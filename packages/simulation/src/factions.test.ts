import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseMoney,
  parseOrganizationId,
  parsePersonId,
  parseTick,
  type FactionProfileId,
  type OrganizationId,
  type PublicContract,
} from "@landlord/shared";
import { canonicalizeState } from "./runner";
import {
  FACTION_ACTION_FAMILY,
  FACTION_POLICY,
  FACTION_PROFILES,
  describeFactions,
  factionProfileIdOf,
  initialFactionState,
  isActionCycleSuppressed,
  publicBidPercentFor,
  recordFactionEncounter,
  rememberFactionAction,
  repetitionPenaltyFor,
  runFactions,
  setFactionProfile,
  stanceFor,
  worstStanceAgainstCompanies,
} from "./factions";
import { PUBLIC_CONTRACTS_POLICY, submitPublicBid } from "./public-contracts";
import { dispatchProductCommand } from "./commands";
import {
  GAME_DAY_TICKS,
  GAME_MONTH_TICKS,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";

const PLAYER = PLAYER_ORGANIZATION_ID;
const RIVAL = RIVAL_ORGANIZATION_ID;

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER, parseMoney(5_000_000));
  state.phase2.balances.set(RIVAL, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(0);
  return state;
}

function atTick(state: GameState, tick: number): void {
  state.clock = { ...state.clock, tick: parseTick(tick) };
}

describe("WP4.10 perfiles de facción", () => {
  it("reproduce los números históricos cuando el perfil es conservador", () => {
    // Fijos a propósito: son los valores que la IA usaba entre WP4.2 y WP4.9. Moverlos cambia
    // decisiones del rival y exige regenerar digestos, así que aquí se detecta ese cambio.
    expect(FACTION_PROFILES.conservative.minimumReservePercent).toBe(30);
    expect(FACTION_PROFILES.conservative.maintenanceConditionThreshold).toBe(55);
    expect(FACTION_PROFILES.conservative.insuranceRiskThreshold).toBe(35);
    expect(FACTION_PROFILES.conservative.contractBidPercent).toBe(
      PUBLIC_CONTRACTS_POLICY.rivalBidPercent,
    );
    expect(Object.values(FACTION_PROFILES.conservative.goalBiasByFamily)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    const state = newState();
    expect(factionProfileIdOf(state, RIVAL)).toBe("conservative");
    expect(publicBidPercentFor(state, RIVAL)).toBe(92);
  });

  it("da a cada organización un perfil distinto sin tocar el selector de estrategia existente", () => {
    const state = newState();
    state.phase2.rivalAi.strategyProfile = "expansionist";
    expect(factionProfileIdOf(state, RIVAL)).toBe("expansionist");
    setFactionProfile(state, PLAYER, "expansionist");
    expect(factionProfileIdOf(state, PLAYER)).toBe("expansionist");
    // El perfil explícito manda sobre el selector heredado.
    setFactionProfile(state, RIVAL, "conservative");
    expect(factionProfileIdOf(state, RIVAL)).toBe("conservative");
    // Un tercero sin perfil ni selector conocido recae en el conservador.
    expect(factionProfileIdOf(state, parseOrganizationId("org_00000004"))).toBe("conservative");
  });

  it("cubre cada acción del repertorio rival con una familia de objetivos", () => {
    const state = newState();
    const actions = new Set<string>();
    for (let month = 1; month <= 2; month += 1) {
      atTick(state, month * GAME_MONTH_TICKS);
      advanceProductSystems(state);
      if (state.phase2.rivalAi.lastAction !== "none") actions.add(state.phase2.rivalAi.lastAction);
    }
    expect(actions.size).toBeGreaterThan(0);
    for (const action of actions) expect(FACTION_ACTION_FAMILY[action]).toBeTruthy();
    expect(Object.keys(FACTION_ACTION_FAMILY)).toHaveLength(14);
  });

  it("el perfil cambia lo que el conservador no podía permitirse", () => {
    const state = newState();
    // Caja justa: por debajo de la reserva conservadora (30%) y por encima de la expansionista (12%).
    state.phase2.balances.set(RIVAL, parseMoney(12_000));
    atTick(state, GAME_DAY_TICKS);
    advanceProductSystems(state);
    const conservativeAction = state.phase2.rivalAi.lastAction;

    setFactionProfile(state, RIVAL, "expansionist");
    state.phase2.balances.set(RIVAL, parseMoney(12_000));
    atTick(state, GAME_DAY_TICKS * 2);
    advanceProductSystems(state);
    expect(state.phase2.rivalAi.lastAction).not.toBe(conservativeAction);
  });

  it("topa la puja por hostilidad sin dejarla por debajo del coste de ejecutar", () => {
    const state = newState();
    recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    // El conservador se aleja del choque: puja un 1,8% menos; el expansionista lo busca y sube 2,4%.
    expect(publicBidPercentFor(state, RIVAL)).toBeCloseTo(90.2, 10);
    setFactionProfile(state, RIVAL, "expansionist");
    expect(publicBidPercentFor(state, RIVAL)).toBeCloseTo(99.4, 10);
    for (let index = 0; index < 40; index += 1)
      recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(FACTION_POLICY.minimumStance);
    // Techo: pujar por encima del presupuesto anunciado sería rechazado por el propio motor.
    expect(publicBidPercentFor(state, RIVAL)).toBe(100);
    setFactionProfile(state, RIVAL, "conservative");
    expect(publicBidPercentFor(state, RIVAL)).toBe(77);
  });
});

describe("WP4.10 encuentros y postura", () => {
  function commit(state: GameState, actor: OrganizationId, victim: OrganizationId, id: string) {
    return dispatchProductCommand(state, {
      type: "CommitCrime",
      commandId: parseCommandId(id),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: actor,
      payload: { targetOrganizationId: victim },
    });
  }

  it("un sabotaje forma hostilidad sólo en la víctima", () => {
    // La detección tira del PRNG de la partida: se busca la primera semilla en la que el golpe llega.
    let state: GameState | undefined;
    for (let seed = 1; seed <= 40 && !state; seed += 1) {
      const candidate = newState(seed);
      atTick(candidate, GAME_DAY_TICKS);
      candidate.phase2.crime.policePressure = 0;
      if (!commit(candidate, PLAYER, RIVAL, "sabotaje-1").accepted) continue;
      if (candidate.phase2.crime.lastOutcome === "detected") continue;
      state = candidate;
    }
    expect(state, "ninguna semilla dejó el sabotaje sin detectar").toBeDefined();
    expect(stanceFor(state!, RIVAL, PLAYER)).toBe(FACTION_POLICY.encounters.sabotage);
    expect(stanceFor(state!, PLAYER, RIVAL)).toBe(0);
    // Nadie se forma opinión a sí mismo.
    recordFactionEncounter(state!, RIVAL, RIVAL, "sabotage");
    expect(stanceFor(state!, RIVAL, RIVAL)).toBe(0);
  });

  it("entrar en una licitación con competidores registrados cuenta el roce", () => {
    const state = newState();
    atTick(state, GAME_MONTH_TICKS);
    const contract: PublicContract = {
      id: "contract_00000001",
      kind: "public_works",
      title: "Obra de prueba",
      budget: parseMoney(400),
      bond: parseMoney(40),
      requiredBuildings: 0,
      publishedAtTick: parseTick(state.clock.tick),
      closesAtTick: parseTick(state.clock.tick + GAME_MONTH_TICKS),
      executesAtTick: parseTick(state.clock.tick + 2 * GAME_MONTH_TICKS),
      status: "open",
      awardedToOrganizationId: null,
      awardedAmount: null,
      // Dos ofertas del mismo competidor: el roce es por empresa, no por oferta.
      bids: [
        { organizationId: RIVAL, amount: parseMoney(10), atTick: parseTick(state.clock.tick) },
        { organizationId: RIVAL, amount: parseMoney(12), atTick: parseTick(state.clock.tick) },
      ],
    };
    state.phase2.contracts.contracts[contract.id] = contract;
    const rejection = submitPublicBid(state, PLAYER, contract.id, parseMoney(20));
    expect(rejection).toBeNull();
    expect(stanceFor(state, PLAYER, RIVAL)).toBe(FACTION_POLICY.encounters.tender_contested);
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(0);
  });

  it("la hostilidad se olvida sola y desaparece del estado al llegar a cero", () => {
    const state = newState();
    recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(-12);
    for (let month = 1; month <= 3; month += 1) {
      atTick(state, month * GAME_MONTH_TICKS);
      advanceProductSystems(state);
    }
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(-3);
    atTick(state, 4 * GAME_MONTH_TICKS);
    advanceProductSystems(state);
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(0);
    // El decaimiento para en cero: no se convierte en amistad por el paso del tiempo.
    expect(Object.keys(state.phase2.factions.stanceByPairId)).toHaveLength(0);
    expect(state.phase2.factions.lastDecayTick).toBe(parseTick(4 * GAME_MONTH_TICKS));
  });

  it("compartir frontera rocea en las dos direcciones y se topa por mes", () => {
    function share(state: GameState, pairs: number): void {
      const parcels = [...state.phase2.parcels.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, pairs * 2);
      // Las celdas se fijan a mano: el reparto del distrito no garantiza parcelas contiguas.
      parcels.forEach((parcel, index) => {
        parcel.ownerOrganizationId = index % 2 === 0 ? PLAYER : RIVAL;
        parcel.anchorCell = { x: index % 2, y: Math.floor(index / 2) };
      });
      atTick(state, GAME_MONTH_TICKS);
      advanceProductSystems(state);
    }

    const state = newState();
    share(state, 1);
    expect(stanceFor(state, PLAYER, RIVAL)).toBe(FACTION_POLICY.encounters.territory);
    expect(stanceFor(state, RIVAL, PLAYER)).toBe(FACTION_POLICY.encounters.territory);

    // Diez fronteras contiguas no declaran una guerra: la presión mensual está topada.
    const wide = newState();
    share(wide, 10);
    expect(stanceFor(wide, PLAYER, RIVAL)).toBe(FACTION_POLICY.territoryCapPerMonth);
    expect(stanceFor(wide, RIVAL, PLAYER)).toBe(FACTION_POLICY.territoryCapPerMonth);

    // La trama real planta a dos celdas porque la calzada va en medio: cara a cara también roza.
    const block = newState();
    const facing = [...block.phase2.parcels.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, 2);
    facing.forEach((parcel, index) => {
      parcel.ownerOrganizationId = index === 0 ? PLAYER : RIVAL;
      parcel.anchorCell = { x: index * 2, y: 0 };
    });
    atTick(block, GAME_MONTH_TICKS);
    advanceProductSystems(block);
    expect(stanceFor(block, PLAYER, RIVAL)).toBe(FACTION_POLICY.encounters.territory);
    expect(stanceFor(block, RIVAL, PLAYER)).toBe(FACTION_POLICY.encounters.territory);
  });

  it("fuera del cierre mensual la postura no se mueve", () => {
    const state = newState();
    recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    for (const tick of [GAME_DAY_TICKS, GAME_DAY_TICKS * 2, GAME_MONTH_TICKS + 1]) {
      atTick(state, tick);
      advanceProductSystems(state);
      expect(stanceFor(state, RIVAL, PLAYER)).toBe(-12);
    }
    expect(state.phase2.factions.lastDecayTick).toBeNull();
  });

  it("la memoria manda sobre la utilidad y el bucle se corta solo", () => {
    const state = newState();
    expect(repetitionPenaltyFor(state, RIVAL, "buy_parcel", "parcel_00000002")).toBe(0);
    expect(isActionCycleSuppressed(state, RIVAL, "buy_parcel", "parcel_00000002")).toBe(false);
    for (let index = 0; index < 2; index += 1)
      rememberFactionAction(state, RIVAL, {
        action: "buy_parcel",
        target: "parcel_00000002",
        accepted: false,
        rejectionCode: "PARCEL_NOT_AVAILABLE",
      });
    // Dos rechazos cuestan, pero no vetan: si el contexto mejora la acción sigue siendo elegible.
    expect(repetitionPenaltyFor(state, RIVAL, "buy_parcel", "parcel_00000002")).toBe(
      FACTION_POLICY.repetition.rejectionPenalty,
    );
    expect(isActionCycleSuppressed(state, RIVAL, "buy_parcel", "parcel_00000002")).toBe(false);
    // Un blanco distinto no comparte el castigo: insistir en otra parcela es otra decisión.
    expect(repetitionPenaltyFor(state, RIVAL, "buy_parcel", "parcel_00000003")).toBe(0);
    // Repetir con éxito es trabajo, no un bucle: no acumula golpes aunque repita la clave.
    for (let index = 0; index < 5; index += 1)
      rememberFactionAction(state, RIVAL, {
        action: "buy_parcel",
        target: "parcel_00000003",
        accepted: true,
        rejectionCode: null,
      });
    expect(repetitionPenaltyFor(state, RIVAL, "buy_parcel", "parcel_00000003")).toBe(0);
    expect(isActionCycleSuppressed(state, RIVAL, "buy_parcel", "parcel_00000003")).toBe(false);
    // El tercer rechazo saca la acción del menú hasta que la ventana la olvide.
    rememberFactionAction(state, RIVAL, {
      action: "buy_parcel",
      target: "parcel_00000002",
      accepted: false,
      rejectionCode: "PARCEL_NOT_AVAILABLE",
    });
    expect(isActionCycleSuppressed(state, RIVAL, "buy_parcel", "parcel_00000002")).toBe(true);
    // El contador de ciclos sólo lo mueve la capa de decisión, no el registro de memoria.
    expect(describeFactions(state, RIVAL).cyclesSuppressed).toBe(0);
  });

  it("la memoria está acotada por tamaño y por ventana", () => {
    const state = newState();
    for (let index = 0; index < 40; index += 1)
      rememberFactionAction(state, RIVAL, {
        action: "buy_parcel",
        target: `parcel_${String(index).padStart(8, "0")}`,
        accepted: false,
        rejectionCode: "PARCEL_NOT_AVAILABLE",
      });
    const entries = state.phase2.factions.memoryByOrganizationId[RIVAL]!;
    expect(entries).toHaveLength(FACTION_POLICY.memoryLimitPerOrganization);
    expect(entries[0]!.target).toBe("parcel_00000028");
    // Pasada la ventana, el recuerdo deja de pesar y la organización puede volver a intentarlo.
    state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
    atTick(state, FACTION_POLICY.memoryWindowTicks + GAME_MONTH_TICKS);
    advanceProductSystems(state);
    expect(state.phase2.factions.memoryByOrganizationId[RIVAL]).toBeUndefined();
    expect(repetitionPenaltyFor(state, RIVAL, "buy_parcel", "parcel_00000039")).toBe(0);
  });
});

describe("WP4.10 persistencia y cota de información", () => {
  /** Lo que decide el rival en el próximo día: acción, motivo y su propia caja. */
  function rivalDecision(state: GameState): Record<string, unknown> {
    const working = restoreStateFromSnapshot(serializeSnapshot(state));
    atTick(working, GAME_DAY_TICKS);
    advanceProductSystems(working);
    return {
      action: working.phase2.rivalAi.lastAction,
      reason: working.phase2.rivalAi.lastReason,
      failure: working.phase2.rivalAi.lastFailureCode,
      rivalBalance: working.phase2.balances.get(RIVAL),
      rivalParcels: [...working.phase2.parcels.values()].filter(
        (parcel) => parcel.ownerOrganizationId === RIVAL,
      ).length,
      rivalBuildings: working.phase2.buildings.size,
    };
  }

  it("viaja intacta por el guardado y llega de partida antigua sin el campo", () => {
    const state = newState();
    recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    recordFactionEncounter(state, PLAYER, RIVAL, "auction_outbid");
    rememberFactionAction(state, RIVAL, {
      action: "buy_parcel",
      target: "parcel_00000002",
      accepted: false,
      rejectionCode: "PARCEL_NOT_AVAILABLE",
    });
    atTick(state, GAME_MONTH_TICKS);
    runFactions(state);
    expect(restoreStateFromSnapshot(serializeSnapshot(state)).phase2.factions).toEqual(
      state.phase2.factions,
    );

    const legacy = serializeSnapshot(newState());
    delete legacy.phase2!.factions;
    const migrated = restoreStateFromSnapshot(legacy);
    expect(migrated.phase2.factions).toEqual(initialFactionState());
    expect(migrated.phase2.factions.stanceByPairId).toEqual({});
  });

  it("dos partidas con la misma semilla y comandos terminan igual", () => {
    const build = () => {
      const state = newState(19);
      for (const tick of [GAME_DAY_TICKS, GAME_MONTH_TICKS, 2 * GAME_MONTH_TICKS]) {
        atTick(state, tick);
        advanceProductSystems(state);
      }
      return serializeSnapshot(state).phase2!.factions;
    };
    expect(build()).toEqual(build());
  });

  it("la postura y el perfil no salen hacia la proyección del jugador", () => {
    const state = newState();
    recordFactionEncounter(state, RIVAL, PLAYER, "sabotage");
    recordFactionEncounter(state, PLAYER, RIVAL, "tender_contested");
    setFactionProfile(state, RIVAL, "expansionist");
    const json = JSON.stringify(createViewProjection(state, true));
    expect(json).not.toContain("expansionist");
    expect(json).not.toContain("stanceByPairId");
    expect(describeFactions(state, RIVAL)).toMatchObject({
      profileId: "expansionist",
      contractBidPercent: 97,
      minimumReservePercent: 12,
      worstStance: FACTION_POLICY.encounters.sabotage,
      rememberedActions: 0,
    });
    expect(worstStanceAgainstCompanies(state, PLAYER)).toBe(
      FACTION_POLICY.encounters.tender_contested,
    );
  });

  it("la IA no mueve su decisión según lo que el jugador guarda para sí", () => {
    const base = newState();
    const expected = rivalDecision(base);
    expect(expected.action).not.toBe("none");
    const mutations: Array<[string, (state: GameState) => void]> = [
      ["caja del jugador", (state) => state.phase2.balances.set(PLAYER, parseMoney(9_333_333))],
      [
        "inventario del jugador",
        (state) => {
          const inventory = state.phase2.inventories.get(PLAYER)!;
          inventory.cement = 999;
          inventory.brick = 999;
          inventory.steel = 999;
        },
      ],
      [
        "deuda del jugador",
        (state) => {
          for (const loan of state.phase2.loans.values())
            if (loan.borrowerOrganizationId === PLAYER)
              loan.outstandingPrincipal = parseMoney(4_444_444);
        },
      ],
      [
        "impagos del jugador",
        (state) => {
          state.phase2.taxation.arrearsByOrganizationId[PLAYER] = parseMoney(3_111_111);
        },
      ],
      [
        "búsqueda de los hogares",
        (state) => {
          for (const tenant of state.phase2.tenants.values()) tenant.searchMonths = 77;
        },
      ],
      [
        "pujas pendientes del jugador",
        (state) => {
          for (const auction of Object.values(state.phase2.insolvency.auctionsByLoanId))
            auction.reservedFundsByOrganizationId[PLAYER] = parseMoney(8_888_888);
        },
      ],
      [
        "reputación del jugador ante la banca",
        (state) => {
          state.phase2.reputation.standingByOrganizationId[PLAYER] = { banks: -100 };
        },
      ],
    ];
    for (const [label, mutate] of mutations) {
      const poisoned = newState();
      mutate(poisoned);
      expect(rivalDecision(poisoned), label).toEqual(expected);
    }
  }, 120_000);
});

describe("WP4.10 campañas headless", () => {
  function campaign(seed: number, profile: FactionProfileId, months: number): GameState {
    const state = createInitialState(seed);
    setFactionProfile(state, RIVAL, profile);
    for (let tick = 0; tick < months * GAME_MONTH_TICKS; tick += 1) advanceProductSystems(state);
    return state;
  }

  function scoreboard(state: GameState): Record<string, number> {
    const rivalParcels = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.ownerOrganizationId === RIVAL,
    ).length;
    return {
      rivalBalance: state.phase2.balances.get(RIVAL) ?? 0,
      playerBalance: state.phase2.balances.get(PLAYER) ?? 0,
      rivalParcels,
      rivalBuildings: [...state.phase2.buildings.values()].filter(
        (building) => building.ownerOrganizationId === RIVAL,
      ).length,
      transactions: state.phase2.transactions.length,
      failedActions: state.phase2.rivalAi.memory.lossCount,
    };
  }

  const conservative = campaign(4, "conservative", 2);
  const expansionist = campaign(4, "expansionist", 2);

  /**
   * V.d.0 cambió el alcance del rival: hasta que existan traslados y mercados distritales (V.d.2),
   * la IA sólo opera en el distrito donde tiene cuadrillas. Con un mercado de ~25 parcelas, el suelo
   * de reserva de 2 500 domina al porcentaje de cada perfil y los dos convergen a los dos meses. Se
   * conserva lo que sigue siendo cierto —ambos perfiles compran y construyen— y se deja anotada la
   * divergencia como deuda de V.d.2 en el acta de V.d.0.
   */
  it("ambos perfiles operan en su distrito y respetan su propio suelo de reserva", () => {
    for (const state of [conservative, expansionist]) {
      const board = scoreboard(state);
      expect(board.rivalParcels).toBeGreaterThan(0);
      expect(board.rivalBuildings).toBeGreaterThan(0);
      expect(board.rivalBalance).toBeGreaterThanOrEqual(0);
    }
    // La divergencia entre perfiles vuelve cuando la IA tenga traslados y mercados por distrito.
    expect(scoreboard(conservative)).toEqual(scoreboard(expansionist));
  });

  it("una ciudad grande corta sus propios bucles en vez de insistir", () => {
    const city = createScaledCity(7, { parcelCount: 50, incidentCount: 12 });
    for (let tick = 0; tick < 2 * GAME_MONTH_TICKS; tick += 1) advanceProductSystems(city);

    // Ninguna acción se golpea contra el mismo muro más de lo que permite la supresión.
    for (const entries of Object.values(city.phase2.factions.memoryByOrganizationId)) {
      const strikes = new Map<string, number>();
      for (const entry of entries.filter((candidate) => !candidate.accepted)) {
        const key = `${entry.action}:${entry.target}`;
        strikes.set(key, (strikes.get(key) ?? 0) + 1);
      }
      for (const [key, count] of [...strikes.entries()].sort(([left], [right]) =>
        left.localeCompare(right),
      ))
        expect(count, key).toBeLessThanOrEqual(FACTION_POLICY.repetition.suppressionStrikes);
    }
    expect(describeFactions(city, RIVAL).cyclesSuppressed).toBeGreaterThan(0);
    // Dos promotoras con decenas de parcelas en la misma trama no pueden seguir sin tocarse.
    expect(Object.keys(city.phase2.factions.stanceByPairId).length).toBeGreaterThan(0);
    expect(stanceFor(city, RIVAL, PLAYER)).toBeLessThan(0);
  });

  it("el roster de acciones rivales sólo usa acciones con familia conocida", () => {
    for (const state of [conservative, expansionist]) {
      const actions = new Set(
        Object.values(state.phase2.factions.memoryByOrganizationId)
          .flat()
          .map((entry) => entry.action),
      );
      for (const action of actions) expect(FACTION_ACTION_FAMILY[action], action).toBeTruthy();
    }
  });

  it("la campaña deja memoria acotada, posturas topadas y cierre mensual anotado", () => {
    for (const [label, state] of [
      ["conservadora", conservative],
      ["expansionista", expansionist],
    ] as const) {
      for (const entries of Object.values(state.phase2.factions.memoryByOrganizationId))
        expect(entries.length, label).toBeLessThanOrEqual(
          FACTION_POLICY.memoryLimitPerOrganization,
        );
      for (const [key, value] of Object.entries(state.phase2.factions.stanceByPairId)) {
        expect(value, `${label} ${key}`).toBeGreaterThanOrEqual(FACTION_POLICY.minimumStance);
        expect(value, `${label} ${key}`).toBeLessThanOrEqual(FACTION_POLICY.maximumStance);
        expect(value, `${label} ${key}`).not.toBe(0);
      }
      // La campaña recorre los ticks 0..2*mes-1, así que sólo cruza el cierre de 36000.
      expect(state.phase2.factions.lastDecayTick).toBe(parseTick(GAME_MONTH_TICKS));
      for (const balance of state.phase2.balances.values()) {
        expect(Number.isInteger(balance), label).toBe(true);
        expect(balance, label).toBeGreaterThanOrEqual(0);
      }
      expect(describeFactions(state, RIVAL).cyclesSuppressed, label).toBeGreaterThanOrEqual(0);
    }
  });

  it("la misma semilla y el mismo perfil reproducen la misma campaña", () => {
    const again = campaign(4, "expansionist", 2);
    expect(canonicalizeState(again)).toBe(canonicalizeState(expansionist));
  });
});

import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseIncidentId,
  parseMoney,
  parsePolicyId,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingId,
  type PoliticalIssue,
  type Tenant,
  type TenantId,
} from "@landlord/shared";
import {
  GAME_MONTH_TICKS,
  MUNICIPAL_PARTY_CATALOG,
  MUNICIPAL_POLICY_CATALOG,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import {
  MUNICIPAL_ELECTION_POLICY,
  MUNICIPAL_INSTITUTION,
  MUNICIPAL_MOOD_POLICY,
  POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT,
  budgetPriorityFor,
  computeCivicMood,
  councilAlignmentPercent,
  describeMunicipalPolitics,
  initialMunicipalPoliticsState,
  politicalPartyById,
  runMunicipalPolitics,
} from "./municipal-politics";
import { MUNICIPAL_BUDGET_POLICY, runMunicipalBudget } from "./municipal-budget";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";
import { canonicalizeState } from "./runner";
import { createScaledCity } from "./system-cost";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";

/** Distrito de prueba con el rival y las finanzas acallados: sólo gobierna la política. */
function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addHome(state: GameState, index: number): BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  return id;
}

/** Hogar con las llaves puestas: un votante, y un pago de renta que la opinión puede medir. */
function contractHome(
  state: GameState,
  buildingId: BuildingId,
  ordinal: number,
  budget: number,
): TenantId {
  const id = parseTenantId(`tenant_${String(ordinal).padStart(8, "0")}`);
  const tenant: Tenant = {
    id,
    profile: "household",
    budget: parseMoney(budget),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: buildingId,
    satisfaction: 70,
    leaseRemaining: 2,
    status: "contracted",
    size: 2,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "market",
  };
  state.phase2.tenants.set(id, tenant);
  const building = state.phase2.buildings.get(buildingId)!;
  building.tenantIds = [...building.tenantIds, id];
  building.tenantId = id;
  return id;
}

function moodWithHomes(state: GameState, rentBudget: number): Record<PoliticalIssue, number> {
  const buildingId = addHome(state, 0);
  contractHome(state, buildingId, 90, rentBudget);
  return computeCivicMood(state);
}

/** Avanza una campaña headless hasta el cierre del mes indicado, con el sistema político en marcha. */
function advanceToMonth(state: GameState, month: number): GameState {
  for (let tick = 0; tick < GAME_MONTH_TICKS * month; tick += 1) advanceProductSystems(state);
  return state;
}

describe("WP4.11 institución y calendario municipal", () => {
  it("abre la legislatura con el concejo repartido y la primera elección ya en el calendario", () => {
    const state = newState();
    const politics = state.phase2.politics;
    const seats = Object.values(politics.seatsByPartyId);
    expect(seats.reduce((sum, value) => sum + value, 0)).toBe(MUNICIPAL_INSTITUTION.councilSeats);
    expect(politics.nextElectionTick).toBe(GAME_MONTH_TICKS * MUNICIPAL_INSTITUTION.termMonths);
    expect(politics.electionsHeld).toBe(0);
    expect(politics.lastElectionTick).toBeNull();
    expect(politics.lastMoodTick).toBeNull();
    /** El partido que gobierna es el que más escaños trajo, y está definido desde el primer tick. */
    expect(politics.governingPartyId).toBe(
      [...MUNICIPAL_PARTY_CATALOG].sort(
        (left, right) => right.openingSeats - left.openingSeats || left.id.localeCompare(right.id),
      )[0]!.id,
    );
    for (const issue of Object.keys(politics.moodByIssue)) {
      expect(politics.moodByIssue[issue], issue).toBe(100);
    }
  });

  it("cada plataforma es datos consumibles: las cuatro categorías y una ordenanza del catálogo", () => {
    const categories = new Set<string>(MUNICIPAL_BUDGET_POLICY.priority);
    for (const party of MUNICIPAL_PARTY_CATALOG) {
      expect(new Set(party.budgetPriority).size, party.id).toBe(
        MUNICIPAL_BUDGET_POLICY.priority.length,
      );
      for (const category of party.budgetPriority) {
        expect(categories.has(category), `${party.id} ${category}`).toBe(true);
      }
      expect(
        MUNICIPAL_POLICY_CATALOG.some((policy) => policy.id === party.preferredOrdinanceId),
        party.id,
      ).toBe(true);
      for (const issue of Object.keys(POLITICAL_PRIORITY_WEIGHTS_BY_SEGMENT.household!)) {
        expect(
          party.positionByIssue[issue as PoliticalIssue],
          `${party.id} ${issue}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          party.positionByIssue[issue as PoliticalIssue],
          `${party.id} ${issue}`,
        ).toBeLessThanOrEqual(100);
      }
    }
    /** El reparto de apertura llena el concejo justo: sin eso la gobernanza inicial sería ambigua. */
    expect(MUNICIPAL_PARTY_CATALOG.reduce((sum, party) => sum + party.openingSeats, 0)).toBe(
      MUNICIPAL_INSTITUTION.councilSeats,
    );
  });

  it("mide la opinión cada mes y ancla el calendario a la semilla, no al reloj de render", () => {
    const state = newState();
    runMunicipalPolitics(state);
    expect(state.phase2.politics.lastMoodTick).toBeNull();

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalPolitics(state);
    expect(state.phase2.politics.lastMoodTick).toBe(GAME_MONTH_TICKS);
    expect(state.phase2.politics.electionsHeld).toBe(0);

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 6) };
    runMunicipalPolitics(state);
    expect(state.phase2.politics.electionsHeld).toBe(1);
    expect(state.phase2.politics.nextElectionTick).toBe(GAME_MONTH_TICKS * 12);
    expect(state.phase2.politics.nextDebateTick).toBe(GAME_MONTH_TICKS * 8);
  });
});

describe("WP4.11 opinión a partir del estado social", () => {
  it("la renta frente al presupuesto de los hogares es queja de vivienda", () => {
    const state = newState();
    expect(moodWithHomes(state, 1_000).housing).toBe(100);
    const squeezed = moodWithHomes(newState(7), 200);
    expect(squeezed.housing).toBeLessThan(100);
    /** Vivir por encima del presupuesto no es una queja lineal infinita: el eje se topa en cero. */
    expect(moodWithHomes(newState(7), 20).housing).toBeGreaterThanOrEqual(
      MUNICIPAL_MOOD_POLICY.housingComfortableRentSharePercent -
        MUNICIPAL_MOOD_POLICY.housingComfortableRentSharePercent,
    );
    expect(moodWithHomes(newState(7), 20).housing).toBe(0);
  });

  it("el empleo del distrito es la opinión de empleo", () => {
    const state = newState();
    addHome(state, 0);
    contractHome(state, addHome(state, 1), 91, 1_000);
    const mood = computeCivicMood(state);
    /** Sin edificios operacionales de sectores con empleo, ningún hogar contratado trabaja. */
    expect(mood.employment).toBe(0);
    expect(mood.employment).toBeLessThan(mood.housing);
  });

  it("las ruinas y los siniestros del mes pesan contra la seguridad", () => {
    const calm = computeCivicMood(newState());
    const state = newState();
    const buildingId = addHome(state, 0);
    state.phase2.buildings.get(buildingId)!.state = "ruin";
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId,
      origin: "sabotage",
      intensity: 1,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(state.clock.tick),
      causedByAgentId: null,
      causedByOrganizationId: null,
      casualties: { injured: 1, dead: 0 },
    } as import("@landlord/shared").IncidentRecord);
    state.phase2.crime.policePressure = 3;
    const mood = computeCivicMood(state);
    expect(mood.safety).toBeLessThan(calm.safety);
    expect(mood.safety).toBe(
      Math.max(
        0,
        100 -
          3 * MUNICIPAL_MOOD_POLICY.safetyPolicePressurePenalty -
          1 * MUNICIPAL_MOOD_POLICY.safetyRuinPenalty -
          1 * MUNICIPAL_MOOD_POLICY.safetyIncidentPenalty,
      ),
    );
  });

  it("los servicios sin financiar y la carga fiscal alta se leen como queja", () => {
    const state = newState();
    const buildingId = addHome(state, 0);
    contractHome(state, buildingId, 92, 1_000);
    state.phase2.municipal.serviceLevelPercentByCategory.transport = 0;
    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    state.phase2.municipal.serviceLevelPercentByCategory.cleaning = 0;
    expect(computeCivicMood(state).services).toBe(0);

    const relaxed = computeCivicMood(newState());
    expect(relaxed.taxes).toBe(100);
    /** El municipio que se queda más de la parte cómoda de la renta del distrito genera queja. */
    const greedy = newState();
    const home = addHome(greedy, 0);
    contractHome(greedy, home, 93, 1_000);
    greedy.phase2.municipal.revenueThisMonthBySource.propertyTax = parseMoney(2_000);
    expect(computeCivicMood(greedy).taxes).toBeLessThan(100);
  });

  it("la opinión se guarda en el estado y no se recalcula en la proyección", () => {
    const state = newState();
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalPolitics(state);
    const report = describeMunicipalPolitics(state);
    for (const issue of Object.keys(report.moodByIssue)) {
      expect(state.phase2.politics.moodByIssue[issue], issue).toBe(report.moodByIssue[issue]);
    }
  });
});

describe("WP4.11 voto, participación y transferencia institucional", () => {
  it("la misma semilla y el mismo estado producen exactamente el mismo resultado", () => {
    const left = advanceToMonth(newState(3), MUNICIPAL_INSTITUTION.termMonths + 1);
    const right = advanceToMonth(newState(3), MUNICIPAL_INSTITUTION.termMonths + 1);
    expect(left.phase2.politics).toEqual(right.phase2.politics);
    expect(canonicalizeState(left)).toBe(canonicalizeState(right));
  });

  it("la queja mobiliza: el distrito degradado vota más alto que el distrito tranquilo", () => {
    /** Un electorado pequeño hace la participación ruidosa; el distrito grande muestra la tendencia. */
    const elect = (degraded: boolean) => {
      const state = createScaledCity(4, { parcelCount: 24 });
      if (degraded) {
        for (const buildingType of Object.keys(
          state.phase2.housingMarket.rentIndexPercentByBuildingType,
        )) {
          state.phase2.housingMarket.rentIndexPercentByBuildingType[buildingType] = 300;
        }
        for (const category of ["transport", "security", "cleaning"] as const) {
          state.phase2.municipal.serviceLevelPercentByCategory[category] = 0;
        }
        state.phase2.crime.policePressure = 8;
      }
      state.clock = {
        ...state.clock,
        tick: parseTick(GAME_MONTH_TICKS * MUNICIPAL_INSTITUTION.termMonths),
      };
      runMunicipalPolitics(state);
      return state.phase2.politics;
    };
    const calm = elect(false);
    const angry = elect(true);
    expect(angry.moodByIssue.housing).toBeLessThan(calm.moodByIssue.housing!);
    expect(angry.lastTurnoutPercent).toBeGreaterThan(calm.lastTurnoutPercent);
  });

  it("el voto castiga al partido que gobernaba con un asunto suyo roto", () => {
    const state = newState(11);
    for (let index = 0; index < 6; index += 1) {
      contractHome(state, addHome(state, index), 200 + index, 1_000);
    }
    /** Renta por las nubes: la queja de vivienda manda en todos los votantes. */
    state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home = 900;
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 6) };
    runMunicipalPolitics(state);
    const politics = state.phase2.politics;
    expect(politics.moodByIssue.housing).toBeLessThan(50);
    expect(politics.electionsHeld).toBe(1);
    /** La formación con más saliencia de vivienda recoge el voto de castigo. */
    expect(politics.governingPartyId).toBe("party_suelo_comun");
    expect(politics.seatsByPartyId.party_suelo_comun!).toBeGreaterThan(
      politics.seatsByPartyId.party_trabajo_local!,
    );
  });

  it("el reparto no es a ganador absoluto: dos asuntos rotos dejan escaños para la oposición", () => {
    const state = newState(11);
    for (let index = 0; index < 6; index += 1) {
      contractHome(state, addHome(state, index), 400 + index, 1_000);
    }
    /** Renta y empleo a la vez: ningún partido representa solo el dolor del distrito. */
    state.phase2.housingMarket.rentIndexPercentByBuildingType.courtyard_home = 900;
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 6) };
    runMunicipalPolitics(state);
    const seats = Object.values(state.phase2.politics.seatsByPartyId);
    expect(seats.reduce((sum, value) => sum + value, 0)).toBe(MUNICIPAL_INSTITUTION.councilSeats);
    expect(seats.filter((value) => value > 0).length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...seats)).toBeLessThan(MUNICIPAL_INSTITUTION.councilSeats);
    /** El partido sin escaños aparece igual en el apoyo público: la cámara no borra a quien perdió. */
    expect(Object.keys(state.phase2.politics.supportPercentByPartyId)).toHaveLength(
      MUNICIPAL_PARTY_CATALOG.length,
    );
  });

  it("el jugador no vota: la misma participación y escaños con máxima influencia o sin ninguna", () => {
    const build = (influence: number) => {
      const state = newState(5);
      for (let index = 0; index < 4; index += 1) {
        contractHome(state, addHome(state, index), 300 + index, 1_000);
      }
      state.phase2.influenceByOrganizationId.set(PLAYER_ORGANIZATION_ID, influence);
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 6) };
      runMunicipalPolitics(state);
      return state.phase2.politics;
    };
    expect(build(0)).toEqual(build(50));
  });

  it("la transferencia reordena el presupuesto: la misma caja financia categorías distintas", () => {
    const settle = (governingPartyId: string) => {
      const state = newState(9);
      for (let index = 0; index < 3; index += 1) addHome(state, index);
      state.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(15));
      state.phase2.politics.governingPartyId = governingPartyId;
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
      runMunicipalBudget(state);
      return {
        priority: [...budgetPriorityFor(state, MUNICIPAL_BUDGET_POLICY.priority)],
        levels: { ...state.phase2.municipal.serviceLevelPercentByCategory },
      };
    };
    const growth = settle("party_trabajo_local");
    const austerity = settle("party_cuentas_claras");
    expect(growth.priority).not.toEqual(austerity.priority);
    /** Con los mismos 15 de caja, la plataforma de obras paga transporte entero y deja la
     * administración a medias; la de cuentas al revés. */
    expect(growth.levels.transport).toBe(100);
    expect(growth.levels.administration).toBe(90);
    expect(austerity.levels.administration).toBe(100);
    expect(austerity.levels.transport).toBe(83);
    expect(austerity.levels.cleaning).toBe(0);
  });

  it("el concejo impone su ordenanza en el debate cuando la mesa está libre", () => {
    const state = newState(13);
    state.phase2.ordinance.status = "expired";
    state.phase2.politics.nextElectionTick = parseTick(GAME_MONTH_TICKS * 12);
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 8) };
    state.phase2.politics.nextDebateTick = parseTick(GAME_MONTH_TICKS * 8);
    state.phase2.politics.governingPartyId = "party_suelo_comun";
    runMunicipalPolitics(state);
    expect(state.phase2.ordinance.id).toBe(parsePolicyId("policy_00000004"));
    expect(["active", "rejected"]).toContain(state.phase2.ordinance.status);
    expect(state.phase2.politics.nextDebateTick).toBeNull();
  });

  it("si otra ordenanza ocupa la mesa, el debate se pospone un mes en vez de borrarla", () => {
    const state = newState(13);
    state.phase2.ordinance = {
      ...state.phase2.ordinance,
      id: parsePolicyId("policy_00000001"),
      status: "active",
      expiresAtTick: parseTick(GAME_MONTH_TICKS * 20),
    };
    state.phase2.politics.governingPartyId = "party_suelo_comun";
    state.phase2.politics.nextElectionTick = parseTick(GAME_MONTH_TICKS * 12);
    state.phase2.politics.nextDebateTick = parseTick(GAME_MONTH_TICKS * 8);
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 8) };
    runMunicipalPolitics(state);
    expect(state.phase2.ordinance.id).toBe(parsePolicyId("policy_00000001"));
    expect(state.phase2.politics.nextDebateTick).toBe(GAME_MONTH_TICKS * 9);
  });

  it("el alineamiento del concejo modula la ley: la misma ordenanza sube o baja según quién gobierne", () => {
    const state = newState();
    const bill = MUNICIPAL_POLICY_CATALOG.find(
      (policy) => policy.id === parsePolicyId("policy_00000004"),
    )!;
    state.phase2.politics.governingPartyId = "party_suelo_comun";
    const friendly = councilAlignmentPercent(state, bill);
    state.phase2.politics.governingPartyId = "party_trabajo_local";
    const hostile = councilAlignmentPercent(state, bill);
    expect(friendly).toBeGreaterThan(0);
    expect(hostile).toBeLessThan(0);
    /** Topado: ninguna formación bloquea o aprueba una ley ella sola. */
    expect(Math.abs(friendly)).toBeLessThanOrEqual(25);
    expect(Math.abs(hostile)).toBeLessThanOrEqual(25);
  });
});

describe("WP4.11 persistencia, proyección y campaña", () => {
  it("guarda y carga el concejo entero, incluida la opinión y el calendario", () => {
    const state = advanceToMonth(newState(3), MUNICIPAL_INSTITUTION.termMonths + 1);
    const before = describeMunicipalPolitics(state);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(describeMunicipalPolitics(restored)).toEqual(before);
    expect(restored.phase2.politics).toEqual(state.phase2.politics);
    /**
     * Comparación estructural: `canonicalizeState` serializa con JSON.stringify y el orden de
     * claves de un estado restaurado difiere del original sin que cambie ningún valor (deuda
     * documentada en la prueba de generación de distrito).
     */
    expect(JSON.parse(canonicalizeState(restored))).toEqual(JSON.parse(canonicalizeState(state)));
  });

  it("una partida anterior sin concejo arranca con la legislatura de referencia", () => {
    const state = newState();
    const snapshot = serializeSnapshot(state) as unknown as Record<string, unknown>;
    (snapshot.phase2 as Record<string, unknown>).politics = undefined;
    const restored = restoreStateFromSnapshot(snapshot as never);
    expect(restored.phase2.politics).toEqual(initialMunicipalPoliticsState());
    expect(restored.phase2.politics.governingPartyId).toBe(state.phase2.politics.governingPartyId);
  });

  it("la proyección expone escaños, opinión y participación sin publicar el mecanismo interno", () => {
    const state = advanceToMonth(newState(3), MUNICIPAL_INSTITUTION.termMonths + 1);
    const politics = createViewProjection(state, true).economy!.politics;
    expect(politics.parties.map((party) => party.id)).toEqual(
      MUNICIPAL_PARTY_CATALOG.map((party) => party.id),
    );
    expect(politics.governingPartyName).not.toBe("");
    expect(politics.electionsHeld).toBeGreaterThan(0);
    expect(politics.nextElectionTick).toBe(GAME_MONTH_TICKS * 12);
    expect(Object.keys(politics.moodByIssue).sort()).toEqual(
      ["employment", "housing", "safety", "services", "taxes"].sort(),
    );
    expect(JSON.stringify(politics)).not.toContain("positionByIssue_");
    /** El voto de cada hogar no se persiste ni se proyecta: sólo el agregado. */
    expect(JSON.stringify(politics)).not.toMatch(/tenant_/);
  });

  it("una campaña de dos años cruza tres elecciones y el resultado no es el que el jugador decide", () => {
    const city = createScaledCity(4, { parcelCount: 24 });
    const state = advanceToMonth(city, 24);
    const politics = state.phase2.politics;
    /** Meses 6, 12 y 18: el cierre del mes 24 queda fuera de la ventana medida. */
    expect(politics.electionsHeld).toBe(3);
    expect(Object.values(politics.seatsByPartyId).reduce((sum, seats) => sum + seats, 0)).toBe(
      MUNICIPAL_INSTITUTION.councilSeats,
    );
    for (const share of Object.values(politics.supportPercentByPartyId)) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(100);
    }
    expect(politics.lastTurnoutPercent).toBeGreaterThanOrEqual(
      MUNICIPAL_ELECTION_POLICY.minimumTurnoutPercent,
    );
    expect(politics.lastTurnoutPercent).toBeLessThanOrEqual(
      MUNICIPAL_ELECTION_POLICY.maximumTurnoutPercent,
    );
    /** El concejo acaba legislando solo: la ordenanza vigente es del catálogo. */
    expect(MUNICIPAL_POLICY_CATALOG.some((policy) => policy.id === state.phase2.ordinance.id)).toBe(
      true,
    );
    /**
     * Aceptación: en una campaña normal el distrito despide al gobierno con el que abrió la
     * legislatura. Nadie del jugador decide ese cambio; lo produce la opinión medida cada mes.
     */
    expect(politics.governingPartyId).not.toBe(initialMunicipalPoliticsState().governingPartyId);
  });

  it("ninguna formación del catálogo reproduce la nomenclatura de un partido real", () => {
    const names = MUNICIPAL_PARTY_CATALOG.map((party) => party.name.toLowerCase());
    for (const name of names) {
      expect(name).not.toMatch(
        /partido popular|socialista obrero|podemos|izquierda unida|ciudadanos|vox|demócrata|republicano|conservador|labour|blues|rosas/,
      );
      expect(name.length).toBeLessThanOrEqual(80);
    }
    /** Son tres plataformas distintas: si dos fueran iguales el voto no elegiría nada. */
    const signatures = MUNICIPAL_PARTY_CATALOG.map((party) =>
      Object.values(party.positionByIssue).join(":"),
    );
    expect(new Set(signatures).size).toBe(MUNICIPAL_PARTY_CATALOG.length);
    const priorities = MUNICIPAL_PARTY_CATALOG.map((party) => party.budgetPriority.join(">"));
    expect(new Set(priorities).size).toBe(MUNICIPAL_PARTY_CATALOG.length);
  });

  it("el sistema político no toca la caja: la conservación del distrito sigue cerrando", () => {
    const state = newState(21);
    const buildingId = addHome(state, 0);
    contractHome(state, buildingId, 99, 1_000);
    const balancesBefore = [...state.phase2.balances.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const transactionsBefore = state.phase2.transactions.length;
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS * 6) };
    runMunicipalPolitics(state);
    const balancesAfter = [...state.phase2.balances.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
    expect(balancesAfter).toEqual(balancesBefore);
    expect(state.phase2.transactions.length).toBe(transactionsBefore);
    expect(politicalPartyById(state.phase2.politics.governingPartyId)).not.toBeNull();
  });
});

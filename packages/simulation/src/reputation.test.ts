import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingId,
  type OrganizationId,
  type ParcelId,
  type Tenant,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { createViewProjection } from "./projection";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { HOUSING_SEGMENTS, desirabilityOf } from "./housing-market";
import {
  REPUTATION_GROUPS,
  REPUTATION_POLICY,
  bankRateModifierBpsFor,
  describeReputation,
  influenceGainFor,
  initialReputationState,
  recordReputationFact,
  residentFactorPercentFor,
  runReputation,
  standingFor,
} from "./reputation";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/** Estado de prueba con caja holgada y rival silenciado: sólo manda la reputación. */
function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.balances.set(RIVAL_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function settleAt(state: GameState, month: number): void {
  state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
  runReputation(state);
}

/** Cierre mensual completo: la renta desaloja y la reputación lo anota en el mismo tick. */
function advanceMonth(state: GameState, month: number): void {
  state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
  advanceProductSystems(state);
}

function addBuilding(
  state: GameState,
  index: number,
  options: { owner?: OrganizationId; condition?: number } = {},
): BuildingId {
  const owner = options.owner ?? PLAYER_ORGANIZATION_ID;
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = owner;
  const building: Building = {
    id,
    parcelId: parcel.id,
    districtId: parcel.districtId,
    footprintCells: [{ ...parcel.anchorCell }],
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId: owner,
    productionFacilityId: null,
    type: "courtyard_home",
    level: 1,
    condition: options.condition ?? 100,
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

function addTenant(state: GameState, index: number, buildingId: BuildingId): void {
  const tenantId = parseTenantId(`tenant_${String(index).padStart(8, "0")}`);
  const tenant: Tenant = {
    id: tenantId,
    profile: "household",
    budget: parseMoney(0),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: buildingId,
    marketDistrictId: null,
    satisfaction: 0,
    leaseRemaining: 12,
    status: "contracted",
    size: 1,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
  };
  state.phase2.tenants.set(tenantId, tenant);
  const building = state.phase2.buildings.get(buildingId)!;
  building.tenantIds.push(tenantId);
  building.tenantId = tenantId;
}

/** Parcela comprada y tasada para que el colateral cubra el préstamo pedido. */
function collateralizedParcel(state: GameState): ParcelId {
  const parcelId = parseParcelId("parcel_00000001");
  dispatchProductCommand(state, {
    type: "BuyParcel",
    commandId: parseCommandId(`reputation-buy-${parcelId}`),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    payload: { parcelId },
  });
  const parcel = state.phase2.parcels.get(parcelId)!;
  parcel.price = parseMoney(2_000);
  return parcelId;
}

function requestLoanRate(state: GameState, parcelId: ParcelId): number | undefined {
  dispatchProductCommand(state, {
    type: "RequestLoan",
    commandId: parseCommandId(`reputation-loan-${parcelId}`),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    payload: { amount: parseMoney(600), termMonths: 12, collateralParcelId: parcelId },
  });
  return [...state.phase2.loans.values()][0]?.annualInterestRateBps;
}

describe("WP4.8 reputación multidimensional", () => {
  it("el mismo hecho valora distinto a cada grupo y no hay barra universal", () => {
    const completed = newState();
    recordReputationFact(completed, PLAYER_ORGANIZATION_ID, "contract_completed");
    expect(standingFor(completed, PLAYER_ORGANIZATION_ID, "residents")).toBe(3);
    expect(standingFor(completed, PLAYER_ORGANIZATION_ID, "municipality")).toBe(8);
    expect(standingFor(completed, PLAYER_ORGANIZATION_ID, "banks")).toBe(2);
    expect(
      new Set(
        REPUTATION_GROUPS.map((group) => standingFor(completed, PLAYER_ORGANIZATION_ID, group)),
      ).size,
    ).toBe(3);

    const state = newState();
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "households_displaced", { magnitude: 2 });
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-6);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "municipality")).toBe(-2);
    /** WP4.11-H: desalojar no mejora la lectura crediticia; el +1 permanente era un exploit. */
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(0);
  });

  it("la opinión de la banca fija el tipo de interés del préstamo", () => {
    const neutral = newState();
    expect(requestLoanRate(neutral, collateralizedParcel(neutral))).toBe(900);

    const delinquent = newState();
    const delinquentParcel = collateralizedParcel(delinquent);
    recordReputationFact(delinquent, PLAYER_ORGANIZATION_ID, "loan_defaulted");
    expect(bankRateModifierBpsFor(delinquent, PLAYER_ORGANIZATION_ID)).toBe(100);
    expect(requestLoanRate(delinquent, delinquentParcel)).toBe(1_000);

    const solven = newState();
    const solvenParcel = collateralizedParcel(solven);
    recordReputationFact(solven, PLAYER_ORGANIZATION_ID, "loan_paid_off");
    recordReputationFact(solven, PLAYER_ORGANIZATION_ID, "loan_paid_off");
    expect(bankRateModifierBpsFor(solven, PLAYER_ORGANIZATION_ID)).toBe(-25);
    expect(requestLoanRate(solven, solvenParcel)).toBe(875);
  });

  it("los residentes castigan el atractivo del parque del casero", () => {
    const state = newState();
    const buildingId = addBuilding(state, 0, { condition: 10 });
    for (let index = 1; index <= 4; index += 1) addTenant(state, index, buildingId);

    advanceMonth(state, 1);
    // Cuatro hogares a la calle restan 12 ante los vecinos; el cierre decae 3 y la lectura
    // final es -9. La banca no decae pero tampoco premia el desalojo desde WP4.11-H.
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-9);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(0);
    expect(residentFactorPercentFor(state, PLAYER_ORGANIZATION_ID)).toBe(100);

    // El umbral siguiente sí castiga el parque: -9 menos dos desalojos más queda en -15.
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "households_displaced", { magnitude: 2 });
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-15);
    expect(residentFactorPercentFor(state, PLAYER_ORGANIZATION_ID)).toBe(92);

    const unit = { quality: 80, accessibility: 60, safety: 70, services: 50 };
    const segment = HOUSING_SEGMENTS.household;
    const clean = desirabilityOf({ ...unit, landlordFactorPercent: 100 }, segment);
    const shunned = desirabilityOf({ ...unit, landlordFactorPercent: 92 }, segment);
    expect(shunned).toBeLessThan(clean);
    expect(shunned).toBe(Math.round((clean * 92) / 100));
  });

  it("el gobierno deja influencia al cerrar el mes", () => {
    const state = newState();
    const before = state.phase2.influenceByOrganizationId.get(PLAYER_ORGANIZATION_ID) ?? 0;
    settleAt(state, 1);
    expect(state.phase2.influenceByOrganizationId.get(PLAYER_ORGANIZATION_ID)).toBe(before + 1);
    // El municipio no es una empresa: no se deposita influencia a sí mismo.
    expect(state.phase2.influenceByOrganizationId.has(MUNICIPALITY_ORGANIZATION_ID)).toBe(false);

    for (let index = 0; index < 3; index += 1)
      recordReputationFact(state, PLAYER_ORGANIZATION_ID, "contract_completed");
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "municipality")).toBe(24);
    expect(influenceGainFor(state, PLAYER_ORGANIZATION_ID)).toBe(2);

    // Quien agota la paciencia del gobierno deja de cobrar influencia.
    const refused = newState();
    for (let index = 0; index < 3; index += 1)
      recordReputationFact(refused, PLAYER_ORGANIZATION_ID, "contract_defaulted");
    expect(standingFor(refused, PLAYER_ORGANIZATION_ID, "municipality")).toBe(-30);
    expect(influenceGainFor(refused, PLAYER_ORGANIZATION_ID)).toBe(0);
  });

  it("la opinión pública decae y el historial crediticio no", () => {
    const state = newState();
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "tax_arrears");
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "municipality")).toBe(-4);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(-3);

    for (let month = 1; month <= 3; month += 1) settleAt(state, month);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "municipality")).toBe(0);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(-3);
    expect(state.phase2.reputation.lastDecayTick).toBe(parseTick(3 * GAME_MONTH_TICKS));
    expect(REPUTATION_POLICY.decayPerMonth.banks).toBe(0);
  });

  it("la memoria es acotada y la magnitud tiene tope por hecho", () => {
    const state = newState();
    for (let index = 0; index < 20; index += 1)
      recordReputationFact(state, PLAYER_ORGANIZATION_ID, "loan_paid_off");
    const facts = state.phase2.reputation.factsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? [];
    expect(facts).toHaveLength(REPUTATION_POLICY.factLimitPerOrganization);
    expect(facts[facts.length - 1]!.id > facts[0]!.id).toBe(true);
    expect(state.phase2.reputation.nextFactOrdinal).toBe(21);
    // La percepción persiste aunque el ledger se recorte.
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(
      REPUTATION_POLICY.maximumStanding,
    );

    const capped = newState();
    recordReputationFact(capped, PLAYER_ORGANIZATION_ID, "households_displaced", {
      magnitude: 100,
    });
    expect(standingFor(capped, PLAYER_ORGANIZATION_ID, "residents")).toBe(
      -3 * REPUTATION_POLICY.facts.households_displaced.magnitudeCap,
    );
  });

  it("la percepción propia se publica y la del rival se calla", () => {
    const state = newState();
    recordReputationFact(state, RIVAL_ORGANIZATION_ID, "contract_defaulted");
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "contract_completed");

    const report = describeReputation(state);
    expect(report.standingByGroup.municipality).toBe(8);
    expect(report.facts.map((fact) => fact.kind)).toEqual(["contract_completed"]);
    expect(JSON.stringify(report)).not.toContain(RIVAL_ORGANIZATION_ID);
    expect(state.phase2.reputation.standingByOrganizationId[RIVAL_ORGANIZATION_ID]).toMatchObject({
      municipality: -10,
    });

    // La proyección es lo que lee el panel: mismo informe, sin filtrar el estado interno.
    const projected = createViewProjection(state, true).economy?.reputation;
    expect(projected?.standingByGroup).toEqual(report.standingByGroup);
    expect(projected?.facts.map((fact) => fact.kind)).toEqual(["contract_completed"]);
    expect(JSON.stringify(projected)).not.toContain(RIVAL_ORGANIZATION_ID);
  });

  it("sobrevive a guardar y cargar y migra partidas anteriores", () => {
    const state = newState();
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "casualties", {
      referenceId: "building_00000001",
      magnitude: 3,
    });
    settleAt(state, 1);
    const serialized = serializeSnapshot(state);
    expect(serializeSnapshot(restoreStateFromSnapshot(serialized))).toEqual(serialized);
    expect(restoreStateFromSnapshot(serialized).phase2.reputation.factsByOrganizationId).toEqual(
      state.phase2.reputation.factsByOrganizationId,
    );

    const legacy = serializeSnapshot(newState());
    delete legacy.phase2!.reputation;
    expect(restoreStateFromSnapshot(legacy).phase2.reputation).toEqual(initialReputationState());
  });

  it("dos partidas con la misma seed y los mismos hechos convergen", () => {
    const run = (): string => {
      const state = newState(11);
      requestLoanRate(state, collateralizedParcel(state));
      for (let month = 1; month <= 4; month += 1) {
        state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
        advanceProductSystems(state);
      }
      recordReputationFact(state, PLAYER_ORGANIZATION_ID, "households_displaced", {
        magnitude: 5,
      });
      settleAt(state, 5);
      return canonicalizeState(state);
    };
    expect(run()).toBe(run());
  });
});

describe("WP4.11-H atribución de víctimas y exploit bancario", () => {
  it("el sabotaje visto por alguien recae también sobre quien lo causó", () => {
    const state = newState(67);
    const buildingId = addBuilding(state, 0);
    addTenant(state, 1, buildingId);
    addTenant(state, 2, buildingId);
    const building = state.phase2.buildings.get(buildingId)!;
    building.state = "collapse_pending";
    building.structuralIntegrity = 0;
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId,
      origin: "sabotage",
      intensity: 100,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: RIVAL_ORGANIZATION_ID,
      publiclyAttributedOrganizationId: RIVAL_ORGANIZATION_ID,
      casualties: { injured: 0, dead: 0 },
    });
    state.clock = { ...state.clock, tick: parseTick(50) };
    advanceProductSystems(state);

    expect(building.state).toBe("ruin");
    const rivalFacts = state.phase2.reputation.factsByOrganizationId[RIVAL_ORGANIZATION_ID] ?? [];
    expect(rivalFacts.map((fact) => fact.kind)).toContain("violent_sabotage");
    expect(standingFor(state, RIVAL_ORGANIZATION_ID, "residents")).toBe(-10);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-8);
  });

  /** La verdad del motor y lo que sabe el distrito no son lo mismo (D-072). */
  it("un sabotaje sin atribución pública no mancha al atacante", () => {
    const state = newState(67);
    const buildingId = addBuilding(state, 0);
    addTenant(state, 1, buildingId);
    addTenant(state, 2, buildingId);
    const building = state.phase2.buildings.get(buildingId)!;
    building.state = "collapse_pending";
    building.structuralIntegrity = 0;
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId,
      origin: "sabotage",
      intensity: 100,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: RIVAL_ORGANIZATION_ID,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    state.clock = { ...state.clock, tick: parseTick(50) };
    advanceProductSystems(state);

    const incident = state.phase2.incidents.get(parseIncidentId("incident_00000001"))!;
    /** La autoría sigue siendo verdad autoritativa aunque nadie la conozca. */
    expect(incident.causedByOrganizationId).toBe(RIVAL_ORGANIZATION_ID);
    expect(incident.publiclyAttributedOrganizationId).toBeNull();
    const rivalFacts = state.phase2.reputation.factsByOrganizationId[RIVAL_ORGANIZATION_ID] ?? [];
    expect(rivalFacts.map((fact) => fact.kind)).not.toContain("violent_sabotage");
    expect(standingFor(state, RIVAL_ORGANIZATION_ID, "residents")).toBe(0);
    /** El dueño sí responde del inmueble: su castigo no depende de quién disparó el fuego. */
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-8);
  });

  it("sin atacante distinto del dueño no se duplica la penalización", () => {
    const state = newState(71);
    const buildingId = addBuilding(state, 0);
    addTenant(state, 1, buildingId);
    addTenant(state, 2, buildingId);
    const building = state.phase2.buildings.get(buildingId)!;
    building.state = "collapse_pending";
    building.structuralIntegrity = 0;
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId,
      origin: "deterioration",
      intensity: 100,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: PLAYER_ORGANIZATION_ID,
      publiclyAttributedOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    state.clock = { ...state.clock, tick: parseTick(50) };
    advanceProductSystems(state);
    const facts = state.phase2.reputation.factsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? [];
    expect(facts.filter((fact) => fact.kind === "casualties")).toHaveLength(1);
    expect(facts.filter((fact) => fact.kind === "violent_sabotage")).toHaveLength(0);
  });

  it("sin víctimas no se registra hecho para nadie", () => {
    const state = newState(73);
    const buildingId = addBuilding(state, 0);
    const building = state.phase2.buildings.get(buildingId)!;
    building.state = "collapse_pending";
    building.structuralIntegrity = 0;
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId,
      origin: "sabotage",
      intensity: 100,
      status: "active",
      targetOrganizationId: PLAYER_ORGANIZATION_ID,
      createdAtTick: parseTick(0),
      causedByAgentId: null,
      causedByOrganizationId: RIVAL_ORGANIZATION_ID,
      publiclyAttributedOrganizationId: RIVAL_ORGANIZATION_ID,
      casualties: { injured: 0, dead: 0 },
    });
    state.clock = { ...state.clock, tick: parseTick(50) };
    advanceProductSystems(state);
    expect(
      state.phase2.reputation.factsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? [],
    ).toHaveLength(0);
    expect(state.phase2.reputation.factsByOrganizationId[RIVAL_ORGANIZATION_ID] ?? []).toHaveLength(
      0,
    );
  });

  /** Un sabotaje resuelto por el motor deja atribución pública sólo si la ronda de detección la vio. */
  function sabotageResolvedByEngine(
    policePressure: number,
    seed: number,
  ): import("@landlord/shared").IncidentRecord {
    const state = newState(seed);
    const buildingId = addBuilding(state, 0);
    const parcel = state.phase2.parcels.get(
      state.phase2.buildings.get(buildingId)!.parcelId,
    )!.anchorCell;
    const enforcer = [...state.agents.values()].find((agent) => agent.specialty === "enforcer")!;
    enforcer.organizationId = RIVAL_ORGANIZATION_ID;
    expect(
      dispatchProductCommand(state, {
        commandId: parseCommandId(`sabotage-${seed}`),
        /** El rival actúa por su cuenta: person_00000002 + org_00000002 es el actor autónomo. */
        issuedByPersonId: parsePersonId("person_00000002"),
        actingAsOrganizationId: RIVAL_ORGANIZATION_ID,
        type: "OrderEnforcerAction",
        payload: {
          enforcerAgentId: enforcer.id,
          action: "sabotage_building",
          targetBuildingId: buildingId,
        },
      }).accepted,
    ).toBe(true);
    /** Se planta al enforcer junto a la parcela: la caminata ya la valida el spike de WP2.15. */
    enforcer.cell = { x: parcel.x, y: parcel.y + 1 };
    enforcer.target = { ...parcel };
    enforcer.path = [];
    state.phase2.crime.policePressure = policePressure;
    for (let tick = 0; tick < 60; tick += 1) advanceProductSystems(state);
    const incident = [...state.phase2.incidents.values()].find(
      (entry) => entry.origin === "sabotage" && entry.buildingId === buildingId,
    );
    if (!incident) throw new Error(`el sabotaje de la seed ${seed} no llegó a resolverse`);
    return { ...incident };
  }

  it("la atribución pública del sabotaje nace con la ronda de detección", () => {
    /** Con presión policial 22 la tirada (35 + 3×presión) no puede fallar: el autor es visto. */
    const seen = sabotageResolvedByEngine(22, 17);
    expect(seen.causedByOrganizationId).toBe(RIVAL_ORGANIZATION_ID);
    expect(seen.publiclyAttributedOrganizationId).toBe(RIVAL_ORGANIZATION_ID);

    /** Sin presión hay sabotajes que nadie ve: la autoría queda en el motor, no en el distrito. */
    let unseen: import("@landlord/shared").IncidentRecord | null = null;
    for (let seed = 1; seed <= 40 && !unseen; seed += 1) {
      const candidate = sabotageResolvedByEngine(0, seed);
      if (!candidate.publiclyAttributedOrganizationId) unseen = candidate;
    }
    expect(unseen).not.toBeNull();
    expect(unseen!.causedByOrganizationId).toBe(RIVAL_ORGANIZATION_ID);
    expect(unseen!.publiclyAttributedOrganizationId).toBeNull();
  });

  it("desalojar repetidamente no construye reputación bancaria ni abarata el préstamo", () => {
    const abusive = newState(79);
    const control = newState(79);
    for (let month = 1; month <= 12; month += 1) {
      settleAt(abusive, month);
      recordReputationFact(abusive, PLAYER_ORGANIZATION_ID, "households_displaced", {
        magnitude: 8,
      });
      settleAt(control, month);
    }
    expect(standingFor(abusive, PLAYER_ORGANIZATION_ID, "banks")).toBe(0);
    expect(bankRateModifierBpsFor(abusive, PLAYER_ORGANIZATION_ID)).toBe(
      bankRateModifierBpsFor(control, PLAYER_ORGANIZATION_ID),
    );
    /** La calle sí lo castiga: la neutralidad bancaria no borra la queja social. */
    expect(standingFor(abusive, PLAYER_ORGANIZATION_ID, "residents")).toBeLessThan(
      standingFor(control, PLAYER_ORGANIZATION_ID, "residents"),
    );
  });
});

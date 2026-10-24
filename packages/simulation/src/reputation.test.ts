import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
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
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
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
    const state = newState();
    recordReputationFact(state, PLAYER_ORGANIZATION_ID, "households_displaced", { magnitude: 2 });

    const residents = standingFor(state, PLAYER_ORGANIZATION_ID, "residents");
    const municipality = standingFor(state, PLAYER_ORGANIZATION_ID, "municipality");
    const banks = standingFor(state, PLAYER_ORGANIZATION_ID, "banks");
    expect(residents).toBe(-6);
    expect(municipality).toBe(-2);
    expect(banks).toBe(2);
    // Desplazar households Improve la lectura de la banca y empeora la de la calle.
    expect(Math.sign(residents)).not.toBe(Math.sign(banks));
    expect(
      new Set(REPUTATION_GROUPS.map((group) => standingFor(state, PLAYER_ORGANIZATION_ID, group)))
        .size,
    ).toBe(3);
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
    // final es -9. La banca no decae y lee el desalojo como menos riesgo: +4.
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "residents")).toBe(-9);
    expect(standingFor(state, PLAYER_ORGANIZATION_ID, "banks")).toBe(4);
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
      return JSON.stringify(serializeSnapshot(state));
    };
    // canonicalizeState sigue sin serializar los agregados económicos (deuda de WP4.3–WP4.8).
    expect(run()).toBe(run());
  });
});

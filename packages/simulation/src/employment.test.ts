import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseMoney,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingId,
  type BuildingType,
  type Tenant,
} from "@landlord/shared";
import { EMPLOYMENT_POLICY, describeEmployment, runEmployment } from "./employment";
import { GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { describeHousingMarket } from "./housing-market";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addBuilding(
  state: GameState,
  index: number,
  type: BuildingType,
  condition = 100,
): BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  const building: Building = {
    id,
    parcelIds: [parcel.id],
    districtId: parcel.districtId,
    footprintCells: [{ ...parcel.anchorCell }],
    orientation: 0,
    floors: 1,
    form: "detached",
    ownerOrganizationId: PLAYER_ORGANIZATION_ID,
    productionFacilityId: null,
    type,
    level: 1,
    condition,
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

function nextTenantOrdinal(state: GameState): number {
  let highest = 0;
  for (const id of state.phase2.tenants.keys()) {
    const suffix = Number.parseInt(id.slice("tenant_".length), 10);
    if (Number.isFinite(suffix) && suffix > highest) highest = suffix;
  }
  return highest + 1;
}

function addHousehold(
  state: GameState,
  buildingId: BuildingId,
  options: { origin?: "authored" | "market"; contracted?: boolean } = {},
): void {
  const ordinal = nextTenantOrdinal(state);
  const id = parseTenantId(`tenant_${String(ordinal).padStart(8, "0")}`);
  const tenant: Tenant = {
    id,
    profile: "household",
    budget: parseMoney(260),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: options.contracted === false ? null : buildingId,
    marketDistrictId: null,
    satisfaction: 70,
    leaseRemaining: 24,
    status: options.contracted === false ? "available" : "contracted",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: options.origin ?? "market",
  };
  state.phase2.tenants.set(id, tenant);
  if (options.contracted !== false) {
    const building = state.phase2.buildings.get(buildingId)!;
    building.tenantIds.push(id);
    building.tenantId = building.tenantIds[0]!;
  }
}

function months(state: GameState, count: number, from = 0): void {
  for (let index = 1; index <= count; index += 1) {
    state.clock = { ...state.clock, tick: parseTick((from + index) * GAME_MONTH_TICKS) };
    advanceProductSystems(state);
  }
}

describe("WP4.4 empleo y actividad económica", () => {
  it("cuenta puestos, trabajadores y paro sin asignar individuos a puestos", () => {
    const state = newState();
    addBuilding(state, 0, "cement_plant");
    addBuilding(state, 1, "brickworks");
    const home = addBuilding(state, 2, "courtyard_home");
    for (let index = 0; index < 3; index += 1) addHousehold(state, home);

    const report = describeEmployment(state);

    expect(report.jobs).toBe(8);
    expect(report.jobsBySector).toEqual({ materials: 8, commerce: 0 });
    expect(report.workers).toBe(3);
    expect(report.employedWorkers).toBe(3);
    expect(report.unemployedWorkers).toBe(0);
    expect(report.employmentRatePercent).toBe(100);
  });

  it("con paro baja el salario y con escasez laboral sube, dentro de la banda", () => {
    const unemployed = newState(21);
    const homeA = addBuilding(unemployed, 0, "courtyard_home");
    addBuilding(unemployed, 1, "cement_plant");
    for (let index = 0; index < 12; index += 1) addHousehold(unemployed, homeA);
    months(unemployed, 8);
    const unemployedReport = describeEmployment(unemployed);
    expect(unemployedReport.unemployedWorkers).toBeGreaterThan(0);
    expect(unemployedReport.salaryIndexPercent).toBe(EMPLOYMENT_POLICY.minimumSalaryIndexPercent);
    expect(unemployedReport.incomeIndexPercentBySegment.household!).toBeLessThan(100);

    const shortage = newState(21);
    const homeB = addBuilding(shortage, 0, "courtyard_home");
    addBuilding(shortage, 1, "cement_plant");
    addBuilding(shortage, 2, "brickworks");
    addBuilding(shortage, 3, "steelworks");
    for (let index = 0; index < 2; index += 1) addHousehold(shortage, homeB);
    months(shortage, 8);
    const shortageReport = describeEmployment(shortage);
    expect(shortageReport.employedWorkers).toBe(2);
    expect(shortageReport.unemployedWorkers).toBe(0);
    expect(shortageReport.salaryIndexPercent).toBe(EMPLOYMENT_POLICY.maximumSalaryIndexPercent);
    expect(shortageReport.incomeIndexPercentBySegment.household!).toBeGreaterThan(100);
  });

  it("un cierre de planta destruye puestos y arrastra el ingreso", () => {
    const state = newState(23);
    const home = addBuilding(state, 0, "courtyard_home");
    const plants = [1, 2].map((index) => addBuilding(state, index, "cement_plant"));
    for (let index = 0; index < 4; index += 1) addHousehold(state, home);
    months(state, 6);

    const before = describeEmployment(state);
    expect(before.jobs).toBe(8);
    expect(before.salaryIndexPercent).toBeGreaterThan(100);

    for (const plant of plants) state.phase2.buildings.get(plant)!.state = "ruin";
    months(state, 6, 6);

    const after = describeEmployment(state);
    expect(after.jobs).toBe(0);
    expect(after.unemployedWorkers).toBe(4);
    expect(after.salaryIndexPercent).toBeLessThan(before.salaryIndexPercent);
    expect(after.incomeIndexPercentBySegment.household!).toBeLessThan(
      before.incomeIndexPercentBySegment.household!,
    );
  });

  it("el empleo decide qué vivienda es asequible", () => {
    const build = (seed: number, withJobs: boolean): GameState => {
      const state = newState(seed);
      const homes = [0, 1, 2, 3].map((index) => addBuilding(state, index, "courtyard_home"));
      for (const home of homes) {
        for (let slot = 0; slot < 2; slot += 1) addHousehold(state, home);
      }
      // Una plaza libre en el último edificio permite observar la asequibilidad de lo vacante.
      const occupied = homes[3]!;
      const building = state.phase2.buildings.get(occupied)!;
      const [first, second] = building.tenantIds;
      building.tenantIds = [first!];
      building.tenantId = first!;
      state.phase2.tenants.delete(second!);
      state.phase2.ordinance.status = "active";
      state.phase2.ordinance.rentModifierPercent = 40;
      if (withJobs) {
        addBuilding(state, 4, "cement_plant");
        addBuilding(state, 5, "brickworks");
      }
      state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
      runEmployment(state);
      return state;
    };

    const withJobs = build(29, true);
    const withoutJobs = build(29, false);

    const demandWithJobs = describeHousingMarket(withJobs)[0]!;
    const demandWithoutJobs = describeHousingMarket(withoutJobs)[0]!;

    expect(demandWithJobs.vacantSlots).toBe(1);
    expect(demandWithoutJobs.vacantSlots).toBe(1);
    expect(demandWithJobs.affordableVacantSlots).toBe(1);
    expect(demandWithoutJobs.affordableVacantSlots).toBe(0);
    expect(demandWithJobs.appealPercent).toBeGreaterThan(demandWithoutJobs.appealPercent);
  });

  it("recalcula el presupuesto de los hogares de mercado y respeta a los autorados", () => {
    const state = newState(31);
    const home = addBuilding(state, 0, "courtyard_home");
    addBuilding(state, 1, "cement_plant");
    addBuilding(state, 2, "steelworks");
    addHousehold(state, home, { origin: "market" });
    addHousehold(state, home, { origin: "authored" });

    const marketTenant = [...state.phase2.tenants.values()].find(
      (tenant) => tenant.origin === "market",
    )!;
    const authoredTenant = [...state.phase2.tenants.values()].find(
      (tenant) =>
        tenant.id !== marketTenant.id &&
        tenant.origin === "authored" &&
        tenant.status === "contracted",
    )!;
    const authoredBudget = authoredTenant.budget;

    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runEmployment(state);

    expect(marketTenant.budget).toBeGreaterThan(260);
    expect(authoredTenant.budget).toBe(authoredBudget);
  });

  it("es determinista y sobrevive a guardar y cargar", () => {
    const setup = (): GameState => {
      const state = newState(37);
      const home = addBuilding(state, 0, "courtyard_home");
      addBuilding(state, 1, "cement_plant");
      addBuilding(state, 2, "courtyard_home");
      for (let index = 0; index < 3; index += 1) addHousehold(state, home);
      return state;
    };
    const first = setup();
    const second = setup();
    months(first, 10);
    months(second, 10);
    expect(canonicalizeState(first)).toBe(canonicalizeState(second));

    const saved = setup();
    months(saved, 4);
    const restored = restoreStateFromSnapshot(serializeSnapshot(saved));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(saved));
    months(saved, 3, 4);
    months(restored, 3, 4);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(saved));
  });

  it("una partida anterior a WP4.4 carga con el empleo por defecto", () => {
    const state = newState(41);
    addBuilding(state, 0, "cement_plant");
    const raw = JSON.parse(JSON.stringify(serializeSnapshot(state))) as {
      phase2: { employment?: unknown; tenants: Array<Record<string, unknown>> };
    };
    delete raw.phase2.employment;
    for (const tenant of raw.phase2.tenants) delete tenant.incomeFactorPercent;

    const restored = restoreStateFromSnapshot(raw);

    expect(restored.phase2.employment).toEqual({
      salaryIndexPercent: EMPLOYMENT_POLICY.initialSalaryIndexPercent,
      postsByDistrictId: {},
      lastSettlementTick: null,
    });
    expect(
      [...restored.phase2.tenants.values()].every((tenant) => tenant.incomeFactorPercent === 100),
    ).toBe(true);
  });
});

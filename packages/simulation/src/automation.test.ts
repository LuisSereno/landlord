import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parsePersonId,
  parseTenantId,
  parseTick,
  type Building,
  type Tenant,
} from "@landlord/shared";
import { describeAutomation, initialAutomationState, runAutomation } from "./automation";
import { dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  GAME_DAY_TICKS,
  GAME_MONTH_TICKS,
  PLAYER_ORGANIZATION_ID,
  REPAIR_COST,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  console?: { log(value: string): void };
};

function capacityOf(type: Building["type"]): number {
  return BUILDING_DEFINITIONS[type].capacity;
}

function automationCommand(payload: {
  property?: "manual" | "fill_vacancies";
  finance?: "manual" | "cover_shortfall";
  maintenanceRepairThreshold?: number | null;
}) {
  return {
    commandId: parseCommandId(
      `test-automation-${payload.property ?? ""}-${payload.finance ?? ""}-${payload.maintenanceRepairThreshold ?? "x"}`,
    ),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    type: "SetAutomationPolicy" as const,
    payload,
  };
}

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.clock = { ...state.clock, tick: parseTick(GAME_DAY_TICKS) };
  return state;
}

function addOwnedBuilding(
  state: GameState,
  index: number,
  options: { condition?: number; tenants?: number } = {},
): Building {
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
    condition: options.condition ?? 100,
    tenantId: null,
    tenantIds: [],
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
  };
  state.phase2.buildings.set(id, building);
  for (let seated = 0; seated < (options.tenants ?? 0); seated += 1) {
    const tenant = addTenant(state, index * 2 + seated + 1, {
      activeContractBuildingId: id,
      status: "contracted",
    });
    building.tenantIds.push(tenant.id);
    building.tenantId = building.tenantIds[0]!;
  }
  return building;
}

function addTenant(state: GameState, id: number, overrides: Partial<Tenant> = {}): Tenant {
  const tenantId = parseTenantId(`tenant_${String(id).padStart(8, "0")}`);
  const tenant: Tenant = {
    id: tenantId,
    profile: "household",
    budget: parseMoney(300),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    satisfaction: 60,
    leaseRemaining: 0,
    status: "available",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    ...overrides,
  };
  state.phase2.tenants.set(tenantId, tenant);
  return tenant;
}

describe("WP4.13 automatización y delegación", () => {
  it("arranca en manual y se configura por el mismo dispatcher", () => {
    const state = newState();
    expect(state.phase2.automation).toEqual({
      property: "manual",
      finance: "manual",
      maintenanceRepairThreshold: null,
      financeCashFloor: 2000,
    });
    const result = dispatchProductCommand(state, automationCommand({ property: "fill_vacancies" }));
    expect(result.accepted).toBe(true);
    expect(state.phase2.automation.property).toBe("fill_vacancies");
    expect(initialAutomationState().property).toBe("manual");
  });

  it("el gestor de propiedad coloca inquilinos compatibles y respeta el presupuesto", () => {
    const state = newState();
    state.phase2.tenants.clear();
    addOwnedBuilding(state, 0);
    const rich = addTenant(state, 1);
    const poor = addTenant(state, 2, { budget: parseMoney(10) });
    state.phase2.automation.property = "fill_vacancies";
    runAutomation(state);
    const building = [...state.phase2.buildings.values()][0]!;
    expect(building.tenantIds).toEqual([rich.id]);
    expect(rich.status).toBe("contracted");
    /** El inquilino sin presupuesto no entra: la automatización no salta la validación. */
    expect(poor.status).toBe("available");
  });

  it("el gestor de propiedad no hace nada en modo manual", () => {
    const state = newState();
    state.phase2.tenants.clear();
    addOwnedBuilding(state, 0);
    const tenant = addTenant(state, 1);
    runAutomation(state);
    expect(tenant.status).toBe("available");
    expect([...state.phase2.buildings.values()][0]!.tenantIds).toHaveLength(0);
  });

  it("el gestor financiero pide y acepta un préstamo si la caja cae bajo el suelo", () => {
    const state = newState();
    const parcel = [...state.phase2.parcels.values()][0]!;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    parcel.price = parseMoney(2_000);
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(100));
    state.phase2.automation.finance = "cover_shortfall";
    runAutomation(state);
    const loan = [...state.phase2.loans.values()].find(
      (entry) => entry.borrowerOrganizationId === PLAYER_ORGANIZATION_ID,
    );
    expect(loan).toBeDefined();
    expect(loan!.status).toBe("active");
    expect(state.phase2.balances.get(PLAYER_ORGANIZATION_ID)!).toBeGreaterThan(100);
  });

  it("el gestor financiero no pide préstamo sin garantía ni con deuda viva", () => {
    const withoutCollateral = newState();
    withoutCollateral.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(0));
    withoutCollateral.phase2.automation.finance = "cover_shortfall";
    runAutomation(withoutCollateral);
    expect(withoutCollateral.phase2.loans.size).toBe(0);

    const withDebt = newState();
    const parcel = [...withDebt.phase2.parcels.values()][0]!;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    parcel.price = parseMoney(2_000);
    withDebt.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(0));
    withDebt.phase2.automation.finance = "cover_shortfall";
    const manual = dispatchProductCommand(withDebt, {
      commandId: parseCommandId("manual-loan"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
      type: "RequestLoan",
      payload: {
        amount: parseMoney(500),
        termMonths: 12,
        collateralParcelId: parcel.id,
      },
    });
    expect(manual.accepted).toBe(true);
    const count = withDebt.phase2.loans.size;
    runAutomation(withDebt);
    expect(withDebt.phase2.loans.size).toBe(count);
  });

  it("el gestor de mantenimiento repara bajo umbral solo si la caja cubre el suelo", () => {
    const state = newState();
    const building = addOwnedBuilding(state, 0, { condition: 30 });
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(50_000));
    state.phase2.automation.maintenanceRepairThreshold = 40;
    runAutomation(state);
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.repairBuildingId === building.id,
    );
    expect(site).toBeDefined();
    expect(site!.assignedCrewIds.length).toBe(1);

    const poor = newState();
    const poorBuilding = addOwnedBuilding(poor, 0, { condition: 30 });
    poor.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(REPAIR_COST));
    poor.phase2.automation.maintenanceRepairThreshold = 40;
    runAutomation(poor);
    expect(
      [...poor.phase2.constructionSites.values()].some(
        (entry) => entry.repairBuildingId === poorBuilding.id,
      ),
    ).toBe(false);
  });

  it("la automatización nunca actúa sobre la organización rival", () => {
    const state = newState();
    const parcel = [...state.phase2.parcels.values()][0]!;
    parcel.ownerOrganizationId = RIVAL_ORGANIZATION_ID;
    const buildingId = parseBuildingId("building_00000099");
    parcel.buildingId = buildingId;
    const building: Building = {
      id: buildingId,
      parcelId: parcel.id,
      ownerOrganizationId: RIVAL_ORGANIZATION_ID,
      productionFacilityId: null,
      type: "courtyard_home",
      level: 1,
      condition: 10,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    };
    state.phase2.buildings.set(buildingId, building);
    state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(50_000));
    state.phase2.automation.maintenanceRepairThreshold = 40;
    runAutomation(state);
    expect(
      [...state.phase2.constructionSites.values()].some(
        (entry) => entry.repairBuildingId === buildingId,
      ),
    ).toBe(false);
  });

  it("la bandeja prioriza deuda sobre deterioro y rutina, y sólo publica datos propios", () => {
    const state = newState();
    addOwnedBuilding(state, 0, { condition: 30 });
    addOwnedBuilding(state, 1, { condition: 60 });
    state.phase2.taxation.arrearsByOrganizationId[PLAYER_ORGANIZATION_ID] = parseMoney(300);
    const report = describeAutomation(state);
    expect(report.routineTaskCount).toBeGreaterThanOrEqual(4);
    expect(report.exceptions[0]!.kind).toBe("tax_arrears");
    expect(report.exceptions[0]!.severity).toBe(3);
    expect(report.exceptions.map((entry) => entry.kind)).toContain("building_condition");
    expect(report.exceptions.map((entry) => entry.kind)).toContain("vacant_unit");
    expect(report.exceptions).toHaveLength(Math.min(report.routineTaskCount, 20));
    expect(JSON.stringify(report)).not.toMatch(/rival|org_00000002/);
  });

  it("persiste en snapshot y en el estado canónico", () => {
    const state = newState();
    state.phase2.automation.property = "fill_vacancies";
    state.phase2.automation.maintenanceRepairThreshold = 35;
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.automation).toEqual(state.phase2.automation);
    const baseline = canonicalizeState(state);
    state.phase2.automation.finance = "cover_shortfall";
    expect(canonicalizeState(state)).not.toBe(baseline);
  });

  it("restaura partidas anteriores a WP4.13 con la política manual", () => {
    const state = newState();
    const snapshot = serializeSnapshot(state) as unknown as {
      phase2: { automation?: Record<string, unknown> };
    };
    const legacy = JSON.parse(JSON.stringify(snapshot));
    delete legacy.phase2.automation;
    const restored = restoreStateFromSnapshot(legacy);
    expect(restored.phase2.automation).toEqual(initialAutomationState());
  });

  it("la campaña delegada es determinista", () => {
    const run = () => {
      const state = createScaledCity(5, { parcelCount: 40 });
      state.phase2.automation.property = "fill_vacancies";
      state.phase2.automation.maintenanceRepairThreshold = 40;
      for (let tick = 0; tick < GAME_MONTH_TICKS * 3; tick += 1) advanceProductSystems(state);
      return canonicalizeState(state);
    };
    expect(run()).toBe(run());
  }, 30_000);

  it.skipIf(environment.process?.env?.AUTOMATION_LOAD !== "1")(
    "mide la rutina manual y delegada en 50, 200 y 800 parcelas",
    () => {
      const rows = [50, 200, 800].map((parcelCount) => {
        const city = createScaledCity(7, { parcelCount });
        for (let tick = 0; tick < GAME_MONTH_TICKS * 6; tick += 1) advanceProductSystems(city);
        const playerBuildings = [...city.phase2.buildings.values()].filter(
          (building) =>
            building.ownerOrganizationId === PLAYER_ORGANIZATION_ID &&
            building.state === "operational",
        );
        const playerVacantSlots = playerBuildings.reduce(
          (total, building) =>
            total + Math.max(0, capacityOf(building.type) - building.tenantIds.length),
          0,
        );
        /** Un inquilino disponible por plaza: el trabajo manual que la jugadora tendría delante. */
        let ordinal = 10_000;
        const preparedTenantIds: string[] = [];
        for (const building of [...playerBuildings].sort((left, right) =>
          left.id.localeCompare(right.id),
        )) {
          for (let slot = building.tenantIds.length; slot < capacityOf(building.type); slot += 1) {
            ordinal += 1;
            const tenant = addTenant(city, ordinal, {
              preferredBuildingType: building.type,
              budget: parseMoney(500),
            });
            preparedTenantIds.push(tenant.id);
          }
        }
        city.phase2.automation.property = "fill_vacancies";
        for (let day = 1; day <= 10; day += 1) {
          city.clock = { ...city.clock, tick: parseTick(day * GAME_DAY_TICKS) };
          runAutomation(city);
        }
        const filledByManager = preparedTenantIds.filter(
          (id) => city.phase2.tenants.get(parseTenantId(id))?.status === "contracted",
        ).length;
        return {
          parcelCount,
          playerVacantSlots,
          manualInteractions: playerVacantSlots,
          playerInteractionsWithAutomation: 0,
          filledByManager,
          vacanciesLeft: playerVacantSlots - filledByManager,
        };
      });
      environment.console?.log(`AUTOMATION_LOAD ${JSON.stringify(rows)}`);
      expect(rows[2]!.manualInteractions).toBeGreaterThan(rows[0]!.manualInteractions);
      expect(rows[2]!.filledByManager).toBeGreaterThan(0);
      expect(rows[0]!.filledByManager).toBeGreaterThan(0);
    },
    600_000,
  );
});

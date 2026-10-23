import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseFacilityId,
  parseIncidentId,
  parseLoanId,
  parseOrganizationId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parsePolicyId,
  parseTenantId,
  parseTick,
  type ProductCommand,
  viewProjectionV1Schema,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";
import { createInitialState } from "./state";
import { createViewProjection } from "./projection";
import { GAME_MONTH_TICKS, deteriorationRiskPercent } from "./game-data";

const actor = parsePersonId("person_00000001");
const organization = "org_00000001" as ProductCommand["actingAsOrganizationId"];

function advanceToTick(state: ReturnType<typeof createInitialState>, target: number): void {
  for (const site of state.phase2.constructionSites.values()) {
    if (site.assignedCrewIds.length === 0) {
      const crew = [...state.phase2.crews.values()].find(
        (entry) => entry.organizationId === site.ownerOrganizationId,
      );
      if (crew)
        dispatchProductCommand(
          state,
          command("auto-crew-" + site.id, "AssignCrewToWorkOrder", {
            crewId: crew.id,
            workOrderId: site.id,
          }),
        );
    }
  }
  while (state.clock.tick <= target) advanceProductSystems(state);
}

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: organization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

describe("Gate 2 product loop", () => {
  it("buys a parcel atomically and records an auditable cash movement", () => {
    const state = createInitialState(7);
    const before = state.phase2.balances.get(organization)!;
    const result = dispatchProductCommand(
      state,
      command("buy-1", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );

    expect(result.accepted).toBe(true);
    expect(state.phase2.parcels.get(parseParcelId("parcel_00000001"))?.ownerOrganizationId).toBe(
      organization,
    );
    expect(state.phase2.balances.get(organization)).toBe(before - 914);
    expect(state.phase2.transactions).toHaveLength(3);
    expect(
      dispatchProductCommand(
        state,
        command("buy-2", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
      ),
    ).toEqual({ accepted: false, code: "PARCEL_UNAVAILABLE" });
  });

  it("runs production, construction, occupancy, rent, upgrade and policy effects deterministically", () => {
    const state = createInitialState(11);
    dispatchProductCommand(
      state,
      command("buy-1", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    expect(
      dispatchProductCommand(
        state,
        command("build-1", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000001"),
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, 96 * 50);

    const buildingId = parseBuildingId("building_00000001");
    expect(state.phase2.buildings.has(buildingId)).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("tenant-1", "AssignTenant", {
          buildingId,
          tenantId: parseTenantId("tenant_00000001"),
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("policy-1", "LobbyPolicy", {
          policyId: parsePolicyId("policy_00000001"),
          influenceSpend: 1,
        }),
      ).accepted,
    ).toBe(true);
    const balanceBeforeRent = state.phase2.balances.get(organization)!;
    advanceToTick(state, 36_000);
    expect(state.phase2.balances.get(organization)).toBeGreaterThan(balanceBeforeRent);
    expect(state.phase2.ordinance.status).toBe("expired");
  });

  it("keeps the product state and PRNG continuation identical across save/load", () => {
    const state = createInitialState(23);
    dispatchProductCommand(
      state,
      command("buy-1", "BuyParcel", { parcelId: parseParcelId("parcel_00000002") }),
    );
    dispatchProductCommand(
      state,
      command("crime-1", "CommitCrime", {
        targetOrganizationId: parseOrganizationId("org_00000002"),
      }),
    );
    advanceProductSystems(state);
    const snapshot = serializeSnapshot(state);
    const restored = restoreStateFromSnapshot(snapshot);
    expect(serializeSnapshot(restored)).toEqual(snapshot);
    expect(restored.phase2.crime).toEqual(state.phase2.crime);
  });

  it("starts new games without legacy facilities or the invisible investment flow", () => {
    const state = createInitialState(3);
    expect(state.phase2.facilities).toHaveLength(0);
    expect(createViewProjection(state, true).economy?.production).toHaveLength(0);
    expect(
      dispatchProductCommand(
        state,
        command("legacy-invest", "InvestInProduction", { resource: "cement" }),
      ),
    ).toEqual({ accepted: false, code: "FACILITY_NOT_FOUND" });
  });

  it("supports two assignable crews and cancellation recovers capped materials", () => {
    const state = createInitialState(5);
    dispatchProductCommand(
      state,
      command("buy-1", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    dispatchProductCommand(
      state,
      command("buy-2", "BuyParcel", { parcelId: parseParcelId("parcel_00000002") }),
    );
    expect(
      dispatchProductCommand(
        state,
        command("build-1", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000001"),
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("crew-1", "AllocateCrew", {
          constructionSiteId: parseConstructionSiteId("site_00000001"),
          crewCapacity: 2,
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("build-2", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000002"),
          buildingType: "workshop",
        }),
      ),
    ).toEqual({ accepted: false, code: "CREW_UNAVAILABLE" });
    const inventoryBeforeCancel = { ...state.phase2.inventories.get(organization)! };
    expect(
      dispatchProductCommand(
        state,
        command("cancel-1", "CancelConstruction", {
          constructionSiteId: parseConstructionSiteId("site_00000001"),
        }),
      ).accepted,
    ).toBe(true);
    const inventory = state.phase2.inventories.get(organization)!;
    expect(inventory).toMatchObject({
      cement: inventoryBeforeCancel.cement + 2,
      brick: inventoryBeforeCancel.brick + 4,
      steel: inventoryBeforeCancel.steel + 1,
    });
  });

  it("spends influence and charges a deterministic detection fine", () => {
    const policyState = createInitialState(11);
    dispatchProductCommand(
      policyState,
      command("policy", "LobbyPolicy", {
        policyId: parsePolicyId("policy_00000001"),
        influenceSpend: 1,
      }),
    );
    expect(policyState.phase2.influenceByOrganizationId.get(organization)).toBe(1);

    let detectedState: ReturnType<typeof createInitialState> | undefined;
    for (let seed = 1; seed <= 100 && !detectedState; seed += 1) {
      const candidate = createInitialState(seed);
      dispatchProductCommand(
        candidate,
        command(`crime-${seed}`, "CommitCrime", {
          targetOrganizationId: parseOrganizationId("org_00000002"),
        }),
      );
      if (candidate.phase2.crime.lastOutcome === "detected") detectedState = candidate;
    }
    expect(detectedState).toBeDefined();
    expect(detectedState!.phase2.balances.get(organization)).toBe(11820);
    expect(detectedState!.phase2.transactions.at(-1)?.cause).toBe("crime_fine");
  });

  it("turns an upgrade into a visible rent increase", () => {
    const state = createInitialState(19);
    dispatchProductCommand(
      state,
      command("buy", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    dispatchProductCommand(
      state,
      command("build", "StartConstruction", {
        parcelId: parseParcelId("parcel_00000001"),
        buildingType: "courtyard_home",
      }),
    );
    advanceToTick(state, 96 * 50);
    const buildingId = parseBuildingId("building_00000001");
    expect(
      dispatchProductCommand(state, command("upgrade", "UpgradeBuilding", { buildingId })).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(state.phase2.buildings.get(buildingId)?.upgraded).toBe(true);
    expect(
      createViewProjection(state, true).economy?.buildings.find(
        (building) => building.id === buildingId,
      )?.effectiveRent,
    ).toBe(225);
  });

  it("preserves money when a profitable crime target has less than the nominal benefit", () => {
    let profitable: ReturnType<typeof createInitialState> | undefined;
    for (let seed = 1; seed <= 100 && !profitable; seed += 1) {
      const candidate = createInitialState(seed);
      candidate.phase2.balances.set(parseOrganizationId("org_00000002"), parseMoney(100));
      dispatchProductCommand(
        candidate,
        command(`crime-low-${seed}`, "CommitCrime", {
          targetOrganizationId: parseOrganizationId("org_00000002"),
        }),
      );
      if (candidate.phase2.crime.lastOutcome === "profitable") profitable = candidate;
    }
    expect(profitable).toBeDefined();
    expect(profitable!.phase2.balances.get(organization)).toBe(12100);
    expect(profitable!.phase2.balances.get(parseOrganizationId("org_00000002"))).toBe(0);
  });

  it("projects calendar time, effective policy cost and public rival buildings", () => {
    const state = createInitialState(7);
    state.phase2.ordinance.status = "active";
    state.clock.tick = parseTick(36_000);
    const rivalBuildingId = parseBuildingId("building_00000009");
    state.phase2.buildings.set(rivalBuildingId, {
      id: rivalBuildingId,
      parcelId: parseParcelId("parcel_00000005"),
      ownerOrganizationId: parseOrganizationId("org_00000002"),
      type: "workshop",
      level: 1,
      condition: 90,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    });
    const projection = createViewProjection(state, true).economy!;
    expect(projection.gameTime).toMatchObject({ month: 2, day: 1, hour: 0 });
    expect(
      projection.constructionOptions.find((option) => option.type === "courtyard_home"),
    ).toMatchObject({
      baseCost: 3000,
      cost: 2400,
    });
    expect(projection.buildings.find((building) => building.id === rivalBuildingId)).toMatchObject({
      ownerOrganizationId: "org_00000002",
      tenantIds: [],
    });
  });

  it("enforces unit capacity and tenant budgets", () => {
    const state = createInitialState(13);
    dispatchProductCommand(
      state,
      command("buy", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    dispatchProductCommand(
      state,
      command("build", "StartConstruction", {
        parcelId: parseParcelId("parcel_00000001"),
        buildingType: "courtyard_home",
      }),
    );
    advanceToTick(state, 96 * 50);
    const buildingId = parseBuildingId("building_00000001");
    expect(
      dispatchProductCommand(
        state,
        command("tenant-1", "AssignTenant", {
          buildingId,
          tenantId: parseTenantId("tenant_00000001"),
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("tenant-2", "AssignTenant", {
          buildingId,
          tenantId: parseTenantId("tenant_00000004"),
        }),
      ).accepted,
    ).toBe(true);
    state.phase2.tenants.get(parseTenantId("tenant_00000003"))!.preferredBuildingType =
      "courtyard_home";
    expect(
      dispatchProductCommand(
        state,
        command("tenant-3", "AssignTenant", {
          buildingId,
          tenantId: parseTenantId("tenant_00000003"),
        }),
      ),
    ).toEqual({ accepted: false, code: "TENANT_ALREADY_ASSIGNED" });

    const second = createInitialState(14);
    dispatchProductCommand(
      second,
      command("buy-b", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    dispatchProductCommand(
      second,
      command("build-b", "StartConstruction", {
        parcelId: parseParcelId("parcel_00000001"),
        buildingType: "courtyard_home",
      }),
    );
    advanceToTick(second, 96 * 50);
    second.phase2.tenants.get(parseTenantId("tenant_00000001"))!.budget = parseMoney(100);
    expect(
      dispatchProductCommand(
        second,
        command("tenant-low", "AssignTenant", {
          buildingId,
          tenantId: parseTenantId("tenant_00000001"),
        }),
      ),
    ).toEqual({ accepted: false, code: "TENANT_BUDGET_TOO_LOW" });
  });

  it("repairs a deteriorated building through a timed crew assignment", () => {
    const state = createInitialState(29);
    dispatchProductCommand(
      state,
      command("repair-buy", "BuyParcel", { parcelId: parseParcelId("parcel_00000001") }),
    );
    dispatchProductCommand(
      state,
      command("repair-build", "StartConstruction", {
        parcelId: parseParcelId("parcel_00000001"),
        buildingType: "courtyard_home",
      }),
    );
    advanceToTick(state, 96 * 50);
    const buildingId = parseBuildingId("building_00000001");
    state.phase2.buildings.get(buildingId)!.condition = 55;
    const balanceBefore = state.phase2.balances.get(organization)!;

    expect(
      dispatchProductCommand(state, command("repair-start", "RepairBuilding", { buildingId }))
        .accepted,
    ).toBe(true);
    expect(state.phase2.balances.get(organization)).toBe(balanceBefore - 450);
    expect(
      [...state.phase2.constructionSites.values()].find(
        (site) => site.repairBuildingId === buildingId,
      )?.repairBuildingId,
    ).toBe(buildingId);

    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(state.phase2.buildings.get(buildingId)?.condition).toBe(100);
    expect(
      [...state.phase2.constructionSites.values()].some(
        (site) => site.repairBuildingId === buildingId,
      ),
    ).toBe(false);
  });

  it("builds a physical factory with parcel suitability and pauses production during fire", () => {
    const state = createInitialState(31);
    dispatchProductCommand(
      state,
      command("factory-buy", "BuyParcel", { parcelId: parseParcelId("parcel_00000005") }),
    );
    expect(
      dispatchProductCommand(
        state,
        command("factory-build", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000005"),
          buildingType: "cement_plant",
        }),
      ).accepted,
    ).toBe(true);

    advanceToTick(state, 120 * 2 * 50);
    const building = state.phase2.buildings.get(parseBuildingId("building_00000001"))!;
    expect(building.type).toBe("cement_plant");
    expect(building.productionFacilityId).not.toBeNull();
    const facility = state.phase2.facilities.get(building.productionFacilityId!)!;
    expect(facility.buildingId).toBe(building.id);
    expect(facility.suitabilityPercent).toBe(120);
    expect(createViewProjection(state, true).economy?.production[0]).toMatchObject({
      baseOutputAmount: 2,
      averageOutputAmount: 2.4,
      nextCycleOutputAmount: 2,
      remainder: 0,
    });
    facility.suitabilityPercent = 95;
    expect(createViewProjection(state, true).economy?.production[0]?.averageOutputAmount).toBe(1.9);
    facility.suitabilityPercent = 135;
    expect(createViewProjection(state, true).economy?.production[0]?.averageOutputAmount).toBe(2.7);
    facility.suitabilityPercent = 120;

    const inventory = state.phase2.inventories.get(organization)!;
    const beforeProduction = inventory.cement;
    advanceToTick(state, state.clock.tick + 72 * 50);
    expect(inventory.cement - beforeProduction).toBe(7);
    expect(facility.remainder).toBe(200_000);

    building.state = "burning";
    state.phase2.incidents.set(parseIncidentId("incident_00000002"), {
      id: parseIncidentId("incident_00000002"),
      buildingId: building.id,
      origin: "deterioration",
      intensity: 35,
      status: "active",
      targetOrganizationId: organization,
      createdAtTick: state.clock.tick,
      causedByAgentId: null,
      causedByOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    const duringFire = inventory.cement;
    expect(
      dispatchProductCommand(
        state,
        command("factory-maintenance", "AssignMaintenance", { buildingId: building.id }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 23 * 50);
    expect(inventory.cement).toBe(duringFire);
    expect(building.state).toBe("operational");
    expect(state.phase2.incidents.get(parseIncidentId("incident_00000002"))?.status).toBe(
      "resolved",
    );
    advanceToTick(state, state.clock.tick + 50);
    expect(inventory.cement).toBeGreaterThan(duringFire);

    building.condition = 55;
    expect(createViewProjection(state, true).economy?.production[0]?.averageOutputAmount).toBe(
      1.32,
    );
    expect(
      dispatchProductCommand(
        state,
        command("factory-repair", "RepairBuilding", { buildingId: building.id }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(building.condition).toBe(100);

    expect(
      dispatchProductCommand(
        state,
        command("factory-upgrade", "UpgradeBuilding", { buildingId: building.id }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 60 * 2 * 50);
    expect(facility.upgradePercent).toBe(125);
    expect(createViewProjection(state, true).economy?.production[0]?.averageOutputAmount).toBe(3);
    const physicalProjection = createViewProjection(state, true);
    viewProjectionV1Schema.parse(physicalProjection);

    building.state = "ruin";
    state.phase2.incidents.set(parseIncidentId("incident_00000001"), {
      id: parseIncidentId("incident_00000001"),
      buildingId: building.id,
      origin: "deterioration",
      intensity: 100,
      status: "resolved",
      targetOrganizationId: organization,
      createdAtTick: state.clock.tick,
      causedByAgentId: null,
      causedByOrganizationId: null,
      casualties: { injured: 0, dead: 0 },
    });
    expect(
      dispatchProductCommand(
        state,
        command("factory-clear", "ClearRuin", { buildingId: building.id }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(state.phase2.buildings.has(building.id)).toBe(false);
    expect(state.phase2.facilities.has(facility.id)).toBe(false);
    const restoredAfterClear = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(
      restoredAfterClear.phase2.incidents.get(parseIncidentId("incident_00000001")),
    ).toMatchObject({
      status: "resolved",
      buildingId: building.id,
    });
  });

  it("does not produce before completion and applies parcel suitability", () => {
    const buildFactory = (seed: number, parcelId: string) => {
      const state = createInitialState(seed);
      dispatchProductCommand(
        state,
        command(`factory-buy-${seed}`, "BuyParcel", { parcelId: parseParcelId(parcelId) }),
      );
      dispatchProductCommand(
        state,
        command(`factory-build-${seed}`, "StartConstruction", {
          parcelId: parseParcelId(parcelId),
          buildingType: "cement_plant",
        }),
      );
      const inventoryBefore = { ...state.phase2.inventories.get(organization)! };
      advanceToTick(state, 120 * 50 - 1);
      expect(state.phase2.buildings).toHaveLength(0);
      expect(state.phase2.facilities).toHaveLength(0);
      expect(state.phase2.inventories.get(organization)).toEqual(inventoryBefore);

      advanceToTick(state, 120 * 50 + 50);
      const building = [...state.phase2.buildings.values()][0]!;
      const facility = state.phase2.facilities.get(building.productionFacilityId!)!;
      return { state, facility };
    };

    const highSuitability = buildFactory(41, "parcel_00000005");
    const mixedSuitability = buildFactory(43, "parcel_00000006");
    expect(highSuitability.facility.suitabilityPercent).toBe(120);
    expect(mixedSuitability.facility.suitabilityPercent).toBe(95);
    expect(
      createViewProjection(highSuitability.state, true).economy?.production[0]?.averageOutputAmount,
    ).toBe(2.4);
    expect(
      createViewProjection(mixedSuitability.state, true).economy?.production[0]
        ?.averageOutputAmount,
    ).toBe(1.9);
  });

  it("lets the rival choose market supply or a physical factory through normal commands", () => {
    const productionState = createInitialState(47);
    productionState.phase2.parcels.get(parseParcelId("parcel_00000005"))!.ownerOrganizationId =
      parseOrganizationId("org_00000002");
    productionState.clock.tick = parseTick(50 * 24);
    advanceProductSystems(productionState);
    expect(productionState.phase2.rivalAi.lastAction).toBe("build_production");
    expect(["cement_plant", "brickworks", "steelworks"]).toContain(
      [...productionState.phase2.constructionSites.values()][0]?.buildingType,
    );

    const marketState = createInitialState(53);
    marketState.phase2.parcels.get(parseParcelId("parcel_00000005"))!.ownerOrganizationId =
      parseOrganizationId("org_00000002");
    marketState.phase2.inventories.get(parseOrganizationId("org_00000002"))!.brick = 0;
    marketState.clock.tick = parseTick(50 * 24);
    advanceProductSystems(marketState);
    expect(marketState.phase2.rivalAi.lastAction).toBe("buy_materials");
    expect(marketState.phase2.inventories.get(parseOrganizationId("org_00000002"))!.brick).toBe(2);
  });

  it("migrates snapshots without kind by building linkage", () => {
    const state = createInitialState(37);
    dispatchProductCommand(
      state,
      command("migration-buy", "BuyParcel", { parcelId: parseParcelId("parcel_00000005") }),
    );
    dispatchProductCommand(
      state,
      command("migration-build", "StartConstruction", {
        parcelId: parseParcelId("parcel_00000005"),
        buildingType: "cement_plant",
      }),
    );
    advanceToTick(state, 120 * 2 * 50);
    for (const site of state.phase2.constructionSites.values()) {
      if (site.crewCapacity === 0) site.crewCapacity = 1;
    }
    const snapshot = serializeSnapshot(state);
    const physical = snapshot.phase2!.facilities[0]!;
    delete (physical as { kind?: string }).kind;
    delete (physical as { conditionPercent?: number }).conditionPercent;
    delete (physical as { upgradePercent?: number }).upgradePercent;
    delete (physical as { remainder?: number }).remainder;
    const legacy = {
      ...physical,
      id: parseFacilityId("facility_99999999"),
      buildingId: null,
      operational: false,
    };
    delete (legacy as { kind?: string }).kind;
    snapshot.phase2!.facilities.push(legacy);

    const restored = restoreStateFromSnapshot(snapshot);
    expect(restored.phase2.facilities.get(physical.id)?.kind).toBe("physical");
    expect(restored.phase2.facilities.get(parseFacilityId("facility_99999999"))?.kind).toBe(
      "legacy",
    );
    expect(
      dispatchProductCommand(
        restored,
        command("legacy-invest-migrated", "InvestInProduction", { resource: "cement" }),
      ).accepted,
    ).toBe(true);

    const broken = serializeSnapshot(state);
    broken.phase2!.buildings[0]!.productionFacilityId = null;
    expect(() => restoreStateFromSnapshot(broken)).toThrow(/bidirectional/);
  });
});

describe("WP3.4 banking and debt", () => {
  it("offers and disburses a collateralized loan without creating money", () => {
    const state = createInitialState(31);
    const parcelId = parseParcelId("parcel_00000001");
    expect(
      dispatchProductCommand(state, command("loan-buy", "BuyParcel", { parcelId })).accepted,
    ).toBe(true);
    const parcel = state.phase2.parcels.get(parcelId)!;
    parcel.price = parseMoney(2000);
    const beforeTotal =
      state.phase2.balances.get(organization)! +
      state.phase2.balances.get(parseOrganizationId("org_00000003"))!;
    expect(
      dispatchProductCommand(
        state,
        command("loan-request", "RequestLoan", {
          amount: parseMoney(600),
          termMonths: 12,
          collateralParcelId: parcelId,
        }),
      ).accepted,
    ).toBe(true);
    expect(state.phase2.loans.get(parseLoanId("loan_00000001"))?.status).toBe("offered");
    expect(
      dispatchProductCommand(
        state,
        command("loan-accept", "AcceptLoanOffer", { loanId: parseLoanId("loan_00000001") }),
      ).accepted,
    ).toBe(true);
    expect(state.phase2.loans.get(parseLoanId("loan_00000001"))).toMatchObject({
      status: "active",
      principal: 600,
      outstandingPrincipal: 600,
      nextPaymentTick: GAME_MONTH_TICKS,
    });
    const afterTotal =
      state.phase2.balances.get(organization)! +
      state.phase2.balances.get(parseOrganizationId("org_00000003"))!;
    expect(afterTotal).toBe(beforeTotal);
  });

  it("amortizes once per due month and persists the next due tick", () => {
    const state = createInitialState(32);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command("amort-buy", "BuyParcel", { parcelId }));
    state.phase2.parcels.get(parcelId)!.price = parseMoney(2000);
    dispatchProductCommand(
      state,
      command("amort-request", "RequestLoan", {
        amount: parseMoney(600),
        termMonths: 12,
        collateralParcelId: parcelId,
      }),
    );
    dispatchProductCommand(
      state,
      command("amort-accept", "AcceptLoanOffer", { loanId: parseLoanId("loan_00000001") }),
    );
    const beforePayment = state.phase2.balances.get(organization)!;
    advanceToTick(state, GAME_MONTH_TICKS);
    const loan = state.phase2.loans.get(parseLoanId("loan_00000001"))!;
    expect(loan).toMatchObject({
      status: "active",
      outstandingPrincipal: 550,
      nextPaymentTick: GAME_MONTH_TICKS * 2,
    });
    expect(state.phase2.balances.get(organization)).toBe(beforePayment - 75);
    const transactionCount = state.phase2.transactions.length;
    advanceProductSystems(state);
    expect(state.phase2.transactions).toHaveLength(transactionCount);
  });

  it("transitions to delinquency and then default when liquidity stays insufficient", () => {
    const state = createInitialState(33);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command("mora-buy", "BuyParcel", { parcelId }));
    state.phase2.parcels.get(parcelId)!.price = parseMoney(2000);
    dispatchProductCommand(
      state,
      command("mora-request", "RequestLoan", {
        amount: parseMoney(600),
        termMonths: 12,
        collateralParcelId: parcelId,
      }),
    );
    dispatchProductCommand(
      state,
      command("mora-accept", "AcceptLoanOffer", { loanId: parseLoanId("loan_00000001") }),
    );
    state.phase2.balances.set(organization, parseMoney(0));
    advanceToTick(state, GAME_MONTH_TICKS);
    expect(state.phase2.loans.get(parseLoanId("loan_00000001"))?.status).toBe("delinquent");
    advanceToTick(state, GAME_MONTH_TICKS * 2);
    expect(state.phase2.loans.get(parseLoanId("loan_00000001"))?.status).toBe("defaulted");
  });

  it("round-trips loan schedule through save/load", () => {
    const state = createInitialState(34);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command("save-loan-buy", "BuyParcel", { parcelId }));
    state.phase2.parcels.get(parcelId)!.price = parseMoney(2000);
    dispatchProductCommand(
      state,
      command("save-loan-request", "RequestLoan", {
        amount: parseMoney(600),
        termMonths: 12,
        collateralParcelId: parcelId,
      }),
    );
    dispatchProductCommand(
      state,
      command("save-loan-accept", "AcceptLoanOffer", { loanId: parseLoanId("loan_00000001") }),
    );
    const snapshot = serializeSnapshot(state);
    const restored = restoreStateFromSnapshot(snapshot);
    expect(serializeSnapshot(restored)).toEqual(snapshot);
    expect(restored.phase2.loans.get(parseLoanId("loan_00000001"))?.nextPaymentTick).toBe(
      GAME_MONTH_TICKS,
    );
  });
});

describe("WP3.5 taxation and fees", () => {
  it("charges a transfer fee immediately and property tax at the monthly settlement", () => {
    const state = createInitialState(61);
    const parcelId = parseParcelId("parcel_00000005");
    state.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 2);
    const before = state.phase2.balances.get(organization)!;
    dispatchProductCommand(state, command("tax-buy", "BuyParcel", { parcelId }));

    expect(state.phase2.balances.get(organization)).toBe(before - 812);
    expect(state.phase2.balances.get(parseOrganizationId("org_00000004"))).toBe(12);
    expect(state.phase2.taxation.totalCollected).toBe(12);

    advanceToTick(state, GAME_MONTH_TICKS);
    expect(state.phase2.balances.get(organization)).toBe(before - 822);
    expect(state.phase2.balances.get(parseOrganizationId("org_00000004"))).toBe(22);
    expect(state.phase2.taxation).toMatchObject({
      lastSettlementTick: GAME_MONTH_TICKS,
      nextSettlementTick: GAME_MONTH_TICKS * 2,
      totalCollected: 22,
    });
  });

  it("honors an explicit exemption without changing the transfer fee", () => {
    const state = createInitialState(62);
    const parcelId = parseParcelId("parcel_00000005");
    state.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 2);
    dispatchProductCommand(state, command("exempt-buy", "BuyParcel", { parcelId }));
    state.phase2.taxation.exemptOrganizationIds.push(organization);
    const balanceAfterPurchase = state.phase2.balances.get(organization)!;

    advanceToTick(state, GAME_MONTH_TICKS);
    expect(state.phase2.balances.get(organization)).toBe(balanceAfterPurchase);
    expect(state.phase2.taxation.totalCollected).toBe(12);
    expect(state.phase2.taxation.arrearsByOrganizationId[organization]).toBeUndefined();
  });

  it("exposes ordinance-adjusted rates before a decision is made", () => {
    const state = createInitialState(63);
    state.phase2.ordinance.status = "active";
    state.phase2.ordinance.propertyTaxModifierPercent = -50;
    state.phase2.ordinance.transferTaxModifierPercent = -50;
    const projection = createViewProjection(state, true);

    expect(projection.economy?.taxation).toMatchObject({
      propertyRateBps: 60,
      transferRateBps: 75,
      projectedMonthlyPropertyTax: 0,
    });
    expect(projection.economy?.parcels[0]).toMatchObject({
      estimatedTransferTax: 7,
      estimatedMonthlyPropertyTax: 6,
    });
  });

  it("restores a schedule immediately before settlement without double charging", () => {
    const state = createInitialState(64);
    const parcelId = parseParcelId("parcel_00000005");
    dispatchProductCommand(state, command("near-due-buy", "BuyParcel", { parcelId }));
    state.clock = {
      ...state.clock,
      tick: parseTick(state.phase2.taxation.nextSettlementTick - 1),
    };
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    advanceProductSystems(restored);
    expect(restored.phase2.taxation.lastSettlementTick).toBeNull();
    advanceProductSystems(restored);
    const settledBalance = restored.phase2.balances.get(organization)!;
    expect(restored.phase2.taxation.lastSettlementTick).toBe(GAME_MONTH_TICKS);
    advanceProductSystems(restored);
    expect(restored.phase2.balances.get(organization)).toBe(settledBalance);
  });
});

describe("WP3.6 maintenance and deterioration", () => {
  function addTestBuilding(
    state: ReturnType<typeof createInitialState>,
    condition = 100,
  ): ReturnType<typeof parseBuildingId> {
    const buildingId = parseBuildingId("building_00000001");
    const parcel = state.phase2.parcels.get(parseParcelId("parcel_00000001"))!;
    parcel.ownerOrganizationId = organization;
    parcel.buildingId = buildingId;
    state.phase2.buildings.set(buildingId, {
      id: buildingId,
      parcelId: parcel.id,
      ownerOrganizationId: organization,
      productionFacilityId: null,
      type: "courtyard_home",
      level: 1,
      condition,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    });
    return buildingId;
  }

  function moveToMaintenanceSettlement(
    state: ReturnType<typeof createInitialState>,
    tick: number,
  ): void {
    state.clock = { ...state.clock, tick: parseTick(tick) };
    state.phase2.taxation.nextSettlementTick = parseTick(tick + GAME_MONTH_TICKS);
    state.phase2.rivalAi.cooldownUntilTick = parseTick(tick + GAME_MONTH_TICKS);
    advanceProductSystems(state);
  }

  it("liquida mantenimiento equilibrado y recupera la condición sin interacción manual", () => {
    const state = createInitialState(71);
    const buildingId = addTestBuilding(state);
    const before = state.phase2.balances.get(organization)!;
    state.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS);

    moveToMaintenanceSettlement(state, GAME_MONTH_TICKS);

    expect(state.phase2.buildings.get(buildingId)?.condition).toBe(100);
    expect(state.phase2.balances.get(organization)).toBe(before - 35);
    expect(state.phase2.maintenance).toMatchObject({
      lastSettlementTick: GAME_MONTH_TICKS,
      nextSettlementTick: GAME_MONTH_TICKS * 2,
      backlogByBuildingId: {},
    });
    expect(state.phase2.transactions.at(-1)).toMatchObject({
      cause: "maintenance_service",
      amount: 35,
      referenceId: buildingId,
      direction: "debit",
    });
  });

  it("permite diferir, acumula backlog y conserva la deuda si después no hay liquidez", () => {
    const state = createInitialState(72);
    const buildingId = addTestBuilding(state);
    expect(
      dispatchProductCommand(
        state,
        command("maintenance-deferred", "SetMaintenancePolicy", { policy: "deferred" }),
      ).accepted,
    ).toBe(true);
    const before = state.phase2.balances.get(organization)!;
    state.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS);

    moveToMaintenanceSettlement(state, GAME_MONTH_TICKS);

    expect(state.phase2.balances.get(organization)).toBe(before);
    expect(state.phase2.buildings.get(buildingId)?.condition).toBe(95);
    expect(state.phase2.maintenance.backlogByBuildingId[buildingId]).toBe(35);

    expect(
      dispatchProductCommand(
        state,
        command("maintenance-balanced", "SetMaintenancePolicy", { policy: "balanced" }),
      ).accepted,
    ).toBe(true);
    state.phase2.balances.set(organization, parseMoney(0));
    state.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
    moveToMaintenanceSettlement(state, GAME_MONTH_TICKS * 2);

    expect(state.phase2.buildings.get(buildingId)?.condition).toBe(90);
    expect(state.phase2.maintenance.backlogByBuildingId[buildingId]).toBe(70);
    expect(
      state.phase2.transactions.some(
        (transaction) =>
          transaction.cause === "maintenance_service" && transaction.tick === GAME_MONTH_TICKS * 2,
      ),
    ).toBe(false);
  });

  it("expone el coste y el backlog en la proyección y persiste la política", () => {
    const state = createInitialState(73);
    const buildingId = addTestBuilding(state, 55);
    state.phase2.maintenance.policy = "deferred";
    state.phase2.maintenance.backlogByBuildingId[buildingId] = parseMoney(35);
    const projection = createViewProjection(state, true);

    expect(projection.economy?.maintenance).toMatchObject({
      policy: "deferred",
      monthlyCost: 0,
      backlog: 35,
    });
    expect(projection.economy?.buildings[0]).toMatchObject({
      maintenanceCost: 35,
      maintenanceDue: 70,
      effectiveRent: 140,
    });
    expect(projection.economy?.financials?.assets).toBe(17110);
    expect(deteriorationRiskPercent(100)).toBe(0);
    expect(deteriorationRiskPercent(60)).toBe(30);
    expect(deteriorationRiskPercent(20)).toBe(80);

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.maintenance).toEqual(state.phase2.maintenance);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
  });
});

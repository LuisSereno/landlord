import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseFacilityId,
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
    expect(state.phase2.balances.get(organization)).toBe(before - 900);
    expect(state.phase2.transactions).toHaveLength(1);
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
    const duringFire = inventory.cement;
    advanceToTick(state, state.clock.tick + 24 * 50);
    expect(inventory.cement).toBe(duringFire);

    building.state = "operational";
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
    expect(
      dispatchProductCommand(
        state,
        command("factory-clear", "ClearRuin", { buildingId: building.id }),
      ).accepted,
    ).toBe(true);
    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(state.phase2.buildings.has(building.id)).toBe(false);
    expect(state.phase2.facilities.has(facility.id)).toBe(false);
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

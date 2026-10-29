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
  viewProjectionV2Schema,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { activePermitFor, publishedPermitForParcel } from "./permitting";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";
import { controlGrantKey, createInitialState } from "./state";
import { rivalParcel } from "./test-support";
import { developmentCodeById } from "./development-codes";
import { createViewProjection } from "./projection";
import { GAME_DAY_TICKS, GAME_MONTH_TICKS, deteriorationRiskPercent } from "./game-data";

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
    advanceToTick(state, 120 * 50);

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
    /** WP4.11-H: la vigencia es la de una legislatura, explícita en el estado y no un 24_000 mágico. */
    const ordinance = state.phase2.ordinance;
    expect(ordinance.status).toBe("active");
    expect(ordinance.expiresAtTick).not.toBeNull();
    state.clock = { ...state.clock, tick: ordinance.expiresAtTick! };
    advanceProductSystems(state);
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
    dispatchProductCommand(
      state,
      command("buy-3", "BuyParcel", { parcelId: parseParcelId("parcel_00000003") }),
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
        command("build-2", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000002"),
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    expect(
      dispatchProductCommand(
        state,
        command("build-3", "StartConstruction", {
          parcelId: parseParcelId("parcel_00000003"),
          buildingType: "courtyard_home",
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
    advanceToTick(state, 120 * 50);
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
    const rivalParcelForBuilding = state.phase2.parcels.get(parseParcelId("parcel_00000005"))!;
    state.phase2.buildings.set(rivalBuildingId, {
      id: rivalBuildingId,
      parcelId: rivalParcelForBuilding.id,
      districtId: rivalParcelForBuilding.districtId,
      footprintCells: [{ ...rivalParcelForBuilding.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "shed",
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
    advanceToTick(state, 120 * 50);
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
    advanceToTick(second, 120 * 50);
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
    advanceToTick(state, 120 * 50);
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
      publiclyAttributedOrganizationId: null,
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
    const afterFire = inventory.cement;
    for (let tick = 0; tick < 500 && inventory.cement === afterFire; tick += 1) {
      advanceProductSystems(state);
    }
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
    viewProjectionV2Schema.parse(physicalProjection);

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
      publiclyAttributedOrganizationId: null,
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
    const buildFactory = (seed: number, parcelId: string, suitability?: number) => {
      const state = createInitialState(seed);
      if (suitability !== undefined) {
        const parcel = state.phase2.parcels.get(parseParcelId(parcelId))!;
        parcel.productionSuitability = {
          ...(parcel.productionSuitability ?? { cement: 100, brick: 100, steel: 100 }),
          cement: suitability,
        };
      }
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
      expect(
        [...state.phase2.buildings.values()].filter(
          (entry) => entry.ownerOrganizationId === organization,
        ),
      ).toHaveLength(0);
      expect(state.phase2.facilities).toHaveLength(0);
      expect(state.phase2.inventories.get(organization)).toEqual(inventoryBefore);

      advanceToTick(state, 180 * 50);
      const building = [...state.phase2.buildings.values()].find(
        (entry) => entry.parcelId === parseParcelId(parcelId),
      )!;
      const facility = state.phase2.facilities.get(building.productionFacilityId!)!;
      return { state, facility };
    };

    const highSuitability = buildFactory(41, "parcel_00000005");
    const mixedSuitability = buildFactory(43, "parcel_00000007", 95);
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
    rivalParcel(productionState, (parcel) =>
      developmentCodeById(parcel.developmentCodeId).allowedUses.includes("industrial"),
    ).ownerOrganizationId = parseOrganizationId("org_00000002");
    productionState.clock.tick = parseTick(50 * 24);
    advanceProductSystems(productionState);
    expect(productionState.phase2.rivalAi.lastAction).toBe("build_production");
    expect(["cement_plant", "brickworks", "steelworks"]).toContain(
      [...productionState.phase2.constructionSites.values()][0]?.buildingType,
    );

    const marketState = createInitialState(53);
    rivalParcel(marketState, (parcel) =>
      developmentCodeById(parcel.developmentCodeId).allowedUses.includes("industrial"),
    ).ownerOrganizationId = parseOrganizationId("org_00000002");
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
    parcel.marketValue = parseMoney(2000);
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
    state.phase2.parcels.get(parcelId)!.marketValue = parseMoney(2000);
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
    state.phase2.parcels.get(parcelId)!.marketValue = parseMoney(2000);
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
    state.phase2.parcels.get(parcelId)!.marketValue = parseMoney(2000);
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
    // WP4.5: el municipio ya no acumula impuestos sin gastar. Cobra 10 de propiedad sobre los 12
    // de la transferencia y paga 10 de administración en el mismo cierre, así que su caja es 12 y
    // el ingreso sigue siendo verificable en el libro presupuestario.
    expect(state.phase2.balances.get(parseOrganizationId("org_00000004"))).toBe(12);
    expect(state.phase2.municipal.revenueTotalBySource.propertyTax).toBe(10);
    expect(state.phase2.municipal.revenueTotalBySource.transferTax).toBe(12);
    expect(state.phase2.municipal.spentTotalByCategory.administration).toBe(10);
    expect(state.phase2.municipal.serviceLevelPercentByCategory.administration).toBe(100);
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
    state.phase2.buildings.set(buildingId, {
      id: buildingId,
      parcelId: parcel.id,
      districtId: parcel.districtId,
      footprintCells: [{ ...parcel.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "detached",
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

describe("WP3.7 insurance and covered events", () => {
  function addInsuranceBuilding(
    state: ReturnType<typeof createInitialState>,
    condition = 100,
  ): ReturnType<typeof parseBuildingId> {
    const buildingId = parseBuildingId("building_00000001");
    const parcel = state.phase2.parcels.get(parseParcelId("parcel_00000001"))!;
    parcel.ownerOrganizationId = organization;
    state.phase2.buildings.set(buildingId, {
      id: buildingId,
      parcelId: parcel.id,
      districtId: parcel.districtId,
      footprintCells: [{ ...parcel.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "detached",
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

  function settleInsuranceAtMonth(state: ReturnType<typeof createInitialState>): void {
    state.phase2.taxation.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
    state.phase2.maintenance.nextSettlementTick = parseTick(GAME_MONTH_TICKS * 2);
    state.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 2);
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    advanceProductSystems(state);
  }

  it("offers comparable coverage and pays a covered deterioration claim", () => {
    let candidate: ReturnType<typeof createInitialState> | undefined;
    const buildingId = parseBuildingId("building_00000001");
    for (let seed = 1; seed <= 100 && !candidate; seed += 1) {
      const state = createInitialState(seed);
      addInsuranceBuilding(state, 10);
      const result = dispatchProductCommand(
        state,
        command(`insurance-buy-${seed}`, "BuyInsurance", {
          buildingId,
          coverage: "fire_plus",
        }),
      );
      expect(result.accepted).toBe(true);
      settleInsuranceAtMonth(state);
      if (Object.values(state.phase2.insurance.claimsByIncidentId).length > 0) candidate = state;
    }
    expect(candidate).toBeDefined();
    const state = candidate!;
    expect(state.phase2.insurance.contractsByBuildingId[buildingId]).toMatchObject({
      coverage: "fire_plus",
      premium: 130,
      coverageLimit: 3000,
      deductible: 350,
      status: "active",
      totalPremiumPaid: 260,
    });
    expect(Object.values(state.phase2.insurance.claimsByIncidentId)).toContainEqual(
      expect.objectContaining({
        buildingId,
        coverage: "fire_plus",
        status: "paid",
        lossEstimate: 1200,
        payout: 850,
      }),
    );
    expect(state.phase2.balances.get(organization)).toBe(12590);
    expect(state.phase2.balances.get(parseOrganizationId("org_00000005"))).toBe(99410);
  });

  it("records exclusions and lapses a policy when its recurring premium cannot be paid", () => {
    const state = createInitialState(81);
    const buildingId = addInsuranceBuilding(state, 100);
    expect(
      dispatchProductCommand(
        state,
        command("insurance-basic", "BuyInsurance", { buildingId, coverage: "fire_basic" }),
      ).accepted,
    ).toBe(true);
    expect(createViewProjection(state, true).economy?.insurance.offers).toEqual([]);
    expect(createViewProjection(state, true).economy?.insurance.contracts[0]).toMatchObject({
      coverage: "fire_basic",
      premium: 25,
      coverageLimit: 1800,
      deductible: 200,
      exclusions: ["sabotage", "blast"],
    });
    state.phase2.balances.set(organization, parseMoney(0));
    settleInsuranceAtMonth(state);
    expect(state.phase2.insurance.contractsByBuildingId[buildingId]).toMatchObject({
      status: "lapsed",
      nextPremiumTick: null,
      totalPremiumPaid: 25,
    });

    const uninsured = createInitialState(82);
    const uninsuredBuildingId = addInsuranceBuilding(uninsured, 10);
    settleInsuranceAtMonth(uninsured);
    expect(Object.values(uninsured.phase2.insurance.claimsByIncidentId)).toContainEqual(
      expect.objectContaining({
        buildingId: uninsuredBuildingId,
        coverage: null,
        status: "excluded",
        payout: 0,
      }),
    );
  });

  it("cancels and restores insurance state without renewing after load", () => {
    const state = createInitialState(83);
    const buildingId = addInsuranceBuilding(state);
    dispatchProductCommand(
      state,
      command("insurance-cancel-buy", "BuyInsurance", {
        buildingId,
        coverage: "fire_plus",
      }),
    );
    expect(
      dispatchProductCommand(state, command("insurance-cancel", "CancelInsurance", { buildingId })),
    ).toMatchObject({ accepted: true });
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.insurance).toEqual(state.phase2.insurance);
    expect(createViewProjection(restored, true).economy?.insurance.contracts[0]).toMatchObject({
      status: "cancelled",
      nextPremiumTick: null,
    });
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
  });
});

describe("WP3.8 zoning and permits", () => {
  it("exposes permitted uses and rejects an incompatible zoning request", () => {
    const state = createInitialState(91);
    const parcelId = parseParcelId("parcel_00000005");
    dispatchProductCommand(state, command("permit-buy-industrial", "BuyParcel", { parcelId }));

    expect(
      dispatchProductCommand(
        state,
        command("permit-invalid-use", "RequestPermit", {
          parcelId,
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "USE_NOT_ALLOWED" });
    expect(
      createViewProjection(state, true).economy?.parcels.find((p) => p.id === parcelId),
    ).toMatchObject({
      zoning: "industrial",
      /**
       * H1-04: `allowedUses` es compatibilidad, no requisitos acumulativos. El taller declara
       * `["industrial", "retail"]` y aquí era ilegal con la lectura `every`, es decir, no existía
       * ninguna parcela donde construirlo.
       */
      permittedBuildingTypes: ["workshop", "cement_plant", "brickworks", "steelworks", "warehouse"],
      regulatoryRiskPercent: 25,
      permitStatus: null,
    });
  });

  it("applies a municipal permit policy, denies deterministically, then approves and persists", () => {
    const state = createInitialState(92);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command("permit-buy-residential", "BuyParcel", { parcelId }));
    state.phase2.ordinance.status = "active";
    state.phase2.ordinance.permitApprovalModifierPercent = -100;

    expect(
      dispatchProductCommand(
        state,
        command("permit-denied", "RequestPermit", {
          parcelId,
          buildingType: "courtyard_home",
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PermitDenied" } });
    expect(publishedPermitForParcel(state, parcelId, state.clock.tick)).toMatchObject({
      status: "denied",
      authorityOrganizationId: "org_00000004",
      requirements: expect.arrayContaining(["code:res_urban_4f", "use:courtyard_home"]),
      developmentCodeIdAtDecision: "res_urban_4f",
      allowedUsesAtDecision: ["residential"],
      currentUsesAtDecision: [],
      expiresAtTick: null,
    });
    expect(
      dispatchProductCommand(
        state,
        command("permit-construction-denied", "StartConstruction", {
          parcelId,
          buildingType: "courtyard_home",
        }),
      ),
    ).toEqual({ accepted: false, code: "PERMIT_DENIED" });

    state.phase2.ordinance.permitApprovalModifierPercent = 0;
    expect(
      dispatchProductCommand(
        state,
        command("permit-approved", "RequestPermit", {
          parcelId,
          buildingType: "courtyard_home",
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PermitApproved" } });
    const permit = activePermitFor(state, parcelId, "courtyard_home", state.clock.tick)!;
    expect(permit).toMatchObject({
      status: "approved",
      expiresAtTick: GAME_MONTH_TICKS * 6,
    });
    expect(
      dispatchProductCommand(
        state,
        command("permit-construction-approved", "StartConstruction", {
          parcelId,
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);

    /**
     * El permiso de esta parcela se gastó en la obra aceptada, así que la inspección publica la
     * decisión cerrada, no una caducidad (H1-03). La caducidad se comprueba en una parcela cuyo
     * permiso sigue sin consumir.
     */
    expect(
      createViewProjection(state, true).economy?.parcels.find((p) => p.id === parcelId),
    ).toMatchObject({
      permitStatus: "consumed",
      permitExpiresAtTick: GAME_MONTH_TICKS * 6,
    });

    const unusedParcelId = parseParcelId("parcel_00000002");
    dispatchProductCommand(
      state,
      command("permit-buy-unused", "BuyParcel", { parcelId: unusedParcelId }),
    );
    expect(
      dispatchProductCommand(
        state,
        command("permit-approve-unused", "RequestPermit", {
          parcelId: unusedParcelId,
          buildingType: "courtyard_home",
        }),
      ).accepted,
    ).toBe(true);
    const unusedPermit = activePermitFor(
      state,
      unusedParcelId,
      "courtyard_home",
      state.clock.tick,
    )!;
    expect(
      createViewProjection(state, true).economy?.parcels.find((p) => p.id === unusedParcelId),
    ).toMatchObject({ permitStatus: "approved", permitId: unusedPermit.id });

    state.clock = { ...state.clock, tick: unusedPermit.expiresAtTick! };
    expect(
      createViewProjection(state, true).economy?.parcels.find((p) => p.id === unusedParcelId),
    ).toMatchObject({
      permitStatus: "expired",
      permitExpiresAtTick: unusedPermit.expiresAtTick,
    });
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.phase2.permitting).toEqual(state.phase2.permitting);
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
  });
});

describe("WP3.9 auctions and insolvency recovery", () => {
  function createDefaultedLoan(seed: number): ReturnType<typeof createInitialState> {
    const state = createInitialState(seed);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command(`crisis-buy-${seed}`, "BuyParcel", { parcelId }));
    state.phase2.parcels.get(parcelId)!.marketValue = parseMoney(2000);
    dispatchProductCommand(
      state,
      command(`crisis-request-${seed}`, "RequestLoan", {
        amount: parseMoney(600),
        termMonths: 12,
        collateralParcelId: parcelId,
      }),
    );
    dispatchProductCommand(
      state,
      command(`crisis-accept-${seed}`, "AcceptLoanOffer", { loanId: parseLoanId("loan_00000001") }),
    );
    state.phase2.rivalAi.cooldownUntilTick = parseTick(GAME_MONTH_TICKS * 3);
    state.phase2.balances.set(organization, parseMoney(0));
    advanceToTick(state, GAME_MONTH_TICKS * 2);
    return state;
  }

  it("opens a collateral auction after default and supports limited refinancing", () => {
    const state = createDefaultedLoan(101);
    const loan = state.phase2.loans.get(parseLoanId("loan_00000001"))!;
    const auction = state.phase2.insolvency.auctionsByLoanId[loan.id]!;
    expect(loan.status).toBe("defaulted");
    expect(auction).toMatchObject({
      status: "open",
      highestBid: 0,
      sellerOrganizationId: organization,
    });
    expect(auction.reservePrice).toBeGreaterThan(0);

    expect(
      dispatchProductCommand(
        state,
        command("crisis-refinance", "RequestRefinancing", {
          loanId: loan.id,
          termMonths: 12,
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "LoanRefinanced" } });
    expect(loan).toMatchObject({
      status: "active",
      outstandingPrincipal: 630,
      remainingMonths: 12,
      nextPaymentTick: GAME_MONTH_TICKS * 2 + 1 + GAME_MONTH_TICKS,
    });
    expect(state.phase2.insolvency.auctionsByLoanId[loan.id]?.status).toBe("closed");
  });

  it("reserves bids, rejects ties, supports withdrawal and transfers ownership atomically", () => {
    const state = createDefaultedLoan(102);
    state.phase2.balances.set(organization, parseMoney(2000));
    const loanId = parseLoanId("loan_00000001");
    const auction = state.phase2.insolvency.auctionsByLoanId[loanId]!;
    const reserve = auction.reservePrice;
    const beforeBalance = state.phase2.balances.get(organization)!;
    const beforeBank = state.phase2.balances.get(parseOrganizationId("org_00000003"))!;
    expect(
      dispatchProductCommand(
        state,
        command("crisis-low-bid", "PlaceAuctionBid", { loanId, amount: parseMoney(reserve - 1) }),
      ),
    ).toEqual({ accepted: false, code: "AUCTION_BID_TOO_LOW" });
    expect(
      dispatchProductCommand(
        state,
        command("crisis-bid", "PlaceAuctionBid", { loanId, amount: parseMoney(reserve) }),
      ).accepted,
    ).toBe(true);
    expect(state.phase2.balances.get(organization)).toBe(beforeBalance);
    expect(
      dispatchProductCommand(
        state,
        command("crisis-tie", "PlaceAuctionBid", { loanId, amount: parseMoney(reserve) }),
      ),
    ).toEqual({ accepted: false, code: "AUCTION_BID_TOO_LOW" });
    expect(
      dispatchProductCommand(state, command("crisis-withdraw", "WithdrawAuctionBid", { loanId })),
    ).toMatchObject({ accepted: true });

    const rival = parseOrganizationId("org_00000002");
    state.controlGrants.set(controlGrantKey(actor, rival), {
      personId: actor,
      organizationId: rival,
    });
    expect(
      dispatchProductCommand(state, {
        ...command("crisis-rival-bid", "PlaceAuctionBid", { loanId, amount: parseMoney(1400) }),
        actingAsOrganizationId: rival,
      }),
    ).toMatchObject({ accepted: true });
    state.phase2.rivalAi.cooldownUntilTick = parseTick(auction.closesAtTick + GAME_DAY_TICKS);
    advanceToTick(state, auction.closesAtTick);

    expect(state.phase2.insolvency.auctionsByLoanId[loanId]?.status).toBe("executed");
    expect(state.phase2.parcels.get(parseParcelId("parcel_00000001"))?.ownerOrganizationId).toBe(
      rival,
    );
    expect(state.phase2.balances.get(organization)).toBe(beforeBalance);
    expect(state.phase2.balances.get(parseOrganizationId("org_00000003"))).toBe(beforeBank + 1400);
    expect(serializeSnapshot(restoreStateFromSnapshot(serializeSnapshot(state)))).toEqual(
      serializeSnapshot(state),
    );
  });
});

describe("WP3.10 rival financial AI", () => {
  const rival = parseOrganizationId("org_00000002");
  const bank = parseOrganizationId("org_00000003");

  it("executes a rival parcel sale through the normal atomic command path", () => {
    const state = createInitialState(111);
    const parcelId = parseParcelId("parcel_00000001");
    const parcel = state.phase2.parcels.get(parcelId)!;
    parcel.ownerOrganizationId = rival;
    const salePrice = Math.floor((parcel.marketValue * 85) / 100);
    const beforeRival = state.phase2.balances.get(rival)!;
    const beforeBank = state.phase2.balances.get(bank)!;

    const result = dispatchProductCommand(state, {
      commandId: parseCommandId("rival-sale-atomic"),
      issuedByPersonId: parsePersonId("person_00000002"),
      actingAsOrganizationId: rival,
      type: "SellParcel",
      payload: { parcelId },
    });

    expect(result).toMatchObject({ accepted: true, event: { type: "ParcelSold" } });
    expect(parcel.ownerOrganizationId).toBeNull();
    expect(state.phase2.balances.get(rival)).toBe(beforeRival + salePrice);
    expect(state.phase2.balances.get(bank)).toBe(beforeBank - salePrice);
    expect(state.phase2.transactions.slice(-2).map((entry) => entry.cause)).toEqual([
      "asset_sale",
      "asset_sale",
    ]);
    expect(serializeSnapshot(restoreStateFromSnapshot(serializeSnapshot(state)))).toEqual(
      serializeSnapshot(state),
    );
  });

  it("liquidates an empty rival parcel deterministically when the reserve is threatened", () => {
    const createScenario = () => {
      const state = createInitialState(113);
      const parcelId = parseParcelId("parcel_00000001");
      const parcel = state.phase2.parcels.get(parcelId)!;
      parcel.ownerOrganizationId = rival;
      const inventory = state.phase2.inventories.get(rival)!;
      inventory.capacity = 0;
      inventory.cement = 0;
      inventory.brick = 0;
      inventory.steel = 0;
      state.phase2.balances.set(rival, parseMoney(0));
      state.phase2.loans.set(parseLoanId("loan_00000001"), {
        id: parseLoanId("loan_00000001"),
        borrowerOrganizationId: rival,
        lenderOrganizationId: bank,
        principal: parseMoney(600),
        outstandingPrincipal: parseMoney(600),
        annualInterestRateBps: 800,
        termMonths: 12,
        remainingMonths: 12,
        collateralParcelId: parcelId,
        status: "active",
        offeredAtTick: parseTick(0),
        acceptedAtTick: parseTick(0),
        nextPaymentTick: null,
        missedPayments: 0,
      });
      state.phase2.rivalAi.cooldownUntilTick = parseTick(0);
      state.clock.tick = parseTick(GAME_DAY_TICKS);
      advanceProductSystems(state);
      return state;
    };

    const first = createScenario();
    const second = createScenario();
    expect(first.phase2.rivalAi).toMatchObject({
      strategyProfile: "conservative",
      lastAction: "sell_parcel",
      lastFailureCode: "SELL_COLLATERAL_LOCKED",
      memory: { defaultCount: 0, lossCount: 1 },
    });
    expect(first.phase2.parcels.get(parseParcelId("parcel_00000001"))?.ownerOrganizationId).toBe(
      rival,
    );
    expect(first.phase2.balances.get(rival)).toBe(0);
    expect(serializeSnapshot(first)).toEqual(serializeSnapshot(second));
  });
});

describe("WP3.11 municipal policy integration", () => {
  it("offers policy alternatives, applies trade-offs and supports withdrawal", () => {
    const state = createInitialState(127);
    const initialProjection = createViewProjection(state, true).economy!;
    expect(initialProjection.policyOptions.map((policy) => policy.id)).toEqual([
      "policy_00000001",
      "policy_00000002",
      "policy_00000003",
      "policy_00000004",
      "policy_00000005",
    ]);

    expect(
      dispatchProductCommand(
        state,
        command("policy-propose-renewal", "ProposePolicy", {
          policyId: parsePolicyId("policy_00000002"),
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PolicyProposed" } });
    expect(state.phase2.ordinance).toMatchObject({
      id: "policy_00000002",
      status: "proposed",
      materialCostModifierPercent: 10,
      rentModifierPercent: 20,
    });
    expect(
      dispatchProductCommand(
        state,
        command("policy-withdraw-renewal", "WithdrawPolicy", {
          policyId: parsePolicyId("policy_00000002"),
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PolicyWithdrawn" } });
    expect(state.phase2.ordinance.status).toBe("withdrawn");

    expect(
      dispatchProductCommand(
        state,
        command("policy-repropose-renewal", "ProposePolicy", {
          policyId: parsePolicyId("policy_00000002"),
        }),
      ).accepted,
    ).toBe(true);
    state.phase2.influenceByOrganizationId.set(organization, 2);
    state.phase2.ordinance.approvalChancePercent = 100;
    expect(
      dispatchProductCommand(
        state,
        command("policy-lobby-renewal", "LobbyPolicy", {
          policyId: parsePolicyId("policy_00000002"),
          influenceSpend: 2,
        }),
      ),
    ).toMatchObject({ accepted: true, event: { type: "PolicyEnacted" } });
    expect(createViewProjection(state, true).economy?.constructionOptions[0]?.cost).toBe(3300);

    /** WP4.11-H.1: una vez en vigor la ordenanza es norma municipal, ya no está en mano de la jugadora. */
    expect(
      dispatchProductCommand(
        state,
        command("policy-withdraw-active", "WithdrawPolicy", {
          policyId: parsePolicyId("policy_00000002"),
        }),
      ),
    ).toMatchObject({ accepted: false, code: "POLICY_NOT_AVAILABLE" });
    expect(state.phase2.ordinance.status).toBe("active");
    expect(createViewProjection(state, true).economy?.constructionOptions[0]?.cost).toBe(3300);
    expect(serializeSnapshot(restoreStateFromSnapshot(serializeSnapshot(state)))).toEqual(
      serializeSnapshot(state),
    );
  });

  it("lets the rival lobby for a proposal that improves its own tax position", () => {
    const state = createInitialState(131);
    expect(
      dispatchProductCommand(
        state,
        command("policy-propose-fiscal", "ProposePolicy", {
          policyId: parsePolicyId("policy_00000003"),
        }),
      ).accepted,
    ).toBe(true);
    state.clock.tick = parseTick(GAME_MONTH_TICKS);
    advanceProductSystems(state);
    expect(state.phase2.rivalAi.lastAction).toBe("lobby_policy");
    // WP4.8: gasta la influencia con la que arranca y cobra el +1 mensual que el gobierno deja en
    // cada empresa mientras su posición ante el municipio sea neutra.
    expect(state.phase2.influenceByOrganizationId.get(parseOrganizationId("org_00000002"))).toBe(1);
  });
});

describe("WP3.12 portfolio automation and exception UX", () => {
  it("projects deterministic exceptions instead of requiring routine polling", () => {
    const state = createInitialState(137);
    const parcelId = parseParcelId("parcel_00000001");
    dispatchProductCommand(state, command("alert-buy", "BuyParcel", { parcelId }));
    for (const role of Object.keys(state.phase2.permitting.approvalChanceByRole)) {
      state.phase2.permitting.approvalChanceByRole[
        role as keyof typeof state.phase2.permitting.approvalChanceByRole
      ] = 0;
    }
    dispatchProductCommand(
      state,
      command("alert-permit", "RequestPermit", {
        parcelId,
        buildingType: "courtyard_home",
      }),
    );
    const projection = createViewProjection(state, true);
    expect(projection.economy?.alerts).toContainEqual({
      id: `permit-${parcelId}`,
      severity: "medium",
      kind: "permit",
      message: `El permiso de ${parcelId} está denied; revisa el uso antes de construir.`,
      targetId: parcelId,
    });
    expect(viewProjectionV2Schema.parse(projection).economy?.alerts).toEqual(
      projection.economy?.alerts,
    );
  });
});

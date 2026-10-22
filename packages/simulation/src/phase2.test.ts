import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseOrganizationId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parsePolicyId,
  parseTenantId,
  parseTick,
  type ProductCommand,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";
import { createInitialState } from "./state";
import { createViewProjection } from "./projection";

const actor = parsePersonId("person_00000001");
const organization = "org_00000001" as ProductCommand["actingAsOrganizationId"];

function advanceToTick(state: ReturnType<typeof createInitialState>, target: number): void {
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

  it("renews every construction material and exposes production through the projection", () => {
    const state = createInitialState(3);
    Object.assign(state.phase2.inventories.get(organization)!, {
      cement: 0,
      brick: 0,
      steel: 0,
    });
    for (const resource of ["cement", "brick", "steel"] as const) {
      expect(
        dispatchProductCommand(
          state,
          command(`invest-${resource}`, "InvestInProduction", { resource }),
        ).accepted,
      ).toBe(true);
    }
    const before = { ...state.phase2.inventories.get(organization)! };
    advanceToTick(state, 72 * 50);
    const inventory = state.phase2.inventories.get(organization)!;
    expect(inventory.cement).toBeGreaterThan(before.cement);
    expect(inventory.brick).toBeGreaterThan(before.brick);
    expect(inventory.steel).toBeGreaterThan(before.steel);
    expect(createViewProjection(state, true).economy?.production).toHaveLength(3);
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
    expect([...state.phase2.constructionSites.values()][0]?.repairBuildingId).toBe(buildingId);

    advanceToTick(state, state.clock.tick + 48 * 50);
    expect(state.phase2.buildings.get(buildingId)?.condition).toBe(100);
    expect(
      [...state.phase2.constructionSites.values()].some(
        (site) => site.repairBuildingId === buildingId,
      ),
    ).toBe(false);
  });
});

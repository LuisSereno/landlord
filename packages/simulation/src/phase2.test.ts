import { describe, expect, it } from "vitest";

import {
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  parsePolicyId,
  parseTenantId,
  type ProductCommand,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";
import { createInitialState } from "./state";
import { createViewProjection } from "./projection";

const actor = parsePersonId("person_00000001");
const organization = "org_00000001" as ProductCommand["actingAsOrganizationId"];

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
    for (let tick = 0; tick < 8; tick += 1) advanceProductSystems(state);

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
        command("policy-1", "LobbyPolicy", { policyId: parsePolicyId("policy_00000001") }),
      ).accepted,
    ).toBe(true);
    const balanceBeforeRent = state.phase2.balances.get(organization)!;
    while (state.clock.tick <= 12) advanceProductSystems(state);
    expect(state.phase2.balances.get(organization)).toBeGreaterThan(balanceBeforeRent);
    expect(state.phase2.ordinance.status).toBe("active");
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
    const before = { ...state.phase2.inventories.get(organization)! };
    for (let tick = 0; tick < 10; tick += 1) advanceProductSystems(state);
    const inventory = state.phase2.inventories.get(organization)!;
    expect(inventory.cement).toBeGreaterThan(before.cement);
    expect(inventory.brick).toBeGreaterThan(before.brick);
    expect(inventory.steel).toBeGreaterThan(before.steel);
    expect(createViewProjection(state, true).economy?.production).toHaveLength(3);
  });

  it("limits work to one crew and cancellation recovers half the reserved materials", () => {
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
      command("policy", "LobbyPolicy", { policyId: parsePolicyId("policy_00000001") }),
    );
    expect(policyState.phase2.influenceByOrganizationId.get(organization)).toBe(0);

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
    for (let tick = 0; tick < 8; tick += 1) advanceProductSystems(state);
    const buildingId = parseBuildingId("building_00000001");
    expect(
      dispatchProductCommand(state, command("upgrade", "UpgradeBuilding", { buildingId })).accepted,
    ).toBe(true);
    for (let tick = 0; tick < 5; tick += 1) advanceProductSystems(state);
    expect(state.phase2.buildings.get(buildingId)?.upgraded).toBe(true);
    expect(
      createViewProjection(state, true).economy?.buildings.find(
        (building) => building.id === buildingId,
      )?.effectiveRent,
    ).toBe(225);
  });
});

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseCityProfileId,
  parseCommandId,
  parsePersonId,
  parseSnapshotV2,
  parseTick,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import { GAME_HOUR_TICKS, PLAYER_ORGANIZATION_ID } from "./game-data";
import { createInitialState } from "./state";
import { serializeSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";

const fixturePath = fileURLToPath(
  new URL("../../../scripts/fixtures/alpha-phase4.snapshot.json", import.meta.url),
);
// Leave a full contract window open for the browser smoke before the worker advances it.
const targetTick = 72_001;

function command(
  id: string,
  type: "BuyParcel" | "StartConstruction" | "AllocateCrew",
  payload: object,
) {
  return {
    commandId: parseCommandId(id),
    type,
    payload,
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
  } as never;
}

describe("alpha fixture producer", () => {
  it("regenerates the fixture from the current simulation producer", () => {
    const previous = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      seed: number;
      world: { city: { generation: { profileId: string } } };
    };
    const state = createInitialState(previous.seed, {
      cityProfileId: parseCityProfileId(previous.world.city.generation.profileId),
    });
    const parcel = [...state.phase2.parcels.values()].find(
      (entry) => entry.disposition === "marketable" && entry.ownerOrganizationId === null,
    );
    expect(parcel).toBeDefined();
    const buyResult = dispatchProductCommand(
      state,
      command("alpha-fixture-buy", "BuyParcel", { parcelId: parcel!.id }),
    );
    expect(buyResult.accepted).toBe(true);
    const constructionResult = dispatchProductCommand(
      state,
      command("alpha-fixture-build", "StartConstruction", {
        parcelIds: [parcel!.id],
        buildingType: "courtyard_home",
      }),
    );
    expect(constructionResult.accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()][0];
    expect(site).toBeDefined();
    const crewResult = dispatchProductCommand(
      state,
      command("alpha-fixture-crew", "AllocateCrew", {
        constructionSiteId: site!.id,
        crewCapacity: 1,
      }),
    );
    expect(crewResult.accepted).toBe(true);
    site!.progress = site!.workRequired;
    state.clock = { ...state.clock, tick: parseTick(GAME_HOUR_TICKS) };
    advanceProductSystems(state);
    for (let tick = 0; tick < targetTick; tick += 1) advanceProductSystems(state);

    const snapshot = serializeSnapshot(state);
    const parsed = parseSnapshotV2(snapshot);
    if (!parsed.phase2 || !parsed.phase2.contracts)
      throw new Error("Generated alpha fixture has no phase2 state");
    const openContracts = Object.values(parsed.phase2.contracts.contracts).filter(
      (contract) => contract.status === "open",
    );
    expect(openContracts.length).toBeGreaterThan(0);
    expect(parsed.phase2.buildings.every((building) => building.parcelIds.length > 0)).toBe(true);
    expect(parsed.phase2.constructionSites.every((site) => site.parcelIds.length > 0)).toBe(true);
    writeFileSync(fixturePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  });
});

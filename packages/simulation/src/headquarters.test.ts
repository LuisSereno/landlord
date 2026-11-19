import { describe, expect, it } from "vitest";
import {
  parseCommandId,
  parseOrganizationId,
  parseParcelId,
  parsePersonId,
  type ProductCommand,
} from "@landlord/shared";
import { createInitialState } from "./state";
import { BUILDING_DEFINITIONS } from "./game-data";
import { enumeratePurchasableDevelopmentSites } from "./development-site";
import { developmentPlacementCandidatesFor } from "./development-placement";
import { districtObstacles, interactionCellCandidates } from "./district-obstacles";
import { findDeterministicPath } from "./navigation";
import { PLAYER_HOME_DISTRICT_ID, RIVAL_HOME_DISTRICT_ID } from "./city";
import { dispatchProductCommand } from "./commands";
import { serializeSnapshot, restoreStateFromSnapshot } from "./snapshot";
import { advanceProductSystems } from "./systems";
import { districtRoute, gatewayCell, TRANSFER_TICKS_PER_COST } from "./transfers";
import { districtIdForSlot } from "./city";

const PLAYERS = [
  { organizationId: parseOrganizationId("org_00000001"), districtId: PLAYER_HOME_DISTRICT_ID },
  { organizationId: parseOrganizationId("org_00000002"), districtId: RIVAL_HOME_DISTRICT_ID },
] as const;

describe("organization headquarters", () => {
  it("keeps at least one legal, reachable headquarters site in both initial districts across 60 seeds", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = createInitialState(seed);
      for (const player of PLAYERS) {
        const parcelSets = enumeratePurchasableDevelopmentSites({
          state,
          definition: BUILDING_DEFINITIONS.headquarters,
          districtIds: new Set([player.districtId]),
        });
        expect(
          parcelSets.length,
          `seed ${seed}, ${player.districtId}: parcelas contiguas`,
        ).toBeGreaterThan(0);
        let placed = false;
        for (const parcelIds of parcelSets) {
          for (const parcelId of parcelIds)
            state.phase2.parcels.get(parcelId)!.ownerOrganizationId = player.organizationId;
          const placement = developmentPlacementCandidatesFor(state, {
            districtId: player.districtId,
            parcelIds,
            buildingType: "headquarters",
            organizationId: player.organizationId,
          });
          const footprint = placement.candidates[0]?.footprintCells;
          if (!footprint) continue;
          const obstacles = districtObstacles(state, player.districtId);
          const blocked = new Set(obstacles.impassable);
          for (const cell of footprint) blocked.add(`${cell.x}:${cell.y}`);
          const accesses = interactionCellCandidates(
            footprint,
            { occupied: new Set(), impassable: blocked },
            64,
            64,
          );
          const provisional = state.organizationBases.get(
            player.organizationId,
          )!.serviceEntranceCell;
          const service = accesses.find(
            (cell) =>
              (cell.x === provisional.x && cell.y === provisional.y) ||
              findDeterministicPath(provisional, cell, blocked).length > 0,
          );
          if (service) {
            placed = true;
            break;
          }
        }
        expect(placed, `seed ${seed}, ${player.districtId}: colocación legal y acceso`).toBe(true);
      }
    }
  }, 120_000);

  it("defines a non-rent headquarters with the agreed footprint, cost, materials, and work", () => {
    expect(BUILDING_DEFINITIONS.headquarters).toMatchObject({
      type: "headquarters",
      cost: 4500,
      workRequired: 96,
      capacity: 0,
      baseRent: 0,
      resources: { cement: 4, brick: 8, steel: 2 },
      preferredFootprint: { width: 4, height: 2 },
      siteRequirements: {
        requiredParcels: 2,
        minCombinedAreaCells: 16,
        requireEdgeContiguous: true,
      },
    });
  });

  it("requires a chosen architecture, charges the company, enforces uniqueness, and saves the variant", () => {
    const state = createInitialState(1);
    const organizationId = PLAYERS[0].organizationId;
    const parcelIds = enumeratePurchasableDevelopmentSites({
      state,
      definition: BUILDING_DEFINITIONS.headquarters,
      districtIds: new Set([PLAYER_HOME_DISTRICT_ID]),
    }).find((ids) => {
      for (const id of ids) state.phase2.parcels.get(id)!.ownerOrganizationId = organizationId;
      return (
        developmentPlacementCandidatesFor(state, {
          districtId: PLAYER_HOME_DISTRICT_ID,
          parcelIds: ids,
          buildingType: "headquarters",
          organizationId,
        }).candidates.length > 0
      );
    })!;
    const balance = state.phase2.balances.get(organizationId)!;
    const inventory = state.phase2.inventories.get(organizationId)!;
    const submit = (id: string, variantId?: "cupola" | "courtyard") =>
      dispatchProductCommand(state, {
        commandId: parseCommandId(id),
        issuedByPersonId: parsePersonId("person_00000001"),
        actingAsOrganizationId: organizationId,
        type: "StartConstruction",
        payload: {
          parcelIds,
          buildingType: "headquarters",
          ...(variantId ? { headquartersVariantId: variantId } : {}),
        },
      } as Extract<ProductCommand, { type: "StartConstruction" }>);

    expect(submit("headquarters-missing-variant")).toMatchObject({
      accepted: false,
      code: "INVALID_BUILDING_VARIANT",
    });
    expect(submit("headquarters-cupola", "cupola").accepted).toBe(true);
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.buildingType === "headquarters",
    )!;
    expect(site.headquartersVariantId).toBe("cupola");
    expect(site.headquartersAccess?.service).toBeDefined();
    expect(state.phase2.balances.get(organizationId)).toBe(balance - 4500);
    expect(inventory).toMatchObject({ cement: 4, brick: 8, steel: 4 });
    expect(submit("headquarters-duplicate", "courtyard")).toMatchObject({
      accepted: false,
      code: "BUILDING_CAPACITY_FULL",
    });

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    const restoredSite = [...restored.phase2.constructionSites.values()].find(
      (entry) => entry.buildingType === "headquarters",
    )!;
    expect(restoredSite.headquartersVariantId).toBe("cupola");
    expect(restoredSite.headquartersAccess).toEqual(site.headquartersAccess);
    expect(restored.organizationBases.get(organizationId)?.provisional).toBe(true);
  });

  it("resumes and completes an interdistrital base return after loading a save", () => {
    const state = createInitialState(9);
    const agent = [...state.agents.values()].find(
      (entry) => entry.organizationId === PLAYERS[0].organizationId,
    )!;
    const farDistrict = districtIdForSlot(2, 2);
    const route = districtRoute(state, farDistrict, PLAYERS[0].districtId)!;
    const entry = gatewayCell(state, farDistrict, route.route[0]!)!;
    agent.districtId = farDistrict;
    agent.cell = entry;
    agent.atBase = false;
    agent.returningToBase = true;
    agent.task = null;

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    const returning = restored.agents.get(agent.id)!;
    const transferTicks = route.cost * TRANSFER_TICKS_PER_COST + 2000;
    for (let tick = 0; tick < transferTicks && returning.returningToBase; tick += 1)
      advanceProductSystems(restored);

    expect(returning.districtId).toBe(PLAYERS[0].districtId);
    expect(
      returning.returningToBase,
      JSON.stringify({
        cell: returning.cell,
        target: returning.target,
        path: returning.path,
        task: returning.task,
        travel: returning.travel,
      }),
    ).toBe(false);
    expect(returning.atBase).toBe(true);
    expect(returning.task).toBeNull();
  });
});

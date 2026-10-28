import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseCommandId,
  parseOrganizationId,
  parsePersonId,
  type ProductCommand,
} from "@landlord/shared";
import { createInitialState } from "./state";
import { dispatchProductCommand } from "./commands";
import { advanceProductSystems } from "./systems";
import { createViewProjection } from "./projection";
import { resolveDistrictProfile } from "./district-profiles";
import { GAME_DAY_TICKS } from "./game-data";

/**
 * Harness opt-in de WP4.15-V.c.1: construye una partida REAL con comandos auténticos (comprar
 * parcelas, levantar courtyard homes y un taller, dejar una obra en curso) y vuelca la
 * `ViewProjectionV1` resultante a un JSON. La captura de gameplay inyecta esa proyección a través
 * del hook de prueba de cámara, así los edificios y la construcción que se ven en `/` proceden del
 * motor de simulación, no de una composición fija.
 *
 *   VC1_PROJECTION=1 pnpm --filter @landlord/simulation test
 */
const playerOrganization = parseOrganizationId("org_00000001");
const actor = parsePersonId("person_00000001");

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: playerOrganization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

describe("generador de proyección de gameplay (WP4.15-V.c.1)", () => {
  it(
    "vuelca una proyección real con edificios y una obra en curso",
    { skip: !process.env.VC1_PROJECTION },
    () => {
      const profile = resolveDistrictProfile("vega_del_cauce");
      const state = createInitialState(2026);
      const vegaDistrictId = [...state.world.districts].find(
        ([, entry]) => entry.district.generation?.profileId === profile.id,
      )![0];
      const spawn = state.world.districts.get(vegaDistrictId)!.district.generation
        ? profile.spawnAnchors.player
        : profile.spawnAnchors.player;
      const parcels = [...state.phase2.parcels.values()]
        .slice(profile.anchorSlots.length)
        .sort(
          (a, b) => manhattan(a.cell, spawn) - manhattan(b.cell, spawn) || a.id.localeCompare(b.id),
        );

      const residential = parcels
        .filter((p) => p.zoning === "residential")
        .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
        .slice(0, 6);
      const mixed = parcels
        .filter((p) => p.zoning === "mixed")
        .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
        .slice(0, 3);
      let seq = 0;
      const nextId = (prefix: string): string => `${prefix}-${(seq += 1)}`;

      // Comprar y levantar courtyard homes.
      const built: typeof residential = [];
      for (const parcel of residential) {
        const buy = dispatchProductCommand(
          state,
          command(nextId("buy"), "BuyParcel", { parcelId: parcel.id }),
        );
        if (!buy.accepted) continue;
        const start = dispatchProductCommand(
          state,
          command(nextId("build"), "StartConstruction", {
            parcelId: parcel.id,
            buildingType: "courtyard_home",
          }),
        );
        if (start.accepted) built.push(parcel);
      }
      expect(built.length).toBeGreaterThanOrEqual(2);

      // Asignar cuadrilla sólo a la mitad de las obras: ésas terminarán (edificios); las demás quedan
      // como obra en curso sin progreso, garantizando `constructionSites` en la proyección.
      const crews = [...state.phase2.crews.values()].filter(
        (c) => c.organizationId === playerOrganization,
      );
      const sites = [...state.phase2.constructionSites.values()];
      const targetCompleted = Math.max(1, Math.floor(sites.length / 2));
      let crewIndex = 0;
      for (const site of sites.slice(0, targetCompleted)) {
        const crew = crews[crewIndex % Math.max(1, crews.length)]!;
        crewIndex += 1;
        dispatchProductCommand(
          state,
          command(nextId("crew"), "AssignCrewToWorkOrder", {
            crewId: crew.id,
            workOrderId: site.id,
          }),
        );
      }
      // Avanzar hasta que las obras cuadrilladas terminen.
      for (let step = 0; step < GAME_DAY_TICKS * 90; step += 1) {
        advanceProductSystems(state);
        const completed = built.filter((p) => state.phase2.parcels.get(p.id)?.buildingId).length;
        if (completed >= targetCompleted) break;
      }

      // Intentar levantar un taller en parcela mixta (variedad comercial); tolerable si no alcanza.
      for (const parcel of mixed) {
        const buy = dispatchProductCommand(
          state,
          command(nextId("buy"), "BuyParcel", { parcelId: parcel.id }),
        );
        if (!buy.accepted) continue;
        dispatchProductCommand(
          state,
          command(nextId("build"), "StartConstruction", {
            parcelId: parcel.id,
            buildingType: "workshop",
          }),
        );
      }

      const projection = createViewProjection(state, true);
      expect(projection.economy).toBeDefined();
      expect(projection.economy!.buildings.length).toBeGreaterThan(0);
      expect(projection.economy!.constructionSites.length).toBeGreaterThan(0);

      mkdirSync("artifacts/visual-slice", { recursive: true });
      writeFileSync(
        "artifacts/visual-slice/vc1-projection.json",
        JSON.stringify(projection, null, 2),
      );
      process.stdout.write(
        `VC1 projection: ${projection.economy!.parcels.length} parcels, ` +
          `${projection.economy!.buildings.length} buildings, ` +
          `${projection.economy!.constructionSites.length} construction sites\n`,
      );
    },
  );
});

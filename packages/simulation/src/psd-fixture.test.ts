import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createInitialState } from "./state";

/**
 * Harness opt-in de V.g public-space dressing: genera la CIUDAD multidistrito REAL
 * (`createInitialState`) y vuelca las plazas y parques de dos distritos concretos — centro_civico
 * (plaza cívica enlazada al ayuntamiento) y barrio_del_umbral (parque residencial) — al fixture JSON
 * que consume el planificador de dressing en Blender.
 *
 * Se genera desde la ciudad, no desde `generateDistrict` aislado, porque el id de espacio público
 * deriva del `districtId`: dos distritos standalone producirían el mismo `publicspace_00000101`. En
 * la ciudad real cada distrito aporta un `districtId` distinto y los ids son globalmente únicos. Se
 * comprueba la unicidad antes de escribir. La fuente de verdad sigue siendo el dominio.
 *
 *   PSD_FIXTURE=1 pnpm --filter @landlord/simulation test
 */
const FIXTURE_PATH = resolve(
  import.meta.dirname,
  "../../../blender_artist/manifests/public-space-dressing-fixture.json",
);

const CELL_METERS = 4;
const SEED = 2026;

function districtByProfile(state: ReturnType<typeof createInitialState>, profileId: string) {
  const entry = [...state.world.districts.values()].find(
    (district) => district.district.generation?.profileId === profileId,
  );
  if (!entry) throw new Error(`distrito ${profileId} ausente en la ciudad`);
  return entry;
}

function cellsOfParcels(state: ReturnType<typeof createInitialState>, parcelIds: string[]) {
  const cells: { x: number; y: number }[] = [];
  for (const parcelId of parcelIds) {
    const parcel = state.phase2.parcels.get(parcelId as never);
    if (parcel) for (const cell of parcel.cells) cells.push({ x: cell.x, y: cell.y });
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function footprintOfBuildings(state: ReturnType<typeof createInitialState>, buildingIds: string[]) {
  const cells: { x: number; y: number }[] = [];
  for (const buildingId of buildingIds) {
    const building = state.phase2.buildings.get(buildingId as never);
    if (building) for (const cell of building.footprintCells) cells.push({ x: cell.x, y: cell.y });
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

describe("generador de fixture de public-space dressing (V.g)", () => {
  it(
    "vuelca plazas y parques de la ciudad real con ids únicos y la asociación town_hall↔plaza",
    { skip: !process.env.PSD_FIXTURE },
    () => {
      const state = createInitialState(SEED);

      const civic = districtByProfile(state, "centro_civico");
      const residential = districtByProfile(state, "barrio_del_umbral");

      const townHall = [...civic.facilities.values()].find((f) => f.kind === "town_hall");
      expect(townHall, "centro_civico debe reservar un town_hall").toBeTruthy();
      // P3: el ayuntamiento debe traer su plaza enlazada; sin eso no hay civic core que vestir.
      expect(townHall!.publicSpaceIds.length, "town_hall sin plaza enlazada").toBeGreaterThan(0);

      const civicPlazas = [...civic.publicSpaces.values()]
        .filter((space) => space.kind === "plaza" || space.kind === "civic_courtyard")
        .map((space) => ({
          id: space.id,
          kind: space.kind,
          blockId: space.blockId,
          cells: space.cells.map((cell) => ({ x: cell.x, y: cell.y })),
        }));
      expect(civicPlazas.length).toBeGreaterThan(0);

      const residentialParks = [...residential.publicSpaces.values()]
        .filter((space) => space.kind === "park" || space.kind === "pocket_park")
        .slice(0, 2)
        .map((space) => ({
          id: space.id,
          kind: space.kind,
          blockId: space.blockId,
          cells: space.cells.map((cell) => ({ x: cell.x, y: cell.y })),
        }));
      expect(residentialParks.length).toBeGreaterThan(0);

      const districts = [
        {
          profileId: "centro_civico",
          districtId: civic.district.id,
          role: "civic",
          townHallParcelCells: cellsOfParcels(state, townHall!.parcelIds as unknown as string[]),
          townHallFootprintCells: footprintOfBuildings(
            state,
            townHall!.buildingIds as unknown as string[],
          ),
          townHallPlazaId: townHall!.publicSpaceIds[0],
          publicSpaces: civicPlazas,
        },
        {
          profileId: "barrio_del_umbral",
          districtId: residential.district.id,
          role: "residential",
          townHallParcelCells: [],
          townHallFootprintCells: [],
          townHallPlazaId: null,
          publicSpaces: residentialParks,
        },
      ];

      // Unicidad de ids de espacio público en toda la evidencia combinada.
      const allIds = districts.flatMap((district) => district.publicSpaces.map((s) => s.id));
      const unique = new Set(allIds);
      expect(unique.size, `ids duplicados en el fixture: ${allIds.join(", ")}`).toBe(allIds.length);

      const fixture = {
        schemaVersion: 2,
        purpose:
          "V.g public-space dressing: celdas REALES de plazas y parques volcadas desde la ciudad multidistrito (createInitialState). Ids globalmente únicos por districtId. El planificador Blender lee este fixture; no inventa geometría de espacio público.",
        cellMeters: CELL_METERS,
        seed: SEED,
        districts,
      };

      mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf-8");
    },
  );
});

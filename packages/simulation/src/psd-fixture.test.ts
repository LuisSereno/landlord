import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDistrict } from "./district-generator";

/**
 * Harness opt-in de V.g public-space dressing: genera dos distritos REALES con
 * `generateDistrict` (centro_civico → plaza, barrio_del_umbral → parques) y vuelca sus
 * `publicSpaces` (id, kind, cells) más las celdas de la parcela del town_hall al fixture JSON que
 * consume el planificador de dressing en Blender. La fuente de verdad es el dominio, no una
 * composición fija: si el generador cambia una plaza, el fixture cambia con ella.
 *
 *   PSD_FIXTURE=1 pnpm --filter @landlord/simulation test
 *
 * El `seed` queda registrado en el fixture para que la evidencia sea reproducible.
 */
const FIXTURE_PATH = resolve(
  import.meta.dirname,
  "../../../blender_artist/manifests/public-space-dressing-fixture.json",
);

const CELL_METERS = 4;

function cellsOf(parcels: { id: string; cells: { x: number; y: number }[] }[], parcelIds: string[]) {
  const wanted = new Set(parcelIds);
  const cells: { x: number; y: number }[] = [];
  for (const parcel of parcels) {
    if (!wanted.has(parcel.id)) continue;
    for (const cell of parcel.cells) cells.push({ x: cell.x, y: cell.y });
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

describe("generador de fixture de public-space dressing (V.g)", () => {
  it(
    "vuelca plazas y parques reales con la parcela del town_hall",
    { skip: !process.env.PSD_FIXTURE },
    () => {
      const civic = generateDistrict({ seed: 2026, profileId: "centro_civico" });
      const residential = generateDistrict({ seed: 2026, profileId: "barrio_del_umbral" });

      const townHall = civic.facilities.find((facility) => facility.kind === "town_hall");
      expect(townHall, "centro_civico debe reservar un town_hall").toBeTruthy();

      const civicPlazas = civic.publicSpaces
        .filter((space) => space.kind === "plaza" || space.kind === "civic_courtyard")
        .map((space) => ({
          id: space.id,
          kind: space.kind,
          blockId: space.blockId,
          cells: space.cells.map((cell) => ({ x: cell.x, y: cell.y })),
        }));
      expect(civicPlazas.length, "centro_civico debe producir al menos una plaza").toBeGreaterThan(0);

      const residentialParks = residential.publicSpaces
        .filter((space) => space.kind === "park" || space.kind === "pocket_park")
        .map((space) => ({
          id: space.id,
          kind: space.kind,
          blockId: space.blockId,
          cells: space.cells.map((cell) => ({ x: cell.x, y: cell.y })),
        }));
      expect(residentialParks.length, "barrio_del_umbral debe producir al menos un parque").toBeGreaterThan(0);

      const fixture = {
        schemaVersion: 1,
        purpose:
          "V.g public-space dressing: celdas REALES de plazas y parques volcadas desde generateDistrict. El planificador Blender lee este fixture; no inventa geometría de espacio público.",
        cellMeters: CELL_METERS,
        seed: 2026,
        districts: [
          {
            profileId: "centro_civico",
            role: "civic",
            townHallParcelCells: cellsOf(
              civic.parcels as unknown as { id: string; cells: { x: number; y: number }[] }[],
              townHall!.parcelIds as unknown as string[],
            ),
            publicSpaces: civicPlazas,
          },
          {
            profileId: "barrio_del_umbral",
            role: "residential",
            townHallParcelCells: [],
            publicSpaces: residentialParks.slice(0, 2),
          },
        ],
      };

      mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    },
  );
});

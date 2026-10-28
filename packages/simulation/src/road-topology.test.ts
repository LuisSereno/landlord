import { describe, expect, it } from "vitest";

import {
  roadCellClassesFromSegments,
  roadCellsFromSegments,
  roadSegmentId,
  viewProjectionV1Schema,
  type RoadSegmentV1,
} from "@landlord/shared";
import { findDeterministicPath } from "./navigation";
import { cellKey, generateDistrict, hasRoadAccess } from "./district-generator";
import { DISTRICT_PROFILE_IDS } from "./district-profiles";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState } from "./state";
import { createViewProjection } from "./projection";

const SEEDS = [1, 7, 42, 1337, 3, 99, 2024, 555] as const;

function componentCount(cells: ReadonlySet<string>): number {
  const unseen = new Set(cells);
  let count = 0;
  while (unseen.size > 0) {
    count += 1;
    const queue = [[...unseen].sort()[0]!];
    unseen.delete(queue[0]!);
    for (let head = 0; head < queue.length; head += 1) {
      const [x, y] = queue[head]!.split(":").map(Number) as [number, number];
      for (const key of [`${x - 1}:${y}`, `${x + 1}:${y}`, `${x}:${y - 1}`, `${x}:${y + 1}`]) {
        if (unseen.delete(key)) queue.push(key);
      }
    }
  }
  return count;
}

/**
 * Parcelas con frente vial por perfil sobre las ocho semillas. Los tres perfiles de Fase 4 suman
 * 989, el total que esta prueba exigía antes de V.d; los seis perfiles nuevos de la ciudad 3×3
 * aportan el resto. Fijado por perfil para que una regresión nombre al responsable en vez de mover
 * una cifra global.
 */
const EXPECTED_FRONTAGE_BY_PROFILE: Record<string, number> = {
  barrio_del_taller: 335,
  barrio_del_umbral: 229,
  centro_civico: 424,
  ensanche_ferroviario: 385,
  ensanche_ferroviario_oeste: 401,
  lomas_del_umbral: 273,
  mercado_del_norte: 351,
  patios_del_este: 345,
  vega_del_cauce: 375,
};

describe("WP4.15-V.c.2B authoritative road topology", () => {
  it("mantiene los distritos aprobados con frente, sin solapes y una red pública 4-conexa", () => {
    const frontageByProfile: Record<string, number> = {};
    for (const profileId of DISTRICT_PROFILE_IDS) {
      let frontage = 0;
      for (const seed of SEEDS) {
        const generated = generateDistrict({ profileId, seed });
        const roads = roadCellsFromSegments(generated.roads.segments);
        const parcelCells = new Set(generated.parcels.map((parcel) => cellKey(parcel.cell)));
        expect(componentCount(roads), `${profileId}/${seed}`).toBe(1);
        expect(
          [...roads].filter((key) => parcelCells.has(key)),
          `${profileId}/${seed}`,
        ).toEqual([]);
        expect(
          [...roads].filter((key) => generated.blockedCells.includes(key)),
          `${profileId}/${seed}`,
        ).toEqual([]);
        for (const parcel of generated.parcels) {
          expect(hasRoadAccess(parcel, roads), `${profileId}/${seed}/${parcel.id}`).toBe(true);
          frontage += 1;
        }
      }
      frontageByProfile[profileId] = frontage;
    }
    expect(frontageByProfile).toEqual(EXPECTED_FRONTAGE_BY_PROFILE);
  }, 60_000);

  it("resuelve el bolsillo de vega_del_cauce seed 7 como una única red publicada", () => {
    const generated = generateDistrict({ profileId: "vega_del_cauce", seed: 7 });
    const roads = roadCellsFromSegments(generated.roads.segments);
    expect(componentCount(roads)).toBe(1);
    expect(generated.parcels.every((parcel) => hasRoadAccess(parcel, roads))).toBe(true);
  });

  it("normaliza IDs por contenido y avenue domina la semántica de una celda solapada", () => {
    const street: RoadSegmentV1 = {
      id: roadSegmentId("street", { x: 2, y: 3 }, { x: 5, y: 3 }),
      from: { x: 2, y: 3 },
      to: { x: 5, y: 3 },
      class: "street",
    };
    const avenue: RoadSegmentV1 = {
      id: roadSegmentId("avenue", { x: 4, y: 1 }, { x: 4, y: 5 }),
      from: { x: 4, y: 1 },
      to: { x: 4, y: 5 },
      class: "avenue",
    };
    expect(roadSegmentId("street", street.from, street.to)).toBe(street.id);
    expect(roadCellClassesFromSegments([street, avenue]).get("4:3")).toBe("avenue");
  });

  it("backfill legacy depende sólo de la geometría persistida y se materializa byte a byte", () => {
    const state = createInitialState(7, { districtProfileId: "vega_del_cauce" });
    const legacy = serializeSnapshot(state) as { map: { roads?: unknown } };
    delete legacy.map.roads;
    const first = serializeSnapshot(restoreStateFromSnapshot(legacy));
    const second = serializeSnapshot(restoreStateFromSnapshot(legacy));
    expect(first.map.roads).toEqual(second.map.roads);
    expect(serializeSnapshot(restoreStateFromSnapshot(first)).map.roads).toEqual(first.map.roads);
  }, 20_000);

  it("conserva roads en el round-trip Zod completo de la proyección", () => {
    const projection = createViewProjection(createInitialState(1));
    const parsed = viewProjectionV1Schema.parse(JSON.parse(JSON.stringify(projection)));
    expect(parsed.map.roads).toEqual(projection.map.roads);
  });

  it("las celdas viales no están bloqueadas y siguen siendo transitables para el A* vigente", () => {
    const state = createInitialState(1);
    const road = [...roadCellsFromSegments(state.map.roads.segments)][0]!;
    const [x, y] = road.split(":").map(Number) as [number, number];
    expect(state.map.blockedCells.has(road)).toBe(false);
    const target = [
      { x: x + 1, y },
      { x, y: y + 1 },
    ].find((cell) => !state.map.blockedCells.has(`${cell.x}:${cell.y}`))!;
    expect(findDeterministicPath({ x, y }, target, state.map.blockedCells, 64, 64)).toEqual([
      target,
    ]);
  });
});

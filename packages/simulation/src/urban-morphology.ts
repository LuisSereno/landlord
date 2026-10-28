import { roadCellsFromSegments, type Block, type RoadTopology } from "@landlord/shared";

/**
 * Morphological metrics of a generated district, comparable with the aggregates in
 * the versioned Fase 0 envelopes. They are derived from the authoritative road cells and
 * blocks; nothing here is stored in the game state.
 */

export const DISTRICT_AREA_KM2 = (64 * 64 * 16) / 1_000_000;

/** Unique street edges in metres: each shared edge is counted once, never once per segment class. */
export function streetLengthMeters(roads: RoadTopology): number {
  const cells = roadCellsFromSegments(roads.segments);
  let metres = 0;
  for (const key of cells) {
    const [x, y] = key.split(":").map(Number) as [number, number];
    if (cells.has(`${x + 1}:${y}`)) metres += 4;
    if (cells.has(`${x}:${y + 1}`)) metres += 4;
  }
  return metres;
}

export function streetDensityKmPerKm2(roads: RoadTopology): number {
  return streetLengthMeters(roads) / 1000 / DISTRICT_AREA_KM2;
}

/**
 * Crossings and T junctions. Border corners whose two lines continue into the neighbouring
 * district count as intersections: the district border is a measuring artifact, not a dead end
 * (D-088).
 */
export function intersectionCount(roads: RoadTopology): number {
  const cells = roadCellsFromSegments(roads.segments);
  let intersections = 0;
  for (const key of cells) {
    const [x, y] = key.split(":").map(Number) as [number, number];
    let neighbours = 0;
    if (cells.has(`${x}:${y - 1}`)) neighbours += 1;
    if (cells.has(`${x + 1}:${y}`)) neighbours += 1;
    if (cells.has(`${x}:${y + 1}`)) neighbours += 1;
    if (cells.has(`${x - 1}:${y}`)) neighbours += 1;
    const corner = (x === 0 || x === 63) && (y === 0 || y === 63) && neighbours === 2;
    if (neighbours >= 3 || corner) intersections += 1;
  }
  return intersections;
}

export function intersectionDensityPerKm2(roads: RoadTopology): number {
  return intersectionCount(roads) / DISTRICT_AREA_KM2;
}

export function medianBlockAreaCells(blocks: readonly Block[]): number {
  if (blocks.length === 0) return 0;
  const areas = blocks.map((block) => block.cells.length).sort((left, right) => left - right);
  return areas[Math.floor(areas.length / 2)]!;
}

/** Recipe → morphological family of the Fase 0 benchmark used as its envelope. */
export const MORPHOLOGY_FAMILY_BY_PROFILE: Record<string, string> = {
  barrio_del_umbral: "ensanche",
  ensanche_ferroviario: "ensanche",
  lomas_del_umbral: "low_density_residential",
  vega_del_cauce: "low_density_residential",
  mercado_del_norte: "mixed_dense",
  barrio_del_taller: "mixed_dense",
  centro_civico: "civic_centre",
  ensanche_ferroviario_oeste: "industrial_edge",
  patios_del_este: "industrial_edge",
};

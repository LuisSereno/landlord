import type {
  Building,
  BuildingDefinition,
  BuildingForm,
  DevelopmentCode,
  GridCell,
  LandUse,
  Parcel,
} from "@landlord/shared";

import { cellKey } from "./building-index";

export type FootprintRejection = "NO_BUILDABLE_ENVELOPE" | "COVERAGE_LIMIT" | "FAR_LIMIT";

export type FootprintChoice =
  | {
      footprintCells: GridCell[];
      orientation: 0 | 90 | 180 | 270;
      floors: number;
      form: BuildingForm;
      use: LandUse;
    }
  | { error: FootprintRejection };

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function distanceFrom(
  cells: ReadonlySet<string>,
  sources: readonly string[],
  limit: number,
): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: string[] = [];
  for (const key of sources) {
    if (!cells.has(key) || distance.has(key)) continue;
    distance.set(key, 0);
    queue.push(key);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const current = distance.get(key)!;
    if (current >= limit) continue;
    const [x, y] = key.split(":").map(Number) as [number, number];
    for (const offset of OFFSETS) {
      const next = `${x + offset.x}:${y + offset.y}`;
      if (!cells.has(next) || distance.has(next)) continue;
      distance.set(next, current + 1);
      queue.push(next);
    }
  }
  return distance;
}

/**
 * Buildable envelope of a parcel: cells minus street/side setbacks and existing footprints. It is
 * recomputed from geometry; nothing about it is persisted beyond the chosen `footprintCells`.
 */
export function buildableEnvelope(input: {
  parcel: Pick<Parcel, "cells" | "roadFrontages">;
  code: DevelopmentCode;
  buildings: readonly Pick<Building, "footprintCells">[];
}): Set<string> {
  const parcelCells = new Set(input.parcel.cells.map(cellKey));
  const frontageCells = input.parcel.roadFrontages.flatMap((frontage) =>
    frontage.cells.map(cellKey),
  );
  const streetDepth = distanceFrom(parcelCells, frontageCells, input.code.streetSetbackCells);
  const sideSources: string[] = [];
  for (const key of parcelCells) {
    if (frontageCells.includes(key)) continue;
    const [x, y] = key.split(":").map(Number) as [number, number];
    if (
      OFFSETS.some((offset) => {
        const neighbour = `${x + offset.x}:${y + offset.y}`;
        return !parcelCells.has(neighbour);
      })
    ) {
      sideSources.push(key);
    }
  }
  const sideDepth = distanceFrom(parcelCells, sideSources, input.code.sideSetbackCells);
  const occupied = new Set<string>();
  for (const building of input.buildings) {
    for (const cell of building.footprintCells) occupied.add(cellKey(cell));
  }
  const buildable = new Set<string>();
  for (const key of parcelCells) {
    if (occupied.has(key)) continue;
    if ((streetDepth.get(key) ?? Number.POSITIVE_INFINITY) < input.code.streetSetbackCells)
      continue;
    if ((sideDepth.get(key) ?? Number.POSITIVE_INFINITY) < input.code.sideSetbackCells) continue;
    buildable.add(key);
  }
  return buildable;
}

function cellsInRectangle(
  buildable: ReadonlySet<string>,
  x: number,
  y: number,
  width: number,
  height: number,
): GridCell[] | null {
  const cells: GridCell[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const key = `${x + column}:${y + row}`;
      if (!buildable.has(key)) return null;
      cells.push({ x: x + column, y: y + row });
    }
  }
  return cells;
}

/**
 * Deterministic footprint auto-placement (D-090 §4). The engine enumerates axis-aligned
 * rectangles inside the buildable envelope, scores them against the definition's target area and
 * picks one; the player never places cells. Ties break by orientation, y, x and signature.
 */
export function chooseFootprint(input: {
  parcel: Pick<Parcel, "cells" | "roadFrontages">;
  code: DevelopmentCode;
  definition: BuildingDefinition;
  buildings: readonly Pick<Building, "footprintCells" | "floors">[];
}): FootprintChoice {
  const buildable = buildableEnvelope(input);
  if (buildable.size === 0) return { error: "NO_BUILDABLE_ENVELOPE" };
  const parcelArea = input.parcel.cells.length;
  const coverageLimit = Math.floor((parcelArea * input.code.maxCoveragePercent) / 100);
  const farLimit = Math.floor((parcelArea * input.code.maxFloorAreaRatioPercent) / 100);
  const existingArea = input.buildings.reduce(
    (total, building) => total + building.footprintCells.length,
    0,
  );
  const existingFar = input.buildings.reduce(
    (total, building) => total + building.footprintCells.length * building.floors,
    0,
  );
  if (existingArea >= coverageLimit) return { error: "COVERAGE_LIMIT" };
  if (existingFar >= farLimit) return { error: "FAR_LIMIT" };

  const xs = input.parcel.cells.map((cell) => cell.x);
  const ys = input.parcel.cells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const target = input.definition.targetFootprintCells;
  const baseFloors = Math.max(1, Math.min(input.code.maxFloors, input.definition.defaultFloors));

  type Candidate = {
    cells: GridCell[];
    area: number;
    floors: number;
    orientation: 0 | 90 | 180 | 270;
    signature: string;
  };
  let best: Candidate | null = null;
  const better = (left: Candidate, right: Candidate): boolean => {
    const leftTarget = Math.min(left.area, target);
    const rightTarget = Math.min(right.area, target);
    if (leftTarget !== rightTarget) return leftTarget > rightTarget;
    const leftDistance = Math.abs(left.area - target);
    const rightDistance = Math.abs(right.area - target);
    if (leftDistance !== rightDistance) return leftDistance < rightDistance;
    if (left.floors !== right.floors) return left.floors > right.floors;
    if (left.area !== right.area) return left.area > right.area;
    if (left.orientation !== right.orientation) return left.orientation === 0;
    return left.signature < right.signature;
  };

  const maximumWidth = Math.min(maxX - minX + 1, Math.max(1, target * 2));
  const maximumHeight = Math.min(maxY - minY + 1, Math.max(1, target * 2));
  for (let height = 1; height <= maximumHeight; height += 1) {
    for (let width = 1; width <= maximumWidth; width += 1) {
      const area = width * height;
      if (area > target * 2) continue;
      if (existingArea + area > coverageLimit) continue;
      const floors = Math.min(baseFloors, Math.floor((farLimit - existingFar) / area));
      if (floors < 1) continue;
      for (let y = minY; y + height - 1 <= maxY; y += 1) {
        for (let x = minX; x + width - 1 <= maxX; x += 1) {
          const cells = cellsInRectangle(buildable, x, y, width, height);
          if (!cells) continue;
          const orientation: 0 | 90 | 180 | 270 = width >= height ? 0 : 90;
          const signature = `${x},${y},${width},${height}`;
          const candidate: Candidate = { cells, area, floors, orientation, signature };
          if (!best || better(candidate, best)) best = candidate;
        }
      }
    }
  }
  if (!best) {
    if (coverageLimit - existingArea < 1) return { error: "COVERAGE_LIMIT" };
    return { error: "FAR_LIMIT" };
  }
  return {
    footprintCells: best.cells,
    orientation: best.orientation,
    floors: best.floors,
    form: input.definition.form,
    use: input.definition.allowedUses[0]!,
  };
}

/** Coverage and FAR currently consumed on a parcel, in percent of the parcel area. */
export function parcelEnvelopeUsage(input: {
  parcel: Pick<Parcel, "cells">;
  code: DevelopmentCode;
  buildings: readonly Pick<Building, "footprintCells" | "floors">[];
}): {
  coveragePercent: number;
  farPercent: number;
  coverageLimitPercent: number;
  farLimitPercent: number;
} {
  const area = input.parcel.cells.length;
  const footprint = input.buildings.reduce(
    (total, building) => total + building.footprintCells.length,
    0,
  );
  const floors = input.buildings.reduce(
    (total, building) => total + building.footprintCells.length * building.floors,
    0,
  );
  return {
    coveragePercent: area === 0 ? 0 : Math.floor((footprint * 100) / area),
    farPercent: area === 0 ? 0 : Math.floor((floors * 100) / area),
    coverageLimitPercent: input.code.maxCoveragePercent,
    farLimitPercent: input.code.maxFloorAreaRatioPercent,
  };
}

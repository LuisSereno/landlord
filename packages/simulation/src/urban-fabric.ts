import {
  roadCellsFromSegments,
  roadSegmentId,
  type Block,
  type GridCell,
  type Parcel,
  type PublicSpace,
  type RoadAnchor,
  type RoadCellClass,
  type RoadSegment,
  type RoadTopology,
  type UrbanFacility,
} from "@landlord/shared";

import type { DistrictGenerationIssue } from "./district-issues";
import type { Xoshiro128ss } from "./prng";

/**
 * Authoritative urban fabric of one district (D-090): road network, blocks and parcels.
 *
 * The chain is one-way: anchors → roads → blocks → parcels. Nothing here reads a parcel to decide
 * where a street goes, and nothing derives a block from the order in which cells were discovered.
 */

export type UrbanFabricConfig = {
  /** Vertical and horizontal street lines; 3 produces 31-cell blocks, 4 produces 20-cell blocks. */
  latticeLines: number;
  /**
   * Whether a spawn anchor gets a physical connector to the lattice. Low-density recipes turn it
   * off: the plot is served by the nearest street and the extra connector would push the street
   * density above the low-density envelope that the recipe is meant to reproduce.
   */
  connectSpawns: boolean;
  maxBlockAreaCells: number;
  maxBlockDepthCells: number;
  parcelFrontageCells: readonly [number, number];
  parcelDepthCells: readonly [number, number];
  parcelAreaCells: readonly [number, number];
  maxParcelAspectRatio: number;
};

const CARDINAL_OFFSETS: readonly GridCell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
const DIRECTION_NAMES = ["north", "east", "south", "west"] as const;
type FrontageDirection = (typeof DIRECTION_NAMES)[number];

export function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

export function keyToCell(key: string): GridCell {
  const [x, y] = key.split(":").map(Number) as [number, number];
  return { x, y };
}

export function compareCellKey(left: string, right: string): number {
  const [leftX, leftY] = left.split(":").map(Number) as [number, number];
  const [rightX, rightY] = right.split(":").map(Number) as [number, number];
  return leftY - rightY || leftX - rightX || left.localeCompare(right);
}

export function compareCells(left: GridCell, right: GridCell): number {
  return left.y - right.y || left.x - right.x;
}

export function canonicalCellKeys(cells: Iterable<GridCell>): string[] {
  return [...new Set([...cells].map(cellKey))].sort(compareCellKey);
}

export function canonicalGridCells(cells: Iterable<GridCell>): GridCell[] {
  return canonicalCellKeys(cells).map(keyToCell);
}

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash ^ input.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function blockIdForGeometry(districtId: string, cells: readonly GridCell[]): string {
  const signature = canonicalCellKeys(cells).join(",");
  return `block_${fnv1a32(`landlord.block.v1|${districtId}|${signature}`)
    .toString(16)
    .padStart(8, "0")}`;
}

export function publicSpaceIdForDistrict(districtId: string, ordinal: number): string {
  const districtOrdinal = Number(districtId.slice("district_".length));
  const value = districtOrdinal * 100 + ordinal;
  return `publicspace_${String(value).padStart(8, "0")}`;
}

function inBounds(cell: GridCell, width: number, height: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
}

function neighbours(key: string): string[] {
  const [x, y] = key.split(":").map(Number) as [number, number];
  return [`${x}:${y - 1}`, `${x - 1}:${y}`, `${x + 1}:${y}`, `${x}:${y + 1}`];
}

/**
 * Connected components of a cell set. The output order is deterministic for a given iteration
 * order but is not canonicalised: callers that publish geometry sort it once at the end. Removing
 * the per-call sorts is what keeps block splitting inside the generation budget.
 */
export function connectedComponents(cells: ReadonlySet<string>): string[][] {
  const unvisited = new Set(cells);
  const result: string[][] = [];
  for (const first of cells) {
    if (!unvisited.has(first)) continue;
    const component: string[] = [];
    const queue = [first];
    unvisited.delete(first);
    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!;
      component.push(current);
      for (const next of neighbours(current)) {
        if (unvisited.delete(next)) queue.push(next);
      }
    }
    result.push(component);
  }
  return result;
}

function blocksTouchRoad(cells: readonly string[], roadAdjacent: ReadonlySet<string>): boolean {
  return cells.some((key) => roadAdjacent.has(key));
}

// ---------------------------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------------------------

function axisPositions(size: number, lines: number): number[] {
  if (lines < 2) throw new RangeError("La retícula vial necesita al menos dos líneas por eje");
  return Array.from({ length: lines }, (_, index) =>
    Math.round((index * (size - 1)) / (lines - 1)),
  );
}

function segmentsFromGrid(cells: ReadonlySet<string>, roadClass: RoadCellClass): RoadSegment[] {
  const segments: RoadSegment[] = [];
  const rows = new Map<number, number[]>();
  const columns = new Map<number, number[]>();
  for (const key of cells) {
    const [x, y] = key.split(":").map(Number) as [number, number];
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
    const column = columns.get(x) ?? [];
    column.push(y);
    columns.set(x, column);
  }
  for (const [y, xs] of [...rows.entries()].sort(([left], [right]) => left - right)) {
    const sorted = [...new Set(xs)].sort((left, right) => left - right);
    for (let index = 0; index < sorted.length;) {
      const start = sorted[index]!;
      let end = start;
      index += 1;
      while (sorted[index] === end + 1) {
        end = sorted[index]!;
        index += 1;
      }
      const from = { x: start, y };
      const to = { x: end, y };
      segments.push({ id: roadSegmentId(roadClass, from, to), from, to, class: roadClass });
    }
  }
  // A one-cell vertical run is already covered by a horizontal segment; emitting it twice would
  // duplicate cell ownership and road-frontage ids for the same piece of street.
  for (const [x, ys] of [...columns.entries()].sort(([left], [right]) => left - right)) {
    const sorted = [...new Set(ys)].sort((left, right) => left - right);
    for (let index = 0; index < sorted.length;) {
      const start = sorted[index]!;
      let end = start;
      index += 1;
      while (sorted[index] === end + 1) {
        end = sorted[index]!;
        index += 1;
      }
      if (end === start) continue;
      const from = { x, y: start };
      const to = { x, y: end };
      segments.push({ id: roadSegmentId(roadClass, from, to), from, to, class: roadClass });
    }
  }
  return segments;
}

function normalizeRoadSegments(segments: readonly RoadSegment[]): RoadSegment[] {
  const unique = new Map<string, RoadSegment>();
  for (const segment of segments) {
    const fromBeforeTo =
      segment.from.y < segment.to.y ||
      (segment.from.y === segment.to.y && segment.from.x <= segment.to.x);
    const from = fromBeforeTo ? segment.from : segment.to;
    const to = fromBeforeTo ? segment.to : segment.from;
    if ((from.x !== to.x && from.y !== to.y) || from.x < 0 || from.y < 0 || to.x < 0 || to.y < 0) {
      throw new Error("ROAD_SEGMENTS_INVALID");
    }
    const normalized = {
      ...segment,
      from: { ...from },
      to: { ...to },
      id: roadSegmentId(segment.class, from, to),
    };
    unique.set(
      `${normalized.class}|${normalized.from.x}:${normalized.from.y}|${normalized.to.x}:${normalized.to.y}`,
      normalized,
    );
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.from.y - right.from.y ||
      left.from.x - right.from.x ||
      left.class.localeCompare(right.class) ||
      left.to.y - right.to.y ||
      left.to.x - right.to.x,
  );
}

function spawnFrontDoor(spawn: GridCell, width: number, height: number): GridCell {
  const towardX = spawn.x < width / 2 ? 1 : -1;
  const towardY = spawn.y < height / 2 ? 1 : -1;
  const dx = Math.abs(spawn.x - width / 2);
  const dy = Math.abs(spawn.y - height / 2);
  const horizontal = { x: spawn.x + towardX, y: spawn.y };
  const vertical = { x: spawn.x, y: spawn.y + towardY };
  if (!inBounds(horizontal, width, height)) return vertical;
  if (!inBounds(vertical, width, height)) return horizontal;
  return dx >= dy ? horizontal : vertical;
}

export type RoadNetwork = {
  topology: RoadTopology;
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
};

/**
 * Roads come from `RoadAnchor[]` plus an authored lattice. The lattice is not scenery: it bounds
 * every block depth, which is what lets the parcel recipe promise road frontage for 100 % of the
 * marketable soil.
 */
export function deriveRoadNetwork(input: {
  anchors: readonly RoadAnchor[];
  latticeLines: number;
  connectSpawns?: boolean;
  width: number;
  height: number;
}): RoadNetwork {
  const xs = axisPositions(input.width, input.latticeLines);
  const ys = axisPositions(input.height, input.latticeLines);
  const avenueXs = new Set([xs[Math.floor(xs.length / 2)]!]);
  const avenueYs = new Set([ys[Math.floor(ys.length / 2)]!]);
  const street = new Set<string>();
  const avenue = new Set<string>();

  for (const x of xs) {
    const isAvenue = avenueXs.has(x);
    for (let y = 0; y < input.height; y += 1) {
      const key = `${x}:${y}`;
      street.add(key);
      if (isAvenue) avenue.add(key);
    }
  }
  for (const y of ys) {
    const isAvenue = avenueYs.has(y);
    for (let x = 0; x < input.width; x += 1) {
      const key = `${x}:${y}`;
      street.add(key);
      if (isAvenue) avenue.add(key);
    }
  }

  for (const anchor of [...input.anchors].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!inBounds(anchor.cell, input.width, input.height)) {
      throw new RangeError(
        `Road anchor ${anchor.id} is outside the district: ${cellKey(anchor.cell)}`,
      );
    }
    if (anchor.kind === "spawn" && input.connectSpawns === false) continue;
    const target =
      anchor.kind === "spawn"
        ? spawnFrontDoor(anchor.cell, input.width, input.height)
        : { ...anchor.cell };
    if (street.has(cellKey(target))) continue;
    let nearestX = xs[0]!;
    for (const candidate of xs) {
      if (Math.abs(candidate - target.x) < Math.abs(nearestX - target.x)) nearestX = candidate;
    }
    let nearestY = ys[0]!;
    for (const candidate of ys) {
      if (Math.abs(candidate - target.y) < Math.abs(nearestY - target.y)) nearestY = candidate;
    }
    const dx = Math.abs(nearestX - target.x);
    const dy = Math.abs(nearestY - target.y);
    const connector: GridCell[] = [];
    if (dx <= dy) {
      const step = Math.sign(nearestX - target.x);
      for (let x = target.x; ; x += step) {
        connector.push({ x, y: target.y });
        if (x === nearestX) break;
      }
    } else {
      const step = Math.sign(nearestY - target.y);
      for (let y = target.y; ; y += step) {
        connector.push({ x: target.x, y });
        if (y === nearestY) break;
      }
    }
    const connectorIsAvenue = anchor.kind === "gateway" || anchor.kind === "industrial_access";
    for (const cell of connector) {
      const key = cellKey(cell);
      street.add(key);
      if (connectorIsAvenue) avenue.add(key);
    }
  }

  const segments = normalizeRoadSegments([
    ...segmentsFromGrid(street, "street"),
    ...segmentsFromGrid(avenue, "avenue"),
  ]);
  const segmentsByCell = new Map<string, string[]>();
  for (const segment of segments) {
    const dx = Math.sign(segment.to.x - segment.from.x);
    const dy = Math.sign(segment.to.y - segment.from.y);
    const length = Math.max(
      Math.abs(segment.to.x - segment.from.x),
      Math.abs(segment.to.y - segment.from.y),
    );
    for (let step = 0; step <= length; step += 1) {
      const key = `${segment.from.x + dx * step}:${segment.from.y + dy * step}`;
      const ids = segmentsByCell.get(key) ?? [];
      ids.push(segment.id);
      segmentsByCell.set(key, ids);
    }
  }
  for (const ids of segmentsByCell.values()) ids.sort();
  const roadCells = roadCellsFromSegments(segments);
  return {
    topology: { topologyVersion: 1, derivationVersion: 2, segments },
    roadCells,
    segmentsByCell,
  };
}

// ---------------------------------------------------------------------------------------------
// Terrain and blocks
// ---------------------------------------------------------------------------------------------

export function generateObstacles(input: {
  prng: Xoshiro128ss;
  profile: {
    width: number;
    height: number;
    obstacles: { clusters: readonly [number, number]; cellsPerCluster: readonly [number, number] };
    expansion: { margin: number };
  };
  roadCells: ReadonlySet<string>;
  reservedCells: ReadonlySet<string>;
}): Set<string> {
  const { prng, profile } = input;
  const blocked = new Set<string>();
  const clusters = prng.nextInt(profile.obstacles.clusters[0], profile.obstacles.clusters[1] + 1);
  for (let cluster = 0; cluster < clusters; cluster += 1) {
    const size = prng.nextInt(
      profile.obstacles.cellsPerCluster[0],
      profile.obstacles.cellsPerCluster[1] + 1,
    );
    if (size <= 0) continue;
    let cursor = {
      x: prng.nextInt(profile.expansion.margin, profile.width - profile.expansion.margin),
      y: prng.nextInt(profile.expansion.margin, profile.height - profile.expansion.margin),
    };
    for (let step = 0; step < size; step += 1) {
      const offset = CARDINAL_OFFSETS[prng.nextInt(0, CARDINAL_OFFSETS.length)]!;
      cursor = { x: cursor.x + offset.x, y: cursor.y + offset.y };
      const key = cellKey(cursor);
      if (!inBounds(cursor, profile.width, profile.height)) continue;
      if (input.roadCells.has(key) || input.reservedCells.has(key) || blocked.has(key)) continue;
      blocked.add(key);
    }
  }
  return blocked;
}

export type BlockGeometry = {
  cells: GridCell[];
  keySignature: string;
};

function medianCoordinate(values: readonly number[]): number {
  const sorted = [...new Set(values)].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * Splits a component that exceeds the profile envelope with deterministic guillotine cuts. Every
 * cut becomes an alley (blocked terrain), and a cut is rejected if it would leave a piece with no
 * public-road frontage.
 */
function splitBlockCells(input: {
  cells: ReadonlySet<string>;
  roadAdjacent: ReadonlySet<string>;
  alleys: Set<string>;
  config: UrbanFabricConfig;
  depth: number;
}): string[][] {
  const { cells, roadAdjacent, alleys, config, depth } = input;
  if (depth > 12) return [[...cells].sort(compareCellKey)];
  const keys = [...cells];
  const xs = keys.map((key) => keyToCell(key).x);
  const ys = keys.map((key) => keyToCell(key).y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (cells.size <= config.maxBlockAreaCells && width <= config.maxBlockDepthCells * 2 + 1) {
    return [[...cells].sort(compareCellKey)];
  }
  const verticalFirst = width >= height;
  for (const vertical of [verticalFirst, !verticalFirst]) {
    const median = vertical ? medianCoordinate(xs) : medianCoordinate(ys);
    const cutCells = keys.filter((key) => {
      const [x, y] = key.split(":").map(Number) as [number, number];
      return vertical ? x === median : y === median;
    });
    if (cutCells.length === 0 || cutCells.length === cells.size) continue;
    const cutSet = new Set(cutCells);
    const remaining = new Set(keys.filter((key) => !cutSet.has(key)));
    const components = connectedComponents(remaining);
    if (components.length < 2) continue;
    if (components.some((component) => !blocksTouchRoad(component, roadAdjacent))) continue;
    // A cut that does not actually reduce the oversized dimension is not useful.
    if (vertical && (median === minX || median === maxX)) continue;
    if (!vertical && (median === minY || median === maxY)) continue;
    for (const key of cutSet) alleys.add(key);
    return components.flatMap((component) =>
      splitBlockCells({
        cells: new Set(component),
        roadAdjacent,
        alleys,
        config,
        depth: depth + 1,
      }),
    );
  }
  return [[...cells].sort(compareCellKey)];
}

export function formBlocks(input: {
  roadCells: ReadonlySet<string>;
  obstacleCells: ReadonlySet<string>;
  width: number;
  height: number;
  config: UrbanFabricConfig;
}): { blocks: string[][]; alleys: Set<string> } {
  const developable = new Set<string>();
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const key = `${x}:${y}`;
      if (input.roadCells.has(key) || input.obstacleCells.has(key)) continue;
      developable.add(key);
    }
  }
  const roadAdjacent = new Set<string>();
  for (const key of developable) {
    if (neighbours(key).some((candidate) => input.roadCells.has(candidate))) {
      roadAdjacent.add(key);
    }
  }
  const alleys = new Set<string>();
  const blocks: string[][] = [];
  for (const component of connectedComponents(developable)) {
    blocks.push(
      ...splitBlockCells({
        cells: new Set(component),
        roadAdjacent,
        alleys,
        config: input.config,
        depth: 0,
      }),
    );
  }
  blocks.sort((left, right) => compareCellKey(left[0]!, right[0]!));
  return { blocks, alleys };
}

// ---------------------------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------------------------

type FrontageEntry = {
  cell: string;
  direction: FrontageDirection;
  roadCell: string;
  segmentIds: string[];
};

function frontageEntries(input: {
  blockCells: ReadonlySet<string>;
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
}): FrontageEntry[] {
  const entries: FrontageEntry[] = [];
  for (const key of [...input.blockCells].sort(compareCellKey)) {
    const cell = keyToCell(key);
    CARDINAL_OFFSETS.forEach((offset, index) => {
      const roadCell = { x: cell.x + offset.x, y: cell.y + offset.y };
      const roadKey = cellKey(roadCell);
      if (!input.roadCells.has(roadKey)) return;
      const segmentIds = [...(input.segmentsByCell.get(roadKey) ?? [])];
      if (segmentIds.length === 0) return;
      entries.push({
        cell: key,
        direction: DIRECTION_NAMES[index]!,
        roadCell: roadKey,
        segmentIds,
      });
    });
  }
  return entries;
}

function directionOrder(direction: FrontageDirection): number {
  return DIRECTION_NAMES.indexOf(direction);
}

function frontageSort(left: FrontageEntry, right: FrontageEntry): number {
  const direction = directionOrder(left.direction) - directionOrder(right.direction);
  if (direction !== 0) return direction;
  const leftCell = keyToCell(left.cell);
  const rightCell = keyToCell(right.cell);
  if (left.direction === "north" || left.direction === "south") {
    return leftCell.x - rightCell.x || leftCell.y - rightCell.y;
  }
  return leftCell.y - rightCell.y || leftCell.x - rightCell.x;
}

export type ParcelGeometry = {
  cells: GridCell[];
  anchorCell: GridCell;
  roadFrontages: Array<{ roadSegmentId: string; cells: GridCell[] }>;
};

function parcelRoadFrontages(input: {
  cells: readonly GridCell[];
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
}): Array<{ roadSegmentId: string; cells: GridCell[] }> {
  const bySegment = new Map<string, GridCell[]>();
  for (const cell of input.cells) {
    for (const offset of CARDINAL_OFFSETS) {
      const roadCell = { x: cell.x + offset.x, y: cell.y + offset.y };
      const roadKey = cellKey(roadCell);
      if (!input.roadCells.has(roadKey)) continue;
      for (const segmentId of input.segmentsByCell.get(roadKey) ?? []) {
        const cells = bySegment.get(segmentId) ?? [];
        cells.push({ ...cell });
        bySegment.set(segmentId, cells);
      }
    }
  }
  return [...bySegment.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([roadSegmentId, cells]) => ({
      roadSegmentId,
      cells: canonicalGridCells(cells),
    }));
}

function bboxOf(cells: readonly GridCell[]): {
  width: number;
  height: number;
  minX: number;
  minY: number;
} {
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { width: Math.max(...xs) - minX + 1, height: Math.max(...ys) - minY + 1, minX, minY };
}

/**
 * Front-first subdivision: detect frontages, seed by target width, then grow inward by assigning
 * every remaining cell to the nearest seed (Manhattan distance weighted toward the lateral axis).
 * The assignment covers the whole block by construction; a parcel below the minimum area is merged
 * into the neighbour with the longest shared edge.
 */
export function subdivideBlock(input: {
  blockCells: readonly string[];
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
  config: UrbanFabricConfig;
  prng: Xoshiro128ss;
}): { parcels: ParcelGeometry[]; unassigned: string[] } {
  const blockSet = new Set(input.blockCells);
  const entries = frontageEntries({
    blockCells: blockSet,
    roadCells: input.roadCells,
    segmentsByCell: input.segmentsByCell,
  }).sort(frontageSort);

  type Seed = {
    cells: Set<string>;
    direction: FrontageDirection;
    origin: number;
    lateralCenter2: number;
  };
  const seeds: Seed[] = [];
  const seedCells = new Set<string>();
  for (const direction of DIRECTION_NAMES) {
    const group = entries.filter((entry) => entry.direction === direction);
    for (let index = 0; index < group.length;) {
      if (seedCells.has(group[index]!.cell)) {
        index += 1;
        continue;
      }
      const width = input.prng.nextInt(
        input.config.parcelFrontageCells[0],
        input.config.parcelFrontageCells[1] + 1,
      );
      const chunk: FrontageEntry[] = [];
      while (index < group.length && chunk.length < width) {
        const entry = group[index]!;
        if (seedCells.has(entry.cell)) break;
        if (chunk.length > 0) {
          const previous = keyToCell(chunk[chunk.length - 1]!.cell);
          const current = keyToCell(entry.cell);
          if (Math.abs(previous.x - current.x) + Math.abs(previous.y - current.y) !== 1) break;
        }
        chunk.push(entry);
        index += 1;
      }
      if (chunk.length === 0) continue;
      const cells = new Set(chunk.map((entry) => entry.cell));
      for (const key of cells) seedCells.add(key);
      const origin =
        direction === "north"
          ? Math.min(...chunk.map((entry) => keyToCell(entry.roadCell).y))
          : direction === "south"
            ? Math.max(...chunk.map((entry) => keyToCell(entry.roadCell).y))
            : direction === "east"
              ? Math.max(...chunk.map((entry) => keyToCell(entry.roadCell).x))
              : Math.min(...chunk.map((entry) => keyToCell(entry.roadCell).x));
      const centers = chunk.map((entry) => keyToCell(entry.cell));
      const lateralCenter2 =
        (direction === "north" || direction === "south"
          ? centers.reduce((sum, cell) => sum + cell.x, 0) * 2
          : centers.reduce((sum, cell) => sum + cell.y, 0) * 2) | 0;
      seeds.push({ cells, direction, origin, lateralCenter2 });
    }
  }
  if (seeds.length === 0) {
    return { parcels: [], unassigned: [...blockSet].sort(compareCellKey) };
  }

  // Multi-source BFS over the block: every cell joins the seed it can reach first. Regions are
  // connected by construction and deterministic because sources and neighbours are canonical.
  const seedOf = new Map<string, number>();
  const queue: string[] = [];
  seeds.forEach((seed, order) => {
    for (const key of [...seed.cells].sort(compareCellKey)) {
      seedOf.set(key, order);
      queue.push(key);
    }
  });
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const owner = seedOf.get(key)!;
    for (const neighbour of neighbours(key)) {
      if (!blockSet.has(neighbour) || seedOf.has(neighbour)) continue;
      seedOf.set(neighbour, owner);
      seeds[owner]!.cells.add(neighbour);
      queue.push(neighbour);
    }
  }

  type Draft = {
    cells: Set<string>;
    direction: FrontageDirection;
    origin: number;
    lateralCenter2: number;
  };
  const drafts: Draft[] = seeds
    .filter((seed) => seed.cells.size > 0)
    .map((seed) => ({ ...seed, cells: new Set(seed.cells) }));

  // A parcel below the minimum area is a corner sliver: merge it into the neighbouring draft with
  // which it shares the longest edge, so frontage width and area are meaningful.
  for (let index = drafts.length - 1; index >= 0; index -= 1) {
    const draft = drafts[index]!;
    if (draft.cells.size >= input.config.parcelAreaCells[0]) continue;
    let bestIndex = -1;
    let bestShared = 0;
    drafts.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      let shared = 0;
      for (const key of draft.cells) {
        const cell = keyToCell(key);
        for (const offset of CARDINAL_OFFSETS) {
          if (other.cells.has(cellKey({ x: cell.x + offset.x, y: cell.y + offset.y }))) shared += 1;
        }
      }
      if (other.cells.size + draft.cells.size > input.config.parcelAreaCells[1]) return;
      if (shared > bestShared || (shared === bestShared && shared > 0 && bestIndex < 0)) {
        bestShared = shared;
        bestIndex = otherIndex;
      }
    });
    if (bestIndex < 0 || bestShared === 0) continue;
    for (const key of draft.cells) drafts[bestIndex]!.cells.add(key);
    drafts.splice(index, 1);
  }

  const parcels = drafts.map((draft) => {
    const cells = canonicalGridCells([...draft.cells].map(keyToCell));
    return {
      cells,
      anchorCell: { ...cells[0]! },
      roadFrontages: parcelRoadFrontages({
        cells,
        roadCells: input.roadCells,
        segmentsByCell: input.segmentsByCell,
      }),
    };
  });

  // A corner sliver can keep a single frontage cell even after the area merge. It is not a
  // marketable parcel (PARCEL_TOO_NARROW), so it joins the neighbour with the longest edge.
  for (let index = parcels.length - 1; index >= 0; index -= 1) {
    const parcel = parcels[index]!;
    if (parcelFrontageWidth(parcel) >= input.config.parcelFrontageCells[0]) continue;
    let bestIndex = -1;
    let bestShared = 0;
    const own = new Set(parcel.cells.map(cellKey));
    for (let other = 0; other < parcels.length; other += 1) {
      if (other === index) continue;
      const cells = new Set(parcels[other]!.cells.map(cellKey));
      let shared = 0;
      for (const key of own) {
        const cell = keyToCell(key);
        for (const offset of CARDINAL_OFFSETS) {
          if (cells.has(cellKey({ x: cell.x + offset.x, y: cell.y + offset.y }))) shared += 1;
        }
      }
      if (parcels[other]!.cells.length + parcel.cells.length > input.config.parcelAreaCells[1])
        continue;
      if (shared > bestShared || (shared === bestShared && shared > 0 && bestIndex < 0)) {
        bestShared = shared;
        bestIndex = other;
      }
    }
    if (bestIndex < 0 || bestShared === 0) continue;
    const target = parcels[bestIndex]!;
    const cells = canonicalGridCells([...target.cells, ...parcel.cells]);
    target.cells = cells;
    target.anchorCell = { ...cells[0]! };
    target.roadFrontages = parcelRoadFrontages({
      cells,
      roadCells: input.roadCells,
      segmentsByCell: input.segmentsByCell,
    });
    parcels.splice(index, 1);
  }

  const covered = new Set(parcels.flatMap((parcel) => parcel.cells.map(cellKey)));
  return {
    parcels,
    unassigned: [...blockSet].filter((key) => !covered.has(key)).sort(compareCellKey),
  };
}

export function parcelDepth(cells: readonly GridCell[]): number {
  const bbox = bboxOf(cells);
  return Math.max(bbox.width, bbox.height);
}

export function parcelFrontageWidth(parcel: Pick<Parcel, "roadFrontages">): number {
  return parcel.roadFrontages.reduce(
    (maximum, frontage) => Math.max(maximum, frontage.cells.length),
    0,
  );
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

function parcelFrontageDepth(parcel: Pick<Parcel, "roadFrontages" | "cells">): {
  depth: number;
  frontageWidth: number;
} {
  const cellKeys = new Set(parcel.cells.map(cellKey));
  const sources: string[] = [];
  for (const frontage of parcel.roadFrontages) {
    for (const cell of frontage.cells) sources.push(cellKey(cell));
  }
  if (sources.length === 0) return { depth: Math.max(1, parcel.cells.length), frontageWidth: 0 };
  const distance = new Map<string, number>();
  const queue: string[] = [];
  for (const key of sources) {
    if (!cellKeys.has(key) || distance.has(key)) continue;
    distance.set(key, 0);
    queue.push(key);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const key = queue[head]!;
    const current = distance.get(key)!;
    for (const neighbour of neighbours(key)) {
      if (!cellKeys.has(neighbour) || distance.has(neighbour)) continue;
      distance.set(neighbour, current + 1);
      queue.push(neighbour);
    }
  }
  let depth = 0;
  for (const value of distance.values()) depth = Math.max(depth, value);
  if (distance.size !== cellKeys.size) depth = parcel.cells.length;
  const frontageWidth = parcel.roadFrontages.reduce(
    (maximum, frontage) => Math.max(maximum, frontage.cells.length),
    0,
  );
  return { depth, frontageWidth };
}

export function validateUrbanFabric(input: {
  width: number;
  height: number;
  config: UrbanFabricConfig;
  roads: RoadTopology;
  blockedCells: ReadonlySet<string>;
  blocks: readonly Block[];
  parcels: readonly Parcel[];
  publicSpaces: readonly PublicSpace[];
  facilities?: readonly UrbanFacility[];
  gatewayCells?: readonly GridCell[];
  spawnCells?: readonly GridCell[];
}): DistrictGenerationIssue[] {
  const issues: DistrictGenerationIssue[] = [];
  const roadCells = roadCellsFromSegments(input.roads.segments);
  const blockById = new Map(input.blocks.map((block) => [block.id, block]));
  const parcelCellOwner = new Map<string, string>();
  const blockCellOwner = new Map<string, string>();
  const publicCellOwner = new Map<string, string>();

  for (const block of input.blocks) {
    const keys = canonicalCellKeys(block.cells);
    if (keys.length !== block.cells.length) {
      issues.push({ code: "BLOCK_DISCONNECTED", detail: `${block.id} repite celdas` });
    }
    if (connectedComponents(new Set(keys)).length !== 1) {
      issues.push({ code: "BLOCK_DISCONNECTED", detail: `${block.id} no es 4-conexa` });
    }
    for (const key of keys) {
      if (blockCellOwner.has(key)) {
        issues.push({ code: "BLOCK_DISCONNECTED", detail: `${key} en dos manzanas` });
      }
      blockCellOwner.set(key, block.id);
      if (roadCells.has(key) || input.blockedCells.has(key)) {
        issues.push({ code: "BLOCK_DISCONNECTED", detail: `${block.id} pisa vía u obstáculo` });
      }
    }
    if (block.frontageRoadSegmentIds.length === 0) {
      issues.push({ code: "BLOCK_DISCONNECTED", detail: `${block.id} sin frente vial` });
    }
  }

  for (const parcel of input.parcels) {
    const block = blockById.get(parcel.blockId);
    if (!block) {
      issues.push({
        code: "PARCEL_DISCONNECTED",
        detail: `${parcel.id} sin manzana ${parcel.blockId}`,
      });
      continue;
    }
    const keys = canonicalCellKeys(parcel.cells);
    const keySet = new Set(keys);
    if (keys.length !== parcel.cells.length) {
      issues.push({ code: "DUPLICATE_PARCEL_CELL", detail: `${parcel.id} repite celdas` });
    }
    if (connectedComponents(keySet).length !== 1) {
      issues.push({ code: "PARCEL_DISCONNECTED", detail: `${parcel.id} no es 4-conexa` });
    }
    for (const key of keys) {
      if (parcelCellOwner.has(key)) {
        issues.push({ code: "DUPLICATE_PARCEL_CELL", detail: `${key} en dos parcelas` });
      }
      parcelCellOwner.set(key, parcel.id);
      if (!blockCellOwner.has(key) || blockCellOwner.get(key) !== block.id) {
        issues.push({
          code: "BLOCK_UNASSIGNED_CELLS",
          detail: `${parcel.id} en ${key} fuera de su manzana`,
        });
      }
      if (roadCells.has(key) || input.blockedCells.has(key)) {
        issues.push({ code: "ROAD_CROSSES_PARCEL", detail: `${parcel.id} pisa vía u obstáculo` });
      }
    }
    if (!keySet.has(cellKey(parcel.anchorCell))) {
      issues.push({ code: "PARCEL_DISCONNECTED", detail: `${parcel.id} anchorCell fuera` });
    }
    if (parcel.roadFrontages.length === 0) {
      issues.push({ code: "PARCEL_WITHOUT_ROAD_FRONTAGE", detail: `${parcel.id} sin frente` });
    } else {
      for (const frontage of parcel.roadFrontages) {
        if (frontage.cells.length === 0) {
          issues.push({
            code: "PARCEL_WITHOUT_ROAD_FRONTAGE",
            detail: `${parcel.id} frente vacío`,
          });
        }
        if (!input.roads.segments.some((segment) => segment.id === frontage.roadSegmentId)) {
          issues.push({
            code: "PARCEL_WITHOUT_ROAD_FRONTAGE",
            detail: `${parcel.id} referencia ${frontage.roadSegmentId}`,
          });
        }
        for (const cell of frontage.cells) {
          if (!keySet.has(cellKey(cell))) {
            issues.push({
              code: "PARCEL_DISCONNECTED",
              detail: `${parcel.id} frente fuera de la parcela`,
            });
          }
        }
      }
    }
    if (parcel.disposition !== "marketable") continue;
    const frontageWidth = parcelFrontageWidth(parcel);
    if (frontageWidth < input.config.parcelFrontageCells[0]) {
      issues.push({
        code: "PARCEL_TOO_NARROW",
        detail: `${parcel.id} frente ${frontageWidth} < ${input.config.parcelFrontageCells[0]}`,
      });
    }
    const bbox = bboxOf(parcel.cells);
    const measured = parcelFrontageDepth(parcel);
    if (
      measured.depth > input.config.parcelDepthCells[1] ||
      measured.depth > Math.max(1, measured.frontageWidth) * input.config.maxParcelAspectRatio ||
      parcel.cells.length > input.config.parcelAreaCells[1]
    ) {
      issues.push({
        code: "PARCEL_TOO_DEEP",
        detail: `${parcel.id} ${bbox.width}x${bbox.height} profundidad ${measured.depth} área ${parcel.cells.length}`,
      });
    }
    if (!inBounds(parcel.anchorCell, input.width, input.height)) {
      issues.push({
        code: "PARCEL_DISCONNECTED",
        detail: `${parcel.id} anchorCell fuera del mapa`,
      });
    }
  }

  for (const block of input.blocks) {
    for (const cell of block.cells) {
      const key = cellKey(cell);
      if (!parcelCellOwner.has(key) && !publicCellOwner.has(key)) {
        issues.push({
          code: "BLOCK_UNASSIGNED_CELLS",
          detail: `${block.id} deja ${key} sin parcela`,
        });
      }
    }
  }

  const developable = new Set<string>();
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const key = `${x}:${y}`;
      if (!roadCells.has(key) && !input.blockedCells.has(key)) developable.add(key);
    }
  }
  for (const space of input.publicSpaces) {
    const keys = canonicalCellKeys(space.cells);
    if (keys.length !== space.cells.length) {
      issues.push({ code: "PUBLIC_RESERVATION_INVALID", detail: `${space.id} repite celdas` });
    }
    if (connectedComponents(new Set(keys)).length !== 1) {
      issues.push({ code: "PUBLIC_RESERVATION_INVALID", detail: `${space.id} no es 4-conexa` });
    }
    if (keys.some((key) => roadCells.has(key) || input.blockedCells.has(key))) {
      issues.push({
        code: "PUBLIC_RESERVATION_INVALID",
        detail: `${space.id} pisa vía u obstáculo`,
      });
    }
    for (const key of keys) {
      if (publicCellOwner.has(key)) {
        issues.push({ code: "PUBLIC_RESERVATION_INVALID", detail: `${key} en dos reservas` });
      }
      publicCellOwner.set(key, space.id);
      if (parcelCellOwner.has(key)) {
        issues.push({ code: "PUBLIC_RESERVATION_INVALID", detail: `${space.id} pisa una parcela` });
      }
      developable.delete(key);
    }
  }

  for (const key of developable) {
    if (!blockCellOwner.has(key) && !publicCellOwner.has(key)) {
      issues.push({ code: "BLOCK_UNASSIGNED_CELLS", detail: `${key} sin manzana` });
    }
  }

  for (const gateway of input.gatewayCells ?? []) {
    if (!roadCells.has(cellKey(gateway))) {
      issues.push({ code: "GATEWAY_NOT_CONNECTED", detail: `${cellKey(gateway)} no es vía` });
    }
  }
  for (const spawn of input.spawnCells ?? []) {
    if (input.blockedCells.has(cellKey(spawn))) {
      issues.push({ code: "SPAWN_BLOCKED", detail: `${cellKey(spawn)} bloqueado` });
    }
  }

  for (const facility of input.facilities ?? []) {
    const parcels = facility.parcelIds
      .map((id) => input.parcels.find((parcel) => parcel.id === id))
      .filter((parcel): parcel is Parcel => parcel !== undefined);
    if (parcels.length !== facility.parcelIds.length) {
      issues.push({
        code: "FACILITY_SITE_INVALID",
        detail: `${facility.id} referencia una parcela ausente`,
      });
    }
    if (parcels.some((parcel) => parcel.districtId !== facility.districtId)) {
      issues.push({ code: "FACILITY_SITE_INVALID", detail: `${facility.id} cruza distritos` });
    }
    if (facility.capacity <= 0) {
      issues.push({
        code: "FACILITY_SITE_INVALID",
        detail: `${facility.id} capacidad no positiva`,
      });
    }
  }

  return issues;
}

/** Public API for reserved parcels that are not produced by the normal subdivision. */
export function roadFrontagesForCells(input: {
  cells: readonly GridCell[];
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
}): Array<{ roadSegmentId: string; cells: GridCell[] }> {
  return parcelRoadFrontages(input);
}

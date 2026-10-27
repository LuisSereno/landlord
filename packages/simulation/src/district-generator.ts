import {
  parseDistrictId,
  parseMoney,
  parseParcelId,
  parseSeed,
  roadCellsFromSegments,
  roadSegmentId,
  type RoadCellClass,
  type RoadSegmentV1,
  type RoadTopologyV1,
  type District,
  type GridCell,
  type Parcel,
  type ProductionSuitability,
  type Seed,
  type Zoning,
} from "@landlord/shared";
import {
  DISTRICT_GENERATOR_VERSION,
  resolveDistrictProfile,
  rosterLayout,
  ZONING_ORDER,
  type DistrictProfile,
  type DistrictSpawnAnchors,
} from "./district-profiles";
import { createPrng, type Xoshiro128ss } from "./prng";

const MAX_COMPOSITION_ATTEMPTS = 12;
const MAX_BLOCK_PLACEMENT_ATTEMPTS = 24;
const GENERATED_DISTRICT_ID = parseDistrictId("district_00000001");
const CARDINAL_OFFSETS: readonly GridCell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export type DistrictGenerationIssue = {
  code:
    | "INSUFFICIENT_PARCELS"
    | "ZONING_SHORTAGE"
    | "ZONING_CONCENTRATION"
    | "UNAFFORDABLE_ENTRY"
    | "DUPLICATE_PARCEL_CELL"
    | "PARCEL_ADJACENCY"
    | "SPAWN_BLOCKED"
    | "PARCEL_WITHOUT_ACCESS"
    | "ROAD_SEGMENTS_INVALID"
    | "ROAD_CROSSES_PARCEL"
    | "ROAD_UNREACHABLE_SPAWNS";
  detail: string;
};

export type DistrictGenerationReport = {
  profileId: string;
  generatorVersion: number;
  seed: number;
  attempts: number;
  parcelCount: number;
  anchorParcelCount: number;
  zoningCounts: Record<Zoning, number>;
  blockedCellCount: number;
  roadCellCount: number;
  cheapestParcelPrice: number;
  mostExpensiveParcelPrice: number;
  averageParcelPrice: number;
  hash: string;
  issues: readonly DistrictGenerationIssue[];
};

export type GeneratedDistrict = {
  district: District;
  parcels: Parcel[];
  blockedCells: string[];
  roads: RoadTopologyV1;
  spawnAnchors: DistrictSpawnAnchors;
  report: DistrictGenerationReport;
};

export class DistrictGenerationError extends Error {
  public readonly profileId: string;
  public readonly seed: number;
  public readonly issues: readonly DistrictGenerationIssue[];

  public constructor(profileId: string, seed: number, issues: readonly DistrictGenerationIssue[]) {
    super(
      `No se pudo generar un distrito jugable para el perfil ${profileId} con seed ${seed}: ${issues
        .map((issue) => `${issue.code} (${issue.detail})`)
        .join("; ")}`,
    );
    this.name = "DistrictGenerationError";
    this.profileId = profileId;
    this.seed = seed;
    this.issues = issues;
  }
}

export function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function compareCellKey(left: string, right: string): number {
  const [leftX, leftY] = left.split(":").map(Number) as [number, number];
  const [rightX, rightY] = right.split(":").map(Number) as [number, number];
  return leftY - rightY || leftX - rightX || left.localeCompare(right);
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash ^ input.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * La generación consume un flujo propio derivado de la seed, de modo que el PRNG de la
 * partida (`createPrng(seed)`) conserva exactamente la misma secuencia que antes de WP4.1.
 */
function deriveGenerationSeed(seed: Seed, profileId: string): number {
  let mixed = fnv1a32(`landlord.district.v${DISTRICT_GENERATOR_VERSION}|${profileId}`);
  mixed = (mixed ^ seed) >>> 0;
  mixed = Math.imul(mixed, 0x9e3779b1) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
  mixed ^= mixed >>> 13;
  return mixed >>> 0;
}

function nextInRange(prng: Xoshiro128ss, range: readonly [number, number]): number {
  const [minimum, maximum] = range;
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum < 0 ||
    maximum < minimum
  ) {
    throw new RangeError(`Rango entero inválido en el perfil de distrito: ${minimum}..${maximum}`);
  }
  return minimum === maximum ? minimum : prng.nextInt(minimum, maximum + 1);
}

/**
 * Bolsa proporcional a los pesos del perfil, mezclada con el PRNG. Reparte el zoning entre
 * las manzanas de forma que la mezcla resultante siga la composición declarada del perfil
 * en lugar de depender de tiradas independientes.
 */
function drawZoningBag(
  prng: Xoshiro128ss,
  weights: Record<Zoning, number>,
  size: number,
): Zoning[] {
  const entries: Zoning[] = [];
  for (const zoning of ZONING_ORDER) {
    const weight = Math.max(0, Math.trunc(weights[zoning]));
    for (let index = 0; index < weight; index += 1) entries.push(zoning);
  }
  if (entries.length === 0) {
    throw new RangeError("El perfil de distrito necesita al menos un peso de zoning positivo");
  }
  const bag: Zoning[] = [];
  while (bag.length < size) bag.push(...entries);
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = prng.nextInt(0, index + 1);
    const kept = bag[index]!;
    bag[index] = bag[swap]!;
    bag[swap] = kept;
  }
  return bag.slice(0, size);
}

function drawPrice(prng: Xoshiro128ss, profile: DistrictProfile, zoning: Zoning): number {
  return nextInRange(prng, profile.priceBand[zoning]);
}

function drawSuitability(
  prng: Xoshiro128ss,
  profile: DistrictProfile,
  zoning: Zoning,
): ProductionSuitability {
  const base = profile.suitability[zoning];
  if (profile.suitabilityJitterPercent <= 0) return { ...base };
  const jitter = (value: number): number => {
    const amplitude = Math.floor((value * profile.suitabilityJitterPercent) / 100);
    if (amplitude <= 0) return value;
    return Math.max(1, value - amplitude + prng.nextInt(0, amplitude * 2 + 1));
  };
  return {
    cement: jitter(base.cement),
    brick: jitter(base.brick),
    steel: jitter(base.steel),
  };
}

type ParcelSlot = {
  cell: GridCell;
  zoning: Zoning;
  price: number;
  suitability: ProductionSuitability;
  anchor: boolean;
};

type Composition = {
  slots: ParcelSlot[];
  blocked: Set<string>;
};

function isParcelCompatible(cell: GridCell, parcelCells: ReadonlySet<string>): boolean {
  return CARDINAL_OFFSETS.every(
    (offset) => !parcelCells.has(cellKey({ x: cell.x + offset.x, y: cell.y + offset.y })),
  );
}

function composeDistrict(profile: DistrictProfile, prng: Xoshiro128ss): Composition {
  const reserved = new Set<string>();
  for (const anchor of [profile.spawnAnchors.player, profile.spawnAnchors.rival]) {
    reserved.add(cellKey(anchor));
    for (const slot of rosterLayout(anchor)) reserved.add(cellKey(slot.cell));
  }

  const parcelCells = new Set<string>();
  const slots: ParcelSlot[] = [];

  for (const anchorSlot of profile.anchorSlots) {
    parcelCells.add(cellKey(anchorSlot.cell));
    slots.push({
      cell: { ...anchorSlot.cell },
      zoning: anchorSlot.zoning,
      price: anchorSlot.price,
      suitability: { ...profile.suitability[anchorSlot.zoning] },
      anchor: true,
    });
  }

  const { margin, spacingX, spacingY, zoningWeights } = profile.expansion;
  const maxX = profile.width - 1 - margin;
  const maxY = profile.height - 1 - margin;
  const expansionSlots: ParcelSlot[] = [];
  const blockCount = nextInRange(prng, profile.expansion.blockCount);
  const zoningPlan = drawZoningBag(prng, zoningWeights, blockCount);
  for (let block = 0; block < blockCount; block += 1) {
    const columns = nextInRange(prng, profile.expansion.blockColumns);
    const rows = nextInRange(prng, profile.expansion.blockRows);
    const zoning = zoningPlan[block]!;
    const widest = (columns - 1) * spacingX;
    const tallest = (rows - 1) * spacingY;
    if (widest > maxX - margin || tallest > maxY - margin) continue;
    let placed = false;
    for (let attempt = 0; attempt < MAX_BLOCK_PLACEMENT_ATTEMPTS && !placed; attempt += 1) {
      const originX = prng.nextInt(margin, maxX - widest + 1);
      const originY = prng.nextInt(margin, maxY - tallest + 1);
      const cells: GridCell[] = [];
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          cells.push({ x: originX + column * spacingX, y: originY + row * spacingY });
        }
      }
      const available = cells.every(
        (cell) =>
          !reserved.has(cellKey(cell)) &&
          !parcelCells.has(cellKey(cell)) &&
          isParcelCompatible(cell, parcelCells),
      );
      if (!available) continue;
      const blockParcelCells = new Set(cells.map(cellKey));
      const isolated = cells.every((cell) => isParcelCompatible(cell, blockParcelCells));
      if (!isolated) continue;
      for (const cell of cells) {
        parcelCells.add(cellKey(cell));
        expansionSlots.push({
          cell: { ...cell },
          zoning,
          price: drawPrice(prng, profile, zoning),
          suitability: drawSuitability(prng, profile, zoning),
          anchor: false,
        });
      }
      placed = true;
    }
  }
  expansionSlots.sort((left, right) => left.cell.y - right.cell.y || left.cell.x - right.cell.x);
  slots.push(...expansionSlots);

  const blocked = new Set<string>();
  const clusterCount = nextInRange(prng, profile.obstacles.clusters);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const cellsPerCluster = nextInRange(prng, profile.obstacles.cellsPerCluster);
    if (cellsPerCluster <= 0) continue;
    let cursor = {
      x: prng.nextInt(margin, maxX + 1),
      y: prng.nextInt(margin, maxY + 1),
    };
    for (let step = 0; step < cellsPerCluster; step += 1) {
      const offset = CARDINAL_OFFSETS[prng.nextInt(0, CARDINAL_OFFSETS.length)]!;
      cursor = { x: cursor.x + offset.x, y: cursor.y + offset.y };
      const key = cellKey(cursor);
      const walkable =
        cursor.x >= 0 &&
        cursor.y >= 0 &&
        cursor.x < profile.width &&
        cursor.y < profile.height &&
        !reserved.has(key) &&
        !parcelCells.has(key) &&
        isParcelCompatible(cursor, parcelCells);
      if (!walkable) continue;
      blocked.add(key);
    }
  }

  return { slots, blocked };
}

function assignParcelIds(slots: readonly ParcelSlot[]): Parcel[] {
  return slots.map((slot, index) => ({
    id: parseParcelId(`parcel_${String(index + 1).padStart(8, "0")}`),
    districtId: GENERATED_DISTRICT_ID,
    cell: { ...slot.cell },
    price: parseMoney(slot.price),
    zoning: slot.zoning,
    ownerOrganizationId: null,
    buildingId: null,
    productionSuitability: { ...slot.suitability },
  }));
}

/** Celdas transitables alcanzables desde los spawns, evitando obstáculos y límites del mapa. */
function reachableCells(
  anchors: readonly GridCell[],
  blocked: ReadonlySet<string>,
  width: number,
  height: number,
): Set<string> {
  const reachable = new Set<string>();
  const queue: GridCell[] = [];
  for (const anchor of anchors) {
    const key = cellKey(anchor);
    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= width || anchor.y >= height) continue;
    if (blocked.has(key) || reachable.has(key)) continue;
    reachable.add(key);
    queue.push(anchor);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    for (const offset of CARDINAL_OFFSETS) {
      const next = { x: current.x + offset.x, y: current.y + offset.y };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue;
      const key = cellKey(next);
      if (blocked.has(key) || reachable.has(key)) continue;
      reachable.add(key);
      queue.push(next);
    }
  }
  return reachable;
}

const ROAD_DERIVATION_VERSION = 1 as const;
const ROAD_MESH_MAX_RUN = 12;

function inBounds(cell: GridCell, width: number, height: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
}

// Orden canónico (y, x): N, W, E, S. Evita ordenar cuatro vecinos en cada expansión.
function neighbours(key: string): string[] {
  const [x, y] = key.split(":").map(Number) as [number, number];
  return [`${x}:${y - 1}`, `${x - 1}:${y}`, `${x + 1}:${y}`, `${x}:${y + 1}`];
}

function connectedComponents(cells: ReadonlySet<string>): string[][] {
  const unvisited = new Set(cells);
  const result: string[][] = [];
  // Una única ordenación canónica. Ordenar el Set restante para cada componente era O(C² log C)
  // en la malla sintética y no cambia qué semilla canónica se escoge para cada componente.
  for (const first of [...cells].sort(compareCellKey)) {
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
    result.push(component.sort(compareCellKey));
  }
  return result.sort((left, right) => compareCellKey(left[0]!, right[0]!));
}

function findConnector(
  source: ReadonlySet<string>,
  target: ReadonlySet<string>,
  forbidden: ReadonlySet<string>,
  width: number,
  height: number,
): string[] | null {
  const queue = [...source].sort(compareCellKey);
  const previous = new Map<string, string | null>(queue.map((key) => [key, null]));
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    if (target.has(current)) {
      const path: string[] = [];
      for (
        let cursor: string | null = current;
        cursor !== null;
        cursor = previous.get(cursor) ?? null
      ) {
        path.push(cursor);
      }
      return path.reverse();
    }
    for (const next of neighbours(current)) {
      const [x, y] = next.split(":").map(Number) as [number, number];
      if (!inBounds({ x, y }, width, height) || forbidden.has(next) || previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

const GRID_SIZE = 64;
const GRID_CELLS = GRID_SIZE * GRID_SIZE;
function indexFromKey(key: string): number {
  const separator = key.indexOf(":");
  return Number(key.slice(separator + 1)) * GRID_SIZE + Number(key.slice(0, separator));
}
function keyFromIndex(index: number): string {
  return `${index % GRID_SIZE}:${Math.floor(index / GRID_SIZE)}`;
}
function indexedNeighbours(index: number, callback: (next: number) => void): void {
  const x = index % GRID_SIZE;
  const y = Math.floor(index / GRID_SIZE);
  if (y > 0) callback(index - GRID_SIZE);
  if (x > 0) callback(index - 1);
  if (x < GRID_SIZE - 1) callback(index + 1);
  if (y < GRID_SIZE - 1) callback(index + GRID_SIZE);
}
function indexedComponentsSafe(mask: Uint8Array): number[][] {
  const visited = new Uint8Array(GRID_CELLS);
  const queue = new Int32Array(GRID_CELLS);
  const components: number[][] = [];
  for (let seed = 0; seed < GRID_CELLS; seed += 1) {
    if (!mask[seed] || visited[seed]) continue;
    const component: number[] = [];
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    visited[seed] = 1;
    while (head < tail) {
      const current = queue[head++]!;
      component.push(current);
      indexedNeighbours(current, (next) => {
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      });
    }
    components.push(component.sort((left, right) => left - right));
  }
  return components;
}

function indexedConnector(
  source: readonly number[],
  target: Uint8Array,
  forbidden: Uint8Array,
): number[] | null {
  const queue = new Int32Array(GRID_CELLS);
  const previous = new Int32Array(GRID_CELLS);
  const visited = new Uint8Array(GRID_CELLS);
  previous.fill(-1);
  let head = 0;
  let tail = 0;
  for (const index of source) {
    queue[tail++] = index;
    visited[index] = 1;
  }
  let found = -1;
  while (head < tail) {
    const current = queue[head++]!;
    if (target[current]) {
      found = current;
      break;
    }
    indexedNeighbours(current, (next) => {
      if (!forbidden[next] && !visited[next]) {
        visited[next] = 1;
        previous[next] = current;
        queue[tail++] = next;
      }
    });
  }
  if (found < 0) return null;
  const path: number[] = [];
  for (let cursor = found; cursor >= 0; cursor = previous[cursor]!) path.push(cursor);
  return path.reverse();
}

function segmentsFromCells(cells: ReadonlySet<string>, roadClass: RoadCellClass): RoadSegmentV1[] {
  // Filas máximas: una representación canónica sin inferir semánticas inexistentes de cruces.
  const rows = new Map<number, number[]>();
  for (const key of cells) {
    const [x, y] = key.split(":").map(Number) as [number, number];
    const row = rows.get(y) ?? [];
    row.push(x);
    rows.set(y, row);
  }
  const segments: RoadSegmentV1[] = [];
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
  return segments;
}

function normalizeRoadSegments(segments: readonly RoadSegmentV1[]): RoadSegmentV1[] {
  const unique = new Map<string, RoadSegmentV1>();
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

/**
 * Trazado post-composición: corredores del spacing → cierre de retícula → malla rectilínea →
 * Prim/BFS multi-fuente determinista. No consume el PRNG de partida ni depende de Set/Map sin ordenar.
 */
export function deriveRoadTopology(input: {
  parcels: readonly Parcel[];
  blockedCells: ReadonlySet<string>;
  width: number;
  height: number;
}): RoadTopologyV1 {
  const parcelCells = new Set(input.parcels.map((parcel) => cellKey(parcel.cell)));
  const forbidden = new Set([...parcelCells, ...input.blockedCells]);
  const street = new Set<string>();
  const orderedParcels = [...input.parcels].sort((left, right) =>
    compareCellKey(cellKey(left.cell), cellKey(right.cell)),
  );
  // 1. corredores de spacing
  for (const parcel of orderedParcels) {
    for (const offset of [
      { x: 2, y: 0 },
      { x: 0, y: 2 },
    ]) {
      const other = { x: parcel.cell.x + offset.x, y: parcel.cell.y + offset.y };
      if (!parcelCells.has(cellKey(other))) continue;
      const middle = { x: parcel.cell.x + offset.x / 2, y: parcel.cell.y + offset.y / 2 };
      if (!forbidden.has(cellKey(middle))) street.add(cellKey(middle));
    }
  }
  // 2. cierre de retícula (iterado hasta punto fijo)
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...street].sort(compareCellKey)) {
      const [x, y] = key.split(":").map(Number) as [number, number];
      for (const offset of [
        { x: 2, y: 0 },
        { x: 0, y: 2 },
      ]) {
        const other = cellKey({ x: x + offset.x, y: y + offset.y });
        const middle = cellKey({ x: x + offset.x / 2, y: y + offset.y / 2 });
        if (street.has(other) && !forbidden.has(middle) && !street.has(middle)) {
          street.add(middle);
          changed = true;
        }
      }
    }
  }
  // 3. cierre de malla rectilíneo desde hojas, conservando el eje del tramo.
  for (const key of [...street].sort(compareCellKey)) {
    const adjacent = neighbours(key).filter((candidate) => street.has(candidate));
    if (adjacent.length !== 1) continue;
    const [x, y] = key.split(":").map(Number) as [number, number];
    const [nx, ny] = adjacent[0]!.split(":").map(Number) as [number, number];
    const dx = x - nx;
    const dy = y - ny;
    for (let run = 1; run <= ROAD_MESH_MAX_RUN; run += 1) {
      const next = { x: x + dx * run, y: y + dy * run };
      const nextKey = cellKey(next);
      if (!inBounds(next, input.width, input.height) || forbidden.has(nextKey)) break;
      street.add(nextKey);
      if (
        neighbours(nextKey).some(
          (candidate) =>
            street.has(candidate) &&
            candidate !== cellKey({ x: x + dx * (run - 1), y: y + dy * (run - 1) }),
        )
      )
        break;
    }
  }
  // Las parcelas aisladas por un bloque válido reciben un frente canónico antes de enlazar la red.
  // No altera la composición: sólo ocupa una celda abierta adyacente ya persistida fuera de la parcela.
  for (const parcel of orderedParcels) {
    if (hasRoadAccess(parcel, street)) continue;
    const frontage = CARDINAL_OFFSETS.map((offset) => ({
      x: parcel.cell.x + offset.x,
      y: parcel.cell.y + offset.y,
    }))
      .filter((cell) => inBounds(cell, input.width, input.height) && !forbidden.has(cellKey(cell)))
      .sort((left, right) => compareCellKey(cellKey(left), cellKey(right)))[0];
    if (!frontage) throw new Error("ROAD_UNREACHABLE_SPAWNS");
    street.add(cellKey(frontage));
  }
  // 4. Prim determinista: cada BFS parte de la red pública acumulada y une el siguiente componente.
  const avenue = new Set<string>();
  const roadMask = new Uint8Array(GRID_CELLS);
  const forbiddenMask = new Uint8Array(GRID_CELLS);
  for (const key of forbidden) forbiddenMask[indexFromKey(key)] = 1;
  for (const key of street) roadMask[indexFromKey(key)] = 1;
  while (true) {
    const components = indexedComponentsSafe(roadMask);
    if (components.length <= 1) break;
    const targetMask = new Uint8Array(GRID_CELLS);
    for (const component of components.slice(1))
      for (const index of component) targetMask[index] = 1;
    const path = indexedConnector(components[0]!, targetMask, forbiddenMask);
    if (!path) {
      // Bolsillos sellados por parcelas: no son red pública si no pueden prestar servicio exterior.
      // Se excluyen en lugar de publicar varios componentes desconectados.
      for (const component of components.slice(1))
        for (const index of component) {
          const key = keyFromIndex(index);
          street.delete(key);
          avenue.delete(key);
          roadMask[index] = 0;
        }
      continue;
    }
    for (const index of path)
      if (!roadMask[index]) {
        const key = keyFromIndex(index);
        avenue.add(key);
        roadMask[index] = 1;
      }
  }
  const segments = normalizeRoadSegments([
    ...segmentsFromCells(street, "street"),
    ...segmentsFromCells(avenue, "avenue"),
  ]);
  return { topologyVersion: 1, derivationVersion: ROAD_DERIVATION_VERSION, segments };
}

export function hasRoadAccess(parcel: Parcel, roadCells: ReadonlySet<string>): boolean {
  return CARDINAL_OFFSETS.some((offset) =>
    roadCells.has(cellKey({ x: parcel.cell.x + offset.x, y: parcel.cell.y + offset.y })),
  );
}

export function validateDistrictPlayability(input: {
  profile: DistrictProfile;
  parcels: readonly Parcel[];
  blockedCells: ReadonlySet<string>;
}): DistrictGenerationIssue[] {
  const { profile, parcels, blockedCells } = input;
  const issues: DistrictGenerationIssue[] = [];
  const { playability } = profile;

  const parcelCellSet = new Set(parcels.map((parcel) => cellKey(parcel.cell)));
  if (parcelCellSet.size !== parcels.length) {
    issues.push({ code: "DUPLICATE_PARCEL_CELL", detail: `${parcels.length} parcelas repetidas` });
  }
  for (const parcel of parcels) {
    const key = cellKey(parcel.cell);
    const adjacent = CARDINAL_OFFSETS.filter((offset) =>
      parcelCellSet.has(cellKey({ x: parcel.cell.x + offset.x, y: parcel.cell.y + offset.y })),
    );
    if (adjacent.length > 0) {
      issues.push({ code: "PARCEL_ADJACENCY", detail: `${parcel.id} en ${key}` });
    }
  }

  const zoningCounts: Record<Zoning, number> = { residential: 0, mixed: 0, industrial: 0 };
  for (const parcel of parcels) zoningCounts[parcel.zoning] += 1;
  if (parcels.length < playability.minimumParcels) {
    issues.push({
      code: "INSUFFICIENT_PARCELS",
      detail: `${parcels.length} < ${playability.minimumParcels}`,
    });
  }
  for (const zoning of ZONING_ORDER) {
    if (zoningCounts[zoning] < playability.minimumParcelsPerZoning[zoning]) {
      issues.push({
        code: "ZONING_SHORTAGE",
        detail: `${zoning}: ${zoningCounts[zoning]} < ${playability.minimumParcelsPerZoning[zoning]}`,
      });
    }
    const sharePercent = parcels.length === 0 ? 0 : (zoningCounts[zoning] * 100) / parcels.length;
    if (sharePercent > playability.maximumZoningSharePercent) {
      issues.push({
        code: "ZONING_CONCENTRATION",
        detail: `${zoning}: ${sharePercent.toFixed(1)}% > ${playability.maximumZoningSharePercent}%`,
      });
    }
  }

  const prices = parcels.map((parcel) => parcel.price);
  const cheapest = prices.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...prices);
  if (cheapest > playability.maximumCheapestParcelPrice) {
    issues.push({
      code: "UNAFFORDABLE_ENTRY",
      detail: `${cheapest} > ${playability.maximumCheapestParcelPrice}`,
    });
  }

  for (const anchor of [profile.spawnAnchors.player, profile.spawnAnchors.rival]) {
    if (blockedCells.has(cellKey(anchor))) {
      issues.push({ code: "SPAWN_BLOCKED", detail: `spawn en ${cellKey(anchor)}` });
    }
  }
  const reachable = reachableCells(
    [profile.spawnAnchors.player, profile.spawnAnchors.rival],
    blockedCells,
    profile.width,
    profile.height,
  );
  for (const parcel of parcels) {
    const hasAccess = CARDINAL_OFFSETS.some((offset) => {
      const neighbour = { x: parcel.cell.x + offset.x, y: parcel.cell.y + offset.y };
      if (
        neighbour.x < 0 ||
        neighbour.y < 0 ||
        neighbour.x >= profile.width ||
        neighbour.y >= profile.height
      ) {
        return false;
      }
      const key = cellKey(neighbour);
      return !blockedCells.has(key) && !parcelCellSet.has(key) && reachable.has(key);
    });
    if (!hasAccess) {
      issues.push({
        code: "PARCEL_WITHOUT_ACCESS",
        detail: `${parcel.id} en ${cellKey(parcel.cell)}`,
      });
    }
  }

  return issues;
}

export function districtCanonicalString(input: {
  profileId: string;
  seed: number;
  district: District;
  parcels: readonly Parcel[];
  blockedCells: readonly string[];
  roads: RoadTopologyV1;
  spawnAnchors: DistrictSpawnAnchors;
}): string {
  const { profileId, seed, district, parcels, blockedCells, roads, spawnAnchors } = input;
  const parcelEntries = [...parcels]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((parcel) => {
      const suitability = parcel.productionSuitability ?? { cement: 100, brick: 100, steel: 100 };
      return [
        parcel.id,
        `${parcel.cell.x},${parcel.cell.y}`,
        parcel.zoning,
        parcel.price,
        `${suitability.cement}/${suitability.brick}/${suitability.steel}`,
      ].join("@");
    })
    .join(";");
  return [
    "landlord-district",
    `v${DISTRICT_GENERATOR_VERSION}`,
    `profile=${profileId}`,
    `seed=${seed}`,
    `name=${district.name}`,
    `size=${district.width}x${district.height}`,
    `spawns=${spawnAnchors.player.x},${spawnAnchors.player.y}|${spawnAnchors.rival.x},${spawnAnchors.rival.y}`,
    `parcels=${parcelEntries}`,
    `blocked=${[...blockedCells].sort(compareCellKey).join(",")}`,
    `roads=${roads.segments
      .map(
        (segment) =>
          `${segment.id}:${segment.class}:${segment.from.x},${segment.from.y}-${segment.to.x},${segment.to.y}`,
      )
      .join(";")}`,
  ].join("~");
}

export function districtGenerationHash(input: {
  profileId: string;
  seed: number;
  district: District;
  parcels: readonly Parcel[];
  blockedCells: readonly string[];
  roads: RoadTopologyV1;
  spawnAnchors: DistrictSpawnAnchors;
}): string {
  return fnv1a32(districtCanonicalString(input)).toString(16).padStart(8, "0");
}

function buildReport(input: {
  profile: DistrictProfile;
  seed: number;
  attempts: number;
  parcels: readonly Parcel[];
  blockedCells: readonly string[];
  roads: RoadTopologyV1;
  anchorParcelCount: number;
  hash: string;
  issues: readonly DistrictGenerationIssue[];
}): DistrictGenerationReport {
  const { profile, seed, attempts, parcels, blockedCells, roads, anchorParcelCount, hash, issues } =
    input;
  const zoningCounts: Record<Zoning, number> = { residential: 0, mixed: 0, industrial: 0 };
  for (const parcel of parcels) zoningCounts[parcel.zoning] += 1;
  const prices = parcels.map((parcel) => parcel.price);
  const total = prices.reduce((sum, price) => sum + price, 0);
  return {
    profileId: profile.id,
    generatorVersion: DISTRICT_GENERATOR_VERSION,
    seed,
    attempts,
    parcelCount: parcels.length,
    anchorParcelCount,
    zoningCounts,
    blockedCellCount: blockedCells.length,
    roadCellCount: roadCellsFromSegments(roads.segments).size,
    cheapestParcelPrice: prices.length === 0 ? 0 : Math.min(...prices),
    mostExpensiveParcelPrice: prices.length === 0 ? 0 : Math.max(...prices),
    averageParcelPrice: prices.length === 0 ? 0 : Math.round(total / prices.length),
    hash,
    issues,
  };
}

export function generateDistrictFromProfile(
  profile: DistrictProfile,
  seedValue: number,
): GeneratedDistrict {
  const seed = parseSeed(seedValue);
  const prng = createPrng(deriveGenerationSeed(seed, profile.id));
  let issues: DistrictGenerationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_COMPOSITION_ATTEMPTS; attempt += 1) {
    const composition = composeDistrict(profile, prng);
    const parcels = assignParcelIds(composition.slots);
    const blockedCells = [...composition.blocked].sort(compareCellKey);
    issues = validateDistrictPlayability({
      profile,
      parcels,
      blockedCells: composition.blocked,
    });
    if (issues.length > 0) continue;

    let roads: RoadTopologyV1;
    try {
      roads = deriveRoadTopology({
        parcels,
        blockedCells: composition.blocked,
        width: profile.width,
        height: profile.height,
      });
    } catch (error) {
      issues = [{ code: "ROAD_SEGMENTS_INVALID", detail: String(error) }];
      continue;
    }
    const roadCells = roadCellsFromSegments(roads.segments);
    const roadIssues: DistrictGenerationIssue[] = [];
    if (roadCells.size === 0 || connectedComponents(roadCells).length !== 1) {
      roadIssues.push({ code: "ROAD_UNREACHABLE_SPAWNS", detail: "red pública no 4-conexa" });
    }
    if (
      [...roadCells].some(
        (key) =>
          composition.blocked.has(key) || parcels.some((parcel) => cellKey(parcel.cell) === key),
      )
    ) {
      roadIssues.push({
        code: "ROAD_CROSSES_PARCEL",
        detail: "road intersecta parcela u obstáculo",
      });
    }
    if (parcels.some((parcel) => !hasRoadAccess(parcel, roadCells))) {
      roadIssues.push({ code: "PARCEL_WITHOUT_ACCESS", detail: "parcela sin frente vial" });
    }
    if (roadIssues.length > 0) {
      issues = roadIssues;
      continue;
    }

    const district: District = {
      id: GENERATED_DISTRICT_ID,
      name: profile.name,
      width: profile.width,
      height: profile.height,
      generation: { profileId: profile.id, generatorVersion: DISTRICT_GENERATOR_VERSION, seed },
    };
    const hash = districtGenerationHash({
      profileId: profile.id,
      seed,
      district,
      parcels,
      blockedCells,
      roads,
      spawnAnchors: profile.spawnAnchors,
    });
    return {
      district,
      parcels,
      blockedCells,
      roads,
      spawnAnchors: {
        player: { ...profile.spawnAnchors.player },
        rival: { ...profile.spawnAnchors.rival },
      },
      report: buildReport({
        profile,
        seed,
        attempts: attempt,
        parcels,
        blockedCells,
        roads,
        anchorParcelCount: composition.slots.filter((slot) => slot.anchor).length,
        hash,
        issues: [],
      }),
    };
  }

  throw new DistrictGenerationError(profile.id, seed, issues);
}

export function generateDistrict(options: {
  seed: number;
  profileId?: string | undefined;
}): GeneratedDistrict {
  return generateDistrictFromProfile(resolveDistrictProfile(options.profileId), options.seed);
}

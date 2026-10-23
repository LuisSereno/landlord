import {
  parseDistrictId,
  parseMoney,
  parseParcelId,
  parseSeed,
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
    | "PARCEL_WITHOUT_ACCESS";
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
  spawnAnchors: DistrictSpawnAnchors;
}): string {
  const { profileId, seed, district, parcels, blockedCells, spawnAnchors } = input;
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
  ].join("~");
}

export function districtGenerationHash(input: {
  profileId: string;
  seed: number;
  district: District;
  parcels: readonly Parcel[];
  blockedCells: readonly string[];
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
  anchorParcelCount: number;
  hash: string;
  issues: readonly DistrictGenerationIssue[];
}): DistrictGenerationReport {
  const { profile, seed, attempts, parcels, blockedCells, anchorParcelCount, hash, issues } = input;
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
      spawnAnchors: profile.spawnAnchors,
    });
    return {
      district,
      parcels,
      blockedCells,
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

import {
  parseBlockId,
  parseDistrictId,
  parseMoney,
  parseParcelId,
  parsePublicSpaceId,
  parseSeed,
  roadCellsFromSegments,
  type Block,
  type CityId,
  type District,
  type DistrictId,
  type GridCell,
  type Parcel,
  type ProductionSuitability,
  type PublicSpace,
  type RoadAnchor,
  type RoadTopology,
  type Seed,
  type Zoning,
} from "@landlord/shared";

import {
  DISTRICT_GENERATOR_VERSION,
  resolveDistrictProfile,
  ZONING_ORDER,
  type DistrictProfile,
  type DistrictSpawnAnchors,
} from "./district-profiles";
import { DEFAULT_DEVELOPMENT_CODE_BY_ROLE } from "./development-codes";
import type { DistrictGenerationIssue } from "./district-issues";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import { createPrng, type Xoshiro128ss } from "./prng";
import {
  blockIdForGeometry,
  canonicalCellKeys,
  canonicalGridCells,
  cellKey,
  compareCellKey,
  compareCells,
  deriveRoadNetwork,
  formBlocks,
  fnv1a32,
  generateObstacles,
  keyToCell,
  publicSpaceIdForDistrict,
  subdivideBlock,
  validateUrbanFabric,
} from "./urban-fabric";

export type { DistrictGenerationIssue } from "./district-issues";
export { cellKey } from "./urban-fabric";

const MAX_COMPOSITION_ATTEMPTS = 12;
const GENERATED_DISTRICT_ID = parseDistrictId("district_00000001");

export type DistrictGenerationReport = {
  profileId: string;
  generatorVersion: number;
  seed: number;
  attempts: number;
  parcelCount: number;
  anchorParcelCount: number;
  blockCount: number;
  publicSpaceCount: number;
  parcelCellCount: number;
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
  blocks: Block[];
  publicSpaces: PublicSpace[];
  blockedCells: string[];
  roads: RoadTopology;
  spawnAnchors: DistrictSpawnAnchors;
  roadAnchors: RoadAnchor[];
  report: DistrictGenerationReport;
};

export class DistrictGenerationError extends Error {
  public readonly profileId: string;
  public readonly seed: number;
  public readonly cityId: CityId | null;
  public readonly districtId: DistrictId;
  public readonly issues: readonly DistrictGenerationIssue[];

  public constructor(input: {
    profileId: string;
    seed: number;
    districtId: DistrictId;
    cityId?: CityId | undefined;
    issues: readonly DistrictGenerationIssue[];
  }) {
    super(
      `No se pudo generar el distrito ${input.districtId} de la ciudad ${
        input.cityId ?? "single-district"
      } (perfil ${input.profileId}, seed ${input.seed}): ${input.issues
        .map((issue) => `${issue.code} (${issue.detail})`)
        .join("; ")}`,
    );
    this.name = "DistrictGenerationError";
    this.profileId = input.profileId;
    this.seed = input.seed;
    this.districtId = input.districtId;
    this.cityId = input.cityId ?? null;
    this.issues = input.issues;
  }
}

function deriveGenerationSeed(seed: Seed, profileId: string): number {
  let mixed = fnv1a32(`landlord.district.v${DISTRICT_GENERATOR_VERSION}|${profileId}`);
  mixed = (mixed ^ seed) >>> 0;
  mixed = Math.imul(mixed, 0x9e3779b1) >>> 0;
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
  mixed ^= mixed >>> 13;
  return mixed >>> 0;
}

/** Each retry gets its own derived stream: an attempt never inherits the failed attempt's draws. */
function deriveAttemptSeed(baseSeed: number, attempt: number): number {
  let mixed = fnv1a32(`landlord.district-attempt.v1|${baseSeed}|${attempt}`);
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d) >>> 0;
  mixed ^= mixed >>> 15;
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

/**
 * Anchors of a district when no city supplies gateways. The civic centre is always the map centre;
 * role-specific corridors add the commercial/industrial accesses the recipe needs.
 */
export function defaultRoadAnchors(
  profile: DistrictProfile,
  gatewayAnchors: readonly RoadAnchor[] = [],
): RoadAnchor[] {
  const center = { x: profile.width / 2, y: profile.height / 2 };
  const anchors: RoadAnchor[] = [...gatewayAnchors];
  anchors.push({ id: "civic_center", kind: "civic_center", cell: { ...center } });
  if (
    profile.dominantRole === "commercial_corridor" ||
    profile.dominantRole === "mixed_core" ||
    profile.dominantRole === "civic_core"
  ) {
    anchors.push(
      {
        id: "commercial_north",
        kind: "commercial_corridor",
        cell: { x: center.x, y: center.y - 16 },
      },
      {
        id: "commercial_south",
        kind: "commercial_corridor",
        cell: { x: center.x, y: center.y + 16 },
      },
    );
  }
  if (profile.dominantRole === "industrial_logistics") {
    anchors.push({
      id: "industrial_access",
      kind: "industrial_access",
      cell: { x: center.x + 16, y: center.y + 16 },
    });
  }
  anchors.push(
    { id: "spawn_player", kind: "spawn", cell: { ...profile.spawnAnchors.player } },
    { id: "spawn_rival", kind: "spawn", cell: { ...profile.spawnAnchors.rival } },
  );
  const seen = new Set<string>();
  return anchors
    .filter((anchor) => {
      const key = `${anchor.kind}|${cellKey(anchor.cell)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function blockFrontageSegmentIds(input: {
  cells: readonly GridCell[];
  roadCells: ReadonlySet<string>;
  segmentsByCell: ReadonlyMap<string, readonly string[]>;
}): string[] {
  const ids = new Set<string>();
  for (const cell of input.cells) {
    for (const offset of [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ]) {
      const roadKey = cellKey({ x: cell.x + offset.x, y: cell.y + offset.y });
      if (!input.roadCells.has(roadKey)) continue;
      for (const id of input.segmentsByCell.get(roadKey) ?? []) ids.add(id);
    }
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
}

type DraftParcel = {
  blockId: string;
  cells: GridCell[];
  anchorCell: GridCell;
  roadFrontages: Parcel["roadFrontages"];
};

function selectPublicReservationBlock(input: {
  blocks: readonly string[][];
  reservedCells: ReadonlySet<string>;
  center: GridCell;
}): string[] | null {
  const candidates = input.blocks
    .filter((cells) => !cells.some((key) => input.reservedCells.has(key)))
    .map((cells) => {
      const gridCells = cells.map(keyToCell);
      const centroid = {
        x: gridCells.reduce((sum, cell) => sum + cell.x, 0) / gridCells.length,
        y: gridCells.reduce((sum, cell) => sum + cell.y, 0) / gridCells.length,
      };
      const distance =
        Math.abs(centroid.x - input.center.x) + Math.abs(centroid.y - input.center.y);
      return { cells, distance };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance || compareCellKey(left.cells[0]!, right.cells[0]!),
    );
  return candidates[0]?.cells ?? null;
}

function assignAnchorOverrides(input: {
  parcels: Array<{
    draft: DraftParcel;
    zoning: Zoning;
    price: number;
    suitability: ProductionSuitability;
  }>;
  profile: DistrictProfile;
}): number[] {
  const claimed = new Set<number>();
  const assigned: number[] = [];
  for (const slot of input.profile.anchorSlots) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < input.parcels.length; index += 1) {
      if (claimed.has(index)) continue;
      const cell = input.parcels[index]!.draft.anchorCell;
      const distance = Math.abs(cell.x - slot.cell.x) + Math.abs(cell.y - slot.cell.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    claimed.add(bestIndex);
    const target = input.parcels[bestIndex]!;
    target.zoning = slot.zoning;
    target.price = slot.price;
    target.suitability = { ...input.profile.suitability[slot.zoning] };
    assigned.push(bestIndex);
  }
  return assigned;
}

function validatePlayability(input: {
  profile: DistrictProfile;
  parcels: readonly Parcel[];
  blockedCells: ReadonlySet<string>;
}): DistrictGenerationIssue[] {
  const issues: DistrictGenerationIssue[] = [];
  const { profile, parcels, blockedCells } = input;
  const playability = profile.playability;
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
  return issues;
}

export function districtCanonicalString(input: {
  profileId: string;
  seed: number;
  district: District;
  parcels: readonly Parcel[];
  blocks: readonly Block[];
  publicSpaces: readonly PublicSpace[];
  blockedCells: readonly string[];
  roads: RoadTopology;
  spawnAnchors: DistrictSpawnAnchors;
}): string {
  const { profileId, seed, district, parcels, blocks, publicSpaces, blockedCells, roads } = input;
  const parcelEntries = [...parcels]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((parcel) => {
      const suitability = parcel.productionSuitability ?? { cement: 100, brick: 100, steel: 100 };
      return [
        parcel.id,
        parcel.blockId,
        canonicalCellKeys(parcel.cells).join(","),
        cellKey(parcel.anchorCell),
        parcel.roadFrontages
          .map(
            (frontage) =>
              `${frontage.roadSegmentId}@${canonicalCellKeys(frontage.cells).join(",")}`,
          )
          .join("|"),
        parcel.disposition,
        parcel.zoning,
        parcel.price,
        `${suitability.cement}/${suitability.brick}/${suitability.steel}`,
      ].join("@");
    })
    .join(";");
  const blockEntries = [...blocks]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((block) =>
      [
        block.id,
        block.urbanRole,
        block.defaultDevelopmentCodeId,
        canonicalCellKeys(block.cells).join(","),
        block.frontageRoadSegmentIds.join(","),
      ].join("@"),
    )
    .join(";");
  const publicEntries = [...publicSpaces]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((space) => `${space.id}@${space.kind}@${canonicalCellKeys(space.cells).join(",")}`)
    .join(";");
  return [
    "landlord-district",
    `v${DISTRICT_GENERATOR_VERSION}`,
    `profile=${profileId}`,
    `seed=${seed}`,
    `name=${district.name}`,
    `size=${district.width}x${district.height}`,
    `spawns=${input.spawnAnchors.player.x},${input.spawnAnchors.player.y}|${input.spawnAnchors.rival.x},${input.spawnAnchors.rival.y}`,
    `blocks=${blockEntries}`,
    `public=${publicEntries}`,
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

export function districtGenerationHash(
  input: Parameters<typeof districtCanonicalString>[0],
): string {
  return fnv1a32(districtCanonicalString(input)).toString(16).padStart(8, "0");
}

function buildReport(input: {
  profile: DistrictProfile;
  seed: number;
  attempts: number;
  parcels: readonly Parcel[];
  blocks: readonly Block[];
  publicSpaces: readonly PublicSpace[];
  blockedCells: readonly string[];
  roads: RoadTopology;
  anchorParcelCount: number;
  hash: string;
  issues: readonly DistrictGenerationIssue[];
}): DistrictGenerationReport {
  const {
    profile,
    seed,
    attempts,
    parcels,
    blocks,
    publicSpaces,
    blockedCells,
    roads,
    anchorParcelCount,
    hash,
    issues,
  } = input;
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
    blockCount: blocks.length,
    publicSpaceCount: publicSpaces.length,
    parcelCellCount: parcels.reduce((sum, parcel) => sum + parcel.cells.length, 0),
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

export type DistrictGenerationOptions = {
  districtId?: DistrictId;
  parcelIdOrdinal?: number;
  /** Gateways of the city, already on this district's border (D-088, D-090). */
  gatewayCells?: readonly GridCell[];
  cityId?: CityId;
};

function attemptComposition(input: {
  profile: DistrictProfile;
  prng: Xoshiro128ss;
  districtId: DistrictId;
  parcelIdOrdinal: number;
  gatewayCells: readonly GridCell[];
}): {
  parcels: Parcel[];
  blocks: Block[];
  publicSpaces: PublicSpace[];
  blockedCells: Set<string>;
  roads: RoadTopology;
  anchorParcelCount: number;
  issues: DistrictGenerationIssue[];
} {
  const { profile, prng, districtId, parcelIdOrdinal, gatewayCells } = input;
  const config = profile.fabric;
  const gatewayAnchors: RoadAnchor[] = gatewayCells.map((cell, index) => ({
    id: `gateway_${String(index + 1).padStart(2, "0")}`,
    kind: "gateway",
    cell: { ...cell },
  }));
  const roadAnchors = defaultRoadAnchors(profile, gatewayAnchors);
  const issues: DistrictGenerationIssue[] = [];

  const network = deriveRoadNetwork({
    anchors: roadAnchors,
    latticeLines: config.latticeLines,
    connectSpawns: config.connectSpawns,
    width: profile.width,
    height: profile.height,
  });
  const reservedCells = new Set<string>(
    [profile.spawnAnchors.player, profile.spawnAnchors.rival].map(cellKey),
  );
  const obstacles = generateObstacles({
    prng,
    profile,
    roadCells: network.roadCells,
    reservedCells,
  });
  const formed = formBlocks({
    roadCells: network.roadCells,
    obstacleCells: obstacles,
    width: profile.width,
    height: profile.height,
    config,
  });
  const blocked = new Set<string>([...obstacles, ...formed.alleys]);
  const openBlocks = formed.blocks;

  const reservationCells = selectPublicReservationBlock({
    blocks: openBlocks,
    reservedCells,
    center: { x: profile.width / 2, y: profile.height / 2 },
  });
  if (!reservationCells) {
    issues.push({
      code: "PUBLIC_RESERVATION_INVALID",
      detail: "ninguna manzana admite la reserva pública",
    });
    return {
      parcels: [],
      blocks: [],
      publicSpaces: [],
      blockedCells: blocked,
      roads: network.topology,
      anchorParcelCount: 0,
      issues,
    };
  }
  const publicSpaces: PublicSpace[] = [
    {
      id: parsePublicSpaceId(publicSpaceIdForDistrict(districtId, 1)),
      districtId,
      blockId: null,
      kind:
        profile.dominantRole === "civic_core" ||
        profile.dominantRole === "commercial_corridor" ||
        profile.dominantRole === "mixed_core"
          ? "plaza"
          : "park",
      cells: canonicalGridCells(reservationCells.map(keyToCell)),
      operatorOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
    },
  ];
  const blocks: Block[] = [];
  const drafts: DraftParcel[] = [];
  for (const cells of openBlocks) {
    if (cells === reservationCells) continue;
    const gridCells = canonicalGridCells(cells.map(keyToCell));
    const frontageRoadSegmentIds = blockFrontageSegmentIds({
      cells: gridCells,
      roadCells: network.roadCells,
      segmentsByCell: network.segmentsByCell,
    });
    if (frontageRoadSegmentIds.length === 0) {
      issues.push({
        code: "BLOCK_DISCONNECTED",
        detail: `${cellKey(gridCells[0]!)} sin frente vial`,
      });
      continue;
    }
    const blockId = blockIdForGeometry(districtId, gridCells);
    blocks.push({
      id: parseBlockId(blockId),
      districtId,
      cells: gridCells,
      frontageRoadSegmentIds,
      urbanRole: profile.dominantRole,
      defaultDevelopmentCodeId: DEFAULT_DEVELOPMENT_CODE_BY_ROLE[profile.dominantRole],
    });
    const subdivision = subdivideBlock({
      blockCells: cells,
      roadCells: network.roadCells,
      segmentsByCell: network.segmentsByCell,
      config,
      prng,
    });
    if (subdivision.unassigned.length > 0) {
      issues.push({
        code: "BLOCK_UNASSIGNED_CELLS",
        detail: `${blockId} deja ${subdivision.unassigned.length} celdas`,
      });
    }
    for (const parcel of subdivision.parcels) {
      drafts.push({ blockId, ...parcel });
    }
  }

  drafts.sort(
    (left, right) =>
      compareCells(left.anchorCell, right.anchorCell) ||
      compareCellKey(canonicalCellKeys(left.cells)[0]!, canonicalCellKeys(right.cells)[0]!),
  );
  const bag = drawZoningBag(prng, profile.expansion.zoningWeights, drafts.length);
  const working = drafts.map((draft, index) => {
    const zoning = bag[index] ?? "mixed";
    return {
      draft,
      zoning,
      price: drawPrice(prng, profile, zoning),
      suitability: drawSuitability(prng, profile, zoning),
    };
  });
  const anchorIndices = assignAnchorOverrides({ parcels: working, profile });
  // Authored anchors keep the first parquet ordinals, in slot order: they are the economic
  // reference of the profile (D-064) and the geometry around them is still generated.
  const anchorSet = new Set(anchorIndices);
  const ordered = [
    ...anchorIndices.map((index) => working[index]!),
    ...working.filter((_, index) => !anchorSet.has(index)),
  ];
  const anchorParcelCount = anchorIndices.length;
  const parcels: Parcel[] = ordered.map((entry, index) => ({
    id: parseParcelId(`parcel_${String(parcelIdOrdinal + index + 1).padStart(8, "0")}`),
    districtId,
    blockId: parseBlockId(entry.draft.blockId),
    cells: entry.draft.cells.map((cell) => ({ ...cell })),
    anchorCell: { ...entry.draft.anchorCell },
    roadFrontages: entry.draft.roadFrontages.map((frontage) => ({
      roadSegmentId: frontage.roadSegmentId,
      cells: frontage.cells.map((cell) => ({ ...cell })),
    })),
    disposition: "marketable",
    price: parseMoney(entry.price),
    zoning: entry.zoning,
    ownerOrganizationId: null,
    buildingId: null,
    productionSuitability: { ...entry.suitability },
  }));

  issues.push(
    ...validateUrbanFabric({
      width: profile.width,
      height: profile.height,
      config,
      roads: network.topology,
      blockedCells: blocked,
      blocks,
      parcels,
      publicSpaces,
      gatewayCells,
      spawnCells: [profile.spawnAnchors.player, profile.spawnAnchors.rival],
    }),
    ...validatePlayability({ profile, parcels, blockedCells: blocked }),
  );
  return {
    parcels,
    blocks,
    publicSpaces,
    blockedCells: blocked,
    roads: network.topology,
    anchorParcelCount,
    issues,
  };
}

export function generateDistrictFromProfile(
  profile: DistrictProfile,
  seedValue: number,
  options: DistrictGenerationOptions = {},
): GeneratedDistrict {
  const seed = parseSeed(seedValue);
  const districtId = options.districtId ?? GENERATED_DISTRICT_ID;
  const parcelIdOrdinal = options.parcelIdOrdinal ?? 0;
  const gatewayCells = options.gatewayCells ?? [];
  let issues: DistrictGenerationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_COMPOSITION_ATTEMPTS; attempt += 1) {
    const prng = createPrng(deriveAttemptSeed(deriveGenerationSeed(seed, profile.id), attempt));
    const composition = attemptComposition({
      profile,
      prng,
      districtId,
      parcelIdOrdinal,
      gatewayCells,
    });
    if (composition.issues.length > 0) {
      issues = composition.issues;
      continue;
    }
    const blockedCells = [...composition.blockedCells].sort(compareCellKey);
    const district: District = {
      id: districtId,
      name: profile.name,
      width: profile.width,
      height: profile.height,
      generation: { profileId: profile.id, generatorVersion: DISTRICT_GENERATOR_VERSION, seed },
    };
    const hash = districtGenerationHash({
      profileId: profile.id,
      seed,
      district,
      parcels: composition.parcels,
      blocks: composition.blocks,
      publicSpaces: composition.publicSpaces,
      blockedCells,
      roads: composition.roads,
      spawnAnchors: profile.spawnAnchors,
    });
    return {
      district,
      parcels: composition.parcels,
      blocks: composition.blocks,
      publicSpaces: composition.publicSpaces,
      blockedCells,
      roads: composition.roads,
      spawnAnchors: {
        player: { ...profile.spawnAnchors.player },
        rival: { ...profile.spawnAnchors.rival },
      },
      roadAnchors: defaultRoadAnchors(
        profile,
        gatewayCells.map((cell, index) => ({
          id: `gateway_${String(index + 1).padStart(2, "0")}`,
          kind: "gateway",
          cell: { ...cell },
        })),
      ),
      report: buildReport({
        profile,
        seed,
        attempts: attempt,
        parcels: composition.parcels,
        blocks: composition.blocks,
        publicSpaces: composition.publicSpaces,
        blockedCells,
        roads: composition.roads,
        anchorParcelCount: composition.anchorParcelCount,
        hash,
        issues: [],
      }),
    };
  }

  throw new DistrictGenerationError({
    profileId: profile.id,
    seed,
    districtId,
    cityId: options.cityId,
    issues,
  });
}

export function generateDistrict(options: {
  seed: number;
  profileId?: string | undefined;
}): GeneratedDistrict {
  return generateDistrictFromProfile(resolveDistrictProfile(options.profileId), options.seed);
}

export function hasRoadAccess(
  parcel: Pick<Parcel, "cells">,
  roadCells: ReadonlySet<string>,
): boolean {
  const offsets = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  return parcel.cells.some((cell) =>
    offsets.some((offset) =>
      roadCells.has(cellKey({ x: cell.x + offset.x, y: cell.y + offset.y })),
    ),
  );
}

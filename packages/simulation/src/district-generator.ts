import {
  parseBlockId,
  parseBuildingId,
  parseDistrictId,
  parseMoney,
  parseParcelId,
  parsePublicSpaceId,
  parseSeed,
  parseUrbanFacilityId,
  roadCellsFromSegments,
  type Block,
  type Building,
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
  type UrbanFacility,
  type UrbanRole,
} from "@landlord/shared";

import {
  DISTRICT_GENERATOR_VERSION,
  resolveDistrictProfile,
  type DistrictProfile,
  type DistrictSpawnAnchors,
} from "./district-profiles";
import {
  developmentCodeForAnchorUse,
  developmentCodeForRole,
  zoningFamilyForCode,
  zoningFamilyForRole,
} from "./development-codes";
import type { DistrictGenerationIssue } from "./district-issues";
import {
  BUILDING_DEFINITIONS,
  MUNICIPALITY_ORGANIZATION_ID,
  PRIMARY_USE_BY_BUILDING_TYPE,
} from "./game-data";
import { chooseFootprint } from "./footprints";
import {
  MUNICIPAL_FACILITY_CAPACITY,
  MUNICIPAL_FACILITY_SERVICE_PROFILE,
  municipalProgramForProfile,
  type MunicipalProgramEntry,
} from "./municipal-program";
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
  roadFrontagesForCells,
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
  publicParcelCount: number;
  buildingCount: number;
  facilityCount: number;
  roleCounts: Record<UrbanRole, number>;
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
  buildings: Building[];
  facilities: UrbanFacility[];
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

function drawPrice(
  prng: Xoshiro128ss,
  profile: DistrictProfile,
  family: "residential" | "mixed" | "industrial",
): number {
  return nextInRange(prng, profile.priceBand[family]);
}

function drawSuitability(
  prng: Xoshiro128ss,
  profile: DistrictProfile,
  family: "residential" | "mixed" | "industrial",
): ProductionSuitability {
  const base = profile.suitability[family];
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
  role: UrbanRole;
  cells: GridCell[];
  anchorCell: GridCell;
  roadFrontages: Parcel["roadFrontages"];
};

/**
 * Urban-role recipe of a block (PLAN_improvements.md §V.d.2.2): road centrality (avenues), civic
 * distance, gateways and the district's dominant role. The role chooses the development code; it
 * does not decide what was built.
 */
function roleForBlock(input: {
  dominant: UrbanRole;
  distanceToCivic: number;
  onAvenue: boolean;
  nearGateway: boolean;
  middleRank: number;
  edgeRank: number;
}): UrbanRole {
  const { dominant, distanceToCivic, onAvenue, nearGateway, middleRank, edgeRank } = input;
  if (dominant === "industrial_logistics") {
    if (distanceToCivic <= 12) return "mixed_core";
    if (distanceToCivic <= 34) {
      return onAvenue && middleRank % 2 === 0 ? "commercial_corridor" : "urban_residential";
    }
    return "industrial_logistics";
  }
  if (dominant === "civic_core") {
    if (distanceToCivic <= 9) return "civic_core";
    if (distanceToCivic <= 20) return "mixed_core";
    if (distanceToCivic <= 34) {
      return onAvenue && middleRank % 2 === 0 ? "commercial_corridor" : "urban_residential";
    }
    return "industrial_logistics";
  }
  if (dominant === "commercial_corridor") {
    if (distanceToCivic <= 14) return "commercial_corridor";
    if (distanceToCivic <= 34) {
      return middleRank % 2 === 0 ? "mixed_core" : "urban_residential";
    }
    return "industrial_logistics";
  }
  if (dominant === "mixed_core") {
    if (distanceToCivic <= 12) return "mixed_core";
    if (distanceToCivic <= 34) {
      return onAvenue && middleRank % 2 === 0 ? "commercial_corridor" : "urban_residential";
    }
    return "industrial_logistics";
  }
  if (dominant === "low_density_residential" || dominant === "green_open_space") {
    if (distanceToCivic <= 24) {
      return nearGateway || middleRank % 3 !== 2 ? "mixed_core" : "low_density_residential";
    }
    return edgeRank % 3 === 0 ? "industrial_logistics" : "low_density_residential";
  }
  if (dominant === "urban_residential") {
    if (distanceToCivic <= 10) return "mixed_core";
    if (distanceToCivic <= 34) {
      return onAvenue && middleRank % 2 === 0 ? "commercial_corridor" : "urban_residential";
    }
    return "industrial_logistics";
  }
  return dominant;
}

type ReservedProgramBlock = {
  entry: MunicipalProgramEntry;
  cells: string[];
  gridCells: GridCell[];
  distanceToCivic: number;
};

/**
 * Reserves one whole block per programme entry before private subdivision. Facilities go to the
 * blocks closest to the civic centre; public spaces take the next free blocks in a fixed order. If
 * any entry has no free block the attempt fails: a missing mandatory facility is never silently
 * dropped (V.d.3).
 */
function reserveProgramBlocks(input: {
  openBlocks: readonly string[][];
  program: readonly MunicipalProgramEntry[];
  reservedCells: ReadonlySet<string>;
  roadCells: ReadonlySet<string>;
  center: GridCell;
}): { selected: ReservedProgramBlock[]; issues: DistrictGenerationIssue[] } {
  const candidates = input.openBlocks
    .filter((cells) => !cells.some((key) => input.reservedCells.has(key)))
    .filter((cells) =>
      cells.some((key) => {
        const [x, y] = key.split(":").map(Number) as [number, number];
        return [`${x}:${y - 1}`, `${x + 1}:${y}`, `${x}:${y + 1}`, `${x - 1}:${y}`].some(
          (neighbour) => input.roadCells.has(neighbour),
        );
      }),
    )
    .map((cells) => {
      const gridCells = cells.map(keyToCell);
      const centroid = {
        x: gridCells.reduce((sum, cell) => sum + cell.x, 0) / gridCells.length,
        y: gridCells.reduce((sum, cell) => sum + cell.y, 0) / gridCells.length,
      };
      return {
        cells,
        gridCells,
        distanceToCivic:
          Math.abs(centroid.x - input.center.x) + Math.abs(centroid.y - input.center.y),
      };
    })
    .sort(
      (left, right) =>
        left.distanceToCivic - right.distanceToCivic ||
        compareCellKey(left.cells[0]!, right.cells[0]!),
    );
  const used = new Set<number>();
  const selected: ReservedProgramBlock[] = [];
  const issues: DistrictGenerationIssue[] = [];
  for (const entry of input.program) {
    let chosen = -1;
    for (let index = 0; index < candidates.length; index += 1) {
      if (used.has(index)) continue;
      chosen = index;
      break;
    }
    if (chosen < 0) {
      issues.push({
        code: "PUBLIC_RESERVATION_INVALID",
        detail: `no hay manzana para ${entry.id}`,
      });
      break;
    }
    used.add(chosen);
    const candidate = candidates[chosen]!;
    selected.push({
      entry,
      cells: candidate.cells,
      gridCells: candidate.gridCells,
      distanceToCivic: candidate.distanceToCivic,
    });
  }
  return { selected, issues };
}

function assignAnchorOverrides(input: {
  parcels: Array<{
    draft: DraftParcel;
    developmentCodeId: import("@landlord/shared").DevelopmentCodeId;
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
    const code = developmentCodeForAnchorUse(slot.use);
    target.developmentCodeId = code.id;
    target.price = slot.price;
    target.suitability = {
      ...input.profile.suitability[zoningFamilyForCode(code)],
    };
    assigned.push(bestIndex);
  }
  return assigned;
}

const FAMILY_ORDER = ["residential", "mixed", "industrial"] as const;

function validatePlayability(input: {
  profile: DistrictProfile;
  parcels: readonly Parcel[];
  blocks: readonly Block[];
  blockedCells: ReadonlySet<string>;
}): DistrictGenerationIssue[] {
  const issues: DistrictGenerationIssue[] = [];
  const { profile, parcels, blocks, blockedCells } = input;
  const playability = profile.playability;
  const roleByBlock = new Map(blocks.map((block) => [block.id as string, block.urbanRole]));
  const zoningCounts: Record<(typeof FAMILY_ORDER)[number], number> = {
    residential: 0,
    mixed: 0,
    industrial: 0,
  };
  for (const parcel of parcels) {
    const role = roleByBlock.get(parcel.blockId as string) ?? profile.dominantRole;
    zoningCounts[zoningFamilyForRole(role)] += 1;
  }
  if (parcels.length < playability.minimumParcels) {
    issues.push({
      code: "INSUFFICIENT_PARCELS",
      detail: `${parcels.length} < ${playability.minimumParcels}`,
    });
  }
  for (const zoning of FAMILY_ORDER) {
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
  const prices = parcels.map((parcel) => parcel.marketValue);
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
  buildings: readonly Building[];
  facilities: readonly UrbanFacility[];
  blockedCells: readonly string[];
  roads: RoadTopology;
  spawnAnchors: DistrictSpawnAnchors;
}): string {
  const {
    profileId,
    seed,
    district,
    parcels,
    blocks,
    publicSpaces,
    buildings,
    facilities,
    blockedCells,
    roads,
  } = input;
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
        parcel.developmentCodeId,
        parcel.currentUses.join("+"),
        parcel.baseLandValue,
        parcel.marketValue,
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
  const buildingEntries = [...buildings]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((building) =>
      [
        building.id,
        building.type,
        building.districtId,
        canonicalCellKeys(building.footprintCells).join(","),
        building.orientation,
        building.floors,
        building.form,
      ].join("@"),
    )
    .join(";");
  const facilityEntries = [...facilities]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((facility) =>
      [
        facility.id,
        facility.kind,
        facility.districtId,
        facility.parcelIds.join(","),
        facility.buildingIds.join(","),
        facility.operatorOrganizationId,
        facility.capacity,
        facility.serviceProfileId,
      ].join("@"),
    )
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
    `buildings=${buildingEntries}`,
    `facilities=${facilityEntries}`,
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
  buildings: readonly Building[];
  facilities: readonly UrbanFacility[];
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
    buildings,
    facilities,
    blockedCells,
    roads,
    anchorParcelCount,
    hash,
    issues,
  } = input;
  const roleCounts = Object.fromEntries(
    [
      "civic_core",
      "mixed_core",
      "commercial_corridor",
      "urban_residential",
      "low_density_residential",
      "industrial_logistics",
      "institutional",
      "green_open_space",
    ].map((role) => [role, 0]),
  ) as Record<UrbanRole, number>;
  const roleByBlock = new Map(blocks.map((block) => [block.id as string, block.urbanRole]));
  for (const parcel of parcels) {
    const role = roleByBlock.get(parcel.blockId as string) ?? "urban_residential";
    roleCounts[role] += 1;
  }
  const marketable = parcels.filter((parcel) => parcel.disposition === "marketable");
  const prices = marketable.map((parcel) => parcel.marketValue);
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
    publicParcelCount: parcels.filter((parcel) => parcel.disposition === "public").length,
    buildingCount: buildings.length,
    facilityCount: facilities.length,
    roleCounts,
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
  buildingIdOrdinal?: number;
  facilityIdOrdinal?: number;
  /** Gateways of the city, already on this district's border (D-088, D-090). */
  gatewayCells?: readonly GridCell[];
  cityId?: CityId;
};

function attemptComposition(input: {
  profile: DistrictProfile;
  prng: Xoshiro128ss;
  districtId: DistrictId;
  parcelIdOrdinal: number;
  buildingIdOrdinal: number;
  facilityIdOrdinal: number;
  gatewayCells: readonly GridCell[];
}): {
  parcels: Parcel[];
  blocks: Block[];
  publicSpaces: PublicSpace[];
  buildings: Building[];
  facilities: UrbanFacility[];
  blockedCells: Set<string>;
  roads: RoadTopology;
  anchorParcelCount: number;
  issues: DistrictGenerationIssue[];
} {
  const {
    profile,
    prng,
    districtId,
    parcelIdOrdinal,
    buildingIdOrdinal,
    facilityIdOrdinal,
    gatewayCells,
  } = input;
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

  const program = municipalProgramForProfile(profile.id);
  const reservation = reserveProgramBlocks({
    openBlocks,
    program,
    reservedCells,
    roadCells: network.roadCells,
    center: { x: profile.width / 2, y: profile.height / 2 },
  });
  issues.push(...reservation.issues);
  if (issues.length > 0) {
    return {
      parcels: [],
      blocks: [],
      publicSpaces: [],
      buildings: [],
      facilities: [],
      blockedCells: blocked,
      roads: network.topology,
      anchorParcelCount: 0,
      issues,
    };
  }
  const reservedBlockCells = new Set(reservation.selected.flatMap((entry) => entry.cells));
  const blocks: Block[] = [];
  const drafts: DraftParcel[] = [];
  type ReservedFacility = {
    entry: Extract<MunicipalProgramEntry, { kind: "facility" }>;
    gridCells: GridCell[];
    block: Block;
  };
  const reservedFacilities: ReservedFacility[] = [];
  for (const selected of reservation.selected) {
    if (selected.entry.kind !== "facility") continue;
    const role: UrbanRole =
      selected.entry.facilityKind === "market" ? "commercial_corridor" : "institutional";
    const code = developmentCodeForRole(role);
    const frontageRoadSegmentIds = blockFrontageSegmentIds({
      cells: selected.gridCells,
      roadCells: network.roadCells,
      segmentsByCell: network.segmentsByCell,
    });
    if (frontageRoadSegmentIds.length === 0) {
      issues.push({
        code: "FACILITY_SITE_INVALID",
        detail: `${selected.entry.id} sin acceso vial`,
      });
      continue;
    }
    const block: Block = {
      id: parseBlockId(blockIdForGeometry(districtId, selected.gridCells)),
      districtId,
      cells: selected.gridCells,
      frontageRoadSegmentIds,
      urbanRole: role,
      defaultDevelopmentCodeId: code.id,
    };
    blocks.push(block);
    reservedFacilities.push({ entry: selected.entry, gridCells: selected.gridCells, block });
  }
  const publicSpaces: PublicSpace[] = reservation.selected
    .filter(
      (
        selected,
      ): selected is typeof selected & {
        entry: Extract<MunicipalProgramEntry, { kind: "public_space" }>;
      } => selected.entry.kind === "public_space",
    )
    .map((selected, index) => ({
      id: parsePublicSpaceId(publicSpaceIdForDistrict(districtId, index + 1)),
      districtId,
      blockId: null,
      kind: selected.entry.publicSpaceKind,
      cells: canonicalGridCells(selected.gridCells),
      operatorOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
    }));
  const bandCounters = { core: 0, middle: 0, edge: 0 };
  for (const cells of openBlocks) {
    if (cells.some((key) => reservedBlockCells.has(key))) continue;
    const gridCells = canonicalGridCells(cells.map(keyToCell));
    const frontageRoadSegmentIds = blockFrontageSegmentIds({
      cells: gridCells,
      roadCells: network.roadCells,
      segmentsByCell: network.segmentsByCell,
    });
    if (frontageRoadSegmentIds.length === 0) {
      // A block fully enclosed by obstacles is not developable terrain: it becomes an alley-like
      // obstruction instead of failing the whole district.
      for (const key of cells) blocked.add(key);
      continue;
    }
    const blockId = blockIdForGeometry(districtId, gridCells);
    const centroid = {
      x: gridCells.reduce((sum, cell) => sum + cell.x, 0) / gridCells.length,
      y: gridCells.reduce((sum, cell) => sum + cell.y, 0) / gridCells.length,
    };
    const distanceToCivic =
      Math.abs(centroid.x - profile.width / 2) + Math.abs(centroid.y - profile.height / 2);
    const avenueSegments = new Set(
      network.topology.segments
        .filter((segment) => segment.class === "avenue")
        .map((segment) => segment.id),
    );
    const onAvenue = frontageRoadSegmentIds.some((id) => avenueSegments.has(id));
    const nearGateway = gatewayCells.some(
      (cell) => Math.abs(cell.x - centroid.x) + Math.abs(cell.y - centroid.y) <= 8,
    );
    const band = distanceToCivic <= 12 ? "core" : distanceToCivic <= 34 ? "middle" : "edge";
    const middleRank = band === "middle" ? bandCounters.middle++ : bandCounters.middle;
    const edgeRank = band === "edge" ? bandCounters.edge++ : bandCounters.edge;
    if (band === "core") bandCounters.core += 1;
    const role = roleForBlock({
      dominant: profile.dominantRole,
      distanceToCivic,
      onAvenue,
      nearGateway,
      middleRank,
      edgeRank,
    });
    const code = developmentCodeForRole(role);
    blocks.push({
      id: parseBlockId(blockId),
      districtId,
      cells: gridCells,
      frontageRoadSegmentIds,
      urbanRole: role,
      defaultDevelopmentCodeId: code.id,
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
      drafts.push({ blockId, role, ...parcel });
    }
  }

  drafts.sort(
    (left, right) =>
      compareCells(left.anchorCell, right.anchorCell) ||
      compareCellKey(canonicalCellKeys(left.cells)[0]!, canonicalCellKeys(right.cells)[0]!),
  );
  const working = drafts.map((draft) => {
    const family = zoningFamilyForRole(draft.role);
    return {
      draft,
      developmentCodeId: developmentCodeForRole(draft.role).id,
      price: drawPrice(prng, profile, family),
      suitability: drawSuitability(prng, profile, family),
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
    baseLandValue: parseMoney(entry.price),
    marketValue: parseMoney(entry.price),
    developmentCodeId: entry.developmentCodeId,
    currentUses: [],
    ownerOrganizationId: null,
    productionSuitability: { ...entry.suitability },
  }));

  const publicParcels: Parcel[] = [];
  const municipalBuildings: Building[] = [];
  const facilities: UrbanFacility[] = [];
  let facilityIndex = 0;
  for (const reservation of reservedFacilities) {
    const definition = BUILDING_DEFINITIONS[reservation.entry.buildingType];
    const code = developmentCodeForRole(reservation.block.urbanRole);
    const frontages = roadFrontagesForCells({
      cells: reservation.gridCells,
      roadCells: network.roadCells,
      segmentsByCell: network.segmentsByCell,
    });
    const footprint = chooseFootprint({
      parcel: { cells: reservation.gridCells, roadFrontages: frontages },
      code,
      definition,
      principalFrontageCells: frontages.flatMap((frontage) => frontage.cells),
      buildings: [],
    });
    if ("error" in footprint) {
      issues.push({
        code: "FACILITY_SITE_INVALID",
        detail: `${reservation.entry.id}: ${footprint.error}`,
      });
      continue;
    }
    const parcelId = parseParcelId(
      `parcel_${String(parcelIdOrdinal + parcels.length + publicParcels.length + 1).padStart(8, "0")}`,
    );
    const anchorCell = reservation.gridCells[0]!;
    const use = PRIMARY_USE_BY_BUILDING_TYPE[reservation.entry.buildingType];
    const parcel: Parcel = {
      id: parcelId,
      districtId,
      blockId: reservation.block.id,
      cells: reservation.gridCells.map((cell) => ({ ...cell })),
      anchorCell: { ...anchorCell },
      roadFrontages: frontages.map((frontage) => ({
        roadSegmentId: frontage.roadSegmentId,
        cells: frontage.cells.map((cell) => ({ ...cell })),
      })),
      disposition: "public",
      baseLandValue: parseMoney(0),
      marketValue: parseMoney(0),
      developmentCodeId: code.id,
      currentUses: [use],
      ownerOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
      productionSuitability: { cement: 100, brick: 100, steel: 100 },
    };
    const buildingId = parseBuildingId(
      `building_${String(buildingIdOrdinal + facilityIndex + 1).padStart(8, "0")}`,
    );
    const building: Building = {
      id: buildingId,
      parcelIds: [parcelId],
      districtId,
      ownerOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
      productionFacilityId: null,
      type: reservation.entry.buildingType,
      footprintCells: footprint.footprintCells.map((cell) => ({ ...cell })),
      orientation: footprint.orientation,
      floors: footprint.floors,
      form: footprint.form,
      level: 1,
      condition: 100,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    };
    const facility: UrbanFacility = {
      id: parseUrbanFacilityId(
        `urbanfacility_${String(facilityIdOrdinal + facilityIndex + 1).padStart(8, "0")}`,
      ),
      kind: reservation.entry.facilityKind,
      districtId,
      parcelIds: [parcelId],
      buildingIds: [buildingId],
      publicSpaceIds: [],
      operatorOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
      capacity: MUNICIPAL_FACILITY_CAPACITY[reservation.entry.facilityKind],
      serviceProfileId: MUNICIPAL_FACILITY_SERVICE_PROFILE[reservation.entry.facilityKind],
    };
    facilityIndex += 1;
    publicParcels.push(parcel);
    municipalBuildings.push(building);
    facilities.push(facility);
  }
  if (facilities.length !== program.filter((entry) => entry.kind === "facility").length) {
    issues.push({
      code: "FACILITY_SITE_INVALID",
      detail: `programa incompleto: ${facilities.length} equipamientos`,
    });
  }
  const allParcels = [...parcels, ...publicParcels];

  issues.push(
    ...validateUrbanFabric({
      width: profile.width,
      height: profile.height,
      config,
      roads: network.topology,
      blockedCells: blocked,
      blocks,
      parcels: allParcels,
      publicSpaces,
      facilities,
      gatewayCells,
      spawnCells: [profile.spawnAnchors.player, profile.spawnAnchors.rival],
    }),
    ...validatePlayability({
      profile,
      parcels: allParcels.filter((parcel) => parcel.disposition === "marketable"),
      blocks,
      blockedCells: blocked,
    }),
  );
  return {
    parcels: allParcels,
    blocks,
    publicSpaces,
    buildings: municipalBuildings,
    facilities,
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
  const buildingIdOrdinal = options.buildingIdOrdinal ?? 0;
  const facilityIdOrdinal = options.facilityIdOrdinal ?? 0;
  const gatewayCells = options.gatewayCells ?? [];
  let issues: DistrictGenerationIssue[] = [];

  for (let attempt = 1; attempt <= MAX_COMPOSITION_ATTEMPTS; attempt += 1) {
    const prng = createPrng(deriveAttemptSeed(deriveGenerationSeed(seed, profile.id), attempt));
    const composition = attemptComposition({
      profile,
      prng,
      districtId,
      parcelIdOrdinal,
      buildingIdOrdinal,
      facilityIdOrdinal,
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
      buildings: composition.buildings,
      facilities: composition.facilities,
      blockedCells,
      roads: composition.roads,
      spawnAnchors: profile.spawnAnchors,
    });
    return {
      district,
      parcels: composition.parcels,
      blocks: composition.blocks,
      publicSpaces: composition.publicSpaces,
      buildings: composition.buildings,
      facilities: composition.facilities,
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
        buildings: composition.buildings,
        facilities: composition.facilities,
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

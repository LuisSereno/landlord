import {
  districtGatewayIdentity,
  districtGenerationSeed,
  parseCityId,
  parseCityProfileId,
  parseDistrictConnectionId,
  parseDistrictId,
  parseSeed,
  type Block,
  type City,
  type CityProfileId,
  type District,
  type DistrictConnection,
  type DistrictGateway,
  type DistrictId,
  type DistrictSide,
  type Building,
  type GridCell,
  type Parcel,
  type PublicSpace,
  type RoadTopology,
  type UrbanFacility,
  type UrbanRole,
} from "@landlord/shared";

import {
  DISTRICT_GENERATOR_VERSION,
  resolveDistrictProfile,
  type DistrictProfile,
} from "./district-profiles";
import { generateDistrictFromProfile, type GeneratedDistrict } from "./district-generator";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";

/**
 * City layer of V.d (D-088).
 *
 * Nine districts, all generated up front, each with its own seed derived from the city seed, so
 * changing one district recipe never shifts another district's geometry. The layout is authored;
 * the geometry inside every district is procedural.
 */

export const DEFAULT_CITY_PROFILE_ID = parseCityProfileId("ciudad_del_umbral_v1");
export const CITY_LAYOUT = { columns: 3, rows: 3 } as const;
export const DISTRICT_WIDTH = 64;
export const DISTRICT_HEIGHT = 64;

export type CitySlotDefinition = {
  slotX: number;
  slotY: number;
  districtProfileId: string;
  /** District name as authored by the city profile (§4.1), independent of the recipe name. */
  districtName: string;
  dominantRole: UrbanRole;
};

export type CityProfileDefinition = {
  id: CityProfileId;
  name: string;
  slots: readonly CitySlotDefinition[];
  /** Integer traversal cost of a gateway; D-092 uses it as the service graph edge weight. */
  gatewayConnectionCost: number;
};

const CITY_SLOTS: readonly CitySlotDefinition[] = [
  {
    slotX: 0,
    slotY: 0,
    districtProfileId: "lomas_del_umbral",
    districtName: "Lomas del Umbral",
    dominantRole: "low_density_residential",
  },
  {
    slotX: 1,
    slotY: 0,
    districtProfileId: "mercado_del_norte",
    districtName: "Mercado del Norte",
    dominantRole: "commercial_corridor",
  },
  {
    slotX: 2,
    slotY: 0,
    districtProfileId: "vega_del_cauce",
    districtName: "Vega del Cauce",
    dominantRole: "green_open_space",
  },
  {
    slotX: 0,
    slotY: 1,
    districtProfileId: "barrio_del_umbral",
    districtName: "Barrio del Umbral",
    dominantRole: "urban_residential",
  },
  {
    slotX: 1,
    slotY: 1,
    districtProfileId: "centro_civico",
    districtName: "Centro Cívico",
    dominantRole: "civic_core",
  },
  {
    slotX: 2,
    slotY: 1,
    districtProfileId: "barrio_del_taller",
    districtName: "Barrio del Taller",
    dominantRole: "mixed_core",
  },
  {
    slotX: 0,
    slotY: 2,
    districtProfileId: "ensanche_ferroviario_oeste",
    districtName: "Ensanche Ferroviario Oeste",
    dominantRole: "industrial_logistics",
  },
  {
    slotX: 1,
    slotY: 2,
    districtProfileId: "ensanche_ferroviario",
    districtName: "Corredor Ferroviario",
    dominantRole: "commercial_corridor",
  },
  {
    slotX: 2,
    slotY: 2,
    districtProfileId: "patios_del_este",
    districtName: "Patios del Este",
    dominantRole: "industrial_logistics",
  },
];

export const CITY_PROFILES: Record<string, CityProfileDefinition> = {
  ciudad_del_umbral_v1: {
    id: DEFAULT_CITY_PROFILE_ID,
    name: "Ciudad del Umbral",
    slots: CITY_SLOTS,
    gatewayConnectionCost: 4,
  },
};

export const CITY_PROFILE_IDS: readonly string[] = Object.keys(CITY_PROFILES).sort((left, right) =>
  left.localeCompare(right),
);

export function resolveCityProfile(
  profileId: CityProfileId = DEFAULT_CITY_PROFILE_ID,
): CityProfileDefinition {
  const profile = CITY_PROFILES[profileId];
  if (!profile) {
    throw new RangeError(
      `Unknown city profile: ${profileId} (disponibles: ${CITY_PROFILE_IDS.join(", ")})`,
    );
  }
  return profile;
}

/** Canonical slot order: row first, then column. Every hash and digest walks this order. */
export function canonicalSlots(profile: CityProfileDefinition): readonly CitySlotDefinition[] {
  return [...profile.slots].sort(
    (left, right) => left.slotY - right.slotY || left.slotX - right.slotX,
  );
}

export function slotOrdinal(
  slotX: number,
  slotY: number,
  columns: number = CITY_LAYOUT.columns,
): number {
  return slotY * columns + slotX;
}

export function districtIdForSlot(
  slotX: number,
  slotY: number,
  columns: number = CITY_LAYOUT.columns,
): DistrictId {
  return parseDistrictId(
    `district_${String(slotOrdinal(slotX, slotY, columns) + 1).padStart(8, "0")}`,
  );
}

export function slotForDistrictId(
  districtId: DistrictId,
  columns: number = CITY_LAYOUT.columns,
): { slotX: number; slotY: number } {
  const ordinal = Number(districtId.slice("district_".length)) - 1;
  return { slotX: ordinal % columns, slotY: Math.floor(ordinal / columns) };
}

/**
 * Per-district parcel ordinal block, so nine districts never collide on a parcel id.
 *
 * The district that hosts the player roster takes block 0: its parcels keep the `parcel_00000001…`
 * identity that every economic test and fixture was written against, and "the first parcels" keeps
 * meaning "the player's neighbourhood" instead of an arbitrary corner of the grid.
 */
export function parcelOrdinalBlock(slotX: number, slotY: number): number {
  if (slotX === CITY_ROSTER_SLOTS.player.slotX && slotY === CITY_ROSTER_SLOTS.player.slotY)
    return 0;
  const ordinal = slotOrdinal(slotX, slotY);
  const playerOrdinal = slotOrdinal(CITY_ROSTER_SLOTS.player.slotX, CITY_ROSTER_SLOTS.player.slotY);
  return (ordinal < playerOrdinal ? ordinal + 1 : ordinal) * 1_000_000;
}

export function parcelIdOrdinalForSlot(slotX: number, slotY: number): number {
  return parcelOrdinalBlock(slotX, slotY);
}

export type GeneratedDistrictState = {
  district: District;
  parcels: Parcel[];
  blocks: Block[];
  publicSpaces: PublicSpace[];
  buildings: Building[];
  facilities: UrbanFacility[];
  blockedCells: string[];
  roads: RoadTopology;
  spawnAnchors: GeneratedDistrict["spawnAnchors"];
  report: GeneratedDistrict["report"];
};

export type AdjacentPair = {
  slotX: number;
  slotY: number;
  side: DistrictSide;
  neighbourSlotX: number;
  neighbourSlotY: number;
  neighbourSide: DistrictSide;
};

/** Every orthogonally adjacent pair, emitted once, in canonical order. */
export function adjacentPairs(
  columns: number = CITY_LAYOUT.columns,
  rows: number = CITY_LAYOUT.rows,
): readonly AdjacentPair[] {
  const pairs: AdjacentPair[] = [];
  for (let slotY = 0; slotY < rows; slotY += 1) {
    for (let slotX = 0; slotX < columns; slotX += 1) {
      if (slotX + 1 < columns) {
        pairs.push({
          slotX,
          slotY,
          side: "east",
          neighbourSlotX: slotX + 1,
          neighbourSlotY: slotY,
          neighbourSide: "west",
        });
      }
      if (slotY + 1 < rows) {
        pairs.push({
          slotX,
          slotY,
          side: "south",
          neighbourSlotX: slotX,
          neighbourSlotY: slotY + 1,
          neighbourSide: "north",
        });
      }
    }
  }
  return pairs;
}

/**
 * Gateway cell of a shared border. The middle of the border sits on the central lattice line of
 * three-line recipes (x = y = 32), so a gateway is already a road cell there and only short
 * connectors are needed on four-line recipes (D-090).
 */
export function gatewayCellForSide(side: DistrictSide): GridCell {
  const index = Math.floor(DISTRICT_WIDTH / 2);
  if (side === "north") return { x: index, y: 0 };
  if (side === "south") return { x: index, y: DISTRICT_HEIGHT - 1 };
  if (side === "west") return { x: 0, y: index };
  return { x: DISTRICT_WIDTH - 1, y: index };
}

export type GatewayCandidate = {
  pair: AdjacentPair;
  leftId: DistrictId;
  leftCell: GridCell;
  rightId: DistrictId;
  rightCell: GridCell;
};

/** Gateway cells per district, before any geometry is generated. */
export function gatewayCellsByDistrict(
  columns: number = CITY_LAYOUT.columns,
  rows: number = CITY_LAYOUT.rows,
): ReadonlyMap<DistrictId, GridCell[]> {
  const result = new Map<DistrictId, GridCell[]>();
  for (const pair of adjacentPairs(columns, rows)) {
    const leftId = districtIdForSlot(pair.slotX, pair.slotY, columns);
    const rightId = districtIdForSlot(pair.neighbourSlotX, pair.neighbourSlotY, columns);
    const left = result.get(leftId) ?? [];
    left.push(gatewayCellForSide(pair.side));
    result.set(leftId, left);
    const right = result.get(rightId) ?? [];
    right.push(gatewayCellForSide(pair.neighbourSide));
    result.set(rightId, right);
  }
  for (const cells of result.values()) {
    cells.sort((left, right) => left.y - right.y || left.x - right.x);
  }
  return result;
}

function segmentsCovering(roads: RoadTopology, cell: GridCell): string[] {
  const ids: string[] = [];
  for (const segment of roads.segments) {
    const dx = Math.sign(segment.to.x - segment.from.x);
    const dy = Math.sign(segment.to.y - segment.from.y);
    const length = Math.max(
      Math.abs(segment.to.x - segment.from.x),
      Math.abs(segment.to.y - segment.from.y),
    );
    for (let step = 0; step <= length; step += 1) {
      if (segment.from.x + dx * step === cell.x && segment.from.y + dy * step === cell.y) {
        ids.push(segment.id);
        break;
      }
    }
  }
  return ids.sort((left, right) => left.localeCompare(right));
}

/**
 * One gateway per adjacent pair, on the pre-computed border cells. The generator connected every
 * gateway to the district's public network; this function only records which segments touch each
 * side (D-092).
 */
export function deriveGateways(
  districts: ReadonlyMap<DistrictId, GeneratedDistrictState>,
): readonly GatewayCandidate[] {
  void districts;
  return adjacentPairs().map((pair) => {
    const leftId = districtIdForSlot(pair.slotX, pair.slotY);
    const rightId = districtIdForSlot(pair.neighbourSlotX, pair.neighbourSlotY);
    return {
      pair,
      leftId,
      leftCell: gatewayCellForSide(pair.side),
      rightId,
      rightCell: gatewayCellForSide(pair.neighbourSide),
    };
  });
}

export function gatewayRoadSegmentIds(
  districts: ReadonlyMap<DistrictId, GeneratedDistrictState>,
  candidate: GatewayCandidate,
): string[] {
  const ids = new Set<string>();
  for (const id of segmentsCovering(districts.get(candidate.leftId)!.roads, candidate.leftCell))
    ids.add(id);
  for (const id of segmentsCovering(districts.get(candidate.rightId)!.roads, candidate.rightCell))
    ids.add(id);
  return [...ids].sort((left, right) => left.localeCompare(right));
}

export type GeneratedCity = {
  city: City;
  districts: Map<DistrictId, GeneratedDistrictState>;
  gateways: DistrictGateway[];
  connections: DistrictConnection[];
  /** Districts that host the starting rosters, by organization role. */
  rosterSlots: {
    player: { slotX: number; slotY: number };
    rival: { slotX: number; slotY: number };
  };
};

/** The player starts in Barrio del Umbral and the rival in Barrio del Taller (§4.1 of the plan). */
export const CITY_ROSTER_SLOTS = {
  player: { slotX: 0, slotY: 1 },
  rival: { slotX: 2, slotY: 1 },
} as const;

export const PLAYER_HOME_DISTRICT_ID = districtIdForSlot(
  CITY_ROSTER_SLOTS.player.slotX,
  CITY_ROSTER_SLOTS.player.slotY,
);
export const RIVAL_HOME_DISTRICT_ID = districtIdForSlot(
  CITY_ROSTER_SLOTS.rival.slotX,
  CITY_ROSTER_SLOTS.rival.slotY,
);

function connectionIdFromGateway(gatewayId: string): string {
  return `connection_${gatewayId.slice("gateway_".length)}`;
}

export function createCity(options: {
  seed: number;
  profileId?: CityProfileId | undefined;
}): GeneratedCity {
  const profile = resolveCityProfile(options.profileId);
  const districts = new Map<DistrictId, GeneratedDistrictState>();
  const cityId = parseCityId("city_00000001");
  const gatewaysByDistrict = gatewayCellsByDistrict();

  for (const slot of canonicalSlots(profile)) {
    const districtProfile: DistrictProfile = resolveDistrictProfile(slot.districtProfileId);
    const districtSeed = districtGenerationSeed({
      citySeed: parseSeed(options.seed),
      cityProfileId: profile.id,
      slotX: slot.slotX,
      slotY: slot.slotY,
      districtProfileId: districtProfile.id,
    });
    const districtId = districtIdForSlot(slot.slotX, slot.slotY);
    const generated = generateDistrictFromProfile(districtProfile, districtSeed, {
      districtId,
      parcelIdOrdinal: parcelIdOrdinalForSlot(slot.slotX, slot.slotY),
      buildingIdOrdinal: 90_000_000 + slotOrdinal(slot.slotX, slot.slotY) * 1_000,
      facilityIdOrdinal: slotOrdinal(slot.slotX, slot.slotY) * 1_000,
      gatewayCells: gatewaysByDistrict.get(districtId) ?? [],
      cityId,
    });
    districts.set(districtId, {
      district: { ...generated.district, name: slot.districtName },
      parcels: generated.parcels,
      blocks: generated.blocks,
      publicSpaces: generated.publicSpaces,
      buildings: generated.buildings,
      facilities: generated.facilities,
      blockedCells: generated.blockedCells,
      roads: generated.roads,
      spawnAnchors: generated.spawnAnchors,
      report: generated.report,
    });
  }

  const candidates = deriveGateways(districts);
  const identities = candidates.map((candidate) =>
    districtGatewayIdentity({
      firstDistrictId: candidate.leftId,
      firstSide: candidate.pair.side,
      secondDistrictId: candidate.rightId,
      secondSide: candidate.pair.neighbourSide,
    }),
  );

  const gateways: DistrictGateway[] = candidates.map((candidate, index) => {
    const identity = identities[index]!;
    const firstIsLeft = identity.districtIds[0] === candidate.leftId;
    return {
      id: identity.id,
      districtIds: identity.districtIds,
      sides: identity.sides,
      cells: firstIsLeft
        ? [candidate.leftCell, candidate.rightCell]
        : [candidate.rightCell, candidate.leftCell],
      roadSegmentIds: gatewayRoadSegmentIds(districts, candidate),
    };
  });

  const connections: DistrictConnection[] = identities.map((identity) => ({
    id: parseDistrictConnectionId(connectionIdFromGateway(identity.id)),
    gatewayId: identity.id,
    fromDistrictId: identity.districtIds[0]!,
    toDistrictId: identity.districtIds[1]!,
    cost: profile.gatewayConnectionCost,
  }));

  const city: City = {
    id: cityId,
    name: profile.name,
    municipalityOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
    layout: { columns: CITY_LAYOUT.columns, rows: CITY_LAYOUT.rows },
    districtIds: canonicalSlots(profile).map((slot) => districtIdForSlot(slot.slotX, slot.slotY)),
    connections,
    generation: {
      profileId: profile.id,
      generatorVersion: DISTRICT_GENERATOR_VERSION,
      seed: parseSeed(options.seed),
    },
  };

  return {
    city,
    districts,
    gateways,
    connections,
    rosterSlots: {
      player: { ...CITY_ROSTER_SLOTS.player },
      rival: { ...CITY_ROSTER_SLOTS.rival },
    },
  };
}

import { z } from "zod";

import {
  blockIdSchema,
  buildingIdSchema,
  cityIdSchema,
  cityProfileIdSchema,
  developmentCodeIdSchema,
  districtConnectionIdSchema,
  districtGatewayIdSchema,
  districtIdSchema,
  organizationIdSchema,
  parcelIdSchema,
  publicSpaceIdSchema,
  urbanFacilityIdSchema,
  type CityProfileId,
  type DistrictId,
  type DistrictGatewayId,
} from "./primitives";
import { gridCellSchema, seedSchema, type GridCell, type Seed } from "./time-and-grid";

/**
 * Contracts of the V.d urban fabric (D-090, D-092).
 *
 * This module is additive on purpose: the engine still runs the single-district v1 model, and these
 * types are the shape it moves to. Nothing here is derived from Phaser, React or the DOM, and no
 * field carries presentation.
 */

/** Function of a block in the city. It steers the development code; it does not say what was built. */
export const urbanRoleSchema = z.enum([
  "civic_core",
  "mixed_core",
  "commercial_corridor",
  "urban_residential",
  "low_density_residential",
  "industrial_logistics",
  "institutional",
  "green_open_space",
]);
export type UrbanRole = z.infer<typeof urbanRoleSchema>;

/** What may occupy a parcel. Replaces the three-value `Zoning` of v1 (D-090). */
export const landUseSchema = z.enum([
  "residential",
  "retail",
  "office",
  "industrial",
  "civic",
  "education",
  "health",
  "utility",
]);
export type LandUse = z.infer<typeof landUseSchema>;

/**
 * Building envelope rules. Percentages are integers because authoritative rules never touch floats:
 * a float here would make the canonical digest depend on evaluation order (D-060).
 */
export const developmentCodeSchema = z.object({
  id: developmentCodeIdSchema,
  allowedUses: z.array(landUseSchema).min(1),
  maxFloors: z.number().int().min(1).max(64),
  maxCoveragePercent: z.number().int().min(0).max(100),
  maxFloorAreaRatioPercent: z.number().int().min(0),
  streetSetbackCells: z.number().int().min(0),
  sideSetbackCells: z.number().int().min(0),
});

export type DevelopmentCode = z.infer<typeof developmentCodeSchema>;

export const roadFrontageSchema = z.object({
  roadSegmentId: z.string().min(1),
  cells: z.array(gridCellSchema).min(1),
});
export type RoadFrontage = z.infer<typeof roadFrontageSchema>;

export const blockSchema = z.object({
  id: blockIdSchema,
  districtId: districtIdSchema,
  cells: z.array(gridCellSchema).min(1),
  frontageRoadSegmentIds: z.array(z.string().min(1)).min(1),
  urbanRole: urbanRoleSchema,
  defaultDevelopmentCodeId: developmentCodeIdSchema,
});

export type Block = z.infer<typeof blockSchema>;

export const publicSpaceKindSchema = z.enum([
  "plaza",
  "park",
  "pocket_park",
  "civic_courtyard",
  "schoolyard",
]);
export type PublicSpaceKind = z.infer<typeof publicSpaceKindSchema>;

export const publicSpaceSchema = z.object({
  id: publicSpaceIdSchema,
  districtId: districtIdSchema,
  /** A public space may be an independent reservation, not attached to any developable block. */
  blockId: blockIdSchema.nullable(),
  kind: publicSpaceKindSchema,
  cells: z.array(gridCellSchema).min(1),
  operatorOrganizationId: organizationIdSchema,
});

export type PublicSpace = z.infer<typeof publicSpaceSchema>;

export const urbanFacilityKindSchema = z.enum([
  "town_hall",
  "school",
  "clinic",
  "police_station",
  "fire_station",
  "market",
]);
export type UrbanFacilityKind = z.infer<typeof urbanFacilityKindSchema>;

/**
 * An operating function of the municipality, distinct from its physical buildings (D-092). A school
 * is the function; the teaching block and its schoolyard are objects. Collapsing the two is what
 * makes "school with courtyard" and "relocatable market" unrepresentable.
 */
export const urbanFacilitySchema = z.object({
  id: urbanFacilityIdSchema,
  kind: urbanFacilityKindSchema,
  districtId: districtIdSchema,
  parcelIds: z.array(parcelIdSchema).min(1),
  buildingIds: z.array(buildingIdSchema),
  publicSpaceIds: z.array(publicSpaceIdSchema),
  operatorOrganizationId: organizationIdSchema,
  capacity: z.number().int().min(1),
  serviceProfileId: z.string().min(1),
});

export type UrbanFacility = z.infer<typeof urbanFacilitySchema>;

export const districtSideSchema = z.enum(["north", "east", "south", "west"]);
export type DistrictSide = z.infer<typeof districtSideSchema>;

/**
 * A shared border crossing between two districts. Both districts carry a cell: the gateway is one
 * cell in each of them, never a phantom coordinate between maps (D-088).
 */
export const districtGatewaySchema = z.object({
  id: districtGatewayIdSchema,
  /** Ordered so that a pair of districts and their sides always produces the same identity. */
  districtIds: z.array(districtIdSchema).length(2),
  cells: z.array(gridCellSchema).length(2),
  sides: z.array(districtSideSchema).length(2),
  roadSegmentIds: z.array(z.string().min(1)),
});

export type DistrictGateway = z.infer<typeof districtGatewaySchema>;

export const districtConnectionSchema = z.object({
  id: districtConnectionIdSchema,
  gatewayId: districtGatewayIdSchema,
  fromDistrictId: districtIdSchema,
  toDistrictId: districtIdSchema,
  /** Integer traversal cost declared by the city profile (D-092). */
  cost: z.number().int().min(1),
});

export type DistrictConnection = z.infer<typeof districtConnectionSchema>;

export const cityGenerationSchema = z.object({
  profileId: cityProfileIdSchema,
  generatorVersion: z.number().int().min(1),
  seed: seedSchema,
});
export type CityGeneration = z.infer<typeof cityGenerationSchema>;

export const citySchema = z.object({
  id: cityIdSchema,
  name: z.string().min(1).max(96),
  municipalityOrganizationId: organizationIdSchema,
  layout: z.object({ columns: z.literal(3), rows: z.literal(3) }),
  districtIds: z.array(districtIdSchema).length(9),
  connections: z.array(districtConnectionSchema),
  generation: cityGenerationSchema,
});

export type City = z.infer<typeof citySchema>;

/** Authored description of one district slot of a city profile. */
export const cityDistrictSlotSchema = z.object({
  slotX: z.number().int().min(0).max(2),
  slotY: z.number().int().min(0).max(2),
  profileId: z.string().min(1),
  name: z.string().min(1).max(96),
  dominantRole: urbanRoleSchema,
});
export type CityDistrictSlot = z.infer<typeof cityDistrictSlotSchema>;

export const cityProfileSchema = z.object({
  id: cityProfileIdSchema,
  name: z.string().min(1).max(96),
  layout: z.object({ columns: z.literal(3), rows: z.literal(3) }),
  districtSlots: z.array(cityDistrictSlotSchema).length(9),
  gatewayConnectionCost: z.number().int().min(1),
});

export type CityProfile = z.infer<typeof cityProfileSchema>;

/**
 * Derivation of the per-district seed. It is a pure function of the inputs so that adding or
 * removing a district recipe never shifts another district's geometry (D-088, D-064).
 */
export function districtGenerationSeed(input: {
  citySeed: Seed;
  cityProfileId: CityProfileId;
  slotX: number;
  slotY: number;
  districtProfileId: string;
}): Seed {
  const source = [
    `landlord.district-seed.v1|${input.citySeed}`,
    input.cityProfileId,
    input.slotX,
    input.slotY,
    input.districtProfileId,
  ].join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul((hash ^ source.charCodeAt(index)) >>> 0, 0x01000193) >>> 0;
  }
  return seedSchema.parse(hash >>> 0);
}

/** Canonical identity of a gateway from its two districts and their sides, independent of discovery order. */
export function districtGatewayIdentity(input: {
  firstDistrictId: DistrictId;
  firstSide: DistrictSide;
  secondDistrictId: DistrictId;
  secondSide: DistrictSide;
}): {
  districtIds: [DistrictId, DistrictId];
  sides: [DistrictSide, DistrictSide];
  id: DistrictGatewayId;
} {
  const pairs = [
    [input.firstDistrictId, input.firstSide],
    [input.secondDistrictId, input.secondSide],
  ] as const;
  const ordered = [...pairs].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const [first, second] = ordered as [[DistrictId, DistrictSide], [DistrictId, DistrictSide]];
  const source = `landlord.gateway.v1|${first[0]}|${first[1]}|${second[0]}|${second[1]}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul((hash ^ source.charCodeAt(index)) >>> 0, 0x01000193) >>> 0;
  }
  return {
    districtIds: [first[0], second[0]],
    sides: [first[1], second[1]],
    id: `gateway_${hash.toString(16).padStart(8, "0")}` as DistrictGatewayId,
  };
}

/** Cell keys of a geometry, sorted: connectivity and identity checks operate on this, never on order of insertion. */
export function canonicalCellKeys(cells: readonly GridCell[]): string[] {
  return [...new Set(cells.map((cell) => `${cell.x}:${cell.y}`))].sort();
}

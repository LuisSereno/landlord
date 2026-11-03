import { z } from "zod";

import { buildingTypeSchema } from "./domain";
import {
  developmentPlacementIdSchema,
  districtIdSchema,
  parcelIdSchema,
  type DevelopmentPlacementId,
  type DistrictId,
  type ParcelId,
} from "./primitives";
import { gridCellSchema, type GridCell } from "./time-and-grid";

/** Physical rotation of a footprint inside its site. Same vocabulary as `Building.orientation`. */
export const placementOrientationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);
export type PlacementOrientation = z.infer<typeof placementOrientationSchema>;

/**
 * V.d-7C · una colocación legal. Es dato derivado del motor: identidad, alcance catastral, huella y
 * orientación. El `id` se deriva canónicamente de esos mismos campos (§8 D-097), nunca del orden de
 * enumeración, así que un candidato sobreviviente sigue siendo el mismo aunque cambie el orden de
 * inserción de los Maps del estado.
 */
export type DevelopmentPlacementCandidate = {
  id: DevelopmentPlacementId;
  districtId: DistrictId;
  /** Conjunto canónico de parcelas del proyecto, en el orden que valida el motor. */
  parcelIds: ParcelId[];
  footprintCells: GridCell[];
  orientation: PlacementOrientation;
  floors: number;
  /** Only the highest-ranked candidate of an enumeration; the UI labels it, no scoring is exposed. */
  recommended: boolean;
};

export const developmentPlacementCandidateSchema = z.object({
  id: developmentPlacementIdSchema,
  districtId: districtIdSchema,
  parcelIds: z.array(parcelIdSchema).min(1),
  footprintCells: z.array(gridCellSchema).min(1),
  orientation: placementOrientationSchema,
  floors: z.number().int().positive(),
  recommended: z.boolean(),
});

/**
 * Why an enumeration returned nothing. These are the same authoritative buildability codes the
 * engine already rejects a command with, so the UI explains a real engine reason instead of a
 * second, UI-only diagnosis.
 */
export const placementRejectionSchema = z.enum([
  "NO_BUILDABLE_ENVELOPE",
  "COVERAGE_LIMIT",
  "FAR_LIMIT",
  "DUPLICATE_PARCELS",
  "WRONG_PARCEL_COUNT",
  "PARCEL_NOT_FOUND",
  "PARCELS_DIFFERENT_DISTRICT",
  "MIXED_DEVELOPMENT_CODES",
  "USE_NOT_ALLOWED",
  "ACTIVE_SITE_ON_PARCEL",
  "PARCEL_OCCUPIED",
  "PARCELS_NOT_EDGE_CONTIGUOUS",
  "SITE_AREA_TOO_SMALL",
  "PUBLIC_LAND_NOT_BUILDABLE",
  "ACTOR_NOT_AUTHORIZED",
]);
export type PlacementRejection = z.infer<typeof placementRejectionSchema>;

/**
 * Read-only answer to `GetDevelopmentPlacementCandidates`. `totalCandidates` counts the whole legal
 * set while `candidates` is the ranked page the transport carries, so the UI can say "no hay más"
 * without the engine shipping thousands of footprints per request.
 */
export const developmentPlacementCandidatesSchema = z.object({
  districtId: districtIdSchema,
  parcelIds: z.array(parcelIdSchema).min(1),
  buildingType: buildingTypeSchema,
  candidates: z.array(developmentPlacementCandidateSchema),
  totalCandidates: z.number().int().nonnegative(),
  rejection: placementRejectionSchema.nullable(),
});

export type DevelopmentPlacementCandidates = z.infer<typeof developmentPlacementCandidatesSchema>;

import { z } from "zod";

import type { BuildingType } from "./domain";

/**
 * Contrato runtime de assets (WP4.15). La fuente puede ser Blender o la factoría procedural; el
 * runtime sólo consume este manifiesto. Las imágenes viajan como data URI SVG en Alpha para no
 * versionar binarios ni exigir Git LFS; el esquema admite URLs relativas para el pipeline Blender.
 */
export type AssetImageV1 = {
  /** `data:image/svg+xml;base64,...` o una ruta relativa a `public/`. */
  src: string;
  width: number;
  height: number;
  /** SHA-256 del contenido fuente (SVG o PNG) para provenance y detección de ediciones manuales. */
  sha256: string;
};

export type BuildingAssetState = "complete" | "construction" | "damaged" | "burning";

export type BuildingAssetV1 = {
  type: BuildingType;
  name: string;
  /** Huella en celdas isométricas; ordena el depth frente a vecinos. */
  footprint: { width: number; height: number };
  /** Punto de anclaje normalizado 0..1 dentro de la imagen (suelo, centro de la huella). */
  pivot: { x: number; y: number };
  states: Record<BuildingAssetState, AssetImageV1>;
};

export type CharacterAnimation = "idle" | "walk";

export type CharacterAssetV1 = {
  id: string;
  name: string;
  directions: 4 | 8;
  animations: Record<CharacterAnimation, { frameDurationMs: number; frames: AssetImageV1[] }>;
};

export type RuntimeAssetManifestV1 = {
  schemaVersion: 1;
  generator: {
    id: string;
    version: number;
    method: "procedural_svg" | "blender_render";
    source: string;
  };
  provenance: {
    license: "original" | "cc0" | "cc_by";
    author: string;
    notes: string;
  };
  buildings: Record<BuildingType, BuildingAssetV1>;
  characters: Record<string, CharacterAssetV1>;
};

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const assetImageSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha256: sha256Schema,
});

export const buildingAssetStateSchema = z.enum(["complete", "construction", "damaged", "burning"]);

export const buildingAssetSchema = z.object({
  type: z.enum(["courtyard_home", "workshop", "cement_plant", "brickworks", "steelworks"]),
  name: z.string().min(1),
  footprint: z.object({
    width: z.number().positive().max(8),
    height: z.number().positive().max(8),
  }),
  pivot: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  states: z.object({
    complete: assetImageSchema,
    construction: assetImageSchema,
    damaged: assetImageSchema,
    burning: assetImageSchema,
  }),
});

export const characterAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  directions: z.union([z.literal(4), z.literal(8)]),
  animations: z.object({
    idle: z.object({
      frameDurationMs: z.number().int().positive(),
      frames: z.array(assetImageSchema).min(1),
    }),
    walk: z.object({
      frameDurationMs: z.number().int().positive(),
      frames: z.array(assetImageSchema).min(1),
    }),
  }),
});

export const runtimeAssetManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  generator: z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    method: z.enum(["procedural_svg", "blender_render"]),
    source: z.string().min(1),
  }),
  provenance: z.object({
    license: z.enum(["original", "cc0", "cc_by"]),
    author: z.string().min(1),
    notes: z.string(),
  }),
  buildings: z.record(z.string(), buildingAssetSchema),
  characters: z.record(z.string(), characterAssetSchema),
});

export const BUILDING_ASSET_STATES: readonly BuildingAssetState[] = [
  "complete",
  "construction",
  "damaged",
  "burning",
];

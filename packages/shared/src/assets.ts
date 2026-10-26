import { z } from "zod";

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

/**
 * Licencias admitidas. Los literales son SPDX y son los mismos que
 * `blender_artist/manifests/license-allowlist.json`; `assets.test.ts` falla si divergen, para
 * que contrato y validador de staging no puedan volver a representar dos veces la misma licencia.
 */
export const ASSET_LICENSES = ["original", "CC0-1.0", "MIT", "CC-BY-4.0"] as const;

/** Licencias que obligan a conservar aviso de autoría: sin evidencia, el manifiesto no pasa. */
export const ATTRIBUTION_REQUIRED_LICENSES = ["MIT", "CC-BY-4.0"] as const;

export type AssetLicense = (typeof ASSET_LICENSES)[number];

export type AssetAttributionV1 = {
  sourceUrl: string;
  licenseUrl: string;
  attributionText: string;
  /** Fecha ISO en la que se verificó la licencia en la fuente. */
  verifiedAt: string;
  /** SHA-256 del archivo de licencia que viaja con el material. */
  licenseFileSha256: string;
};

export type AssetProvenanceV1 = {
  license: AssetLicense;
  author: string;
  /** id lógico contra blender_artist/manifests/staging-sources.json. */
  sourceId?: string;
  attribution?: AssetAttributionV1;
  notes?: string;
};

export type BuildingAssetV1 = {
  /**
   * Id del asset de arte. No tiene por qué coincidir con `BuildingType` del motor: el bundle
   * puede publicar catálogo externo (Kenney) sin ampliar los tipos de la simulación.
   */
  type: string;
  name: string;
  /** Huella en celdas isométricas; ordena el depth frente a vecinos. */
  footprint: { width: number; height: number };
  /** Punto de anclaje normalizado 0..1 dentro de la imagen (suelo, centro de la huella). */
  pivot: { x: number; y: number };
  states: Record<BuildingAssetState, AssetImageV1>;
  /**
   * Densidad de la fuente: píxeles por metro de la cámara que produjo el sprite. El renderer
   * lo usa para escalar al grid del juego (celda de 4 m = 64 px de diagonal).
   */
  pixelsPerMeter?: number;
  /** Procedencia de este asset; si falta, heredaba la del bundle. */
  provenance?: AssetProvenanceV1;
};

/**
 * Asset escénico de una sola imagen (terrain, prop o vehicle). Comparte pivote y huella con los
 * edificios para que el depth se resuelva con la misma función `depthForAsset`.
 */
export type SceneryAssetV1 = {
  id: string;
  name: string;
  footprint: { width: number; height: number };
  pivot: { x: number; y: number };
  image: AssetImageV1;
  pixelsPerMeter?: number;
  provenance?: AssetProvenanceV1;
};

export type CharacterAnimation = "idle" | "walk";

export type CharacterAssetV1 = {
  id: string;
  name: string;
  directions: 4 | 8;
  animations: Record<CharacterAnimation, { frameDurationMs: number; frames: AssetImageV1[] }>;
  provenance?: AssetProvenanceV1;
};

export type RuntimeAssetManifestV1 = {
  schemaVersion: 1;
  generator: {
    id: string;
    version: number;
    method: "procedural_svg" | "blender_render";
    source: string;
  };
  /**
   * Resumen del bundle. Un bundle puede mezclar CC0 y MIT, así que cada asset declara su
   * `provenance` propia (D-083); esto queda como valor por defecto y como resumen legible.
   */
  provenance: AssetProvenanceV1;
  buildings: Record<string, BuildingAssetV1>;
  characters: Record<string, CharacterAssetV1>;
  /** Capa de suelo (carreteras y losas). Opcional: el bundle procedural no la publica. */
  terrain?: Record<string, SceneryAssetV1>;
  /** Mobiliario urbano y vegetación. Opcional por la misma razón. */
  props?: Record<string, SceneryAssetV1>;
  /** Vehículos. Opcional por la misma razón. */
  vehicles?: Record<string, SceneryAssetV1>;
};

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const assetAttributionSchema = z.object({
  sourceUrl: z.string().url(),
  licenseUrl: z.string().url(),
  attributionText: z.string().min(1),
  verifiedAt: z.string().min(1),
  licenseFileSha256: sha256Schema,
});

export const assetProvenanceSchema = z
  .object({
    license: z.enum(ASSET_LICENSES),
    author: z.string().min(1),
    sourceId: z.string().min(1).optional(),
    attribution: assetAttributionSchema.optional(),
    notes: z.string().optional(),
  })
  .superRefine((provenance, ctx) => {
    const required = (ATTRIBUTION_REQUIRED_LICENSES as readonly string[]).includes(
      provenance.license,
    );
    if (required && !provenance.attribution) {
      ctx.addIssue({
        code: "custom",
        path: ["attribution"],
        message: `la licencia ${provenance.license} exige evidencia de atribución (sourceUrl, licenseUrl, attributionText, verifiedAt, licenseFileSha256)`,
      });
    }
  });

export const assetImageSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha256: sha256Schema,
});

export const buildingAssetStateSchema = z.enum(["complete", "construction", "damaged", "burning"]);

export const buildingAssetSchema = z.object({
  type: z.string().min(1),
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
  pixelsPerMeter: z.number().positive().optional(),
  provenance: assetProvenanceSchema.optional(),
});

export const sceneryAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  footprint: z.object({
    width: z.number().positive().max(8),
    height: z.number().positive().max(8),
  }),
  pivot: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  image: assetImageSchema,
  pixelsPerMeter: z.number().positive().optional(),
  provenance: assetProvenanceSchema.optional(),
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
  provenance: assetProvenanceSchema.optional(),
});

export const runtimeAssetManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  generator: z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    method: z.enum(["procedural_svg", "blender_render"]),
    source: z.string().min(1),
  }),
  provenance: assetProvenanceSchema,
  buildings: z.record(z.string(), buildingAssetSchema),
  characters: z.record(z.string(), characterAssetSchema),
  terrain: z.record(z.string(), sceneryAssetSchema).optional(),
  props: z.record(z.string(), sceneryAssetSchema).optional(),
  vehicles: z.record(z.string(), sceneryAssetSchema).optional(),
});

export const BUILDING_ASSET_STATES: readonly BuildingAssetState[] = [
  "complete",
  "construction",
  "damaged",
  "burning",
];

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
 * Frame alternativo de un asset escénico para una orientación concreta (azimut de cámara).
 * El pivote se publica por frame porque la proyección del origen cambia con el azimut.
 */
export type SceneryFrameV1 = {
  image: AssetImageV1;
  pivot: { x: number; y: number };
  pixelsPerMeter?: number;
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
  /**
   * Orientaciones adicionales indexadas por azimut en grados ("225", "315"...). El frame por
   * defecto (45°) vive en `image`/`pivot` para no duplicarlo. La escena elige por colocación.
   */
  orientations?: Record<string, SceneryFrameV1>;
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

export const sceneryFrameSchema = z.object({
  image: assetImageSchema,
  pivot: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  pixelsPerMeter: z.number().positive().optional(),
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
  orientations: z.record(z.string(), sceneryFrameSchema).optional(),
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

/**
 * RuntimeAssetManifestV2 (V.d.6 §3, cerrado en V.d-H1).
 *
 * V1 describe el dibujo: asset, estados, pivote y huella en celdas isométricas. Le faltaban las dos
 * cosas que el motor necesita para no adivinar —qué huella de dominio representa ese dibujo y en qué
 * orientaciones de cámara es legal mostrarlo— y la simetría, que es lo que permite a un asset
 * cuadrado servirse de cualquier azimut mientras uno asimétrico sólo vale de frente.
 */
export const BUILDING_ORIENTATIONS = [45, 135, 225, 315] as const;
export type BuildingOrientation = (typeof BUILDING_ORIENTATIONS)[number];

/**
 * `omni`  — todas las orientaciones producen la misma silueta (asset cuadrado y sin fachada única).
 * `mirror` — el frame declarado vale también para su espejo en X.
 * `none`   — el asset sólo puede mostrarse en las orientaciones que enumera.
 */
export const ASSET_SYMMETRIES = ["omni", "mirror", "none"] as const;
export type AssetSymmetry = (typeof ASSET_SYMMETRIES)[number];

export type BuildingAssetV2 = {
  type: string;
  name: string;
  /** Celdas isométricas que pinta el sprite: manda en el depth y en el anclaje visual. */
  footprint: { width: number; height: number };
  /** Celdas de 4 m que ocupa el tipo en la simulación. Es lo que el dibujo representa. */
  domainFootprint: { width: number; height: number };
  pivot: { x: number; y: number };
  states: Record<BuildingAssetState, AssetImageV1>;
  pixelsPerMeter?: number;
  provenance?: AssetProvenanceV1;
  /** Azimuts de cámara en los que este asset es legal. El runtime no puede inventar otros. */
  allowedOrientations: BuildingOrientation[];
  symmetry: AssetSymmetry;
  /** Frames adicionales por azimut; sólo pueden declararse orientaciones permitidas. */
  orientations?: Record<string, SceneryFrameV1>;
};

export type RuntimeAssetManifestV2 = {
  schemaVersion: 2;
  generator: RuntimeAssetManifestV1["generator"];
  provenance: AssetProvenanceV1;
  buildings: Record<string, BuildingAssetV2>;
  characters: Record<string, CharacterAssetV1>;
  terrain?: Record<string, SceneryAssetV1>;
  props?: Record<string, SceneryAssetV1>;
  vehicles?: Record<string, SceneryAssetV1>;
};

export const buildingAssetV2Schema = buildingAssetSchema.extend({
  domainFootprint: z.object({
    width: z.number().int().positive().max(8),
    height: z.number().int().positive().max(8),
  }),
  allowedOrientations: z
    .array(z.union([z.literal(45), z.literal(135), z.literal(225), z.literal(315)]))
    .min(1),
  symmetry: z.enum(ASSET_SYMMETRIES),
  orientations: z.record(z.string(), sceneryFrameSchema).optional(),
});

export const runtimeAssetManifestV2Schema = z.object({
  schemaVersion: z.literal(2),
  generator: runtimeAssetManifestV1Schema.shape.generator,
  provenance: assetProvenanceSchema,
  buildings: z.record(z.string(), buildingAssetV2Schema),
  characters: z.record(z.string(), characterAssetSchema),
  terrain: z.record(z.string(), sceneryAssetSchema).optional(),
  props: z.record(z.string(), sceneryAssetSchema).optional(),
  vehicles: z.record(z.string(), sceneryAssetSchema).optional(),
});

/**
 * Conversión V1 → V2, explícita y sin ramas silenciosas. Un manifiesto V1 nunca declaró orientación
 * legal: sólo se dibujó a 45°, así que eso es lo que se le puede garantizar. La huella de dominio de
 * un asset V1 se desconoce, y `footprint` es lo único que se puede afirmar de él; la validación
 * posterior es la que denuncia los tipos cuyo dominio real es más ancho.
 */
export function fromRuntimeAssetManifestV1(
  manifest: RuntimeAssetManifestV1,
): RuntimeAssetManifestV2 {
  return {
    schemaVersion: 2,
    generator: manifest.generator,
    provenance: manifest.provenance,
    characters: manifest.characters,
    ...(manifest.terrain ? { terrain: manifest.terrain } : {}),
    ...(manifest.props ? { props: manifest.props } : {}),
    ...(manifest.vehicles ? { vehicles: manifest.vehicles } : {}),
    buildings: Object.fromEntries(
      Object.entries(manifest.buildings).map(([key, asset]) => [
        key,
        {
          ...asset,
          domainFootprint: { ...asset.footprint },
          allowedOrientations: [45] as BuildingOrientation[],
          symmetry: "none" as AssetSymmetry,
        },
      ]),
    ),
  };
}

/** Punto único de entrada: un `schemaVersion` desconocido es un error, no una rama por defecto. */
export function parseRuntimeAssetManifest(value: unknown): RuntimeAssetManifestV2 {
  const declared =
    typeof value === "object" && value !== null && "schemaVersion" in value
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (declared === 2)
    return runtimeAssetManifestV2Schema.parse(value) as unknown as RuntimeAssetManifestV2;
  if (declared === 1)
    return runtimeAssetManifestV2Schema.parse(
      fromRuntimeAssetManifestV1(
        runtimeAssetManifestV1Schema.parse(value) as unknown as RuntimeAssetManifestV1,
      ),
    ) as unknown as RuntimeAssetManifestV2;
  throw new Error(
    `RUNTIME_ASSET_MANIFEST_VERSION: se esperaba schemaVersion 1 o 2 y el manifiesto declara ${String(declared)}`,
  );
}

/**
 * Comprobaciones de contrato que el runtime no puede asumir. Devuelve la lista de incidencias en
 * orden canónico: vacío significa que el manifiesto es dibujable sin adivinar nada.
 */
export function validateRuntimeAssetManifestV2(manifest: RuntimeAssetManifestV2): string[] {
  const issues: string[] = [];
  for (const [key, asset] of Object.entries(manifest.buildings).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (asset.type !== key) issues.push(`${key}: type no coincide con la clave del catálogo`);
    for (const state of BUILDING_ASSET_STATES)
      if (!asset.states[state]) issues.push(`${key}: falta el estado ${state}`);
    if (asset.footprint.width < 1 || asset.footprint.height < 1)
      issues.push(`${key}: huella de sprite inválida`);
    if (asset.domainFootprint.width < 1 || asset.domainFootprint.height < 1)
      issues.push(`${key}: huella de dominio inválida`);
    const allowed = new Set<number>(asset.allowedOrientations);
    if (allowed.size !== asset.allowedOrientations.length)
      issues.push(`${key}: orientaciones permitidas duplicadas`);
    if (asset.symmetry === "omni" && allowed.size !== BUILDING_ORIENTATIONS.length)
      issues.push(`${key}: simetría omni exige las cuatro orientaciones`);
    if (asset.symmetry === "none" && !allowed.has(45))
      issues.push(`${key}: un asset asimétrico debe poder dibujarse de frente (45°)`);
    for (const frame of Object.keys(asset.orientations ?? {})) {
      const azimuth = Number(frame);
      if (!BUILDING_ORIENTATIONS.includes(azimuth as BuildingOrientation))
        issues.push(`${key}: frame en orientación inexistente ${frame}`);
      else if (!allowed.has(azimuth)) issues.push(`${key}: frame en ${frame} no está permitido`);
    }
  }
  return issues;
}

/**
 * El runtime pregunta aquí en vez de asumir. Un `null` significa "no dibujes este asset desde este
 * azimut": la alternativa sería mostrar de lado un edificio pintado de frente.
 */
export function buildingFrameForOrientation(
  asset: BuildingAssetV2,
  azimuth: number,
): SceneryFrameV1 | null {
  if (!asset.allowedOrientations.includes(azimuth as BuildingOrientation)) return null;
  const frame = asset.orientations?.[String(azimuth)];
  if (frame) return frame;
  /** `mirror` comparte silueta con su espejo; el resto de azimuts no tiene frame que ofrecer. */
  if (azimuth === 45 || asset.symmetry === "omni" || asset.symmetry === "mirror")
    return { image: asset.states.complete, pivot: asset.pivot };
  return null;
}

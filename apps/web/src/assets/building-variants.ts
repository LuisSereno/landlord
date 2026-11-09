import {
  buildingVariantKey,
  validateBuildingVariantManifest,
  type BuildingAssetState,
  type BuildingAssetV2,
  type BuildingPhysicalOrientation,
  type BuildingVariantManifestV1,
  type BuildingVariantV1,
  type ConstructionStage,
} from "@landlord/shared";
import rawVariants from "../generated/runtime-building-variants.json";

/**
 * V.j.5 — catálogo de variantes reales (tipo × estado × etapa × orientación física). El manifiesto
 * se versiona; los PNG se sirven bajo demanda desde un dir gitignored (D-102: el arranque no carga
 * las imágenes, sólo este índice). V.j.6 añade caché por distrito + expulsión + métricas.
 */
export const BUILDING_VARIANTS = rawVariants as unknown as BuildingVariantManifestV1;

const variantIssues = validateBuildingVariantManifest(BUILDING_VARIANTS);
if (variantIssues.length > 0) {
  throw new Error(`El manifiesto de variantes no cumple el contrato: ${variantIssues.join(" | ")}`);
}

export function resolveBuildingVariant(
  type: string,
  state: BuildingAssetState,
  orientation: BuildingPhysicalOrientation,
  stage?: ConstructionStage | null,
): BuildingVariantV1 | null {
  return BUILDING_VARIANTS.variants[buildingVariantKey(type, state, orientation, stage)] ?? null;
}

export function variantTextureKey(
  type: string,
  state: BuildingAssetState,
  orientation: BuildingPhysicalOrientation,
  stage?: ConstructionStage | null,
): string {
  return `blender-variant-${buildingVariantKey(type, state, orientation, stage)}`;
}

/**
 * Envuelve una variante real en el contrato BuildingAssetV2 para reutilizar el plan de sprites y el
 * escalado existentes: el render de la variante pasa a ser el único estado `complete` del asset
 * sintético (ya está en la orientación/estado pedidos; no se rota ni se tiñe en pantalla).
 */
export function variantAsAsset(type: string, variant: BuildingVariantV1): BuildingAssetV2 {
  return {
    type,
    name: type,
    footprint: variant.footprint,
    domainFootprint: variant.domainFootprint,
    pivot: variant.pivot,
    states: { complete: variant.image },
    ...(variant.pixelsPerMeter !== undefined ? { pixelsPerMeter: variant.pixelsPerMeter } : {}),
    allowedOrientations: [45],
    symmetry: "none",
  };
}

/** Tipos que tienen arte real de variantes y por tanto NO deben caer al fallback procedural. */
export function hasRealVariants(type: string): boolean {
  return Object.keys(BUILDING_VARIANTS.variants).some((key) => key.startsWith(`${type}:`));
}

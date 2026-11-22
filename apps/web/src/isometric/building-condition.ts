import type { BuildingAssetState } from "@landlord/shared";

/**
 * D-111.2 WP04 + cierre FASE 4 — proyección visual de conservación derivada del estado autoritativo
 * (los umbrales son los que publica el contrato: blender_artist/manifests/building-weathering-contract.json → visualStates).
 *
 * El contrato de weathering (`blender_artist/manifests/building-weathering-contract.json`) separa
 * cuatro representaciones, pero el runtime sólo conocía tres `BuildingAssetState` y una regla:
 * `condition < 60 ⇒ "damaged"`. Esa regla convertía un edificio operativo con poco mantenimiento en
 * una ruina con sección de cubierta, escombros y hollín —deterioro estructural que la simulación no
 * ha declarado— y dejaba el tier `aged` del contrato sin ninguna ruta de selección.
 *
 * Aquí no se inventa ningún umbral: se lee el que ya publicó el contrato en `visualStates.*.derivation`
 * y se aplica a los tres campos que YA viajan en la proyección de vista
 * (`packages/shared/src/projection.ts:522-528` — `condition`, `structuralIntegrity`, `state`).
 * No se añade ningún estado a `GameState` ni se toca la simulación: esto es presentación derivada.
 *
 * `damaged` del contrato admite dos orígenes (`state == 'ruin'` **o** el colapso de `condition < 60`
 * que hacía el runtime). Se desempata con `structuralIntegrity`, que es justo lo que el tier `aged`
 * exige por definición (`structuralIntegrity > 0`): un paño sucio pero con estructura no es una ruina.
 */
export type BuildingVisualTier = "conserved" | "aged" | "damaged" | "burning";

/** Los tres campos que la proyección necesita. Son el tipo exacto de la vista, no un estado nuevo. */
export type BuildingConditionInput = {
  readonly state: "operational" | "burning" | "collapse_pending" | "ruin";
  readonly condition: number;
  readonly structuralIntegrity: number;
};

/** Umbral del contrato (`aged`: `condition < 60`). Se nombra una sola vez para que no se duplique. */
export const AGED_CONDITION_BELOW = 60;

export function buildingVisualTierFor(input: BuildingConditionInput): BuildingVisualTier {
  if (input.state === "burning" || input.state === "collapse_pending") return "burning";
  if (input.state === "ruin") return "damaged";
  if (input.condition >= AGED_CONDITION_BELOW) return "conserved";
  return input.structuralIntegrity > 0 ? "aged" : "damaged";
}

/**
 * Qué sprite de catálogo se carga por tier. `aged` es `complete` a propósito: el envejecimiento es una
 * proyección de MATERIAL (`materialProjection: true`, `geometryChange: false` en el contrato), no un
 * cuarto estado geométrico, así que comparte silhouette con el edificio conservado.
 */
const TIER_ASSET_STATE: Record<BuildingVisualTier, BuildingAssetState> = {
  conserved: "complete",
  aged: "complete",
  damaged: "damaged",
  burning: "burning",
};

/**
 * Token que se le pasa a `request.weathering` al componer el sprite. `null` = el tier no es una
 * proyección de material sino de geometría, y elegirlo con `weathering` haría abortar el compositor
 * (`weatheringTokens` del contrato sólo declara `conserved` y `aged`).
 */
const TIER_WEATHERING: Record<BuildingVisualTier, "conserved" | "aged" | null> = {
  conserved: "conserved",
  aged: "aged",
  damaged: null,
  burning: null,
};

export type BuildingVisualProjection = {
  readonly tier: BuildingVisualTier;
  readonly assetState: BuildingAssetState;
  readonly weathering: "conserved" | "aged" | null;
};

/** Resolución completa: sprite del catálogo y token del request de composición. */
export function projectBuildingCondition(input: BuildingConditionInput): BuildingVisualProjection {
  const tier = buildingVisualTierFor(input);
  return { tier, assetState: TIER_ASSET_STATE[tier], weathering: TIER_WEATHERING[tier] };
}

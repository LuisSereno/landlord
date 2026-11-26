import type {
  BuildingAssetState,
  BuildingVariantManifestV1,
  RuntimeAssetManifestV2,
} from "@landlord/shared";

import { BLENDER_ASSETS, PROCEDURAL_ASSETS } from "../assets/runtime-assets";
import { BUILDING_VARIANTS } from "../assets/building-variants";
import { buildingTypeLabel } from "./labels";

/**
 * V.d-UX · miniatura de un edificio derivada del asset que el juego ya dibuja (spec §7.2). Las
 * variantes Blender promocionadas tienen prioridad: son la misma geometría y el mismo PNG que la
 * escena isométrica para complete@0. El bundle histórico y el procedural sólo sostienen un tipo que
 * todavía no tenga variante real.
 */
export function buildingThumbnailSource(
  type: string,
  state: BuildingAssetState = "complete",
  bundles: {
    variants?: BuildingVariantManifestV1;
    blender?: RuntimeAssetManifestV2;
    procedural: RuntimeAssetManifestV2;
  } = {
    variants: BUILDING_VARIANTS,
    blender: BLENDER_ASSETS,
    procedural: PROCEDURAL_ASSETS,
  },
): string | null {
  // El catálogo sólo solicita `complete`; no fingimos una etapa de obra al no disponer de su stage.
  const variantType = type === "headquarters" ? "headquarters_cupola" : type;
  const variant =
    state === "complete" ? bundles.variants?.variants[`${variantType}:complete:-:0`] : null;
  if (variant) return variant.image.src;
  const blender = bundles.blender?.buildings[type]?.states?.[state]?.src;
  if (blender) return blender;
  return (
    bundles.procedural.buildings[type]?.states?.[state]?.src ??
    (type === "headquarters"
      ? bundles.procedural.buildings.courtyard_home?.states?.[state]?.src
      : null) ??
    null
  );
}

/**
 * Miniatura con fondo neutro y proporción conservada. El nombre del edificio ya vive al lado en
 * las tarjetas, así que la imagen es decorativa salvo que se pida `alt`.
 */
export function BuildingThumbnail({
  type,
  state = "complete",
  size = 56,
  alt,
  className,
}: {
  type: string;
  state?: BuildingAssetState;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const src = buildingThumbnailSource(type, state);
  const classes = className ? `building-thumbnail ${className}` : "building-thumbnail";
  if (!src)
    return (
      <span
        aria-label={alt ?? `${buildingTypeLabel(type)}: sin imagen`}
        className={`${classes} building-thumbnail-empty`}
        role="img"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span className={classes} style={{ width: size, height: size }}>
      <img alt={alt ?? ""} aria-hidden={alt ? undefined : true} src={src} />
    </span>
  );
}

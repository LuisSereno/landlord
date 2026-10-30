import type { BuildingAssetState, RuntimeAssetManifestV2 } from "@landlord/shared";

import { BLENDER_ASSETS, PROCEDURAL_ASSETS } from "../assets/runtime-assets";
import { buildingTypeLabel } from "./labels";

/**
 * V.d-UX · miniatura de un edificio derivada del asset que el juego ya dibuja (spec §7.2). No hay
 * una segunda colección de iconos: se lee el frame `complete` del `RuntimeAssetManifestV2`. El
 * orden de resolución es el mismo que usa la escena —Blender si declara el tipo, procedural como
 * respaldo—, así que sustituir un tipo en el pipeline actualiza la miniatura sin tocar la UI.
 */
export function buildingThumbnailSource(
  type: string,
  state: BuildingAssetState = "complete",
  bundles: { blender?: RuntimeAssetManifestV2; procedural: RuntimeAssetManifestV2 } = {
    blender: BLENDER_ASSETS,
    procedural: PROCEDURAL_ASSETS,
  },
): string | null {
  const blender = bundles.blender?.buildings[type]?.states?.[state]?.src;
  if (blender) return blender;
  return bundles.procedural.buildings[type]?.states?.[state]?.src ?? null;
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

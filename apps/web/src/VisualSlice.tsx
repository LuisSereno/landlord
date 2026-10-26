import { useEffect, useRef } from "react";

import { mountVisualSlice } from "./isometric/mount";
import { TERRAIN_STAGES, type TerrainStage } from "./visual-slice/terrain-paint";

function terrainStage(value: string | null): TerrainStage {
  return TERRAIN_STAGES.includes((value ?? "") as TerrainStage) ? (value as TerrainStage) : "full";
}

/**
 * Ruta de evaluación del Visual Slice: monta la escena de gameplay real con la composición
 * autoral de la microzona. `?characters=1` añade la capa de personajes, `?terrain=none|base|
 * parcels|full` hornea el suelo hasta una capa concreta para la evidencia BEFORE/AFTER, y
 * `?grid=1` devuelve la cuadrícula de edición. El resto de la URL no altera la composición.
 */
export function VisualSlice() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const params = new URLSearchParams(window.location.search);
    return mountVisualSlice(container.current, {
      characters: params.get("characters") === "1",
      terrainStage: terrainStage(params.get("terrain")),
      showGrid: params.get("grid") === "1",
    });
  }, []);

  return <div className="visual-slice-canvas" ref={container} data-testid="visual-slice" />;
}

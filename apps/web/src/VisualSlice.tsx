import { useEffect, useRef } from "react";

import { mountVisualSlice } from "./isometric/mount";

/**
 * Ruta de evaluación del Visual Slice: monta la escena de gameplay real con la composición
 * autoral de la microzona. `?characters=1` añade la capa de personajes; el resto de la URL no
 * altera la composición.
 */
export function VisualSlice() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return undefined;
    const characters = new URLSearchParams(window.location.search).get("characters") === "1";
    return mountVisualSlice(container.current, { characters });
  }, []);

  return <div className="visual-slice-canvas" ref={container} data-testid="visual-slice" />;
}

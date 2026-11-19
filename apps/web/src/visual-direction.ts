/** A/B de dirección visual para QA. No se guarda en localStorage ni toca la partida. */
export const VISUAL_DIRECTIONS = ["graphic_civic", "material_maquette_candidate"] as const;
export type VisualDirection = (typeof VISUAL_DIRECTIONS)[number];

export function parseVisualDirection(search: string): VisualDirection {
  return new URLSearchParams(search).get("artDirection") === "material_maquette_candidate"
    ? "material_maquette_candidate"
    : "graphic_civic";
}

export function readVisualDirection(): VisualDirection {
  if (typeof window === "undefined") return "graphic_civic";
  return parseVisualDirection(window.location.search);
}

export function applyVisualDirection(direction: VisualDirection): void {
  document.documentElement.dataset.visualDirection = direction;
}

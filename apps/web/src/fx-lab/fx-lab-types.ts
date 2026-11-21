/**
 * D-111 §7 — laboratorio de capacidades gráficas de Phaser 4.
 *
 * Todo lo de esta carpeta es PRESENTACIÓN DERIVADA y opt-in. No lee GameState, no envía comandos,
 * no escribe en `localStorage` ni en saves: el único estado vive en la URL (`/art-lab?fxLab=1`).
 * Los efectos están APAGADOS por defecto; cada uno se activa de forma independiente.
 */
export const FX_EFFECTS = [
  "grading",
  "bloomThreshold",
  "bloomObjects",
  "lighting",
  "lightingNormals",
  "particles",
  "fire",
] as const;

export type FxEffect = (typeof FX_EFFECTS)[number];

export type FxMood = "day" | "night";
export type FxRenderer = "auto" | "canvas";

export type FxLabOptions = {
  readonly effects: readonly FxEffect[];
  readonly mood: FxMood;
  readonly zoom: number;
  readonly renderer: FxRenderer;
  /** Con `perf=1` la escena acumula frame times para poder medir on/off. */
  readonly perf: boolean;
};

/** Cadena canónica de efectos activos: vacía ⇒ ninguno (estado por defecto del laboratorio). */
export const FX_NONE = "";

export function isFxEffect(value: string): value is FxEffect {
  return (FX_EFFECTS as readonly string[]).includes(value);
}

export function parseFxEffects(value: string | null): FxEffect[] {
  if (!value || value === FX_NONE) return [];
  return FX_EFFECTS.filter((effect) => value.split(",").includes(effect));
}

export function parseFxLabOptions(search: string): FxLabOptions {
  const params = new URLSearchParams(search);
  const zoom = Number(params.get("fxZoom"));
  return {
    effects: parseFxEffects(params.get("fx")),
    mood: params.get("fxMood") === "night" ? "night" : "day",
    zoom: Number.isFinite(zoom) && zoom >= 0.5 && zoom <= 2.5 ? zoom : 1,
    renderer: params.get("fxRenderer") === "canvas" ? "canvas" : "auto",
    perf: params.get("fxPerf") === "1",
  };
}

/** Etiquetas legibles para la UI de QA y para el manifiesto de evidencia. */
export const FX_LABELS: Record<FxEffect, string> = {
  grading: "Color grading",
  bloomThreshold: "Bloom por umbral (cámara)",
  bloomObjects: "Bloom por objeto (emisivos)",
  lighting: "Luz dinámica puntual",
  lightingNormals: "Normal maps en fachadas",
  particles: "Partículas de estado",
  fire: "Incendio animado (foco + humo + brasas)",
};

/** Métricas de frame que produce la escena cuando `fxPerf=1`. */
export type FxFrameStats = {
  fps: number;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  frameTimeMeanMs: number;
  samples: number;
  drawCalls: number | null;
  texturesLive: number | null;
  /** Texturas WebGL conocidas por el renderer: aproximación razonable de la memoria residente. */
  gpuTextureBytes: number | null;
};

export type FxLabProbe = {
  ready: boolean;
  rendererType: "webgl" | "canvas" | "unknown";
  effects: FxEffect[];
  mood: FxMood;
  zoom: number;
  emissiveObjects: number;
  litObjects: number;
  lights: number;
  particlesAlive: number;
  sceneObjects: number;
  capabilities: {
    filters: boolean;
    lighting: boolean;
    particles: boolean;
    api: Record<string, boolean>;
  };
  stats: FxFrameStats | null;
  errors: string[];
};

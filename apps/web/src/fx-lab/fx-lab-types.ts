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
  /** Preset pedido por URL (`?fxPreset=night_fire`); `null` si la URL no menciona ninguno. */
  readonly preset: FxPreset | null;
};

/** Cadena canónica de efectos activos: vacía ⇒ ninguno (estado por defecto del laboratorio). */
export const FX_NONE = "";

export function isFxEffect(value: string): value is FxEffect {
  return (FX_EFFECTS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------------ presets */

/**
 * D-111.2 §5.1 — los presets son CONFIGURACIONES, no combinaciones manuales de toggles.
 *
 * Ninguno lleva `bloomThreshold`: el umbral de cámara se midió (§7.2) y pesa sobre toda la fachada,
 * no sólo sobre lo emisivo, así que no es recomendable como acabado de calle. El bloom de los
 * presets es siempre por objeto.
 */
export const FX_PRESETS = ["day_balanced", "night_balanced", "night_fire"] as const;

export type FxPreset = (typeof FX_PRESETS)[number];

export type FxPresetConfig = {
  readonly label: string;
  readonly mood: FxMood;
  readonly effects: readonly FxEffect[];
  /** Qué exige el encargo que haga este preset, en una línea, para poder auditarlo sin leer código. */
  readonly nota: string;
};

export const FX_PRESET_TABLE: Record<FxPreset, FxPresetConfig> = {
  day_balanced: {
    label: "Día equilibrado",
    mood: "day",
    /** De día la luz dinámica casi no resta: ambiente casi blanco y grading suave, sin viñeta dura. */
    effects: ["grading", "lighting", "bloomObjects", "particles"],
    nota: "exposición equilibrada sobre el bake diurno, sin sumar halos que no hacen falta",
  },
  night_balanced: {
    label: "Noche equilibrada",
    mood: "night",
    /**
     * Los cinco requisitos de §5.1: ambiente suficiente (rig de luz con `0x…` levantado), farolas
     * cálidas, bloom suave por objeto, partículas cuando el estado lo justifica y relieve en
     * fachada para que el paño no sea un plano de color.
     */
    effects: ["grading", "lighting", "lightingNormals", "bloomObjects", "particles"],
    nota: "farolas cálidas + relieve + bloom por objeto; sin bloom por umbral",
  },
  night_fire: {
    label: "Noche con incendio",
    mood: "night",
    /** Añade al nocturno la llama animada, su humo y su luz localizada (§4.5). */
    effects: ["grading", "lighting", "lightingNormals", "bloomObjects", "particles", "fire"],
    nota: "night_balanced + incendio animado con iluminación localizada",
  },
};

export function isFxPreset(value: string): value is FxPreset {
  return (FX_PRESETS as readonly string[]).includes(value);
}

export function parseFxEffects(value: string | null): FxEffect[] {
  if (!value || value === FX_NONE) return [];
  return FX_EFFECTS.filter((effect) => value.split(",").includes(effect));
}

export function parseFxLabOptions(search: string): FxLabOptions {
  const params = new URLSearchParams(search);
  const zoom = Number(params.get("fxZoom"));
  const presetParam = params.get("fxPreset");
  const preset = presetParam && isFxPreset(presetParam) ? presetParam : null;
  const requested = parseFxEffects(params.get("fx"));
  /**
   * `fx=` explícito gana al preset: la batería de captura necesita encender familias sueltas sobre la
   * misma tabla de presets, y si el preset atropellara al parámetro esa batería sería imposible.
   */
  return {
    effects: requested.length ? requested : preset ? [...FX_PRESET_TABLE[preset].effects] : [],
    mood:
      params.get("fxMood") === "night" ? "night" : preset ? FX_PRESET_TABLE[preset].mood : "day",
    zoom: Number.isFinite(zoom) && zoom >= 0.5 && zoom <= 2.5 ? zoom : 1,
    renderer: params.get("fxRenderer") === "canvas" ? "canvas" : "auto",
    perf: params.get("fxPerf") === "1",
    preset,
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

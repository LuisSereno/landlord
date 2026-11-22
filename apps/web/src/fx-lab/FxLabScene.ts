/**
 * FxLabScene — escena técnica de QA para D-111 §7.
 *
 * Una sola calle isométrica, idéntica con los efectos encendidos y apagados, para poder atribuir
 * cada diferencia visual al efecto y no a la composición. No consulta GameState ni la proyección del
 * juego: los cuatro estados que se ven son colocaciones fijas de la propia escena.
 */
import Phaser from "phaser";
import type { BuildingAssetState } from "@landlord/shared";
import {
  BUSH_CELLS,
  BUILDING_PLACEMENTS,
  DAY_PALETTE,
  EMISSIVE_DEPTH_OFFSET,
  LAMP_CELLS,
  NIGHT_PALETTE,
  REFERENCE_LAYOUT,
  TREE_CELLS,
  WORK_CELLS,
  buildingMetadata,
  buildingSrc,
  gridToScreen,
  paintGround,
  placeScenery,
  propSrc,
  textureKeyForBuilding,
  type StreetPalette,
} from "./fx-street";
import {
  applyGrading,
  applyLighting,
  applyObjectBloom,
  applyThresholdBloom,
  attachNormalMaps,
  buildEmissiveTexture,
  isWebGL,
  probeFxCapabilities,
  textureSize,
  type Disposer,
  type EmissiveOverlay,
  type LampAnchor,
  type LightRig,
} from "./fx-effects";
import {
  aliveParticleCount,
  createEmitters,
  destroyEmitters,
  setEmittersActive,
  type Emitter,
} from "./fx-particles";
import { createFireRig, type FireRig, type FireStats } from "./fx-fire";
import {
  clearFireAnchorCache,
  fireAnchorsFor,
  type FireAnchorMetadata,
  type FireFocus,
} from "./fx-fire-anchors";
import { candidateFireMetadata, type CandidateQaMetadata } from "./fx-candidate-qa";
import { makeSoftDisc } from "./fx-textures";
import { buildNormalMapFromSprite, makeFlatNormal } from "./fx-normal-map";
import { depthForAsset, footprintCenter, spriteScaleFor } from "../isometric/building-sprites";
import {
  FX_EFFECTS,
  FX_PRESET_TABLE,
  type FxEffect,
  type FxFrameStats,
  type FxMood,
  type FxPreset,
} from "./fx-lab-types";

const FRAME_WINDOW = 180;
const LAMP_GLOW_TEXTURE = "fx-tex-lamp-glow";
/** Escala de farolas y vegetación: el pack está densificado y la calle de QA se mira de cerca. */
const SCENERY_BOOST = 2.1;
/** De día la calle la sostiene el bake: la capa emisiva sólo insinúa. */
const DAY_EMISSIVE_ALPHA = 0.08;
/**
 * §5.2 — emisión nocturna por fuente. La ventana es un rectángulo de pocos píxeles y a 0,62 sigue
 * leyéndose como foco encendido sin quemarse; el disco de farola ocupa ~100 px en ADD y por eso baja
 * más; la capa cálida del edificio ardiendo es precisamente el estado que hay que reconocer.
 *
 * La farola sube de 0,5 a 0,7 al retirar el `PointLight` del rig: el disco horneado pasa a ser la
 * única fuente de calidez visible del poste y es la que escala sin recortar a blanco (medido: con el
 * halo el filamento llegaba a (255,255,255); con sólo este disco queda en ámbar).
 *
 * §5.2 (hoja `phaser_fx_v2_sheet.png` del 21-11): con 0,7 el disco del cabezal seguía leyendo como
 * BOLA FLUTANTE —un círculo de ~100 px en ADD cuyo núcleo recorta— mientras la calzada seguía oscura.
 * El halo baja a 0,5 y la luz se reparte en una charca aplastada sobre el pavimento (`lampPool`), que
 * es lo que el encargo pide al hablar de «radios de luz» y de «calles demasiado oscuras».
 */
const NIGHT_EMISSIVE_ALPHA: Record<EmissiveOverlay["kind"], number> = {
  window: 0.62,
  lamp: 0.5,
  /** ~190×60 px de disco: al repartir la misma energía sobre área, el centro no recorta. */
  lampPool: 0.34,
  fire: 0.85,
  /** Lo manda el rig de fuego fotograma a fotograma; este valor no se usa. */
  fireGlow: 1,
};
/**
 * Semilla de PRESENTACIÓN del incendio. Es fija para que la hoja de animación sea repetible; no
 * entra en la simulación, en el save ni en GameState (FASE 4.3 lo permite explícitamente).
 */
const FIRE_PRESENTATION_SEED = 20_261_121;

type EffectHandles = {
  dispose: Disposer;
  /** Sólo bloom por objeto: cuántos emisivos quedaron efectivamente filtrados. */
  count?: number;
};

type BuildingEntry = {
  key: string;
  type: string;
  state: BuildingAssetState;
  sprite: Phaser.GameObjects.Image;
  emissive: Phaser.GameObjects.Image | null;
  boost: number;
  /** Pivote con el que se colocó: el del catálogo, o el publicado por la candidata QA. */
  pivot: { x: number; y: number };
  /** Focos de la metadata del asset; `null` = derivar de la silueta como siempre. */
  fireMetadata: FireAnchorMetadata[] | null;
  /** `true` cuando el sprite ya hornea su columna de humo y el rig no debe soltar otra. */
  smokeFromSprite: boolean;
};

export type FxLabSceneOptions = {
  effects: FxEffect[];
  mood: FxMood;
  zoom: number;
  perf: boolean;
  /** El preset con el que se montó (o se pidió) la escena; `null` si es una combinación suelta. */
  preset: FxPreset | null;
  /** D-111.2 cierre: candidata QA resuelta por el panel; `null` = calle del catálogo. */
  candidate: {
    metadata: CandidateQaMetadata;
    pngUrl: string;
    textureKey: string;
  } | null;
};

export type FxLabProbeData = {
  effects: FxEffect[];
  /** Qué preset está puesto de verdad: si un toggle se movió a mano, la sonda dice `null`. */
  preset: FxPreset | null;
  /** La escena no es interpretable sin saber con qué se montó: el arnés de captura cambia mood y
   *  zoom por URL y necesita verificar que el cambio llegó al juego, no sólo al React state. */
  mood: FxMood;
  zoom: number;
  /** La calle existe (los edificios están construidos) aunque aún no haya 8 muestras de perf. */
  ready: boolean;
  /** Frames del bucle desde el montaje: dos lecturas con el mismo número = renderer congelado. */
  frames: number;
  /** Reloj de Phaser en ms: la envolvente del fuego depende de este número, no del de `frames`. */
  clockMs: number;
  emissive: number;
  litObjects: number;
  lights: number;
  particles: number;
  /** Las cinco familias del incendio (FASE 4.1), contadas por separado. */
  fire: FireStats | null;
  fireActive: boolean;
  /** Dónde ancló el fuego: sin estos números la evidencia no puede decir si el foco cayó en la cubierta. */
  fireAnchors: { kind: string; x: number; y: number; flameWorldPx: number }[];
  sceneObjects: number;
  /** Colocaciones sin sprite montado: una calle vacía no puede pasar por evidencia. */
  missingPlacements: string[];
  /** D-111.2 cierre: qué candidata QA está realmente colocada; `null` = calle del catálogo. */
  candidate: {
    candidateId: string;
    compositionSignature: string;
    textureKey: string;
    fireAnchors: number;
    smokeFromSprite: boolean;
    /** Los u,v que el adaptador entregó a `fireAnchorsFor`: la salida que valida el checker. */
    anchorsUv: { u: number; v: number; flameFraction: number; kind: string }[];
  } | null;
  webgl: boolean;
  /** `false` = el `__NORMAL` de Phaser no llegó al GL y el rig necesita su propia normal plana. */
  defaultNormalTexture: boolean;
  capabilities: Record<string, boolean>;
  stats: FxFrameStats | null;
  errors: string[];
};

function percentile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

export class FxLabScene extends Phaser.Scene {
  private readonly options: FxLabSceneOptions;
  private readonly handles = new Map<FxEffect, EffectHandles>();
  private readonly errorLog: string[] = [];
  private buildings: BuildingEntry[] = [];
  private missingPlacements: string[] = [];
  private overlays: EmissiveOverlay[] = [];
  private lamps: LampAnchor[] = [];
  private ground: Phaser.GameObjects.Graphics | null = null;
  private emitters: Emitter[] = [];
  private fire: FireRig | null = null;
  private fireFoci: FireFocus[] = [];
  private normalMaps: { textureKey: string; normal: HTMLCanvasElement }[] = [];
  private flatNormals = new Map<string, HTMLCanvasElement>();
  private rig: LightRig | null = null;
  private capabilities: Record<string, boolean> | null = null;
  private frameTimes: number[] = [];
  /** Contador monótono del bucle: es la prueba de vida del renderer entre dos capturas. */
  private frames = 0;
  private reportAccumulator = 0;
  private fps = 0;
  private ready = false;
  /**
   * `create()` ocurre en un tick posterior al de `new Phaser.Game(...)`, y React aplica el mood, el
   * zoom y los toggles de la URL en sus efectos del primer commit: sin este flag esas llamadas
   * tocarían `cameras.main` cuando todavía no existe. Antes del arranque sólo registran estado en
   * `options`, que es precisamente lo que `create()` lee, así que el primer fotograma ya sale con
   * lo pedido.
   */
  private booted = false;
  /** `applyPreset()` apaga y enciende por dentro: esos `applyEffect` no deben borrar el preset. */
  private applyingPreset = false;

  constructor(options: FxLabSceneOptions) {
    super("fx-lab");
    this.options = options;
  }

  preload(): void {
    for (const placement of BUILDING_PLACEMENTS) {
      const src = buildingSrc(placement.type, placement.state);
      if (src) this.load.image(textureKeyForBuilding(placement.type, placement.state), src);
    }
    if (this.options.candidate) {
      this.load.image(this.options.candidate.textureKey, this.options.candidate.pngUrl);
    }
    const props = new Set<string>(["prp_street_light", "prp_bush", "prp_bollard"]);
    for (const tree of TREE_CELLS) props.add(tree.type);
    for (const work of WORK_CELLS) props.add(work.type);
    for (const id of props) {
      const src = propSrc(id);
      if (src) this.load.image(`fx-${id}`, src);
    }
  }

  create(): void {
    this.booted = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.cameras.main.setBackgroundColor(this.options.mood === "night" ? "#141a26" : "#2b3542");
    this.makeLampGlowTexture();
    this.ground = paintGround(this, this.palette());
    this.placeBuildings();
    this.placeFireRigs();
    this.placeSceneryRow();
    this.placeEmitters();
    this.cameras.main.centerOn(528, 288);
    this.cameras.main.setZoom(this.options.zoom);

    /**
     * Efectos APAGADOS por defecto: sólo se monta lo que la URL o el panel pidan explícitamente.
     * `applyingPreset` protege el arranque: estos no son toggles manuales. Y si la combinación que
     * queda en pantalla no es la de la tabla (URL con `fx=` y `fxPreset=` a la vez) el preset se
     * descuelga: la sonda no puede decir que está puesto lo que no está puesto.
     */
    this.applyingPreset = true;
    for (const effect of this.options.effects) this.applyEffect(effect, true);
    this.applyingPreset = false;
    if (this.options.preset && !this.matchesPreset(this.options.preset)) this.options.preset = null;
    this.syncEmissiveVisibility();
    this.ready = true;
  }

  /**
   * Si lo que hay montado coincide con la tabla del preset, mood incluido. Se compara como CONJUNTO:
   * `activeEffects` sale en el orden canónico de `FX_EFFECTS` y la tabla lo da en el orden en que hay
   * que montar las cosas (`lighting` antes que `lightingNormals`, que lo pide prestado), así que una
   * comparación de cadenas diría que un preset puesto a mano no coincide consigo mismo.
   */
  private matchesPreset(preset: FxPreset): boolean {
    const config = FX_PRESET_TABLE[preset];
    if (this.options.mood !== config.mood) return false;
    const active = new Set(this.activeEffects);
    return (
      active.size === new Set(config.effects).size &&
      FX_EFFECTS.every((effect) => active.has(effect) === config.effects.includes(effect))
    );
  }

  override update(time: number, delta: number): void {
    this.frames += 1;
    /**
     * El fuego se anima por frame, no por partícula: Phaser 4.2.1 no trae `Oscillator` en emisores
     * (0 apariciones en sus tipos), así que la única vía de mover el cuerpo de la llama es la escena.
     * `time` es reloj de presentación —la simulación autoritativa no lo ve— y la semilla del rig es
     * fija, de modo que dos corridas con el mismo `time` base dan la misma coreografía.
     */
    if (this.fireActive) this.fire?.update(time);
    if (!this.options.perf) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length > FRAME_WINDOW) this.frameTimes.shift();
    this.reportAccumulator += delta;
    if (this.reportAccumulator < 500) return;
    const total = this.frameTimes.reduce((a, b) => a + b, 0);
    this.fps = total > 0 ? Math.round((this.frameTimes.length * 1000) / total) : 0;
    this.reportAccumulator = 0;
  }

  /* ------------------------------------------------------------------ API pública */

  get isReady(): boolean {
    return this.ready;
  }

  get activeEffects(): FxEffect[] {
    return FX_EFFECTS.filter((effect) => this.handles.has(effect));
  }

  /** El incendio es opt-in como cualquier otra familia: fuera del toggle, el rig está montado y quieto. */
  private get fireActive(): boolean {
    return this.handles.has("fire");
  }

  /**
   * §5.1 — aplicar un preset es una configuración, no una macro de clicks: fija el mood, apaga todo
   * lo que el preset no menciona y enciende lo suyo en el orden de la tabla. Si alguien mueve un
   * toggle a mano después, el preset deja de ser el que se está viendo y la sonda lo dice.
   */
  applyPreset(preset: FxPreset): void {
    const config = FX_PRESET_TABLE[preset];
    this.applyingPreset = true;
    this.options.preset = preset;
    if (!this.booted) {
      this.options.mood = config.mood;
      this.options.effects = [...config.effects];
      this.applyingPreset = false;
      return;
    }
    this.setMood(config.mood);
    for (const effect of FX_EFFECTS) this.applyEffect(effect, false);
    for (const effect of config.effects) this.applyEffect(effect, true);
    this.applyingPreset = false;
  }

  /** Enciende o apaga UNA familia sin tocar las demás: es el requisito de toggles independientes. */
  applyEffect(effect: FxEffect, on: boolean): void {
    if (!this.booted) {
      this.rememberEffect(effect, on);
      return;
    }
    /** Un toggle manual rompe la identidad del preset: la sonda tiene que decir lo que hay, no lo que se pidió. */
    if (!this.applyingPreset) this.options.preset = null;
    if (on) {
      if (this.handles.has(effect)) return;
      this.handles.set(effect, this.buildEffect(effect));
      return;
    }
    const handle = this.handles.get(effect);
    if (!handle) return;
    // Se retira ANTES de desmontar: el disposer de `lightingNormals` apaga el rig que pidió y no
    // debe volver a entrar por esta misma puerta.
    this.handles.delete(effect);
    if (effect === "lighting" && this.handles.has("lightingNormals")) {
      this.applyEffect("lightingNormals", false);
    }
    try {
      handle.dispose();
    } catch (error) {
      this.errorLog.push(`${effect} dispose: ${String(error)}`);
    }
  }

  setMood(mood: FxMood): void {
    this.options.mood = mood;
    if (!this.booted) return;
    /**
     * Mover el mood a mano también rompe el preset: la tabla fija el suyo. Se comprueba sólo con la
     * escena arrancada porque antes de `create()` los efectos viven en `options.effects` y no en los
     * handles, así que comparar contra la tabla daría falso justo en el arranque desde URL.
     */
    if (!this.applyingPreset && this.options.preset && !this.matchesPreset(this.options.preset)) {
      this.options.preset = null;
    }
    this.cameras.main.setBackgroundColor(mood === "night" ? "#141a26" : "#2b3542");
    this.ground?.destroy();
    this.ground = paintGround(this, this.palette());
    this.syncEmissiveVisibility();
    /**
     * La luz dinámica y el grading dependen del mood (ambiente, intensidad, curva y viñeta): se
     * reconstruyen si estaban activos. El re-montaje va dentro de `rebuildInternal` porque cada
     * `applyEffect` de estos dos bloques es suyo, no del usuario: si se leyera como un toggle manual,
     * aplicar un preset nocturno borraría su propia identidad en cuanto React replicara el mood en la
     * escena — que es exactamente lo que medía la sonda el 2026-11-21 con `night_balanced: null`.
     */
    this.rebuildInternal(() => {
      if (this.handles.has("lighting")) {
        const withNormals = this.handles.has("lightingNormals");
        this.applyEffect("lighting", false);
        this.applyEffect("lighting", true);
        if (withNormals) this.applyEffect("lightingNormals", true);
      }
      if (this.handles.has("grading")) {
        this.applyEffect("grading", false);
        this.applyEffect("grading", true);
      }
    });
    /** El halo y la luz del fuego dependen del mood: se rehace el rig conservando el toggle. */
    if (this.fire) this.placeFireRigs();
  }

  /** Ejecuta un re-montaje interno sin que la escena lo confunda con un cambio manual de efectos. */
  private rebuildInternal(action: () => void): void {
    const before = this.applyingPreset;
    this.applyingPreset = true;
    try {
      action();
    } finally {
      this.applyingPreset = before;
    }
  }

  setZoom(zoom: number): void {
    this.options.zoom = zoom;
    if (!this.booted) return;
    this.cameras.main.setZoom(zoom);
  }

  /** Antes de `create()` un toggle no puede montar nada: se anota y `create()` lo aplicará. */
  private rememberEffect(effect: FxEffect, on: boolean): void {
    if (!this.applyingPreset) this.options.preset = null;
    const next = new Set<FxEffect>(this.options.effects);
    if (on) next.add(effect);
    else next.delete(effect);
    this.options.effects = FX_EFFECTS.filter((item) => next.has(item));
  }

  getProbe(): FxLabProbeData {
    const renderer = this.game.renderer as Partial<Phaser.Renderer.WebGL.WebGLRenderer> & {
      drawCount?: number;
      normalTexture?: unknown;
    };
    let bytes = 0;
    let texturesLive = 0;
    for (const key of this.textures.getTextureKeys()) {
      const source = this.textures.get(key).source[0];
      if (!source) continue;
      bytes += source.width * source.height * 4;
      texturesLive += 1;
    }
    return {
      effects: this.activeEffects,
      preset: this.options.preset,
      mood: this.options.mood,
      zoom: this.cameras.main.zoom,
      ready: this.buildings.length > 0,
      frames: this.frames,
      clockMs: Math.round(this.time.now),
      emissive: this.overlays.length,
      litObjects: this.rig?.litObjects ?? 0,
      lights: this.rig?.lights ?? 0,
      particles: aliveParticleCount(this.emitters),
      fire: this.fire?.stats() ?? null,
      fireActive: this.fireActive,
      fireAnchors: this.fireFoci.map((focus) => ({
        kind: focus.kind,
        x: Math.round(focus.x),
        y: Math.round(focus.y),
        flameWorldPx: Math.round(focus.flameWorldPx * 100) / 100,
      })),
      sceneObjects: this.children.list.length,
      missingPlacements: [...this.missingPlacements],
      candidate: (() => {
        const candidate = this.options.candidate;
        if (!candidate) return null;
        const placed = this.buildings.find((entry) => entry.key === candidate.textureKey);
        if (!placed) return null;
        return {
          candidateId: candidate.metadata.candidateId,
          compositionSignature: candidate.metadata.compositionSignature,
          textureKey: candidate.textureKey,
          fireAnchors: placed.fireMetadata?.length ?? 0,
          smokeFromSprite: placed.smokeFromSprite,
          anchorsUv: (placed.fireMetadata ?? []).map((anchor) => ({
            u: Math.round(anchor.u * 1e5) / 1e5,
            v: Math.round(anchor.v * 1e5) / 1e5,
            flameFraction: Math.round((anchor.flameFraction ?? 0) * 1e5) / 1e5,
            kind: anchor.kind ?? "roof",
          })),
        };
      })(),
      webgl: isWebGL(this),
      /** `false` aquí explica por qué el rig necesita su propia normal plana: ver `case "lighting"`. */
      defaultNormalTexture: Boolean(renderer.normalTexture),
      capabilities: probeFxCapabilities(this),
      stats: this.stats(bytes, texturesLive, renderer.drawCount ?? null),
      errors: [...this.errorLog],
    };
  }

  /* ---------------------------------------------------------------------- internos */

  private palette(): StreetPalette {
    return this.options.mood === "night" ? NIGHT_PALETTE : DAY_PALETTE;
  }

  private stats(
    gpuTextureBytes: number,
    texturesLive: number,
    drawCalls: number | null,
  ): FxFrameStats | null {
    if (!this.options.perf || this.frameTimes.length < 8) return null;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return {
      fps: this.fps,
      frameTimeP50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
      frameTimeP95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
      frameTimeMeanMs: Number(mean.toFixed(2)),
      samples: sorted.length,
      drawCalls,
      texturesLive,
      gpuTextureBytes,
    };
  }

  private buildEffect(effect: FxEffect): EffectHandles {
    const noop: Disposer = () => undefined;
    try {
      switch (effect) {
        case "grading": {
          const result = applyGrading(this, this.options.mood);
          return result ? { dispose: result.dispose } : { dispose: noop };
        }
        case "bloomThreshold": {
          const result = applyThresholdBloom(this);
          return result ? { dispose: result.dispose } : { dispose: noop };
        }
        case "bloomObjects": {
          const result = applyObjectBloom(this, this.overlays);
          return result ? { dispose: result.dispose, count: result.bloomed } : { dispose: noop };
        }
        case "lighting": {
          const facades: Phaser.GameObjects.Image[] = this.buildings.map((entry) => entry.sprite);
          const rig = applyLighting(this, this.options.mood, facades, this.lamps);
          if (!rig) return { dispose: noop };
          this.rig = rig;
          /** La luz cálida de proximidad del incendio sólo existe sobre fachadas iluminadas. */
          this.fire?.setLights(true);
          /**
           * El rig se monta con normal PLANA del tamaño de cada fachada. Dos motivos medidos: el
           * fallback `__NORMAL` de Phaser es un pixel de 1×1, así que comparar «sin normales» contra
           * el mapa derivado cambiaría a la vez el filtro y el relieve; y encender `lightingNormals`
           * después no podría atribuirse al relieve si el estado anterior no ocupaba el mismo slot.
           * NO se ilumina el suelo: es un `Graphics`, su `dataSource` no tiene `glTexture` y el
           * batcher de quads revienta en `batchTextures` congelando el fotograma (medido 2026-11-20).
           */
          const flat = attachNormalMaps(this, this.flatNormalEntries());
          return {
            dispose: () => {
              /** Primero el fuego: su luz vive dentro del `LightsManager` que `rig.dispose()` apaga. */
              this.fire?.setLights(false);
              flat();
              rig.dispose();
              this.rig = null;
            },
          };
        }
        case "lightingNormals": {
          this.ensureNormalMaps();
          if (!this.normalMaps.length) return { dispose: noop };
          /**
           * Las normales sólo se ven sobre un objeto iluminado, así que el caso monta el rig si no
           * está: el A/B con/sin relieve compara lo mismo. Si el rig lo pidió este caso, se lo lleva
           * al apagar; si ya estaba encendido, se queda.
           */
          const borrowed = !this.handles.has("lighting");
          if (borrowed) this.applyEffect("lighting", true);
          if (!this.rig) return { dispose: noop };
          const restore = attachNormalMaps(this, this.normalMaps);
          return {
            dispose: () => {
              restore();
              if (borrowed) this.applyEffect("lighting", false);
            },
          };
        }
        case "particles": {
          setEmittersActive(this.emitters, true);
          return { dispose: () => setEmittersActive(this.emitters, false) };
        }
        case "fire": {
          if (!this.fire) return { dispose: noop };
          this.fire.setActive(true);
          /** Con el fuego encendido después del bloom, el halo entra en la lista del pase difuso. */
          if (this.handles.has("bloomObjects")) this.remount("bloomObjects");
          return {
            dispose: () => {
              this.fire?.setActive(false);
              this.fire?.setLights(false);
            },
          };
        }
      }
    } catch (error) {
      this.errorLog.push(`${effect}: ${String(error)}`);
      return { dispose: noop };
    }
  }

  /** Volver a montar un efecto para que recoja estado que apareció después (el halo del incendio). */
  private remount(effect: FxEffect): void {
    if (!this.handles.has(effect)) return;
    this.applyEffect(effect, false);
    this.applyEffect(effect, true);
  }

  /**
   * Normal plana por tamaño de textura: el A/B de relieve necesita que el state «sin normales» ocupe
   * el mismo slot y las mismas dimensiones que el mapa derivado.
   */
  private flatNormalEntries(): { textureKey: string; normal: HTMLCanvasElement }[] {
    const entries: { textureKey: string; normal: HTMLCanvasElement }[] = [];
    for (const textureKey of new Set(this.buildings.map((entry) => entry.sprite.texture.key))) {
      const measured = textureSize(this, textureKey);
      if (!measured) continue;
      const size = `${measured.width}x${measured.height}`;
      let flat = this.flatNormals.get(size);
      if (!flat) {
        flat = makeFlatNormal(measured.width, measured.height);
        this.flatNormals.set(size, flat);
      }
      entries.push({ textureKey, normal: flat });
    }
    return entries;
  }

  /**
   * Los mapas de normales se derivan EN MEMORIA del bake ya existente. No se escribe ningún `_n.png`
   * ni se regenera el catálogo: el experimento vive sólo en el ciclo de vida de la escena.
   */
  private ensureNormalMaps(): void {
    if (this.normalMaps.length || !isWebGL(this)) return;
    for (const entry of this.buildings) {
      const measured = textureSize(this, entry.sprite.texture.key);
      if (!measured) continue;
      this.normalMaps.push({
        textureKey: entry.sprite.texture.key,
        normal: buildNormalMapFromSprite(measured.source, measured.width, measured.height, 2.2),
      });
    }
  }

  private makeLampGlowTexture(): void {
    if (this.textures.exists(LAMP_GLOW_TEXTURE)) return;
    this.textures.addCanvas(
      LAMP_GLOW_TEXTURE,
      makeSoftDisc(96, "rgba(255,206,140,0.7)", "rgba(255,150,60,0)"),
    );
  }

  private placeBuildings(): void {
    /**
     * D-111.2 cierre: con candidata QA activa, el hueco de `front-burning` lo ocupa el sprite del
     * compositor —el catálogo normal queda intacto y el estado `burning` del hueco es el que el rig
     * de fuego ya sabe encender. La escala sale del mismo `spriteScaleFor` del catálogo, con los
     * px/m que publica la candidata, así que ocupa sus celdas de huella reales.
     */
    const candidate = this.options.candidate;
    const candidateReady = candidate !== null && this.textures.exists(candidate.textureKey);
    for (const placement of BUILDING_PLACEMENTS) {
      if (candidate && placement.key === "front-burning") {
        if (candidateReady) {
          this.placeCandidate(candidate);
        } else {
          this.missingPlacements.push(`candidate:${candidate.metadata.candidateId}`);
        }
        continue;
      }
      const key = textureKeyForBuilding(placement.type, placement.state);
      const asset = buildingMetadata(placement.type);
      if (!this.textures.exists(key) || !asset) {
        this.missingPlacements.push(`${placement.key}:${placement.type}/${placement.state}`);
        continue;
      }
      const center = gridToScreen(
        footprintCenter(placement.cell, asset.footprint),
        REFERENCE_LAYOUT,
      );
      const sprite = this.add.image(center.x, center.y, key);
      sprite.setOrigin(asset.pivot.x, asset.pivot.y);
      sprite.setScale(asset.scale * placement.scale);
      sprite.setDepth(depthForAsset(placement.cell, asset.footprint));

      let emissive: Phaser.GameObjects.Image | null = null;
      if (placement.emissiveBoost > 0) {
        /**
         * `burning` exige matiz cálido (el asset no trae fuego horneado, y sin filtro de matiz un
         * resaltado de alféizar leía como incendio) pero NO un umbral más bajo: con 0,55 la cubierta
         * entera del bake pasaba la filtro y la capa ADD pintaba de blanco el tejado. La luz del
         * fuego la pone el rig de `fx-fire.ts`; la capa emisiva sigue siendo sólo lo que ya brillaba.
         */
        const built = buildEmissiveTexture(
          this,
          key,
          `${key}-emissive`,
          0.72,
          placement.state === "burning",
        );
        if (built?.key) {
          emissive = this.add.image(center.x, center.y, built.key);
          emissive.setOrigin(asset.pivot.x, asset.pivot.y);
          emissive.setScale(asset.scale * placement.scale);
          emissive.setDepth(sprite.depth + EMISSIVE_DEPTH_OFFSET);
          emissive.setBlendMode(Phaser.BlendModes.ADD);
          this.overlays.push({
            image: emissive,
            kind: placement.state === "burning" ? "fire" : "window",
          });
        }
      }
      this.buildings.push({
        key,
        type: placement.type,
        state: placement.state,
        sprite,
        emissive,
        boost: placement.emissiveBoost,
        pivot: { x: asset.pivot.x, y: asset.pivot.y },
        fireMetadata: null,
        smokeFromSprite: false,
      });
    }
  }

  /**
   * La candidata QA se coloca con SUS números publicados: pivote, huella y px/m del JSON del
   * compositor. Sin capa emisiva derivada —el sprite ya trae su fuego horneado y un ADD sobre él
   * recortaría a blanco justo donde el encargo prohibe zonas quemadas.
   */
  private placeCandidate(candidate: NonNullable<FxLabSceneOptions["candidate"]>): void {
    const meta = candidate.metadata;
    const asset = {
      footprint: { width: meta.footprintCells.width, height: meta.footprintCells.height },
      pivot: { x: meta.pivot.x, y: meta.pivot.y },
      scale: spriteScaleFor(
        { pixelsPerMeter: meta.framing.pixelsPerMeter },
        REFERENCE_LAYOUT.tileWidth,
      ),
    };
    const cell = { x: 8, y: 9 };
    const center = gridToScreen(footprintCenter(cell, asset.footprint), REFERENCE_LAYOUT);
    const sprite = this.add.image(center.x, center.y, candidate.textureKey);
    sprite.setOrigin(asset.pivot.x, asset.pivot.y);
    sprite.setScale(asset.scale);
    sprite.setDepth(depthForAsset(cell, asset.footprint));
    this.buildings.push({
      key: candidate.textureKey,
      type: `${meta.buildingType} (candidata ${meta.candidateId})`,
      state: "burning",
      sprite,
      emissive: null,
      boost: 0,
      pivot: { ...asset.pivot },
      fireMetadata: candidateFireMetadata(meta),
      smokeFromSprite: true,
    });
  }

  private placeSceneryRow(): void {
    for (const cell of LAMP_CELLS) {
      const lamp = placeScenery(
        this,
        REFERENCE_LAYOUT,
        "fx-prp_street_light",
        cell,
        20,
        SCENERY_BOOST,
      );
      if (!lamp) continue;
      /** El cabezal se deduce del propio sprite: pivot declaresuelo + alto visible, sin hardcodear px. */
      const headY = lamp.y - lamp.displayHeight * lamp.originY + 8;
      this.lamps.push({ x: lamp.x, y: headY, depth: lamp.depth });
      const glow = this.add.image(lamp.x, headY, LAMP_GLOW_TEXTURE);
      glow.setScale(1.05);
      glow.setDepth(lamp.depth + EMISSIVE_DEPTH_OFFSET);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.overlays.push({ image: glow, kind: "lamp" });
      /**
       * Charca de luz sobre el pavimento: el mismo disco, aplastado y centrado en la línea de tierra
       * del poste. Sin ella la calidez de la farola vive sólo en el aire y la calzada sigue oscura.
       */
      const pool = this.add.image(lamp.x, lamp.y, LAMP_GLOW_TEXTURE);
      pool.setScale(1.7, 0.55);
      pool.setDepth(lamp.depth - 1);
      pool.setBlendMode(Phaser.BlendModes.ADD);
      this.overlays.push({ image: pool, kind: "lampPool" });
    }
    for (const tree of TREE_CELLS) {
      placeScenery(this, REFERENCE_LAYOUT, `fx-${tree.type}`, tree.cell, 10, SCENERY_BOOST);
    }
    for (const cell of BUSH_CELLS) {
      placeScenery(this, REFERENCE_LAYOUT, "fx-prp_bush", cell, 10, SCENERY_BOOST);
    }
    for (const work of WORK_CELLS) {
      placeScenery(this, REFERENCE_LAYOUT, `fx-${work.type}`, work.cell, 10, SCENERY_BOOST);
    }
    for (const x of [0, 5, 10]) {
      placeScenery(this, REFERENCE_LAYOUT, "fx-prp_bollard", { x, y: 8 }, 8, SCENERY_BOOST);
    }
  }

  /**
   * Los anclajes salen de los estados YA existentes en el catálogo (`construction`) y de la planta de
   * producción; no se inventa ningún estado nuevo de dominio. El `burning` se fue a `placeFireRigs()`.
   */
  private placeEmitters(): void {
    const anchors: Record<string, { x: number; y: number; scale: number }[]> = {
      "industrial-smoke": [],
      "construction-dust": [],
    };
    for (const entry of this.buildings) {
      const top = entry.sprite.y - entry.sprite.displayHeight * entry.sprite.originY;
      if (entry.type === "cement_plant") {
        anchors["industrial-smoke"]?.push({
          x: entry.sprite.x + entry.sprite.displayWidth * 0.12,
          y: top + 12,
          scale: 1.35,
        });
      }
      if (entry.state === "construction") {
        anchors["construction-dust"]?.push({ x: entry.sprite.x, y: entry.sprite.y - 18, scale: 1 });
      }
    }
    this.emitters = createEmitters(this, anchors);
  }

  /**
   * Los anclajes se derivan de la silueta del sprite de CADA edificio (FASE 4.4): la línea de cubierta
   * y el paño de fachada que mide ese PNG, no un desplazamiento universal. El fixture de QA es el
   * estado `burning` colocado a mano en `BUILDING_PLACEMENTS`. D-111.2 cierre: la candidata QA trae
   * `fireMetadata` — los focos que publicó el compositor en metros, llevados a u,v por el adaptador,
   * mandan sobre la silueta, y su columna de humo horneada desactiva la del rig.
   */
  private placeFireRigs(): void {
    this.fire?.dispose();
    this.overlays = this.overlays.filter((overlay) => overlay.kind !== "fireGlow");
    this.fireFoci = [];
    for (const entry of this.buildings) {
      if (entry.state !== "burning") continue;
      this.fireFoci.push(
        ...fireAnchorsFor(this, entry.sprite, entry.pivot, entry.fireMetadata ?? undefined),
      );
    }
    if (!this.fireFoci.length) {
      this.fire = null;
      return;
    }
    this.fire = createFireRig(this, this.fireFoci, {
      mood: this.options.mood,
      seed: FIRE_PRESENTATION_SEED,
      active: this.fireActive,
      smoke: !this.buildings.some((entry) => entry.smokeFromSprite),
    });
    for (const glow of this.fire.glows) this.overlays.push({ image: glow, kind: "fireGlow" });
    this.fire.setLights(this.handles.has("lighting"));
  }

  /**
   * De día la capa emisiva casi no existe; de noche es lo que sostiene la lectura de la calle.
   *
   * §5.2 — el alfa nocturno va POR TIPO de emisivo. Con un único 0,95 para todo (medido en
   * `street_night_fire.png` de la FASE 4) las ventanas salían a blanco plano y el disco de farola
   * saturaba las fachadas de su lado. La capa es mezcla ADD, así que bajarla aquí es bajar la EMISIÓN
   * de cada fuente — que es lo que pide el encargo — y no tocar la exposición global.
   */
  private syncEmissiveVisibility(): void {
    const night = this.options.mood === "night";
    for (const overlay of this.overlays) {
      /** El halo del incendio se lo apunta el rig cada frame: la escena no le toca el alfa. */
      if (overlay.kind === "fireGlow") continue;
      overlay.image.setAlpha(night ? NIGHT_EMISSIVE_ALPHA[overlay.kind] : DAY_EMISSIVE_ALPHA);
    }
  }

  /**
   * Phaser 4.2.1 no declara `shutdown()` en `Phaser.Scene` (es un evento, no un hook de clase), así
   * que el desmontaje se engancha en `create()` con `events.once('shutdown')` y queda además
   * disponible de forma explícita para el `mount`.
   */
  teardown(): void {
    for (const [, handle] of this.handles) {
      try {
        handle.dispose();
      } catch {
        /* la escena ya se está destruyendo: nada que recuperar */
      }
    }
    this.handles.clear();
    this.fire?.dispose();
    this.fire = null;
    this.fireFoci = [];
    clearFireAnchorCache();
    destroyEmitters(this.emitters);
    this.emitters = [];
  }
}

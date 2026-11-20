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
import { makeSoftDisc } from "./fx-textures";
import { buildNormalMapFromSprite, makeFlatNormal } from "./fx-normal-map";
import { depthForAsset, footprintCenter } from "../isometric/building-sprites";
import { FX_EFFECTS, type FxEffect, type FxFrameStats, type FxMood } from "./fx-lab-types";

const FRAME_WINDOW = 180;
const LAMP_GLOW_TEXTURE = "fx-tex-lamp-glow";
/** Escala de farolas y vegetación: el pack está densificado y la calle de QA se mira de cerca. */
const SCENERY_BOOST = 2.1;

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
};

export type FxLabSceneOptions = {
  effects: FxEffect[];
  mood: FxMood;
  zoom: number;
  perf: boolean;
};

export type FxLabProbeData = {
  effects: FxEffect[];
  /** La escena no es interpretable sin saber con qué se montó: el arnés de captura cambia mood y
   *  zoom por URL y necesita verificar que el cambio llegó al juego, no sólo al React state. */
  mood: FxMood;
  zoom: number;
  /** La calle existe (los edificios están construidos) aunque aún no haya 8 muestras de perf. */
  ready: boolean;
  /** Frames del bucle desde el montaje: dos lecturas con el mismo número = renderer congelado. */
  frames: number;
  emissive: number;
  litObjects: number;
  lights: number;
  particles: number;
  sceneObjects: number;
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
  private overlays: EmissiveOverlay[] = [];
  private lamps: LampAnchor[] = [];
  private ground: Phaser.GameObjects.Graphics | null = null;
  private emitters: Emitter[] = [];
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

  constructor(options: FxLabSceneOptions) {
    super("fx-lab");
    this.options = options;
  }

  preload(): void {
    for (const placement of BUILDING_PLACEMENTS) {
      const src = buildingSrc(placement.type, placement.state);
      if (src) this.load.image(textureKeyForBuilding(placement.type, placement.state), src);
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
    this.placeSceneryRow();
    this.placeEmitters();
    this.cameras.main.centerOn(528, 288);
    this.cameras.main.setZoom(this.options.zoom);

    /** Efectos APAGADOS por defecto: sólo se monta lo que la URL o el panel pidan explícitamente. */
    for (const effect of this.options.effects) this.applyEffect(effect, true);
    this.syncEmissiveVisibility();
    this.ready = true;
  }

  override update(_time: number, delta: number): void {
    this.frames += 1;
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

  /** Enciende o apaga UNA familia sin tocar las demás: es el requisito de toggles independientes. */
  applyEffect(effect: FxEffect, on: boolean): void {
    if (!this.booted) {
      this.rememberEffect(effect, on);
      return;
    }
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
    this.cameras.main.setBackgroundColor(mood === "night" ? "#141a26" : "#2b3542");
    this.ground?.destroy();
    this.ground = paintGround(this, this.palette());
    this.syncEmissiveVisibility();
    /** La luz dinámica depende del mood (ambiente e intensidad): se reconstruye si estaba activa. */
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
  }

  setZoom(zoom: number): void {
    this.options.zoom = zoom;
    if (!this.booted) return;
    this.cameras.main.setZoom(zoom);
  }

  /** Antes de `create()` un toggle no puede montar nada: se anota y `create()` lo aplicará. */
  private rememberEffect(effect: FxEffect, on: boolean): void {
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
      mood: this.options.mood,
      zoom: this.cameras.main.zoom,
      ready: this.buildings.length > 0,
      frames: this.frames,
      emissive: this.overlays.length,
      litObjects: this.rig?.litObjects ?? 0,
      lights: this.rig?.lights ?? 0,
      particles: aliveParticleCount(this.emitters),
      sceneObjects: this.children.list.length,
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
      }
    } catch (error) {
      this.errorLog.push(`${effect}: ${String(error)}`);
      return { dispose: noop };
    }
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
      makeSoftDisc(96, "rgba(255,206,140,0.95)", "rgba(255,150,60,0)"),
    );
  }

  private placeBuildings(): void {
    for (const placement of BUILDING_PLACEMENTS) {
      const key = textureKeyForBuilding(placement.type, placement.state);
      const asset = buildingMetadata(placement.type);
      if (!this.textures.exists(key) || !asset) continue;
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
        const built = buildEmissiveTexture(
          this,
          key,
          `${key}-emissive`,
          placement.state === "burning" ? 0.55 : 0.72,
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
      });
    }
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
   * Los anclajes salen de los estados YA existentes en el catálogo (`construction`, `burning`) y de
   * la planta de producción; no se inventa ningún estado nuevo de dominio.
   */
  private placeEmitters(): void {
    const anchors: Record<string, { x: number; y: number; scale: number }[]> = {
      "industrial-smoke": [],
      "construction-dust": [],
      fire: [],
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
      if (entry.state === "burning") {
        anchors.fire?.push({ x: entry.sprite.x, y: entry.sprite.y - 26, scale: 1.15 });
      }
    }
    this.emitters = createEmitters(this, anchors);
  }

  /** De día la capa emisiva casi no existe; de noche es lo que sostiene la lectura de la calle. */
  private syncEmissiveVisibility(): void {
    const night = this.options.mood === "night";
    for (const overlay of this.overlays) {
      const boost = overlay.kind === "fire" ? 1 : overlay.kind === "lamp" ? 1 : 0.9;
      overlay.image.setAlpha(night ? 0.95 * boost : 0.08 * boost);
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
    destroyEmitters(this.emitters);
    this.emitters = [];
  }
}

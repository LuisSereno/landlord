/**
 * D-111.2 FASE 4 — las cinco representaciones del incendio en Phaser 4.2.1.
 *
 * | # | Representación        | Dónde vive                       | Por qué así |
 * |---|-----------------------|----------------------------------|-------------|
 * | 1 | cuerpo de la llama    | 2 `Image` por foco               | El encargo prohíbe que el fuego dependa de partículas de brasa. |
 * | 2 | lenguas secundarias   | 3 `Image` por foco con envolvente | Phaser 4.2.1 NO tiene `Oscillator` en partículas (0 apariciones en `types/phaser.d.ts`): sólo una `Image` movida por la escena puede oscilar. |
 * | 3 | brasas                | emisor de partículas             | Traza ascendente con gravedad: es lo que vuela, no el cuerpo. |
 * | 4 | humo próximo          | emisor en la punta de la llama   | Nace EN el foco, denso y oscuro. |
 * | 5 | humo ascendente       | 2 emisores desincronizados       | Dos frecuencias inconmensurables matan la periodicidad perfecta de la columna. |
 *
 * Animación: dos senoides de periodos 1150 ms y 1790 ms (razón 1,556: inconmensurables, la suma no
 * se repite en pantalla) más una envolvente suave por lengua. Los recorridos están acotados a
 * ±12 % de altura y ±3° de giro, y la base de cada llama está anclada en su origen (`origin 0.5/1`),
 * así que no hay parpadeos rápidos, saltos de brillo ni desplazamientos de posición.
 *
 * El `seed` es de PRESENTACIÓN: dos corridas con la misma semilla dan la misma coreografía, lo que
 * hace repetible la hoja de animación. No entra en la simulación ni en GameState.
 *
 * Todo es opt-in y desmontable: `setActive(false)` deja de emitir y vacía las partículas vivas;
 * `dispose()` destruye las `Image`, los emisores, el halo y las luces cálidas.
 */
import Phaser from "phaser";
import type { FireFocus } from "./fx-fire-anchors";
import { PARTICLE_TEXTURES } from "./fx-particles";
import {
  makeEmber,
  makeFireGlow,
  makeFlameTongue,
  makeSmokePuff,
  makeSmokeWisp,
} from "./fx-textures";

export const FIRE_TEXTURES = {
  flameA: "fx-tex-flame-a",
  flameB: "fx-tex-flame-b",
  glow: "fx-tex-fire-glow",
  wisp: "fx-tex-smoke-wisp",
} as const;

const FLAME_TEXTURE_SIZE = 96;
/**
 * Dimensiones reales de cada variante de `makeFlameTongue`: `0,62`/`0,78` del ancho y `1,5` del alto
 * sobre el tamaño pedido. Escalar sin estos números deformaría la silueta dibujada a mano.
 */
const FLAME_HEIGHT_PX = FLAME_TEXTURE_SIZE * 1.5;
const FLAME_WIDTH_PX = [FLAME_TEXTURE_SIZE * 0.62, FLAME_TEXTURE_SIZE * 0.78] as const;
const GLOW_TEXTURE_SIZE = 192;
/** Diámetro natural de cada textura de partícula: sirve para pasar de "tamaño del fuego" a escala. */
const EMBER_TEXTURE_SIZE = 32;
const SMOKE_TEXTURE_SIZE = 64;
const WISP_TEXTURE_SIZE = 128;

/** Periodos de la oscilación base, en ms. Inconmensurables a propósito. */
const SLOW_PERIOD_MS = 1150;
const FAST_PERIOD_MS = 1790;
const TAU = Math.PI * 2;

/** Color de la luz cálida del fuego: el mismo filamento naranja que el compositor hornea en Blender. */
const FIRE_LIGHT_COLOUR = 0xff7a2a;

export type FireRigOptions = {
  /** `night` sube el alfa del halo: de día el bake manda y el fuego debe sumarse sin cegar. */
  readonly mood: "day" | "night";
  /** Semilla de presentación: fija la coreografía de las lenguas para poder fotografiarla. */
  readonly seed: number;
  /** Emisores montados pero en pausa hasta que el toggle encienda el fuego. */
  readonly active: boolean;
  /**
   * D-111.2 cierre: `false` cuando el sprite YA trae su columna horneada (ruta QA híbrida) — soltar
   * la del rig encima leería como dos columnas independientes, que es justo lo que el encargo
   * prohíbe. Por defecto `true`: el catálogo runtime no hornea humo.
   */
  readonly smoke?: boolean;
};

export type FireStats = {
  readonly foci: number;
  readonly flameImages: number;
  readonly emitters: number;
  readonly particlesAlive: number;
  readonly lights: number;
  readonly glowImages: number;
};

export type FireRig = {
  update(timeMs: number): void;
  setActive(active: boolean): void;
  /** Luz cálida de proximidad: sólo tiene sentido si el rig de iluminación dinámica está montado. */
  setLights(enabled: boolean): void;
  dispose(): void;
  stats(): FireStats;
  /** Halo aditivo por foco: lo registra la escena como overlay emisivo para el bloom por objeto. */
  readonly glows: readonly Phaser.GameObjects.Image[];
};

/** PRNG determinista de presentación (mulberry32). Nunca entra en la simulación. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothStep(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export function ensureFireTextures(scene: Phaser.Scene): void {
  const entries: [string, () => HTMLCanvasElement][] = [
    [FIRE_TEXTURES.flameA, () => makeFlameTongue(FLAME_TEXTURE_SIZE, 0)],
    [FIRE_TEXTURES.flameB, () => makeFlameTongue(FLAME_TEXTURE_SIZE, 1)],
    [FIRE_TEXTURES.glow, () => makeFireGlow(GLOW_TEXTURE_SIZE)],
    [FIRE_TEXTURES.wisp, () => makeSmokeWisp(WISP_TEXTURE_SIZE)],
    [PARTICLE_TEXTURES.smoke, () => makeSmokePuff(SMOKE_TEXTURE_SIZE)],
    [PARTICLE_TEXTURES.ember, () => makeEmber(EMBER_TEXTURE_SIZE)],
  ];
  for (const [key, factory] of entries) {
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, factory());
  }
}

type Tongue = {
  image: Phaser.GameObjects.Image;
  /** Ancho nativo de la textura usada: sin él la escala X se calcula contra la otra variante. */
  widthPx: number;
  periodMs: number;
  phase: number;
  heightFraction: number;
  leanDegrees: number;
};

type FocusRig = {
  focus: FireFocus;
  /** Las dos capas del cuerpo, nombradas: un array obliga a destructurar y el compilador no garantiza índices. */
  outer: Phaser.GameObjects.Image;
  core: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  /** Luz cálida de ESTE foco: `null` mientras el rig de iluminación dinámica no esté montado. */
  light: Phaser.GameObjects.Light | null;
  tongues: Tongue[];
  embers: Phaser.GameObjects.Particles.ParticleEmitter;
  /** `null` cuando el sprite ya hornea su columna (ruta QA híbrida). */
  nearSmoke: Phaser.GameObjects.Particles.ParticleEmitter | null;
  risingSmoke: Phaser.GameObjects.Particles.ParticleEmitter[];
};

export function createFireRig(
  scene: Phaser.Scene,
  foci: readonly FireFocus[],
  options: FireRigOptions,
): FireRig {
  ensureFireTextures(scene);
  const night = options.mood === "night";
  const rigs: FocusRig[] = [];
  const glows: Phaser.GameObjects.Image[] = [];
  const lights: Phaser.GameObjects.Light[] = [];
  let active = false;
  /** Estado del rig de iluminación: si no está, el fuego no puede pedir luces sin cambiar el pipeline. */
  let lightsAllowed = false;

  for (const [index, focus] of foci.entries()) {
    const random = prng(options.seed + index * 7919);
    const flame = focus.flameWorldPx;
    const cx = focus.x;
    const baseY = focus.y;
    const smoke = options.smoke ?? true;

    /**
     * Cuerpo: dos capas con el mismo origen en la base. La exterior da la silueta roja; la interior,
     * más estrecha y más blanca, el núcleo. Ninguna depende de las brasas.
     */
    const outer = scene.add
      .image(cx, baseY, FIRE_TEXTURES.flameA)
      .setOrigin(0.5, 1)
      .setDepth(focus.depth)
      .setBlendMode(Phaser.BlendModes.ADD);
    const core = scene.add
      .image(cx, baseY, FIRE_TEXTURES.flameB)
      .setOrigin(0.5, 1)
      .setDepth(focus.depth + 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    const tongues: Tongue[] = [];
    for (let t = 0; t < 3; t += 1) {
      const variant = t % 2;
      const image = scene.add
        .image(cx, baseY, variant === 0 ? FIRE_TEXTURES.flameA : FIRE_TEXTURES.flameB)
        .setOrigin(0.5, 1)
        .setDepth(focus.depth + 2 + t)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      tongues.push({
        image,
        widthPx: FLAME_WIDTH_PX[variant]!,
        /** Periodos distintos por lengua: tres envolturas que nunca coinciden en el mismo punto. */
        periodMs: 1400 + Math.round(random() * 1600),
        phase: random() * TAU,
        heightFraction: 0.34 + random() * 0.3,
        leanDegrees: (random() - 0.5) * 9,
      });
    }

    /** Brasas: pocas y cortas. Son la traza, no el cuerpo del fuego. */
    const embers = scene.add.particles(cx, baseY - flame * 0.55, PARTICLE_TEXTURES.ember, {
      x: { min: -flame * 0.35, max: flame * 0.35 },
      speedY: { min: -flame * 3.2, max: -flame * 1.7 },
      speedX: { min: -flame * 0.55, max: flame * 0.55 },
      gravityY: flame * 1.4,
      lifespan: { min: 700, max: 1500 },
      /** Todo tamaño del incendio se expresa contra `flame`: cambia el edificio, cambia el fuego. */
      scale: {
        start: (flame * 0.3) / EMBER_TEXTURE_SIZE,
        end: (flame * 0.06) / EMBER_TEXTURE_SIZE,
      },
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      frequency: 210,
      maxAliveParticles: 14,
      reserve: 14,
      emitting: false,
    });

    /** Humo próximo: nace en la punta de la llama, denso y todavía cálido. */
    const nearSmoke = smoke
      ? scene.add.particles(cx, baseY - flame * 0.95, PARTICLE_TEXTURES.smoke, {
          x: { min: -flame * 0.28, max: flame * 0.28 },
          speedY: { min: -flame * 2.1, max: -flame * 1.4 },
          speedX: { min: -flame * 0.25, max: flame * 0.45 },
          lifespan: { min: 900, max: 1500 },
          scale: {
            start: (flame * 0.85) / SMOKE_TEXTURE_SIZE,
            end: (flame * 2.6) / SMOKE_TEXTURE_SIZE,
          },
          alpha: { start: 0.5, end: 0.06 },
          quantity: 1,
          frequency: 240,
          maxAliveParticles: 12,
          reserve: 12,
          emitting: false,
        })
      : null;

    /**
     * Humo ascendente: DOS emisores con frecuencias de 340 y 520 ms. Una sola frecuencia es
     * perfectamente periódica y la columna se lee como una máquina; la superposición de dos
     * inconmensurables da un retardo irregular sin añadir coste apreciable.
     */
    const rising = smoke
      ? [340, 520].map((frequency, emitterIndex) =>
          scene.add.particles(
            cx + (emitterIndex === 0 ? -flame * 0.12 : flame * 0.14),
            baseY - flame * 1.6,
            FIRE_TEXTURES.wisp,
            {
              x: { min: -flame * 0.4, max: flame * 0.4 },
              speedY: { min: -flame * 1.5, max: -flame * 0.95 },
              /** Deriva lateral moderada y siempre en el mismo sentido: el viento no cambia cada frame. */
              speedX: { min: -flame * 0.12, max: flame * 0.3 },
              accelerationX: flame * 0.06,
              lifespan: { min: 2600, max: 4200 },
              /** La columna nace estrecha, se ensancha y pierde opacidad: 4,2× el ancho de la llama. */
              scale: {
                start: (flame * 1.5) / WISP_TEXTURE_SIZE,
                end: (flame * 4.2) / WISP_TEXTURE_SIZE,
              },
              alpha: { start: 0.44, end: 0 },
              rotate: { min: -30, max: 30 },
              quantity: 1,
              frequency,
              maxAliveParticles: 16,
              reserve: 16,
              emitting: false,
            },
          ),
        )
      : [];

    /**
     * Halo cálido LOCALIZADO (4.5). El radio es 1,15× la llama de ESTE foco: con 3× (primera corrida
     * de `fire_animation_sheet.png`) el ADD se apilaba sobre las lenguas y saturaba a blanco media
     * manzana; con 1,7× seguía llegando al árbol de al lado. Un incendio alumbra su cubierta, no su
     * calle.
     */
    const glow = scene.add
      .image(cx, baseY - flame * 0.45, FIRE_TEXTURES.glow)
      .setDepth(focus.depth - 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    glow.setScale((flame * 1.15) / (GLOW_TEXTURE_SIZE / 2));
    glows.push(glow);

    rigs.push({
      focus,
      outer,
      core,
      glow,
      light: null,
      tongues,
      embers,
      nearSmoke,
      risingSmoke: rising,
    });
  }

  /** La envolvente común: [0,1] con dos senoides inconmensurables. */
  const pulse = (timeMs: number, phase = 0): number => {
    const slow = Math.sin((timeMs / SLOW_PERIOD_MS) * TAU + phase);
    const fast = Math.sin((timeMs / FAST_PERIOD_MS) * TAU + phase * 0.37);
    return 0.5 + 0.25 * slow + 0.25 * fast;
  };

  const apply = (on: boolean): void => {
    active = on;
    for (const rig of rigs) {
      rig.outer.setVisible(on);
      rig.core.setVisible(on);
      for (const tongue of rig.tongues) tongue.image.setVisible(on);
      for (const emitter of [
        rig.embers,
        ...(rig.nearSmoke ? [rig.nearSmoke] : []),
        ...rig.risingSmoke,
      ]) {
        if (on) emitter.start();
        /** `stop(true)` llama `killAll()`: al perder el estado `burning` no quedan partículas vivas. */
        else emitter.stop(true);
      }
    }
    for (const glow of glows) glow.setVisible(on);
    if (!on) setLightsInternal(false);
  };

  function setLightsInternal(enabled: boolean): void {
    if (enabled) {
      if (lightsAllowed && lights.length === 0) {
        for (const entry of rigs) {
          /**
           * Radio de 2,2× la llama: charca propia por foco. No se añade `addPointLight()`: su halo
           * se apilaría sobre el sprite de glow y saturaría el centro a blanco (medido con las
           * farolas en `street_night_lighting`).
           */
          const light = scene.lights.addLight(
            entry.focus.x,
            entry.focus.y - entry.focus.flameWorldPx * 0.5,
            entry.focus.flameWorldPx * 2.2,
            FIRE_LIGHT_COLOUR,
            1.1,
          );
          lights.push(light);
          entry.light = light;
        }
      }
      return;
    }
    for (const light of lights) scene.lights.removeLight(light);
    lights.length = 0;
    for (const entry of rigs) entry.light = null;
  }

  const rig: FireRig = {
    glows,

    update(timeMs: number): void {
      if (!active) return;
      for (const [index, entry] of rigs.entries()) {
        const h = pulse(timeMs, index * 1.7);
        const flame = entry.focus.flameWorldPx;
        const { outer, core } = entry;
        /**
         * Alto y ancho se escalan POR SEPARADO contra las dimensiones reales de cada textura. Con el
         * ancho derivado del alto (como estaba) las dos variantes —59,5 y 74,9 px de ancho— salían
         * achatadas a la misma proporción y la llama se leía como una aguja de 8×20 px.
         * ±12 % de alto, ±6 % de ancho: variación de longitud y forma sin latigazos.
         */
        const bodyHeight = flame * (0.88 + 0.24 * h);
        const bodyWidth = flame * (0.62 + 0.06 * (1 - h));
        outer.setScale(bodyWidth / FLAME_WIDTH_PX[0]!, bodyHeight / FLAME_HEIGHT_PX);
        outer.setAlpha(0.6 + 0.16 * h);
        outer.rotation = ((h - 0.5) * 6 * Math.PI) / 180;
        core.setScale(
          (bodyWidth * 0.52) / FLAME_WIDTH_PX[1]!,
          (bodyHeight * 0.74) / FLAME_HEIGHT_PX,
        );
        core.setAlpha(0.5 + 0.2 * h);
        core.rotation = -((h - 0.5) * 4 * Math.PI) / 180;

        for (const [t, tongue] of entry.tongues.entries()) {
          /** Envolvente lenta: la lengua crece, se sostiene y se apaga; nunca aparece de golpe. */
          const wave = Math.sin((timeMs / tongue.periodMs) * TAU + tongue.phase);
          const envelope = smoothStep((wave + 1) / 2) ** 1.6;
          const height = flame * tongue.heightFraction * (0.7 + 0.5 * h) * envelope;
          tongue.image.setScale((height * 0.62) / tongue.widthPx, height / FLAME_HEIGHT_PX);
          tongue.image.setAlpha(envelope * (0.46 + 0.18 * h));
          tongue.image.rotation = ((tongue.leanDegrees + (h - 0.5) * 4) * Math.PI) / 180;
          tongue.image.x = entry.focus.x + (t - 1) * flame * 0.22;
        }

        const glowScale = (flame * (1 + 0.25 * h)) / (GLOW_TEXTURE_SIZE / 2);
        entry.glow.setScale(glowScale);
        entry.glow.setAlpha((night ? 0.22 : 0.1) * (0.82 + 0.3 * h));

        /** La luz palpita con SU foco: un incendio no le marca el ritmo a la farola de al lado. */
        if (entry.light) entry.light.intensity = 0.8 + 0.5 * h;
      }
    },

    setActive(on: boolean): void {
      if (on === active) return;
      apply(on);
    },

    setLights(enabled: boolean): void {
      lightsAllowed = enabled;
      setLightsInternal(enabled && active);
    },

    dispose(): void {
      setLightsInternal(false);
      for (const entry of rigs) {
        entry.outer.destroy();
        entry.core.destroy();
        for (const tongue of entry.tongues) tongue.image.destroy();
        entry.embers.destroy();
        entry.nearSmoke?.destroy();
        for (const emitter of entry.risingSmoke) emitter.destroy();
      }
      for (const glow of glows) glow.destroy();
      rigs.length = 0;
      glows.length = 0;
    },

    stats(): FireStats {
      let particlesAlive = 0;
      let emitters = 0;
      let flameImages = 0;
      for (const entry of rigs) {
        for (const emitter of [
          entry.embers,
          ...(entry.nearSmoke ? [entry.nearSmoke] : []),
          ...entry.risingSmoke,
        ]) {
          emitters += 1;
          particlesAlive += emitter.getAliveParticleCount();
        }
        flameImages += 2 + entry.tongues.length;
      }
      return {
        foci: rigs.length,
        flameImages,
        emitters,
        particlesAlive,
        lights: lights.length,
        glowImages: glows.length,
      };
    },
  };

  apply(options.active);
  return rig;
}

/**
 * Montaje del laboratorio D-111 §7.
 *
 * Mismo patrón que `mountDenseAssetScene`: un `Phaser.Game` propio dentro de un div, destruido al
 * desmontar React. La diferencia es que aquí el tipo de renderer se puede forzar a CANVAS para
 * medir de verdad la degradación (§7.5), y que la escena expone una sonda en `window` para que el
 * arnés de captura lea métricas y efectos activos sin tocar el DOM del juego.
 */
import Phaser from "phaser";
import { FxLabScene, type FxLabProbeData } from "./FxLabScene";
import type { FxEffect, FxMood } from "./fx-lab-types";

declare global {
  interface Window {
    __fxLab?: import("./mount").FxLabProbeWindow;
  }
}

export type FxLabMountOptions = {
  effects: readonly FxEffect[];
  mood: FxMood;
  zoom: number;
  perf: boolean;
  /** `canvas` fuerza el renderer 2D: es la prueba real de §7.5, no una simulación. */
  renderer: "auto" | "canvas";
  width?: number;
  height?: number;
};

/** Cadena del driver WebGL real. En esta máquina sale ANGLE/llvmpipe: es la prueba del suelo blando. */
function readGlRenderer(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (!info) return gl.getParameter(gl.VERSION) as string;
    return gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return null;
  }
}

export type FxLabProbeWindow = FxLabProbeData & { glRenderer: string | null };

export type FxLabController = {
  destroy(): void;
  setMood(mood: FxMood): void;
  applyEffect(effect: FxEffect, on: boolean): void;
  setZoom(zoom: number): void;
  getProbe(): FxLabProbeWindow;
  readonly glRenderer: string | null;
};

export function mountFxLab(container: HTMLElement, options: FxLabMountOptions): FxLabController {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const scene = new FxLabScene({
    effects: [...options.effects],
    mood: options.mood,
    zoom: options.zoom,
    perf: options.perf,
  });
  const game = new Phaser.Game({
    type: options.renderer === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
    parent: container,
    width,
    height,
    backgroundColor: options.mood === "night" ? "#141a26" : "#2b3542",
    scene: [scene],
    banner: false,
    audio: { noAudio: true },
  });

  const glRenderer = readGlRenderer();
  const publish = (): void => {
    window.__fxLab = { ...scene.getProbe(), glRenderer };
  };
  const interval = window.setInterval(publish, 250);

  return {
    glRenderer,
    setMood: (mood) => scene.setMood(mood),
    applyEffect: (effect, on) => scene.applyEffect(effect, on),
    setZoom: (zoom) => scene.setZoom(zoom),
    getProbe: () => ({ ...scene.getProbe(), glRenderer }),
    destroy: () => {
      window.clearInterval(interval);
      delete window.__fxLab;
      scene.teardown();
      game.destroy(true);
    },
  };
}

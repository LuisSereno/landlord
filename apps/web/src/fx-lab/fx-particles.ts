/**
 * 7.4 — partículas de estado. Sólo presentación derivada de estados que YA existen en el motor:
 *
 * | Emisor            | Estado real                                                        |
 * |-------------------|--------------------------------------------------------------------|
 * | humo industrial   | `ProductionFacility.operational` sobre un edificio tipo `cement_plant` (`packages/shared/src/domain.ts:407`) |
 * | polvo de obra     | `BuildingAssetState = "construction"` / `ConstructionSite.kind = "construction"` (`domain.ts:640`)           |
 *
 * El incendio NO está aquí: desde D-111.2 FASE 4 vive en `fx-fire.ts`, que es el único sitio que
 * decide cuántas representaciones tiene un fuego y cómo se animan. Antes este módulo emitía una
 * columna de brasas con un desplazamiento vertical universal (`anchor.y − 26`), que es justo lo que
 * el encargo prohíbe y lo que hacía imposible atribuir la forma del incendio a un edificio concreto.
 *
 * La escena de laboratorio coloca a mano un ejemplar de cada estado para poder fotografiarlos. No se
 * añade ningún campo nuevo ni se lee GameState.
 */
import Phaser from "phaser";
import { makeDustMote, makeEmber, makeSmokePuff } from "./fx-textures";

export const PARTICLE_TEXTURES = {
  smoke: "fx-tex-smoke",
  ember: "fx-tex-ember",
  dust: "fx-tex-dust",
} as const;

export type Emitter = {
  readonly kind: "industrial-smoke" | "construction-dust";
  readonly emitter: Phaser.GameObjects.Particles.ParticleEmitter;
};

export type Anchor = { x: number; y: number; scale: number };

/** Texturas de partícula generadas en runtime: el repo no recibe ningún PNG nuevo. */
export function ensureParticleTextures(scene: Phaser.Scene): void {
  const entries: [string, () => HTMLCanvasElement][] = [
    [PARTICLE_TEXTURES.smoke, () => makeSmokePuff(64)],
    [PARTICLE_TEXTURES.ember, () => makeEmber(32)],
    [PARTICLE_TEXTURES.dust, () => makeDustMote(32)],
  ];
  for (const [key, factory] of entries) {
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, factory());
  }
}

/**
 * `frequency` en modo flow emite cada N ms; `quantity` por ciclo. Se mantienen bajos a propósito:
 * el presupuesto de draw calls de `docs/art/PERFORMANCE-BUDGET.md` es ≤150 en frame normal y cada
 * emisor con partículas vivas es geometría adicional sobre el mapa.
 */
export function createEmitters(scene: Phaser.Scene, anchors: Record<string, Anchor[]>): Emitter[] {
  ensureParticleTextures(scene);
  const emitters: Emitter[] = [];

  for (const anchor of anchors["industrial-smoke"] ?? []) {
    emitters.push({
      kind: "industrial-smoke",
      emitter: scene.add.particles(anchor.x, anchor.y, PARTICLE_TEXTURES.smoke, {
        x: { min: -6, max: 6 },
        speedY: { min: -34, max: -20 },
        speedX: { min: -6, max: 10 },
        lifespan: { min: 2600, max: 4200 },
        scale: { start: 0.5 * anchor.scale, end: 2.1 * anchor.scale },
        alpha: { start: 0.5, end: 0 },
        quantity: 1,
        frequency: 420,
        maxAliveParticles: 26,
        reserve: 26,
        emitting: false,
      }),
    });
  }

  for (const anchor of anchors["construction-dust"] ?? []) {
    emitters.push({
      kind: "construction-dust",
      emitter: scene.add.particles(anchor.x, anchor.y, PARTICLE_TEXTURES.dust, {
        x: { min: -34, max: 34 },
        y: { min: -4, max: 4 },
        speedY: { min: -26, max: -10 },
        speedX: { min: -14, max: 14 },
        lifespan: { min: 900, max: 1500 },
        scale: { start: 0.42 * anchor.scale, end: 1.05 * anchor.scale },
        alpha: { start: 0.42, end: 0 },
        quantity: 2,
        frequency: 260,
        maxAliveParticles: 30,
        reserve: 30,
        emitting: false,
      }),
    });
  }

  return emitters;
}

export function setEmittersActive(emitters: readonly Emitter[], active: boolean): void {
  for (const entry of emitters) {
    if (active) entry.emitter.start();
    else entry.emitter.stop(true);
  }
}

export function aliveParticleCount(emitters: readonly Emitter[]): number {
  let total = 0;
  for (const entry of emitters) total += entry.emitter.getAliveParticleCount();
  return total;
}

export function destroyEmitters(emitters: readonly Emitter[]): void {
  for (const entry of emitters) entry.emitter.destroy();
}

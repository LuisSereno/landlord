import Phaser from "phaser";
import {
  parseRuntimeAssetManifest,
  type BuildingAssetState,
  type BuildingType,
  type RuntimeAssetManifestV2,
} from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import blenderBundle from "../generated/runtime-assets-blender.json";
import { depthForAsset, originFromPivot, spriteKeyFor } from "./building-sprites";
import { gridToScreen, REFERENCE_LAYOUT } from "./coordinates";

declare global {
  interface Window {
    __artLabFps?: number;
    __artLabSprites?: number;
    __artLabBlenderTextures?: number;
    __artLabDenseReady?: boolean;
  }
}

const ASSETS: RuntimeAssetManifestV2 = parseRuntimeAssetManifest(runtimeAssets);
const BLENDER: RuntimeAssetManifestV2 = parseRuntimeAssetManifest(blenderBundle);

const STATE_ORDER: readonly BuildingAssetState[] = [
  "complete",
  "construction",
  "damaged",
  "burning",
];
const FRAME_SWAP_MS = 240;
const FPS_WINDOW_MS = 500;
const CAMERA_PX_PER_FRAME = 0.6;

/**
 * Perfil de distrito denso sobre Phaser de verdad (WP4.15-H): `count` sprites del manifiesto con
 * depth por huella, cambio de frame periódico, deriva de posición y scroll de cámara. Sustituye al
 * perfil antiguo de DOM estático, que sólo medía la tasa de `requestAnimationFrame` del navegador.
 * Incluye además las texturas de la ruta Blender para probar que Phaser las consume.
 */
export class DenseAssetScene extends Phaser.Scene {
  private readonly spriteCount: number;
  private readonly staticMode: boolean;
  private sprites: Phaser.GameObjects.Image[] = [];
  private frameTimer = 0;
  private frameStep = 0;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private texturesReady = false;

  constructor(spriteCount: number, staticMode = false) {
    super("dense-assets");
    this.spriteCount = spriteCount;
    this.staticMode = staticMode;
  }

  create(): void {
    void this.registerTextures();
  }

  override update(_time: number, delta: number): void {
    this.fpsFrames += 1;
    this.fpsAccumulator += delta;
    if (this.fpsAccumulator >= FPS_WINDOW_MS) {
      window.__artLabFps = Math.round((this.fpsFrames * 1000) / this.fpsAccumulator);
      this.fpsFrames = 0;
      this.fpsAccumulator = 0;
    }
    if (this.staticMode || !this.texturesReady) return;
    this.cameras.main.scrollX =
      (this.cameras.main.scrollX + CAMERA_PX_PER_FRAME) % (REFERENCE_LAYOUT.mapWidth * 32);
    this.frameTimer += delta;
    if (this.frameTimer < FRAME_SWAP_MS) return;
    this.frameTimer = 0;
    this.frameStep += 1;
    for (const [index, sprite] of this.sprites.entries()) {
      const type = sprite.getData("buildingType") as BuildingType;
      const state = STATE_ORDER[(index + this.frameStep) % STATE_ORDER.length]!;
      sprite.setTexture(spriteKeyFor(type, state));
      sprite.setPosition(sprite.x + 0.4, sprite.y + 0.2);
    }
  }

  /** Rasteriza los data URI del manifiesto y las rutas PNG de la ruta Blender en texturas. */
  private async registerTextures(): Promise<void> {
    const sources: Array<{ key: string; src: string; width: number; height: number }> = [];
    for (const [type, asset] of Object.entries(ASSETS.buildings)) {
      for (const [state, image] of Object.entries(asset.states)) {
        sources.push({
          key: spriteKeyFor(type as BuildingType, state as BuildingAssetState),
          src: image.src,
          width: image.width,
          height: image.height,
        });
      }
    }
    let blenderTextures = 0;
    for (const [state, image] of Object.entries(BLENDER.buildings["courtyard_home"]!.states)) {
      sources.push({
        key: `blender-courtyard_home-${state}`,
        src: image.src,
        width: image.width,
        height: image.height,
      });
      blenderTextures += 1;
    }
    for (const source of sources) {
      if (this.textures.exists(source.key)) continue;
      const element = new Image();
      element.src = source.src;
      try {
        await element.decode();
      } catch {
        continue;
      }
      if (!element.complete || element.naturalWidth === 0) continue;
      const texture = this.textures.createCanvas(source.key, source.width, source.height);
      if (!texture) continue;
      texture.context.drawImage(element, 0, 0, source.width, source.height);
      texture.refresh();
    }
    window.__artLabBlenderTextures = blenderTextures;
    this.spawnSprites();
    this.texturesReady = true;
    window.__artLabDenseReady = true;
  }

  private spawnSprites(): void {
    const columns = Math.ceil(Math.sqrt(this.spriteCount));
    const types = Object.keys(ASSETS.buildings) as BuildingType[];
    for (let index = 0; index < this.spriteCount; index += 1) {
      const type = types[index % types.length]!;
      const asset = ASSETS.buildings[type]!;
      const cell = {
        x: (index % columns) * 2,
        y: Math.floor(index / columns) * 2,
      };
      const center = gridToScreen(cell, REFERENCE_LAYOUT);
      const sprite = this.add.image(center.x, center.y, spriteKeyFor(type, STATE_ORDER[0]!));
      const origin = originFromPivot(asset);
      sprite.setOrigin(origin.x, origin.y);
      sprite.setDepth(depthForAsset(cell, asset.footprint));
      sprite.setData("buildingType", type);
      this.sprites.push(sprite);
    }
    /** Una fila frontal con la ruta Blender: si Phaser no la consumiera, quedaría hueca. */
    const blenderAsset = BLENDER.buildings["courtyard_home"]!;
    for (const [index, state] of STATE_ORDER.entries()) {
      const cell = { x: index * 2, y: columns * 2 + 2 };
      const center = gridToScreen(cell, REFERENCE_LAYOUT);
      const sprite = this.add.image(center.x, center.y, `blender-courtyard_home-${state}`);
      const origin = originFromPivot(blenderAsset);
      sprite.setOrigin(origin.x, origin.y);
      sprite.setDepth(depthForAsset(cell, blenderAsset.footprint) + 1);
      sprite.setScale(2);
      this.sprites.push(sprite);
    }
    window.__artLabSprites = this.spriteCount;
  }
}

export function mountDenseAssetScene(
  container: HTMLElement,
  count: number,
  staticMode = false,
): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: 960,
    height: 540,
    backgroundColor: "#1c2533",
    scene: [new DenseAssetScene(count, staticMode)],
    banner: false,
    audio: { noAudio: true },
  });
  return () => {
    game.destroy(true);
  };
}

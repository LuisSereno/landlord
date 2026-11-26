import type Phaser from "phaser";
import type {
  CharacterAnimation,
  CharacterAssetV1,
  RuntimeAssetManifestV2,
} from "@landlord/shared";
import {
  calibrateAnimation,
  measureAlphaBounds,
  type SpriteCalibration,
} from "../character-scale-lab/scale-calibration";

export type CharacterFrameVisual = {
  key: string;
  slot: number;
  calibration: SpriteCalibration;
};

export type CharacterGroupVisual = {
  key: string;
  frames: CharacterFrameVisual[];
  bytes: number;
  lastUse: number;
};

export type CharacterAssetMetrics = {
  loadedBytesTotal: number;
  loadedCount: number;
  cacheBytes: number;
  cacheCount: number;
  evictedCount: number;
  evictedBytes: number;
  budgetBytes: number;
};

const DEFAULT_BUDGET_BYTES = 96 * 1024 * 1024;

function targetHeight(asset: CharacterAssetV1): number {
  return asset.provenance?.sourceId === "src_kenney_mini_characters" ? 34 : 28;
}

function groupKey(character: string, animation: CharacterAnimation, direction: number): string {
  return `${character}/${animation}/d${direction}`;
}

function frameKey(
  character: string,
  animation: CharacterAnimation,
  direction: number,
  slot: number,
): string {
  return `blender-character-${character}-${animation}-d${direction}-${slot}`;
}

export class CharacterTextureCache {
  private readonly groups = new Map<string, CharacterGroupVisual>();
  private readonly pending = new Map<string, Promise<void>>();
  private queue: Promise<void> = Promise.resolve();
  private clock = 0;
  private loadedBytesTotal = 0;
  private loadedCount = 0;
  private evictedCount = 0;
  private evictedBytes = 0;

  constructor(
    private readonly textures: Phaser.Textures.TextureManager,
    private readonly lift: Uint8Array,
    private readonly budgetBytes = DEFAULT_BUDGET_BYTES,
    private readonly isDestroyed: () => boolean = () => false,
  ) {}

  ensure(
    manifest: RuntimeAssetManifestV2,
    character: string,
    animation: CharacterAnimation,
    direction: number,
  ): Promise<void> {
    const key = groupKey(character, animation, direction);
    const existing = this.groups.get(key);
    if (existing) {
      existing.lastUse = ++this.clock;
      return Promise.resolve();
    }
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const task = this.queue.then(() => this.loadGroup(manifest, character, animation, direction));
    this.queue = task.catch(() => undefined);
    this.pending.set(key, task);
    void task.then(
      () => this.pending.delete(key),
      () => this.pending.delete(key),
    );
    return task;
  }

  getFrame(
    character: string,
    animation: CharacterAnimation,
    direction: number,
    slot: number,
  ): CharacterFrameVisual | null {
    const key = groupKey(character, animation, direction);
    const group = this.groups.get(key);
    if (!group) return null;
    group.lastUse = ++this.clock;
    return group.frames[slot] ?? null;
  }

  metrics(): CharacterAssetMetrics {
    let cacheBytes = 0;
    for (const group of this.groups.values()) cacheBytes += group.bytes;
    return {
      loadedBytesTotal: this.loadedBytesTotal,
      loadedCount: this.loadedCount,
      cacheBytes,
      cacheCount: this.groups.size,
      evictedCount: this.evictedCount,
      evictedBytes: this.evictedBytes,
      budgetBytes: this.budgetBytes,
    };
  }

  destroy(): void {
    for (const group of this.groups.values()) {
      for (const frame of group.frames) this.textures.remove(frame.key);
    }
    this.groups.clear();
    this.pending.clear();
  }

  private async loadGroup(
    manifest: RuntimeAssetManifestV2,
    character: string,
    animation: CharacterAnimation,
    direction: number,
  ): Promise<void> {
    const asset = manifest.characters[character];
    if (!asset) throw new Error(`Personaje fuera del manifiesto: ${character}`);
    const clip = asset.animations[animation];
    const framesPerDirection = Math.max(1, Math.floor(clip.frames.length / asset.directions));
    const measurements: Array<{
      width: number;
      height: number;
      visible: ReturnType<typeof measureAlphaBounds>["visible"];
      support: ReturnType<typeof measureAlphaBounds>["support"];
    }> = [];
    const keys: string[] = [];
    for (let slot = 0; slot < framesPerDirection; slot += 1) {
      const image = clip.frames[direction * framesPerDirection + slot];
      if (!image) throw new Error(`Frame ausente: ${character}/${animation}/d${direction}/${slot}`);
      const element = new Image();
      element.src = image.src;
      await element.decode();
      if (this.isDestroyed()) throw new Error("Character texture load cancelled");
      const key = frameKey(character, animation, direction, slot);
      if (this.textures.exists(key)) this.textures.remove(key);
      const texture = this.textures.createCanvas(key, image.width, image.height);
      if (!texture) throw new Error(`No se pudo crear la textura ${key}`);
      texture.context.drawImage(element, 0, 0, image.width, image.height);
      const frame = texture.context.getImageData(0, 0, image.width, image.height);
      const alpha = new Uint8Array(image.width * image.height);
      for (let index = 0; index < alpha.length; index += 1) {
        const offset = index * 4;
        frame.data[offset] = this.lift[frame.data[offset]!]!;
        frame.data[offset + 1] = this.lift[frame.data[offset + 1]!]!;
        frame.data[offset + 2] = this.lift[frame.data[offset + 2]!]!;
        alpha[index] = frame.data[offset + 3]!;
      }
      texture.context.putImageData(frame, 0, 0);
      texture.refresh();
      measurements.push({
        width: image.width,
        height: image.height,
        ...measureAlphaBounds(image.width, image.height, alpha),
      });
      keys.push(key);
    }
    const calibrations = calibrateAnimation(measurements, targetHeight(asset), 1);
    const bytes = measurements.reduce((total, frame) => total + frame.width * frame.height * 4, 0);
    const key = groupKey(character, animation, direction);
    this.groups.set(key, {
      key,
      frames: calibrations.map((calibration, slot) => ({
        key: keys[slot]!,
        slot,
        calibration,
      })),
      bytes,
      lastUse: ++this.clock,
    });
    this.loadedBytesTotal += bytes;
    this.loadedCount += 1;
    this.evict();
  }

  private evict(): void {
    let cacheBytes = this.metrics().cacheBytes;
    const candidates = [...this.groups.values()].sort(
      (left, right) => left.lastUse - right.lastUse,
    );
    for (const group of candidates) {
      if (cacheBytes <= this.budgetBytes) break;
      if (this.pending.has(group.key)) continue;
      for (const frame of group.frames) this.textures.remove(frame.key);
      this.groups.delete(group.key);
      cacheBytes -= group.bytes;
      this.evictedCount += 1;
      this.evictedBytes += group.bytes;
    }
  }
}

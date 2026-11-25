import type { GridCell } from "../isometric/coordinates";
import type { ArrangementId, ScaleConfigId } from "./config";

export type LabSpriteFrame = {
  role: string;
  direction: number;
  animation: "idle" | "walk";
  sampleIndex: number;
  path: string;
  sha256: string;
  width: number;
  height: number;
  visible: { left: number; top: number; right: number; bottom: number };
  visibleWidth: number;
  visibleHeight: number;
  support: { x: number; y: number };
};

export type LabSpriteManifest = {
  schemaVersion: 1;
  frames: LabSpriteFrame[];
};

export type CharacterVisual = {
  role: string;
  sprite: Phaser.GameObjects.Image;
  cell: GridCell;
  direction: number;
  animation: "idle" | "walk";
  sampleIndex: number;
  scale: number;
  originX: number;
  originY: number;
  worldHeight: number;
  screenHeight: number;
};

export type CharacterSnapshot = Omit<CharacterVisual, "sprite"> & {
  x: number;
  y: number;
  depth: number;
  textureKey: string;
  inView: boolean;
};

export type LabState = {
  ready: boolean;
  config: ScaleConfigId;
  arrangement: ArrangementId;
  paused: boolean;
  cameraZoom: number;
  cameraScroll: { x: number; y: number };
  cameraCenterWorld: { x: number; y: number };
  visibleWorldArea: number;
  fps: number;
  spriteCount: number;
  visibleBuildingCount: number;
  textureCount: number;
  estimatedTextureBytes: number;
  pickedCell: GridCell | null;
  characters: CharacterSnapshot[];
};

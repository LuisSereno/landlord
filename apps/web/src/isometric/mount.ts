import Phaser from "phaser";
import type { ViewProjectionV1 } from "@landlord/shared";
import {
  IsometricSpikeScene,
  isometricSpikeGameConfig,
  type MapOverlay,
} from "./IsometricSpikeScene";

export type { MapOverlay } from "./IsometricSpikeScene";

const mountedScenes = new WeakMap<Phaser.Game, IsometricSpikeScene>();

export function mountIsometricSpike(
  parent: HTMLElement,
  onCellPicked?: (cell: { x: number; y: number }) => void,
): Phaser.Game {
  const scene = new IsometricSpikeScene();
  if (onCellPicked) scene.setCellPickedListener(onCellPicked);
  const game = new Phaser.Game({
    ...isometricSpikeGameConfig,
    scene: [scene],
    parent,
  });
  mountedScenes.set(game, scene);
  return game;
}

export function updateIsometricProjection(game: Phaser.Game, projection: ViewProjectionV1): void {
  mountedScenes.get(game)?.setProjection(projection);
}

export function updateIsometricOverlay(game: Phaser.Game, overlay: MapOverlay): void {
  mountedScenes.get(game)?.setOverlay(overlay);
}

import Phaser from "phaser";
import type { ViewProjectionV1 } from "@landlord/shared";
import { IsometricSpikeScene, isometricSpikeGameConfig } from "./IsometricSpikeScene";

export function mountIsometricSpike(
  parent: HTMLElement,
  onCellPicked?: (cell: { x: number; y: number }) => void,
): Phaser.Game {
  const game = new Phaser.Game({
    ...isometricSpikeGameConfig,
    parent,
  });
  if (onCellPicked) {
    const scene = game.scene.getScene("IsometricSpikeScene") as IsometricSpikeScene;
    scene.events.on("cell-picked", onCellPicked);
  }
  return game;
}

export function updateIsometricProjection(game: Phaser.Game, projection: ViewProjectionV1): void {
  const scene = game.scene.getScene("IsometricSpikeScene") as IsometricSpikeScene;
  scene.setProjection(projection);
}

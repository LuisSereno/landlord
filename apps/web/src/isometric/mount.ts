import Phaser from "phaser";
import type { ViewProjectionV2 } from "@landlord/shared";
import {
  IsometricSpikeScene,
  isometricSpikeGameConfig,
  type MapOverlay,
} from "./IsometricSpikeScene";
import { VISUAL_SLICE_LAYOUT } from "../visual-slice/layout";
import type { TerrainStage } from "../visual-slice/terrain-paint";

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

/**
 * Monta la escena de gameplay con la capa de presentación del Visual Slice. La simulación no
 * participa: se evalúa la composición con la misma cámara, grid y depth que el juego real.
 */
export function mountVisualSlice(
  parent: HTMLElement,
  options: { characters: boolean; terrainStage?: TerrainStage; showGrid?: boolean },
): () => void {
  const game = new Phaser.Game({
    ...isometricSpikeGameConfig,
    scene: [
      new IsometricSpikeScene({
        visualSlice: VISUAL_SLICE_LAYOUT,
        sliceCharacters: options.characters,
        terrainStage: options.terrainStage,
        showGrid: options.showGrid ?? false,
      }),
    ],
    parent,
  });
  return () => game.destroy(true);
}

export function updateIsometricProjection(game: Phaser.Game, projection: ViewProjectionV2): void {
  mountedScenes.get(game)?.setProjection(projection);
}

export function updateIsometricOverlay(game: Phaser.Game, overlay: MapOverlay): void {
  mountedScenes.get(game)?.setOverlay(overlay);
}

/** V.d-UX · navegación desde fichas y notificaciones: centra la cámara en la parcela. */
export function focusIsometricCell(game: Phaser.Game, cell: { x: number; y: number }): void {
  mountedScenes.get(game)?.focusCell(cell);
}

export function setIsometricSelection(
  game: Phaser.Game,
  cell: { x: number; y: number } | null,
): void {
  mountedScenes.get(game)?.setSelectedCell(cell);
}

export function setIsometricEntityPickedListener(
  game: Phaser.Game,
  listener: (target: { kind: "building" | "construction"; id: string }) => void,
): void {
  mountedScenes.get(game)?.setEntityPickedListener(listener);
}

export function setIsometricIndicatorListener(
  game: Phaser.Game,
  listener: (target: { parcelId: string; buildingId?: string }) => void,
): void {
  mountedScenes.get(game)?.setIndicatorListener(listener);
}

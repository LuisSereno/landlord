import {
  type AssetImageV1,
  type BuildingAssetState,
  type BuildingAssetV1,
  type CharacterAnimation,
  type CharacterAssetV1,
  type GridCell,
  type RuntimeAssetManifestV1,
} from "@landlord/shared";

/**
 * Helpers puros de la capa de sprites (WP4.15). Separan el contrato de assets del render para que
 * pivote, estado visual y depth se puedan probar sin Phaser.
 */
export type ProjectedBuildingState = "operational" | "burning" | "collapse_pending" | "ruin";

export function buildingAssetStateFor(
  state: ProjectedBuildingState,
  condition: number,
): BuildingAssetState {
  if (state === "burning" || state === "collapse_pending") return "burning";
  if (state === "ruin") return "damaged";
  return condition < 60 ? "damaged" : "complete";
}

export function spriteKeyFor(type: string, state: BuildingAssetState): string {
  return `building-${type}-${state}`;
}

/**
 * Orden de dibujo isométrico: primero las filas más lejanas (x+y), después y, después x. Coincide con
 * el orden con el que el mapa pinta sus losetas, así que un edificio nunca se adelanta a la loseta
 * que tiene delante.
 */
export function depthForCell(cell: GridCell): number {
  return (cell.x + cell.y) * 1_000 + cell.y * 10 + cell.x;
}

/**
 * Depth de un sprite con huella. El asset ocupa `width × height` celdas hacia el sureste desde su celda
 * ancla, así que se ordena por la celda más cercana a cámara: sin esto una planta de cemento 2×2 se
 * pintaría detrás de los edificios que tapa.
 */
export function depthForAsset(
  cell: GridCell,
  footprint: { width: number; height: number },
): number {
  return depthForCell({
    x: cell.x + Math.max(1, Math.round(footprint.width)) - 1,
    y: cell.y + Math.max(1, Math.round(footprint.height)) - 1,
  });
}

/**
 * Celda del centro de la huella, fraccionaria cuando la huella es par. El pivote del contrato es el
 * centro de la huella, no la celda ancla: ahí se coloca el sprite.
 */
export function footprintCenter(
  cell: GridCell,
  footprint: { width: number; height: number },
): GridCell {
  return {
    x: cell.x + (Math.max(1, Math.round(footprint.width)) - 1) / 2,
    y: cell.y + (Math.max(1, Math.round(footprint.height)) - 1) / 2,
  };
}

/**
 * Frames por dirección de una animación. El manifiesto los ordena por dirección y después por fase, así
 * que el índice de un frame es `dirección × framesPorDirección + fase`.
 */ export function framesPerDirection(
  character: Pick<CharacterAssetV1, "directions" | "animations">,
  animation: CharacterAnimation,
): number {
  return Math.max(
    1,
    Math.floor(character.animations[animation].frames.length / character.directions),
  );
}

/** Frame de una dirección y fase concretas: cada dirección camina con sus propios frames. */
export function animationFrameFor(
  character: Pick<CharacterAssetV1, "directions" | "animations">,
  animation: CharacterAnimation,
  direction: number,
  phase: number,
): AssetImageV1 {
  const frames = character.animations[animation].frames;
  const perDirection = framesPerDirection(character, animation);
  const index = (direction % character.directions) * perDirection + (phase % perDirection);
  return frames[index]!;
}

export function assetFor(manifest: RuntimeAssetManifestV1, type: string): BuildingAssetV1 | null {
  return manifest.buildings[type] ?? null;
}

/** Lado de la celda lógica en metros: las losetas Kenney que definen el grid miden 4 m. */
export const CELL_METERS = 4;

/**
 * Escala que lleva un render Blender a la celda isométrica. La cámara del pack declara su densidad
 * (`pixelsPerMeter`); el grid del juego mide la diagonal de una celda de 4 m como `tileWidth` px.
 * Los assets procedurales ya están dibujados a esa escala y no declaran densidad.
 */
export function spriteScaleFor(asset: { pixelsPerMeter?: number }, tileWidth: number): number {
  if (!asset.pixelsPerMeter) return 1;
  const gamePixelsPerMeter = tileWidth / (CELL_METERS * Math.SQRT2);
  return gamePixelsPerMeter / asset.pixelsPerMeter;
}

/** Origen normalizado listo para `setOrigin`: el pivote es el punto de suelo del sprite. */
export function originFromPivot(asset: BuildingAssetV1): { x: number; y: number } {
  return { x: asset.pivot.x, y: asset.pivot.y };
}

/** Compara una dirección de pantalla (+y hacia abajo) con las variantes del manifiesto (0 = derecha, sentido horario). */
export function directionIndexFor(dx: number, dy: number, directions: 4 | 8): number {
  if (dx === 0 && dy === 0) return 0;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalized = (angle + 360) % 360;
  const step = 360 / directions;
  return Math.round(normalized / step) % directions;
}

/**
 * Selecciona la textura Blender si está disponible; si no, usa la procedural.
 * Implementa la degradación por asset (caso C): un Blender corrupto no bloquea el fallback.
 *
 * @param proceduralKey Clave del sprite procedural (`building-{type}-{state}`).
 * @param blenderAvailable Set de claves Blender disponibles (`blender-building-{type}-{state}`).
 * @returns La clave a usar.
 */
export function selectBuildingTextureKey(
  proceduralKey: string,
  blenderAvailable: Set<string>,
): string {
  const blenderKey = `blender-${proceduralKey}`;
  return blenderAvailable.has(blenderKey) ? blenderKey : proceduralKey;
}

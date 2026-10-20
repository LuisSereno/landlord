export type GridCell = { x: number; y: number };
export type ScreenPoint = { x: number; y: number };
export type IsometricLayout = {
  origin: ScreenPoint;
  tileWidth: number;
  tileHeight: number;
  mapWidth: number;
  mapHeight: number;
};

function assertLayout(layout: IsometricLayout): void {
  if (
    !Number.isFinite(layout.tileWidth) ||
    !Number.isFinite(layout.tileHeight) ||
    layout.tileWidth <= 0 ||
    layout.tileHeight <= 0
  ) {
    throw new RangeError("Isometric tile dimensions must be positive");
  }
}

export function gridToScreen(cell: GridCell, layout: IsometricLayout): ScreenPoint {
  assertLayout(layout);
  return {
    x: layout.origin.x + (cell.x - cell.y) * (layout.tileWidth / 2),
    y: layout.origin.y + (cell.x + cell.y) * (layout.tileHeight / 2),
  };
}

export function screenToGrid(point: ScreenPoint, layout: IsometricLayout): GridCell {
  assertLayout(layout);
  const normalizedX = (point.x - layout.origin.x) / (layout.tileWidth / 2);
  const normalizedY = (point.y - layout.origin.y) / (layout.tileHeight / 2);
  return {
    x: Math.round((normalizedX + normalizedY) / 2),
    y: Math.round((normalizedY - normalizedX) / 2),
  };
}

export function isCellInMap(cell: GridCell, layout: IsometricLayout): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < layout.mapWidth &&
    cell.y < layout.mapHeight
  );
}

export function pickGridCell(point: ScreenPoint, layout: IsometricLayout): GridCell | null {
  const cell = screenToGrid(point, layout);
  if (!isCellInMap(cell, layout)) return null;
  const center = gridToScreen(cell, layout);
  const distance =
    Math.abs(point.x - center.x) / (layout.tileWidth / 2) +
    Math.abs(point.y - center.y) / (layout.tileHeight / 2);
  return distance <= 1 ? cell : null;
}

export const REFERENCE_LAYOUT: IsometricLayout = {
  origin: { x: 512, y: 64 },
  tileWidth: 64,
  tileHeight: 32,
  mapWidth: 64,
  mapHeight: 64,
};

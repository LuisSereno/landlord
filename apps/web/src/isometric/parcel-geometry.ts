import { gridToScreen, type GridCell, type IsometricLayout, type ScreenPoint } from "./coordinates";

export type GridEdgeSide = "n" | "e" | "s" | "w";
export type GridEdge = { cell: GridCell; side: GridEdgeSide };
export type ScreenLine = { from: ScreenPoint; to: ScreenPoint };

const DIRECTIONS: ReadonlyArray<{ side: GridEdgeSide; dx: number; dy: number }> = [
  { side: "n", dx: 0, dy: -1 },
  { side: "e", dx: 1, dy: 0 },
  { side: "s", dx: 0, dy: 1 },
  { side: "w", dx: -1, dy: 0 },
];

/** Exterior cadastral edges only. Input order never affects the canonical result. */
export function parcelBoundaryEdges(cells: readonly GridCell[]): GridEdge[] {
  const occupied = new Set(cells.map((cell) => `${cell.x}:${cell.y}`));
  return [...cells]
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .flatMap((cell) =>
      DIRECTIONS.filter(({ dx, dy }) => !occupied.has(`${cell.x + dx}:${cell.y + dy}`)).map(
        ({ side }) => ({ cell: { ...cell }, side }),
      ),
    );
}

/** Maps a grid-side to the matching edge of the same isometric tile used by the ground renderer. */
export function gridEdgeToScreenLine(edge: GridEdge, layout: IsometricLayout): ScreenLine {
  const center = gridToScreen(edge.cell, layout);
  const top = { x: center.x, y: center.y - layout.tileHeight / 2 };
  const right = { x: center.x + layout.tileWidth / 2, y: center.y };
  const bottom = { x: center.x, y: center.y + layout.tileHeight / 2 };
  const left = { x: center.x - layout.tileWidth / 2, y: center.y };
  switch (edge.side) {
    case "n":
      return { from: top, to: right };
    case "e":
      return { from: right, to: bottom };
    case "s":
      return { from: bottom, to: left };
    case "w":
      return { from: left, to: top };
  }
}

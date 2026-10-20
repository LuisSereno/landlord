import { describe, expect, it } from "vitest";
import { gridToScreen, pickGridCell, REFERENCE_LAYOUT, screenToGrid } from "./coordinates";

describe("isometric coordinates", () => {
  it.each([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 12, y: 27 },
    { x: 63, y: 63 },
  ])("round-trips cell $x,$y at its center", (cell) => {
    expect(screenToGrid(gridToScreen(cell, REFERENCE_LAYOUT), REFERENCE_LAYOUT)).toEqual(cell);
    expect(pickGridCell(gridToScreen(cell, REFERENCE_LAYOUT), REFERENCE_LAYOUT)).toEqual(cell);
  });

  it("rejects clicks outside the map or outside a tile diamond", () => {
    expect(pickGridCell({ x: 512, y: 20 }, REFERENCE_LAYOUT)).toBeNull();
    expect(pickGridCell({ x: 100, y: 100 }, REFERENCE_LAYOUT)).toBeNull();
  });

  it("handles tile edges and a camera-translated origin", () => {
    const shifted = { ...REFERENCE_LAYOUT, origin: { x: 700, y: 180 } };
    const center = gridToScreen({ x: 20, y: 20 }, shifted);
    expect(pickGridCell({ x: center.x + 31, y: center.y }, shifted)).toEqual({ x: 20, y: 20 });
    const boundary = gridToScreen({ x: 63, y: 63 }, shifted);
    expect(pickGridCell({ x: boundary.x + 33, y: boundary.y }, shifted)).toBeNull();
  });
});

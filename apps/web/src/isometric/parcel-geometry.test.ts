import { describe, expect, it } from "vitest";

import { REFERENCE_LAYOUT } from "./coordinates";
import { gridEdgeToScreenLine, parcelBoundaryEdges } from "./parcel-geometry";

const cases = [
  ["una celda", [{ x: 0, y: 0 }], 4],
  ["dos horizontales", [{ x: 0, y: 0 }, { x: 1, y: 0 }], 6],
  ["dos verticales", [{ x: 0, y: 0 }, { x: 0, y: 1 }], 6],
  ["rectángulo 2×2", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], 8],
  ["rectángulo 3×4", Array.from({ length: 12 }, (_, index) => ({ x: index % 3, y: Math.floor(index / 3) })), 14],
  ["L", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 8],
  ["irregular", [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }], 12],
] as const;

describe("parcel boundary geometry", () => {
  it.each(cases)("returns only external edges for %s", (_name, cells, count) => {
    const edges = parcelBoundaryEdges(cells);
    expect(edges).toHaveLength(count);
    expect(edges).toEqual(parcelBoundaryEdges([...cells].reverse()));
  });

  it("converts edges using the shared isometric layout", () => {
    expect(gridEdgeToScreenLine({ cell: { x: 0, y: 0 }, side: "n" }, REFERENCE_LAYOUT)).toEqual({
      from: { x: 512, y: 48 },
      to: { x: 544, y: 64 },
    });
  });
});

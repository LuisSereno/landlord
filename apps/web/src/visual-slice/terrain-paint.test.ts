import { describe, expect, it } from "vitest";
import { crossingArms, curbEdgesForCell, type CurbMode } from "./terrain-paint";
import type { GroundSurface } from "./ground";

function surfaces(entries: Record<string, GroundSurface>) {
  return (cell: { x: number; y: number }): GroundSurface =>
    entries[`${cell.x}:${cell.y}`] ?? "urban";
}

describe("Graphic Civic curbs", () => {
  it("preserva el bordillo pavement/asphalt del Visual Slice", () => {
    const surfaceAt = surfaces({ "1:1": "pavement", "2:1": "asphalt" });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt)).toEqual(["e"]);
    expect(curbEdgesForCell({ x: 0, y: 1 }, surfaceAt)).toEqual([]);
  });

  it("en gameplay marca cualquier frontera asphalt/non-asphalt", () => {
    const mode: CurbMode = "all_non_asphalt";
    const surfaceAt = surfaces({ "1:1": "grass", "2:1": "asphalt", "1:2": "asphalt" });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt, mode)).toEqual(["e", "s"]);
  });

  it("no dibuja bordillos internos para una intersección de asfalto", () => {
    const mode: CurbMode = "all_non_asphalt";
    const surfaceAt = surfaces({
      "1:1": "asphalt",
      "1:0": "asphalt",
      "2:1": "asphalt",
      "1:2": "asphalt",
      "0:1": "asphalt",
    });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt, mode)).toEqual([]);
    expect(curbEdgesForCell({ x: 1, y: 0 }, surfaceAt, mode)).toEqual([]);
  });
});

describe("Graphic Civic pedestrian markings", () => {
  it("pinta sólo los brazos publicados de una T, en orden cardinal estable", () => {
    expect(crossingArms(7).map((arm) => arm.bit)).toEqual([1, 2, 4]);
  });

  it("pinta los cuatro brazos sólo para una intersección plena", () => {
    expect(crossingArms(15).map((arm) => arm.bit)).toEqual([1, 2, 4, 8]);
  });
});

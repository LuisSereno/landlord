import { describe, expect, it } from "vitest";

import type { GridCell } from "@landlord/shared";

import {
  MAX_GROUND_DESCRIPTORS_PER_PROPERTY,
  planPropertyGrounds,
  propertyGroundsCacheKey,
} from "./property-grounds";

function rectangle(x: number, y: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < height; row += 1)
    for (let column = 0; column < width; column += 1) cells.push({ x: x + column, y: y + row });
  return cells;
}

const SITE = rectangle(0, 0, 4, 4);
const FOOTPRINT = rectangle(1, 1, 2, 2);
const FRONTAGE = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 2, y: -1 },
  { x: 3, y: -1 },
];

function plan(family: "residential" | "industrial" | "mixed" | "civic", cells = SITE) {
  return planPropertyGrounds({
    buildingType: family === "industrial" ? "warehouse" : "courtyard_home",
    family,
    siteCells: cells,
    footprintCells: FOOTPRINT,
    frontageCells: FRONTAGE,
  });
}

describe("V.d-7C · entorno de propiedad derivado y determinista", () => {
  it("la misma geometría produce el mismo entorno", () => {
    expect(plan("residential")).toEqual(plan("residential"));
    expect(plan("industrial")).toEqual(plan("industrial"));
  });

  it("el orden de entrada no cambia el resultado", () => {
    const forward = planPropertyGrounds({
      buildingType: "courtyard_home",
      family: "residential",
      siteCells: SITE,
      footprintCells: FOOTPRINT,
      frontageCells: FRONTAGE,
    });
    const backward = planPropertyGrounds({
      buildingType: "courtyard_home",
      family: "residential",
      siteCells: [...SITE].reverse(),
      footprintCells: [...FOOTPRINT].reverse(),
      frontageCells: [...FRONTAGE].reverse(),
    });
    expect(backward).toEqual(forward);
  });

  it("ningún descriptor pisa la huella ni sale del solar", () => {
    const footprintKeys = new Set(FOOTPRINT.map((cell) => `${cell.x},${cell.y}`));
    const siteKeys = new Set(SITE.map((cell) => `${cell.x},${cell.y}`));
    for (const family of ["residential", "industrial", "mixed", "civic"] as const)
      for (const descriptor of plan(family)) {
        expect(footprintKeys.has(`${descriptor.cell.x},${descriptor.cell.y}`)).toBe(false);
        expect(siteKeys.has(`${descriptor.cell.x},${descriptor.cell.y}`)).toBe(true);
      }
  });

  it("vivienda y nave se leen distinto", () => {
    const home = new Set(plan("residential").map((entry) => entry.kind));
    const shed = new Set(plan("industrial").map((entry) => entry.kind));
    expect(home.has("garden") || home.has("hedge")).toBe(true);
    expect(shed.has("hardstanding") || shed.has("service-yard")).toBe(true);
    expect(home.has("hardstanding")).toBe(false);
    expect(shed.has("garden")).toBe(false);
  });

  it("el acceso conecta visualmente con la calle cuando hay hueco", () => {
    const descriptors = plan("residential");
    expect(descriptors.some((entry) => entry.kind === "path")).toBe(true);
  });

  it("un solar completamente edificado no genera entorno", () => {
    const full = planPropertyGrounds({
      buildingType: "warehouse",
      family: "industrial",
      siteCells: FOOTPRINT,
      footprintCells: FOOTPRINT,
      frontageCells: FRONTAGE,
    });
    expect(full).toHaveLength(0);
  });

  it("el coste de dibujo está topado por propiedad", () => {
    const big = plan("residential", rectangle(0, 0, 10, 10));
    expect(big.length).toBeLessThanOrEqual(MAX_GROUND_DESCRIPTORS_PER_PROPERTY);
  });

  it("la clave de caché cambia sólo con la geometría autoritativa", () => {
    const key = propertyGroundsCacheKey({
      buildingId: "building_00000001",
      siteCells: SITE,
      footprintCells: FOOTPRINT,
      frontageCells: FRONTAGE,
    });
    expect(key).toBe(
      propertyGroundsCacheKey({
        buildingId: "building_00000001",
        siteCells: [...SITE].reverse(),
        footprintCells: [...FOOTPRINT].reverse(),
        frontageCells: [...FRONTAGE].reverse(),
      }),
    );
    expect(key).not.toBe(
      propertyGroundsCacheKey({
        buildingId: "building_00000002",
        siteCells: SITE,
        footprintCells: FOOTPRINT,
        frontageCells: FRONTAGE,
      }),
    );
  });
});

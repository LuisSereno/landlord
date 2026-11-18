import { describe, expect, it } from "vitest";

import type { GridCell } from "@landlord/shared";

import {
  FACILITY_COURTYARD_SPECS,
  planFacilityCourtyard,
  planGameplayFacilityCourtyards,
} from "./facility-courtyards";

function rect(x0: number, y0: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];
  for (let y = y0; y < y0 + height; y += 1)
    for (let x = x0; x < x0 + width; x += 1) cells.push({ x, y });
  return cells;
}

const key = (cell: GridCell) => `${cell.x}:${cell.y}`;

/** Solar 8×4 con edificio 5×3 al fondo y frente vial en la fila y=0 (calle en y=-1). */
function townHallFixture() {
  const siteCells = rect(0, 0, 8, 4);
  const footprintCells = rect(0, 1, 5, 3);
  const frontage = rect(0, 0, 8, 1);
  return { siteCells, footprintCells, frontage };
}

describe("patios de equipamientos (WP-D)", () => {
  it("el ayuntamiento reserva monumento, asta, bancos, jardineras y bolardos sin vehículo", () => {
    const { siteCells, footprintCells, frontage } = townHallFixture();
    const plan = planFacilityCourtyard(
      { id: "b1", type: "town_hall", footprintCells, siteCells },
      frontage,
    )!;
    expect(plan).not.toBeNull();
    expect(plan.elements.some((entry) => entry.kind === "vehicle")).toBe(false);
    const assets = plan.elements.map((entry) => entry.asset);
    expect(assets).toContain("prp_monument");
    expect(assets).toContain("prp_flagpole");
    expect(assets.filter((asset) => asset === "prp_bench")).toHaveLength(2);
    expect(assets.filter((asset) => asset === "prp_planter")).toHaveLength(2);
    expect(assets.filter((asset) => asset === "prp_bollard")).toHaveLength(2);
    expect(plan.accessCells.length).toBeGreaterThan(0);
    expect(plan.accessRoadExit).not.toBeNull();
  });

  it("cada equipamiento aparca su vehículo temático dentro del solar, fuera de huella y acceso", () => {
    const cases: Array<{ type: string; site: [number, number]; building: [number, number]; asset: string }> = [
      { type: "clinic", site: [3, 2], building: [2, 1], asset: "veh_ambulance" },
      { type: "police_station", site: [3, 2], building: [2, 1], asset: "veh_police" },
      { type: "fire_station", site: [4, 2], building: [3, 1], asset: "veh_firetruck" },
      { type: "market_hall", site: [5, 2], building: [4, 1], asset: "veh_delivery" },
    ];
    for (const c of cases) {
      const siteCells = rect(0, 0, c.site[0], c.site[1]);
      const footprintCells = rect(0, 1, c.building[0], c.building[1]);
      const frontage = rect(0, 0, c.site[0], 1);
      const plan = planFacilityCourtyard(
        { id: `b-${c.type}`, type: c.type, footprintCells, siteCells },
        frontage,
      )!;
      const vehicles = plan.elements.filter((entry) => entry.kind === "vehicle");
      expect(vehicles, c.type).toHaveLength(1);
      expect(vehicles[0]!.asset).toBe(c.asset);
      const site = new Set(siteCells.map(key));
      const footprint = new Set(footprintCells.map(key));
      const access = new Set(plan.accessCells.map(key));
      expect(site.has(key(vehicles[0]!.cell))).toBe(true);
      expect(footprint.has(key(vehicles[0]!.cell))).toBe(false);
      expect(access.has(key(vehicles[0]!.cell))).toBe(false);
      expect(plan.keepFree.map(key)).toContain(key(vehicles[0]!.cell));
    }
  });

  it("el colegio tiene zona de juegos y bancos; el mercado puestos y reparto", () => {
    const school = planFacilityCourtyard(
      {
        id: "b-school",
        type: "school_block",
        footprintCells: rect(0, 1, 5, 1),
        siteCells: rect(0, 0, 7, 2),
      },
      rect(0, 0, 7, 1),
    )!;
    expect(school.elements.map((entry) => entry.asset)).toContain("prp_school_playground");
    expect(school.elements.filter((entry) => entry.asset === "prp_bench").length).toBeGreaterThanOrEqual(1);

    const market = planFacilityCourtyard(
      {
        id: "b-market",
        type: "market_hall",
        footprintCells: rect(0, 1, 4, 1),
        siteCells: rect(0, 0, 5, 2),
      },
      rect(0, 0, 5, 1),
    )!;
    expect(market.elements.filter((entry) => entry.asset === "prp_market_stall").length).toBeGreaterThanOrEqual(1);
    expect(market.elements.some((entry) => entry.asset === "veh_delivery")).toBe(true);
  });

  it("props, vehículo y acceso no se solapan y quedan dentro del patio", () => {
    for (const type of Object.keys(FACILITY_COURTYARD_SPECS)) {
      const spec = FACILITY_COURTYARD_SPECS[type]!;
      const width = spec.vehicle ? 5 : 8;
      const siteCells = rect(0, 0, width, 4);
      const footprintCells = rect(0, 2, width - 1, 2);
      const plan = planFacilityCourtyard(
        { id: `b-${type}`, type, footprintCells, siteCells },
        rect(0, 0, width, 1),
      )!;
      const occupied = new Set<string>();
      const patio = new Set(plan.patioCells.map(key));
      for (const entry of plan.elements) {
        expect(patio.has(key(entry.cell)), `${type} ${entry.asset}`).toBe(true);
        expect(occupied.has(key(entry.cell)), `${type} solape ${entry.asset}`).toBe(false);
        occupied.add(key(entry.cell));
      }
      for (const cell of plan.accessCells) {
        expect(occupied.has(key(cell)), `${type} acceso pisado`).toBe(false);
        expect(patio.has(key(cell))).toBe(true);
      }
      const keepFree = new Set(plan.keepFree.map(key));
      for (const cell of plan.accessCells) expect(keepFree.has(key(cell))).toBe(true);
      for (const entry of plan.elements) expect(keepFree.has(key(entry.cell))).toBe(true);
    }
  });

  it("es determinista para la misma geometría y no planifica tipos privados", () => {
    const { siteCells, footprintCells, frontage } = townHallFixture();
    const building = { id: "b1", type: "town_hall", footprintCells, siteCells };
    expect(planFacilityCourtyard(building, frontage)).toEqual(
      planFacilityCourtyard(building, frontage),
    );
    expect(
      planFacilityCourtyard(
        { id: "b2", type: "courtyard_home", footprintCells, siteCells },
        frontage,
      ),
    ).toBeNull();
  });

  it("la capa agregada reserva celdas y desembocaduras para excluir fauna y aparcamiento", () => {
    const { siteCells, footprintCells, frontage } = townHallFixture();
    const result = planGameplayFacilityCourtyards(
      [
        {
          id: "b1",
          type: "town_hall",
          footprintCells,
          siteCells,
          parcelIds: ["p1"],
        },
      ],
      new Map([["p1", frontage]]),
    );
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.reservedCells.size).toBeGreaterThan(0);
    expect(result.accessRoadExits.size).toBe(1);
    const patio = result.patioByParcelId.get("p1")!;
    expect(patio.cells.length).toBeGreaterThan(0);
    for (const cell of patio.cells) {
      expect(result.reservedCells.has(key(cell))).toBe(false);
    }
  });
});
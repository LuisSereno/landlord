import { describe, expect, it } from "vitest";
import { parseRuntimeAssetManifest, type RuntimeAssetManifestV2 } from "@landlord/shared";
import blenderBundle from "../generated/runtime-assets-blender.json";
import {
  AVENUE_X,
  EAST_AVENUE_X,
  SECOND_STREET_Y,
  STREET_Y,
  VISUAL_SLICE_LAYOUT,
  WORKS_LOT,
  ZONE_FROM,
  ZONE_TO,
  roadCells,
} from "./layout";

const BUNDLE: RuntimeAssetManifestV2 = parseRuntimeAssetManifest(blenderBundle);

function key(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

const roads = roadCells();
const lotCells = new Set<string>();
for (let y = WORKS_LOT.from.y; y <= WORKS_LOT.to.y; y += 1) {
  for (let x = WORKS_LOT.from.x; x <= WORKS_LOT.to.x; x += 1) lotCells.add(`${x}:${y}`);
}

describe("WP4.15-V.b Visual Slice: composición densa", () => {
  it("compone un barrio de 3–4 manzanas con masa suficiente", () => {
    const cells = VISUAL_SLICE_LAYOUT.buildings.map((building) => key(building.cell));
    expect(VISUAL_SLICE_LAYOUT.buildings.length).toBeGreaterThanOrEqual(50);
    expect(VISUAL_SLICE_LAYOUT.buildings.length).toBeLessThanOrEqual(70);
    expect(new Set(cells).size).toBe(cells.length);
    // Dos frentes de calle distintos (principal y secundaria) más frentes de avenida.
    const rows = new Set(VISUAL_SLICE_LAYOUT.buildings.map((building) => building.cell.y));
    expect(rows.size).toBeGreaterThanOrEqual(4);
  });

  it("todos los assets y orientaciones de la escena existen en el bundle", () => {
    for (const building of VISUAL_SLICE_LAYOUT.buildings) {
      const asset = BUNDLE.buildings[building.type];
      expect(asset, building.type).toBeDefined();
      expect(asset!.states).toHaveProperty(building.state ?? "complete");
    }
    for (const prop of VISUAL_SLICE_LAYOUT.props) {
      const asset = BUNDLE.props?.[prop.asset];
      expect(asset, prop.asset).toBeDefined();
      if (prop.azimuth !== undefined && prop.azimuth !== 45) {
        expect(asset!.orientations?.[String(prop.azimuth)], prop.asset).toBeDefined();
      }
    }
    for (const vehicle of VISUAL_SLICE_LAYOUT.vehicles) {
      const asset = BUNDLE.vehicles?.[vehicle.asset];
      expect(asset, vehicle.asset).toBeDefined();
      if (vehicle.azimuth !== undefined && vehicle.azimuth !== 45) {
        expect(asset!.orientations?.[String(vehicle.azimuth)], vehicle.asset).toBeDefined();
      }
    }
    for (const tile of VISUAL_SLICE_LAYOUT.terrain) {
      expect(BUNDLE.terrain?.[tile.asset], tile.asset).toBeDefined();
    }
  });

  it("las calles son continuas y el solar ocupa su manzana", () => {
    const terrain = new Set(VISUAL_SLICE_LAYOUT.terrain.map((tile) => key(tile.cell)));
    for (const cell of roads) expect(terrain.has(cell), cell).toBe(true);
    for (let y = ZONE_FROM; y <= ZONE_TO; y += 1) {
      expect(roads.has(`${AVENUE_X}:${y}`), `avenida ${AVENUE_X}:${y}`).toBe(true);
      expect(roads.has(`${EAST_AVENUE_X}:${y}`), `avenida ${EAST_AVENUE_X}:${y}`).toBe(true);
    }
    for (let x = ZONE_FROM; x <= ZONE_TO; x += 1) {
      expect(roads.has(`${x}:${STREET_Y}`), `calle ${x}:${STREET_Y}`).toBe(true);
      expect(roads.has(`${x}:${SECOND_STREET_Y}`), `calle ${x}:${SECOND_STREET_Y}`).toBe(true);
    }
    for (const cell of lotCells) expect(terrain.has(cell), `solar ${cell}`).toBe(true);
    expect(VISUAL_SLICE_LAYOUT.lots?.[0]).toEqual(WORKS_LOT);
  });

  it("los vehículos circulan por la calzada y la escena no invade el asfalto", () => {
    for (const vehicle of VISUAL_SLICE_LAYOUT.vehicles) {
      expect(roads.has(key(vehicle.cell)) || lotCells.has(key(vehicle.cell)), vehicle.asset).toBe(
        true,
      );
    }
    for (const building of VISUAL_SLICE_LAYOUT.buildings) {
      expect(roads.has(key(building.cell)), building.type).toBe(false);
    }
    for (const prop of VISUAL_SLICE_LAYOUT.props) {
      expect(roads.has(key(prop.cell)), `${prop.asset} en ${key(prop.cell)}`).toBe(false);
    }
  });

  it("no hay dos objetos en la misma celda y todo cabe en el mapa", () => {
    const occupied = new Set<string>();
    for (const placement of [
      ...VISUAL_SLICE_LAYOUT.buildings,
      ...VISUAL_SLICE_LAYOUT.props,
      ...VISUAL_SLICE_LAYOUT.vehicles,
    ]) {
      const { x, y } = placement.cell;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(64);
      expect(y).toBeLessThan(64);
      expect(occupied.has(key(placement.cell)), key(placement.cell)).toBe(false);
      occupied.add(key(placement.cell));
    }
  });
});

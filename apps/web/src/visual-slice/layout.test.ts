import { describe, expect, it } from "vitest";
import type { RuntimeAssetManifestV1 } from "@landlord/shared";
import blenderBundle from "../generated/runtime-assets-blender.json";
import { AVENUE_X, STREET_Y, VISUAL_SLICE_LAYOUT, ZONE_FROM, ZONE_TO } from "./layout";

const BUNDLE = blenderBundle as unknown as RuntimeAssetManifestV1;

function key(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

const roadCells = new Set(VISUAL_SLICE_LAYOUT.terrain.map((tile) => key(tile.cell)));

describe("WP4.15-V Visual Slice: composición", () => {
  it("compone entre 8 y 12 edificios sin repetir celda", () => {
    const cells = VISUAL_SLICE_LAYOUT.buildings.map((building) => key(building.cell));
    expect(VISUAL_SLICE_LAYOUT.buildings.length).toBeGreaterThanOrEqual(8);
    expect(VISUAL_SLICE_LAYOUT.buildings.length).toBeLessThanOrEqual(12);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("todos los assets de la escena existen en el bundle runtime", () => {
    for (const building of VISUAL_SLICE_LAYOUT.buildings) {
      const asset = BUNDLE.buildings[building.type];
      expect(asset, building.type).toBeDefined();
      expect(asset!.states).toHaveProperty(building.state ?? "complete");
    }
    for (const prop of VISUAL_SLICE_LAYOUT.props) {
      expect(BUNDLE.props?.[prop.asset], prop.asset).toBeDefined();
    }
    for (const vehicle of VISUAL_SLICE_LAYOUT.vehicles) {
      expect(BUNDLE.vehicles?.[vehicle.asset], vehicle.asset).toBeDefined();
    }
    for (const tile of VISUAL_SLICE_LAYOUT.terrain) {
      expect(BUNDLE.terrain?.[tile.asset], tile.asset).toBeDefined();
    }
  });

  it("la avenida y la calle son continuas y comparten un cruce", () => {
    for (let y = ZONE_FROM; y <= ZONE_TO; y += 1) {
      const expected = y === STREET_Y ? "ter_road_intersection" : "ter_road_straight";
      const tile = VISUAL_SLICE_LAYOUT.terrain.find(
        (entry) => entry.cell.x === AVENUE_X && entry.cell.y === y,
      );
      expect(tile?.asset, `avenida x=${AVENUE_X} y=${y}`).toBe(expected);
    }
    for (let x = ZONE_FROM; x <= ZONE_TO; x += 1) {
      if (x === AVENUE_X) continue;
      const tile = VISUAL_SLICE_LAYOUT.terrain.find(
        (entry) => entry.cell.y === STREET_Y && entry.cell.x === x,
      );
      expect(tile?.asset, `calle y=${STREET_Y} x=${x}`).toBe("ter_road_straight");
    }
    expect(roadCells.size).toBe(VISUAL_SLICE_LAYOUT.terrain.length);
  });

  it("los vehículos circulan por la calzada y los edificios no la invaden", () => {
    for (const vehicle of VISUAL_SLICE_LAYOUT.vehicles) {
      expect(roadCells.has(key(vehicle.cell)), vehicle.asset).toBe(true);
    }
    for (const building of VISUAL_SLICE_LAYOUT.buildings) {
      expect(roadCells.has(key(building.cell)), building.type).toBe(false);
    }
    for (const prop of VISUAL_SLICE_LAYOUT.props) {
      expect(roadCells.has(key(prop.cell)), `${prop.asset} en ${key(prop.cell)}`).toBe(false);
    }
  });

  it("los elementos de escena caben en el mapa y no se apilan en la misma celda", () => {
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

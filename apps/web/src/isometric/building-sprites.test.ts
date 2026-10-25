import { describe, expect, it } from "vitest";
import type { BuildingAssetV1 } from "@landlord/shared";
import {
  assetFor,
  buildingAssetStateFor,
  depthForCell,
  directionIndexFor,
  originFromPivot,
  spriteKeyFor,
} from "./building-sprites";

const manifest = {
  buildings: {
    courtyard_home: { pivot: { x: 0.5, y: 0.93 } },
  },
} as unknown as import("@landlord/shared").RuntimeAssetManifestV1;

describe("WP4.15 sprites de edificios", () => {
  it("mapea el estado proyectado a los cuatro estados del contrato", () => {
    expect(buildingAssetStateFor("operational", 100)).toBe("complete");
    expect(buildingAssetStateFor("operational", 59)).toBe("damaged");
    expect(buildingAssetStateFor("burning", 100)).toBe("burning");
    expect(buildingAssetStateFor("collapse_pending", 80)).toBe("burning");
    expect(buildingAssetStateFor("ruin", 0)).toBe("damaged");
  });

  it("genera claves estables y encuentra el asset por tipo", () => {
    expect(spriteKeyFor("cement_plant", "burning")).toBe("building-cement_plant-burning");
    expect(assetFor(manifest, "courtyard_home")).toBeDefined();
    expect(assetFor(manifest, "steelworks")).toBeNull();
  });

  it("ordena el depth por fila isométrica y desempata por y y x", () => {
    expect(depthForCell({ x: 0, y: 0 })).toBe(0);
    expect(depthForCell({ x: 1, y: 0 })).toBe(1_001);
    expect(depthForCell({ x: 0, y: 1 })).toBe(1_010);
    expect(depthForCell({ x: 2, y: 1 })).toBeGreaterThan(depthForCell({ x: 1, y: 1 }));
    expect(depthForCell({ x: 1, y: 2 })).toBeGreaterThan(depthForCell({ x: 2, y: 1 }));
  });

  it("convierte el pivote normalizado en origen de Phaser", () => {
    const asset = { pivot: { x: 0.4, y: 0.9 } } as BuildingAssetV1;
    expect(originFromPivot(asset)).toEqual({ x: 0.4, y: 0.9 });
  });

  it("elige la dirección más cercana para 4 y 8 direcciones (0 = derecha, horario)", () => {
    expect(directionIndexFor(1, 0, 4)).toBe(0);
    expect(directionIndexFor(0, 1, 4)).toBe(1);
    expect(directionIndexFor(-1, 0, 4)).toBe(2);
    expect(directionIndexFor(0, -1, 4)).toBe(3);
    expect(directionIndexFor(1, 1, 8)).toBe(1);
    expect(directionIndexFor(0, 1, 8)).toBe(2);
    expect(directionIndexFor(-1, 0, 8)).toBe(4);
    expect(directionIndexFor(0, -1, 8)).toBe(6);
    expect(directionIndexFor(0, 0, 8)).toBe(0);
    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      expect(directionIndexFor(Math.cos(angle), Math.sin(angle), 8)).toBe(index);
    }
  });
});

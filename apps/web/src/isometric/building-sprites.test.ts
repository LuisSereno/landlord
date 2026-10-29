import { describe, expect, it } from "vitest";
import {
  parseRuntimeAssetManifest,
  type BuildingAssetV1,
  type RuntimeAssetManifestV2,
} from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import {
  animationFrameFor,
  assetFor,
  buildingAssetStateFor,
  CELL_METERS,
  depthForAsset,
  depthForCell,
  directionIndexFor,
  footprintCenter,
  framesPerDirection,
  originFromPivot,
  spriteKeyFor,
  spriteScaleFor,
} from "./building-sprites";

const ASSETS = parseRuntimeAssetManifest(runtimeAssets);

const manifest = {
  buildings: {
    courtyard_home: { pivot: { x: 0.5, y: 0.93 } },
  },
} as unknown as RuntimeAssetManifestV2;

/** La factoría dibuja la cara desplazada según la dirección: así se comprueba el frame real. */
function headCx(frameSrc: string): number {
  const svg = atob(frameSrc.replace(/^data:image\/svg\+xml;base64,/, ""));
  return Number(/<circle cx="(-?\d+)" cy="16"/.exec(svg)?.[1]);
}

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

  it("la huella participa en el depth y en la posición del sprite", () => {
    const oneByOne = { width: 1, height: 1 };
    const twoByTwo = { width: 2, height: 2 };
    expect(depthForAsset({ x: 3, y: 3 }, oneByOne)).toBe(depthForCell({ x: 3, y: 3 }));
    /** Una planta 2×2 tapa las celdas (4,3), (3,4) y (4,4): se dibuja después que todas ellas. */
    expect(depthForAsset({ x: 3, y: 3 }, twoByTwo)).toBe(depthForCell({ x: 4, y: 4 }));
    expect(depthForAsset({ x: 3, y: 3 }, twoByTwo)).toBeGreaterThan(
      depthForAsset({ x: 4, y: 3 }, oneByOne),
    );
    expect(depthForAsset({ x: 3, y: 3 }, twoByTwo)).toBeGreaterThan(
      depthForAsset({ x: 3, y: 4 }, oneByOne),
    );
    expect(footprintCenter({ x: 3, y: 3 }, oneByOne)).toEqual({ x: 3, y: 3 });
    expect(footprintCenter({ x: 3, y: 3 }, twoByTwo)).toEqual({ x: 3.5, y: 3.5 });
    expect(ASSETS.buildings["cement_plant"]!.footprint).toEqual(twoByTwo);
  });

  it("escala los renders Blender a la celda de 4 m y deja intactos los procedurales", () => {
    expect(CELL_METERS).toBe(4);
    expect(spriteScaleFor({}, 64)).toBe(1);
    /** Carretera Kenney: la loseta de 4 m debe medir la diagonal de la celda (64 px). */
    const roadPixelsPerMeter = 256 / 6;
    const roadScale = spriteScaleFor({ pixelsPerMeter: roadPixelsPerMeter }, 64);
    expect(242 * roadScale).toBeCloseTo(64, 0);
    /** Edificio Kenney: un comercio de ~3.5 m debe medir ~1 celda de ancho. */
    const buildingScale = spriteScaleFor({ pixelsPerMeter: 256 / 8.5 }, 64);
    expect(141 * buildingScale).toBeGreaterThan(45);
    expect(141 * buildingScale).toBeLessThan(60);
  });

  it("cada dirección camina con sus propios frames", () => {
    for (const character of Object.values(ASSETS.characters)) {
      const perDirection = framesPerDirection(character, "walk");
      expect(character.animations.walk.frames).toHaveLength(character.directions * perDirection);
      for (let direction = 0; direction < character.directions; direction += 1) {
        const angle = ((360 / character.directions) * direction * Math.PI) / 180;
        const expectedCx = 24 + Math.round(5 * Math.cos(angle));
        for (let phase = 0; phase < perDirection; phase += 1) {
          const walk = animationFrameFor(character, "walk", direction, phase);
          expect(headCx(walk.src), `${character.id} walk dir ${direction} fase ${phase}`).toBe(
            expectedCx,
          );
          const idle = animationFrameFor(character, "idle", direction, phase);
          expect(headCx(idle.src), `${character.id} idle dir ${direction} fase ${phase}`).toBe(
            expectedCx,
          );
        }
        /** La fase sólo recorre los frames de su dirección: no salta a la siguiente. */
        expect(animationFrameFor(character, "walk", direction, perDirection)).toEqual(
          animationFrameFor(character, "walk", direction, 0),
        );
      }
      /** Con 8 direcciones, mirar a la derecha y a la izquierda no puede dar el mismo frame. */
      if (character.directions === 8) {
        expect(animationFrameFor(character, "walk", 0, 0).src).not.toBe(
          animationFrameFor(character, "walk", 4, 0).src,
        );
      }
    }
  });
});

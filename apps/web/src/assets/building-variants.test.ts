import { describe, expect, it } from "vitest";
import {
  BUILDING_PHYSICAL_ORIENTATIONS,
  CONSTRUCTION_STAGES,
  buildingVariantKey,
  validateBuildingVariantManifest,
} from "@landlord/shared";
import {
  BUILDING_VARIANTS,
  hasRealVariants,
  resolveBuildingVariant,
  variantAsAsset,
  variantTextureKey,
} from "./building-variants";
import { buildingSpritePlan, resolveBuildingVisual } from "../isometric/building-sprites";

const TYPES = [
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
];

describe("V.j.5 manifiesto de variantes", () => {
  it("cumple el contrato y cubre 15 tipos × estados × orientaciones", () => {
    expect(validateBuildingVariantManifest(BUILDING_VARIANTS)).toEqual([]);
    expect(Object.keys(BUILDING_VARIANTS.variants)).toHaveLength(360);
    for (const type of TYPES) {
      expect(hasRealVariants(type)).toBe(true);
      for (const orientation of BUILDING_PHYSICAL_ORIENTATIONS) {
        for (const state of ["complete", "damaged", "burning"] as const) {
          expect(resolveBuildingVariant(type, state, orientation)).not.toBeNull();
        }
        for (const stage of CONSTRUCTION_STAGES) {
          expect(resolveBuildingVariant(type, "construction", orientation, stage)).not.toBeNull();
        }
      }
    }
  });

  it("clave canónica y textura por variante", () => {
    expect(buildingVariantKey("row_house", "burning", 90)).toBe("row_house:burning:-:90");
    expect(buildingVariantKey("row_house", "construction", 0, "structure")).toBe(
      "row_house:construction:structure:0",
    );
    expect(variantTextureKey("row_house", "damaged", 180)).toBe(
      "blender-variant-row_house:damaged:-:180",
    );
  });

  it("variante envuelta en BuildingAssetV2 no rota ni tiñe en pantalla", () => {
    const variant = resolveBuildingVariant("row_house", "complete", 0)!;
    const asset = variantAsAsset("row_house", variant);
    expect(asset.states.complete).toBe(variant.image);
    expect(asset.pivot).toEqual(variant.pivot);
    expect(asset.allowedOrientations).toEqual([45]);
  });
});

describe("V.j.5 resolución prioriza variante real sobre procedural", () => {
  const economy = {
    buildings: [
      {
        id: "b1",
        type: "row_house",
        state: "burning",
        condition: 100,
        orientation: 90,
        footprintCells: [{ x: 0, y: 0 }],
      },
    ],
    constructionSites: [
      {
        id: "s1",
        buildingType: "row_house",
        orientation: 180,
        progress: 0.4,
        workRequired: 1,
        footprintCells: [{ x: 1, y: 0 }],
      },
    ],
  } as never;

  it("el plan hilo orientación y etapa al resolver", () => {
    const seen: Array<[string, string, number, string | null]> = [];
    buildingSpritePlan(economy, {
      archetypeFor: (_id, type) => type,
      resolveVisual: (archetype, _type, state, orientation, stage) => {
        seen.push([archetype, state, orientation, stage]);
        return null;
      },
    });
    expect(seen).toContainEqual(["row_house", "burning", 90, null]);
    expect(seen).toContainEqual(["row_house", "construction", 180, "structure"]);
  });

  it("resolveBuildingVisual devuelve la variante real y no cae al procedural", () => {
    const resolved = resolveBuildingVisual("row_house", "row_house", "burning", {
      blenderBundle: undefined,
      proceduralBundle: { buildings: {} },
      textureExists: () => false,
      azimuth: 45,
      orientation: 90,
      resolveVariant: (type, state, orientation) => {
        const variant = resolveBuildingVariant(type, state, orientation);
        return variant
          ? {
              key: variantTextureKey(type, state, orientation),
              asset: variantAsAsset(type, variant),
            }
          : null;
      },
    });
    expect(resolved?.key).toBe("blender-variant-row_house:burning:-:90");
  });

  it("sin variante ni Blender, el procedural sigue sosteniendo tipos legacy", () => {
    const procedural = {
      buildings: {
        row_house: {
          states: { complete: {} },
          allowedOrientations: [45],
          symmetry: "none",
          pivot: { x: 0.5, y: 0.7 },
        },
      },
    } as never;
    const resolved = resolveBuildingVisual("row_house", "row_house", "complete", {
      blenderBundle: undefined,
      proceduralBundle: procedural,
      textureExists: () => true,
      azimuth: 45,
    });
    expect(resolved?.key).toBe("building-row_house-complete");
  });
});

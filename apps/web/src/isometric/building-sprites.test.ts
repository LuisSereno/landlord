import { describe, expect, it } from "vitest";
import {
  parseRuntimeAssetManifest,
  type BuildingAssetV1,
  type BuildingAssetState,
  type BuildingType,
  type RuntimeAssetManifestV2,
  type ViewProjectionV2,
} from "@landlord/shared";
import { BUILDING_DEFINITIONS } from "@landlord/simulation";
import runtimeAssets from "../generated/runtime-assets.json";
import {
  animationFrameFor,
  assetFor,
  buildingAssetStateFor,
  buildingSpritePlan,
  CELL_METERS,
  depthForAsset,
  depthForCell,
  depthForFootprintCells,
  directionIndexFor,
  footprintBounds,
  footprintCenter,
  footprintVisualCenter,
  framesPerDirection,
  originFromPivot,
  resolveBuildingVisual,
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

/**
 * H2-01 — los edificios y obras se colocan y ordenan por su huella física real, no por el anchor
 * de la parcela. Estos tests cubren los helpers puros y la paridad `sprites == edificios
 * proyectados renderizables`; la escena consume exactamente el mismo `buildingSpritePlan`.
 */
const FAKE_ASSET = {
  footprint: { width: 1, height: 1 },
  pivot: { x: 0.5, y: 0.93 },
  states: {},
} as unknown as BuildingAssetV1;

function planFor(
  economy: Pick<NonNullable<ViewProjectionV2["economy"]>, "buildings" | "constructionSites">,
) {
  return buildingSpritePlan(economy, {
    archetypeFor: (_id, domainType) => domainType,
    resolveVisual: () => ({ key: "resolved", asset: FAKE_ASSET }),
  });
}

describe("H2-01 huella física y paridad del plan de sprites", () => {
  it("footprintBounds devuelve el bounding box de las celdas", () => {
    const cells = [
      { x: 4, y: 7 },
      { x: 5, y: 7 },
      { x: 4, y: 8 },
      { x: 5, y: 8 },
      { x: 6, y: 9 },
    ];
    expect(footprintBounds(cells)).toEqual({
      minX: 4,
      minY: 7,
      maxX: 6,
      maxY: 9,
      width: 3,
      height: 3,
    });
    expect(() => footprintBounds([])).toThrow(RangeError);
  });

  it("footprintVisualCenter es el punto medio del bounding box, no el anchor", () => {
    /** Huella 2×2 desplazada: el anchor (4,7) no coincide con el centro visual. */
    expect(footprintVisualCenter([{ x: 4, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 8 }, { x: 5, y: 8 }])).toEqual({
      x: 4.5,
      y: 7.5,
    });
    /** Huella impar: el centro cae en una celda entera. */
    expect(footprintVisualCenter([{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }])).toEqual({
      x: 3,
      y: 3,
    });
  });

  it("depthForFootprintCells usa la celda físicamente más próxima a cámara", () => {
    const cells = [{ x: 3, y: 3 }];
    expect(depthForFootprintCells(cells)).toBe(depthForCell({ x: 3, y: 3 }));
    /** Un 2×2 hacia el sureste tapa (4,4): se ordena por esa celda, no por el anchor (3,3). */
    const block = [
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ];
    expect(depthForFootprintCells(block)).toBe(depthForCell({ x: 4, y: 4 }));
    /** Una huella con una celda más al sur-este se ordena por ella, aunque el bounding box sea el mismo. */
    expect(depthForFootprintCells([{ x: 3, y: 3 }, { x: 4, y: 4 }])).toBe(depthForCell({ x: 4, y: 4 }));
  });

  it("una parcela con dos edificios produce dos entradas en el plan con celdas distintas", () => {
    /**
     * Parcela multi-celda con dos edificios: cada uno publica su `footprintCells` y sus propias
     * coordenadas. Antes el scene resolvía la parcela buscando `parcel.buildingId === building.id`
     * y colocaba ambos en el anchor; aquí se comprueba que el plan no puede volver a hacerlo.
     */
    const economy = {
      buildings: [
        {
          id: "b1",
          parcelId: "p1",
          districtId: "d1",
          type: "row_house",
          footprintCells: [
            { x: 4, y: 6 },
            { x: 5, y: 6 },
          ],
          orientation: 0,
          floors: 2,
          form: "row",
          level: 1,
          condition: 100,
          state: "operational",
        },
        {
          id: "b2",
          parcelId: "p1",
          districtId: "d1",
          type: "row_house",
          footprintCells: [
            { x: 10, y: 12 },
            { x: 11, y: 12 },
          ],
          orientation: 0,
          floors: 2,
          form: "row",
          level: 1,
          condition: 60,
          state: "operational",
        },
      ],
      constructionSites: [],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;

    const plan = planFor(economy);
    expect(plan.map((entry) => entry.id)).toEqual(["building:b1", "building:b2"]);
    /** Cada entrada arrastra su propia huella: el plan no puede volver a derivarla de la parcela. */
    expect(plan[0]!.cells).toEqual([
      { x: 4, y: 6 },
      { x: 5, y: 6 },
    ]);
    expect(plan[1]!.cells).toEqual([
      { x: 10, y: 12 },
      { x: 11, y: 12 },
    ]);
    /** Centros visuales y depths distintos: la escena pinta dos sprites separados. */
    expect(footprintVisualCenter(plan[0]!.cells)).not.toEqual(footprintVisualCenter(plan[1]!.cells));
    expect(depthForFootprintCells(plan[1]!.cells)).toBeGreaterThan(
      depthForFootprintCells(plan[0]!.cells),
    );
  });

  it("un ConstructionSite con huella desplazada respecto al anchor se coloca en su huella", () => {
    const economy = {
      buildings: [],
      constructionSites: [
        {
          id: "s1",
          parcelId: "p1",
          districtId: "d1",
          buildingType: "row_house",
          /**
           * El anchor de la parcela podría ser (0,0); el sitio tiene su huella en (8,4)..(9,5).
           * El renderer no debe usar el anchor para colocarlo (H2-01).
           */
          footprintCells: [
            { x: 8, y: 4 },
            { x: 9, y: 4 },
            { x: 8, y: 5 },
            { x: 9, y: 5 },
          ],
          orientation: 0,
          floors: 2,
          form: "row",
          progress: 10,
          workRequired: 100,
          kind: "construction",
        },
      ],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;

    const plan = planFor(economy);
    expect(plan).toHaveLength(1);
    expect(plan[0]!.id).toBe("site:s1");
    expect(footprintVisualCenter(plan[0]!.cells)).toEqual({ x: 8.5, y: 4.5 });
    /** Sesgo de depth +1: la obra siempre se pinta por encima del suelo de la parcela. */
    expect(plan[0]!.depthBias).toBe(1);
    /** El estado visual es la variante "construction", no la de un edificio ya terminado. */
    expect(plan[0]!.assetState).toBe("construction");
  });

  it("paridad: el plan es exactamente un sprite por cada edificio y obra proyectados", () => {
    /**
     * invariant guardado — si una proyección publica N edificios y M obras y todos resuelven un
     * asset, el plan tiene N+M entradas. Sin esta prueba, una regresión como la de H2-01 puede
     * volver a esconder edificios sin que ningún test lo note.
     */
    const economy = {
      buildings: [
        { id: "b1", type: "row_house", condition: 100, state: "operational", footprintCells: [{ x: 1, y: 1 }] },
        { id: "b2", type: "row_house", condition: 100, state: "operational", footprintCells: [{ x: 2, y: 2 }] },
        { id: "b3", type: "clinic", condition: 100, state: "operational", footprintCells: [{ x: 3, y: 3 }] },
      ],
      constructionSites: [
        { id: "s1", buildingType: "workshop", footprintCells: [{ x: 4, y: 4 }], kind: "construction" },
      ],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;
    const plan = planFor(economy);
    expect(plan).toHaveLength(economy.buildings.length + economy.constructionSites.length);
    const ids = new Set(plan.map((entry) => entry.id));
    for (const building of economy.buildings) expect(ids.has(`building:${building.id}`)).toBe(true);
    for (const site of economy.constructionSites) expect(ids.has(`site:${site.id}`)).toBe(true);
  });

  it("una huella eliminada de la proyección sólo borra su sprite, no el del hermano", () => {
    /**
     * Dos edificios de la misma parcela: se quita `b2` de la proyección; el plan sigue devolviendo
     * `b1` con su huella. Antes la resolución por parcela hacía que ambos dependieran de la misma
     * `parcel.cell`, así que quitar uno no era verificable —no había plan puro—.
     */
    const both = {
      buildings: [
        { id: "b1", type: "row_house", condition: 100, state: "operational", footprintCells: [{ x: 1, y: 1 }] },
        { id: "b2", type: "row_house", condition: 100, state: "operational", footprintCells: [{ x: 2, y: 2 }] },
      ],
      constructionSites: [],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;
    const onlyFirst = {
      buildings: [both.buildings[0]!],
      constructionSites: [],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;
    const before = planFor(both).map((entry) => entry.id);
    const after = planFor(onlyFirst).map((entry) => entry.id);
    expect(before).toEqual(["building:b1", "building:b2"]);
    expect(after).toEqual(["building:b1"]);
  });

  it("una entrada sin asset resoluble se omite; con H2-02 cerrado esto debe ser cero", () => {
    /**
     * Contrato explícito: el plan es la paridad contra "renderizables", no contra todos los
     * proyectados. Cuando el catálogo procedural cubra los 15 tipos (H2-02), ningún edificio
     * real quedará fuera; mientras falte un tipo, el test lo hace visible en lugar de ocultarlo.
     */
    const economy = {
      buildings: [
        { id: "b1", type: "row_house", condition: 100, state: "operational", footprintCells: [{ x: 1, y: 1 }] },
        { id: "b2", type: "warehouse", condition: 100, state: "operational", footprintCells: [{ x: 2, y: 2 }] },
      ],
      constructionSites: [],
    } as unknown as Pick<
      NonNullable<ViewProjectionV2["economy"]>,
      "buildings" | "constructionSites"
    >;
    const plan = buildingSpritePlan(economy, {
      archetypeFor: (_id, domainType) => domainType,
      resolveVisual: (_archetype, domainType) =>
        domainType === "warehouse" ? null : { key: "resolved", asset: FAKE_ASSET },
    });
    expect(plan.map((entry) => entry.id)).toEqual(["building:b1"]);
  });
});

/**
 * H2-02 · el contrato de `resolveBuildingVisual` dice "un edificio nunca desaparece por falta de
 * un Blender". El test simula esa ausencia y comprueba que los 15 tipos del catálogo de dominio
 * resuelven una textura procedural válida. Si un tipo nuevo entra en `BUILDING_DEFINITIONS` sin
 * fallback, este test falla antes de que el render pierda el edificio.
 */
const ALL_BUILDING_STATES: BuildingAssetState[] = ["complete", "construction", "damaged", "burning"];

describe("H2-02 ausencia de Blender → fallback procedural para los 15 tipos", () => {
  it("cada BuildingType del catálogo resuelve una textura procedural válida sin Blender", () => {
    const proceduralBundle = ASSETS;
    const emptyBlender = { buildings: {} };
    const types = Object.keys(BUILDING_DEFINITIONS) as BuildingType[];
    /** Invariante estructural: 15 tipos, no una lista mantenida a mano. */
    expect(types).toHaveLength(15);
    for (const type of types) {
      for (const state of ALL_BUILDING_STATES) {
        const resolved = resolveBuildingVisual(type, type, state, {
          blenderBundle: emptyBlender,
          proceduralBundle,
          textureExists: () => true,
          azimuth: 45,
        });
        expect(
          resolved,
          `${type}:${state} — el catálogo procedural debe sostener el fallback sin Blender`,
        ).not.toBeNull();
        expect(resolved!.key).toBe(spriteKeyFor(type, state));
        expect(resolved!.asset.states[state]).toBeDefined();
      }
    }
  });

  it("un Blender corrupto (textura no registrada) tampoco tumba el fallback", () => {
    /**
     * Cadena Blender → texture.exists() → procedural: si la clave Blender está declarada en el
     * bundle pero la textura no se cargó (caso C de la degradación por asset), el procedural
     * cubre igualmente. Era el mismo bug de H2-02 pero por el lado de la carga.
     */
    const blenderBundle = {
      buildings: Object.fromEntries(
        Object.keys(BUILDING_DEFINITIONS).map((t) => [
          t,
          {
            type: t,
            name: t,
            footprint: { width: 1, height: 1 },
            domainFootprint: { width: 1, height: 1 },
            pivot: { x: 0.5, y: 0.93 },
            states: {},
            allowedOrientations: [45],
            symmetry: "none",
          },
        ]),
      ),
    };
    for (const type of Object.keys(BUILDING_DEFINITIONS) as BuildingType[]) {
      const resolved = resolveBuildingVisual(type, type, "complete", {
        blenderBundle: blenderBundle as unknown as RuntimeAssetManifestV2,
        proceduralBundle: ASSETS,
        /** Ninguna textura Blender está realmente cargada: el helper debe caer al procedural. */
        textureExists: (key) => !key.startsWith("blender-building-"),
        azimuth: 45,
      });
      expect(resolved, type).not.toBeNull();
      expect(resolved!.key).toBe(spriteKeyFor(type, "complete"));
    }
  });

  it("un azimut no declarado por el asset procedural devuelve null: el renderer no inventa", () => {
    /**
     * El procedural sólo declara `[45]` con `symmetry: "none"`. Para 135/225/315 el helper tiene
     * que rechazar pintar el edificio en lugar de usar un frame ilegal: eso es H2-03 y la
     * deuda visual de orientación.
     */
    for (const azimuth of [135, 225, 315]) {
      for (const type of Object.keys(BUILDING_DEFINITIONS) as BuildingType[]) {
        const resolved = resolveBuildingVisual(type, type, "complete", {
          blenderBundle: undefined,
          proceduralBundle: ASSETS,
          textureExists: () => true,
          azimuth,
        });
        expect(resolved, `${type} @ ${azimuth}`).toBeNull();
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import type { ViewProjectionV2 } from "@landlord/shared";
import type { RuntimeAssetManifestV1 } from "@landlord/shared";
import blenderBundle from "../generated/runtime-assets-blender.json";
import {
  buildGameplayVisualModel,
  gameplayGeometryKey,
  planGameplayDecorations,
  planGameplayGround,
  deriveRoadMarkings,
  planGameplayParkedVehicles,
  planGameplayStreetFurniture,
  deriveRoadVisuals,
  visualArchetypeForBuilding,
} from "./gameplay-visual-adapter";

const BLENDER_BUNDLE = blenderBundle as unknown as RuntimeAssetManifestV1;

type ParcelInput = {
  id: string;
  cell: { x: number; y: number };
  zoning: "residential" | "industrial" | "mixed";
  ownerOrganizationId: string | null;
  buildingId: string | null;
};

type BuildingInput = {
  id: string;
  type: string;
  parcelId: string;
  state: "operational" | "burning" | "collapse_pending" | "ruin";
  condition: number;
};

type SiteInput = { id: string; parcelId: string; buildingType: string };

function projection(
  parcels: ParcelInput[],
  buildings: BuildingInput[],
  sites: SiteInput[],
  roads: string[] = [],
  digest = roads.length > 0 ? "road-fixture" : "811c9dc5",
): ViewProjectionV2 {
  return {
    projectionVersion: 1,
    tick: 0,
    map: { width: 64, height: 64, roads: { revision: 0, digest, cells: roads } },
    structures: [],
    agents: [],
    economy: {
      parcels,
      buildings,
      constructionSites: sites,
      cash: 12000,
    },
  } as unknown as ViewProjectionV2;
}

const PARCELS: ParcelInput[] = [
  {
    id: "par_1",
    cell: { x: 10, y: 10 },
    zoning: "residential",
    ownerOrganizationId: "org_1",
    buildingId: "bld_1",
  },
  {
    id: "par_2",
    cell: { x: 14, y: 10 },
    zoning: "mixed",
    ownerOrganizationId: "org_1",
    buildingId: "bld_2",
  },
  {
    id: "par_3",
    cell: { x: 18, y: 10 },
    zoning: "industrial",
    ownerOrganizationId: "org_2",
    buildingId: "bld_3",
  },
  {
    id: "par_4",
    cell: { x: 10, y: 16 },
    zoning: "residential",
    ownerOrganizationId: null,
    buildingId: null,
  },
  {
    id: "par_5",
    cell: { x: 14, y: 16 },
    zoning: "residential",
    ownerOrganizationId: "org_1",
    buildingId: null,
  },
];

const BUILDINGS: BuildingInput[] = [
  { id: "bld_1", type: "courtyard_home", parcelId: "par_1", state: "operational", condition: 90 },
  { id: "bld_2", type: "workshop", parcelId: "par_2", state: "operational", condition: 40 },
  { id: "bld_3", type: "cement_plant", parcelId: "par_3", state: "operational", condition: 80 },
];

const SITES: SiteInput[] = [{ id: "site_1", parcelId: "par_5", buildingType: "courtyard_home" }];

function streetDressingRoads() {
  const cells: string[] = [];
  for (let x = 4; x <= 20; x += 1) cells.push(`${x}:10`);
  for (let y = 4; y <= 16; y += 1) cells.push(`10:${y}`);
  for (let y = 5; y <= 15; y += 1) cells.push(`5:${y}`);
  for (let x = 5; x <= 12; x += 1) cells.push(`${x}:5`);
  for (let x = 4; x <= 12; x += 1) cells.push(`${x}:20`);
  for (let y = 16; y <= 20; y += 1) cells.push(`5:${y}`);
  return deriveRoadVisuals({ digest: "street-dressing-fixture", cells });
}

describe("gameplay visual adapter (WP4.15-V.c.1)", () => {
  it("es determinista: la misma proyección produce el mismo modelo visual", () => {
    const first = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES));
    const second = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES));
    expect([...second.groundPlan.surfaces.entries()]).toEqual([
      ...first.groundPlan.surfaces.entries(),
    ]);
    expect(second.decorations).toEqual(first.decorations);
    expect(second.buildings).toEqual(first.buildings);
    expect(second.geometryKey).toBe(first.geometryKey);
  });

  it("asigna un archetype estable por identidad de edificio", () => {
    const a = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    const b = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    expect(a).toBe(b);
    expect([
      "bld_residential_a",
      "bld_residential_b",
      "bld_residential_c",
      "courtyard_home",
    ]).toContain(a);
  });

  it("resuelve workshop a un archetype comercial compatible", () => {
    const archetype = visualArchetypeForBuilding("workshop", "bld_00000042");
    expect(["bld_shopfront", "bld_commercial_b", "bld_commercial_c"]).toContain(archetype);
  });

  it("mantiene los tipos industriales en su tipo de dominio (fallback procedural honesto)", () => {
    for (const type of ["cement_plant", "brickworks", "steelworks"]) {
      expect(visualArchetypeForBuilding(type, "bld_x")).toBe(type);
    }
  });

  it("no clasifica huecos entre parcelas como carretera: sin asfalto en el plan de gameplay", () => {
    const plan = planGameplayGround(
      PARCELS.map((p) => ({ id: p.id, cell: p.cell, zoning: p.zoning, buildingId: p.buildingId })),
      new Set<string>(),
      64,
      64,
    );
    const surfaces = new Set(plan.surfaces.values());
    expect(surfaces.has("asphalt")).toBe(false);
    expect(plan.crossings).toEqual([]);
  });

  it("pinta roads.cells como asphalt con precedencia sobre parcela y apron", () => {
    const roadCells = ["10:10", "11:10", "14:10"];
    const model = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES, roadCells));
    expect(model.groundPlan.surfaces.get("10:10")).toBe("asphalt"); // parcela residencial
    expect(model.groundPlan.surfaces.get("11:10")).toBe("asphalt"); // apron grass
    expect(model.groundPlan.surfaces.get("14:10")).toBe("asphalt"); // parcela pavement
    expect(model.roadVisuals.map((road) => `${road.cell.x}:${road.cell.y}`)).toEqual(roadCells);
  });

  it("mantiene visible la road cell que da frontage a una parcela", () => {
    const plan = planGameplayGround(
      PARCELS.map((p) => ({ id: p.id, cell: p.cell, zoning: p.zoning, buildingId: p.buildingId })),
      new Set<string>(),
      64,
      64,
      ["11:10"],
    );
    const parcel = PARCELS[0]!;
    const hasVisibleFrontage = [
      `${parcel.cell.x + 1}:${parcel.cell.y}`,
      `${parcel.cell.x - 1}:${parcel.cell.y}`,
      `${parcel.cell.x}:${parcel.cell.y + 1}`,
      `${parcel.cell.x}:${parcel.cell.y - 1}`,
    ].some((key) => plan.surfaces.get(key) === "asphalt");
    expect(hasVisibleFrontage).toBe(true);
  });

  it("usa datos reales para superficies de parcela", () => {
    const plan = planGameplayGround(
      PARCELS.map((p) => ({ id: p.id, cell: p.cell, zoning: p.zoning, buildingId: p.buildingId })),
      new Set(["par_5"]),
      64,
      64,
    );
    expect(plan.surfaces.get("10:10")).toBe("gravel"); // residential built → apron
    expect(plan.surfaces.get("14:10")).toBe("pavement"); // mixed built
    expect(plan.surfaces.get("18:10")).toBe("gravel"); // industrial built
    expect(plan.surfaces.get("10:16")).toBe("dirt"); // vacant
    expect(plan.surfaces.get("14:16")).toBe("construction"); // construction site
    expect(plan.surfaces.get("11:10")).toBe("grass"); // residential apron ring
  });

  it("no coloca decoración sobre una parcela construida ni sobre su entorno inmediato", () => {
    const built = PARCELS.map((p) => ({
      id: p.id,
      cell: p.cell,
      zoning: p.zoning,
      buildingId: p.buildingId,
    }));
    const { decorations } = planGameplayDecorations(built, new Set(["par_5"]), 64, 64);
    const builtCells = new Set(
      built.filter((p) => p.buildingId).map((p) => `${p.cell.x}:${p.cell.y}`),
    );
    for (const decoration of decorations) {
      expect(builtCells.has(`${decoration.cell.x}:${decoration.cell.y}`)).toBe(false);
    }
  });

  it("no coloca decoración sobre ninguna road cell", () => {
    const roadCells = ["1:1", "10:16", "11:10", "13:13"];
    const model = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES, roadCells));
    const roadSet = new Set(roadCells);
    for (const decoration of model.decorations) {
      expect(roadSet.has(`${decoration.cell.x}:${decoration.cell.y}`)).toBe(false);
    }
    expect(model.groundPlan.treeCells).toEqual(
      expect.arrayContaining(model.decorations.map((decoration) => decoration.cell)),
    );
  });

  it("deriva los 16 masks de road de forma determinista", () => {
    const neighbours = [
      { key: "0:-1", bit: 1 },
      { key: "1:0", bit: 2 },
      { key: "0:1", bit: 4 },
      { key: "-1:0", bit: 8 },
    ];
    const expected: Array<[string, string]> = [
      ["isolated", "isolated"],
      ["endpoint", "endpoint_n"],
      ["endpoint", "endpoint_e"],
      ["corner", "corner_ne"],
      ["endpoint", "endpoint_s"],
      ["straight", "straight_ns"],
      ["corner", "corner_se"],
      ["t_junction", "t_w"],
      ["endpoint", "endpoint_w"],
      ["corner", "corner_nw"],
      ["straight", "straight_ew"],
      ["t_junction", "t_s"],
      ["corner", "corner_sw"],
      ["t_junction", "t_e"],
      ["t_junction", "t_n"],
      ["intersection", "intersection"],
    ];
    for (let mask = 0; mask < 16; mask += 1) {
      const roads = [
        "0:0",
        ...neighbours.filter(({ bit }) => (mask & bit) !== 0).map(({ key }) => key),
      ];
      const visual = deriveRoadVisuals({ digest: `mask-${mask}`, cells: roads }).find(
        (entry) => entry.cell.x === 0 && entry.cell.y === 0,
      )!;
      expect([visual.shape, visual.orientation]).toEqual(expected[mask]);
      expect(visual.mask).toBe(mask);
    }
  });

  it("sólo asigna lenguaje peatonal a T e intersecciones y conserva sus bocas reales", () => {
    const roads = [
      // T: N+E+S (sin oeste), con sus vecinos.
      "10:10",
      "10:9",
      "11:10",
      "10:11",
      // Cruce completo, con sus vecinos.
      "20:20",
      "20:19",
      "21:20",
      "20:21",
      "19:20",
      // Recta: queda deliberadamente sin marcas en esta subfase.
      "30:30",
      "30:29",
      "30:31",
    ];
    expect(deriveRoadMarkings({ digest: "junction-fixture", cells: roads })).toEqual([
      { cell: { x: 10, y: 10 }, mask: 7 },
      { cell: { x: 20, y: 20 }, mask: 15 },
    ]);
  });

  it("incluye las marcas viales derivadas en el GroundPlan sin crear una topología nueva", () => {
    const roads = ["10:10", "10:9", "11:10", "10:11"];
    const model = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES, roads));
    expect(model.groundPlan.roadMarkings).toEqual([{ cell: { x: 10, y: 10 }, mask: 7 }]);
  });

  it("planifica street furniture determinista, sin hosts ilegales ni semáforos en T", () => {
    const roads = streetDressingRoads();
    const parcels = [
      { id: "res", cell: { x: 12, y: 8 }, zoning: "residential", buildingId: "b" },
      { id: "mixed", cell: { x: 16, y: 9 }, zoning: "mixed", buildingId: "c" },
      { id: "industrial", cell: { x: 17, y: 11 }, zoning: "industrial", buildingId: "i" },
    ];
    const trees = [{ x: 13, y: 9 }];
    const first = planGameplayStreetFurniture(roads, parcels, new Set(), trees, 32, 32);
    const second = planGameplayStreetFurniture(roads, parcels, new Set(), trees, 32, 32);
    expect(second).toEqual(first);
    expect(new Set(first.map((entry) => entry.id)).size).toBe(first.length);
    const intersections = roads.filter((road) => road.shape === "intersection");
    expect(first.filter((entry) => entry.kind === "traffic_light")).toHaveLength(
      intersections.length * 2,
    );
    expect(first.some((entry) => entry.roadCell.x === 5 && entry.roadCell.y === 20)).toBe(false);
    for (const entry of first) {
      expect(
        roads.some((road) => `${road.cell.x}:${road.cell.y}` === `${entry.cell.x}:${entry.cell.y}`),
      ).toBe(false);
      expect(
        parcels.some(
          (parcel) => `${parcel.cell.x}:${parcel.cell.y}` === `${entry.cell.x}:${entry.cell.y}`,
        ),
      ).toBe(false);
      expect(trees).not.toContainEqual(entry.cell);
    }
  });

  it("planifica vehículos aparcados sólo en rectas, con clearance y orientación de manifest", () => {
    const roads = streetDressingRoads();
    const parcels = [
      { id: "res", cell: { x: 12, y: 8 }, zoning: "residential", buildingId: "b" },
      { id: "mixed", cell: { x: 16, y: 9 }, zoning: "mixed", buildingId: "c" },
    ];
    const furniture = planGameplayStreetFurniture(roads, parcels, new Set(), [], 32, 32);
    const vehicles = planGameplayParkedVehicles(roads, parcels, new Set(), [], furniture, 32, 32);
    expect(vehicles.length).toBeGreaterThan(0);
    expect(new Set(vehicles.map((vehicle) => vehicle.id)).size).toBe(vehicles.length);
    for (const vehicle of vehicles) {
      const road = roads.find(
        (entry) =>
          `${entry.cell.x}:${entry.cell.y}` === `${vehicle.roadCell.x}:${vehicle.roadCell.y}`,
      )!;
      expect(road.shape).toBe("straight");
      expect([45, 225]).toContain(vehicle.azimuth);
      expect(
        roads
          .filter((entry) => entry.shape === "t_junction" || entry.shape === "intersection")
          .every(
            (junction) =>
              Math.abs(junction.cell.x - vehicle.roadCell.x) +
                Math.abs(junction.cell.y - vehicle.roadCell.y) >
              2,
          ),
      ).toBe(true);
    }
  });

  it("usa sólo assets y azimuts existentes en el bundle Blender aprobado", () => {
    const props = BLENDER_BUNDLE.props!;
    const vehicles = BLENDER_BUNDLE.vehicles!;
    expect(props.prp_street_light).toBeDefined();
    expect(props.prp_traffic_light).toBeDefined();
    expect(props.prp_bench).toBeDefined();
    expect(props.prp_trash_can).toBeDefined();
    expect(vehicles.veh_sedan).toBeDefined();
    expect(vehicles.veh_taxi).toBeDefined();
    expect(vehicles.veh_truck).toBeDefined();
    for (const asset of [
      props.prp_traffic_light!,
      vehicles.veh_sedan!,
      vehicles.veh_taxi!,
      vehicles.veh_truck!,
    ]) {
      expect(asset.orientations?.["225"]).toBeDefined();
    }
  });

  it("mantiene street dressing y vehículos aunque cambien caja, tick o condición", () => {
    const roads = streetDressingRoads().map((road) => `${road.cell.x}:${road.cell.y}`);
    const first = projection(PARCELS, BUILDINGS, SITES, roads, "street-dressing");
    const mutated = projection(PARCELS, BUILDINGS, SITES, roads, "street-dressing");
    (mutated as { tick: number }).tick = 777;
    (mutated.economy as { cash: number }).cash = 2;
    mutated.economy!.buildings = BUILDINGS.map((building) => ({
      ...building,
      condition: 10,
    })) as never;
    const firstModel = buildGameplayVisualModel(first);
    const secondModel = buildGameplayVisualModel(mutated);
    expect(secondModel.streetFurniture).toEqual(firstModel.streetFurniture);
    expect(secondModel.parkedVehicles).toEqual(firstModel.parkedVehicles);
  });

  it("reutiliza la representación vial cuando digest y cells canónicas no cambian", () => {
    const first = deriveRoadVisuals({ digest: "cached-roads", cells: ["2:1", "1:1"] });
    const second = deriveRoadVisuals({ digest: "cached-roads", cells: ["1:1", "2:1"] });
    expect(second).toBe(first);
  });

  it("la clave de geometría ignora cambios económicos no espaciales", () => {
    const spatial = projection(PARCELS, BUILDINGS, SITES);
    const mutated = projection(PARCELS, BUILDINGS, SITES);
    // Same geometry, different tick / cash / condition.
    (mutated as { tick: number }).tick = 9999;
    (mutated.economy as { cash: number }).cash = 5_000_000;
    const econ = mutated.economy!;
    econ.buildings = BUILDINGS.map((b) => ({
      ...b,
      condition: 12,
    })) as unknown as typeof econ.buildings;
    expect(gameplayGeometryKey(mutated)).toBe(gameplayGeometryKey(spatial));
  });

  it("la clave de geometría cambia cuando cambia la colocación de parcelas", () => {
    const before = gameplayGeometryKey(projection(PARCELS, BUILDINGS, SITES));
    const relocated = PARCELS.map((p) => ({ ...p, cell: { x: p.cell.x + 1, y: p.cell.y } }));
    const after = gameplayGeometryKey(projection(relocated, BUILDINGS, SITES));
    expect(after).not.toBe(before);
  });

  it("incluye el digest vial en la geometría sin depender del orden de cells", () => {
    const first = projection(PARCELS, BUILDINGS, SITES, ["11:10", "10:10"], "roads-a");
    const same = projection(PARCELS, BUILDINGS, SITES, ["10:10", "11:10"], "roads-a");
    const changed = projection(PARCELS, BUILDINGS, SITES, ["11:10", "10:10"], "roads-b");
    expect(gameplayGeometryKey(first)).toBe(gameplayGeometryKey(same));
    expect(gameplayGeometryKey(changed)).not.toBe(gameplayGeometryKey(first));
  });

  it("no añade cruces ni campos de composición del Visual Slice al plan de gameplay", () => {
    const model = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES));
    expect(model.groundPlan.worksLot).toBeUndefined();
    expect(model.groundPlan.access).toBeUndefined();
    expect(model.groundPlan.zone).toBeUndefined();
  });
});

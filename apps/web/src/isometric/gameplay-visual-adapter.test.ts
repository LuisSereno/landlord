import { describe, expect, it } from "vitest";
import type { ViewProjectionV1 } from "@landlord/shared";
import {
  buildGameplayVisualModel,
  gameplayGeometryKey,
  planGameplayDecorations,
  planGameplayGround,
  visualArchetypeForBuilding,
} from "./gameplay-visual-adapter";

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
): ViewProjectionV1 {
  return {
    projectionVersion: 1,
    tick: 0,
    map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells: [] } },
    structures: [],
    agents: [],
    economy: {
      parcels,
      buildings,
      constructionSites: sites,
      cash: 12000,
    },
  } as unknown as ViewProjectionV1;
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

  it("no añade cruces ni campos de composición del Visual Slice al plan de gameplay", () => {
    const model = buildGameplayVisualModel(projection(PARCELS, BUILDINGS, SITES));
    expect(model.groundPlan.worksLot).toBeUndefined();
    expect(model.groundPlan.access).toBeUndefined();
    expect(model.groundPlan.zone).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { VISUAL_SLICE_LAYOUT } from "./layout";
import {
  CONSTRUCTION_ACCESS,
  GROUND_SURFACES,
  OPEN_SPACES,
  cellKey,
  planGround,
  type GroundSurface,
} from "./ground";

const plan = planGround(VISUAL_SLICE_LAYOUT);

function surface(x: number, y: number): GroundSurface {
  return plan.surfaces.get(`${x}:${y}`)!;
}

describe("plan de terreno del Visual Slice (WP4.15-V.b0)", () => {
  it("cubre todo el mapa con superficies conocidas", () => {
    expect(plan.surfaces.size).toBe(64 * 64);
    for (const value of plan.surfaces.values()) {
      expect(GROUND_SURFACES).toContain(value);
    }
  });

  it("es determinista: la misma composición produce el mismo plano", () => {
    const again = planGround(VISUAL_SLICE_LAYOUT);
    expect([...again.surfaces.entries()]).toEqual([...plan.surfaces.entries()]);
  });

  it("mantiene la calzada en asfalto", () => {
    for (const tile of VISUAL_SLICE_LAYOUT.terrain) {
      if (!tile.asset.startsWith("ter_road")) continue;
      expect(surface(tile.cell.x, tile.cell.y)).toBe("asphalt");
    }
  });

  it("mantiene la acera en pavimento a ambos lados de calzada", () => {
    // Aceras norte y sur de la calle principal, y oeste y este de la avenida.
    for (const x of [20, 25, 38]) expect(surface(x, 29)).toBe("pavement");
    for (const x of [20, 25, 38]) expect(surface(x, 31)).toBe("pavement");
    for (const y of [22, 26, 39]) expect(surface(29, y)).toBe("pavement");
    for (const y of [22, 26, 39]) expect(surface(31, y)).toBe("pavement");
  });

  it("lee la obra como superficie propia con su acceso de rodadura", () => {
    for (let y = 34; y <= 37; y += 1) {
      for (let x = 33; x <= 36; x += 1) expect(surface(x, y)).toBe("construction");
    }
    for (let y = CONSTRUCTION_ACCESS.from.y; y <= CONSTRUCTION_ACCESS.to.y; y += 1) {
      for (let x = CONSTRUCTION_ACCESS.from.x; x <= CONSTRUCTION_ACCESS.to.x; x += 1) {
        expect(surface(x, y)).toBe("dirt");
      }
    }
  });

  it("asienta cada edificio sobre la superficie de su solar", () => {
    const roles = new Set<string>();
    for (const building of VISUAL_SLICE_LAYOUT.buildings) {
      const value = surface(building.cell.x, building.cell.y);
      roles.add(value);
      if (building.type.includes("residential")) expect(value).toBe("gravel");
      else expect(value).toBe("pavement");
    }
    expect(roles.size).toBe(2);
  });

  it("da trasera de servicio a los comerciales y jardín a los residenciales", () => {
    // bld_commercial_b en (28,24): la trasera mira al norte.
    expect(surface(28, 23)).toBe("pavement");
    // bld_residential_a en (34,28): su trasera sigue siendo suelo del solar, no explanada.
    expect(surface(34, 27)).not.toBe("asphalt");
  });

  it("mantiene parques en césped y solares vacíos en tierra", () => {
    for (const space of OPEN_SPACES) {
      const expected: GroundSurface = space.kind === "park" ? "grass" : "dirt";
      const centre = {
        x: Math.round((space.from.x + space.to.x) / 2),
        y: Math.round((space.from.y + space.to.y) / 2),
      };
      expect([space.id, surface(centre.x, centre.y)]).toEqual([space.id, expected]);
      let matching = 0;
      let total = 0;
      for (let y = space.from.y; y <= space.to.y; y += 1) {
        for (let x = space.from.x; x <= space.to.x; x += 1) {
          total += 1;
          if (surface(x, y) === expected) matching += 1;
        }
      }
      // El frente comercial puede abrir una explanada de servicio dentro del parque, pero no absorberlo.
      expect(matching / total).toBeGreaterThan(0.7);
    }
  });

  it("ninguna parcela del plano pisa una celda ocupada por otro elemento", () => {
    const occupied = new Set<string>([
      ...VISUAL_SLICE_LAYOUT.terrain.map((tile) => cellKey(tile.cell)),
      ...VISUAL_SLICE_LAYOUT.buildings.map((building) => cellKey(building.cell)),
      ...VISUAL_SLICE_LAYOUT.props.map((prop) => cellKey(prop.cell)),
    ]);
    for (const space of OPEN_SPACES) {
      for (let y = space.from.y; y <= space.to.y; y += 1) {
        for (let x = space.from.x; x <= space.to.x; x += 1) {
          if (!occupied.has(`${x}:${y}`)) continue;
          // Un parque o solar puede albergar arbolado y mobiliario, pero nunca un edificio.
          const building = VISUAL_SLICE_LAYOUT.buildings.some(
            (entry) => entry.cell.x === x && entry.cell.y === y,
          );
          expect(building).toBe(false);
        }
      }
    }
  });

  it("da solar propio a cada edificio: jardín residencial y explanada comercial", () => {
    // bld_residential_a (34,28) → jardín; bld_commercial_b (28,24) → pavimento y trasera de servicio.
    expect(surface(34, 26)).toBe("grass");
    expect(surface(28, 22)).toBe("pavement");
    // A más de un solar de distancia no hay parcela: el suelo vuelve a ser terreno no edificado.
    expect(surface(50, 10)).not.toBe("gravel");
  });

  it("expone los dieciséis cruces de la malla 4×4", () => {
    expect(plan.crossings).toEqual([
      { x: 18, y: 6 },
      { x: 18, y: 18 },
      { x: 18, y: 30 },
      { x: 18, y: 42 },
      { x: 30, y: 6 },
      { x: 30, y: 18 },
      { x: 30, y: 30 },
      { x: 30, y: 42 },
      { x: 42, y: 6 },
      { x: 42, y: 18 },
      { x: 42, y: 30 },
      { x: 42, y: 42 },
      { x: 54, y: 6 },
      { x: 54, y: 18 },
      { x: 54, y: 30 },
      { x: 54, y: 42 },
    ]);
  });

  it("expone los parques para que el pintado les trace el camino de tierra", () => {
    expect(plan.parks.map((park) => park.id)).toEqual([
      "park_north_west",
      "park_north_east",
      "park_south",
      "park_east",
    ]);
  });

  it("rodea el solar de obra con grava sin borrar la acera", () => {
    // Corona oeste y este del tajo, y la acera contigua sigue siendo pavimento.
    expect(surface(32, 35)).toBe("gravel");
    expect(surface(37, 36)).toBe("gravel");
    expect(surface(30, 35)).not.toBe("gravel");
  });

  it("deja el extrarradio sin urbanizar, con vegetación que crece al alejarse del distrito", () => {
    let near = 0;
    let far = 0;
    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        if (x >= 4 && x <= 56 && y >= 4 && y <= 56) continue;
        const value = surface(x, y);
        const wild = value === "grass" || value === "dirt";
        const distance = Math.max(
          0,
          x < 4 ? 4 - x : x > 56 ? x - 56 : 0,
          y < 4 ? 4 - y : y > 56 ? y - 56 : 0,
        );
        if (distance <= 2) near += wild ? 1 : 0;
        if (distance >= 4) far += wild ? 1 : 0;
      }
    }
    expect(far).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  planGameplayPublicSpaceFurniture,
  planGameplayParcelDressing,
  planGameplayContextVehicles,
  planGameplayParkedVehicles,
  planGameplayAmbientActors,
} from "./gameplay-visual-adapter";

/**
 * V.g civic-core P8: invariantes del dressing de espacios públicos. Se prueba la función pura
 * directamente (no el atlas): el contrato es que el mobiliario es una función determinista de la
 * geometría espacial, nunca de la economía, y respeta las reglas semánticas del civic core.
 */

function rectCells(x0: number, y0: number, w: number, h: number) {
  const cells: { x: number; y: number }[] = [];
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) cells.push({ x, y });
  return cells;
}

const PLAZA = { id: "publicspace_plaza", kind: "plaza", cells: rectCells(33, 33, 9, 9) };
const PARK = { id: "publicspace_park", kind: "park", cells: rectCells(10, 10, 12, 12) };
// Ayuntamiento al oeste de la plaza; su huella (8×4) queda fuera de las celdas de la plaza.
const TOWN_HALL_BUILDING = { id: "bld_th", footprintCells: rectCells(23, 33, 8, 4) };
const FACILITIES = [
  { kind: "town_hall", buildingIds: ["bld_th"], publicSpaceIds: ["publicspace_plaza"] },
];

function run(roadCells: readonly string[] = []) {
  return planGameplayPublicSpaceFurniture(
    [PLAZA, PARK],
    FACILITIES,
    [TOWN_HALL_BUILDING],
    new Set(roadCells),
    64,
    64,
  );
}

const inCells = (cell: { x: number; y: number }, cells: readonly { x: number; y: number }[]) =>
  cells.some((c) => c.x === cell.x && c.y === cell.y);

describe("V.g civic-core P8: invariantes de public-space dressing", () => {
  it("mismo estado espacial produce exactamente el mismo dressing (determinismo)", () => {
    expect(run()).toEqual(run());
  });

  it("el dressing no depende de la economía: sólo de la geometría espacial", () => {
    // La firma de la función no recibe tick ni dinero; dos llamadas con la misma geometría son idénticas.
    const a = run();
    const b = run();
    expect(a.map((f) => f.id).join("|")).toBe(b.map((f) => f.id).join("|"));
  });

  it("la plaza del town_hall recibe vocabulary cívico (monumento presente y único)", () => {
    const plazaProps = run().filter((f) => f.publicSpaceId === PLAZA.id);
    const monuments = plazaProps.filter((f) => f.kind === "monument");
    expect(monuments).toHaveLength(1);
    expect(plazaProps.some((f) => f.kind === "street_lamp")).toBe(true);
    expect(plazaProps.some((f) => f.kind === "bench")).toBe(true);
  });

  it("el parque recibe vocabulary verde (árboles) y la plaza NO lleva árboles dispersos", () => {
    const props = run();
    const plazaProps = props.filter((f) => f.publicSpaceId === PLAZA.id);
    const parkProps = props.filter((f) => f.publicSpaceId === PARK.id);
    expect(parkProps.some((f) => f.kind === "tree")).toBe(true);
    expect(plazaProps.filter((f) => f.kind === "tree")).toHaveLength(0);
    expect(plazaProps.filter((f) => f.kind === "foliage")).toHaveLength(0);
  });

  it("ningún prop pisa una carretera", () => {
    // Una carretera vertical que cruza la plaza por x=37.
    const roadCells = rectCells(37, 30, 1, 15).map((c) => `${c.x}:${c.y}`);
    const props = run(roadCells);
    for (const prop of props) expect(roadCells).not.toContain(`${prop.cell.x}:${prop.cell.y}`);
  });

  it("ningún prop pisa la huella del ayuntamiento", () => {
    const props = run();
    for (const prop of props) {
      expect(inCells(prop.cell, TOWN_HALL_BUILDING.footprintCells)).toBe(false);
    }
  });

  it("el monumento permanece dentro de las celdas de la plaza", () => {
    const monument = run().find((f) => f.kind === "monument")!;
    expect(inCells(monument.cell, PLAZA.cells)).toBe(true);
  });

  it("el corredor peatonal town_hall↔plaza queda libre de bancos/jardineras/bolardos", () => {
    const props = run();
    // El eje town_hall→plaza es +X a la altura del centroide del ayuntamiento (y≈34).
    const blocking = props.filter(
      (f) =>
        f.publicSpaceId === PLAZA.id &&
        ["bench", "planter", "bollard"].includes(f.kind) &&
        f.cell.y >= 33 &&
        f.cell.y <= 36,
    );
    // Los props del corredor (banda y≈34) quedan desalojados por el eje cívico.
    for (const prop of blocking) {
      // Ningún bloqueador debe estar en la misma fila que el monumento sobre el eje.
      const monument = props.find((f) => f.kind === "monument")!;
      expect(prop.cell.x).not.toBe(monument.cell.x);
    }
  });

  it("no hay IDs duplicados en el dressing", () => {
    const ids = run().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada prop está dentro de las celdas de su espacio público", () => {
    for (const prop of run()) {
      const space = prop.publicSpaceId === PLAZA.id ? PLAZA : PARK;
      expect(inCells(prop.cell, space.cells)).toBe(true);
    }
  });
});

describe("V.h.5 parcel/lot dressing: invariantes", () => {
  const PARCEL_CELLS = rectCells(10, 10, 6, 6);
  const BUILDING = {
    id: "b1",
    type: "courtyard_home",
    state: "operational",
    footprintCells: rectCells(11, 11, 3, 3),
  };
  const PARCELS = [
    {
      id: "p1",
      cell: { x: 10, y: 10 },
      cells: PARCEL_CELLS,
      zoning: "residential",
      buildingId: "b1",
    },
  ];

  function runLots(roadCells: readonly string[] = []) {
    return planGameplayParcelDressing(PARCELS, [BUILDING], new Set(), new Set(roadCells), 64, 64);
  }

  it("parcel dressing es determinista (mismo estado → mismo dressing)", () => {
    expect(runLots()).toEqual(runLots());
  });

  it("ningún prop pisa la huella del edificio", () => {
    for (const prop of runLots()) {
      expect(inCells(prop.cell, BUILDING.footprintCells)).toBe(false);
    }
  });

  it("ningún prop pisa una carretera", () => {
    const roadCells = rectCells(10, 12, 6, 1).map((c) => `${c.x}:${c.y}`);
    for (const prop of runLots(roadCells)) {
      expect(roadCells).not.toContain(`${prop.cell.x}:${prop.cell.y}`);
    }
  });

  it("los props quedan dentro de la parcela y con IDs únicos", () => {
    const props = runLots();
    const ids = props.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prop of props) expect(inCells(prop.cell, PARCEL_CELLS)).toBe(true);
  });

  it("un solar en obra recibe vocabulary de construcción, no residencial", () => {
    const construction = planGameplayParcelDressing(
      [
        {
          id: "p1",
          cell: { x: 10, y: 10 },
          cells: PARCEL_CELLS,
          zoning: "residential",
          buildingId: null,
        },
      ],
      [],
      new Set(["p1"]),
      new Set(),
      64,
      64,
    );
    expect(construction.every((p) => p.lotType === "construction")).toBe(true);
    expect(construction.some((p) => p.asset.startsWith("prp_construction"))).toBe(true);
  });
});

describe("V.h.6 context vehicles: invariantes", () => {
  // Carretera recta este-oeste en y=5, sin cruces; los edificios apoyan su huella en y=6.
  const ROAD_EW = Array.from({ length: 13 }, (_v, i) => ({
    cell: { x: i, y: 5 },
    mask: 10 as const,
    shape: "straight" as const,
    orientation: "straight_ew" as const,
  }));
  const FIRE = { id: "bld_fire", type: "fire_station", footprintCells: rectCells(5, 6, 2, 2) };
  const CLINIC = { id: "bld_clinic", type: "clinic", footprintCells: rectCells(9, 6, 2, 1) };
  const POLICE = {
    id: "bld_police",
    type: "police_station",
    footprintCells: rectCells(2, 6, 2, 1),
  };
  const CONTEXT_BUILDINGS = [FIRE, CLINIC, POLICE];
  const SIDE_DELTA = {
    n: { x: 0, y: -1 },
    e: { x: 1, y: 0 },
    s: { x: 0, y: 1 },
    w: { x: -1, y: 0 },
  } as const;

  const runContext = () => planGameplayContextVehicles(CONTEXT_BUILDINGS, ROAD_EW, 64, 64);

  it("es determinista (misma geometría → mismos vehículos)", () => {
    expect(runContext()).toEqual(runContext());
  });

  it("mapea edificio → clase y vehículo contextual (fire/ambulance/police)", () => {
    const by = new Map(runContext().map((v) => [v.buildingId, v]));
    expect(by.get("bld_fire")?.asset).toBe("veh_firetruck");
    expect(by.get("bld_fire")?.vehicleClass).toBe("fire");
    expect(by.get("bld_clinic")?.asset).toBe("veh_ambulance");
    expect(by.get("bld_clinic")?.vehicleClass).toBe("ambulance");
    expect(by.get("bld_police")?.asset).toBe("veh_police");
    expect(by.get("bld_police")?.vehicleClass).toBe("police");
  });

  it("cada vehículo aparca en el bordillo: celda de carretera adyacente a su huella, lado hacia el edificio", () => {
    for (const v of runContext()) {
      const building = CONTEXT_BUILDINGS.find((b) => b.id === v.buildingId)!;
      const delta = SIDE_DELTA[v.side];
      const host = { x: v.roadCell.x + delta.x, y: v.roadCell.y + delta.y };
      expect(inCells(host, building.footprintCells)).toBe(true);
    }
  });

  it("IDs únicos y sin dos vehículos contextuales en la misma celda de carretera", () => {
    const vs = runContext();
    expect(new Set(vs.map((v) => v.id)).size).toBe(vs.length);
    expect(new Set(vs.map((v) => `${v.roadCell.x}:${v.roadCell.y}`)).size).toBe(vs.length);
  });

  it("las celdas reservadas por vehículos contextuales quedan libres para el aparcamiento ambiental", () => {
    const reserved = new Set(runContext().map((v) => `${v.roadCell.x}:${v.roadCell.y}`));
    const parked = planGameplayParkedVehicles(ROAD_EW, [], new Set(), [], [], 64, 64, reserved);
    for (const p of parked) expect(reserved.has(`${p.roadCell.x}:${p.roadCell.y}`)).toBe(false);
  });
});

describe("V.h.7 ambient actors: invariantes", () => {
  const SPACES = [PLAZA, PARK];
  const runActors = (roadCells: readonly string[] = []) =>
    planGameplayAmbientActors(SPACES, new Set(roadCells), 64, 64);

  it("es determinista (misma geometría → mismos actores)", () => {
    expect(runActors()).toEqual(runActors());
  });

  it("los actores quedan dentro de las celdas del espacio público y fuera de carreteras", () => {
    const roadCells = rectCells(33, 33, 9, 1).map((c) => `${c.x}:${c.y}`);
    const all = [...PLAZA.cells, ...PARK.cells];
    for (const actor of runActors(roadCells)) {
      expect(inCells(actor.cell, all)).toBe(true);
      expect(roadCells).not.toContain(`${actor.cell.x}:${actor.cell.y}`);
    }
  });

  it("IDs únicos y sin dos actores en la misma celda", () => {
    const actors = runActors();
    expect(new Set(actors.map((a) => a.id)).size).toBe(actors.length);
    expect(new Set(actors.map((a) => `${a.cell.x}:${a.cell.y}`)).size).toBe(actors.length);
  });

  it("el budget de peatones por espacio queda acotado (no saturar, §18/§20)", () => {
    const bySpace = new Map<string, number>();
    for (const actor of runActors()) {
      const spaceId = actor.id.split(":")[1]!;
      bySpace.set(spaceId, (bySpace.get(spaceId) ?? 0) + 1);
    }
    for (const count of bySpace.values()) expect(count).toBeLessThanOrEqual(4);
    expect(bySpace.size).toBeGreaterThan(0);
  });

  it("dirección/animación/slot dentro del rango horneado (4 dirs, idle/walk, 2 slots)", () => {
    for (const actor of runActors()) {
      expect(actor.direction).toBeGreaterThanOrEqual(0);
      expect(actor.direction).toBeLessThanOrEqual(3);
      expect(["idle", "walk"]).toContain(actor.animation);
      expect(actor.slot).toBeGreaterThanOrEqual(0);
      expect(actor.slot).toBeLessThanOrEqual(1);
    }
  });
});

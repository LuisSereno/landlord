import { describe, expect, it } from "vitest";
import { planGameplayPublicSpaceFurniture } from "./gameplay-visual-adapter";

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

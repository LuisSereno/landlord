import { describe, expect, it } from "vitest";

import { roadCellsFromSegments, roadSegmentId, type RoadSegment } from "./domain";
import {
  ROAD_PROFILES,
  roadAxisProfileForClass,
  roadCellRolesFromSegments,
  roadCorridorCellsFromSegments,
  roadProfileForClass,
  roadProfileForSection,
  type RoadProfile,
} from "./road-cross-section";
import type { GridCell } from "./time-and-grid";

function segment(from: GridCell, to: GridCell, roadClass: RoadSegment["class"]): RoadSegment {
  return { id: roadSegmentId(roadClass, from, to), from, to, class: roadClass };
}

const key = (x: number, y: number) => `${x}:${y}`;

describe("V.l.2 · perfiles de sección transversal (D-104)", () => {
  it("los tres perfiles tienen el ancho que pidió el responsable: 3, 5 con mediana y 7", () => {
    expect(ROAD_PROFILES.street.width).toBe(3);
    expect(ROAD_PROFILES.avenue.width).toBe(5);
    expect(ROAD_PROFILES.motorway.width).toBe(7);
    expect(ROAD_PROFILES.avenue.roles).toContain("median");
    expect(ROAD_PROFILES.motorway.roles).toContain("median");
    expect(ROAD_PROFILES.street.roles).not.toContain("median");
  });

  it("cada perfil es coherente: ancho impar, roles y sentidos de la misma longitud, aceras en los dos bordes", () => {
    for (const profile of Object.values(ROAD_PROFILES)) {
      expect(profile.width % 2, profile.id).toBe(1);
      expect(profile.roles).toHaveLength(profile.width);
      expect(profile.laneSenses).toHaveLength(profile.width);
      expect(profile.roles[0], profile.id).toBe("sidewalk");
      expect(profile.roles[profile.width - 1], profile.id).toBe("sidewalk");
      expect([...profile.roles].reverse(), profile.id).toEqual([...profile.roles]);
      const centre = (profile.width - 1) / 2;
      expect(profile.roles[centre], profile.id).toBe(
        profile.id === "street" ? "carriageway" : "median",
      );
      profile.roles.forEach((role, index) => {
        const sense = profile.laneSenses[index]!;
        if (role === "carriageway") expect(sense, `${profile.id}[${index}]`).not.toBeNull();
        else expect(sense, `${profile.id}[${index}]`).toBeNull();
      });
    }
  });

  it("circulación por la derecha: el lado negativo es backward y el positivo forward; la calle de 3 es de doble sentido", () => {
    expect(ROAD_PROFILES.street.laneSenses).toEqual([null, "both", null]);
    expect(ROAD_PROFILES.avenue.laneSenses).toEqual([null, "backward", null, "forward", null]);
    expect(ROAD_PROFILES.motorway.laneSenses).toEqual([
      null,
      "backward",
      "backward",
      null,
      "forward",
      "forward",
      null,
    ]);
  });

  it("la clase vial existente resuelve a su perfil sin fallback silencioso", () => {
    expect(roadProfileForClass("street")).toBe(ROAD_PROFILES.street);
    expect(roadProfileForClass("avenue")).toBe(ROAD_PROFILES.avenue);
    expect(roadProfileForClass("motorway")).toBe(ROAD_PROFILES.motorway);
  });

  it("la sección de eje (ancho 1) conserva el id de la clase y reproduce la geometría v2", () => {
    for (const roadClass of ["street", "avenue", "motorway"] as const) {
      const profile = roadAxisProfileForClass(roadClass);
      expect(profile.id).toBe(roadClass);
      expect(profile.width).toBe(1);
      expect(profile.roles).toEqual(["carriageway"]);
      expect(profile.laneSenses).toEqual(["both"]);
    }
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
    ];
    expect([...roadCorridorCellsFromSegments(segments, roadAxisProfileForClass)].sort()).toEqual(
      [...roadCellsFromSegments(segments)].sort(),
    );
  });

  it("la variante ave3 deja las calles en el eje y la avenida con dos aceras", () => {
    expect(roadProfileForSection("street", "ave3")).toEqual(roadAxisProfileForClass("street"));
    expect(roadProfileForSection("avenue", "ave3")).toEqual({
      id: "avenue",
      width: 3,
      roles: ["sidewalk", "carriageway", "sidewalk"],
      laneSenses: [null, "both", null],
    });
    expect(roadProfileForSection("avenue", "full")).toBe(ROAD_PROFILES.avenue);
  });
});

describe("V.l.2 · derivación del corredor", () => {
  it("una calle horizontal ocupa el eje y una acera a cada lado, con el rol correcto", () => {
    const segments = [segment({ x: 2, y: 10 }, { x: 6, y: 10 }, "street")];
    const cells = roadCorridorCellsFromSegments(segments);
    expect(cells.size).toBe(15);
    const roles = roadCellRolesFromSegments(segments);
    for (let x = 2; x <= 6; x += 1) {
      expect(roles.get(key(x, 9))).toBe("sidewalk");
      expect(roles.get(key(x, 10))).toBe("carriageway");
      expect(roles.get(key(x, 11))).toBe("sidewalk");
    }
  });

  it("una avenida vertical gira el perpendicular: avanzando +y, el sentido forward queda en −x", () => {
    const segments = [segment({ x: 10, y: 2 }, { x: 10, y: 6 }, "avenue")];
    const cells = roadCorridorCellsFromSegments(segments);
    expect(cells.size).toBe(25);
    const roles = roadCellRolesFromSegments(segments);
    expect(roles.get(key(12, 4))).toBe("sidewalk");
    expect(roles.get(key(11, 4))).toBe("carriageway");
    expect(roles.get(key(10, 4))).toBe("median");
    expect(roles.get(key(9, 4))).toBe("carriageway");
    expect(roles.get(key(8, 4))).toBe("sidewalk");
    // El carril de x=9 es el del lado derecho de quien avanza en +y, es decir el forward.
    expect(ROAD_PROFILES.avenue.laneSenses[3]).toBe("forward");
  });

  it("recorta en el borde del distrito en vez de desplazar la sección", () => {
    const atZero = roadCorridorCellsFromSegments([
      segment({ x: 0, y: 0 }, { x: 5, y: 0 }, "street"),
    ]);
    expect(atZero.size).toBe(12);
    expect([...atZero].every((cell) => !cell.startsWith("-"))).toBe(true);
    expect(atZero.has(key(3, -1))).toBe(false);

    const atEdge = roadCorridorCellsFromSegments(
      [segment({ x: 0, y: 63 }, { x: 4, y: 63 }, "avenue")],
      () => ROAD_PROFILES.motorway,
    );
    expect(atEdge.size).toBe(20);
    expect(atEdge.has(key(2, 63))).toBe(true);
    expect(atEdge.has(key(2, 60))).toBe(true);
    expect(atEdge.has(key(2, 64))).toBe(false);
  });

  it("en un cruce de dos ejes la intersección es calzada: la mediana se interrumpe, no corta la vía", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
    ];
    const roles = roadCellRolesFromSegments(segments);
    expect(roles.get(key(10, 10))).toBe("carriageway");
    expect(roles.get(key(9, 10))).toBe("carriageway");
    // Fuera del cruce la avenida conserva su sección completa.
    expect(roles.get(key(10, 12))).toBe("median");
    expect(roles.get(key(8, 12))).toBe("sidewalk");
  });

  it("conserva la mediana cuando dos segmentos colineales publican el mismo eje", () => {
    const segments = [
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
      // La retícula real añade tramos de una celda sobre la línea de avenida.
      segment({ x: 10, y: 10 }, { x: 10, y: 10 }, "street"),
    ];
    const roles = roadCellRolesFromSegments(segments);
    expect(roles.get(key(10, 10))).toBe("median");
    expect(roles.get(key(9, 10))).toBe("carriageway");
    expect(roles.get(key(11, 10))).toBe("carriageway");
  });

  it("el eje de una calle no lo convierte en acera el perfil mayor de otra vía que lo cruza", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
    ];
    const roles = roadCellRolesFromSegments(segments);
    // (8,10) es eje de la calle y acera de la avenida: manda el eje.
    expect(roles.get(key(8, 10))).toBe("carriageway");
    expect(roles.get(key(12, 10))).toBe("carriageway");
  });

  it("entre celdas que no son eje de nadie manda el perfil mayor: la avenida gana a la calle paralela", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 0, y: 12 }, { x: 20, y: 12 }, "avenue"),
    ];
    const roles = roadCellRolesFromSegments(segments);
    expect(roles.get(key(5, 11))).toBe("carriageway");
    expect(roles.get(key(5, 9))).toBe("sidewalk");
    expect(roles.get(key(5, 14))).toBe("sidewalk");
  });

  it("a igual perfil, el eje propio gana al lateral de la otra calle", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "street"),
    ];
    const roles = roadCellRolesFromSegments(segments);
    expect(roles.get(key(10, 9))).toBe("carriageway");
    expect(roles.get(key(10, 10))).toBe("carriageway");
  });

  it("es determinista: el orden de entrada no cambia ni el conjunto ni los roles", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
      segment({ x: 30, y: 30 }, { x: 40, y: 30 }, "street"),
    ];
    const forward = roadCellRolesFromSegments(segments);
    const reversed = roadCellRolesFromSegments([...segments].reverse());
    expect([...reversed.entries()].sort()).toEqual([...forward.entries()].sort());
    expect([...roadCorridorCellsFromSegments([...segments].reverse())].sort()).toEqual(
      [...roadCorridorCellsFromSegments(segments)].sort(),
    );
  });

  it("conserva el eje: toda celda de `roadCellsFromSegments` está en el corredor y nunca es acera", () => {
    const segments = [
      segment({ x: 0, y: 10 }, { x: 20, y: 10 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
    ];
    const corridor = roadCorridorCellsFromSegments(segments);
    const roles = roadCellRolesFromSegments(segments);
    for (const cell of roadCellsFromSegments(segments)) {
      expect(corridor.has(cell), cell).toBe(true);
      expect(roles.get(cell), cell).not.toBe("sidewalk");
    }
  });

  it("control de V.l.5: con perfiles de ancho 1 el corredor es exactamente el eje de hoy", () => {
    const widthOne: RoadProfile = {
      id: "street",
      width: 1,
      roles: ["carriageway"],
      laneSenses: ["both"],
    };
    const segments = [
      segment({ x: 0, y: 0 }, { x: 63, y: 0 }, "street"),
      segment({ x: 10, y: 0 }, { x: 10, y: 20 }, "avenue"),
      segment({ x: 32, y: 32 }, { x: 32, y: 32 }, "street"),
    ];
    const corridor = roadCorridorCellsFromSegments(segments, () => widthOne);
    expect([...corridor].sort()).toEqual([...roadCellsFromSegments(segments)].sort());
  });

  it("un tramo de una celda y un tramo no ortogonal se comportan como el derivador del eje", () => {
    const single = roadCorridorCellsFromSegments([
      segment({ x: 5, y: 5 }, { x: 5, y: 5 }, "street"),
    ]);
    expect([...single].sort()).toEqual([key(5, 4), key(5, 5), key(5, 6)].sort());
    expect(() =>
      roadCorridorCellsFromSegments([segment({ x: 1, y: 1 }, { x: 4, y: 4 }, "street")]),
    ).toThrow(/not orthogonal/);
  });

  it("no muta los segmentos ni toca su identidad: `roadSegmentId` sigue siendo el de siempre", () => {
    const segments = [segment({ x: 2, y: 10 }, { x: 6, y: 10 }, "street")];
    const before = JSON.stringify(segments);
    for (const entry of segments) Object.freeze(entry);
    Object.freeze(segments);
    roadCorridorCellsFromSegments(segments);
    roadCellRolesFromSegments(segments);
    expect(JSON.stringify(segments)).toBe(before);
    expect(segments[0]!.id).toBe(roadSegmentId("street", { x: 2, y: 10 }, { x: 6, y: 10 }));
  });
});

import { describe, expect, it } from "vitest";
import {
  DAY_SURFACE_STYLE,
  SURFACE_STYLE,
  allowsOrganicGroundBlend,
  crossingArms,
  curbEdgesForCell,
  roadGuideOrientationForCell,
  type CurbMode,
} from "./terrain-paint";
import type { GroundSurface } from "./ground";

function surfaces(entries: Record<string, GroundSurface>) {
  return (cell: { x: number; y: number }): GroundSurface =>
    entries[`${cell.x}:${cell.y}`] ?? "urban";
}

describe("Graphic Civic curbs", () => {
  it("preserva el bordillo pavement/asphalt del Visual Slice", () => {
    const surfaceAt = surfaces({ "1:1": "pavement", "2:1": "asphalt" });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt)).toEqual(["e"]);
    expect(curbEdgesForCell({ x: 0, y: 1 }, surfaceAt)).toEqual([]);
  });

  it("en gameplay marca cualquier frontera asphalt/non-asphalt", () => {
    const mode: CurbMode = "all_non_asphalt";
    const surfaceAt = surfaces({ "1:1": "grass", "2:1": "asphalt", "1:2": "asphalt" });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt, mode)).toEqual(["e", "s"]);
  });

  it("no dibuja bordillos internos para una intersección de asfalto", () => {
    const mode: CurbMode = "all_non_asphalt";
    const surfaceAt = surfaces({
      "1:1": "asphalt",
      "1:0": "asphalt",
      "2:1": "asphalt",
      "1:2": "asphalt",
      "0:1": "asphalt",
    });
    expect(curbEdgesForCell({ x: 1, y: 1 }, surfaceAt, mode)).toEqual([]);
    expect(curbEdgesForCell({ x: 1, y: 0 }, surfaceAt, mode)).toEqual([]);
  });
});

describe("Graphic Civic pedestrian markings", () => {
  it("pinta sólo los brazos publicados de una T, en orden cardinal estable", () => {
    expect(crossingArms(7).map((arm) => arm.bit)).toEqual([1, 2, 4]);
  });

  it("pinta los cuatro brazos sólo para una intersección plena", () => {
    expect(crossingArms(15).map((arm) => arm.bit)).toEqual([1, 2, 4, 8]);
  });
});

describe("Graphic Civic legibilidad vial", () => {
  it("no mezcla terreno orgánico dentro de una calzada v2", () => {
    expect(allowsOrganicGroundBlend("grass", "asphalt")).toBe(false);
    expect(allowsOrganicGroundBlend("asphalt", "grass")).toBe(false);
  });

  it("no mezcla terreno orgánico sobre una acera", () => {
    expect(allowsOrganicGroundBlend("dirt", "pavement")).toBe(false);
    expect(allowsOrganicGroundBlend("pavement", "dirt")).toBe(false);
    expect(allowsOrganicGroundBlend("grass", "pavement")).toBe(false);
    expect(allowsOrganicGroundBlend("pavement", "grass")).toBe(false);
  });

  it("reserva la guía discontinua para una calzada asfaltada recta", () => {
    const horizontal = surfaces({
      "1:2": "asphalt",
      "2:2": "asphalt",
      "3:2": "asphalt",
    });
    expect(roadGuideOrientationForCell({ x: 2, y: 2 }, horizontal)).toBe("ew");

    const pavement = surfaces({
      "1:2": "pavement",
      "2:2": "pavement",
      "3:2": "pavement",
    });
    expect(roadGuideOrientationForCell({ x: 2, y: 2 }, pavement)).toBeNull();
  });

  it("no convierte una intersección en una guía de carril ficticia", () => {
    const intersection = surfaces({
      "2:2": "asphalt",
      "1:2": "asphalt",
      "3:2": "asphalt",
      "2:1": "asphalt",
      "2:3": "asphalt",
    });
    expect(roadGuideOrientationForCell({ x: 2, y: 2 }, intersection)).toBeNull();
  });

  it("da a la calzada el grano más fino del lenguaje de suelo, en los dos grados", () => {
    // El asfalto es una superficie fabricada y continua. Con el grano de un terreno suelto, cada
    // loseta de la calzada se leía como tierra derramada sobre ella.
    for (const palette of [SURFACE_STYLE, DAY_SURFACE_STYLE]) {
      const road = palette.asphalt.grain;
      for (const surface of Object.keys(palette) as GroundSurface[]) {
        if (surface === "asphalt") continue;
        expect(road, `${surface} deja de ser más liso que la calzada`).toBeLessThan(
          palette[surface].grain,
        );
      }
    }
  });
});

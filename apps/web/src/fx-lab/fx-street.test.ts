/**
 * D-111.2 cierre FASE 4 — la calle de pruebas elige el sprite por la proyección del contrato de
 * weathering, no lo escribe nadie.
 *
 * El defecto que se cierra aquí es el colapso `condition < 60 ⇒ damaged`: un edificio envejecido con
 * la estructura en pie se pintaba como ruina. Se comprueba la TABLA derivada (datos, sin navegador);
 * que el render la respete es lo que se fotografía en `building_condition_states.png`.
 */
import { describe, expect, it } from "vitest";
import { BUILDING_PLACEMENTS, buildingSrc } from "./fx-street";
import {
  buildingVisualTierFor,
  projectBuildingCondition,
  type BuildingConditionInput,
} from "../isometric/building-condition";

const byKey = (key: string) => {
  const found = BUILDING_PLACEMENTS.find((placement) => placement.key === key);
  if (!found) throw new Error(`falta la colocación ${key}`);
  return found;
};

/** El escenario de un edificio de la calle, o `null` si es una obra (no tiene conservación). */
const escenario = (key: string): BuildingConditionInput | null => {
  const scenario = byKey(key).scenario;
  return scenario === "construction" ? null : scenario;
};

describe("ruta de selección de la calle (D-111.2 cierre FASE 4)", () => {
  it("ningún estado se escribe a mano: todos vienen de la proyección", () => {
    for (const placement of BUILDING_PLACEMENTS) {
      if (placement.scenario === "construction") {
        expect(placement.state, placement.key).toBe("construction");
        continue;
      }
      expect(placement.state, placement.key).toBe(
        projectBuildingCondition(placement.scenario).assetState,
      );
    }
  });

  it("envejecido conserva el sprite de geometría íntegra y sólo cambia el token de material", () => {
    const conserved = projectBuildingCondition({
      state: "operational",
      condition: 92,
      structuralIntegrity: 100,
    });
    const aged = projectBuildingCondition({
      state: "operational",
      condition: 48,
      structuralIntegrity: 76,
    });
    /** §6: "un edificio envejecido conserva ventanas, cubierta y estructura". */
    expect(aged.assetState).toBe(conserved.assetState);
    expect(aged.tier).toBe("aged");
    expect(aged.weathering).toBe("aged");
    expect(conserved.weathering).toBe("conserved");
    /** Yendo al manifiesto: mismo type y mismo assetState ⇒ el mismo PNG horneado. */
    expect(buildingSrc("mixed_tenement", aged.assetState)).toBe(
      buildingSrc("mixed_tenement", conserved.assetState),
    );
  });

  it("el caso que se pintaba como ruina ya no lo es", () => {
    const tenement = byKey("back-mixed_tenement");
    expect(tenement.scenario).toEqual({
      state: "operational",
      condition: 48,
      structuralIntegrity: 76,
    });
    expect(tenement.state).toBe("complete");
    expect(buildingVisualTierFor(escenario("back-mixed_tenement")!)).toBe("aged");
  });

  it("sólo arde lo que en el escenario arde", () => {
    const ardiendo = BUILDING_PLACEMENTS.filter((p) => p.state === "burning");
    expect(ardiendo.map((p) => p.key)).toEqual(["front-burning"]);
    expect(byKey("front-burning").scenario).toEqual({
      state: "burning",
      condition: 40,
      structuralIntegrity: 0,
    });
    /** Dañado ≠ ardiendo: la ruina pierde el techo pero no echa llamas por sí sola. */
    expect(byKey("front-damaged").state).toBe("damaged");
    expect(buildingVisualTierFor(escenario("front-damaged")!)).toBe("damaged");
  });

  it("los cuatro tiers se representan a la vez en la misma calle", () => {
    const tiers = BUILDING_PLACEMENTS.map((placement) =>
      placement.scenario === "construction" ? null : buildingVisualTierFor(placement.scenario),
    );
    expect([...new Set(tiers.filter((tier) => tier !== null))].sort()).toEqual([
      "aged",
      "burning",
      "conserved",
      "damaged",
    ]);
  });

  it("todo estado derivado tiene sprite publicado en el manifiesto", () => {
    for (const placement of BUILDING_PLACEMENTS) {
      expect(
        buildingSrc(placement.type, placement.state),
        `${placement.key} pide ${placement.type}/${placement.state} y eso no está en el catálogo`,
      ).not.toBeNull();
    }
  });
});

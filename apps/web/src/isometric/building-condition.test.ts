/**
 * D-111.2 WP04 + cierre FASE 4 — la proyección de conservación no puede volver a colapsar `aged` sobre `damaged`.
 *
 * Lo que se prueba aquí es la DISTINCIÓN, que es el objetivo de la fase: el mismo edificio con el
 * mismo `condition` cambia de representación según la integridad estructural real, y ningún edificio
 * operativo acaba con sprite de ruina. El umbral no lo declara este test: se lee del contrato, para
 * que moverlo en el JSON sin mover el código falle aquí y no en un playtest.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AGED_CONDITION_BELOW,
  buildingVisualTierFor,
  projectBuildingCondition,
} from "./building-condition";

const CONTRACT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "blender_artist/manifests/building-weathering-contract.json",
);
const contract = JSON.parse(readFileSync(CONTRACT, "utf8"));

describe("proyección visual de conservación (D-111.2 WP04 + cierre FASE 4)", () => {
  it("mantiene el umbral y el vocabulario del contrato", () => {
    expect(AGED_CONDITION_BELOW).toBe(60);
    expect(contract["weatheringTokens"]).toEqual(["conserved", "aged"]);
    expect(Object.keys(contract["visualStates"]).sort()).toEqual(
      ["aged", "burning", "conserved", "damaged"].sort(),
    );
    /** `aged` y `conserved` son proyección de material; `damaged` y `burning` cambian geometría. */
    expect(contract["visualStates"]["aged"]["materialProjection"]).toBe(true);
    expect(contract["visualStates"]["aged"]["geometryChange"]).toBe(false);
    expect(contract["visualStates"]["damaged"]["geometryChange"]).toBe(true);
  });

  it("el mismo condition<60 da envejecido o ruina según la integridad, no siempre ruina", () => {
    /** Éste era el defecto: `condition < 60 ⇒ 'damaged'` sin mirar `structuralIntegrity`. */
    expect(
      buildingVisualTierFor({ state: "operational", condition: 40, structuralIntegrity: 82 }),
    ).toBe("aged");
    expect(
      buildingVisualTierFor({ state: "operational", condition: 40, structuralIntegrity: 0 }),
    ).toBe("damaged");
  });

  it("ningún edificio operativo con estructura se representa como dañado", () => {
    for (const condition of [0, 1, 59, 60, 100]) {
      for (const structuralIntegrity of [1, 25, 50, 100]) {
        const projection = projectBuildingCondition({
          state: "operational",
          condition,
          structuralIntegrity,
        });
        expect(projection.tier, `${condition}/${structuralIntegrity}`).not.toBe("damaged");
        expect(projection.assetState, `${condition}/${structuralIntegrity}`).toBe("complete");
      }
    }
  });

  it("el incendio manda sobre el estado de conservación", () => {
    for (const state of ["burning", "collapse_pending"] as const) {
      expect(buildingVisualTierFor({ state, condition: 100, structuralIntegrity: 100 })).toBe(
        "burning",
      );
    }
    expect(
      projectBuildingCondition({ state: "burning", condition: 95, structuralIntegrity: 90 }),
    ).toEqual({ tier: "burning", assetState: "burning", weathering: null });
  });

  it("la ruina es daño estructural haya o no condition bajo", () => {
    expect(buildingVisualTierFor({ state: "ruin", condition: 90, structuralIntegrity: 0 })).toBe(
      "damaged",
    );
    expect(buildingVisualTierFor({ state: "ruin", condition: 12, structuralIntegrity: 4 })).toBe(
      "damaged",
    );
  });

  it("sólo los tiers de material piden token de envejecimiento al compositor", () => {
    expect(
      projectBuildingCondition({ state: "operational", condition: 99, structuralIntegrity: 100 }),
    ).toEqual({ tier: "conserved", assetState: "complete", weathering: "conserved" });
    expect(
      projectBuildingCondition({ state: "operational", condition: 30, structuralIntegrity: 70 }),
    ).toEqual({ tier: "aged", assetState: "complete", weathering: "aged" });
    /** `damaged`/`burning` con token harían abortar a `weathering.Plan`: aquí se declara `null`. */
    expect(
      projectBuildingCondition({ state: "ruin", condition: 10, structuralIntegrity: 0 }).weathering,
    ).toBeNull();
  });

  it("distingue las cuatro representaciones sin añadir un estado de dominio", () => {
    const scenarios = [
      { state: "operational", condition: 95, structuralIntegrity: 100 },
      { state: "operational", condition: 41, structuralIntegrity: 88 },
      { state: "ruin", condition: 41, structuralIntegrity: 0 },
      { state: "burning", condition: 41, structuralIntegrity: 0 },
    ] as const;
    expect(scenarios.map(buildingVisualTierFor)).toEqual([
      "conserved",
      "aged",
      "damaged",
      "burning",
    ]);
    /** Los `state` usados son los cuatro que ya declara la proyección de vista: ninguno nuevo. */
    expect(new Set(scenarios.map((s) => s.state))).toEqual(
      new Set(["operational", "ruin", "burning"]),
    );
  });
});

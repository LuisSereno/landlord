import { describe, expect, it } from "vitest";
import { ARRANGEMENTS, DEFAULT_CONFIG_ID, SCALE_CONFIGS } from "./config";

describe("character scale lab configurations", () => {
  it("declares exactly the four authorized configurations", () => {
    expect(SCALE_CONFIGS).toEqual({
      A: { id: "A", label: "Referencia", cameraZoom: 1, characterWorldHeight: 28, expectedScreenHeight: 28 },
      B: { id: "B", label: "Personajes mayores", cameraZoom: 1, characterWorldHeight: 34, expectedScreenHeight: 34 },
      C: { id: "C", label: "Ciudad más cercana", cameraZoom: 1.25, characterWorldHeight: 28, expectedScreenHeight: 35 },
      D: { id: "D", label: "Combinación moderada", cameraZoom: 1.15, characterWorldHeight: 34, expectedScreenHeight: 39.1 },
    });
  });

  it("uses B as the recommended lab default without changing production", () => {
    expect(DEFAULT_CONFIG_ID).toBe("B");
  });

  it("provides reproducible five-character lineup and reference positions", () => {
    expect(Object.keys(ARRANGEMENTS.lineup)).toEqual(["worker", "supervisor", "enforcer", "police", "firefighter"]);
    expect(ARRANGEMENTS.street.worker).toEqual({ x: 6, y: 7 });
    expect(ARRANGEMENTS.door.worker).toEqual({ x: 5, y: 6 });
  });
});

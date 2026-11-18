import { describe, expect, it } from "vitest";

import { nextSimulationSpeed, SIMULATION_SPEEDS } from "./game-hud";

describe("avance rápido del HUD", () => {
  it("recorre todas las velocidades y vuelve a 1×", () => {
    expect(SIMULATION_SPEEDS.map(nextSimulationSpeed)).toEqual([2, 4, 8, 16, 1]);
  });
});

import { describe, expect, it } from "vitest";

import { parseTick } from "@landlord/shared";
import { canonicalizeState, runScenario } from "./runner";
import { advanceProductSystems } from "./systems";
import { createScaledCity } from "./system-cost";

/**
 * Digesto propio, sin dependencias: fija el resultado económico de carreras largas para que
 * cualquier trabajo de coste del tick (WP4.2) demuestre que no altera la simulación. Si un cambio
 * de reglas lo rompe, se regenera de forma deliberada y se explica en el acta correspondiente.
 *
 * Regeneración WP4.3 (2026-10-23): el estado canónico gana `phase2.housingMarket` y los campos
 * `size`, `segmentId`, `searchMonths` y `origin` de cada hogar, así que todos los digestos cambian
 * aunque ningún saldo, transacción, baja ni desplazamiento varíe. La huella económica previa y
 * posterior se comparó observable por observable en el acta de WP4.3.
 */
function digest(value: string): string {
  let left = 0x811c9dc5;
  let right = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right + code + index, 0x85ebca6b) >>> 0;
  }
  return left.toString(16).padStart(8, "0") + right.toString(16).padStart(8, "0");
}

function cityDigest(input: {
  parcelCount: number;
  ticks: number;
  incidentCount?: number;
  startTick?: number;
}): string {
  const state = createScaledCity(7, {
    parcelCount: input.parcelCount,
    incidentCount: input.incidentCount,
  });
  state.clock = { ...state.clock, tick: parseTick(input.startTick ?? 0) };
  for (let tick = 0; tick < input.ticks; tick += 1) advanceProductSystems(state);
  return digest(canonicalizeState(state));
}

const GOLDEN_CASES: ReadonlyArray<{ id: string; expected: string; run: () => string }> = [
  {
    id: "scenario:seed-1:1200",
    expected: "ace97c49a78af34c",
    run: () => digest(canonicalizeState(runScenario(1, [], 1_200).state)),
  },
  {
    id: "scenario:seed-7:1200",
    expected: "a3a03bcc9184ab74",
    run: () => digest(canonicalizeState(runScenario(7, [], 1_200).state)),
  },
  {
    id: "scenario:seed-42:1200",
    expected: "1f0ca9fbbdbc6141",
    run: () => digest(canonicalizeState(runScenario(42, [], 1_200).state)),
  },
  {
    id: "scenario:seed-1:36000",
    expected: "71d6cef52673c50f",
    run: () => digest(canonicalizeState(runScenario(1, [], 36_000).state)),
  },
  {
    id: "city:50-parcels:1300-ticks",
    expected: "fd797cdc572304ac",
    run: () => cityDigest({ parcelCount: 50, ticks: 1_300 }),
  },
  {
    id: "city:50-parcels:month-boundary",
    expected: "3715417bb5c70c6f",
    run: () => cityDigest({ parcelCount: 50, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  {
    id: "city:200-parcels:month-boundary",
    expected: "5e5f43c8106309eb",
    run: () => cityDigest({ parcelCount: 200, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  // Las tres carreras siguientes llegan a colapso y explosión: cubren el recuento de bajas, el
  // desplazamiento de tenants y el daño en cadena, que sólo se ejecutan con incidentes vivos.
  {
    id: "city:50-parcels:fire-cascade",
    expected: "ada77107894b1f55",
    run: () => cityDigest({ parcelCount: 50, ticks: 3_000, incidentCount: 12 }),
  },
  {
    id: "city:200-parcels:fire-cascade",
    expected: "7d6c147490b1d55f",
    run: () => cityDigest({ parcelCount: 200, ticks: 3_000, incidentCount: 40 }),
  },
  {
    id: "city:800-parcels:fire-cascade",
    expected: "9a4f481d64014c2f",
    run: () => cityDigest({ parcelCount: 800, ticks: 1_500, incidentCount: 50 }),
  },
];

describe("WP4.2 conservación del resultado económico", () => {
  it("mantiene el digesto de carreras largas al optimizar el coste del tick", () => {
    for (const golden of GOLDEN_CASES) {
      expect(golden.run(), golden.id).toBe(golden.expected);
    }
  }, 600_000);
});

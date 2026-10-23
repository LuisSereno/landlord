import { describe, expect, it } from "vitest";

import { advanceProductSystems, PRODUCT_SYSTEMS } from "./systems";
import { canonicalizeState } from "./runner";
import { parseTick } from "@landlord/shared";
import {
  createScaledCity,
  describeScaledCity,
  measureScaledCity,
  summarizeScaleGrowth,
  SYSTEM_COST_SCALES,
  SYSTEM_COST_WINDOWS,
  type ScaledCityMeasurement,
} from "./system-cost";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  performance: { now(): number };
  console: { log(value: string): void };
};

const now = () => environment.performance.now();

const relational = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/**
 * `tactical` e `insurance` ordenan todas sus entidades en cada tick. Esta sonda separa cuánto de
 * ese coste es la comparación de ids y verifica que el orden relacional coincide con
 * `localeCompare`, que es lo único que permitiría sustituirlo sin cambiar el resultado.
 */
function measureOrdering(ids: readonly string[], runs = 200) {
  const start = now();
  for (let run = 0; run < runs; run += 1) [...ids].sort((left, right) => left.localeCompare(right));
  const localeMs = (now() - start) / runs;
  const relationalStart = now();
  for (let run = 0; run < runs; run += 1) [...ids].sort(relational);
  const relationalMs = (now() - relationalStart) / runs;
  return {
    count: ids.length,
    localeMs,
    relationalMs,
    sameOrder:
      JSON.stringify([...ids].sort((left, right) => left.localeCompare(right))) ===
      JSON.stringify([...ids].sort(relational)),
  };
}

describe("WP4.2 system cost harness", () => {
  it("construye la misma ciudad sintética para la misma seed", () => {
    const left = createScaledCity(7, { parcelCount: 40 });
    const right = createScaledCity(7, { parcelCount: 40 });
    expect(canonicalizeState(left)).toBe(canonicalizeState(right));
    const other = createScaledCity(11, { parcelCount: 40 });
    expect(canonicalizeState(other)).not.toBe(canonicalizeState(left));
    const counts = describeScaledCity(left);
    expect(counts.parcels).toBeGreaterThan(40);
    expect(counts.buildings).toBeGreaterThan(0);
    expect(counts.tenants).toBeGreaterThan(0);
    expect(counts.constructionSites).toBeGreaterThan(0);
    expect(counts.crews).toBeGreaterThan(0);
    expect(counts.loans).toBeGreaterThan(0);
    expect(counts.insuranceContracts).toBeGreaterThan(0);
  });

  it("no consume el PRNG de la partida al generar carga sintética", () => {
    const plain = createScaledCity(3, { parcelCount: 0 });
    expect(plain.prng).toEqual(createScaledCity(3, { parcelCount: 60 }).prng);
  });

  it("cronometrar sistema a sistema no altera el estado resultante", () => {
    const reference = createScaledCity(5, { parcelCount: 40 });
    const instrumented = createScaledCity(5, { parcelCount: 40 });
    for (let tick = 0; tick < 120; tick += 1) {
      advanceProductSystems(reference);
      for (const system of PRODUCT_SYSTEMS) system.run(instrumented);
      instrumented.clock = { ...instrumented.clock, tick: parseTick(instrumented.clock.tick + 1) };
    }
    expect(canonicalizeState(instrumented)).toBe(canonicalizeState(reference));
  });

  it("rechaza una escala que no cabe en el mapa", () => {
    expect(() => createScaledCity(1, { parcelCount: 5_000 })).toThrow(RangeError);
  });

  it("ordena los ids del juego igual por comparación relacional que por localeCompare", () => {
    const city = createScaledCity(7, { parcelCount: 200 });
    const groups = [
      [...city.agents.keys()],
      [...city.phase2.buildings.keys()],
      [...city.phase2.parcels.keys()],
      [...city.phase2.facilities.keys()],
      [...city.phase2.loans.keys()],
      [...city.phase2.constructionSites.keys()],
    ];
    for (const ids of groups) {
      expect(ids.length).toBeGreaterThan(0);
      expect([...ids].sort(relational)).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    }
  });

  it.skipIf(environment.process?.env?.SYSTEM_COST !== "1")(
    "mide el coste por sistema y el crecimiento entre escalas",
    () => {
      const seed = Number(environment.process?.env?.SYSTEM_COST_SEED ?? 7);
      const measurements: ScaledCityMeasurement[] = SYSTEM_COST_SCALES.map((scale) =>
        measureScaledCity({ seed, scale, windows: SYSTEM_COST_WINDOWS, now }),
      );
      const largest = createScaledCity(seed, {
        parcelCount: SYSTEM_COST_SCALES[SYSTEM_COST_SCALES.length - 1]!.parcels,
      });
      environment.console.log(
        JSON.stringify(
          {
            seed,
            ordering: {
              agents: measureOrdering([...largest.agents.keys()]),
              buildings: measureOrdering([...largest.phase2.buildings.keys()]),
              contracts: measureOrdering(
                Object.keys(largest.phase2.insurance.contractsByBuildingId),
              ),
            },
            scales: measurements.map((measurement) => ({
              scaleId: measurement.scaleId,
              parcelCount: measurement.parcelCount,
              windows: measurement.windows.map((costWindow) => ({
                label: costWindow.label,
                ticks: costWindow.ticks,
                counts: costWindow.counts,
                endCounts: costWindow.endCounts,
                plainTick: costWindow.plainTick,
                instrumentedTick: costWindow.instrumentedTick,
                systems: costWindow.systems,
              })),
            })),
            growth: SYSTEM_COST_WINDOWS.map((costWindow) =>
              summarizeScaleGrowth(measurements, costWindow.label),
            ),
          },
          null,
          2,
        ),
      );
    },
    900_000,
  );
});

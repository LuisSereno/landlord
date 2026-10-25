import { describe, expect, it } from "vitest";

import { advanceProductSystems, PRODUCT_SYSTEMS } from "./systems";
import { canonicalizeState } from "./runner";
import { GAME_HOUR_TICKS, GAME_MONTH_TICKS } from "./game-data";
import { parseTick } from "@landlord/shared";
import {
  createScaledCity,
  describeScaledCity,
  injectScaledIncidents,
  measurementStartTick,
  measureMonthlyCloses,
  measureScaledCity,
  summarizeScaleGrowth,
  SYSTEM_COST_SCALES,
  SYSTEM_COST_WINDOWS,
  windowCrossesMonthClose,
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

  it("la ventana mensual cruza el cierre después del warmup, no dentro de él", () => {
    const month = SYSTEM_COST_WINDOWS.find((entry) => entry.label === "month")!;
    const warmup = 60;
    expect(windowCrossesMonthClose(month, warmup)).toBe(true);
    const start = measurementStartTick(month, warmup);
    expect(start).toBe(GAME_MONTH_TICKS - 3);
    for (const entry of SYSTEM_COST_WINDOWS.filter((item) => item.label !== "month")) {
      expect(windowCrossesMonthClose(entry, warmup), entry.label).toBe(false);
    }
  });

  it("los cierres mensuales se ejecutan dentro de la sección medida", () => {
    const month = SYSTEM_COST_WINDOWS.find((entry) => entry.label === "month")!;
    const warmup = 60;
    const state = createScaledCity(5, { parcelCount: 50 });
    const start = measurementStartTick(month, warmup);
    state.clock = { ...state.clock, tick: parseTick(start - warmup) };
    for (let tick = 0; tick < warmup; tick += 1) advanceProductSystems(state);
    expect(state.clock.tick).toBe(start);
    expect(state.phase2.politics.lastMoodTick).not.toBe(GAME_MONTH_TICKS);
    for (let tick = 0; tick < month.ticks; tick += 1) advanceProductSystems(state);
    /** La opinión sólo se mide al cerrar el mes: si el cierre quedó en warmup, este valor sería nulo. */
    expect(state.phase2.politics.lastMoodTick).toBe(GAME_MONTH_TICKS);
    expect(state.phase2.municipal.lastSettlementTick).toBe(GAME_MONTH_TICKS);
    expect(state.clock.tick).toBeGreaterThan(GAME_MONTH_TICKS);
  });

  it("separa el cierre mensual del tick ordinario en la ventana month", () => {
    const measurement = measureScaledCity({
      seed: 5,
      scale: SYSTEM_COST_SCALES[0]!,
      windows: SYSTEM_COST_WINDOWS.filter((entry) => entry.label === "month"),
      now,
    });
    const costWindow = measurement.windows[0]!;
    /** El cierre existe, se identificó y salió del recuento del tick ordinario. */
    expect(costWindow.monthClose).not.toBeNull();
    expect(costWindow.monthClose!.tick).toBe(GAME_MONTH_TICKS);
    expect(costWindow.monthClose!.plainMs).toBeGreaterThanOrEqual(0);
    /** La muestra del cierre quedó fuera del tick ordinario: el p95 de la ventana ya no es el cierre. */
    expect(costWindow.ordinaryTick.maxMs).toBeLessThanOrEqual(costWindow.plainTick.maxMs);
    /** Las ventanas que no cruzan mes no inventan un cierre. */
    const day = measureScaledCity({
      seed: 5,
      scale: SYSTEM_COST_SCALES[0]!,
      windows: SYSTEM_COST_WINDOWS.filter((entry) => entry.label === "day"),
      now,
    });
    expect(day.windows[0]!.monthClose).toBeNull();
    expect(day.windows[0]!.ordinaryTick).toEqual(day.windows[0]!.plainTick);
  });

  it("la ventana de fuego calienta sin incendios y los coloca al empezar a medir", () => {
    const fire = SYSTEM_COST_WINDOWS.find((entry) => entry.label === "fire")!;
    const warmup = 60;
    const state = createScaledCity(7, { parcelCount: 50 });
    for (let tick = 0; tick < warmup; tick += 1) advanceProductSystems(state);
    /** Antes, el fuego venía puesto en la generación y su primera propagación se calentaba sin medir. */
    expect(state.phase2.incidents.size).toBe(0);
    const start = measurementStartTick(fire, warmup);
    expect(state.clock.tick).toBe(start);

    expect(injectScaledIncidents(state, fire.incidentCount)).toBe(fire.incidentCount);
    const injected = [...state.phase2.incidents.values()];
    expect(injected).toHaveLength(fire.incidentCount);
    for (const incident of injected) expect(incident.createdAtTick).toBe(start);

    /** El primer paso horario del fuego cae dentro de la sección medida, no en el warmup. */
    const firstHourTick = Math.ceil((start + 1) / GAME_HOUR_TICKS) * GAME_HOUR_TICKS;
    expect(firstHourTick).toBeGreaterThan(start);
    expect(firstHourTick).toBeLessThan(start + fire.ticks);
    expect(
      measureScaledCity({ seed: 7, scale: SYSTEM_COST_SCALES[0]!, windows: [fire], now })
        .windows[0]!.endCounts.incidents,
    ).toBeGreaterThan(0);
  });

  it("mide el cierre mensual como distribución sobre varias semillas", () => {
    const measurement = measureMonthlyCloses({
      scale: SYSTEM_COST_SCALES[0]!,
      seeds: [5, 11],
      closesPerSeed: 2,
      now,
    });
    expect(measurement.closeSamplesMs).toHaveLength(4);
    expect(measurement.close.meanMs).toBeGreaterThan(measurement.ordinaryTick.meanMs);
    /** Con cuatro muestras el p95 del cierre vuelve a ser el máximo: se documenta, no se vende de otra cosa. */
    expect(measurement.close.p95Ms).toBeCloseTo(measurement.close.maxMs, 10);
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
                ordinaryTick: costWindow.ordinaryTick,
                monthClose: costWindow.monthClose,
                instrumentedTick: costWindow.instrumentedTick,
                systems: costWindow.systems,
              })),
            })),
            growth: SYSTEM_COST_WINDOWS.map((costWindow) =>
              summarizeScaleGrowth(measurements, costWindow.label),
            ),
            /**
             * El cierre mensual medido como campaña longitudinal real: 8 semillas × 6 cierres = 48 muestras.
             * Cada semilla genera UNA ciudad que vive múltiples cierres en secuencia, acumulando estado
             * (préstamos pagados, mercado de vivienda evolucionado, etc.). Esto reemplaza el benchmark
             * sintético anterior que saltaba el reloj y medía ciudades que nunca vivieron el cierre anterior.
             * La ventana `month` del arnés ordinario tiene seis muestras y su p95 es el máximo de un
             * solo cierre; por eso se separa aquí.
             */
            monthlyClose: measureMonthlyCloses({
              scale: SYSTEM_COST_SCALES[SYSTEM_COST_SCALES.length - 1]!,
              seeds: [1, 2, 3, 4, 5, 6, 7, 8],
              closesPerSeed: 6,
              now,
            }),
          },
          null,
          2,
        ),
      );
    },
    900_000,
  );
});

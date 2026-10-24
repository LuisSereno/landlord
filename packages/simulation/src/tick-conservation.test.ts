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
 *
 * Regeneración WP4.4 (2026-10-23): el estado gana `phase2.employment` y `incomeFactorPercent` por
 * hogar. Otra vez cambia la forma del estado y no la economía: los diez observables siguen siendo
 * idénticos porque los hogares sintéticos son autorados y conservan su presupuesto de escenario.
 *
 * Regeneración WP4.5 (2026-10-23): el municipio gasta. Sólo cambian los dos casos que cruzan un
 * cierre mensual, y sólo en la caja municipal (`org_00000004`) y en el número e importe de
 * transacciones, por los pagos de administración, seguridad y servicios. Jugador, rival, banco,
 * aseguradora, hogares, ruinas, incidentes y bajas siguen idénticos.
 *
 * Regeneración WP4.6 (2026-10-23): el municipio añade la tasa por unidad ocupada y reparte el
 * gasto en transporte, seguridad y limpieza. Vuelven a cambiar sólo los dos casos que cruzan un
 * cierre mensual, y sólo en la caja municipal y sus transacciones.
 *
 * Regeneración WP4.8 (2026-10-24): la reputación añade su cierre mensual y la influencia que el
 * gobierno deposita en cada empresa. Cambian otra vez los dos casos que cruzan un cierre mensual, y
 * sólo en la influencia de las empresas: las cinco cajas y el número de transacciones quedan
 * idénticos porque en ocho ticks no hay impago, desalojo ni abandono que anotar. Se verificó
 * neutralizando las tres tablas de efecto: con ellas a cero los diez digestos recuperan el valor de
 * WP4.7, así que el delta procede sólo de los canales pretendidos.
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
    expected: "3e74222da9a56f00",
    run: () => digest(canonicalizeState(runScenario(1, [], 1_200).state)),
  },
  {
    id: "scenario:seed-7:1200",
    expected: "14103ef0c3275ac8",
    run: () => digest(canonicalizeState(runScenario(7, [], 1_200).state)),
  },
  {
    id: "scenario:seed-42:1200",
    expected: "59e99227f5cb1b75",
    run: () => digest(canonicalizeState(runScenario(42, [], 1_200).state)),
  },
  {
    id: "scenario:seed-1:36000",
    expected: "6a05240180ec5c23",
    run: () => digest(canonicalizeState(runScenario(1, [], 36_000).state)),
  },
  {
    id: "city:50-parcels:1300-ticks",
    expected: "647ab036ce6ca6b9",
    run: () => cityDigest({ parcelCount: 50, ticks: 1_300 }),
  },
  {
    id: "city:50-parcels:month-boundary",
    expected: "611b01b5e69f0d61",
    run: () => cityDigest({ parcelCount: 50, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  {
    id: "city:200-parcels:month-boundary",
    expected: "7ab1cf04050e3d4d",
    run: () => cityDigest({ parcelCount: 200, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  // Las tres carreras siguientes llegan a colapso y explosión: cubren el recuento de bajas, el
  // desplazamiento de tenants y el daño en cadena, que sólo se ejecutan con incidentes vivos.
  {
    id: "city:50-parcels:fire-cascade",
    expected: "62873e8d5297617a",
    run: () => cityDigest({ parcelCount: 50, ticks: 3_000, incidentCount: 12 }),
  },
  {
    id: "city:200-parcels:fire-cascade",
    expected: "54850d16ca272de4",
    run: () => cityDigest({ parcelCount: 200, ticks: 3_000, incidentCount: 40 }),
  },
  {
    id: "city:800-parcels:fire-cascade",
    expected: "39bdd4d3f1ced61a",
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

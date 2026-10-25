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
 *
 * Regeneración WP4.10 (2026-10-24): la IA estratégica gana memoria, perfiles de facción y roce territorial.
 * Cambia un solo digesto, `scenario:seed-1:36000`, el único caso en el que el rival toma decisiones durante
 * un mes completo; los otros nueve son idénticos. Neutralizando la escalada antirrepetición y la presión
 * territorial los diez recuperan el valor de WP4.9 (`6a05240180ec5c23` en este caso), así que el delta
 * procede sólo de los canales pretendidos. En ese escenario el rival pasa de 2 a 3 solares, de 9 a 3
 * acciones fallidas y de 21 a 26 transacciones, y su caja termina en 2815 en vez de 3066: tras tres
 * rechazos deja de golpear la misma parcela, espera y pide financiación al banco (org_00000003 baja de
 * 100000 a 99400). La caja del jugador no se mueve. Doce ciclos quedaron cortados por la memoria.
 *
 * Regeneración WP4.11 (2026-10-24): el estado canónico gana `phase2.politics`, así que cambian los diez
 * digestos. El bloque nuevo explica ocho de ellos: al quitarlo (`JSON.parse` + `delete politics`) los
 * ocho recuperan exactamente su valor de WP4.10, incluida la carrera de 800 parcelas. Los dos casos que
 * faltan son los cruces de cierre mensual, y ahí la diferencia sí es económica: el partido que gobierna
 * reordena el pago de la caja municipal, como pretende el WP. Neutralizando la transferencia (un
 * `governingPartyId` fuera del catálogo hace que `budgetPriorityFor` devuelva el orden por defecto) y
 * quitando el bloque, ambos recuperan `611b01b5e69f0d61` y `7ab1cf04050e3d4d`, sus digestos de WP4.10.
 * Ninguna otra caja, transacción, hogar ni incidente se mueve por otro canal.
 *
 * Regeneración WP4.11-H (2026-10-25): el estado canónico gana `crews`, `incidents`,
 * `phase2.idCounters`, `pendingCommands`, `employment`, `municipal`, `housingMarket`, `contracts`,
 * `reputation`, `intelligence` y `factions`; además `balances`, `inventories` e influencia pasan a
 * serializar su id y todas las claves se ordenan recursivamente. Cambian los diez digestos.
 * Atribución verificada: reconstruyendo la serialización canónica anterior sobre los mismos estados
 * nuevos salen exactamente los diez valores de WP4.11 (`cbfb3f7c51f0233c`, `ab1719956d062dac`,
 * `55cd7cc60cd9c651`, `09ba274d438311f3`, `bf1ac7fb74da8b89`, `8cd19ed973a256a1`, `ffaabc2525434a22`,
 * `1269681c889cb606`, `95489f25a3251d3a`, `cb47c7206fe65ef0`). Ninguna caja, transacción, baja,
 * desplazamiento ni decisión de estos escenarios se movió: el delta es superficie canónica. Las
 * reglas nuevas de censo, eje fiscal, ordenanza y reputación no se ejercitan aquí porque ningún caso
 * celebra elección, ni desaloja en proporción distinta, ni cambia la lectura bancaria.
 *
 * Regeneración WP4.11-H.1 (2026-10-25): cambian los diez digestos por dos motivos de superficie y
 * ninguno económico. (a) Cada `IncidentRecord` gana `publiclyAttributedOrganizationId` (D-076 punto 2:
 * la atribución pública separada de la verdad autoritativa); sólo tocan los cinco casos con incidentes
 * vivos. (b) `canonicalizeState` deja de serializar `clock.runState` y `clock.speed` (D-076 punto 3:
 * son controles del scheduler que la snapshot no guarda, así que una partida guardada corriendo a 4x no
 * podía cargar canónicamente igual). Atribución verificada sobre los estados nuevos: quitando la clave
 * `publiclyAttributedOrganizationId` y volviendo a meter `"runState":"paused","speed":1` dentro de
 * `clock`, los diez recuperan exactamente sus valores de WP4.11-H (`3112921f3895fda7`,
 * `f896686c9cd189a1`, `5d3bb2ce7c992fee`, `0dc2c0afcbb37013`, `aa6df9560bd75329`, `ea45762a6d3c88b9`,
 * `c9880ee1531a61c2`, `7c2c82428577dd48`, `69b80619079b5568`, `e5011f6ed4c2e30a`). Además en estos diez
 * casos ningún incidente queda con autor atribuido y ningún estado registra `violent_sabotage`, así que
 * la puerta de atribución nueva no mueve reputación, caja ni decisiones: el delta es superficie.
 *
 * Regeneración WP4.12-R (2026-10-25): el estado canónico gana `phase2.macroEvents` completo (eventos
 * activos, ordinal, arroyo de shocks y próximo sorteo). Cambian los diez digestos por superficie; la
 * atribución se verificó eliminando la clave `macroEvents` del estado canónico nuevo, con lo que los
 * diez recuperan exactamente sus valores de WP4.11-H.1 (`290ae56589918230`, `81470bc663a2116a`,
 * `2eedd2a42fda6677`, `440287b1646aa604`, `c99ebd1caffb8af6`, `2b460e2479f02a02`, `2ae6584f346b79b3`,
 * `a7c43328b70b75c5`, `787f7087a4af7f99`, `f5fcd654560b88e7`). El sorteo natural no disparó ningún
 * shock en estos diez casos (10 % mensual y sólo tres cruzan un cierre), así que tampoco hay delta
 * económico que atribuir: las pruebas de macroeventos cubren trigger, efectos y reacción de IA aparte.
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
    expected: "f7867a5a1e57fdd9",
    run: () => digest(canonicalizeState(runScenario(1, [], 1_200).state)),
  },
  {
    id: "scenario:seed-7:1200",
    expected: "26267ba2389a386f",
    run: () => digest(canonicalizeState(runScenario(7, [], 1_200).state)),
  },
  {
    id: "scenario:seed-42:1200",
    expected: "9cc24e739ecde8bf",
    run: () => digest(canonicalizeState(runScenario(42, [], 1_200).state)),
  },
  {
    id: "scenario:seed-1:36000",
    expected: "d766a1f2d895a5cd",
    run: () => digest(canonicalizeState(runScenario(1, [], 36_000).state)),
  },
  {
    id: "city:50-parcels:1300-ticks",
    expected: "0281775ece6fa189",
    run: () => cityDigest({ parcelCount: 50, ticks: 1_300 }),
  },
  {
    id: "city:50-parcels:month-boundary",
    expected: "6940184eb08761a5",
    run: () => cityDigest({ parcelCount: 50, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  {
    id: "city:200-parcels:month-boundary",
    expected: "74d9cf8b0fe0ecc0",
    run: () => cityDigest({ parcelCount: 200, ticks: 8, incidentCount: 12, startTick: 35_997 }),
  },
  // Las tres carreras siguientes llegan a colapso y explosión: cubren el recuento de bajas, el
  // desplazamiento de tenants y el daño en cadena, que sólo se ejecutan con incidentes vivos.
  {
    id: "city:50-parcels:fire-cascade",
    expected: "ed5e94dedebe2ea8",
    run: () => cityDigest({ parcelCount: 50, ticks: 3_000, incidentCount: 12 }),
  },
  {
    id: "city:200-parcels:fire-cascade",
    expected: "8b4904c945c9f8ff",
    run: () => cityDigest({ parcelCount: 200, ticks: 3_000, incidentCount: 40 }),
  },
  {
    id: "city:800-parcels:fire-cascade",
    expected: "94b9cc664d254f39",
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

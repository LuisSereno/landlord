import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { parseBuildingId, type Building } from "@landlord/shared";
import { MUNICIPALITY_ORGANIZATION_ID, PLAYER_ORGANIZATION_ID } from "./game-data";
import {
  demandUnitsPerCapacityFor,
  facilityCoverageIndex,
  facilityServiceDistanceReport,
  listFacilitiesForService,
  operationalFacilityCapacity,
  type FacilityServiceId,
} from "./facility-coverage";
import { CANONICAL_CITY_SEEDS } from "./city-fixtures";
import { createInitialState, type GameState } from "./state";

/**
 * V.d-H2 · H2-04 harness de balance de servicios municipales.
 *
 * Corre sobre las 12 seeds canónicas de ciudad y fija, PARA EL MODELO ACTUAL, la foto completa
 * de demanda / capacidad / cobertura / saturación / distancia por servicio. No cambia ninguna
 * regla de juego: es observabilidad. La salida se guarda como evidencia en
 * `docs/execution/phase-4/vd-h2-service-baseline.json` para que los fixes H2-05…H2-09 tengan
 * un antes medido, no un antes recordado.
 *
 * No sobrescribe la evidencia de H1: `SERVICES_BALANCE_OUT` permite redirigir sin tocar el
 * camino canónico. `pnpm services:balance` escribe en el fichero nuevo; una corrida histórica
 * puede exportar a otro destino.
 */

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

const enabled = process.env.SERVICES_BALANCE === "1";

const SERVICES: readonly FacilityServiceId[] = [
  "security",
  "fire",
  "health",
  "education",
  "market",
  "parks",
  "transport",
];

/** Servicios que tienen facility física con capacidad; parks y transport no consumen slots. */
const CAPACITY_SERVICES: ReadonlySet<FacilityServiceId> = new Set([
  "security",
  "fire",
  "health",
  "education",
  "market",
]);

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function median(values: readonly number[]): number {
  return percentile(values, 0.5);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * H2-08 · escenarios de crecimiento. Se colocan edificios privados deterministas hasta alcanzar
 * un porcentaje objetivo de parcelas marketable DESARROLLADAS, respetando la topología y sin
 * tocar las seeds: sólo se añade estado. `state.phase2.buildings.set` es el único mutation.
 * Orden canónico: parcelas por `parcelId.localeCompare`, distritos por `districtId.localeCompare`.
 */
function growCity(state: GameState, targetDevelopedPercent: number): void {
  if (targetDevelopedPercent <= 0) return;
  const marketable = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .sort((left, right) => {
      const districtOrder = left.districtId.localeCompare(right.districtId);
      if (districtOrder !== 0) return districtOrder;
      return left.id.localeCompare(right.id);
    });
  const alreadyDeveloped = new Set(
    [...state.phase2.buildings.values()]
      .filter(
        (building) =>
          building.state !== "ruin" &&
          building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID,
      )
      .map((building) => building.parcelId),
  );
  const target = Math.round((marketable.length * targetDevelopedPercent) / 100);
  let developed = alreadyDeveloped.size;
  let serial = 20_000;
  for (const parcel of marketable) {
    if (developed >= target) return;
    if (alreadyDeveloped.has(parcel.id)) continue;
    const id = parseBuildingId(`building_${String(serial).padStart(8, "0")}`);
    serial += 1;
    parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    state.phase2.buildings.set(id, {
      id,
      parcelId: parcel.id,
      districtId: parcel.districtId,
      footprintCells: [{ ...parcel.anchorCell }],
      orientation: 0,
      floors: 1,
      form: "detached",
      ownerOrganizationId: PLAYER_ORGANIZATION_ID,
      productionFacilityId: null,
      type: "courtyard_home",
      level: 1,
      condition: 100,
      tenantId: null,
      tenantIds: [],
      upgraded: false,
      structuralIntegrity: 100,
      state: "operational",
      casualtiesTotal: { injured: 0, dead: 0 },
    } satisfies Building);
    developed += 1;
  }
}

const SCENARIOS: ReadonlyArray<{
  name: string;
  developedPercent: number;
  band?: [number, number];
}> = [
  { name: "initial", developedPercent: 0 },
  { name: "25_percent", developedPercent: 25 },
  { name: "50_percent", developedPercent: 50, band: [60, 90] },
  { name: "75_percent", developedPercent: 75, band: [45, 80] },
];

function measureSeed(seed: number, developedPercent = 0) {
  const state = createInitialState(seed);
  growCity(state, developedPercent);
  const coverage = facilityCoverageIndex(state);
  const parcels = [...state.phase2.parcels.values()];
  const marketable = parcels.filter((parcel) => parcel.disposition === "marketable");
  /**
   * Parcela "desarrollada" (H2-05): una marketable con al menos un edificio privado no-ruin.
   * El modelo actual NO la usa como demanda —usa toda marketable— pero el harness la mide
   * para hacer visible la distancia entre "parcela catastral" y "parcela urbana".
   */
  const developedParcelIds = new Set(
    [...state.phase2.buildings.values()]
      .filter(
        (building) =>
          building.state !== "ruin" &&
          building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID,
      )
      .map((building) => building.parcelId),
  );
  const privateNonRuinBuildings = [...state.phase2.buildings.values()].filter(
    (building) =>
      building.state !== "ruin" && building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID,
  );
  const occupiedTenants = privateNonRuinBuildings.reduce(
    (total, building) => total + building.tenantIds.length,
    0,
  );
  const developedParcels = marketable.filter((parcel) => developedParcelIds.has(parcel.id));

  const perService: Record<string, unknown> = {};
  for (const service of SERVICES) {
    const facilities = listFacilitiesForService(state, service);
    const distances = facilityServiceDistanceReport(state, service);
    const reachableCosts = distances
      .map((entry) => entry.cost)
      .filter((cost): cost is number => cost !== null);
    const unreachable = distances.filter((entry) => entry.cost === null).length;

    /**
     * Reporte por facility agregado a nivel de ciudad. `demand` aquí es la parcela Voronoi'd
     * asignada a la facility, NO la demanda potencial alcanzable: la distinción es el germen
     * de H2-06. Para parks/transport, que no tienen facility física, `demand` es directamente
     * el número de parcelas alcanzables.
     */
    const reports = [...coverage.facilities.values()].filter((entry) => entry.service === service);
    const voronoiDemand = reports.reduce((total, entry) => total + entry.firstChoiceDemand, 0);
    /**
     * `served` uniforme: parcelas DESARROLLADAS con cobertura ≥ 50 en este servicio. Bajo H2-05
     * una parcela vacante no puede aparecer servida en un capacity service; sí en parks/transport.
     */
    const served = (CAPACITY_SERVICES.has(service) ? developedParcels : marketable).filter(
      (parcel) => (coverage.byParcelId.get(parcel.id)?.[service] ?? 0) >= 50,
    ).length;
    const effectiveCapacity = reports.reduce((total, entry) => total + entry.effectiveCapacity, 0);
    const authoredCapacityCohorts = facilities.reduce((total, entry) => total + entry.capacity, 0);
    const operationalCapacityCohorts = facilities.reduce(
      (total, entry) => total + operationalFacilityCapacity(state, entry),
      0,
    );
    const saturatedFacilities = reports.filter((entry) => entry.saturated).length;
    /**
     * `unusedCapacity`: holgura efectiva no usada por la Voronoi. Es el número que H2-06 debe
     * reducir sin cambiar el programa municipal (misma facility count, mismo authored capacity).
     */
    const unusedCapacity = reports.reduce(
      (total, entry) => total + Math.max(0, entry.effectiveCapacity - entry.served),
      0,
    );
    /**
     * Cobertura por distrito sobre las parcelas `marketable` del propio distrito. Se mide sobre
     * todas, no sobre las servidas: el denominador es lo que el jugador ve en el mapa.
     */
    const coverageByDistrict = [...state.world.city.districtIds].map((districtId) => {
      const districtParcels = marketable.filter((parcel) => parcel.districtId === districtId);
      const districtDeveloped = districtParcels.filter((parcel) =>
        developedParcelIds.has(parcel.id),
      );
      const coveredCount = districtParcels.filter(
        (parcel) => (coverage.byParcelId.get(parcel.id)?.[service] ?? 0) >= 50,
      ).length;
      return {
        districtId,
        marketableParcels: districtParcels.length,
        developedParcels: districtDeveloped.length,
        coveragePercent:
          districtParcels.length === 0
            ? 0
            : Math.round((coveredCount * 100) / districtParcels.length),
      };
    });

    /**
     * Métricas estructurales de capacidad (H2-07/08):
     * - `reachableDemand` (capacity services) = parcelas marketable ALCANZABLES **y DESARROLLADAS**.
     *   Bajo H2-05 una vacante puede estar "al alcance" de una facility sin consumir su capacidad;
     *   no es parte de la cobertura que se quiere medir.
     * - `theoreticalCapacityCoverage`: qué porcentaje de esa demanda podría servir la capacidad
     *   efectiva TOTAL, sin Voronoi ni spill.
     * - `actualCoverage`: el mismo denominador, lo que el algoritmo sirve hoy.
     * - `strandedCapacity`: capacidad disponible ociosa mientras hay demanda alcanzable sin servir
     *   — la firma del Voronoi "nearest first, capacity applied" antes de H2-06.
     *
     * Para parks y transport el denominador sigue siendo TODAS las marketables: son accesibilidad
     * geográfica, no consumo de slots.
     */
    const reachableCostsActive = CAPACITY_SERVICES.has(service)
      ? developedParcels
          .map((parcel) => {
            const entry = distances.find((candidate) => candidate.parcelId === parcel.id);
            return entry?.cost ?? null;
          })
          .filter((cost): cost is number => cost !== null)
      : reachableCosts;
    const reachableDemand = reachableCostsActive.length;
    const theoreticalCapacityCoverage =
      reachableDemand === 0
        ? 100
        : Math.min(100, Math.round((effectiveCapacity * 100) / reachableDemand));
    const actualCoverage = reachableDemand === 0 ? 0 : Math.round((served * 100) / reachableDemand);
    const unfulfilledReachableDemand = Math.max(0, reachableDemand - served);
    const strandedCapacity =
      unfulfilledReachableDemand === 0 ? 0 : Math.min(unusedCapacity, unfulfilledReachableDemand);

    perService[service] = {
      hasCapacity: CAPACITY_SERVICES.has(service),
      facilities: facilities.length,
      authoredCapacityCohorts,
      operationalCapacityCohorts,
      /**
       * H2.1-03: la unidad canónica es POR SERVICIO desde H2-07 (security 75 · fire 75 · health
       * 25 · education 17 · market 25; parks y transport conservan 25 porque no consumen
       * capacidad real). Publicar el scalar global `DEMAND_UNITS_PER_CAPACITY` = 25 como si fuera
       * la unidad de los cinco services capacity-aware era un error de evidencia: las cohortes
       * medidas en el informe no cuadran con ninguna de esas cinco cifras.
       */
      capacityUnitParcels: demandUnitsPerCapacityFor(service),
      effectiveCapacityParcels: effectiveCapacity,
      demand: CAPACITY_SERVICES.has(service) ? voronoiDemand : reachableDemand,
      served,
      coveragePercent: marketable.length === 0 ? 0 : Math.round((served * 100) / marketable.length),
      saturatedFacilities,
      unreachableDemand: unreachable,
      unusedCapacity,
      theoreticalCapacityCoverage,
      actualCoverage,
      strandedCapacity,
      travelCostParcelsMeasured: reachableCosts.length,
      travelCostP50: percentile(reachableCosts, 0.5),
      travelCostP95: percentile(reachableCosts, 0.95),
      coverageByDistrict,
    };
  }

  return {
    seed,
    marketableParcels: marketable.length,
    developedParcels: developedParcels.length,
    privateNonRuinBuildings: privateNonRuinBuildings.length,
    occupiedTenants,
    services: perService,
  };
}

describe.skipIf(!enabled)("V.d-H2 · baseline de balance de servicios municipales", () => {
  it("barre las 12 seeds canónicas y publica el baseline JSON", () => {
    /**
     * H2-04 · `initial` preserva la semántica del baseline: la ciudad recién generada, sin
     * desarrollo humano. H2-08 · `25_percent`, `50_percent` y `75_percent` fijan las bandas
     * de calibración sin alterar topología, programa municipal ni seeds. Los escenarios no
     * son una simulación temporal: son harnesses de balance.
     */
    const scenarioResults: Record<
      string,
      {
        perSeed: ReturnType<typeof measureSeed>[];
        aggregate: Record<string, Record<string, number>>;
      }
    > = {};
    for (const scenario of SCENARIOS) {
      const perSeed = CANONICAL_CITY_SEEDS.map((seed) =>
        measureSeed(seed, scenario.developedPercent),
      );

      const aggregate: Record<string, Record<string, number>> = {};
      for (const service of SERVICES) {
        const field = (name: string): number[] =>
          perSeed.map((entry) => {
            const record = entry.services[service] as
              Record<string, number | undefined> | undefined;
            const value = record?.[name];
            return typeof value === "number" ? value : 0;
          });
        aggregate[service] = {
          medianMarketable: median(perSeed.map((entry) => entry.marketableParcels)),
          medianDeveloped: median(perSeed.map((entry) => entry.developedParcels)),
          medianDemand: median(field("demand")),
          medianServed: median(field("served")),
          medianCoverage: median(field("coveragePercent")),
          medianEffectiveCapacity: median(field("effectiveCapacityParcels")),
          medianSaturatedFacilities: median(field("saturatedFacilities")),
          medianUnreachable: median(field("unreachableDemand")),
          medianUnusedCapacity: median(field("unusedCapacity")),
          medianStrandedCapacity: median(field("strandedCapacity")),
          medianActualCoverage: median(field("actualCoverage")),
          medianTheoreticalCoverage: median(field("theoreticalCapacityCoverage")),
          medianTravelCostP95: median(field("travelCostP95")),
          p10ActualCoverage: percentile(field("actualCoverage"), 0.1),
          p90ActualCoverage: percentile(field("actualCoverage"), 0.9),
          maxDemand: Math.max(...field("demand")),
          maxStranded: Math.max(...field("strandedCapacity")),
        };
        for (const key of Object.keys(aggregate[service]!)) {
          aggregate[service]![key] = round2(aggregate[service]![key]!);
        }
      }

      scenarioResults[scenario.name] = { perSeed, aggregate };

      /**
       * Bandas de H2-08: se evalúan sobre la mediana y el p10/p90 de `actualCoverage` de los
       * cinco capacity services. No se exige que cada seed individual caiga dentro: la banda
       * es una señal de calibración, no un contrato por semilla.
       *
       * El flag `SERVICES_BALANCE_BANDS=0` desactiva las aserciones para la corrida de
       * calibración: H2-07 deriva las constantes leyendo estos números, no al revés.
       */
      const enforceBands = environment.process?.env?.SERVICES_BALANCE_BANDS !== "0";
      if (scenario.band && enforceBands) {
        for (const service of CAPACITY_SERVICES) {
          const entry = aggregate[service]!;
          const demand = entry["medianDemand"]!;
          if (demand === 0) continue;
          const median_ = entry["medianActualCoverage"]!;
          expect(
            median_,
            `${scenario.name}/${service}: mediana ${median_} fuera de banda [${scenario.band.join(", ")}]`,
          ).toBeGreaterThanOrEqual(scenario.band[0]);
          expect(
            median_,
            `${scenario.name}/${service}: mediana ${median_} fuera de banda [${scenario.band.join(", ")}]`,
          ).toBeLessThanOrEqual(scenario.band[1]);
        }
      }
    }

    const evidence = {
      head: execSync("git rev-parse HEAD").toString().trim(),
      generatedAt: new Date().toISOString(),
      tool: "pnpm services:balance",
      phase: "V.d-H2 · H2-04 + H2-08 · corregido en H2.1-03 (cohorte por servicio)",
      demandModel:
        "demanda = parcela marketable desarrollada (H2-05); asignación capacity-aware (H2-06)",
      seeds: CANONICAL_CITY_SEEDS.length,
      /** H2.1-03: mapa explícito por servicio; el scalar global ya no describe a ninguno de los cinco. */
      capacityUnitParcelsByService: Object.fromEntries(
        SERVICES.map((service) => [service, demandUnitsPerCapacityFor(service)]),
      ),
      scenarios: SCENARIOS.map((scenario) => ({
        name: scenario.name,
        developedPercent: scenario.developedPercent,
        band: scenario.band,
      })),
      aggregate: scenarioResults["initial"]!.aggregate,
      scenarioAggregates: Object.fromEntries(
        Object.entries(scenarioResults).map(([name, value]) => [name, value.aggregate]),
      ),
      perSeed: scenarioResults["initial"]!.perSeed,
      scenarioPerSeed: Object.fromEntries(
        Object.entries(scenarioResults).map(([name, value]) => [name, value.perSeed]),
      ),
    };
    console.log(JSON.stringify({ head: evidence.head, aggregate: evidence.aggregate }, null, 2));
    /**
     * H2-04 escribió la primera corrida en `vd-h2-service-baseline.json` (modelo pre-H2, sin
     * filtros de desarrollo). Con H2-05/H2-06/H2-07/H2-08 el mismo comando refleja el modelo
     * nuevo y se guardó como `vd-h2-service-final.json`. H2.1-03 corrige UNA etiqueta de
     * evidencia —la cohorte por servicio—, así que la corrida actual escribe en fichero propio y
     * no pisa ninguna de las dos fotografías históricas.
     */
    const evidencePath =
      environment.process?.env?.SERVICES_BALANCE_OUT ??
      "docs/execution/phase-4/vd-h21-service-final.json";
    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    expect(scenarioResults["initial"]!.perSeed).toHaveLength(12);
    for (const entry of scenarioResults["initial"]!.perSeed)
      expect(entry.marketableParcels).toBeGreaterThan(0);
  }, 900_000);
});

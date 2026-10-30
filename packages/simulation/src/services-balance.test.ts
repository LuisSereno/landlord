import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  MUNICIPALITY_ORGANIZATION_ID,
} from "./game-data";
import {
  DEMAND_UNITS_PER_CAPACITY,
  facilityCoverageIndex,
  facilityServiceDistanceReport,
  listFacilitiesForService,
  operationalFacilityCapacity,
  type FacilityServiceId,
} from "./facility-coverage";
import { CANONICAL_CITY_SEEDS } from "./city-fixtures";
import { createInitialState } from "./state";

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

function measureSeed(seed: number) {
  const state = createInitialState(seed);
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
          building.state !== "ruin" && building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID,
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
    const voronoiDemand = reports.reduce((total, entry) => total + entry.demand, 0);
    /**
     * `served` uniforme: parcelas marketable con cobertura ≥ 50 en este servicio. Es lo mismo
     * que suman los `entry.served` de las capacity facilities, pero también funciona para parks
     * y transport, donde no hay facility reports.
     */
    const served = marketable.filter(
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
      const districtDeveloped = districtParcels.filter((parcel) => developedParcelIds.has(parcel.id));
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
     * - `theoreticalCapacityCoverage`: qué porcentaje de la demanda ALCANZABLE (parcels con coste
     *   finito) podría servir la capacidad efectiva TOTAL de este servicio, sin Voronoi.
     * - `actualCoverage`: el mismo denominador, pero lo que el algoritmo sirve HOY.
     * - `strandedCapacity`: capacidad efectiva disponible que el algoritmo deja ociosa mientras
     *   hay demanda alcanzable sin servir — la firma del Voronoi "nearest first, capacity applied".
     */
    const reachableDemand = reachableCosts.length;
    const theoreticalCapacityCoverage =
      reachableDemand === 0
        ? 100
        : Math.min(100, Math.round((effectiveCapacity * 100) / reachableDemand));
    const actualCoverage =
      reachableDemand === 0 ? 0 : Math.round((served * 100) / reachableDemand);
    const unfulfilledReachableDemand = Math.max(0, reachableDemand - served);
    const strandedCapacity =
      unfulfilledReachableDemand === 0
        ? 0
        : Math.min(unusedCapacity, unfulfilledReachableDemand);

    perService[service] = {
      hasCapacity: CAPACITY_SERVICES.has(service),
      facilities: facilities.length,
      authoredCapacityCohorts,
      operationalCapacityCohorts,
      /** Unidad canónica actual: un cohorte vale `DEMAND_UNITS_PER_CAPACITY` parcelas. */
      capacityUnitParcels: DEMAND_UNITS_PER_CAPACITY,
      effectiveCapacityParcels: effectiveCapacity,
      demand: CAPACITY_SERVICES.has(service) ? voronoiDemand : reachableDemand,
      served,
      coveragePercent:
        marketable.length === 0 ? 0 : Math.round((served * 100) / marketable.length),
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
    const perSeed = CANONICAL_CITY_SEEDS.map((seed) => measureSeed(seed));

    const aggregate: Record<string, Record<string, number>> = {};
    for (const service of SERVICES) {
      const field = (name: string): number[] =>
        perSeed.map((entry) => {
          const record = entry.services[service] as Record<string, number | undefined> | undefined;
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
        maxDemand: Math.max(...field("demand")),
        maxStranded: Math.max(...field("strandedCapacity")),
      };
      for (const key of Object.keys(aggregate[service]!)) {
        aggregate[service]![key] = round2(aggregate[service]![key]!);
      }
    }

    const evidence = {
      head: execSync("git rev-parse HEAD").toString().trim(),
      generatedAt: new Date().toISOString(),
      tool: "pnpm services:balance",
      phase: "V.d-H2 · H2-04 (baseline pre-hardening)",
      demandModel: "toda parcela marketable cuenta como demanda (modelo actual, antes de H2-05)",
      seeds: CANONICAL_CITY_SEEDS.length,
      capacityUnitParcels: DEMAND_UNITS_PER_CAPACITY,
      aggregate,
      perSeed,
    };
    console.log(JSON.stringify({ head: evidence.head, aggregate }, null, 2));
    const evidencePath =
      environment.process?.env?.SERVICES_BALANCE_OUT ??
      "docs/execution/phase-4/vd-h2-service-baseline.json";
    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

    expect(perSeed).toHaveLength(12);
    for (const entry of perSeed) expect(entry.marketableParcels).toBeGreaterThan(0);
  }, 900_000);
});

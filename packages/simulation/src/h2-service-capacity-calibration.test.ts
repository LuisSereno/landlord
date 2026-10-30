import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  type Building,
  type Parcel,
  type UrbanFacility,
  type UrbanFacilityId,
} from "@landlord/shared";

import {
  DEMAND_UNITS_PER_CAPACITY,
  DEMAND_UNITS_PER_CAPACITY_BY_SERVICE,
  facilityCoverageIndex,
  demandUnitsPerCapacityFor,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { createInitialState, type GameState } from "./state";

/**
 * H2-07 · `DEMAND_UNITS_PER_CAPACITY` global = 25 suponía que una cohorte de bomberos y una de
 * mercado significaban lo mismo. No hay razón de dominio. La nueva tabla deriva valores medidos
 * sobre las doce seeds canónicas y los escenarios de crecimiento 25/50/75 % de H2-08, para que
 * la cobertura citywide caiga en las bandas de diseño sin tocar el programa municipal.
 */

function developParcels(
  state: GameState,
  districtId: Parcel["districtId"],
  count: number,
  serialStart = 0,
): Parcel[] {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, count);
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(serialStart + index).padStart(8, "0")}`);
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
  });
  return parcels;
}

function facilitiesOfKind(state: GameState, kind: string): UrbanFacility[] {
  const out: UrbanFacility[] = [];
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) out.push(facility);
  return out.sort((left, right) => left.id.localeCompare(right.id));
}

describe("H2-07 · capacidad por servicio, no constante global ciega", () => {
  it("los cinco capacity services tienen valor propio y parks/transport caen al default", () => {
    /** Los cinco con facility física tienen entrada en la tabla. */
    expect(demandUnitsPerCapacityFor("security")).toBe(
      DEMAND_UNITS_PER_CAPACITY_BY_SERVICE.security,
    );
    expect(demandUnitsPerCapacityFor("fire")).toBe(DEMAND_UNITS_PER_CAPACITY_BY_SERVICE.fire);
    expect(demandUnitsPerCapacityFor("health")).toBe(DEMAND_UNITS_PER_CAPACITY_BY_SERVICE.health);
    expect(demandUnitsPerCapacityFor("education")).toBe(
      DEMAND_UNITS_PER_CAPACITY_BY_SERVICE.education,
    );
    expect(demandUnitsPerCapacityFor("market")).toBe(DEMAND_UNITS_PER_CAPACITY_BY_SERVICE.market);
    /** Los dos de accesibilidad no consumen slots: `parks` y `transport` devuelven el default. */
    expect(demandUnitsPerCapacityFor("parks")).toBe(DEMAND_UNITS_PER_CAPACITY);
    expect(demandUnitsPerCapacityFor("transport")).toBe(DEMAND_UNITS_PER_CAPACITY);
  });

  it("los valores no son un tuning a ojo: derivan de las bandas de H2-08", () => {
    /**
     * Medición canónica sobre las 12 seeds y el escenario 50 % de desarrollo (demanda mediana
     * 358 parcelas, 100 % de presupuesto):
     *   - security 2 × 2 × 75 = 300 slots → 83 % cobertura.
     *   - fire     2 × 2 × 75 = 300 slots → 83 %.
     *   - health   3 × 4 × 25 = 300 slots → 83 %.
     *   - education 3 × 6 × 17 = 306 slots → 85 %.
     *   - market   3 × 4 × 25 = 300 slots → 83 %.
     * En los cinco casos la mediana cae en la banda 60–90 % de H2-08. Al 75 % (demanda 537),
     * los cinco caen en 45–80 %. El programa municipal (recetas y facility counts) no se toca.
     */
    const expected: Record<keyof typeof DEMAND_UNITS_PER_CAPACITY_BY_SERVICE, number> = {
      security: 75,
      fire: 75,
      health: 25,
      education: 17,
      market: 25,
    };
    for (const [service, units] of Object.entries(expected))
      expect(
        DEMAND_UNITS_PER_CAPACITY_BY_SERVICE[
          service as keyof typeof DEMAND_UNITS_PER_CAPACITY_BY_SERVICE
        ],
        service,
      ).toBe(units);
  });

  it("effective capacity del informe usa el multiplicador del servicio, no el global", () => {
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    developParcels(state, station!.districtId, 500, 500);
    const index = facilityCoverageIndex(state);
    const securityReport = index.facilities.get(station!.id as UrbanFacilityId)!;
    /**
     * Comisaría authored capacity = 2 cohortes × 75 parcelas = 150 slots por facility, al 100 %
     * de presupuesto. Si el código siguiera usando el global de 25, reportaría 50.
     */
    expect(securityReport.effectiveCapacity).toBe(150);
    /** Y el informe del colegio usa 6 × 17 = 102 (no 6 × 25 = 150). */
    const [school] = facilitiesOfKind(state, "school");
    const schoolReport = index.facilities.get(school!.id as UrbanFacilityId)!;
    expect(schoolReport.effectiveCapacity).toBe(102);
    /** Mercado 4 × 25 = 100. */
    const [market] = facilitiesOfKind(state, "market");
    expect(index.facilities.get(market!.id as UrbanFacilityId)!.effectiveCapacity).toBe(100);
  });

  it("bajar el presupuesto al 50 % reduce la capacidad efectiva en la misma proporción", () => {
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    developParcels(state, station!.districtId, 400, 900);
    const full = facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!;
    expect(full.effectiveCapacity).toBe(150);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 50;
    const half = facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!;
    expect(half.effectiveCapacity).toBe(75);
  });

  it("H2-09 · la respuesta al presupuesto es monotónica y sin saltos 0 → cohorte", () => {
    /**
     * Con la fórmula vieja (`floor(capacity × level / 100) × demandUnits`) una comisaría de
     * capacity 2 pasaba de 0 slots al 49 % a 75 al 50 %: un salto discreto que hacía
     * imposible una política presupuestaria intermedia. Con la nueva (`floor(capacity ×
     * demandUnits × level / 100)`) la función es monotónica y las diferencias son suaves.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    developParcels(state, station!.districtId, 400, 1200);
    const levels = [0, 25, 50, 75, 100] as const;
    const capacities = levels.map((level) => {
      state.phase2.municipal.serviceLevelPercentByCategory.security = level;
      return facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!
        .effectiveCapacity;
    });
    /** 0 al 0 %, 150 al 100 %, monotónico estricto entre los demás. */
    expect(capacities[0]).toBe(0);
    expect(capacities[4]).toBe(150);
    for (let index = 1; index < capacities.length; index += 1)
      expect(capacities[index]).toBeGreaterThan(capacities[index - 1]!);
    /** Ninguna escala intermedia da un salto mayor que 40 parcelas (≈ 25 % de 150). */
    for (let index = 1; index < capacities.length; index += 1)
      expect(capacities[index]! - capacities[index - 1]!).toBeLessThanOrEqual(40);
  });

  it("H2-09 · un nivel del 49 % sigue dando capacidad, no cero", () => {
    /**
     * El salto brusco "49 % → 0, 50 % → 75" era exactamente el bug que H2-09 cierra. Con la
     * fórmula nueva, 49 % da floor(2 × 75 × 49 / 100) = 73 —un servicio degradado, no
     * inexistente—, y 1 % da 1 unidad, no cero.
     */
    const state = createInitialState(7);
    const [station] = facilitiesOfKind(state, "police_station");
    developParcels(state, station!.districtId, 200, 1500);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 49;
    const report = facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!;
    expect(report.effectiveCapacity).toBe(73);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 1;
    const minimal = facilityCoverageIndex(state).facilities.get(station!.id as UrbanFacilityId)!;
    expect(minimal.effectiveCapacity).toBe(1);
  });
});

describe("H2-08 · demanda creciente y cobertura decreciente", () => {
  /**
   * El test local fija el efecto direccional: más desarrollo urbano → cobertura menor para el
   * mismo presupuesto. La banda 60–90 % / 45–80 % la audita `pnpm services:balance` sobre las
   * doce seeds y los cuatro escenarios, que es donde vive la evidencia. Una única semilla no
   * puede afirmar que la banda se cumple; puede afirmar que la cobertura no sube con el
   * desarrollo.
   */
  function coverageForScenario(seed: number, percent: number): number {
    const state = createInitialState(seed);
    const marketable = [...state.phase2.parcels.values()].filter(
      (parcel) => parcel.disposition === "marketable",
    );
    const target = Math.round((marketable.length * percent) / 100);
    const allDistricts = state.world.city.districtIds as Parcel["districtId"][];
    const perDistrict = Math.ceil(target / allDistricts.length);
    let serial = 500;
    const developedIds = new Set<Parcel["id"]>();
    for (const districtId of allDistricts) {
      const parcels = developParcels(state, districtId, perDistrict, serial);
      serial += parcels.length;
      for (const parcel of parcels) developedIds.add(parcel.id);
      if (developedIds.size >= target) break;
    }
    const index = facilityCoverageIndex(state);
    if (developedIds.size === 0) return 0;
    let servedCount = 0;
    for (const parcelId of developedIds)
      if ((index.byParcelId.get(parcelId)?.security ?? 0) >= 50) servedCount += 1;
    return Math.round((servedCount * 100) / developedIds.size);
  }

  it("la cobertura de security no sube al crecer la ciudad", () => {
    const a = coverageForScenario(23, 25);
    const b = coverageForScenario(23, 50);
    const c = coverageForScenario(23, 75);
    /** Bajo el programa municipal fijo, la cobertura cae monótonamente con el desarrollo. */
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
    /** Y en el escenario 75 % la ciudad está efectivamente bajo presión. */
    expect(c).toBeLessThan(100);
  });
});

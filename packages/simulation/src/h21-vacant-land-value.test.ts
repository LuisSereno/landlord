import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  type Building,
  type Parcel,
  type ParcelId,
  type UrbanFacility,
} from "@landlord/shared";

import {
  developedParcelsOf,
  facilityCoverageIndex,
  facilityPotentialForParcel,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { buildLandValueContext, landValueBreakdownFor } from "./land-value";
import { createInitialState, type GameState } from "./state";
import { buildCoverageIndex, type CoverageIndex } from "./urban-services";

/**
 * H2.1-02 · el solar vacante era invisible para la tasación. `potentialService` existía desde
 * H2-10 —overlay, compra, inspector—, pero `land-value.ts` sólo consultaba la cobertura ACTIVA,
 * de modo que una parcela vacante junto a una red operativa puntuaba `services: 0` igual que un
 * erial sin acceso, y sólo reaccionaba cuando el jugador ya había construido.
 *
 * Contrato que fijan estos tests:
 *   - la demanda activa de una vacante sigue siendo 0 (no consume capacidad);
 *   - para el valor del suelo: desarrollada → cobertura real, vacante → cobertura potencial;
 *   - sólo entra en la composición existente `transport + security + cleaning`, sin pesos nuevos;
 *   - el potencial no reserva hueco: dos solares pueden ver el mismo;
 *   - `civicAmenities` no se toca: mide proximidad geométrica, no disponibilidad.
 */

const clamp = (value: number) => Math.max(0, Math.min(10, value));

function facilitiesOfKind(state: GameState, kind: string): UrbanFacility[] {
  const out: UrbanFacility[] = [];
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) out.push(facility);
  return out.sort((left, right) => left.id.localeCompare(right.id));
}

function marketableOf(state: GameState, districtId: Parcel["districtId"], count: number): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, count);
}

function developParcels(
  state: GameState,
  districtId: Parcel["districtId"],
  count: number,
  serialStart: number,
): Parcel[] {
  const parcels = marketableOf(state, districtId, count);
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

function setFacilityBuildingState(
  state: GameState,
  facility: UrbanFacility,
  buildingState: Building["state"],
): void {
  for (const buildingId of facility.buildingIds) {
    const building = state.phase2.buildings.get(buildingId);
    if (building) building.state = buildingState;
  }
}

function scoreOf(state: GameState, parcel: Parcel): ReturnType<typeof landValueBreakdownFor> {
  const coverage = buildCoverageIndex(state);
  const context = buildLandValueContext(state, parcel.districtId, coverage);
  return landValueBreakdownFor(parcel, context);
}

/** La composición de V.d.4, término a término, para atribuir quién se movió. */
function expectedServicesScore(
  coverage: CoverageIndex,
  parcelId: ParcelId,
  security: number,
): number {
  const levels = coverage.byParcelId.get(parcelId)!;
  return clamp(Math.round((levels.transport + security + levels.cleaning) / 30));
}

function vacantParcelWithPotential(state: GameState): Parcel {
  const built = developedParcelsOf(state);
  const builtIds = new Set(built.map((parcel) => parcel.id));
  const candidate = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.disposition === "marketable" &&
        !builtIds.has(parcel.id) &&
        facilityPotentialForParcel(state, parcel.id, "security") === 100,
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!candidate) throw new Error("no hay ningún solar vacante con seguridad potencial");
  return candidate;
}

describe("H2.1-02 · el suelo vacante se tasa por acceso potencial al servicio", () => {
  it("A · un solar vacante con potencial tiene demanda activa 0 y más score que su gemelo sin potencial", () => {
    const state = createInitialState(7);
    const parcel = vacantParcelWithPotential(state);
    const coverage = buildCoverageIndex(state);
    /** Demanda activa: sigue siendo cero. Aquí no cambió nada. */
    expect(coverage.developedParcelIds.has(parcel.id)).toBe(false);
    expect(coverage.byParcelId.get(parcel.id)!.security).toBe(0);
    expect(coverage.potentialByParcelId.get(parcel.id)!.security).toBe(100);

    const breakdown = scoreOf(state, parcel);
    /** El score vale lo que vale la composición con el término de seguridad potencial. */
    expect(breakdown.services).toBe(
      expectedServicesScore(
        coverage,
        parcel.id,
        coverage.potentialByParcelId.get(parcel.id)!.security,
      ),
    );
    /** Y ese término añade puntos reales frente a un solar equivalente sin cobertura potencial. */
    expect(breakdown.services).toBeGreaterThan(expectedServicesScore(coverage, parcel.id, 0));
  });

  it("B · quemar todas las comisarías lleva el potencial a 0 y baja el valor objetivo", () => {
    const state = createInitialState(7);
    const parcel = vacantParcelWithPotential(state);
    const before = scoreOf(state, parcel);
    for (const station of facilitiesOfKind(state, "police_station"))
      setFacilityBuildingState(state, station, "ruin");
    const after = scoreOf(state, parcel);
    expect(after.services).toBeLessThan(before.services);
    /** `civicAmenities` no se entera: mide proximidad geométrica, no disponibilidad (D-093 §7). */
    expect(after.civicAmenities).toBe(before.civicAmenities);
    /** Sin clamp en el camino: la caída del término se traslada al score y al valor objetivo. */
    expect(after.clampAdjustment).toBe(0);
    expect(before.clampAdjustment).toBe(0);
    expect(after.score).toBeLessThan(before.score);
    expect(after.targetValue).toBeLessThan(before.targetValue);
    /** Y el solar nunca consumió capacidad: sigue sin edificio y sin demanda activa. */
    expect(developedParcelsOf(state).some((entry) => entry.id === parcel.id)).toBe(false);
  });

  it("C · bajar el presupuesto de seguridad a 0 apaga el potencial sin consumo de capacidad", () => {
    const state = createInitialState(7);
    const parcel = vacantParcelWithPotential(state);
    const before = scoreOf(state, parcel);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 0;
    const coverage = buildCoverageIndex(state);
    expect(coverage.potentialByParcelId.get(parcel.id)!.security).toBe(0);
    /** La parcela no consume capacidad: no está desarrollada y su demanda activa sigue en 0. */
    expect(coverage.developedParcelIds.has(parcel.id)).toBe(false);
    expect(coverage.byParcelId.get(parcel.id)!.security).toBe(0);
    /** Y ninguna facility de seguridad sirvió parcela. */
    for (const report of facilityCoverageIndex(state).facilities.values())
      if (report.service === "security") expect(report.served).toBe(0);
    const after = scoreOf(state, parcel);
    expect(after.services).toBeLessThan(before.services);
    expect(after.civicAmenities).toBe(before.civicAmenities);
    expect(after.targetValue).toBeLessThan(before.targetValue);
  });

  it("D · saturar toda la capacidad alcanzable apaga el potencial y el valor lo refleja", () => {
    /**
     * Con la red al 25 % cada comisaría tiene 37 huecos (capacity 2 × cohorte 75 × 25 / 100).
     * Se desarrollan parcelas en los distritos hasta llenar los 74 huecos: los solares que
     * quedan vacantes ya no ven ningún sitio libre, así que su señal potencial se apaga.
     */
    const state = createInitialState(7);
    const parcel = vacantParcelWithPotential(state);
    const before = scoreOf(state, parcel);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 25;
    let developedCount = 0;
    for (const districtId of state.world.city.districtIds) {
      if ((districtId as string) === parcel.districtId) continue;
      developedCount += developParcels(state, districtId, 12, 2000 + developedCount).length;
    }
    expect(developedCount).toBeGreaterThan(74);
    const coverage = buildCoverageIndex(state);
    expect(coverage.potentialByParcelId.get(parcel.id)!.security).toBe(0);
    /** Saturación real: las dos comisarías se quedaron sin hueco. */
    const stations = facilitiesOfKind(state, "police_station");
    for (const station of stations) {
      const report = facilityCoverageIndex(state).facilities.get(station.id)!;
      expect(report.saturated).toBe(true);
      expect(report.served).toBe(report.effectiveCapacity);
    }
    const after = scoreOf(state, parcel);
    expect(after.services).toBe(expectedServicesScore(coverage, parcel.id, 0));
    expect(after.services).toBeLessThan(before.services);
    expect(after.targetValue).toBeLessThan(before.targetValue);
  });

  it("E · una parcela desarrollada sigue usando su cobertura real", () => {
    /**
     * Dos casos, ambos con la misma regla: el término `services` de una parcela con edificio
     * privado sale de `byParcelId` (servicio efectivamente asignado), nunca del potencial. El
     * mapa de potencial ni siquiera tiene entrada para ella. Se fuerza la saturación para que
     * exista el caso interesante: una parcela DESARROLLADA sin servir no hereda el hueco de
     * otra, y una desarrollada servida no se mide por su potencial.
     */
    const state = createInitialState(7);
    state.phase2.municipal.serviceLevelPercentByCategory.security = 25;
    let serial = 3000;
    const built: Parcel[] = [];
    for (const districtId of state.world.city.districtIds) {
      built.push(...developParcels(state, districtId, 12, serial));
      serial += 100;
    }
    const coverage = buildCoverageIndex(state);
    const served = built.filter((parcel) => coverage.byParcelId.get(parcel.id)!.security > 0);
    const unserved = built.filter((parcel) => coverage.byParcelId.get(parcel.id)!.security === 0);
    expect(served.length).toBeGreaterThan(0);
    expect(unserved.length).toBeGreaterThan(0);
    for (const parcel of served) {
      expect(coverage.developedParcelIds.has(parcel.id)).toBe(true);
      expect(coverage.potentialByParcelId.get(parcel.id)).toBeUndefined();
      expect(scoreOf(state, parcel).services).toBe(
        expectedServicesScore(coverage, parcel.id, coverage.byParcelId.get(parcel.id)!.security),
      );
    }
    /** La parcela desarrollada sin servir vale por 0 de seguridad, no por el potencial del vecino. */
    for (const parcel of unserved) {
      expect(coverage.potentialByParcelId.get(parcel.id)).toBeUndefined();
      expect(scoreOf(state, parcel).services).toBe(expectedServicesScore(coverage, parcel.id, 0));
    }
  });

  it("el potencial no reserva capacidad: dos solares pueden ver el mismo hueco libre", () => {
    const state = createInitialState(7);
    const capacityParcels = [...facilityCoverageIndex(state).facilities.values()]
      .filter((report) => report.service === "security")
      .reduce((total, report) => total + report.effectiveCapacity, 0);
    const seeing = [...state.phase2.parcels.values()].filter(
      (parcel) =>
        parcel.disposition === "marketable" &&
        facilityPotentialForParcel(state, parcel.id, "security") === 100,
    ).length;
    /** Todos los solares ven el mismo conjunto de huecos: la señal es diagnóstica, no una reserva. */
    expect(seeing).toBeGreaterThan(capacityParcels);
    expect(developedParcelsOf(state).length).toBe(0);
  });
});

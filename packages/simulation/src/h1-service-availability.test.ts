import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseMoney,
  parseTick,
  type Building,
  type DistrictId,
  type UrbanFacility,
  type UrbanFacilityId,
} from "@landlord/shared";

import {
  facilityCoverageIndex,
  geometrySignature,
  operationalFacilityCapacity,
} from "./facility-coverage";
import { PLAYER_ORGANIZATION_ID } from "./game-data";
import { URBAN_SERVICE_POLICY, buildCoverageIndex } from "./urban-services";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";

/**
 * H1-05 y H1-06. V.d.3 separó la función urbana del edificio físico, pero la cobertura seguía usando
 * la capacidad declarada aunque el edificio ardiera, pendiera de derrumbe o fuera ruina: una comisaría
 * destruida daba seguridad y un parque de bomberos destruido apagaba fuegos. Y la limpieza, que sigue
 * siendo radial por excepción (D-092), calculaba su centro y su densidad mezclando los nueve mapas.
 */

function quietState(): GameState {
  const state = createInitialState(7);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function facilityOfKind(state: GameState, kind: string): UrbanFacility {
  for (const district of state.world.districts.values())
    for (const facility of district.facilities.values())
      if (facility.kind === kind) return facility;
  throw new Error(`Sin facility de tipo ${kind}`);
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

function securityCoveredParcels(state: GameState): number {
  const index = facilityCoverageIndex(state);
  return [...index.byParcelId.values()].filter((coverage) => coverage.security > 0).length;
}

function parcelsOf(state: GameState, districtId: DistrictId) {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
}

function addBuildings(state: GameState, parcelCount: number, districtId: DistrictId): void {
  const parcels = parcelsOf(state, districtId).slice(0, parcelCount);
  parcels.forEach((parcel, index) => {
    const id = parseBuildingId(`building_${String(500 + index).padStart(8, "0")}`);
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
    });
  });
}

describe("H1-05 · la cobertura depende del edificio físico", () => {
  it("una comisaría destruida deja de dar seguridad donde sólo dependía de ella", () => {
    const state = quietState();
    const station = facilityOfKind(state, "police_station");
    /**
     * H2-05: hay que desarrollar suelo cerca de la comisaría para que tenga demanda a la que
     * servir. Sin edificios privados, la Voronoi de security queda vacía y `served` es 0 por
     * diseño, no por destrucción del edificio. Se llenan las primeras 30 parcelas del distrito
     * de la facility.
     */
    addBuildings(state, 30, station.districtId);
    const before = facilityCoverageIndex(state);
    const reportBefore = before.facilities.get(station.id as UrbanFacilityId)!;
    expect(reportBefore.served).toBeGreaterThan(0);
    expect(securityCoveredParcels(state)).toBeGreaterThan(0);

    setFacilityBuildingState(state, station, "ruin");

    const after = facilityCoverageIndex(state);
    const report = after.facilities.get(station.id as UrbanFacilityId)!;
    expect(operationalFacilityCapacity(state, station)).toBe(0);
    expect(report.effectiveCapacity).toBe(0);
    expect(report.served).toBe(0);
    expect(report.coveragePercent).toBe(0);
    expect(report.saturated).toBe(report.demand > 0);
    for (const parcelId of after.byParcelId.keys())
      expect(after.byParcelId.get(parcelId)!.security).toBeLessThanOrEqual(
        before.byParcelId.get(parcelId)!.security ?? 0,
      );
  });

  it("un parque de bomberos destruido pierde su cobertura de fuego", () => {
    const state = quietState();
    const station = facilityOfKind(state, "fire_station");
    addBuildings(state, 30, station.districtId);
    const covered = [...facilityCoverageIndex(state).byParcelId.values()].filter(
      (coverage) => coverage.fire > 0,
    ).length;
    expect(covered).toBeGreaterThan(0);

    setFacilityBuildingState(state, station, "collapse_pending");

    const after = facilityCoverageIndex(state);
    expect(after.facilities.get(station.id as UrbanFacilityId)!.effectiveCapacity).toBe(0);
    expect(
      [...after.byParcelId.values()].filter((coverage) => coverage.fire > 0).length,
    ).toBeLessThan(covered);
  });

  it("un edificio ardiendo tampoco sirve, y restaurarlo recupera la cobertura", () => {
    const state = quietState();
    const station = facilityOfKind(state, "police_station");
    addBuildings(state, 30, station.districtId);
    const coveredBefore = securityCoveredParcels(state);
    expect(coveredBefore).toBeGreaterThan(0);

    setFacilityBuildingState(state, station, "burning");
    expect(securityCoveredParcels(state)).toBeLessThan(coveredBefore);

    setFacilityBuildingState(state, station, "operational");
    expect(operationalFacilityCapacity(state, station)).toBe(station.capacity);
    expect(securityCoveredParcels(state)).toBe(coveredBefore);
  });

  it("la disponibilidad no invalida la geometría: la firma espacial es estable", () => {
    const state = quietState();
    const station = facilityOfKind(state, "police_station");
    const geometry = geometrySignature(state);
    const indexBefore = facilityCoverageIndex(state);
    expect(facilityCoverageIndex(state)).toBe(indexBefore);

    setFacilityBuildingState(state, station, "ruin");

    /** Mismas calles, mismas distancias: sólo cambia quién puede servir. */
    expect(geometrySignature(state)).toBe(geometry);
    expect(facilityCoverageIndex(state)).not.toBe(indexBefore);
  });

  it("guardar y cargar produce exactamente el mismo resultado derivado", () => {
    const state = quietState();
    const station = facilityOfKind(state, "fire_station");
    setFacilityBuildingState(state, station, "ruin");
    const destroyed = facilityCoverageIndex(state);
    const report = destroyed.facilities.get(station.id as UrbanFacilityId)!;

    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    const restoredStation = [...restored.world.districts.values()]
      .flatMap((district) => [...district.facilities.values()])
      .find((entry) => entry.id === station.id)!;
    const restoredIndex = facilityCoverageIndex(restored);
    expect(restoredIndex.facilities.get(station.id as UrbanFacilityId)).toEqual(report);
    expect(operationalFacilityCapacity(restored, restoredStation)).toBe(0);
    expect(restoredIndex.byParcelId).toEqual(destroyed.byParcelId);
  });
});

describe("H1-06 · limpieza radial por distrito", () => {
  it("dos parcelas con la misma coordenada se sirven por su propio distrito", () => {
    const state = quietState();
    const districtA = state.world.city.districtIds[0]!;
    const districtB = state.world.city.districtIds[1]!;
    const parcelA = parcelsOf(state, districtA)[0]!;
    const parcelB = parcelsOf(state, districtB)[0]!;
    /** La misma coordenada local en los dos mapas: la identidad es distrito + celda. */
    const sharedCell = { x: 30, y: 30 };
    parcelA.anchorCell = { ...sharedCell };
    parcelB.anchorCell = { ...sharedCell };
    /** A se satura: más edificios que su referencia de capacidad; B se queda vacío. */
    addBuildings(state, 100, districtA);

    const index = buildCoverageIndex(state);
    const geometryA = index.cleaningByDistrictId.get(districtA)!;
    const geometryB = index.cleaningByDistrictId.get(districtB)!;
    expect(geometryA.buildingCount).toBeGreaterThan(
      URBAN_SERVICE_POLICY.cleaning.referenceBuildings,
    );
    expect(geometryB.buildingCount).toBe(0);
    expect(geometryA.radiusCells).toBeLessThan(geometryB.radiusCells);
    /** Los centros son locales: coincidir en coordenada no los fusiona. */
    expect(geometryA.center).not.toStrictEqual(geometryB.center);

    const coverageA = index.byParcelId.get(parcelA.id)!;
    const coverageB = index.byParcelId.get(parcelB.id)!;
    expect(coverageB.cleaning).toBeGreaterThan(coverageA.cleaning);
  });

  it("llenar un distrito no recorta el radio de los demás", () => {
    const before = buildCoverageIndex(quietState());
    const state = quietState();
    const districtA = state.world.city.districtIds[0]!;
    addBuildings(state, 100, districtA);
    const after = buildCoverageIndex(state);

    for (const districtId of state.world.city.districtIds) {
      const entry = after.cleaningByDistrictId.get(districtId)!;
      if (districtId === districtA) continue;
      expect(entry.radiusCells).toBe(before.cleaningByDistrictId.get(districtId)!.radiusCells);
    }
    expect(after.cleaningByDistrictId.get(districtA)!.radiusCells).toBeLessThan(
      before.cleaningByDistrictId.get(districtA)!.radiusCells,
    );
  });

  it("el recorte de limpieza se aplica a todos con la misma política municipal", () => {
    const state = quietState();
    const full = buildCoverageIndex(state);
    state.phase2.municipal.serviceLevelPercentByCategory.cleaning = 50;
    const halved = buildCoverageIndex(state);

    for (const districtId of state.world.city.districtIds)
      expect(halved.cleaningByDistrictId.get(districtId)!.radiusCells).toBe(
        full.cleaningByDistrictId.get(districtId)!.radiusCells,
      );

    let anyDecrease = false;
    for (const [parcelId, coverage] of full.byParcelId) {
      const value = halved.byParcelId.get(parcelId)!.cleaning;
      expect(value).toBeLessThanOrEqual(coverage.cleaning);
      if (coverage.cleaning > 0) anyDecrease = true;
    }
    expect(anyDecrease).toBe(true);
  });

  it("el nivel de limpieza no cambia la geometría del grafo de servicios", () => {
    const state = quietState();
    const geometry = geometrySignature(state);
    facilityCoverageIndex(state);
    state.phase2.municipal.serviceLevelPercentByCategory.cleaning = 20;
    state.phase2.municipal.serviceLevelPercentByCategory.security = 40;
    expect(geometrySignature(state)).toBe(geometry);
  });
});

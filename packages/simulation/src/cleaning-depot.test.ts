import { describe, expect, it } from "vitest";
import {
  parseBuildingId,
  parseConstructionSiteId,
  parseSnapshotV3,
  type Building,
  type ConstructionSite,
  type GridCell,
  type Parcel,
  type UrbanFacility,
} from "@landlord/shared";

import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { facilityCoverageIndex } from "./facility-coverage";
import {
  BUILDING_DEFINITIONS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  PRIMARY_USE_BY_BUILDING_TYPE,
} from "./game-data";
import {
  CITY_MUNICIPAL_PROGRAM_COUNTS,
  MUNICIPAL_FACILITY_CAPACITY,
  MUNICIPAL_FACILITY_SERVICE_PROFILE,
} from "./municipal-program";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { URBAN_SERVICE_POLICY, buildCoverageIndex } from "./urban-services";

type CleaningDepot = { building: Building; facility: UrbanFacility; parcel: Parcel };

function cleaningDepotOf(state: GameState): CleaningDepot {
  for (const district of state.world.districts.values()) {
    const facility = [...district.facilities.values()].find(
      (entry) => entry.kind === "cleaning_depot",
    );
    if (!facility) continue;
    const building = state.phase2.buildings.get(facility.buildingIds[0]!);
    const parcel = state.phase2.parcels.get(facility.parcelIds[0]!);
    if (!building || !parcel) throw new Error("Depósito sin edificio o parcela física");
    return { building, facility, parcel };
  }
  throw new Error("Programa municipal sin depósito de limpieza");
}

function allFacilities(state: GameState): UrbanFacility[] {
  return [...state.world.districts.values()].flatMap((district) => [
    ...district.facilities.values(),
  ]);
}

function marketableParcelsOf(state: GameState, districtId: string): Parcel[] {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.districtId === districtId && parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
}

function removeDepotBuilding(state: GameState): CleaningDepot {
  const depot = cleaningDepotOf(state);
  state.phase2.buildings.delete(depot.building.id);
  return depot;
}

function distance(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function baseRadiusFor(buildingCount: number): number {
  const policy = URBAN_SERVICE_POLICY.cleaning;
  const density = Math.sqrt(
    policy.referenceBuildings / Math.max(policy.referenceBuildings, buildingCount),
  );
  return Math.max(policy.minimumRadiusCells, Math.round(policy.baseRadiusCells * density));
}

function cleaningCoverageFor(cellDistance: number, radius: number, quality: number): number {
  const proximity = Math.max(0, Math.min(100, Math.round(100 - (100 * cellDistance) / radius)));
  return Math.round((quality * proximity) / 100);
}

function radiusOf(state: GameState, districtId: string): number {
  return buildCoverageIndex(state).cleaningByDistrictId.get(districtId)!.radiusCells;
}

describe("municipal cleaning depot", () => {
  it("authors one non-rent depot with the agreed footprint, reservation and service entries", () => {
    const state = createInitialState(7);
    const depot = cleaningDepotOf(state);
    const definition = BUILDING_DEFINITIONS.cleaning_depot;

    expect(definition).toMatchObject({
      type: "cleaning_depot",
      municipal: true,
      capacity: 0,
      baseRent: 0,
      targetFootprintCells: 3,
      preferredFootprint: { width: 3, height: 1 },
      siteFootprint: { width: 4, height: 2 },
      siteRequirements: {
        requiredParcels: 1,
        minCombinedAreaCells: 8,
        requireEdgeContiguous: true,
      },
      cleaningRadiusBonusCells: 6,
    });
    expect(PRIMARY_USE_BY_BUILDING_TYPE.cleaning_depot).toBe("civic");
    expect(CITY_MUNICIPAL_PROGRAM_COUNTS.cleaning_depots).toBe(1);
    expect(MUNICIPAL_FACILITY_CAPACITY.cleaning_depot).toBe(1);
    expect(MUNICIPAL_FACILITY_SERVICE_PROFILE.cleaning_depot).toBe("cleaning_service_v1");
    expect(allFacilities(state)).toHaveLength(15);
    expect(
      [...state.phase2.buildings.values()].filter(
        (building) => building.ownerOrganizationId === MUNICIPALITY_ORGANIZATION_ID,
      ),
    ).toHaveLength(15);

    expect(depot.building.districtId).toBe(PLAYER_HOME_DISTRICT_ID);
    expect(depot.building.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    expect(depot.building.state).toBe("operational");
    expect(depot.building.parcelIds).toEqual([depot.parcel.id]);
    expect(depot.building.footprintCells).toHaveLength(3);
    expect(depot.building.siteCells).toHaveLength(8);
    expect(depot.parcel.cells.length).toBeGreaterThanOrEqual(8);
    expect(depot.parcel.disposition).toBe("public");
    expect(depot.parcel.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    expect(depot.facility.operatorOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    expect(depot.facility.capacity).toBe(1);
    expect(depot.facility.serviceProfileId).toBe("cleaning_service_v1");

    const siteKeys = new Set(depot.building.siteCells!.map((cell) => `${cell.x}:${cell.y}`));
    const parcelKeys = new Set(depot.parcel.cells.map((cell) => `${cell.x}:${cell.y}`));
    expect(depot.building.footprintCells.every((cell) => siteKeys.has(`${cell.x}:${cell.y}`))).toBe(
      true,
    );
    expect(depot.building.siteCells!.every((cell) => parcelKeys.has(`${cell.x}:${cell.y}`))).toBe(
      true,
    );
  });

  it("keeps the exact pre-depot radial baseline when no depot building exists", () => {
    const state = createInitialState(7);
    removeDepotBuilding(state);
    const index = buildCoverageIndex(state);
    const quality = state.phase2.municipal.serviceLevelPercentByCategory.cleaning ?? 100;

    for (const districtId of state.world.city.districtIds) {
      const geometry = index.cleaningByDistrictId.get(districtId)!;
      const expectedRadius = baseRadiusFor(geometry.buildingCount);
      expect(geometry.radiusCells).toBe(expectedRadius);
      for (const parcel of marketableParcelsOf(state, districtId)) {
        expect(index.byParcelId.get(parcel.id)!.cleaning).toBe(
          cleaningCoverageFor(
            distance(parcel.anchorCell, geometry.center),
            expectedRadius,
            quality,
          ),
        );
      }
    }
  });

  it("adds six local radius cells, improves an edge parcel and leaves graph services unchanged", () => {
    const withDepot = createInitialState(7);
    const withoutDepot = createInitialState(7);
    const depot = cleaningDepotOf(withDepot);
    removeDepotBuilding(withoutDepot);

    const before = buildCoverageIndex(withoutDepot);
    const after = buildCoverageIndex(withDepot);
    const beforeGeometry = before.cleaningByDistrictId.get(depot.building.districtId)!;
    const afterGeometry = after.cleaningByDistrictId.get(depot.building.districtId)!;
    const bonus = BUILDING_DEFINITIONS.cleaning_depot.cleaningRadiusBonusCells!;

    expect(afterGeometry.radiusCells).toBe(beforeGeometry.radiusCells + bonus);
    expect(afterGeometry.buildingCount).toBe(beforeGeometry.buildingCount);
    for (const districtId of withDepot.world.city.districtIds) {
      if (districtId === depot.building.districtId) continue;
      expect(after.cleaningByDistrictId.get(districtId)).toEqual(
        before.cleaningByDistrictId.get(districtId),
      );
    }

    const edge = marketableParcelsOf(withDepot, depot.building.districtId).find((parcel) => {
      const cellDistance = distance(parcel.anchorCell, beforeGeometry.center);
      return (
        cellDistance > beforeGeometry.radiusCells &&
        cellDistance < beforeGeometry.radiusCells + bonus
      );
    });
    expect(edge).toBeDefined();
    const edgeDistance = distance(edge!.anchorCell, beforeGeometry.center);
    const quality = withDepot.phase2.municipal.serviceLevelPercentByCategory.cleaning ?? 100;
    expect(before.byParcelId.get(edge!.id)!.cleaning).toBe(0);
    expect(after.byParcelId.get(edge!.id)!.cleaning).toBe(
      cleaningCoverageFor(edgeDistance, afterGeometry.radiusCells, quality),
    );
    expect(after.byParcelId.get(edge!.id)!.cleaning).toBeGreaterThan(0);
    expect(after.byParcelId.get(edge!.id)!.transport).toBe(
      before.byParcelId.get(edge!.id)!.transport,
    );
    expect(after.byParcelId.get(edge!.id)!.security).toBe(
      before.byParcelId.get(edge!.id)!.security,
    );

    const graphBefore = facilityCoverageIndex(withoutDepot);
    const graphAfter = facilityCoverageIndex(withDepot);
    expect(graphAfter.byParcelId).toEqual(graphBefore.byParcelId);
    expect(graphAfter.byDistrictId).toEqual(graphBefore.byDistrictId);
    expect(graphAfter.facilities).toEqual(graphBefore.facilities);
    expect(graphAfter.facilities.has(depot.facility.id)).toBe(false);
    const projection = createViewProjection(withDepot, true, depot.building.districtId);
    expect(
      projection.facilities.find((facility) => facility.id === depot.facility.id)?.serviceMetrics,
    ).toBeNull();
  });

  it("requires municipal ownership for the bonus", () => {
    const state = createInitialState(7);
    const baseline = createInitialState(7);
    const districtId = cleaningDepotOf(baseline).building.districtId;
    removeDepotBuilding(baseline);
    const baseRadius = radiusOf(baseline, districtId);
    const depot = cleaningDepotOf(state);

    depot.building.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
    expect(radiusOf(state, districtId)).toBe(baseRadius);
    depot.building.ownerOrganizationId = MUNICIPALITY_ORGANIZATION_ID;
    expect(radiusOf(state, districtId)).toBe(
      baseRadius + BUILDING_DEFINITIONS.cleaning_depot.cleaningRadiusBonusCells!,
    );
  });

  it.each(["burning", "collapse_pending", "ruin"] as const)(
    "gives no radius bonus while the depot is %s",
    (buildingState) => {
      const state = createInitialState(7);
      const baseline = createInitialState(7);
      const depot = cleaningDepotOf(state);
      const baselineDepot = cleaningDepotOf(baseline);
      removeDepotBuilding(baseline);
      depot.building.state = buildingState;

      expect(radiusOf(state, depot.building.districtId)).toBe(
        radiusOf(baseline, baselineDepot.building.districtId),
      );
    },
  );

  it("gives no radius bonus to a depot construction site", () => {
    const state = createInitialState(7);
    const baseline = createInitialState(7);
    const depot = removeDepotBuilding(state);
    const baselineDepot = cleaningDepotOf(baseline);
    removeDepotBuilding(baseline);
    const site: ConstructionSite = {
      id: parseConstructionSiteId("site_00000901"),
      parcelIds: [...depot.building.parcelIds],
      districtId: depot.building.districtId,
      ownerOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
      buildingType: "cleaning_depot",
      footprintCells: depot.building.footprintCells.map((cell) => ({ ...cell })),
      orientation: depot.building.orientation,
      floors: depot.building.floors,
      form: depot.building.form,
      progress: 0,
      workRequired: 1,
      resourcesReserved: { cement: 0, brick: 0, steel: 0 },
      crewCapacity: 0,
      upgradeBuildingId: null,
      repairBuildingId: null,
      kind: "construction",
      targetBuildingId: null,
      assignedCrewIds: [],
      assignedTechnicianId: null,
    };
    state.phase2.constructionSites.set(site.id, site);

    expect(radiusOf(state, depot.building.districtId)).toBe(
      radiusOf(baseline, baselineDepot.building.districtId),
    );
  });

  it("caps accumulated operational depot bonuses at the configured 36-cell maximum", () => {
    const state = createInitialState(7);
    const depot = cleaningDepotOf(state);
    for (let index = 0; index < 3; index += 1) {
      const id = parseBuildingId(`building_00000${String(901 + index)}`);
      state.phase2.buildings.set(id, {
        ...depot.building,
        id,
        parcelIds: [...depot.building.parcelIds],
        footprintCells: depot.building.footprintCells.map((cell) => ({ ...cell })),
        tenantIds: [],
        casualtiesTotal: { injured: 0, dead: 0 },
      });
    }

    expect(URBAN_SERVICE_POLICY.cleaning.maxRadiusCells).toBe(36);
    expect(radiusOf(state, depot.building.districtId)).toBe(36);
  });

  it("preserves the depot and derived cleaning coverage through a v3 save/load round trip", () => {
    const state = createInitialState(7);
    const depot = cleaningDepotOf(state);
    const snapshot = serializeSnapshot(state);
    const parsed = parseSnapshotV3(JSON.parse(JSON.stringify(snapshot)));
    const restored = restoreStateFromSnapshot(parsed);
    const restoredDepot = cleaningDepotOf(restored);

    expect(parsed.schemaVersion).toBe(3);
    expect(restoredDepot.building).toEqual(depot.building);
    expect(restoredDepot.facility).toEqual(depot.facility);
    expect(restoredDepot.parcel).toEqual(depot.parcel);
    expect(buildCoverageIndex(restored).cleaningByDistrictId).toEqual(
      buildCoverageIndex(state).cleaningByDistrictId,
    );
    expect(buildCoverageIndex(restored).byParcelId).toEqual(buildCoverageIndex(state).byParcelId);
    expect(serializeSnapshot(restored)).toEqual(snapshot);
  });

  it("loads an old v3 state without a depot and keeps base cleaning behavior", () => {
    const state = createInitialState(7);
    const depot = removeDepotBuilding(state);
    state.world.districts.get(depot.facility.districtId)!.facilities.delete(depot.facility.id);
    const snapshot = serializeSnapshot(state);
    const parsed = parseSnapshotV3(JSON.parse(JSON.stringify(snapshot)));
    const restored = restoreStateFromSnapshot(parsed);

    expect(allFacilities(restored)).toHaveLength(14);
    expect(
      [...restored.phase2.buildings.values()].some(
        (building) => building.type === "cleaning_depot",
      ),
    ).toBe(false);
    const restoredIndex = buildCoverageIndex(restored);
    const quality = restored.phase2.municipal.serviceLevelPercentByCategory.cleaning ?? 100;
    for (const districtId of restored.world.city.districtIds) {
      const geometry = restoredIndex.cleaningByDistrictId.get(districtId)!;
      const expectedRadius = baseRadiusFor(geometry.buildingCount);
      expect(geometry.radiusCells).toBe(expectedRadius);
      for (const parcel of marketableParcelsOf(restored, districtId)) {
        expect(restoredIndex.byParcelId.get(parcel.id)!.cleaning).toBe(
          cleaningCoverageFor(
            distance(parcel.anchorCell, geometry.center),
            expectedRadius,
            quality,
          ),
        );
      }
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseMoney,
  parsePersonId,
  parseSnapshotV2,
  roadCellsFromSegments,
  viewProjectionV2Schema,
  type GridCell,
  type ProductCommand,
} from "@landlord/shared";

import { buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { dispatchProductCommand } from "./commands";
import { createViewProjection } from "./projection";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import { createInitialState, type GameState } from "./state";

const actor = parsePersonId("person_00000001");
const organization = "org_00000001" as ProductCommand["actingAsOrganizationId"];

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function cardinalNeighbours(cell: GridCell): string[] {
  return [
    `${cell.x}:${cell.y - 1}`,
    `${cell.x + 1}:${cell.y}`,
    `${cell.x}:${cell.y + 1}`,
    `${cell.x - 1}:${cell.y}`,
  ];
}

function command<T extends ProductCommand["type"]>(
  id: string,
  type: T,
  payload: Extract<ProductCommand, { type: T }>["payload"],
): Extract<ProductCommand, { type: T }> {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: actor,
    actingAsOrganizationId: organization,
    type,
    payload,
  } as Extract<ProductCommand, { type: T }>;
}

function allFacilities(state: GameState) {
  return [...state.world.districts.values()].flatMap((district) => [
    ...district.facilities.values(),
  ]);
}

function allPublicSpaces(state: GameState) {
  return [...state.world.districts.values()].flatMap((district) => [
    ...district.publicSpaces.values(),
  ]);
}

describe("V.d.3 programa municipal", () => {
  it("generates the exact §4.4 programme and links every physical building", () => {
    for (const seed of [1, 7, 42, 1337, 2024]) {
      const state = createInitialState(seed);
      const facilities = allFacilities(state);
      const spaces = allPublicSpaces(state);
      const kinds = facilities.map((facility) => facility.kind);
      expect(kinds.filter((kind) => kind === "town_hall")).toHaveLength(1);
      expect(kinds.filter((kind) => kind === "school")).toHaveLength(3);
      expect(kinds.filter((kind) => kind === "clinic")).toHaveLength(3);
      expect(kinds.filter((kind) => kind === "police_station")).toHaveLength(2);
      expect(kinds.filter((kind) => kind === "fire_station")).toHaveLength(2);
      expect(kinds.filter((kind) => kind === "market")).toHaveLength(3);
      expect(spaces.filter((space) => space.kind === "plaza")).toHaveLength(1);
      expect(spaces.filter((space) => space.kind === "park")).toHaveLength(6);

      const publicParcels = [...state.phase2.parcels.values()].filter(
        (parcel) => parcel.disposition === "public",
      );
      expect(publicParcels).toHaveLength(facilities.length);
      expect(
        publicParcels.every(
          (parcel) => parcel.ownerOrganizationId === MUNICIPALITY_ORGANIZATION_ID,
        ),
      ).toBe(true);

      const seenBuildings = new Set<string>();
      for (const facility of facilities) {
        expect(facility.operatorOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
        expect(facility.capacity).toBeGreaterThan(0);
        expect(facility.serviceProfileId.length).toBeGreaterThan(0);
        const district = state.world.districts.get(facility.districtId)!;
        expect(district.facilities.has(facility.id)).toBe(true);
        for (const parcelId of facility.parcelIds) {
          const parcel = state.phase2.parcels.get(parcelId)!;
          expect(parcel.districtId).toBe(facility.districtId);
          expect(parcel.disposition).toBe("public");
          expect(parcel.roadFrontages.length).toBeGreaterThan(0);
        }
        for (const buildingId of facility.buildingIds) {
          expect(seenBuildings.has(buildingId)).toBe(false);
          seenBuildings.add(buildingId);
          const building = state.phase2.buildings.get(buildingId)!;
          expect(building.districtId).toBe(facility.districtId);
          expect(building.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
          expect(building.footprintCells.length).toBeGreaterThan(0);
          expect(facility.parcelIds).toContain(building.parcelIds[0]!);
        }
      }
      for (const space of spaces) {
        expect(space.operatorOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
        expect(space.cells.length).toBeGreaterThan(0);
      }

      const centro = [...state.world.districts.values()].find(
        (district) => district.district.name === "Centro Cívico",
      )!;
      expect(
        [...centro.facilities.values()].some((facility) => facility.kind === "town_hall"),
      ).toBe(true);
      expect([...centro.publicSpaces.values()].some((space) => space.kind === "plaza")).toBe(true);

      // Todo el programa es alcanzable desde la red: las parcelas municipales tienen frente y
      // cada plaza/parque ocupa una manzana que toca una celda vial.
      for (const district of state.world.districts.values()) {
        const roadCells = roadCellsFromSegments(district.map.roads.segments);
        for (const facility of district.facilities.values()) {
          for (const parcelId of facility.parcelIds) {
            expect(state.phase2.parcels.get(parcelId)!.roadFrontages.length).toBeGreaterThan(0);
          }
        }
        for (const space of district.publicSpaces.values()) {
          expect(
            space.cells.some((cell) =>
              cardinalNeighbours(cell).some((neighbour) => roadCells.has(neighbour)),
            ),
            `${space.id} sin acceso desde la red`,
          ).toBe(true);
        }
      }

      for (const building of state.phase2.buildings.values()) {
        if (building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID) continue;
        const parcel = state.phase2.parcels.get(building.parcelIds[0]!)!;
        const parcelCells = new Set(parcel.cells.map(cellKey));
        expect(building.footprintCells.every((cell) => parcelCells.has(cellKey(cell)))).toBe(true);
      }
    }
  });

  it("blocks transfer, collateral, permits and company construction on public land", () => {
    const state = createInitialState(7);
    state.phase2.balances.set(organization, 1_000_000 as never);
    const parcel = [...state.phase2.parcels.values()].find(
      (entry) => entry.disposition === "public",
    )!;
    expect(
      dispatchProductCommand(state, command("civic-buy", "BuyParcel", { parcelId: parcel.id })),
    ).toEqual({ accepted: false, code: "PUBLIC_LAND_NOT_FOR_SALE" });
    expect(
      dispatchProductCommand(
        state,
        command("civic-permit", "RequestPermit", {
          parcelIds: [parcel.id],
          buildingType: "town_hall",
        }),
      ),
    ).toEqual({ accepted: false, code: "PUBLIC_LAND_NOT_BUILDABLE" });
    expect(
      dispatchProductCommand(
        state,
        command("civic-build", "StartConstruction", {
          parcelIds: [parcel.id],
          buildingType: "town_hall",
        }),
      ),
    ).toEqual({ accepted: false, code: "PUBLIC_LAND_NOT_BUILDABLE" });
    expect(
      dispatchProductCommand(
        state,
        command("civic-loan", "RequestLoan", {
          amount: parseMoney(600),
          termMonths: 12,
          collateralParcelId: parcel.id,
        }),
      ),
    ).toEqual({ accepted: false, code: "PUBLIC_LAND_NOT_COLLATERAL" });
    expect(
      dispatchProductCommand(state, command("civic-sell", "SellParcel", { parcelId: parcel.id })),
    ).toEqual({ accepted: false, code: "PUBLIC_LAND_NOT_TRANSFERABLE" });
  });

  it("keeps facilities and public spaces across save/load", () => {
    const state = createInitialState(7);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
    expect(allFacilities(restored)).toHaveLength(14);
    expect(allPublicSpaces(restored)).toHaveLength(7);
    expect(
      parseSnapshotV2(JSON.parse(JSON.stringify(serializeSnapshot(state))))
        .world.districts.map((entry) => entry.facilities.length)
        .reduce((sum, count) => sum + count, 0),
    ).toBe(14);
  });

  it("rejects a facility whose parcel stops being public or municipally owned", () => {
    const state = createInitialState(7);
    const snapshot = JSON.parse(JSON.stringify(serializeSnapshot(state)));
    const entry = snapshot.world.districts.find(
      (district: { facilities: unknown[] }) => district.facilities.length > 0,
    );
    const facility = entry.facilities[0];
    const parcel = snapshot.phase2.parcels.find(
      (candidate: { id: string }) => candidate.id === facility.parcelIds[0],
    );
    expect(parcel.disposition).toBe("public");
    parcel.disposition = "marketable";
    expect(() => parseSnapshotV2(snapshot)).toThrow();
    parcel.disposition = "public";
    parcel.ownerOrganizationId = "org_00000001";
    expect(() => parseSnapshotV2(snapshot)).toThrow();
  });

  it("publishes the facility inspector in the observed district projection", () => {
    const state = createInitialState(7);
    const projection = createViewProjection(state, true);
    expect(projection.facilities.length).toBeGreaterThan(0);
    expect(projection.facilities.every((facility) => facility.accessCells.length > 0)).toBe(true);
    expect(projection.publicSpaces.length).toBeGreaterThan(0);
    expect(projection.city.districts.reduce((sum, district) => sum + district.facilities, 0)).toBe(
      14,
    );
    expect(
      projection.city.districts.reduce((sum, district) => sum + district.publicSpaces, 0),
    ).toBe(7);
    expect(() =>
      viewProjectionV2Schema.parse(JSON.parse(JSON.stringify(projection))),
    ).not.toThrow();
    const district = state.world.districts.get(projection.observedDistrictId)!;
    expect(projection.facilities.map((facility) => facility.id).sort()).toEqual(
      [...district.facilities.keys()].sort(),
    );
  });

  it("does not expose public parcels as marketable stock", () => {
    const state = createInitialState(7);
    const projection = createViewProjection(state, true);
    const district = state.world.districts.get(projection.observedDistrictId)!;
    const publicIds = new Set(
      [...state.phase2.parcels.values()]
        .filter((parcel) => parcel.disposition === "public")
        .map((parcel) => parcel.id),
    );
    const projectedPublic = projection.economy!.parcels.filter(
      (parcel) => parcel.disposition === "public",
    );
    expect(projectedPublic.length).toBeGreaterThan(0);
    for (const parcel of projectedPublic) {
      expect(publicIds.has(parcel.id)).toBe(true);
    }
    const summary = projection.city.districts.find(
      (entry) => entry.id === projection.observedDistrictId,
    )!;
    expect(summary.marketableParcels).toBe(
      [...state.phase2.parcels.values()].filter(
        (parcel) =>
          parcel.districtId === projection.observedDistrictId &&
          parcel.disposition === "marketable" &&
          parcel.ownerOrganizationId === null,
      ).length,
    );
    const buildings = buildBuildingIndex(state);
    for (const parcelId of publicIds) {
      expect(buildingsOnParcel(buildings, parcelId).length).toBeLessThanOrEqual(1);
    }
    expect(district.facilities.size).toBeGreaterThan(0);
  });
});

describe("V.d.3 identidad pública", () => {
  it("uses the municipality as owner and operator, never a company", () => {
    const state = createInitialState(11);
    for (const parcel of state.phase2.parcels.values()) {
      if (parcel.disposition !== "public") continue;
      expect(parcel.ownerOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
    }
    for (const facility of allFacilities(state)) {
      expect(facility.operatorOrganizationId).toBe(MUNICIPALITY_ORGANIZATION_ID);
      expect(state.organizations.get(facility.operatorOrganizationId)?.kind).toBe("municipality");
    }
  });
});

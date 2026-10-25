import { describe, expect, it } from "vitest";

import { parseBuildingId, parseMoney, parseTick, type Building } from "@landlord/shared";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import { describeHousingStock } from "./housing-market";
import { runMunicipalBudget } from "./municipal-budget";
import { createInitialState, type GameState } from "./state";
import { createScaledCity } from "./system-cost";
import {
  MUNICIPAL_FEE_PER_OCCUPIED_UNIT,
  URBAN_SERVICE_POLICY,
  buildCoverageIndex,
  describeUrbanServices,
  municipalServiceFee,
} from "./urban-services";

function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function addBuilding(
  state: GameState,
  index: number,
  tenants = 0,
): import("@landlord/shared").BuildingId {
  const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const parcel = parcels[index]!;
  const id = parseBuildingId(`building_${String(index + 1).padStart(8, "0")}`);
  parcel.ownerOrganizationId = PLAYER_ORGANIZATION_ID;
  parcel.buildingId = id;
  const building: Building = {
    id,
    parcelId: parcel.id,
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
  };
  for (let slot = 0; slot < tenants; slot += 1) {
    const tenantId =
      `tenant_${String(9_000 + index * 10 + slot).padStart(8, "0")}` as import("@landlord/shared").TenantId;
    state.phase2.tenants.set(tenantId, {
      id: tenantId,
      profile: "household",
      budget: parseMoney(260),
      preferredBuildingType: "courtyard_home",
      activeContractBuildingId: id,
      satisfaction: 70,
      leaseRemaining: 24,
      status: "contracted",
      size: 3,
      segmentId: "household",
      searchMonths: 0,
      incomeFactorPercent: 100,
      origin: "authored",
    });
    building.tenantIds.push(tenantId);
  }
  building.tenantId = building.tenantIds[0] ?? null;
  state.phase2.buildings.set(id, building);
  return id;
}

describe("WP4.6 servicios urbanos y accesibilidad", () => {
  it("la cobertura es máxima en el centro y cae con la distancia", () => {
    const state = newState();
    addBuilding(state, 0);
    const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const centerParcel = parcels[0]!;
    const edgeParcel = parcels[1]!;
    const center = buildCoverageIndex(state).center;
    centerParcel.cell = { ...center };
    edgeParcel.cell = {
      x: center.x + URBAN_SERVICE_POLICY.transport.baseRadiusCells,
      y: center.y,
    };

    const index = buildCoverageIndex(state);
    const centerCoverage = index.byParcelId.get(centerParcel.id)!;
    const edgeCoverage = index.byParcelId.get(edgeParcel.id)!;

    // Mover las parcelas desplaza ligeramente el centroide, así que el centro no llega a 100
    // exacto; lo que importa es que el borde queda prácticamente sin cobertura.
    expect(centerCoverage.transport).toBeGreaterThanOrEqual(85);
    expect(edgeCoverage.transport).toBeLessThan(10);
    expect(edgeCoverage.transport).toBeLessThan(centerCoverage.transport);
  });

  it("crecer diluye el radio: la capacidad se satura", () => {
    const small = newState();
    addBuilding(small, 0);
    const large = createScaledCity(7, { parcelCount: 200 });

    const smallTransport = describeUrbanServices(small).find((entry) => entry.id === "transport")!;
    const largeTransport = describeUrbanServices(large).find((entry) => entry.id === "transport")!;

    expect(smallTransport.radiusCells).toBe(URBAN_SERVICE_POLICY.transport.baseRadiusCells);
    expect(largeTransport.radiusCells).toBeLessThan(smallTransport.radiusCells);
    expect(largeTransport.radiusCells).toBeGreaterThanOrEqual(
      URBAN_SERVICE_POLICY.transport.minimumRadiusCells,
    );
  });

  it("recortar servicios empeora el barrio y el borde sufre más que el centro", () => {
    const state = newState();
    addBuilding(state, 0);
    addBuilding(state, 1);
    const center = buildCoverageIndex(state).center;
    const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    parcels[0]!.cell = { ...center };
    parcels[1]!.cell = {
      x: center.x + URBAN_SERVICE_POLICY.cleaning.minimumRadiusCells,
      y: center.y,
    };

    const funded = describeHousingStock(state);
    const centerUnit = funded.find((unit) => unit.buildingId === "building_00000001")!;
    const edgeUnit = funded.find((unit) => unit.buildingId === "building_00000002")!;
    expect(centerUnit.accessibility).toBeGreaterThan(edgeUnit.accessibility);
    expect(centerUnit.quality).toBeGreaterThanOrEqual(edgeUnit.quality);

    state.phase2.municipal.serviceLevelPercentByCategory = {
      administration: 100,
      security: 100,
      transport: 0,
      cleaning: 0,
    };
    const cut = describeHousingStock(state);
    const cutCenter = cut.find((unit) => unit.buildingId === "building_00000001")!;
    expect(cutCenter.accessibility).toBe(0);
    expect(cutCenter.quality).toBeLessThan(centerUnit.quality);
  });

  it("la tasa por unidad ocupada sostiene el presupuesto municipal", () => {
    const empty = newState();
    addBuilding(empty, 0, 0);
    expect(municipalServiceFee(empty)).toBe(0);

    const occupied = newState();
    addBuilding(occupied, 0, 2);
    expect(municipalServiceFee(occupied)).toBe(2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT);

    occupied.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(0));
    occupied.clock = { ...occupied.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalBudget(occupied);
    // Tras el cierre el libro acumula el mes y reinicia el contador corriente.
    expect(occupied.phase2.municipal.revenueTotalBySource.serviceFee).toBe(
      2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT,
    );
    expect(occupied.phase2.municipal.revenueThisMonthBySource.serviceFee).toBe(0);
  });

  it("los indicadores de servicio son deterministas y explican la cobertura", () => {
    const build = (): GameState => {
      const state = newState(23);
      for (let index = 0; index < 5; index += 1) addBuilding(state, index);
      const center = buildCoverageIndex(state).center;
      const parcels = [...state.phase2.parcels.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      for (let index = 0; index < 5; index += 1) {
        parcels[index]!.cell = { x: center.x + index, y: center.y };
      }
      return state;
    };
    const first = build();
    const second = build();

    expect(describeUrbanServices(first)).toEqual(describeUrbanServices(second));
    for (const service of describeUrbanServices(first)) {
      expect(service.qualityPercent).toBe(100);
      expect(service.buildingsCovered).toBeGreaterThan(0);
      expect(service.meanCoveragePercent).toBeGreaterThan(0);
    }
  });
});

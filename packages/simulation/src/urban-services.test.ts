import { describe, expect, it } from "vitest";

import { parseBuildingId, parseMoney, parseTick, type Building } from "@landlord/shared";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import { describeHousingStock } from "./housing-market";
import { describeMunicipalBudget, runMunicipalBudget } from "./municipal-budget";
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
  const building: Building = {
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
      marketDistrictId: parcel.districtId,
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
    centerParcel.anchorCell = { ...center };
    edgeParcel.anchorCell = {
      x: center.x + URBAN_SERVICE_POLICY.cleaning.baseRadiusCells,
      y: center.y,
    };

    const index = buildCoverageIndex(state);
    const centerCoverage = index.byParcelId.get(centerParcel.id)!;
    const edgeCoverage = index.byParcelId.get(edgeParcel.id)!;

    // La limpieza sigue siendo radial; transporte y seguridad son grafo (V.d.5).
    expect(centerCoverage.cleaning).toBeGreaterThanOrEqual(85);
    expect(edgeCoverage.cleaning).toBeLessThan(10);
    expect(edgeCoverage.cleaning).toBeLessThan(centerCoverage.cleaning);
  });

  it("crecer diluye el radio: la capacidad se satura", () => {
    const small = newState();
    addBuilding(small, 0);
    const large = createScaledCity(7, { parcelCount: 200 });

    const smallCleaning = describeUrbanServices(small).find((entry) => entry.id === "cleaning")!;
    const largeCleaning = describeUrbanServices(large).find((entry) => entry.id === "cleaning")!;

    expect(smallCleaning.radiusCells).toBe(URBAN_SERVICE_POLICY.cleaning.baseRadiusCells);
    expect(largeCleaning.radiusCells).toBeLessThan(smallCleaning.radiusCells);
    expect(largeCleaning.radiusCells).toBeGreaterThanOrEqual(
      URBAN_SERVICE_POLICY.cleaning.minimumRadiusCells,
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
    parcels[0]!.anchorCell = { ...center };
    parcels[1]!.anchorCell = {
      x: center.x + URBAN_SERVICE_POLICY.cleaning.minimumRadiusCells,
      y: center.y,
    };

    const funded = describeHousingStock(state);
    const centerUnit = funded.find((unit) => unit.buildingId === "building_00000001")!;
    const edgeUnit = funded.find((unit) => unit.buildingId === "building_00000002")!;
    // El borde pierde limpieza (radio) aunque el transporte ya se mide por grafo.
    expect(centerUnit.quality).toBeGreaterThan(edgeUnit.quality);

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
    /** Sin unidades ocupadas el informe tampoco promete tasa: 0 es la cifra honesta, no un fallo. */
    expect(describeMunicipalBudget(empty).serviceFeeDueNextSettlement).toBe(0);

    const occupied = newState();
    addBuilding(occupied, 0, 2);
    expect(municipalServiceFee(occupied)).toBe(2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT);
    /**
     * El acumulado del mes no sirve a la UI: la tasa se devenga y se vuelca al histórico dentro de la
     * misma ejecución del cierre, así que desde fuera siempre se ve a cero. Lo que la jugadora puede
     * leer es lo que el municipio va a cobrarle al distrito.
     */
    const before = describeMunicipalBudget(occupied);
    expect(before.revenueThisMonthBySource.serviceFee).toBe(0);
    expect(before.serviceFeeDueNextSettlement).toBe(2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT);

    occupied.phase2.balances.set(MUNICIPALITY_ORGANIZATION_ID, parseMoney(0));
    occupied.clock = { ...occupied.clock, tick: parseTick(GAME_MONTH_TICKS) };
    runMunicipalBudget(occupied);
    // Tras el cierre el libro acumula el mes y reinicia el contador corriente.
    expect(occupied.phase2.municipal.revenueTotalBySource.serviceFee).toBe(
      2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT,
    );
    expect(occupied.phase2.municipal.revenueThisMonthBySource.serviceFee).toBe(0);
    const after = describeMunicipalBudget(occupied);
    expect(after.revenueTotalBySource.serviceFee).toBe(before.serviceFeeDueNextSettlement);
    // Y la cifra que ve la jugadora sigue contando el mes que viene, no un cero.
    expect(after.serviceFeeDueNextSettlement).toBe(2 * MUNICIPAL_FEE_PER_OCCUPIED_UNIT);
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
        parcels[index]!.anchorCell = { x: center.x + index, y: center.y };
      }
      return state;
    };
    const first = build();
    const second = build();

    expect(describeUrbanServices(first)).toEqual(describeUrbanServices(second));
    for (const service of describeUrbanServices(first)) {
      expect(service.qualityPercent).toBe(100);
      // La seguridad ya no es un radio: una parcela lejos de una comisaría puede quedar a cero.
      if (service.id !== "security") {
        expect(service.buildingsCovered).toBeGreaterThan(0);
        expect(service.meanCoveragePercent).toBeGreaterThan(0);
      } else {
        expect(service.buildingsCovered).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

import type { BuildingId, DistrictId, GridCell, ParcelId } from "@landlord/shared";
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
import {
  facilityCoverageIndex,
  type FacilityCoverageIndex,
} from "./facility-coverage";
import type { GameState } from "./state";

export type UrbanServiceId = "transport" | "security" | "cleaning";

/**
 * Tres servicios con una consecuencia distinta y medible. El coste es municipal y por edificio; la
 * cobertura es radial desde el centro del distrito, así que crecer diluye la capacidad y las
 * parcelas de borde quedan peor servidas. No hay edificios de servicio: el modelo es de red.
 */
export const URBAN_SERVICE_POLICY: Record<
  UrbanServiceId,
  {
    costPerBuilding: number;
    baseRadiusCells: number;
    minimumRadiusCells: number;
    referenceBuildings: number;
  }
> = {
  transport: {
    costPerBuilding: 2,
    baseRadiusCells: 26,
    minimumRadiusCells: 8,
    referenceBuildings: 40,
  },
  security: {
    costPerBuilding: 1,
    baseRadiusCells: 30,
    minimumRadiusCells: 10,
    referenceBuildings: 40,
  },
  cleaning: {
    costPerBuilding: 2,
    baseRadiusCells: 20,
    minimumRadiusCells: 6,
    referenceBuildings: 40,
  },
};

/** Tasa municipal por unidad ocupada: es el canal por el que la población sostiene el presupuesto. */
export const MUNICIPAL_FEE_PER_OCCUPIED_UNIT = 3;

export type UrbanServiceReport = {
  id: UrbanServiceId;
  qualityPercent: number;
  radiusCells: number;
  buildingsCovered: number;
  meanCoveragePercent: number;
};

/**
 * Geometría de limpieza de un distrito. La limpieza sigue siendo el servicio radial por excepción
 * (D-092), pero el centro y la densidad son locales: los nueve distritos comparten el rango 0..63 y
 * promediarlos producía un centro que no existía en ninguno de los mapas.
 */
export type DistrictCleaningGeometry = {
  districtId: DistrictId;
  center: GridCell;
  buildingCount: number;
  radiusCells: number;
};

export type CoverageIndex = {
  cleaningByDistrictId: ReadonlyMap<string, DistrictCleaningGeometry>;
  byBuildingId: Map<BuildingId, Record<UrbanServiceId, number>>;
  byParcelId: Map<ParcelId, Record<UrbanServiceId, number>>;
  /**
   * H2.1-02 · dos señales separadas para quien tenga que tasar suelo sin construir. `byParcelId`
   * es cobertura ACTIVA y no cambia su significado: un solar vacío sigue teniendo demanda 0 y no
   * consume capacidad. `potentialByParcelId` es la cobertura POTENCIAL de H2-10 (pasada por
   * referencia desde el índice de facilities: algún servicio alcanzable con hueco libre) y
   * `developedParcelIds` dice qué parcelas tienen ya edificio privado no en ruina. La regla de
   * valoración las combina: desarrollada → real, vacante → potencial. Ninguna de las dos cifras
   * entra en `byParcelId`, así que overlays, UI y consumo de capacidad siguen leyendo sólo la
   * cobertura servida.
   */
  potentialByParcelId: FacilityCoverageIndex["potentialByParcelId"];
  developedParcelIds: ReadonlySet<ParcelId>;
};

/** Radio medio de los distritos: es el resumen municipal, no una geometría autoritativa. */
export function meanCleaningRadiusCells(index: CoverageIndex): number {
  const radii = [...index.cleaningByDistrictId.values()].map((entry) => entry.radiusCells);
  if (radii.length === 0) return 0;
  return Math.round(radii.reduce((total, value) => total + value, 0) / radii.length);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function qualityOf(state: GameState, service: UrbanServiceId): number {
  return state.phase2.municipal.serviceLevelPercentByCategory[service] ?? 100;
}

function radiusOf(state: GameState, service: UrbanServiceId, buildings: number): number {
  const policy = URBAN_SERVICE_POLICY[service];
  // Más edificios con el mismo presupuesto es menos radio por edificio: la capacidad se satura.
  const density = Math.sqrt(
    policy.referenceBuildings / Math.max(policy.referenceBuildings, buildings),
  );
  return Math.max(policy.minimumRadiusCells, Math.round(policy.baseRadiusCells * density));
}

function coverageOf(
  state: GameState,
  service: UrbanServiceId,
  cell: GridCell,
  center: GridCell,
  buildings: number,
): number {
  const radius = radiusOf(state, service, buildings);
  const proximity = clamp(Math.round(100 - (100 * manhattan(cell, center)) / radius), 0, 100);
  return Math.round((qualityOf(state, service) * proximity) / 100);
}

/** Índice de cobertura por edificio y por parcela, con la limpieza resuelta en su propio mapa. */
export function buildCoverageIndex(state: GameState): CoverageIndex {
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
  const buildings = [...state.phase2.buildings.values()]
    .filter((building) => building.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID)
    .sort((left, right) => left.id.localeCompare(right.id));
  /** Densidad por distrito: un mapa no puede diluir el radio del vecino (H1-06). */
  const buildingCountByDistrictId = new Map<string, number>();
  for (const building of buildings) {
    if (building.state === "ruin") continue;
    buildingCountByDistrictId.set(
      building.districtId,
      (buildingCountByDistrictId.get(building.districtId) ?? 0) + 1,
    );
  }
  const cleaningByDistrictId = new Map<string, DistrictCleaningGeometry>();
  for (const districtId of state.world.city.districtIds) {
    const local = parcels.filter((parcel) => parcel.districtId === districtId);
    const buildingCount = buildingCountByDistrictId.get(districtId) ?? 0;
    cleaningByDistrictId.set(districtId, {
      districtId,
      buildingCount,
      radiusCells: radiusOf(state, "cleaning", buildingCount),
      center:
        local.length === 0
          ? { x: 0, y: 0 }
          : {
              x: Math.round(
                local.reduce((total, parcel) => total + parcel.anchorCell.x, 0) / local.length,
              ),
              y: Math.round(
                local.reduce((total, parcel) => total + parcel.anchorCell.y, 0) / local.length,
              ),
            },
    });
  }
  const facilityCoverage = facilityCoverageIndex(state);
  const byParcelId = new Map<ParcelId, Record<UrbanServiceId, number>>();
  for (const parcel of parcels) {
    const geometry = cleaningByDistrictId.get(parcel.districtId);
    byParcelId.set(parcel.id, {
      // Transport is accessibility to the network/gateways and security comes from stations; both
      // are graph coverage. Cleaning stays the municipal radial network, computed per district.
      transport: facilityCoverage.byParcelId.get(parcel.id)?.transport ?? 0,
      security: facilityCoverage.byParcelId.get(parcel.id)?.security ?? 0,
      cleaning:
        geometry === undefined
          ? 0
          : coverageOf(
              state,
              "cleaning",
              parcel.anchorCell,
              geometry.center,
              geometry.buildingCount,
            ),
    });
  }
  const byBuildingId = new Map<BuildingId, Record<UrbanServiceId, number>>();
  for (const building of buildings) {
    const coverage = byParcelId.get(building.parcelId);
    if (coverage) byBuildingId.set(building.id, coverage);
  }
  /**
   * Conjunto de parcelas desarrolladas. Mismo predicado que `developedParcelsOf` —edificio
   * privado, no en ruina, sobre parcela marketable— pero construido sobre las colecciones que
   * esta función ya tiene en mano, en vez de volver a filtrar y ORDENAR las ~1 400 parcelas de la
   * ciudad para extraer sólo unos ids. Medido intercalado en la misma corrida sobre una ciudad de
   * 800 parcelas: p50 0,73 ms por la vía `developedParcelsOf` frente a 0,46 ms por la vía directa,
   * con los dos conjuntos comparados elemento a elemento en cada iteración. Los p95 de esa muestra
   * (1,05 y 1,14) están dominados por las primeras iteraciones en frío y no son comparables; el
   * ahorro real es de ~0,3 ms sobre un cierre de ~45 ms. Optimización exacta y semánticamente
   * neutra (autorizada por §5 de H2.1): ningún digesto dorado se mueve y ninguna regla cambia.
   */
  const marketableParcelIds = new Set<ParcelId>(parcels.map((parcel) => parcel.id));
  const developedParcelIds = new Set<ParcelId>();
  for (const building of buildings)
    if (building.state !== "ruin" && marketableParcelIds.has(building.parcelId))
      developedParcelIds.add(building.parcelId);
  return {
    cleaningByDistrictId,
    byBuildingId,
    byParcelId,
    potentialByParcelId: facilityCoverage.potentialByParcelId,
    developedParcelIds,
  };
}

export function coverageFor(
  state: GameState,
  buildingId: BuildingId,
  service: UrbanServiceId,
): number {
  const parcelId = state.phase2.buildings.get(buildingId)?.parcelId;
  if (!parcelId) return 0;
  return buildCoverageIndex(state).byParcelId.get(parcelId)?.[service] ?? 0;
}

export function describeUrbanServices(state: GameState): UrbanServiceReport[] {
  const index = buildCoverageIndex(state);
  return (Object.keys(URBAN_SERVICE_POLICY) as UrbanServiceId[]).map((service) => {
    const values = [...index.byBuildingId.values()].map((coverage) => coverage[service]);
    const covered = values.filter((value) => value > 0).length;
    return {
      id: service,
      qualityPercent: qualityOf(state, service),
      radiusCells:
        service === "security" || service === "transport" ? 0 : meanCleaningRadiusCells(index),
      buildingsCovered: covered,
      meanCoveragePercent:
        values.length === 0
          ? 0
          : Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    };
  });
}

/** Unidades ocupadas del distrito: base de la tasa municipal por servicio. */
export function occupiedUnits(state: GameState): number {
  let units = 0;
  for (const building of state.phase2.buildings.values()) units += building.tenantIds.length;
  return units;
}

export function municipalServiceFee(state: GameState): number {
  return occupiedUnits(state) * MUNICIPAL_FEE_PER_OCCUPIED_UNIT;
}

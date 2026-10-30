import {
  roadCellsFromSegments,
  type DistrictId,
  type GridCell,
  type Parcel,
  type ParcelId,
  type UrbanFacility,
  type UrbanFacilityId,
  type UrbanFacilityKind,
} from "@landlord/shared";
import type { GameState } from "./state";
import { cellKey } from "./urban-fabric";

/**
 * V.d.5 service graph. Facilities are sources on the road network; demand is assigned to the
 * reachable facility with the lowest integer cost (tie by facility id). Capacity caps how many
 * parcels a facility serves; budget quality scales the effective capacity, so a cut removes service
 * without removing the building.
 */

export type FacilityServiceId =
  "security" | "fire" | "health" | "education" | "market" | "parks" | "transport";

const SERVICE_FACILITY_KIND: Partial<Record<FacilityServiceId, UrbanFacilityKind>> = {
  security: "police_station",
  fire: "fire_station",
  health: "clinic",
  education: "school",
  market: "market",
};

/**
 * A capacity unit is authored in service cohorts, not individual plots: one unit serves 25 parcels.
 * The number is deliberately explicit so the inspector can explain a saturated facility.
 */
export const DEMAND_UNITS_PER_CAPACITY = 25;

/** Parks are an amenity, not a capacity service: reachable on the network within this integer cost. */
export const PARK_MAX_TRAVEL_COST = 40;

/** Transport is accessibility to the city network, not a radio from a station (V.d.5 exception). */
export const TRANSPORT_MAX_TRAVEL_COST = 90;

const OFFSETS: readonly GridCell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export type FacilityCoverageReport = {
  facilityId: UrbanFacilityId;
  service: FacilityServiceId;
  demand: number;
  effectiveCapacity: number;
  served: number;
  coveragePercent: number;
  saturated: boolean;
};

export type FacilityCoverageIndex = {
  byParcelId: Map<ParcelId, Record<FacilityServiceId, number>>;
  byDistrictId: Map<DistrictId, Record<FacilityServiceId, number>>;
  facilities: Map<UrbanFacilityId, FacilityCoverageReport>;
};

type Graph = {
  nodes: Map<string, number>;
  neighbours: Map<string, Array<{ node: string; cost: number }>>;
};

function nodeKey(districtId: DistrictId, cell: GridCell): string {
  return `${districtId}:${cell.x}:${cell.y}`;
}

function roadCostsByDistrict(state: GameState): Map<DistrictId, Map<string, number>> {
  const result = new Map<DistrictId, Map<string, number>>();
  for (const [districtId, district] of state.world.districts) {
    const costs = new Map<string, number>();
    for (const segment of district.map.roads.segments) {
      const cost = segment.class === "avenue" ? 1 : 2;
      for (const key of roadCellsFromSegments([segment])) {
        const previous = costs.get(key);
        if (previous === undefined || cost < previous) costs.set(key, cost);
      }
    }
    result.set(districtId, costs);
  }
  return result;
}

function buildGraph(state: GameState, roadCosts: Map<DistrictId, Map<string, number>>): Graph {
  const nodes = new Map<string, number>();
  const neighbours = new Map<string, Array<{ node: string; cost: number }>>();
  const addEdge = (from: string, to: string, cost: number): void => {
    const list = neighbours.get(from) ?? [];
    list.push({ node: to, cost });
    neighbours.set(from, list);
  };
  for (const [districtId, costs] of roadCosts) {
    for (const [key, cost] of costs) {
      const [x, y] = key.split(":").map(Number) as [number, number];
      const node = `${districtId}:${key}`;
      nodes.set(node, cost);
      for (const offset of OFFSETS) {
        const neighbourKey = `${x + offset.x}:${y + offset.y}`;
        const neighbourCost = costs.get(neighbourKey);
        if (neighbourCost === undefined) continue;
        addEdge(node, `${districtId}:${neighbourKey}`, neighbourCost);
      }
    }
  }
  for (const gateway of state.world.gateways) {
    const first = gateway.cells[0]!;
    const second = gateway.cells[1]!;
    const firstNode = nodeKey(gateway.districtIds[0]!, first);
    const secondNode = nodeKey(gateway.districtIds[1]!, second);
    if (!nodes.has(firstNode) || !nodes.has(secondNode)) continue;
    const connection = state.world.city.connections.find((entry) => entry.gatewayId === gateway.id);
    // No connection means the gateway is closed: it is not a free crossing.
    if (!connection) continue;
    const cost = connection.cost;
    addEdge(firstNode, secondNode, cost);
    addEdge(secondNode, firstNode, cost);
  }
  for (const list of neighbours.values()) {
    list.sort((left, right) => left.node.localeCompare(right.node) || left.cost - right.cost);
  }
  return { nodes, neighbours };
}

class MinHeap {
  private readonly values: Array<{ node: string; cost: number }> = [];

  public get size(): number {
    return this.values.length;
  }

  public push(node: string, cost: number): void {
    this.values.push({ node, cost });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent]!.cost <= this.values[index]!.cost) break;
      [this.values[parent], this.values[index]] = [this.values[index]!, this.values[parent]!];
      index = parent;
    }
  }

  public pop(): { node: string; cost: number } | undefined {
    if (this.values.length === 0) return undefined;
    const first = this.values[0]!;
    const last = this.values.pop()!;
    if (this.values.length === 0) return first;
    this.values[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.values.length && this.values[left]!.cost < this.values[smallest]!.cost)
        smallest = left;
      if (right < this.values.length && this.values[right]!.cost < this.values[smallest]!.cost)
        smallest = right;
      if (smallest === index) break;
      [this.values[index], this.values[smallest]] = [this.values[smallest]!, this.values[index]!];
      index = smallest;
    }
    return first;
  }
}

function shortestDistances(graph: Graph, sources: readonly string[]): Map<string, number> {
  const distance = new Map<string, number>();
  const heap = new MinHeap();
  for (const source of sources) {
    if (!graph.nodes.has(source) || distance.has(source)) continue;
    distance.set(source, 0);
    heap.push(source, 0);
  }
  while (heap.size > 0) {
    const current = heap.pop()!;
    if (current.cost !== distance.get(current.node)) continue;
    for (const neighbour of graph.neighbours.get(current.node) ?? []) {
      const next = current.cost + neighbour.cost;
      const previous = distance.get(neighbour.node);
      if (previous !== undefined && previous <= next) continue;
      distance.set(neighbour.node, next);
      heap.push(neighbour.node, next);
    }
  }
  return distance;
}

function roadCellsByDistrict(state: GameState): Map<DistrictId, ReadonlySet<string>> {
  const result = new Map<DistrictId, ReadonlySet<string>>();
  for (const [districtId, district] of state.world.districts) {
    result.set(districtId, roadCellsFromSegments(district.map.roads.segments));
  }
  return result;
}

function roadAccessNodes(
  parcel: Pick<Parcel, "districtId" | "roadFrontages">,
  roadCells: ReadonlySet<string>,
): string[] {
  const nodes = new Set<string>();
  for (const frontage of parcel.roadFrontages) {
    for (const cell of frontage.cells) {
      for (const offset of OFFSETS) {
        const key = `${cell.x + offset.x}:${cell.y + offset.y}`;
        if (roadCells.has(key))
          nodes.add(nodeKey(parcel.districtId, { x: cell.x + offset.x, y: cell.y + offset.y }));
      }
    }
  }
  return [...nodes].sort();
}

function publicSpaceAccessNodes(
  state: GameState,
  roads: ReadonlyMap<DistrictId, ReadonlySet<string>>,
): string[] {
  const nodes = new Set<string>();
  for (const district of state.world.districts.values()) {
    const roadCells = roads.get(district.district.id) ?? new Set<string>();
    for (const space of district.publicSpaces.values()) {
      for (const cell of space.cells) {
        for (const offset of OFFSETS) {
          const key = `${cell.x + offset.x}:${cell.y + offset.y}`;
          if (roadCells.has(key)) {
            nodes.add(
              nodeKey(district.district.id, { x: cell.x + offset.x, y: cell.y + offset.y }),
            );
          }
        }
      }
    }
  }
  return [...nodes].sort();
}

function facilityAccessNodes(
  state: GameState,
  facility: UrbanFacility,
  roads: ReadonlyMap<DistrictId, ReadonlySet<string>>,
): string[] {
  const nodes = new Set<string>();
  for (const parcelId of facility.parcelIds) {
    const parcel = state.phase2.parcels.get(parcelId);
    if (!parcel) continue;
    const roadCells = roads.get(parcel.districtId) ?? new Set<string>();
    for (const node of roadAccessNodes(parcel, roadCells)) nodes.add(node);
  }
  return [...nodes].sort();
}

function budgetLevelFor(state: GameState, service: FacilityServiceId): number {
  if (service === "transport")
    return state.phase2.municipal.serviceLevelPercentByCategory.transport ?? 100;
  if (service === "security" || service === "fire") {
    return state.phase2.municipal.serviceLevelPercentByCategory.security ?? 100;
  }
  if (service === "parks") {
    return state.phase2.municipal.serviceLevelPercentByCategory.cleaning ?? 100;
  }
  return state.phase2.municipal.serviceLevelPercentByCategory.administration ?? 100;
}

function emptyCoverage(): Record<FacilityServiceId, number> {
  return { security: 0, fire: 0, health: 0, education: 0, market: 0, parks: 0, transport: 0 };
}

/**
 * Capacidad realmente disponible (H1-05). V.d.3 separó la función urbana del edificio físico, pero la
 * cobertura seguía usando la capacidad declarada aunque el edificio ardiera, pendientes de derrumbe o
 * en ruina: una comisaría destruida daba seguridad y un parque de bomberos destruido apagaba fuegos.
 * Semántica binaria por ahora —la curva por condición no es todavía una regla de producto—: o hay al
 * menos un edificio asociado operativo, o la función no sirve.
 */
export function operationalFacilityCapacity(state: GameState, facility: UrbanFacility): number {
  for (const buildingId of facility.buildingIds)
    if (state.phase2.buildings.get(buildingId)?.state === "operational") return facility.capacity;
  return 0;
}

/**
 * Firma de disponibilidad. Es separada de la geométrica a propósito: un edificio que pasa de
 * operativo a ruina cambia quién sirve, no dónde están las calles, y reconstruir Dijkstra por eso
 * sería cachear con la clave equivocada (D-092 §5).
 */
function availabilitySignature(state: GameState): string {
  const facilities: string[] = [];
  for (const district of [...state.world.districts.values()].sort((left, right) =>
    left.district.id.localeCompare(right.district.id),
  )) {
    for (const facility of [...district.facilities.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ))
      facilities.push(`${facility.id}=${operationalFacilityCapacity(state, facility)}`);
  }
  return facilities.join(";");
}

/** Visible para las pruebas de caché: es la clave de la geometría, sin disponibilidad. */
export function geometrySignature(state: GameState): string {
  const districts = [...state.world.districts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([districtId, district]) => {
      const roads = district.map.roads.segments
        .map((segment) => `${segment.id}:${segment.class}:${segment.to.x},${segment.to.y}`)
        .join(";");
      const facilities = [...district.facilities.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(
          (facility) =>
            `${facility.id}:${facility.kind}:${facility.capacity}:${facility.parcelIds.join(",")}`,
        )
        .join(";");
      const spaces = [...district.publicSpaces.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((space) => `${space.id}:${space.cells.map(cellKey).join(",")}`)
        .join(";");
      return `${districtId}|${roads}|${facilities}|${spaces}`;
    })
    .join("|");
  const connections = state.world.city.connections
    .map((connection) => `${connection.id}:${connection.gatewayId}:${connection.cost}`)
    .join(";");
  const gateways = state.world.gateways
    .map(
      (gateway) =>
        `${gateway.id}:${gateway.districtIds.join(",")}:${gateway.cells.map(cellKey).join(",")}`,
    )
    .join(";");
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .map(
      (parcel) =>
        `${parcel.id}@${parcel.roadFrontages.map((frontage) => frontage.roadSegmentId).join(",")}`,
    )
    .sort()
    .join(";");
  return `${districts}|${connections}|${gateways}|${parcels}`;
}

function budgetSignature(state: GameState): string {
  return Object.entries(state.phase2.municipal.serviceLevelPercentByCategory)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}

type RawServiceDistance = {
  facilities: UrbanFacility[];
  distances: Map<UrbanFacilityId, Map<string, number>>;
};

type RawCoverage = {
  geometrySignature: string;
  parcels: Parcel[];
  accessByParcel: Map<ParcelId, string[]>;
  services: Map<FacilityServiceId, RawServiceDistance>;
  parkDistance: Map<string, number> | null;
  transportDistance: Map<string, number> | null;
};

const rawCache = new WeakMap<GameState, RawCoverage>();
const indexCache = new WeakMap<GameState, { signature: string; index: FacilityCoverageIndex }>();

/**
 * Topology, facilities and gateway distances are cached separately from the budget. A monthly
 * service-level cut changes capacity, not the road graph; recomputing Dijkstra for it would be a
 * cache with the wrong key (D-092 §5).
 */
function rawCoverage(state: GameState): RawCoverage {
  const signature = geometrySignature(state);
  const cached = rawCache.get(state);
  if (cached?.geometrySignature === signature) return cached;

  const roadCosts = roadCostsByDistrict(state);
  const roads = roadCellsByDistrict(state);
  const graph = buildGraph(state, roadCosts);
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
  const accessByParcel = new Map<ParcelId, string[]>();
  for (const parcel of parcels) {
    accessByParcel.set(
      parcel.id,
      roadAccessNodes(parcel, roads.get(parcel.districtId) ?? new Set<string>()),
    );
  }
  const services = new Map<FacilityServiceId, RawServiceDistance>();
  for (const service of ["security", "fire", "health", "education", "market"] as const) {
    const kind = SERVICE_FACILITY_KIND[service]!;
    const serviceFacilities = [...state.world.districts.values()]
      .flatMap((district) => [...district.facilities.values()])
      .filter((facility) => facility.kind === kind)
      .sort((left, right) => left.id.localeCompare(right.id));
    const distances = new Map<UrbanFacilityId, Map<string, number>>();
    for (const facility of serviceFacilities) {
      distances.set(
        facility.id,
        shortestDistances(graph, facilityAccessNodes(state, facility, roads)),
      );
    }
    services.set(service, { facilities: serviceFacilities, distances });
  }
  const parkSources = publicSpaceAccessNodes(state, roads);
  const parkDistance = parkSources.length > 0 ? shortestDistances(graph, parkSources) : null;
  const openGatewayIds = new Set(state.world.city.connections.map((entry) => entry.gatewayId));
  const gatewaySources = state.world.gateways
    .filter((gateway) => openGatewayIds.has(gateway.id))
    .flatMap((gateway) => [
      nodeKey(gateway.districtIds[0]!, gateway.cells[0]!),
      nodeKey(gateway.districtIds[1]!, gateway.cells[1]!),
    ])
    .filter((node) => graph.nodes.has(node));
  const transportDistance =
    gatewaySources.length > 0 ? shortestDistances(graph, gatewaySources) : null;
  const raw: RawCoverage = {
    geometrySignature: signature,
    parcels,
    accessByParcel,
    services,
    parkDistance,
    transportDistance,
  };
  rawCache.set(state, raw);
  return raw;
}

export function facilityCoverageIndex(state: GameState): FacilityCoverageIndex {
  const raw = rawCoverage(state);
  const signature = `${raw.geometrySignature}|${budgetSignature(state)}|${availabilitySignature(
    state,
  )}`;
  const cached = indexCache.get(state);
  if (cached?.signature === signature) return cached.index;

  const parcels = raw.parcels;
  const byParcelId = new Map<ParcelId, Record<FacilityServiceId, number>>();
  for (const parcel of parcels) byParcelId.set(parcel.id, emptyCoverage());
  const facilities = new Map<UrbanFacilityId, FacilityCoverageReport>();

  for (const [service, data] of raw.services) {
    if (data.facilities.length === 0) continue;
    const bestForParcel = new Map<ParcelId, { cost: number; facilityId: UrbanFacilityId }>();
    for (const facility of data.facilities) {
      const distance = data.distances.get(facility.id)!;
      for (const parcel of parcels) {
        const access = raw.accessByParcel.get(parcel.id) ?? [];
        if (access.length === 0) continue;
        let cost = Number.POSITIVE_INFINITY;
        for (const node of access)
          cost = Math.min(cost, distance.get(node) ?? Number.POSITIVE_INFINITY);
        if (!Number.isFinite(cost)) continue;
        const previous = bestForParcel.get(parcel.id);
        if (
          !previous ||
          cost < previous.cost ||
          (cost === previous.cost && facility.id < previous.facilityId)
        ) {
          bestForParcel.set(parcel.id, { cost, facilityId: facility.id });
        }
      }
    }
    const groups = new Map<UrbanFacilityId, Array<{ parcel: Parcel; cost: number }>>();
    for (const parcel of parcels) {
      const best = bestForParcel.get(parcel.id);
      if (!best) continue;
      const group = groups.get(best.facilityId) ?? [];
      group.push({ parcel, cost: best.cost });
      groups.set(best.facilityId, group);
    }
    const level = budgetLevelFor(state, service);
    for (const facility of data.facilities) {
      const group = groups.get(facility.id) ?? [];
      group.sort(
        (left, right) => left.cost - right.cost || left.parcel.id.localeCompare(right.parcel.id),
      );
      const effectiveCapacity =
        Math.floor((operationalFacilityCapacity(state, facility) * level) / 100) *
        DEMAND_UNITS_PER_CAPACITY;
      const served = Math.min(group.length, effectiveCapacity);
      for (let index = 0; index < served; index += 1) {
        byParcelId.get(group[index]!.parcel.id)![service] = 100;
      }
      facilities.set(facility.id, {
        facilityId: facility.id,
        service,
        demand: group.length,
        effectiveCapacity,
        served,
        coveragePercent: group.length === 0 ? 0 : Math.round((served * 100) / group.length),
        saturated: group.length > effectiveCapacity,
      });
    }
  }

  if (raw.parkDistance) {
    for (const parcel of parcels) {
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      let cost = Number.POSITIVE_INFINITY;
      for (const node of access)
        cost = Math.min(cost, raw.parkDistance.get(node) ?? Number.POSITIVE_INFINITY);
      if (cost <= PARK_MAX_TRAVEL_COST) byParcelId.get(parcel.id)!.parks = 100;
    }
  }
  if (raw.transportDistance) {
    const level = budgetLevelFor(state, "transport");
    for (const parcel of parcels) {
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      let cost = Number.POSITIVE_INFINITY;
      for (const node of access)
        cost = Math.min(cost, raw.transportDistance.get(node) ?? Number.POSITIVE_INFINITY);
      if (cost <= TRANSPORT_MAX_TRAVEL_COST) byParcelId.get(parcel.id)!.transport = level;
    }
  }

  const byDistrictId = new Map<DistrictId, Record<FacilityServiceId, number>>();
  for (const districtId of state.world.city.districtIds) {
    const districtParcels = parcels.filter((parcel) => parcel.districtId === districtId);
    const values = emptyCoverage();
    if (districtParcels.length > 0) {
      for (const service of Object.keys(values) as FacilityServiceId[]) {
        values[service] = Math.round(
          districtParcels.reduce(
            (total, parcel) => total + (byParcelId.get(parcel.id)?.[service] ?? 0),
            0,
          ) / districtParcels.length,
        );
      }
    }
    byDistrictId.set(districtId, values);
  }

  const index: FacilityCoverageIndex = { byParcelId, byDistrictId, facilities };
  indexCache.set(state, { signature, index });
  return index;
}

export function facilityCoverageForParcel(
  state: GameState,
  parcelId: ParcelId,
  service: FacilityServiceId,
): number {
  return facilityCoverageIndex(state).byParcelId.get(parcelId)?.[service] ?? 0;
}

export function facilityCoverageForDistrict(
  state: GameState,
  districtId: DistrictId,
  service: FacilityServiceId,
): number {
  return facilityCoverageIndex(state).byDistrictId.get(districtId)?.[service] ?? 0;
}

/** Single helper used by the fire system: coverage reduces intensity growth and structural damage. */
export function fireDamageForBuilding(
  state: GameState,
  building: { parcelId: ParcelId },
  intensity: number,
): { intensityGrowth: number; structuralDamage: number } {
  const coverage = facilityCoverageForParcel(state, building.parcelId, "fire");
  const uncovered = 100 - coverage;
  return {
    intensityGrowth: Math.round((15 * uncovered) / 100),
    structuralDamage: Math.max(1, Math.ceil(((intensity / 10) * (50 + uncovered / 2)) / 100)),
  };
}

/** Single helper used when an agent is hurt: a covered district recovers in one day, not two. */
export function injuredRecoveryDays(state: GameState, districtId: DistrictId): number {
  return facilityCoverageForDistrict(state, districtId, "health") >= 50 ? 1 : 2;
}

/**
 * Diagnóstico (H2-04) · coste de viaje canónico de cada parcela a la facility más barata del
 * servicio, ANTES de la capacidad. `facilityCoverageIndex` sabe el coste pero no lo expone;
 * el harness de balance lo necesita para medir p50/p95 y para distinguir demanda inalcanzable
 * (coste infinito) de saturada (coste finito pero capacidad cero).
 *
 * No es una regla de producto: es un asidero de observabilidad, se expone fuera del índice
 * cacheado para no cambiar la superficie que consume el juego.
 */
export type FacilityServiceDistance = {
  parcelId: ParcelId;
  districtId: DistrictId;
  /** Coste entero mínimo de la red; `null` si ningún nodo de acceso es alcanzable desde el servicio. */
  cost: number | null;
  /** Facility canónica del mínimo coste, resuelta por `facilityId.localeCompare` en empates. */
  nearestFacilityId: UrbanFacilityId | null;
};

export function facilityServiceDistanceReport(
  state: GameState,
  service: FacilityServiceId,
): FacilityServiceDistance[] {
  const raw = rawCoverage(state);
  const out: FacilityServiceDistance[] = [];
  if (service === "parks") {
    if (!raw.parkDistance) return [];
    for (const parcel of raw.parcels) {
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      let best = Number.POSITIVE_INFINITY;
      for (const node of access) {
        const value = raw.parkDistance.get(node) ?? Number.POSITIVE_INFINITY;
        if (value < best) best = value;
      }
      out.push({
        parcelId: parcel.id,
        districtId: parcel.districtId,
        cost: Number.isFinite(best) ? best : null,
        nearestFacilityId: null,
      });
    }
    return out;
  }
  if (service === "transport") {
    if (!raw.transportDistance) return [];
    for (const parcel of raw.parcels) {
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      let best = Number.POSITIVE_INFINITY;
      for (const node of access) {
        const value = raw.transportDistance.get(node) ?? Number.POSITIVE_INFINITY;
        if (value < best) best = value;
      }
      out.push({
        parcelId: parcel.id,
        districtId: parcel.districtId,
        cost: Number.isFinite(best) ? best : null,
        nearestFacilityId: null,
      });
    }
    return out;
  }
  const data = raw.services.get(service);
  if (!data) return out;
  for (const parcel of raw.parcels) {
    const access = raw.accessByParcel.get(parcel.id) ?? [];
    if (access.length === 0) {
      out.push({
        parcelId: parcel.id,
        districtId: parcel.districtId,
        cost: null,
        nearestFacilityId: null,
      });
      continue;
    }
    let bestCost = Number.POSITIVE_INFINITY;
    let bestFacility: UrbanFacilityId | null = null;
    for (const facility of data.facilities) {
      const distance = data.distances.get(facility.id)!;
      let cost = Number.POSITIVE_INFINITY;
      for (const node of access) {
        const value = distance.get(node) ?? Number.POSITIVE_INFINITY;
        if (value < cost) cost = value;
      }
      if (!Number.isFinite(cost)) continue;
      if (
        cost < bestCost ||
        (cost === bestCost && (bestFacility === null || facility.id < bestFacility))
      ) {
        bestCost = cost;
        bestFacility = facility.id;
      }
    }
    out.push({
      parcelId: parcel.id,
      districtId: parcel.districtId,
      cost: Number.isFinite(bestCost) ? bestCost : null,
      nearestFacilityId: bestFacility,
    });
  }
  return out;
}

/** Facilidad para la caché de `facilityCoverageIndex`: reutilizar el mismo `rawCoverage` en el harness. */
export function listFacilitiesForService(
  state: GameState,
  service: FacilityServiceId,
): UrbanFacility[] {
  const kind = SERVICE_FACILITY_KIND[service];
  if (!kind) return [];
  return [...state.world.districts.values()]
    .flatMap((district) => [...district.facilities.values()])
    .filter((facility) => facility.kind === kind)
    .sort((left, right) => left.id.localeCompare(right.id));
}

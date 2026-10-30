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
import { MUNICIPALITY_ORGANIZATION_ID } from "./game-data";
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
 * Unidad canónica de capacidad por servicio (H2-07). Antes una constante global (`25`)
 * imponía que una cohorte de policía, una de bomberos, una de clínica, una de colegio y una
 * de mercado significaran exactamente lo mismo en el dominio. No hay razón para exigirlo: las
 * cinco facilities tienen arquitecturas, ratios de uso y programas municipales distintos.
 *
 * Derivación medida sobre las 12 seeds canónicas y los escenarios de crecimiento 25/50/75 %
 * de H2-08, para que la cobertura citywide de los cinco capacity services caiga en las bandas
 * de diseño: 60–90 % al 50 % de desarrollo y 45–80 % al 75 %. El programa municipal NO se
 * toca (2 comisarías, 2 parques de bomberos, 3 clínicas, 3 colegios, 3 mercados); sólo cambia
 * cuántas parcelas sirve cada cohorte.
 *
 *  - security y fire   75 parcelas / cohorte → 2 × 2 × 75 = 300 slots citywide.
 *  - health y market   25 parcelas / cohorte → 3 × 4 × 25  = 300 slots.
 *  - education         17 parcelas / cohorte → 3 × 6 × 17  = 306 slots.
 *
 * `parks` y `transport` quedan fuera: no son servicios de facility con capacity (`PARK_MAX_
 * TRAVEL_COST` y `TRANSPORT_MAX_TRAVEL_COST` son radios de accesibilidad, no slots).
 */
export const DEMAND_UNITS_PER_CAPACITY_BY_SERVICE: Record<
  "security" | "fire" | "health" | "education" | "market",
  number
> = {
  security: 75,
  fire: 75,
  health: 25,
  education: 17,
  market: 25,
};

/**
 * Compatibilidad: la constante global que D-092 y las pruebas antiguas referencian. Se queda
 * como el valor "por defecto" para el helper genérico, pero los services con tabla propia la
 * sobreescriben. No es un tuning arbitrario: es el valor con el que el modelo funcionaba antes
 * de H2-07 y que los tests de facility-coverage usan al construir fixtures sintéticos.
 */
export const DEMAND_UNITS_PER_CAPACITY = 25;

export function demandUnitsPerCapacityFor(service: FacilityServiceId): number {
  if (service in DEMAND_UNITS_PER_CAPACITY_BY_SERVICE)
    return DEMAND_UNITS_PER_CAPACITY_BY_SERVICE[
      service as keyof typeof DEMAND_UNITS_PER_CAPACITY_BY_SERVICE
    ];
  return DEMAND_UNITS_PER_CAPACITY;
}

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

/**
 * H2.1-01 · métricas del informe de una facility. Son magnitudes de naturaleza distinta y no
 * son intercambiables entre sí:
 * - `firstChoiceDemand` es la parcela que ELIJE a esta facility como opción más cercana
 *   (Voronoi estricto). Ni se la atiende ni se la deja de atender por estar aquí contada.
 * - `served` es lo que la facility efectivamente admite: sus primeras opciones más el
 *   spill-in de vecinas que fueron llenas antes de llegar a ellas.
 * - `effectiveCapacity` son los slots disponibles (capacidad operativa × cohorte × presupuesto).
 *   Es el único denominador de la utilización: `served / firstChoiceDemand` no es un porcentaje
 *   de nada —con spill-in puede superar 100 y con demanda primaria 0 no existe.
 * Por eso el informe ya no publica ninguna magnitud llamada "cobertura". La cobertura por
 * parcela vive en `byParcelId`; aquí sólo se describe la carga de la facility.
 */
export type FacilityCoverageReport = {
  facilityId: UrbanFacilityId;
  service: FacilityServiceId;
  firstChoiceDemand: number;
  effectiveCapacity: number;
  served: number;
  utilizationPercent: number;
  /**
   * Sin hueco libre: con capacidad efectiva > 0 y `served === effectiveCapacity`, la próxima
   * parcela que llegue será derivada a otra facility. No afirma que haya demanda insatisfecha
   * en la ciudad —el spill puede resolverla—; afirma que esta facility no admite más.
   */
  saturated: boolean;
};

export type FacilityCoverageIndex = {
  byParcelId: Map<ParcelId, Record<FacilityServiceId, number>>;
  byDistrictId: Map<DistrictId, Record<FacilityServiceId, number>>;
  facilities: Map<UrbanFacilityId, FacilityCoverageReport>;
  /**
   * Cobertura **potencial** de las parcelas vacantes (H2-10). Una parcela sin edificio no
   * consume capacidad, pero el jugador la ve en el mapa, la puede comprar y necesita saber si
   * ALGUNA facility alcanzable tiene hueco libre para atenderla el día que construya. No
   * reserva slot: es un diagnóstico, no una asignación. En las parcelas ya desarrolladas este
   * mapa no registra entrada —su servicio real está en `byParcelId`.
   */
  potentialByParcelId: Map<ParcelId, Record<FacilityServiceId, number>>;
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

/**
 * Parcela "desarrollada" (H2-05): marketable con al menos un Building privado no-ruin encima.
 * Un solar vacío NO consume capacidad: tiene accesibilidad (llegar a la facility), pero no
 * demanda activa. El contrato anterior medía demanda como `parcel.disposition === "marketable"`,
 * lo que hacía que una ciudad naciese prácticamente saturada (716 solares, ~600 edificios
 * privados posibles, 2 comisarías con 2 cohortes × 25 parcelas = 100 slots). Con esta
 * definición la saturación es consecuencia del desarrollo urbano, no del censo catastral.
 *
 * Aproximación Alpha: una parcela con dos edificios sigue valiendo una unidad de demanda —no
 * hay aún un modelo demográfico que pondere residentes, floors o usos. Queda declarado en
 * D-094 y en KNOWN-GAPS para una futura Beta.
 */
export function developedParcelsOf(state: GameState): Parcel[] {
  const developed = new Set<ParcelId>();
  for (const building of state.phase2.buildings.values()) {
    if (building.state === "ruin") continue;
    if (building.ownerOrganizationId === MUNICIPALITY_ORGANIZATION_ID) continue;
    for (const parcelId of building.parcelIds) developed.add(parcelId);
  }
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable" && developed.has(parcel.id))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Firma de la demanda activa. Va en la clave de la caché del índice —no en la de geometría—:
 * poner el primer edificio en una parcela recalcula la asignación de capacidad sin reconstruir
 * Dijkstra, igual que la disponibilidad física o el presupuesto.
 */
function demandSignature(state: GameState): string {
  const ids: string[] = [];
  const developed = new Set<ParcelId>();
  for (const building of [...state.phase2.buildings.values()]
    .filter(
      (entry) =>
        entry.state !== "ruin" && entry.ownerOrganizationId !== MUNICIPALITY_ORGANIZATION_ID,
    )
    .sort((left, right) => left.id.localeCompare(right.id))) {
    for (const parcelId of building.parcelIds) developed.add(parcelId);
  }
  for (const parcel of [...state.phase2.parcels.values()]
    .filter((entry) => entry.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id)))
    if (developed.has(parcel.id)) ids.push(parcel.id);
  return ids.join(",");
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
  )}|${demandSignature(state)}`;
  const cached = indexCache.get(state);
  if (cached?.signature === signature) return cached.index;

  const parcels = raw.parcels;
  /**
   * H2-05 · demanda activa = parcela marketable DESARROLLADA. Los solares sin edificio conservan
   * accesibilidad (aparecen en `byParcelId` y en parks/transport, que no consumen capacidad),
   * pero no presionan la cola de ningún servicio. Era el "todas las marketables cuentan" de
   * V.d.5, que hacía que una ciudad nueva naciese con 12 de 14 facilities saturadas por
   * construcción.
   */
  const developedIds = new Set<ParcelId>(developedParcelsOf(state).map((parcel) => parcel.id));
  const demandParcels = parcels.filter((parcel) => developedIds.has(parcel.id));
  const byParcelId = new Map<ParcelId, Record<FacilityServiceId, number>>();
  for (const parcel of parcels) byParcelId.set(parcel.id, emptyCoverage());
  /**
   * H2-10 · cobertura potencial. Se calcula sobre las parcelas VACANTES: si una facility
   * alcanzable tiene capacidad residual (`effectiveCapacity − assigned > 0`), el solar puede
   * mostrar "servicio potencial" para overlay, compra, land value e inspector. No reserva
   * slot: cuando el jugador construya, la parcela entrará en la demanda activa y competirá
   * por la capacidad como cualquier otra.
   */
  const potentialByParcelId = new Map<ParcelId, Record<FacilityServiceId, number>>();
  for (const parcel of parcels)
    if (!developedIds.has(parcel.id)) potentialByParcelId.set(parcel.id, emptyCoverage());
  const facilities = new Map<UrbanFacilityId, FacilityCoverageReport>();

  for (const [service, data] of raw.services) {
    if (data.facilities.length === 0) continue;
    const level = budgetLevelFor(state, service);
    const demandUnits = demandUnitsPerCapacityFor(service);
    /**
     * H2-09 · respuesta suave al presupuesto. Antes
     *   `Math.floor((facilityCapacity × level) / 100) × demandUnitsPerCapacity`
     * truncaba a cohortes ENTERAS antes de multiplicar: una comisaría con capacity 2 y
     * demandUnits 75 pasaba de 150 slots al 100 % de presupuesto a 0 al 49 %, con un salto
     * discreto de 0 → 75 al 50 %. La fórmula nueva multiplica primero y divide después:
     *   `Math.floor(facilityCapacity × demandUnitsPerCapacity × level / 100)`
     * sigue siendo aritmética entera y determinista, pero el presupuesto modula UNIDADES DE
     * SERVICIO, no bloques enteros de facility. Con los mismos parámetros:
     *   level 100 → 150 · level 75 → 112 · level 50 → 75 · level 25 → 37 · level 0 → 0.
     */
    /**
     * H2-06 · asignación determinista con capacidad. La Voronoi "nearest-first" dejaba a una
     * parcela sin servir cuando la facility más cercana estaba llena o sin edificio, aunque
     * hubiera otra alcanzable con capacidad libre. El algoritmo nuevo genera todos los pares
     * (parcel, facility, cost) alcanzables, excluye facilities con capacidad efectiva 0 y
     * recorre la lista en orden canónico (cost asc → parcelId asc → facilityId asc). Cada
     * parcela se sirve en la primera facility que la admita; si esa facility se llena antes,
     * la siguiente alternativa puede cogerla.
     *
     * Se conserva la Voronoi estricta como `firstChoiceDemand`: número de parcelas para las que
     * esta facility es la primera opción ENTRE LAS QUE TIENEN CAPACIDAD. Una facility con
     * capacidad efectiva 0 no es primera opción de nadie —se descarta antes del greedy— y por eso
     * reporta `firstChoiceDemand: 0`, no su cuenca geográfica. `served` es lo que realmente
     * admite, incluyendo el spill-in de vecinas saturadas: puede ser mayor que su demanda primaria.
     */
    const effectiveCapacityByFacilityId = new Map<UrbanFacilityId, number>();
    const usedCapacityByFacilityId = new Map<UrbanFacilityId, number>();
    const voronoiDemandByFacilityId = new Map<UrbanFacilityId, number>();
    for (const facility of data.facilities) {
      const operational = operationalFacilityCapacity(state, facility);
      const effective = Math.floor((operational * demandUnits * level) / 100);
      effectiveCapacityByFacilityId.set(facility.id, effective);
      usedCapacityByFacilityId.set(facility.id, 0);
      voronoiDemandByFacilityId.set(facility.id, 0);
    }

    type Candidate = { parcel: Parcel; facilityId: UrbanFacilityId; cost: number };
    const candidates: Candidate[] = [];
    for (const parcel of demandParcels) {
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      if (access.length === 0) continue;
      for (const facility of data.facilities) {
        const capacity = effectiveCapacityByFacilityId.get(facility.id)!;
        if (capacity === 0) continue;
        const distance = data.distances.get(facility.id)!;
        let cost = Number.POSITIVE_INFINITY;
        for (const node of access) {
          const value = distance.get(node) ?? Number.POSITIVE_INFINITY;
          if (value < cost) cost = value;
        }
        if (!Number.isFinite(cost)) continue;
        /** Voronoi: esta facility es la primera opción de la parcela si gana en coste/lex-id. */
        candidates.push({ parcel, facilityId: facility.id, cost });
      }
    }
    /** Marca la demanda Voronoi por facility antes del greedy de asignación. */
    const bestByParcel = new Map<ParcelId, { cost: number; facilityId: UrbanFacilityId }>();
    for (const candidate of candidates) {
      const previous = bestByParcel.get(candidate.parcel.id);
      if (
        !previous ||
        candidate.cost < previous.cost ||
        (candidate.cost === previous.cost && candidate.facilityId < previous.facilityId)
      ) {
        bestByParcel.set(candidate.parcel.id, {
          cost: candidate.cost,
          facilityId: candidate.facilityId,
        });
      }
    }
    for (const entry of bestByParcel.values())
      voronoiDemandByFacilityId.set(
        entry.facilityId,
        (voronoiDemandByFacilityId.get(entry.facilityId) ?? 0) + 1,
      );

    /** Orden canónico del greedy: coste ascendente, después parcelId, después facilityId. */
    candidates.sort(
      (left, right) =>
        left.cost - right.cost ||
        left.parcel.id.localeCompare(right.parcel.id) ||
        left.facilityId.localeCompare(right.facilityId),
    );
    const servedByParcel = new Set<ParcelId>();
    for (const candidate of candidates) {
      if (servedByParcel.has(candidate.parcel.id)) continue;
      const capacity = effectiveCapacityByFacilityId.get(candidate.facilityId)!;
      const used = usedCapacityByFacilityId.get(candidate.facilityId)!;
      if (used >= capacity) continue;
      usedCapacityByFacilityId.set(candidate.facilityId, used + 1);
      servedByParcel.add(candidate.parcel.id);
      byParcelId.get(candidate.parcel.id)![service] = 100;
    }

    for (const facility of data.facilities) {
      const effectiveCapacity = effectiveCapacityByFacilityId.get(facility.id)!;
      const served = usedCapacityByFacilityId.get(facility.id)!;
      facilities.set(facility.id, {
        facilityId: facility.id,
        service,
        firstChoiceDemand: voronoiDemandByFacilityId.get(facility.id)!,
        effectiveCapacity,
        served,
        utilizationPercent:
          effectiveCapacity === 0
            ? 0
            : Math.min(100, Math.max(0, Math.round((served * 100) / effectiveCapacity))),
        saturated: effectiveCapacity > 0 && served >= effectiveCapacity,
      });
    }

    /**
     * H2-10 · cobertura potencial de las vacantes. Un solar sin edificio no consume capacidad,
     * pero el jugador lo ve en el mapa y necesita saber si ALGUNA facility alcanzable tiene
     * hueco libre para atenderle el día que construya. Se evalúa por parcela y por facility
     * con `residual > 0`: si la parcela llega a esa facility por grafo (coste finito), potencial
     * = 100. No se reserva el slot —el residual no decrementa aquí—: si mañana dos jugadores
     * construyen sobre dos solares que compartían un mismo hueco, la Voronoi + greedy resuelve
     * la contienda canónicamente.
     */
    for (const parcel of parcels) {
      if (developedIds.has(parcel.id)) continue;
      const access = raw.accessByParcel.get(parcel.id) ?? [];
      if (access.length === 0) continue;
      const potential = potentialByParcelId.get(parcel.id);
      if (!potential) continue;
      for (const facility of data.facilities) {
        const capacity = effectiveCapacityByFacilityId.get(facility.id)!;
        const used = usedCapacityByFacilityId.get(facility.id)!;
        if (used >= capacity) continue;
        const distance = data.distances.get(facility.id)!;
        let cost = Number.POSITIVE_INFINITY;
        for (const node of access)
          cost = Math.min(cost, distance.get(node) ?? Number.POSITIVE_INFINITY);
        if (Number.isFinite(cost)) {
          potential[service] = 100;
          break;
        }
      }
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

  /**
   * H2-05: el denominador del rollup por distrito cambia según el servicio. Para los cinco
   * capacity services se mide sobre las parcelas DESARROLLADAS del distrito (cobertura de la
   * demanda activa); para parks y transport, que no consumen capacidad, sigue siendo la
   * cobertura geográfica sobre todas las marketable del distrito.
   */
  const capacityServices = new Set<FacilityServiceId>([
    "security",
    "fire",
    "health",
    "education",
    "market",
  ]);
  const byDistrictId = new Map<DistrictId, Record<FacilityServiceId, number>>();
  for (const districtId of state.world.city.districtIds) {
    const districtParcels = parcels.filter((parcel) => parcel.districtId === districtId);
    const districtDemandParcels = districtParcels.filter((parcel) => developedIds.has(parcel.id));
    const values = emptyCoverage();
    for (const service of Object.keys(values) as FacilityServiceId[]) {
      const pool = capacityServices.has(service) ? districtDemandParcels : districtParcels;
      if (pool.length === 0) {
        values[service] = 0;
        continue;
      }
      values[service] = Math.round(
        pool.reduce((total, parcel) => total + (byParcelId.get(parcel.id)?.[service] ?? 0), 0) /
          pool.length,
      );
    }
    byDistrictId.set(districtId, values);
  }

  const index: FacilityCoverageIndex = {
    byParcelId,
    byDistrictId,
    facilities,
    potentialByParcelId,
  };
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

/**
 * H2-10 · servicio potencial de una parcela vacante. Devuelve 0 si la parcela está construida
 * (para ella manda `facilityCoverageForParcel`, que refleja consumo real de capacidad) o si
 * ninguna facility alcanzable tiene hueco libre.
 */
export function facilityPotentialForParcel(
  state: GameState,
  parcelId: ParcelId,
  service: FacilityServiceId,
): number {
  return facilityCoverageIndex(state).potentialByParcelId.get(parcelId)?.[service] ?? 0;
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
  building: { parcelIds: ParcelId[] },
  intensity: number,
): { intensityGrowth: number; structuralDamage: number } {
  /** El fuego se resuelve sobre el complejo: todas sus parcelas comparten district y servicio. */
  const coverage = facilityCoverageForParcel(state, building.parcelIds[0]!, "fire");
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

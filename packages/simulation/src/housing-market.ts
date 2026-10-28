import {
  parseMoney,
  parseTenantId,
  parseTick,
  type Building,
  type BuildingId,
  type BuildingType,
  type GridCell,
  type HousingMarketState,
  type Money,
  type Tenant,
  type TenantProfile,
} from "@landlord/shared";
import {
  BUILDING_DEFINITIONS,
  GAME_MONTH_TICKS,
  TENANT_PROFILE_DEFAULTS,
  UPGRADE_RENT_BONUS_PERCENT,
  conditionRentMultiplierPercent,
} from "./game-data";
import { effectiveRentBudget } from "./employment";
import { buildCoverageIndex } from "./urban-services";
import { HOUSING_SEGMENTS, type HousingSegment } from "./housing-segments";
import { activeMacroModifiers, rentModifierPercentFor } from "./macro-events";
import { Xoshiro128ss } from "./prng";
import { residentFactorPercentFor } from "./reputation";
import type { GameState } from "./state";

export { HOUSING_SEGMENTS, type HousingSegment } from "./housing-segments";

const BUILDING_TYPES = Object.keys(BUILDING_DEFINITIONS) as BuildingType[];
const LEASE_MONTHS = 24;

export const HOUSING_MARKET_POLICY = {
  /** Vacancia de equilibrio: por encima el índice baja, por debajo sube. */
  targetVacancyPercent: 8,
  indexPointsPerVacancyPoint: 2.5,
  maximumIndexStepPercent: 4,
  minimumIndexPercent: 80,
  maximumIndexPercent: 125,
  /** Por debajo de este número de edificios del tipo no se ajusta precio: evita fijar precios con un solo piso. */
  minimumUnitsForPriceDiscovery: 3,
  /** Meses que un hogar espera vivienda antes de abandonar el mercado. */
  maximumSearchMonths: 6,
  serviceRadiusCells: 6,
  jobsPerProductionBuilding: 4,
  budgetJitterPercent: 15,
  desirability: {
    accessibilityDistancePenalty: 12,
    isolatedAccessibility: 50,
    incidentSafetyPenalty: 12,
    policePressureSafetyPenalty: 2,
    maximumPoliceSafetyPenalty: 20,
    servicesPerPoint: 20,
  },
  appealWeights: { stock: 40, safety: 20, affordability: 20, employment: 20 },
} as const;

export function initialHousingMarketState(): HousingMarketState {
  return {
    rentIndexPercentByBuildingType: Object.fromEntries(BUILDING_TYPES.map((type) => [type, 100])),
    lastSettlementTick: null,
    arrivalsTotal: 0,
    departuresTotal: 0,
    nextTenantOrdinal: 1,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/**
 * Índice espacial del parque. La distancia de servicio es Manhattan, así que un vecino dentro del
 * radio está como mucho a `radius` celdas en cada eje y sólo hace falta recorrer los nueve buckets
 * adyacentes. El recuento resultante es idéntico al de todos contra todos: cambia el orden de
 * visita, no qué edificios cuentan.
 */
const NEIGHBOUR_BUCKET_SIZE = HOUSING_MARKET_POLICY.serviceRadiusCells + 1;
const CELL_KEY_SPAN = 8192;
const CELL_KEY_OFFSET = 4096;

function neighbourBucketKey(bucketX: number, bucketY: number): number {
  return (bucketX + CELL_KEY_OFFSET) * CELL_KEY_SPAN + (bucketY + CELL_KEY_OFFSET);
}

function cellKeyOf(cell: GridCell): number {
  return (cell.x + CELL_KEY_OFFSET) * CELL_KEY_SPAN + (cell.y + CELL_KEY_OFFSET);
}

type CellOccupancy = { cell: GridCell; buildings: number };

/** Cuenta los edificios operativos por celda y agrupa las celdas ocupadas en buckets. */
export function indexCells(raw: ReadonlyArray<{ cell: GridCell }>): Map<number, CellOccupancy[]> {
  const occupancyByCell = new Map<number, CellOccupancy>();
  const buckets = new Map<number, CellOccupancy[]>();
  for (const entry of raw) {
    const key = cellKeyOf(entry.cell);
    const occupancy = occupancyByCell.get(key);
    if (occupancy) {
      occupancy.buildings += 1;
      continue;
    }
    const created: CellOccupancy = { cell: entry.cell, buildings: 1 };
    occupancyByCell.set(key, created);
    const bucketX = Math.floor(entry.cell.x / NEIGHBOUR_BUCKET_SIZE);
    const bucketY = Math.floor(entry.cell.y / NEIGHBOUR_BUCKET_SIZE);
    const bucketKey = neighbourBucketKey(bucketX, bucketY);
    const bucket = buckets.get(bucketKey);
    if (bucket) bucket.push(created);
    else buckets.set(bucketKey, [created]);
  }
  return buckets;
}

/** Edificios distintos al propio dentro del radio de servicio de una celda. */
export function countNeighbours(
  cell: GridCell,
  buckets: ReadonlyMap<number, CellOccupancy[]>,
): number {
  const radius = HOUSING_MARKET_POLICY.serviceRadiusCells;
  const bucketX = Math.floor(cell.x / NEIGHBOUR_BUCKET_SIZE);
  const bucketY = Math.floor(cell.y / NEIGHBOUR_BUCKET_SIZE);
  let total = -1;
  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (const occupancy of buckets.get(
        neighbourBucketKey(bucketX + offsetX, bucketY + offsetY),
      ) ?? []) {
        if (manhattan(cell, occupancy.cell) <= radius) total += occupancy.buildings;
      }
    }
  }
  return total;
}

function rentIndexFor(state: GameState, type: BuildingType): number {
  return state.phase2.housingMarket.rentIndexPercentByBuildingType[type] ?? 100;
}

/**
 * Única fórmula de renta del juego. `systems`, `commands` y `projection` la comparten para que el
 * precio que ve el jugador, el que valida un contrato y el que cobra el motor sean el mismo.
 */
export function askingRentFor(state: GameState, building: Building): Money {
  const policyModifier = 1 + rentModifierPercentFor(state) / 100;
  return parseMoney(
    Math.max(
      0,
      Math.round(
        BUILDING_DEFINITIONS[building.type].baseRent *
          (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
          policyModifier *
          (conditionRentMultiplierPercent(building.condition) / 100) *
          (rentIndexFor(state, building.type) / 100),
      ),
    ),
  );
}

type StockUnit = {
  building: Building;
  cell: GridCell;
  quality: number;
  accessibility: number;
  safety: number;
  services: number;
  /** Cómo la opinión de los residentes sobre el dueño multiplica el atractivo de su parque. */
  landlordFactorPercent: number;
  askingRent: Money;
  vacantSlots: number;
};

/** Estado del parque operativo del distrito en el momento del cierre mensual. */
function buildStock(state: GameState): StockUnit[] {
  const activeIncidentCells: GridCell[] = [];
  for (const incident of state.phase2.incidents.values()) {
    if (incident.status !== "active") continue;
    const building = state.phase2.buildings.get(incident.buildingId);
    const cell = building ? state.phase2.parcels.get(building.parcelId)?.anchorCell : undefined;
    if (cell) activeIncidentCells.push(cell);
  }

  const raw: Array<{ building: Building; cell: GridCell }> = [];
  for (const building of [...state.phase2.buildings.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (building.state !== "operational") continue;
    const cell = state.phase2.parcels.get(building.parcelId)?.anchorCell;
    if (!cell) continue;
    raw.push({ building, cell });
  }
  if (raw.length === 0) return [];

  const coverage = buildCoverageIndex(state);
  const policePenalty = Math.min(
    HOUSING_MARKET_POLICY.desirability.maximumPoliceSafetyPenalty,
    state.phase2.crime.policePressure *
      HOUSING_MARKET_POLICY.desirability.policePressureSafetyPenalty,
  );

  const stock: StockUnit[] = [];
  const cellsByBucket = indexCells(raw);
  for (const entry of raw) {
    const nearbyOffices = countNeighbours(entry.cell, cellsByBucket);
    let nearbyIncidents = 0;
    for (const cell of activeIncidentCells) {
      if (manhattan(entry.cell, cell) <= HOUSING_MARKET_POLICY.serviceRadiusCells)
        nearbyIncidents += 1;
    }
    const parcelCoverage = coverage.byParcelId.get(entry.building.parcelId);
    stock.push({
      building: entry.building,
      cell: entry.cell,
      landlordFactorPercent: residentFactorPercentFor(state, entry.building.ownerOrganizationId),
      // La limpieza se nota en el estado del parque: sin cobertura, el entorno envejece antes.
      quality: clamp(
        entry.building.condition +
          (entry.building.upgraded ? 10 : 0) -
          Math.round((100 - (parcelCoverage?.cleaning ?? 0)) / 4),
        0,
        100,
      ),
      accessibility:
        raw.length === 1
          ? HOUSING_MARKET_POLICY.desirability.isolatedAccessibility
          : clamp(parcelCoverage?.transport ?? 0, 0, 100),
      safety: clamp(
        100 -
          nearbyIncidents * HOUSING_MARKET_POLICY.desirability.incidentSafetyPenalty -
          policePenalty -
          Math.round((100 - (parcelCoverage?.security ?? 0)) / 2),
        0,
        100,
      ),
      services: clamp(nearbyOffices * HOUSING_MARKET_POLICY.desirability.servicesPerPoint, 0, 100),
      askingRent: askingRentFor(state, entry.building),
      vacantSlots: Math.max(
        0,
        BUILDING_DEFINITIONS[entry.building.type].capacity - entry.building.tenantIds.length,
      ),
    });
  }
  return stock;
}

export function desirabilityOf(
  unit: Pick<StockUnit, "quality" | "accessibility" | "safety" | "services"> &
    Partial<Pick<StockUnit, "landlordFactorPercent">>,
  segment: HousingSegment,
): number {
  const { weights } = segment;
  const total = weights.quality + weights.accessibility + weights.safety + weights.services;
  const base =
    (unit.quality * weights.quality +
      unit.accessibility * weights.accessibility +
      unit.safety * weights.safety +
      unit.services * weights.services) /
    total;
  // Un casero con mala reputación no baja el estado del edificio: baja las ganas de mudarse a él.
  return Math.round(base * ((unit.landlordFactorPercent ?? 100) / 100));
}

function isCompatible(unit: StockUnit, segment: HousingSegment): boolean {
  return segment.preferredBuildingTypes.includes(unit.building.type);
}

/** Población del segmento: contratados y buscadores cuentan igual contra el techo. */
function segmentPopulation(state: GameState, segment: HousingSegment): number {
  let total = 0;
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status === "displaced") continue;
    if (segmentIdOf(tenant) !== segment.id) continue;
    total += 1;
  }
  return total;
}

function segmentIdOf(tenant: Tenant): TenantProfile {
  return tenant.segmentId in HOUSING_SEGMENTS
    ? (tenant.segmentId as TenantProfile)
    : tenant.profile;
}

function employmentPercent(
  state: GameState,
  segment: HousingSegment,
  stock: readonly StockUnit[],
): number {
  // La industria emplea a los hogares; la clientela sostiene a los artesanos y comerciantes.
  const jobs =
    stock.filter(
      (unit) => unit.building.type !== "courtyard_home" && unit.building.type !== "workshop",
    ).length * HOUSING_MARKET_POLICY.jobsPerProductionBuilding;
  const households = [...state.phase2.tenants.values()].filter(
    (tenant) => tenant.status === "contracted" && segmentIdOf(tenant) === "household",
  ).length;
  const commerce = [...state.phase2.tenants.values()].filter(
    (tenant) => tenant.status === "contracted" && segmentIdOf(tenant) !== "household",
  ).length;
  if (segment.id === "household") {
    if (jobs === 0) return 25;
    return clamp(Math.round((100 * jobs) / Math.max(1, households)), 0, 100);
  }
  if (households === 0) return 25;
  return clamp(Math.round((100 * households) / Math.max(1, 2 * commerce)), 0, 100);
}

export type SegmentDemand = {
  id: TenantProfile;
  label: string;
  population: number;
  populationCap: number;
  appealPercent: number;
  compatibleSlots: number;
  vacantSlots: number;
  affordableVacantSlots: number;
};

/** Lectura del parque operativo con sus cuatro componentes de deseabilidad. */
export function describeHousingStock(state: GameState): Array<{
  buildingId: BuildingId;
  type: BuildingType;
  quality: number;
  accessibility: number;
  safety: number;
  services: number;
  askingRent: Money;
  vacantSlots: number;
}> {
  return buildStock(state).map((unit) => ({
    buildingId: unit.building.id,
    type: unit.building.type,
    quality: unit.quality,
    accessibility: unit.accessibility,
    safety: unit.safety,
    services: unit.services,
    askingRent: unit.askingRent,
    vacantSlots: unit.vacantSlots,
  }));
}

/** Lectura pública del mercado: la usan la proyección y las pruebas. */
export function describeHousingMarket(state: GameState): SegmentDemand[] {
  const stock = buildStock(state);
  return (Object.keys(HOUSING_SEGMENTS) as TenantProfile[]).map((id) => {
    const segment = HOUSING_SEGMENTS[id];
    const compatible = stock.filter((unit) => isCompatible(unit, segment));
    const vacant = compatible.reduce((total, unit) => total + unit.vacantSlots, 0);
    const affordable = compatible.reduce(
      (total, unit) =>
        total + (unit.askingRent <= effectiveRentBudget(state, segment) ? unit.vacantSlots : 0),
      0,
    );
    return {
      id: segment.id,
      label: segment.label,
      population: segmentPopulation(state, segment),
      populationCap: segment.populationCap,
      appealPercent: appealOf(state, segment, stock, vacant, affordable),
      compatibleSlots: compatible.reduce(
        (total, unit) => total + BUILDING_DEFINITIONS[unit.building.type].capacity,
        0,
      ),
      vacantSlots: vacant,
      affordableVacantSlots: affordable,
    };
  });
}

function appealOf(
  state: GameState,
  segment: HousingSegment,
  stock: readonly StockUnit[],
  vacantSlots: number,
  affordableVacantSlots: number,
): number {
  const compatible = stock.filter((unit) => isCompatible(unit, segment));
  const stockQuality =
    compatible.length === 0
      ? 0
      : Math.round(
          compatible.reduce((total, unit) => total + desirabilityOf(unit, segment), 0) /
            compatible.length,
        );
  const safety =
    compatible.length === 0
      ? 100
      : Math.round(compatible.reduce((total, unit) => total + unit.safety, 0) / compatible.length);
  const affordability =
    vacantSlots === 0 ? 0 : Math.round((100 * affordableVacantSlots) / vacantSlots);
  const weights = HOUSING_MARKET_POLICY.appealWeights;
  return clamp(
    Math.round(
      (stockQuality * weights.stock +
        safety * weights.safety +
        affordability * weights.affordability +
        employmentPercent(state, segment, stock) * weights.employment) /
        (weights.stock + weights.safety + weights.affordability + weights.employment),
    ),
    0,
    100,
  );
}

/** Vacancia observada antes de admitir llegadas: es la señal que mueve el índice de renta. */
export function vacancyPercentByBuildingType(
  state: GameState,
  stock: readonly StockUnit[] = buildStock(state),
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const type of BUILDING_TYPES) {
    const units = stock.filter((unit) => unit.building.type === type);
    if (units.length === 0) {
      result[type] = 0;
      continue;
    }
    const slots = units.reduce(
      (total, unit) => total + BUILDING_DEFINITIONS[unit.building.type].capacity,
      0,
    );
    const vacant = units.reduce((total, unit) => total + unit.vacantSlots, 0);
    result[type] = slots === 0 ? 0 : Math.round((1000 * vacant) / slots) / 10;
  }
  return result;
}

function adjustRentIndices(
  state: GameState,
  stock: readonly StockUnit[],
  vacancy: Record<string, number>,
): void {
  const market = state.phase2.housingMarket;
  /**
   * La vacancia observada es física; el shock macroeconómico no crea plazas vacías, cambia lo que el
   * mercado tolera. El modifier escala la señal que alimenta el descubrimiento de precio: una
   * recesión hace que la misma vacancia presione más la renta a la baja y una crisis de vivienda, lo
   * contrario. La cifra publicada sigue siendo la observada.
   */
  const vacancySignalModifier = 1 + (activeMacroModifiers(state).vacancyModifierPercent ?? 0) / 100;
  for (const type of BUILDING_TYPES) {
    if (
      stock.filter((unit) => unit.building.type === type).length <
      HOUSING_MARKET_POLICY.minimumUnitsForPriceDiscovery
    )
      continue;
    const signal = Math.max(0, vacancy[type]! * vacancySignalModifier);
    const gap = HOUSING_MARKET_POLICY.targetVacancyPercent - signal;
    const step = clamp(
      Math.round(gap * HOUSING_MARKET_POLICY.indexPointsPerVacancyPoint),
      -HOUSING_MARKET_POLICY.maximumIndexStepPercent,
      HOUSING_MARKET_POLICY.maximumIndexStepPercent,
    );
    market.rentIndexPercentByBuildingType[type] = clamp(
      (market.rentIndexPercentByBuildingType[type] ?? 100) + step,
      HOUSING_MARKET_POLICY.minimumIndexPercent,
      HOUSING_MARKET_POLICY.maximumIndexPercent,
    );
  }
}

function nextTenantOrdinal(state: GameState): number {
  let highest = state.phase2.housingMarket.nextTenantOrdinal - 1;
  for (const id of state.phase2.tenants.keys()) {
    const suffix = Number.parseInt(id.slice("tenant_".length), 10);
    if (Number.isFinite(suffix) && suffix > highest) highest = suffix;
  }
  return highest + 1;
}

function admitArrivals(state: GameState, stock: readonly StockUnit[], prng: Xoshiro128ss): void {
  const market = state.phase2.housingMarket;
  /** La demanda macroeconómica multiplica la llegada de hogares antes de los topes de plazas. */
  const demandFactor = 1 + (activeMacroModifiers(state).demandModifierPercent ?? 0) / 100;
  // Las plazas se reservan en una sola pasada para que dos segmentos que comparten tipo de
  // edificio (artesanos y comerciantes en talleres) no cuenten dos veces la misma vacante.
  const remaining = new Map<BuildingId, number>(
    stock.map((unit) => [unit.building.id, unit.vacantSlots]),
  );
  let ordinal = nextTenantOrdinal(state);
  for (const id of Object.keys(HOUSING_SEGMENTS) as TenantProfile[]) {
    const segment = HOUSING_SEGMENTS[id];
    const compatible = stock
      .filter((unit) => isCompatible(unit, segment))
      .sort(
        (left, right) =>
          desirabilityOf(right, segment) - desirabilityOf(left, segment) ||
          left.building.id.localeCompare(right.building.id),
      );
    const free = compatible.reduce(
      (total, unit) => total + (remaining.get(unit.building.id) ?? 0),
      0,
    );
    const budget = effectiveRentBudget(state, segment);
    const affordable = compatible.reduce(
      (total, unit) =>
        total + (unit.askingRent <= budget ? (remaining.get(unit.building.id) ?? 0) : 0),
      0,
    );
    const population = segmentPopulation(state, segment);
    const pressure = clamp((segment.populationCap - population) / segment.populationCap, 0, 1);
    const appeal = appealOf(state, segment, stock, free, affordable);
    // Sin plazas libres Y asequibles no llega nadie: construir caro no atrae demanda, sólo vacancia.
    const arrivals = Math.min(
      Math.min(free, affordable),
      Math.max(
        0,
        Math.round(segment.arrivalsAtFullAppeal * (appeal / 100) * pressure * demandFactor),
      ),
    );
    let pending = arrivals;
    for (const unit of compatible) {
      if (pending === 0) break;
      if (unit.askingRent > budget) continue;
      const slots = remaining.get(unit.building.id) ?? 0;
      if (slots === 0) continue;
      const taken = Math.min(slots, pending);
      remaining.set(unit.building.id, slots - taken);
      pending -= taken;
    }
    for (let index = 0; index < arrivals; index += 1) {
      const jitter = prng.nextInt(0, 2 * HOUSING_MARKET_POLICY.budgetJitterPercent + 1);
      const factor = 100 - HOUSING_MARKET_POLICY.budgetJitterPercent + jitter;
      const tenantBudget = Math.round((budget * factor) / 100);
      ordinal += 1;
      const tenantId = parseTenantId(`tenant_${String(ordinal).padStart(8, "0")}`);
      const tenant: Tenant = {
        id: tenantId,
        profile: segment.id,
        budget: parseMoney(tenantBudget),
        preferredBuildingType: segment.preferredBuildingTypes[0]!,
        activeContractBuildingId: null,
        satisfaction: 60,
        leaseRemaining: 0,
        status: "available",
        size: TENANT_PROFILE_DEFAULTS[segment.id].size,
        segmentId: segment.id,
        searchMonths: 0,
        incomeFactorPercent: factor,
        origin: "market",
      };
      state.phase2.tenants.set(tenantId, tenant);
      market.arrivalsTotal += 1;
    }
  }
  market.nextTenantOrdinal = ordinal + 1;
}

function ageSearches(state: GameState): void {
  for (const tenant of state.phase2.tenants.values()) {
    if (tenant.status !== "available") continue;
    tenant.searchMonths += 1;
  }
}

function expireSearches(state: GameState): void {
  const market = state.phase2.housingMarket;
  for (const tenant of [...state.phase2.tenants.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (tenant.status !== "available") continue;
    if (tenant.searchMonths <= HOUSING_MARKET_POLICY.maximumSearchMonths) continue;
    state.phase2.tenants.delete(tenant.id);
    market.departuresTotal += 1;
  }
}

function placeSearchers(state: GameState, stock: readonly StockUnit[]): void {
  const vacant = new Map<BuildingId, number>(
    stock.map((unit) => [unit.building.id, unit.vacantSlots]),
  );
  const searchers = [...state.phase2.tenants.values()]
    .filter(
      (tenant) =>
        // Los hogares autorados son el pool que elige el jugador: el mercado no se los instala solo,
        // sólo los retira si pasan demasiado tiempo sin encontrar plaza.
        tenant.origin === "market" && tenant.status === "available" && tenant.searchMonths >= 1,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (searchers.length === 0) return;
  /**
   * La deseabilidad de una unidad no cambia durante la colocación, así que se calcula una vez por
   * segmento en vez de una vez por cada par búsqueda × unidad. El orden (puntuación descendente,
   * id ascendente) reproduce exactamente el desempate anterior, así que la colocación es idéntica.
   */
  const candidatesBySegment = new Map<TenantProfile, Array<{ unit: StockUnit; score: number }>>();
  for (const segment of Object.values(HOUSING_SEGMENTS)) {
    candidatesBySegment.set(
      segment.id,
      stock
        .filter((unit) => isCompatible(unit, segment))
        .map((unit) => ({ unit, score: desirabilityOf(unit, segment) }))
        .sort(
          (left, right) =>
            right.score - left.score || left.unit.building.id.localeCompare(right.unit.building.id),
        ),
    );
  }
  for (const tenant of searchers) {
    const segment = HOUSING_SEGMENTS[segmentIdOf(tenant)];
    const candidates = candidatesBySegment.get(segment.id)!;
    let chosen: StockUnit | null = null;
    for (const candidate of candidates) {
      if ((vacant.get(candidate.unit.building.id) ?? 0) <= 0) continue;
      if (candidate.unit.askingRent > tenant.budget) continue;
      chosen = candidate.unit;
      break;
    }
    if (!chosen) continue;
    const building = chosen.building;
    building.tenantIds.push(tenant.id);
    building.tenantId = building.tenantIds[0] ?? null;
    vacant.set(building.id, (vacant.get(building.id) ?? 0) - 1);
    tenant.activeContractBuildingId = building.id;
    tenant.status = "contracted";
    tenant.leaseRemaining = LEASE_MONTHS;
    tenant.searchMonths = 0;
  }
}

/**
 * Sistema mensual de vivienda. Se ejecuta al final del tick para que la renta del mes se cobre con
 * el índice anterior: el precio se descubre con la vacancia observada, no con la del mismo cierre.
 */
export function runHousingMarket(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const market = state.phase2.housingMarket;
  const stock = buildStock(state);
  const vacancy = vacancyPercentByBuildingType(state, stock);
  adjustRentIndices(state, stock, vacancy);
  ageSearches(state);
  expireSearches(state);
  const prng = new Xoshiro128ss(state.seed);
  prng.restoreState(state.prng);
  admitArrivals(state, stock, prng);
  state.prng = prng.exportState();
  placeSearchers(state, stock);
  market.lastSettlementTick = parseTick(state.clock.tick);
}

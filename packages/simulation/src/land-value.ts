import {
  roadCellsFromSegments,
  type DevelopmentCodeId,
  type GridCell,
  type LandValueBreakdown,
  type Parcel,
  type UrbanRole,
} from "@landlord/shared";
import type { GameState } from "./state";
import {
  effectiveDensityBonus,
  effectiveDevelopmentCode,
  type OrdinanceDensity,
} from "./development-codes";
import { GAME_MONTH_TICKS } from "./game-data";
import { buildCoverageIndex, type CoverageIndex } from "./urban-services";
import { cellKey } from "./urban-fabric";

const GRID_SIZE = 64;
const MONTHLY_STEP_PERCENT = 5;
const OFFSETS: readonly GridCell[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function distanceMap(sources: readonly GridCell[]): Map<string, number> {
  const distance = new Map<string, number>();
  const queue: GridCell[] = [];
  for (const source of sources) {
    if (source.x < 0 || source.y < 0 || source.x >= GRID_SIZE || source.y >= GRID_SIZE) continue;
    const key = cellKey(source);
    if (distance.has(key)) continue;
    distance.set(key, 0);
    queue.push(source);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    const currentDistance = distance.get(cellKey(current))!;
    for (const offset of OFFSETS) {
      const next = { x: current.x + offset.x, y: current.y + offset.y };
      if (next.x < 0 || next.y < 0 || next.x >= GRID_SIZE || next.y >= GRID_SIZE) continue;
      const key = cellKey(next);
      if (distance.has(key)) continue;
      distance.set(key, currentDistance + 1);
      queue.push(next);
    }
  }
  return distance;
}

function distanceAt(map: ReadonlyMap<string, number>, cell: GridCell): number {
  return map.get(cellKey(cell)) ?? GRID_SIZE * 2;
}

function roleCells(
  roles: ReadonlySet<UrbanRole>,
  blocks: Iterable<{
    cells: readonly GridCell[];
    urbanRole: UrbanRole;
  }>,
): GridCell[] {
  const cells: GridCell[] = [];
  for (const block of blocks) {
    if (!roles.has(block.urbanRole)) continue;
    for (const cell of block.cells) cells.push(cell);
  }
  return cells;
}

function hashVariation(parcel: Parcel): number {
  let hash = 0x811c9dc5;
  const source = `${parcel.id}|${parcel.baseLandValue}|${parcel.districtId}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul((hash ^ source.charCodeAt(index)) >>> 0, 0x01000193) >>> 0;
  }
  return (hash % 7) - 3;
}

export type LandValueContext = {
  districtId: string;
  roadClassBySegmentId: ReadonlyMap<string, string>;
  roleByBlockId: ReadonlyMap<string, UrbanRole>;
  avenueDistance: ReadonlyMap<string, number>;
  roadDistance: ReadonlyMap<string, number>;
  commercialDistance: ReadonlyMap<string, number>;
  industrialDistance: ReadonlyMap<string, number>;
  civicDistance: ReadonlyMap<string, number>;
  coverage: CoverageIndex;
  /**
   * Oportunidad urbanística vigente de la ordenanza activa (H1-09B). Viaja con el contexto y no con
   * la geometría cacheada: la ordenanza cambia cada mes y las distancias no.
   */
  density: OrdinanceDensity;
};

type GeometryCache = Omit<LandValueContext, "districtId" | "coverage" | "density">;

/**
 * Distance maps depend only on generated geometry, which V.d.4 never mutates. The district state
 * object is the cache key; save/load gets a fresh object and rebuilds.
 */
const geometryCache = new WeakMap<object, GeometryCache>();

/** Spatial inputs for one district. Distances are geometric (ignoring obstacles): a value signal, not a route. */
export function buildLandValueContext(
  state: GameState,
  districtId: Parcel["districtId"],
  coverage: CoverageIndex = buildCoverageIndex(state),
): LandValueContext {
  const district = state.world.districts.get(districtId);
  if (!district) throw new RangeError(`Unknown district for land value: ${districtId}`);
  const cached = geometryCache.get(district);
  const ordinance = state.phase2.ordinance;
  const live = { districtId, coverage, density: ordinance };
  if (cached) return { ...cached, ...live };
  const roadClassBySegmentId = new Map(
    district.map.roads.segments.map((segment) => [segment.id as string, segment.class]),
  );
  const avenueCells = roadCellsFromSegments(
    district.map.roads.segments.filter((segment) => segment.class === "avenue"),
  );
  const roadCells = roadCellsFromSegments(district.map.roads.segments);
  const blocks = [...district.blocks.values()];
  const commercialSources = roleCells(new Set(["commercial_corridor"]), blocks);
  const industrialSources = roleCells(new Set(["industrial_logistics"]), blocks);
  const civicSources: GridCell[] = [];
  for (const facility of district.facilities.values()) {
    for (const parcelId of facility.parcelIds) {
      const parcel = state.phase2.parcels.get(parcelId);
      if (parcel) civicSources.push(...parcel.cells);
    }
  }
  for (const space of district.publicSpaces.values()) civicSources.push(...space.cells);
  const geometry: GeometryCache = {
    roadClassBySegmentId,
    roleByBlockId: new Map(blocks.map((block) => [block.id as string, block.urbanRole])),
    avenueDistance: distanceMap(
      [...avenueCells].map((key) => {
        const [x, y] = key.split(":").map(Number) as [number, number];
        return { x, y };
      }),
    ),
    roadDistance: distanceMap(
      [...roadCells].map((key) => {
        const [x, y] = key.split(":").map(Number) as [number, number];
        return { x, y };
      }),
    ),
    commercialDistance: distanceMap(commercialSources),
    industrialDistance: distanceMap(industrialSources),
    civicDistance: distanceMap(civicSources),
  };
  geometryCache.set(district, geometry);
  return { ...geometry, ...live };
}

function frontageScore(parcel: Parcel, context: LandValueContext): number {
  if (parcel.roadFrontages.length === 0) return 0;
  return parcel.roadFrontages.some(
    (frontage) => context.roadClassBySegmentId.get(frontage.roadSegmentId) === "avenue",
  )
    ? 6
    : 3;
}

/**
 * Potencial normativo del suelo: el código de la parcela más la densidad que la ordenanza vigente
 * concede a su rol (H1-09B). Mientras el ensayo de corredor está activo, la oportunidad del solar
 * sube; al expirar, vuelve a ser la del código base. Los derechos adquiridos de un permiso privado
 * no entran aquí —eso los consume sólo su titular al construir, y revalorizaría toda la ciudad.
 */
function codePotential(
  codeId: DevelopmentCodeId,
  role: UrbanRole | undefined,
  context: LandValueContext,
): number {
  const bonus = effectiveDensityBonus(context.density, role);
  const code = effectiveDevelopmentCode(codeId, bonus.floors, bonus.farPercent);
  return clamp(code.maxFloors + Math.floor(code.maxFloorAreaRatioPercent / 100), 0, 12);
}

/**
 * H2.1-02 · un solar vacío junto a una red operativa ya vale más que un erial sin acceso, y el
 * jugador lo ve en el mapa antes de construir. La tasación usa la señal disponible según el
 * estado de la parcela: desarrollada → cobertura REAL servida; vacante → cobertura POTENCIAL
 * (H2-10: hay un servicio alcanzable con hueco libre). Sólo se sustituye `security`, que es el
 * único término de esta composición que viene de las facilities con capacidad; `transport` y
 * `cleaning` son accesibilidad y red radial y ya se computan para toda parcela marketable. La
 * composición y los pesos no cambian: `(transport + security + cleaning) / 30`, banda 0..10.
 *
 * El potencial no reserva capacidad: dos solares vacantes contiguos pueden ver el mismo hueco
 * libre. Cuando uno se construya, la demanda activa dirá quién lo ocupó.
 */
function serviceScore(parcel: Parcel, coverage: CoverageIndex): number {
  const levels = coverage.byParcelId.get(parcel.id);
  if (!levels) return 0;
  const security = coverage.developedParcelIds.has(parcel.id)
    ? levels.security
    : (coverage.potentialByParcelId.get(parcel.id)?.security ?? 0);
  return clamp(Math.round((levels.transport + security + levels.cleaning) / 30), 0, 10);
}

/**
 * Integer land-value score of V.d.4. Components are literal bands; `rawScore` is their sum and
 * `clampAdjustment` makes `score` the clamped value the plan specifies.
 */
export function landValueBreakdownFor(
  parcel: Parcel,
  context: LandValueContext,
): LandValueBreakdown {
  const roadCentrality = clamp(20 - distanceAt(context.avenueDistance, parcel.anchorCell), 0, 20);
  const commercialAccess = clamp(
    12 - distanceAt(context.commercialDistance, parcel.anchorCell),
    0,
    12,
  );
  const civicAmenities = clamp(10 - distanceAt(context.civicDistance, parcel.anchorCell), 0, 10);
  const frontage = frontageScore(parcel, context);
  const role = context.roleByBlockId.get(parcel.blockId as string);
  const potential = codePotential(parcel.developmentCodeId, role, context);
  const services = serviceScore(parcel, context.coverage);
  const industrialExternality =
    role === "industrial_logistics"
      ? 0
      : -clamp(18 - distanceAt(context.industrialDistance, parcel.anchorCell), 0, 18);
  const isolation = -clamp(distanceAt(context.roadDistance, parcel.anchorCell), 0, 20);
  const seedVariation = hashVariation(parcel);
  const rawScore =
    roadCentrality +
    commercialAccess +
    civicAmenities +
    frontage +
    potential +
    services +
    industrialExternality +
    isolation +
    seedVariation;
  const score = clamp(rawScore, -40, 60);
  const targetValue = Math.floor((parcel.baseLandValue * (100 + score)) / 100);
  return {
    roadCentrality,
    commercialAccess,
    civicAmenities,
    frontage,
    codePotential: potential,
    services,
    industrialExternality,
    isolation,
    seedVariation,
    rawScore,
    clampAdjustment: score - rawScore,
    score,
    targetValue,
  };
}

/**
 * Monthly close: move each market value toward its target by at most 5 % of the current value.
 * Public land stays at zero; it is not a traded asset.
 */
export function updateLandValues(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const coverage = buildCoverageIndex(state);
  const contexts = new Map<string, LandValueContext>();
  for (const districtId of state.world.city.districtIds) {
    contexts.set(districtId, buildLandValueContext(state, districtId, coverage));
  }
  const parcels = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.disposition === "marketable")
    .sort((left, right) => left.id.localeCompare(right.id));
  for (const parcel of parcels) {
    const context = contexts.get(parcel.districtId);
    if (!context) continue;
    const breakdown = landValueBreakdownFor(parcel, context);
    const current = parcel.marketValue;
    const maxStep = Math.floor((current * MONTHLY_STEP_PERCENT) / 100);
    const target = breakdown.targetValue;
    if (target === current || maxStep === 0) continue;
    const delta = clamp(target - current, -maxStep, maxStep);
    parcel.marketValue = Math.max(0, current + delta) as Parcel["marketValue"];
  }
}

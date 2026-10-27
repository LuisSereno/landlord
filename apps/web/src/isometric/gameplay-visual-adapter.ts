import type { GridCell, ViewProjectionV1 } from "@landlord/shared";
import type { GroundPlan, GroundRoadMarking, GroundSurface } from "../visual-slice/ground";

/**
 * Frontera de presentación del gameplay (WP4.15-V.c.1). Convierte `ViewProjectionV1` en el modelo
 * visual que consume la escena isométrica: qué archetype de edificio pintar, qué superficie tiene
 * cada celda y qué decoración sin carretera puede dibujarse.
 *
 * Es puro y unidireccional. Sólo lee la proyección; no importa `GameState`, ni paquetes internos de
 * simulación, ni la composición fija de `visual-slice/layout.ts`. La dirección autoritativa sigue
 * siendo la simulación; aquí sólo se decide cómo se ve.
 *
 * Simulación → ViewProjectionV1 → este adapter → renderer Graphic Civic → Phaser.
 */

/** Tipos económicos sin geometría Blender homologable: se mantienen en el fallback procedural. */
const INDUSTRIAL_TYPES: readonly string[] = ["cement_plant", "brickworks", "steelworks"];

/**
 * Archetypes residenciales compatibles (huella 1×1 en el bundle Blender). Se listan ordenados para
 * que la selección por hash no dependa del orden de un mapa.
 */
const RESIDENTIAL_ARCHETYPES: readonly string[] = [
  "bld_residential_a",
  "bld_residential_b",
  "bld_residential_c",
  "courtyard_home",
];

/** Archetypes comerciales/taller compatibles (huella 1×1 en el bundle Blender). */
const COMMERCIAL_ARCHETYPES: readonly string[] = [
  "bld_shopfront",
  "bld_commercial_b",
  "bld_commercial_c",
];

/** Especies de árbol que pueden decorar sin depender de una red vial. */
const TREE_ASSETS: readonly string[] = ["prp_tree_oak", "prp_tree_pine", "prp_tree_detailed"];

export type GameplayBuildingVisual = {
  /** Identificador estable: `building:{id}` o `site:{id}`. */
  id: string;
  /** Tipo económico de dominio; base del fallback procedural. */
  domainType: string;
  /** Archetype visual preferido (asset Blender cuando existe). */
  archetype: string;
};

export type GameplayDecoration = {
  cell: GridCell;
  asset: string;
  /** Multiplicador sobre la escala física (`spriteScaleFor`); no un agrandado global arbitrario. */
  scale: number;
};

export type GameplayStreetFurnitureKind = "street_light" | "traffic_light" | "bench" | "trash_can";

export type GameplayStreetFurniture = {
  id: string;
  kind: GameplayStreetFurnitureKind;
  asset: string;
  cell: GridCell;
  roadCell: GridCell;
  curbEdge?: "n" | "e" | "s" | "w";
  azimuth?: 45 | 225;
  scale: number;
};

export type GameplayParkedVehicle = {
  id: string;
  asset: "veh_sedan" | "veh_taxi" | "veh_truck";
  roadCell: GridCell;
  side: "n" | "e" | "s" | "w";
  azimuth: 45 | 225;
  lateralOffset: number;
  longitudinalOffset: number;
  scale: number;
};

export type GameplayVisualModel = {
  groundPlan: GroundPlan;
  /** Clave de geometría: cambia sólo con datos que afectan al terreno, no con economía no espacial. */
  geometryKey: string;
  buildings: GameplayBuildingVisual[];
  decorations: GameplayDecoration[];
  streetFurniture: GameplayStreetFurniture[];
  parkedVehicles: GameplayParkedVehicle[];
  /** Metadatos presentacionales derivados de `projection.map.roads.cells`; no son datos de dominio. */
  roadVisuals: readonly GameplayRoadVisual[];
};

export const ROAD_NEIGHBOUR_BITS = {
  n: 1,
  e: 2,
  s: 4,
  w: 8,
} as const;

export type RoadNeighbourMask = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type RoadShape =
  "isolated" | "endpoint" | "straight" | "corner" | "t_junction" | "intersection";

export type RoadOrientation =
  | "isolated"
  | "endpoint_n"
  | "endpoint_e"
  | "endpoint_s"
  | "endpoint_w"
  | "straight_ns"
  | "straight_ew"
  | "corner_ne"
  | "corner_nw"
  | "corner_se"
  | "corner_sw"
  | "t_n"
  | "t_e"
  | "t_s"
  | "t_w"
  | "intersection";

export type GameplayRoadVisual = {
  cell: GridCell;
  mask: RoadNeighbourMask;
  shape: RoadShape;
  orientation: RoadOrientation;
};

export type RoadShapeInfo = { shape: RoadShape; orientation: RoadOrientation };

/**
 * Las orientaciones de las T nombran el brazo ausente (por ejemplo, `t_n` = E+S+W). Esto evita
 * confundir la orientación de la forma con el class street/avenue, que no está en la proyección.
 */
const ROAD_SHAPE_BY_MASK: readonly RoadShapeInfo[] = [
  { shape: "isolated", orientation: "isolated" },
  { shape: "endpoint", orientation: "endpoint_n" },
  { shape: "endpoint", orientation: "endpoint_e" },
  { shape: "corner", orientation: "corner_ne" },
  { shape: "endpoint", orientation: "endpoint_s" },
  { shape: "straight", orientation: "straight_ns" },
  { shape: "corner", orientation: "corner_se" },
  { shape: "t_junction", orientation: "t_w" },
  { shape: "endpoint", orientation: "endpoint_w" },
  { shape: "corner", orientation: "corner_nw" },
  { shape: "straight", orientation: "straight_ew" },
  { shape: "t_junction", orientation: "t_s" },
  { shape: "corner", orientation: "corner_sw" },
  { shape: "t_junction", orientation: "t_e" },
  { shape: "t_junction", orientation: "t_n" },
  { shape: "intersection", orientation: "intersection" },
];

function parseCellKey(key: string): GridCell | null {
  const separator = key.indexOf(":");
  if (separator <= 0 || separator === key.length - 1) return null;
  const x = Number(key.slice(0, separator));
  const y = Number(key.slice(separator + 1));
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function roadSet(roadCells: ReadonlySet<string> | ReadonlyArray<string>): ReadonlySet<string> {
  return roadCells instanceof Set ? roadCells : new Set(roadCells);
}

/** Máscara N/E/S/W pura y presentacional. No comparte lógica con simulación ni pathfinding. */
export function roadNeighbourMask(
  cell: GridCell,
  roadCells: ReadonlySet<string> | ReadonlyArray<string>,
): RoadNeighbourMask {
  const roads = roadSet(roadCells);
  let mask = 0;
  if (roads.has(`${cell.x}:${cell.y - 1}`)) mask |= ROAD_NEIGHBOUR_BITS.n;
  if (roads.has(`${cell.x + 1}:${cell.y}`)) mask |= ROAD_NEIGHBOUR_BITS.e;
  if (roads.has(`${cell.x}:${cell.y + 1}`)) mask |= ROAD_NEIGHBOUR_BITS.s;
  if (roads.has(`${cell.x - 1}:${cell.y}`)) mask |= ROAD_NEIGHBOUR_BITS.w;
  return mask as RoadNeighbourMask;
}

/** Alias ortográfico para consumidores que usan la grafía americana. */
export const roadNeighborMask = roadNeighbourMask;

export function roadShapeForMask(mask: RoadNeighbourMask): RoadShapeInfo {
  return ROAD_SHAPE_BY_MASK[mask]!;
}

/** Deriva una representación estable, ordenada por fila y columna, de la red publicada. */
export function deriveRoadVisuals(roads: {
  digest: string;
  cells: ReadonlyArray<string>;
}): readonly GameplayRoadVisual[] {
  const canonicalCells = [...new Set(roads.cells)].sort((left, right) => {
    const leftCell = parseCellKey(left);
    const rightCell = parseCellKey(right);
    if (!leftCell || !rightCell) return left.localeCompare(right);
    return leftCell.y - rightCell.y || leftCell.x - rightCell.x;
  });
  const cacheKey = `${roads.digest}|${canonicalCells.join(",")}`;
  if (roadVisualCache?.key === cacheKey) return roadVisualCache.value;
  const cells = canonicalCells.flatMap((key) => {
    const cell = parseCellKey(key);
    return cell ? [{ key, cell }] : [];
  });
  const roadCells = new Set(cells.map(({ key }) => key));
  const value = cells.map(({ cell }) => {
    const mask = roadNeighbourMask(cell, roadCells);
    const shape = roadShapeForMask(mask);
    return { cell: { ...cell }, mask, ...shape };
  });
  roadVisualCache = { key: cacheKey, value };
  return value;
}

/**
 * Sólo T y cruces reciben lenguaje peatonal. La máscara mantiene qué bocas existen para que el
 * renderer no pinte una cebra en una prolongación ausente; rectas, esquinas y extremos quedan
 * deliberadamente sin marcas en V.c.3A.
 */
export function deriveRoadMarkings(roads: {
  digest: string;
  cells: ReadonlyArray<string>;
}): readonly GroundRoadMarking[] {
  return deriveRoadVisuals(roads)
    .filter((road) => road.shape === "t_junction" || road.shape === "intersection")
    .map((road) => ({ cell: { ...road.cell }, mask: road.mask }));
}

let roadVisualCache: { key: string; value: readonly GameplayRoadVisual[] } | null = null;

/** Hash FNV-1a determinista sobre una cadena: la misma identidad siempre produce el mismo valor. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash ^ input.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

/** Hash espacial estable para dressing y decoración: sólo coordenada y sal, nunca tick ni RNG global. */
function spatialHash(x: number, y: number, salt: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const CARDINAL_HOSTS = [
  { dx: 0, dy: -1, edge: "n" },
  { dx: 1, dy: 0, edge: "e" },
  { dx: 0, dy: 1, edge: "s" },
  { dx: -1, dy: 0, edge: "w" },
] as const;
const JUNCTION_CLEARANCE = 2;

type GameplayParcel = {
  id: string;
  cell: GridCell;
  zoning: string;
  buildingId: string | null;
};

function inMap(cell: GridCell, mapWidth: number, mapHeight: number): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < mapWidth && cell.y < mapHeight;
}

function manhattanDistance(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function isJunction(road: GameplayRoadVisual): boolean {
  return road.shape === "t_junction" || road.shape === "intersection";
}

function roadLineKey(road: GameplayRoadVisual): string {
  return road.orientation === "straight_ns" ? `ns:${road.cell.x}` : `ew:${road.cell.y}`;
}

function roadProgress(road: GameplayRoadVisual): number {
  return road.orientation === "straight_ns" ? road.cell.y : road.cell.x;
}

function hostCandidates(road: GameplayRoadVisual): readonly {
  cell: GridCell;
  edge: "n" | "e" | "s" | "w";
}[] {
  const sides =
    road.orientation === "straight_ns"
      ? [CARDINAL_HOSTS[1], CARDINAL_HOSTS[3]]
      : [CARDINAL_HOSTS[0], CARDINAL_HOSTS[2]];
  const ordered =
    spatialHash(road.cell.x, road.cell.y, 0x71f3) % 2 === 0 ? sides : sides.slice().reverse();
  return ordered.map(({ dx, dy, edge }) => ({
    cell: { x: road.cell.x + dx, y: road.cell.y + dy },
    edge,
  }));
}

function nearestZoning(
  cell: GridCell,
  parcels: readonly GameplayParcel[],
  maxDistance: number,
): string | null {
  let nearest: { distance: number; zoning: string } | null = null;
  for (const parcel of parcels) {
    const distance = manhattanDistance(cell, parcel.cell);
    if (distance > maxDistance || (nearest && distance >= nearest.distance)) continue;
    nearest = { distance, zoning: parcel.zoning };
  }
  return nearest?.zoning ?? null;
}

function isNearJunction(cell: GridCell, junctions: readonly GridCell[]): boolean {
  return junctions.some((junction) => manhattanDistance(cell, junction) <= JUNCTION_CLEARANCE);
}

function hostIsFree(
  cell: GridCell,
  mapWidth: number,
  mapHeight: number,
  roadCells: ReadonlySet<string>,
  parcelCells: ReadonlySet<string>,
  treeCells: ReadonlySet<string>,
  occupiedFurniture: ReadonlySet<string>,
  constructionCells: ReadonlySet<string>,
): boolean {
  const key = cellKey(cell);
  return (
    inMap(cell, mapWidth, mapHeight) &&
    !roadCells.has(key) &&
    !parcelCells.has(key) &&
    !treeCells.has(key) &&
    !occupiedFurniture.has(key) &&
    !constructionCells.has(key)
  );
}

/**
 * Genera mobiliario urbano sin Phaser. Los hosts viven junto al bordillo, nunca en carretera ni en
 * parcela; las uniones reservan el espacio de V.c.3A y las reglas son sólo visuales.
 */
export function planGameplayStreetFurniture(
  roadVisuals: readonly GameplayRoadVisual[],
  parcels: readonly GameplayParcel[],
  constructionParcelIds: ReadonlySet<string>,
  treeCells: readonly GridCell[],
  mapWidth: number,
  mapHeight: number,
): GameplayStreetFurniture[] {
  const roadCells = new Set(roadVisuals.map((road) => cellKey(road.cell)));
  const parcelCells = new Set(parcels.map((parcel) => cellKey(parcel.cell)));
  const treeSet = new Set(treeCells.map(cellKey));
  const constructionCells = new Set<string>();
  for (const parcel of parcels) {
    if (!constructionParcelIds.has(parcel.id)) continue;
    constructionCells.add(cellKey(parcel.cell));
    for (const neighbour of CARDINAL_HOSTS) {
      constructionCells.add(`${parcel.cell.x + neighbour.dx}:${parcel.cell.y + neighbour.dy}`);
    }
  }
  const junctions = roadVisuals.filter(isJunction).map((road) => road.cell);
  const occupied = new Set<string>();
  const furniture: GameplayStreetFurniture[] = [];
  const add = (entry: GameplayStreetFurniture): void => {
    const key = cellKey(entry.cell);
    if (occupied.has(key)) return;
    occupied.add(key);
    furniture.push(entry);
  };

  // Un cruce pleno recibe dos semáforos opuestos; las T no se convierten en cruces regulados.
  for (const junction of roadVisuals.filter((road) => road.shape === "intersection")) {
    const candidates = [
      { cell: { x: junction.cell.x - 1, y: junction.cell.y - 1 }, azimuth: 225 as const },
      { cell: { x: junction.cell.x + 1, y: junction.cell.y + 1 }, azimuth: 45 as const },
      { cell: { x: junction.cell.x + 1, y: junction.cell.y - 1 }, azimuth: 225 as const },
      { cell: { x: junction.cell.x - 1, y: junction.cell.y + 1 }, azimuth: 45 as const },
    ];
    const pairs = [
      [candidates[0]!, candidates[1]!],
      [candidates[2]!, candidates[3]!],
    ];
    const pair = pairs.find(([first, second]) => {
      if (!first || !second) return false;
      return [first, second].every((candidate) =>
        hostIsFree(
          candidate.cell,
          mapWidth,
          mapHeight,
          roadCells,
          parcelCells,
          treeSet,
          occupied,
          constructionCells,
        ),
      );
    });
    if (!pair) continue;
    for (const { cell, azimuth } of pair) {
      add({
        id: `traffic-light:${cellKey(junction.cell)}:${cellKey(cell)}`,
        kind: "traffic_light",
        asset: "prp_traffic_light",
        cell,
        roadCell: { ...junction.cell },
        azimuth,
        scale: 0.82,
      });
    }
  }

  const straightRoads = roadVisuals
    .filter((road) => road.shape === "straight")
    .slice()
    .sort(
      (left, right) =>
        roadLineKey(left).localeCompare(roadLineKey(right)) ||
        roadProgress(left) - roadProgress(right),
    );
  const placeAlongStraight = (
    salt: number,
    spacing: number,
    threshold: number,
    kind: GameplayStreetFurnitureKind,
    asset: string,
    scale: number,
    zoningRequired: boolean,
  ): void => {
    const lastPlaced = new Map<string, number>();
    for (const road of straightRoads) {
      if (isNearJunction(road.cell, junctions)) continue;
      const line = roadLineKey(road);
      const progress = roadProgress(road);
      if ((lastPlaced.get(line) ?? Number.NEGATIVE_INFINITY) + spacing > progress) continue;
      if (spatialHash(road.cell.x, road.cell.y, salt) % 100 >= threshold) continue;
      const host = hostCandidates(road).find(({ cell }) =>
        hostIsFree(
          cell,
          mapWidth,
          mapHeight,
          roadCells,
          parcelCells,
          treeSet,
          occupied,
          constructionCells,
        ),
      );
      if (!host) continue;
      if (
        zoningRequired &&
        !["residential", "mixed"].includes(nearestZoning(host.cell, parcels, 3) ?? "")
      )
        continue;
      add({
        id: `${kind.replace("_", "-")}:${cellKey(road.cell)}:${cellKey(host.cell)}`,
        kind,
        asset,
        cell: host.cell,
        roadCell: { ...road.cell },
        curbEdge: host.edge,
        scale,
      });
      lastPlaced.set(line, progress);
    }
  };
  placeAlongStraight(0x44a1, 5, 38, "street_light", "prp_street_light", 0.86, false);
  placeAlongStraight(0x89b2, 9, 24, "bench", "prp_bench", 0.78, true);
  placeAlongStraight(0xb7c3, 11, 16, "trash_can", "prp_trash_can", 0.74, true);
  return furniture;
}

/** Vehículos aparcados estáticos: sólo rectas, con distancia a toda T/intersección y sin economía. */
export function planGameplayParkedVehicles(
  roadVisuals: readonly GameplayRoadVisual[],
  parcels: readonly GameplayParcel[],
  constructionParcelIds: ReadonlySet<string>,
  treeCells: readonly GridCell[],
  furniture: readonly GameplayStreetFurniture[],
  mapWidth: number,
  mapHeight: number,
): GameplayParkedVehicle[] {
  const roadCells = new Set(roadVisuals.map((road) => cellKey(road.cell)));
  const parcelCells = new Set(parcels.map((parcel) => cellKey(parcel.cell)));
  const treeSet = new Set(treeCells.map(cellKey));
  const furnitureCells = new Set(furniture.map((entry) => cellKey(entry.cell)));
  const constructionCells = new Set(
    parcels
      .filter((parcel) => constructionParcelIds.has(parcel.id))
      .flatMap((parcel) => {
        const cells = [cellKey(parcel.cell)];
        for (const neighbour of CARDINAL_HOSTS) {
          cells.push(`${parcel.cell.x + neighbour.dx}:${parcel.cell.y + neighbour.dy}`);
        }
        return cells;
      }),
  );
  const junctions = roadVisuals.filter(isJunction).map((road) => road.cell);
  const occupied = new Set<string>();
  const vehicles: GameplayParkedVehicle[] = [];
  const lastByLine = new Map<string, number>();
  const candidates = roadVisuals
    .filter((road) => road.shape === "straight")
    .slice()
    .sort(
      (left, right) =>
        roadLineKey(left).localeCompare(roadLineKey(right)) ||
        roadProgress(left) - roadProgress(right),
    );
  for (const road of candidates) {
    if (isNearJunction(road.cell, junctions)) continue;
    const line = roadLineKey(road);
    const progress = roadProgress(road);
    if ((lastByLine.get(line) ?? Number.NEGATIVE_INFINITY) + 6 > progress) continue;
    if (spatialHash(road.cell.x, road.cell.y, 0xc4d5) % 100 >= 45) continue;
    const preferred = spatialHash(road.cell.x, road.cell.y, 0xe6f7) % 2 === 0;
    const sides =
      road.orientation === "straight_ns"
        ? preferred
          ? (["e", "w"] as const)
          : (["w", "e"] as const)
        : preferred
          ? (["n", "s"] as const)
          : (["s", "n"] as const);
    const side = sides.find((value) => {
      const host =
        value === "n"
          ? { x: road.cell.x, y: road.cell.y - 1 }
          : value === "e"
            ? { x: road.cell.x + 1, y: road.cell.y }
            : value === "s"
              ? { x: road.cell.x, y: road.cell.y + 1 }
              : { x: road.cell.x - 1, y: road.cell.y };
      return (
        inMap(host, mapWidth, mapHeight) &&
        !roadCells.has(cellKey(host)) &&
        !parcelCells.has(cellKey(host)) &&
        !treeSet.has(cellKey(host)) &&
        !furnitureCells.has(cellKey(host)) &&
        !constructionCells.has(cellKey(host))
      );
    });
    if (!side || occupied.has(cellKey(road.cell))) continue;
    occupied.add(cellKey(road.cell));
    const variant = spatialHash(road.cell.x, road.cell.y, 0xf809) % 100;
    const asset: GameplayParkedVehicle["asset"] =
      variant < 72 ? "veh_sedan" : variant < 92 ? "veh_taxi" : "veh_truck";
    const azimuth: 45 | 225 = road.orientation === "straight_ns" ? 45 : 225;
    vehicles.push({
      id: `parked-${asset}:${cellKey(road.cell)}:${side}`,
      asset,
      roadCell: { ...road.cell },
      side,
      azimuth,
      lateralOffset: 0.22,
      longitudinalOffset: ((spatialHash(road.cell.x, road.cell.y, 0xa10b) % 3) - 1) * 0.08,
      scale: asset === "veh_truck" ? 0.82 : 0.78,
    });
    lastByLine.set(line, progress);
  }
  return vehicles;
}

/**
 * Arquetipo visual de un edificio. Depende del tipo de dominio y de una identidad inmutable
 * (`building.id`), no del estado ni de la condición. Los tipos industriales conservan su asset
 * procedural: una cementera nunca se dibuja como una vivienda sólo por variedad.
 */
export function visualArchetypeForBuilding(domainType: string, stableId: string): string {
  if (INDUSTRIAL_TYPES.includes(domainType)) return domainType;
  const candidates = domainType === "workshop" ? COMMERCIAL_ARCHETYPES : RESIDENTIAL_ARCHETYPES;
  const index = fnv1a32(`${domainType}|${stableId}`) % candidates.length;
  return candidates[index]!;
}

type ParcelStatus = "built" | "construction" | "vacant";

function surfaceForParcel(zoning: string, status: ParcelStatus): GroundSurface {
  if (status === "construction") return "construction";
  if (status === "vacant") return "dirt";
  if (zoning === "residential") return "gravel";
  if (zoning === "industrial") return "gravel";
  return "pavement";
}

function apronForParcel(zoning: string, status: ParcelStatus): GroundSurface | null {
  if (status !== "built") return null;
  if (zoning === "residential") return "grass";
  if (zoning === "industrial") return "gravel";
  return "pavement";
}

/**
 * Plano de suelo derivado de estado real. Clasifica cada parcela según su zoning y si está
 * construida, en obra o vacía, y sólo aplica calzadas que ya vengan en `roadCells`. Las celdas sin
 * parcela ni carretera quedan como terreno base, que el pintado ya texturiza con grano, manchas de
 * valor y desgaste.
 */
export function planGameplayGround(
  parcels: ReadonlyArray<{
    id: string;
    cell: GridCell;
    zoning: string;
    buildingId: string | null;
  }>,
  constructionParcelIds: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  roadCells: ReadonlySet<string> | ReadonlyArray<string> = [],
  roadMarkings: readonly GroundRoadMarking[] = [],
): GroundPlan {
  const surfaces = new Map<string, GroundSurface>();
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) surfaces.set(`${x}:${y}`, "urban");
  }

  const statusOf = (parcel: { id: string; buildingId: string | null }): ParcelStatus =>
    parcel.buildingId ? "built" : constructionParcelIds.has(parcel.id) ? "construction" : "vacant";

  const sorted = [...parcels].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x);
  const parcelCells = new Set(sorted.map((parcel) => cellKey(parcel.cell)));

  for (const parcel of sorted) {
    const status = statusOf(parcel);
    surfaces.set(cellKey(parcel.cell), surfaceForParcel(parcel.zoning, status));
    const apron = apronForParcel(parcel.zoning, status);
    if (!apron) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const neighbor = { x: parcel.cell.x + dx, y: parcel.cell.y + dy };
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= mapWidth || neighbor.y >= mapHeight)
        continue;
      const key = cellKey(neighbor);
      if (parcelCells.has(key)) continue;
      surfaces.set(key, apron);
    }
  }

  // La calzada se aplica al final para que ROAD > apron > parcela > base sea una regla explícita.
  // Las strings proceden únicamente de ViewProjectionV1.map.roads.cells; no se infiere geometría.
  for (const key of roadSet(roadCells)) {
    if (surfaces.has(key)) surfaces.set(key, "asphalt");
  }

  return {
    surfaces,
    crossings: [],
    roadMarkings,
    parks: [],
    treeCells: [],
    binCells: [],
    benchCells: [],
    zoneCenter: { x: (mapWidth - 1) / 2, y: (mapHeight - 1) / 2 },
  };
}

/**
 * Coloca decoración que no depende de una red vial: árboles en solares vacíos y en terreno libre
 * alejado de parcelas construidas. Determinista a partir de la coordenada; nunca pisa una celda de
 * parcela y nunca cambia entre ticks con la misma geometría.
 */
export function planGameplayDecorations(
  parcels: ReadonlyArray<{
    id: string;
    cell: GridCell;
    zoning: string;
    buildingId: string | null;
  }>,
  constructionParcelIds: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  roadCells: ReadonlySet<string> | ReadonlyArray<string> = [],
): { decorations: GameplayDecoration[]; treeCells: GridCell[] } {
  const parcelCells = new Set(parcels.map((parcel) => cellKey(parcel.cell)));
  const roadCellKeys = roadSet(roadCells);
  const blocked = new Set<string>();
  for (const parcel of parcels) {
    const built = parcel.buildingId || constructionParcelIds.has(parcel.id);
    if (!built) continue;
    for (const [dx, dy] of NEIGHBOURS) {
      blocked.add(`${parcel.cell.x + dx}:${parcel.cell.y + dy}`);
    }
  }

  const decorations: GameplayDecoration[] = [];
  const pushTree = (cell: GridCell, salt: number): void => {
    if (roadCellKeys.has(cellKey(cell))) return;
    const asset = TREE_ASSETS[spatialHash(cell.x, cell.y, salt) % TREE_ASSETS.length]!;
    const jitter = 0.9 + (spatialHash(cell.x, cell.y, salt ^ 0x9e37) % 31) / 100;
    decorations.push({ cell: { ...cell }, asset, scale: jitter });
  };

  const statusOf = (parcel: { id: string; buildingId: string | null }): ParcelStatus =>
    parcel.buildingId ? "built" : constructionParcelIds.has(parcel.id) ? "construction" : "vacant";

  // Árboles en solares vacíos (un jardín en el solar propio).
  for (const parcel of [...parcels].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x)) {
    if (statusOf(parcel) !== "vacant") continue;
    if (spatialHash(parcel.cell.x, parcel.cell.y, 0x1a2b) % 100 >= 45) continue;
    pushTree(parcel.cell, 0x1a2b);
  }

  // Árboles dispersos en terreno libre, lejos de parcelas construidas.
  for (let y = 1; y < mapHeight - 1; y += 2) {
    for (let x = 1; x < mapWidth - 1; x += 2) {
      const cell = { x, y };
      const key = cellKey(cell);
      if (parcelCells.has(key) || blocked.has(key) || roadCellKeys.has(key)) continue;
      if (spatialHash(x, y, 0x3c5d) % 100 >= 10) continue;
      pushTree(cell, 0x3c5d);
    }
  }

  return { decorations, treeCells: decorations.map((decoration) => decoration.cell) };
}

const NEIGHBOURS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Clave estable de geometría. Sólo incluye datos que cambian el suelo: qué parcelas existen, su
 * zoning y si están construidas o en obra. Excluye caja, renta, condición, reputación, política y
 * tick: dos proyecciones con la misma geometría y economía distinta generan la misma clave.
 */
export function gameplayGeometryKey(projection: ViewProjectionV1): string {
  const economy = projection.economy;
  if (!economy) return `roads:${projection.map.roads.digest}`;
  const constructionParcelIds = new Set(economy.constructionSites.map((site) => site.parcelId));
  const parts = economy.parcels
    .map((parcel) => {
      const status = parcel.buildingId
        ? "b"
        : constructionParcelIds.has(parcel.id)
          ? "c"
          : parcel.ownerOrganizationId
            ? "o"
            : "v";
      return `${parcel.cell.x},${parcel.cell.y},${parcel.zoning},${status}`;
    })
    .sort();
  return fnv1a32(`${projection.map.roads.digest}|${parts.join("|")}`).toString(16);
}

export function buildGameplayVisualModel(
  projection: ViewProjectionV1,
  mapWidth = projection.map.width,
  mapHeight = projection.map.height,
): GameplayVisualModel {
  const economy = projection.economy;
  const parcels = economy?.parcels ?? [];
  const roadVisuals = deriveRoadVisuals(projection.map.roads);
  const roadCellKeys = new Set(projection.map.roads.cells);
  const constructionParcelIds = new Set(
    (economy?.constructionSites ?? []).map((site) => site.parcelId),
  );

  const buildingVisuals: GameplayBuildingVisual[] = (economy?.buildings ?? []).map((building) => ({
    id: `building:${building.id}`,
    domainType: building.type,
    archetype: visualArchetypeForBuilding(building.type, building.id),
  }));
  const siteVisuals: GameplayBuildingVisual[] = (economy?.constructionSites ?? []).map((site) => ({
    id: `site:${site.id}`,
    domainType: site.buildingType,
    archetype: visualArchetypeForBuilding(site.buildingType, site.id),
  }));

  const { decorations, treeCells } = planGameplayDecorations(
    parcels,
    constructionParcelIds,
    mapWidth,
    mapHeight,
    roadCellKeys,
  );
  const groundPlan = planGameplayGround(
    parcels,
    constructionParcelIds,
    mapWidth,
    mapHeight,
    roadCellKeys,
    deriveRoadMarkings(projection.map.roads),
  );
  groundPlan.treeCells = treeCells;
  const streetFurniture = planGameplayStreetFurniture(
    roadVisuals,
    parcels,
    constructionParcelIds,
    treeCells,
    mapWidth,
    mapHeight,
  );
  const parkedVehicles = planGameplayParkedVehicles(
    roadVisuals,
    parcels,
    constructionParcelIds,
    treeCells,
    streetFurniture,
    mapWidth,
    mapHeight,
  );

  return {
    groundPlan,
    geometryKey: gameplayGeometryKey(projection),
    buildings: [...buildingVisuals, ...siteVisuals],
    decorations,
    streetFurniture,
    parkedVehicles,
    roadVisuals,
  };
}

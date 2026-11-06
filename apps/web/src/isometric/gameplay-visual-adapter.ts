import type { BuildingType, GridCell, ViewProjectionV2 } from "@landlord/shared";
import type { GroundPlan, GroundRoadMarking, GroundSurface } from "../visual-slice/ground";
import {
  buildingContextProps,
  districtVisualProfileFor,
  type DistrictVisualProfile,
} from "./district-visual-profiles";

/**
 * Frontera de presentación del gameplay (WP4.15-V.c.1). Convierte `ViewProjectionV2` en el modelo
 * visual que consume la escena isométrica: qué archetype de edificio pintar, qué superficie tiene
 * cada celda y qué decoración sin carretera puede dibujarse.
 *
 * Es puro y unidireccional. Sólo lee la proyección; no importa `GameState`, ni paquetes internos de
 * simulación, ni la composición fija de `visual-slice/layout.ts`. La dirección autoritativa sigue
 * siendo la simulación; aquí sólo se decide cómo se ve.
 *
 * Simulación → ViewProjectionV2 → este adapter → renderer Graphic Civic → Phaser.
 */

/**
 * Explicit temporary policy for all fifteen domain types. A missing reviewed Blender asset falls
 * back to the exact procedural type; it is never disguised as an unrelated old house or shop.
 */
export type BuildingVisualPolicy =
  | { mode: "runtime_exact"; assetId: string }
  | { mode: "runtime_compatible"; archetypes: readonly string[] }
  | { mode: "procedural_semantic_fallback"; assetId: BuildingType };

export const BUILDING_VISUAL_POLICIES: Record<BuildingType, BuildingVisualPolicy> = {
  courtyard_home: { mode: "runtime_exact", assetId: "courtyard_home" },
  row_house: { mode: "procedural_semantic_fallback", assetId: "row_house" },
  apartment_block: { mode: "procedural_semantic_fallback", assetId: "apartment_block" },
  mixed_tenement: { mode: "procedural_semantic_fallback", assetId: "mixed_tenement" },
  workshop: { mode: "procedural_semantic_fallback", assetId: "workshop" },
  warehouse: { mode: "procedural_semantic_fallback", assetId: "warehouse" },
  cement_plant: { mode: "procedural_semantic_fallback", assetId: "cement_plant" },
  brickworks: { mode: "procedural_semantic_fallback", assetId: "brickworks" },
  steelworks: { mode: "procedural_semantic_fallback", assetId: "steelworks" },
  town_hall: { mode: "runtime_exact", assetId: "town_hall" },
  school_block: { mode: "runtime_exact", assetId: "school_block" },
  clinic: { mode: "procedural_semantic_fallback", assetId: "clinic" },
  police_station: { mode: "procedural_semantic_fallback", assetId: "police_station" },
  fire_station: { mode: "procedural_semantic_fallback", assetId: "fire_station" },
  market_hall: { mode: "procedural_semantic_fallback", assetId: "market_hall" },
};

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

/** IDs runtime de vehículos horneados en el atlas (V.h.6 vocabulary). */
export type GameplayVehicleAsset =
  | "veh_sedan"
  | "veh_taxi"
  | "veh_truck"
  | "veh_firetruck"
  | "veh_ambulance"
  | "veh_police"
  | "veh_garbage"
  | "veh_delivery"
  | "veh_tractor";

export type GameplayParkedVehicle = {
  id: string;
  asset: GameplayVehicleAsset;
  roadCell: GridCell;
  side: "n" | "e" | "s" | "w";
  azimuth: 45 | 135 | 225 | 315;
  lateralOffset: number;
  longitudinalOffset: number;
  scale: number;
};

/**
 * Vehículo contextual anclado a un edificio (V.h.6 §15): fire_station→firetruck, clinic→ambulance,
 * police→police car, industrial→freight/construction. Misma forma de render que un parked vehicle
 * (roadCell + side + offsets) pero derivado del tipo de edificio, no del tráfico ambiental.
 * Presentacional y determinista; no vive en GameState.
 */
export type GameplayContextVehicle = GameplayParkedVehicle & {
  buildingId: string;
  vehicleClass: string;
};

/**
 * Actor ambiental presentacional (V.h.7 §16): peatón determinista en un espacio público, separado
 * de GameState y de los agents simulados (que se renderizan como markers autoritativos). Usa el
 * personaje horneado `vecino_variante` (idle/walk, 4 direcciones); sin IA peatonal: pose estática
 * derivada de coordenada + seed, nunca de tick.
 */
export type GameplayAmbientActor = {
  id: string;
  /** Runtime ID del personaje Rocketbox horneado (p.ej. chr_citizen). Nunca el procedural. */
  character: string;
  cell: GridCell;
  direction: 0 | 1 | 2 | 3;
  animation: "idle" | "walk";
  /** Slot de frame dentro de la dirección (0..framesPerDirection-1). */
  slot: number;
};

/**
 * Actor profesional contextual (V.h.11 §12/§16): un avatar Rocketbox anclado a un edificio del
 * rol correspondiente (comisaría→policía, clínica→sanitario, bomberos→bombero, industria→obrero).
 * Es presencia presentacional por colocación, NO uniforme literal (Rocketbox no trae uniformes).
 * Separado de GameState; determinista por coordenada de la huella.
 */
export type GameplayContextActor = GameplayAmbientActor & {
  buildingId: string;
  actorClass: string;
  /** El anchor lógico sigue siendo `cell` (road cell); el render lo desplaza hacia este bordillo. */
  curbEdge: "n" | "e" | "s" | "w";
  lateralOffset: number;
};

/** Roles de mobiliario de espacio público (V.g civic-core). Espejo de public_space_dresser.py. */
export type GameplayPublicSpaceFurnitureKind =
  "monument" | "street_lamp" | "bench" | "planter" | "bollard" | "tree" | "foliage";

export type GameplayPublicSpaceFurniture = {
  id: string;
  kind: GameplayPublicSpaceFurnitureKind;
  asset: string;
  publicSpaceId: string;
  cell: GridCell;
  /** Azimut del sprite (bancos miran al eje cívico/monumento; el resto, 45 por defecto). */
  azimuth: 45 | 135 | 225 | 315;
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
  /** Vehículos contextuales por tipo de edificio (V.h.6 §15). Presentacional, determinista. */
  contextVehicles: GameplayContextVehicle[];
  /** Peatones ambientales presentacionales en espacios públicos (V.h.7 §16). Separados de GameState. */
  ambientActors: GameplayAmbientActor[];
  /** Actores profesionales contextuales por edificio (V.h.11 §12/§16), avatares Rocketbox. */
  contextActors: GameplayContextActor[];
  /**
   * Mobiliario cívico/verde derivado de los espacios públicos (V.g). Es presentacional: no vive en
   * GameState, no lo tocan tick ni economía, sólo la geometría espacial (publicSpaces + facilities).
   */
  publicSpaceFurniture: GameplayPublicSpaceFurniture[];
  /** Dressing del espacio libre de cada parcela por tipo de solar (V.h.5). Presentacional. */
  parcelDressing: GameplayParcelDressing[];
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
  /** Celdas reales de la parcela multi-celda; `cell` es sólo su ancla. */
  cells?: readonly GridCell[];
  zoning: string;
  disposition?: "marketable" | "public" | "infrastructure";
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
    // Una parcela multi-celda define su frente en cualquiera de sus celdas, no sólo en el ancla.
    const distance = Math.min(
      ...geometryCells(parcel).map((host) => manhattanDistance(cell, host)),
    );
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
  profile?: DistrictVisualProfile,
): GameplayStreetFurniture[] {
  const roadCells = new Set(roadVisuals.map((road) => cellKey(road.cell)));
  /** Toda prueba de ocupación recorre `geometryCells`: el ancla ya no representa a la parcela. */
  const parcelCells = new Set(parcels.flatMap((parcel) => geometryCells(parcel).map(cellKey)));
  const treeSet = new Set(treeCells.map(cellKey));
  const constructionCells = new Set<string>();
  for (const parcel of parcels) {
    if (!constructionParcelIds.has(parcel.id)) continue;
    for (const cell of geometryCells(parcel)) {
      constructionCells.add(cellKey(cell));
      for (const neighbour of CARDINAL_HOSTS) {
        constructionCells.add(`${String(cell.x + neighbour.dx)}:${String(cell.y + neighbour.dy)}`);
      }
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
  const threshold = (base: number, multiplier: number) =>
    Math.max(0, Math.min(100, Math.round(base * multiplier)));
  placeAlongStraight(
    0x44a1,
    5,
    threshold(38, profile?.density.lighting ?? 1),
    "street_light",
    "prp_street_light",
    1.0,
    false,
  );
  placeAlongStraight(
    0x89b2,
    9,
    threshold(24, profile?.density.benches ?? 1),
    "bench",
    "prp_bench",
    0.78,
    true,
  );
  placeAlongStraight(
    0xb7c3,
    11,
    threshold(16, profile?.density.bins ?? 1),
    "trash_can",
    "prp_trash_can",
    0.74,
    true,
  );
  return furniture;
}

/** Eje visual de vehículo paralelo a la carretera, en ambos sentidos. */
export function vehicleAzimuthForRoad(
  orientation: RoadOrientation,
  reverse: boolean,
): 45 | 135 | 225 | 315 {
  if (orientation === "straight_ns") return reverse ? 315 : 135;
  if (orientation === "straight_ew") return reverse ? 225 : 45;
  throw new Error(`vehicleAzimuthForRoad requiere una vía recta, recibió: ${orientation}`);
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
  reservedRoadCells: ReadonlySet<string> = new Set(),
  profile?: DistrictVisualProfile,
): GameplayParkedVehicle[] {
  const roadCells = new Set(roadVisuals.map((road) => cellKey(road.cell)));
  const parcelCells = new Set(parcels.flatMap((parcel) => geometryCells(parcel).map(cellKey)));
  const treeSet = new Set(treeCells.map(cellKey));
  const furnitureCells = new Set(furniture.map((entry) => cellKey(entry.cell)));
  const constructionCells = new Set(
    parcels
      .filter((parcel) => constructionParcelIds.has(parcel.id))
      .flatMap((parcel) => {
        const cells = geometryCells(parcel).map(cellKey);
        for (const cell of geometryCells(parcel)) {
          for (const neighbour of CARDINAL_HOSTS) {
            cells.push(`${String(cell.x + neighbour.dx)}:${String(cell.y + neighbour.dy)}`);
          }
        }
        return cells;
      }),
  );
  const junctions = roadVisuals.filter(isJunction).map((road) => road.cell);
  const occupied = new Set<string>();
  const vehicles: GameplayParkedVehicle[] = [];
  const lastByLine = new Map<string, number>();
  const vehicleDensity = profile?.density.vehicles ?? 1;
  const minimumVehicleGap = Math.max(4, Math.ceil(6 / vehicleDensity));
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
    if (reservedRoadCells.has(cellKey(road.cell))) continue;
    const line = roadLineKey(road);
    const progress = roadProgress(road);
    if ((lastByLine.get(line) ?? Number.NEGATIVE_INFINITY) + minimumVehicleGap > progress) continue;
    const vehicleThreshold = Math.max(0, Math.min(100, Math.round(45 * vehicleDensity)));
    if (spatialHash(road.cell.x, road.cell.y, 0xc4d5) % 100 >= vehicleThreshold) continue;
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
      variant < 55 ? "veh_sedan" : variant < 80 ? "veh_taxi" : "veh_truck";
    const reverseDirection = spatialHash(road.cell.x, road.cell.y, 0x17b3) % 2 === 1;
    const azimuth = vehicleAzimuthForRoad(road.orientation, reverseDirection);
    vehicles.push({
      id: `parked-${asset}:${cellKey(road.cell)}:${side}`,
      asset,
      roadCell: { ...road.cell },
      side,
      azimuth,
      lateralOffset: 0.28,
      longitudinalOffset: ((spatialHash(road.cell.x, road.cell.y, 0xa10b) % 3) - 1) * 0.08,
      scale: asset === "veh_truck" ? 0.92 : 0.88,
    });
    lastByLine.set(line, progress);
  }
  if (!profile || vehicleDensity >= 1.2) return vehicles;
  const densityBudget = Math.max(
    vehicleDensity > 0 && vehicles.length > 0 ? 1 : 0,
    Math.floor((vehicles.length * vehicleDensity) / 1.2),
  );
  return vehicles.slice(0, densityBudget);
}

/**
 * V.h.6 §15: edificio → vehículo contextual estático. El asset es el runtime ID horneado en el atlas
 * (veh_firetruck, veh_ambulance, ...). No hay tráfico simulado: son dressing determinista anclado al
 * tipo de edificio (fire_station→firetruck, clinic→ambulance, police→police car, industrial→freight).
 */
const BUILDING_CONTEXT_VEHICLES: Record<
  string,
  { vehicleClass: string; asset: GameplayVehicleAsset; count: number }
> = {
  fire_station: { vehicleClass: "fire", asset: "veh_firetruck", count: 1 },
  clinic: { vehicleClass: "ambulance", asset: "veh_ambulance", count: 1 },
  police_station: { vehicleClass: "police", asset: "veh_police", count: 1 },
  market_hall: { vehicleClass: "delivery", asset: "veh_delivery", count: 1 },
  cement_plant: { vehicleClass: "freight", asset: "veh_truck", count: 2 },
  steelworks: { vehicleClass: "freight", asset: "veh_truck", count: 2 },
  brickworks: { vehicleClass: "freight", asset: "veh_truck", count: 1 },
  warehouse: { vehicleClass: "delivery", asset: "veh_delivery", count: 1 },
  workshop: { vehicleClass: "construction", asset: "veh_tractor", count: 1 },
};

const SIDE_DELTAS: readonly (readonly ["n" | "e" | "s" | "w", GridCell])[] = [
  ["n", { x: 0, y: -1 }],
  ["e", { x: 1, y: 0 }],
  ["s", { x: 0, y: 1 }],
  ["w", { x: -1, y: 0 }],
];

/**
 * Coloca los vehículos contextuales en el bordillo frente a cada edificio: una celda de carretera
 * recta adyacente a la huella, con el sprite desplazado hacia el lado del edificio. Determinista por
 * coordenada de la huella + índice; nunca en cruces ni sobre una celda ya ocupada por otro vehículo.
 */
export function planGameplayContextVehicles(
  buildings: readonly { id: string; type: string; footprintCells: readonly GridCell[] }[],
  roadVisuals: readonly GameplayRoadVisual[],
  mapWidth: number,
  mapHeight: number,
): GameplayContextVehicle[] {
  if (mapWidth <= 0 || mapHeight <= 0) return [];
  const junctions = roadVisuals.filter(isJunction).map((road) => road.cell);
  const straights = roadVisuals.filter((road) => road.shape === "straight");
  const out: GameplayContextVehicle[] = [];
  const usedRoadCells = new Set<string>();
  for (const building of buildings) {
    const spec = BUILDING_CONTEXT_VEHICLES[building.type];
    if (!spec || building.footprintCells.length === 0) continue;
    const footprint = building.footprintCells;
    const anchor = footprint[0]!;
    const curbs: { road: GameplayRoadVisual; side: "n" | "e" | "s" | "w" }[] = [];
    for (const road of straights) {
      if (isNearJunction(road.cell, junctions)) continue;
      for (const [side, delta] of SIDE_DELTAS) {
        const host = { x: road.cell.x + delta.x, y: road.cell.y + delta.y };
        if (footprint.some((cell) => cell.x === host.x && cell.y === host.y)) {
          curbs.push({ road, side });
          break;
        }
      }
    }
    if (curbs.length === 0) continue;
    for (let i = 0; i < spec.count; i += 1) {
      const free = curbs.filter((curb) => !usedRoadCells.has(cellKey(curb.road.cell)));
      if (free.length === 0) break;
      const curb = free[spatialHash(anchor.x, anchor.y, 0x7c1 + i * 0x2f) % free.length]!;
      usedRoadCells.add(cellKey(curb.road.cell));
      const reverseDirection = spatialHash(anchor.x, anchor.y, 0x31d5 + i * 0x53) % 2 === 1;
      const azimuth = vehicleAzimuthForRoad(curb.road.orientation, reverseDirection);
      out.push({
        id: `ctx-${building.id}:${spec.asset}:${cellKey(curb.road.cell)}:${i}`,
        buildingId: building.id,
        vehicleClass: spec.vehicleClass,
        asset: spec.asset,
        roadCell: { ...curb.road.cell },
        side: curb.side,
        azimuth,
        lateralOffset: 0.28,
        longitudinalOffset: ((spatialHash(anchor.x, anchor.y, 0x9a3 + i) % 3) - 1) * 0.08,
        scale:
          spec.asset === "veh_truck" ||
          spec.asset === "veh_firetruck" ||
          spec.asset === "veh_garbage"
            ? 0.92
            : 0.88,
      });
    }
  }
  return out;
}

/**
 * V.h.7 §16: peatones ambientales presentacionales en espacios públicos. Deterministas por
 * coordenada del espacio + índice (nunca tick/cámara); budget acotado por tamaño del espacio para
 * no saturar (§18/§20). No son agents simulados: no viven en GameState ni afectan economía.
 */
export function planGameplayAmbientActors(
  publicSpaces: readonly { id: string; cells: readonly GridCell[] }[],
  roadCellKeys: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  profile?: DistrictVisualProfile,
): GameplayAmbientActor[] {
  const out: GameplayAmbientActor[] = [];
  for (const space of publicSpaces) {
    if (space.cells.length === 0) continue;
    const anchor = space.cells[0]!;
    // Budget de peatones modulado por el perfil del distrito (§11): cívico/comercial con más
    // actividad, industrial/logístico con menos. Acotado para no saturar (§18/§20).
    const baseBudget = Math.min(4, Math.max(1, Math.floor(space.cells.length / 12)));
    const budget = profile
      ? Math.min(6, Math.max(0, Math.round(baseBudget * profile.density.pedestrians)))
      : baseBudget;
    const used = new Set<string>();
    for (let i = 0; i < budget; i += 1) {
      const candidates = space.cells.filter(
        (cell) => !used.has(cellKey(cell)) && !roadCellKeys.has(cellKey(cell)),
      );
      if (candidates.length === 0) break;
      const seed = spatialHash(anchor.x, anchor.y, 0x61a1 + i * 0x37);
      const cell = candidates[seed % candidates.length]!;
      used.add(cellKey(cell));
      out.push({
        id: `amb:${space.id}:${cellKey(cell)}:${i}`,
        character: "chr_citizen",
        cell: { ...cell },
        direction: (seed % 4) as 0 | 1 | 2 | 3,
        animation: seed % 3 === 0 ? "idle" : "walk",
        slot: seed % 2,
      });
    }
  }
  return out;
}

/**
 * V.h.11 §12/§16: edificio → actor profesional (avatar Rocketbox). Rol por colocación, no uniforme.
 */
const BUILDING_CONTEXT_ACTORS: Record<string, { actorClass: string; character: string }> = {
  police_station: { actorClass: "police", character: "chr_police" },
  clinic: { actorClass: "medical", character: "chr_medical" },
  fire_station: { actorClass: "firefighter", character: "chr_firefighter" },
  workshop: { actorClass: "worker", character: "chr_worker" },
  warehouse: { actorClass: "worker", character: "chr_worker" },
  cement_plant: { actorClass: "worker", character: "chr_worker" },
  steelworks: { actorClass: "worker", character: "chr_worker" },
  brickworks: { actorClass: "worker", character: "chr_worker" },
};

/**
 * Coloca un actor profesional por edificio con rol, en el bordillo frente al acceso (misma idea que
 * los vehículos contextuales), evitando las celdas de carretera ya reservadas por un vehículo y los
 * cruces. Determinista por coordenada de la huella. Presentacional, fuera de GameState.
 */
export function planGameplayContextActors(
  buildings: readonly { id: string; type: string; footprintCells: readonly GridCell[] }[],
  roadVisuals: readonly GameplayRoadVisual[],
  reservedRoadCells: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
): GameplayContextActor[] {
  if (mapWidth <= 0 || mapHeight <= 0) return [];
  const junctions = roadVisuals.filter(isJunction).map((road) => road.cell);
  const straights = roadVisuals.filter((road) => road.shape === "straight");
  const out: GameplayContextActor[] = [];
  const used = new Set<string>();
  for (const building of buildings) {
    const spec = BUILDING_CONTEXT_ACTORS[building.type];
    if (!spec || building.footprintCells.length === 0) continue;
    const footprint = building.footprintCells;
    const anchor = footprint[0]!;
    const curbs: { road: GameplayRoadVisual; side: "n" | "e" | "s" | "w" }[] = [];
    for (const road of straights) {
      if (isNearJunction(road.cell, junctions)) continue;
      for (const [side, delta] of SIDE_DELTAS) {
        const host = { x: road.cell.x + delta.x, y: road.cell.y + delta.y };
        const frontageDistance = Math.min(
          ...footprint.map((cell) => Math.abs(cell.x - host.x) + Math.abs(cell.y - host.y)),
        );
        // Un vehículo puede ocupar la celda exacta del acceso. En ese caso el profesional usa el
        // tramo contiguo del mismo bordillo (una celda longitudinal), sin saltar a calzada central.
        if (frontageDistance <= 1 && !reservedRoadCells.has(cellKey(road.cell))) {
          curbs.push({ road, side });
          break;
        }
      }
    }
    if (curbs.length === 0) continue;
    const free = curbs.filter((curb) => !used.has(cellKey(curb.road.cell)));
    if (free.length === 0) continue;
    const curb = free[spatialHash(anchor.x, anchor.y, 0x4b7c) % free.length]!;
    used.add(cellKey(curb.road.cell));
    out.push({
      id: `ctxa-${building.id}:${spec.character}:${cellKey(curb.road.cell)}`,
      buildingId: building.id,
      actorClass: spec.actorClass,
      character: spec.character,
      cell: { ...curb.road.cell },
      curbEdge: curb.side,
      lateralOffset: 0.46,
      direction: (spatialHash(anchor.x, anchor.y, 0x2f1) % 4) as 0 | 1 | 2 | 3,
      animation: "idle",
      slot: 0,
    });
  }
  return out;
}

/** Posición fraccionaria que usa Phaser: fuera del centro vial y hacia la fachada asociada. */
export function contextActorRenderCell(
  actor: Pick<GameplayContextActor, "cell" | "curbEdge" | "lateralOffset">,
): GridCell {
  const delta =
    actor.curbEdge === "n"
      ? { x: 0, y: -actor.lateralOffset }
      : actor.curbEdge === "e"
        ? { x: actor.lateralOffset, y: 0 }
        : actor.curbEdge === "s"
          ? { x: 0, y: actor.lateralOffset }
          : { x: -actor.lateralOffset, y: 0 };
  return { x: actor.cell.x + delta.x, y: actor.cell.y + delta.y };
}

/**
 * Vocabulario de dressing por tipo de espacio público. Espejo de `public-space-dressing.json` y de
 * `public_space_dresser.py`: mismas estrategias (center/perimeter/corners/inner_ring/scatter), misma
 * separación plaza↔parque. Un asset por rol; si el sprite no está en el atlas, el renderer lo salta.
 */
type PublicSpaceSlot = {
  role: GameplayPublicSpaceFurnitureKind;
  strategy: "center" | "perimeter" | "corners" | "inner_ring" | "scatter";
  assets: readonly string[];
  everyCells?: number;
  insetCells?: number;
  count?: number;
  density?: number;
  minSpacingCells?: number;
  scale: number;
  salt: number;
};

const PUBLIC_SPACE_VOCAB: Record<string, readonly PublicSpaceSlot[]> = {
  plaza: [
    {
      role: "monument",
      strategy: "center",
      assets: ["prp_monument_obelisk"],
      scale: 1.0,
      salt: 0x1a01,
    },
    {
      role: "street_lamp",
      strategy: "perimeter",
      assets: ["prp_street_light"],
      everyCells: 3,
      scale: 1.0,
      salt: 0x1a02,
    },
    {
      role: "bench",
      strategy: "inner_ring",
      assets: ["prp_bench"],
      insetCells: 1,
      count: 4,
      scale: 0.9,
      salt: 0x1a03,
    },
    { role: "planter", strategy: "corners", assets: ["prp_planter_urn"], scale: 0.9, salt: 0x1a04 },
    {
      role: "bollard",
      strategy: "perimeter",
      assets: ["prp_bollard"],
      everyCells: 5,
      scale: 0.8,
      salt: 0x1a05,
    },
  ],
  civic_courtyard: [
    { role: "planter", strategy: "corners", assets: ["prp_planter_urn"], scale: 0.9, salt: 0x1c01 },
    {
      role: "street_lamp",
      strategy: "perimeter",
      assets: ["prp_street_light"],
      everyCells: 4,
      scale: 1.0,
      salt: 0x1c02,
    },
  ],
  park: [
    {
      role: "tree",
      strategy: "scatter",
      assets: ["prp_tree_oak", "prp_tree_pine", "prp_tree_detailed"],
      density: 0.18,
      minSpacingCells: 2,
      scale: 1.0,
      salt: 0x1b01,
    },
    {
      role: "foliage",
      strategy: "scatter",
      assets: ["prp_bush"],
      density: 0.06,
      minSpacingCells: 2,
      scale: 0.9,
      salt: 0x1b02,
    },
    {
      role: "bench",
      strategy: "perimeter",
      assets: ["prp_bench"],
      everyCells: 6,
      scale: 0.9,
      salt: 0x1b03,
    },
    {
      role: "street_lamp",
      strategy: "perimeter",
      assets: ["prp_street_light"],
      everyCells: 9,
      scale: 1.0,
      salt: 0x1b04,
    },
  ],
  pocket_park: [
    {
      role: "tree",
      strategy: "scatter",
      assets: ["prp_tree_pine", "prp_tree_detailed"],
      density: 0.22,
      minSpacingCells: 2,
      scale: 1.0,
      salt: 0x1d01,
    },
    {
      role: "foliage",
      strategy: "scatter",
      assets: ["prp_bush"],
      density: 0.1,
      minSpacingCells: 1,
      scale: 0.9,
      salt: 0x1d02,
    },
    { role: "bench", strategy: "center", assets: ["prp_bench"], scale: 0.9, salt: 0x1d03 },
  ],
};

function spaceCentroid(cells: readonly GridCell[]): GridCell {
  let sx = 0;
  let sy = 0;
  for (const cell of cells) {
    sx += cell.x;
    sy += cell.y;
  }
  return { x: Math.round(sx / cells.length), y: Math.round(sy / cells.length) };
}

function spaceBounds(cells: readonly GridCell[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    minY = Math.min(minY, cell.y);
    maxX = Math.max(maxX, cell.x);
    maxY = Math.max(maxY, cell.y);
  }
  return { minX, minY, maxX, maxY };
}

function isPerimeter(cell: GridCell, set: ReadonlySet<string>): boolean {
  return (
    !set.has(`${cell.x + 1}:${cell.y}`) ||
    !set.has(`${cell.x - 1}:${cell.y}`) ||
    !set.has(`${cell.x}:${cell.y + 1}`) ||
    !set.has(`${cell.x}:${cell.y - 1}`)
  );
}

/** Eje cívico de una plaza enlazada a un ayuntamiento: monumento sobre el eje, corredor libre. */
function civicAxis(
  cellset: ReadonlySet<string>,
  cells: readonly GridCell[],
  townHallCells: readonly GridCell[],
): { monument: GridCell; corridor: Set<string> } {
  const hall = spaceCentroid(townHallCells);
  const plaza = spaceCentroid(cells);
  let ux = plaza.x - hall.x;
  let uy = plaza.y - hall.y;
  const length = Math.hypot(ux, uy) || 1;
  ux /= length;
  uy /= length;
  const corridor = new Set<string>();
  let monument: GridCell | null = null;
  let monumentAlong = Infinity;
  for (const cell of cells) {
    const vx = cell.x - plaza.x;
    const vy = cell.y - plaza.y;
    const perpendicular = Math.abs(vx * uy - vy * ux);
    const along = vx * ux + vy * uy;
    if (perpendicular <= 1.5) corridor.add(`${cell.x}:${cell.y}`);
    if (perpendicular <= 1.5 && along < monumentAlong) {
      monumentAlong = along;
      monument = cell;
    }
  }
  return { monument: monument ?? plaza, corridor };
}

/**
 * Mobiliario de espacios públicos derivado de la geometría (V.g civic-core). Espejo runtime de
 * `public_space_dresser.py`: entrada = publicSpaces + facilities (para el eje town_hall↔plaza) +
 * huellas de edificios + celdas de road; salida = props presentacionales. Determinista por
 * `spatialHash(celda, salt)`: ni tick ni economía entran, así que el dressing no cambia al avanzar
 * el reloj. Un prop nunca pisa una carretera ni la huella de un edificio.
 */
export function planGameplayPublicSpaceFurniture(
  publicSpaces: readonly { id: string; kind: string; cells: readonly GridCell[] }[],
  facilities: readonly {
    kind: string;
    buildingIds: readonly string[];
    publicSpaceIds: readonly string[];
  }[],
  buildings: readonly { id: string; footprintCells: readonly GridCell[] }[],
  roadCellKeys: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
): GameplayPublicSpaceFurniture[] {
  const townHallPlaza = new Map<string, readonly GridCell[]>();
  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  for (const facility of facilities) {
    if (facility.kind !== "town_hall") continue;
    const plazaId = facility.publicSpaceIds[0];
    const building = buildingById.get(facility.buildingIds[0] ?? "");
    if (plazaId && building) townHallPlaza.set(plazaId, building.footprintCells);
  }

  const furniture: GameplayPublicSpaceFurniture[] = [];
  for (const space of publicSpaces) {
    const slots = PUBLIC_SPACE_VOCAB[space.kind];
    if (!slots || space.cells.length === 0) continue;
    const set = new Set(space.cells.map(cellKey));
    const bounds = spaceBounds(space.cells);
    const centroid = spaceCentroid(space.cells);
    const townHallCells = townHallPlaza.get(space.id);
    const axis = townHallCells ? civicAxis(set, space.cells, townHallCells) : null;
    const monumentCell = axis ? axis.monument : centroid;
    const corridor = axis ? axis.corridor : new Set<string>();

    const occupied = new Set<string>();
    const inMap = (cell: GridCell) =>
      cell.x >= 0 && cell.y >= 0 && cell.x < mapWidth && cell.y < mapHeight;
    const free = (cell: GridCell) => {
      const key = cellKey(cell);
      if (!set.has(key)) return false; // sólo dentro del espacio público real
      if (roadCellKeys.has(key)) return false; // nunca sobre una carretera
      if (occupied.has(key)) return false;
      return true;
    };

    for (const slot of slots) {
      let targets: GridCell[] = [];
      if (slot.strategy === "center") {
        targets = [monumentCell];
      } else if (slot.strategy === "perimeter") {
        const perim = space.cells
          .filter((cell) => isPerimeter(cell, set))
          .sort((a, b) => a.y - b.y || a.x - b.x);
        targets = perim.filter((_c, index) => index % (slot.everyCells ?? 3) === 0);
      } else if (slot.strategy === "corners") {
        const corners = [
          { x: bounds.minX, y: bounds.minY },
          { x: bounds.maxX, y: bounds.minY },
          { x: bounds.minX, y: bounds.maxY },
          { x: bounds.maxX, y: bounds.maxY },
        ];
        targets = corners
          .map((corner) => nearestSpaceCell(space.cells, corner))
          .filter((cell): cell is GridCell => cell !== null);
      } else if (slot.strategy === "inner_ring") {
        const inset = slot.insetCells ?? 1;
        const ring = space.cells
          .filter(
            (cell) =>
              Math.min(
                cell.x - bounds.minX,
                cell.y - bounds.minY,
                bounds.maxX - cell.x,
                bounds.maxY - cell.y,
              ) <= inset,
          )
          .sort((a, b) => a.y - b.y || a.x - b.x);
        targets = ring.slice(0, slot.count ?? 4);
      } else if (slot.strategy === "scatter") {
        const interior = space.cells
          .filter((cell) => !isPerimeter(cell, set))
          .sort((a, b) => spatialHash(a.x, a.y, slot.salt) - spatialHash(b.x, b.y, slot.salt));
        const target = Math.max(1, Math.round((slot.density ?? 0.15) * interior.length));
        const chosen: GridCell[] = [];
        for (const cell of interior) {
          if (chosen.length >= target) break;
          if (
            chosen.every(
              (c) => Math.abs(c.x - cell.x) + Math.abs(c.y - cell.y) >= (slot.minSpacingCells ?? 2),
            )
          ) {
            chosen.push(cell);
          }
        }
        targets = chosen;
      }

      // El corredor peatonal queda libre salvo para el monumento y las farolas que lo jalonan.
      if (axis && slot.role !== "monument" && slot.role !== "street_lamp") {
        targets = targets.filter((cell) => !corridor.has(cellKey(cell)));
      }

      for (const cell of targets) {
        if (!inMap(cell) || !free(cell)) continue;
        occupied.add(cellKey(cell));
        const assetIndex = spatialHash(cell.x, cell.y, slot.salt) % slot.assets.length;
        const asset = slot.assets[assetIndex] ?? slot.assets[0]!;
        furniture.push({
          id: `psf:${space.id}:${slot.role}:${cellKey(cell)}`,
          kind: slot.role,
          asset,
          publicSpaceId: space.id,
          cell: { ...cell },
          azimuth: slot.role === "bench" ? azimuthToward(cell, monumentCell) : 45,
          scale: slot.scale,
        });
      }
    }
  }
  return furniture;
}

/** Tipo de solar para el dressing de parcela (V.h.5): deriva de zoning/disposición/estado del edificio. */
export type GameplayLotType =
  "residential" | "commercial" | "industrial" | "municipal" | "construction" | "vacant" | "ruin";

export type GameplayParcelDressing = {
  id: string;
  lotType: GameplayLotType;
  asset: string;
  parcelId: string;
  cell: GridCell;
  scale: number;
};

const RESIDENTIAL_TYPES = new Set([
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
]);
const INDUSTRIAL_TYPES_SET = new Set([
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
]);
const MUNICIPAL_TYPES = new Set([
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
]);

function lotTypeFor(
  parcel: { zoning: string; disposition?: string; buildingId: string | null },
  building: { type: string; state: string } | undefined,
  isConstruction: boolean,
): GameplayLotType {
  if (isConstruction) return "construction";
  if (building) {
    if (building.state === "ruin" || building.state === "collapse_pending") return "ruin";
    if (RESIDENTIAL_TYPES.has(building.type)) return "residential";
    if (INDUSTRIAL_TYPES_SET.has(building.type)) return "industrial";
    if (MUNICIPAL_TYPES.has(building.type)) return "municipal";
    return "commercial";
  }
  if (parcel.disposition === "public" || parcel.disposition === "infrastructure")
    return "municipal";
  return "vacant";
}

/** Props por tipo de solar: qué se coloca en el espacio libre de la parcela. Sprites existentes. */
const LOT_PROPS: Record<
  GameplayLotType,
  readonly { asset: string; weight: number; scale: number }[]
> = {
  residential: [
    { asset: "prp_tree_oak", weight: 40, scale: 0.9 },
    { asset: "prp_bush", weight: 30, scale: 0.8 },
    { asset: "prp_trash_can", weight: 20, scale: 0.8 },
    { asset: "prp_bench", weight: 10, scale: 0.8 },
  ],
  commercial: [
    { asset: "prp_trash_can", weight: 40, scale: 0.8 },
    { asset: "prp_bench", weight: 30, scale: 0.8 },
    { asset: "prp_street_light", weight: 30, scale: 0.9 },
  ],
  industrial: [
    { asset: "prp_construction_barrier", weight: 45, scale: 0.9 },
    { asset: "prp_trash_can", weight: 30, scale: 0.85 },
    { asset: "prp_construction_cone", weight: 25, scale: 0.8 },
  ],
  municipal: [
    { asset: "prp_planter_urn", weight: 40, scale: 0.85 },
    { asset: "prp_bollard", weight: 30, scale: 0.8 },
    { asset: "prp_street_light", weight: 30, scale: 0.9 },
  ],
  construction: [
    { asset: "prp_construction_barrier", weight: 50, scale: 1.0 },
    { asset: "prp_construction_cone", weight: 50, scale: 0.9 },
  ],
  vacant: [
    { asset: "prp_bush", weight: 60, scale: 0.8 },
    { asset: "prp_construction_cone", weight: 40, scale: 0.7 },
  ],
  ruin: [
    { asset: "prp_construction_cone", weight: 50, scale: 0.8 },
    { asset: "prp_bush", weight: 50, scale: 0.85 },
  ],
};

/**
 * V.h.5 parcel/lot dressing: viste el espacio NO ocupado dentro de cada parcela según su tipo de
 * solar. Determinista por spatialHash(celda, salt+lotType); no toca GameState ni economía. Los props
 * nunca pisan la huella del edificio ni una carretera ni el acceso (se dejan libres las celdas de
 * fachada frontal). Capa presentacional pura.
 */
export function planGameplayParcelDressing(
  parcels: readonly {
    id: string;
    cell?: GridCell;
    cells?: readonly GridCell[];
    zoning: string;
    disposition?: string;
    buildingId: string | null;
  }[],
  buildings: readonly {
    id: string;
    type: string;
    state: string;
    footprintCells: readonly GridCell[];
  }[],
  constructionParcelIds: ReadonlySet<string>,
  roadCellKeys: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  profile?: DistrictVisualProfile,
): GameplayParcelDressing[] {
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const out: GameplayParcelDressing[] = [];
  for (const parcel of parcels) {
    const anchor = parcel.cell;
    const cells = parcel.cells?.length ? parcel.cells : anchor ? [anchor] : [];
    if (cells.length === 0) continue;
    const building = parcel.buildingId ? buildingById.get(parcel.buildingId) : undefined;
    const lotType = lotTypeFor(parcel, building, constructionParcelIds.has(parcel.id));
    const footprint = new Set((building?.footprintCells ?? []).map(cellKey));
    // Celdas libres: dentro de la parcela, sin edificio, sin carretera.
    const free = cells.filter(
      (cell) => !footprint.has(cellKey(cell)) && !roadCellKeys.has(cellKey(cell)),
    );
    if (free.length === 0) continue;
    // Budget de props por parcela: escala con el tamaño, modulado por el perfil visual del
    // distrito (§11) y acotado para no saturar (§18/§20).
    const baseBudget = Math.min(3, Math.max(1, Math.floor(free.length / 6)));
    const budget = profile
      ? Math.min(4, Math.max(1, Math.round(baseBudget * profile.density.props)))
      : baseBudget;
    // Pool efectivo: pesos del tipo de solar sesgados por el perfil del distrito (favored/avoided)
    // y por el contexto del edificio (§12). Pesos enteros para un roll determinista.
    const context = buildingContextProps(building?.type);
    const pool = LOT_PROPS[lotType].map((entry) => {
      let weight = entry.weight;
      if (profile?.favored.includes(entry.asset)) weight *= 2;
      if (profile?.avoided.includes(entry.asset)) weight *= 0.25;
      if (context.includes(entry.asset)) weight *= 2;
      return { ...entry, weight: Math.max(1, Math.round(weight)) };
    });
    const used = new Set<string>();
    for (let i = 0; i < budget; i += 1) {
      const salt = 0x5001 + i * 0x97;
      // Elige una celda libre determinista y un prop por peso.
      const candidates = free.filter((c) => !used.has(cellKey(c)));
      if (candidates.length === 0) break;
      const pick =
        candidates[spatialHash(parcel.id.length, i, salt) % candidates.length] ?? candidates[0]!;
      // Refina con hash espacial para que la celda varíe por coordenada, no sólo por índice.
      const cell = candidates[spatialHash(pick.x, pick.y, salt) % candidates.length] ?? pick;
      used.add(cellKey(cell));
      const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
      let roll = spatialHash(cell.x, cell.y, salt + 0x11) % totalWeight;
      let chosen = pool[0]!;
      for (const prop of pool) {
        if (roll < prop.weight) {
          chosen = prop;
          break;
        }
        roll -= prop.weight;
      }
      out.push({
        id: `lotd:${parcel.id}:${lotType}:${cellKey(cell)}:${i}`,
        lotType,
        asset: chosen.asset,
        parcelId: parcel.id,
        cell: { ...cell },
        scale: chosen.scale,
      });
    }
  }
  return out;
}

function nearestSpaceCell(cells: readonly GridCell[], target: GridCell): GridCell | null {
  let best: GridCell | null = null;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const distance = Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }
  return best;
}

function azimuthToward(from: GridCell, to: GridCell): 45 | 135 | 225 | 315 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy >= 0 ? 135 : 315;
  return dx >= 0 ? 45 : 225;
}

/**
 * Arquetipo visual de un edificio. Depende del tipo de dominio y de una identidad inmutable
 * (`building.id`), no del estado ni de la condición. Los tipos industriales conservan su asset
 * procedural: una cementera nunca se dibuja como una vivienda sólo por variedad.
 */
export function visualArchetypeForBuilding(domainType: string, stableId: string): string {
  const policy = BUILDING_VISUAL_POLICIES[domainType as BuildingType];
  if (!policy) return domainType;
  if (policy.mode !== "runtime_compatible") return policy.assetId;
  const index = fnv1a32(`${domainType}|${stableId}`) % policy.archetypes.length;
  return policy.archetypes[index]!;
}

type ParcelStatus = "built" | "construction" | "vacant" | "public";

function surfaceForParcel(zoning: string, status: ParcelStatus): GroundSurface {
  if (status === "construction") return "construction";
  if (status === "public") return "grass";
  if (status === "vacant") return "dirt";
  if (zoning === "residential") return "gravel";
  if (zoning === "industrial") return "gravel";
  return "pavement";
}

function apronForParcel(zoning: string, status: ParcelStatus): GroundSurface | null {
  if (status !== "built" && status !== "public") return null;
  if (zoning === "residential") return "grass";
  if (zoning === "industrial") return "gravel";
  return "pavement";
}

/** A plaza is paved; parks and pocket parks are green. The kind comes from the projection. */
function surfaceForPublicSpace(kind: string): GroundSurface {
  return kind === "plaza" || kind === "civic_courtyard" || kind === "schoolyard"
    ? "pavement"
    : "grass";
}

function geometryCells(parcel: {
  cell: GridCell;
  cells?: readonly GridCell[];
}): readonly GridCell[] {
  return parcel.cells && parcel.cells.length > 0 ? parcel.cells : [parcel.cell];
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
    cells?: readonly GridCell[];
    zoning: string;
    disposition?: "marketable" | "public" | "infrastructure";
    buildingId: string | null;
  }>,
  constructionParcelIds: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  roadCells: ReadonlySet<string> | ReadonlyArray<string> = [],
  roadMarkings: readonly GroundRoadMarking[] = [],
  publicSpaces: ReadonlyArray<{ kind: string; cells: readonly GridCell[] }> = [],
): GroundPlan {
  const surfaces = new Map<string, GroundSurface>();
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) surfaces.set(`${x}:${y}`, "urban");
  }

  const statusOf = (parcel: {
    id: string;
    buildingId: string | null;
    disposition?: "marketable" | "public" | "infrastructure";
  }): ParcelStatus =>
    parcel.disposition === "public"
      ? "public"
      : parcel.buildingId
        ? "built"
        : constructionParcelIds.has(parcel.id)
          ? "construction"
          : "vacant";

  const sorted = [...parcels].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x);
  const parcelCells = new Set<string>();
  for (const parcel of sorted) {
    for (const cell of geometryCells(parcel)) parcelCells.add(cellKey(cell));
  }

  for (const parcel of sorted) {
    const status = statusOf(parcel);
    for (const cell of geometryCells(parcel)) {
      surfaces.set(cellKey(cell), surfaceForParcel(parcel.zoning, status));
    }
    const apron = apronForParcel(parcel.zoning, status);
    if (!apron) continue;
    for (const cell of geometryCells(parcel)) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const neighbor = { x: cell.x + dx, y: cell.y + dy };
        if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= mapWidth || neighbor.y >= mapHeight)
          continue;
        const key = cellKey(neighbor);
        if (parcelCells.has(key)) continue;
        surfaces.set(key, apron);
      }
    }
  }

  for (const space of publicSpaces) {
    const surface = surfaceForPublicSpace(space.kind);
    for (const cell of space.cells) surfaces.set(cellKey(cell), surface);
  }

  // La calzada se aplica al final para que ROAD > apron > parcela > base sea una regla explícita.
  // Las strings proceden únicamente de ViewProjectionV2.map.roads.cells; no se infiere geometría.
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
    cells?: readonly GridCell[];
    zoning: string;
    disposition?: "marketable" | "public" | "infrastructure";
    buildingId: string | null;
  }>,
  constructionParcelIds: ReadonlySet<string>,
  mapWidth: number,
  mapHeight: number,
  roadCells: ReadonlySet<string> | ReadonlyArray<string> = [],
  profile?: DistrictVisualProfile,
): { decorations: GameplayDecoration[]; treeCells: GridCell[] } {
  const parcelCells = new Set(parcels.flatMap((parcel) => geometryCells(parcel).map(cellKey)));
  const roadCellKeys = roadSet(roadCells);
  const blocked = new Set<string>();
  for (const parcel of parcels) {
    const built = parcel.buildingId || constructionParcelIds.has(parcel.id);
    if (!built) continue;
    for (const cell of geometryCells(parcel)) {
      for (const [dx, dy] of NEIGHBOURS) {
        blocked.add(`${cell.x + dx}:${cell.y + dy}`);
      }
    }
  }

  const decorations: GameplayDecoration[] = [];
  const pushVegetation = (cell: GridCell, salt: number): void => {
    if (roadCellKeys.has(cellKey(cell))) return;
    const treeDensity = profile?.density.trees ?? 1;
    const bushDensity = profile?.density.bushes ?? 1;
    const bushShare = Math.round((100 * bushDensity) / Math.max(0.01, treeDensity + bushDensity));
    const asset =
      spatialHash(cell.x, cell.y, salt ^ 0x51b7) % 100 < bushShare
        ? "prp_bush"
        : TREE_ASSETS[spatialHash(cell.x, cell.y, salt) % TREE_ASSETS.length]!;
    const jitter = 0.9 + (spatialHash(cell.x, cell.y, salt ^ 0x9e37) % 31) / 100;
    decorations.push({ cell: { ...cell }, asset, scale: jitter });
  };

  const statusOf = (parcel: {
    id: string;
    buildingId: string | null;
    disposition?: "marketable" | "public" | "infrastructure";
  }): ParcelStatus =>
    parcel.disposition === "public"
      ? "public"
      : parcel.buildingId
        ? "built"
        : constructionParcelIds.has(parcel.id)
          ? "construction"
          : "vacant";

  // Árboles en solares vacíos (un jardín en el solar propio), sobre una celda real de la parcela.
  for (const parcel of [...parcels].sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x)) {
    if (statusOf(parcel) !== "vacant") continue;
    const salt = spatialHash(parcel.cell.x, parcel.cell.y, 0x1a2b);
    const density = Math.max(profile?.density.trees ?? 1, profile?.density.bushes ?? 1);
    if (salt % 100 >= Math.min(100, Math.round(45 * density))) continue;
    const cells = [...geometryCells(parcel)].sort((a, b) => a.y - b.y || a.x - b.x);
    pushVegetation(cells[salt % cells.length]!, 0x1a2b);
  }

  // Árboles dispersos en terreno libre, lejos de parcelas construidas.
  for (let y = 1; y < mapHeight - 1; y += 2) {
    for (let x = 1; x < mapWidth - 1; x += 2) {
      const cell = { x, y };
      const key = cellKey(cell);
      if (parcelCells.has(key) || blocked.has(key) || roadCellKeys.has(key)) continue;
      const density = Math.max(profile?.density.trees ?? 1, profile?.density.bushes ?? 1);
      if (spatialHash(x, y, 0x3c5d) % 100 >= Math.min(100, Math.round(10 * density))) continue;
      pushVegetation(cell, 0x3c5d);
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
 *
 * H2-01: la condición de "construida" se deriva del conjunto de `parcelId`s que aparecen en
 * `economy.buildings`, no de `parcel.buildingId`. `buildingId` sólo publica el primer edificio
 * derivado, así que una parcela multi-edificio cambiaría de clave si el orden de la colección
 * de edificios cambia sin que cambie el suelo. La clave debe detectar *cualquier* edificio.
 */
export function gameplayGeometryKey(projection: ViewProjectionV2): string {
  const economy = projection.economy;
  if (!economy) return `roads:${projection.map.roads.digest}`;
  const constructionParcelIds = new Set(
    economy.constructionSites.flatMap((site) => site.parcelIds),
  );
  const builtParcelIds = new Set(economy.buildings.flatMap((building) => building.parcelIds));
  const parts = economy.parcels
    .map((parcel) => {
      const status = builtParcelIds.has(parcel.id)
        ? "b"
        : constructionParcelIds.has(parcel.id)
          ? "c"
          : parcel.ownerOrganizationId
            ? "o"
            : "v";
      const cells = (parcel.cells ?? [parcel.cell])
        .map((cell) => `${cell.x},${cell.y}`)
        .sort()
        .join("+");
      return `${cells},${parcel.zoning},${parcel.disposition ?? "marketable"},${status}`;
    })
    .sort();
  return fnv1a32(`${projection.map.roads.digest}|${parts.join("|")}`).toString(16);
}

export function buildGameplayVisualModel(
  projection: ViewProjectionV2,
  mapWidth = projection.map.width,
  mapHeight = projection.map.height,
): GameplayVisualModel {
  const economy = projection.economy;
  const parcels = economy?.parcels ?? [];
  const roadVisuals = deriveRoadVisuals(projection.map.roads);
  const roadCellKeys = new Set(projection.map.roads.cells);
  const constructionParcelIds = new Set(
    (economy?.constructionSites ?? []).flatMap((site) => site.parcelIds),
  );
  // V.h.12: el perfil se resuelve antes de planificar capas para que todos los consumidores activos
  // lean exactamente la misma identidad visual del distrito observado.
  const districtProfile = districtVisualProfileFor(
    (projection.city?.districts ?? []).find(
      (district) => district.id === projection.observedDistrictId,
    )?.role,
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
    districtProfile,
  );
  const groundPlan = planGameplayGround(
    parcels,
    constructionParcelIds,
    mapWidth,
    mapHeight,
    roadCellKeys,
    deriveRoadMarkings(projection.map.roads),
    projection.publicSpaces,
  );
  groundPlan.treeCells = treeCells;
  const streetFurniture = planGameplayStreetFurniture(
    roadVisuals,
    parcels,
    constructionParcelIds,
    treeCells,
    mapWidth,
    mapHeight,
    districtProfile,
  );
  const contextBuildings = (economy?.buildings ?? []).map((building) => ({
    id: building.id,
    type: building.type,
    footprintCells: building.footprintCells ?? [],
  }));
  const contextVehicles = planGameplayContextVehicles(
    contextBuildings,
    roadVisuals,
    mapWidth,
    mapHeight,
  );
  const reservedVehicleRoads = new Set(contextVehicles.map((vehicle) => cellKey(vehicle.roadCell)));
  const ambientActors = planGameplayAmbientActors(
    projection.publicSpaces ?? [],
    roadCellKeys,
    mapWidth,
    mapHeight,
    districtProfile,
  );
  const contextActors = planGameplayContextActors(
    contextBuildings,
    roadVisuals,
    reservedVehicleRoads,
    mapWidth,
    mapHeight,
  );
  const reservedStreetLifeRoads = new Set([
    ...reservedVehicleRoads,
    ...contextActors.map((actor) => cellKey(actor.cell)),
  ]);
  const parkedVehicles = planGameplayParkedVehicles(
    roadVisuals,
    parcels,
    constructionParcelIds,
    treeCells,
    streetFurniture,
    mapWidth,
    mapHeight,
    reservedStreetLifeRoads,
    districtProfile,
  );
  const publicSpaceFurniture = planGameplayPublicSpaceFurniture(
    projection.publicSpaces ?? [],
    projection.facilities ?? [],
    economy?.buildings ?? [],
    roadCellKeys,
    mapWidth,
    mapHeight,
  );
  const parcelDressing = planGameplayParcelDressing(
    parcels,
    (economy?.buildings ?? []).map((building) => ({
      id: building.id,
      type: building.type,
      state: building.state,
      footprintCells: building.footprintCells,
    })),
    constructionParcelIds,
    roadCellKeys,
    mapWidth,
    mapHeight,
    districtProfile,
  );

  return {
    groundPlan,
    geometryKey: gameplayGeometryKey(projection),
    buildings: [...buildingVisuals, ...siteVisuals],
    decorations,
    streetFurniture,
    parkedVehicles,
    contextVehicles,
    ambientActors,
    contextActors,
    publicSpaceFurniture,
    parcelDressing,
    roadVisuals,
  };
}

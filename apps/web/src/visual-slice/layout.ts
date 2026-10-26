import type { BuildingAssetState, GridCell } from "@landlord/shared";

/**
 * Composición autoral de la microzona del Visual Slice (WP4.15-V). No genera ciudad ni toca la
 * simulación: es una capa de presentación que la escena de gameplay dibuja con su misma cámara,
 * grid y orden de profundidad. Las celdas se eligen a mano para que la lectura urbana sea la que
 * se quiere evaluar.
 */
export type SliceBuilding = {
  /** id del asset de arte (catálogo Kenney), no un tipo de la simulación. */
  type: string;
  cell: GridCell;
  state?: BuildingAssetState;
  flipX?: boolean;
};

export type SliceTerrain = {
  /** id del asset en `bundle.terrain`. */
  asset: string;
  cell: GridCell;
};

export type SliceProp = {
  /** id del asset en `bundle.props`. */
  asset: string;
  cell: GridCell;
  flipX?: boolean;
  /** Multiplicador de presentación sobre la escala física; lo pequeño debe seguir leyéndose. */
  scale?: number;
};

export type SliceVehicle = {
  /** id del asset en `bundle.vehicles`. */
  asset: string;
  cell: GridCell;
  flipX?: boolean;
};

export type SliceCharacter = {
  cell: GridCell;
  direction: 0 | 1 | 2 | 3;
};

export type VisualSliceLayout = {
  /** Celda sobre la que se centra la cámara en las capturas. */
  center: GridCell;
  terrain: SliceTerrain[];
  buildings: SliceBuilding[];
  props: SliceProp[];
  vehicles: SliceVehicle[];
  characters: SliceCharacter[];
};

/** Avenida vertical y calle horizontal: forman el cruce que estructura la microzona. */
export const AVENUE_X = 30;
export const STREET_Y = 30;
export const ZONE_FROM = 10;
export const ZONE_TO = 50;

function roadTiles(): SliceTerrain[] {
  const tiles: SliceTerrain[] = [];
  for (let y = ZONE_FROM; y <= ZONE_TO; y += 1) {
    if (y === STREET_Y) continue;
    tiles.push({ asset: "ter_road_straight", cell: { x: AVENUE_X, y } });
  }
  for (let x = ZONE_FROM; x <= ZONE_TO; x += 1) {
    if (x === AVENUE_X) continue;
    tiles.push({ asset: "ter_road_straight", cell: { x, y: STREET_Y } });
  }
  tiles.push({ asset: "ter_road_intersection", cell: { x: AVENUE_X, y: STREET_Y } });
  return tiles;
}

const BUILDINGS: SliceBuilding[] = [
  // Frente norte de la calle: pared urbana continua, con huecos para leer cada volumen.
  { type: "bld_shopfront", cell: { x: 21, y: 28 } },
  { type: "bld_commercial_b", cell: { x: 24, y: 28 }, flipX: true },
  { type: "bld_residential_a", cell: { x: 27, y: 28 } },
  { type: "bld_commercial_c", cell: { x: 33, y: 28 }, flipX: true },
  { type: "bld_residential_b", cell: { x: 36, y: 28 } },
  { type: "bld_residential_c", cell: { x: 39, y: 28 }, flipX: true },
  // Segunda fila: asoma entre los huecos y da silueta de barrio.
  { type: "bld_residential_c", cell: { x: 22, y: 24 }, flipX: true },
  { type: "bld_commercial_b", cell: { x: 25, y: 24 } },
  { type: "bld_shopfront", cell: { x: 35, y: 24 }, flipX: true },
  { type: "bld_residential_a", cell: { x: 38, y: 24 } },
  // Frente sur retirado: enmarca la avenida sin tapar la calle ni los coches.
  { type: "bld_commercial_c", cell: { x: 28, y: 33 }, flipX: true },
  { type: "bld_residential_b", cell: { x: 32, y: 33 } },
];

const PROPS: SliceProp[] = [
  // Arborado de fondo, agrupado y sin retícula.
  { asset: "prp_tree_pine", cell: { x: 19, y: 26 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 28, y: 26 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 34, y: 26 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 41, y: 27 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 20, y: 33 }, scale: 1.3 },
  // Parque del sureste.
  { asset: "prp_tree_detailed", cell: { x: 36, y: 35 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 38, y: 37 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 40, y: 35 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 35, y: 40 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 39, y: 40 }, scale: 1.3 },
  // Fondos de manzana: grupos, nunca una fila regular.
  { asset: "prp_tree_detailed", cell: { x: 20, y: 40 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 29, y: 40 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 26, y: 34 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 19, y: 37 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 23, y: 42 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 41, y: 22 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 43, y: 24 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 42, y: 33 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 43, y: 38 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 42, y: 42 }, scale: 1.3 },
  // Farolas sobre las aceras que dibuja la propia calle.
  { asset: "prp_street_light", cell: { x: 23, y: 29 }, scale: 1.8, flipX: true },
  { asset: "prp_street_light", cell: { x: 26, y: 29 }, scale: 1.8, flipX: true },
  { asset: "prp_street_light", cell: { x: 35, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 38, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 29, y: 22 }, scale: 1.8, flipX: true },
  { asset: "prp_street_light", cell: { x: 31, y: 26 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 29, y: 37 }, scale: 1.8, flipX: true },
  { asset: "prp_street_light", cell: { x: 31, y: 41 }, scale: 1.8 },
  // Semáforos en el cruce.
  { asset: "prp_traffic_light", cell: { x: 29, y: 29 }, scale: 2.0, flipX: true },
  { asset: "prp_traffic_light", cell: { x: 31, y: 31 }, scale: 2.0 },
  // Mobiliario de acera y parque.
  { asset: "prp_bench", cell: { x: 21, y: 31 }, scale: 2.0 },
  { asset: "prp_bench", cell: { x: 26, y: 31 }, scale: 2.0, flipX: true },
  { asset: "prp_bench", cell: { x: 37, y: 36 }, scale: 2.0 },
  { asset: "prp_bench", cell: { x: 39, y: 38 }, scale: 2.0, flipX: true },
  { asset: "prp_trash_can", cell: { x: 24, y: 31 }, scale: 1.6 },
  { asset: "prp_trash_can", cell: { x: 38, y: 40 }, scale: 1.6 },
  { asset: "prp_trash_can", cell: { x: 40, y: 36 }, scale: 1.6 },
  // Zona de obra junto al cruce: barreras y conos.
  { asset: "prp_construction_barrier", cell: { x: 34, y: 32 }, scale: 3.2 },
  { asset: "prp_construction_barrier", cell: { x: 35, y: 32 }, scale: 3.2 },
  { asset: "prp_construction_barrier", cell: { x: 36, y: 32 }, scale: 3.2, flipX: true },
  { asset: "prp_construction_cone", cell: { x: 35, y: 33 }, scale: 2.8 },
  { asset: "prp_construction_cone", cell: { x: 34, y: 34 }, scale: 2.8 },
  { asset: "prp_construction_cone", cell: { x: 36, y: 34 }, scale: 2.8 },
];

const VEHICLES: SliceVehicle[] = [
  { asset: "veh_sedan", cell: { x: 23, y: 30 } },
  { asset: "veh_truck", cell: { x: 27, y: 30 } },
  { asset: "veh_taxi", cell: { x: 35, y: 30 }, flipX: true },
  { asset: "veh_sedan", cell: { x: 39, y: 30 }, flipX: true },
  { asset: "veh_taxi", cell: { x: 30, y: 24 }, flipX: true },
  { asset: "veh_sedan", cell: { x: 30, y: 36 } },
];

const CHARACTERS: SliceCharacter[] = [
  { cell: { x: 31, y: 29 }, direction: 2 },
  { cell: { x: 29, y: 31 }, direction: 3 },
  { cell: { x: 34, y: 29 }, direction: 0 },
  { cell: { x: 25, y: 31 }, direction: 1 },
];

export const VISUAL_SLICE_LAYOUT: VisualSliceLayout = {
  center: { x: AVENUE_X, y: 29 },
  terrain: roadTiles(),
  buildings: BUILDINGS,
  props: PROPS,
  vehicles: VEHICLES,
  characters: CHARACTERS,
};

import type { BuildingAssetState, GridCell } from "@landlord/shared";

/**
 * Composición autoral de la microzona del Visual Slice (WP4.15-V.b). No genera ciudad ni toca la
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
  /** Multiplicador sólo para losetas procedurales que deben cubrir la celda completa. */
  scale?: number;
  /**
   * Espejo horizontal. El tile de calzada está renderizado a lo largo de +x; una calzada que corre
   * a lo largo de +y necesita el espejo para que bordillos y eje coincidan con la banda.
   */
  flipX?: boolean;
};

export type SliceProp = {
  /** id del asset en `bundle.props`. */
  asset: string;
  cell: GridCell;
  flipX?: boolean;
  /** Azimut de la variante de orientación; 45 por defecto. */
  azimuth?: number;
  /** Multiplicador de presentación sobre la escala física; lo pequeño debe seguir leyéndose. */
  scale?: number;
};

export type SliceVehicle = {
  /** id del asset en `bundle.vehicles`. */
  asset: string;
  cell: GridCell;
  flipX?: boolean;
  /** Azimut de la variante de orientación; 45 por defecto. */
  azimuth?: number;
  /** Desplazamiento en píxeles de pantalla para centrar el coche en su carril. */
  offset?: { x: number; y: number };
};

export type SliceCharacter = {
  cell: GridCell;
  direction: 0 | 1 | 2 | 3;
};

export type SliceLot = {
  /** Rectángulo inclusivo de celdas que forma la parcela (obra, solar, plaza). */
  from: GridCell;
  to: GridCell;
};

export type VisualSliceLayout = {
  /** Celda sobre la que se centra la cámara en las capturas. */
  center: GridCell;
  terrain: SliceTerrain[];
  buildings: SliceBuilding[];
  props: SliceProp[];
  vehicles: SliceVehicle[];
  characters: SliceCharacter[];
  /** Contornos de parcela dibujados como capa de presentación (no gameplay). */
  lots?: SliceLot[];
};

/** Cruce principal y malla secundaria: calle al norte y avenida al este. */
export const AVENUE_X = 30;
export const STREET_Y = 30;
export const SECOND_STREET_Y = 18;
export const EAST_AVENUE_X = 42;
export const ZONE_FROM = 4;
export const ZONE_TO = 56;

/** Bandas de calzada: las consume también el planificador de terreno (aceras, frentes, cruces). */
export const HORIZONTAL_STREETS = [6, SECOND_STREET_Y, STREET_Y, 42];
export const VERTICAL_AVENUES = [18, AVENUE_X, EAST_AVENUE_X, 54];

/** Solar en obra del bloque sureste: terreno, contorno y props; la mecánica se lee sin UI. */
export const WORKS_LOT = { from: { x: 33, y: 34 }, to: { x: 36, y: 37 } };

export function roadCells(): Set<string> {
  const cells = new Set<string>();
  for (const y of HORIZONTAL_STREETS) {
    for (let x = ZONE_FROM; x <= ZONE_TO; x += 1) cells.add(`${x}:${y}`);
  }
  for (const x of VERTICAL_AVENUES) {
    for (let y = ZONE_FROM; y <= ZONE_TO; y += 1) cells.add(`${x}:${y}`);
  }
  return cells;
}

function roadTiles(): SliceTerrain[] {
  const tiles: SliceTerrain[] = [];
  const intersections = new Set<string>();
  for (const y of HORIZONTAL_STREETS) {
    for (const x of VERTICAL_AVENUES) intersections.add(`${x}:${y}`);
  }
  for (const y of HORIZONTAL_STREETS) {
    for (let x = ZONE_FROM; x <= ZONE_TO; x += 1) {
      if (VERTICAL_AVENUES.includes(x)) continue;
      tiles.push({ asset: "ter_road_straight", cell: { x, y } });
    }
  }
  for (const x of VERTICAL_AVENUES) {
    for (let y = ZONE_FROM; y <= ZONE_TO; y += 1) {
      if (HORIZONTAL_STREETS.includes(y)) continue;
      tiles.push({ asset: "ter_road_straight", cell: { x, y } });
    }
  }
  for (const value of intersections) {
    const [x, y] = value.split(":").map(Number) as [number, number];
    tiles.push({ asset: "ter_road_intersection", cell: { x, y } });
  }
  return tiles;
}

function worksLotTiles(): SliceTerrain[] {
  const tiles: SliceTerrain[] = [];
  for (let y = WORKS_LOT.from.y; y <= WORKS_LOT.to.y; y += 1) {
    for (let x = WORKS_LOT.from.x; x <= WORKS_LOT.to.x; x += 1) {
      tiles.push({
        asset: (x + y) % 2 === 0 ? "ter_lot_dirt_a" : "ter_lot_dirt_b",
        cell: { x, y },
        scale: 1.05,
      });
    }
  }
  return tiles;
}

const BUILDINGS: SliceBuilding[] = [
  // === PRIMARY FRONTAGE: Avenida principal x=30 (oeste, x=28) ===
  { type: "bld_shopfront", cell: { x: 28, y: 20 } },
  { type: "bld_commercial_b", cell: { x: 28, y: 24 } },
  { type: "bld_commercial_c", cell: { x: 28, y: 28 } },
  { type: "bld_shopfront", cell: { x: 28, y: 32 } },
  { type: "bld_commercial_b", cell: { x: 28, y: 36 } },
  { type: "bld_commercial_c", cell: { x: 28, y: 40 } },

  // === PRIMARY FRONTAGE: Avenida principal x=42 (este, x=40) ===
  { type: "bld_commercial_c", cell: { x: 40, y: 20 } },
  { type: "bld_shopfront", cell: { x: 40, y: 24 } },
  { type: "bld_commercial_b", cell: { x: 40, y: 28 } },
  { type: "bld_commercial_c", cell: { x: 40, y: 32 } },
  { type: "bld_shopfront", cell: { x: 40, y: 36 } },
  { type: "bld_commercial_b", cell: { x: 40, y: 40 } },

  // === SECONDARY STREET: Calle principal y=30 (norte, y=28) ===
  { type: "bld_shopfront", cell: { x: 20, y: 28 } },
  { type: "bld_commercial_b", cell: { x: 24, y: 28 } },
  { type: "bld_residential_a", cell: { x: 34, y: 28 } },
  { type: "bld_residential_b", cell: { x: 38, y: 28 } },

  // === SECONDARY STREET: Calle principal y=30 (sur, y=32) ===
  { type: "bld_residential_c", cell: { x: 22, y: 32 } },
  { type: "bld_commercial_c", cell: { x: 26, y: 32 } },
  { type: "bld_residential_a", cell: { x: 36, y: 32 } },
  { type: "bld_residential_b", cell: { x: 44, y: 32 } },

  // === SECONDARY STREET: Calle secundaria y=18 (norte, y=16) ===
  { type: "bld_residential_a", cell: { x: 20, y: 16 } },
  { type: "bld_residential_b", cell: { x: 24, y: 16 } },
  { type: "bld_shopfront", cell: { x: 34, y: 16 } },
  { type: "bld_residential_c", cell: { x: 38, y: 16 } },

  // === SECONDARY STREET: Calle secundaria y=18 (sur, y=20) ===
  { type: "bld_residential_b", cell: { x: 22, y: 20 } },
  { type: "bld_residential_c", cell: { x: 26, y: 20 } },
  { type: "bld_residential_a", cell: { x: 36, y: 20 } },
  { type: "bld_shopfront", cell: { x: 48, y: 20 } },

  // === TERTIARY STREET: y=6 (norte extremo, y=4) ===
  { type: "bld_residential_a", cell: { x: 22, y: 4 } },
  { type: "bld_residential_b", cell: { x: 28, y: 4 } },
  { type: "bld_residential_c", cell: { x: 34, y: 4 } },
  { type: "bld_residential_a", cell: { x: 40, y: 4 } },

  // === TERTIARY STREET: y=42 (sur extremo, y=40) ===
  { type: "bld_residential_b", cell: { x: 24, y: 40 } },
  { type: "bld_residential_c", cell: { x: 32, y: 40 } },
  { type: "bld_residential_a", cell: { x: 36, y: 40 } },
  { type: "bld_residential_b", cell: { x: 44, y: 40 } },

  // === TERTIARY STREET: x=18 (oeste extremo, x=16) ===
  { type: "bld_residential_c", cell: { x: 16, y: 22 } },
  { type: "bld_residential_a", cell: { x: 16, y: 28 } },
  { type: "bld_residential_b", cell: { x: 16, y: 34 } },
  { type: "bld_residential_c", cell: { x: 16, y: 40 } },

  // === TERTIARY STREET: x=54 (este extremo, x=52) ===
  { type: "bld_residential_a", cell: { x: 52, y: 24 } },
  { type: "bld_residential_b", cell: { x: 52, y: 28 } },
  { type: "bld_residential_c", cell: { x: 52, y: 36 } },
  { type: "bld_residential_a", cell: { x: 52, y: 44 } },

  // === SECOND ROW: profundidad detrás de fachada principal ===
  { type: "bld_residential_b", cell: { x: 25, y: 23 } },
  { type: "bld_residential_c", cell: { x: 35, y: 23 } },
  { type: "bld_residential_a", cell: { x: 25, y: 37 } },
  { type: "bld_residential_b", cell: { x: 35, y: 39 } },

  // === THIRD ROW: más profundidad ===
  { type: "bld_residential_c", cell: { x: 22, y: 22 } },
  { type: "bld_residential_a", cell: { x: 38, y: 22 } },
  { type: "bld_residential_b", cell: { x: 22, y: 38 } },
  { type: "bld_residential_c", cell: { x: 38, y: 38 } },

  // === FOURTH ROW: bloques adicionales ===
  { type: "bld_residential_a", cell: { x: 14, y: 14 } },
  { type: "bld_residential_b", cell: { x: 20, y: 14 } },
  { type: "bld_residential_c", cell: { x: 44, y: 14 } },
  { type: "bld_residential_a", cell: { x: 50, y: 14 } },
  { type: "bld_residential_b", cell: { x: 14, y: 46 } },
  { type: "bld_residential_c", cell: { x: 20, y: 46 } },
  { type: "bld_residential_a", cell: { x: 44, y: 46 } },
  { type: "bld_residential_b", cell: { x: 50, y: 46 } },
  { type: "bld_residential_c", cell: { x: 10, y: 28 } },
  { type: "bld_residential_a", cell: { x: 46, y: 32 } },
];

const PROPS: SliceProp[] = [
  // Arborado de fondo, en grupos irregulares.
  { asset: "prp_tree_pine", cell: { x: 14, y: 22 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 19, y: 24 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 23, y: 22 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 27, y: 20 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 33, y: 21 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 39, y: 21 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 45, y: 26 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 45, y: 33 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 45, y: 43 }, scale: 1.3 },
  // Parque del suroeste, en el interior de la manzana.
  { asset: "prp_tree_oak", cell: { x: 19, y: 34 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 21, y: 37 }, scale: 1.3 },
  { asset: "prp_tree_pine", cell: { x: 19, y: 41 }, scale: 1.3 },
  { asset: "prp_tree_oak", cell: { x: 24, y: 43 }, scale: 1.3 },
  { asset: "prp_tree_detailed", cell: { x: 26, y: 38 }, scale: 1.3 },
  // Farolas sobre las aceras de la calle y la avenida principales.
  { asset: "prp_street_light", cell: { x: 19, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 23, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 27, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 34, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 38, y: 29 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 29, y: 22 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 29, y: 36 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 31, y: 26 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 31, y: 39 }, scale: 1.8 },
  { asset: "prp_street_light", cell: { x: 41, y: 20 }, scale: 1.8 },
  // Semáforos: cara visible (azimut 225) en los cruces.
  { asset: "prp_traffic_light", cell: { x: 29, y: 29 }, azimuth: 225, scale: 2.0 },
  {
    asset: "prp_traffic_light",
    cell: { x: 31, y: 31 },
    azimuth: 225,
    scale: 2.0,
  },
  { asset: "prp_traffic_light", cell: { x: 41, y: 29 }, azimuth: 225, scale: 2.0 },
  {
    asset: "prp_traffic_light",
    cell: { x: 29, y: 17 },
    azimuth: 225,
    scale: 2.0,
  },
  // Mobiliario de acera y parque.
  { asset: "prp_bench", cell: { x: 24, y: 31 }, scale: 2.0 },
  { asset: "prp_bench", cell: { x: 19, y: 36 }, scale: 2.0 },
  { asset: "prp_bench", cell: { x: 23, y: 41 }, scale: 2.0 },
  { asset: "prp_trash_can", cell: { x: 26, y: 31 }, scale: 1.6 },
  { asset: "prp_trash_can", cell: { x: 20, y: 39 }, scale: 1.6 },
  { asset: "prp_trash_can", cell: { x: 44, y: 36 }, scale: 1.6 },
  // Obra: barreras al norte del solar, conos y camión dentro.
  { asset: "prp_construction_barrier", cell: { x: 33, y: 34 }, scale: 3.2 },
  { asset: "prp_construction_barrier", cell: { x: 34, y: 34 }, scale: 3.2 },
  { asset: "prp_construction_barrier", cell: { x: 35, y: 34 }, scale: 3.2 },
  { asset: "prp_construction_barrier", cell: { x: 36, y: 34 }, scale: 3.2 },
  { asset: "prp_construction_cone", cell: { x: 33, y: 36 }, scale: 2.8 },
  { asset: "prp_construction_cone", cell: { x: 35, y: 36 }, scale: 2.8 },
  { asset: "prp_construction_cone", cell: { x: 34, y: 37 }, scale: 2.8 },
  { asset: "prp_construction_cone", cell: { x: 36, y: 37 }, scale: 2.8 },
];

const VEHICLES: SliceVehicle[] = [
  // Calle principal: carril derecho según el sentido (offsets de presentación).
  { asset: "veh_sedan", cell: { x: 21, y: 30 }, offset: { x: -8, y: 4 } },
  { asset: "veh_truck", cell: { x: 26, y: 30 }, offset: { x: -8, y: 4 } },
  {
    asset: "veh_taxi",
    cell: { x: 35, y: 30 },
    azimuth: 225,
    offset: { x: 8, y: -4 },
  },
  {
    asset: "veh_sedan",
    cell: { x: 39, y: 30 },
    azimuth: 225,
    offset: { x: 8, y: -4 },
  },
  // Avenida principal.
  { asset: "veh_taxi", cell: { x: 30, y: 24 }, offset: { x: -8, y: -4 } },
  { asset: "veh_sedan", cell: { x: 30, y: 37 }, azimuth: 225, offset: { x: 8, y: 4 } },
  // Camión parado en el solar, fuera de la calzada.
  { asset: "veh_truck", cell: { x: 35, y: 35 }, azimuth: 225 },
];

const CHARACTERS: SliceCharacter[] = [
  { cell: { x: 31, y: 29 }, direction: 2 },
  { cell: { x: 29, y: 31 }, direction: 3 },
  { cell: { x: 34, y: 29 }, direction: 0 },
  { cell: { x: 25, y: 31 }, direction: 1 },
];

export const VISUAL_SLICE_LAYOUT: VisualSliceLayout = {
  center: { x: AVENUE_X, y: 29 },
  terrain: [...roadTiles(), ...worksLotTiles()],
  buildings: BUILDINGS,
  props: PROPS,
  vehicles: VEHICLES,
  characters: CHARACTERS,
  lots: [WORKS_LOT],
};

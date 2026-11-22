/**
 * Geometría de la calle de pruebas (D-111 §7): acera, calzada, edificios, farolas y vegetación.
 *
 * Los edificios, farolas y árboles son los sprites RELES prerenderizados del catálogo Blender
 * (con su luz y sombra horneadas), porque el experimento de bloom y de luz dinámica sólo vale si se
 * mide sobre material con bake. El suelo de acera se pinta con rombos isométricos de color mate
 * plano: si llevara también luz horneada, el umbral de bloom no podría distinguirse del propio suelo
 * y el A/B dejaría de ser interpretable.
 */
import type { BuildingAssetState } from "@landlord/shared";
import { REFERENCE_LAYOUT, gridToScreen } from "../isometric/coordinates";
import {
  depthForAsset,
  depthForCell,
  originFromPivot,
  spriteScaleFor,
} from "../isometric/building-sprites";
import {
  projectBuildingCondition,
  type BuildingConditionInput,
} from "../isometric/building-condition";
import type { IsometricLayout } from "../isometric/coordinates";
import blenderBundle from "../generated/runtime-assets-blender.json";
import { parseRuntimeAssetManifest, type RuntimeAssetManifestV2 } from "@landlord/shared";

const BLENDER = parseRuntimeAssetManifest(blenderBundle) as RuntimeAssetManifestV2;

export const EMISSIVE_DEPTH_OFFSET = 4;

export type Cell = { x: number; y: number };

/**
 * Escenario de la calle de pruebas. O los tres campos de conservación que ya viajan en la proyección
 * de vista, o la obra (`construction` es otra entidad de dominio —`ConstructionSite`— y no tiene
 * `condition`: se coloca por su `progress`).
 */
export type BuildingScenario = BuildingConditionInput | "construction";

export type BuildingPlacement = {
  readonly key: string;
  readonly type: string;
  /** Derivado por `projectBuildingCondition`: nadie escribe el sprite a mano (contrato de weathering → visualStates; cierre FASE 4). */
  readonly state: BuildingAssetState;
  readonly scenario: BuildingScenario;
  readonly cell: Cell;
  readonly scale: number;
  /** Semientidad luminosa extraída del bake: 0 apaga la capa emisiva de este edificio. */
  readonly emissiveBoost: number;
};

type PlacementSeed = Omit<BuildingPlacement, "state">;

/** Ruta experimental de selección: escenario de dominio → sprite del catálogo. */
function select(seed: PlacementSeed): BuildingPlacement {
  if (seed.scenario === "construction") return { ...seed, state: "construction" };
  /** La proyección llama `assetState` a la clave del catálogo; extenderla tal cual dejaba `state` vacío. */
  return { ...seed, state: projectBuildingCondition(seed.scenario).assetState };
}

/**
 * Types reales del juego que se usan aquí, sin inventar ninguno:
 * - `row_house` / `mixed_tenement` / `cement_plant`: tipos de edificio del catálogo Blender.
 * - `bld_*`: módulos 1×1 del Composer, los únicos que tienen horneados los cuatro estados de
 *   `BuildingAssetState`, así que permiten enseñar `construction`, `damaged` y `burning` en la misma
 *   calle sin regenerar nada.
 * - `cement_plant` hace de planta de producción: el humo industrial se deriva de
 *   `ProductionFacility.operational`, no de un flag nuevo.
 *
 * Los `condition`/`structuralIntegrity` son los del escenario QA que se fotografía, no datos de una
 * partida: la calle no lee `GameState`. `back-mixed_tenement` (48/76) es el caso que antes se pintaba
 * como ruina: con estructura en pie proyecta `aged`, cuyo sprite es el mismo `complete` porque el
 * envejecimiento del contrato no mueve geometría.
 */
export const BUILDING_PLACEMENTS: readonly BuildingPlacement[] = [
  select({
    key: "back-row_house",
    type: "row_house",
    scenario: { state: "operational", condition: 92, structuralIntegrity: 100 },
    cell: { x: 0, y: 3 },
    scale: 1,
    emissiveBoost: 1,
  }),
  select({
    key: "back-mixed_tenement",
    type: "mixed_tenement",
    scenario: { state: "operational", condition: 48, structuralIntegrity: 76 },
    cell: { x: 4, y: 2 },
    scale: 1,
    emissiveBoost: 1.15,
  }),
  select({
    key: "back-cement_plant",
    type: "cement_plant",
    scenario: { state: "operational", condition: 88, structuralIntegrity: 100 },
    cell: { x: 8, y: 2 },
    scale: 1,
    emissiveBoost: 0.8,
  }),
  select({
    key: "front-shopfront",
    type: "bld_shopfront",
    scenario: { state: "operational", condition: 100, structuralIntegrity: 100 },
    cell: { x: 0, y: 9 },
    scale: 1.6,
    emissiveBoost: 1.5,
  }),
  select({
    key: "front-residential",
    type: "bld_residential_a",
    scenario: "construction",
    cell: { x: 2, y: 9 },
    scale: 1.6,
    emissiveBoost: 0,
  }),
  select({
    key: "front-commercial",
    type: "bld_commercial_b",
    scenario: { state: "operational", condition: 74, structuralIntegrity: 90 },
    cell: { x: 4, y: 9 },
    scale: 1.6,
    emissiveBoost: 1.4,
  }),
  select({
    key: "front-damaged",
    type: "bld_residential_c",
    scenario: { state: "ruin", condition: 35, structuralIntegrity: 0 },
    cell: { x: 6, y: 9 },
    scale: 1.6,
    emissiveBoost: 0.55,
  }),
  select({
    key: "front-burning",
    type: "bld_commercial_c",
    scenario: { state: "burning", condition: 40, structuralIntegrity: 0 },
    cell: { x: 8, y: 9 },
    scale: 1.6,
    emissiveBoost: 2.1,
  }),
];

/** Farolas sobre la acera cercana (fila 8): es la que ilumina fachadas de la fila 9 y la calzada. */
export const LAMP_CELLS: readonly Cell[] = [
  { x: 1, y: 8 },
  { x: 4, y: 8 },
  { x: 7, y: 8 },
  { x: 10, y: 8 },
];

export const TREE_CELLS: readonly { cell: Cell; type: string }[] = [
  { cell: { x: 2, y: 5 }, type: "prp_tree_oak" },
  { cell: { x: 6, y: 5 }, type: "prp_tree_pine" },
  { cell: { x: 11, y: 5 }, type: "prp_tree_oak" },
];

export const BUSH_CELLS: readonly Cell[] = [
  { x: 3, y: 5 },
  { x: 8, y: 5 },
  { x: 9, y: 5 },
];

/** Vestuario de obra: corresponde al estado `construction`, no a un estado nuevo de dominio. */
export const WORK_CELLS: readonly { cell: Cell; type: string }[] = [
  { cell: { x: 1, y: 9 }, type: "prp_construction_barrier" },
  { cell: { x: 3, y: 9 }, type: "prp_construction_barrier" },
  { cell: { x: 2, y: 8 }, type: "prp_construction_cone" },
];

export type PlacedSprite = {
  readonly sprite: Phaser.GameObjects.Image;
  readonly cell: Cell;
  readonly key: string;
};

export type StreetPalette = {
  readonly lot: number;
  readonly sidewalk: number;
  readonly kerb: number;
  readonly asphalt: number;
  readonly marking: number;
};

export const DAY_PALETTE: StreetPalette = {
  lot: 0x6f6a5c,
  sidewalk: 0x9a9384,
  kerb: 0xb4ac9a,
  asphalt: 0x4d4f52,
  marking: 0xc9b46a,
};

export const NIGHT_PALETTE: StreetPalette = {
  lot: 0x3b3a37,
  sidewalk: 0x53514c,
  kerb: 0x63605a,
  asphalt: 0x2a2c31,
  marking: 0x7d7350,
};

const ROAD_ROWS = [6, 7] as const;
const SIDEWALK_ROWS = [5, 8] as const;
const LOT_ROWS = [2, 3, 4, 9, 10, 11] as const;
const STREET_COLUMNS = 13;

function diamond(
  graphics: Phaser.GameObjects.Graphics,
  layout: IsometricLayout,
  cell: Cell,
  color: number,
  alpha: number,
): void {
  const n = gridToScreen(cell, layout);
  const e = gridToScreen({ x: cell.x + 1, y: cell.y }, layout);
  const s = gridToScreen({ x: cell.x + 1, y: cell.y + 1 }, layout);
  const w = gridToScreen({ x: cell.x, y: cell.y + 1 }, layout);
  graphics.fillStyle(color, alpha);
  graphics.beginPath();
  graphics.moveTo(n.x, n.y);
  graphics.lineTo(e.x, e.y);
  graphics.lineTo(s.x, s.y);
  graphics.lineTo(w.x, w.y);
  graphics.closePath();
  graphics.fillPath();
}

/** Relleno del suelo: solar → acera → calzada → acera → solar, más la línea discontinua central. */
export function paintGround(
  scene: Phaser.Scene,
  palette: StreetPalette,
  layout: IsometricLayout = REFERENCE_LAYOUT,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  graphics.setDepth(-1_000_000);
  for (const row of LOT_ROWS) {
    for (let x = 0; x < STREET_COLUMNS; x += 1)
      diamond(graphics, layout, { x, y: row }, palette.lot, 1);
  }
  for (const row of SIDEWALK_ROWS) {
    for (let x = 0; x < STREET_COLUMNS; x += 1) {
      diamond(graphics, layout, { x, y: row }, palette.sidewalk, 1);
      /** El borde del bordillo se insinúa con un rombo más claro y angosto: silueta, no detalle. */
      diamond(graphics, layout, { x, y: row }, palette.kerb, 0.25);
    }
  }
  for (const row of ROAD_ROWS) {
    for (let x = 0; x < STREET_COLUMNS; x += 1)
      diamond(graphics, layout, { x, y: row }, palette.asphalt, 1);
  }
  for (let x = 0; x < STREET_COLUMNS; x += 2) {
    const c = gridToScreen({ x: x + 0.5, y: (ROAD_ROWS[0] + ROAD_ROWS[1]) / 2 + 0.5 }, layout);
    const d = gridToScreen({ x: x + 1.0, y: (ROAD_ROWS[0] + ROAD_ROWS[1]) / 2 + 0.5 }, layout);
    graphics.lineStyle(3, palette.marking, 0.75);
    graphics.beginPath();
    graphics.moveTo(c.x, c.y);
    graphics.lineTo(d.x, d.y);
    graphics.strokePath();
  }
  return graphics;
}

export function assetSrc(id: string): string | null {
  const building = BLENDER.buildings[id];
  if (building) return building.states.complete?.src ?? null;
  const prop = BLENDER.props?.[id];
  if (prop) return prop.image.src;
  const terrain = BLENDER.terrain?.[id];
  if (terrain) return terrain.image.src;
  return null;
}

export function buildingSrc(type: string, state: BuildingAssetState): string | null {
  return BLENDER.buildings[type]?.states[state]?.src ?? null;
}

/**
 * Metadatos de presentación de un tipo de edificio, leídos del manifiesto Blender: huella en celdas,
 * pivote normalizado y la escala que lleva el render de Blender a la celda isométrica de 4 m.
 * Se resuelven una vez al colocar la escena, nunca por frame.
 */
export function buildingMetadata(
  type: string,
  layout: IsometricLayout = REFERENCE_LAYOUT,
): {
  footprint: { width: number; height: number };
  pivot: { x: number; y: number };
  scale: number;
} | null {
  const asset = BLENDER.buildings[type];
  if (!asset) return null;
  return {
    footprint: { width: asset.footprint.width, height: asset.footprint.height },
    pivot: { x: asset.pivot.x, y: asset.pivot.y },
    scale: spriteScaleFor(asset, layout.tileWidth),
  };
}

export function propSrc(id: string): string | null {
  return BLENDER.props?.[id]?.image.src ?? null;
}

/** Claves de textura que la escena necesita: todos los estados pedidos de cada edificio colocado. */
export function requiredTextureKeys(): string[] {
  const keys = new Set<string>();
  for (const placement of BUILDING_PLACEMENTS) {
    if (buildingSrc(placement.type, placement.state)) keys.add(placement.type);
  }
  for (const lamp of LAMP_CELLS) void lamp;
  for (const tree of TREE_CELLS) if (assetSrc(tree.type)) keys.add(tree.type);
  for (const work of WORK_CELLS) if (assetSrc(work.type)) keys.add(work.type);
  for (const id of ["prp_street_light", "prp_bush", "prp_bollard", "ter_road_straight"]) {
    if (assetSrc(id)) keys.add(id);
  }
  return [...keys];
}

export function textureKeyForBuilding(type: string, state: BuildingAssetState): string {
  return `fx-${type}-${state}`;
}

/** Coloca un sprite del catálogo sobre una celda con el depth isométrico correcto. */
export function placeScenery(
  scene: Phaser.Scene,
  layout: IsometricLayout,
  textureKey: string,
  cell: Cell,
  extraDepth = 0,
  scaleBoost = 1,
): Phaser.GameObjects.Image | null {
  const asset = BLENDER.props?.[textureKey.replace(/^fx-/, "")];
  if (!scene.textures.exists(textureKey)) return null;
  const center = gridToScreen(cell, layout);
  const image = scene.add.image(center.x, center.y, textureKey);
  const declared = asset ? spriteScaleFor(asset, layout.tileWidth) : 1;
  image.setScale(declared * scaleBoost);
  if (asset) {
    const origin = originFromPivot(asset);
    image.setOrigin(origin.x, origin.y);
  } else {
    image.setOrigin(0.5, 0.85);
  }
  image.setDepth(depthForCell(cell) + extraDepth);
  return image;
}

export { BLENDER, depthForAsset, REFERENCE_LAYOUT, gridToScreen };

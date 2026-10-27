import type { GridCell } from "@landlord/shared";
import {
  HORIZONTAL_STREETS,
  VERTICAL_AVENUES,
  WORKS_LOT,
  ZONE_FROM,
  ZONE_TO,
  type SliceBuilding,
  type VisualSliceLayout,
} from "./layout";

/**
 * Lenguaje visual del suelo (WP4.15-V.b0). Es una capa de presentación: clasifica cada celda de la
 * composición en una superficie y expone los elementos que el pintado necesita (cruces, arbolado,
 * obra). No genera ciudad, no añade edificios y no toca la simulación: el grid del motor sigue
 * siendo autoritativo y aquí sólo se describe cómo se ve el suelo bajo esa misma cuadrícula.
 */
export const GROUND_SURFACES = [
  "urban",
  "grass",
  "dirt",
  "gravel",
  "pavement",
  "asphalt",
  "construction",
] as const;

export type GroundSurface = (typeof GROUND_SURFACES)[number];

export function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

/**
 * Hash espacial determinista. Todo el dressing del suelo deriva de aquí, así que la misma
 * composición produce siempre el mismo barrio y las capturas del gate son reproducibles.
 */
export function hashCell(x: number, y: number, salt: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Ruido de valor bilineal sobre una retícula gruesa. Devuelve manchas continuas de 3-5 celdas: un
 * hash por celda produce camuflaje, que es exactamente el aspecto de editor de tiles que se evita.
 */
export function field(x: number, y: number, scale: number, salt: number): number {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const corner = (ix: number, iy: number): number => hashCell(ix, iy, salt) / 4294967295;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = corner(x0, y0) * (1 - sx) + corner(x0 + 1, y0) * sx;
  const bottom = corner(x0, y0 + 1) * (1 - sx) + corner(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Zonas verdes y solares sin edificar. Suelo, no gameplay: no producen rentabilidad ni densidad. */
export type OpenSpace = {
  id: string;
  from: GridCell;
  to: GridCell;
  kind: "park" | "vacant";
};

/**
 * Zonas verdes y solares sin edificar. Suelo, no gameplay: no producen rentabilidad ni densidad.
 * Su superficie deja banda suficiente alrededor de cada fila de edificios para que el solar propio
 * (jardín o explanada) se lea por separado de la plaza pública.
 */
export const OPEN_SPACES: readonly OpenSpace[] = [
  { id: "park_north_west", from: { x: 8, y: 8 }, to: { x: 12, y: 12 }, kind: "park" },
  { id: "park_north_east", from: { x: 48, y: 8 }, to: { x: 52, y: 12 }, kind: "park" },
  { id: "park_south", from: { x: 8, y: 48 }, to: { x: 12, y: 52 }, kind: "park" },
  { id: "park_east", from: { x: 56, y: 48 }, to: { x: 60, y: 52 }, kind: "park" },
  { id: "lot_vacant_west", from: { x: 13, y: 32 }, to: { x: 15, y: 34 }, kind: "vacant" },
  { id: "lot_vacant_south", from: { x: 46, y: 46 }, to: { x: 48, y: 48 }, kind: "vacant" },
];

/** franja de acceso de la obra: entrada de rodadura desde la calle hasta el solar. */
export const CONSTRUCTION_ACCESS = { from: { x: 34, y: 31 }, to: { x: 35, y: 33 } };

/** Celdas que se leen como solar del edificio a partir de su huella: jardín o explanada. */
const LOT_RADIUS = 3;

/** Un solar residencial o comercial: determina qué superficie recibe el edificio y su trasera. */
export function lotRole(type: string): "residential" | "commercial" {
  return type.includes("residential") ? "residential" : "commercial";
}

export type GroundPlan = {
  surfaces: Map<string, GroundSurface>;
  /** Encrucijadas donde tiene sentido un paso de peatones. Vacío sin topología vial. */
  crossings: GridCell[];
  /** Parques del plan: el pintado los usa para trazar caminos de tierra. */
  parks: OpenSpace[];
  treeCells: GridCell[];
  binCells: GridCell[];
  benchCells: GridCell[];
  zoneCenter: GridCell;
  /**
   * Campos propios de la composición autoral del Visual Slice. El plan de gameplay se alimenta de
   * estado real y no los declara: el pintado los trata como opcionales y omite la rodera de acceso
   * y el solar de obra cuando no existen.
   */
  worksLot?: { from: GridCell; to: GridCell };
  access?: { from: GridCell; to: GridCell };
  zone?: { from: GridCell; to: GridCell };
};

function inRect(cell: GridCell, rect: { from: GridCell; to: GridCell }): boolean {
  return (
    cell.x >= rect.from.x && cell.x <= rect.to.x && cell.y >= rect.from.y && cell.y <= rect.to.y
  );
}

function isRoad(cell: GridCell): boolean {
  return (
    HORIZONTAL_STREETS.includes(cell.y) ||
    (VERTICAL_AVENUES.includes(cell.x) && cell.x >= ZONE_FROM && cell.x <= ZONE_TO)
  );
}

function streetDistance(cell: GridCell): number {
  return Math.min(...HORIZONTAL_STREETS.map((street) => Math.abs(cell.y - street)));
}

function avenueDistance(cell: GridCell): number {
  return Math.min(...VERTICAL_AVENUES.map((avenue) => Math.abs(cell.x - avenue)));
}

/** Distancia a la calzada más próxima: 0 = asfalto, 1 = acera, 2 = frente de parcela. */
function roadDistance(cell: GridCell): number {
  return Math.min(streetDistance(cell), avenueDistance(cell));
}

function inZone(cell: GridCell): boolean {
  return cell.x >= ZONE_FROM && cell.x <= ZONE_TO && cell.y >= ZONE_FROM && cell.y <= ZONE_TO;
}

/** Celdas de separación respecto al rectángulo urbanizado: 0 dentro, 1 en la corona inmediata. */
function zoneDistance(cell: GridCell): number {
  const dx = cell.x < ZONE_FROM ? ZONE_FROM - cell.x : cell.x > ZONE_TO ? cell.x - ZONE_TO : 0;
  const dy = cell.y < ZONE_FROM ? ZONE_FROM - cell.y : cell.y > ZONE_TO ? cell.y - ZONE_TO : 0;
  return Math.max(dx, dy);
}

/** Celda hacia el interior de la manzana, es decir alejándose de la calzada que da frente. */
function awayFromStreet(cell: GridCell): GridCell {
  if (streetDistance(cell) <= avenueDistance(cell)) {
    const street = HORIZONTAL_STREETS.reduce((best, s) =>
      Math.abs(cell.y - s) < Math.abs(cell.y - best) ? s : best,
    );
    return { x: cell.x, y: cell.y + (cell.y < street ? -1 : 1) };
  }
  const avenue = VERTICAL_AVENUES.reduce((best, a) =>
    Math.abs(cell.x - a) < Math.abs(cell.x - best) ? a : best,
  );
  return { x: cell.x + (cell.x < avenue ? -1 : 1), y: cell.y };
}

/**
 * Superficie de manzana: cada edificio arrastra su propia parcela — jardín en residencial, pavimento
 * en comercial. Sin esto los edificios quedan plantados sobre terreno genérico y el barrio se lee
 * como una cuadrícula con objetos encima, que es justo lo que evalúa el gate.
 */
function blockSurface(layout: VisualSliceLayout, cell: GridCell): GroundSurface {
  let nearest: SliceBuilding | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const building of layout.buildings) {
    const distance = Math.max(
      Math.abs(building.cell.x - cell.x),
      Math.abs(building.cell.y - cell.y),
    );
    if (distance < best) {
      best = distance;
      nearest = building;
    }
  }
  if (!nearest || best > LOT_RADIUS) return "urban";
  if (lotRole(nearest.type) === "commercial") return "pavement";
  /** Vivienda: apero de grava pegado a la casa y jardín detrás, para que cada solar se lea aparte. */
  return best <= 1 ? "gravel" : "grass";
}

export function planGround(layout: VisualSliceLayout, mapWidth = 64, mapHeight = 64): GroundPlan {
  const buildings = new Map<string, "residential" | "commercial">();
  for (const building of layout.buildings)
    buildings.set(cellKey(building.cell), lotRole(building.type));
  const reserved = new Set(buildings.keys());
  const surfaces = new Map<string, GroundSurface>();
  const plan: GroundPlan = {
    surfaces,
    crossings: [],
    parks: OPEN_SPACES.filter((space) => space.kind === "park"),
    treeCells: [],
    binCells: [],
    benchCells: [],
    worksLot: WORKS_LOT,
    access: CONSTRUCTION_ACCESS,
    zone: { from: { x: ZONE_FROM, y: ZONE_FROM }, to: { x: ZONE_TO, y: ZONE_TO } },
    zoneCenter: { x: (ZONE_FROM + ZONE_TO) / 2, y: (ZONE_FROM + ZONE_TO) / 2 },
  };

  for (const prop of layout.props) {
    if (
      prop.asset === "prp_tree_oak" ||
      prop.asset === "prp_tree_pine" ||
      prop.asset === "prp_tree_detailed"
    )
      plan.treeCells.push(prop.cell);
    if (prop.asset === "prp_trash_can") plan.binCells.push(prop.cell);
    if (prop.asset === "prp_bench") plan.benchCells.push(prop.cell);
  }
  for (const avenue of VERTICAL_AVENUES) {
    for (const street of HORIZONTAL_STREETS) plan.crossings.push({ x: avenue, y: street });
  }

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const cell: GridCell = { x, y };
      const key = cellKey(cell);
      let surface: GroundSurface = "urban";
      if (isRoad(cell)) surface = "asphalt";
      else if (inRect(cell, WORKS_LOT)) surface = "construction";
      else if (inRect(cell, CONSTRUCTION_ACCESS)) surface = "dirt";
      else if (buildings.has(key))
        surface = buildings.get(key) === "residential" ? "gravel" : "pavement";
      else if (inZone(cell) && roadDistance(cell) === 1) surface = "pavement";
      else {
        const open = OPEN_SPACES.find((space) => inRect(cell, space));
        if (open) surface = open.kind === "park" ? "grass" : "dirt";
        else if (inZone(cell)) surface = blockSurface(layout, cell);
      }
      surfaces.set(key, surface);
    }
  }

  /**
   * Trasera comercial: explanada de servicio y aparcamiento en asfalto, no césped tras la fachada.
   * El frente del mismo solar sigue siendo pavimento; lo que cambia es el interior de la manzana.
   */
  for (const building of layout.buildings) {
    if (lotRole(building.type) !== "commercial") continue;
    const rear = awayFromStreet(building.cell);
    const rearKey = cellKey(rear);
    if (!inZone(rear) || reserved.has(rearKey) || isRoad(rear)) continue;
    if (surfaces.get(rearKey) === "construction") continue;
    surfaces.set(rearKey, "asphalt");
  }

  /**
   * Delante del solar la grava sustituye al jardín: explanada de tajo que se lee desde la calle sin
   * añadir maquinaria ni nuevos sprites. La acera contigua se conserva, el bordillo sigue existiendo.
   */
  for (let y = WORKS_LOT.from.y - 1; y <= WORKS_LOT.to.y + 1; y += 1) {
    for (let x = WORKS_LOT.from.x - 1; x <= WORKS_LOT.to.x + 1; x += 1) {
      const cell: GridCell = { x, y };
      const key = cellKey(cell);
      if (!inZone(cell) || isRoad(cell) || reserved.has(key) || inRect(cell, CONSTRUCTION_ACCESS))
        continue;
      const current = surfaces.get(key);
      if (current === "pavement" || current === "asphalt" || current === "construction") continue;
      surfaces.set(key, "gravel");
    }
  }

  /**
   * Extrarradio: fuera de la zona el suelo no está urbanizado. La vegetación aparece en manchas
   * continuas que crecen al alejarse del distrito, así el límite deja de ser un rectángulo perfecto.
   */
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const cell: GridCell = { x, y };
      if (inZone(cell) || isRoad(cell)) continue;
      const key = cellKey(cell);
      if (surfaces.get(key) !== "urban") continue;
      const wildness = Math.min(0.95, 0.35 + zoneDistance(cell) * 0.2);
      if (field(x, y, 5, 0x51ed) < 1 - wildness) continue;
      /** Campo continuo: la tierra asoma sólo en claros grandes y raros, no en parches sueltos. */
      surfaces.set(key, field(x, y, 7, 0x2b7a) > 0.87 ? "dirt" : "grass");
    }
  }

  /**
   * Desgaste del parque: el césped no es una moqueta uniforme. Se abre en claros de tierra por donde
   * pasaría la gente, y el borde se expande hacia el terreno urbano contiguo.
   */
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      if (surfaceOf(surfaces, x, y) !== "grass") continue;
      if (!isInsidePark({ x, y })) continue;
      if (field(x, y, 3.6, 0x7ac3) > 0.86) surfaces.set(cellKey({ x, y }), "dirt");
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const edges: GridCell[] = [];
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        if (surfaceOf(surfaces, x, y) !== "grass" || !isInsidePark({ x, y })) continue;
        for (const [dx, dy] of NEIGHBOURS) {
          const cell: GridCell = { x: x + dx, y: y + dy };
          if (cell.x < 0 || cell.y < 0 || cell.x >= mapWidth || cell.y >= mapHeight) continue;
          if (
            surfaceOf(surfaces, cell.x, cell.y) === "urban" &&
            field(cell.x, cell.y, 2.4, 0x9f31) > 0.6
          )
            edges.push(cell);
        }
      }
    }
    for (const cell of edges) surfaces.set(cellKey(cell), "grass");
  }
  return plan;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function surfaceOf(surfaces: Map<string, GroundSurface>, x: number, y: number): GroundSurface {
  return surfaces.get(`${x}:${y}`) ?? "urban";
}

function isInsidePark(cell: GridCell): boolean {
  return OPEN_SPACES.some(
    (space) =>
      space.kind === "park" &&
      cell.x >= space.from.x &&
      cell.x <= space.to.x &&
      cell.y >= space.from.y &&
      cell.y <= space.to.y,
  );
}

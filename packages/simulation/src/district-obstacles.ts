import type { DistrictId, GridCell } from "@landlord/shared";
import { cellKey } from "./building-index";
import { districtMapOf, type GameState } from "./state";

/**
 * Derivación única de lo que hay físicamente en un distrito (H1-02). Hasta V.d la capa táctica
 * modelaba un edificio como el `anchorCell` de su parcela: con parcelas multi-celda y varios
 * edificios por parcela el ancla ya no es el edificio, así que un operario podía quedar de pie sobre
 * la huella de otro y una ruta podía atravesar una obra en curso.
 *
 * Todo se restringe a un distrito: los nueve mapas comparten el rango local 0..63 y una celda
 * ocupada en uno no dice nada del de al lado.
 */
export type DistrictObstacles = {
  /** Celdas ocupadas por un edificio o por una obra activa del distrito. */
  readonly occupied: Set<string>;
  /** `blockedCells` del mapa más las celdas ocupadas: lo que una ruta respeta. */
  readonly impassable: Set<string>;
};

export type DistrictObstacleIndex = ReadonlyMap<string, DistrictObstacles>;

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

/** Orden canónico de celdas: por fila y luego columna, como los empates del resto del motor. */
function compareCells(left: GridCell, right: GridCell): number {
  return left.y - right.y || left.x - right.x;
}

function addCells(obstacles: DistrictObstacles, cells: readonly GridCell[]): void {
  for (const cell of cells) {
    const key = cellKey(cell);
    obstacles.occupied.add(key);
    obstacles.impassable.add(key);
  }
}

function obstacleFor(state: GameState, districtId: DistrictId): DistrictObstacles {
  return {
    occupied: new Set<string>(),
    impassable: new Set<string>(districtMapOf(state, districtId).blockedCells),
  };
}

/** Los nueve distritos en una sola pasada: es la variante que usa el tick, donde el coste importa. */
export function buildDistrictObstacleIndex(state: GameState): DistrictObstacleIndex {
  const index = new Map<string, DistrictObstacles>();
  for (const districtId of state.world.city.districtIds)
    index.set(districtId, obstacleFor(state, districtId));
  for (const building of state.phase2.buildings.values()) {
    const obstacles = index.get(building.districtId);
    if (obstacles) addCells(obstacles, building.footprintCells);
  }
  for (const site of state.phase2.constructionSites.values()) {
    if (site.progress >= site.workRequired) continue;
    const obstacles = index.get(site.districtId);
    if (obstacles) addCells(obstacles, site.footprintCells);
  }
  return index;
}

/** Obstáculos de un solo distrito, sin recorrer los otros ocho. */
export function districtObstacles(state: GameState, districtId: DistrictId): DistrictObstacles {
  const obstacles = obstacleFor(state, districtId);
  for (const building of state.phase2.buildings.values())
    if (building.districtId === districtId) addCells(obstacles, building.footprintCells);
  for (const site of state.phase2.constructionSites.values()) {
    if (site.districtId !== districtId || site.progress >= site.workRequired) continue;
    addCells(obstacles, site.footprintCells);
  }
  return obstacles;
}

/**
 * Celdas libres adyacentes a una huella, en orden canónico y deduplicadas. Es el único sitio donde
 * se decide dónde se planta un operario: nunca dentro de la huella objetivo ni sobre otra.
 */
export function interactionCellCandidates(
  footprint: readonly GridCell[],
  obstacles: DistrictObstacles,
  width: number,
  height: number,
): GridCell[] {
  const seen = new Set<string>();
  const candidates: GridCell[] = [];
  for (const cell of [...footprint].sort(compareCells)) {
    for (const offset of OFFSETS) {
      const candidate = { x: cell.x + offset.x, y: cell.y + offset.y };
      if (candidate.x < 0 || candidate.y < 0 || candidate.x >= width || candidate.y >= height)
        continue;
      const key = cellKey(candidate);
      if (obstacles.impassable.has(key) || seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }
  return candidates;
}

/** ¿La celda está pegada orthogonalmente a alguna celda del conjunto? */
export function isAdjacentToCells(cell: GridCell, cells: readonly GridCell[]): boolean {
  for (const offset of OFFSETS)
    if (cells.some((target) => target.x === cell.x + offset.x && target.y === cell.y + offset.y))
      return true;
  return false;
}

import type { ParcelId } from "./primitives";
import type { GridCell } from "./time-and-grid";

/**
 * V.d-7 · contrato multi-parcela puro y compartido. Un proyecto físico puede apoyarse en varias
 * parcelas catastrales, pero éstas nunca se fusionan: conservan identidad, valor, dueño, impuestos
 * y frente. Estas funciones fijan el orden canónico y la contigüidad para que simulación, motor y
 * renderer coincidan sin depender del orden en que React envíe los ids.
 */

/** Ids únicos en orden lexicográfico: el orden canónico que entra en estado y digestos. */
export function canonicalParcelIds(ids: readonly ParcelId[]): ParcelId[] {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}

/**
 * Ancla de presentación (cámara, foco, nombre) para un conjunto de parcelas. NO es una regla
 * económica: cualquier cobro, capacidad o valor reparte entre TODAS las parcelas del conjunto.
 */
export function primaryParcelId(ids: readonly ParcelId[]): ParcelId | null {
  return canonicalParcelIds(ids)[0] ?? null;
}

export function areSameParcelSet(
  left: readonly ParcelId[],
  right: readonly ParcelId[],
): boolean {
  const a = canonicalParcelIds(left);
  const b = canonicalParcelIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

/**
 * La unión de varios grupos de celdas tiene que ser UNA sola componente 4-conexa: dos parcelas
 * que se tocan sólo en diagonal no sostienen un mismo proyecto.
 */
export function areCellGroupsEdgeConnected(groups: readonly (readonly GridCell[])[]): boolean {
  const cells = new Set<string>();
  for (const group of groups) for (const cell of group) cells.add(cellKey(cell));
  if (cells.size === 0) return false;
  const [start] = cells;
  const visited = new Set<string>([start!]);
  const queue: string[] = [start!];
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head]!.split(":").map(Number) as [number, number];
    for (const offset of OFFSETS) {
      const neighbour = `${x + offset.x}:${y + offset.y}`;
      if (!cells.has(neighbour) || visited.has(neighbour)) continue;
      visited.add(neighbour);
      queue.push(neighbour);
    }
  }
  return visited.size === cells.size;
}

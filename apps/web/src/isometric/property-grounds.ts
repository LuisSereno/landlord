import type { GridCell } from "@landlord/shared";

/**
 * V.d-7C · entorno de la propiedad (D-097 · Site grounds).
 *
 * Es presentación derivada y efímera: no toca propiedad, colisión autoritativa, producción, valoración,
 * cobertura ni FAR, y no se persiste. Su única entrada es geometría y tipo ya autoritativos, y su
 * salida son descriptores de dibujo. No hay `Math.random()`: la firma del solar decide el detalle,
 * así que la misma geometría produce siempre el mismo recinto aunque cambie el orden de inserción.
 */
export type GroundDescriptorKind =
  | "garden"
  | "path"
  | "hedge"
  | "fence"
  | "tree"
  | "yard"
  | "hardstanding"
  | "service-yard"
  | "loading-area"
  | "pallets"
  | "containers";

export type GroundDescriptor = { kind: GroundDescriptorKind; cell: GridCell };

export type GroundFamily = "residential" | "industrial" | "mixed" | "civic";

/** Techos de dibujo: un distrito entero no puede convertir el grounds en un coste por frame. */
export const MAX_GROUND_DESCRIPTORS_PER_PROPERTY = 18;

function key(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}

function canonicalCells(cells: Iterable<GridCell>): GridCell[] {
  const seen = new Map<string, GridCell>();
  for (const cell of cells) {
    const value = key(cell);
    if (!seen.has(value)) seen.set(value, { x: cell.x, y: cell.y });
  }
  return [...seen.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, cell]) => cell);
}

/** FNV-1a determinista: la misma firma, el mismo adorno, en cualquier máquina y en cualquier orden. */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value = (value ^ input.charCodeAt(index)) >>> 0;
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

const OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function neighboursOf(cell: GridCell): GridCell[] {
  return OFFSETS.map((offset) => ({ x: cell.x + offset.x, y: cell.y + offset.y }));
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/**
 * Camino de acceso: refuerza visualmente que la propiedad conecta con la calle. Sale de la celda
 * libre más pegada al frente vial y trepa hacia la huella. No crea ninguna carretera.
 */
function accessPath(free: GridCell[], footprint: GridCell[], frontage: GridCell[]): GridCell[] {
  if (free.length === 0 || frontage.length === 0 || footprint.length === 0) return [];
  const toStreet = (cell: GridCell) => Math.min(...frontage.map((entry) => manhattan(cell, entry)));
  const toBuilding = (cell: GridCell) =>
    Math.min(...footprint.map((entry) => manhattan(cell, entry)));
  const freeKeys = new Set(free.map(key));
  /** Se empieza por la celda libre más pegada a la calle y se trepa hacia la huella. */
  const start = canonicalCells(free).sort(
    (left, right) => toStreet(left) - toStreet(right) || key(left).localeCompare(key(right)),
  )[0]!;
  const path: GridCell[] = [start];
  const used = new Set<string>([key(start)]);
  for (let step = 0; step < 6 && toBuilding(path[path.length - 1]!) > 1; step += 1) {
    const candidates = neighboursOf(path[path.length - 1]!).filter(
      (cell) => freeKeys.has(key(cell)) && !used.has(key(cell)),
    );
    if (candidates.length === 0) break;
    const next = canonicalCells(candidates).sort(
      (left, right) => toBuilding(left) - toBuilding(right) || key(left).localeCompare(key(right)),
    )[0]!;
    used.add(key(next));
    path.push(next);
  }
  return path;
}

/** Celdas del perímetro del solar que dan a algo distinto del propio solar. */
function boundaryCells(site: GridCell[]): GridCell[] {
  const inside = new Set(site.map(key));
  return site.filter((cell) => neighboursOf(cell).some((neighbour) => !inside.has(key(neighbour))));
}

export function planPropertyGrounds(input: {
  buildingType: string;
  family: GroundFamily;
  siteCells: readonly GridCell[];
  footprintCells: readonly GridCell[];
  frontageCells: readonly GridCell[];
}): GroundDescriptor[] {
  const site = canonicalCells(input.siteCells);
  const footprint = canonicalCells(input.footprintCells);
  const frontage = canonicalCells(input.frontageCells);
  const occupied = new Set(footprint.map(key));
  const free = site.filter((cell) => !occupied.has(key(cell)));
  if (free.length === 0) return [];

  const signature = `${input.family}|${input.buildingType}|${site.map(key).join(";")}|${footprint
    .map(key)
    .join(";")}|${frontage.map(key).join(";")}`;
  const seed = hash(signature);
  const descriptors: GroundDescriptor[] = [];
  const taken = new Set<string>();
  const push = (kind: GroundDescriptorKind, cell: GridCell) => {
    if (descriptors.length >= MAX_GROUND_DESCRIPTORS_PER_PROPERTY) return;
    if (taken.has(key(cell)) || occupied.has(key(cell))) return;
    taken.add(key(cell));
    descriptors.push({ kind, cell });
  };

  const path = accessPath(free, footprint, frontage);
  for (const cell of path) push("path", cell);

  const industrial = input.family === "industrial";
  const civic = input.family === "civic";
  const remaining = free.filter((cell) => !taken.has(key(cell)));

  if (industrial) {
    /** Pista de maniobras junto a la huella y patio de servicio detrás: se lee como nave, no como vivienda. */
    const nextToBuilding = remaining.filter((cell) =>
      neighboursOf(cell).some((neighbour) => occupied.has(key(neighbour))),
    );
    for (const cell of canonicalCells(nextToBuilding)) push("hardstanding", cell);
    const still = remaining.filter((cell) => !taken.has(key(cell)));
    for (const cell of canonicalCells(still).slice(0, 6)) push("service-yard", cell);
    const loading = canonicalCells(still)[0];
    if (loading) push("loading-area", loading);
    const scatter = canonicalCells(still);
    if (scatter.length > 2) {
      push(scatter.length % 2 === 0 ? "pallets" : "containers", scatter[seed % scatter.length]!);
      push(
        scatter.length % 2 === 0 ? "containers" : "pallets",
        scatter[(seed + 7) % scatter.length]!,
      );
    }
  } else if (civic) {
    for (const cell of canonicalCells(remaining).slice(0, 8)) push("garden", cell);
    const trees = canonicalCells(remaining);
    if (trees.length > 3) {
      push("tree", trees[seed % trees.length]!);
      push("tree", trees[(seed + 5) % trees.length]!);
    }
  } else {
    /** Vivienda y mixto: jardín, seto o valla en el perímetro y algún árbol puntual. */
    const garden = canonicalCells(remaining);
    for (const cell of garden.slice(0, 10)) push("garden", cell);
    const perimeter = canonicalCells(boundaryCells(site)).filter(
      (cell) => !occupied.has(key(cell)) && !taken.has(key(cell)),
    );
    const enclosure: GroundDescriptorKind = input.family === "mixed" ? "fence" : "hedge";
    for (const cell of perimeter.slice(0, 6)) push(enclosure, cell);
    if (garden.length >= 4) push("tree", garden[(seed + 2) % garden.length]!);
    if (garden.length === 1) push("yard", garden[0]!);
  }
  return descriptors.slice(0, MAX_GROUND_DESCRIPTORS_PER_PROPERTY);
}

/** Clave de caché: sólo los insumos autoritativos que cambian el dibujo. */
export function propertyGroundsCacheKey(input: {
  buildingId: string;
  siteCells: readonly GridCell[];
  footprintCells: readonly GridCell[];
  frontageCells: readonly GridCell[];
}): string {
  return [
    input.buildingId,
    canonicalCells(input.siteCells).map(key).join(";"),
    canonicalCells(input.footprintCells).map(key).join(";"),
    canonicalCells(input.frontageCells).map(key).join(";"),
  ].join("|");
}

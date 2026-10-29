import type { DistrictId, GridCell } from "@landlord/shared";

/**
 * Desde D-088 una coordenada `{x,y}` no identifica un lugar: los nueve distritos comparten el rango
 * local 0..63, así que `(20,20)` existe nueve veces. La identidad espacial real es el par
 * `districtId + cell`, y esta es la única capa que puede comparar posiciones de entidades distintas.
 */
export type DistrictPlace = {
  districtId: DistrictId;
  cell: GridCell;
};

export function placeKey(place: DistrictPlace): string {
  return `${place.districtId}|${place.cell.x}:${place.cell.y}`;
}

/** Dos lugares son el mismo sitio solo si coinciden distrito y coordenada. */
export function sameDistrictPlace(left: DistrictPlace, right: DistrictPlace): boolean {
  return (
    left.districtId === right.districtId &&
    left.cell.x === right.cell.x &&
    left.cell.y === right.cell.y
  );
}

/**
 * Distancia entre dos lugares, o `null` si pertenecen a distritos diferentes: en ese caso no hay
 * ninguna relación espacial que medir, no una distancia larga.
 */
export function distanceWithinDistrict(left: DistrictPlace, right: DistrictPlace): number | null {
  if (left.districtId !== right.districtId) return null;
  return Math.abs(left.cell.x - right.cell.x) + Math.abs(left.cell.y - right.cell.y);
}

/** Predicado de radio: solo impacta dentro del mismo distrito. */
export function isWithinDistrictRadius(
  origin: DistrictPlace,
  target: DistrictPlace,
  radiusCells: number,
): boolean {
  const distance = distanceWithinDistrict(origin, target);
  return distance !== null && distance <= radiusCells;
}

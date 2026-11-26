import type { GridCell } from "@landlord/shared";

/**
 * Patios de equipamientos municipales (WP-D). Capa presentacional determinista derivada de la
 * geometría proyectada (solar reservado `siteCells` + huella física `footprintCells` + frente vial):
 * no vive en GameState, no toca economía, servicios ni navegación. El patio es el solar menos la
 * huella; el acceso peatonal conecta la calle con la fachada frontal y la plaza de vehículo queda
 * reservada junto al acceso. El dressing genérico, la fauna y los vehículos de calle no pisan las
 * celdas reservadas por este plan.
 */

export type FacilityCourtyardElement = {
  id: string;
  buildingId: string;
  kind: "prop" | "vehicle";
  asset: string;
  cell: GridCell;
  /** Vehículos: las dos celdas reservadas de la plaza; el sprite se ancla y ordena por ellas. */
  cells?: GridCell[];
  azimuth: 45 | 135 | 225 | 315;
  scale: number;
  /** Sólo vehículos: clase visual para el lenguaje de presentación. */
  vehicleClass?: string;
};

export type FacilityCourtyardPlan = {
  buildingId: string;
  type: string;
  /** Celdas del patio: solar reservado menos huella física. */
  patioCells: GridCell[];
  /** Corredor peatonal desde el frente vial hasta la fachada; puede ser vacío si la puerta da a la calle. */
  accessCells: GridCell[];
  /** Celdas que ninguna otra capa puede ocupar: acceso, plaza de vehículo y aproximación a la puerta. */
  keepFree: GridCell[];
  elements: FacilityCourtyardElement[];
  /** Celda vial donde desemboca el acceso: los vehículos de calle no aparcan ahí. */
  accessRoadExit: GridCell | null;
};

type CourtyardSpec = {
  vehicle: { asset: string; vehicleClass: string; scale: number } | null;
  props: readonly { asset: string; count: number; scale: number }[];
};

export const FACILITY_COURTYARD_SPECS: Record<string, CourtyardSpec> = {
  town_hall: {
    vehicle: null,
    props: [
      { asset: "prp_monument_obelisk", count: 1, scale: 1.0 },
      { asset: "prp_flagpole", count: 1, scale: 1.0 },
      { asset: "prp_bench", count: 2, scale: 0.8 },
      { asset: "prp_planter_urn", count: 2, scale: 0.8 },
      { asset: "prp_bollard", count: 2, scale: 0.8 },
    ],
  },
  school_block: {
    vehicle: null,
    props: [
      { asset: "prp_school_playground", count: 1, scale: 1.0 },
      { asset: "prp_bench", count: 2, scale: 0.8 },
    ],
  },
  clinic: {
    vehicle: { asset: "veh_ambulance", vehicleClass: "ambulance", scale: 0.88 },
    props: [
      { asset: "prp_bench", count: 1, scale: 0.8 },
      { asset: "prp_planter_urn", count: 1, scale: 0.8 },
    ],
  },
  police_station: {
    vehicle: { asset: "veh_police", vehicleClass: "police", scale: 0.88 },
    props: [
      { asset: "prp_bollard", count: 2, scale: 0.8 },
      { asset: "prp_bench", count: 1, scale: 0.8 },
    ],
  },
  fire_station: {
    vehicle: { asset: "veh_firetruck", vehicleClass: "fire", scale: 0.92 },
    props: [{ asset: "prp_bollard", count: 2, scale: 0.8 }],
  },
  market_hall: {
    vehicle: { asset: "veh_delivery", vehicleClass: "delivery", scale: 0.88 },
    props: [
      { asset: "prp_market_stall", count: 2, scale: 1.0 },
      { asset: "prp_bench", count: 1, scale: 0.8 },
    ],
  },
  cleaning_depot: {
    vehicle: { asset: "veh_garbage", vehicleClass: "garbage", scale: 0.92 },
    props: [
      { asset: "prp_waste_heap", count: 1, scale: 2.5 },
      { asset: "prp_trash_can", count: 1, scale: 0.9 },
    ],
  },
};

const SIDES = [
  { side: "n", dx: 0, dy: -1 },
  { side: "e", dx: 1, dy: 0 },
  { side: "s", dx: 0, dy: 1 },
  { side: "w", dx: -1, dy: 0 },
] as const;

type Side = (typeof SIDES)[number]["side"];

const SIDE_AZIMUTH: Record<Side, 45 | 135 | 225 | 315> = { n: 45, e: 135, s: 225, w: 315 };

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

/** Mismo hash espacial que el resto del dressing: coordenada y sal, nunca tick ni RNG global. */
function spatialHash(x: number, y: number, salt: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function canonicalCells(cells: readonly GridCell[]): GridCell[] {
  return [...cells].sort((left, right) => left.y - right.y || left.x - right.x);
}

function distanceTo(cell: GridCell, targets: readonly GridCell[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    best = Math.min(best, Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y));
  }
  return best;
}

export type FacilityCourtyardBuilding = {
  id: string;
  type: string;
  footprintCells: readonly GridCell[];
  siteCells?: readonly GridCell[];
};

/**
 * Plan de patio de un equipamiento. Determinista para la misma geometría: el frente se elige por
 * cercanía al frente vial (desempate N/E/S/W), el acceso es el corredor recto desde la puerta al
 * borde del solar, y vehículo y props se colocan por hash espacial sobre las celdas restantes.
 */
export function planFacilityCourtyard(
  building: FacilityCourtyardBuilding,
  frontageCells: readonly GridCell[],
): FacilityCourtyardPlan | null {
  const spec = FACILITY_COURTYARD_SPECS[building.type];
  if (!spec || !building.siteCells?.length || building.footprintCells.length === 0) return null;
  const footprint = new Set(building.footprintCells.map(cellKey));
  const site = canonicalCells(building.siteCells);
  const patio = site.filter((cell) => !footprint.has(cellKey(cell)));
  const patioKeys = new Set(patio.map(cellKey));

  /** Frente: el lado de la huella con patio delante y más cercano a la calle. */
  let front: Side = "n";
  let bestScore = Number.POSITIVE_INFINITY;
  for (const { side, dx, dy } of SIDES) {
    const edgeCells = building.footprintCells.filter(
      (cell) => !footprint.has(`${cell.x + dx}:${cell.y + dy}`),
    );
    if (edgeCells.length === 0) continue;
    const withPatio = edgeCells.filter((cell) => patioKeys.has(`${cell.x + dx}:${cell.y + dy}`));
    const reference = withPatio.length > 0 ? withPatio : edgeCells;
    const score =
      (frontageCells.length > 0
        ? Math.min(...reference.map((c) => distanceTo(c, frontageCells)))
        : 0) + (withPatio.length === 0 ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      front = side;
    }
  }
  const frontDelta = SIDES.find((entry) => entry.side === front)!;

  /** Puerta: la celda de la fachada frontal más cercana al frente vial; desempate canónico. */
  const facade = canonicalCells(
    building.footprintCells.filter(
      (cell) => !footprint.has(`${cell.x + frontDelta.dx}:${cell.y + frontDelta.dy}`),
    ),
  );
  const door =
    facade.length > 0
      ? facade.reduce((best, cell) =>
          distanceTo(cell, frontageCells) < distanceTo(best, frontageCells) ? cell : best,
        )
      : canonicalCells(building.footprintCells)[0]!;

  /** Corredor de acceso: recto desde la puerta hacia la calle mientras haya patio. */
  const accessCells: GridCell[] = [];
  let cursor = { x: door.x + frontDelta.dx, y: door.y + frontDelta.dy };
  while (patioKeys.has(cellKey(cursor))) {
    accessCells.push({ ...cursor });
    cursor = { x: cursor.x + frontDelta.dx, y: cursor.y + frontDelta.dy };
  }
  const accessRoadExit = (() => {
    const frontageKeys = new Set(frontageCells.map(cellKey));
    const mouth = accessCells.length > 0 ? accessCells[accessCells.length - 1]! : door;
    if (!frontageKeys.has(cellKey(mouth))) return null;
    return { x: mouth.x + frontDelta.dx, y: mouth.y + frontDelta.dy };
  })();

  const reserved = new Set(accessCells.map(cellKey));
  const elements: FacilityCourtyardElement[] = [];

  /**
   * Caras visibles de la cámara isométrica (+X y +Y): el patio en la cara contraria queda tapado
   * por el propio edificio (orden de dibujo por x+y). Vehículo y props mayores se prefieren en las
   * celdas de patio visibles; el acceso peatonal sigue mirando al frente vial aunque quede detrás.
   */
  const footprintKeys = new Set(building.footprintCells.map(cellKey));
  const isVisiblePatio = (cell: GridCell) =>
    footprintKeys.has(`${cell.x - 1}:${cell.y}`) || footprintKeys.has(`${cell.x}:${cell.y - 1}`);

  /** Plaza de vehículo: dos celdas de patio contiguas (en cualquier eje), junto al acceso. */
  if (spec.vehicle) {
    const pairs: GridCell[][] = [];
    for (const parallel of [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
    ]) {
      for (const cell of patio) {
        const next = { x: cell.x + parallel.dx, y: cell.y + parallel.dy };
        if (!patioKeys.has(cellKey(next))) continue;
        if (reserved.has(cellKey(cell)) || reserved.has(cellKey(next))) continue;
        const touchesAccess = [...accessCells, door].some(
          (anchor) =>
            Math.abs(anchor.x - cell.x) + Math.abs(anchor.y - cell.y) <= 1 ||
            Math.abs(anchor.x - next.x) + Math.abs(anchor.y - next.y) <= 1,
        );
        if (touchesAccess) pairs.push([cell, next]);
      }
    }
    const canonicalPairs = pairs.sort(
      (left, right) =>
        left[0]!.y - right[0]!.y || left[0]!.x - right[0]!.x || left[1]!.x - right[1]!.x,
    );
    const visiblePairs = canonicalPairs.filter(
      (pair) => isVisiblePatio(pair[0]!) && isVisiblePatio(pair[1]!),
    );
    const pool = visiblePairs.length > 0 ? visiblePairs : canonicalPairs;
    if (pool.length > 0) {
      const pair = pool[spatialHash(door.x, door.y, 0x51c7) % pool.length]!;
      for (const cell of pair) reserved.add(cellKey(cell));
      /**
       * El eje de la plaza decide el rumbo del sprite: paralela a la fachada (eje X) equivale a
       * una vía este-oeste (135/315); eje Y, a una vía norte-sur (45/225). El sentido se sortea
       * por hash, nunca por tick.
       */
      const alongX = pair[1]!.x !== pair[0]!.x;
      const reverse = spatialHash(door.x, door.y, 0x51c8) % 2 === 1;
      const azimuth = alongX ? (reverse ? 315 : 135) : reverse ? 45 : 225;
      elements.push({
        id: `courtyard:${building.id}:vehicle:${cellKey(pair[0]!)}`,
        buildingId: building.id,
        kind: "vehicle",
        asset: spec.vehicle.asset,
        cell: { ...pair[0]! },
        cells: pair.map((cell) => ({ ...cell })),
        azimuth,
        scale: spec.vehicle.scale,
        vehicleClass: spec.vehicle.vehicleClass,
      });
    }
  }

  /** Props temáticos sobre el patio restante, en orden canónico y por hash espacial. */
  let available = canonicalCells(patio.filter((cell) => !reserved.has(cellKey(cell))));
  let salt = 0x62a1;
  for (const prop of spec.props) {
    for (let index = 0; index < prop.count; index += 1) {
      if (available.length === 0) break;
      const visible = available.filter(isVisiblePatio);
      const pool = visible.length > 0 ? visible : available;
      const pick = spatialHash(door.x, door.y, salt + index * 0x1f) % pool.length;
      const cell = pool[pick]!;
      available = available.filter((entry) => cellKey(entry) !== cellKey(cell));
      reserved.add(cellKey(cell));
      elements.push({
        id: `courtyard:${building.id}:${prop.asset}:${cellKey(cell)}`,
        buildingId: building.id,
        kind: "prop",
        asset: prop.asset,
        cell: { ...cell },
        azimuth: prop.asset === "prp_bench" ? SIDE_AZIMUTH[front] : 45,
        scale: prop.scale,
      });
    }
    salt += 0x101;
  }

  const keepFree = canonicalCells(
    [...reserved].map((key) => {
      const [x, y] = key.split(":").map(Number) as [number, number];
      return { x, y };
    }),
  );
  return {
    buildingId: building.id,
    type: building.type,
    patioCells: patio,
    accessCells,
    keepFree,
    elements,
    accessRoadExit,
  };
}

export type GameplayFacilityCourtyards = {
  elements: FacilityCourtyardElement[];
  /** Celdas de patio reservadas (acceso + vehículo + props): fauna y dressing no las pisan. */
  reservedCells: ReadonlySet<string>;
  /** Desembocaduras viales de los accesos: el aparcamiento de calle las evita. */
  accessRoadExits: ReadonlySet<string>;
  /** Patio libre por parcela pública de equipamiento, para los gorriones urbanos. */
  patioByParcelId: ReadonlyMap<string, { cells: GridCell[]; reserved: ReadonlySet<string> }>;
};

/** Planifica todos los equipamientos del distrito observado sobre la proyección. */
export function planGameplayFacilityCourtyards(
  buildings: readonly (FacilityCourtyardBuilding & { parcelIds: readonly string[] })[],
  frontagesByParcelId: ReadonlyMap<string, readonly GridCell[]>,
): GameplayFacilityCourtyards {
  const elements: FacilityCourtyardElement[] = [];
  const reservedCells = new Set<string>();
  const accessRoadExits = new Set<string>();
  const patioByParcelId = new Map<string, { cells: GridCell[]; reserved: ReadonlySet<string> }>();
  for (const building of [...buildings].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!FACILITY_COURTYARD_SPECS[building.type]) continue;
    const frontages = building.parcelIds.flatMap((id) => frontagesByParcelId.get(id) ?? []);
    const plan = planFacilityCourtyard(building, frontages);
    if (!plan) continue;
    elements.push(...plan.elements);
    const planReserved = new Set(plan.keepFree.map(cellKey));
    for (const key of planReserved) reservedCells.add(key);
    if (plan.accessRoadExit) accessRoadExits.add(cellKey(plan.accessRoadExit));
    const parcelId = building.parcelIds[0];
    if (parcelId) {
      patioByParcelId.set(parcelId, {
        cells: plan.patioCells.filter((cell) => !planReserved.has(cellKey(cell))),
        reserved: planReserved,
      });
    }
  }
  return { elements, reservedCells, accessRoadExits, patioByParcelId };
}

import type {
  Block,
  Building,
  BuildingId,
  ConstructionSite,
  DevelopmentCode,
  Parcel,
  ParcelId,
} from "@landlord/shared";

import { developmentCodeById } from "./development-codes";
import { PRIMARY_USE_BY_BUILDING_TYPE } from "./game-data";
import { districtStateOf, type GameState } from "./state";

/**
 * Derived, rebuildable indexes over the building stock (D-090). They are never persisted: every
 * consumer rebuilds them from `phase2.buildings` and `phase2.parcels`, which stays the single
 * authoritative source. The whole point is that `Parcel` no longer carries `buildingId`.
 */
export type BuildingIndex = {
  byId: Map<BuildingId, Building>;
  byParcel: Map<ParcelId, Building[]>;
  byDistrict: Map<string, Building[]>;
  footprintCellsByParcel: Map<ParcelId, Set<string>>;
  parcelsByBlock: Map<string, Parcel[]>;
};

export function cellKey(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

export function buildBuildingIndex(state: GameState): BuildingIndex {
  const byId = new Map<BuildingId, Building>();
  const byParcel = new Map<ParcelId, Building[]>();
  const byDistrict = new Map<string, Building[]>();
  const footprintCellsByParcel = new Map<ParcelId, Set<string>>();
  for (const building of state.phase2.buildings.values()) {
    byId.set(building.id, building);
    /**
     * V.d-7 · un edificio multi-parcela aparece indexado desde TODAS sus parcelas: preguntar por
     * cualquiera de ellas lo devuelve. La huella se registra en cada parcela del conjunto porque
     * todo el complejo reserva su suelo.
     */
    for (const parcelId of building.parcelIds) {
      const parcelBuildings = byParcel.get(parcelId) ?? [];
      parcelBuildings.push(building);
      byParcel.set(parcelId, parcelBuildings);
      const footprint = footprintCellsByParcel.get(parcelId) ?? new Set<string>();
      for (const cell of building.footprintCells) footprint.add(cellKey(cell));
      footprintCellsByParcel.set(parcelId, footprint);
    }
    const districtBuildings = byDistrict.get(building.districtId) ?? [];
    districtBuildings.push(building);
    byDistrict.set(building.districtId, districtBuildings);
  }
  for (const buildings of byParcel.values())
    buildings.sort((left, right) => left.id.localeCompare(right.id));
  for (const buildings of byDistrict.values())
    buildings.sort((left, right) => left.id.localeCompare(right.id));
  const parcelsByBlock = new Map<string, Parcel[]>();
  for (const parcel of state.phase2.parcels.values()) {
    const blockParcels = parcelsByBlock.get(parcel.blockId) ?? [];
    blockParcels.push(parcel);
    parcelsByBlock.set(parcel.blockId, blockParcels);
  }
  for (const parcels of parcelsByBlock.values()) {
    parcels.sort((left, right) => left.id.localeCompare(right.id));
  }
  return { byId, byParcel, byDistrict, footprintCellsByParcel, parcelsByBlock };
}

export function buildingsOnParcel(index: BuildingIndex, parcelId: ParcelId): Building[] {
  return index.byParcel.get(parcelId) ?? [];
}

export function activeSiteOnParcel(
  state: GameState,
  parcelId: ParcelId,
): ConstructionSite | undefined {
  return [...state.phase2.constructionSites.values()]
    .filter((site) => site.parcelIds.includes(parcelId))
    .sort((left, right) => left.id.localeCompare(right.id))[0];
}

export function blockOfParcel(state: GameState, parcel: Parcel): Block {
  const block = districtStateOf(state, parcel.districtId).blocks.get(parcel.blockId);
  if (block) return block;
  // Synthetic loads (system-cost harness) and legacy parcels may carry a block id without a
  // persisted block. They still need a normative code, which the parcel itself already has.
  return {
    id: parcel.blockId,
    districtId: parcel.districtId,
    cells: parcel.cells.map((cell) => ({ ...cell })),
    frontageRoadSegmentIds: ["synthetic_frontage"],
    urbanRole: "urban_residential",
    defaultDevelopmentCodeId: parcel.developmentCodeId,
  };
}

export function developmentCodeOfParcel(_state: GameState, parcel: Parcel): DevelopmentCode {
  // The parcel carries the code it was generated or varied with; the block keeps the default.
  return developmentCodeById(parcel.developmentCodeId);
}

export function developmentCodeOfParcelById(
  state: GameState,
  parcelId: ParcelId,
): DevelopmentCode | null {
  const parcel = state.phase2.parcels.get(parcelId);
  if (!parcel) return null;
  return developmentCodeOfParcel(state, parcel);
}

const LAND_USE_ORDER = [
  "residential",
  "retail",
  "office",
  "industrial",
  "civic",
  "education",
  "health",
  "utility",
] as const;

/**
 * Rebuilds a parcel's `currentUses` from the buildings that physically exist on it. Called after
 * construction completes and after a ruin is cleared, so the field never keeps a use that no longer
 * has a building behind it.
 */
export function reconcileParcelUses(state: GameState, parcelId: ParcelId): void {
  const parcel = state.phase2.parcels.get(parcelId);
  if (!parcel) return;
  const uses = new Set<string>();
  for (const building of buildingsOnParcel(buildBuildingIndex(state), parcelId)) {
    if (building.state === "ruin") continue;
    uses.add(PRIMARY_USE_BY_BUILDING_TYPE[building.type]);
  }
  parcel.currentUses = LAND_USE_ORDER.filter((use) => uses.has(use));
}

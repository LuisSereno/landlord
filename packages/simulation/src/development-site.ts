import type {
  BuildingDefinition,
  DistrictId,
  OrganizationId,
  Parcel,
  ParcelId,
} from "@landlord/shared";
import { areCellGroupsEdgeConnected, canonicalParcelIds } from "@landlord/shared";

import { activeSiteOnParcel, buildBuildingIndex, buildingsOnParcel } from "./building-index";
import { type GameState } from "./state";
import { developmentCodeById, isBuildingAllowedByDevelopmentCode } from "./development-codes";

/**
 * V.d-7 · búsqueda determinista de solar para un proyecto. Es pura respecto al orden de los Maps:
 * recorre distritos, parcelas y expansiones en orden canónico y devuelve el primer conjunto válido
 * de exactamente `requiredParcels` parcelas. La usan la IA rival y cualquier automatización que
 * construya; el comando vuelve a validar todo, así que un fallo aquí no puede colar un site ilegal.
 */
export function findDevelopmentSite(input: {
  state: GameState;
  definition: BuildingDefinition;
  ownerOrganizationId: OrganizationId;
  seedParcelId?: ParcelId;
  districtIds?: ReadonlySet<DistrictId>;
  /** Tope de nodos explorados; los proyectos Alpha piden como máximo 3 parcelas. */
  maxExplored?: number;
}): ParcelId[] | null {
  return enumerateDevelopmentSites(input)[0] ?? null;
}

/**
 * Pure geometric/product-rule core. Callers supply already eligible parcels; this deliberately
 * knows nothing about ownership, buildings, works or Map insertion order.
 */
export function enumerateCompatibleDevelopmentSites(input: {
  parcels: readonly Parcel[];
  definition: BuildingDefinition;
  seedParcelId?: ParcelId;
  maxExplored?: number;
}): ParcelId[][] {
  const { definition } = input;
  const required = definition.siteRequirements.requiredParcels;
  const all = [...input.parcels]
    .filter((parcel) =>
      isBuildingAllowedByDevelopmentCode(definition, developmentCodeById(parcel.developmentCodeId)),
    )
    .sort(
      (left, right) =>
        left.districtId.localeCompare(right.districtId) || left.id.localeCompare(right.id),
    );
  if (all.length === 0) return [];
  const byId = new Map(all.map((parcel) => [parcel.id, parcel]));

  if (required === 1) {
    const seed = input.seedParcelId ? byId.get(input.seedParcelId) : undefined;
    const chosen = seed ?? all[0]!;
    return chosen.cells.length >= definition.siteRequirements.minCombinedAreaCells
      ? [[chosen.id]]
      : [];
  }

  /**
   * Vecindad por borde entre parcelas candidatas. La clave incluye el distrito: los nueve mapas
   * comparten rango local 0..63 y una celda de otro distrito no es vecina de nada (D-093/H1-01).
   */
  const cellOwner = new Map<string, ParcelId>();
  for (const parcel of all)
    for (const cell of parcel.cells)
      cellOwner.set(`${parcel.districtId}:${cell.x}:${cell.y}`, parcel.id);
  const neighbours = new Map<ParcelId, ParcelId[]>();
  for (const parcel of all) {
    const found = new Set<ParcelId>();
    for (const cell of parcel.cells) {
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const) {
        const owner = cellOwner.get(`${parcel.districtId}:${cell.x + dx}:${cell.y + dy}`);
        if (owner && owner !== parcel.id) found.add(owner);
      }
    }
    neighbours.set(
      parcel.id,
      [...found].sort((left, right) => left.localeCompare(right)),
    );
  }

  const maxExplored = input.maxExplored ?? 512;
  let explored = 0;
  const seeds =
    input.seedParcelId && byId.has(input.seedParcelId) ? [byId.get(input.seedParcelId)!] : all;
  const candidateSets = new Set<string>();
  for (const seed of seeds) {
    const frontier: ParcelId[][] = [[seed.id]];
    while (frontier.length > 0 && explored < maxExplored) {
      const set = frontier.shift()!;
      explored += 1;
      if (set.length === required) {
        candidateSets.add(canonicalParcelIds(set).join(","));
        continue;
      }
      for (const neighbour of neighbours.get(set[set.length - 1]!) ?? [])
        if (!set.includes(neighbour)) frontier.push([...set, neighbour]);
    }
  }
  const valid: ParcelId[][] = [];
  for (const key of [...candidateSets].sort()) {
    const ids = key.split(",") as ParcelId[];
    const parcels = ids.map((id) => byId.get(id)!).filter(Boolean);
    if (parcels.length !== required) continue;
    const districtId = parcels[0]!.districtId;
    if (parcels.some((parcel) => parcel.districtId !== districtId)) continue;
    const codeId = parcels[0]!.developmentCodeId;
    if (parcels.some((parcel) => parcel.developmentCodeId !== codeId)) continue;
    if (!areCellGroupsEdgeConnected(parcels.map((parcel) => parcel.cells))) continue;
    const area = parcels.reduce((total, parcel) => total + parcel.cells.length, 0);
    if (area < definition.siteRequirements.minCombinedAreaCells) continue;
    valid.push(canonicalParcelIds(ids));
  }
  return valid;
}

/** Runtime selection adds ownership and occupancy constraints to the pure site contract. */
export function enumerateDevelopmentSites(input: {
  state: GameState;
  definition: BuildingDefinition;
  ownerOrganizationId?: OrganizationId;
  seedParcelId?: ParcelId;
  districtIds?: ReadonlySet<DistrictId>;
  maxExplored?: number;
}): ParcelId[][] {
  const { state, definition, ownerOrganizationId } = input;
  const index = buildBuildingIndex(state);
  const parcels = [...state.phase2.parcels.values()].filter(
    (parcel) =>
      parcel.disposition === "marketable" &&
      (ownerOrganizationId === undefined || parcel.ownerOrganizationId === ownerOrganizationId) &&
      (input.districtIds === undefined || input.districtIds.has(parcel.districtId)) &&
      buildingsOnParcel(index, parcel.id).length === 0 &&
      activeSiteOnParcel(state, parcel.id) === undefined,
  );
  return enumerateCompatibleDevelopmentSites({
    parcels,
    definition,
    ...(input.seedParcelId === undefined ? {} : { seedParcelId: input.seedParcelId }),
    ...(input.maxExplored === undefined ? {} : { maxExplored: input.maxExplored }),
  });
}

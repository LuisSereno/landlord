import type { BuildingId, ViewProjectionV2 } from "@landlord/shared";

import { resolveBuildingSelection } from "../building-selection";
import type { Economy, ProjectedBuilding, ProjectedParcel } from "./types";

const PLAYER = "org_00000001";

/**
 * V.d-UX · contrato selección→superficie (spec §6). Es una función pura sobre la proyección:
 * la celda elegida decide qué panel abre. El suelo municipal es contexto institucional y nunca
 * abre la ficha de un edificio privado.
 */
export type ContextSelection =
  | { kind: "parcel"; parcel: ProjectedParcel }
  | { kind: "building"; parcel: ProjectedParcel; building: ProjectedBuilding; owned: boolean }
  | {
      kind: "construction";
      parcel: ProjectedParcel;
      site: Economy["constructionSites"][number];
      owned: boolean;
    }
  | { kind: "facility"; parcel: ProjectedParcel; facility: ViewProjectionV2["facilities"][number] }
  | {
      kind: "public-space";
      parcel: ProjectedParcel;
      space: ViewProjectionV2["publicSpaces"][number];
    };

/**
 * Identidad estable de la selección espacial. Una celda sólo sirve para descubrir el objetivo al
 * hacer click; no se conserva como estado de interacción porque una parcela, edificio u obra
 * puede abarcar varias celdas.
 */
export type SpatialSelection =
  | { kind: "parcel"; parcelId: string }
  | { kind: "building"; buildingId: string }
  | { kind: "construction"; siteId: string }
  | { kind: "facility"; facilityId: string }
  | { kind: "public-space"; publicSpaceId: string };

export function selectionTargetForCell(input: {
  economy: Economy;
  projection: ViewProjectionV2;
  cell: { x: number; y: number };
}): SpatialSelection | null {
  const { economy, projection, cell } = input;
  const parcel = economy.parcels.find((entry) =>
    entry.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
  );
  if (!parcel) return null;
  if (parcel.disposition === "public") {
    const facility = projection.facilities.find((entry) => entry.parcelIds.includes(parcel.id));
    if (facility) return { kind: "facility", facilityId: facility.id };
    const space = projection.publicSpaces.find((entry) =>
      entry.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
    );
    if (space) return { kind: "public-space", publicSpaceId: space.id };
    return { kind: "parcel", parcelId: parcel.id };
  }
  const building = economy.buildings.find((entry) => entry.parcelIds.includes(parcel.id));
  if (building) return { kind: "building", buildingId: building.id };
  const site = economy.constructionSites.find((entry) => entry.parcelIds.includes(parcel.id));
  if (site) return { kind: "construction", siteId: site.id };
  return { kind: "parcel", parcelId: parcel.id };
}

export function resolveContextSelection(input: {
  economy: Economy;
  projection: ViewProjectionV2;
  /** Prefer the semantic identity. `cell` remains temporarily for existing callers/tests. */
  target?: SpatialSelection | null;
  cell?: { x: number; y: number };
  selectedBuildingId?: BuildingId | null;
}): ContextSelection | null {
  const { economy, projection, cell, selectedBuildingId = null } = input;
  if (input.target) return resolveSemanticSelection(economy, projection, input.target);
  if (!cell) return null;
  const parcel = economy.parcels.find((entry) =>
    entry.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
  );
  if (!parcel) return null;
  if (parcel.disposition === "public") {
    const facility = projection.facilities.find((entry) => entry.parcelIds.includes(parcel.id));
    if (facility) return { kind: "facility", parcel, facility };
    const space = projection.publicSpaces.find((entry) =>
      entry.cells.some((candidate) => candidate.x === cell.x && candidate.y === cell.y),
    );
    if (space) return { kind: "public-space", parcel, space };
    return { kind: "parcel", parcel };
  }
  const { activeBuildingId } = resolveBuildingSelection(parcel.buildingIds, selectedBuildingId);
  const building = activeBuildingId
    ? economy.buildings.find((entry) => entry.id === activeBuildingId)
    : undefined;
  if (building)
    return {
      kind: "building",
      parcel,
      building,
      owned: building.ownerOrganizationId === PLAYER,
    };
  const site = economy.constructionSites.find((entry) => entry.parcelIds.includes(parcel.id));
  if (site)
    return { kind: "construction", parcel, site, owned: site.ownerOrganizationId === PLAYER };
  return { kind: "parcel", parcel };
}

function resolveSemanticSelection(
  economy: Economy,
  projection: ViewProjectionV2,
  target: SpatialSelection,
): ContextSelection | null {
  if (target.kind === "parcel") {
    const parcel = economy.parcels.find((entry) => entry.id === target.parcelId);
    return parcel ? { kind: "parcel", parcel } : null;
  }
  if (target.kind === "building") {
    const building = economy.buildings.find((entry) => entry.id === target.buildingId);
    if (!building) return null;
    const parcel = economy.parcels.find((entry) => entry.id === building.parcelIds[0]);
    if (!parcel) return null;
    if (parcel.disposition === "public") {
      const facility = projection.facilities.find((entry) => entry.parcelIds.includes(parcel.id));
      if (facility) return { kind: "facility", parcel, facility };
      return { kind: "parcel", parcel };
    }
    return { kind: "building", parcel, building, owned: building.ownerOrganizationId === PLAYER };
  }
  if (target.kind === "construction") {
    const site = economy.constructionSites.find((entry) => entry.id === target.siteId);
    if (!site) return null;
    const parcel = economy.parcels.find((entry) => entry.id === site.parcelIds[0]);
    if (!parcel) return null;
    if (parcel.disposition === "public") {
      const facility = projection.facilities.find((entry) => entry.parcelIds.includes(parcel.id));
      if (facility) return { kind: "facility", parcel, facility };
      return { kind: "parcel", parcel };
    }
    return {
      kind: "construction",
      parcel,
      site,
      owned: site.ownerOrganizationId === PLAYER,
    };
  }
  if (target.kind === "facility") {
    const facility = projection.facilities.find((entry) => entry.id === target.facilityId);
    if (!facility) return null;
    const parcel = economy.parcels.find((entry) => entry.id === facility.parcelIds[0]);
    return parcel ? { kind: "facility", parcel, facility } : null;
  }
  const space = projection.publicSpaces.find((entry) => entry.id === target.publicSpaceId);
  if (!space) return null;
  const parcel = economy.parcels.find((entry) =>
    entry.cells.some((cell) =>
      space.cells.some((spaceCell) => spaceCell.x === cell.x && spaceCell.y === cell.y),
    ),
  );
  return parcel ? { kind: "public-space", parcel, space } : null;
}

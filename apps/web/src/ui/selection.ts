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

export function resolveContextSelection(input: {
  economy: Economy;
  projection: ViewProjectionV2;
  cell: { x: number; y: number };
  selectedBuildingId: BuildingId | null;
}): ContextSelection | null {
  const { economy, projection, cell, selectedBuildingId } = input;
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

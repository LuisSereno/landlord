import type { BuildingType, HeadquartersVariantId } from "@landlord/shared";

import type { Economy, ProjectedParcel } from "./types";

const PLAYER = "org_00000001";

export type PendingDevelopmentSite = {
  buildingType: BuildingType;
  /** Punto de partida de la intención del jugador; no es geometría autoritativa. */
  anchorParcelId: string;
  parcelIds: readonly string[];
  targetParcelIds: readonly string[];
  purchaseParcelIds?: readonly string[];
  headquartersVariantId?: HeadquartersVariantId;
};

export type SiteAssemblyIssue =
  "wrong-parcel-count" | "area-too-small" | "not-edge-contiguous" | "parcel-not-eligible";

type SiteRequirements = Economy["constructionOptions"][number]["siteRequirements"];

export function siteRequirementsFor(
  economy: Economy,
  buildingType: BuildingType,
): SiteRequirements | null {
  return (
    economy.constructionOptions.find((option) => option.type === buildingType)?.siteRequirements ??
    null
  );
}

/** La contigüidad es por borde de celda, nunca por diagonales ni por el anchor de la parcela. */
export function parcelsAreEdgeConnected(parcels: readonly ProjectedParcel[]): boolean {
  if (parcels.length <= 1) return parcels.length === 1;
  const cells = parcels.flatMap((parcel) => parcel.cells);
  if (cells.length === 0) return false;
  const occupied = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const reached = new Set<string>();
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const key = `${cell.x},${cell.y}`;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const neighbor of [
      { x: cell.x + 1, y: cell.y },
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 },
      { x: cell.x, y: cell.y - 1 },
    ])
      if (occupied.has(`${neighbor.x},${neighbor.y}`)) queue.push(neighbor);
  }
  return reached.size === occupied.size;
}

export function isParcelEligibleForSite(
  economy: Economy,
  parcel: ProjectedParcel,
  buildingType: BuildingType,
  anchor: ProjectedParcel,
  ownership: "owned" | "purchasable" = "owned",
): boolean {
  return (
    (ownership === "owned"
      ? parcel.ownerOrganizationId === PLAYER
      : parcel.ownerOrganizationId === null) &&
    parcel.disposition === "marketable" &&
    parcel.buildingIds.length === 0 &&
    parcel.developmentCodeId === anchor.developmentCodeId &&
    parcel.permittedBuildingTypes.includes(buildingType) &&
    !economy.constructionSites.some((site) => site.parcelIds.includes(parcel.id))
  );
}

export function siteAssemblyIssues(
  economy: Economy,
  pending: PendingDevelopmentSite,
): SiteAssemblyIssue[] {
  const requirements = siteRequirementsFor(economy, pending.buildingType);
  const parcels = pending.parcelIds
    .map((id) => economy.parcels.find((parcel) => parcel.id === id))
    .filter((parcel): parcel is ProjectedParcel => Boolean(parcel));
  const anchor = economy.parcels.find((parcel) => parcel.id === pending.anchorParcelId);
  if (!requirements || !anchor || parcels.length !== pending.parcelIds.length)
    return ["parcel-not-eligible"];
  const issues: SiteAssemblyIssue[] = [];
  if (
    parcels.some(
      (parcel) => !isParcelEligibleForSite(economy, parcel, pending.buildingType, anchor),
    )
  )
    issues.push("parcel-not-eligible");
  if (parcels.length !== requirements.requiredParcels) issues.push("wrong-parcel-count");
  if (
    parcels.reduce((area, parcel) => area + parcel.cells.length, 0) <
    requirements.minCombinedAreaCells
  )
    issues.push("area-too-small");
  if (requirements.requireEdgeContiguous && !parcelsAreEdgeConnected(parcels))
    issues.push("not-edge-contiguous");
  return issues;
}

export function siteAssemblyCandidates(
  economy: Economy,
  pending: PendingDevelopmentSite,
): ProjectedParcel[] {
  const requirements = siteRequirementsFor(economy, pending.buildingType);
  const selected = new Set(pending.parcelIds);
  const target = new Set(pending.targetParcelIds);
  const anchor = economy.parcels.find((parcel) => parcel.id === pending.anchorParcelId);
  if (!requirements || !anchor || pending.parcelIds.length >= requirements.requiredParcels)
    return [];
  const current = economy.parcels.filter((parcel) => selected.has(parcel.id));
  return economy.parcels
    .filter(
      (parcel) =>
        !selected.has(parcel.id) &&
        target.has(parcel.id) &&
        isParcelEligibleForSite(economy, parcel, pending.buildingType, anchor) &&
        (!requirements.requireEdgeContiguous || parcelsAreEdgeConnected([...current, parcel])),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function siteAssemblyPurchaseCandidates(
  economy: Economy,
  pending: PendingDevelopmentSite,
): ProjectedParcel[] {
  const requirements = siteRequirementsFor(economy, pending.buildingType);
  const selected = new Set(pending.parcelIds);
  const purchaseIds = new Set(pending.purchaseParcelIds ?? []);
  const anchor = economy.parcels.find((parcel) => parcel.id === pending.anchorParcelId);
  if (!requirements || !anchor || pending.parcelIds.length >= requirements.requiredParcels)
    return [];
  const current = economy.parcels.filter((parcel) => selected.has(parcel.id));
  return economy.parcels
    .filter(
      (parcel) =>
        !selected.has(parcel.id) &&
        purchaseIds.has(parcel.id) &&
        isParcelEligibleForSite(economy, parcel, pending.buildingType, anchor, "purchasable") &&
        (!requirements.requireEdgeContiguous || parcelsAreEdgeConnected([...current, parcel])),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function siteAssemblyIssueMessage(issue: SiteAssemblyIssue): string {
  switch (issue) {
    case "wrong-parcel-count":
      return "Faltan solares para completar el número de parcelas del proyecto.";
    case "area-too-small":
      return "La superficie combinada no alcanza el mínimo del proyecto.";
    case "not-edge-contiguous":
      return "Los solares seleccionados deben compartir un borde; una calle o una esquina no valen.";
    case "parcel-not-eligible":
      return "Cada solar debe ser propio, estar vacío, compartir el código urbanístico y permitir este uso.";
  }
}

export function addParcelToSite(
  economy: Economy,
  pending: PendingDevelopmentSite,
  parcelId: string,
): PendingDevelopmentSite | null {
  if (!siteAssemblyCandidates(economy, pending).some((parcel) => parcel.id === parcelId))
    return null;
  return { ...pending, parcelIds: [...pending.parcelIds, parcelId].sort() };
}

export function removeParcelFromSite(
  pending: PendingDevelopmentSite,
  parcelId: string,
): PendingDevelopmentSite | null {
  const parcelIds = pending.parcelIds.filter((id) => id !== parcelId);
  return parcelIds.length > 0
    ? {
        ...pending,
        anchorParcelId:
          parcelId === pending.anchorParcelId ? parcelIds[0]! : pending.anchorParcelId,
        parcelIds,
      }
    : null;
}

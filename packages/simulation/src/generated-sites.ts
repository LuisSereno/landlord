import type { DistrictId } from "@landlord/shared";

import { BUILDING_DEFINITIONS } from "./game-data";
import { enumerateCompatibleDevelopmentSites } from "./development-site";
import { type GameState } from "./state";

export type GeneratedSiteSummary = {
  twoParcel: { total: number; disjoint: number };
  threeParcel: { total: number; disjoint: number };
};

export function selectDisjointSites<T extends readonly string[]>(sites: readonly T[]): T[] {
  const consumed = new Set<string>();
  const selected: T[] = [];
  for (const site of [...sites].sort((left, right) =>
    left.join(",").localeCompare(right.join(",")),
  )) {
    if (site.some((id) => consumed.has(id))) continue;
    for (const id of site) consumed.add(id);
    selected.push(site);
  }
  return selected;
}

/** Physical/cadastral capacity only: ownership is intentionally ignored for generation evidence. */
export function generatedIndustrialSites(
  state: GameState,
  districtIds?: ReadonlySet<DistrictId>,
): GeneratedSiteSummary {
  const parcels = [...state.phase2.parcels.values()].filter(
    (parcel) =>
      parcel.disposition === "marketable" &&
      (districtIds === undefined || districtIds.has(parcel.districtId)),
  );
  const two = enumerateCompatibleDevelopmentSites({
    parcels,
    definition: BUILDING_DEFINITIONS.cement_plant,
  });
  const three = enumerateCompatibleDevelopmentSites({
    parcels,
    definition: BUILDING_DEFINITIONS.steelworks,
  });
  return {
    twoParcel: { total: two.length, disjoint: selectDisjointSites(two).length },
    threeParcel: { total: three.length, disjoint: selectDisjointSites(three).length },
  };
}

import { describe, expect, it } from "vitest";

import {
  addParcelToSite,
  parcelsAreEdgeConnected,
  siteAssemblyCandidates,
  siteAssemblyIssues,
} from "./site-assembly";
import type { Economy, ProjectedParcel } from "./types";

const parcel = (id: string, cells: Array<{ x: number; y: number }>): ProjectedParcel =>
  ({
    id,
    cell: cells[0],
    cells,
    roadFrontages: [],
    ownerOrganizationId: "org_00000001",
    disposition: "marketable",
    buildingIds: [],
    developmentCodeId: "code_00000001",
    permittedBuildingTypes: ["apartment_block"],
  }) as unknown as ProjectedParcel;

function economy(parcels: ProjectedParcel[]): Economy {
  return {
    parcels,
    constructionSites: [],
    constructionOptions: [
      {
        type: "apartment_block",
        siteRequirements: {
          requiredParcels: 2,
          minCombinedAreaCells: 4,
          requireEdgeContiguous: true,
        },
      },
    ],
  } as unknown as Economy;
}

describe("site assembly", () => {
  it("requiere conexión real por borde de las celdas", () => {
    expect(
      parcelsAreEdgeConnected([parcel("a", [{ x: 0, y: 0 }]), parcel("b", [{ x: 1, y: 0 }])]),
    ).toBe(true);
    expect(
      parcelsAreEdgeConnected([parcel("a", [{ x: 0, y: 0 }]), parcel("b", [{ x: 1, y: 1 }])]),
    ).toBe(false);
  });

  it("sólo propone solares propios, vacíos, compatibles y contiguos", () => {
    const first = parcel("parcel_a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    const adjacent = parcel("parcel_b", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    const diagonal = parcel("parcel_c", [{ x: 2, y: 2 }]);
    const state = economy([first, adjacent, diagonal]);
    const pending = { buildingType: "apartment_block" as const, parcelIds: [first.id] };
    expect(siteAssemblyCandidates(state, pending).map((entry) => entry.id)).toEqual([adjacent.id]);
    expect(addParcelToSite(state, pending, adjacent.id)?.parcelIds).toEqual([
      first.id,
      adjacent.id,
    ]);
    expect(siteAssemblyIssues(state, { ...pending, parcelIds: [first.id, adjacent.id] })).toEqual(
      [],
    );
  });
});

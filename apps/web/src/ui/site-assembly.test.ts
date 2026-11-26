import { describe, expect, it } from "vitest";
import { parseOrganizationId } from "@landlord/shared";

import {
  addParcelToSite,
  parcelsAreEdgeConnected,
  removeParcelFromSite,
  siteAssemblyCandidates,
  siteAssemblyIssues,
  siteAssemblyPurchaseCandidates,
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

  it("separa las candidatas comprables de las que ya pueden añadirse", () => {
    const first = parcel("parcel_a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    const purchasable: ProjectedParcel = {
      ...parcel("parcel_b", [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
      ownerOrganizationId: null,
    };
    const state = economy([first, purchasable]);
    const pending = {
      buildingType: "apartment_block" as const,
      anchorParcelId: first.id,
      parcelIds: [first.id],
      targetParcelIds: [first.id, purchasable.id],
      purchaseParcelIds: [purchasable.id],
    };
    expect(siteAssemblyCandidates(state, pending)).toEqual([]);
    expect(siteAssemblyPurchaseCandidates(state, pending).map((entry) => entry.id)).toEqual([
      purchasable.id,
    ]);
    expect(addParcelToSite(state, pending, purchasable.id)).toBeNull();
    purchasable.ownerOrganizationId = parseOrganizationId("org_00000001");
    expect(siteAssemblyCandidates(state, pending).map((entry) => entry.id)).toEqual([
      purchasable.id,
    ]);
  });

  it("no permite sustituir el conjunto legal confirmado por otro contiguo", () => {
    const first = parcel("parcel_a", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
    const target = parcel("parcel_b", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    const other = parcel("parcel_c", [
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
    const state = economy([first, target, other]);
    const pending = {
      buildingType: "apartment_block" as const,
      anchorParcelId: first.id,
      parcelIds: [first.id],
      targetParcelIds: [first.id, target.id],
    };
    expect(siteAssemblyCandidates(state, pending).map((entry) => entry.id)).toEqual([target.id]);
    const assembled = addParcelToSite(state, pending, target.id)!;
    expect(
      siteAssemblyCandidates(state, removeParcelFromSite(assembled, first.id)!).map(
        (entry) => entry.id,
      ),
    ).toEqual([first.id]);
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
    const pending = {
      buildingType: "apartment_block" as const,
      anchorParcelId: first.id,
      parcelIds: [first.id],
      targetParcelIds: [first.id, adjacent.id],
    };
    expect(siteAssemblyCandidates(state, pending).map((entry) => entry.id)).toEqual([adjacent.id]);
    expect(addParcelToSite(state, pending, adjacent.id)?.parcelIds).toEqual([
      first.id,
      adjacent.id,
    ]);
    expect(siteAssemblyIssues(state, { ...pending, parcelIds: [first.id, adjacent.id] })).toEqual(
      [],
    );
    expect(
      removeParcelFromSite({ ...pending, parcelIds: [first.id, adjacent.id] }, first.id),
    ).toMatchObject({ anchorParcelId: adjacent.id, parcelIds: [adjacent.id] });
  });
});

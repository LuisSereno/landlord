import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Economy, GameCalendar, ProjectedParcel } from "./types";
import { BuildCatalog } from "./build-catalog";

describe("BuildCatalog headquarters guidance", () => {
  it("shows the headquarters on a residential lot as disabled with the office-zoning reason", () => {
    const economy = {
      constructionOptions: [
        {
          type: "headquarters",
          name: "Sede operativa",
          allowedUses: ["office"],
          municipal: false,
          densityBonusFloors: 0,
          densityBonusFarPercent: 0,
          cost: 4500,
          baseCost: 4500,
          workRequired: 96,
          capacity: 0,
          baseRent: 0,
          resources: { cement: 4, brick: 8, steel: 2 },
          upgradeCost: 0,
          upgradeWorkRequired: 1,
          upgradeResources: { cement: 0, brick: 0, steel: 0 },
          upgradeRentBonusPercent: 0,
          production: null,
          siteRequirements: {
            requiredParcels: 2,
            minCombinedAreaCells: 16,
            requireEdgeContiguous: true,
          },
        },
      ],
      buildings: [],
      constructionSites: [],
      inventory: { cement: 8, brick: 16, steel: 6 },
      cash: 11082,
      crews: [{ assignedWorkOrderId: null }],
    } as unknown as Economy;
    const parcel = {
      id: "parcel_00000001",
      buildingIds: [],
      permittedBuildingTypes: [],
    } as unknown as ProjectedParcel;
    const markup = renderToStaticMarkup(
      <BuildCatalog
        calendar={{ ticksPerDay: 24 } as GameCalendar}
        economy={economy}
        onBeginPlacement={() => undefined}
        onBeginSite={() => undefined}
        parcel={parcel}
      />,
    );

    expect(markup).toContain("Sede operativa");
    expect(markup).toContain("Comercio y mixto");
    expect(markup).toContain("La sede necesita un solar mixto cuyo código permita oficinas.");
  });
});

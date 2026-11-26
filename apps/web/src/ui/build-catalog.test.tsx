// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { parseDistrictId, parseParcelId, type DevelopmentAvailability } from "@landlord/shared";

import { BuildCatalog } from "./build-catalog";
import type { Economy, GameCalendar, ProjectedParcel } from "./types";
import type { PendingDevelopmentSite } from "./site-assembly";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function fixture() {
  const economy = {
    district: { id: "district_00000001", name: "Barrio del Umbral" },
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
    permittedBuildingTypes: ["headquarters"],
  } as unknown as ProjectedParcel;
  return { economy, parcel };
}

function availability(overrides: Partial<DevelopmentAvailability> = {}): DevelopmentAvailability {
  return {
    districtId: parseDistrictId("district_00000001"),
    anchorParcelId: parseParcelId("parcel_00000001"),
    buildingType: "headquarters",
    available: true,
    parcelIds: [parseParcelId("parcel_00000001"), parseParcelId("parcel_00000002")],
    purchaseParcelIds: [],
    acquisitionCost: 0,
    rejection: null,
    ...overrides,
  };
}

describe("BuildCatalog headquarters guidance", () => {
  let container: HTMLElement | undefined;
  let root: Root | undefined;

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  const mount = (
    checkAvailability: () => Promise<DevelopmentAvailability | null>,
    onBeginSite: (site: PendingDevelopmentSite) => void,
  ) => {
    const { economy, parcel } = fixture();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <BuildCatalog
          availabilityKey="test"
          calendar={{ ticksPerDay: 24 } as GameCalendar}
          checkAvailability={checkAvailability}
          economy={economy}
          onBeginPlacement={() => undefined}
          onBeginSite={onBeginSite}
          parcel={parcel}
        />,
      );
    });
  };

  const selectHeadquarters = async () => {
    const card = [...container!.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Sede operativa"),
    );
    expect(card).toBeDefined();
    await act(async () => {
      card!.click();
      await Promise.resolve();
    });
    return container!.querySelector<HTMLButtonElement>(".build-detail .primary-action")!;
  };

  it("shows the headquarters on a residential lot as disabled with the office-zoning reason", () => {
    const { economy, parcel } = fixture();
    parcel.permittedBuildingTypes = [];
    const markup = renderToStaticMarkup(
      <BuildCatalog
        availabilityKey="test"
        calendar={{ ticksPerDay: 24 } as GameCalendar}
        checkAvailability={() => Promise.resolve(null)}
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

  it("no ofrece iniciar la sede cuando el motor no encuentra un conjunto legal", async () => {
    mount(
      () =>
        Promise.resolve(
          availability({
            available: false,
            parcelIds: [],
            rejection: "PARCELS_NOT_EDGE_CONTIGUOUS",
          }),
        ),
      () => undefined,
    );
    const primary = await selectHeadquarters();
    expect(primary.disabled).toBe(true);
    expect(container!.textContent).toContain("Los solares deben compartir un borde");
    expect(container!.textContent).not.toContain("Solar legal confirmado por el motor");
  });

  it("transfiere los solares comprables al ensamblado cuando el motor confirma la opción", async () => {
    let started: PendingDevelopmentSite | null = null;
    mount(
      () =>
        Promise.resolve(
          availability({
            purchaseParcelIds: [parseParcelId("parcel_00000002")],
            acquisitionCost: 102,
          }),
        ),
      (site) => {
        started = site;
      },
    );
    const primary = await selectHeadquarters();
    expect(primary.disabled).toBe(false);
    await act(async () => primary.click());
    expect(started).toMatchObject({
      buildingType: "headquarters",
      anchorParcelId: "parcel_00000001",
      parcelIds: ["parcel_00000001"],
      targetParcelIds: [parseParcelId("parcel_00000001"), parseParcelId("parcel_00000002")],
      purchaseParcelIds: [parseParcelId("parcel_00000002")],
    });
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ViewProjectionV3 } from "@landlord/shared";
import { ContextPanel, type PanelContext } from "./panels";
import { resolveContextSelection } from "./selection";
import { building, economy, parcel } from "./status-fixtures";
import type { GameActions } from "./types";
import type { PanelSectionRequest } from "./world-indicators";

/**
 * V.d-UX.S · gate S5: el routing de pestaña tiene que ser REACTIVO. `useState(sección)` sólo se
 * inicializa en el primer montaje, así que un segundo badge sobre el MISMO edificio dejaría la
 * pestaña obsoleta. Este test monta el panel de verdad en un DOM y dispara peticiones sucesivas
 * con token nuevo, que es exactamente el caso que el montaje estático no puede cubrir.
 */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const projectionOf = (e: ReturnType<typeof economy>) =>
  ({
    observedDistrictId: "district_00000001",
    tick: 20,
    movement: { ticksPerCell: 10 },
    facilities: [],
    publicSpaces: [],
    economy: e,
    agents: [],
  }) as unknown as ViewProjectionV3;

function contextFor(
  e: ReturnType<typeof economy>,
  request?: PanelSectionRequest,
  pendingSite: PanelContext["pendingSite"] = null,
): PanelContext {
  return {
    economy: e,
    projection: projectionOf(e),
    projectionDistrictName: "Barrio del Umbral",
    calendar: e.gameTime,
    actions: {} as GameActions,
    onClose: () => {},
    onOpenHub: () => {},
    onSelectBuilding: () => {},
    pendingSite,
    onBeginSite: () => {},
    onUpdateSite: () => {},
    onCancelSite: () => {},
    availabilityKey: "test",
    checkAvailability: () => Promise.resolve(null),
    pendingPlacement: null,
    placementHandlers: null,
    placementBlockers: [],
    placementSubmitting: false,
    onBeginPlacement: () => {},
    sectionRequest: request,
  };
}

describe("V.d-UX.S · routing reactivo de la pestaña del edificio", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (e: ReturnType<typeof economy>, request?: PanelSectionRequest) => {
    const selection = resolveContextSelection({
      economy: e,
      projection: projectionOf(e),
      target: { kind: "building", buildingId: "building_00000001" },
    });
    expect(selection?.kind).toBe("building");
    act(() => {
      root.render(<ContextPanel selection={selection!} context={contextFor(e, request)} />);
    });
  };

  const activeTab = () => container.querySelector('.tab[aria-pressed="true"]')?.textContent ?? "";

  it("tres peticiones sucesivas sobre el mismo edificio cambian la pestaña", () => {
    const e = economy({ parcels: [parcel()], buildings: [building()] });
    render(e);
    expect(activeTab()).toContain("Resumen");

    render(e, { section: "insurance", token: 1 });
    expect(activeTab()).toContain("Seguro");

    render(e, { section: "maintenance", token: 2 });
    expect(activeTab()).toContain("Mantenimiento");

    render(e, { section: "finance", token: 3 });
    expect(activeTab()).toContain("Finanzas");
  });

  it("un token repetido no vuelve a imponer la sección tras un click manual", () => {
    const e = economy({ parcels: [parcel()], buildings: [building()] });
    render(e, { section: "insurance", token: 1 });
    expect(activeTab()).toContain("Seguro");
    /** El jugador elige Resumen a mano. */
    act(() => {
      const summary = [...container.querySelectorAll("button.tab")].find((node) =>
        node.textContent?.includes("Resumen"),
      );
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(activeTab()).toContain("Resumen");
    /** Llega otra proyección con el MISMO token ya consumido: no debe pisar al jugador. */
    render(e, { section: "insurance", token: 1 });
    expect(activeTab()).toContain("Resumen");
  });

  it("cambiar de edificio sin petición vuelve al resumen", () => {
    const first = economy({ parcels: [parcel()], buildings: [building()] });
    render(first, { section: "insurance", token: 1 });
    expect(activeTab()).toContain("Seguro");
    const second = economy({
      parcels: [parcel({ id: "parcel_00000002" })],
      buildings: [building({ id: "building_00000002", parcelIds: ["parcel_00000002"] })],
    });
    const selection = resolveContextSelection({
      economy: second,
      projection: projectionOf(second),
      target: { kind: "building", buildingId: "building_00000002" },
    });
    act(() => {
      root.render(<ContextPanel selection={selection!} context={contextFor(second)} />);
    });
    expect(activeTab()).toContain("Resumen");
  });

  it("la cabecera muestra los chips de estado del activo", () => {
    const e = economy({
      parcels: [parcel()],
      buildings: [building({ upgraded: true, tenantIds: [], maintenanceDue: 400 })],
      insurance: {
        offers: [],
        claims: [],
        contracts: [
          {
            buildingId: "building_00000001",
            insurerOrganizationId: "org_00000005",
            coverage: "fire_basic",
            premium: 25,
            coverageLimit: 1800,
            deductible: 200,
            exclusions: ["sabotage", "blast"],
            status: "lapsed",
            purchasedAtTick: 0,
            lastPremiumTick: 0,
            nextPremiumTick: null,
            totalPremiumPaid: 25,
          },
        ],
      },
    });
    render(e);
    const chips = [...container.querySelectorAll(".chip-row .chip")].map(
      (node) => node.textContent,
    );
    expect(chips.join(" | ")).toContain("Mejorado");
    expect(chips.join(" | ")).toContain("sin inquilinos");
    expect(chips.join(" | ")).toContain("póliza vencida");
    expect(chips.join(" | ")).toContain("Atraso 360 u.");
  });

  it("el ensamblado sustituye al catálogo y ofrece comprar la candidata autoritativa", () => {
    const anchor = parcel({
      id: "parcel_00000001",
      cells: [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ],
      developmentCodeId: "mixed_core_5f",
      permittedBuildingTypes: ["headquarters"],
      productionSuitability: { cement: 100, brick: 100, steel: 100 },
    });
    const candidate = parcel({
      id: "parcel_00000002",
      cell: { x: 12, y: 10 },
      cells: [{ x: 12, y: 10 }],
      ownerOrganizationId: null,
      developmentCodeId: "mixed_core_5f",
      permittedBuildingTypes: ["headquarters"],
      marketValue: 100,
      productionSuitability: { cement: 100, brick: 100, steel: 100 },
    });
    const e = economy({
      parcels: [anchor, candidate],
      constructionOptions: [
        {
          type: "headquarters",
          siteRequirements: {
            requiredParcels: 2,
            minCombinedAreaCells: 16,
            requireEdgeContiguous: true,
          },
        },
      ],
    });
    const pendingSite = {
      buildingType: "headquarters" as const,
      anchorParcelId: "parcel_00000001",
      parcelIds: ["parcel_00000001"],
      targetParcelIds: ["parcel_00000001", "parcel_00000002"],
      purchaseParcelIds: ["parcel_00000002"],
    };
    const selection = resolveContextSelection({
      economy: e,
      projection: projectionOf(e),
      target: { kind: "parcel", parcelId: "parcel_00000002" },
    });
    act(() => {
      root.render(
        <ContextPanel selection={selection!} context={contextFor(e, undefined, pendingSite)} />,
      );
    });
    expect(container.textContent).toContain("Proyecto en preparación");
    expect(container.textContent).toContain("Comprar para ampliar");
    expect(container.textContent).not.toContain("Qué construir");
    expect(container.textContent).not.toContain("Añadir 1 solar");
  });

  it("finanzas separa la hipoteca del activo de la deuda de la cartera", () => {
    const e = economy({
      parcels: [parcel()],
      buildings: [building()],
      banking: {
        offers: [],
        auctions: [],
        loans: [
          {
            id: "loan_00000001",
            status: "active",
            outstandingPrincipal: 600,
            monthlyPayment: 55,
            remainingMonths: 12,
            missedPayments: 0,
            collateralParcelId: "parcel_00000001",
            nextPaymentTick: 36000,
          },
        ],
      },
      financials: { liabilities: 5000 },
    });
    render(e, { section: "finance", token: 1 });
    const text = container.textContent ?? "";
    expect(text).toContain("Hipoteca del activo");
    expect(text).toContain("600 u.");
    expect(text).toContain("Deuda de la cartera");
    expect(text).toContain("5000 u.");
  });
});

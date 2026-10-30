import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ViewProjectionV2 } from "@landlord/shared";

import { HelpPopover, HelpTooltip, helpCatalog, type HelpTopicKey } from "./help";
import {
  constructionBlockedReasons,
  missingResourceLines,
  tenantBlockedReason,
} from "./disabled-reasons";
import {
  deriveNotifications,
  groupNotifications,
  sanitizeAlertMessage,
  unreadCount,
} from "./notifications";
import { deriveOnboardingStep } from "./onboarding";
import { resolveContextSelection } from "./selection";
import { deriveWorldIndicators } from "./world-indicators";
import { groupConstructionOptions } from "./build-catalog";
import type { Economy } from "./types";

const PLAYER = "org_00000001";

const baseEconomy = {
  cash: 10_000,
  district: { id: "district_00000001", name: "Barrio del Umbral" },
  inventory: { cement: 8, brick: 16, steel: 6 },
  crew: { used: 0, capacity: 2 },
  crews: [
    { id: "crew_00000001", assignedWorkOrderId: null },
    { id: "crew_00000002", assignedWorkOrderId: null },
  ],
  parcels: [],
  buildings: [],
  constructionSites: [],
  constructionOptions: [],
  tenants: [],
  production: [],
  insurance: { contracts: [], offers: [], claims: [] },
  banking: { offers: [], loans: [], auctions: [] },
  alerts: [],
  gameTime: {
    month: 1,
    day: 1,
    hour: 0,
    ticksPerMonth: 36_000,
    ticksPerDay: 1_200,
    daysPerMonth: 30,
  },
  financials: {
    assets: 0,
    liabilities: 0,
    equity: 0,
    period: { month: 1, income: 0, expenses: 0, netIncome: 0, cashFlow: 0 },
    forecast: { income: 0, expenses: 0, netCashFlow: 0, closingCash: 0, shortfall: 0 },
  },
  taxation: { playerArrears: 0 },
  ordinance: { status: "active" },
  influence: 0,
  maintenance: { policy: "balanced", repairCost: 400 },
} as unknown as Economy;

function economy(overrides: Partial<Record<string, unknown>>): Economy {
  return {
    ...(baseEconomy as unknown as Record<string, unknown>),
    ...overrides,
  } as unknown as Economy;
}

const parcel = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "parcel_00000001",
    cell: { x: 10, y: 10 },
    cells: [{ x: 10, y: 10 }],
    disposition: "marketable",
    buildingIds: [],
    ownerOrganizationId: null,
    urbanRole: "urban_residential",
    permittedBuildingTypes: ["courtyard_home"],
    potentialService: { security: 100, fire: 100, health: 0, education: 0, market: 0 },
    ...overrides,
  }) as never;

const building = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "building_00000001",
    parcelIds: ["parcel_00000001"],
    ownerOrganizationId: PLAYER,
    type: "courtyard_home",
    condition: 100,
    state: "operational",
    footprintCells: [{ x: 10, y: 10 }],
    tenantIds: [],
    capacity: 2,
    ...overrides,
  }) as never;

describe("V.d-UX · contratos de la interfaz", () => {
  it("el catálogo de ayuda cubre los conceptos no triviales y todos tienen resumen", () => {
    const required: HelpTopicKey[] = [
      "profitability",
      "land_value",
      "production_suitability",
      "services",
      "regulation",
      "influence",
      "permits",
      "maintenance",
      "debt",
      "collateral",
      "insurance",
      "ordinance",
      "first_steps",
      "notifications",
      "overlays",
    ];
    for (const topic of required) {
      expect(helpCatalog[topic], topic).toBeDefined();
      expect(helpCatalog[topic].title.length, topic).toBeGreaterThan(0);
      expect(helpCatalog[topic].summary.length, topic).toBeGreaterThan(10);
    }
    const markup = renderToStaticMarkup(<HelpTooltip topic="debt" />);
    expect(markup).toContain("aria-describedby");
    expect(markup).toContain('role="tooltip"');
    const popover = renderToStaticMarkup(<HelpPopover topic="services" />);
    expect(popover).toContain("Ayuda sobre Servicios municipales");
  });

  it("las acciones bloqueadas explican la causa con números y sin enums", () => {
    const reasons = constructionBlockedReasons({
      option: {
        type: "courtyard_home",
        cost: 3000,
        resources: { cement: 10, brick: 16, steel: 6 },
      } as never,
      economy: baseEconomy,
      parcelOwned: true,
      hasBuilding: false,
      permitted: true,
    });
    expect(reasons.map((reason) => reason.message)).toContain("Te faltan 2 de cemento.");
    const broke = constructionBlockedReasons({
      option: {
        type: "courtyard_home",
        cost: 99_999,
        resources: { cement: 0, brick: 0, steel: 0 },
      } as never,
      economy: baseEconomy,
      parcelOwned: false,
      hasBuilding: true,
      permitted: false,
    });
    const text = broke.map((reason) => reason.message).join(" | ");
    expect(text).toContain("Necesitas comprar la parcela");
    expect(text).toContain("La parcela no permite este uso");
    expect(text).toContain("La parcela ya tiene un edificio");
    expect(text).toContain("Te faltan 89999 u.");
    expect(text).not.toMatch(/not_owned|use_not_permitted|not_enough_cash/);
    expect(missingResourceLines(baseEconomy.inventory, { cement: 8, brick: 16, steel: 6 })).toEqual(
      [],
    );
    expect(tenantBlockedReason(100, 180)?.message).toContain("no puede pagar la renta");
    expect(tenantBlockedReason(200, 180)).toBeNull();
  });

  it("las notificaciones se categorizan, se sanean y resuelven su destino", () => {
    const alerts: Economy["alerts"] = [
      {
        id: "liquidity-forecast",
        severity: "high",
        kind: "liquidity",
        message: "La previsión mensual queda corta en 120 u.",
        targetId: null,
      },
      {
        id: "occupancy-building_00000001",
        severity: "low",
        kind: "occupancy",
        message: "building_00000001 tiene 2 plaza(s) vacante(s).",
        targetId: "parcel_00000001",
      },
    ];
    const economyWithAlerts = economy({
      alerts,
      buildings: [building({ type: "courtyard_home" })],
      parcels: [parcel()],
    });
    const notifications = deriveNotifications(economyWithAlerts);
    expect(notifications[0]?.category).toBe("urgent");
    expect(notifications[0]?.target).toEqual({ kind: "hub", hub: "finance" });
    expect(notifications[0]?.actionLabel).toBe("Abrir Finanzas");
    expect(notifications[1]?.category).toBe("properties");
    expect(notifications[1]?.title).toBe("Plazas vacantes");
    expect(notifications[1]?.target).toEqual({ kind: "parcel", parcelId: "parcel_00000001" });
    expect(notifications[1]?.body).not.toMatch(/building_\d+/);
    expect(notifications[1]?.body).toContain("Patio residencial");
    expect(unreadCount(notifications, new Set())).toBe(2);
    expect(unreadCount(notifications, new Set([notifications[1]!.id]))).toBe(1);
    expect(groupNotifications(notifications).map((group) => group.category)).toEqual([
      "urgent",
      "properties",
    ]);
    expect(
      sanitizeAlertMessage("El préstamo loan_00000004 está en atraso", economyWithAlerts),
    ).toBe("El préstamo está en atraso");
  });

  it("el onboarding propone un paso según el estado y se detiene al completarlo", () => {
    expect(deriveOnboardingStep(undefined)).toBeNull();
    expect(deriveOnboardingStep(economy({}))?.id).toBe("first_parcel");
    const owned = parcel({ ownerOrganizationId: PLAYER });
    const noMaterials = economy({
      parcels: [owned],
      constructionOptions: [
        {
          type: "courtyard_home",
          municipal: false,
          cost: 3000,
          resources: { cement: 20, brick: 2, steel: 0 },
        },
      ],
    });
    expect(deriveOnboardingStep(noMaterials)?.id).toBe("resources");
    const withSites = economy({
      parcels: [owned],
      constructionSites: [
        {
          id: "site_00000001",
          parcelIds: ["parcel_00000001"],
          ownerOrganizationId: PLAYER,
          assignedCrewIds: [],
        },
      ],
    });
    expect(deriveOnboardingStep(withSites)?.id).toBe("crew");
    const occupied = economy({
      parcels: [owned],
      buildings: [building({ tenantIds: ["tenant_00000001"] })],
    });
    expect(deriveOnboardingStep(occupied)).toBeNull();
  });

  it("la selección abre la superficie correcta y el suelo municipal no es un rival", () => {
    const projection = {
      observedDistrictId: "district_00000001",
      facilities: [{ id: "facility_1", kind: "police_station", parcelIds: ["parcel_public"] }],
      publicSpaces: [{ id: "space_1", kind: "plaza", cells: [{ x: 20, y: 20 }] }],
    } as unknown as ViewProjectionV2;
    const publicParcel = parcel({
      id: "parcel_public",
      cell: { x: 30, y: 30 },
      cells: [{ x: 30, y: 30 }],
      disposition: "public",
      ownerOrganizationId: "org_00000004",
    });
    const owned = parcel({ buildingIds: ["building_rival", "building_own"] });
    const rivalBuilding = building({ id: "building_rival", ownerOrganizationId: "org_00000002" });
    const ownBuilding = building({ id: "building_own" });
    const economyFixture = economy({
      parcels: [owned, publicParcel],
      buildings: [rivalBuilding, ownBuilding],
      constructionSites: [
        {
          id: "site_1",
          parcelIds: ["parcel_other"],
          ownerOrganizationId: PLAYER,
          assignedCrewIds: [],
        },
      ],
    });
    expect(
      resolveContextSelection({
        economy: economyFixture,
        projection,
        cell: { x: 10, y: 10 },
        selectedBuildingId: null,
      })?.kind,
    ).toBe("parcel");
    const rival = resolveContextSelection({
      economy: economyFixture,
      projection,
      cell: { x: 10, y: 10 },
      selectedBuildingId: "building_rival" as never,
    });
    expect(rival?.kind).toBe("building");
    expect(rival && "owned" in rival ? rival.owned : null).toBe(false);
    const facility = resolveContextSelection({
      economy: economyFixture,
      projection,
      cell: { x: 30, y: 30 },
      selectedBuildingId: null,
    });
    expect(facility?.kind).toBe("facility");
    expect(
      resolveContextSelection({
        economy: economyFixture,
        projection,
        cell: { x: 99, y: 99 },
        selectedBuildingId: null,
      }),
    ).toBeNull();
  });

  it("los indicadores de mundo priorizan lo crítico, excluyen rivales y respetan el tope", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      building({
        id: `building_${String(index).padStart(8, "0")}`,
        condition: 40,
      }),
    );
    const indicators = deriveWorldIndicators(
      economy({
        buildings: [
          ...many,
          building({ id: "building_burning", state: "burning" }),
          building({ id: "building_rival", ownerOrganizationId: "org_00000002", state: "burning" }),
        ],
        constructionSites: [
          {
            id: "site_1",
            parcelIds: ["parcel_00000001"],
            ownerOrganizationId: PLAYER,
            assignedCrewIds: [],
            footprintCells: [{ x: 1, y: 1 }],
          },
        ],
      }),
    );
    expect(indicators.length).toBe(12);
    expect(indicators[0]?.critical).toBe(true);
    expect(indicators[0]?.kind).toBe("danger");
    expect(indicators.some((entry) => entry.buildingId === "building_rival")).toBe(false);
    expect(deriveWorldIndicators(undefined)).toEqual([]);
  });

  it("el catálogo agrupa los tipos reales sin dejar tarjetas fuera", () => {
    const types = [
      "courtyard_home",
      "row_house",
      "apartment_block",
      "workshop",
      "mixed_tenement",
      "warehouse",
      "cement_plant",
      "brickworks",
      "steelworks",
    ];
    const options = types.map((type) => ({ type })) as never;
    const groups = groupConstructionOptions(options);
    expect(groups.map((group) => group.id)).toEqual(["housing", "mixed", "industry", "production"]);
    expect(groups.flatMap((group) => group.options)).toHaveLength(types.length);
  });
});

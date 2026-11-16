import type { Economy } from "./types";

/**
 * V.d-UX.S · fixtures SÓLO de test para las puertas de estado. Ningún módulo de producción las
 * importa, así que no entran en el bundle. Reproducen el patrón de `ux-contracts.test.tsx`:
 * economía mínima con casts, porque el contrato completo tiene decenas de secciones que estos
 * casos no ejercitan.
 */

export const PLAYER = "org_00000001";
export const RIVAL = "org_00000002";
export const CIVIC = "org_00000004";

const baseEconomy = {
  cash: 10_000,
  district: { id: "district_00000001", name: "Barrio del Umbral" },
  inventory: { cement: 8, brick: 16, steel: 6 },
  crew: { used: 0, capacity: 2 },
  crews: [],
  parcels: [],
  buildings: [],
  constructionSites: [],
  constructionOptions: [],
  tenants: [],
  production: [],
  insurance: { contracts: [], offers: [], claims: [] },
  banking: { bankOrganizationId: "org_00000003", offers: [], loans: [], auctions: [] },
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
  maintenance: { policy: "balanced", repairCost: 400, backlog: 0 },
} as unknown as Economy;

export function economy(overrides: Partial<Record<string, unknown>> = {}): Economy {
  return {
    ...(baseEconomy as unknown as Record<string, unknown>),
    ...overrides,
  } as unknown as Economy;
}

export function parcel(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "parcel_00000001",
    cell: { x: 10, y: 10 },
    cells: [{ x: 10, y: 10 }],
    roadFrontages: [],
    disposition: "marketable",
    buildingIds: [],
    ownerOrganizationId: PLAYER,
    zoning: "residential",
    urbanRole: "urban_residential",
    developmentCodeId: "urban_residential_2f",
    currentUses: ["residential"],
    allowedUses: ["residential"],
    permittedBuildingTypes: ["courtyard_home"],
    regulatoryRiskPercent: 0,
    landValueBreakdown: { score: 10 },
    serviceCoverage: { security: 0, fire: 0, health: 0, education: 0, transport: 0 },
    potentialService: { security: 100, fire: 100, health: 0, education: 0, market: 0 },
    ...overrides,
  } as never;
}

export function building(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "building_00000001",
    parcelIds: ["parcel_00000001"],
    districtId: "district_00000001",
    ownerOrganizationId: PLAYER,
    productionFacilityId: null,
    type: "courtyard_home",
    footprintCells: [{ x: 10, y: 10 }],
    orientation: 0,
    floors: 1,
    form: "detached",
    level: 1,
    condition: 100,
    tenantId: null,
    tenantIds: [],
    capacity: 2,
    upgraded: false,
    structuralIntegrity: 100,
    state: "operational",
    casualtiesTotal: { injured: 0, dead: 0 },
    effectiveRent: 100,
    maintenanceCost: 40,
    maintenanceDue: 40,
    ...overrides,
  } as never;
}

export function loan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "loan_00000001",
    status: "active",
    outstandingPrincipal: 600,
    monthlyPayment: 55,
    remainingMonths: 12,
    missedPayments: 0,
    collateralParcelId: "parcel_00000001",
    nextPaymentTick: 36_000,
    ...overrides,
  } as never;
}

export function auction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    loanId: "loan_00000001",
    collateralParcelId: "parcel_00000001",
    sellerOrganizationId: PLAYER,
    reservePrice: 500,
    highestBid: 0,
    highestBidderOrganizationId: null,
    status: "open",
    closesAtTick: 40_000,
    ...overrides,
  } as never;
}

export function contract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    buildingId: "building_00000001",
    insurerOrganizationId: "org_00000005",
    coverage: "fire_basic",
    premium: 25,
    coverageLimit: 1800,
    deductible: 200,
    exclusions: ["sabotage", "blast"],
    status: "active",
    purchasedAtTick: 0,
    lastPremiumTick: 0,
    nextPremiumTick: 36_000,
    totalPremiumPaid: 25,
    ...overrides,
  } as never;
}

export function alert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "condition-building_00000001",
    severity: "medium",
    kind: "maintenance",
    reason: "building_condition",
    message: "El edificio está al 40 % de condición.",
    targetId: "parcel_00000001",
    buildingId: "building_00000001",
    ...overrides,
  } as never;
}

export function site(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "site_00000001",
    parcelIds: ["parcel_00000001"],
    districtId: "district_00000001",
    ownerOrganizationId: PLAYER,
    buildingType: "courtyard_home",
    footprintCells: [{ x: 10, y: 10 }],
    orientation: 0,
    floors: 1,
    form: "detached",
    progress: 0,
    workRequired: 48,
    upgradeBuildingId: null,
    repairBuildingId: null,
    crewCapacity: 0,
    kind: "construction",
    assignedCrewIds: [],
    assignedTechnicianId: null,
    ...overrides,
  } as never;
}
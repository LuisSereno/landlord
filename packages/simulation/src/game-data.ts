import {
  parseMoney,
  type Building,
  type BuildingDefinition,
  type DevelopmentCode,
  type InsuranceCoverage,
  type BuildingType,
  type LandUse,
  type Loan,
  type Tenant,
  type TenantProfile,
  type Ordinance,
  type MunicipalParty,
  type UrbanRole,
} from "@landlord/shared";
import { parseTenantId, parsePolicyId, parseOrganizationId } from "@landlord/shared";

export const BUILDING_DEFINITIONS: Record<BuildingDefinition["type"], BuildingDefinition> = {
  courtyard_home: {
    type: "courtyard_home",
    name: "Patio compacto",
    allowedUses: ["residential"],
    cost: parseMoney(3000),
    workRequired: 96,
    capacity: 2,
    baseRent: parseMoney(180),
    upgradeCost: parseMoney(1600),
    upgradeWorkRequired: 48,
    resources: { cement: 4, brick: 8, steel: 2 },
    form: "detached",
    defaultFloors: 1,
    targetFootprintCells: 4,
    municipal: false,
  },
  workshop: {
    type: "workshop",
    name: "Taller de barrio",
    allowedUses: ["industrial", "retail"],
    cost: parseMoney(4200),
    workRequired: 144,
    capacity: 3,
    baseRent: parseMoney(260),
    upgradeCost: parseMoney(2200),
    upgradeWorkRequired: 72,
    resources: { cement: 6, brick: 10, steel: 4 },
    form: "shed",
    defaultFloors: 1,
    targetFootprintCells: 8,
    municipal: false,
  },
  cement_plant: {
    type: "cement_plant",
    name: "Planta de cemento",
    allowedUses: ["industrial", "utility"],
    cost: parseMoney(3800),
    workRequired: 120,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(1900),
    upgradeWorkRequired: 60,
    resources: { cement: 6, brick: 10, steel: 4 },
    form: "shed",
    defaultFloors: 2,
    targetFootprintCells: 10,
    municipal: false,
    production: {
      output: "cement",
      cycleLength: 24,
      outputAmount: 2,
      operatingCost: parseMoney(80),
    },
  },
  brickworks: {
    type: "brickworks",
    name: "Ladrillera",
    allowedUses: ["industrial", "utility"],
    cost: parseMoney(3400),
    workRequired: 120,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(1700),
    upgradeWorkRequired: 60,
    resources: { cement: 5, brick: 8, steel: 3 },
    form: "shed",
    defaultFloors: 2,
    targetFootprintCells: 10,
    municipal: false,
    production: {
      output: "brick",
      cycleLength: 36,
      outputAmount: 2,
      operatingCost: parseMoney(45),
    },
  },
  steelworks: {
    type: "steelworks",
    name: "Acería",
    allowedUses: ["industrial", "utility"],
    cost: parseMoney(5200),
    workRequired: 168,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(2600),
    upgradeWorkRequired: 84,
    resources: { cement: 8, brick: 12, steel: 6 },
    form: "shed",
    defaultFloors: 2,
    targetFootprintCells: 12,
    municipal: false,
    production: {
      output: "steel",
      cycleLength: 72,
      outputAmount: 1,
      operatingCost: parseMoney(100),
    },
  },
  row_house: {
    type: "row_house",
    name: "Casa adosada",
    allowedUses: ["residential"],
    cost: parseMoney(2600),
    workRequired: 84,
    capacity: 2,
    baseRent: parseMoney(160),
    upgradeCost: parseMoney(1400),
    upgradeWorkRequired: 42,
    resources: { cement: 4, brick: 8, steel: 2 },
    form: "row",
    defaultFloors: 2,
    targetFootprintCells: 4,
    municipal: false,
  },
  apartment_block: {
    type: "apartment_block",
    name: "Bloque de viviendas",
    allowedUses: ["residential", "office"],
    cost: parseMoney(5200),
    workRequired: 168,
    capacity: 6,
    baseRent: parseMoney(260),
    upgradeCost: parseMoney(2600),
    upgradeWorkRequired: 84,
    resources: { cement: 8, brick: 12, steel: 5 },
    form: "perimeter",
    defaultFloors: 4,
    targetFootprintCells: 10,
    municipal: false,
  },
  mixed_tenement: {
    type: "mixed_tenement",
    name: "Inmueble mixto",
    allowedUses: ["residential", "retail", "office"],
    cost: parseMoney(4800),
    workRequired: 156,
    capacity: 5,
    baseRent: parseMoney(250),
    upgradeCost: parseMoney(2400),
    upgradeWorkRequired: 78,
    resources: { cement: 7, brick: 11, steel: 4 },
    form: "perimeter",
    defaultFloors: 3,
    targetFootprintCells: 8,
    municipal: false,
  },
  warehouse: {
    type: "warehouse",
    name: "Nave logística",
    allowedUses: ["industrial", "utility"],
    cost: parseMoney(3600),
    workRequired: 120,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(1800),
    upgradeWorkRequired: 60,
    resources: { cement: 6, brick: 8, steel: 4 },
    form: "shed",
    defaultFloors: 1,
    targetFootprintCells: 12,
    municipal: false,
  },
  town_hall: {
    type: "town_hall",
    name: "Ayuntamiento",
    allowedUses: ["civic"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "civic_landmark",
    defaultFloors: 4,
    targetFootprintCells: 12,
    municipal: true,
  },
  school_block: {
    type: "school_block",
    name: "Colegio",
    allowedUses: ["education"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 6,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "pavilion",
    defaultFloors: 3,
    targetFootprintCells: 14,
    municipal: true,
  },
  clinic: {
    type: "clinic",
    name: "Clínica",
    allowedUses: ["health"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 4,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "pavilion",
    defaultFloors: 2,
    targetFootprintCells: 6,
    municipal: true,
  },
  police_station: {
    type: "police_station",
    name: "Comisaría",
    allowedUses: ["civic"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 2,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "pavilion",
    defaultFloors: 2,
    targetFootprintCells: 6,
    municipal: true,
  },
  fire_station: {
    type: "fire_station",
    name: "Parque de bomberos",
    allowedUses: ["civic", "utility"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 2,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "pavilion",
    defaultFloors: 2,
    targetFootprintCells: 8,
    municipal: true,
  },
  market_hall: {
    type: "market_hall",
    name: "Mercado",
    allowedUses: ["retail"],
    cost: parseMoney(0),
    workRequired: 1,
    capacity: 4,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(0),
    upgradeWorkRequired: 1,
    resources: { cement: 0, brick: 0, steel: 0 },
    form: "pavilion",
    defaultFloors: 2,
    targetFootprintCells: 10,
    municipal: true,
  },
};

/**
 * Valores de hogar por perfil. `size` son los ocupantes que cuentan en un siniestro y no consume
 * plazas de capacidad; `segmentId` enlaza el hogar con la demanda segmentada del mercado.
 * Los hogares autorados de Fase 3 y los sintéticos de las pruebas comparten esta tabla para que
 * cargar una partida antigua reproduzca exactamente el mismo recuento de bajas.
 */
export const TENANT_PROFILE_DEFAULTS: Record<TenantProfile, { size: number; segmentId: string }> = {
  household: { size: 3, segmentId: "household" },
  maker: { size: 2, segmentId: "maker" },
  shopkeeper: { size: 2, segmentId: "shopkeeper" },
};

export const PROTOTYPE_TENANTS: Tenant[] = [
  {
    id: parseTenantId("tenant_00000001"),
    profile: "household",
    budget: parseMoney(210),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
    status: "available",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    marketDistrictId: null,
  },
  {
    id: parseTenantId("tenant_00000002"),
    profile: "maker",
    budget: parseMoney(300),
    preferredBuildingType: "workshop",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
    status: "available",
    size: 2,
    segmentId: "maker",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    marketDistrictId: null,
  },
  {
    id: parseTenantId("tenant_00000003"),
    profile: "shopkeeper",
    budget: parseMoney(320),
    preferredBuildingType: "workshop",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
    status: "available",
    size: 2,
    segmentId: "shopkeeper",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    marketDistrictId: null,
  },
  {
    id: parseTenantId("tenant_00000004"),
    profile: "household",
    budget: parseMoney(230),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
    status: "available",
    size: 3,
    segmentId: "household",
    searchMonths: 0,
    incomeFactorPercent: 100,
    origin: "authored",
    marketDistrictId: null,
  },
];

export const PROTOTYPE_ORDINANCE = {
  id: parsePolicyId("policy_00000001"),
  name: "Programa de materiales locales",
  status: "proposed" as const,
  proposedAtTick: null,
  activeFromTick: null,
  expiresAtTick: null,
  materialCostModifierPercent: -20,
  rentModifierPercent: -10,
  influenceRequired: 1,
  approvalChancePercent: 65,
  propertyTaxModifierPercent: 0,
  transferTaxModifierPercent: 0,
  permitApprovalModifierPercent: 0,
};

export const MUNICIPAL_POLICY_CATALOG: readonly Ordinance[] = [
  PROTOTYPE_ORDINANCE,
  {
    id: parsePolicyId("policy_00000002"),
    name: "Renovación de barrio",
    status: "proposed",
    proposedAtTick: null,
    activeFromTick: null,
    expiresAtTick: null,
    materialCostModifierPercent: 10,
    rentModifierPercent: 20,
    influenceRequired: 2,
    approvalChancePercent: 45,
    propertyTaxModifierPercent: -10,
    transferTaxModifierPercent: 10,
    permitApprovalModifierPercent: 15,
  },
  {
    id: parsePolicyId("policy_00000003"),
    name: "Disciplina fiscal",
    status: "proposed",
    proposedAtTick: null,
    activeFromTick: null,
    expiresAtTick: null,
    materialCostModifierPercent: 5,
    rentModifierPercent: 0,
    influenceRequired: 1,
    approvalChancePercent: 60,
    propertyTaxModifierPercent: -25,
    transferTaxModifierPercent: -15,
    permitApprovalModifierPercent: -10,
  },
  {
    id: parsePolicyId("policy_00000004"),
    name: "Tope de renta del Umbral",
    status: "proposed",
    proposedAtTick: null,
    activeFromTick: null,
    expiresAtTick: null,
    materialCostModifierPercent: 5,
    rentModifierPercent: -20,
    influenceRequired: 2,
    approvalChancePercent: 40,
    propertyTaxModifierPercent: 0,
    transferTaxModifierPercent: 0,
    permitApprovalModifierPercent: -15,
  },
];

export function createMunicipalPolicy(policyId: string): Ordinance | null {
  const definition = MUNICIPAL_POLICY_CATALOG.find((policy) => policy.id === policyId);
  return definition ? { ...definition } : null;
}

/**
 * Formaciones ficticias del concejo. Ninguna representa un partido, una ideología ni una
 * organización real: son pesos sobre los cinco asuntos sobre los que la opinión puede quejarse, el
 * orden en el que pagarían el presupuesto si gobernaran y la ordenanza que intentarían aprobar.
 */
export const MUNICIPAL_PARTY_CATALOG: readonly MunicipalParty[] = [
  {
    id: "party_suelo_comun",
    name: "Concentración del Suelo Común",
    positionByIssue: { housing: 90, employment: 35, safety: 60, services: 45, taxes: 50 },
    budgetPriority: ["security", "cleaning", "transport", "administration"],
    preferredOrdinanceId: parsePolicyId("policy_00000004"),
    openingSeats: 2,
  },
  {
    id: "party_trabajo_local",
    name: "Liga del Trabajo Local",
    positionByIssue: { housing: 40, employment: 85, safety: 35, services: 70, taxes: 30 },
    budgetPriority: ["transport", "administration", "security", "cleaning"],
    preferredOrdinanceId: parsePolicyId("policy_00000002"),
    openingSeats: 4,
  },
  {
    id: "party_cuentas_claras",
    name: "Unión de Cuentas Claras",
    positionByIssue: { housing: 30, employment: 45, safety: 40, services: 25, taxes: 90 },
    budgetPriority: ["administration", "transport", "security", "cleaning"],
    preferredOrdinanceId: parsePolicyId("policy_00000003"),
    openingSeats: 3,
  },
];

export const ILLEGAL_ROUTE = {
  baseDetectionChancePercent: 35,
  heatOnAttempt: 2,
  policePressureOnDetection: 1,
  benefitOnSuccess: parseMoney(250),
  fineOnDetection: parseMoney(180),
} as const;

export const TECHNICAL_TICKS_PER_SECOND = 20;
export const GAME_HOUR_TICKS = 50;
export const GAME_DAY_TICKS = GAME_HOUR_TICKS * 24;
export const GAME_MONTH_DAYS = 30;
export const GAME_MONTH_TICKS = GAME_DAY_TICKS * GAME_MONTH_DAYS;
/**
 * Una sola duración para cualquier ordenanza, la impulse el lobby del jugador o el concejo: la
 * norma es la misma ley y no debe caducar antes por el camino que la aprobó.
 */
export const MUNICIPAL_TERM_MONTHS = 6;
export const MUNICIPAL_POLICY_DURATION_TICKS = GAME_MONTH_TICKS * MUNICIPAL_TERM_MONTHS;
export const PLAYER_CREW_CAPACITY = 2;
export const UPGRADE_RESOURCES = { cement: 1, brick: 2, steel: 1 } as const;
export const UPGRADE_RENT_BONUS_PERCENT = 25;
export const REPAIR_COST = parseMoney(450);
export const REPAIR_WORK_REQUIRED = 48;
export const CRIME_COOLDOWN_TICKS = GAME_DAY_TICKS * 2;
export const MARKET_PRICES = { cement: 90, brick: 55, steel: 160 } as const;
export const FACILITY_CONFIG = {
  cement: { cycleLength: 24, outputAmount: 2, investmentCost: 1800, operatingCost: 80 },
  brick: { cycleLength: 36, outputAmount: 2, investmentCost: 1600, operatingCost: 45 },
  steel: { cycleLength: 72, outputAmount: 1, investmentCost: 2400, operatingCost: 100 },
} as const;

export const PLAYER_ORGANIZATION_ID = parseOrganizationId("org_00000001");
export const RIVAL_ORGANIZATION_ID = parseOrganizationId("org_00000002");
export const BANK_ORGANIZATION_ID = parseOrganizationId("org_00000003");
export const MUNICIPALITY_ORGANIZATION_ID = parseOrganizationId("org_00000004");
export const INSURER_ORGANIZATION_ID = parseOrganizationId("org_00000005");

export const TAX_POLICY = {
  propertyRateBps: 120,
  transferRateBps: 150,
  beneficiaryOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
  settlementPeriodTicks: GAME_MONTH_TICKS,
  exemptOrganizationIds: [] as const,
} as const;

export const MAINTENANCE_POLICY = {
  settlementPeriodTicks: GAME_MONTH_TICKS,
  wearPerSettlement: 5,
  recoveryPerSettlement: 5,
  costsByBuildingType: {
    courtyard_home: parseMoney(35),
    workshop: parseMoney(60),
    cement_plant: parseMoney(80),
    brickworks: parseMoney(65),
    steelworks: parseMoney(100),
    row_house: parseMoney(35),
    apartment_block: parseMoney(70),
    mixed_tenement: parseMoney(65),
    warehouse: parseMoney(55),
    town_hall: parseMoney(75),
    school_block: parseMoney(65),
    clinic: parseMoney(65),
    police_station: parseMoney(55),
    fire_station: parseMoney(55),
    market_hall: parseMoney(60),
  } as const,
} as const;

export const INSURANCE_POLICY = {
  settlementPeriodTicks: GAME_MONTH_TICKS,
  insurerOrganizationId: INSURER_ORGANIZATION_ID,
  products: {
    fire_basic: {
      basePremium: 25,
      riskPremiumFactor: 0.5,
      coveragePercentOfBuildCost: 60,
      deductible: 200,
      exclusions: ["sabotage", "blast"] as const,
    },
    fire_plus: {
      basePremium: 50,
      riskPremiumFactor: 1,
      coveragePercentOfBuildCost: 100,
      deductible: 350,
      exclusions: ["blast"] as const,
    },
  },
} as const;

export const PERMIT_POLICY = {
  validityTicks: GAME_MONTH_TICKS * 6,
  approvalChanceByRole: {
    civic_core: 100,
    mixed_core: 100,
    commercial_corridor: 100,
    urban_residential: 100,
    low_density_residential: 100,
    industrial_logistics: 100,
    institutional: 100,
    green_open_space: 100,
  } as Record<UrbanRole, number>,
} as const;

export function permitRequirements(
  role: UrbanRole,
  code: DevelopmentCode,
  currentUses: readonly LandUse[],
  buildingType: BuildingType,
): string[] {
  return [
    `role:${role}`,
    `code:${code.id}`,
    `use:${buildingType}`,
    ...(currentUses.includes("industrial") ? ["impact:industrial"] : []),
  ];
}

export function regulatoryRiskPercent(role: UrbanRole): number {
  if (role === "industrial_logistics") return 25;
  if (role === "commercial_corridor" || role === "mixed_core" || role === "civic_core") return 15;
  return 5;
}

export function calculateInsuranceOffer(
  building: Pick<Building, "type" | "condition">,
  coverage: InsuranceCoverage,
): {
  premium: import("@landlord/shared").Money;
  coverageLimit: import("@landlord/shared").Money;
  deductible: import("@landlord/shared").Money;
  exclusions: Array<"sabotage" | "deterioration" | "blast">;
} {
  const product = INSURANCE_POLICY.products[coverage];
  const buildCost = BUILDING_DEFINITIONS[building.type].cost;
  return {
    premium: parseMoney(
      product.basePremium +
        Math.ceil(deteriorationRiskPercent(building.condition) * product.riskPremiumFactor),
    ),
    coverageLimit: parseMoney(Math.ceil((buildCost * product.coveragePercentOfBuildCost) / 100)),
    deductible: parseMoney(product.deductible),
    exclusions: [...product.exclusions],
  };
}

export function conditionRentMultiplierPercent(condition: number): number {
  return Math.max(50, Math.min(100, 50 + Math.round(condition / 2)));
}

export function conditionAssetValueMultiplierPercent(condition: number): number {
  return Math.max(50, Math.min(100, Math.round(condition)));
}

export function deteriorationRiskPercent(condition: number): number {
  return Math.max(0, Math.min(80, Math.round((80 - condition) * 1.5)));
}

export function effectiveTaxRateBps(baseRateBps: number, modifierPercent: number): number {
  return Math.max(0, Math.round((baseRateBps * (100 + modifierPercent)) / 100));
}

export function calculateTax(base: number, rateBps: number): number {
  return Math.ceil((base * rateBps) / 10_000);
}

export const LOAN_POLICY = {
  minimumPrincipal: parseMoney(500),
  maximumPrincipal: parseMoney(8000),
  annualInterestRateBps: 900,
  allowedTermsMonths: [6, 12, 24] as const,
  collateralLoanToValuePercent: 75,
  maximumDebt: parseMoney(12000),
  initialBankBalance: parseMoney(100000),
  delinquencyGracePayments: 1,
} as const;

export const INSOLVENCY_POLICY = {
  auctionDurationTicks: GAME_DAY_TICKS * 3,
  reservePricePercentOfCollateral: 70,
  refinancingFeePercent: 5,
  refinancingInterestRateBps: 1200,
} as const;

/**
 * Liquidación de activos: es una regla del mercado, no de la IA. La aplica el banco a cualquier
 * vendedor, incluido el jugador, así que WP4.10 no la movió a los perfiles de facción.
 */
export const RIVAL_AI_POLICY = {
  salePricePercent: 85,
} as const;

export function calculateLoanPayment(
  loan: Pick<Loan, "outstandingPrincipal" | "remainingMonths" | "annualInterestRateBps">,
): {
  principal: number;
  interest: number;
  total: number;
} {
  const principal = Math.ceil(loan.outstandingPrincipal / Math.max(1, loan.remainingMonths));
  const interest = Math.ceil((loan.outstandingPrincipal * loan.annualInterestRateBps) / 1_200_000);
  return { principal, interest, total: principal + interest };
}

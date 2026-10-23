import {
  parseMoney,
  type Building,
  type BuildingDefinition,
  type InsuranceCoverage,
  type Loan,
  type Parcel,
  type Tenant,
} from "@landlord/shared";
import {
  parseDistrictId,
  parseParcelId,
  parseTenantId,
  parsePolicyId,
  parseOrganizationId,
} from "@landlord/shared";

export const BUILDING_DEFINITIONS: Record<BuildingDefinition["type"], BuildingDefinition> = {
  courtyard_home: {
    type: "courtyard_home",
    name: "Patio compacto",
    allowedZoning: ["residential", "mixed"],
    cost: parseMoney(3000),
    workRequired: 96,
    capacity: 2,
    baseRent: parseMoney(180),
    upgradeCost: parseMoney(1600),
    upgradeWorkRequired: 48,
    resources: { cement: 4, brick: 8, steel: 2 },
  },
  workshop: {
    type: "workshop",
    name: "Taller de barrio",
    allowedZoning: ["industrial", "mixed"],
    cost: parseMoney(4200),
    workRequired: 144,
    capacity: 3,
    baseRent: parseMoney(260),
    upgradeCost: parseMoney(2200),
    upgradeWorkRequired: 72,
    resources: { cement: 6, brick: 10, steel: 4 },
  },
  cement_plant: {
    type: "cement_plant",
    name: "Planta de cemento",
    allowedZoning: ["industrial", "mixed"],
    cost: parseMoney(3800),
    workRequired: 120,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(1900),
    upgradeWorkRequired: 60,
    resources: { cement: 6, brick: 10, steel: 4 },
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
    allowedZoning: ["industrial", "mixed"],
    cost: parseMoney(3400),
    workRequired: 120,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(1700),
    upgradeWorkRequired: 60,
    resources: { cement: 5, brick: 8, steel: 3 },
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
    allowedZoning: ["industrial"],
    cost: parseMoney(5200),
    workRequired: 168,
    capacity: 0,
    baseRent: parseMoney(0),
    upgradeCost: parseMoney(2600),
    upgradeWorkRequired: 84,
    resources: { cement: 8, brick: 12, steel: 6 },
    production: {
      output: "steel",
      cycleLength: 72,
      outputAmount: 1,
      operatingCost: parseMoney(100),
    },
  },
};

export const PROTOTYPE_PARCELS: Parcel[] = [
  ["parcel_00000001", 7, 7, 900, "residential"],
  ["parcel_00000002", 9, 7, 1000, "mixed"],
  ["parcel_00000003", 11, 7, 1050, "residential"],
  ["parcel_00000004", 13, 7, 1200, "mixed"],
  ["parcel_00000005", 7, 11, 800, "industrial"],
  ["parcel_00000006", 9, 11, 950, "mixed"],
  ["parcel_00000007", 11, 11, 850, "industrial"],
  ["parcel_00000008", 13, 11, 1100, "mixed"],
].map(([id, x, y, price, zoning]) => ({
  id: parseParcelId(id as string),
  districtId: parseDistrictId("district_00000001"),
  cell: { x: x as number, y: y as number },
  price: parseMoney(price as number),
  zoning: zoning as Parcel["zoning"],
  ownerOrganizationId: null,
  buildingId: null,
  productionSuitability:
    zoning === "industrial"
      ? { cement: 120, brick: 100, steel: 135 }
      : zoning === "mixed"
        ? { cement: 95, brick: 125, steel: 80 }
        : { cement: 70, brick: 85, steel: 55 },
}));

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
};

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

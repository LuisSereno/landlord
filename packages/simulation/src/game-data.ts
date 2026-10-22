import { parseMoney, type BuildingDefinition, type Parcel, type Tenant } from "@landlord/shared";
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
  },
  {
    id: parseTenantId("tenant_00000002"),
    profile: "maker",
    budget: parseMoney(300),
    preferredBuildingType: "workshop",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
  },
  {
    id: parseTenantId("tenant_00000003"),
    profile: "shopkeeper",
    budget: parseMoney(320),
    preferredBuildingType: "workshop",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
  },
  {
    id: parseTenantId("tenant_00000004"),
    profile: "household",
    budget: parseMoney(230),
    preferredBuildingType: "courtyard_home",
    activeContractBuildingId: null,
    satisfaction: 70,
    leaseRemaining: 0,
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

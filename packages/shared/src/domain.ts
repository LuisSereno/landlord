import { z } from "zod";

import {
  commandIdSchema,
  buildingIdSchema,
  agentIdSchema,
  crewIdSchema,
  incidentIdSchema,
  constructionSiteIdSchema,
  districtIdSchema,
  eventIdSchema,
  facilityIdSchema,
  organizationIdSchema,
  parcelIdSchema,
  policyIdSchema,
  personIdSchema,
  playerIdentityIdSchema,
  structureIdSchema,
  tenantIdSchema,
  transactionIdSchema,
  loanIdSchema,
  type BuildingId,
  type AgentId,
  type CrewId,
  type IncidentId,
  type ConstructionSiteId,
  type CommandId,
  type DistrictId,
  type EventId,
  type FacilityId,
  type OrganizationId,
  type ParcelId,
  type PersonId,
  type PolicyId,
  type PlayerIdentityId,
  type StructureId,
  type TenantId,
  type TransactionId,
  type LoanId,
} from "./primitives";
import {
  gridCellSchema,
  seedSchema,
  tickSchema,
  type GridCell,
  type Seed,
  type Tick,
} from "./time-and-grid";
import { moneySchema, parseMoney, type Money } from "./money";

export type PlayerIdentity = {
  id: PlayerIdentityId;
  personId: PersonId;
};

export type Person = {
  id: PersonId;
};

export type Organization = {
  id: OrganizationId;
  kind: "company" | "bank" | "municipality" | "insurer";
};

export type OrganizationControlGrant = {
  personId: PersonId;
  organizationId: OrganizationId;
};

export type TestStructure = {
  id: StructureId;
  ownerOrganizationId: OrganizationId;
  cell: GridCell;
};

export const playerIdentitySchema = z.object({
  id: playerIdentityIdSchema,
  personId: personIdSchema,
});

export const personSchema = z.object({
  id: personIdSchema,
});

export const organizationSchema = z.object({
  id: organizationIdSchema,
  kind: z.enum(["company", "bank", "municipality", "insurer"]),
});

export const organizationControlGrantSchema = z.object({
  personId: personIdSchema,
  organizationId: organizationIdSchema,
});

export const testStructureSchema = z.object({
  id: structureIdSchema,
  ownerOrganizationId: organizationIdSchema,
  cell: gridCellSchema,
});

export type PlaceTestStructure = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
  type: "PlaceTestStructure";
  payload: {
    cell: GridCell;
  };
};

export const placeTestStructureSchema = z.object({
  commandId: commandIdSchema,
  issuedByPersonId: personIdSchema,
  actingAsOrganizationId: organizationIdSchema,
  type: z.literal("PlaceTestStructure"),
  payload: z.object({
    cell: gridCellSchema,
  }),
});

export type TestStructurePlaced = {
  eventId: EventId;
  tick: Tick;
  causationCommandId: CommandId;
  type: "TestStructurePlaced";
  payload: {
    structureId: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  };
};

export const testStructurePlacedSchema = z.object({
  eventId: eventIdSchema,
  tick: tickSchema,
  causationCommandId: commandIdSchema,
  type: z.literal("TestStructurePlaced"),
  payload: z.object({
    structureId: structureIdSchema,
    ownerOrganizationId: organizationIdSchema,
    cell: gridCellSchema,
  }),
});

export const resourceKindSchema = z.enum(["cement", "brick", "steel"]);
export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const buildingTypeSchema = z.enum([
  "courtyard_home",
  "workshop",
  "cement_plant",
  "brickworks",
  "steelworks",
]);
export type BuildingType = z.infer<typeof buildingTypeSchema>;

export const zoningSchema = z.enum(["residential", "industrial", "mixed"]);
export type Zoning = z.infer<typeof zoningSchema>;

/**
 * Identidad persistente de un distrito generado. No contiene representación visual:
 * tiles, sprites o atlas se derivan en el renderer a partir de zoning y topología.
 */
export type DistrictGeneration = {
  profileId: string;
  generatorVersion: number;
  seed: Seed;
};

export type District = {
  id: DistrictId;
  name: string;
  width: 64;
  height: 64;
  /** Ausente en partidas guardadas anteriores a la generación procedural (WP4.1). */
  generation?: DistrictGeneration;
};

export type Parcel = {
  id: ParcelId;
  districtId: DistrictId;
  cell: GridCell;
  price: Money;
  zoning: Zoning;
  ownerOrganizationId: OrganizationId | null;
  buildingId: BuildingId | null;
  productionSuitability?: ProductionSuitability;
};

export type ResourceBundle = { cement: number; brick: number; steel: number };
export type ResourceInventory = ResourceBundle & { capacity: number };
export type ProductionSuitability = ResourceBundle;
export type ProductionFacilityKind = "legacy" | "physical";

export type ProductionFacility = {
  id: FacilityId;
  ownerOrganizationId: OrganizationId;
  operational: boolean;
  cycleProgress: number;
  cycleLength: number;
  output: ResourceKind;
  outputAmount: number;
  kind: ProductionFacilityKind;
  investmentCost: Money;
  operatingCost: Money;
  buildingId: BuildingId | null;
  suitabilityPercent: number;
  conditionPercent: number;
  upgradePercent: number;
  remainder: number;
};

export type BuildingDefinition = {
  type: BuildingType;
  name: string;
  allowedZoning: Zoning[];
  cost: Money;
  workRequired: number;
  capacity: number;
  baseRent: Money;
  upgradeCost: Money;
  upgradeWorkRequired: number;
  resources: ResourceBundle;
  production?: {
    output: ResourceKind;
    cycleLength: number;
    outputAmount: number;
    operatingCost: Money;
  };
};

export type Building = {
  id: BuildingId;
  parcelId: ParcelId;
  ownerOrganizationId: OrganizationId;
  productionFacilityId?: FacilityId | null;
  type: BuildingType;
  level: number;
  condition: number;
  tenantId: TenantId | null;
  tenantIds: TenantId[];
  upgraded: boolean;
  structuralIntegrity: number;
  state: "operational" | "burning" | "collapse_pending" | "ruin";
  casualtiesTotal: { injured: number; dead: number };
};

export type AgentSpecialty =
  "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";

export type Agent = {
  id: AgentId;
  personId?: PersonId;
  organizationId?: OrganizationId;
  specialty?: AgentSpecialty;
  health?: number;
  state?: "idle" | "moving" | "working" | "injured" | "dead";
  cell: GridCell;
  target?: GridCell;
  path?: GridCell[];
  task?:
    | { kind: "work_order"; workOrderId: ConstructionSiteId }
    | { kind: "maintenance"; buildingId: BuildingId }
    | { kind: "attack_agent"; targetAgentId: AgentId }
    | { kind: "sabotage_building"; targetBuildingId: BuildingId }
    | null;
  cooldownUntilTick?: Tick;
  injuredUntilTick?: Tick | null;
  lastPathRecalculationTick?: Tick;
};
export type Crew = {
  id: CrewId;
  organizationId: OrganizationId;
  supervisorAgentId: AgentId;
  workerAgentIds: AgentId[];
};
export type IncidentRecord = {
  id: IncidentId;
  buildingId: BuildingId;
  origin: "sabotage" | "deterioration" | "blast";
  intensity: number;
  status: "active" | "resolved";
  targetOrganizationId: OrganizationId;
  createdAtTick: Tick;
  causedByAgentId: AgentId | null;
  causedByOrganizationId: OrganizationId | null;
  casualties: { injured: number; dead: number };
};

export type IncidentOrigin = IncidentRecord["origin"];

export type InsuranceCoverage = "fire_basic" | "fire_plus";
export type InsuranceContract = {
  buildingId: BuildingId;
  insurerOrganizationId: OrganizationId;
  coverage: InsuranceCoverage;
  premium: Money;
  coverageLimit: Money;
  deductible: Money;
  exclusions: IncidentOrigin[];
  status: "active" | "lapsed" | "cancelled";
  purchasedAtTick: Tick;
  lastPremiumTick: Tick;
  nextPremiumTick: Tick | null;
  totalPremiumPaid: Money;
};

export type InsuranceClaim = {
  incidentId: IncidentId;
  buildingId: BuildingId;
  coverage: InsuranceCoverage | null;
  status: "paid" | "excluded" | "unpaid";
  lossEstimate: Money;
  payout: Money;
  createdAtTick: Tick;
  processedAtTick: Tick;
};

export type InsuranceState = {
  contractsByBuildingId: Record<string, InsuranceContract>;
  claimsByIncidentId: Record<string, InsuranceClaim>;
};

export type ConstructionSite = {
  id: ConstructionSiteId;
  parcelId: ParcelId;
  ownerOrganizationId: OrganizationId;
  buildingType: BuildingType;
  progress: number;
  workRequired: number;
  resourcesReserved: ResourceBundle;
  crewCapacity: number;
  upgradeBuildingId: BuildingId | null;
  repairBuildingId: BuildingId | null;
  kind: "construction" | "upgrade" | "repair" | "clear_ruin";
  targetBuildingId: BuildingId | null;
  assignedCrewIds: CrewId[];
  assignedTechnicianId: AgentId | null;
};

export type TenantProfile = "household" | "maker" | "shopkeeper";
export type Tenant = {
  id: TenantId;
  profile: TenantProfile;
  budget: Money;
  preferredBuildingType: BuildingType;
  activeContractBuildingId: BuildingId | null;
  satisfaction: number;
  leaseRemaining: number;
  status: "available" | "contracted" | "displaced";
  /** Ocupantes del hogar. Se usa para las bajas de un siniestro; no consume plazas de capacidad. */
  size: number;
  /** Segmento de demanda que originó el hogar; los hogares autorados usan su propio perfil. */
  segmentId: string;
  /** Meses que el hogar lleva disponible sin firmar contrato. */
  searchMonths: number;
  /** Ingreso del hogar respecto a su segmento, en porcentaje; 100 es el ingreso de referencia. */
  incomeFactorPercent: number;
  /**
   * `authored` es un candidato que el jugador coloca a mano (el pool del slice); `market` lo generó
   * el mercado y se instala por su cuenta cuando encuentra una plaza asequible.
   */
  origin: "authored" | "market";
};

export type EconomicTransaction = {
  id: TransactionId;
  tick: Tick;
  organizationId: OrganizationId;
  cause: string;
  amount: Money;
  direction: "debit" | "credit";
  referenceId: string;
};

export type LoanStatus = "offered" | "active" | "delinquent" | "paid_off" | "defaulted";
export type Loan = {
  id: LoanId;
  borrowerOrganizationId: OrganizationId;
  lenderOrganizationId: OrganizationId;
  principal: Money;
  outstandingPrincipal: Money;
  annualInterestRateBps: number;
  termMonths: number;
  remainingMonths: number;
  collateralParcelId: ParcelId;
  status: LoanStatus;
  offeredAtTick: Tick;
  acceptedAtTick: Tick | null;
  nextPaymentTick: Tick | null;
  missedPayments: number;
};

export type AuctionStatus = "open" | "closed" | "executed";
export type Auction = {
  loanId: LoanId;
  collateralParcelId: ParcelId;
  sellerOrganizationId: OrganizationId;
  reservePrice: Money;
  highestBid: Money;
  highestBidderOrganizationId: OrganizationId | null;
  reservedFundsByOrganizationId: Record<string, Money>;
  status: AuctionStatus;
  openedAtTick: Tick;
  closesAtTick: Tick;
};
export type InsolvencyState = {
  auctionsByLoanId: Record<string, Auction>;
};

export type TaxationState = {
  propertyRateBps: number;
  transferRateBps: number;
  nextSettlementTick: Tick;
  lastSettlementTick: Tick | null;
  totalCollected: Money;
  exemptOrganizationIds: OrganizationId[];
  arrearsByOrganizationId: Record<string, Money>;
};

export type EmploymentState = {
  /** Nivel salarial local; 100 es el salario de referencia. */
  salaryIndexPercent: number;
  lastSettlementTick: Tick | null;
};

export type HousingMarketState = {
  /** Índice de renta por tipo de edificio; 100 es el precio base de `BUILDING_DEFINITIONS`. */
  rentIndexPercentByBuildingType: Record<string, number>;
  lastSettlementTick: Tick | null;
  arrivalsTotal: number;
  departuresTotal: number;
  /** Último ordinal de id de hogar emitido por el mercado; nunca retrocede al vaciar el pool. */
  nextTenantOrdinal: number;
};

export type MaintenancePolicy = "balanced" | "deferred";
export type MaintenanceState = {
  policy: MaintenancePolicy;
  nextSettlementTick: Tick;
  lastSettlementTick: Tick | null;
  backlogByBuildingId: Record<string, Money>;
};

export type PolicyStatus =
  "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn";
export type Ordinance = {
  id: PolicyId;
  name: string;
  status: PolicyStatus;
  proposedAtTick: Tick | null;
  activeFromTick: Tick | null;
  expiresAtTick: Tick | null;
  materialCostModifierPercent: number;
  rentModifierPercent: number;
  influenceRequired: number;
  approvalChancePercent: number;
  propertyTaxModifierPercent: number;
  transferTaxModifierPercent: number;
  permitApprovalModifierPercent: number;
};

export type PermitStatus = "approved" | "denied" | "expired";
export type Permit = {
  parcelId: ParcelId;
  buildingType: BuildingType;
  authorityOrganizationId: OrganizationId;
  requirements: string[];
  zoningAtDecision: Zoning;
  status: PermitStatus;
  requestedAtTick: Tick;
  decidedAtTick: Tick;
  expiresAtTick: Tick | null;
};
export type PermittingState = {
  validityTicks: number;
  approvalChanceByZoning: Record<Zoning, number>;
  permitsByParcelId: Record<string, Permit>;
};

export type CrimeState = {
  heatByOrganizationId: Record<string, number>;
  policePressure: number;
  lastOutcome: "none" | "profitable" | "detected";
  nextAvailableTickByOrganizationId: Record<string, number>;
};

export const districtGenerationSchema = z.object({
  profileId: z.string().min(1).max(64),
  generatorVersion: z.number().int().nonnegative(),
  seed: seedSchema,
});
export const districtSchema = z.object({
  id: districtIdSchema,
  name: z.string().min(1).max(80),
  width: z.literal(64),
  height: z.literal(64),
  generation: districtGenerationSchema.optional(),
});
export const parcelSchema = z.object({
  id: parcelIdSchema,
  districtId: districtIdSchema,
  cell: gridCellSchema,
  price: moneySchema,
  zoning: zoningSchema,
  ownerOrganizationId: organizationIdSchema.nullable(),
  buildingId: buildingIdSchema.nullable(),
  productionSuitability: z
    .object({
      cement: z.number().int().positive(),
      brick: z.number().int().positive(),
      steel: z.number().int().positive(),
    })
    .default({ cement: 100, brick: 100, steel: 100 }),
});
export const resourceBundleSchema = z.object({
  cement: z.number().int().nonnegative(),
  brick: z.number().int().nonnegative(),
  steel: z.number().int().nonnegative(),
});
export const resourceInventorySchema = resourceBundleSchema.extend({
  capacity: z.number().int().positive(),
});
export const productionFacilitySchema = z.object({
  id: facilityIdSchema,
  ownerOrganizationId: organizationIdSchema,
  operational: z.boolean(),
  cycleProgress: z.number().int().nonnegative(),
  cycleLength: z.number().int().positive(),
  output: resourceKindSchema,
  outputAmount: z.number().int().positive(),
  kind: z.enum(["legacy", "physical"]).optional(),
  investmentCost: moneySchema.default(parseMoney(0)),
  operatingCost: moneySchema.default(parseMoney(0)),
  buildingId: buildingIdSchema.nullable().default(null),
  suitabilityPercent: z.number().int().positive().default(100),
  conditionPercent: z.number().int().min(0).max(100).default(100),
  upgradePercent: z.number().int().positive().default(100),
  remainder: z.number().int().min(0).max(999_999).default(0),
});
export const buildingSchema = z.object({
  id: buildingIdSchema,
  parcelId: parcelIdSchema,
  ownerOrganizationId: organizationIdSchema,
  productionFacilityId: facilityIdSchema.nullable().default(null),
  type: buildingTypeSchema,
  level: z.number().int().positive(),
  condition: z.number().int().min(0).max(100),
  tenantId: tenantIdSchema.nullable(),
  tenantIds: z.array(tenantIdSchema).default([]),
  upgraded: z.boolean(),
  structuralIntegrity: z.number().int().min(0).max(100).default(100),
  state: z.enum(["operational", "burning", "collapse_pending", "ruin"]).default("operational"),
  casualtiesTotal: z
    .object({ injured: z.number().int().nonnegative(), dead: z.number().int().nonnegative() })
    .default({ injured: 0, dead: 0 }),
});
export const constructionSiteSchema = z.object({
  id: constructionSiteIdSchema,
  parcelId: parcelIdSchema,
  ownerOrganizationId: organizationIdSchema,
  buildingType: buildingTypeSchema,
  progress: z.number().int().nonnegative(),
  workRequired: z.number().int().positive(),
  resourcesReserved: resourceBundleSchema,
  crewCapacity: z.number().int().nonnegative(),
  upgradeBuildingId: buildingIdSchema.nullable(),
  repairBuildingId: buildingIdSchema.nullable().default(null),
  kind: z.enum(["construction", "upgrade", "repair", "clear_ruin"]).default("construction"),
  targetBuildingId: buildingIdSchema.nullable().default(null),
  assignedCrewIds: z.array(crewIdSchema).default([]),
  assignedTechnicianId: agentIdSchema.nullable().default(null),
});
export const agentTaskSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("work_order"), workOrderId: constructionSiteIdSchema }),
  z.object({ kind: z.literal("maintenance"), buildingId: buildingIdSchema }),
  z.object({ kind: z.literal("attack_agent"), targetAgentId: agentIdSchema }),
  z.object({ kind: z.literal("sabotage_building"), targetBuildingId: buildingIdSchema }),
]);
export const agentSchema = z.object({
  id: agentIdSchema,
  personId: personIdSchema.optional(),
  organizationId: organizationIdSchema.optional(),
  specialty: z
    .enum(["supervisor", "construction_worker", "maintenance_technician", "enforcer"])
    .optional(),
  health: z.number().int().min(0).max(100).optional(),
  state: z.enum(["idle", "moving", "working", "injured", "dead"]).optional(),
  cell: gridCellSchema,
  target: gridCellSchema.optional(),
  path: z.array(gridCellSchema).optional(),
  task: agentTaskSchema.nullable().optional(),
  cooldownUntilTick: tickSchema.optional(),
  injuredUntilTick: tickSchema.nullable().optional(),
  lastPathRecalculationTick: tickSchema.optional(),
});
export const crewSchema = z.object({
  id: crewIdSchema,
  organizationId: organizationIdSchema,
  supervisorAgentId: agentIdSchema,
  workerAgentIds: z.array(agentIdSchema),
});
export const incidentSchema = z.object({
  id: incidentIdSchema,
  buildingId: buildingIdSchema,
  origin: z.enum(["sabotage", "deterioration", "blast"]),
  intensity: z.number().int().min(0).max(100),
  status: z.enum(["active", "resolved"]),
  targetOrganizationId: organizationIdSchema,
  createdAtTick: tickSchema,
  causedByAgentId: agentIdSchema.nullable(),
  causedByOrganizationId: organizationIdSchema.nullable(),
  casualties: z.object({
    injured: z.number().int().nonnegative(),
    dead: z.number().int().nonnegative(),
  }),
});
export const insuranceContractSchema = z.object({
  buildingId: buildingIdSchema,
  insurerOrganizationId: organizationIdSchema,
  coverage: z.enum(["fire_basic", "fire_plus"]),
  premium: moneySchema,
  coverageLimit: moneySchema,
  deductible: moneySchema,
  exclusions: z.array(z.enum(["sabotage", "deterioration", "blast"])),
  status: z.enum(["active", "lapsed", "cancelled"]),
  purchasedAtTick: tickSchema,
  lastPremiumTick: tickSchema,
  nextPremiumTick: tickSchema.nullable(),
  totalPremiumPaid: moneySchema,
});
export const insuranceClaimSchema = z.object({
  incidentId: incidentIdSchema,
  buildingId: buildingIdSchema,
  coverage: z.enum(["fire_basic", "fire_plus"]).nullable(),
  status: z.enum(["paid", "excluded", "unpaid"]),
  lossEstimate: moneySchema,
  payout: moneySchema,
  createdAtTick: tickSchema,
  processedAtTick: tickSchema,
});
export const insuranceStateSchema = z.object({
  contractsByBuildingId: z.record(z.string(), insuranceContractSchema),
  claimsByIncidentId: z.record(z.string(), insuranceClaimSchema),
});
export const tenantSchema = z.object({
  id: tenantIdSchema,
  profile: z.enum(["household", "maker", "shopkeeper"]),
  budget: moneySchema,
  preferredBuildingType: buildingTypeSchema,
  activeContractBuildingId: buildingIdSchema.nullable(),
  satisfaction: z.number().int().min(0).max(100),
  leaseRemaining: z.number().int().nonnegative(),
  status: z.enum(["available", "contracted", "displaced"]).optional(),
  size: z.number().int().positive().optional(),
  segmentId: z.string().min(1).max(64).optional(),
  searchMonths: z.number().int().nonnegative().optional(),
  incomeFactorPercent: z.number().int().positive().optional(),
  origin: z.enum(["authored", "market"]).optional(),
});
export const economicTransactionSchema = z.object({
  id: transactionIdSchema,
  tick: tickSchema,
  organizationId: organizationIdSchema,
  cause: z.string().min(1).max(120),
  amount: moneySchema,
  direction: z.enum(["debit", "credit"]),
  referenceId: z.string().min(1).max(128),
});
export const loanSchema = z.object({
  id: loanIdSchema,
  borrowerOrganizationId: organizationIdSchema,
  lenderOrganizationId: organizationIdSchema,
  principal: moneySchema,
  outstandingPrincipal: moneySchema,
  annualInterestRateBps: z.number().int().positive(),
  termMonths: z.number().int().positive(),
  remainingMonths: z.number().int().nonnegative(),
  collateralParcelId: parcelIdSchema,
  status: z.enum(["offered", "active", "delinquent", "paid_off", "defaulted"]),
  offeredAtTick: tickSchema,
  acceptedAtTick: tickSchema.nullable(),
  nextPaymentTick: tickSchema.nullable(),
  missedPayments: z.number().int().nonnegative(),
});
export const auctionSchema = z.object({
  loanId: loanIdSchema,
  collateralParcelId: parcelIdSchema,
  sellerOrganizationId: organizationIdSchema,
  reservePrice: moneySchema,
  highestBid: moneySchema,
  highestBidderOrganizationId: organizationIdSchema.nullable(),
  reservedFundsByOrganizationId: z.record(z.string(), moneySchema),
  status: z.enum(["open", "closed", "executed"]),
  openedAtTick: tickSchema,
  closesAtTick: tickSchema,
});
export const insolvencyStateSchema = z.object({
  auctionsByLoanId: z.record(z.string(), auctionSchema),
});
export const taxationStateSchema = z.object({
  propertyRateBps: z.number().int().nonnegative(),
  transferRateBps: z.number().int().nonnegative(),
  nextSettlementTick: tickSchema,
  lastSettlementTick: tickSchema.nullable(),
  totalCollected: moneySchema,
  exemptOrganizationIds: z.array(organizationIdSchema),
  arrearsByOrganizationId: z.record(z.string(), moneySchema),
});
export const employmentStateSchema = z.object({
  salaryIndexPercent: z.number().int().min(50).max(200),
  lastSettlementTick: tickSchema.nullable(),
});
export const housingMarketStateSchema = z.object({
  rentIndexPercentByBuildingType: z.record(z.string(), z.number().int().min(50).max(150)),
  lastSettlementTick: tickSchema.nullable(),
  arrivalsTotal: z.number().int().nonnegative(),
  departuresTotal: z.number().int().nonnegative(),
  nextTenantOrdinal: z.number().int().positive(),
});
export const maintenanceStateSchema = z.object({
  policy: z.enum(["balanced", "deferred"]),
  nextSettlementTick: tickSchema,
  lastSettlementTick: tickSchema.nullable(),
  backlogByBuildingId: z.record(z.string(), moneySchema),
});
export const ordinanceSchema = z.object({
  id: policyIdSchema,
  name: z.string().min(1).max(120),
  status: z.enum(["proposed", "approved", "active", "expired", "rejected", "withdrawn"]),
  proposedAtTick: tickSchema.nullable(),
  activeFromTick: tickSchema.nullable(),
  expiresAtTick: tickSchema.nullable(),
  materialCostModifierPercent: z.number().int(),
  rentModifierPercent: z.number().int(),
  influenceRequired: z.number().int().nonnegative(),
  approvalChancePercent: z.number().int().min(0).max(100).default(65),
  propertyTaxModifierPercent: z.number().int().default(0),
  transferTaxModifierPercent: z.number().int().default(0),
  permitApprovalModifierPercent: z.number().int().default(0),
});
export const permitSchema = z.object({
  parcelId: parcelIdSchema,
  buildingType: buildingTypeSchema,
  authorityOrganizationId: organizationIdSchema,
  requirements: z.array(z.string().min(1).max(80)),
  zoningAtDecision: zoningSchema,
  status: z.enum(["approved", "denied", "expired"]),
  requestedAtTick: tickSchema,
  decidedAtTick: tickSchema,
  expiresAtTick: tickSchema.nullable(),
});
export const permittingStateSchema = z.object({
  validityTicks: z.number().int().positive(),
  approvalChanceByZoning: z.object({
    residential: z.number().int().min(0).max(100),
    industrial: z.number().int().min(0).max(100),
    mixed: z.number().int().min(0).max(100),
  }),
  permitsByParcelId: z.record(z.string(), permitSchema),
});
export const crimeStateSchema = z.object({
  heatByOrganizationId: z.record(z.string(), z.number().int().nonnegative()),
  policePressure: z.number().int().nonnegative(),
  lastOutcome: z.enum(["none", "profitable", "detected"]),
  nextAvailableTickByOrganizationId: z
    .record(z.string(), z.number().int().nonnegative())
    .default({}),
});

type DomainCommandBase = {
  commandId: CommandId;
  issuedByPersonId: PersonId;
  actingAsOrganizationId: OrganizationId;
};
export type BuyParcel = DomainCommandBase & { type: "BuyParcel"; payload: { parcelId: ParcelId } };
export type SellParcel = DomainCommandBase & {
  type: "SellParcel";
  payload: { parcelId: ParcelId };
};
export type StartConstruction = DomainCommandBase & {
  type: "StartConstruction";
  payload: { parcelId: ParcelId; buildingType: BuildingType };
};
export type CancelConstruction = DomainCommandBase & {
  type: "CancelConstruction";
  payload: { constructionSiteId: ConstructionSiteId };
};
export type AssignTenant = DomainCommandBase & {
  type: "AssignTenant";
  payload: { buildingId: BuildingId; tenantId: TenantId };
};
export type UpgradeBuilding = DomainCommandBase & {
  type: "UpgradeBuilding";
  payload: { buildingId: BuildingId };
};
export type LobbyPolicy = DomainCommandBase & {
  type: "LobbyPolicy";
  payload: { policyId: PolicyId; influenceSpend: number };
};
export type ProposePolicy = DomainCommandBase & {
  type: "ProposePolicy";
  payload: { policyId: PolicyId };
};
export type WithdrawPolicy = DomainCommandBase & {
  type: "WithdrawPolicy";
  payload: { policyId: PolicyId };
};
export type CommitCrime = DomainCommandBase & {
  type: "CommitCrime";
  payload: { targetOrganizationId: OrganizationId };
};
export type BuyMaterials = DomainCommandBase & {
  type: "BuyMaterials";
  payload: { resource: ResourceKind; amount: number };
};
export type InvestInProduction = DomainCommandBase & {
  type: "InvestInProduction";
  payload: { resource: ResourceKind };
};
export type AllocateCrew = DomainCommandBase & {
  type: "AllocateCrew";
  payload: { constructionSiteId: ConstructionSiteId; crewCapacity: 1 | 2 };
};
export type RepairBuilding = DomainCommandBase & {
  type: "RepairBuilding";
  payload: { buildingId: BuildingId };
};
export type AssignCrewToWorkOrder = DomainCommandBase & {
  type: "AssignCrewToWorkOrder";
  payload: { crewId: CrewId; workOrderId: ConstructionSiteId };
};
export type AssignMaintenance = DomainCommandBase & {
  type: "AssignMaintenance";
  payload: { buildingId: BuildingId };
};
export type OrderEnforcerAction = DomainCommandBase & {
  type: "OrderEnforcerAction";
  payload: {
    enforcerAgentId: AgentId;
    action: "attack_agent" | "sabotage_building";
    targetAgentId?: AgentId;
    targetBuildingId?: BuildingId;
  };
};
export type ClearRuin = DomainCommandBase & {
  type: "ClearRuin";
  payload: { buildingId: BuildingId };
};
export type RequestLoan = DomainCommandBase & {
  type: "RequestLoan";
  payload: { amount: Money; termMonths: number; collateralParcelId: ParcelId };
};
export type AcceptLoanOffer = DomainCommandBase & {
  type: "AcceptLoanOffer";
  payload: { loanId: LoanId };
};
export type RequestRefinancing = DomainCommandBase & {
  type: "RequestRefinancing";
  payload: { loanId: LoanId; termMonths: number };
};
export type PlaceAuctionBid = DomainCommandBase & {
  type: "PlaceAuctionBid";
  payload: { loanId: LoanId; amount: Money };
};
export type WithdrawAuctionBid = DomainCommandBase & {
  type: "WithdrawAuctionBid";
  payload: { loanId: LoanId };
};
export type SetMaintenancePolicy = DomainCommandBase & {
  type: "SetMaintenancePolicy";
  payload: { policy: MaintenancePolicy };
};
export type RequestPermit = DomainCommandBase & {
  type: "RequestPermit";
  payload: { parcelId: ParcelId; buildingType: BuildingType };
};
export type BuyInsurance = DomainCommandBase & {
  type: "BuyInsurance";
  payload: { buildingId: BuildingId; coverage: InsuranceCoverage };
};
export type CancelInsurance = DomainCommandBase & {
  type: "CancelInsurance";
  payload: { buildingId: BuildingId };
};
export type ProductCommand =
  | PlaceTestStructure
  | BuyParcel
  | SellParcel
  | StartConstruction
  | CancelConstruction
  | AssignTenant
  | UpgradeBuilding
  | LobbyPolicy
  | ProposePolicy
  | WithdrawPolicy
  | CommitCrime
  | BuyMaterials
  | InvestInProduction
  | AllocateCrew
  | RepairBuilding
  | AssignCrewToWorkOrder
  | AssignMaintenance
  | OrderEnforcerAction
  | ClearRuin
  | RequestLoan
  | AcceptLoanOffer
  | RequestRefinancing
  | PlaceAuctionBid
  | WithdrawAuctionBid
  | SetMaintenancePolicy
  | RequestPermit
  | BuyInsurance
  | CancelInsurance;

function commandSchema<TType extends string>(type: TType, payload: z.ZodType) {
  return z.object({
    commandId: commandIdSchema,
    issuedByPersonId: personIdSchema,
    actingAsOrganizationId: organizationIdSchema,
    type: z.literal(type),
    payload,
  });
}
export const buyParcelSchema = commandSchema("BuyParcel", z.object({ parcelId: parcelIdSchema }));
export const sellParcelSchema = commandSchema("SellParcel", z.object({ parcelId: parcelIdSchema }));
export const startConstructionSchema = commandSchema(
  "StartConstruction",
  z.object({ parcelId: parcelIdSchema, buildingType: buildingTypeSchema }),
);
export const cancelConstructionSchema = commandSchema(
  "CancelConstruction",
  z.object({ constructionSiteId: constructionSiteIdSchema }),
);
export const assignTenantSchema = commandSchema(
  "AssignTenant",
  z.object({ buildingId: buildingIdSchema, tenantId: tenantIdSchema }),
);
export const upgradeBuildingSchema = commandSchema(
  "UpgradeBuilding",
  z.object({ buildingId: buildingIdSchema }),
);
export const lobbyPolicySchema = commandSchema(
  "LobbyPolicy",
  z.object({ policyId: policyIdSchema, influenceSpend: z.number().int().min(1).max(3) }),
);
export const proposePolicySchema = commandSchema(
  "ProposePolicy",
  z.object({ policyId: policyIdSchema }),
);
export const withdrawPolicySchema = commandSchema(
  "WithdrawPolicy",
  z.object({ policyId: policyIdSchema }),
);
export const commitCrimeSchema = commandSchema(
  "CommitCrime",
  z.object({ targetOrganizationId: organizationIdSchema }),
);
export const buyMaterialsSchema = commandSchema(
  "BuyMaterials",
  z.object({ resource: resourceKindSchema, amount: z.number().int().positive().max(40) }),
);
export const investInProductionSchema = commandSchema(
  "InvestInProduction",
  z.object({ resource: resourceKindSchema }),
);
export const allocateCrewSchema = commandSchema(
  "AllocateCrew",
  z.object({
    constructionSiteId: constructionSiteIdSchema,
    crewCapacity: z.union([z.literal(1), z.literal(2)]),
  }),
);
export const repairBuildingSchema = commandSchema(
  "RepairBuilding",
  z.object({ buildingId: buildingIdSchema }),
);
export const assignCrewToWorkOrderSchema = commandSchema(
  "AssignCrewToWorkOrder",
  z.object({ crewId: crewIdSchema, workOrderId: constructionSiteIdSchema }),
);
export const assignMaintenanceSchema = commandSchema(
  "AssignMaintenance",
  z.object({ buildingId: buildingIdSchema }),
);
export const orderEnforcerActionSchema = commandSchema(
  "OrderEnforcerAction",
  z.object({
    enforcerAgentId: agentIdSchema,
    action: z.enum(["attack_agent", "sabotage_building"]),
    targetAgentId: agentIdSchema.optional(),
    targetBuildingId: buildingIdSchema.optional(),
  }),
);
export const clearRuinSchema = commandSchema(
  "ClearRuin",
  z.object({ buildingId: buildingIdSchema }),
);
export const requestLoanSchema = commandSchema(
  "RequestLoan",
  z.object({
    amount: moneySchema,
    termMonths: z.number().int().positive().max(24),
    collateralParcelId: parcelIdSchema,
  }),
);
export const acceptLoanOfferSchema = commandSchema(
  "AcceptLoanOffer",
  z.object({ loanId: loanIdSchema }),
);
export const requestRefinancingSchema = commandSchema(
  "RequestRefinancing",
  z.object({
    loanId: loanIdSchema,
    termMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]),
  }),
);
export const placeAuctionBidSchema = commandSchema(
  "PlaceAuctionBid",
  z.object({ loanId: loanIdSchema, amount: moneySchema }),
);
export const withdrawAuctionBidSchema = commandSchema(
  "WithdrawAuctionBid",
  z.object({ loanId: loanIdSchema }),
);
export const setMaintenancePolicySchema = commandSchema(
  "SetMaintenancePolicy",
  z.object({ policy: z.enum(["balanced", "deferred"]) }),
);
export const requestPermitSchema = commandSchema(
  "RequestPermit",
  z.object({ parcelId: parcelIdSchema, buildingType: buildingTypeSchema }),
);
export const buyInsuranceSchema = commandSchema(
  "BuyInsurance",
  z.object({
    buildingId: buildingIdSchema,
    coverage: z.enum(["fire_basic", "fire_plus"]),
  }),
);
export const cancelInsuranceSchema = commandSchema(
  "CancelInsurance",
  z.object({ buildingId: buildingIdSchema }),
);
export const productCommandSchema = z.discriminatedUnion("type", [
  placeTestStructureSchema,
  buyParcelSchema,
  sellParcelSchema,
  startConstructionSchema,
  cancelConstructionSchema,
  assignTenantSchema,
  upgradeBuildingSchema,
  lobbyPolicySchema,
  proposePolicySchema,
  withdrawPolicySchema,
  commitCrimeSchema,
  buyMaterialsSchema,
  investInProductionSchema,
  allocateCrewSchema,
  repairBuildingSchema,
  assignCrewToWorkOrderSchema,
  assignMaintenanceSchema,
  orderEnforcerActionSchema,
  clearRuinSchema,
  requestLoanSchema,
  acceptLoanOfferSchema,
  requestRefinancingSchema,
  placeAuctionBidSchema,
  withdrawAuctionBidSchema,
  setMaintenancePolicySchema,
  requestPermitSchema,
  buyInsuranceSchema,
  cancelInsuranceSchema,
]);

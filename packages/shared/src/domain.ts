import { z } from "zod";

import {
  commandIdSchema,
  buildingIdSchema,
  agentIdSchema,
  crewIdSchema,
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
} from "./primitives";
import { gridCellSchema, tickSchema, type GridCell, type Tick } from "./time-and-grid";
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
  kind: "company";
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
  kind: z.literal("company"),
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

export const buildingTypeSchema = z.enum(["courtyard_home", "workshop"]);
export type BuildingType = z.infer<typeof buildingTypeSchema>;

export const zoningSchema = z.enum(["residential", "industrial", "mixed"]);
export type Zoning = z.infer<typeof zoningSchema>;

export type District = { id: DistrictId; name: string; width: 64; height: 64 };

export type Parcel = {
  id: ParcelId;
  districtId: DistrictId;
  cell: GridCell;
  price: Money;
  zoning: Zoning;
  ownerOrganizationId: OrganizationId | null;
  buildingId: BuildingId | null;
};

export type ResourceBundle = { cement: number; brick: number; steel: number };
export type ResourceInventory = ResourceBundle & { capacity: number };

export type ProductionFacility = {
  id: FacilityId;
  ownerOrganizationId: OrganizationId;
  operational: boolean;
  cycleProgress: number;
  cycleLength: number;
  output: ResourceKind;
  outputAmount: number;
  investmentCost: Money;
  operatingCost: Money;
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
};

export type Building = {
  id: BuildingId;
  parcelId: ParcelId;
  ownerOrganizationId: OrganizationId;
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

export type Agent = {
  id: AgentId;
  personId?: PersonId;
  organizationId?: OrganizationId;
  specialty?: "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";
  health?: number;
  state?: "idle" | "moving" | "working" | "injured" | "dead";
  cell: GridCell;
  target?: GridCell;
  path?: GridCell[];
  task?: { kind: "work_order"; workOrderId: ConstructionSiteId } | { kind: "maintenance"; buildingId: BuildingId } | { kind: "attack_agent"; targetAgentId: AgentId } | { kind: "sabotage_building"; targetBuildingId: BuildingId } | null;
  cooldownUntilTick?: Tick;
  injuredUntilTick?: Tick | null;
  lastPathRecalculationTick?: Tick;
};
export type Crew = { id: CrewId; organizationId: OrganizationId; supervisorAgentId: AgentId; workerAgentIds: AgentId[] };
export type IncidentRecord = { id: IncidentId; buildingId: BuildingId; origin: "sabotage" | "deterioration" | "blast"; intensity: number; status: "active" | "resolved"; targetOrganizationId: OrganizationId; createdAtTick: Tick; causedByAgentId: AgentId | null; causedByOrganizationId: OrganizationId | null; casualties: { injured: number; dead: number } };

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

export type PolicyStatus = "proposed" | "approved" | "active" | "expired" | "rejected";
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
};

export type CrimeState = {
  heatByOrganizationId: Record<string, number>;
  policePressure: number;
  lastOutcome: "none" | "profitable" | "detected";
  nextAvailableTickByOrganizationId: Record<string, number>;
};

export const districtSchema = z.object({
  id: districtIdSchema,
  name: z.string().min(1).max(80),
  width: z.literal(64),
  height: z.literal(64),
});
export const parcelSchema = z.object({
  id: parcelIdSchema,
  districtId: districtIdSchema,
  cell: gridCellSchema,
  price: moneySchema,
  zoning: zoningSchema,
  ownerOrganizationId: organizationIdSchema.nullable(),
  buildingId: buildingIdSchema.nullable(),
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
  investmentCost: moneySchema.default(parseMoney(0)),
  operatingCost: moneySchema.default(parseMoney(0)),
});
export const buildingSchema = z.object({
  id: buildingIdSchema,
  parcelId: parcelIdSchema,
  ownerOrganizationId: organizationIdSchema,
  type: buildingTypeSchema,
  level: z.number().int().positive(),
  condition: z.number().int().min(0).max(100),
  tenantId: tenantIdSchema.nullable(),
  tenantIds: z.array(tenantIdSchema).default([]),
  upgraded: z.boolean(),
  structuralIntegrity: z.number().int().min(0).max(100).default(100),
  state: z.enum(["operational", "burning", "collapse_pending", "ruin"]).default("operational"),
  casualtiesTotal: z.object({ injured: z.number().int().nonnegative(), dead: z.number().int().nonnegative() }).default({ injured: 0, dead: 0 }),
});
export const constructionSiteSchema = z.object({
  id: constructionSiteIdSchema,
  parcelId: parcelIdSchema,
  ownerOrganizationId: organizationIdSchema,
  buildingType: buildingTypeSchema,
  progress: z.number().int().nonnegative(),
  workRequired: z.number().int().positive(),
  resourcesReserved: resourceBundleSchema,
  crewCapacity: z.number().int().positive(),
  upgradeBuildingId: buildingIdSchema.nullable(),
  repairBuildingId: buildingIdSchema.nullable().default(null),
  kind: z.enum(["construction", "upgrade", "repair", "clear_ruin"]).default("construction"),
  targetBuildingId: buildingIdSchema.nullable().default(null),
  assignedCrewIds: z.array(crewIdSchema).default([]),
  assignedTechnicianId: agentIdSchema.nullable().default(null),
});
export const tenantSchema = z.object({
  id: tenantIdSchema,
  profile: z.enum(["household", "maker", "shopkeeper"]),
  budget: moneySchema,
  preferredBuildingType: buildingTypeSchema,
  activeContractBuildingId: buildingIdSchema.nullable(),
  satisfaction: z.number().int().min(0).max(100),
  leaseRemaining: z.number().int().nonnegative(),
  status: z.enum(["available", "contracted", "displaced"]).default("available"),
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
export const ordinanceSchema = z.object({
  id: policyIdSchema,
  name: z.string().min(1).max(120),
  status: z.enum(["proposed", "approved", "active", "expired", "rejected"]),
  proposedAtTick: tickSchema.nullable(),
  activeFromTick: tickSchema.nullable(),
  expiresAtTick: tickSchema.nullable(),
  materialCostModifierPercent: z.number().int(),
  rentModifierPercent: z.number().int(),
  influenceRequired: z.number().int().nonnegative(),
  approvalChancePercent: z.number().int().min(0).max(100).default(65),
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
export type AssignCrewToWorkOrder = DomainCommandBase & { type: "AssignCrewToWorkOrder"; payload: { crewId: CrewId; workOrderId: ConstructionSiteId } };
export type AssignMaintenance = DomainCommandBase & { type: "AssignMaintenance"; payload: { buildingId: BuildingId } };
export type OrderEnforcerAction = DomainCommandBase & { type: "OrderEnforcerAction"; payload: { enforcerAgentId: AgentId; action: "attack_agent" | "sabotage_building"; targetAgentId?: AgentId; targetBuildingId?: BuildingId } };
export type ClearRuin = DomainCommandBase & { type: "ClearRuin"; payload: { buildingId: BuildingId } };
export type ProductCommand =
  | PlaceTestStructure
  | BuyParcel
  | StartConstruction
  | CancelConstruction
  | AssignTenant
  | UpgradeBuilding
  | LobbyPolicy
  | CommitCrime
  | BuyMaterials
  | InvestInProduction
  | AllocateCrew
  | RepairBuilding
  | AssignCrewToWorkOrder
  | AssignMaintenance
  | OrderEnforcerAction
  | ClearRuin;

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
export const assignCrewToWorkOrderSchema = commandSchema("AssignCrewToWorkOrder", z.object({ crewId: crewIdSchema, workOrderId: constructionSiteIdSchema }));
export const assignMaintenanceSchema = commandSchema("AssignMaintenance", z.object({ buildingId: buildingIdSchema }));
export const orderEnforcerActionSchema = commandSchema("OrderEnforcerAction", z.object({
  enforcerAgentId: agentIdSchema,
  action: z.enum(["attack_agent", "sabotage_building"]),
  targetAgentId: agentIdSchema.optional(),
  targetBuildingId: buildingIdSchema.optional(),
}));
export const clearRuinSchema = commandSchema("ClearRuin", z.object({ buildingId: buildingIdSchema }));
export const productCommandSchema = z.discriminatedUnion("type", [
  placeTestStructureSchema,
  buyParcelSchema,
  startConstructionSchema,
  cancelConstructionSchema,
  assignTenantSchema,
  upgradeBuildingSchema,
  lobbyPolicySchema,
  commitCrimeSchema,
  buyMaterialsSchema,
  investInProductionSchema,
  allocateCrewSchema,
  repairBuildingSchema,
  assignCrewToWorkOrderSchema,
  assignMaintenanceSchema,
  orderEnforcerActionSchema,
  clearRuinSchema,
]);

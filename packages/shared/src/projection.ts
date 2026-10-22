import { z } from "zod";

import {
  buildingIdSchema,
  constructionSiteIdSchema,
  districtIdSchema,
  organizationIdSchema,
  parcelIdSchema,
  policyIdSchema,
  structureIdSchema,
  agentIdSchema,
  tenantIdSchema,
  type BuildingId,
  type ConstructionSiteId,
  type DistrictId,
  type OrganizationId,
  type ParcelId,
  type PolicyId,
  type StructureId,
  type AgentId,
  type TenantId,
} from "./primitives";
import { gridCellSchema, tickSchema, type GridCell, type Tick } from "./time-and-grid";
import { moneySchema } from "./money";
import { buildingTypeSchema, zoningSchema, type BuildingType } from "./domain";

export type ViewProjectionV1 = {
  projectionVersion: 1;
  tick: Tick;
  map: { width: 64; height: 64 };
  structures: Array<{
    id: StructureId;
    ownerOrganizationId: OrganizationId;
    cell: GridCell;
  }>;
  agents: Array<{
    id: AgentId;
    cell: GridCell;
    organizationId?: OrganizationId;
    specialty?: "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";
    health?: number;
    state?: "idle" | "moving" | "working" | "injured" | "dead";
  }>;
  economy?: {
    gameTime: { month: number; day: number; hour: number; ticksPerMonth: number };
    district: { id: DistrictId; name: string };
    parcels: Array<{
      id: ParcelId;
      cell: GridCell;
      price: number;
      zoning: "residential" | "industrial" | "mixed";
      ownerOrganizationId: OrganizationId | null;
      buildingId: BuildingId | null;
    }>;
    cash: number;
    inventory: { cement: number; brick: number; steel: number; capacity: number };
    production: Array<{
      output: "cement" | "brick" | "steel";
      cycleProgress: number;
      cycleLength: number;
      outputAmount: number;
      operational: boolean;
      investmentCost: number;
      operatingCost: number;
    }>;
    crew: { capacity: number; used: number };
    influence: number;
    constructionOptions: Array<{
      type: BuildingType;
      name: string;
      allowedZoning: Array<"residential" | "industrial" | "mixed">;
      cost: number;
      baseCost: number;
      workRequired: number;
      capacity: number;
      baseRent: number;
      resources: { cement: number; brick: number; steel: number };
      upgradeCost: number;
      upgradeWorkRequired: number;
      upgradeResources: { cement: number; brick: number; steel: number };
      upgradeRentBonusPercent: number;
    }>;
    buildings: Array<{
      id: BuildingId;
      ownerOrganizationId: OrganizationId;
      parcelId: ParcelId;
      type: BuildingType;
      level: number;
      condition: number;
      tenantId: TenantId | null;
      tenantIds: TenantId[];
      capacity: number;
      upgraded: boolean;
      effectiveRent: number;
    }>;
    constructionSites: Array<{
      id: ConstructionSiteId;
      parcelId: ParcelId;
      ownerOrganizationId: OrganizationId;
      buildingType: BuildingType;
      progress: number;
      workRequired: number;
      upgradeBuildingId: BuildingId | null;
      repairBuildingId: BuildingId | null;
      crewCapacity: number;
    }>;
    tenants: Array<{
      id: TenantId;
      profile: "household" | "maker" | "shopkeeper";
      preferredBuildingType: BuildingType;
      activeContractBuildingId: BuildingId | null;
      leaseRemaining: number;
      budget: number;
      satisfaction: number;
    }>;
    ordinance: {
      id: PolicyId;
      name: string;
      status: "proposed" | "approved" | "active" | "expired" | "rejected";
      expiresAtTick: Tick | null;
      materialCostModifierPercent: number;
      rentModifierPercent: number;
      influenceRequired: number;
      approvalChancePercent: number;
    };
    illegalRoute: {
      detectionChancePercent: number;
      benefitOnSuccess: number;
      heatOnAttempt: number;
      fineOnDetection: number;
      cooldownRemainingTicks: number;
    };
    market: { prices: { cement: number; brick: number; steel: number } };
    maintenance: { repairCost: number; repairWorkRequired: number };
    recentTransactions: Array<{
      tick: Tick;
      cause: string;
      amount: number;
      direction: "credit" | "debit";
    }>;
    rival: {
      parcels: number;
      buildings: number;
      occupiedBuildings: number;
      lastAction: string;
      lastReason: string;
    };
    heat: number;
    policePressure: number;
    lastCrimeOutcome: "none" | "profitable" | "detected";
    publicOpportunity: { policyId: PolicyId; name: string };
  };
};

const mapSchema = z.object({
  width: z.literal(64),
  height: z.literal(64),
});

export const viewProjectionV1Schema = z.object({
  projectionVersion: z.literal(1),
  tick: tickSchema,
  map: mapSchema,
  structures: z.array(
    z.object({
      id: structureIdSchema,
      ownerOrganizationId: organizationIdSchema,
      cell: gridCellSchema,
    }),
  ),
  agents: z.array(
    z.object({
      id: agentIdSchema,
      cell: gridCellSchema,
      organizationId: organizationIdSchema.optional(),
      specialty: z.enum(["supervisor", "construction_worker", "maintenance_technician", "enforcer"]).optional(),
      health: z.number().int().min(0).max(100).optional(),
      state: z.enum(["idle", "moving", "working", "injured", "dead"]).optional(),
    }),
  ),
  economy: z
    .object({
      gameTime: z.object({
        month: z.number().int().positive(),
        day: z.number().int().positive(),
        hour: z.number().int().min(0).max(23),
        ticksPerMonth: z.number().int().positive(),
      }),
      district: z.object({ id: districtIdSchema, name: z.string() }),
      parcels: z.array(
        z.object({
          id: parcelIdSchema,
          cell: gridCellSchema,
          price: moneySchema,
          zoning: zoningSchema,
          ownerOrganizationId: organizationIdSchema.nullable(),
          buildingId: buildingIdSchema.nullable(),
        }),
      ),
      cash: moneySchema,
      inventory: z.object({
        cement: z.number().int().nonnegative(),
        brick: z.number().int().nonnegative(),
        steel: z.number().int().nonnegative(),
        capacity: z.number().int().positive(),
      }),
      production: z.array(
        z.object({
          output: z.enum(["cement", "brick", "steel"]),
          cycleProgress: z.number().int().nonnegative(),
          cycleLength: z.number().int().positive(),
          outputAmount: z.number().int().positive(),
          operational: z.boolean(),
          investmentCost: moneySchema,
          operatingCost: moneySchema,
        }),
      ),
      crew: z.object({
        capacity: z.number().int().positive(),
        used: z.number().int().nonnegative(),
      }),
      influence: z.number().int().nonnegative(),
      constructionOptions: z.array(
        z.object({
          type: buildingTypeSchema,
          name: z.string(),
          allowedZoning: z.array(zoningSchema),
          cost: moneySchema,
          baseCost: moneySchema,
          workRequired: z.number().int().positive(),
          capacity: z.number().int().positive(),
          baseRent: moneySchema,
          resources: z.object({
            cement: z.number().int().nonnegative(),
            brick: z.number().int().nonnegative(),
            steel: z.number().int().nonnegative(),
          }),
          upgradeCost: moneySchema,
          upgradeWorkRequired: z.number().int().positive(),
          upgradeResources: z.object({
            cement: z.number().int().nonnegative(),
            brick: z.number().int().nonnegative(),
            steel: z.number().int().nonnegative(),
          }),
          upgradeRentBonusPercent: z.number().int().nonnegative(),
        }),
      ),
      buildings: z.array(
        z.object({
          id: buildingIdSchema,
          ownerOrganizationId: organizationIdSchema,
          parcelId: parcelIdSchema,
          type: buildingTypeSchema,
          level: z.number().int().positive(),
          condition: z.number().int().min(0).max(100),
          tenantId: tenantIdSchema.nullable(),
          tenantIds: z.array(tenantIdSchema),
          capacity: z.number().int().positive(),
          upgraded: z.boolean(),
          effectiveRent: moneySchema,
        }),
      ),
      constructionSites: z.array(
        z.object({
          id: constructionSiteIdSchema,
          parcelId: parcelIdSchema,
          ownerOrganizationId: organizationIdSchema,
          buildingType: buildingTypeSchema,
          progress: z.number().int().nonnegative(),
          workRequired: z.number().int().positive(),
          upgradeBuildingId: buildingIdSchema.nullable(),
          repairBuildingId: buildingIdSchema.nullable(),
          crewCapacity: z.number().int().positive(),
        }),
      ),
      tenants: z.array(
        z.object({
          id: tenantIdSchema,
          profile: z.enum(["household", "maker", "shopkeeper"]),
          preferredBuildingType: buildingTypeSchema,
          activeContractBuildingId: buildingIdSchema.nullable(),
          leaseRemaining: z.number().int().nonnegative(),
          budget: moneySchema,
          satisfaction: z.number().int().min(0).max(100),
        }),
      ),
      ordinance: z.object({
        id: policyIdSchema,
        name: z.string(),
        status: z.enum(["proposed", "approved", "active", "expired", "rejected"]),
        expiresAtTick: tickSchema.nullable(),
        materialCostModifierPercent: z.number().int(),
        rentModifierPercent: z.number().int(),
        influenceRequired: z.number().int().nonnegative(),
        approvalChancePercent: z.number().int().min(0).max(100),
      }),
      illegalRoute: z.object({
        detectionChancePercent: z.number().int().min(0).max(100),
        benefitOnSuccess: moneySchema,
        heatOnAttempt: z.number().int().positive(),
        fineOnDetection: moneySchema,
        cooldownRemainingTicks: z.number().int().nonnegative(),
      }),
      market: z.object({
        prices: z.object({ cement: moneySchema, brick: moneySchema, steel: moneySchema }),
      }),
      maintenance: z.object({
        repairCost: moneySchema,
        repairWorkRequired: z.number().int().positive(),
      }),
      recentTransactions: z.array(
        z.object({
          tick: tickSchema,
          cause: z.string(),
          amount: moneySchema,
          direction: z.enum(["credit", "debit"]),
        }),
      ),
      rival: z.object({
        parcels: z.number().int().nonnegative(),
        buildings: z.number().int().nonnegative(),
        occupiedBuildings: z.number().int().nonnegative(),
        lastAction: z.string(),
        lastReason: z.string(),
      }),
      heat: z.number().int().nonnegative(),
      policePressure: z.number().int().nonnegative(),
      lastCrimeOutcome: z.enum(["none", "profitable", "detected"]),
      publicOpportunity: z.object({ policyId: policyIdSchema, name: z.string() }),
    })
    .optional(),
});

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
  }>;
  economy?: {
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
    }>;
    crew: { capacity: number; used: number };
    influence: number;
    constructionOptions: Array<{
      type: BuildingType;
      name: string;
      allowedZoning: Array<"residential" | "industrial" | "mixed">;
      cost: number;
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
      parcelId: ParcelId;
      type: BuildingType;
      level: number;
      condition: number;
      tenantId: TenantId | null;
      upgraded: boolean;
      effectiveRent: number;
    }>;
    constructionSites: Array<{
      id: ConstructionSiteId;
      parcelId: ParcelId;
      buildingType: BuildingType;
      progress: number;
      workRequired: number;
      upgradeBuildingId: BuildingId | null;
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
    };
    illegalRoute: {
      detectionChancePercent: number;
      benefitOnSuccess: number;
      heatOnAttempt: number;
      fineOnDetection: number;
    };
    recentTransactions: Array<{
      tick: Tick;
      cause: string;
      amount: number;
      direction: "credit" | "debit";
    }>;
    rival: { cash: number; parcels: number; buildings: number; occupiedBuildings: number };
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
    }),
  ),
  economy: z
    .object({
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
          parcelId: parcelIdSchema,
          type: buildingTypeSchema,
          level: z.number().int().positive(),
          condition: z.number().int().min(0).max(100),
          tenantId: tenantIdSchema.nullable(),
          upgraded: z.boolean(),
          effectiveRent: moneySchema,
        }),
      ),
      constructionSites: z.array(
        z.object({
          id: constructionSiteIdSchema,
          parcelId: parcelIdSchema,
          buildingType: buildingTypeSchema,
          progress: z.number().int().nonnegative(),
          workRequired: z.number().int().positive(),
          upgradeBuildingId: buildingIdSchema.nullable(),
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
      }),
      illegalRoute: z.object({
        detectionChancePercent: z.number().int().min(0).max(100),
        benefitOnSuccess: moneySchema,
        heatOnAttempt: z.number().int().positive(),
        fineOnDetection: moneySchema,
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
        cash: moneySchema,
        parcels: z.number().int().nonnegative(),
        buildings: z.number().int().nonnegative(),
        occupiedBuildings: z.number().int().nonnegative(),
      }),
      heat: z.number().int().nonnegative(),
      policePressure: z.number().int().nonnegative(),
      lastCrimeOutcome: z.enum(["none", "profitable", "detected"]),
      publicOpportunity: z.object({ policyId: policyIdSchema, name: z.string() }),
    })
    .optional(),
});

import { z } from "zod";

import {
  buildingIdSchema,
  facilityIdSchema,
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
  crewIdSchema,
  incidentIdSchema,
  type CrewId,
  type IncidentId,
  loanIdSchema,
  type LoanId,
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
      productionSuitability: { cement: number; brick: number; steel: number };
      estimatedTransferTax: number;
      estimatedMonthlyPropertyTax: number;
    }>;
    cash: number;
    financials: {
      assets: number;
      liabilities: number;
      equity: number;
      period: {
        month: number;
        income: number;
        expenses: number;
        netIncome: number;
        cashFlow: number;
      };
      forecast: {
        income: number;
        expenses: number;
        netCashFlow: number;
        closingCash: number;
        shortfall: number;
      };
    };
    banking: {
      bankOrganizationId: OrganizationId;
      offers: Array<{
        id: LoanId;
        principal: number;
        annualInterestRateBps: number;
        termMonths: number;
        collateralParcelId: ParcelId;
      }>;
      loans: Array<{
        id: LoanId;
        status: "active" | "delinquent" | "paid_off" | "defaulted";
        outstandingPrincipal: number;
        monthlyPayment: number;
        remainingMonths: number;
        missedPayments: number;
        collateralParcelId: ParcelId;
        nextPaymentTick: Tick | null;
      }>;
    };
    taxation: {
      beneficiaryOrganizationId: OrganizationId;
      propertyRateBps: number;
      transferRateBps: number;
      nextSettlementTick: Tick;
      lastSettlementTick: Tick | null;
      totalCollected: number;
      playerArrears: number;
      projectedMonthlyPropertyTax: number;
    };
    inventory: { cement: number; brick: number; steel: number; capacity: number };
    production: Array<{
      output: "cement" | "brick" | "steel";
      cycleProgress: number;
      cycleLength: number;
      baseOutputAmount: number;
      averageOutputAmount: number;
      nextCycleOutputAmount: number;
      operational: boolean;
      investmentCost: number;
      operatingCost: number;
      buildingId: BuildingId | null;
      suitabilityPercent: number;
      conditionPercent: number;
      upgradePercent: number;
      remainder: number;
    }>;
    crew: { capacity: number; used: number };
    crews: Array<{
      id: CrewId;
      organizationId: OrganizationId;
      supervisorAgentId: AgentId;
      workerAgentIds: AgentId[];
      assignedWorkOrderId: ConstructionSiteId | null;
    }>;
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
      production: {
        output: "cement" | "brick" | "steel";
        cycleLength: number;
        outputAmount: number;
        operatingCost: number;
      } | null;
    }>;
    buildings: Array<{
      id: BuildingId;
      ownerOrganizationId: OrganizationId;
      productionFacilityId: import("./primitives").FacilityId | null;
      parcelId: ParcelId;
      type: BuildingType;
      level: number;
      condition: number;
      tenantId: TenantId | null;
      tenantIds: TenantId[];
      capacity: number;
      upgraded: boolean;
      structuralIntegrity: number;
      state: "operational" | "burning" | "collapse_pending" | "ruin";
      casualtiesTotal: { injured: number; dead: number };
      effectiveRent: number;
      maintenanceCost: number;
      maintenanceDue: number;
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
      kind: "construction" | "upgrade" | "repair" | "clear_ruin";
      assignedCrewIds: CrewId[];
      assignedTechnicianId: AgentId | null;
    }>;
    tenants: Array<{
      id: TenantId;
      profile: "household" | "maker" | "shopkeeper";
      preferredBuildingType: BuildingType;
      activeContractBuildingId: BuildingId | null;
      leaseRemaining: number;
      budget: number;
      satisfaction: number;
      status: "available" | "contracted" | "displaced";
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
      propertyTaxModifierPercent: number;
      transferTaxModifierPercent: number;
    };
    illegalRoute: {
      detectionChancePercent: number;
      benefitOnSuccess: number;
      heatOnAttempt: number;
      fineOnDetection: number;
      cooldownRemainingTicks: number;
    };
    market: { prices: { cement: number; brick: number; steel: number } };
    maintenance: {
      policy: "balanced" | "deferred";
      nextSettlementTick: Tick;
      lastSettlementTick: Tick | null;
      monthlyCost: number;
      backlog: number;
      repairCost: number;
      repairWorkRequired: number;
    };
    insurance: {
      insurerOrganizationId: OrganizationId;
      offers: Array<{
        buildingId: BuildingId;
        coverage: "fire_basic" | "fire_plus";
        premium: number;
        coverageLimit: number;
        deductible: number;
        exclusions: Array<"sabotage" | "deterioration" | "blast">;
      }>;
      contracts: Array<{
        buildingId: BuildingId;
        coverage: "fire_basic" | "fire_plus";
        premium: number;
        coverageLimit: number;
        deductible: number;
        exclusions: Array<"sabotage" | "deterioration" | "blast">;
        status: "active" | "lapsed" | "cancelled";
        nextPremiumTick: Tick | null;
        totalPremiumPaid: number;
      }>;
      claims: Array<{
        incidentId: IncidentId;
        buildingId: BuildingId;
        coverage: "fire_basic" | "fire_plus" | null;
        status: "paid" | "excluded" | "unpaid";
        lossEstimate: number;
        payout: number;
        createdAtTick: Tick;
        processedAtTick: Tick;
      }>;
    };
    recentTransactions: Array<{
      tick: Tick;
      cause: string;
      amount: number;
      direction: "credit" | "debit";
    }>;
    incidents: Array<{
      id: IncidentId;
      buildingId: BuildingId;
      origin: "sabotage" | "deterioration" | "blast";
      intensity: number;
      status: "active" | "resolved";
      casualties: { injured: number; dead: number };
      createdAtTick: Tick;
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
      specialty: z
        .enum(["supervisor", "construction_worker", "maintenance_technician", "enforcer"])
        .optional(),
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
          productionSuitability: z.object({
            cement: z.number().int().positive(),
            brick: z.number().int().positive(),
            steel: z.number().int().positive(),
          }),
          estimatedTransferTax: moneySchema,
          estimatedMonthlyPropertyTax: moneySchema,
        }),
      ),
      cash: moneySchema,
      financials: z.object({
        assets: moneySchema,
        liabilities: moneySchema,
        equity: moneySchema,
        period: z.object({
          month: z.number().int().positive(),
          income: z.number().int().nonnegative(),
          expenses: z.number().int().nonnegative(),
          netIncome: z.number().int(),
          cashFlow: z.number().int(),
        }),
        forecast: z.object({
          income: z.number().int().nonnegative(),
          expenses: z.number().int().nonnegative(),
          netCashFlow: z.number().int(),
          closingCash: z.number().int().nonnegative(),
          shortfall: z.number().int().nonnegative(),
        }),
      }),
      banking: z.object({
        bankOrganizationId: organizationIdSchema,
        offers: z.array(
          z.object({
            id: loanIdSchema,
            principal: moneySchema,
            annualInterestRateBps: z.number().int().positive(),
            termMonths: z.number().int().positive(),
            collateralParcelId: parcelIdSchema,
          }),
        ),
        loans: z.array(
          z.object({
            id: loanIdSchema,
            status: z.enum(["active", "delinquent", "paid_off", "defaulted"]),
            outstandingPrincipal: moneySchema,
            monthlyPayment: moneySchema,
            remainingMonths: z.number().int().nonnegative(),
            missedPayments: z.number().int().nonnegative(),
            collateralParcelId: parcelIdSchema,
            nextPaymentTick: tickSchema.nullable(),
          }),
        ),
      }),
      taxation: z.object({
        beneficiaryOrganizationId: organizationIdSchema,
        propertyRateBps: z.number().int().nonnegative(),
        transferRateBps: z.number().int().nonnegative(),
        nextSettlementTick: tickSchema,
        lastSettlementTick: tickSchema.nullable(),
        totalCollected: moneySchema,
        playerArrears: moneySchema,
        projectedMonthlyPropertyTax: moneySchema,
      }),
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
          baseOutputAmount: z.number().int().positive(),
          averageOutputAmount: z.number().nonnegative(),
          nextCycleOutputAmount: z.number().int().nonnegative(),
          operational: z.boolean(),
          investmentCost: moneySchema,
          operatingCost: moneySchema,
          buildingId: buildingIdSchema.nullable(),
          suitabilityPercent: z.number().int().positive(),
          conditionPercent: z.number().int().min(0).max(100),
          upgradePercent: z.number().int().positive(),
          remainder: z.number().int().min(0).max(999999),
        }),
      ),
      crew: z.object({
        capacity: z.number().int().positive(),
        used: z.number().int().nonnegative(),
      }),
      crews: z.array(
        z.object({
          id: crewIdSchema,
          organizationId: organizationIdSchema,
          supervisorAgentId: agentIdSchema,
          workerAgentIds: z.array(agentIdSchema),
          assignedWorkOrderId: constructionSiteIdSchema.nullable(),
        }),
      ),
      influence: z.number().int().nonnegative(),
      constructionOptions: z.array(
        z.object({
          type: buildingTypeSchema,
          name: z.string(),
          allowedZoning: z.array(zoningSchema),
          cost: moneySchema,
          baseCost: moneySchema,
          workRequired: z.number().int().positive(),
          capacity: z.number().int().nonnegative(),
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
          production: z
            .object({
              output: z.enum(["cement", "brick", "steel"]),
              cycleLength: z.number().int().positive(),
              outputAmount: z.number().int().positive(),
              operatingCost: moneySchema,
            })
            .nullable(),
        }),
      ),
      buildings: z.array(
        z.object({
          id: buildingIdSchema,
          ownerOrganizationId: organizationIdSchema,
          productionFacilityId: facilityIdSchema.nullable(),
          parcelId: parcelIdSchema,
          type: buildingTypeSchema,
          level: z.number().int().positive(),
          condition: z.number().int().min(0).max(100),
          tenantId: tenantIdSchema.nullable(),
          tenantIds: z.array(tenantIdSchema),
          capacity: z.number().int().nonnegative(),
          upgraded: z.boolean(),
          structuralIntegrity: z.number().int().min(0).max(100),
          state: z.enum(["operational", "burning", "collapse_pending", "ruin"]),
          casualtiesTotal: z.object({
            injured: z.number().int().nonnegative(),
            dead: z.number().int().nonnegative(),
          }),
          effectiveRent: moneySchema,
          maintenanceCost: moneySchema,
          maintenanceDue: moneySchema,
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
          crewCapacity: z.number().int().nonnegative(),
          kind: z.enum(["construction", "upgrade", "repair", "clear_ruin"]),
          assignedCrewIds: z.array(crewIdSchema),
          assignedTechnicianId: agentIdSchema.nullable(),
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
          status: z.enum(["available", "contracted", "displaced"]),
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
        propertyTaxModifierPercent: z.number().int(),
        transferTaxModifierPercent: z.number().int(),
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
        policy: z.enum(["balanced", "deferred"]),
        nextSettlementTick: tickSchema,
        lastSettlementTick: tickSchema.nullable(),
        monthlyCost: moneySchema,
        backlog: moneySchema,
        repairCost: moneySchema,
        repairWorkRequired: z.number().int().positive(),
      }),
      insurance: z.object({
        insurerOrganizationId: organizationIdSchema,
        offers: z.array(
          z.object({
            buildingId: buildingIdSchema,
            coverage: z.enum(["fire_basic", "fire_plus"]),
            premium: moneySchema,
            coverageLimit: moneySchema,
            deductible: moneySchema,
            exclusions: z.array(z.enum(["sabotage", "deterioration", "blast"])),
          }),
        ),
        contracts: z.array(
          z.object({
            buildingId: buildingIdSchema,
            coverage: z.enum(["fire_basic", "fire_plus"]),
            premium: moneySchema,
            coverageLimit: moneySchema,
            deductible: moneySchema,
            exclusions: z.array(z.enum(["sabotage", "deterioration", "blast"])),
            status: z.enum(["active", "lapsed", "cancelled"]),
            nextPremiumTick: tickSchema.nullable(),
            totalPremiumPaid: moneySchema,
          }),
        ),
        claims: z.array(
          z.object({
            incidentId: incidentIdSchema,
            buildingId: buildingIdSchema,
            coverage: z.enum(["fire_basic", "fire_plus"]).nullable(),
            status: z.enum(["paid", "excluded", "unpaid"]),
            lossEstimate: moneySchema,
            payout: moneySchema,
            createdAtTick: tickSchema,
            processedAtTick: tickSchema,
          }),
        ),
      }),
      recentTransactions: z.array(
        z.object({
          tick: tickSchema,
          cause: z.string(),
          amount: moneySchema,
          direction: z.enum(["credit", "debit"]),
        }),
      ),
      incidents: z.array(
        z.object({
          id: incidentIdSchema,
          buildingId: buildingIdSchema,
          origin: z.enum(["sabotage", "deterioration", "blast"]),
          intensity: z.number().int().min(0).max(100),
          status: z.enum(["active", "resolved"]),
          casualties: z.object({
            injured: z.number().int().nonnegative(),
            dead: z.number().int().nonnegative(),
          }),
          createdAtTick: tickSchema,
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

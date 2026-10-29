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
  developmentCodeIdSchema,
  type LoanId,
  type DevelopmentCodeId,
} from "./primitives";
import { gridCellSchema, tickSchema, type GridCell, type Tick } from "./time-and-grid";
import { moneySchema, type Money } from "./money";
import {
  buildingTypeSchema,
  zoningSchema,
  type BuildingType,
  type IntelKind,
  type IntelSource,
} from "./domain";
import { landUseSchema, type LandUse } from "./urban";

/** Resumen público de un distrito: lo que la vista de ciudad puede enseñar sin filtrar estado privado. */
export type PublicDistrictSummary = {
  id: DistrictId;
  name: string;
  slotX: number;
  slotY: number;
  role: string;
  parcels: number;
  marketableParcels: number;
  ownParcels: number;
  rivalParcels: number;
  buildings: number;
  ownBuildings: number;
  rivalBuildings: number;
  occupiedUnits: number;
  vacantUnits: number;
  rentIndexPercent: number;
  averageLandValue: number;
  facilities: number;
  publicSpaces: number;
  alerts: number;
};

/** Integer land-value scoring of V.d.4. Components sum to `rawScore`; clamp produces `score`. */
export type LandValueBreakdown = {
  roadCentrality: number;
  commercialAccess: number;
  civicAmenities: number;
  frontage: number;
  codePotential: number;
  services: number;
  industrialExternality: number;
  isolation: number;
  seedVariation: number;
  rawScore: number;
  clampAdjustment: number;
  score: number;
  targetValue: number;
};

export type ViewProjectionV2 = {
  projectionVersion: 2;
  /** Distrito que el renderer dibuja; cambiarlo no toca `GameState` (D-089). */
  observedDistrictId: DistrictId;
  city: {
    id: string;
    name: string;
    layout: { columns: number; rows: number };
    districts: PublicDistrictSummary[];
  };
  tick: Tick;
  map: {
    width: 64;
    height: 64;
    roads: { revision: number; digest: string; cells: string[] };
  };
  /** Reserved public land of the observed district (D-092). */
  publicSpaces: Array<{
    id: string;
    kind: string;
    blockId: string | null;
    cells: GridCell[];
    operatorOrganizationId: OrganizationId;
  }>;
  /** Municipal functions of the observed district, with their physical buildings. */
  facilities: Array<{
    id: string;
    kind: string;
    districtId: DistrictId;
    parcelIds: ParcelId[];
    buildingIds: BuildingId[];
    publicSpaceIds: string[];
    operatorOrganizationId: OrganizationId;
    capacity: number;
    serviceProfileId: string;
    /** Road cells the service graph starts from (D-092, V.d.5). */
    accessCells: GridCell[];
    coverage: {
      demand: number;
      effectiveCapacity: number;
      served: number;
      coveragePercent: number;
      saturated: boolean;
    } | null;
  }>;
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
      /** Every cell of the parcel; `cell` remains its stable anchor for picking and sprites. */
      cells: GridCell[];
      baseLandValue: number;
      marketValue: number;
      landValueBreakdown: LandValueBreakdown;
      /** Accessibility and facility coverage of V.d.5, in percent. */
      serviceCoverage: {
        transport: number;
        security: number;
        fire: number;
        health: number;
        education: number;
        market: number;
        parks: number;
      };
      /** Display/legacy family derived from the development code; not a rule. */
      zoning: "residential" | "industrial" | "mixed";
      disposition: "marketable" | "public" | "infrastructure";
      developmentCodeId: DevelopmentCodeId;
      allowedUses: LandUse[];
      currentUses: LandUse[];
      ownerOrganizationId: OrganizationId | null;
      /** Derived first building, kept for the current UI; `buildingIds` is the full relation. */
      buildingId: BuildingId | null;
      buildingIds: BuildingId[];
      productionSuitability: { cement: number; brick: number; steel: number };
      estimatedTransferTax: number;
      estimatedMonthlyPropertyTax: number;
      permittedBuildingTypes: BuildingType[];
      permitStatus: "approved" | "denied" | "expired" | null;
      permitExpiresAtTick: Tick | null;
      regulatoryRiskPercent: number;
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
      auctions: Array<{
        loanId: LoanId;
        collateralParcelId: ParcelId;
        sellerOrganizationId: OrganizationId;
        reservePrice: number;
        highestBid: number;
        highestBidderOrganizationId: OrganizationId | null;
        status: "open" | "closed" | "executed";
        closesAtTick: Tick;
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
      allowedUses: LandUse[];
      municipal: boolean;
      densityBonusFloors: number;
      densityBonusFarPercent: number;
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
      size: number;
      segmentId: string;
      searchMonths: number;
      incomeFactorPercent: number;
      origin: "authored" | "market";
    }>;
    urbanServices: Array<{
      id: "transport" | "security" | "cleaning";
      qualityPercent: number;
      radiusCells: number;
      buildingsCovered: number;
      meanCoveragePercent: number;
    }>;
    municipal: {
      reserve: Money;
      plannedByCategory: Record<string, Money>;
      serviceLevelPercentByCategory: Record<string, number>;
      revenueThisMonthBySource: Record<string, Money>;
      revenueTotalBySource: Record<string, Money>;
      serviceFeeDueNextSettlement: Money;
      spentTotalByCategory: Record<string, Money>;
      unfundedTotalByCategory: Record<string, Money>;
      deficitMonths: number;
      surplusMonths: number;
      lastSettlementTick: Tick | null;
    };
    politics: {
      seatsByPartyId: Record<string, number>;
      governingPartyId: string;
      governingPartyName: string;
      moodByIssue: Record<string, number>;
      supportPercentByPartyId: Record<string, number>;
      lastTurnoutPercent: number;
      electionsHeld: number;
      lastElectionTick: Tick | null;
      nextElectionTick: Tick;
      nextDebateTick: Tick | null;
      councilOrdinanceId: string | null;
      parties: Array<{
        id: string;
        name: string;
        seats: number;
        supportPercent: number;
        positionByIssue: Record<string, number>;
      }>;
    };
    employment: {
      jobs: number;
      jobsBySector: Record<string, number>;
      workers: number;
      employedWorkers: number;
      unemployedWorkers: number;
      employmentRatePercent: number;
      salaryIndexPercent: number;
      incomeIndexPercentBySegment: Record<string, number>;
      lastSettlementTick: Tick | null;
    };
    housingMarket: {
      lastSettlementTick: Tick | null;
      arrivalsTotal: number;
      departuresTotal: number;
      rentIndexPercentByBuildingType: Record<string, number>;
      vacancyPercentByBuildingType: Record<string, number>;
      segments: Array<{
        id: "household" | "maker" | "shopkeeper";
        label: string;
        population: number;
        populationCap: number;
        appealPercent: number;
        compatibleSlots: number;
        vacantSlots: number;
        affordableVacantSlots: number;
      }>;
    };
    macroEvents: {
      active: Array<{
        id: string;
        type:
          | "material_scarcity"
          | "economic_recession"
          | "population_migration"
          | "construction_boom"
          | "housing_crisis"
          | "labor_shortage";
        label: string;
        startTick: Tick;
        endTick: Tick;
        intensity: number;
        modifiers: {
          materialCostModifierPercent?: number;
          rentModifierPercent?: number;
          vacancyModifierPercent?: number;
          constructionCostModifierPercent?: number;
          laborCostModifierPercent?: number;
          demandModifierPercent?: number;
        };
      }>;
      aggregatedModifiers: {
        materialCostModifierPercent?: number;
        rentModifierPercent?: number;
        vacancyModifierPercent?: number;
        constructionCostModifierPercent?: number;
        laborCostModifierPercent?: number;
        demandModifierPercent?: number;
      };
      nextCheckTick: Tick;
    };
    automation: {
      policies: {
        property: "manual" | "fill_vacancies";
        finance: "manual" | "cover_shortfall";
        maintenanceRepairThreshold: number | null;
        financeCashFloor: Money;
      };
      /** Tareas rutinarias detectadas antes de aplicar la automatización. */
      routineTaskCount: number;
    };
    publicContracts: {
      open: Array<{
        id: string;
        kind: "public_works" | "supply";
        title: string;
        budget: Money;
        bond: Money;
        requiredBuildings: number;
        closesAtTick: Tick;
        executesAtTick: Tick;
        status: "open" | "awarded";
        awardedToOrganizationId: OrganizationId | null;
        awardedAmount: Money | null;
        bidCount: number;
        playerBid: Money | null;
      }>;
      history: Array<{
        id: string;
        kind: "public_works" | "supply";
        title: string;
        status: "completed" | "failed" | "defaulted";
        awardedToOrganizationId: OrganizationId | null;
        awardedAmount: Money | null;
      }>;
      reliability: { awarded: number; completed: number; defaulted: number };
    };
    reputation: {
      standingByGroup: { residents: number; municipality: number; banks: number };
      bankRateModifierBps: number;
      residentFactorPercent: number;
      influenceGainPerMonth: number;
      facts: Array<{
        id: string;
        kind:
          | "contract_completed"
          | "contract_defaulted"
          | "households_displaced"
          | "casualties"
          | "violent_sabotage"
          | "tax_arrears"
          | "maintenance_backlog"
          | "loan_defaulted"
          | "loan_paid_off";
        atTick: Tick;
        magnitude: number;
      }>;
    };
    intelligence: {
      commissionCost: number;
      cooldownRemainingTicks: number;
      staleAfterMonths: number;
      kinds: Array<{
        kind: IntelKind;
        label: string;
        marketErrorPercent: number;
        contactsErrorPercent: number;
      }>;
      estimates: Array<{
        id: string;
        subjectOrganizationId: OrganizationId;
        kind: IntelKind;
        label: string;
        source: IntelSource;
        value: number;
        accuracyPercent: number;
        ageMonths: number;
        effectiveAccuracyPercent: number;
      }>;
    };
    ordinance: {
      id: PolicyId;
      name: string;
      status: "proposed" | "approved" | "active" | "expired" | "rejected" | "withdrawn";
      expiresAtTick: Tick | null;
      materialCostModifierPercent: number;
      rentModifierPercent: number;
      influenceRequired: number;
      approvalChancePercent: number;
      propertyTaxModifierPercent: number;
      transferTaxModifierPercent: number;
      permitApprovalModifierPercent: number;
      densityBonusFloors: number;
      densityBonusFarPercent: number;
      densityAppliesToRole: string | null;
    };
    policyOptions: Array<{
      id: PolicyId;
      name: string;
      materialCostModifierPercent: number;
      rentModifierPercent: number;
      influenceRequired: number;
      approvalChancePercent: number;
      propertyTaxModifierPercent: number;
      transferTaxModifierPercent: number;
      permitApprovalModifierPercent: number;
      densityBonusFloors: number;
      densityBonusFarPercent: number;
      densityAppliesToRole: string | null;
    }>;
    alerts: Array<{
      id: string;
      severity: "high" | "medium" | "low";
      kind: "liquidity" | "debt" | "maintenance" | "permit" | "auction" | "occupancy";
      message: string;
      targetId: string | null;
    }>;
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
    };
    heat: number;
    policePressure: number;
    lastCrimeOutcome: "none" | "profitable" | "detected";
    publicOpportunity: { policyId: PolicyId; name: string };
  };
};

const projectedRoadCellSchema = z
  .string()
  .regex(/^(?:0|[1-9]|[1-5]\d|6[0-3]):(?:0|[1-9]|[1-5]\d|6[0-3])$/);

const mapSchema = z.object({
  width: z.literal(64),
  height: z.literal(64),
  roads: z.object({
    revision: z.number().int().nonnegative(),
    digest: z.string().regex(/^[0-9a-f]{8}$/),
    cells: z.array(projectedRoadCellSchema),
  }),
});

export const publicDistrictSummarySchema = z.object({
  id: districtIdSchema,
  name: z.string().min(1),
  slotX: z.number().int().min(0),
  slotY: z.number().int().min(0),
  role: z.string().min(1),
  parcels: z.number().int().nonnegative(),
  marketableParcels: z.number().int().nonnegative(),
  ownParcels: z.number().int().nonnegative(),
  rivalParcels: z.number().int().nonnegative(),
  buildings: z.number().int().nonnegative(),
  ownBuildings: z.number().int().nonnegative(),
  rivalBuildings: z.number().int().nonnegative(),
  occupiedUnits: z.number().int().nonnegative(),
  vacantUnits: z.number().int().nonnegative(),
  rentIndexPercent: z.number(),
  averageLandValue: moneySchema,
  facilities: z.number().int().nonnegative(),
  publicSpaces: z.number().int().nonnegative(),
  alerts: z.number().int().nonnegative(),
});

export const landValueBreakdownSchema = z.object({
  roadCentrality: z.number().int().min(0).max(20),
  commercialAccess: z.number().int().min(0).max(12),
  civicAmenities: z.number().int().min(0).max(10),
  frontage: z.number().int().min(0).max(6),
  codePotential: z.number().int().min(0).max(12),
  services: z.number().int().min(0).max(10),
  industrialExternality: z.number().int().min(-18).max(0),
  isolation: z.number().int().min(-20).max(0),
  seedVariation: z.number().int().min(-3).max(3),
  rawScore: z.number().int().min(-41).max(73),
  clampAdjustment: z.number().int(),
  score: z.number().int().min(-40).max(60),
  targetValue: moneySchema,
});

export const viewProjectionV2Schema = z.object({
  projectionVersion: z.literal(2),
  observedDistrictId: districtIdSchema,
  city: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    layout: z.object({ columns: z.number().int(), rows: z.number().int() }),
    districts: z.array(publicDistrictSummarySchema).length(9),
  }),
  tick: tickSchema,
  map: mapSchema,
  publicSpaces: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.string().min(1),
      blockId: z.string().min(1).nullable(),
      cells: z.array(gridCellSchema).min(1),
      operatorOrganizationId: organizationIdSchema,
    }),
  ),
  facilities: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.string().min(1),
      districtId: districtIdSchema,
      parcelIds: z.array(parcelIdSchema).min(1),
      buildingIds: z.array(buildingIdSchema),
      publicSpaceIds: z.array(z.string().min(1)),
      operatorOrganizationId: organizationIdSchema,
      capacity: z.number().int().positive(),
      serviceProfileId: z.string().min(1),
      accessCells: z.array(gridCellSchema),
      coverage: z
        .object({
          demand: z.number().int().nonnegative(),
          effectiveCapacity: z.number().int().nonnegative(),
          served: z.number().int().nonnegative(),
          coveragePercent: z.number().int().min(0).max(100),
          saturated: z.boolean(),
        })
        .nullable(),
    }),
  ),
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
          cells: z.array(gridCellSchema).min(1),
          baseLandValue: moneySchema,
          marketValue: moneySchema,
          landValueBreakdown: landValueBreakdownSchema,
          serviceCoverage: z.object({
            transport: z.number().int().min(0).max(100),
            security: z.number().int().min(0).max(100),
            fire: z.number().int().min(0).max(100),
            health: z.number().int().min(0).max(100),
            education: z.number().int().min(0).max(100),
            market: z.number().int().min(0).max(100),
            parks: z.number().int().min(0).max(100),
          }),
          zoning: zoningSchema,
          disposition: z.enum(["marketable", "public", "infrastructure"]),
          developmentCodeId: developmentCodeIdSchema,
          allowedUses: z.array(landUseSchema),
          currentUses: z.array(landUseSchema),
          ownerOrganizationId: organizationIdSchema.nullable(),
          buildingId: buildingIdSchema.nullable(),
          buildingIds: z.array(buildingIdSchema),
          productionSuitability: z.object({
            cement: z.number().int().positive(),
            brick: z.number().int().positive(),
            steel: z.number().int().positive(),
          }),
          estimatedTransferTax: moneySchema,
          estimatedMonthlyPropertyTax: moneySchema,
          permittedBuildingTypes: z.array(buildingTypeSchema),
          permitStatus: z.enum(["approved", "denied", "expired"]).nullable(),
          permitExpiresAtTick: tickSchema.nullable(),
          regulatoryRiskPercent: z.number().int().min(0).max(100),
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
        auctions: z.array(
          z.object({
            loanId: loanIdSchema,
            collateralParcelId: parcelIdSchema,
            sellerOrganizationId: organizationIdSchema,
            reservePrice: moneySchema,
            highestBid: moneySchema,
            highestBidderOrganizationId: organizationIdSchema.nullable(),
            status: z.enum(["open", "closed", "executed"]),
            closesAtTick: tickSchema,
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
          allowedUses: z.array(landUseSchema),
          municipal: z.boolean(),
          densityBonusFloors: z.number().int().min(0),
          densityBonusFarPercent: z.number().int().min(0),
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
          size: z.number().int().positive(),
          segmentId: z.string(),
          searchMonths: z.number().int().nonnegative(),
          incomeFactorPercent: z.number().int().positive(),
          origin: z.enum(["authored", "market"]),
        }),
      ),
      urbanServices: z.array(
        z.object({
          id: z.enum(["transport", "security", "cleaning"]),
          qualityPercent: z.number().int().min(0).max(100),
          radiusCells: z.number().int().nonnegative(),
          buildingsCovered: z.number().int().nonnegative(),
          meanCoveragePercent: z.number().int().min(0).max(100),
        }),
      ),
      municipal: z.object({
        reserve: moneySchema,
        plannedByCategory: z.record(z.string(), moneySchema),
        serviceLevelPercentByCategory: z.record(z.string(), z.number().int().min(0).max(100)),
        revenueThisMonthBySource: z.record(z.string(), moneySchema),
        revenueTotalBySource: z.record(z.string(), moneySchema),
        serviceFeeDueNextSettlement: moneySchema,
        spentTotalByCategory: z.record(z.string(), moneySchema),
        unfundedTotalByCategory: z.record(z.string(), moneySchema),
        deficitMonths: z.number().int().nonnegative(),
        surplusMonths: z.number().int().nonnegative(),
        lastSettlementTick: tickSchema.nullable(),
      }),
      politics: z.object({
        seatsByPartyId: z.record(z.string(), z.number().int().nonnegative()),
        governingPartyId: z.string().max(64),
        governingPartyName: z.string().max(80),
        moodByIssue: z.record(z.string(), z.number().int().min(0).max(100)),
        supportPercentByPartyId: z.record(z.string(), z.number().int().min(0).max(100)),
        lastTurnoutPercent: z.number().int().min(0).max(100),
        electionsHeld: z.number().int().nonnegative(),
        lastElectionTick: tickSchema.nullable(),
        nextElectionTick: tickSchema,
        nextDebateTick: tickSchema.nullable(),
        councilOrdinanceId: z.string().max(32).nullable(),
        parties: z.array(
          z.object({
            id: z.string().max(64),
            name: z.string().max(80),
            seats: z.number().int().nonnegative(),
            supportPercent: z.number().int().min(0).max(100),
            positionByIssue: z.record(z.string(), z.number().int().min(0).max(100)),
          }),
        ),
      }),
      employment: z.object({
        jobs: z.number().int().nonnegative(),
        jobsBySector: z.record(z.string(), z.number().int().nonnegative()),
        workers: z.number().int().nonnegative(),
        employedWorkers: z.number().int().nonnegative(),
        unemployedWorkers: z.number().int().nonnegative(),
        employmentRatePercent: z.number().int().min(0).max(100),
        salaryIndexPercent: z.number().int(),
        incomeIndexPercentBySegment: z.record(z.string(), z.number().int()),
        lastSettlementTick: tickSchema.nullable(),
      }),
      housingMarket: z.object({
        lastSettlementTick: tickSchema.nullable(),
        arrivalsTotal: z.number().int().nonnegative(),
        departuresTotal: z.number().int().nonnegative(),
        rentIndexPercentByBuildingType: z.record(z.string(), z.number().int()),
        vacancyPercentByBuildingType: z.record(z.string(), z.number()),
        segments: z.array(
          z.object({
            id: z.enum(["household", "maker", "shopkeeper"]),
            label: z.string(),
            population: z.number().int().nonnegative(),
            populationCap: z.number().int().nonnegative(),
            appealPercent: z.number().int().min(0).max(100),
            compatibleSlots: z.number().int().nonnegative(),
            vacantSlots: z.number().int().nonnegative(),
            affordableVacantSlots: z.number().int().nonnegative(),
          }),
        ),
      }),
      macroEvents: z.object({
        active: z.array(
          z.object({
            id: z.string().min(1),
            type: z.enum([
              "material_scarcity",
              "economic_recession",
              "population_migration",
              "construction_boom",
              "housing_crisis",
              "labor_shortage",
            ]),
            label: z.string(),
            startTick: tickSchema,
            endTick: tickSchema,
            intensity: z.number().min(0).max(1),
            modifiers: z.object({
              materialCostModifierPercent: z.number().optional(),
              rentModifierPercent: z.number().optional(),
              vacancyModifierPercent: z.number().optional(),
              constructionCostModifierPercent: z.number().optional(),
              laborCostModifierPercent: z.number().optional(),
              demandModifierPercent: z.number().optional(),
            }),
          }),
        ),
        aggregatedModifiers: z.object({
          materialCostModifierPercent: z.number().optional(),
          rentModifierPercent: z.number().optional(),
          vacancyModifierPercent: z.number().optional(),
          constructionCostModifierPercent: z.number().optional(),
          laborCostModifierPercent: z.number().optional(),
          demandModifierPercent: z.number().optional(),
        }),
        nextCheckTick: tickSchema,
      }),
      automation: z.object({
        policies: z.object({
          property: z.enum(["manual", "fill_vacancies"]),
          finance: z.enum(["manual", "cover_shortfall"]),
          maintenanceRepairThreshold: z.number().int().min(0).max(100).nullable(),
          financeCashFloor: moneySchema,
        }),
        routineTaskCount: z.number().int().nonnegative(),
      }),
      publicContracts: z.object({
        open: z.array(
          z.object({
            id: z.string().min(1),
            kind: z.enum(["public_works", "supply"]),
            title: z.string(),
            budget: moneySchema,
            bond: moneySchema,
            requiredBuildings: z.number().int().nonnegative(),
            closesAtTick: tickSchema,
            executesAtTick: tickSchema,
            status: z.enum(["open", "awarded"]),
            awardedToOrganizationId: organizationIdSchema.nullable(),
            awardedAmount: moneySchema.nullable(),
            bidCount: z.number().int().nonnegative(),
            playerBid: moneySchema.nullable(),
          }),
        ),
        history: z.array(
          z.object({
            id: z.string().min(1),
            kind: z.enum(["public_works", "supply"]),
            title: z.string(),
            status: z.enum(["completed", "failed", "defaulted"]),
            awardedToOrganizationId: organizationIdSchema.nullable(),
            awardedAmount: moneySchema.nullable(),
          }),
        ),
        reliability: z.object({
          awarded: z.number().int().nonnegative(),
          completed: z.number().int().nonnegative(),
          defaulted: z.number().int().nonnegative(),
        }),
      }),
      reputation: z.object({
        standingByGroup: z.object({
          residents: z.number().int().min(-100).max(100),
          municipality: z.number().int().min(-100).max(100),
          banks: z.number().int().min(-100).max(100),
        }),
        bankRateModifierBps: z.number().int(),
        residentFactorPercent: z.number().int().positive(),
        influenceGainPerMonth: z.number().int().nonnegative(),
        facts: z.array(
          z.object({
            id: z.string().min(1),
            kind: z.enum([
              "contract_completed",
              "contract_defaulted",
              "households_displaced",
              "casualties",
              "violent_sabotage",
              "tax_arrears",
              "maintenance_backlog",
              "loan_defaulted",
              "loan_paid_off",
            ]),
            atTick: tickSchema,
            magnitude: z.number().int().positive(),
          }),
        ),
      }),
      intelligence: z.object({
        commissionCost: z.number().int().positive(),
        cooldownRemainingTicks: z.number().int().nonnegative(),
        staleAfterMonths: z.number().int().positive(),
        kinds: z.array(
          z.object({
            kind: z.enum(["balance", "exposure", "arrears", "bid_intent"]),
            label: z.string().min(1),
            marketErrorPercent: z.number().int().min(0).max(100),
            contactsErrorPercent: z.number().int().min(0).max(100),
          }),
        ),
        estimates: z.array(
          z.object({
            id: z.string().min(1),
            subjectOrganizationId: organizationIdSchema,
            kind: z.enum(["balance", "exposure", "arrears", "bid_intent"]),
            label: z.string().min(1),
            source: z.enum(["market", "contacts"]),
            value: z.number().int(),
            accuracyPercent: z.number().int().min(1).max(100),
            ageMonths: z.number().int().nonnegative(),
            effectiveAccuracyPercent: z.number().int().min(1).max(100),
          }),
        ),
      }),
      ordinance: z.object({
        id: policyIdSchema,
        name: z.string(),
        status: z.enum(["proposed", "approved", "active", "expired", "rejected", "withdrawn"]),
        expiresAtTick: tickSchema.nullable(),
        materialCostModifierPercent: z.number().int(),
        rentModifierPercent: z.number().int(),
        influenceRequired: z.number().int().nonnegative(),
        approvalChancePercent: z.number().int().min(0).max(100),
        propertyTaxModifierPercent: z.number().int(),
        transferTaxModifierPercent: z.number().int(),
        permitApprovalModifierPercent: z.number().int(),
        densityBonusFloors: z.number().int().min(0),
        densityBonusFarPercent: z.number().int().min(0),
        densityAppliesToRole: z.string().nullable(),
      }),
      policyOptions: z.array(
        z.object({
          id: policyIdSchema,
          name: z.string(),
          materialCostModifierPercent: z.number().int(),
          rentModifierPercent: z.number().int(),
          influenceRequired: z.number().int().nonnegative(),
          approvalChancePercent: z.number().int().min(0).max(100),
          propertyTaxModifierPercent: z.number().int(),
          transferTaxModifierPercent: z.number().int(),
          permitApprovalModifierPercent: z.number().int(),
          densityBonusFloors: z.number().int().min(0),
          densityBonusFarPercent: z.number().int().min(0),
          densityAppliesToRole: z.string().nullable(),
        }),
      ),
      alerts: z.array(
        z.object({
          id: z.string().min(1),
          severity: z.enum(["high", "medium", "low"]),
          kind: z.enum(["liquidity", "debt", "maintenance", "permit", "auction", "occupancy"]),
          message: z.string(),
          targetId: z.string().nullable(),
        }),
      ),
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
      }),
      heat: z.number().int().nonnegative(),
      policePressure: z.number().int().nonnegative(),
      lastCrimeOutcome: z.enum(["none", "profitable", "detected"]),
      publicOpportunity: z.object({ policyId: policyIdSchema, name: z.string() }),
    })
    .optional(),
});

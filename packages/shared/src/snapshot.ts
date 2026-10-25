import { z } from "zod";

import {
  agentIdSchema,
  commandIdSchema,
  schemaVersionSchema,
  type CommandId,
  type AgentId,
  type SchemaVersion,
} from "./primitives";
import {
  organizationControlGrantSchema,
  organizationSchema,
  personSchema,
  productCommandSchema,
  playerIdentitySchema,
  crimeStateSchema,
  constructionSiteSchema,
  districtSchema,
  economicTransactionSchema,
  loanSchema,
  taxationStateSchema,
  maintenanceStateSchema,
  housingMarketStateSchema,
  employmentStateSchema,
  municipalBudgetStateSchema,
  municipalPoliticsStateSchema,
  publicContractsStateSchema,
  reputationStateSchema,
  intelligenceStateSchema,
  factionStateSchema,
  insuranceContractSchema,
  insuranceClaimSchema,
  permittingStateSchema,
  insolvencyStateSchema,
  ordinanceSchema,
  parcelSchema,
  productionFacilitySchema,
  resourceInventorySchema,
  buildingSchema,
  tenantSchema,
  agentTaskSchema,
  crewSchema,
  incidentSchema,
  testStructureSchema,
  type Organization,
  type OrganizationControlGrant,
  type Person,
  type ProductCommand,
  type PlayerIdentity,
  type TestStructure,
} from "./domain";
import {
  gridCellSchema,
  seedSchema,
  tickSchema,
  type GridCell,
  type Seed,
  type Tick,
} from "./time-and-grid";

export type SnapshotV1 = {
  schemaVersion: SchemaVersion;
  engineVersion: string;
  seed: Seed;
  tick: Tick;
  prng: {
    algorithm: "xoshiro128ss-v1";
    state: [number, number, number, number];
  };
  idCounters: {
    structure: number;
    agent: number;
    event: number;
    commandOrder: number;
    parcel?: number;
    building?: number;
    constructionSite?: number;
    transaction?: number;
    loan?: number;
  };
  map: {
    width: 64;
    height: 64;
    blockedCells: GridCell[];
  };
  playerIdentities: PlayerIdentity[];
  persons: Person[];
  organizations: Organization[];
  controlGrants: OrganizationControlGrant[];
  agents: Array<{
    id: AgentId;
    cell: GridCell;
    target: GridCell;
    path: GridCell[];
    personId?: import("./primitives").PersonId;
    organizationId?: import("./primitives").OrganizationId;
    specialty?: "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";
    health?: number;
    state?: "idle" | "moving" | "working" | "injured" | "dead";
    task?: import("./domain").Agent["task"];
    cooldownUntilTick?: Tick;
    injuredUntilTick?: Tick | null;
    lastPathRecalculationTick?: Tick;
  }>;
  structures: TestStructure[];
  processedCommandIds: CommandId[];
  pendingCommands: Array<{
    acceptedOrder: number;
    command: ProductCommand;
  }>;
  /** Additive Gate 2 payload. Gate 1 snapshots without it remain valid. */
  phase2?: {
    idCounters: {
      building: number;
      constructionSite: number;
      facility?: number;
      transaction: number;
      loan?: number;
      incident?: number;
    };
    district: import("./domain").District;
    parcels: import("./domain").Parcel[];
    balances: Array<{ organizationId: import("./primitives").OrganizationId; balance: number }>;
    inventories: Array<{
      organizationId: import("./primitives").OrganizationId;
      inventory: import("./domain").ResourceInventory;
    }>;
    facilities: import("./domain").ProductionFacility[];
    buildings: import("./domain").Building[];
    constructionSites: import("./domain").ConstructionSite[];
    tenants: import("./domain").Tenant[];
    transactions: import("./domain").EconomicTransaction[];
    ordinance: import("./domain").Ordinance;
    crime: import("./domain").CrimeState;
    influenceByOrganizationId: Array<{
      organizationId: import("./primitives").OrganizationId;
      influence: number;
    }>;
    rivalAi: {
      strategyProfile: "conservative" | "expansionist";
      lastAction: string;
      lastReason: string;
      lastFailureCode: string | null;
      cooldownUntilTick: Tick;
      memory: { lossCount: number; defaultCount: number; lastLossAmount: number };
    };
    crews?: import("./domain").Crew[];
    incidents?: import("./domain").IncidentRecord[];
    loans?: import("./domain").Loan[];
    taxation?: import("./domain").TaxationState;
    maintenance?: import("./domain").MaintenanceState;
    housingMarket?: import("./domain").HousingMarketState;
    employment?: import("./domain").EmploymentState;
    municipal?: import("./domain").MunicipalBudgetState;
    politics?: import("./domain").MunicipalPoliticsState;
    contracts?: import("./domain").PublicContractsState;
    reputation?: import("./domain").ReputationState;
    intelligence?: import("./domain").IntelligenceState;
    factions?: import("./domain").FactionState;
    insurance?: import("./domain").InsuranceState;
    permitting?: import("./domain").PermittingState;
    insolvency?: import("./domain").InsolvencyState;
  };
};

const safeCounter = z.number().int().nonnegative().safe();
const uint32 = z.number().int().nonnegative().max(0xffffffff).safe();
const prngStateSchema = z.tuple([uint32, uint32, uint32, uint32]);
const mapSnapshotSchema = z.object({
  width: z.literal(64),
  height: z.literal(64),
  blockedCells: z.array(gridCellSchema),
});
const agentSnapshotSchema = z.object({
  id: agentIdSchema,
  cell: gridCellSchema,
  target: gridCellSchema,
  path: z.array(gridCellSchema),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  specialty: z
    .enum(["supervisor", "construction_worker", "maintenance_technician", "enforcer"])
    .optional(),
  health: z.number().int().min(0).max(100).optional(),
  state: z.enum(["idle", "moving", "working", "injured", "dead"]).optional(),
  task: agentTaskSchema.nullable().optional(),
  cooldownUntilTick: tickSchema.optional(),
  injuredUntilTick: tickSchema.nullable().optional(),
  lastPathRecalculationTick: tickSchema.optional(),
});
const pendingCommandSchema = z.object({
  acceptedOrder: safeCounter,
  command: productCommandSchema,
});
const phase2SnapshotSchema = z.object({
  idCounters: z.object({
    building: safeCounter,
    constructionSite: safeCounter,
    facility: safeCounter.optional(),
    incident: safeCounter.optional(),
    loan: safeCounter.optional(),
    transaction: safeCounter,
  }),
  district: districtSchema,
  parcels: z.array(parcelSchema),
  balances: z.array(
    z.object({
      organizationId: organizationSchema.shape.id,
      balance: z.number().int().nonnegative(),
    }),
  ),
  inventories: z.array(
    z.object({ organizationId: organizationSchema.shape.id, inventory: resourceInventorySchema }),
  ),
  facilities: z.array(productionFacilitySchema),
  buildings: z.array(buildingSchema),
  constructionSites: z.array(constructionSiteSchema),
  tenants: z.array(tenantSchema),
  transactions: z.array(economicTransactionSchema),
  ordinance: ordinanceSchema,
  crime: crimeStateSchema,
  influenceByOrganizationId: z.array(
    z.object({
      organizationId: organizationSchema.shape.id,
      influence: z.number().int().nonnegative(),
    }),
  ),
  rivalAi: z
    .object({
      strategyProfile: z.enum(["conservative", "expansionist"]).default("conservative"),
      lastAction: z.string(),
      lastReason: z.string(),
      lastFailureCode: z.string().nullable(),
      cooldownUntilTick: tickSchema,
      memory: z
        .object({
          lossCount: z.number().int().nonnegative(),
          defaultCount: z.number().int().nonnegative(),
          lastLossAmount: z.number().int().nonnegative(),
        })
        .default({ lossCount: 0, defaultCount: 0, lastLossAmount: 0 }),
    })
    .default({
      strategyProfile: "conservative",
      lastAction: "none",
      lastReason: "",
      lastFailureCode: null,
      cooldownUntilTick: 0 as Tick,
      memory: { lossCount: 0, defaultCount: 0, lastLossAmount: 0 },
    }),
  crews: z.array(crewSchema).optional(),
  incidents: z.array(incidentSchema).optional(),
  loans: z.array(loanSchema).optional(),
  taxation: taxationStateSchema.optional(),
  maintenance: maintenanceStateSchema.optional(),
  housingMarket: housingMarketStateSchema.optional(),
  employment: employmentStateSchema.optional(),
  municipal: municipalBudgetStateSchema.optional(),
  politics: municipalPoliticsStateSchema.optional(),
  contracts: publicContractsStateSchema.optional(),
  reputation: reputationStateSchema.optional(),
  intelligence: intelligenceStateSchema.optional(),
  factions: factionStateSchema.optional(),
  insurance: z
    .object({
      contractsByBuildingId: z.record(z.string(), insuranceContractSchema),
      claimsByIncidentId: z.record(z.string(), insuranceClaimSchema),
    })
    .optional(),
  permitting: permittingStateSchema.optional(),
  insolvency: insolvencyStateSchema.optional(),
});

export const snapshotV1Schema = z.object({
  schemaVersion: schemaVersionSchema,
  engineVersion: z.string().min(1).max(128),
  seed: seedSchema,
  tick: tickSchema,
  prng: z.object({
    algorithm: z.literal("xoshiro128ss-v1"),
    state: prngStateSchema,
  }),
  idCounters: z.object({
    structure: safeCounter,
    agent: safeCounter,
    event: safeCounter,
    commandOrder: safeCounter,
    parcel: safeCounter.optional(),
    building: safeCounter.optional(),
    constructionSite: safeCounter.optional(),
    facility: safeCounter.optional(),
    transaction: safeCounter.optional(),
  }),
  map: mapSnapshotSchema,
  playerIdentities: z.array(playerIdentitySchema),
  persons: z.array(personSchema),
  organizations: z.array(organizationSchema),
  controlGrants: z.array(organizationControlGrantSchema),
  agents: z.array(agentSnapshotSchema),
  structures: z.array(testStructureSchema),
  processedCommandIds: z.array(commandIdSchema),
  pendingCommands: z.array(pendingCommandSchema),
  phase2: phase2SnapshotSchema.optional(),
});

export type SnapshotValidationIssue = {
  code:
    | "DUPLICATE_ID"
    | "MISSING_REFERENCE"
    | "DUPLICATE_CELL"
    | "CELL_OUT_OF_BOUNDS"
    | "DUPLICATE_ORDER";
  path: string;
};

function hasDuplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function inBounds(cell: GridCell): boolean {
  return cell.x < 64 && cell.y < 64;
}

export function validateSnapshotReferences(snapshot: SnapshotV1): SnapshotValidationIssue[] {
  const issues: SnapshotValidationIssue[] = [];
  const personIds = new Set(snapshot.persons.map((person) => person.id));
  const organizationIds = new Set(snapshot.organizations.map((organization) => organization.id));
  const organizationById = new Map(
    snapshot.organizations.map((organization) => [organization.id, organization]),
  );
  const structureIds = snapshot.structures.map((structure) => structure.id);
  const agentIds = snapshot.agents.map((agent) => agent.id);
  const cells = [
    ...snapshot.map.blockedCells,
    ...snapshot.structures.map((structure) => structure.cell),
  ];

  if (hasDuplicate(snapshot.playerIdentities.map((identity) => identity.id))) {
    issues.push({ code: "DUPLICATE_ID", path: "playerIdentities" });
  }
  if (hasDuplicate(snapshot.persons.map((person) => person.id))) {
    issues.push({ code: "DUPLICATE_ID", path: "persons" });
  }
  if (hasDuplicate(snapshot.organizations.map((organization) => organization.id))) {
    issues.push({ code: "DUPLICATE_ID", path: "organizations" });
  }
  if (hasDuplicate(structureIds) || hasDuplicate(agentIds)) {
    issues.push({ code: "DUPLICATE_ID", path: "entities" });
  }
  if (new Set(cells.map(cellKey)).size !== cells.length) {
    issues.push({ code: "DUPLICATE_CELL", path: "map/structures" });
  }
  if (cells.some((cell) => !inBounds(cell))) {
    issues.push({ code: "CELL_OUT_OF_BOUNDS", path: "map/structures" });
  }

  for (const identity of snapshot.playerIdentities) {
    if (!personIds.has(identity.personId)) {
      issues.push({ code: "MISSING_REFERENCE", path: `playerIdentities/${identity.id}/personId` });
    }
  }
  for (const grant of snapshot.controlGrants) {
    if (!personIds.has(grant.personId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "controlGrants/personId" });
    }
    if (!organizationIds.has(grant.organizationId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "controlGrants/organizationId" });
    }
  }
  for (const structure of snapshot.structures) {
    if (!organizationIds.has(structure.ownerOrganizationId)) {
      issues.push({
        code: "MISSING_REFERENCE",
        path: `structures/${structure.id}/ownerOrganizationId`,
      });
    }
  }
  for (const agent of snapshot.agents) {
    if (agent.personId && !personIds.has(agent.personId))
      issues.push({ code: "MISSING_REFERENCE", path: `agents/${agent.id}/personId` });
    if (agent.organizationId && !organizationIds.has(agent.organizationId))
      issues.push({ code: "MISSING_REFERENCE", path: `agents/${agent.id}/organizationId` });
    if (agent.task?.kind === "attack_agent" && !agentIds.includes(agent.task.targetAgentId))
      issues.push({ code: "MISSING_REFERENCE", path: `agents/${agent.id}/task/targetAgentId` });
    if (
      agent.task?.kind === "sabotage_building" &&
      snapshot.phase2 &&
      !snapshot.phase2.buildings.some(
        (building) => building.id === (agent.task as { targetBuildingId: string }).targetBuildingId,
      )
    )
      issues.push({ code: "MISSING_REFERENCE", path: `agents/${agent.id}/task/targetBuildingId` });
  }
  for (const pending of snapshot.pendingCommands) {
    if (!personIds.has(pending.command.issuedByPersonId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "pendingCommands/issuedByPersonId" });
    }
    if (!organizationIds.has(pending.command.actingAsOrganizationId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "pendingCommands/actingAsOrganizationId" });
    }
  }
  if (
    hasDuplicate(snapshot.pendingCommands.map((pending) => pending.command.commandId)) ||
    snapshot.pendingCommands.some((pending) =>
      snapshot.processedCommandIds.includes(pending.command.commandId),
    )
  ) {
    issues.push({ code: "DUPLICATE_ID", path: "pendingCommands/commandId" });
  }
  if (snapshot.phase2) {
    const parcelIds = new Set(snapshot.phase2.parcels.map((parcel) => parcel.id));
    const buildingIds = new Set(snapshot.phase2.buildings.map((building) => building.id));
    const tenantIds = new Set(snapshot.phase2.tenants.map((tenant) => tenant.id));
    const constructionSiteIds = snapshot.phase2.constructionSites.map((site) => site.id);
    const crewIds = new Set((snapshot.phase2.crews ?? []).map((crew) => crew.id));
    const balanceOrganizationIds = snapshot.phase2.balances.map((entry) => entry.organizationId);
    const inventoryOrganizationIds = snapshot.phase2.inventories.map(
      (entry) => entry.organizationId,
    );
    const influenceOrganizationIds = snapshot.phase2.influenceByOrganizationId.map(
      (entry) => entry.organizationId,
    );
    if (
      hasDuplicate(snapshot.phase2.tenants.map((tenant) => tenant.id)) ||
      hasDuplicate(snapshot.phase2.facilities.map((facility) => facility.id)) ||
      hasDuplicate(constructionSiteIds) ||
      hasDuplicate(snapshot.phase2.transactions.map((transaction) => transaction.id))
    ) {
      issues.push({ code: "DUPLICATE_ID", path: "phase2/entities" });
    }
    if (
      hasDuplicate(balanceOrganizationIds) ||
      hasDuplicate(inventoryOrganizationIds) ||
      hasDuplicate(influenceOrganizationIds)
    ) {
      issues.push({ code: "DUPLICATE_ID", path: "phase2/organizationState" });
    }
    for (const parcel of snapshot.phase2.parcels) {
      if (parcel.districtId !== snapshot.phase2.district.id) {
        issues.push({ code: "MISSING_REFERENCE", path: `phase2/parcels/${parcel.id}/districtId` });
      }
      if (parcel.ownerOrganizationId && !organizationIds.has(parcel.ownerOrganizationId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/parcels/${parcel.id}/ownerOrganizationId`,
        });
      }
      if (parcel.buildingId && !buildingIds.has(parcel.buildingId)) {
        issues.push({ code: "MISSING_REFERENCE", path: `phase2/parcels/${parcel.id}/buildingId` });
      }
    }
    for (const building of snapshot.phase2.buildings) {
      if (!parcelIds.has(building.parcelId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/buildings/${building.id}/parcelId`,
        });
      }
      if (building.tenantId && !tenantIds.has(building.tenantId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/buildings/${building.id}/tenantId`,
        });
      }
      if (!organizationIds.has(building.ownerOrganizationId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/buildings/${building.id}/ownerOrganizationId`,
        });
      }
      const assignedTenantIds =
        building.tenantIds.length > 0
          ? building.tenantIds
          : building.tenantId
            ? [building.tenantId]
            : [];
      if (hasDuplicate(assignedTenantIds)) {
        issues.push({ code: "DUPLICATE_ID", path: `phase2/buildings/${building.id}/tenantIds` });
      }
      if (building.tenantId && assignedTenantIds[0] !== building.tenantId) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/buildings/${building.id}/tenantId`,
        });
      }
      for (const tenantId of assignedTenantIds) {
        if (!tenantIds.has(tenantId)) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/buildings/${building.id}/tenantIds`,
          });
        }
        const tenant = snapshot.phase2.tenants.find((entry) => entry.id === tenantId);
        if (tenant?.activeContractBuildingId !== building.id) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/buildings/${building.id}/tenantIds/${tenantId}`,
          });
        }
      }
    }
    for (const tenant of snapshot.phase2.tenants) {
      if (tenant.activeContractBuildingId && !buildingIds.has(tenant.activeContractBuildingId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/tenants/${tenant.id}/activeContractBuildingId`,
        });
      }
      if (tenant.activeContractBuildingId) {
        const building = snapshot.phase2.buildings.find(
          (entry) => entry.id === tenant.activeContractBuildingId,
        );
        const assignedTenantIds = building
          ? building.tenantIds.length > 0
            ? building.tenantIds
            : building.tenantId
              ? [building.tenantId]
              : []
          : [];
        if (!assignedTenantIds.includes(tenant.id)) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/tenants/${tenant.id}/activeContractBuildingId`,
          });
        }
      }
    }
    for (const site of snapshot.phase2.constructionSites) {
      if (!parcelIds.has(site.parcelId) || !organizationIds.has(site.ownerOrganizationId)) {
        issues.push({ code: "MISSING_REFERENCE", path: `phase2/constructionSites/${site.id}` });
      }
      if (site.upgradeBuildingId && !buildingIds.has(site.upgradeBuildingId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/constructionSites/${site.id}/upgradeBuildingId`,
        });
      }
      if (site.repairBuildingId && !buildingIds.has(site.repairBuildingId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/constructionSites/${site.id}/repairBuildingId`,
        });
      }
      for (const crewId of site.assignedCrewIds)
        if (!crewIds.has(crewId))
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/constructionSites/${site.id}/assignedCrewIds`,
          });
      if (site.assignedTechnicianId && !agentIds.includes(site.assignedTechnicianId))
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/constructionSites/${site.id}/assignedTechnicianId`,
        });
    }
    for (const crew of snapshot.phase2.crews ?? []) {
      if (!organizationIds.has(crew.organizationId))
        issues.push({ code: "MISSING_REFERENCE", path: `phase2/crews/${crew.id}/organizationId` });
      if (!agentIds.includes(crew.supervisorAgentId))
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/crews/${crew.id}/supervisorAgentId`,
        });
      for (const workerId of crew.workerAgentIds)
        if (!agentIds.includes(workerId))
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/crews/${crew.id}/workerAgentIds`,
          });
    }
    for (const incident of snapshot.phase2.incidents ?? []) {
      if (incident.status === "active" && !buildingIds.has(incident.buildingId))
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/incidents/${incident.id}/buildingId`,
        });
      if (incident.causedByAgentId && !agentIds.includes(incident.causedByAgentId))
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/incidents/${incident.id}/causedByAgentId`,
        });
      if (incident.causedByOrganizationId && !organizationIds.has(incident.causedByOrganizationId))
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/incidents/${incident.id}/causedByOrganizationId`,
        });
    }
    for (const facility of snapshot.phase2.facilities) {
      if (!organizationIds.has(facility.ownerOrganizationId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/facilities/${facility.id}/ownerOrganizationId`,
        });
      }
      const kind = facility.kind ?? (facility.buildingId ? "physical" : "legacy");
      if (kind === "physical") {
        if (!facility.buildingId || !buildingIds.has(facility.buildingId)) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/facilities/${facility.id}/buildingId`,
          });
        } else {
          const building = snapshot.phase2.buildings.find(
            (entry) => entry.id === facility.buildingId,
          );
          if (building?.productionFacilityId !== facility.id) {
            issues.push({
              code: "MISSING_REFERENCE",
              path: `phase2/facilities/${facility.id}/buildingId/bidirectional`,
            });
          }
          if (building && building.ownerOrganizationId !== facility.ownerOrganizationId) {
            issues.push({
              code: "MISSING_REFERENCE",
              path: `phase2/facilities/${facility.id}/ownerOrganizationId`,
            });
          }
        }
      }
    }
    for (const building of snapshot.phase2.buildings) {
      if (!building.productionFacilityId) continue;
      const facility = snapshot.phase2.facilities.find(
        (entry) => entry.id === building.productionFacilityId,
      );
      if (
        !facility ||
        (facility.kind ?? (facility.buildingId ? "physical" : "legacy")) !== "physical" ||
        facility.buildingId !== building.id
      ) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/buildings/${building.id}/productionFacilityId/bidirectional`,
        });
      }
    }
    for (const organizationId of [
      ...balanceOrganizationIds,
      ...inventoryOrganizationIds,
      ...influenceOrganizationIds,
      ...snapshot.phase2.transactions.map((transaction) => transaction.organizationId),
      ...Object.keys(snapshot.phase2.crime.heatByOrganizationId),
      ...Object.keys(snapshot.phase2.crime.nextAvailableTickByOrganizationId),
    ]) {
      if (!organizationIds.has(organizationId as Organization["id"])) {
        issues.push({ code: "MISSING_REFERENCE", path: "phase2/organizationState" });
      }
    }
    /** Contratos públicos: la fianza, la adjudicación y la fiabilidad hablan de empresas vivas. */
    if (snapshot.phase2.contracts) {
      const contracts = snapshot.phase2.contracts;
      for (const [contractId, contract] of Object.entries(contracts.contracts)) {
        if (
          contract.awardedToOrganizationId &&
          (!organizationIds.has(contract.awardedToOrganizationId) ||
            organizationById.get(contract.awardedToOrganizationId)?.kind !== "company")
        ) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/contracts/${contractId}/awardedToOrganizationId`,
          });
        }
        for (const bid of contract.bids) {
          if (
            !organizationIds.has(bid.organizationId) ||
            organizationById.get(bid.organizationId)?.kind !== "company"
          ) {
            issues.push({
              code: "MISSING_REFERENCE",
              path: `phase2/contracts/${contractId}/bids/${bid.organizationId}`,
            });
          }
        }
      }
      for (const organizationId of Object.keys(contracts.reliabilityByOrganizationId)) {
        if (!organizationIds.has(organizationId as Organization["id"])) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/contracts/reliabilityByOrganizationId/${organizationId}`,
          });
        }
      }
    }
    if (snapshot.phase2.reputation) {
      const reputation = snapshot.phase2.reputation;
      for (const organizationId of [
        ...Object.keys(reputation.standingByOrganizationId),
        ...Object.keys(reputation.factsByOrganizationId),
      ]) {
        if (!organizationIds.has(organizationId as Organization["id"])) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/reputation/${organizationId}`,
          });
        }
      }
    }
    if (snapshot.phase2.intelligence) {
      const intelligence = snapshot.phase2.intelligence;
      if (
        !organizationIds.has(intelligence.observerOrganizationId) ||
        organizationById.get(intelligence.observerOrganizationId)?.kind !== "company"
      ) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: "phase2/intelligence/observerOrganizationId",
        });
      }
      for (const [subjectId, estimates] of Object.entries(
        intelligence.estimatesBySubjectOrganizationId,
      )) {
        if (!organizationIds.has(subjectId as Organization["id"])) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/intelligence/estimatesBySubjectOrganizationId/${subjectId}`,
          });
        }
        for (const estimate of estimates) {
          if (
            !organizationIds.has(estimate.subjectOrganizationId) ||
            estimate.subjectOrganizationId !== subjectId
          ) {
            issues.push({
              code: "MISSING_REFERENCE",
              path: `phase2/intelligence/estimatesBySubjectOrganizationId/${subjectId}/${estimate.id}`,
            });
          }
        }
      }
    }
    if (snapshot.phase2.factions) {
      const factions = snapshot.phase2.factions;
      for (const organizationId of [
        ...Object.keys(factions.profileByOrganizationId),
        ...Object.keys(factions.memoryByOrganizationId),
        ...Object.keys(factions.cycleCountByOrganizationId),
      ]) {
        if (!organizationIds.has(organizationId as Organization["id"])) {
          issues.push({ code: "MISSING_REFERENCE", path: `phase2/factions/${organizationId}` });
        }
      }
      for (const pairId of Object.keys(factions.stanceByPairId)) {
        const parts = pairId.split(">");
        const [observerId, subjectId] = parts;
        if (
          parts.length !== 2 ||
          !observerId ||
          !subjectId ||
          !organizationIds.has(observerId as Organization["id"]) ||
          !organizationIds.has(subjectId as Organization["id"])
        ) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `phase2/factions/stanceByPairId/${pairId}`,
          });
        }
      }
    }
    if (hasDuplicate(snapshot.phase2.parcels.map((parcel) => parcel.id))) {
      issues.push({ code: "DUPLICATE_ID", path: "phase2/parcels" });
    }
    if (hasDuplicate(snapshot.phase2.buildings.map((building) => building.id))) {
      issues.push({ code: "DUPLICATE_ID", path: "phase2/buildings" });
    }
  }
  const orders = snapshot.pendingCommands.map((pending) => pending.acceptedOrder);
  if (hasDuplicate(orders.map(String))) {
    issues.push({ code: "DUPLICATE_ORDER", path: "pendingCommands/acceptedOrder" });
  }

  return issues;
}

export function parseSnapshotV1(value: unknown): SnapshotV1 {
  const snapshot = snapshotV1Schema.parse(value) as unknown as SnapshotV1;
  const issues = validateSnapshotReferences(snapshot);
  if (issues.length > 0) {
    throw new Error(`Invalid snapshot references: ${issues.map((issue) => issue.path).join(", ")}`);
  }
  return snapshot;
}

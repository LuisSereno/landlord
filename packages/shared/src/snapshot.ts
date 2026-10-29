import { z } from "zod";

import {
  agentIdSchema,
  commandIdSchema,
  districtIdSchema,
  schemaVersionSchema,
  type CommandId,
  type AgentId,
  type DistrictId,
  type SchemaVersion,
} from "./primitives";
import {
  blockSchema,
  citySchema,
  districtGatewaySchema,
  publicSpaceSchema,
  urbanFacilitySchema,
} from "./urban";
import {
  organizationControlGrantSchema,
  organizationSchema,
  personSchema,
  productCommandSchema,
  playerIdentitySchema,
  crimeStateSchema,
  macroEventsStateSchema,
  automationStateSchema,
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
  roadTopologySchema,
  roadCellsFromSegments,
  roadSegmentId,
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

export type SnapshotV2 = {
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
  world: SnapshotWorld;
  playerIdentities: PlayerIdentity[];
  persons: Person[];
  organizations: Organization[];
  controlGrants: OrganizationControlGrant[];
  agents: Array<{
    id: AgentId;
    districtId: DistrictId;
    cell: GridCell;
    target: GridCell;
    path: GridCell[];
    personId?: import("./primitives").PersonId;
    organizationId?: import("./primitives").OrganizationId;
    specialty?: "supervisor" | "construction_worker" | "maintenance_technician" | "enforcer";
    health?: number;
    state?: "idle" | "moving" | "working" | "injured" | "dead";
    task?: import("./domain").Agent["task"];
    travel?: import("./domain").Agent["travel"];
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
    macroEvents?: import("./domain").MacroEventsState;
    automation?: import("./domain").AutomationState;
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
const districtMapSnapshotSchema = z.object({
  width: z.literal(64),
  height: z.literal(64),
  blockedCells: z.array(gridCellSchema),
  roads: roadTopologySchema,
});

const snapshotDistrictSchema = z.object({
  district: districtSchema,
  map: districtMapSnapshotSchema,
  blocks: z.array(blockSchema),
  publicSpaces: z.array(publicSpaceSchema),
  facilities: z.array(urbanFacilitySchema).default([]),
});

const worldSnapshotSchema = z.object({
  city: citySchema,
  gateways: z.array(districtGatewaySchema),
  districts: z.array(snapshotDistrictSchema).length(9),
});

/** Persisted shape of `WorldState` (D-088, D-089). */
export type SnapshotWorld = {
  city: import("./urban").City;
  gateways: import("./urban").DistrictGateway[];
  districts: Array<{
    district: import("./domain").District;
    map: {
      width: 64;
      height: 64;
      blockedCells: GridCell[];
      roads: import("./domain").RoadTopology;
    };
    blocks: import("./urban").Block[];
    publicSpaces: import("./urban").PublicSpace[];
    facilities: import("./urban").UrbanFacility[];
  }>;
};
const agentTravelSchema = z.object({
  fromDistrictId: districtIdSchema,
  toDistrictId: districtIdSchema,
  departAtTick: tickSchema,
  arriveAtTick: tickSchema,
  route: z.array(districtIdSchema),
});

const agentSnapshotSchema = z.object({
  id: agentIdSchema,
  districtId: districtIdSchema,
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
  travel: agentTravelSchema.nullable().optional(),
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
  macroEvents: macroEventsStateSchema.optional(),
  automation: automationStateSchema.optional(),
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

export const snapshotV2Schema = z.object({
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
  world: worldSnapshotSchema,
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

export function validateSnapshotReferences(snapshot: SnapshotV2): SnapshotValidationIssue[] {
  const issues: SnapshotValidationIssue[] = [];
  const personIds = new Set(snapshot.persons.map((person) => person.id));
  const organizationIds = new Set(snapshot.organizations.map((organization) => organization.id));
  const organizationById = new Map(
    snapshot.organizations.map((organization) => [organization.id, organization]),
  );
  const structureIds = snapshot.structures.map((structure) => structure.id);
  const agentIds = snapshot.agents.map((agent) => agent.id);
  const districtIds = new Set<DistrictId>(snapshot.world.city.districtIds);
  const districtById = new Map(snapshot.world.districts.map((entry) => [entry.district.id, entry]));
  const cells = snapshot.structures.map((structure) => structure.cell);

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
    issues.push({ code: "DUPLICATE_CELL", path: "world/structures" });
  }
  if (cells.some((cell) => !inBounds(cell))) {
    issues.push({ code: "CELL_OUT_OF_BOUNDS", path: "world/structures" });
  }
  for (const structure of snapshot.structures) {
    if (!districtIds.has(structure.districtId)) {
      issues.push({ code: "MISSING_REFERENCE", path: `world/structures/${structure.id}` });
    }
  }
  for (const agent of snapshot.agents) {
    if (!districtIds.has(agent.districtId)) {
      issues.push({ code: "MISSING_REFERENCE", path: `world/agents/${agent.id}` });
    }
  }
  if (snapshot.world.districts.length !== snapshot.world.city.districtIds.length) {
    issues.push({ code: "MISSING_REFERENCE", path: "world/districts" });
  }
  for (const districtId of snapshot.world.city.districtIds) {
    if (!districtById.has(districtId)) {
      issues.push({ code: "MISSING_REFERENCE", path: `world/districts/${districtId}` });
    }
  }
  for (const gateway of snapshot.world.gateways) {
    if (gateway.districtIds.some((id) => !districtIds.has(id))) {
      issues.push({ code: "MISSING_REFERENCE", path: `world/gateways/${gateway.id}` });
    }
  }
  for (const connection of snapshot.world.city.connections) {
    if (
      !districtIds.has(connection.fromDistrictId) ||
      !districtIds.has(connection.toDistrictId) ||
      !snapshot.world.gateways.some((gateway) => gateway.id === connection.gatewayId)
    ) {
      issues.push({ code: "MISSING_REFERENCE", path: `world/connections/${connection.id}` });
    }
  }

  const parcelCellsByDistrict = new Map<string, Set<string>>();
  if (snapshot.phase2) {
    for (const parcel of snapshot.phase2.parcels) {
      const cells = parcelCellsByDistrict.get(parcel.districtId) ?? new Set<string>();
      for (const cell of parcel.cells) cells.add(cellKey(cell));
      parcelCellsByDistrict.set(parcel.districtId, cells);
    }
  }

  for (const entry of snapshot.world.districts) {
    const scope = `world/districts/${entry.district.id}`;
    const segments = entry.map.roads.segments;
    const roadCells = roadCellsFromSegments(segments);
    const blockedKeys = new Set(entry.map.blockedCells.map(cellKey));

    if (hasDuplicate(segments.map((segment) => segment.id))) {
      issues.push({ code: "DUPLICATE_ID", path: `${scope}/roads/segments` });
    }
    const canonical = [...segments].sort(
      (left, right) =>
        left.from.y - right.from.y ||
        left.from.x - right.from.x ||
        left.class.localeCompare(right.class) ||
        left.to.y - right.to.y ||
        left.to.x - right.to.x,
    );
    if (canonical.some((segment, index) => segment !== segments[index])) {
      issues.push({ code: "DUPLICATE_ORDER", path: `${scope}/roads/segments` });
    }
    for (const segment of segments) {
      if (
        (segment.from.x !== segment.to.x && segment.from.y !== segment.to.y) ||
        segment.from.y > segment.to.y ||
        (segment.from.y === segment.to.y && segment.from.x > segment.to.x) ||
        !inBounds(segment.from) ||
        !inBounds(segment.to)
      ) {
        issues.push({ code: "CELL_OUT_OF_BOUNDS", path: `${scope}/roads/segments/${segment.id}` });
      }
      if (segment.id !== roadSegmentId(segment.class, segment.from, segment.to)) {
        issues.push({ code: "DUPLICATE_ID", path: `${scope}/roads/segments/${segment.id}` });
      }
    }
    if ([...roadCells].some((key) => blockedKeys.has(key))) {
      issues.push({ code: "DUPLICATE_CELL", path: `${scope}/roads/blockedCells` });
    }
    if (entry.map.blockedCells.some((cell) => !inBounds(cell))) {
      issues.push({ code: "CELL_OUT_OF_BOUNDS", path: `${scope}/blockedCells` });
    }
    const districtParcelCells = parcelCellsByDistrict.get(entry.district.id);
    if (districtParcelCells && [...roadCells].some((key) => districtParcelCells.has(key))) {
      issues.push({ code: "DUPLICATE_CELL", path: `${scope}/roads/phase2/parcels` });
    }
  }

  const facilityIds: string[] = [];
  const facilityBuildingIds = new Set<string>();
  const publicSpaceIdsByDistrict = new Map<string, Set<string>>();
  for (const entry of snapshot.world.districts) {
    publicSpaceIdsByDistrict.set(
      entry.district.id,
      new Set(entry.publicSpaces.map((space) => space.id)),
    );
  }
  const parcelById = new Map((snapshot.phase2?.parcels ?? []).map((parcel) => [parcel.id, parcel]));
  const buildingDistrict = new Map(
    (snapshot.phase2?.buildings ?? []).map((building) => [building.id, building.districtId]),
  );
  for (const entry of snapshot.world.districts) {
    for (const facility of entry.facilities ?? []) {
      facilityIds.push(facility.id);
      if (facility.districtId !== entry.district.id || !districtIds.has(facility.districtId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `world/districts/${entry.district.id}/facilities/${facility.id}/districtId`,
        });
      }
      if (organizationById.get(facility.operatorOrganizationId)?.kind !== "municipality") {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `world/districts/${entry.district.id}/facilities/${facility.id}/operator`,
        });
      }
      for (const parcelId of facility.parcelIds) {
        const parcel = parcelById.get(parcelId);
        if (
          !parcel ||
          parcel.districtId !== facility.districtId ||
          parcel.disposition !== "public"
        ) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `world/districts/${entry.district.id}/facilities/${facility.id}/parcels/${parcelId}/public`,
          });
        } else if (parcel.ownerOrganizationId !== facility.operatorOrganizationId) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `world/districts/${entry.district.id}/facilities/${facility.id}/parcels/${parcelId}/owner`,
          });
        }
      }
      for (const buildingId of facility.buildingIds) {
        if (
          !buildingDistrict.has(buildingId) ||
          buildingDistrict.get(buildingId) !== facility.districtId
        ) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `world/districts/${entry.district.id}/facilities/${facility.id}/buildings/${buildingId}`,
          });
        }
        if (facilityBuildingIds.has(buildingId)) {
          issues.push({
            code: "DUPLICATE_ID",
            path: `world/districts/${entry.district.id}/facilities/${facility.id}/buildings/${buildingId}`,
          });
        }
        facilityBuildingIds.add(buildingId);
      }
      const districtSpaces = publicSpaceIdsByDistrict.get(entry.district.id) ?? new Set();
      for (const spaceId of facility.publicSpaceIds) {
        if (!districtSpaces.has(spaceId)) {
          issues.push({
            code: "MISSING_REFERENCE",
            path: `world/districts/${entry.district.id}/facilities/${facility.id}/publicSpaces/${spaceId}`,
          });
        }
      }
    }
  }
  if (hasDuplicate(facilityIds)) {
    issues.push({ code: "DUPLICATE_ID", path: "world/districts/facilities" });
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
      if (!districtIds.has(parcel.districtId)) {
        issues.push({ code: "MISSING_REFERENCE", path: `phase2/parcels/${parcel.id}/districtId` });
      }
      if (parcel.ownerOrganizationId && !organizationIds.has(parcel.ownerOrganizationId)) {
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/parcels/${parcel.id}/ownerOrganizationId`,
        });
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
      if (
        incident.publiclyAttributedOrganizationId &&
        !organizationIds.has(incident.publiclyAttributedOrganizationId)
      )
        issues.push({
          code: "MISSING_REFERENCE",
          path: `phase2/incidents/${incident.id}/publiclyAttributedOrganizationId`,
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
        /** La fiabilidad la consume `SubmitPublicBid`, que sólo admite empresas. */
        if (organizationById.get(organizationId as Organization["id"])?.kind !== "company") {
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
        /** `CommissionIntelligence` solo investiga empresas: un expediente de un banco es un corrupto. */
        if (organizationById.get(subjectId as Organization["id"])?.kind !== "company") {
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
      /** En Alpha sólo las empresas son actores estratégicos: banco, municipio y aseguradora no tienen
       *  perfil, memoria, ciclos ni postura. Un snapshot con una de ellas es estado corrupto. */
      for (const organizationId of [
        ...Object.keys(factions.profileByOrganizationId),
        ...Object.keys(factions.memoryByOrganizationId),
        ...Object.keys(factions.cycleCountByOrganizationId),
      ]) {
        if (organizationById.get(organizationId as Organization["id"])?.kind !== "company") {
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
          organizationById.get(observerId as Organization["id"])?.kind !== "company" ||
          organizationById.get(subjectId as Organization["id"])?.kind !== "company"
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

/**
 * A v1 save is rejected by name, not by a schema diff (D-089). The single-district world it
 * describes has no roads-per-district, no blocks and no development codes, so it cannot be derived
 * into nine districts; the player needs to hear that instead of reading a Zod path.
 */
export class UnsupportedSnapshotVersionError extends Error {
  public readonly schemaVersion: unknown;

  public constructor(schemaVersion: unknown) {
    super(
      `UNSUPPORTED_SNAPSHOT_VERSION: el guardado tiene schemaVersion ${String(schemaVersion)} y esta versión sólo acepta 2. Las partidas Alpha v1 no se migran; crea una partida nueva o borra el slot incompatible.`,
    );
    this.name = "UnsupportedSnapshotVersionError";
    this.schemaVersion = schemaVersion;
  }
}

/**
 * A v2 save written before V.d.1/V.d.2 has point parcels, derivationVersion 1 roads, `Parcel.zoning`
 * or buildings without footprints. It is rejected by name instead of by a Zod path: the fabric
 * cannot be reinterpreted without inventing blocks, codes or footprints the original save never
 * had. The slot is left untouched.
 */
export class UnsupportedUrbanFabricError extends Error {
  public constructor() {
    super(
      "UNSUPPORTED_URBAN_FABRIC: este guardado v2 es anterior a V.d.1/V.d.2 (parcelas puntuales, red vial derivationVersion 1 o edificios sin huella) y no se migra; crea una partida nueva o borra explícitamente el slot. El archivo no se ha modificado.",
    );
    this.name = "UnsupportedUrbanFabricError";
  }
}

function isPreVd1Snapshot(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as {
    world?: { districts?: Array<{ map?: { roads?: { derivationVersion?: unknown } } }> };
    phase2?: {
      parcels?: Array<Record<string, unknown>>;
      buildings?: Array<Record<string, unknown>>;
      permitting?: { permitsByParcelId?: Record<string, Record<string, unknown>> };
    };
  };
  const district = snapshot.world?.districts?.[0];
  if (district?.map?.roads?.derivationVersion === 1) return true;
  const parcel = snapshot.phase2?.parcels?.[0];
  if (
    parcel !== undefined &&
    typeof parcel === "object" &&
    ("cell" in parcel || "zoning" in parcel || "buildingId" in parcel)
  )
    return true;
  const building = snapshot.phase2?.buildings?.[0];
  if (building !== undefined && typeof building === "object" && !("footprintCells" in building))
    return true;
  const permit = Object.values(snapshot.phase2?.permitting?.permitsByParcelId ?? {})[0];
  return permit !== undefined && "zoningAtDecision" in permit;
}

export function parseSnapshotV2(value: unknown): SnapshotV2 {
  const declaredVersion =
    typeof value === "object" && value !== null && "schemaVersion" in value
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (declaredVersion !== 2) {
    throw new UnsupportedSnapshotVersionError(declaredVersion);
  }
  if (isPreVd1Snapshot(value)) {
    throw new UnsupportedUrbanFabricError();
  }
  const snapshot = snapshotV2Schema.parse(value) as unknown as SnapshotV2;
  const issues = validateSnapshotReferences(snapshot);
  if (issues.length > 0) {
    throw new Error(`Invalid snapshot references: ${issues.map((issue) => issue.path).join(", ")}`);
  }
  return snapshot;
}

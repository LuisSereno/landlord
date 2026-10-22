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
  ordinanceSchema,
  parcelSchema,
  productionFacilitySchema,
  resourceInventorySchema,
  buildingSchema,
  tenantSchema,
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
  }>;
  structures: TestStructure[];
  processedCommandIds: CommandId[];
  pendingCommands: Array<{
    acceptedOrder: number;
    command: ProductCommand;
  }>;
  /** Additive Gate 2 payload. Gate 1 snapshots without it remain valid. */
  phase2?: {
    idCounters: { building: number; constructionSite: number; transaction: number };
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
});
const pendingCommandSchema = z.object({
  acceptedOrder: safeCounter,
  command: productCommandSchema,
});
const phase2SnapshotSchema = z.object({
  idCounters: z.object({
    building: safeCounter,
    constructionSite: safeCounter,
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
  for (const pending of snapshot.pendingCommands) {
    if (!personIds.has(pending.command.issuedByPersonId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "pendingCommands/issuedByPersonId" });
    }
    if (!organizationIds.has(pending.command.actingAsOrganizationId)) {
      issues.push({ code: "MISSING_REFERENCE", path: "pendingCommands/actingAsOrganizationId" });
    }
  }
  if (snapshot.phase2) {
    const parcelIds = new Set(snapshot.phase2.parcels.map((parcel) => parcel.id));
    const buildingIds = new Set(snapshot.phase2.buildings.map((building) => building.id));
    const tenantIds = new Set(snapshot.phase2.tenants.map((tenant) => tenant.id));
    for (const parcel of snapshot.phase2.parcels) {
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
  const snapshot = snapshotV1Schema.parse(value) as SnapshotV1;
  const issues = validateSnapshotReferences(snapshot);
  if (issues.length > 0) {
    throw new Error(`Invalid snapshot references: ${issues.map((issue) => issue.path).join(", ")}`);
  }
  return snapshot;
}

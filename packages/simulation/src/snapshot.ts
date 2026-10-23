import {
  parseAgentId,
  parseCrewId,
  parseIncidentId,
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseDistrictId,
  parseFacilityId,
  parseOrganizationId,
  parseParcelId,
  parsePolicyId,
  parseMoney,
  parsePersonId,
  parsePlayerIdentityId,
  parseStructureId,
  parseTenantId,
  parseTransactionId,
  parseSnapshotV1,
  type SnapshotV1,
} from "@landlord/shared";
import type { ProductCommand } from "@landlord/shared";
import { parseTick } from "@landlord/shared";
import { PRNG_ALGORITHM } from "./prng";
import { createInitialState, type GameState } from "./state";

export const ENGINE_VERSION = "gate2-dev";

function compareId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function compareCell(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.y - right.y || left.x - right.x;
}

function cellFromKey(value: string): { x: number; y: number } {
  const parts = value.split(":");
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (parts.length !== 2 || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    throw new Error(`Invalid blocked cell key: ${value}`);
  }
  return { x, y };
}

function cloneCommand(command: ProductCommand): ProductCommand {
  return {
    ...command,
    payload: { ...command.payload },
  } as ProductCommand;
}

export function serializeSnapshot(state: GameState, engineVersion = ENGINE_VERSION): SnapshotV1 {
  return {
    schemaVersion: 1 as SnapshotV1["schemaVersion"],
    engineVersion,
    seed: state.seed,
    tick: state.clock.tick,
    prng: {
      algorithm: PRNG_ALGORITHM,
      state: [...state.prng.state] as SnapshotV1["prng"]["state"],
    },
    idCounters: { ...state.idCounters },
    map: {
      width: 64,
      height: 64,
      blockedCells: [...state.map.blockedCells].map(cellFromKey).sort(compareCell),
    },
    playerIdentities: [...state.playerIdentities.values()].sort(compareId),
    persons: [...state.persons.values()].sort(compareId),
    organizations: [...state.organizations.values()].sort(compareId),
    controlGrants: [...state.controlGrants.values()].sort(
      (left, right) =>
        left.organizationId.localeCompare(right.organizationId) ||
        left.personId.localeCompare(right.personId),
    ),
    agents: [...state.agents.values()]
      .map((agent) => ({
        ...agent,
        cell: { ...agent.cell },
        target: { ...(agent.target ?? agent.cell) },
        path: (agent.path ?? []).map((cell) => ({ ...cell })),
      }))
      .sort(compareId),
    structures: [...state.structures.values()].sort(compareId),
    // Set insertion order is the eviction order used by bounded idempotency history.
    processedCommandIds: [...state.processedCommandIds],
    pendingCommands: [...state.pendingCommands]
      .map((pending) => ({
        acceptedOrder: pending.acceptedOrder,
        command: cloneCommand(pending.command),
      }))
      .sort((left, right) => left.acceptedOrder - right.acceptedOrder),
    phase2: {
      idCounters: { ...state.phase2.idCounters },
      district: { ...state.phase2.district },
      parcels: [...state.phase2.parcels.values()]
        .map((parcel) => ({ ...parcel, cell: { ...parcel.cell } }))
        .sort(compareId),
      balances: [...state.phase2.balances.entries()]
        .map(([organizationId, balance]) => ({ organizationId, balance }))
        .sort((left, right) => left.organizationId.localeCompare(right.organizationId)),
      inventories: [...state.phase2.inventories.entries()]
        .map(([organizationId, inventory]) => ({ organizationId, inventory: { ...inventory } }))
        .sort((left, right) => left.organizationId.localeCompare(right.organizationId)),
      facilities: [...state.phase2.facilities.values()]
        .map((facility) => ({ ...facility }))
        .sort(compareId),
      buildings: [...state.phase2.buildings.values()]
        .map((building) => ({ ...building, tenantIds: [...building.tenantIds] }))
        .sort(compareId),
      constructionSites: [...state.phase2.constructionSites.values()]
        .map((site) => ({ ...site, resourcesReserved: { ...site.resourcesReserved } }))
        .sort(compareId),
      tenants: [...state.phase2.tenants.values()].map((tenant) => ({ ...tenant })).sort(compareId),
      transactions: state.phase2.transactions.map((transaction) => ({ ...transaction })),
      ordinance: { ...state.phase2.ordinance },
      crime: {
        heatByOrganizationId: { ...state.phase2.crime.heatByOrganizationId },
        policePressure: state.phase2.crime.policePressure,
        lastOutcome: state.phase2.crime.lastOutcome,
        nextAvailableTickByOrganizationId: {
          ...state.phase2.crime.nextAvailableTickByOrganizationId,
        },
      },
      influenceByOrganizationId: [...state.phase2.influenceByOrganizationId.entries()]
        .map(([organizationId, influence]) => ({ organizationId, influence }))
        .sort((left, right) => left.organizationId.localeCompare(right.organizationId)),
      rivalAi: { ...state.phase2.rivalAi },
      crews: [...state.phase2.crews.values()]
        .map((crew) => ({ ...crew, workerAgentIds: [...crew.workerAgentIds] }))
        .sort(compareId),
      incidents: [...state.phase2.incidents.values()]
        .map((incident) => ({ ...incident, casualties: { ...incident.casualties } }))
        .sort(compareId),
    },
  };
}

export function restoreStateFromSnapshot(value: unknown): GameState {
  const snapshot = parseSnapshotV1(value);
  const rawPhase2 =
    typeof value === "object" &&
    value !== null &&
    "phase2" in value &&
    typeof value.phase2 === "object" &&
    value.phase2 !== null
      ? (value.phase2 as { constructionSites?: Array<{ id?: string; kind?: string }> })
      : undefined;
  const legacyWorkOrders = new Set(
    (rawPhase2?.constructionSites ?? []).filter((site) => !site.kind).map((site) => site.id),
  );
  const defaultState = createInitialState(snapshot.seed);
  const defaults = defaultState.phase2;
  const state: GameState = {
    seed: snapshot.seed,
    clock: { tick: parseTick(snapshot.tick), runState: "paused", speed: 1 },
    prng: {
      algorithm: snapshot.prng.algorithm,
      state: [...snapshot.prng.state] as GameState["prng"]["state"],
    },
    idCounters: { ...snapshot.idCounters },
    map: {
      width: 64,
      height: 64,
      blockedCells: new Set(snapshot.map.blockedCells.map((cell) => `${cell.x}:${cell.y}`)),
    },
    playerIdentities: new Map(
      snapshot.playerIdentities.map((identity) => [
        parsePlayerIdentityId(identity.id),
        { id: parsePlayerIdentityId(identity.id), personId: parsePersonId(identity.personId) },
      ]),
    ),
    persons: new Map([
      ...snapshot.persons.map(
        (person) => [parsePersonId(person.id), { id: parsePersonId(person.id) }] as const,
      ),
      ...[...defaultState.persons.entries()].filter(
        ([id]) => !snapshot.persons.some((person) => person.id === id),
      ),
    ]),
    organizations: new Map([
      ...snapshot.organizations.map(
        (organization) =>
          [
            parseOrganizationId(organization.id),
            { id: parseOrganizationId(organization.id), kind: organization.kind },
          ] as const,
      ),
      ...[...defaultState.organizations.entries()].filter(
        ([id]) => !snapshot.organizations.some((organization) => organization.id === id),
      ),
    ]),
    controlGrants: new Map(
      snapshot.controlGrants.map((grant) => {
        const parsed = {
          personId: parsePersonId(grant.personId),
          organizationId: parseOrganizationId(grant.organizationId),
        };
        return [`${parsed.personId}:${parsed.organizationId}`, parsed];
      }),
    ),
    agents: new Map([
      ...[...defaultState.agents.entries()],
      ...snapshot.agents.map(
        (agent) =>
          [
            parseAgentId(agent.id),
            {
              id: parseAgentId(agent.id),
              cell: { ...agent.cell },
              target: { ...agent.target },
              path: agent.path.map((cell) => ({ ...cell })),
              ...(agent.personId ? { personId: parsePersonId(agent.personId) } : {}),
              ...(agent.organizationId
                ? { organizationId: parseOrganizationId(agent.organizationId) }
                : {}),
              ...(agent.specialty ? { specialty: agent.specialty } : {}),
              health: agent.health ?? 100,
              state: agent.state ?? "idle",
              task: (agent.task as import("@landlord/shared").Agent["task"]) ?? null,
              cooldownUntilTick: parseTick(agent.cooldownUntilTick ?? 0),
              injuredUntilTick: agent.injuredUntilTick ?? null,
              lastPathRecalculationTick: parseTick(agent.lastPathRecalculationTick ?? 0),
            },
          ] as const,
      ),
    ]),
    structures: new Map(
      snapshot.structures.map((structure) => [
        parseStructureId(structure.id),
        {
          id: parseStructureId(structure.id),
          ownerOrganizationId: parseOrganizationId(structure.ownerOrganizationId),
          cell: { ...structure.cell },
        },
      ]),
    ),
    processedCommandIds: new Set(snapshot.processedCommandIds.map((id) => parseCommandId(id))),
    pendingCommands: snapshot.pendingCommands.map((pending) => ({
      acceptedOrder: pending.acceptedOrder,
      command: cloneCommand(pending.command),
    })),
    phase2: snapshot.phase2
      ? {
          idCounters: {
            ...snapshot.phase2.idCounters,
            facility: snapshot.phase2.idCounters.facility ?? 6,
            incident: snapshot.phase2.idCounters.incident ?? 0,
          },
          district: {
            id: parseDistrictId(snapshot.phase2.district.id),
            name: snapshot.phase2.district.name,
            width: 64,
            height: 64,
          },
          parcels: new Map(
            snapshot.phase2.parcels.map((parcel) => [
              parseParcelId(parcel.id),
              {
                ...parcel,
                id: parseParcelId(parcel.id),
                districtId: parseDistrictId(parcel.districtId),
                cell: { ...parcel.cell },
                price: parseMoney(parcel.price),
              },
            ]),
          ),
          balances: new Map(
            snapshot.phase2.balances.map((entry) => [
              parseOrganizationId(entry.organizationId),
              parseMoney(entry.balance),
            ]),
          ),
          inventories: new Map(
            snapshot.phase2.inventories.map((entry) => [
              parseOrganizationId(entry.organizationId),
              { ...entry.inventory },
            ]),
          ),
          facilities: new Map(
            snapshot.phase2.facilities.map((facility) => [
              parseFacilityId(facility.id),
              {
                ...facility,
                id: parseFacilityId(facility.id),
                ownerOrganizationId: parseOrganizationId(facility.ownerOrganizationId),
              },
            ]),
          ),
          buildings: new Map(
            snapshot.phase2.buildings.map((building) => [
              parseBuildingId(building.id),
              {
                ...building,
                id: parseBuildingId(building.id),
                parcelId: parseParcelId(building.parcelId),
                ownerOrganizationId: parseOrganizationId(building.ownerOrganizationId),
                tenantId: building.tenantId ? parseTenantId(building.tenantId) : null,
                tenantIds:
                  building.tenantIds.length > 0
                    ? building.tenantIds.map(parseTenantId)
                    : building.tenantId
                      ? [parseTenantId(building.tenantId)]
                      : [],
              },
            ]),
          ),
          constructionSites: new Map(
            snapshot.phase2.constructionSites.map((site) => [
              parseConstructionSiteId(site.id),
              {
                ...site,
                id: parseConstructionSiteId(site.id),
                parcelId: parseParcelId(site.parcelId),
                ownerOrganizationId: parseOrganizationId(site.ownerOrganizationId),
                upgradeBuildingId: site.upgradeBuildingId
                  ? parseBuildingId(site.upgradeBuildingId)
                  : null,
                repairBuildingId: site.repairBuildingId
                  ? parseBuildingId(site.repairBuildingId)
                  : null,
                resourcesReserved: { ...site.resourcesReserved },
                kind:
                  site.kind ??
                  (site.repairBuildingId
                    ? "repair"
                    : site.upgradeBuildingId
                      ? "upgrade"
                      : "construction"),
                targetBuildingId:
                  site.targetBuildingId ?? site.repairBuildingId ?? site.upgradeBuildingId ?? null,
                assignedCrewIds: site.assignedCrewIds ?? [],
                assignedTechnicianId: site.assignedTechnicianId ?? null,
                progress: (site.progress ?? 0) * (legacyWorkOrders.has(site.id) ? 2 : 1),
                workRequired: (site.workRequired ?? 0) * (legacyWorkOrders.has(site.id) ? 2 : 1),
              },
            ]),
          ),
          crews: snapshot.phase2.crews
            ? new Map(
                snapshot.phase2.crews.map((crew) => [
                  parseCrewId(crew.id),
                  {
                    ...crew,
                    id: parseCrewId(crew.id),
                    organizationId: parseOrganizationId(crew.organizationId),
                    supervisorAgentId: parseAgentId(crew.supervisorAgentId),
                    workerAgentIds: crew.workerAgentIds.map(parseAgentId),
                  },
                ]),
              )
            : defaults.crews,
          incidents: snapshot.phase2.incidents
            ? new Map(
                snapshot.phase2.incidents.map((incident) => [
                  parseIncidentId(incident.id),
                  {
                    ...incident,
                    id: parseIncidentId(incident.id),
                    buildingId: parseBuildingId(incident.buildingId),
                    targetOrganizationId: parseOrganizationId(incident.targetOrganizationId),
                    causedByAgentId: incident.causedByAgentId
                      ? parseAgentId(incident.causedByAgentId)
                      : null,
                    causedByOrganizationId: incident.causedByOrganizationId
                      ? parseOrganizationId(incident.causedByOrganizationId)
                      : null,
                    casualties: { ...incident.casualties },
                  },
                ]),
              )
            : defaults.incidents,
          tenants: new Map(
            snapshot.phase2.tenants.map((tenant) => [
              parseTenantId(tenant.id),
              {
                ...tenant,
                id: parseTenantId(tenant.id),
                activeContractBuildingId: tenant.activeContractBuildingId
                  ? parseBuildingId(tenant.activeContractBuildingId)
                  : null,
                budget: parseMoney(tenant.budget),
                status:
                  tenant.status ?? (tenant.activeContractBuildingId ? "contracted" : "available"),
              },
            ]),
          ),
          transactions: snapshot.phase2.transactions.map((transaction) => ({
            ...transaction,
            id: parseTransactionId(transaction.id),
            organizationId: parseOrganizationId(transaction.organizationId),
            amount: parseMoney(transaction.amount),
          })),
          ordinance: {
            ...snapshot.phase2.ordinance,
            id: parsePolicyId(snapshot.phase2.ordinance.id),
          },
          crime: {
            ...snapshot.phase2.crime,
            heatByOrganizationId: { ...snapshot.phase2.crime.heatByOrganizationId },
          },
          influenceByOrganizationId: new Map(
            snapshot.phase2.influenceByOrganizationId.map((entry) => [
              parseOrganizationId(entry.organizationId),
              entry.influence,
            ]),
          ),
          rivalAi: { ...snapshot.phase2.rivalAi },
        }
      : defaults,
  };
  return state;
}

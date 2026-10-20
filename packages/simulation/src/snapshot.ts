import {
  parseAgentId,
  parseCommandId,
  parseOrganizationId,
  parsePersonId,
  parsePlayerIdentityId,
  parseStructureId,
  parseSnapshotV1,
  type SnapshotV1,
} from "@landlord/shared";
import type { PlaceTestStructure } from "@landlord/shared";
import { parseTick } from "@landlord/shared";
import { PRNG_ALGORITHM } from "./prng";
import type { GameState } from "./state";

export const ENGINE_VERSION = "gate1-dev";

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

function cloneCommand(command: PlaceTestStructure): PlaceTestStructure {
  return {
    ...command,
    payload: { cell: { ...command.payload.cell } },
  };
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
        id: agent.id,
        cell: { ...agent.cell },
        target: { ...agent.cell },
        path: [{ ...agent.cell }],
      }))
      .sort(compareId),
    structures: [...state.structures.values()].sort(compareId),
    processedCommandIds: [...state.processedCommandIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    pendingCommands: [...state.pendingCommands]
      .map((pending) => ({
        acceptedOrder: pending.acceptedOrder,
        command: cloneCommand(pending.command),
      }))
      .sort((left, right) => left.acceptedOrder - right.acceptedOrder),
  };
}

export function restoreStateFromSnapshot(value: unknown): GameState {
  const snapshot = parseSnapshotV1(value);
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
    persons: new Map(
      snapshot.persons.map((person) => [
        parsePersonId(person.id),
        { id: parsePersonId(person.id) },
      ]),
    ),
    organizations: new Map(
      snapshot.organizations.map((organization) => [
        parseOrganizationId(organization.id),
        { id: parseOrganizationId(organization.id), kind: organization.kind },
      ]),
    ),
    controlGrants: new Map(
      snapshot.controlGrants.map((grant) => {
        const parsed = {
          personId: parsePersonId(grant.personId),
          organizationId: parseOrganizationId(grant.organizationId),
        };
        return [`${parsed.personId}:${parsed.organizationId}`, parsed];
      }),
    ),
    agents: new Map(
      snapshot.agents.map((agent) => [
        parseAgentId(agent.id),
        { id: parseAgentId(agent.id), cell: { ...agent.cell } },
      ]),
    ),
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
    events: [],
    pendingCommands: snapshot.pendingCommands.map((pending) => ({
      acceptedOrder: pending.acceptedOrder,
      command: cloneCommand(pending.command),
    })),
  };
  return state;
}

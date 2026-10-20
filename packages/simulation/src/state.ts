import {
  parseOrganizationId,
  parsePersonId,
  parsePlayerIdentityId,
  parseSeed,
  type AgentId,
  type CommandId,
  type OrganizationId,
  type PersonId,
  type PlayerIdentityId,
  type StructureId,
} from "@landlord/shared";
import type {
  Organization,
  OrganizationControlGrant,
  Person,
  PlayerIdentity,
  TestStructure,
  TestStructurePlaced,
} from "@landlord/shared";
import type { Seed } from "@landlord/shared";
import { SimulationClock, type ClockState } from "./clock";
import { createPrng, type PrngState } from "./prng";

export type EntityCounters = {
  structure: number;
  agent: number;
  event: number;
  commandOrder: number;
};

export type GameState = {
  seed: Seed;
  clock: ClockState;
  prng: PrngState;
  idCounters: EntityCounters;
  map: {
    width: 64;
    height: 64;
    blockedCells: Set<string>;
  };
  playerIdentities: Map<PlayerIdentityId, PlayerIdentity>;
  persons: Map<PersonId, Person>;
  organizations: Map<OrganizationId, Organization>;
  controlGrants: Map<string, OrganizationControlGrant>;
  agents: Map<AgentId, { id: AgentId; cell: { x: number; y: number } }>;
  structures: Map<StructureId, TestStructure>;
  processedCommandIds: Set<CommandId>;
  events: TestStructurePlaced[];
  pendingCommands: Array<{
    acceptedOrder: number;
    command: import("@landlord/shared").PlaceTestStructure;
  }>;
};

export function controlGrantKey(personId: PersonId, organizationId: OrganizationId): string {
  return `${personId}:${organizationId}`;
}

export function hasOrganizationControl(
  state: GameState,
  personId: PersonId,
  organizationId: OrganizationId,
): boolean {
  return state.controlGrants.has(controlGrantKey(personId, organizationId));
}

export function createInitialState(seed = 1): GameState {
  const normalizedSeed = parseSeed(seed);
  const personId = parsePersonId("person_00000001");
  const playerIdentityId = parsePlayerIdentityId("player_00000001");
  const controlledOrganizationId = parseOrganizationId("org_00000001");
  const independentOrganizationId = parseOrganizationId("org_00000002");
  const clock = new SimulationClock();

  return {
    seed: normalizedSeed,
    clock: clock.getState(),
    prng: createPrng(normalizedSeed).exportState(),
    idCounters: { structure: 0, agent: 0, event: 0, commandOrder: 0 },
    map: { width: 64, height: 64, blockedCells: new Set() },
    playerIdentities: new Map([[playerIdentityId, { id: playerIdentityId, personId }]]),
    persons: new Map([[personId, { id: personId }]]),
    organizations: new Map([
      [controlledOrganizationId, { id: controlledOrganizationId, kind: "company" }],
      [independentOrganizationId, { id: independentOrganizationId, kind: "company" }],
    ]),
    controlGrants: new Map([
      [
        controlGrantKey(personId, controlledOrganizationId),
        {
          personId,
          organizationId: controlledOrganizationId,
        },
      ],
    ]),
    agents: new Map(),
    structures: new Map(),
    processedCommandIds: new Set(),
    events: [],
    pendingCommands: [],
  };
}

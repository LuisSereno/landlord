import {
  parseOrganizationId,
  parseDistrictId,
  parseFacilityId,
  parsePersonId,
  parsePlayerIdentityId,
  parseMoney,
  parseSeed,
  parseTick,
  type Building,
  type ConstructionSite,
  type District,
  type EconomicTransaction,
  type Ordinance,
  type Parcel,
  type ProductionFacility,
  type ResourceInventory,
  type Tenant,
  type AgentId,
  type CommandId,
  type OrganizationId,
  type PersonId,
  type PlayerIdentityId,
  type StructureId,
} from "@landlord/shared";
import type { Money } from "@landlord/shared";
import type {
  Organization,
  OrganizationControlGrant,
  Person,
  PlayerIdentity,
  TestStructure,
} from "@landlord/shared";
import type { Seed } from "@landlord/shared";
import { SimulationClock, type ClockState } from "./clock";
import { createPrng, type PrngState } from "./prng";
import {
  PLAYER_ORGANIZATION_ID,
  PROTOTYPE_ORDINANCE,
  PROTOTYPE_PARCELS,
  PROTOTYPE_TENANTS,
  RIVAL_ORGANIZATION_ID,
  FACILITY_CONFIG,
} from "./game-data";

export type EntityCounters = {
  structure: number;
  agent: number;
  event: number;
  commandOrder: number;
};

export type Phase2State = {
  idCounters: { building: number; constructionSite: number; transaction: number };
  district: District;
  parcels: Map<import("@landlord/shared").ParcelId, Parcel>;
  balances: Map<OrganizationId, Money>;
  inventories: Map<OrganizationId, ResourceInventory>;
  facilities: Map<import("@landlord/shared").FacilityId, ProductionFacility>;
  buildings: Map<import("@landlord/shared").BuildingId, Building>;
  constructionSites: Map<import("@landlord/shared").ConstructionSiteId, ConstructionSite>;
  tenants: Map<import("@landlord/shared").TenantId, Tenant>;
  transactions: EconomicTransaction[];
  ordinance: Ordinance;
  crime: {
    heatByOrganizationId: Record<string, number>;
    policePressure: number;
    lastOutcome: "none" | "profitable" | "detected";
    nextAvailableTickByOrganizationId: Record<string, number>;
  };
  influenceByOrganizationId: Map<OrganizationId, number>;
  rivalAi: {
    lastAction: string;
    lastReason: string;
    lastFailureCode: string | null;
    cooldownUntilTick: import("@landlord/shared").Tick;
  };
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
  pendingCommands: Array<{
    acceptedOrder: number;
    command: import("@landlord/shared").ProductCommand;
  }>;
  phase2: Phase2State;
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
  const district: District = {
    id: parseDistrictId("district_00000001"),
    name: "Barrio del Umbral",
    width: 64,
    height: 64,
  };
  const parcels = new Map(PROTOTYPE_PARCELS.map((parcel) => [parcel.id, { ...parcel }]));
  const tenants = new Map(PROTOTYPE_TENANTS.map((tenant) => [tenant.id, { ...tenant }]));
  const emptyInventory = (): ResourceInventory => ({
    cement: 0,
    brick: 0,
    steel: 0,
    capacity: 40,
  });
  const playerInventory = emptyInventory();
  playerInventory.cement = 8;
  playerInventory.brick = 16;
  playerInventory.steel = 6;
  const rivalInventory = emptyInventory();
  rivalInventory.cement = 8;
  rivalInventory.brick = 16;
  rivalInventory.steel = 6;

  return {
    seed: normalizedSeed,
    clock: clock.getState(),
    prng: createPrng(normalizedSeed).exportState(),
    idCounters: {
      structure: 0,
      agent: 0,
      event: 0,
      commandOrder: 0,
    },
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
    pendingCommands: [],
    phase2: {
      idCounters: { building: 0, constructionSite: 0, transaction: 0 },
      district,
      parcels,
      balances: new Map([
        [PLAYER_ORGANIZATION_ID, parseMoney(12000)],
        [RIVAL_ORGANIZATION_ID, parseMoney(12000)],
      ]),
      inventories: new Map([
        [PLAYER_ORGANIZATION_ID, playerInventory],
        [RIVAL_ORGANIZATION_ID, rivalInventory],
      ]),
      facilities: new Map([
        [
          parseFacilityId("facility_00000001"),
          {
            id: parseFacilityId("facility_00000001"),
            ownerOrganizationId: PLAYER_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.cement.cycleLength,
            output: "cement",
            outputAmount: FACILITY_CONFIG.cement.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.cement.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.cement.operatingCost),
          },
        ],
        [
          parseFacilityId("facility_00000002"),
          {
            id: parseFacilityId("facility_00000002"),
            ownerOrganizationId: PLAYER_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.brick.cycleLength,
            output: "brick",
            outputAmount: FACILITY_CONFIG.brick.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.brick.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.brick.operatingCost),
          },
        ],
        [
          parseFacilityId("facility_00000003"),
          {
            id: parseFacilityId("facility_00000003"),
            ownerOrganizationId: PLAYER_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.steel.cycleLength,
            output: "steel",
            outputAmount: FACILITY_CONFIG.steel.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.steel.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.steel.operatingCost),
          },
        ],
        [
          parseFacilityId("facility_00000004"),
          {
            id: parseFacilityId("facility_00000004"),
            ownerOrganizationId: RIVAL_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.cement.cycleLength,
            output: "cement",
            outputAmount: FACILITY_CONFIG.cement.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.cement.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.cement.operatingCost),
          },
        ],
        [
          parseFacilityId("facility_00000005"),
          {
            id: parseFacilityId("facility_00000005"),
            ownerOrganizationId: RIVAL_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.brick.cycleLength,
            output: "brick",
            outputAmount: FACILITY_CONFIG.brick.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.brick.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.brick.operatingCost),
          },
        ],
        [
          parseFacilityId("facility_00000006"),
          {
            id: parseFacilityId("facility_00000006"),
            ownerOrganizationId: RIVAL_ORGANIZATION_ID,
            operational: false,
            cycleProgress: 0,
            cycleLength: FACILITY_CONFIG.steel.cycleLength,
            output: "steel",
            outputAmount: FACILITY_CONFIG.steel.outputAmount,
            investmentCost: parseMoney(FACILITY_CONFIG.steel.investmentCost),
            operatingCost: parseMoney(FACILITY_CONFIG.steel.operatingCost),
          },
        ],
      ]),
      buildings: new Map(),
      constructionSites: new Map(),
      tenants,
      transactions: [],
      ordinance: { ...PROTOTYPE_ORDINANCE },
      crime: {
        heatByOrganizationId: {
          [PLAYER_ORGANIZATION_ID]: 0,
          [RIVAL_ORGANIZATION_ID]: 0,
        },
        policePressure: 0,
        lastOutcome: "none",
        nextAvailableTickByOrganizationId: {},
      },
      influenceByOrganizationId: new Map([
        [PLAYER_ORGANIZATION_ID, 2],
        [RIVAL_ORGANIZATION_ID, 1],
      ]),
      rivalAi: {
        lastAction: "none",
        lastReason: "Esperando el primer día económico.",
        lastFailureCode: null,
        cooldownUntilTick: parseTick(0),
      },
    },
  };
}

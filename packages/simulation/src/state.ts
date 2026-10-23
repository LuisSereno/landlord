import {
  parseOrganizationId,
  parseAgentId,
  parseCrewId,
  parseDistrictId,
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
  type Agent,
  type Crew,
  type IncidentRecord,
  type CommandId,
  type OrganizationId,
  type PersonId,
  type PlayerIdentityId,
  type StructureId,
  type Loan,
  type TaxationState,
  type MaintenanceState,
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
  BANK_ORGANIZATION_ID,
  MUNICIPALITY_ORGANIZATION_ID,
  LOAN_POLICY,
  TAX_POLICY,
  MAINTENANCE_POLICY,
} from "./game-data";

export type EntityCounters = {
  structure: number;
  agent: number;
  event: number;
  commandOrder: number;
};

export type Phase2State = {
  idCounters: {
    building: number;
    constructionSite: number;
    facility: number;
    transaction: number;
    incident: number;
    loan: number;
  };
  district: District;
  parcels: Map<import("@landlord/shared").ParcelId, Parcel>;
  balances: Map<OrganizationId, Money>;
  inventories: Map<OrganizationId, ResourceInventory>;
  facilities: Map<import("@landlord/shared").FacilityId, ProductionFacility>;
  buildings: Map<import("@landlord/shared").BuildingId, Building>;
  constructionSites: Map<import("@landlord/shared").ConstructionSiteId, ConstructionSite>;
  crews: Map<import("@landlord/shared").CrewId, Crew>;
  incidents: Map<import("@landlord/shared").IncidentId, IncidentRecord>;
  tenants: Map<import("@landlord/shared").TenantId, Tenant>;
  transactions: EconomicTransaction[];
  loans: Map<import("@landlord/shared").LoanId, Loan>;
  taxation: TaxationState;
  maintenance: MaintenanceState;
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
  agents: Map<AgentId, Agent>;
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

  const roster = new Map<AgentId, Agent>();
  const crews = new Map<import("@landlord/shared").CrewId, Crew>();
  let rosterIndex = 0;
  for (const [organizationId, x] of [
    [controlledOrganizationId, 4],
    [independentOrganizationId, 56],
  ] as const) {
    for (let crewNumber = 0; crewNumber < 2; crewNumber += 1) {
      const ids: AgentId[] = [];
      for (const specialty of [
        "supervisor",
        "construction_worker",
        "construction_worker",
      ] as const) {
        rosterIndex += 1;
        const id = parseAgentId(`agent_${String(rosterIndex).padStart(8, "0")}`);
        ids.push(id);
        roster.set(id, {
          id,
          personId: parsePersonId(`person_${String(100 + rosterIndex).padStart(8, "0")}`),
          organizationId,
          specialty,
          health: 100,
          state: "idle",
          cell: { x: x + crewNumber, y: 4 + ids.length },
          target: { x: x + crewNumber, y: 4 + ids.length },
          path: [],
          task: null,
          cooldownUntilTick: parseTick(0),
          injuredUntilTick: null,
          lastPathRecalculationTick: parseTick(0),
        });
      }
      const crewId = parseCrewId(`crew_${String(crews.size + 1).padStart(8, "0")}`);
      crews.set(crewId, {
        id: crewId,
        organizationId,
        supervisorAgentId: ids[0]!,
        workerAgentIds: ids.slice(1),
      });
    }
    for (const specialty of ["maintenance_technician", "enforcer"] as const) {
      rosterIndex += 1;
      const id = parseAgentId(`agent_${String(rosterIndex).padStart(8, "0")}`);
      roster.set(id, {
        id,
        personId: parsePersonId(`person_${String(100 + rosterIndex).padStart(8, "0")}`),
        organizationId,
        specialty,
        health: 100,
        state: "idle",
        cell: { x, y: 12 + (specialty === "enforcer" ? 1 : 0) },
        target: { x, y: 12 + (specialty === "enforcer" ? 1 : 0) },
        path: [],
        task: null,
        cooldownUntilTick: parseTick(0),
        injuredUntilTick: null,
        lastPathRecalculationTick: parseTick(0),
      });
    }
  }
  return {
    seed: normalizedSeed,
    clock: clock.getState(),
    prng: createPrng(normalizedSeed).exportState(),
    idCounters: {
      structure: 0,
      agent: rosterIndex,
      event: 0,
      commandOrder: 0,
    },
    map: { width: 64, height: 64, blockedCells: new Set() },
    playerIdentities: new Map([[playerIdentityId, { id: playerIdentityId, personId }]]),
    persons: new Map([
      [personId, { id: personId }],
      ...[...roster.values()].flatMap((agent) =>
        agent.personId ? [[agent.personId, { id: agent.personId }] as const] : [],
      ),
    ]),
    organizations: new Map([
      [controlledOrganizationId, { id: controlledOrganizationId, kind: "company" }],
      [independentOrganizationId, { id: independentOrganizationId, kind: "company" }],
      [BANK_ORGANIZATION_ID, { id: BANK_ORGANIZATION_ID, kind: "bank" }],
      [MUNICIPALITY_ORGANIZATION_ID, { id: MUNICIPALITY_ORGANIZATION_ID, kind: "municipality" }],
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
    agents: roster,
    structures: new Map(),
    processedCommandIds: new Set(),
    pendingCommands: [],
    phase2: {
      idCounters: {
        building: 0,
        constructionSite: 0,
        facility: 0,
        transaction: 0,
        incident: 0,
        loan: 0,
      },
      district,
      parcels,
      balances: new Map([
        [PLAYER_ORGANIZATION_ID, parseMoney(12000)],
        [RIVAL_ORGANIZATION_ID, parseMoney(12000)],
        [BANK_ORGANIZATION_ID, LOAN_POLICY.initialBankBalance],
        [MUNICIPALITY_ORGANIZATION_ID, parseMoney(0)],
      ]),
      inventories: new Map([
        [PLAYER_ORGANIZATION_ID, playerInventory],
        [RIVAL_ORGANIZATION_ID, rivalInventory],
      ]),
      facilities: new Map(),
      buildings: new Map(),
      constructionSites: new Map(),
      crews,
      incidents: new Map(),
      tenants,
      transactions: [],
      loans: new Map(),
      taxation: {
        propertyRateBps: TAX_POLICY.propertyRateBps,
        transferRateBps: TAX_POLICY.transferRateBps,
        nextSettlementTick: parseTick(TAX_POLICY.settlementPeriodTicks),
        lastSettlementTick: null,
        totalCollected: parseMoney(0),
        exemptOrganizationIds: [...TAX_POLICY.exemptOrganizationIds],
        arrearsByOrganizationId: {},
      },
      maintenance: {
        policy: "balanced",
        nextSettlementTick: parseTick(MAINTENANCE_POLICY.settlementPeriodTicks),
        lastSettlementTick: null,
        backlogByBuildingId: {},
      },
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

import {
  parseOrganizationId,
  parseAgentId,
  parseCrewId,
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
  type HousingMarketState,
  type EmploymentState,
  type MunicipalBudgetState,
  type MunicipalPoliticsState,
  type PublicContractsState,
  type ReputationState,
  type IntelligenceState,
  type FactionState,
  type InsuranceState,
  type PermittingState,
  type InsolvencyState,
  type MacroEventsState,
  type RoadTopology,
  type Block,
  type BlockId,
  type City,
  type CityProfileId,
  type DistrictGateway,
  type DistrictId,
  type PublicSpace,
  type PublicSpaceId,
  type UrbanFacility,
  type UrbanFacilityId,
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
import { initialAutomationState } from "./automation";
import {
  createCity,
  CITY_ROSTER_SLOTS,
  districtIdForSlot,
  type GeneratedDistrictState,
} from "./city";
import { rosterLayout } from "./district-profiles";
import { initialEmploymentState } from "./employment";
import { initialMunicipalBudgetState } from "./municipal-budget";
import { initialMunicipalPoliticsState } from "./municipal-politics";
import { initialHousingMarketState } from "./housing-market";
import { initialPublicContractsState } from "./public-contracts";
import { initialReputationState } from "./reputation";
import { initialIntelligenceState } from "./information";
import { initialMacroEventsState } from "./macro-events";
import { initialFactionState } from "./factions";
import {
  PLAYER_ORGANIZATION_ID,
  PROTOTYPE_ORDINANCE,
  PROTOTYPE_TENANTS,
  RIVAL_ORGANIZATION_ID,
  BANK_ORGANIZATION_ID,
  MUNICIPALITY_ORGANIZATION_ID,
  INSURER_ORGANIZATION_ID,
  PERMIT_POLICY,
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

export type DistrictMap = {
  width: 64;
  height: 64;
  blockedCells: Set<string>;
  roads: RoadTopology;
};

/**
 * Authoritative spatial state of one district (D-088). Parcels, buildings, agents and organizations
 * stay in the global maps; everything that is a *place* lives here. `blocks` and `publicSpaces` are
 * declared now and filled by V.d.1 and V.d.3, so the shape does not change twice.
 */
export type DistrictState = {
  district: District;
  map: DistrictMap;
  blocks: Map<BlockId, Block>;
  publicSpaces: Map<PublicSpaceId, PublicSpace>;
  facilities: Map<UrbanFacilityId, UrbanFacility>;
};

export type WorldState = {
  city: City;
  gateways: DistrictGateway[];
  districts: Map<DistrictId, DistrictState>;
};

export function districtStateOf(state: GameState, districtId: DistrictId): DistrictState {
  const district = state.world.districts.get(districtId);
  if (!district) {
    throw new RangeError(`Unknown district: ${districtId}`);
  }
  return district;
}

export function districtMapOf(state: GameState, districtId: DistrictId): DistrictMap {
  return districtStateOf(state, districtId).map;
}

export function blockedCellsOf(state: GameState, districtId: DistrictId): ReadonlySet<string> {
  return districtMapOf(state, districtId).blockedCells;
}

export type Phase2State = {
  idCounters: {
    building: number;
    constructionSite: number;
    facility: number;
    transaction: number;
    incident: number;
    loan: number;
  };
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
  employment: EmploymentState;
  municipal: MunicipalBudgetState;
  politics: MunicipalPoliticsState;
  housingMarket: HousingMarketState;
  contracts: PublicContractsState;
  reputation: ReputationState;
  intelligence: IntelligenceState;
  factions: FactionState;
  insurance: InsuranceState;
  permitting: PermittingState;
  insolvency: InsolvencyState;
  ordinance: Ordinance;
  crime: {
    heatByOrganizationId: Record<string, number>;
    policePressure: number;
    lastOutcome: "none" | "profitable" | "detected";
    nextAvailableTickByOrganizationId: Record<string, number>;
  };
  macroEvents: MacroEventsState;
  automation: import("@landlord/shared").AutomationState;
  influenceByOrganizationId: Map<OrganizationId, number>;
  rivalAi: {
    strategyProfile: "conservative" | "expansionist";
    lastAction: string;
    lastReason: string;
    lastFailureCode: string | null;
    cooldownUntilTick: import("@landlord/shared").Tick;
    memory: { lossCount: number; defaultCount: number; lastLossAmount: Money };
  };
};

export type GameState = {
  seed: Seed;
  clock: ClockState;
  prng: PrngState;
  idCounters: EntityCounters;
  world: WorldState;
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

export type InitialStateOptions = {
  /** Perfil de ciudad data-driven; por defecto `ciudad_del_umbral_v1`. */
  cityProfileId?: CityProfileId | undefined;
};

export function createInitialState(seed = 1, options: InitialStateOptions = {}): GameState {
  const normalizedSeed = parseSeed(seed);
  const city = createCity({ seed: normalizedSeed, profileId: options.cityProfileId });
  const personId = parsePersonId("person_00000001");
  const playerIdentityId = parsePlayerIdentityId("player_00000001");
  const controlledOrganizationId = parseOrganizationId("org_00000001");
  const independentOrganizationId = parseOrganizationId("org_00000002");
  const clock = new SimulationClock();
  const districts = new Map<DistrictId, DistrictState>(
    [...city.districts].map(([districtId, generated]: [DistrictId, GeneratedDistrictState]) => [
      districtId,
      {
        district: generated.district,
        map: {
          width: generated.district.width,
          height: generated.district.height,
          blockedCells: new Set(generated.blockedCells),
          roads: generated.roads,
        },
        blocks: new Map(generated.blocks.map((block) => [block.id, block])),
        publicSpaces: new Map(generated.publicSpaces.map((space) => [space.id, space])),
        facilities: new Map(generated.facilities.map((facility) => [facility.id, facility])),
      } satisfies DistrictState,
    ]),
  );
  const parcels = new Map(
    [...city.districts].flatMap(([, generated]) =>
      generated.parcels.map((parcel) => [parcel.id, parcel] as const),
    ),
  );
  void districtIdForSlot;
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
  const playerDistrictId = districtIdForSlot(
    CITY_ROSTER_SLOTS.player.slotX,
    CITY_ROSTER_SLOTS.player.slotY,
  );
  for (const tenant of tenants.values()) {
    if (tenant.origin === "authored") tenant.marketDistrictId = playerDistrictId;
  }
  const rivalDistrictId = districtIdForSlot(
    CITY_ROSTER_SLOTS.rival.slotX,
    CITY_ROSTER_SLOTS.rival.slotY,
  );
  for (const [organizationId, rosterDistrictId, spawnAnchor] of [
    [
      controlledOrganizationId,
      playerDistrictId,
      city.districts.get(playerDistrictId)!.spawnAnchors.player,
    ],
    [
      independentOrganizationId,
      rivalDistrictId,
      city.districts.get(rivalDistrictId)!.spawnAnchors.rival,
    ],
  ] as const) {
    const membersByCrewIndex = new Map<number, AgentId[]>();
    for (const slot of rosterLayout(spawnAnchor)) {
      rosterIndex += 1;
      const id = parseAgentId(`agent_${String(rosterIndex).padStart(8, "0")}`);
      roster.set(id, {
        id,
        personId: parsePersonId(`person_${String(100 + rosterIndex).padStart(8, "0")}`),
        organizationId,
        specialty: slot.specialty,
        health: 100,
        state: "idle",
        districtId: rosterDistrictId,
        cell: { ...slot.cell },
        target: { ...slot.cell },
        path: [],
        task: null,
        cooldownUntilTick: parseTick(0),
        injuredUntilTick: null,
        lastPathRecalculationTick: parseTick(0),
      });
      if (slot.crewIndex === null) continue;
      const members = membersByCrewIndex.get(slot.crewIndex) ?? [];
      members.push(id);
      membersByCrewIndex.set(slot.crewIndex, members);
    }
    for (const crewIndex of [...membersByCrewIndex.keys()].sort((left, right) => left - right)) {
      const ids = membersByCrewIndex.get(crewIndex)!;
      const crewId = parseCrewId(`crew_${String(crews.size + 1).padStart(8, "0")}`);
      crews.set(crewId, {
        id: crewId,
        organizationId,
        supervisorAgentId: ids[0]!,
        workerAgentIds: ids.slice(1),
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
    world: {
      city: city.city,
      gateways: city.gateways,
      districts,
    },
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
      [INSURER_ORGANIZATION_ID, { id: INSURER_ORGANIZATION_ID, kind: "insurer" }],
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
      parcels,
      balances: new Map([
        [PLAYER_ORGANIZATION_ID, parseMoney(12000)],
        [RIVAL_ORGANIZATION_ID, parseMoney(12000)],
        [BANK_ORGANIZATION_ID, LOAN_POLICY.initialBankBalance],
        [MUNICIPALITY_ORGANIZATION_ID, parseMoney(0)],
        [INSURER_ORGANIZATION_ID, parseMoney(100000)],
      ]),
      inventories: new Map([
        [PLAYER_ORGANIZATION_ID, playerInventory],
        [RIVAL_ORGANIZATION_ID, rivalInventory],
      ]),
      facilities: new Map(),
      buildings: new Map(
        [...city.districts].flatMap(([, generated]) =>
          generated.buildings.map((building) => [building.id, building] as const),
        ),
      ),
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
      employment: initialEmploymentState(),
      municipal: initialMunicipalBudgetState(),
      politics: initialMunicipalPoliticsState(),
      housingMarket: initialHousingMarketState(city.city.districtIds),
      contracts: initialPublicContractsState(),
      reputation: initialReputationState(),
      intelligence: initialIntelligenceState(normalizedSeed),
      factions: initialFactionState(),
      insurance: {
        contractsByBuildingId: {},
        claimsByIncidentId: {},
      },
      permitting: {
        validityTicks: PERMIT_POLICY.validityTicks,
        approvalChanceByRole: { ...PERMIT_POLICY.approvalChanceByRole },
        permitsByParcelId: {},
      },
      insolvency: {
        auctionsByLoanId: {},
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
      macroEvents: initialMacroEventsState(normalizedSeed),
      automation: initialAutomationState(),
      influenceByOrganizationId: new Map([
        [PLAYER_ORGANIZATION_ID, 2],
        [RIVAL_ORGANIZATION_ID, 1],
      ]),
      rivalAi: {
        strategyProfile: "conservative",
        lastAction: "none",
        lastReason: "Esperando el primer día económico.",
        lastFailureCode: null,
        cooldownUntilTick: parseTick(0),
        memory: { lossCount: 0, defaultCount: 0, lastLossAmount: parseMoney(0) },
      },
    },
  };
}

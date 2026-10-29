import {
  parseAgentId,
  parseBlockId,
  parseCityId,
  parseCityProfileId,
  parseCrewId,
  parseIncidentId,
  parseBuildingId,
  parseCommandId,
  parseConstructionSiteId,
  parseDistrictConnectionId,
  parseDistrictGatewayId,
  parseDistrictId,
  parseFacilityId,
  parseOrganizationId,
  parseParcelId,
  parsePolicyId,
  parsePublicSpaceId,
  parseMoney,
  parsePersonId,
  parsePlayerIdentityId,
  parseStructureId,
  parseTenantId,
  parseUrbanFacilityId,
  parseTransactionId,
  parseLoanId,
  parseSnapshotV2,
  type SnapshotV2,
} from "@landlord/shared";
import type { ProductCommand } from "@landlord/shared";
import { parseSeed, parseTick } from "@landlord/shared";
import { PRNG_ALGORITHM } from "./prng";
import { createInitialState, type DistrictState, type GameState, type WorldState } from "./state";
import {
  BUILDING_DEFINITIONS,
  MUNICIPAL_PARTY_CATALOG,
  TENANT_PROFILE_DEFAULTS,
} from "./game-data";

export const ENGINE_VERSION = "phase4-dev";

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

export function serializeSnapshot(state: GameState, engineVersion = ENGINE_VERSION): SnapshotV2 {
  return {
    schemaVersion: 2 as SnapshotV2["schemaVersion"],
    engineVersion,
    seed: state.seed,
    tick: state.clock.tick,
    prng: {
      algorithm: PRNG_ALGORITHM,
      state: [...state.prng.state] as SnapshotV2["prng"]["state"],
    },
    idCounters: { ...state.idCounters },
    world: {
      city: {
        ...state.world.city,
        districtIds: [...state.world.city.districtIds],
        connections: state.world.city.connections.map((connection) => ({ ...connection })),
        generation: { ...state.world.city.generation },
      },
      gateways: state.world.gateways.map((gateway) => ({
        ...gateway,
        districtIds: [...gateway.districtIds],
        sides: [...gateway.sides],
        cells: gateway.cells.map((cell) => ({ ...cell })),
        roadSegmentIds: [...gateway.roadSegmentIds],
      })),
      // Canonical order is the city's own slot order, never Map insertion order (D-089).
      districts: state.world.city.districtIds.map((districtId) => {
        const entry = state.world.districts.get(districtId)!;
        return {
          district: {
            ...entry.district,
            ...(entry.district.generation ? { generation: { ...entry.district.generation } } : {}),
          },
          map: {
            width: entry.map.width,
            height: entry.map.height,
            blockedCells: [...entry.map.blockedCells].map(cellFromKey).sort(compareCell),
            roads: {
              topologyVersion: entry.map.roads.topologyVersion,
              derivationVersion: entry.map.roads.derivationVersion,
              segments: entry.map.roads.segments.map((segment) => ({
                ...segment,
                from: { ...segment.from },
                to: { ...segment.to },
              })),
            },
          },
          blocks: [...entry.blocks.values()].sort(compareId),
          publicSpaces: [...entry.publicSpaces.values()].sort(compareId),
          facilities: [...entry.facilities.values()].sort(compareId),
        };
      }),
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
        districtId: agent.districtId,
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
      parcels: [...state.phase2.parcels.values()]
        .map((parcel) => ({
          ...parcel,
          cells: parcel.cells.map((cell) => ({ ...cell })),
          anchorCell: { ...parcel.anchorCell },
          currentUses: [...parcel.currentUses],
          roadFrontages: parcel.roadFrontages.map((frontage) => ({
            ...frontage,
            cells: frontage.cells.map((cell) => ({ ...cell })),
          })),
        }))
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
        .map((building) => ({
          ...building,
          footprintCells: building.footprintCells.map((cell) => ({ ...cell })),
          tenantIds: [...building.tenantIds],
        }))
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
      macroEvents: {
        events: state.phase2.macroEvents.events.map((event) => ({
          ...event,
          modifiers: { ...event.modifiers },
        })),
        nextEventOrdinal: state.phase2.macroEvents.nextEventOrdinal,
        prng: {
          algorithm: "xoshiro128ss-v1",
          state: [...state.phase2.macroEvents.prng.state],
        },
        nextCheckTick: state.phase2.macroEvents.nextCheckTick,
      },
      automation: { ...state.phase2.automation },
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
      loans: [...state.phase2.loans.values()].map((loan) => ({ ...loan })).sort(compareId),
      taxation: {
        ...state.phase2.taxation,
        exemptOrganizationIds: [...state.phase2.taxation.exemptOrganizationIds],
        arrearsByOrganizationId: { ...state.phase2.taxation.arrearsByOrganizationId },
      },
      maintenance: {
        ...state.phase2.maintenance,
        backlogByBuildingId: { ...state.phase2.maintenance.backlogByBuildingId },
      },
      employment: {
        ...state.phase2.employment,
        postsByDistrictId: { ...state.phase2.employment.postsByDistrictId },
      },
      municipal: {
        ...state.phase2.municipal,
        revenueThisMonthBySource: { ...state.phase2.municipal.revenueThisMonthBySource },
        revenueTotalBySource: { ...state.phase2.municipal.revenueTotalBySource },
        spentTotalByCategory: { ...state.phase2.municipal.spentTotalByCategory },
        unfundedTotalByCategory: { ...state.phase2.municipal.unfundedTotalByCategory },
        serviceLevelPercentByCategory: {
          ...state.phase2.municipal.serviceLevelPercentByCategory,
        },
      },
      politics: {
        ...state.phase2.politics,
        seatsByPartyId: { ...state.phase2.politics.seatsByPartyId },
        moodByIssue: { ...state.phase2.politics.moodByIssue },
        supportPercentByPartyId: { ...state.phase2.politics.supportPercentByPartyId },
      },
      housingMarket: {
        ...state.phase2.housingMarket,
        rentIndexPercentByBuildingType: {
          ...state.phase2.housingMarket.rentIndexPercentByBuildingType,
        },
        byDistrictId: Object.fromEntries(
          Object.entries(state.phase2.housingMarket.byDistrictId).map(([districtId, market]) => [
            districtId,
            {
              ...market,
              rentIndexPercentByBuildingType: { ...market.rentIndexPercentByBuildingType },
              unitsByBuildingType: { ...market.unitsByBuildingType },
              demandByBuildingType: { ...market.demandByBuildingType },
            },
          ]),
        ),
      },
      contracts: {
        ...state.phase2.contracts,
        contracts: Object.fromEntries(
          Object.entries(state.phase2.contracts.contracts).map(([id, contract]) => [
            id,
            { ...contract, bids: contract.bids.map((bid) => ({ ...bid })) },
          ]),
        ),
        reliabilityByOrganizationId: Object.fromEntries(
          Object.entries(state.phase2.contracts.reliabilityByOrganizationId).map(
            ([organizationId, entry]) => [organizationId, { ...entry }],
          ),
        ),
      },
      reputation: {
        ...state.phase2.reputation,
        standingByOrganizationId: Object.fromEntries(
          Object.entries(state.phase2.reputation.standingByOrganizationId).map(
            ([organizationId, standing]) => [organizationId, { ...standing }],
          ),
        ),
        factsByOrganizationId: Object.fromEntries(
          Object.entries(state.phase2.reputation.factsByOrganizationId).map(
            ([organizationId, facts]) => [
              organizationId,
              facts.map((fact) => ({ ...fact, deltaByGroup: { ...fact.deltaByGroup } })),
            ],
          ),
        ),
      },
      intelligence: {
        ...state.phase2.intelligence,
        prng: { algorithm: "xoshiro128ss-v1", state: [...state.phase2.intelligence.prng.state] },
        estimatesBySubjectOrganizationId: Object.fromEntries(
          Object.entries(state.phase2.intelligence.estimatesBySubjectOrganizationId).map(
            ([subjectId, estimates]) => [subjectId, estimates.map((estimate) => ({ ...estimate }))],
          ),
        ),
      },
      factions: {
        ...state.phase2.factions,
        profileByOrganizationId: { ...state.phase2.factions.profileByOrganizationId },
        stanceByPairId: { ...state.phase2.factions.stanceByPairId },
        memoryByOrganizationId: Object.fromEntries(
          Object.entries(state.phase2.factions.memoryByOrganizationId).map(
            ([organizationId, entries]) => [organizationId, entries.map((entry) => ({ ...entry }))],
          ),
        ),
        cycleCountByOrganizationId: { ...state.phase2.factions.cycleCountByOrganizationId },
      },
      insurance: {
        contractsByBuildingId: Object.fromEntries(
          Object.entries(state.phase2.insurance.contractsByBuildingId).map(
            ([buildingId, contract]) => [
              buildingId,
              { ...contract, exclusions: [...contract.exclusions] },
            ],
          ),
        ),
        claimsByIncidentId: Object.fromEntries(
          Object.entries(state.phase2.insurance.claimsByIncidentId).map(([incidentId, claim]) => [
            incidentId,
            { ...claim },
          ]),
        ),
      },
      permitting: {
        ...state.phase2.permitting,
        approvalChanceByRole: { ...state.phase2.permitting.approvalChanceByRole },
        permitsByParcelId: Object.fromEntries(
          Object.entries(state.phase2.permitting.permitsByParcelId).map(([parcelId, permit]) => [
            parcelId,
            {
              ...permit,
              requirements: [...permit.requirements],
              allowedUsesAtDecision: [...permit.allowedUsesAtDecision],
              currentUsesAtDecision: [...permit.currentUsesAtDecision],
              requestedAtTick: permit.requestedAtTick,
              decidedAtTick: permit.decidedAtTick,
              expiresAtTick: permit.expiresAtTick,
            },
          ]),
        ),
      },
      insolvency: {
        auctionsByLoanId: Object.fromEntries(
          Object.entries(state.phase2.insolvency.auctionsByLoanId).map(([loanId, auction]) => [
            loanId,
            {
              ...auction,
              reservedFundsByOrganizationId: { ...auction.reservedFundsByOrganizationId },
            },
          ]),
        ),
      },
    },
  };
}

/**
 * Validación semántica que shared no puede hacer sin importar el catálogo de partidos: un concejo
 * gobernado por una formación inexistente o con escaños de partidos que ya no existen dejaría la
 * transferencia institucional sin destino. Se ejecuta al restaurar y falla el snapshot entero.
 */
function assertMunicipalPoliticsReferences(state: GameState): void {
  const politics = state.phase2.politics;
  const partyIds = new Set(MUNICIPAL_PARTY_CATALOG.map((party) => party.id));
  const issues: string[] = [];
  if (!partyIds.has(politics.governingPartyId)) issues.push("governingPartyId");
  for (const partyId of Object.keys(politics.seatsByPartyId)) {
    if (!partyIds.has(partyId)) issues.push(`seatsByPartyId/${partyId}`);
  }
  for (const partyId of Object.keys(politics.supportPercentByPartyId)) {
    if (!partyIds.has(partyId)) issues.push(`supportPercentByPartyId/${partyId}`);
  }
  if (issues.length > 0) {
    throw new Error(`Invalid municipal politics references: ${issues.join(", ")}`);
  }
}

export function restoreStateFromSnapshot(value: unknown): GameState {
  const snapshot = parseSnapshotV2(value);
  // La ciudad guardada manda: los valores por defecto (plantillas, saldos iniciales) deben
  // derivarse del mismo perfil que generó la partida, no del perfil por defecto.
  const defaultState = createInitialState(snapshot.seed, {
    cityProfileId: snapshot.world.city.generation.profileId,
  });
  const defaults = defaultState.phase2;
  const world: WorldState = {
    city: {
      ...snapshot.world.city,
      id: parseCityId(snapshot.world.city.id),
      municipalityOrganizationId: parseOrganizationId(
        snapshot.world.city.municipalityOrganizationId,
      ),
      districtIds: snapshot.world.city.districtIds.map((id) => parseDistrictId(id)),
      connections: snapshot.world.city.connections.map((connection) => ({
        ...connection,
        id: parseDistrictConnectionId(connection.id),
        gatewayId: parseDistrictGatewayId(connection.gatewayId),
        fromDistrictId: parseDistrictId(connection.fromDistrictId),
        toDistrictId: parseDistrictId(connection.toDistrictId),
      })),
      generation: {
        profileId: parseCityProfileId(snapshot.world.city.generation.profileId),
        generatorVersion: snapshot.world.city.generation.generatorVersion,
        seed: parseSeed(snapshot.world.city.generation.seed),
      },
    },
    gateways: snapshot.world.gateways.map((gateway) => ({
      ...gateway,
      id: parseDistrictGatewayId(gateway.id),
      districtIds: gateway.districtIds.map((id) => parseDistrictId(id)),
      cells: gateway.cells.map((cell) => ({ ...cell })),
      roadSegmentIds: [...gateway.roadSegmentIds],
    })),
    districts: new Map(
      snapshot.world.districts.map((entry) => {
        const districtId = parseDistrictId(entry.district.id);
        return [
          districtId,
          {
            district: {
              id: districtId,
              name: entry.district.name,
              width: entry.district.width,
              height: entry.district.height,
              ...(entry.district.generation
                ? {
                    generation: {
                      profileId: entry.district.generation.profileId,
                      generatorVersion: entry.district.generation.generatorVersion,
                      seed: parseSeed(entry.district.generation.seed),
                    },
                  }
                : {}),
            },
            map: {
              width: entry.map.width,
              height: entry.map.height,
              blockedCells: new Set(entry.map.blockedCells.map((cell) => `${cell.x}:${cell.y}`)),
              roads: {
                topologyVersion: entry.map.roads.topologyVersion,
                derivationVersion: entry.map.roads.derivationVersion,
                segments: entry.map.roads.segments.map((segment) => ({
                  ...segment,
                  from: { ...segment.from },
                  to: { ...segment.to },
                })),
              },
            },
            blocks: new Map(entry.blocks.map((block) => [parseBlockId(block.id), block])),
            publicSpaces: new Map(
              entry.publicSpaces.map((space) => [parsePublicSpaceId(space.id), space]),
            ),
            facilities: new Map(
              entry.facilities.map((facility) => [parseUrbanFacilityId(facility.id), facility]),
            ),
          } satisfies DistrictState,
        ] as const;
      }),
    ),
  };
  const state: GameState = {
    seed: snapshot.seed,
    clock: { tick: parseTick(snapshot.tick), runState: "paused", speed: 1 },
    prng: {
      algorithm: snapshot.prng.algorithm,
      state: [...snapshot.prng.state] as GameState["prng"]["state"],
    },
    idCounters: { ...snapshot.idCounters },
    world,
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
              districtId: parseDistrictId(agent.districtId),
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
              ...(agent.travel
                ? {
                    travel: {
                      fromDistrictId: parseDistrictId(agent.travel.fromDistrictId),
                      toDistrictId: parseDistrictId(agent.travel.toDistrictId),
                      departAtTick: parseTick(Number(agent.travel.departAtTick)),
                      arriveAtTick: parseTick(Number(agent.travel.arriveAtTick)),
                      route: agent.travel.route.map((id) => parseDistrictId(id)),
                    },
                  }
                : {}),
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
          districtId: parseDistrictId(structure.districtId),
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
            facility:
              snapshot.phase2.idCounters.facility ??
              snapshot.phase2.facilities.reduce((maximum, facility) => {
                const numericId = Number(facility.id.slice("facility_".length));
                return Number.isSafeInteger(numericId) ? Math.max(maximum, numericId) : maximum;
              }, 0),
            incident: snapshot.phase2.idCounters.incident ?? 0,
            loan: snapshot.phase2.idCounters.loan ?? 0,
          },
          parcels: new Map(
            snapshot.phase2.parcels.map((parcel) => [
              parseParcelId(parcel.id),
              {
                ...parcel,
                id: parseParcelId(parcel.id),
                districtId: parseDistrictId(parcel.districtId),
                blockId: parseBlockId(parcel.blockId),
                cells: parcel.cells.map((cell) => ({ ...cell })),
                anchorCell: { ...parcel.anchorCell },
                currentUses: [...parcel.currentUses],
                roadFrontages: parcel.roadFrontages.map((frontage) => ({
                  ...frontage,
                  cells: frontage.cells.map((cell) => ({ ...cell })),
                })),
                baseLandValue: parseMoney(parcel.baseLandValue),
                marketValue: parseMoney(parcel.marketValue),
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
              (() => {
                const building = facility.buildingId
                  ? snapshot.phase2!.buildings.find((entry) => entry.id === facility.buildingId)
                  : undefined;
                const kind =
                  facility.kind ?? (facility.buildingId === null ? "legacy" : "physical");
                const definition = building
                  ? BUILDING_DEFINITIONS[building.type].production
                  : undefined;
                return {
                  ...facility,
                  id: parseFacilityId(facility.id),
                  ownerOrganizationId: parseOrganizationId(facility.ownerOrganizationId),
                  kind,
                  outputAmount: definition?.outputAmount ?? facility.outputAmount,
                  conditionPercent: facility.conditionPercent ?? building?.condition ?? 100,
                  upgradePercent: facility.upgradePercent ?? (building?.upgraded ? 125 : 100),
                  remainder: facility.remainder ?? 0,
                  buildingId: facility.buildingId ? parseBuildingId(facility.buildingId) : null,
                };
              })(),
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
                progress: site.progress ?? 0,
                workRequired: site.workRequired ?? 0,
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
                    publiclyAttributedOrganizationId: incident.publiclyAttributedOrganizationId
                      ? parseOrganizationId(incident.publiclyAttributedOrganizationId)
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
                // Partidas anteriores a WP4.3 no guardaban estos campos; el perfil del hogar los
                // reconstruye con los mismos valores autorados, así que las bajas no cambian.
                size: tenant.size ?? TENANT_PROFILE_DEFAULTS[tenant.profile].size,
                segmentId: tenant.segmentId ?? tenant.profile,
                searchMonths: tenant.searchMonths ?? 0,
                incomeFactorPercent: tenant.incomeFactorPercent ?? 100,
                origin: tenant.origin ?? "authored",
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
          macroEvents: snapshot.phase2.macroEvents
            ? {
                events: snapshot.phase2.macroEvents.events.map((event) => ({
                  ...event,
                  modifiers: { ...event.modifiers },
                })),
                nextEventOrdinal: snapshot.phase2.macroEvents.nextEventOrdinal,
                // Una partida anterior a WP4.12-R no trae arroyo propio: se deriva de la seed.
                prng: snapshot.phase2.macroEvents.prng
                  ? {
                      algorithm: "xoshiro128ss-v1" as const,
                      state: [...snapshot.phase2.macroEvents.prng.state] as [
                        number,
                        number,
                        number,
                        number,
                      ],
                    }
                  : { ...defaults.macroEvents.prng },
                nextCheckTick: parseTick(
                  snapshot.phase2.macroEvents.nextCheckTick ?? defaults.macroEvents.nextCheckTick,
                ),
              }
            : defaults.macroEvents,
          automation: snapshot.phase2.automation
            ? { ...snapshot.phase2.automation }
            : { ...defaults.automation },
          influenceByOrganizationId: new Map(
            snapshot.phase2.influenceByOrganizationId.map((entry) => [
              parseOrganizationId(entry.organizationId),
              entry.influence,
            ]),
          ),
          rivalAi: {
            ...snapshot.phase2.rivalAi,
            memory: {
              ...snapshot.phase2.rivalAi.memory,
              lastLossAmount: parseMoney(snapshot.phase2.rivalAi.memory.lastLossAmount),
            },
          },
          loans: snapshot.phase2.loans
            ? new Map(
                snapshot.phase2.loans.map((loan) => [
                  parseLoanId(loan.id),
                  {
                    ...loan,
                    id: parseLoanId(loan.id),
                    borrowerOrganizationId: parseOrganizationId(loan.borrowerOrganizationId),
                    lenderOrganizationId: parseOrganizationId(loan.lenderOrganizationId),
                    principal: parseMoney(loan.principal),
                    outstandingPrincipal: parseMoney(loan.outstandingPrincipal),
                    collateralParcelId: parseParcelId(loan.collateralParcelId),
                    offeredAtTick: parseTick(loan.offeredAtTick),
                    acceptedAtTick:
                      loan.acceptedAtTick === null ? null : parseTick(loan.acceptedAtTick),
                    nextPaymentTick:
                      loan.nextPaymentTick === null ? null : parseTick(loan.nextPaymentTick),
                  },
                ]),
              )
            : new Map(),
          taxation: snapshot.phase2.taxation
            ? {
                ...snapshot.phase2.taxation,
                nextSettlementTick: parseTick(snapshot.phase2.taxation.nextSettlementTick),
                lastSettlementTick:
                  snapshot.phase2.taxation.lastSettlementTick === null
                    ? null
                    : parseTick(snapshot.phase2.taxation.lastSettlementTick),
                totalCollected: parseMoney(snapshot.phase2.taxation.totalCollected),
                exemptOrganizationIds:
                  snapshot.phase2.taxation.exemptOrganizationIds.map(parseOrganizationId),
                arrearsByOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.taxation.arrearsByOrganizationId).map(
                    ([organizationId, amount]) => [organizationId, parseMoney(amount)],
                  ),
                ),
              }
            : defaults.taxation,
          maintenance: snapshot.phase2.maintenance
            ? {
                ...snapshot.phase2.maintenance,
                nextSettlementTick: parseTick(snapshot.phase2.maintenance.nextSettlementTick),
                lastSettlementTick:
                  snapshot.phase2.maintenance.lastSettlementTick === null
                    ? null
                    : parseTick(snapshot.phase2.maintenance.lastSettlementTick),
                backlogByBuildingId: Object.fromEntries(
                  Object.entries(snapshot.phase2.maintenance.backlogByBuildingId).map(
                    ([buildingId, amount]) => [buildingId, parseMoney(amount)],
                  ),
                ),
              }
            : defaults.maintenance,
          municipal: snapshot.phase2.municipal
            ? {
                ...snapshot.phase2.municipal,
                revenueThisMonthBySource: Object.fromEntries(
                  Object.entries(snapshot.phase2.municipal.revenueThisMonthBySource).map(
                    ([source, amount]) => [source, parseMoney(amount)],
                  ),
                ),
                revenueTotalBySource: Object.fromEntries(
                  Object.entries(snapshot.phase2.municipal.revenueTotalBySource).map(
                    ([source, amount]) => [source, parseMoney(amount)],
                  ),
                ),
                spentTotalByCategory: Object.fromEntries(
                  Object.entries(snapshot.phase2.municipal.spentTotalByCategory).map(
                    ([category, amount]) => [category, parseMoney(amount)],
                  ),
                ),
                unfundedTotalByCategory: Object.fromEntries(
                  Object.entries(snapshot.phase2.municipal.unfundedTotalByCategory).map(
                    ([category, amount]) => [category, parseMoney(amount)],
                  ),
                ),
                serviceLevelPercentByCategory: {
                  ...snapshot.phase2.municipal.serviceLevelPercentByCategory,
                },
                lastSettlementTick:
                  snapshot.phase2.municipal.lastSettlementTick === null
                    ? null
                    : parseTick(snapshot.phase2.municipal.lastSettlementTick),
              }
            : { ...defaults.municipal },
          politics: snapshot.phase2.politics
            ? {
                ...snapshot.phase2.politics,
                seatsByPartyId: { ...snapshot.phase2.politics.seatsByPartyId },
                moodByIssue: { ...snapshot.phase2.politics.moodByIssue },
                supportPercentByPartyId: {
                  ...snapshot.phase2.politics.supportPercentByPartyId,
                },
                lastElectionTick:
                  snapshot.phase2.politics.lastElectionTick === null
                    ? null
                    : parseTick(snapshot.phase2.politics.lastElectionTick),
                nextElectionTick: parseTick(snapshot.phase2.politics.nextElectionTick),
                lastMoodTick:
                  snapshot.phase2.politics.lastMoodTick === null
                    ? null
                    : parseTick(snapshot.phase2.politics.lastMoodTick),
                nextDebateTick:
                  snapshot.phase2.politics.nextDebateTick === null
                    ? null
                    : parseTick(snapshot.phase2.politics.nextDebateTick),
              }
            : { ...defaults.politics },
          employment: snapshot.phase2.employment
            ? {
                ...snapshot.phase2.employment,
                postsByDistrictId: { ...snapshot.phase2.employment.postsByDistrictId },
                lastSettlementTick:
                  snapshot.phase2.employment.lastSettlementTick === null
                    ? null
                    : parseTick(snapshot.phase2.employment.lastSettlementTick),
              }
            : { ...defaults.employment },
          housingMarket: snapshot.phase2.housingMarket
            ? {
                ...snapshot.phase2.housingMarket,
                rentIndexPercentByBuildingType: {
                  ...snapshot.phase2.housingMarket.rentIndexPercentByBuildingType,
                },
                byDistrictId: Object.fromEntries(
                  Object.entries(snapshot.phase2.housingMarket.byDistrictId).map(
                    ([districtId, market]) => [
                      districtId,
                      {
                        ...market,
                        rentIndexPercentByBuildingType: {
                          ...market.rentIndexPercentByBuildingType,
                        },
                        unitsByBuildingType: { ...market.unitsByBuildingType },
                        demandByBuildingType: { ...market.demandByBuildingType },
                      },
                    ],
                  ),
                ),
                lastSettlementTick:
                  snapshot.phase2.housingMarket.lastSettlementTick === null
                    ? null
                    : parseTick(snapshot.phase2.housingMarket.lastSettlementTick),
              }
            : { ...defaults.housingMarket },
          contracts: snapshot.phase2.contracts
            ? {
                lastPublishedTick:
                  snapshot.phase2.contracts.lastPublishedTick === null
                    ? null
                    : parseTick(snapshot.phase2.contracts.lastPublishedTick),
                nextOrdinal: snapshot.phase2.contracts.nextOrdinal,
                contracts: Object.fromEntries(
                  Object.entries(snapshot.phase2.contracts.contracts).map(([id, contract]) => [
                    id,
                    {
                      ...contract,
                      budget: parseMoney(contract.budget),
                      bond: parseMoney(contract.bond),
                      publishedAtTick: parseTick(contract.publishedAtTick),
                      closesAtTick: parseTick(contract.closesAtTick),
                      executesAtTick: parseTick(contract.executesAtTick),
                      awardedToOrganizationId: contract.awardedToOrganizationId
                        ? parseOrganizationId(contract.awardedToOrganizationId)
                        : null,
                      awardedAmount:
                        contract.awardedAmount === null ? null : parseMoney(contract.awardedAmount),
                      bids: contract.bids.map((bid) => ({
                        organizationId: parseOrganizationId(bid.organizationId),
                        amount: parseMoney(bid.amount),
                        atTick: parseTick(bid.atTick),
                      })),
                    },
                  ]),
                ),
                reliabilityByOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.contracts.reliabilityByOrganizationId).map(
                    ([organizationId, entry]) => [organizationId, { ...entry }],
                  ),
                ),
              }
            : { ...defaults.contracts },
          reputation: snapshot.phase2.reputation
            ? {
                lastDecayTick:
                  snapshot.phase2.reputation.lastDecayTick === null
                    ? null
                    : parseTick(snapshot.phase2.reputation.lastDecayTick),
                nextFactOrdinal: snapshot.phase2.reputation.nextFactOrdinal,
                standingByOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.reputation.standingByOrganizationId).map(
                    ([organizationId, standing]) => [organizationId, { ...standing }],
                  ),
                ),
                factsByOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.reputation.factsByOrganizationId).map(
                    ([organizationId, facts]) => [
                      organizationId,
                      facts.map((fact) => ({
                        ...fact,
                        atTick: parseTick(fact.atTick),
                        deltaByGroup: { ...fact.deltaByGroup },
                      })),
                    ],
                  ),
                ),
              }
            : { ...defaults.reputation },
          intelligence: snapshot.phase2.intelligence
            ? {
                observerOrganizationId: parseOrganizationId(
                  snapshot.phase2.intelligence.observerOrganizationId,
                ),
                prng: {
                  algorithm: "xoshiro128ss-v1",
                  state: [...snapshot.phase2.intelligence.prng.state] as [
                    number,
                    number,
                    number,
                    number,
                  ],
                },
                estimatesBySubjectOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.intelligence.estimatesBySubjectOrganizationId).map(
                    ([subjectId, estimates]) => [
                      subjectId,
                      estimates.map((estimate) => ({
                        ...estimate,
                        subjectOrganizationId: parseOrganizationId(estimate.subjectOrganizationId),
                        atTick: parseTick(estimate.atTick),
                      })),
                    ],
                  ),
                ),
                nextEstimateOrdinal: snapshot.phase2.intelligence.nextEstimateOrdinal,
                commissionCooldownUntilTick: parseTick(
                  snapshot.phase2.intelligence.commissionCooldownUntilTick,
                ),
                lastRefreshTick:
                  snapshot.phase2.intelligence.lastRefreshTick === null
                    ? null
                    : parseTick(snapshot.phase2.intelligence.lastRefreshTick),
              }
            : { ...defaults.intelligence },
          factions: snapshot.phase2.factions
            ? {
                profileByOrganizationId: { ...snapshot.phase2.factions.profileByOrganizationId },
                stanceByPairId: { ...snapshot.phase2.factions.stanceByPairId },
                memoryByOrganizationId: Object.fromEntries(
                  Object.entries(snapshot.phase2.factions.memoryByOrganizationId).map(
                    ([organizationId, entries]) => [
                      organizationId,
                      entries.map((entry) => ({ ...entry, atTick: parseTick(entry.atTick) })),
                    ],
                  ),
                ),
                cycleCountByOrganizationId: {
                  ...snapshot.phase2.factions.cycleCountByOrganizationId,
                },
                nextMemoryOrdinal: snapshot.phase2.factions.nextMemoryOrdinal,
                lastDecayTick:
                  snapshot.phase2.factions.lastDecayTick === null
                    ? null
                    : parseTick(snapshot.phase2.factions.lastDecayTick),
              }
            : { ...defaults.factions },
          insurance: snapshot.phase2.insurance
            ? {
                contractsByBuildingId: Object.fromEntries(
                  Object.entries(snapshot.phase2.insurance.contractsByBuildingId).map(
                    ([buildingId, contract]) => [
                      buildingId,
                      {
                        ...contract,
                        buildingId: parseBuildingId(contract.buildingId),
                        insurerOrganizationId: parseOrganizationId(contract.insurerOrganizationId),
                        premium: parseMoney(contract.premium),
                        coverageLimit: parseMoney(contract.coverageLimit),
                        deductible: parseMoney(contract.deductible),
                        purchasedAtTick: parseTick(contract.purchasedAtTick),
                        lastPremiumTick: parseTick(contract.lastPremiumTick),
                        nextPremiumTick:
                          contract.nextPremiumTick === null
                            ? null
                            : parseTick(contract.nextPremiumTick),
                        totalPremiumPaid: parseMoney(contract.totalPremiumPaid),
                        exclusions: [...contract.exclusions],
                      },
                    ],
                  ),
                ),
                claimsByIncidentId: Object.fromEntries(
                  Object.entries(snapshot.phase2.insurance.claimsByIncidentId).map(
                    ([incidentId, claim]) => [
                      incidentId,
                      {
                        ...claim,
                        incidentId: parseIncidentId(claim.incidentId),
                        buildingId: parseBuildingId(claim.buildingId),
                        lossEstimate: parseMoney(claim.lossEstimate),
                        payout: parseMoney(claim.payout),
                        createdAtTick: parseTick(claim.createdAtTick),
                        processedAtTick: parseTick(claim.processedAtTick),
                      },
                    ],
                  ),
                ),
              }
            : defaults.insurance,
          permitting: snapshot.phase2.permitting
            ? {
                ...snapshot.phase2.permitting,
                approvalChanceByRole: { ...snapshot.phase2.permitting.approvalChanceByRole },
                permitsByParcelId: Object.fromEntries(
                  Object.entries(snapshot.phase2.permitting.permitsByParcelId).map(
                    ([parcelId, permit]) => [
                      parcelId,
                      {
                        ...permit,
                        allowedUsesAtDecision: [...permit.allowedUsesAtDecision],
                        currentUsesAtDecision: [...permit.currentUsesAtDecision],
                        parcelId: parseParcelId(permit.parcelId),
                        authorityOrganizationId: parseOrganizationId(
                          permit.authorityOrganizationId,
                        ),
                        requestedAtTick: parseTick(permit.requestedAtTick),
                        decidedAtTick: parseTick(permit.decidedAtTick),
                        expiresAtTick:
                          permit.expiresAtTick === null ? null : parseTick(permit.expiresAtTick),
                        requirements: [...permit.requirements],
                      },
                    ],
                  ),
                ),
              }
            : defaults.permitting,
          insolvency: snapshot.phase2.insolvency
            ? {
                auctionsByLoanId: Object.fromEntries(
                  Object.entries(snapshot.phase2.insolvency.auctionsByLoanId).map(
                    ([loanId, auction]) => [
                      loanId,
                      {
                        ...auction,
                        loanId: parseLoanId(auction.loanId),
                        collateralParcelId: parseParcelId(auction.collateralParcelId),
                        sellerOrganizationId: parseOrganizationId(auction.sellerOrganizationId),
                        reservePrice: parseMoney(auction.reservePrice),
                        highestBid: parseMoney(auction.highestBid),
                        highestBidderOrganizationId: auction.highestBidderOrganizationId
                          ? parseOrganizationId(auction.highestBidderOrganizationId)
                          : null,
                        reservedFundsByOrganizationId: Object.fromEntries(
                          Object.entries(auction.reservedFundsByOrganizationId).map(
                            ([organizationId, amount]) => [organizationId, parseMoney(amount)],
                          ),
                        ),
                        openedAtTick: parseTick(auction.openedAtTick),
                        closesAtTick: parseTick(auction.closesAtTick),
                      },
                    ],
                  ),
                ),
              }
            : defaults.insolvency,
        }
      : defaults,
  };
  for (const [organizationId, balance] of defaults.balances) {
    if (!state.phase2.balances.has(organizationId))
      state.phase2.balances.set(organizationId, balance);
  }
  assertMunicipalPoliticsReferences(state);
  return state;
}

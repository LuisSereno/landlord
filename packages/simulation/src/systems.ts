import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parseTick,
  parseIncidentId,
  type BuildingType,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  RIVAL_ORGANIZATION_ID,
  UPGRADE_RENT_BONUS_PERCENT,
  GAME_DAY_TICKS,
  GAME_HOUR_TICKS,
  GAME_MONTH_TICKS,
} from "./game-data";
import type { GameState } from "./state";
import { Xoshiro128ss } from "./prng";
import { findDeterministicPath } from "./navigation";

const MOVEMENT_TICKS_PER_CELL = 10;
const INCIDENT_LIMIT = 50;
const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
function hurtAgent(state: GameState, agent: import("@landlord/shared").Agent, damage: number): void {
  agent.health = Math.max(0, (agent.health ?? 100) - damage);
  if (agent.health === 0) { agent.state = "dead"; agent.task = null; return; }
  if (agent.health < 100) { agent.state = "injured"; agent.injuredUntilTick = parseTick(state.clock.tick + GAME_DAY_TICKS * 2); agent.task = null; }
}
function ignite(state: GameState, building: import("@landlord/shared").Building, origin: "sabotage" | "deterioration" | "blast", intensity: number, agentId: import("@landlord/shared").AgentId | null = null): void {
  if (building.state !== "operational") return;
  building.state = "burning";
  state.phase2.idCounters.transaction += 0;
  const id = parseIncidentId(`incident_${String(state.phase2.incidents.size + 1).padStart(8, "0")}`);
  state.phase2.incidents.set(id, { id, buildingId: building.id, origin, intensity, status: "active", targetOrganizationId: building.ownerOrganizationId, createdAtTick: state.clock.tick, causedByAgentId: agentId, causedByOrganizationId: agentId ? state.agents.get(agentId)?.organizationId ?? null : null, casualties: { injured: 0, dead: 0 } });
  while (state.phase2.incidents.size > INCIDENT_LIMIT) state.phase2.incidents.delete(state.phase2.incidents.keys().next().value!);
}

function totalResources(inventory: { cement: number; brick: number; steel: number }): number {
  return inventory.cement + inventory.brick + inventory.steel;
}

function trimTransactions(state: GameState): void {
  if (state.phase2.transactions.length > 500) {
    state.phase2.transactions.splice(0, state.phase2.transactions.length - 500);
  }
}

function recordRent(
  state: GameState,
  organizationId: Parameters<typeof state.phase2.balances.get>[0],
  amount: import("@landlord/shared").Money,
  buildingId: string,
): void {
  const current = state.phase2.balances.get(organizationId);
  if (current === undefined) return;
  const next = (current + amount) as import("@landlord/shared").Money;
  state.phase2.balances.set(organizationId, next);
  state.phase2.idCounters.transaction += 1;
  state.phase2.transactions.push({
    id: `txn_${String(state.phase2.idCounters.transaction).padStart(8, "0")}` as import("@landlord/shared").TransactionId,
    tick: state.clock.tick,
    organizationId,
    cause: "rent_collection",
    amount,
    direction: "credit",
    referenceId: buildingId,
  });
  trimTransactions(state);
}

function progressProduction(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_HOUR_TICKS !== 0) return;
  for (const facility of [...state.phase2.facilities.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!facility.operational) continue;
    facility.cycleProgress += 1;
    if (facility.cycleProgress < facility.cycleLength) continue;
    const inventory = state.phase2.inventories.get(facility.ownerOrganizationId);
    if (!inventory || totalResources(inventory) + facility.outputAmount > inventory.capacity) {
      facility.cycleProgress = facility.cycleLength;
      continue;
    }
    const balance = state.phase2.balances.get(facility.ownerOrganizationId) ?? 0;
    if (balance < facility.operatingCost) {
      facility.cycleProgress = facility.cycleLength;
      continue;
    }
    state.phase2.balances.set(
      facility.ownerOrganizationId,
      parseMoney(balance - facility.operatingCost),
    );
    state.phase2.idCounters.transaction += 1;
    state.phase2.transactions.push({
      id: `txn_${String(state.phase2.idCounters.transaction).padStart(8, "0")}` as import("@landlord/shared").TransactionId,
      tick: state.clock.tick,
      organizationId: facility.ownerOrganizationId,
      cause: "production_operation",
      amount: facility.operatingCost,
      direction: "debit",
      referenceId: facility.id,
    });
    trimTransactions(state);
    inventory[facility.output] += facility.outputAmount;
    facility.cycleProgress = 0;
  }
}

function progressConstruction(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_HOUR_TICKS !== 0) return;
  const sites = [...state.phase2.constructionSites.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const site of sites) {
    const assignedWork = site.assignedCrewIds.length
      ? site.assignedCrewIds.reduce((total, crewId) => {
          const crew = state.phase2.crews.get(crewId);
          if (!crew) return total;
          const supervisor = state.agents.get(crew.supervisorAgentId);
          const workers = crew.workerAgentIds.filter((id) => {
            const worker = state.agents.get(id);
            return worker?.state !== "dead" && worker?.state !== "injured";
          }).length;
          return total + (supervisor?.state !== "dead" && supervisor?.state !== "injured" ? (workers === 2 ? 2 : workers === 1 ? 1 : 0) : 0);
        }, 0)
      : site.crewCapacity;
    site.progress += assignedWork;
    if (site.progress < site.workRequired) continue;
    if (site.kind === "clear_ruin" && site.targetBuildingId) {
      const ruin = state.phase2.buildings.get(site.targetBuildingId);
      if (ruin) {
        const parcel = state.phase2.parcels.get(ruin.parcelId);
        if (parcel) parcel.buildingId = null;
        state.phase2.buildings.delete(ruin.id);
      }
    } else if (site.repairBuildingId) {
      const building = state.phase2.buildings.get(site.repairBuildingId);
      if (building) building.condition = 100;
    } else if (site.upgradeBuildingId) {
      const building = state.phase2.buildings.get(site.upgradeBuildingId);
      if (building) {
        building.upgraded = true;
        building.level += 1;
        building.condition = Math.min(100, building.condition + 15);
      }
    } else {
      state.phase2.idCounters.building += 1;
      const buildingId = parseBuildingId(
        `building_${String(state.phase2.idCounters.building).padStart(8, "0")}`,
      );
      const building: import("@landlord/shared").Building = {
        id: buildingId,
        parcelId: site.parcelId,
        ownerOrganizationId: site.ownerOrganizationId,
        type: site.buildingType,
        level: 1,
        condition: 100,
        tenantId: null,
        tenantIds: [],
        upgraded: false,
        structuralIntegrity: 100,
        state: "operational",
        casualtiesTotal: { injured: 0, dead: 0 },
      };
      state.phase2.buildings.set(buildingId, building);
      const parcel = state.phase2.parcels.get(site.parcelId);
      if (parcel) parcel.buildingId = buildingId;
    }
    state.phase2.constructionSites.delete(site.id);
  }
}

function collectRentAndAgeLeases(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const rentModifier =
    state.phase2.ordinance.status === "active"
      ? 1 + state.phase2.ordinance.rentModifierPercent / 100
      : 1;
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (building.state === "ruin" || building.tenantIds.length === 0) continue;
    const askingRent = Math.max(
      0,
      Math.round(
        BUILDING_DEFINITIONS[building.type].baseRent *
          (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
          rentModifier,
      ),
    );
    for (const tenantId of [...building.tenantIds]) {
      const tenant = state.phase2.tenants.get(tenantId);
      if (!tenant) continue;
      const paid = Math.min(askingRent, tenant.budget);
      recordRent(state, building.ownerOrganizationId, parseMoney(paid), building.id);
      tenant.leaseRemaining = Math.max(0, tenant.leaseRemaining - 1);
      const affordabilityPenalty = askingRent > tenant.budget ? 20 : 0;
      const conditionPenalty = building.condition < 60 ? 10 : 0;
      tenant.satisfaction = Math.max(
        0,
        Math.min(100, tenant.satisfaction + 2 - affordabilityPenalty - conditionPenalty),
      );
      if (tenant.leaseRemaining === 0 || building.condition < 20 || tenant.satisfaction < 30) {
        building.tenantIds = building.tenantIds.filter((id) => id !== tenant.id);
        tenant.activeContractBuildingId = null;
        tenant.status = "available";
      }
    }
    building.tenantId = building.tenantIds[0] ?? null;
    building.condition = Math.max(0, building.condition - 5);
  }
}

function updatePolicyAndHeat(state: GameState): void {
  const ordinance = state.phase2.ordinance;
  if (
    ordinance.status === "active" &&
    ordinance.expiresAtTick !== null &&
    state.clock.tick >= ordinance.expiresAtTick
  ) {
    ordinance.status = "expired";
  }
  if (state.clock.tick > 0 && state.clock.tick % (GAME_DAY_TICKS * 5) === 0) {
    for (const organizationId of Object.keys(state.phase2.crime.heatByOrganizationId)) {
      state.phase2.crime.heatByOrganizationId[organizationId] = Math.max(
        0,
        state.phase2.crime.heatByOrganizationId[organizationId]! - 1,
      );
    }
    state.phase2.crime.policePressure = Math.max(0, state.phase2.crime.policePressure - 1);
  }
}

function tacticalTick(state: GameState): void {
  const agents = [...state.agents.values()].sort((a, b) => a.id.localeCompare(b.id));
  // 1. Movement: target agents are re-evaluated at most once per game second.
  if (state.clock.tick % MOVEMENT_TICKS_PER_CELL === 0) for (const agent of agents) {
    if (agent.state === "dead" || agent.state === "injured" || !agent.task) continue;
    if (agent.task.kind === "attack_agent") {
      const target = state.agents.get(agent.task.targetAgentId);
      if (target && (agent.lastPathRecalculationTick === undefined || state.clock.tick - agent.lastPathRecalculationTick >= 20 || agent.path?.length === 0)) { agent.target = { ...target.cell }; agent.path = findDeterministicPath(agent.cell, agent.target, state.map.blockedCells); agent.lastPathRecalculationTick = state.clock.tick; }
    }
    if (!agent.path?.length && agent.target && !adjacent(agent.cell, agent.target)) agent.path = findDeterministicPath(agent.cell, agent.target, state.map.blockedCells);
    const next = agent.path?.shift(); if (next) agent.cell = next;
    if (agent.target && adjacent(agent.cell, agent.target)) agent.state = "working";
  }
  if (state.clock.tick === 0 || state.clock.tick % GAME_HOUR_TICKS !== 0) return;
  if (state.clock.tick % GAME_MONTH_TICKS === 0) {
    const prng = new Xoshiro128ss(state.seed); prng.restoreState(state.prng);
    for (const building of [...state.phase2.buildings.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const hasIncident = [...state.phase2.incidents.values()].some((incident) => incident.buildingId === building.id && incident.status === "active");
      if (building.state !== "operational" || hasIncident || building.condition > 20) continue;
      if (prng.nextInt(0, 100) < 35) ignite(state, building, "deterioration", 40);
    }
    state.prng = prng.exportState();
  }
  // 3. Technician suppression and repair.
  for (const building of [...state.phase2.buildings.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const technician = agents.find((agent) => agent.task?.kind === "maintenance" && agent.task.buildingId === building.id && adjacent(agent.cell, state.phase2.parcels.get(building.parcelId)!.cell) && agent.state === "working");
    const incident = [...state.phase2.incidents.values()].find((entry) => entry.buildingId === building.id && entry.status === "active");
    if (technician && incident) incident.intensity = Math.max(0, incident.intensity - 35);
    if (technician && building.state === "operational") building.condition = Math.min(100, building.condition + 10);
  }
  // 4. Reached enforcer orders; sabotage is the only PRNG draw here.
  for (const agent of agents) {
    if (agent.specialty !== "enforcer" || !agent.task || (agent.cooldownUntilTick ?? 0) > state.clock.tick) continue;
    if (agent.task.kind === "attack_agent") { const target = state.agents.get(agent.task.targetAgentId); if (target && adjacent(agent.cell, target.cell)) { hurtAgent(state, target, 50); agent.cooldownUntilTick = parseTick(state.clock.tick + GAME_HOUR_TICKS); } }
    if (agent.task.kind === "sabotage_building") { const building = state.phase2.buildings.get(agent.task.targetBuildingId); if (building && adjacent(agent.cell, state.phase2.parcels.get(building.parcelId)!.cell)) { const prng = new Xoshiro128ss(state.seed); prng.restoreState(state.prng); prng.nextInt(0, 100); state.prng = prng.exportState(); ignite(state, building, "sabotage", 40, agent.id); agent.cooldownUntilTick = parseTick(state.clock.tick + GAME_HOUR_TICKS); agent.task = null; agent.state = "idle"; } }
  }
  // 5-6. Fire update and structural damage.
  for (const incident of [...state.phase2.incidents.values()].filter((entry) => entry.status === "active").sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const building = state.phase2.buildings.get(incident.buildingId); if (!building || building.state === "ruin") { incident.status = "resolved"; continue; }
    const tech = agents.some((agent) => agent.task?.kind === "maintenance" && agent.task.buildingId === building.id && agent.state === "working");
    if (!tech) incident.intensity = Math.min(100, incident.intensity + 15);
    building.structuralIntegrity = Math.max(0, building.structuralIntegrity - Math.ceil(incident.intensity / 10));
    if (incident.intensity === 0) { incident.status = "resolved"; building.state = "operational"; }
    else if (incident.intensity >= 100 || building.structuralIntegrity <= 0) building.state = "collapse_pending";
  }
  // 7-9. Existing pending roots blast now. New pending buildings wait next hour.
  const pending = [...state.phase2.buildings.values()].filter((building) => building.state === "collapse_pending").sort((a, b) => a.id.localeCompare(b.id));
  for (const root of pending) {
    root.state = "ruin"; const parcel = state.phase2.parcels.get(root.parcelId)!;
    for (const tenantId of root.tenantIds) { const tenant = state.phase2.tenants.get(tenantId); if (tenant) { tenant.status = "displaced"; tenant.activeContractBuildingId = null; } }
    const occupants = root.type === "courtyard_home" ? 3 : 2; const dead = Math.floor(occupants / 2); const injured = occupants - dead; root.casualtiesTotal.injured += injured; root.casualtiesTotal.dead += dead; root.tenantIds = []; root.tenantId = null;
    const ownIncident = [...state.phase2.incidents.values()].find((entry) => entry.buildingId === root.id && entry.status === "active"); if (ownIncident) { ownIncident.casualties = { injured, dead }; ownIncident.status = "resolved"; }
    for (const agent of agents) if (Math.abs(agent.cell.x - parcel.cell.x) + Math.abs(agent.cell.y - parcel.cell.y) <= 3) hurtAgent(state, agent, 60);
    for (const building of state.phase2.buildings.values()) { if (building.id === root.id || building.state !== "operational") continue; const target = state.phase2.parcels.get(building.parcelId)!; if (Math.abs(target.cell.x - parcel.cell.x) + Math.abs(target.cell.y - parcel.cell.y) <= 3) { building.structuralIntegrity = Math.max(0, building.structuralIntegrity - 35); ignite(state, building, "blast", 25); if (building.structuralIntegrity <= 0) building.state = "collapse_pending"; } }
  }
  // 10. deterministic recovery.
  for (const agent of agents) if (agent.state === "injured" && (agent.injuredUntilTick ?? Infinity) <= state.clock.tick) { agent.health = 100; agent.state = "idle"; agent.injuredUntilTick = null; }
}

function rivalAction(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_DAY_TICKS !== 0) return;
  if (state.clock.tick < state.phase2.rivalAi.cooldownUntilTick) return;
  const rivalPersonId = "person_00000002" as import("@landlord/shared").PersonId;
  const base = {
    issuedByPersonId: rivalPersonId,
    actingAsOrganizationId: RIVAL_ORGANIZATION_ID,
  };
  const vacantBuilding = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        building.tenantIds.length < BUILDING_DEFINITIONS[building.type].capacity,
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  const compatibleTenant = vacantBuilding
    ? [...state.phase2.tenants.values()]
        .filter(
          (tenant) =>
            tenant.activeContractBuildingId === null &&
            tenant.preferredBuildingType === vacantBuilding.type,
        )
        .sort((a, b) => a.id.localeCompare(b.id))[0]
    : undefined;
  const ownedParcel = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        !parcel.buildingId &&
        ![...state.phase2.constructionSites.values()].some((site) => site.parcelId === parcel.id),
    )
    .sort((a, b) => a.price - b.price)[0];
  const available = [...state.phase2.parcels.values()]
    .filter((parcel) => !parcel.ownerOrganizationId)
    .sort((a, b) => a.price - b.price)[0];
  const balance = state.phase2.balances.get(RIVAL_ORGANIZATION_ID) ?? 0;
  const inventory = state.phase2.inventories.get(RIVAL_ORGANIZATION_ID)!;
  const buildingType: BuildingType =
    ownedParcel?.zoning === "industrial" ? "workshop" : "courtyard_home";
  const definition = BUILDING_DEFINITIONS[buildingType];
  const missingResource = (["cement", "brick", "steel"] as const).find(
    (resource) => inventory[resource] < definition.resources[resource],
  );
  const inactiveFacility = [...state.phase2.facilities.values()].find(
    (facility) => facility.ownerOrganizationId === RIVAL_ORGANIZATION_ID && !facility.operational,
  );

  const candidates: Array<{
    score: number;
    action: string;
    reason: string;
    command: Exclude<import("@landlord/shared").ProductCommand, { type: "PlaceTestStructure" }>;
  }> = [];
  if (vacantBuilding && compatibleTenant) {
    candidates.push({
      score: 100,
      action: "assign_tenant",
      reason: "Hay una unidad compatible vacante.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-tenant`),
        type: "AssignTenant",
        payload: { buildingId: vacantBuilding.id, tenantId: compatibleTenant.id },
      },
    });
  }
  if (ownedParcel && missingResource && totalResources(inventory) + 2 <= inventory.capacity) {
    candidates.push({
      score: 85,
      action: "buy_materials",
      reason: `Falta ${missingResource} para desarrollar la parcela propia.`,
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-materials`),
        type: "BuyMaterials",
        payload: { resource: missingResource, amount: 2 },
      },
    });
  }
  if (ownedParcel && !missingResource) {
    candidates.push({
      score: 80,
      action: "start_construction",
      reason: "Parcela propia, materiales y liquidez disponibles.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-build`),
        type: "StartConstruction",
        payload: { parcelId: ownedParcel.id, buildingType },
      },
    });
  }
  if (inactiveFacility && balance >= inactiveFacility.investmentCost + 2500) {
    candidates.push({
      score: 55,
      action: "invest_production",
      reason: "Puede reducir compras futuras conservando una reserva de 2500 u.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-production`),
        type: "InvestInProduction",
        payload: { resource: inactiveFacility.output },
      },
    });
  }
  if (available && balance >= available.price + 2500) {
    candidates.push({
      score: 40,
      action: "buy_parcel",
      reason: "La parcela más barata permite expandirse sin consumir la reserva.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-parcel`),
        type: "BuyParcel",
        payload: { parcelId: available.id },
      },
    });
  }
  const selected = candidates.sort((left, right) => right.score - left.score)[0];
  if (!selected) {
    state.phase2.rivalAi.lastAction = "reserve_liquidity";
    state.phase2.rivalAi.lastReason = "No hay una acción válida que preserve la liquidez mínima.";
    return;
  }
  const result = dispatchProductCommand(state, selected.command);
  state.phase2.rivalAi.lastAction = selected.action;
  state.phase2.rivalAi.lastReason = selected.reason;
  state.phase2.rivalAi.lastFailureCode = result.accepted ? null : result.code;
  state.phase2.rivalAi.cooldownUntilTick = parseTick(
    state.clock.tick + (result.accepted ? GAME_DAY_TICKS : GAME_DAY_TICKS * 2),
  );
}

export function advanceProductSystems(state: GameState): void {
  tacticalTick(state);
  progressProduction(state);
  progressConstruction(state);
  collectRentAndAgeLeases(state);
  updatePolicyAndHeat(state);
  rivalAction(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

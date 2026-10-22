import {
  parseBuildingId,
  parseCommandId,
  parseMoney,
  parseTick,
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
    site.progress += site.crewCapacity;
    if (site.progress < site.workRequired) continue;
    if (site.repairBuildingId) {
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
      const building = {
        id: buildingId,
        parcelId: site.parcelId,
        ownerOrganizationId: site.ownerOrganizationId,
        type: site.buildingType,
        level: 1,
        condition: 100,
        tenantId: null,
        tenantIds: [],
        upgraded: false,
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
    if (building.tenantIds.length === 0) continue;
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
  progressProduction(state);
  progressConstruction(state);
  collectRentAndAgeLeases(state);
  updatePolicyAndHeat(state);
  rivalAction(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

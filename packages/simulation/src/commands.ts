import {
  addMoney,
  parseEventId,
  parseConstructionSiteId,
  parseMoney,
  parseTransactionId,
  parseStructureId,
  parseTick,
  subtractMoney,
  type BuyParcel,
  type CancelConstruction,
  type CommitCrime,
  type ErrorCode,
  type AssignTenant,
  type LobbyPolicy,
  type PlaceTestStructure,
  type StartConstruction,
  type TestStructurePlaced,
  type UpgradeBuilding,
  type BuyMaterials,
  type InvestInProduction,
  type AllocateCrew,
  type RepairBuilding,
} from "@landlord/shared";
import { hasOrganizationControl, type GameState } from "./state";
import {
  BUILDING_DEFINITIONS,
  ILLEGAL_ROUTE,
  PLAYER_CREW_CAPACITY,
  UPGRADE_RESOURCES,
  CRIME_COOLDOWN_TICKS,
  MARKET_PRICES,
  REPAIR_COST,
  REPAIR_WORK_REQUIRED,
} from "./game-data";
import { Xoshiro128ss } from "./prng";

export type CommandRejection = {
  accepted: false;
  code: ErrorCode;
};

/** The event is delivered to current consumers and is not retained in GameState. */
export type CommandAcceptance = {
  accepted: true;
  event: TestStructurePlaced;
};

export type CommandResult = CommandRejection | CommandAcceptance;

export type ProductCommandResult =
  | CommandRejection
  | {
      accepted: true;
      event: { type: string; tick: number; commandId: string; payload: Record<string, unknown> };
    };

function inMap(state: GameState, cell: { x: number; y: number }): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < state.map.width && cell.y < state.map.height;
}

function cellKey(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

function nextEntityId(prefix: "structure" | "event", value: number): string {
  return `${prefix}_${String(value).padStart(8, "0")}`;
}

function hasStructureAt(state: GameState, cell: { x: number; y: number }): boolean {
  const key = cellKey(cell);
  return [...state.structures.values()].some((structure) => cellKey(structure.cell) === key);
}

function validateActor(
  state: GameState,
  command: {
    issuedByPersonId: import("@landlord/shared").PersonId;
    actingAsOrganizationId: import("@landlord/shared").OrganizationId;
  },
): ErrorCode | null {
  const isAutonomousRival =
    command.issuedByPersonId === "person_00000002" &&
    command.actingAsOrganizationId === "org_00000002";
  if (!state.persons.has(command.issuedByPersonId) && !isAutonomousRival) return "PERSON_NOT_FOUND";
  if (!state.organizations.has(command.actingAsOrganizationId)) return "ORGANIZATION_NOT_FOUND";
  if (
    !isAutonomousRival &&
    !hasOrganizationControl(state, command.issuedByPersonId, command.actingAsOrganizationId)
  ) {
    return "ACTOR_NOT_AUTHORIZED";
  }
  return null;
}

function productEvent(
  state: GameState,
  commandId: string,
  type: string,
  payload: Record<string, unknown>,
): ProductCommandResult {
  return { accepted: true, event: { type, tick: state.clock.tick, commandId, payload } };
}

function hasResources(
  available: { cement: number; brick: number; steel: number },
  required: { cement: number; brick: number; steel: number },
): boolean {
  return (
    available.cement >= required.cement &&
    available.brick >= required.brick &&
    available.steel >= required.steel
  );
}

function totalInventory(inventory: { cement: number; brick: number; steel: number }): number {
  return inventory.cement + inventory.brick + inventory.steel;
}

const MAX_TRANSACTION_HISTORY = 500;
const MAX_PROCESSED_COMMANDS = 2048;

function rememberProcessed(
  state: GameState,
  commandId: import("@landlord/shared").CommandId,
): void {
  state.processedCommandIds.add(commandId);
  while (state.processedCommandIds.size > MAX_PROCESSED_COMMANDS) {
    const oldest = state.processedCommandIds.values().next().value;
    if (!oldest) break;
    state.processedCommandIds.delete(oldest);
  }
}

function trimTransactions(state: GameState): void {
  if (state.phase2.transactions.length > MAX_TRANSACTION_HISTORY) {
    state.phase2.transactions.splice(0, state.phase2.transactions.length - MAX_TRANSACTION_HISTORY);
  }
}

function effectiveRent(state: GameState, building: import("@landlord/shared").Building): number {
  const policyModifier =
    state.phase2.ordinance.status === "active"
      ? 1 + state.phase2.ordinance.rentModifierPercent / 100
      : 1;
  return Math.max(
    0,
    Math.round(
      BUILDING_DEFINITIONS[building.type].baseRent *
        (building.upgraded ? 1.25 : 1) *
        policyModifier,
    ),
  );
}

function debit(
  state: GameState,
  organizationId: import("@landlord/shared").OrganizationId,
  amount: import("@landlord/shared").Money,
  cause: string,
  referenceId: string,
): boolean {
  const current = state.phase2.balances.get(organizationId);
  if (current === undefined) return false;
  const next = subtractMoney(current, amount);
  if (!next.ok) return false;
  state.phase2.balances.set(organizationId, next.value);
  state.phase2.idCounters.transaction += 1;
  state.phase2.transactions.push({
    id: parseTransactionId(`txn_${String(state.phase2.idCounters.transaction).padStart(8, "0")}`),
    tick: state.clock.tick,
    organizationId,
    cause,
    amount,
    direction: "debit",
    referenceId,
  });
  trimTransactions(state);
  return true;
}

function credit(
  state: GameState,
  organizationId: import("@landlord/shared").OrganizationId,
  amount: import("@landlord/shared").Money,
  cause: string,
  referenceId: string,
): boolean {
  const current = state.phase2.balances.get(organizationId);
  if (current === undefined) return false;
  const next = addMoney(current, amount);
  if (!next.ok) return false;
  state.phase2.balances.set(organizationId, next.value);
  state.phase2.idCounters.transaction += 1;
  state.phase2.transactions.push({
    id: parseTransactionId(`txn_${String(state.phase2.idCounters.transaction).padStart(8, "0")}`),
    tick: state.clock.tick,
    organizationId,
    cause,
    amount,
    direction: "credit",
    referenceId,
  });
  trimTransactions(state);
  return true;
}

export function dispatchProductCommand(
  state: GameState,
  command:
    | BuyParcel
    | StartConstruction
    | CancelConstruction
    | AssignTenant
    | UpgradeBuilding
    | LobbyPolicy
    | CommitCrime
    | BuyMaterials
    | InvestInProduction
    | AllocateCrew
    | RepairBuilding,
): ProductCommandResult {
  if (state.processedCommandIds.has(command.commandId))
    return { accepted: false, code: "DUPLICATE_COMMAND" };
  const actorError = validateActor(state, command);
  if (actorError) return { accepted: false, code: actorError };

  if (command.type === "BuyMaterials") {
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    if (totalInventory(inventory) + command.payload.amount > inventory.capacity)
      return { accepted: false, code: "INVENTORY_CAPACITY" };
    const cost = parseMoney(MARKET_PRICES[command.payload.resource] * command.payload.amount);
    if (
      !debit(
        state,
        command.actingAsOrganizationId,
        cost,
        "materials_market",
        command.payload.resource,
      )
    )
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    inventory[command.payload.resource] += command.payload.amount;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "MaterialsPurchased", {
      ...command.payload,
      cost,
    });
  }

  if (command.type === "InvestInProduction") {
    const facility = [...state.phase2.facilities.values()].find(
      (entry) =>
        entry.ownerOrganizationId === command.actingAsOrganizationId &&
        entry.output === command.payload.resource,
    );
    if (!facility) return { accepted: false, code: "FACILITY_NOT_FOUND" };
    if (facility.operational) return { accepted: false, code: "FACILITY_ALREADY_ACTIVE" };
    if (
      !debit(
        state,
        command.actingAsOrganizationId,
        facility.investmentCost,
        "production_investment",
        facility.id,
      )
    )
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    facility.operational = true;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ProductionActivated", {
      facilityId: facility.id,
      resource: facility.output,
    });
  }

  if (command.type === "AllocateCrew") {
    const site = state.phase2.constructionSites.get(command.payload.constructionSiteId);
    if (!site) return { accepted: false, code: "CONSTRUCTION_SITE_NOT_FOUND" };
    if (site.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const assignedElsewhere = [...state.phase2.constructionSites.values()]
      .filter(
        (entry) =>
          entry.ownerOrganizationId === command.actingAsOrganizationId && entry.id !== site.id,
      )
      .reduce((sum, entry) => sum + entry.crewCapacity, 0);
    if (assignedElsewhere + command.payload.crewCapacity > PLAYER_CREW_CAPACITY)
      return { accepted: false, code: "INVALID_CREW_ALLOCATION" };
    site.crewCapacity = command.payload.crewCapacity;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "CrewAllocated", {
      siteId: site.id,
      crewCapacity: site.crewCapacity,
    });
  }

  if (command.type === "BuyParcel") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    if (parcel.ownerOrganizationId) return { accepted: false, code: "PARCEL_UNAVAILABLE" };
    if (!debit(state, command.actingAsOrganizationId, parcel.price, "parcel_purchase", parcel.id)) {
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    }
    parcel.ownerOrganizationId = command.actingAsOrganizationId;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ParcelPurchased", {
      parcelId: parcel.id,
      ownerOrganizationId: parcel.ownerOrganizationId,
      price: parcel.price,
    });
  }

  if (command.type === "StartConstruction") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    const definition = BUILDING_DEFINITIONS[command.payload.buildingType];
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!definition.allowedZoning.includes(parcel.zoning))
      return { accepted: false, code: "INVALID_ZONING" };
    if (
      parcel.buildingId ||
      [...state.phase2.constructionSites.values()].some((site) => site.parcelId === parcel.id)
    ) {
      return { accepted: false, code: "CONSTRUCTION_ALREADY_ACTIVE" };
    }
    const activeCrewAssignments = [...state.phase2.constructionSites.values()]
      .filter((site) => site.ownerOrganizationId === command.actingAsOrganizationId)
      .reduce((sum, site) => sum + site.crewCapacity, 0);
    if (activeCrewAssignments >= PLAYER_CREW_CAPACITY)
      return { accepted: false, code: "CREW_UNAVAILABLE" };
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    if (!hasResources(inventory, definition.resources))
      return { accepted: false, code: "INSUFFICIENT_RESOURCES" };
    const materialModifier =
      state.phase2.ordinance.status === "active"
        ? 1 + state.phase2.ordinance.materialCostModifierPercent / 100
        : 1;
    const cost = parseMoney(Math.max(0, Math.round(definition.cost * materialModifier)));
    if (!debit(state, command.actingAsOrganizationId, cost, "construction_start", parcel.id))
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    inventory.cement -= definition.resources.cement;
    inventory.brick -= definition.resources.brick;
    inventory.steel -= definition.resources.steel;
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(
      `site_${String(state.phase2.idCounters.constructionSite).padStart(8, "0")}`,
    );
    state.phase2.constructionSites.set(siteId, {
      id: siteId,
      parcelId: parcel.id,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: definition.type,
      progress: 0,
      workRequired: definition.workRequired,
      resourcesReserved: { ...definition.resources },
      crewCapacity: 1,
      upgradeBuildingId: null,
      repairBuildingId: null,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ConstructionStarted", {
      siteId,
      parcelId: parcel.id,
    });
  }

  if (command.type === "CancelConstruction") {
    const site = state.phase2.constructionSites.get(command.payload.constructionSiteId);
    if (!site) return { accepted: false, code: "CONSTRUCTION_SITE_NOT_FOUND" };
    if (site.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    const room = Math.max(0, inventory.capacity - totalInventory(inventory));
    const refund = {
      cement: Math.floor(site.resourcesReserved.cement / 2),
      brick: Math.floor(site.resourcesReserved.brick / 2),
      steel: Math.floor(site.resourcesReserved.steel / 2),
    };
    let remainingRoom = room;
    for (const resource of ["cement", "brick", "steel"] as const) {
      const restored = Math.min(refund[resource], remainingRoom);
      inventory[resource] += restored;
      refund[resource] = restored;
      remainingRoom -= restored;
    }
    state.phase2.constructionSites.delete(site.id);
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ConstructionCancelled", {
      siteId: site.id,
      refundPolicy: "half_resources_no_cash_capped_by_inventory",
      refund,
    });
  }

  if (command.type === "AssignTenant") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    const tenant = state.phase2.tenants.get(command.payload.tenantId);
    if (!building) return { accepted: false, code: "BUILDING_NOT_FOUND" };
    if (!tenant) return { accepted: false, code: "TENANT_NOT_FOUND" };
    if (building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (
      building.tenantIds.length >= BUILDING_DEFINITIONS[building.type].capacity ||
      tenant.activeContractBuildingId
    )
      return { accepted: false, code: "TENANT_ALREADY_ASSIGNED" };
    if (tenant.preferredBuildingType !== building.type)
      return { accepted: false, code: "TENANT_INCOMPATIBLE" };
    if (tenant.budget < effectiveRent(state, building))
      return { accepted: false, code: "TENANT_BUDGET_TOO_LOW" };
    building.tenantIds.push(tenant.id);
    building.tenantId = building.tenantIds[0] ?? null;
    tenant.activeContractBuildingId = building.id;
    tenant.leaseRemaining = 24;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "TenantAssigned", {
      buildingId: building.id,
      tenantId: tenant.id,
    });
  }

  if (command.type === "UpgradeBuilding") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (!building) return { accepted: false, code: "BUILDING_NOT_FOUND" };
    if (building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (
      building.upgraded ||
      [...state.phase2.constructionSites.values()].some(
        (site) => site.upgradeBuildingId === building.id,
      )
    ) {
      return { accepted: false, code: "CONSTRUCTION_ALREADY_ACTIVE" };
    }
    const activeCrewAssignments = [...state.phase2.constructionSites.values()]
      .filter((site) => site.ownerOrganizationId === command.actingAsOrganizationId)
      .reduce((sum, site) => sum + site.crewCapacity, 0);
    if (activeCrewAssignments >= PLAYER_CREW_CAPACITY)
      return { accepted: false, code: "CREW_UNAVAILABLE" };
    const definition = BUILDING_DEFINITIONS[building.type];
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    if (!hasResources(inventory, UPGRADE_RESOURCES))
      return { accepted: false, code: "INSUFFICIENT_RESOURCES" };
    if (
      !debit(
        state,
        command.actingAsOrganizationId,
        definition.upgradeCost,
        "building_upgrade",
        building.id,
      )
    )
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    inventory.cement -= UPGRADE_RESOURCES.cement;
    inventory.brick -= UPGRADE_RESOURCES.brick;
    inventory.steel -= UPGRADE_RESOURCES.steel;
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(
      `site_${String(state.phase2.idCounters.constructionSite).padStart(8, "0")}`,
    );
    state.phase2.constructionSites.set(siteId, {
      id: siteId,
      parcelId: building.parcelId,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: building.type,
      progress: 0,
      workRequired: definition.upgradeWorkRequired,
      resourcesReserved: { ...UPGRADE_RESOURCES },
      crewCapacity: 1,
      upgradeBuildingId: building.id,
      repairBuildingId: null,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "UpgradeStarted", {
      siteId,
      buildingId: building.id,
    });
  }

  if (command.type === "RepairBuilding") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (!building) return { accepted: false, code: "BUILDING_NOT_FOUND" };
    if (building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (building.condition >= 100) return { accepted: false, code: "BUILDING_CONDITION_FULL" };
    if (
      [...state.phase2.constructionSites.values()].some(
        (site) => site.upgradeBuildingId === building.id || site.repairBuildingId === building.id,
      )
    )
      return { accepted: false, code: "CONSTRUCTION_ALREADY_ACTIVE" };
    const usedCrew = [...state.phase2.constructionSites.values()]
      .filter((site) => site.ownerOrganizationId === command.actingAsOrganizationId)
      .reduce((sum, site) => sum + site.crewCapacity, 0);
    if (usedCrew >= PLAYER_CREW_CAPACITY) return { accepted: false, code: "CREW_UNAVAILABLE" };
    if (!debit(state, command.actingAsOrganizationId, REPAIR_COST, "building_repair", building.id))
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(
      `site_${String(state.phase2.idCounters.constructionSite).padStart(8, "0")}`,
    );
    state.phase2.constructionSites.set(siteId, {
      id: siteId,
      parcelId: building.parcelId,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: building.type,
      progress: 0,
      workRequired: REPAIR_WORK_REQUIRED,
      resourcesReserved: { cement: 0, brick: 0, steel: 0 },
      crewCapacity: 1,
      upgradeBuildingId: null,
      repairBuildingId: building.id,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "RepairStarted", {
      siteId,
      buildingId: building.id,
    });
  }

  if (command.type === "LobbyPolicy") {
    const ordinance = state.phase2.ordinance;
    const influence =
      state.phase2.influenceByOrganizationId.get(command.actingAsOrganizationId) ?? 0;
    if (command.payload.policyId !== ordinance.id || ordinance.status !== "proposed")
      return { accepted: false, code: "POLICY_NOT_AVAILABLE" };
    if (influence < command.payload.influenceSpend)
      return { accepted: false, code: "INFLUENCE_TOO_LOW" };
    state.phase2.influenceByOrganizationId.set(
      command.actingAsOrganizationId,
      influence - command.payload.influenceSpend,
    );
    const generator = new Xoshiro128ss(state.seed);
    generator.restoreState(state.prng);
    const chance = Math.min(
      95,
      ordinance.approvalChancePercent + (command.payload.influenceSpend - 1) * 15,
    );
    const approved = generator.nextInt(0, 100) < chance;
    state.prng = generator.exportState();
    ordinance.status = approved ? "active" : "rejected";
    ordinance.proposedAtTick = state.clock.tick;
    ordinance.activeFromTick = approved ? state.clock.tick : null;
    ordinance.expiresAtTick = approved ? parseTick(state.clock.tick + 24_000) : null;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, approved ? "PolicyEnacted" : "PolicyRejected", {
      policyId: ordinance.id,
      expiresAtTick: ordinance.expiresAtTick,
      approvalChancePercent: chance,
      influenceSpent: command.payload.influenceSpend,
    });
  }

  const target = state.phase2.balances.get(command.payload.targetOrganizationId);
  if (!target || command.payload.targetOrganizationId === command.actingAsOrganizationId)
    return { accepted: false, code: "CRIME_TARGET_INVALID" };
  const nextAvailable =
    state.phase2.crime.nextAvailableTickByOrganizationId[command.actingAsOrganizationId] ?? 0;
  if (state.clock.tick < nextAvailable) return { accepted: false, code: "CRIME_COOLDOWN" };
  const generator = new Xoshiro128ss(state.seed);
  generator.restoreState(state.prng);
  const heat =
    state.phase2.crime.heatByOrganizationId[command.actingAsOrganizationId as string] ?? 0;
  const detected =
    generator.nextInt(0, 100) <
    ILLEGAL_ROUTE.baseDetectionChancePercent + heat * 5 + state.phase2.crime.policePressure * 3;
  state.prng = generator.exportState();
  state.phase2.crime.heatByOrganizationId[command.actingAsOrganizationId as string] =
    heat + ILLEGAL_ROUTE.heatOnAttempt;
  state.phase2.crime.nextAvailableTickByOrganizationId[command.actingAsOrganizationId] =
    state.clock.tick + CRIME_COOLDOWN_TICKS;
  if (detected) {
    state.phase2.crime.policePressure += ILLEGAL_ROUTE.policePressureOnDetection;
    state.phase2.crime.lastOutcome = "detected";
    const currentBalance = state.phase2.balances.get(command.actingAsOrganizationId) ?? 0;
    const fine = parseMoney(Math.min(currentBalance, ILLEGAL_ROUTE.fineOnDetection));
    debit(state, command.actingAsOrganizationId, fine, "crime_fine", command.commandId);
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "CrimeDetected", {
      heat: heat + ILLEGAL_ROUTE.heatOnAttempt,
      policePressure: state.phase2.crime.policePressure,
      fine,
    });
  }
  const benefit = parseMoney(Math.min(target, ILLEGAL_ROUTE.benefitOnSuccess));
  if (benefit > 0) {
    debit(state, command.payload.targetOrganizationId, benefit, "sabotage_loss", command.commandId);
  }
  credit(
    state,
    command.actingAsOrganizationId,
    benefit,
    "illegal_material_route",
    command.commandId,
  );
  state.phase2.crime.lastOutcome = "profitable";
  rememberProcessed(state, command.commandId);
  return productEvent(state, command.commandId, "CrimeProfitable", {
    benefit,
    heat: heat + ILLEGAL_ROUTE.heatOnAttempt,
  });
}

export function dispatchPlaceTestStructure(
  state: GameState,
  command: PlaceTestStructure,
): CommandResult {
  if (state.processedCommandIds.has(command.commandId)) {
    return { accepted: false, code: "DUPLICATE_COMMAND" };
  }
  if (!state.persons.has(command.issuedByPersonId)) {
    return { accepted: false, code: "PERSON_NOT_FOUND" };
  }
  if (!state.organizations.has(command.actingAsOrganizationId)) {
    return { accepted: false, code: "ORGANIZATION_NOT_FOUND" };
  }
  if (!hasOrganizationControl(state, command.issuedByPersonId, command.actingAsOrganizationId)) {
    return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
  }
  if (!inMap(state, command.payload.cell)) {
    return { accepted: false, code: "CELL_OUT_OF_BOUNDS" };
  }
  if (
    state.map.blockedCells.has(cellKey(command.payload.cell)) ||
    hasStructureAt(state, command.payload.cell)
  ) {
    return { accepted: false, code: "CELL_OCCUPIED" };
  }

  const structureCounter = state.idCounters.structure + 1;
  const eventCounter = state.idCounters.event + 1;
  const structureId = parseStructureId(nextEntityId("structure", structureCounter));
  const eventId = parseEventId(nextEntityId("event", eventCounter));
  const event: TestStructurePlaced = {
    eventId,
    tick: state.clock.tick,
    causationCommandId: command.commandId,
    type: "TestStructurePlaced",
    payload: {
      structureId,
      ownerOrganizationId: command.actingAsOrganizationId,
      cell: { ...command.payload.cell },
    },
  };

  state.idCounters.structure = structureCounter;
  state.idCounters.event = eventCounter;
  state.structures.set(structureId, {
    id: structureId,
    ownerOrganizationId: command.actingAsOrganizationId,
    cell: { ...command.payload.cell },
  });
  state.processedCommandIds.add(command.commandId);

  return { accepted: true, event };
}

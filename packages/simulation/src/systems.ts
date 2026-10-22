import { parseBuildingId, parseCommandId, parseTick, type BuildingType } from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  RIVAL_ORGANIZATION_ID,
  UPGRADE_RENT_BONUS_PERCENT,
} from "./game-data";
import type { GameState } from "./state";

function totalResources(inventory: { cement: number; brick: number; steel: number }): number {
  return inventory.cement + inventory.brick + inventory.steel;
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
}

function progressProduction(state: GameState): void {
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
    inventory[facility.output] += facility.outputAmount;
    facility.cycleProgress = 0;
  }
}

function progressConstruction(state: GameState): void {
  const sites = [...state.phase2.constructionSites.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const site of sites) {
    site.progress += site.crewCapacity;
    if (site.progress < site.workRequired) continue;
    if (site.upgradeBuildingId) {
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
  if (state.clock.tick === 0 || state.clock.tick % 12 !== 0) return;
  const rentModifier =
    state.phase2.ordinance.status === "active"
      ? 1 + state.phase2.ordinance.rentModifierPercent / 100
      : 1;
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!building.tenantId) continue;
    const tenant = state.phase2.tenants.get(building.tenantId);
    if (!tenant) continue;
    const amount = Math.max(
      0,
      Math.round(
        BUILDING_DEFINITIONS[building.type].baseRent *
          (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
          rentModifier,
      ),
    );
    recordRent(
      state,
      building.ownerOrganizationId,
      amount as import("@landlord/shared").Money,
      building.id,
    );
    tenant.leaseRemaining = Math.max(0, tenant.leaseRemaining - 1);
    building.condition = Math.max(0, building.condition - 1);
    if (tenant.leaseRemaining === 0 || building.condition < 20) {
      building.tenantId = null;
      tenant.activeContractBuildingId = null;
    }
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
  if (state.clock.tick > 0 && state.clock.tick % 16 === 0) {
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
  if (state.clock.tick === 0 || state.clock.tick % 8 !== 0) return;
  const rivalPersonId = "person_00000002" as import("@landlord/shared").PersonId;
  const commandId = parseCommandId(`ai-rival-${state.clock.tick}`);
  const vacantBuilding = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === RIVAL_ORGANIZATION_ID && building.tenantId === null,
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
  if (vacantBuilding && compatibleTenant) {
    dispatchProductCommand(state, {
      commandId,
      issuedByPersonId: rivalPersonId,
      actingAsOrganizationId: RIVAL_ORGANIZATION_ID,
      type: "AssignTenant",
      payload: { buildingId: vacantBuilding.id, tenantId: compatibleTenant.id },
    });
    return;
  }
  const ownedParcel = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID && !parcel.buildingId)
    .sort((a, b) => a.price - b.price)[0];
  if (
    ownedParcel &&
    ![...state.phase2.constructionSites.values()].some((site) => site.parcelId === ownedParcel.id)
  ) {
    const buildingType: BuildingType =
      ownedParcel.zoning === "industrial" ? "workshop" : "courtyard_home";
    dispatchProductCommand(state, {
      commandId,
      issuedByPersonId: rivalPersonId,
      actingAsOrganizationId: RIVAL_ORGANIZATION_ID,
      type: "StartConstruction",
      payload: { parcelId: ownedParcel.id, buildingType },
    });
    return;
  }
  const available = [...state.phase2.parcels.values()]
    .filter((parcel) => !parcel.ownerOrganizationId)
    .sort((a, b) => a.price - b.price)[0];
  if (available) {
    dispatchProductCommand(state, {
      commandId,
      issuedByPersonId: rivalPersonId,
      actingAsOrganizationId: RIVAL_ORGANIZATION_ID,
      type: "BuyParcel",
      payload: { parcelId: available.id },
    });
  }
}

export function advanceProductSystems(state: GameState): void {
  progressProduction(state);
  progressConstruction(state);
  collectRentAndAgeLeases(state);
  updatePolicyAndHeat(state);
  rivalAction(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

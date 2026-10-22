import type { ViewProjectionV1 } from "@landlord/shared";
import { parseTick } from "@landlord/shared";
import { type GameState } from "./state";
import {
  BUILDING_DEFINITIONS,
  ILLEGAL_ROUTE,
  PLAYER_CREW_CAPACITY,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
  UPGRADE_RENT_BONUS_PERCENT,
  UPGRADE_RESOURCES,
} from "./game-data";

export function createViewProjection(state: GameState, includeEconomy = false): ViewProjectionV1 {
  const playerInventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  return {
    projectionVersion: 1,
    tick: parseTick(state.clock.tick),
    map: { width: 64, height: 64 },
    structures: [...state.structures.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((structure) => ({
        id: structure.id,
        ownerOrganizationId: structure.ownerOrganizationId,
        cell: { ...structure.cell },
      })),
    agents: [...state.agents.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((agent) => ({ id: agent.id, cell: { ...agent.cell } })),
    ...(includeEconomy
      ? {
          economy: {
            district: { id: state.phase2.district.id, name: state.phase2.district.name },
            parcels: [...state.phase2.parcels.values()]
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((parcel) => ({
                id: parcel.id,
                cell: { ...parcel.cell },
                price: parcel.price,
                zoning: parcel.zoning,
                ownerOrganizationId: parcel.ownerOrganizationId,
                buildingId: parcel.buildingId,
              })),
            cash: state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0,
            inventory: { ...playerInventory },
            production: [...state.phase2.facilities.values()]
              .filter((facility) => facility.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
              .sort((left, right) => left.id.localeCompare(right.id))
              .map(({ output, cycleProgress, cycleLength, outputAmount, operational }) => ({
                output,
                cycleProgress,
                cycleLength,
                outputAmount,
                operational,
              })),
            crew: {
              capacity: PLAYER_CREW_CAPACITY,
              used: [...state.phase2.constructionSites.values()].filter(
                (site) => site.ownerOrganizationId === PLAYER_ORGANIZATION_ID,
              ).length,
            },
            influence: state.phase2.influenceByOrganizationId.get(PLAYER_ORGANIZATION_ID) ?? 0,
            constructionOptions: Object.values(BUILDING_DEFINITIONS).map((definition) => ({
              type: definition.type,
              name: definition.name,
              allowedZoning: [...definition.allowedZoning],
              cost: definition.cost,
              workRequired: definition.workRequired,
              capacity: definition.capacity,
              baseRent: definition.baseRent,
              resources: { ...definition.resources },
              upgradeCost: definition.upgradeCost,
              upgradeWorkRequired: definition.upgradeWorkRequired,
              upgradeResources: { ...UPGRADE_RESOURCES },
              upgradeRentBonusPercent: UPGRADE_RENT_BONUS_PERCENT,
            })),
            buildings: [...state.phase2.buildings.values()]
              .filter((building) => building.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((building) => ({
                ...building,
                effectiveRent: Math.round(
                  BUILDING_DEFINITIONS[building.type].baseRent *
                    (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
                    (state.phase2.ordinance.status === "active"
                      ? 1 + state.phase2.ordinance.rentModifierPercent / 100
                      : 1),
                ),
              })),
            constructionSites: [...state.phase2.constructionSites.values()]
              .filter((site) => site.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((site) => ({
                id: site.id,
                parcelId: site.parcelId,
                buildingType: site.buildingType,
                progress: site.progress,
                workRequired: site.workRequired,
                upgradeBuildingId: site.upgradeBuildingId,
              })),
            tenants: [...state.phase2.tenants.values()]
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((tenant) => ({
                id: tenant.id,
                profile: tenant.profile,
                preferredBuildingType: tenant.preferredBuildingType,
                activeContractBuildingId: tenant.activeContractBuildingId,
                leaseRemaining: tenant.leaseRemaining,
                budget: tenant.budget,
                satisfaction: tenant.satisfaction,
              })),
            ordinance: {
              id: state.phase2.ordinance.id,
              name: state.phase2.ordinance.name,
              status: state.phase2.ordinance.status,
              expiresAtTick: state.phase2.ordinance.expiresAtTick,
              materialCostModifierPercent: state.phase2.ordinance.materialCostModifierPercent,
              rentModifierPercent: state.phase2.ordinance.rentModifierPercent,
              influenceRequired: state.phase2.ordinance.influenceRequired,
            },
            illegalRoute: {
              detectionChancePercent: Math.min(
                100,
                ILLEGAL_ROUTE.baseDetectionChancePercent +
                  (state.phase2.crime.heatByOrganizationId[PLAYER_ORGANIZATION_ID] ?? 0) * 5 +
                  state.phase2.crime.policePressure * 3,
              ),
              benefitOnSuccess: ILLEGAL_ROUTE.benefitOnSuccess,
              heatOnAttempt: ILLEGAL_ROUTE.heatOnAttempt,
              fineOnDetection: ILLEGAL_ROUTE.fineOnDetection,
            },
            recentTransactions: state.phase2.transactions
              .filter((transaction) => transaction.organizationId === PLAYER_ORGANIZATION_ID)
              .slice(-6)
              .reverse()
              .map(({ tick, cause, amount, direction }) => ({ tick, cause, amount, direction })),
            rival: {
              cash: state.phase2.balances.get(RIVAL_ORGANIZATION_ID) ?? 0,
              parcels: [...state.phase2.parcels.values()].filter(
                (parcel) => parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID,
              ).length,
              buildings: [...state.phase2.buildings.values()].filter(
                (building) => building.ownerOrganizationId === RIVAL_ORGANIZATION_ID,
              ).length,
              occupiedBuildings: [...state.phase2.buildings.values()].filter(
                (building) =>
                  building.ownerOrganizationId === RIVAL_ORGANIZATION_ID && building.tenantId,
              ).length,
            },
            heat: state.phase2.crime.heatByOrganizationId[PLAYER_ORGANIZATION_ID] ?? 0,
            policePressure: state.phase2.crime.policePressure,
            lastCrimeOutcome: state.phase2.crime.lastOutcome,
            publicOpportunity: {
              policyId: state.phase2.ordinance.id,
              name: state.phase2.ordinance.name,
            },
          },
        }
      : {}),
  };
}

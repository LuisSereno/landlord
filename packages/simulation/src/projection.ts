import type { ViewProjectionV1 } from "@landlord/shared";
import { parseTick } from "@landlord/shared";
import { type GameState } from "./state";
import {
  BUILDING_DEFINITIONS,
  ILLEGAL_ROUTE,
  PLAYER_CREW_CAPACITY,
  PLAYER_ORGANIZATION_ID,
  BANK_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
  UPGRADE_RENT_BONUS_PERCENT,
  UPGRADE_RESOURCES,
  GAME_DAY_TICKS,
  GAME_HOUR_TICKS,
  GAME_MONTH_TICKS,
  MARKET_PRICES,
  REPAIR_COST,
  REPAIR_WORK_REQUIRED,
  calculateLoanPayment,
  calculateTax,
  effectiveTaxRateBps,
  MUNICIPALITY_ORGANIZATION_ID,
  MAINTENANCE_POLICY,
  conditionAssetValueMultiplierPercent,
  conditionRentMultiplierPercent,
} from "./game-data";

function currentPropertyTaxRateBps(state: GameState): number {
  return effectiveTaxRateBps(
    state.phase2.taxation.propertyRateBps,
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.propertyTaxModifierPercent
      : 0,
  );
}

function projectedMonthlyPropertyTax(
  state: GameState,
  rateBps = currentPropertyTaxRateBps(state),
): number {
  return [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
    .reduce((total, parcel) => total + calculateTax(parcel.price, rateBps), 0);
}

function createFinancialSummary(
  state: GameState,
  cash: number,
  playerInventory: { cement: number; brick: number; steel: number },
): NonNullable<NonNullable<ViewProjectionV1["economy"]>["financials"]> {
  const periodStartTick = Math.floor(state.clock.tick / GAME_MONTH_TICKS) * GAME_MONTH_TICKS;
  let periodIncome = 0;
  let periodExpenses = 0;
  for (const transaction of state.phase2.transactions) {
    if (transaction.organizationId !== PLAYER_ORGANIZATION_ID || transaction.tick < periodStartTick)
      continue;
    if (transaction.direction === "credit" && transaction.cause !== "loan_disbursement")
      periodIncome += transaction.amount;
    else periodExpenses += transaction.amount;
  }

  const inventoryValue =
    playerInventory.cement * MARKET_PRICES.cement +
    playerInventory.brick * MARKET_PRICES.brick +
    playerInventory.steel * MARKET_PRICES.steel;
  const parcelValue = [...state.phase2.parcels.values()]
    .filter((parcel) => parcel.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
    .reduce((total, parcel) => total + parcel.price, 0);
  const buildingValue = [...state.phase2.buildings.values()]
    .filter((building) => building.ownerOrganizationId === PLAYER_ORGANIZATION_ID)
    .reduce(
      (total, building) =>
        total +
        Math.round(
          (BUILDING_DEFINITIONS[building.type].cost *
            conditionAssetValueMultiplierPercent(building.condition)) /
            100,
        ),
      0,
    );
  const assets = cash + inventoryValue + parcelValue + buildingValue;
  const liabilities = [...state.phase2.loans.values()]
    .filter(
      (loan) =>
        loan.borrowerOrganizationId === PLAYER_ORGANIZATION_ID &&
        ["active", "delinquent", "defaulted"].includes(loan.status),
    )
    .reduce((total, loan) => total + loan.outstandingPrincipal, 0);
  const equity = assets - liabilities;

  const forecastIncome = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === PLAYER_ORGANIZATION_ID &&
        building.state !== "ruin" &&
        building.tenantIds.length > 0,
    )
    .reduce((total, building) => {
      const rentModifier =
        state.phase2.ordinance.status === "active"
          ? 1 + state.phase2.ordinance.rentModifierPercent / 100
          : 1;
      const rent = Math.max(
        0,
        Math.round(
          BUILDING_DEFINITIONS[building.type].baseRent *
            (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
            rentModifier,
        ),
      );
      return total + rent * building.tenantIds.length;
    }, 0);
  const forecastExpenses = [...state.phase2.facilities.values()]
    .filter(
      (facility) => facility.ownerOrganizationId === PLAYER_ORGANIZATION_ID && facility.operational,
    )
    .reduce((total, facility) => {
      const building = facility.buildingId
        ? state.phase2.buildings.get(facility.buildingId)
        : undefined;
      if (building && (building.state !== "operational" || building.condition <= 0)) return total;
      const monthlyCycles = Math.ceil(GAME_MONTH_TICKS / GAME_HOUR_TICKS / facility.cycleLength);
      return total + facility.operatingCost * monthlyCycles;
    }, 0);
  const loanExpenses = [...state.phase2.loans.values()]
    .filter(
      (loan) =>
        loan.borrowerOrganizationId === PLAYER_ORGANIZATION_ID &&
        ["active", "delinquent"].includes(loan.status),
    )
    .reduce((total, loan) => total + calculateLoanPayment(loan).total, 0);
  const propertyTaxRateBps = currentPropertyTaxRateBps(state);
  const propertyTaxExpense = projectedMonthlyPropertyTax(state, propertyTaxRateBps);
  const maintenanceExpense =
    state.phase2.maintenance.policy === "balanced"
      ? [...state.phase2.buildings.values()]
          .filter(
            (building) =>
              building.ownerOrganizationId === PLAYER_ORGANIZATION_ID && building.state !== "ruin",
          )
          .reduce(
            (total, building) =>
              total +
              MAINTENANCE_POLICY.costsByBuildingType[building.type] +
              (state.phase2.maintenance.backlogByBuildingId[building.id] ?? 0),
            0,
          )
      : 0;
  const totalForecastExpenses =
    forecastExpenses + loanExpenses + propertyTaxExpense + maintenanceExpense;
  const netIncome = periodIncome - periodExpenses;
  const netCashFlow = forecastIncome - totalForecastExpenses;
  const projectedCash = cash + netCashFlow;

  return {
    assets,
    liabilities,
    equity,
    period: {
      month: Math.floor(state.clock.tick / GAME_MONTH_TICKS) + 1,
      income: periodIncome,
      expenses: periodExpenses,
      netIncome,
      cashFlow: netIncome,
    },
    forecast: {
      income: forecastIncome,
      expenses: totalForecastExpenses,
      netCashFlow,
      closingCash: Math.max(0, projectedCash),
      shortfall: Math.max(0, -projectedCash),
    },
  };
}

export function createViewProjection(state: GameState, includeEconomy = false): ViewProjectionV1 {
  const playerInventory = state.phase2.inventories.get(PLAYER_ORGANIZATION_ID)!;
  const propertyTaxRateBps = currentPropertyTaxRateBps(state);
  const propertyTaxExpense = projectedMonthlyPropertyTax(state, propertyTaxRateBps);
  const maintenanceExpense =
    state.phase2.maintenance.policy === "balanced"
      ? [...state.phase2.buildings.values()]
          .filter(
            (building) =>
              building.ownerOrganizationId === PLAYER_ORGANIZATION_ID && building.state !== "ruin",
          )
          .reduce(
            (total, building) =>
              total +
              MAINTENANCE_POLICY.costsByBuildingType[building.type] +
              (state.phase2.maintenance.backlogByBuildingId[building.id] ?? 0),
            0,
          )
      : 0;
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
      .map((agent) => ({
        id: agent.id,
        cell: { ...agent.cell },
        ...(agent.organizationId ? { organizationId: agent.organizationId } : {}),
        ...(agent.specialty ? { specialty: agent.specialty } : {}),
        health: agent.health ?? 100,
        state: agent.state ?? "idle",
      })),
    ...(includeEconomy
      ? {
          economy: {
            gameTime: {
              month: Math.floor(state.clock.tick / GAME_MONTH_TICKS) + 1,
              day: Math.floor((state.clock.tick % GAME_MONTH_TICKS) / GAME_DAY_TICKS) + 1,
              hour: Math.floor((state.clock.tick % GAME_DAY_TICKS) / GAME_HOUR_TICKS),
              ticksPerMonth: GAME_MONTH_TICKS,
            },
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
                productionSuitability: {
                  cement: parcel.productionSuitability?.cement ?? 100,
                  brick: parcel.productionSuitability?.brick ?? 100,
                  steel: parcel.productionSuitability?.steel ?? 100,
                },
                estimatedTransferTax: calculateTax(
                  parcel.price,
                  effectiveTaxRateBps(
                    state.phase2.taxation.transferRateBps,
                    state.phase2.ordinance.status === "active"
                      ? state.phase2.ordinance.transferTaxModifierPercent
                      : 0,
                  ),
                ),
                estimatedMonthlyPropertyTax: calculateTax(parcel.price, propertyTaxRateBps),
              })),
            cash: state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0,
            financials: createFinancialSummary(
              state,
              state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0,
              playerInventory,
            ),
            banking: {
              bankOrganizationId: BANK_ORGANIZATION_ID,
              offers: [...state.phase2.loans.values()]
                .filter(
                  (loan) =>
                    loan.borrowerOrganizationId === PLAYER_ORGANIZATION_ID &&
                    loan.status === "offered",
                )
                .map((loan) => ({
                  id: loan.id,
                  principal: loan.principal,
                  annualInterestRateBps: loan.annualInterestRateBps,
                  termMonths: loan.termMonths,
                  collateralParcelId: loan.collateralParcelId,
                })),
              loans: [...state.phase2.loans.values()]
                .filter((loan) => loan.borrowerOrganizationId === PLAYER_ORGANIZATION_ID)
                .map((loan) => ({
                  id: loan.id,
                  status: loan.status as "active" | "delinquent" | "paid_off" | "defaulted",
                  outstandingPrincipal: loan.outstandingPrincipal,
                  monthlyPayment: loan.status === "paid_off" ? 0 : calculateLoanPayment(loan).total,
                  remainingMonths: loan.remainingMonths,
                  missedPayments: loan.missedPayments,
                  collateralParcelId: loan.collateralParcelId,
                  nextPaymentTick: loan.nextPaymentTick,
                })),
            },
            taxation: {
              beneficiaryOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
              propertyRateBps: propertyTaxRateBps,
              transferRateBps: effectiveTaxRateBps(
                state.phase2.taxation.transferRateBps,
                state.phase2.ordinance.status === "active"
                  ? state.phase2.ordinance.transferTaxModifierPercent
                  : 0,
              ),
              nextSettlementTick: state.phase2.taxation.nextSettlementTick,
              lastSettlementTick: state.phase2.taxation.lastSettlementTick,
              totalCollected: state.phase2.taxation.totalCollected,
              playerArrears:
                state.phase2.taxation.arrearsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? 0,
              projectedMonthlyPropertyTax: propertyTaxExpense,
            },
            inventory: { ...playerInventory },
            production: [...state.phase2.facilities.values()]
              .filter(
                (facility) =>
                  facility.ownerOrganizationId === PLAYER_ORGANIZATION_ID &&
                  facility.kind === "physical",
              )
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((facility) => {
                const building = facility.buildingId
                  ? state.phase2.buildings.get(facility.buildingId)
                  : undefined;
                const conditionPercent = building?.condition ?? facility.conditionPercent;
                const numerator =
                  facility.outputAmount *
                  facility.suitabilityPercent *
                  conditionPercent *
                  facility.upgradePercent;
                return {
                  output: facility.output,
                  cycleProgress: facility.cycleProgress,
                  cycleLength: facility.cycleLength,
                  baseOutputAmount: facility.outputAmount,
                  averageOutputAmount: numerator / 1_000_000,
                  nextCycleOutputAmount: Math.floor((numerator + facility.remainder) / 1_000_000),
                  operational: facility.operational,
                  investmentCost: facility.investmentCost,
                  operatingCost: facility.operatingCost,
                  buildingId: facility.buildingId,
                  suitabilityPercent: facility.suitabilityPercent,
                  conditionPercent,
                  upgradePercent: facility.upgradePercent,
                  remainder: facility.remainder,
                };
              }),
            crew: {
              capacity: PLAYER_CREW_CAPACITY,
              used: [...state.phase2.constructionSites.values()].reduce(
                (total, site) =>
                  total +
                  (site.ownerOrganizationId === PLAYER_ORGANIZATION_ID
                    ? site.assignedCrewIds.length
                    : 0),
                0,
              ),
            },
            crews: [...state.phase2.crews.values()]
              .filter((crew) => crew.organizationId === PLAYER_ORGANIZATION_ID)
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((crew) => ({
                ...crew,
                workerAgentIds: [...crew.workerAgentIds],
                assignedWorkOrderId:
                  [...state.phase2.constructionSites.values()].find((site) =>
                    site.assignedCrewIds.includes(crew.id),
                  )?.id ?? null,
              })),
            influence: state.phase2.influenceByOrganizationId.get(PLAYER_ORGANIZATION_ID) ?? 0,
            constructionOptions: Object.values(BUILDING_DEFINITIONS).map((definition) => ({
              type: definition.type,
              name: definition.name,
              allowedZoning: [...definition.allowedZoning],
              cost: Math.round(
                definition.cost *
                  (state.phase2.ordinance.status === "active"
                    ? 1 + state.phase2.ordinance.materialCostModifierPercent / 100
                    : 1),
              ),
              baseCost: definition.cost,
              workRequired: definition.workRequired,
              capacity: definition.capacity,
              baseRent: definition.baseRent,
              resources: { ...definition.resources },
              upgradeCost: definition.upgradeCost,
              upgradeWorkRequired: definition.upgradeWorkRequired,
              upgradeResources: { ...UPGRADE_RESOURCES },
              upgradeRentBonusPercent: UPGRADE_RENT_BONUS_PERCENT,
              production: definition.production ? { ...definition.production } : null,
            })),
            buildings: [...state.phase2.buildings.values()]
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((building) => ({
                ...building,
                productionFacilityId: building.productionFacilityId ?? null,
                tenantIds:
                  building.ownerOrganizationId === PLAYER_ORGANIZATION_ID
                    ? [...building.tenantIds]
                    : [],
                tenantId:
                  building.ownerOrganizationId === PLAYER_ORGANIZATION_ID
                    ? building.tenantId
                    : null,
                capacity: BUILDING_DEFINITIONS[building.type].capacity,
                structuralIntegrity: building.structuralIntegrity,
                state: building.state,
                casualtiesTotal: { ...building.casualtiesTotal },
                effectiveRent:
                  building.ownerOrganizationId === PLAYER_ORGANIZATION_ID
                    ? Math.round(
                        BUILDING_DEFINITIONS[building.type].baseRent *
                          (building.upgraded ? 1 + UPGRADE_RENT_BONUS_PERCENT / 100 : 1) *
                          (state.phase2.ordinance.status === "active"
                            ? 1 + state.phase2.ordinance.rentModifierPercent / 100
                            : 1) *
                          (conditionRentMultiplierPercent(building.condition) / 100),
                      )
                    : 0,
                maintenanceCost: MAINTENANCE_POLICY.costsByBuildingType[building.type],
                maintenanceDue:
                  MAINTENANCE_POLICY.costsByBuildingType[building.type] +
                  (state.phase2.maintenance.backlogByBuildingId[building.id] ?? 0),
              })),
            constructionSites: [...state.phase2.constructionSites.values()]
              .sort((left, right) => left.id.localeCompare(right.id))
              .map((site) => ({
                id: site.id,
                parcelId: site.parcelId,
                ownerOrganizationId: site.ownerOrganizationId,
                buildingType: site.buildingType,
                progress: site.progress,
                workRequired: site.workRequired,
                upgradeBuildingId: site.upgradeBuildingId,
                repairBuildingId: site.repairBuildingId,
                crewCapacity: site.crewCapacity,
                kind: site.kind,
                assignedCrewIds: [...site.assignedCrewIds],
                assignedTechnicianId: site.assignedTechnicianId,
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
                status: tenant.status,
              })),
            ordinance: {
              id: state.phase2.ordinance.id,
              name: state.phase2.ordinance.name,
              status: state.phase2.ordinance.status,
              expiresAtTick: state.phase2.ordinance.expiresAtTick,
              materialCostModifierPercent: state.phase2.ordinance.materialCostModifierPercent,
              rentModifierPercent: state.phase2.ordinance.rentModifierPercent,
              influenceRequired: state.phase2.ordinance.influenceRequired,
              approvalChancePercent: state.phase2.ordinance.approvalChancePercent,
              propertyTaxModifierPercent: state.phase2.ordinance.propertyTaxModifierPercent,
              transferTaxModifierPercent: state.phase2.ordinance.transferTaxModifierPercent,
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
              cooldownRemainingTicks: Math.max(
                0,
                (state.phase2.crime.nextAvailableTickByOrganizationId[PLAYER_ORGANIZATION_ID] ??
                  0) - state.clock.tick,
              ),
            },
            market: { prices: { ...MARKET_PRICES } },
            maintenance: {
              policy: state.phase2.maintenance.policy,
              nextSettlementTick: state.phase2.maintenance.nextSettlementTick,
              lastSettlementTick: state.phase2.maintenance.lastSettlementTick,
              monthlyCost: maintenanceExpense,
              backlog: Object.entries(state.phase2.maintenance.backlogByBuildingId).reduce(
                (total, [buildingId, amount]) =>
                  state.phase2.buildings.get(buildingId as import("@landlord/shared").BuildingId)
                    ?.ownerOrganizationId === PLAYER_ORGANIZATION_ID
                    ? total + amount
                    : total,
                0,
              ),
              repairCost: REPAIR_COST,
              repairWorkRequired: REPAIR_WORK_REQUIRED,
            },
            recentTransactions: state.phase2.transactions
              .filter((transaction) => transaction.organizationId === PLAYER_ORGANIZATION_ID)
              .slice(-6)
              .reverse()
              .map(({ tick, cause, amount, direction }) => ({ tick, cause, amount, direction })),
            incidents: [...state.phase2.incidents.values()]
              .sort((a, b) => b.createdAtTick - a.createdAtTick || a.id.localeCompare(b.id))
              .slice(0, 20)
              .map((incident) => ({
                id: incident.id,
                buildingId: incident.buildingId,
                origin: incident.origin,
                intensity: incident.intensity,
                status: incident.status,
                casualties: { ...incident.casualties },
                createdAtTick: incident.createdAtTick,
              })),
            rival: {
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
              lastAction: state.phase2.rivalAi.lastAction,
              lastReason: state.phase2.rivalAi.lastReason,
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

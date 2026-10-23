import {
  parseBuildingId,
  parseFacilityId,
  parseCommandId,
  parseMoney,
  parseTick,
  parseIncidentId,
  type BuildingType,
} from "@landlord/shared";
import { credit, debit, dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  RIVAL_ORGANIZATION_ID,
  UPGRADE_RENT_BONUS_PERCENT,
  GAME_DAY_TICKS,
  GAME_HOUR_TICKS,
  GAME_MONTH_TICKS,
  UPGRADE_RESOURCES,
  BANK_ORGANIZATION_ID,
  LOAN_POLICY,
  calculateLoanPayment,
  calculateTax,
  effectiveTaxRateBps,
  MUNICIPALITY_ORGANIZATION_ID,
  TAX_POLICY,
  MAINTENANCE_POLICY,
  conditionRentMultiplierPercent,
  deteriorationRiskPercent,
  INSURANCE_POLICY,
  INSOLVENCY_POLICY,
  RIVAL_AI_POLICY,
  calculateInsuranceOffer,
  REPAIR_COST,
} from "./game-data";
import type { GameState } from "./state";
import { Xoshiro128ss } from "./prng";
import { findDeterministicPath } from "./navigation";

const MOVEMENT_TICKS_PER_CELL = 10;
const INCIDENT_LIMIT = 50;
const PRODUCTION_SCALE = 1_000_000;
const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
function hurtAgent(
  state: GameState,
  agent: import("@landlord/shared").Agent,
  damage: number,
): void {
  agent.health = Math.max(0, (agent.health ?? 100) - damage);
  if (agent.health === 0) {
    agent.state = "dead";
    agent.task = null;
    return;
  }
  if (agent.health < 100) {
    agent.state = "injured";
    agent.injuredUntilTick = parseTick(state.clock.tick + GAME_DAY_TICKS * 2);
    agent.task = null;
  }
}
function ignite(
  state: GameState,
  building: import("@landlord/shared").Building,
  origin: "sabotage" | "deterioration" | "blast",
  intensity: number,
  agentId: import("@landlord/shared").AgentId | null = null,
): void {
  if (building.state !== "operational") return;
  building.state = "burning";
  state.phase2.idCounters.incident += 1;
  const id = parseIncidentId(
    `incident_${String(state.phase2.idCounters.incident).padStart(8, "0")}`,
  );
  const incident = {
    id,
    buildingId: building.id,
    origin,
    intensity,
    status: "active",
    targetOrganizationId: building.ownerOrganizationId,
    createdAtTick: state.clock.tick,
    causedByAgentId: agentId,
    causedByOrganizationId: agentId ? (state.agents.get(agentId)?.organizationId ?? null) : null,
    casualties: { injured: 0, dead: 0 },
  } satisfies import("@landlord/shared").IncidentRecord;
  state.phase2.incidents.set(id, incident);
  processInsuranceClaim(state, incident);
  while (state.phase2.incidents.size > INCIDENT_LIMIT) {
    const resolved = [...state.phase2.incidents.values()]
      .filter((incident) => incident.status === "resolved")
      .sort((a, b) => a.createdAtTick - b.createdAtTick || a.id.localeCompare(b.id))[0];
    if (!resolved) break;
    state.phase2.incidents.delete(resolved.id);
  }
}

function processInsuranceClaim(
  state: GameState,
  incident: import("@landlord/shared").IncidentRecord,
): void {
  const building = state.phase2.buildings.get(incident.buildingId);
  if (!building) return;
  const contract = state.phase2.insurance.contractsByBuildingId[building.id];
  const lossEstimate = parseMoney(
    Math.ceil((BUILDING_DEFINITIONS[building.type].cost * incident.intensity) / 100),
  );
  const excluded =
    !contract || contract.status !== "active" || contract.exclusions.includes(incident.origin);
  if (excluded) {
    state.phase2.insurance.claimsByIncidentId[incident.id] = {
      incidentId: incident.id,
      buildingId: building.id,
      coverage: contract?.coverage ?? null,
      status: "excluded",
      lossEstimate,
      payout: parseMoney(0),
      createdAtTick: parseTick(state.clock.tick),
      processedAtTick: parseTick(state.clock.tick),
    };
    return;
  }
  const payout = parseMoney(
    Math.min(contract.coverageLimit, Math.max(0, lossEstimate - contract.deductible)),
  );
  const paid =
    payout === 0 ||
    debit(state, contract.insurerOrganizationId, payout, "insurance_claim", incident.id);
  if (paid && payout > 0)
    credit(state, building.ownerOrganizationId, payout, "insurance_claim", incident.id);
  state.phase2.insurance.claimsByIncidentId[incident.id] = {
    incidentId: incident.id,
    buildingId: building.id,
    coverage: contract.coverage,
    status: paid ? "paid" : "unpaid",
    lossEstimate,
    payout: paid ? payout : parseMoney(0),
    createdAtTick: parseTick(state.clock.tick),
    processedAtTick: parseTick(state.clock.tick),
  };
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
    if (facility.kind === "physical" && facility.buildingId) {
      const building = state.phase2.buildings.get(facility.buildingId);
      if (!building || building.state !== "operational" || building.condition <= 0) continue;
      facility.conditionPercent = building.condition;
    }
    facility.cycleProgress += 1;
    if (facility.cycleProgress < facility.cycleLength) continue;
    const inventory = state.phase2.inventories.get(facility.ownerOrganizationId);
    const productivityNumerator =
      facility.outputAmount *
      facility.suitabilityPercent *
      facility.conditionPercent *
      facility.upgradePercent;
    const numerator = productivityNumerator + facility.remainder;
    const outputAmount = Math.floor(numerator / PRODUCTION_SCALE);
    const nextRemainder = numerator % PRODUCTION_SCALE;
    if (!inventory || totalResources(inventory) + outputAmount > inventory.capacity) {
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
    inventory[facility.output] += outputAmount;
    facility.remainder = nextRemainder;
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
          const members = [crew.supervisorAgentId, ...crew.workerAgentIds].map((id) =>
            state.agents.get(id),
          );
          const supervisor = members[0];
          const workers = members.slice(1).filter((worker) => {
            return worker?.state === "working";
          }).length;
          return (
            total + (supervisor?.state === "working" && workers > 0 ? (workers === 2 ? 2 : 1) : 0)
          );
        }, 0)
      : 0;
    site.progress += assignedWork;
    if (site.progress < site.workRequired) continue;
    if (site.kind === "clear_ruin" && site.targetBuildingId) {
      const ruin = state.phase2.buildings.get(site.targetBuildingId);
      if (ruin) {
        const parcel = state.phase2.parcels.get(ruin.parcelId);
        if (parcel) parcel.buildingId = null;
        if (ruin.productionFacilityId) {
          state.phase2.facilities.delete(ruin.productionFacilityId);
        }
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
        if (building.productionFacilityId) {
          const facility = state.phase2.facilities.get(building.productionFacilityId);
          if (facility) facility.upgradePercent = 125;
        }
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
        productionFacilityId: null,
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
      const production = BUILDING_DEFINITIONS[building.type].production;
      if (production) {
        state.phase2.idCounters.facility += 1;
        const facilityId = parseFacilityId(
          `facility_${String(state.phase2.idCounters.facility).padStart(8, "0")}`,
        );
        const suitabilityPercent = parcel?.productionSuitability?.[production.output] ?? 100;
        state.phase2.facilities.set(facilityId, {
          id: facilityId,
          ownerOrganizationId: site.ownerOrganizationId,
          operational: true,
          cycleProgress: 0,
          cycleLength: production.cycleLength,
          output: production.output,
          outputAmount: production.outputAmount,
          investmentCost: parseMoney(0),
          operatingCost: production.operatingCost,
          kind: "physical",
          buildingId,
          suitabilityPercent,
          conditionPercent: 100,
          upgradePercent: 100,
          remainder: 0,
        });
        building.productionFacilityId = facilityId;
      }
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
          rentModifier *
          (conditionRentMultiplierPercent(building.condition) / 100),
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
  }
}

function processLoanPayments(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  for (const loan of [...state.phase2.loans.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      !["active", "delinquent"].includes(loan.status) ||
      loan.nextPaymentTick !== state.clock.tick
    )
      continue;
    const payment = calculateLoanPayment(loan);
    const paid = debit(
      state,
      loan.borrowerOrganizationId,
      payment.total as import("@landlord/shared").Money,
      "loan_payment",
      loan.id,
    );
    if (!paid) {
      loan.missedPayments += 1;
      loan.status =
        loan.missedPayments > LOAN_POLICY.delinquencyGracePayments ? "defaulted" : "delinquent";
      loan.nextPaymentTick =
        loan.status === "defaulted" ? null : parseTick(state.clock.tick + GAME_MONTH_TICKS);
      if (loan.status === "defaulted") openAuctionForLoan(state, loan);
      continue;
    }
    credit(
      state,
      BANK_ORGANIZATION_ID,
      payment.total as import("@landlord/shared").Money,
      "loan_payment",
      loan.id,
    );
    loan.outstandingPrincipal = parseMoney(loan.outstandingPrincipal - payment.principal);
    loan.remainingMonths = Math.max(0, loan.remainingMonths - 1);
    loan.missedPayments = 0;
    loan.status = loan.outstandingPrincipal === 0 ? "paid_off" : "active";
    loan.nextPaymentTick =
      loan.status === "paid_off" ? null : parseTick(state.clock.tick + GAME_MONTH_TICKS);
  }
}

function collateralValue(state: GameState, loan: import("@landlord/shared").Loan): number {
  const parcel = state.phase2.parcels.get(loan.collateralParcelId);
  if (!parcel) return 0;
  const building = parcel.buildingId ? state.phase2.buildings.get(parcel.buildingId) : undefined;
  return (
    parcel.price +
    (building
      ? Math.round((BUILDING_DEFINITIONS[building.type].cost * building.condition) / 100)
      : 0)
  );
}

function openAuctionForLoan(state: GameState, loan: import("@landlord/shared").Loan): void {
  if (state.phase2.insolvency.auctionsByLoanId[loan.id]) return;
  const parcel = state.phase2.parcels.get(loan.collateralParcelId);
  if (!parcel) return;
  state.phase2.insolvency.auctionsByLoanId[loan.id] = {
    loanId: loan.id,
    collateralParcelId: parcel.id,
    sellerOrganizationId: loan.borrowerOrganizationId,
    reservePrice: parseMoney(
      Math.floor(
        (collateralValue(state, loan) * INSOLVENCY_POLICY.reservePricePercentOfCollateral) / 100,
      ),
    ),
    highestBid: parseMoney(0),
    highestBidderOrganizationId: null,
    reservedFundsByOrganizationId: {},
    status: "open",
    openedAtTick: parseTick(state.clock.tick),
    closesAtTick: parseTick(state.clock.tick + INSOLVENCY_POLICY.auctionDurationTicks),
  };
}

function settleAuctions(state: GameState): void {
  for (const auction of Object.values(state.phase2.insolvency.auctionsByLoanId).sort((a, b) =>
    a.loanId.localeCompare(b.loanId),
  )) {
    if (auction.status !== "open" || auction.closesAtTick > state.clock.tick) continue;
    const winner = auction.highestBidderOrganizationId;
    const loan = state.phase2.loans.get(auction.loanId);
    const parcel = state.phase2.parcels.get(auction.collateralParcelId);
    if (!winner || !loan || !parcel) {
      auction.status = "closed";
      auction.reservedFundsByOrganizationId = {};
      continue;
    }
    if (!debit(state, winner, auction.highestBid, "auction_purchase", auction.loanId)) {
      auction.status = "closed";
      auction.highestBidderOrganizationId = null;
      auction.highestBid = parseMoney(0);
      auction.reservedFundsByOrganizationId = {};
      continue;
    }
    credit(
      state,
      loan.lenderOrganizationId,
      auction.highestBid,
      "auction_recovery",
      auction.loanId,
    );
    const shortfall = Math.max(0, loan.outstandingPrincipal - auction.highestBid);
    if (auction.sellerOrganizationId === RIVAL_ORGANIZATION_ID && shortfall > 0) {
      state.phase2.rivalAi.memory.lossCount += 1;
      state.phase2.rivalAi.memory.lastLossAmount = parseMoney(shortfall);
    }
    parcel.ownerOrganizationId = winner;
    if (parcel.buildingId) {
      const building = state.phase2.buildings.get(parcel.buildingId);
      if (building) building.ownerOrganizationId = winner;
    }
    loan.outstandingPrincipal = parseMoney(0);
    loan.nextPaymentTick = null;
    auction.status = "executed";
    auction.reservedFundsByOrganizationId = {};
  }
}

function settlePropertyTaxes(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick !== state.phase2.taxation.nextSettlementTick)
    return;
  const owners = new Map<import("@landlord/shared").OrganizationId, number>();
  for (const parcel of [...state.phase2.parcels.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (!parcel.ownerOrganizationId) continue;
    owners.set(
      parcel.ownerOrganizationId,
      (owners.get(parcel.ownerOrganizationId) ?? 0) + parcel.price,
    );
  }
  const propertyRateBps = effectiveTaxRateBps(
    state.phase2.taxation.propertyRateBps,
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.propertyTaxModifierPercent
      : 0,
  );
  for (const [organizationId, taxableBase] of [...owners.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (new Set(state.phase2.taxation.exemptOrganizationIds).has(organizationId)) continue;
    const currentTax = calculateTax(taxableBase, propertyRateBps);
    const arrears = state.phase2.taxation.arrearsByOrganizationId[organizationId] ?? 0;
    const due = parseMoney(currentTax + arrears);
    if (due === 0) continue;
    if (debit(state, organizationId, due, "property_tax", `month-${state.clock.tick}`)) {
      credit(state, MUNICIPALITY_ORGANIZATION_ID, due, "property_tax", `month-${state.clock.tick}`);
      state.phase2.taxation.totalCollected = parseMoney(state.phase2.taxation.totalCollected + due);
      delete state.phase2.taxation.arrearsByOrganizationId[organizationId];
    } else {
      state.phase2.taxation.arrearsByOrganizationId[organizationId] = due;
    }
  }
  state.phase2.taxation.lastSettlementTick = parseTick(state.clock.tick);
  state.phase2.taxation.nextSettlementTick = parseTick(
    state.clock.tick + TAX_POLICY.settlementPeriodTicks,
  );
}

function settleMaintenance(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick !== state.phase2.maintenance.nextSettlementTick)
    return;
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (building.state === "ruin") continue;
    building.condition = Math.max(0, building.condition - MAINTENANCE_POLICY.wearPerSettlement);
    const currentCost = MAINTENANCE_POLICY.costsByBuildingType[building.type];
    const backlog = state.phase2.maintenance.backlogByBuildingId[building.id] ?? 0;
    const due = parseMoney(backlog + currentCost);
    if (state.phase2.maintenance.policy === "balanced") {
      if (debit(state, building.ownerOrganizationId, due, "maintenance_service", building.id)) {
        building.condition = Math.min(
          100,
          building.condition + MAINTENANCE_POLICY.recoveryPerSettlement,
        );
        delete state.phase2.maintenance.backlogByBuildingId[building.id];
      } else {
        state.phase2.maintenance.backlogByBuildingId[building.id] = due;
      }
    } else {
      state.phase2.maintenance.backlogByBuildingId[building.id] = due;
    }
  }
  state.phase2.maintenance.lastSettlementTick = parseTick(state.clock.tick);
  state.phase2.maintenance.nextSettlementTick = parseTick(
    state.clock.tick + MAINTENANCE_POLICY.settlementPeriodTicks,
  );
}

function settleInsurance(state: GameState): void {
  if (state.clock.tick === 0) return;
  for (const contract of Object.values(state.phase2.insurance.contractsByBuildingId).sort((a, b) =>
    a.buildingId.localeCompare(b.buildingId),
  )) {
    if (contract.status !== "active" || contract.nextPremiumTick !== state.clock.tick) continue;
    const building = state.phase2.buildings.get(contract.buildingId);
    if (!building || building.state === "ruin") {
      contract.status = "lapsed";
      contract.nextPremiumTick = null;
      continue;
    }
    if (
      debit(
        state,
        building.ownerOrganizationId,
        contract.premium,
        "insurance_premium",
        contract.buildingId,
      )
    ) {
      credit(
        state,
        contract.insurerOrganizationId,
        contract.premium,
        "insurance_premium",
        contract.buildingId,
      );
      contract.lastPremiumTick = parseTick(state.clock.tick);
      contract.nextPremiumTick = parseTick(
        state.clock.tick + INSURANCE_POLICY.settlementPeriodTicks,
      );
      contract.totalPremiumPaid = parseMoney(contract.totalPremiumPaid + contract.premium);
    } else {
      contract.status = "lapsed";
      contract.nextPremiumTick = null;
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
  if (state.clock.tick % MOVEMENT_TICKS_PER_CELL === 0)
    for (const agent of agents) {
      if (agent.state === "dead" || agent.state === "injured" || !agent.task) continue;
      if (agent.task.kind === "attack_agent") {
        const target = state.agents.get(agent.task.targetAgentId);
        if (
          target &&
          (agent.lastPathRecalculationTick === undefined ||
            state.clock.tick - agent.lastPathRecalculationTick >= 20 ||
            agent.path?.length === 0)
        ) {
          agent.target = { ...target.cell };
          agent.path = findDeterministicPath(agent.cell, agent.target, state.map.blockedCells);
          agent.lastPathRecalculationTick = state.clock.tick;
        }
      }
      if (!agent.path?.length && agent.target && !adjacent(agent.cell, agent.target))
        agent.path = findDeterministicPath(agent.cell, agent.target, state.map.blockedCells);
      const next = agent.path?.shift();
      if (next) agent.cell = next;
      if (agent.target && adjacent(agent.cell, agent.target)) agent.state = "working";
    }
  // Stage 2-3: arrival activates work, then physical crews contribute before hostile actions.
  progressConstruction(state);
  if (state.clock.tick === 0 || state.clock.tick % GAME_HOUR_TICKS !== 0) return;
  if (state.clock.tick % GAME_MONTH_TICKS === 0) {
    const prng = new Xoshiro128ss(state.seed);
    prng.restoreState(state.prng);
    for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const hasIncident = [...state.phase2.incidents.values()].some(
        (incident) => incident.buildingId === building.id && incident.status === "active",
      );
      const risk = deteriorationRiskPercent(building.condition);
      if (building.state !== "operational" || hasIncident || risk === 0) continue;
      if (prng.nextInt(0, 100) < risk) ignite(state, building, "deterioration", 40);
    }
    state.prng = prng.exportState();
  }
  // 3. Technician suppression and repair.
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const technician = agents.find(
      (agent) =>
        agent.task?.kind === "maintenance" &&
        agent.task.buildingId === building.id &&
        adjacent(agent.cell, state.phase2.parcels.get(building.parcelId)!.cell) &&
        agent.state === "working",
    );
    const incident = [...state.phase2.incidents.values()].find(
      (entry) => entry.buildingId === building.id && entry.status === "active",
    );
    if (technician && incident) incident.intensity = Math.max(0, incident.intensity - 35);
    if (technician && building.state === "operational")
      building.condition = Math.min(100, building.condition + 10);
  }
  // 4. Reached enforcer orders; sabotage is the only PRNG draw here.
  for (const agent of agents) {
    if (
      agent.specialty !== "enforcer" ||
      !agent.task ||
      (agent.cooldownUntilTick ?? 0) > state.clock.tick
    )
      continue;
    if (agent.task.kind === "attack_agent") {
      const target = state.agents.get(agent.task.targetAgentId);
      if (target && adjacent(agent.cell, target.cell)) {
        hurtAgent(state, target, 50);
        agent.cooldownUntilTick = parseTick(state.clock.tick + GAME_HOUR_TICKS);
      }
    }
    if (agent.task.kind === "sabotage_building") {
      const building = state.phase2.buildings.get(agent.task.targetBuildingId);
      if (building && adjacent(agent.cell, state.phase2.parcels.get(building.parcelId)!.cell)) {
        const prng = new Xoshiro128ss(state.seed);
        prng.restoreState(state.prng);
        const detected = prng.nextInt(0, 100) < 35 + state.phase2.crime.policePressure * 3;
        state.prng = prng.exportState();
        const organizationId = agent.organizationId;
        if (organizationId) {
          const key = organizationId as string;
          state.phase2.crime.heatByOrganizationId[key] =
            (state.phase2.crime.heatByOrganizationId[key] ?? 0) + 2;
          if (detected) state.phase2.crime.policePressure += 1;
          state.phase2.crime.lastOutcome = detected ? "detected" : "profitable";
        }
        ignite(state, building, "sabotage", 40, agent.id);
        agent.cooldownUntilTick = parseTick(state.clock.tick + GAME_HOUR_TICKS);
        agent.task = null;
        agent.state = "idle";
      }
    }
  }
  // 5-6. Fire update and structural damage.
  for (const incident of [...state.phase2.incidents.values()]
    .filter((entry) => entry.status === "active")
    .sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const building = state.phase2.buildings.get(incident.buildingId);
    if (!building || building.state === "ruin") {
      incident.status = "resolved";
      continue;
    }
    const tech = agents.some(
      (agent) =>
        agent.task?.kind === "maintenance" &&
        agent.task.buildingId === building.id &&
        agent.state === "working",
    );
    if (!tech) incident.intensity = Math.min(100, incident.intensity + 15);
    building.structuralIntegrity = Math.max(
      0,
      building.structuralIntegrity - Math.ceil(incident.intensity / 10),
    );
    if (incident.intensity === 0) {
      incident.status = "resolved";
      building.state = "operational";
    } else if (incident.intensity >= 100 || building.structuralIntegrity <= 0)
      building.state = "collapse_pending";
  }
  // 7-9. Existing pending roots blast now. New pending buildings wait next hour.
  const pending = [...state.phase2.buildings.values()]
    .filter((building) => building.state === "collapse_pending")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const root of pending) {
    root.state = "ruin";
    const parcel = state.phase2.parcels.get(root.parcelId)!;
    for (const tenantId of root.tenantIds) {
      const tenant = state.phase2.tenants.get(tenantId);
      if (tenant) {
        tenant.status = "displaced";
        tenant.activeContractBuildingId = null;
      }
    }
    const occupants = root.tenantIds.reduce((total, tenantId) => {
      const profile = state.phase2.tenants.get(tenantId)?.profile;
      return (
        total +
        (profile === "household" ? 3 : profile === "maker" || profile === "shopkeeper" ? 2 : 0)
      );
    }, 0);
    const dead = Math.floor(occupants / 2);
    const injured = occupants - dead;
    root.casualtiesTotal.injured += injured;
    root.casualtiesTotal.dead += dead;
    root.tenantIds = [];
    root.tenantId = null;
    const ownIncident = [...state.phase2.incidents.values()].find(
      (entry) => entry.buildingId === root.id && entry.status === "active",
    );
    if (ownIncident) {
      ownIncident.casualties = { injured, dead };
      ownIncident.status = "resolved";
    }
    for (const agent of agents)
      if (Math.abs(agent.cell.x - parcel.cell.x) + Math.abs(agent.cell.y - parcel.cell.y) <= 3)
        hurtAgent(state, agent, 60);
    for (const building of state.phase2.buildings.values()) {
      if (building.id === root.id || building.state !== "operational") continue;
      const target = state.phase2.parcels.get(building.parcelId)!;
      if (Math.abs(target.cell.x - parcel.cell.x) + Math.abs(target.cell.y - parcel.cell.y) <= 3) {
        building.structuralIntegrity = Math.max(0, building.structuralIntegrity - 35);
        ignite(state, building, "blast", 25);
        if (building.structuralIntegrity <= 0) building.state = "collapse_pending";
      }
    }
  }
  // 10. deterministic recovery.
  for (const agent of agents)
    if (agent.state === "injured" && (agent.injuredUntilTick ?? Infinity) <= state.clock.tick) {
      agent.health = 100;
      agent.state = "idle";
      agent.injuredUntilTick = null;
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
  const rivalLoans = [...state.phase2.loans.values()].filter(
    (loan) => loan.borrowerOrganizationId === RIVAL_ORGANIZATION_ID,
  );
  state.phase2.rivalAi.memory.defaultCount = rivalLoans.filter(
    (loan) => loan.status === "defaulted",
  ).length;
  const liquidityReserve = Math.max(
    2500,
    Math.floor((balance * RIVAL_AI_POLICY.minimumReservePercent) / 100) +
      state.phase2.rivalAi.memory.defaultCount * 500,
  );
  const canSpend = (amount: number) => balance >= amount + liquidityReserve;
  const buildingType: BuildingType =
    ownedParcel?.zoning === "industrial" ? "workshop" : "courtyard_home";
  const definition = BUILDING_DEFINITIONS[buildingType];
  const productionDefinitions = ownedParcel
    ? Object.values(BUILDING_DEFINITIONS)
        .filter((entry) => entry.production && entry.allowedZoning.includes(ownedParcel.zoning))
        .sort(
          (left, right) =>
            (ownedParcel.productionSuitability?.[right.production!.output] ?? 100) -
              (ownedParcel.productionSuitability?.[left.production!.output] ?? 100) ||
            left.cost - right.cost,
        )
    : [];
  const productionDefinition = productionDefinitions[0];
  const productionBuildingType = productionDefinition?.type;
  const missingResource = (["cement", "brick", "steel"] as const).find(
    (resource) => inventory[resource] < definition.resources[resource],
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
  const productionMissingResource = productionDefinition
    ? (["cement", "brick", "steel"] as const).find(
        (resource) => inventory[resource] < productionDefinition.resources[resource],
      )
    : undefined;
  if (
    ownedParcel &&
    productionDefinition &&
    !productionMissingResource &&
    canSpend(productionDefinition.cost)
  ) {
    candidates.push({
      score: 82,
      action: "build_production",
      reason: "La parcela apta permite sustituir compras por capacidad productiva localizada.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-factory`),
        type: "StartConstruction",
        payload: { parcelId: ownedParcel.id, buildingType: productionBuildingType! },
      },
    });
  }
  const upgradeCandidate = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        building.productionFacilityId &&
        !building.upgraded &&
        ![...state.phase2.constructionSites.values()].some(
          (site) => site.upgradeBuildingId === building.id,
        ),
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (
    upgradeCandidate &&
    canSpend(BUILDING_DEFINITIONS[upgradeCandidate.type].upgradeCost) &&
    inventory.cement >= UPGRADE_RESOURCES.cement &&
    inventory.brick >= UPGRADE_RESOURCES.brick &&
    inventory.steel >= UPGRADE_RESOURCES.steel
  ) {
    candidates.push({
      score: 75,
      action: "expand_production",
      reason: "Amplía una fábrica física existente para aumentar su capacidad.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-factory-upgrade`),
        type: "UpgradeBuilding",
        payload: { buildingId: upgradeCandidate.id },
      },
    });
  }
  if (available && canSpend(available.price)) {
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
  const refinancingLoan = rivalLoans.find((loan) => {
    if (!["delinquent", "defaulted"].includes(loan.status)) return false;
    const auction = state.phase2.insolvency.auctionsByLoanId[loan.id];
    return !auction || !auction.highestBidderOrganizationId;
  });
  if (refinancingLoan) {
    const loan = refinancingLoan;
    if (loan) {
      candidates.push({
        score: 115,
        action: "refinance_debt",
        reason:
          "La liquidez y la memoria de pérdidas priorizan conservar la cartera antes de vender.",
        command: {
          ...base,
          commandId: parseCommandId(`ai-rival-${state.clock.tick}-refinance`),
          type: "RequestRefinancing",
          payload: { loanId: loan.id, termMonths: 12 },
        },
      });
    }
  }
  const rivalAuction = [...Object.values(state.phase2.insolvency.auctionsByLoanId)]
    .filter(
      (auction) =>
        auction.status === "open" &&
        auction.sellerOrganizationId !== RIVAL_ORGANIZATION_ID &&
        auction.highestBidderOrganizationId === null,
    )
    .sort((left, right) => left.reservePrice - right.reservePrice)[0];
  if (rivalAuction) {
    const bid = Math.max(rivalAuction.reservePrice, rivalAuction.highestBid + 1);
    if (canSpend(bid)) {
      candidates.push({
        score: 92,
        action: "bid_auction",
        reason: "La subasta ofrece una parcela pública por debajo de la reserva de expansión.",
        command: {
          ...base,
          commandId: parseCommandId(`ai-rival-${state.clock.tick}-auction`),
          type: "PlaceAuctionBid",
          payload: { loanId: rivalAuction.loanId, amount: parseMoney(bid) },
        },
      });
    }
  }
  const unprotectedBuilding = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        building.state !== "ruin" &&
        !["active", "lapsed"].includes(
          state.phase2.insurance.contractsByBuildingId[building.id]?.status ?? "",
        ) &&
        deteriorationRiskPercent(building.condition) >= RIVAL_AI_POLICY.insuranceRiskThreshold,
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (unprotectedBuilding) {
    const offer = calculateInsuranceOffer(unprotectedBuilding, "fire_basic");
    if (canSpend(offer.premium)) {
      candidates.push({
        score: 88,
        action: "buy_insurance",
        reason:
          "La memoria de riesgo prioriza cubrir un activo deteriorado sin conocer la cartera del jugador.",
        command: {
          ...base,
          commandId: parseCommandId(`ai-rival-${state.clock.tick}-insurance`),
          type: "BuyInsurance",
          payload: { buildingId: unprotectedBuilding.id, coverage: "fire_basic" },
        },
      });
    }
  }
  const repairCandidate = [...state.phase2.buildings.values()]
    .filter(
      (building) =>
        building.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        building.state === "operational" &&
        building.condition <= RIVAL_AI_POLICY.maintenanceConditionThreshold &&
        ![...state.phase2.constructionSites.values()].some(
          (site) => site.repairBuildingId === building.id,
        ),
    )
    .sort((left, right) => left.condition - right.condition)[0];
  if (repairCandidate && canSpend(REPAIR_COST)) {
    candidates.push({
      score: 86,
      action: "repair_building",
      reason:
        "La condición cae por debajo del umbral operativo y la reparación protege el retorno.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-repair`),
        type: "RepairBuilding",
        payload: { buildingId: repairCandidate.id },
      },
    });
  }
  const financeCollateral = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        !rivalLoans.some(
          (loan) =>
            loan.collateralParcelId === parcel.id &&
            ["offered", "active", "delinquent"].includes(loan.status),
        ),
    )
    .sort((left, right) => right.price - left.price)[0];
  if (financeCollateral && balance < liquidityReserve && rivalLoans.length === 0) {
    candidates.push({
      score: 78,
      action: "request_financing",
      reason: "La liquidez cae bajo la reserva y existe una garantía propia sin cargas activas.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-loan`),
        type: "RequestLoan",
        payload: {
          amount: parseMoney(600),
          termMonths: 12,
          collateralParcelId: financeCollateral.id,
        },
      },
    });
  }
  const saleCandidate = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        parcel.buildingId === null &&
        ![...state.phase2.constructionSites.values()].some((site) => site.parcelId === parcel.id),
    )
    .sort((left, right) => left.price - right.price)[0];
  if (saleCandidate && balance < liquidityReserve) {
    candidates.push({
      score: 70,
      action: "sell_parcel",
      reason: "Vende un solar vacío para recuperar liquidez sin tocar edificios ocupados.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-sell`),
        type: "SellParcel",
        payload: { parcelId: saleCandidate.id },
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
  if (result.accepted && selected.command.type === "RequestLoan") {
    const offeredLoan = [...state.phase2.loans.values()]
      .filter(
        (loan) =>
          loan.borrowerOrganizationId === RIVAL_ORGANIZATION_ID && loan.status === "offered",
      )
      .sort((left, right) => right.offeredAtTick - left.offeredAtTick)[0];
    if (offeredLoan)
      dispatchProductCommand(state, {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-loan-accept`),
        type: "AcceptLoanOffer",
        payload: { loanId: offeredLoan.id },
      });
  }
  if (result.accepted && selected.command.type === "StartConstruction") {
    const parcelId = (selected.command as import("@landlord/shared").StartConstruction).payload
      .parcelId;
    const site = [...state.phase2.constructionSites.values()].find(
      (entry) => entry.ownerOrganizationId === RIVAL_ORGANIZATION_ID && entry.parcelId === parcelId,
    );
    const crew = [...state.phase2.crews.values()].find(
      (entry) =>
        entry.organizationId === RIVAL_ORGANIZATION_ID &&
        ![...state.phase2.constructionSites.values()].some((work) =>
          work.assignedCrewIds.includes(entry.id),
        ),
    );
    if (site && crew)
      dispatchProductCommand(state, {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-crew`),
        type: "AssignCrewToWorkOrder",
        payload: { crewId: crew.id, workOrderId: site.id },
      });
  }
  state.phase2.rivalAi.lastAction = selected.action;
  state.phase2.rivalAi.lastReason = selected.reason;
  state.phase2.rivalAi.lastFailureCode = result.accepted ? null : result.code;
  if (!result.accepted) {
    state.phase2.rivalAi.memory.lossCount += 1;
    state.phase2.rivalAi.memory.lastLossAmount = parseMoney(0);
  }
  state.phase2.rivalAi.cooldownUntilTick = parseTick(
    state.clock.tick + (result.accepted ? GAME_DAY_TICKS : GAME_DAY_TICKS * 2),
  );
}

export function advanceProductSystems(state: GameState): void {
  tacticalTick(state);
  progressProduction(state);
  collectRentAndAgeLeases(state);
  processLoanPayments(state);
  settleAuctions(state);
  settlePropertyTaxes(state);
  settleMaintenance(state);
  settleInsurance(state);
  updatePolicyAndHeat(state);
  rivalAction(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

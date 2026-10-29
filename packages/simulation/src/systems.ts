import {
  parseBuildingId,
  parseFacilityId,
  parseCommandId,
  parseMoney,
  parseTick,
  parseIncidentId,
  parseOrganizationId,
  type Agent,
  type BuildingId,
  type BuildingType,
  type IncidentRecord,
} from "@landlord/shared";
import { credit, debit, dispatchProductCommand } from "./commands";
import {
  BUILDING_DEFINITIONS,
  RIVAL_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
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
  deteriorationRiskPercent,
  INSURANCE_POLICY,
  INSOLVENCY_POLICY,
  calculateInsuranceOffer,
  REPAIR_COST,
} from "./game-data";
import { blockedCellsOf, type GameState } from "./state";
import {
  activeSiteOnParcel,
  blockOfParcel,
  buildBuildingIndex,
  buildingsOnParcel,
  reconcileParcelUses,
} from "./building-index";
import { developmentCodeById } from "./development-codes";
import { advanceTransfers } from "./transfers";
import { runEmployment } from "./employment";
import { runAutomation } from "./automation";
import { macroShockBiasFor, runMacroEvents } from "./macro-events";
import { runMunicipalBudget } from "./municipal-budget";
import { runMunicipalPolitics } from "./municipal-politics";
import { hasActiveAward, operationalBuildingsOwned, runPublicContracts } from "./public-contracts";
import { askingRentFor, runHousingMarket } from "./housing-market";
import { recordReputationFact, runReputation } from "./reputation";
import { runIntelligence } from "./information";
import {
  FACTION_ACTION_FAMILY,
  factionProfileOf,
  isActionCycleSuppressed,
  publicBidPercentFor,
  noteCycleSuppressed,
  recordFactionEncounter,
  rememberFactionAction,
  repetitionPenaltyFor,
  runFactions,
} from "./factions";
import { Xoshiro128ss } from "./prng";
import { findDeterministicPath } from "./navigation";

const MOVEMENT_TICKS_PER_CELL = 10;
const INCIDENT_LIMIT = 50;
const PRODUCTION_SCALE = 1_000_000;
const adjacent = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

/**
 * Primer incidente activo por edificio en orden de inserción: equivalente a recorrer
 * `state.phase2.incidents.values()` con `find`, pero una sola vez por etapa en vez de una por edificio.
 */
function indexActiveIncidents(state: GameState): Map<BuildingId, IncidentRecord> {
  const index = new Map<BuildingId, IncidentRecord>();
  for (const incident of state.phase2.incidents.values()) {
    if (incident.status !== "active" || index.has(incident.buildingId)) continue;
    index.set(incident.buildingId, incident);
  }
  return index;
}

/** Técnico en mantenimiento adyacente y trabajando, primero por id de agente. */
function indexAdjacentTechnicians(
  state: GameState,
  agents: readonly Agent[],
): Map<BuildingId, Agent> {
  const index = new Map<BuildingId, Agent>();
  for (const agent of agents) {
    if (agent.state !== "working" || agent.task?.kind !== "maintenance") continue;
    const buildingId = agent.task.buildingId;
    if (index.has(buildingId)) continue;
    const building = state.phase2.buildings.get(buildingId);
    if (!building) continue;
    const parcel = state.phase2.parcels.get(building.parcelId);
    if (!parcel || !adjacent(agent.cell, parcel.anchorCell)) continue;
    index.set(buildingId, agent);
  }
  return index;
}

/** Edificios con algún técnico trabajando, sin exigir adyacencia: es el predicado del paso 5-6. */
function collectWorkingMaintenance(agents: readonly Agent[]): Set<BuildingId> {
  const buildingIds = new Set<BuildingId>();
  for (const agent of agents)
    if (agent.state === "working" && agent.task?.kind === "maintenance")
      buildingIds.add(agent.task.buildingId);
  return buildingIds;
}

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
  publiclyAttributedOrganizationId: import("@landlord/shared").OrganizationId | null = null,
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
    /** Nadie puede conocer a un autor que no fue visto: la atribución pública es conocimiento, no verdad. */
    publiclyAttributedOrganizationId,
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
        if (ruin.productionFacilityId) {
          state.phase2.facilities.delete(ruin.productionFacilityId);
        }
        state.phase2.buildings.delete(ruin.id);
        reconcileParcelUses(state, ruin.parcelId);
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
        districtId: site.districtId,
        ownerOrganizationId: site.ownerOrganizationId,
        productionFacilityId: null,
        type: site.buildingType,
        footprintCells: site.footprintCells.map((cell) => ({ ...cell })),
        orientation: site.orientation,
        floors: site.floors,
        form: site.form,
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
      reconcileParcelUses(state, site.parcelId);
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
  // Vencer el lease no es un agravio: sólo se anota el hogar que sale forzado por un edificio
  // inhabitable o por una satisfacción por el suelo, que es lo que la calle percibe.
  const forcedOutByOrganizationId = new Map<import("@landlord/shared").OrganizationId, number>();
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    if (building.state === "ruin" || building.tenantIds.length === 0) continue;
    const askingRent = askingRentFor(state, building);
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
      const forcedOut = building.condition < 20 || tenant.satisfaction < 30;
      if (tenant.leaseRemaining === 0 || forcedOut) {
        building.tenantIds = building.tenantIds.filter((id) => id !== tenant.id);
        tenant.activeContractBuildingId = null;
        tenant.status = "available";
        // El hogar vuelve al pool: quedarse sin contrato es una salida para la estadística del
        // mercado, aunque el mismo hogar pueda volver a instalarse más adelante.
        state.phase2.housingMarket.departuresTotal += 1;
        if (forcedOut) {
          forcedOutByOrganizationId.set(
            building.ownerOrganizationId,
            (forcedOutByOrganizationId.get(building.ownerOrganizationId) ?? 0) + 1,
          );
        }
      }
    }
    building.tenantId = building.tenantIds[0] ?? null;
  }
  for (const [organizationId, count] of [...forcedOutByOrganizationId.entries()].sort(
    (left, right) => left[0].localeCompare(right[0]),
  )) {
    recordReputationFact(state, organizationId, "households_displaced", { magnitude: count });
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
      if (loan.status === "defaulted") {
        openAuctionForLoan(state, loan);
        recordReputationFact(state, loan.borrowerOrganizationId, "loan_defaulted", {
          referenceId: loan.id,
        });
      }
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
    if (loan.status === "paid_off") {
      recordReputationFact(state, loan.borrowerOrganizationId, "loan_paid_off", {
        referenceId: loan.id,
      });
    }
    loan.nextPaymentTick =
      loan.status === "paid_off" ? null : parseTick(state.clock.tick + GAME_MONTH_TICKS);
  }
}

function collateralValue(state: GameState, loan: import("@landlord/shared").Loan): number {
  const parcel = state.phase2.parcels.get(loan.collateralParcelId);
  if (!parcel) return 0;
  const index = buildBuildingIndex(state);
  return (
    parcel.price +
    buildingsOnParcel(index, parcel.id).reduce(
      (total, building) =>
        total + Math.round((BUILDING_DEFINITIONS[building.type].cost * building.condition) / 100),
      0,
    )
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
  const auctions = Object.values(state.phase2.insolvency.auctionsByLoanId);
  if (auctions.length === 0) return;
  for (const auction of auctions.sort((a, b) => a.loanId.localeCompare(b.loanId))) {
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
    const sellerWasCompany =
      state.organizations.get(auction.sellerOrganizationId)?.kind === "company";
    if (auction.sellerOrganizationId === RIVAL_ORGANIZATION_ID && shortfall > 0) {
      state.phase2.rivalAi.memory.lossCount += 1;
      state.phase2.rivalAi.memory.lastLossAmount = parseMoney(shortfall);
    }
    parcel.ownerOrganizationId = winner;
    for (const building of buildingsOnParcel(buildBuildingIndex(state), parcel.id)) {
      building.ownerOrganizationId = winner;
    }
    loan.outstandingPrincipal = parseMoney(0);
    loan.nextPaymentTick = null;
    /** El subastado pierde el suelo ante alguien concreto: eso es un encuentro, no una estadística. */
    for (const [bidderId] of Object.entries(auction.reservedFundsByOrganizationId).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      if (bidderId === winner) continue;
      const outbidId = parseOrganizationId(bidderId);
      if (state.organizations.get(outbidId)?.kind !== "company") continue;
      recordFactionEncounter(state, outbidId, parseOrganizationId(winner), "auction_outbid");
    }
    if (state.organizations.get(winner)?.kind === "company" && sellerWasCompany)
      recordFactionEncounter(
        state,
        auction.sellerOrganizationId,
        parseOrganizationId(winner),
        "auction_outbid",
      );
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
      state.phase2.municipal.revenueThisMonthBySource.propertyTax = parseMoney(
        (state.phase2.municipal.revenueThisMonthBySource.propertyTax ?? 0) + due,
      );
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
    if (building.ownerOrganizationId !== PLAYER_ORGANIZATION_ID) continue;
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
  // Las primas son mensuales: en el resto de ticks ninguna póliza vence, así que se filtran antes
  // de ordenar en vez de recorrer toda la cartera en cada tick.
  const due = Object.values(state.phase2.insurance.contractsByBuildingId).filter(
    (contract) => contract.status === "active" && contract.nextPremiumTick === state.clock.tick,
  );
  if (due.length === 0) return;
  for (const contract of due.sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
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
  const movementDue = state.clock.tick % MOVEMENT_TICKS_PER_CELL === 0;
  const hourDue = state.clock.tick !== 0 && state.clock.tick % GAME_HOUR_TICKS === 0;
  // En 9 de cada 10 ticks no vence movimiento ni ninguna etapa horaria: ordenar todos los agentes
  // sería entonces el coste dominante del tick sin producir ningún resultado.
  if (!movementDue && !hourDue) return;
  const agents = [...state.agents.values()].sort((a, b) => a.id.localeCompare(b.id));
  // 1. Movement: target agents are re-evaluated at most once per game second.
  if (movementDue)
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
          agent.path = findDeterministicPath(
            agent.cell,
            agent.target,
            blockedCellsOf(state, agent.districtId),
          );
          agent.lastPathRecalculationTick = state.clock.tick;
        }
      }
      if (!agent.path?.length && agent.target && !adjacent(agent.cell, agent.target))
        agent.path = findDeterministicPath(
          agent.cell,
          agent.target,
          blockedCellsOf(state, agent.districtId),
        );
      const next = agent.path?.shift();
      if (next) agent.cell = next;
      if (agent.target && adjacent(agent.cell, agent.target)) agent.state = "working";
    }
  // Stage 2-3: arrival activates work, then physical crews contribute before hostile actions.
  progressConstruction(state);
  if (!hourDue) return;
  // Las etapas horarias recorrían la tabla de incidentes y la lista de agentes una vez por edificio:
  // O(edificios × agentes) en cada hora de juego. Los índices siguientes dan el mismo resultado con
  // una pasada cada uno, y se reconstruyen allí donde una etapa anterior puede mutar el estado.
  let activeIncidents = indexActiveIncidents(state);
  if (state.clock.tick % GAME_MONTH_TICKS === 0) {
    const prng = new Xoshiro128ss(state.seed);
    prng.restoreState(state.prng);
    for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const hasIncident = activeIncidents.has(building.id);
      const risk = deteriorationRiskPercent(building.condition);
      if (building.state !== "operational" || hasIncident || risk === 0) continue;
      if (prng.nextInt(0, 100) < risk) ignite(state, building, "deterioration", 40);
    }
    state.prng = prng.exportState();
    activeIncidents = indexActiveIncidents(state);
  }
  // 3. Technician suppression and repair.
  const technicians = indexAdjacentTechnicians(state, agents);
  for (const building of [...state.phase2.buildings.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const technician = technicians.get(building.id);
    const incident = activeIncidents.get(building.id);
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
      if (
        building &&
        adjacent(agent.cell, state.phase2.parcels.get(building.parcelId)!.anchorCell)
      ) {
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
        ignite(state, building, "sabotage", 40, agent.id, detected ? organizationId : null);
        agent.cooldownUntilTick = parseTick(state.clock.tick + GAME_HOUR_TICKS);
        agent.task = null;
        agent.state = "idle";
      }
    }
  }
  // 5-6. Fire update and structural damage.
  // El paso 4 puede dejar sin tarea a un agente, así que el índice se construye después.
  const maintenanceOnDuty = collectWorkingMaintenance(agents);
  for (const incident of [...state.phase2.incidents.values()]
    .filter((entry) => entry.status === "active")
    .sort((a, b) => a.buildingId.localeCompare(b.buildingId))) {
    const building = state.phase2.buildings.get(incident.buildingId);
    if (!building || building.state === "ruin") {
      incident.status = "resolved";
      continue;
    }
    const tech = maintenanceOnDuty.has(building.id);
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
  // `ignite` sólo actúa sobre edificios operacionales, así que ninguna explosión posterior puede
  // crear el incidente de una raíz pendiente: el índice construido aquí sigue siendo válido.
  const rootIncidents = indexActiveIncidents(state);
  for (const root of pending) {
    root.state = "ruin";
    reconcileParcelUses(state, root.parcelId);
    const parcel = state.phase2.parcels.get(root.parcelId)!;
    for (const tenantId of root.tenantIds) {
      const tenant = state.phase2.tenants.get(tenantId);
      if (tenant) {
        tenant.status = "displaced";
        tenant.activeContractBuildingId = null;
      }
    }
    // `size` es el recuento de ocupantes del hogar; los hogares autorados y los cargados desde una
    // partida antigua lo reconstruyen con la misma tabla, así que las bajas siguen cuadrando.
    const occupants = root.tenantIds.reduce(
      (total, tenantId) => total + (state.phase2.tenants.get(tenantId)?.size ?? 0),
      0,
    );
    const dead = Math.floor(occupants / 2);
    const injured = occupants - dead;
    root.casualtiesTotal.injured += injured;
    root.casualtiesTotal.dead += dead;
    const ownIncident = rootIncidents.get(root.id);
    if (dead + injured > 0) {
      recordReputationFact(state, root.ownerOrganizationId, "casualties", {
        referenceId: root.id,
        magnitude: dead + injured,
      });
      /**
       * El propietario responde de la seguridad del inmueble, y del sabotaje también carga quien lo
       * causó —pero sólo si alguien lo vio: la reputación mide lo que el distrito sabe, no la verdad
       * autoritativa que guarda `causedByOrganizationId`.
       */
      const attackerId = ownIncident?.publiclyAttributedOrganizationId ?? null;
      if (attackerId && attackerId !== root.ownerOrganizationId) {
        recordReputationFact(state, attackerId, "violent_sabotage", {
          referenceId: root.id,
          magnitude: dead + injured,
        });
      }
    }
    root.tenantIds = [];
    root.tenantId = null;
    if (ownIncident) {
      ownIncident.casualties = { injured, dead };
      ownIncident.status = "resolved";
    }
    for (const agent of agents)
      if (
        Math.abs(agent.cell.x - parcel.anchorCell.x) +
          Math.abs(agent.cell.y - parcel.anchorCell.y) <=
        3
      )
        hurtAgent(state, agent, 60);
    for (const building of state.phase2.buildings.values()) {
      if (building.id === root.id || building.state !== "operational") continue;
      const target = state.phase2.parcels.get(building.parcelId)!;
      if (
        Math.abs(target.anchorCell.x - parcel.anchorCell.x) +
          Math.abs(target.anchorCell.y - parcel.anchorCell.y) <=
        3
      ) {
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

type RivalCommand = Exclude<
  import("@landlord/shared").ProductCommand,
  { type: "PlaceTestStructure" }
>;

/**
 * Objetivo de una acción rival para la memoria: la primera clave del payload que identifique una
 * entidad. Sin él, dos intentos sobre parcelas distintas contarían como el mismo bucle.
 */
const RIVAL_TARGET_KEYS = [
  "parcelId",
  "buildingId",
  "contractId",
  "loanId",
  "auctionId",
  "tenantId",
  "resource",
  "policyId",
] as const;

function rivalActionTarget(command: RivalCommand): string {
  const payload = command.payload as Record<string, unknown>;
  for (const key of RIVAL_TARGET_KEYS) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return "*";
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
  /**
   * La IA sólo opera donde tiene agentes: una cuadrilla no puede trabajar en otro distrito hasta que
   * exista un traslado explícito (D-088). Sin este filtro el rival compraba suelo inalcanzable,
   * fallaba cada obra y se quedaba quieto.
   */
  const rivalDistricts = new Set(
    [...state.agents.values()]
      .filter(
        (agent) =>
          agent.organizationId === RIVAL_ORGANIZATION_ID &&
          agent.state !== "dead" &&
          agent.state !== "injured",
      )
      .map((agent) => agent.districtId),
  );
  const rivalIndex = buildBuildingIndex(state);
  const ownedParcel = [...state.phase2.parcels.values()]
    .filter(
      (parcel) =>
        parcel.ownerOrganizationId === RIVAL_ORGANIZATION_ID &&
        rivalDistricts.has(parcel.districtId) &&
        buildingsOnParcel(rivalIndex, parcel.id).length === 0 &&
        activeSiteOnParcel(state, parcel.id) === undefined,
    )
    .sort((a, b) => a.price - b.price)[0];
  const available = [...state.phase2.parcels.values()]
    .filter((parcel) => !parcel.ownerOrganizationId && rivalDistricts.has(parcel.districtId))
    .sort((a, b) => a.price - b.price)[0];
  const balance = state.phase2.balances.get(RIVAL_ORGANIZATION_ID) ?? 0;
  const inventory = state.phase2.inventories.get(RIVAL_ORGANIZATION_ID)!;
  const rivalLoans = [...state.phase2.loans.values()].filter(
    (loan) => loan.borrowerOrganizationId === RIVAL_ORGANIZATION_ID,
  );
  state.phase2.rivalAi.memory.defaultCount = rivalLoans.filter(
    (loan) => loan.status === "defaulted",
  ).length;
  const profile = factionProfileOf(state, RIVAL_ORGANIZATION_ID);
  const liquidityReserve = Math.max(
    2500,
    Math.floor((balance * profile.minimumReservePercent) / 100) +
      state.phase2.rivalAi.memory.defaultCount * 500,
  );
  const canSpend = (amount: number) => balance >= amount + liquidityReserve;
  const ownedBlock = ownedParcel ? blockOfParcel(state, ownedParcel) : undefined;
  const ownedCode = ownedBlock
    ? developmentCodeById(ownedBlock.defaultDevelopmentCodeId)
    : undefined;
  const buildingType: BuildingType = ownedCode?.allowedUses.includes("industrial")
    ? "workshop"
    : "courtyard_home";
  const definition = BUILDING_DEFINITIONS[buildingType];
  const productionDefinitions =
    ownedParcel && ownedCode
      ? Object.values(BUILDING_DEFINITIONS)
          .filter(
            (entry) =>
              entry.production &&
              entry.allowedUses.every((use) => ownedCode.allowedUses.includes(use)),
          )
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
        deteriorationRiskPercent(building.condition) >= profile.insuranceRiskThreshold,
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
        building.condition <= profile.maintenanceConditionThreshold &&
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
        buildingsOnParcel(rivalIndex, parcel.id).length === 0 &&
        activeSiteOnParcel(state, parcel.id) === undefined,
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
  const rivalInfluence = state.phase2.influenceByOrganizationId.get(RIVAL_ORGANIZATION_ID) ?? 0;
  const policy = state.phase2.ordinance;
  const policyBenefitsRival =
    policy.materialCostModifierPercent <= 0 ||
    policy.propertyTaxModifierPercent < 0 ||
    policy.permitApprovalModifierPercent > 0;
  if (
    policy.status === "proposed" &&
    state.clock.tick >= GAME_MONTH_TICKS &&
    rivalInfluence >= policy.influenceRequired &&
    policyBenefitsRival
  ) {
    candidates.push({
      score: 74,
      action: "lobby_policy",
      reason:
        "La propuesta mejora al menos un coste, impuesto o permiso de la cartera rival y consume influencia limitada.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-policy`),
        type: "LobbyPolicy",
        payload: {
          policyId: policy.id,
          influenceSpend: policy.influenceRequired,
        },
      },
    });
  }
  const rivalContract = [...Object.values(state.phase2.contracts.contracts)]
    .filter(
      (contract) =>
        contract.status === "open" &&
        state.clock.tick < contract.closesAtTick &&
        !contract.bids.some((bid) => bid.organizationId === RIVAL_ORGANIZATION_ID) &&
        !hasActiveAward(state, RIVAL_ORGANIZATION_ID) &&
        operationalBuildingsOwned(state, RIVAL_ORGANIZATION_ID) >= contract.requiredBuildings &&
        canSpend(contract.bond),
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (rivalContract) {
    const amount = parseMoney(
      Math.max(
        1,
        Math.floor(
          (rivalContract.budget * publicBidPercentFor(state, RIVAL_ORGANIZATION_ID)) / 100,
        ),
      ),
    );
    candidates.push({
      score: 76,
      action: "bid_public_contract",
      reason:
        "La licitación abierta encaja con la capacidad actual y la caja cubre la fianza sin romper la reserva.",
      command: {
        ...base,
        commandId: parseCommandId(`ai-rival-${state.clock.tick}-contract`),
        type: "SubmitPublicBid",
        payload: { contractId: rivalContract.id, amount },
      },
    });
  }
  /**
   * La utilidad base se corrige tres veces: el perfil pondera la familia de objetivos, el shock
   * macroeconómico activo inclina esa misma familia y la memoria castiga repetir un intento ya
   * rechazado. Los macroeventos son información pública del mundo, así que la IA no gana nada privado.
   */
  const biased = candidates.map((candidate) => {
    const family = FACTION_ACTION_FAMILY[candidate.action] ?? "develop";
    return {
      ...candidate,
      utility:
        candidate.score + profile.goalBiasByFamily[family] + macroShockBiasFor(state, family),
    };
  });
  const remembered = [...biased].sort((left, right) => right.utility - left.utility)[0];
  const ordered = biased
    .filter(
      (candidate) =>
        !isActionCycleSuppressed(
          state,
          RIVAL_ORGANIZATION_ID,
          candidate.action,
          rivalActionTarget(candidate.command),
        ),
    )
    .map((candidate) => ({
      ...candidate,
      utility:
        candidate.utility +
        repetitionPenaltyFor(
          state,
          RIVAL_ORGANIZATION_ID,
          candidate.action,
          rivalActionTarget(candidate.command),
        ),
    }))
    .sort((left, right) => right.utility - left.utility);
  const selected = ordered[0];
  /**
   * La memoria gana sólo si desbanca al candidato que habría elegido la utilidad sola. Contar también el
   * caso en que se queda sin opciones es lo que hace visible el bucle roto.
   */
  if (remembered && (!selected || selected.action !== remembered.action))
    noteCycleSuppressed(state, RIVAL_ORGANIZATION_ID);
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
  rememberFactionAction(state, RIVAL_ORGANIZATION_ID, {
    action: selected.action,
    target: rivalActionTarget(selected.command),
    accepted: result.accepted,
    rejectionCode: result.accepted ? null : result.code,
  });
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

export type ProductSystem = {
  /** Nombre estable: lo usan la instrumentación de coste y las reglas de LOD. */
  readonly name: string;
  run(state: GameState): void;
};

/**
 * El orden del tick es parte del determinismo (D-060): reordenar o intercalar un sistema cambia
 * todas las partidas aunque el código de cada sistema no varíe.
 */
export const PRODUCT_SYSTEMS: readonly ProductSystem[] = [
  // Los traslados llegan antes que el trabajo táctico: quien aparece este tick puede trabajar este tick.
  { name: "transfers", run: advanceTransfers },
  { name: "tactical", run: tacticalTick },
  // Los macroeventos se limpian al inicio del tick para que los modifiers estén disponibles O(1).
  { name: "macroEvents", run: runMacroEvents },
  { name: "production", run: progressProduction },
  { name: "rent", run: collectRentAndAgeLeases },
  { name: "debt", run: processLoanPayments },
  { name: "auctions", run: settleAuctions },
  { name: "propertyTax", run: settlePropertyTaxes },
  { name: "maintenance", run: settleMaintenance },
  { name: "insurance", run: settleInsurance },
  { name: "policy", run: updatePolicyAndHeat },
  { name: "rival", run: rivalAction },
  // La delegación del jugador actúa a diario con los mismos comandos y permisos; va después del
  // rival para que ambas organizaciones decidan sobre el mismo estado del día.
  { name: "automation", run: runAutomation },
  // El empleo fija el nivel de ingresos del mes antes de que vivienda decida qué es asequible.
  { name: "employment", run: runEmployment },
  // El mercado cierra el mes después de la renta: el precio que se descubre hoy se cobra el mes
  // siguiente, nunca en el mismo cierre en el que se observa la vacancia.
  { name: "housing", run: runHousingMarket },
  // La reputación cierra el mes con los impagos y el abandono ya observados, y devuelve la
  // influencia que el gobierno deposita en cada empresa antes de la licitación del mes.
  { name: "reputation", run: runReputation },
  // Los contratos cobran fianzas y pagan obras antes del cierre presupuestario, para que la caja
  // municipal del mes ya refleje lo comprometido con la autoridad.
  { name: "contracts", run: runPublicContracts },
  // La política cierra justo antes que el presupuesto: la opinión juzga los servicios que ya tuvo y
  // la carga fiscal del mes en curso, y el concejo nuevo reordena el pago de este mismo mes.
  { name: "politics", run: runMunicipalPolitics },
  // El municipio paga al final, cuando ya ha cobrado los impuestos del mes.
  { name: "municipal", run: runMunicipalBudget },
  // Las facciones cierran el mes con el roce territorial ya observado: decaen posturas y recortan
  // memoria antes de que la inteligencia re-base el expediente sobre un estado estable.
  { name: "factions", run: runFactions },
  // La inteligencia cierra la lista: re-basa el expediente del jugador sobre el estado ya cerrado
  // del mes, sin mover caja ni el PRNG económico.
  { name: "intelligence", run: runIntelligence },
];

export function advanceProductSystems(state: GameState): void {
  for (const system of PRODUCT_SYSTEMS) system.run(state);
  state.clock = { ...state.clock, tick: parseTick(state.clock.tick + 1) };
}

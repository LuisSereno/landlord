import {
  parseEventId,
  parseConstructionSiteId,
  parseMoney,
  parsePermitId,
  parseStructureId,
  parseTick,
  parseLoanId,
  type ProductCommand,
  type ErrorCode,
  type PlaceTestStructure,
  type TestStructurePlaced,
} from "@landlord/shared";
import { blockedCellsOf, districtMapOf, hasOrganizationControl, type GameState } from "./state";
import {
  activeSiteOnParcel,
  blockOfParcel,
  buildBuildingIndex,
  buildingsOnParcel,
  reconcileParcelUses,
} from "./building-index";
import { chooseFootprint } from "./footprints";
import { credit, debit } from "./ledger";
import { startAgentTravel } from "./transfers";
import { submitPublicBid } from "./public-contracts";

export { credit, debit } from "./ledger";
import {
  BUILDING_DEFINITIONS,
  ILLEGAL_ROUTE,
  PLAYER_CREW_CAPACITY,
  UPGRADE_RESOURCES,
  CRIME_COOLDOWN_TICKS,
  REPAIR_COST,
  REPAIR_WORK_REQUIRED,
  BANK_ORGANIZATION_ID,
  LOAN_POLICY,
  GAME_MONTH_TICKS,
  MUNICIPAL_POLICY_DURATION_TICKS,
  effectiveTaxRateBps,
  calculateTax,
  MUNICIPALITY_ORGANIZATION_ID,
  INSURANCE_POLICY,
  calculateInsuranceOffer,
  permitRequirements,
  INSOLVENCY_POLICY,
  RIVAL_AI_POLICY,
  createMunicipalPolicy,
} from "./game-data";
import { Xoshiro128ss } from "./prng";
import { askingRentFor } from "./housing-market";
import {
  developmentCodeById,
  effectiveDensityBonus,
  effectiveDevelopmentCode,
  isBuildingAllowedByDevelopmentCode,
} from "./development-codes";
import { activePermitFor, permitsFor } from "./permitting";
import {
  effectiveConstructionWorkRequired,
  effectiveMarketPriceFor,
  materialCostModifierPercentFor,
} from "./macro-events";
import { bankRateModifierBpsFor } from "./reputation";
import { INFORMATION_POLICY, commissionIntelligence, commissionRejection } from "./information";
import { recordFactionEncounter } from "./factions";
import { councilAlignmentPercent } from "./municipal-politics";
import { districtObstacles, interactionCellCandidates } from "./district-obstacles";
import { findDeterministicPath } from "./navigation";

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

function inMap(
  state: GameState,
  districtId: import("@landlord/shared").DistrictId,
  cell: { x: number; y: number },
): boolean {
  const map = districtMapOf(state, districtId);
  return cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height;
}

function cellKey(cell: { x: number; y: number }): string {
  return `${cell.x}:${cell.y}`;
}

function nextEntityId(prefix: "structure" | "event", value: number): string {
  return `${prefix}_${String(value).padStart(8, "0")}`;
}

function hasStructureAt(
  state: GameState,
  districtId: import("@landlord/shared").DistrictId,
  cell: { x: number; y: number },
): boolean {
  const key = cellKey(cell);
  return [...state.structures.values()].some(
    (structure) => structure.districtId === districtId && cellKey(structure.cell) === key,
  );
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

function effectiveRent(state: GameState, building: import("@landlord/shared").Building): number {
  return askingRentFor(state, building);
}

/** La misma regla que lee el valor del suelo: la ordenanza vigente, sólo para su rol. */
function densityBonusFor(
  state: GameState,
  role: import("@landlord/shared").UrbanRole,
): { floors: number; farPercent: number } {
  return effectiveDensityBonus(state.phase2.ordinance, role);
}

/**
 * Emite la decisión administrativa y devuelve el registro. Un permiso ya vigente se reutiliza sin
 * volver a sortear; uno caducado pasa a `expired` y conserva su evidencia, y la nueva decisión nace
 * con `PermitId` propio porque pueden convivir varios tipos de edificio en la misma parcela (H1-03).
 */
function issuePermit(
  state: GameState,
  parcel: import("@landlord/shared").Parcel,
  buildingType: import("@landlord/shared").BuildingType,
): import("@landlord/shared").Permit {
  const block = blockOfParcel(state, parcel);
  const code = developmentCodeById(parcel.developmentCodeId);
  const live = activePermitFor(state, parcel.id, buildingType, state.clock.tick);
  if (live) return live;
  for (const permit of permitsFor(state, parcel.id, buildingType))
    if (permit.status === "approved" && permit.expiresAtTick !== null) permit.status = "expired";
  const baseChance = state.phase2.permitting.approvalChanceByRole[block.urbanRole] ?? 100;
  const ordinanceModifier =
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.permitApprovalModifierPercent
      : 0;
  const densityBonus = densityBonusFor(state, block.urbanRole);
  const chance = Math.max(0, Math.min(100, baseChance + ordinanceModifier));
  let approved = chance >= 100;
  if (chance > 0 && chance < 100) {
    const generator = new Xoshiro128ss(state.seed);
    generator.restoreState(state.prng);
    approved = generator.nextInt(0, 100) < chance;
    state.prng = generator.exportState();
  }
  state.phase2.idCounters.permit += 1;
  const id = parsePermitId(`permit_${String(state.phase2.idCounters.permit).padStart(8, "0")}`);
  const permit: import("@landlord/shared").Permit = {
    id,
    parcelId: parcel.id,
    buildingType,
    authorityOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
    requirements: permitRequirements(block.urbanRole, code, parcel.currentUses, buildingType),
    developmentCodeIdAtDecision: code.id,
    allowedUsesAtDecision: [...code.allowedUses],
    currentUsesAtDecision: [...parcel.currentUses],
    densityBonusFloors: densityBonus.floors,
    densityBonusFarPercent: densityBonus.farPercent,
    status: approved ? "approved" : "denied",
    requestedAtTick: parseTick(state.clock.tick),
    decidedAtTick: parseTick(state.clock.tick),
    expiresAtTick: approved
      ? parseTick(state.clock.tick + state.phase2.permitting.validityTicks)
      : null,
    consumedAtTick: null,
  };
  state.phase2.permitting.permitsById[permit.id] = permit;
  return permit;
}

/** La parcela manda a su código; la regla de compatibilidad vive en `development-codes`. */
function isParcelUseAllowed(
  parcel: import("@landlord/shared").Parcel,
  definition: import("@landlord/shared").BuildingDefinition,
): boolean {
  return isBuildingAllowedByDevelopmentCode(
    definition,
    developmentCodeById(parcel.developmentCodeId),
  );
}

function reservedFundsForOrganization(
  state: GameState,
  organizationId: import("@landlord/shared").OrganizationId,
  excludeLoanId?: import("@landlord/shared").LoanId,
): number {
  return Object.values(state.phase2.insolvency.auctionsByLoanId)
    .filter((auction) => auction.status === "open" && auction.loanId !== excludeLoanId)
    .reduce(
      (total, auction) => total + (auction.reservedFundsByOrganizationId[organizationId] ?? 0),
      0,
    );
}

export function dispatchProductCommand(
  state: GameState,
  command: Exclude<ProductCommand, { type: "PlaceTestStructure" }>,
): ProductCommandResult {
  if (state.processedCommandIds.has(command.commandId))
    return { accepted: false, code: "DUPLICATE_COMMAND" };
  const actorError = validateActor(state, command);
  if (actorError) return { accepted: false, code: actorError };

  if (command.type === "SetMaintenancePolicy") {
    state.phase2.maintenance.policy = command.payload.policy;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "MaintenancePolicyChanged", {
      policy: command.payload.policy,
    });
  }

  if (command.type === "SetAutomationPolicy") {
    const automation = state.phase2.automation;
    if (command.payload.property !== undefined) automation.property = command.payload.property;
    if (command.payload.finance !== undefined) automation.finance = command.payload.finance;
    if (command.payload.maintenanceRepairThreshold !== undefined) {
      automation.maintenanceRepairThreshold = command.payload.maintenanceRepairThreshold;
    }
    if (command.payload.financeCashFloor !== undefined) {
      automation.financeCashFloor = command.payload.financeCashFloor;
    }
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "AutomationPolicyChanged", {
      property: automation.property,
      finance: automation.finance,
      maintenanceRepairThreshold: automation.maintenanceRepairThreshold,
      financeCashFloor: automation.financeCashFloor,
    });
  }

  if (command.type === "RequestPermit") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    const definition = BUILDING_DEFINITIONS[command.payload.buildingType];
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    if (parcel.disposition !== "marketable")
      return { accepted: false, code: "PUBLIC_LAND_NOT_BUILDABLE" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!isParcelUseAllowed(parcel, definition))
      return { accepted: false, code: "USE_NOT_ALLOWED" };
    const permit = issuePermit(state, parcel, command.payload.buildingType);
    rememberProcessed(state, command.commandId);
    return productEvent(
      state,
      command.commandId,
      permit.status === "approved" ? "PermitApproved" : "PermitDenied",
      {
        parcelId: parcel.id,
        buildingType: command.payload.buildingType,
        status: permit.status,
        permitId: permit.id,
        expiresAtTick: permit.expiresAtTick,
      },
    );
  }

  if (command.type === "BuyInsurance") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (
      !building ||
      building.ownerOrganizationId !== command.actingAsOrganizationId ||
      building.state === "ruin"
    )
      return { accepted: false, code: "INSURANCE_BUILDING_INVALID" };
    const currentContract = state.phase2.insurance.contractsByBuildingId[building.id];
    if (currentContract?.status === "active" || currentContract?.status === "lapsed")
      return { accepted: false, code: "INSURANCE_ALREADY_ACTIVE" };
    const offer = calculateInsuranceOffer(building, command.payload.coverage);
    if (
      !debit(state, command.actingAsOrganizationId, offer.premium, "insurance_premium", building.id)
    )
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    credit(
      state,
      INSURANCE_POLICY.insurerOrganizationId,
      offer.premium,
      "insurance_premium",
      building.id,
    );
    state.phase2.insurance.contractsByBuildingId[building.id] = {
      buildingId: building.id,
      insurerOrganizationId: INSURANCE_POLICY.insurerOrganizationId,
      coverage: command.payload.coverage,
      ...offer,
      status: "active",
      purchasedAtTick: parseTick(state.clock.tick),
      lastPremiumTick: parseTick(state.clock.tick),
      nextPremiumTick: parseTick(state.clock.tick + INSURANCE_POLICY.settlementPeriodTicks),
      totalPremiumPaid: offer.premium,
    };
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "InsurancePurchased", {
      buildingId: building.id,
      coverage: command.payload.coverage,
      premium: offer.premium,
    });
  }

  if (command.type === "CancelInsurance") {
    const contract = state.phase2.insurance.contractsByBuildingId[command.payload.buildingId];
    if (!contract || contract.status !== "active")
      return { accepted: false, code: "INSURANCE_NOT_FOUND" };
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (!building || building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "INSURANCE_BUILDING_INVALID" };
    contract.status = "cancelled";
    contract.nextPremiumTick = null;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "InsuranceCancelled", {
      buildingId: contract.buildingId,
    });
  }

  if (command.type === "RequestRefinancing") {
    const loan = state.phase2.loans.get(command.payload.loanId);
    if (!loan || loan.borrowerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "LOAN_REFINANCE_UNAVAILABLE" };
    if (!["delinquent", "defaulted"].includes(loan.status))
      return { accepted: false, code: "LOAN_REFINANCE_UNAVAILABLE" };
    const auction = state.phase2.insolvency.auctionsByLoanId[loan.id];
    if (auction?.status === "executed" || auction?.highestBidderOrganizationId)
      return { accepted: false, code: "LOAN_REFINANCE_UNAVAILABLE" };
    const refinancedPrincipal = parseMoney(
      Math.ceil(
        (loan.outstandingPrincipal * (100 + INSOLVENCY_POLICY.refinancingFeePercent)) / 100,
      ),
    );
    loan.principal = refinancedPrincipal;
    loan.outstandingPrincipal = refinancedPrincipal;
    loan.annualInterestRateBps = INSOLVENCY_POLICY.refinancingInterestRateBps;
    loan.termMonths = command.payload.termMonths;
    loan.remainingMonths = command.payload.termMonths;
    loan.status = "active";
    loan.missedPayments = 0;
    loan.nextPaymentTick = parseTick(state.clock.tick + GAME_MONTH_TICKS);
    if (auction) {
      auction.status = "closed";
      auction.highestBid = parseMoney(0);
      auction.highestBidderOrganizationId = null;
      auction.reservedFundsByOrganizationId = {};
    }
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "LoanRefinanced", {
      loanId: loan.id,
      principal: refinancedPrincipal,
      nextPaymentTick: loan.nextPaymentTick,
    });
  }

  if (command.type === "PlaceAuctionBid") {
    const auction = state.phase2.insolvency.auctionsByLoanId[command.payload.loanId];
    if (!auction) return { accepted: false, code: "AUCTION_NOT_FOUND" };
    if (auction.status !== "open") return { accepted: false, code: "AUCTION_NOT_OPEN" };
    if (
      command.payload.amount < auction.reservePrice ||
      command.payload.amount <= auction.highestBid
    )
      return { accepted: false, code: "AUCTION_BID_TOO_LOW" };
    const balance = state.phase2.balances.get(command.actingAsOrganizationId) ?? 0;
    if (
      balance -
        reservedFundsForOrganization(state, command.actingAsOrganizationId, auction.loanId) <
      command.payload.amount
    )
      return { accepted: false, code: "AUCTION_FUNDS_RESERVED" };
    auction.reservedFundsByOrganizationId = {
      [command.actingAsOrganizationId]: command.payload.amount,
    };
    auction.highestBid = command.payload.amount;
    auction.highestBidderOrganizationId = command.actingAsOrganizationId;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "AuctionBidPlaced", {
      loanId: auction.loanId,
      amount: auction.highestBid,
    });
  }

  if (command.type === "WithdrawAuctionBid") {
    const auction = state.phase2.insolvency.auctionsByLoanId[command.payload.loanId];
    if (!auction) return { accepted: false, code: "AUCTION_NOT_FOUND" };
    if (auction.status !== "open") return { accepted: false, code: "AUCTION_NOT_OPEN" };
    if (auction.highestBidderOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "AUCTION_NOT_BIDDER" };
    auction.highestBid = parseMoney(0);
    auction.highestBidderOrganizationId = null;
    auction.reservedFundsByOrganizationId = {};
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "AuctionBidWithdrawn", {
      loanId: auction.loanId,
    });
  }

  if (command.type === "RequestLoan") {
    if (command.actingAsOrganizationId === BANK_ORGANIZATION_ID)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const parcel = state.phase2.parcels.get(command.payload.collateralParcelId);
    if (!parcel) return { accepted: false, code: "LOAN_COLLATERAL_INVALID" };
    if (parcel.disposition !== "marketable")
      return { accepted: false, code: "PUBLIC_LAND_NOT_COLLATERAL" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "LOAN_COLLATERAL_INVALID" };
    if (
      command.payload.amount < LOAN_POLICY.minimumPrincipal ||
      command.payload.amount > LOAN_POLICY.maximumPrincipal ||
      !LOAN_POLICY.allowedTermsMonths.includes(
        command.payload.termMonths as (typeof LOAN_POLICY.allowedTermsMonths)[number],
      )
    )
      return { accepted: false, code: "LOAN_AMOUNT_INVALID" };
    const buildingIndex = buildBuildingIndex(state);
    const collateralValue =
      parcel.marketValue +
      buildingsOnParcel(buildingIndex, parcel.id).reduce(
        (total, building) => total + BUILDING_DEFINITIONS[building.type].cost,
        0,
      );
    if (
      command.payload.amount >
      Math.floor((collateralValue * LOAN_POLICY.collateralLoanToValuePercent) / 100)
    )
      return { accepted: false, code: "LOAN_CAPACITY_EXCEEDED" };
    const outstandingDebt = [...state.phase2.loans.values()]
      .filter(
        (loan) =>
          loan.borrowerOrganizationId === command.actingAsOrganizationId &&
          ["active", "delinquent", "defaulted"].includes(loan.status),
      )
      .reduce((total, loan) => total + loan.outstandingPrincipal, 0);
    if (outstandingDebt + command.payload.amount > LOAN_POLICY.maximumDebt)
      return { accepted: false, code: "LOAN_CAPACITY_EXCEEDED" };
    if (
      [...state.phase2.loans.values()].some(
        (loan) =>
          loan.borrowerOrganizationId === command.actingAsOrganizationId &&
          loan.collateralParcelId === parcel.id &&
          ["offered", "active", "delinquent"].includes(loan.status),
      )
    )
      return { accepted: false, code: "LOAN_ALREADY_ACTIVE" };
    state.phase2.idCounters.loan += 1;
    const loanId = parseLoanId(`loan_${String(state.phase2.idCounters.loan).padStart(8, "0")}`);
    state.phase2.loans.set(loanId, {
      id: loanId,
      borrowerOrganizationId: command.actingAsOrganizationId,
      lenderOrganizationId: BANK_ORGANIZATION_ID,
      principal: command.payload.amount,
      outstandingPrincipal: command.payload.amount,
      annualInterestRateBps:
        LOAN_POLICY.annualInterestRateBps +
        bankRateModifierBpsFor(state, command.actingAsOrganizationId),
      termMonths: command.payload.termMonths,
      remainingMonths: command.payload.termMonths,
      collateralParcelId: parcel.id,
      status: "offered",
      offeredAtTick: parseTick(state.clock.tick),
      acceptedAtTick: null,
      nextPaymentTick: null,
      missedPayments: 0,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "LoanOffered", {
      loanId,
      amount: command.payload.amount,
      termMonths: command.payload.termMonths,
    });
  }

  if (command.type === "AcceptLoanOffer") {
    const loan = state.phase2.loans.get(command.payload.loanId);
    if (!loan) return { accepted: false, code: "LOAN_NOT_FOUND" };
    if (loan.borrowerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (loan.status !== "offered") return { accepted: false, code: "LOAN_NOT_AVAILABLE" };
    if (!debit(state, BANK_ORGANIZATION_ID, loan.principal, "loan_disbursement", loan.id))
      return { accepted: false, code: "LOAN_CAPACITY_EXCEEDED" };
    if (!credit(state, loan.borrowerOrganizationId, loan.principal, "loan_disbursement", loan.id))
      return { accepted: false, code: "LOAN_CAPACITY_EXCEEDED" };
    loan.status = "active";
    loan.acceptedAtTick = parseTick(state.clock.tick);
    loan.nextPaymentTick = parseTick(state.clock.tick + GAME_MONTH_TICKS);
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "LoanAccepted", {
      loanId: loan.id,
      principal: loan.principal,
      nextPaymentTick: loan.nextPaymentTick,
    });
  }

  if (command.type === "BuyMaterials") {
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    if (totalInventory(inventory) + command.payload.amount > inventory.capacity)
      return { accepted: false, code: "INVENTORY_CAPACITY" };
    const cost = parseMoney(
      effectiveMarketPriceFor(state, command.payload.resource) * command.payload.amount,
    );
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
        entry.kind === "legacy" &&
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
    if (parcel.disposition !== "marketable")
      return { accepted: false, code: "PUBLIC_LAND_NOT_FOR_SALE" };
    if (parcel.ownerOrganizationId) return { accepted: false, code: "PARCEL_UNAVAILABLE" };
    const transferRateBps = effectiveTaxRateBps(
      state.phase2.taxation.transferRateBps,
      state.phase2.ordinance.status === "active"
        ? state.phase2.ordinance.transferTaxModifierPercent
        : 0,
    );
    const transferTax = parseMoney(calculateTax(parcel.marketValue, transferRateBps));
    const balance = state.phase2.balances.get(command.actingAsOrganizationId) ?? 0;
    if (balance < parcel.marketValue + transferTax) {
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    }
    debit(state, command.actingAsOrganizationId, parcel.marketValue, "parcel_purchase", parcel.id);
    if (transferTax > 0) {
      debit(state, command.actingAsOrganizationId, transferTax, "property_transfer_tax", parcel.id);
      credit(state, MUNICIPALITY_ORGANIZATION_ID, transferTax, "property_transfer_tax", parcel.id);
      state.phase2.municipal.revenueThisMonthBySource.transferTax = parseMoney(
        (state.phase2.municipal.revenueThisMonthBySource.transferTax ?? 0) + transferTax,
      );
      state.phase2.taxation.totalCollected = parseMoney(
        state.phase2.taxation.totalCollected + transferTax,
      );
    }
    parcel.ownerOrganizationId = command.actingAsOrganizationId;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ParcelPurchased", {
      parcelId: parcel.id,
      ownerOrganizationId: parcel.ownerOrganizationId,
      price: parcel.marketValue,
      transferTax,
    });
  }

  if (command.type === "SellParcel") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    if (!parcel) return { accepted: false, code: "SELL_NOT_AVAILABLE" };
    if (parcel.disposition !== "marketable")
      return { accepted: false, code: "PUBLIC_LAND_NOT_TRANSFERABLE" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "SELL_NOT_AVAILABLE" };
    const sellIndex = buildBuildingIndex(state);
    if (
      buildingsOnParcel(sellIndex, parcel.id).length > 0 ||
      activeSiteOnParcel(state, parcel.id) !== undefined
    )
      return { accepted: false, code: "SELL_NOT_AVAILABLE" };
    const hasActiveLoan = [...state.phase2.loans.values()].some(
      (loan) =>
        loan.collateralParcelId === parcel.id &&
        loan.status !== "paid_off" &&
        loan.status !== "defaulted",
    );
    if (hasActiveLoan) return { accepted: false, code: "SELL_COLLATERAL_LOCKED" };
    const hasOfferedLoan = [...state.phase2.loans.values()].some(
      (loan) => loan.collateralParcelId === parcel.id && loan.status === "offered",
    );
    if (hasOfferedLoan) return { accepted: false, code: "SELL_COLLATERAL_LOCKED" };
    const salePrice = parseMoney(
      Math.floor((parcel.marketValue * RIVAL_AI_POLICY.salePricePercent) / 100),
    );
    if (!debit(state, BANK_ORGANIZATION_ID, salePrice, "asset_sale", parcel.id))
      return { accepted: false, code: "SELL_NOT_AVAILABLE" };
    credit(state, command.actingAsOrganizationId, salePrice, "asset_sale", parcel.id);
    parcel.ownerOrganizationId = null;
    /**
     * La venta no borre el expediente: un permiso es una decisión de la autoridad sobre la parcela,
     * no un atributo del dueño. La obra sigue exigiendo propiedad, así que conservar el registro no
     * permite construir a quien ya no es dueño (H1-03).
     */
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ParcelSold", {
      parcelId: parcel.id,
      salePrice,
      salePricePercent: RIVAL_AI_POLICY.salePricePercent,
    });
  }

  if (command.type === "StartConstruction") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    const definition = BUILDING_DEFINITIONS[command.payload.buildingType];
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    if (parcel.disposition !== "marketable")
      return { accepted: false, code: "PUBLIC_LAND_NOT_BUILDABLE" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!isParcelUseAllowed(parcel, definition))
      return { accepted: false, code: "USE_NOT_ALLOWED" };
    if (activeSiteOnParcel(state, parcel.id)) {
      return { accepted: false, code: "ACTIVE_SITE_ON_PARCEL" };
    }
    /**
     * Solo vale un permiso aprobado, sin consumir, del tipo exacto y sin caducar. Si no lo hay se
     * emite uno nuevo —la autoemisión del flujo actual se conserva— y un rechazo aquí tampoco quema
     * el permiso de una obra que no llega a iniciarse.
     */
    const permit =
      activePermitFor(state, parcel.id, command.payload.buildingType, state.clock.tick) ??
      issuePermit(state, parcel, command.payload.buildingType);
    if (permit.status !== "approved") return { accepted: false, code: "PERMIT_DENIED" };
    const code = effectiveDevelopmentCode(
      permit.developmentCodeIdAtDecision,
      permit.densityBonusFloors,
      permit.densityBonusFarPercent,
    );
    const avenueSegmentIds = new Set(
      state.world.districts
        .get(parcel.districtId)!
        .map.roads.segments.filter((segment) => segment.class === "avenue")
        .map((segment) => segment.id as string),
    );
    const principalFrontageCells = parcel.roadFrontages
      .filter((frontage) => avenueSegmentIds.has(frontage.roadSegmentId))
      .flatMap((frontage) => frontage.cells);
    const buildingIndex = buildBuildingIndex(state);
    const footprint = chooseFootprint({
      parcel,
      code,
      definition,
      principalFrontageCells:
        principalFrontageCells.length > 0
          ? principalFrontageCells
          : parcel.roadFrontages.flatMap((frontage) => frontage.cells),
      buildings: buildingsOnParcel(buildingIndex, parcel.id),
    });
    if ("error" in footprint) return { accepted: false, code: footprint.error };
    const activeSites = [...state.phase2.constructionSites.values()].filter(
      (site) =>
        site.ownerOrganizationId === command.actingAsOrganizationId &&
        site.progress < site.workRequired,
    ).length;
    if (activeSites >= PLAYER_CREW_CAPACITY) return { accepted: false, code: "CREW_UNAVAILABLE" };
    const inventory = state.phase2.inventories.get(command.actingAsOrganizationId)!;
    if (!hasResources(inventory, definition.resources))
      return { accepted: false, code: "INSUFFICIENT_RESOURCES" };
    const materialModifier = 1 + materialCostModifierPercentFor(state) / 100;
    const cost = parseMoney(Math.max(0, Math.round(definition.cost * materialModifier)));
    if (!debit(state, command.actingAsOrganizationId, cost, "construction_start", parcel.id))
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    inventory.cement -= definition.resources.cement;
    inventory.brick -= definition.resources.brick;
    inventory.steel -= definition.resources.steel;
    /**
     * El permiso se consume aquí, cuando ya no queda ningún rechazo posible: footprint, cuadrícula,
     * recursos y fondos se resolvieron antes. Un permiso consumido no puede financiar una segunda
     * obra, y su registro histórico sigue visible con `consumedAtTick`.
     */
    permit.status = "consumed";
    permit.consumedAtTick = parseTick(state.clock.tick);
    /**
     * El modelo construye con recursos y trabajo, no con un coste en caja adicional: el modifier de
     * coste constructivo se aplica como esfuerzo, que es su consumidor semánticamente correcto.
     */
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(
      `site_${String(state.phase2.idCounters.constructionSite).padStart(8, "0")}`,
    );
    state.phase2.constructionSites.set(siteId, {
      id: siteId,
      parcelId: parcel.id,
      districtId: parcel.districtId,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: definition.type,
      footprintCells: footprint.footprintCells.map((cell) => ({ ...cell })),
      orientation: footprint.orientation,
      floors: footprint.floors,
      form: footprint.form,
      progress: 0,
      workRequired: effectiveConstructionWorkRequired(state, definition),
      resourcesReserved: { ...definition.resources },
      crewCapacity: 0,
      upgradeBuildingId: null,
      repairBuildingId: null,
      kind: "construction",
      targetBuildingId: null,
      assignedCrewIds: [],
      assignedTechnicianId: null,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ConstructionStarted", {
      siteId,
      parcelId: parcel.id,
      permitId: permit.id,
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
    if (tenant.marketDistrictId && tenant.marketDistrictId !== building.districtId)
      return { accepted: false, code: "TENANT_INCOMPATIBLE" };
    if (tenant.budget < effectiveRent(state, building))
      return { accepted: false, code: "TENANT_BUDGET_TOO_LOW" };
    building.tenantIds.push(tenant.id);
    building.tenantId = building.tenantIds[0] ?? null;
    tenant.activeContractBuildingId = building.id;
    tenant.status = "contracted";
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
    const activeSites = [...state.phase2.constructionSites.values()].filter(
      (site) =>
        site.ownerOrganizationId === command.actingAsOrganizationId &&
        site.progress < site.workRequired,
    ).length;
    if (activeSites >= PLAYER_CREW_CAPACITY) return { accepted: false, code: "CREW_UNAVAILABLE" };
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
      districtId: building.districtId,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: building.type,
      footprintCells: building.footprintCells.map((cell) => ({ ...cell })),
      orientation: building.orientation,
      floors: building.floors,
      form: building.form,
      progress: 0,
      workRequired: definition.upgradeWorkRequired * 2,
      resourcesReserved: { ...UPGRADE_RESOURCES },
      crewCapacity: 0,
      upgradeBuildingId: building.id,
      repairBuildingId: null,
      kind: "upgrade",
      targetBuildingId: building.id,
      assignedCrewIds: [],
      assignedTechnicianId: null,
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
      districtId: building.districtId,
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: building.type,
      footprintCells: building.footprintCells.map((cell) => ({ ...cell })),
      orientation: building.orientation,
      floors: building.floors,
      form: building.form,
      progress: 0,
      workRequired: REPAIR_WORK_REQUIRED * 2,
      resourcesReserved: { cement: 0, brick: 0, steel: 0 },
      crewCapacity: 0,
      upgradeBuildingId: null,
      repairBuildingId: building.id,
      kind: "repair",
      targetBuildingId: building.id,
      assignedCrewIds: [],
      assignedTechnicianId: null,
    });
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "RepairStarted", {
      siteId,
      buildingId: building.id,
    });
  }

  if (command.type === "AssignCrewToWorkOrder") {
    const site = state.phase2.constructionSites.get(command.payload.workOrderId);
    const crew = state.phase2.crews.get(command.payload.crewId);
    if (!site) return { accepted: false, code: "CONSTRUCTION_SITE_NOT_FOUND" };
    if (!crew) return { accepted: false, code: "CREW_NOT_FOUND" };
    if (
      site.ownerOrganizationId !== command.actingAsOrganizationId ||
      crew.organizationId !== command.actingAsOrganizationId
    )
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const parcel = state.phase2.parcels.get(site.parcelId);
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    const siteMap = districtMapOf(state, parcel.districtId);
    const obstacles = districtObstacles(state, parcel.districtId);
    const candidates = interactionCellCandidates(
      site.footprintCells,
      obstacles,
      siteMap.width,
      siteMap.height,
    );
    if (candidates.length === 0) return { accepted: false, code: "INVALID_AGENT_ACTION" };
    // Construction needs the crew physically in the target district (D-088): transfers are an
    // explicit command, never an implicit teleport inside an assignment.
    // El viaje se comprueba antes que la distancia: "ya está viajando" explica mejor el rechazo
    // que "no está en el distrito", que también sería cierto mientras el agente va de camino.
    const memberIds = [crew.supervisorAgentId, ...crew.workerAgentIds];
    if (memberIds.some((agentId) => state.agents.get(agentId)?.travel))
      return { accepted: false, code: "AGENT_ALREADY_TRAVELLING" };
    if (
      memberIds.some((agentId) => {
        const member = state.agents.get(agentId);
        return member !== undefined && member.districtId !== parcel.districtId;
      })
    ) {
      return { accepted: false, code: "AGENT_NOT_IN_DISTRICT" };
    }
    /**
     * Entre las celdas válidas se elige la primera alcanzable por toda la cuadrilla en orden canónico:
     * se recorre la lista, no el orden de inserción de un `Map`, y si ninguna se alcanza la obra es
     * inaccesible y la orden se rechaza en vez de dejar a la cuadrilla caminando hacia la nada.
     */
    const interactionCell = candidates.find((cell) =>
      memberIds.every((agentId) => {
        const member = state.agents.get(agentId);
        if (!member) return false;
        if (member.cell.x === cell.x && member.cell.y === cell.y) return true;
        return findDeterministicPath(member.cell, cell, obstacles.impassable).length > 0;
      }),
    );
    if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
    for (const other of state.phase2.constructionSites.values()) {
      if (other.assignedCrewIds.includes(crew.id)) {
        for (const agentId of memberIds) {
          const member = state.agents.get(agentId);
          if (member?.task?.kind === "work_order" && member.task.workOrderId === other.id) {
            member.task = null;
            if (member.state !== "dead" && member.state !== "injured") member.state = "idle";
          }
        }
      }
      other.assignedCrewIds = other.assignedCrewIds.filter((id) => id !== crew.id);
    }
    site.assignedCrewIds.push(crew.id);
    for (const agentId of memberIds) {
      const agent = state.agents.get(agentId);
      if (!agent || agent.state === "dead" || agent.state === "injured") continue;
      agent.task = { kind: "work_order", workOrderId: site.id };
      agent.target = { ...interactionCell };
      agent.path = findDeterministicPath(agent.cell, interactionCell, obstacles.impassable);
      agent.state = "moving";
    }
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "CrewAssignedToWorkOrder", {
      crewId: crew.id,
      workOrderId: site.id,
    });
  }
  if (command.type === "AssignMaintenance") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (!building) return { accepted: false, code: "BUILDING_NOT_FOUND" };
    if (building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const buildingParcel = state.phase2.parcels.get(building.parcelId);
    if (!buildingParcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    /**
     * Técnico elegible de menor id: un `find` sobre el orden de inserción del `Map` daría otro
     * resultado si ese orden cambiara, y la asignación tiene que ser canónica.
     */
    const technician = [...state.agents.values()]
      .filter(
        (agent) =>
          agent.organizationId === command.actingAsOrganizationId &&
          agent.specialty === "maintenance_technician" &&
          agent.districtId === buildingParcel.districtId &&
          agent.state === "idle" &&
          !agent.travel &&
          !agent.task,
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!technician) return { accepted: false, code: "AGENT_NOT_FOUND" };
    const maintenanceMap = districtMapOf(state, buildingParcel.districtId);
    const obstacles = districtObstacles(state, buildingParcel.districtId);
    /**
     * Se trabaja junto a la huella del edificio, no junto al ancla de la parcela: en una parcela con
     * dos edificios el ancla puede estar sobre el otro, y el técnico contaba como operativo sin
     * estarlo. La tarea sólo se escribe cuando ya hay destino, para no dejarla huérfana.
     */
    const interactionCell = interactionCellCandidates(
      building.footprintCells,
      obstacles,
      maintenanceMap.width,
      maintenanceMap.height,
    ).find(
      (cell) =>
        (technician.cell.x === cell.x && technician.cell.y === cell.y) ||
        findDeterministicPath(technician.cell, cell, obstacles.impassable).length > 0,
    );
    if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
    technician.task = { kind: "maintenance", buildingId: building.id };
    technician.target = { ...interactionCell };
    technician.path = findDeterministicPath(technician.cell, interactionCell, obstacles.impassable);
    technician.state = "moving";
    const repairOrder = [...state.phase2.constructionSites.values()].find(
      (site) =>
        site.repairBuildingId === building.id ||
        (site.kind === "repair" && site.targetBuildingId === building.id),
    );
    if (repairOrder) repairOrder.assignedTechnicianId = technician.id;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "MaintenanceAssigned", {
      buildingId: building.id,
      technicianId: technician.id,
    });
  }
  if (command.type === "OrderEnforcerAction") {
    const enforcer = state.agents.get(command.payload.enforcerAgentId);
    if (!enforcer || enforcer.specialty !== "enforcer")
      return { accepted: false, code: "AGENT_NOT_FOUND" };
    if (enforcer.organizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (enforcer.travel) return { accepted: false, code: "AGENT_ALREADY_TRAVELLING" };
    if (command.payload.action === "attack_agent" && command.payload.targetAgentId) {
      const target = state.agents.get(command.payload.targetAgentId);
      if (!target || target.organizationId === enforcer.organizationId)
        return { accepted: false, code: "INVALID_AGENT_ACTION" };
      if (target.districtId !== enforcer.districtId)
        return { accepted: false, code: "AGENT_NOT_IN_DISTRICT" };
      enforcer.task = { kind: "attack_agent", targetAgentId: target.id };
      enforcer.target = { ...target.cell };
      enforcer.state = "moving";
    } else if (command.payload.action === "sabotage_building" && command.payload.targetBuildingId) {
      const target = state.phase2.buildings.get(command.payload.targetBuildingId);
      if (!target || target.ownerOrganizationId === enforcer.organizationId)
        return { accepted: false, code: "INVALID_AGENT_ACTION" };
      const targetParcel = state.phase2.parcels.get(target.parcelId);
      if (!targetParcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
      if (enforcer.districtId !== targetParcel.districtId)
        return { accepted: false, code: "AGENT_NOT_IN_DISTRICT" };
      const sabotageMap = districtMapOf(state, targetParcel.districtId);
      const obstacles = districtObstacles(state, targetParcel.districtId);
      const interactionCell = interactionCellCandidates(
        target.footprintCells,
        obstacles,
        sabotageMap.width,
        sabotageMap.height,
      ).find(
        (cell) =>
          (enforcer.cell.x === cell.x && enforcer.cell.y === cell.y) ||
          findDeterministicPath(enforcer.cell, cell, obstacles.impassable).length > 0,
      );
      if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
      enforcer.task = { kind: "sabotage_building", targetBuildingId: target.id };
      enforcer.target = { ...interactionCell };
      enforcer.path = findDeterministicPath(enforcer.cell, interactionCell, obstacles.impassable);
      enforcer.state = "moving";
    } else return { accepted: false, code: "INVALID_AGENT_ACTION" };
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "EnforcerOrdered", {
      enforcerAgentId: enforcer.id,
      action: command.payload.action,
    });
  }
  if (command.type === "ClearRuin") {
    const building = state.phase2.buildings.get(command.payload.buildingId);
    if (!building) return { accepted: false, code: "BUILDING_NOT_FOUND" };
    if (building.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (building.state !== "ruin") return { accepted: false, code: "RUIN_REQUIRED" };
    state.phase2.idCounters.constructionSite += 1;
    const siteId = parseConstructionSiteId(
      `site_${String(state.phase2.idCounters.constructionSite).padStart(8, "0")}`,
    );
    state.phase2.constructionSites.set(siteId, {
      id: siteId,
      parcelId: building.parcelId,
      districtId: building.districtId,
      ownerOrganizationId: building.ownerOrganizationId,
      buildingType: building.type,
      footprintCells: building.footprintCells.map((cell) => ({ ...cell })),
      orientation: building.orientation,
      floors: building.floors,
      form: building.form,
      progress: 0,
      workRequired: 48,
      resourcesReserved: { cement: 0, brick: 0, steel: 0 },
      crewCapacity: 0,
      upgradeBuildingId: null,
      repairBuildingId: null,
      kind: "clear_ruin",
      targetBuildingId: building.id,
      assignedCrewIds: [],
      assignedTechnicianId: null,
    });
    reconcileParcelUses(state, building.parcelId);
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "RuinClearStarted", {
      buildingId: building.id,
      siteId,
    });
  }

  if (command.type === "ProposePolicy") {
    const policy = createMunicipalPolicy(command.payload.policyId);
    if (!policy || ["active", "approved"].includes(state.phase2.ordinance.status))
      return { accepted: false, code: "POLICY_NOT_AVAILABLE" };
    state.phase2.ordinance = {
      ...policy,
      status: "proposed",
      proposedAtTick: parseTick(state.clock.tick),
      activeFromTick: null,
      expiresAtTick: null,
    };
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "PolicyProposed", {
      policyId: policy.id,
      name: policy.name,
      influenceRequired: policy.influenceRequired,
      approvalChancePercent: policy.approvalChancePercent,
    });
  }

  /**
   * Desde WP4.11 una ordenanza `active` puede la impuso el concejo, no la jugadora. Retirarla sería
   * borrar una norma municipal ya vigente y dejar al gobierno sin calendario, así que sólo se
   * retiran propuestas: la ley en vigor caduca por MUNICIPAL_POLICY_DURATION_TICKS.
   */
  if (command.type === "WithdrawPolicy") {
    const ordinance = state.phase2.ordinance;
    if (ordinance.id !== command.payload.policyId || ordinance.status !== "proposed")
      return { accepted: false, code: "POLICY_NOT_AVAILABLE" };
    ordinance.status = "withdrawn";
    ordinance.activeFromTick = null;
    ordinance.expiresAtTick = null;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "PolicyWithdrawn", {
      policyId: ordinance.id,
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
    /** El concejo gobernante empuja o frena: la influencia ya no compra la ley por sí sola. */
    const alignment = councilAlignmentPercent(state, ordinance);
    const chance = Math.min(
      95,
      Math.max(
        5,
        ordinance.approvalChancePercent + (command.payload.influenceSpend - 1) * 15 + alignment,
      ),
    );
    const approved = generator.nextInt(0, 100) < chance;
    state.prng = generator.exportState();
    ordinance.status = approved ? "active" : "rejected";
    ordinance.proposedAtTick = state.clock.tick;
    ordinance.activeFromTick = approved ? state.clock.tick : null;
    ordinance.expiresAtTick = approved
      ? parseTick(state.clock.tick + MUNICIPAL_POLICY_DURATION_TICKS)
      : null;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, approved ? "PolicyEnacted" : "PolicyRejected", {
      policyId: ordinance.id,
      expiresAtTick: ordinance.expiresAtTick,
      approvalChancePercent: chance,
      councilAlignmentPercent: alignment,
      influenceSpent: command.payload.influenceSpend,
    });
  }

  if (command.type === "SubmitPublicBid") {
    const rejection = submitPublicBid(
      state,
      command.actingAsOrganizationId,
      command.payload.contractId,
      command.payload.amount,
    );
    if (rejection) return { accepted: false, code: rejection };
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "PublicBidSubmitted", {
      contractId: command.payload.contractId,
      amount: command.payload.amount,
    });
  }

  if (command.type === "CommissionIntelligence") {
    const rejection = commissionRejection(
      state,
      command.actingAsOrganizationId,
      command.payload.subjectOrganizationId,
    );
    if (rejection) return { accepted: false, code: rejection };
    if (
      !debit(
        state,
        command.actingAsOrganizationId,
        parseMoney(INFORMATION_POLICY.commissionCost),
        "intelligence_commission",
        command.payload.kind,
      )
    )
      return { accepted: false, code: "INTEL_UNAFFORDABLE" };
    const estimate = commissionIntelligence(
      state,
      command.payload.subjectOrganizationId,
      command.payload.kind,
    );
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "IntelligenceCommissioned", {
      subjectOrganizationId: estimate.subjectOrganizationId,
      kind: estimate.kind,
      estimateId: estimate.id,
      cost: INFORMATION_POLICY.commissionCost,
    });
  }

  if (command.type === "TransferCrew") {
    const crew = state.phase2.crews.get(command.payload.crewId);
    if (!crew) return { accepted: false, code: "CREW_NOT_FOUND" };
    if (crew.organizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!state.world.districts.has(command.payload.toDistrictId))
      return { accepted: false, code: "DISTRICT_NOT_FOUND" };
    const members = [crew.supervisorAgentId, ...crew.workerAgentIds]
      .map((agentId) => state.agents.get(agentId))
      .filter((agent): agent is NonNullable<typeof agent> => agent !== undefined);
    if (members.length === 0) return { accepted: false, code: "AGENT_NOT_FOUND" };
    if (members.some((agent) => agent.districtId !== members[0]!.districtId))
      return { accepted: false, code: "AGENT_NOT_IN_DISTRICT" };
    if (members.some((agent) => agent.travel))
      return { accepted: false, code: "AGENT_ALREADY_TRAVELLING" };
    const plan = startAgentTravel(state, members[0]!.id, command.payload.toDistrictId);
    if (!plan) return { accepted: false, code: "DISTRICT_NOT_CONNECTED" };
    for (const agent of members.slice(1)) {
      startAgentTravel(state, agent.id, command.payload.toDistrictId);
    }
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "CrewTransferred", {
      crewId: crew.id,
      toDistrictId: command.payload.toDistrictId,
      arriveAtTick: Number(plan.arriveAtTick),
      route: plan.route,
    });
  }
  if (command.type === "TransferAgent") {
    const agent = state.agents.get(command.payload.agentId);
    if (!agent) return { accepted: false, code: "AGENT_NOT_FOUND" };
    if (agent.organizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!state.world.districts.has(command.payload.toDistrictId))
      return { accepted: false, code: "DISTRICT_NOT_FOUND" };
    if (agent.travel) return { accepted: false, code: "AGENT_ALREADY_TRAVELLING" };
    const plan = startAgentTravel(state, agent.id, command.payload.toDistrictId);
    if (!plan) return { accepted: false, code: "DISTRICT_NOT_CONNECTED" };
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "AgentTransferred", {
      agentId: agent.id,
      toDistrictId: command.payload.toDistrictId,
      arriveAtTick: Number(plan.arriveAtTick),
      route: plan.route,
    });
  }
  // A partir de aquí sólo queda el comando ilegal.
  if (command.type !== "CommitCrime") {
    return { accepted: false, code: "INVALID_PAYLOAD" };
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
  /** El saboteado forma hostilidad hacia quien lo atacó, si la víctima es una empresa del distrito. */
  if (state.organizations.get(command.payload.targetOrganizationId)?.kind === "company")
    recordFactionEncounter(
      state,
      command.payload.targetOrganizationId,
      command.actingAsOrganizationId,
      "sabotage",
    );
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
  if (!state.world.districts.has(command.payload.districtId)) {
    return { accepted: false, code: "DISTRICT_NOT_FOUND" };
  }
  if (!inMap(state, command.payload.districtId, command.payload.cell)) {
    return { accepted: false, code: "CELL_OUT_OF_BOUNDS" };
  }
  if (
    blockedCellsOf(state, command.payload.districtId).has(cellKey(command.payload.cell)) ||
    hasStructureAt(state, command.payload.districtId, command.payload.cell)
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
    districtId: command.payload.districtId,
    cell: { ...command.payload.cell },
  });
  state.processedCommandIds.add(command.commandId);

  return { accepted: true, event };
}

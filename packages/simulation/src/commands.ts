import {
  addMoney,
  parseEventId,
  parseConstructionSiteId,
  parseMoney,
  parseTransactionId,
  parseStructureId,
  parseTick,
  parseLoanId,
  type ProductCommand,
  subtractMoney,
  type ErrorCode,
  type PlaceTestStructure,
  type TestStructurePlaced,
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
  BANK_ORGANIZATION_ID,
  LOAN_POLICY,
  GAME_MONTH_TICKS,
  effectiveTaxRateBps,
  calculateTax,
  MUNICIPALITY_ORGANIZATION_ID,
  conditionRentMultiplierPercent,
  INSURANCE_POLICY,
  calculateInsuranceOffer,
  permitRequirements,
} from "./game-data";
import { Xoshiro128ss } from "./prng";
import { chooseInteractionCell, findDeterministicPath } from "./navigation";

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

function occupiedBuildingCells(
  state: GameState,
  excludingBuildingId?: import("@landlord/shared").BuildingId,
): Set<string> {
  return new Set(
    [...state.phase2.buildings.values()]
      .filter((building) => building.id !== excludingBuildingId)
      .map((building) => {
        const cell = state.phase2.parcels.get(building.parcelId)!.cell;
        return String(cell.x) + ":" + String(cell.y);
      }),
  );
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
        policyModifier *
        (conditionRentMultiplierPercent(building.condition) / 100),
    ),
  );
}

function issuePermit(
  state: GameState,
  parcel: import("@landlord/shared").Parcel,
  buildingType: import("@landlord/shared").BuildingType,
): "approved" | "denied" {
  const existing = state.phase2.permitting.permitsByParcelId[parcel.id];
  if (
    existing?.status === "approved" &&
    existing.buildingType === buildingType &&
    (existing.expiresAtTick === null || existing.expiresAtTick > state.clock.tick)
  )
    return "approved";
  if (existing?.status === "approved" && existing.expiresAtTick !== null)
    existing.status = "expired";
  const baseChance = state.phase2.permitting.approvalChanceByZoning[parcel.zoning];
  const ordinanceModifier =
    state.phase2.ordinance.status === "active"
      ? state.phase2.ordinance.permitApprovalModifierPercent
      : 0;
  const chance = Math.max(0, Math.min(100, baseChance + ordinanceModifier));
  let approved = chance >= 100;
  if (chance > 0 && chance < 100) {
    const generator = new Xoshiro128ss(state.seed);
    generator.restoreState(state.prng);
    approved = generator.nextInt(0, 100) < chance;
    state.prng = generator.exportState();
  }
  state.phase2.permitting.permitsByParcelId[parcel.id] = {
    parcelId: parcel.id,
    buildingType,
    authorityOrganizationId: MUNICIPALITY_ORGANIZATION_ID,
    requirements: permitRequirements(parcel.zoning, buildingType),
    zoningAtDecision: parcel.zoning,
    status: approved ? "approved" : "denied",
    requestedAtTick: parseTick(state.clock.tick),
    decidedAtTick: parseTick(state.clock.tick),
    expiresAtTick: approved
      ? parseTick(state.clock.tick + state.phase2.permitting.validityTicks)
      : null,
  };
  return approved ? "approved" : "denied";
}

export function debit(
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

export function credit(
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

  if (command.type === "RequestPermit") {
    const parcel = state.phase2.parcels.get(command.payload.parcelId);
    const definition = BUILDING_DEFINITIONS[command.payload.buildingType];
    if (!parcel) return { accepted: false, code: "PARCEL_NOT_FOUND" };
    if (parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    if (!definition.allowedZoning.includes(parcel.zoning))
      return { accepted: false, code: "INVALID_ZONING" };
    const status = issuePermit(state, parcel, command.payload.buildingType);
    rememberProcessed(state, command.commandId);
    return productEvent(
      state,
      command.commandId,
      status === "approved" ? "PermitApproved" : "PermitDenied",
      {
        parcelId: parcel.id,
        buildingType: command.payload.buildingType,
        status,
        expiresAtTick: state.phase2.permitting.permitsByParcelId[parcel.id]!.expiresAtTick,
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

  if (command.type === "RequestLoan") {
    if (command.actingAsOrganizationId === BANK_ORGANIZATION_ID)
      return { accepted: false, code: "ACTOR_NOT_AUTHORIZED" };
    const parcel = state.phase2.parcels.get(command.payload.collateralParcelId);
    if (!parcel || parcel.ownerOrganizationId !== command.actingAsOrganizationId)
      return { accepted: false, code: "LOAN_COLLATERAL_INVALID" };
    if (
      command.payload.amount < LOAN_POLICY.minimumPrincipal ||
      command.payload.amount > LOAN_POLICY.maximumPrincipal ||
      !LOAN_POLICY.allowedTermsMonths.includes(
        command.payload.termMonths as (typeof LOAN_POLICY.allowedTermsMonths)[number],
      )
    )
      return { accepted: false, code: "LOAN_AMOUNT_INVALID" };
    const collateralValue =
      parcel.price +
      (parcel.buildingId
        ? (BUILDING_DEFINITIONS[
            state.phase2.buildings.get(parcel.buildingId)?.type ?? "courtyard_home"
          ]?.cost ?? 0)
        : 0);
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
      annualInterestRateBps: LOAN_POLICY.annualInterestRateBps,
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
    if (parcel.ownerOrganizationId) return { accepted: false, code: "PARCEL_UNAVAILABLE" };
    const transferRateBps = effectiveTaxRateBps(
      state.phase2.taxation.transferRateBps,
      state.phase2.ordinance.status === "active"
        ? state.phase2.ordinance.transferTaxModifierPercent
        : 0,
    );
    const transferTax = parseMoney(calculateTax(parcel.price, transferRateBps));
    const balance = state.phase2.balances.get(command.actingAsOrganizationId) ?? 0;
    if (balance < parcel.price + transferTax) {
      return { accepted: false, code: "INSUFFICIENT_FUNDS" };
    }
    debit(state, command.actingAsOrganizationId, parcel.price, "parcel_purchase", parcel.id);
    if (transferTax > 0) {
      debit(state, command.actingAsOrganizationId, transferTax, "property_transfer_tax", parcel.id);
      credit(state, MUNICIPALITY_ORGANIZATION_ID, transferTax, "property_transfer_tax", parcel.id);
      state.phase2.taxation.totalCollected = parseMoney(
        state.phase2.taxation.totalCollected + transferTax,
      );
    }
    parcel.ownerOrganizationId = command.actingAsOrganizationId;
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "ParcelPurchased", {
      parcelId: parcel.id,
      ownerOrganizationId: parcel.ownerOrganizationId,
      price: parcel.price,
      transferTax,
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
    const permit = state.phase2.permitting.permitsByParcelId[parcel.id];
    if (
      permit?.status !== "approved" ||
      permit.buildingType !== command.payload.buildingType ||
      (permit.expiresAtTick !== null && permit.expiresAtTick <= state.clock.tick)
    ) {
      if (issuePermit(state, parcel, command.payload.buildingType) !== "approved")
        return { accepted: false, code: "PERMIT_DENIED" };
    }
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
      workRequired: definition.workRequired * 2,
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
      ownerOrganizationId: command.actingAsOrganizationId,
      buildingType: building.type,
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
    const interactionCell = parcel
      ? chooseInteractionCell(
          parcel.cell,
          state.map.blockedCells,
          64,
          64,
          occupiedBuildingCells(state),
        )
      : null;
    if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
    for (const other of state.phase2.constructionSites.values()) {
      if (other.assignedCrewIds.includes(crew.id)) {
        for (const agentId of [crew.supervisorAgentId, ...crew.workerAgentIds]) {
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
    for (const agentId of [crew.supervisorAgentId, ...crew.workerAgentIds]) {
      const agent = state.agents.get(agentId);
      if (!agent || agent.state === "dead" || agent.state === "injured") continue;
      agent.task = { kind: "work_order", workOrderId: site.id };
      agent.target = { ...interactionCell };
      agent.path = findDeterministicPath(agent.cell, interactionCell, state.map.blockedCells);
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
    const technician = [...state.agents.values()].find(
      (agent) =>
        agent.organizationId === command.actingAsOrganizationId &&
        agent.specialty === "maintenance_technician" &&
        agent.state === "idle" &&
        !agent.task,
    );
    if (!technician) return { accepted: false, code: "AGENT_NOT_FOUND" };
    technician.task = { kind: "maintenance", buildingId: building.id };
    const interactionCell = chooseInteractionCell(
      state.phase2.parcels.get(building.parcelId)!.cell,
      state.map.blockedCells,
      64,
      64,
      occupiedBuildingCells(state, building.id),
    );
    if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
    technician.target = { ...interactionCell };
    technician.path = findDeterministicPath(
      technician.cell,
      interactionCell,
      state.map.blockedCells,
    );
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
    if (command.payload.action === "attack_agent" && command.payload.targetAgentId) {
      const target = state.agents.get(command.payload.targetAgentId);
      if (!target || target.organizationId === enforcer.organizationId)
        return { accepted: false, code: "INVALID_AGENT_ACTION" };
      enforcer.task = { kind: "attack_agent", targetAgentId: target.id };
      enforcer.target = { ...target.cell };
      enforcer.state = "moving";
    } else if (command.payload.action === "sabotage_building" && command.payload.targetBuildingId) {
      const target = state.phase2.buildings.get(command.payload.targetBuildingId);
      if (!target || target.ownerOrganizationId === enforcer.organizationId)
        return { accepted: false, code: "INVALID_AGENT_ACTION" };
      const interactionCell = chooseInteractionCell(
        state.phase2.parcels.get(target.parcelId)!.cell,
        state.map.blockedCells,
        64,
        64,
        occupiedBuildingCells(state, target.id),
      );
      if (!interactionCell) return { accepted: false, code: "INVALID_AGENT_ACTION" };
      enforcer.task = { kind: "sabotage_building", targetBuildingId: target.id };
      enforcer.target = { ...interactionCell };
      enforcer.path = findDeterministicPath(enforcer.cell, interactionCell, state.map.blockedCells);
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
      ownerOrganizationId: building.ownerOrganizationId,
      buildingType: building.type,
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
    rememberProcessed(state, command.commandId);
    return productEvent(state, command.commandId, "RuinClearStarted", {
      buildingId: building.id,
      siteId,
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

import {
  parseMoney,
  parseTick,
  type ErrorCode,
  type Money,
  type OrganizationId,
  type PublicContract,
  type PublicContractKind,
  type PublicContractsState,
} from "@landlord/shared";

import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
} from "./game-data";
import { credit, debit } from "./ledger";
import type { GameState } from "./state";

type ContractSpec = {
  kind: PublicContractKind;
  title: string;
  budget: number;
  requiredBuildings: number;
};

export const PUBLIC_CONTRACTS_POLICY = {
  /**
   * La autoridad contrata por calendario: mes 2 y cada 3 meses. No se publica nada antes porque
   * el primer cierre mensual debe asentar rentas, impuestos y presupuesto.
   */
  firstPublishMonth: 2,
  publishEveryMonths: 3,
  maxOpenContracts: 2,
  bidWindowMonths: 1,
  executionMonths: 1,
  /** Fianza sobre el presupuesto: se cobra al adjudicar y se devuelve al completar. */
  bondPercent: 10,
  historyLimit: 24,
  rivalBidPercent: 92,
  catalog: [
    {
      kind: "public_works",
      title: "Rehabilitación de aceras del casco",
      budget: 420,
      requiredBuildings: 1,
    },
    {
      kind: "supply",
      title: "Suministro de materiales al depósito municipal",
      budget: 260,
      requiredBuildings: 0,
    },
    {
      kind: "public_works",
      title: "Mantenimiento de la red de farolas",
      budget: 360,
      requiredBuildings: 1,
    },
  ] as const satisfies readonly ContractSpec[],
};

export function initialPublicContractsState(): PublicContractsState {
  return {
    lastPublishedTick: null,
    nextOrdinal: 1,
    contracts: {},
    reliabilityByOrganizationId: {},
  };
}

export function bondFor(budget: Money | number): Money {
  return parseMoney(Math.max(1, Math.ceil((budget * PUBLIC_CONTRACTS_POLICY.bondPercent) / 100)));
}

export function operationalBuildingsOwned(
  state: GameState,
  organizationId: OrganizationId,
): number {
  let count = 0;
  for (const building of state.phase2.buildings.values()) {
    if (
      building.ownerOrganizationId === organizationId &&
      building.state === "operational" &&
      building.condition > 0
    )
      count += 1;
  }
  return count;
}

export function hasActiveAward(state: GameState, organizationId: OrganizationId): boolean {
  return Object.values(state.phase2.contracts.contracts).some(
    (contract) =>
      contract.status === "awarded" && contract.awardedToOrganizationId === organizationId,
  );
}

function reliabilityFor(state: GameState, organizationId: OrganizationId) {
  const key = organizationId as string;
  const current = state.phase2.contracts.reliabilityByOrganizationId[key];
  if (current) return current;
  const created = { awarded: 0, completed: 0, defaulted: 0 };
  state.phase2.contracts.reliabilityByOrganizationId[key] = created;
  return created;
}

function compareBids(
  left: PublicContract["bids"][number],
  right: PublicContract["bids"][number],
): number {
  return left.amount - right.amount || left.organizationId.localeCompare(right.organizationId);
}

/** Valida y registra una oferta. Devuelve el código de rechazo o `null` si se aceptó. */
export function submitPublicBid(
  state: GameState,
  organizationId: OrganizationId,
  contractId: string,
  amount: Money,
): ErrorCode | null {
  const contract = state.phase2.contracts.contracts[contractId];
  if (!contract) return "CONTRACT_NOT_FOUND";
  if (state.organizations.get(organizationId)?.kind !== "company") return "ACTOR_NOT_AUTHORIZED";
  if (contract.status !== "open" || state.clock.tick >= contract.closesAtTick)
    return "CONTRACT_CLOSED";
  if (contract.bids.some((bid) => bid.organizationId === organizationId))
    return "BID_ALREADY_SUBMITTED";
  if (amount <= 0 || amount > contract.budget) return "BID_EXCEEDS_BUDGET";
  if (hasActiveAward(state, organizationId)) return "CONTRACT_CONFLICT";
  if (operationalBuildingsOwned(state, organizationId) < contract.requiredBuildings)
    return "CONTRACT_CAPACITY";
  if ((state.phase2.balances.get(organizationId) ?? 0) < contract.bond) return "BOND_UNAVAILABLE";
  contract.bids.push({
    organizationId,
    amount,
    atTick: parseTick(state.clock.tick),
  });
  contract.bids.sort(compareBids);
  return null;
}

function closeTender(state: GameState, contract: PublicContract): void {
  const winner = [...contract.bids]
    .sort(compareBids)
    .find(
      (bid) =>
        state.organizations.get(bid.organizationId)?.kind === "company" &&
        !hasActiveAward(state, bid.organizationId) &&
        (state.phase2.balances.get(bid.organizationId) ?? 0) >= contract.bond,
    );
  if (!winner) {
    // Sin ofertas válidas no hay adjudicación: el contrato queda desierto, no se cobra fianza.
    contract.status = "failed";
    return;
  }
  if (!debit(state, winner.organizationId, contract.bond, "contract_bond", contract.id)) {
    contract.status = "failed";
    return;
  }
  credit(state, MUNICIPALITY_ORGANIZATION_ID, contract.bond, "contract_bond", contract.id);
  contract.status = "awarded";
  contract.awardedToOrganizationId = winner.organizationId;
  contract.awardedAmount = winner.amount;
  contract.executesAtTick = parseTick(
    state.clock.tick + PUBLIC_CONTRACTS_POLICY.executionMonths * GAME_MONTH_TICKS,
  );
  reliabilityFor(state, winner.organizationId).awarded += 1;
}

function executeAwarded(state: GameState, contract: PublicContract): void {
  const contractorId = contract.awardedToOrganizationId;
  const awardedAmount = contract.awardedAmount;
  if (!contractorId || awardedAmount === null) {
    contract.status = "failed";
    return;
  }
  if (operationalBuildingsOwned(state, contractorId) < contract.requiredBuildings) {
    // La fianza ya está en la caja municipal: incumplir la retiene y deja constancia.
    contract.status = "defaulted";
    reliabilityFor(state, contractorId).defaulted += 1;
    return;
  }
  const owed = parseMoney(awardedAmount + contract.bond);
  if ((state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? 0) < owed) {
    // El municipio no puede pagar todavía: el contrato sigue adjudicado y se reintenta al mes
    // siguiente, en vez de incumplir por un problema de tesorería de la autoridad.
    contract.executesAtTick = parseTick(state.clock.tick + GAME_MONTH_TICKS);
    return;
  }
  debit(state, MUNICIPALITY_ORGANIZATION_ID, owed, "contract_payment", contract.id);
  credit(state, contractorId, awardedAmount, "contract_payment", contract.id);
  credit(state, contractorId, contract.bond, "contract_bond_refund", contract.id);
  contract.status = "completed";
  reliabilityFor(state, contractorId).completed += 1;
}

function publishContract(state: GameState): void {
  const spec =
    PUBLIC_CONTRACTS_POLICY.catalog[
      (state.phase2.contracts.nextOrdinal - 1) % PUBLIC_CONTRACTS_POLICY.catalog.length
    ]!;
  const id = `contract_${String(state.phase2.contracts.nextOrdinal).padStart(8, "0")}`;
  const budget = parseMoney(spec.budget);
  state.phase2.contracts.contracts[id] = {
    id,
    kind: spec.kind,
    title: spec.title,
    budget,
    bond: bondFor(budget),
    requiredBuildings: spec.requiredBuildings,
    publishedAtTick: parseTick(state.clock.tick),
    closesAtTick: parseTick(
      state.clock.tick + PUBLIC_CONTRACTS_POLICY.bidWindowMonths * GAME_MONTH_TICKS,
    ),
    // Estimación de calendario; la adjudicación la reescribe al cerrar la licitación.
    executesAtTick: parseTick(
      state.clock.tick +
        (PUBLIC_CONTRACTS_POLICY.bidWindowMonths + PUBLIC_CONTRACTS_POLICY.executionMonths) *
          GAME_MONTH_TICKS,
    ),
    status: "open",
    awardedToOrganizationId: null,
    awardedAmount: null,
    bids: [],
  };
  state.phase2.contracts.nextOrdinal += 1;
  state.phase2.contracts.lastPublishedTick = parseTick(state.clock.tick);
}

function pruneHistory(state: GameState): void {
  const settled = Object.values(state.phase2.contracts.contracts)
    .filter((contract) => !["open", "awarded"].includes(contract.status))
    .sort((left, right) => left.id.localeCompare(right.id));
  const excess = settled.length - PUBLIC_CONTRACTS_POLICY.historyLimit;
  for (let index = 0; index < excess; index += 1)
    delete state.phase2.contracts.contracts[settled[index]!.id];
}

export function runPublicContracts(state: GameState): void {
  if (state.clock.tick === 0 || state.clock.tick % GAME_MONTH_TICKS !== 0) return;
  const ordered = Object.values(state.phase2.contracts.contracts).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  for (const contract of ordered)
    if (contract.status === "awarded" && contract.executesAtTick <= state.clock.tick)
      executeAwarded(state, contract);
  for (const contract of ordered)
    if (contract.status === "open" && contract.closesAtTick <= state.clock.tick)
      closeTender(state, contract);

  const month = state.clock.tick / GAME_MONTH_TICKS;
  const due =
    month >= PUBLIC_CONTRACTS_POLICY.firstPublishMonth &&
    (month - PUBLIC_CONTRACTS_POLICY.firstPublishMonth) %
      PUBLIC_CONTRACTS_POLICY.publishEveryMonths ===
      0;
  const active = Object.values(state.phase2.contracts.contracts).filter((contract) =>
    ["open", "awarded"].includes(contract.status),
  ).length;
  if (due && active < PUBLIC_CONTRACTS_POLICY.maxOpenContracts) publishContract(state);
  pruneHistory(state);
}

export function describePublicContracts(state: GameState): {
  open: PublicContract[];
  history: PublicContract[];
  reliability: { awarded: number; completed: number; defaulted: number };
} {
  const ordered = Object.values(state.phase2.contracts.contracts).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const key = PLAYER_ORGANIZATION_ID as string;
  const reliability = state.phase2.contracts.reliabilityByOrganizationId[key] ?? {
    awarded: 0,
    completed: 0,
    defaulted: 0,
  };
  return {
    open: ordered.filter((contract) => ["open", "awarded"].includes(contract.status)),
    history: ordered.filter((contract) => !["open", "awarded"].includes(contract.status)).slice(-8),
    reliability: { ...reliability },
  };
}

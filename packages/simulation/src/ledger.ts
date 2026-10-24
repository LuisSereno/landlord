import {
  addMoney,
  parseTransactionId,
  subtractMoney,
  type Money,
  type OrganizationId,
} from "@landlord/shared";

import type { GameState } from "./state";

const MAX_TRANSACTION_HISTORY = 500;

function trimTransactions(state: GameState): void {
  if (state.phase2.transactions.length > MAX_TRANSACTION_HISTORY) {
    state.phase2.transactions.splice(0, state.phase2.transactions.length - MAX_TRANSACTION_HISTORY);
  }
}

export function debit(
  state: GameState,
  organizationId: OrganizationId,
  amount: Money,
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
  organizationId: OrganizationId,
  amount: Money,
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

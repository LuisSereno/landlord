import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseMoney,
  parseOrganizationId,
  parsePersonId,
  parseTick,
  type ViewProjectionV2,
  type WorkerResponse,
} from "@landlord/shared";
import { GAME_MONTH_TICKS, PLAYER_ORGANIZATION_ID, RIVAL_ORGANIZATION_ID } from "./game-data";
import { bondFor } from "./public-contracts";
import { SimulationWorkerRuntime } from "./worker-runtime";

const initialize = {
  protocolVersion: 2,
  requestId: "request-init",
  type: "InitializeGame" as const,
  payload: { seed: 3 },
};

function commandRequest(
  commandId: string,
  requestId: string,
  command: { type: string; payload: Record<string, unknown> },
): object {
  return {
    protocolVersion: 2,
    requestId,
    type: "SubmitCommand",
    payload: {
      command: {
        commandId: parseCommandId(commandId),
        issuedByPersonId: parsePersonId("person_00000001"),
        actingAsOrganizationId: parseOrganizationId("org_00000001"),
        ...command,
      },
    },
  };
}

function projectionOf(responses: readonly WorkerResponse[]): ViewProjectionV2 {
  const published = responses.filter((response) => response.type === "ProjectionPublished");
  const last = published[published.length - 1];
  if (!last || last.type !== "ProjectionPublished") throw new Error("No projection published");
  return last.payload as ViewProjectionV2;
}

describe("WP4.11-H acciones Alpha end-to-end", () => {
  it("la oferta pública se acepta, adjudica con fianza y llega a la proyección", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    const state = runtime.getState()!;
    const contractId = "contract_00000001";
    state.phase2.contracts.contracts[contractId] = {
      id: contractId,
      kind: "supply",
      title: "Licitación de prueba",
      budget: parseMoney(260),
      bond: bondFor(260),
      requiredBuildings: 0,
      publishedAtTick: parseTick(0),
      closesAtTick: parseTick(GAME_MONTH_TICKS),
      executesAtTick: parseTick(GAME_MONTH_TICKS * 2),
      status: "open",
      awardedToOrganizationId: null,
      awardedAmount: null,
      bids: [],
    };
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS - 1) };
    const cashBefore = state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0;

    runtime.handle(
      commandRequest("command-bid", "request-bid", {
        type: "SubmitPublicBid",
        payload: { contractId, amount: parseMoney(200) },
      }),
    );
    /** El cierre de licitación ocurre al ejecutar el tick 36000 y la proyección siguiente lo refleja. */
    const responses = runtime.advanceTicks(3);

    expect(responses).toContainEqual(
      expect.objectContaining({ type: "RequestSucceeded", requestId: "request-bid" }),
    );
    const contract = state.phase2.contracts.contracts[contractId]!;
    expect(contract.status).toBe("awarded");
    expect(contract.awardedToOrganizationId).toBe(PLAYER_ORGANIZATION_ID);
    const bondTransactions = state.phase2.transactions.filter(
      (transaction) => transaction.cause === "contract_bond" && transaction.direction === "debit",
    );
    expect(bondTransactions).toHaveLength(1);
    expect(bondTransactions[0]).toMatchObject({
      organizationId: PLAYER_ORGANIZATION_ID,
      amount: contract.bond,
      direction: "debit",
    });
    expect(cashBefore).toBeGreaterThan(contract.bond);
    const projection = projectionOf(responses);
    const projected = projection.economy!.publicContracts.open.find(
      (entry) => entry.id === contractId,
    );
    expect(projected).toMatchObject({
      status: "awarded",
      awardedToOrganizationId: PLAYER_ORGANIZATION_ID,
      playerBid: 200,
    });
  });

  it("el encargo de inteligencia cobra su coste y publica una estimación, no la verdad", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    const state = runtime.getState()!;
    state.clock = { ...state.clock, tick: parseTick(120) };
    state.phase2.balances.set(RIVAL_ORGANIZATION_ID, parseMoney(987_654));
    const cashBefore = state.phase2.balances.get(PLAYER_ORGANIZATION_ID) ?? 0;

    runtime.handle(
      commandRequest("command-intel", "request-intel", {
        type: "CommissionIntelligence",
        payload: { subjectOrganizationId: RIVAL_ORGANIZATION_ID, kind: "balance" },
      }),
    );
    const first = runtime.advanceTicks(1);
    const responses = [...first, ...runtime.advanceTicks(1)];

    expect(responses).toContainEqual(
      expect.objectContaining({ type: "RequestSucceeded", requestId: "request-intel" }),
    );
    expect(state.phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(cashBefore - 150);
    const projection = projectionOf(responses);
    const estimate = projection.economy!.intelligence.estimates.find(
      (entry) => entry.subjectOrganizationId === RIVAL_ORGANIZATION_ID,
    );
    expect(estimate).toMatchObject({ kind: "balance", source: "contacts" });
    expect(estimate!.effectiveAccuracyPercent).toBeGreaterThan(0);
    /** El expediente es una estimación fechada; no expone el saldo real como campo propio. */
    expect(JSON.stringify(projection)).not.toContain("rival_balance");
  });
});

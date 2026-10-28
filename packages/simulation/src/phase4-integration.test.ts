import { describe, expect, it } from "vitest";

import { parseCommandId, parseMoney, parsePersonId } from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import { MUNICIPAL_BUDGET_POLICY } from "./municipal-budget";
import { budgetPriorityFor, politicalPartyById } from "./municipal-politics";
import { operationalBuildingsOwned } from "./public-contracts";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";

const SEED = 5;
const PARCELS = 24;

function advanceToMonthClose(state: ReturnType<typeof createScaledCity>, month: number): void {
  const close = GAME_MONTH_TICKS * month;
  while (state.clock.tick < close) advanceProductSystems(state);
  advanceProductSystems(state);
  if (state.clock.tick !== close + 1) throw new Error("El cierre mensual no se ejecutó");
}

function command(
  type: "SubmitPublicBid" | "CommissionIntelligence",
  payload: Record<string, unknown>,
  actor: "player" | "rival",
) {
  return {
    commandId: parseCommandId(`integration-${type}-${actor}`),
    issuedByPersonId: parsePersonId(actor === "player" ? "person_00000001" : "person_00000002"),
    actingAsOrganizationId: actor === "player" ? PLAYER_ORGANIZATION_ID : RIVAL_ORGANIZATION_ID,
    type,
    payload,
  } as never;
}

describe("WP4.11-H integración transversal de Fase 4", () => {
  it("cruza distrito, economía, contratos, reputación, inteligencia y elección con save/load", () => {
    const state = createScaledCity(SEED, { parcelCount: PARCELS });
    expect(state.world.districts.size).toBe(9);
    for (const entry of state.world.districts.values()) {
      expect(entry.district.generation).toBeDefined();
    }

    advanceToMonthClose(state, 2);
    expect(state.phase2.employment.lastSettlementTick).toBe(GAME_MONTH_TICKS * 2);
    expect(state.phase2.housingMarket.lastSettlementTick).toBe(GAME_MONTH_TICKS * 2);
    /** El suministro municipal se cobra y el presupuesto lo liquida en el mismo cierre. */
    expect(state.phase2.municipal.revenueTotalBySource.serviceFee).toBeGreaterThan(0);
    expect(state.phase2.municipal.lastSettlementTick).toBe(GAME_MONTH_TICKS * 2);

    const contract = Object.values(state.phase2.contracts.contracts).find(
      (entry) => entry.status === "open",
    );
    expect(contract).toBeDefined();
    expect(operationalBuildingsOwned(state, PLAYER_ORGANIZATION_ID)).toBeGreaterThanOrEqual(
      contract!.requiredBuildings,
    );
    expect(operationalBuildingsOwned(state, RIVAL_ORGANIZATION_ID)).toBeGreaterThanOrEqual(
      contract!.requiredBuildings,
    );

    dispatchProductCommand(
      state,
      command(
        "SubmitPublicBid",
        { contractId: contract!.id, amount: parseMoney(Math.floor(contract!.budget * 0.9)) },
        "player",
      ),
    );
    const rivalResult = dispatchProductCommand(
      state,
      command(
        "SubmitPublicBid",
        { contractId: contract!.id, amount: parseMoney(Math.floor(contract!.budget * 0.95)) },
        "rival",
      ),
    );
    expect(rivalResult.accepted).toBe(true);

    advanceToMonthClose(state, 3);
    expect(contract!.status).toBe("awarded");
    expect(contract!.awardedToOrganizationId).toBe(PLAYER_ORGANIZATION_ID);

    advanceToMonthClose(state, 4);
    expect(contract!.status).toBe("completed");
    const reputationFacts =
      state.phase2.reputation.factsByOrganizationId[PLAYER_ORGANIZATION_ID] ?? [];
    expect(reputationFacts.map((fact) => fact.kind)).toContain("contract_completed");
    expect(
      state.phase2.reputation.standingByOrganizationId[PLAYER_ORGANIZATION_ID]?.banks ?? 0,
    ).toBeGreaterThan(0);
    expect(state.phase2.transactions.some((tx) => tx.cause === "contract_bond")).toBe(true);
    expect(state.phase2.transactions.some((tx) => tx.cause === "contract_payment")).toBe(true);

    const intelResult = dispatchProductCommand(
      state,
      command(
        "CommissionIntelligence",
        { subjectOrganizationId: RIVAL_ORGANIZATION_ID, kind: "bid_intent" },
        "player",
      ),
    );
    expect(intelResult.accepted).toBe(true);
    expect(Object.keys(state.phase2.intelligence.estimatesBySubjectOrganizationId)).toContain(
      RIVAL_ORGANIZATION_ID,
    );

    advanceToMonthClose(state, 6);
    expect(state.phase2.politics.electionsHeld).toBeGreaterThanOrEqual(1);
    expect(state.phase2.politics.lastElectionTick).toBe(GAME_MONTH_TICKS * 6);
    const governing = politicalPartyById(state.phase2.politics.governingPartyId);
    expect(governing).not.toBeNull();
    expect([...budgetPriorityFor(state, MUNICIPAL_BUDGET_POLICY.priority)]).toEqual([
      ...governing!.budgetPriority,
    ]);

    const snapshot = serializeSnapshot(state);
    const restored = restoreStateFromSnapshot(snapshot);
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));

    for (let tick = 0; tick < GAME_MONTH_TICKS; tick += 1) {
      advanceProductSystems(state);
      advanceProductSystems(restored);
    }
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));
    expect(restored.phase2.municipal.lastSettlementTick).toBe(GAME_MONTH_TICKS * 7);
    expect(restored.phase2.politics.lastMoodTick).toBe(GAME_MONTH_TICKS * 7);
  }, 120_000);

  it("la caja municipal de un cierre se explica por sus asientos", () => {
    const state = createScaledCity(SEED, { parcelCount: PARCELS });
    const close = GAME_MONTH_TICKS * 3;
    while (state.clock.tick < close) advanceProductSystems(state);
    const before = state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? 0;
    advanceProductSystems(state);
    expect(state.clock.tick).toBe(close + 1);
    const after = state.phase2.balances.get(MUNICIPALITY_ORGANIZATION_ID) ?? 0;
    /** Asientos del cierre; el libro recorta por antigüedad, así que se filtra por tick, no por índice. */
    const municipalDelta = state.phase2.transactions
      .filter(
        (transaction) =>
          transaction.tick === close && transaction.organizationId === MUNICIPALITY_ORGANIZATION_ID,
      )
      .reduce(
        (total, transaction) =>
          total + (transaction.direction === "credit" ? transaction.amount : -transaction.amount),
        0,
      );
    /** La caja del municipio sólo cambia por partidas que el ledger del cierre registra. */
    expect(after - before).toBe(municipalDelta);
    expect(Number.isSafeInteger(after)).toBe(true);
  }, 60_000);
});

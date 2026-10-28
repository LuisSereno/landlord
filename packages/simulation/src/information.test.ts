import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseLoanId,
  parseMoney,
  parseParcelId,
  parsePersonId,
  parseTick,
  type IntelKind,
  type IntelligenceEstimate,
  type OrganizationId,
} from "@landlord/shared";
import { dispatchProductCommand } from "./commands";
import {
  GAME_MONTH_TICKS,
  MUNICIPALITY_ORGANIZATION_ID,
  PLAYER_ORGANIZATION_ID,
  RIVAL_ORGANIZATION_ID,
} from "./game-data";
import {
  INFORMATION_POLICY,
  INFORMATION_SCOPES,
  commissionIntelligence,
  commissionRejection,
  describeIntelligence,
  effectiveAccuracyPercent,
  initialIntelligenceState,
  runIntelligence,
  scopeFor,
  trueValueFor,
} from "./information";
import { createViewProjection } from "./projection";
import { canonicalizeState } from "./runner";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

/** Estado de prueba con caja holgada y rival silenciado: sólo manda el expediente de inteligencia. */
function newState(seed = 7): GameState {
  const state = createInitialState(seed);
  state.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.balances.set(RIVAL_ORGANIZATION_ID, parseMoney(5_000_000));
  state.phase2.rivalAi.cooldownUntilTick = parseTick(9_000_000);
  return state;
}

function at(state: GameState, month: number): void {
  state.clock = { ...state.clock, tick: parseTick(month * GAME_MONTH_TICKS) };
}

function commission(state: GameState, subjectId: OrganizationId, kind: IntelKind) {
  return dispatchProductCommand(state, {
    type: "CommissionIntelligence",
    commandId: parseCommandId(`intel-${subjectId}-${kind}-${state.clock.tick}`),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: PLAYER_ORGANIZATION_ID,
    payload: { subjectOrganizationId: subjectId, kind },
  });
}

function fileOf(state: GameState, subjectId: OrganizationId): IntelligenceEstimate[] {
  return state.phase2.intelligence.estimatesBySubjectOrganizationId[subjectId] ?? [];
}

function errorBound(kind: IntelKind, source: "market" | "contacts", truth: number): number {
  return Math.ceil((truth * INFORMATION_POLICY.kinds[kind].errorPercentBySource[source]) / 100);
}

describe("WP4.9 información imperfecta", () => {
  it("el registro clasifica los cuatro accesos y no deja ninguno sin etiquetar", () => {
    const scopes = new Set(Object.values(INFORMATION_POLICY.scopeByObservable));
    expect([...INFORMATION_SCOPES].sort()).toEqual([...scopes].sort());
    expect(scopeFor("district_rent_index")).toBe("public");
    expect(scopeFor("own_balance")).toBe("own");
    expect(scopeFor("rival_bid_intent")).toBe("inferred");
    expect(scopeFor("rival_balance")).toBe("private");
    // El mismo número cambia de acceso según de quién sea: la caja propia es `own`, la del rival
    // es `private` y su versión estimada pasa a ser `inferred`.
    expect(scopeFor("estimated_balance")).toBe("inferred");
  });

  it("investigar cuesta, tiene cota de error y se enfría", () => {
    const state = newState();
    const result = commission(state, RIVAL_ORGANIZATION_ID, "balance");
    expect(result.accepted).toBe(true);
    expect(state.phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(
      parseMoney(5_000_000 - INFORMATION_POLICY.commissionCost),
    );

    const [estimate] = fileOf(state, RIVAL_ORGANIZATION_ID);
    expect(estimate?.source).toBe("contacts");
    expect(estimate?.accuracyPercent).toBe(
      100 - INFORMATION_POLICY.kinds.balance.errorPercentBySource.contacts,
    );
    // El contacto miente, pero nunca más de lo que cobra por contar.
    const truth = trueValueFor(state, RIVAL_ORGANIZATION_ID, "balance");
    expect(Math.abs(estimate!.value - truth)).toBeLessThanOrEqual(
      errorBound("balance", "contacts", truth),
    );

    expect(commission(state, RIVAL_ORGANIZATION_ID, "exposure").accepted).toBe(false);
    expect(describeIntelligence(state).cooldownRemainingTicks).toBe(GAME_MONTH_TICKS);
  });

  it("el expediente es de un observador y rechaza sujetos imposibles", () => {
    const state = newState();
    expect(commissionRejection(state, PLAYER_ORGANIZATION_ID, MUNICIPALITY_ORGANIZATION_ID)).toBe(
      "INTEL_SUBJECT_UNKNOWN",
    );
    expect(commissionRejection(state, PLAYER_ORGANIZATION_ID, PLAYER_ORGANIZATION_ID)).toBe(
      "INTEL_SUBJECT_IS_SELF",
    );
    // Conocer la propia caja no es inteligencia: es leer tu propio libro.
    expect(commission(state, PLAYER_ORGANIZATION_ID, "balance").accepted).toBe(false);
    // Quien no es el dueño del expediente no gasta el dinero de otro.
    expect(commissionRejection(state, RIVAL_ORGANIZATION_ID, PLAYER_ORGANIZATION_ID)).toBe(
      "INTEL_NOT_OBSERVER",
    );

    const broke = newState();
    broke.phase2.balances.set(PLAYER_ORGANIZATION_ID, parseMoney(100));
    const refused = commission(broke, RIVAL_ORGANIZATION_ID, "balance");
    expect(refused.accepted).toBe(false);
    if (!refused.accepted) expect(refused.code).toBe("INTEL_UNAFFORDABLE");
    expect(broke.phase2.balances.get(PLAYER_ORGANIZATION_ID)).toBe(parseMoney(100));
    expect(fileOf(broke, RIVAL_ORGANIZATION_ID)).toEqual([]);
  });

  it("la precisión envejece y el mercado re-basa sola lo que ya se quedó viejo", () => {
    const state = newState();
    at(state, 1);
    const estimate = commissionIntelligence(state, RIVAL_ORGANIZATION_ID, "balance");
    expect(effectiveAccuracyPercent(estimate, state.clock.tick)).toBe(90);
    expect(effectiveAccuracyPercent(estimate, state.clock.tick + 2 * GAME_MONTH_TICKS)).toBe(86);
    // La caducidad tiene suelo: un dato añejo sigue valiendo algo, nunca cero.
    expect(effectiveAccuracyPercent(estimate, state.clock.tick + 90 * GAME_MONTH_TICKS)).toBe(
      INFORMATION_POLICY.minimumAccuracyPercent,
    );

    // Antes de la ventanilla el mercado no toca nada: el jugador sigue leyendo a su contacto.
    at(state, INFORMATION_POLICY.staleAfterMonths);
    runIntelligence(state);
    expect(fileOf(state, RIVAL_ORGANIZATION_ID)[0]!.source).toBe("contacts");

    at(state, INFORMATION_POLICY.staleAfterMonths + 1);
    const truth = trueValueFor(state, RIVAL_ORGANIZATION_ID, "balance");
    runIntelligence(state);
    const refreshed = fileOf(state, RIVAL_ORGANIZATION_ID)[0]!;
    expect(refreshed.source).toBe("market");
    expect(refreshed.accuracyPercent).toBe(
      100 - INFORMATION_POLICY.kinds.balance.errorPercentBySource.market,
    );
    expect(refreshed.id).not.toBe(estimate.id);
    expect(Math.abs(refreshed.value - truth)).toBeLessThanOrEqual(
      errorBound("balance", "market", truth),
    );
    expect(state.phase2.intelligence.lastRefreshTick).toBe(parseTick(4 * GAME_MONTH_TICKS));
  });

  it("el panel publica la estimación y calla la cifra verdadeira", () => {
    const state = newState();
    state.phase2.balances.set(RIVAL_ORGANIZATION_ID, parseMoney(7_777_770));
    at(state, 1);
    const estimate = commissionIntelligence(state, RIVAL_ORGANIZATION_ID, "balance");
    // Con esta seed el contacto yerra: si clavara la cifra habría que mover el centinela.
    expect(estimate.value).not.toBe(7_777_770);

    const projected = createViewProjection(state, true).economy?.intelligence;
    expect(projected?.commissionCost).toBe(INFORMATION_POLICY.commissionCost);
    expect(projected?.kinds.map((entry) => entry.kind)).toEqual([
      "balance",
      "exposure",
      "arrears",
      "bid_intent",
    ]);
    expect(projected?.estimates.map((entry) => entry.kind)).toEqual(["balance"]);
    expect(projected?.estimates[0]?.value).toBe(estimate.value);
    expect(projected?.estimates[0]?.effectiveAccuracyPercent).toBe(90);
    // La proyección es la única ventana del panel: por ella no sale el número verdadero.
    expect(JSON.stringify(createViewProjection(state, true))).not.toContain("7777770");
  });

  it("leer mal el mundo no cambia el mundo", () => {
    const run = (poison: boolean): string => {
      const state = newState(11);
      for (let month = 1; month <= 6; month += 1) {
        at(state, month);
        commission(state, RIVAL_ORGANIZATION_ID, "balance");
        if (poison) {
          const file = fileOf(state, RIVAL_ORGANIZATION_ID);
          file[file.length - 1] = { ...file[file.length - 1]!, value: 999_999_999 };
        }
        advanceProductSystems(state);
      }
      return JSON.stringify(serializeSnapshot(state).phase2!.transactions);
    };
    // El expediente no es entrada de ninguna regla: el libro contable queda idéntico.
    expect(run(true)).toBe(run(false));
  });

  it("el ruido de estimación no desplaza el arroyo económico", () => {
    const state = newState(13);
    at(state, 1);
    const economicBefore = JSON.stringify(state.prng);
    const intelBefore = JSON.stringify(state.phase2.intelligence.prng);
    commissionIntelligence(state, RIVAL_ORGANIZATION_ID, "bid_intent");
    expect(JSON.stringify(state.prng)).toBe(economicBefore);
    expect(JSON.stringify(state.phase2.intelligence.prng)).not.toBe(intelBefore);
  });

  it("sobrevive a guardar y cargar y migra partidas anteriores", () => {
    const state = newState();
    at(state, 1);
    commissionIntelligence(state, RIVAL_ORGANIZATION_ID, "exposure");
    at(state, 4);
    runIntelligence(state);
    const serialized = serializeSnapshot(state);
    expect(serializeSnapshot(restoreStateFromSnapshot(serialized))).toEqual(serialized);
    const restored = restoreStateFromSnapshot(serialized);
    expect(restored.phase2.intelligence.prng).toEqual(state.phase2.intelligence.prng);
    expect(restored.phase2.intelligence.estimatesBySubjectOrganizationId).toEqual(
      state.phase2.intelligence.estimatesBySubjectOrganizationId,
    );

    const legacy = serializeSnapshot(newState());
    delete legacy.phase2!.intelligence;
    expect(restoreStateFromSnapshot(legacy).phase2.intelligence).toEqual(
      initialIntelligenceState(newState().seed),
    );
  }, 60_000);

  it("dos partidas con la misma seed y los mismos encargos convergen", () => {
    const run = (): string => {
      const state = newState(17);
      for (const month of [1, 2, 4, 5]) {
        at(state, month);
        commission(state, RIVAL_ORGANIZATION_ID, month % 2 === 1 ? "balance" : "bid_intent");
        runIntelligence(state);
      }
      return canonicalizeState(state);
    };
    expect(run()).toBe(run());
  });

  it("el razonamiento y los números privados del rival no llegan a la proyección", () => {
    const state = newState();
    state.phase2.rivalAi.lastReason = "SENTINEL-RAZON-PRIVADA";
    state.phase2.rivalAi.lastAction = "SENTINEL-ACCION-PRIVADA";
    state.phase2.rivalAi.strategyProfile = "expansionist";
    state.phase2.factions.profileByOrganizationId[RIVAL_ORGANIZATION_ID] = "expansionist";
    state.phase2.factions.stanceByPairId[`${PLAYER_ORGANIZATION_ID}>${RIVAL_ORGANIZATION_ID}`] =
      -40;
    state.phase2.balances.set(RIVAL_ORGANIZATION_ID, parseMoney(987_654_321));
    state.phase2.influenceByOrganizationId.set(RIVAL_ORGANIZATION_ID, 777_777);
    state.phase2.reputation.standingByOrganizationId[RIVAL_ORGANIZATION_ID] = {
      residents: -57,
    };
    const parcelId = [...state.phase2.parcels.keys()][0]!;
    state.phase2.loans.set(parseLoanId("loan_00000099"), {
      id: parseLoanId("loan_00000099"),
      borrowerOrganizationId: RIVAL_ORGANIZATION_ID,
      lenderOrganizationId: "org_00000003" as never,
      principal: parseMoney(555_555),
      outstandingPrincipal: parseMoney(555_555),
      annualInterestRateBps: 900,
      termMonths: 12,
      remainingMonths: 12,
      collateralParcelId: parseParcelId(parcelId),
      status: "active",
      offeredAtTick: parseTick(0),
      acceptedAtTick: parseTick(0),
      nextPaymentTick: parseTick(36_000),
      missedPayments: 0,
    });

    const serialized = JSON.stringify(createViewProjection(state, true));
    for (const sentinel of [
      "SENTINEL-RAZON-PRIVADA",
      "SENTINEL-ACCION-PRIVADA",
      "expansionist",
      "987654321",
      "777777",
      "555555",
      `${PLAYER_ORGANIZATION_ID}>${RIVAL_ORGANIZATION_ID}`,
    ]) {
      expect(serialized, sentinel).not.toContain(sentinel);
    }
    /** La reputación proyectada es la del jugador; la del rival no viaja en el panel. */
    expect(JSON.stringify(createViewProjection(state, true).economy!.reputation)).not.toContain(
      "-57",
    );
    /** El observable que sí es público sigue estando: la huella física del rival. */
    expect(createViewProjection(state, true).economy!.rival).toEqual({
      parcels: expect.any(Number),
      buildings: expect.any(Number),
      occupiedBuildings: expect.any(Number),
    });
  });
});

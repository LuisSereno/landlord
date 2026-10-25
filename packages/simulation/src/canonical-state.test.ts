import { describe, expect, it } from "vitest";

import { parseMoney, parseOrganizationId, parseTick } from "@landlord/shared";
import { GAME_MONTH_TICKS } from "./game-data";
import { canonicalizeState } from "./runner";
import { createInitialState, type GameState } from "./state";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";

function campaign(seed = 5, months = 6): GameState {
  const state = createScaledCity(seed, { parcelCount: 40 });
  for (let tick = 0; tick < GAME_MONTH_TICKS * months; tick += 1) advanceProductSystems(state);
  return state;
}

describe("WP4.11-H estado canónico", () => {
  it("es idéntico antes y después de guardar y cargar", () => {
    const state = campaign();
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));
  });

  it("detecta cambios en todos los agregados de Alpha", () => {
    const baselineState = campaign(7, 3);
    const snapshot = serializeSnapshot(baselineState);
    const baseline = canonicalizeState(baselineState);
    const mutations: Array<[string, (state: GameState) => void]> = [
      ["employment", (state) => (state.phase2.employment.salaryIndexPercent += 1)],
      ["municipal", (state) => (state.phase2.municipal.deficitMonths += 1)],
      ["housingMarket", (state) => (state.phase2.housingMarket.arrivalsTotal += 1)],
      ["contracts", (state) => (state.phase2.contracts.nextOrdinal += 1)],
      ["reputation", (state) => (state.phase2.reputation.nextFactOrdinal += 1)],
      ["intelligence", (state) => (state.phase2.intelligence.nextEstimateOrdinal += 1)],
      ["factions", (state) => (state.phase2.factions.nextMemoryOrdinal += 1)],
      ["politics", (state) => (state.phase2.politics.electionsHeld += 1)],
      ["crews", (state) => (state.idCounters.agent += 1)],
      ["incidents", (state) => (state.phase2.idCounters.incident += 1)],
    ];
    for (const [label, mutate] of mutations) {
      const state = restoreStateFromSnapshot(snapshot);
      mutate(state);
      expect(canonicalizeState(state), label).not.toBe(baseline);
    }
  }, 20_000);

  it("el orden de inserción de maps y records no cambia el digesto", () => {
    const state = campaign(9, 2);
    const baseline = canonicalizeState(state);

    state.phase2.balances = new Map([...state.phase2.balances.entries()].reverse());
    state.phase2.reputation.standingByOrganizationId = Object.fromEntries(
      Object.entries(state.phase2.reputation.standingByOrganizationId).reverse(),
    );
    state.phase2.contracts.contracts = Object.fromEntries(
      Object.entries(state.phase2.contracts.contracts).reverse(),
    );
    state.processedCommandIds = new Set([...state.processedCommandIds].reverse());

    expect(canonicalizeState(state)).toBe(baseline);
  });

  it("la misma seed y los mismos meses producen la misma cadena", () => {
    expect(canonicalizeState(campaign(11, 3))).toBe(canonicalizeState(campaign(11, 3)));
  });

  it("el estado restaurado continúa de forma determinista", () => {
    const state = campaign(13, 3);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    for (let tick = 0; tick < GAME_MONTH_TICKS; tick += 1) {
      advanceProductSystems(state);
      advanceProductSystems(restored);
    }
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));
  });

  it("los importes del estado canónico conservan su valor monetario", () => {
    const state = createInitialState(3);
    state.phase2.balances.set(parseOrganizationId("org_00000001"), parseMoney(1234));
    state.clock = { ...state.clock, tick: parseTick(GAME_MONTH_TICKS) };
    expect(canonicalizeState(state)).toContain('"balance":1234');
    expect(canonicalizeState(state)).toContain('"organizationId":"org_00000001"');
  });
});

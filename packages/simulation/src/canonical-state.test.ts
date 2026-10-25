import { describe, expect, it } from "vitest";

import {
  parseAgentId,
  parseCommandId,
  parseIncidentId,
  parseMoney,
  parseOrganizationId,
  parsePersonId,
  parseTick,
} from "@landlord/shared";
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

function firstCrew(state: GameState): import("@landlord/shared").Crew {
  const crew = [...state.phase2.crews.values()][0];
  if (!crew) throw new Error("la campaña no dejó cuadrillas que canonicizar");
  return crew;
}

/**
 * Devuelve un incidente de la campaña y, si el recorrido no dejó ninguno, planta uno sobre un
 * edificio real. La mutación que lo usa cambia contenido de entidad en ambos casos.
 */
function incidentOf(state: GameState): import("@landlord/shared").IncidentRecord {
  const existing = [...state.phase2.incidents.values()][0];
  if (existing) return existing;
  const building = [...state.phase2.buildings.values()][0]!;
  const incident = {
    id: parseIncidentId("incident_00000099"),
    buildingId: building.id,
    origin: "deterioration",
    intensity: 40,
    status: "active",
    targetOrganizationId: building.ownerOrganizationId,
    createdAtTick: parseTick(0),
    causedByAgentId: null,
    causedByOrganizationId: null,
    publiclyAttributedOrganizationId: null,
    casualties: { injured: 0, dead: 0 },
  } satisfies import("@landlord/shared").IncidentRecord;
  state.phase2.incidents.set(incident.id, incident);
  return incident;
}

describe("WP4.11-H estado canónico", () => {
  it("es idéntico antes y después de guardar y cargar", () => {
    const state = campaign();
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(canonicalizeState(restored)).toBe(canonicalizeState(state));
  });

  it("guardar corriendo a 4x y cargar sigue siendo canónicamente idéntico", () => {
    const state = campaign(17, 2);
    /** Los controles del scheduler no son estado del mundo: la snapshot no los persiste. */
    state.clock = { ...state.clock, runState: "running", speed: 4 };
    const baseline = canonicalizeState(state);
    const restored = restoreStateFromSnapshot(serializeSnapshot(state));
    expect(restored.clock).toMatchObject({ runState: "paused", speed: 1 });
    expect(canonicalizeState(restored)).toBe(baseline);
    /** El tick sí es estado: avanzar un tick cambia la cadena. */
    restored.clock = { ...restored.clock, tick: parseTick(restored.clock.tick + 1) };
    expect(canonicalizeState(restored)).not.toBe(baseline);
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
      ["macroEvents", (state) => (state.phase2.macroEvents.nextEventOrdinal += 1)],
      /** Entidades reales, no contadores: el digesto tiene que leer su contenido. */
      ["crews", (state) => firstCrew(state).workerAgentIds.push(parseAgentId("agent_00000099"))],
      ["incidents", (state) => (incidentOf(state).intensity += 1)],
      [
        "pendingCommands",
        (state) =>
          state.pendingCommands.push({
            acceptedOrder: 1,
            command: {
              commandId: parseCommandId("command_00000099"),
              issuedByPersonId: parsePersonId("person_00000001"),
              actingAsOrganizationId: parseOrganizationId("org_00000001"),
              type: "SetMaintenancePolicy",
              payload: { policy: "deferred" },
            },
          }),
      ],
      ["idCounters", (state) => (state.idCounters.agent += 1)],
      ["phase2.idCounters", (state) => (state.phase2.idCounters.incident += 1)],
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

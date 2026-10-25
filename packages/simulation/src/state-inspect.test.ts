import { describe, expect, it } from "vitest";

import { detectInvariantViolations, measureBalance } from "./balance";
import { GAME_MONTH_TICKS } from "./game-data";
import { createViewProjection } from "./projection";
import { createScaledCity } from "./system-cost";
import { advanceProductSystems } from "./systems";

const environment = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
  console?: { log(value: string): void };
};

function envNumber(name: string, fallback: number): number {
  const raw = environment.process?.env?.[name];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Inspector de estado sólo para desarrollo (WP4.14). No es un test de producto: imprime un resumen
 * legible de una campaña con la seed registrada para inspeccionar agregados sin abrir la UI.
 */
describe("inspector de estado", () => {
  it.skipIf(environment.process?.env?.STATE_INSPECT !== "1")(
    "resume una campaña con semilla y meses explícitos",
    () => {
      const seed = envNumber("STATE_INSPECT_SEED", 7);
      const parcels = envNumber("STATE_INSPECT_PARCELS", 200);
      const months = envNumber("STATE_INSPECT_MONTHS", 12);
      const state = createScaledCity(seed, { parcelCount: parcels });
      for (let tick = 0; tick < GAME_MONTH_TICKS * months; tick += 1) {
        advanceProductSystems(state);
      }
      const projection = createViewProjection(state, true);
      environment.console?.log(
        JSON.stringify(
          {
            seed,
            parcels,
            months,
            tick: state.clock.tick,
            balance: measureBalance(state),
            invariants: detectInvariantViolations(state),
            counts: {
              organizations: state.organizations.size,
              persons: state.persons.size,
              agents: state.agents.size,
              parcels: state.phase2.parcels.size,
              buildings: state.phase2.buildings.size,
              tenants: state.phase2.tenants.size,
              loans: state.phase2.loans.size,
              constructionSites: state.phase2.constructionSites.size,
              transactions: state.phase2.transactions.length,
              macroEvents: state.phase2.macroEvents.events.length,
            },
            automation: state.phase2.automation,
            housing: projection.economy?.housingMarket.segments.map((segment) => ({
              id: segment.id,
              population: segment.population,
              vacantSlots: segment.vacantSlots,
              appealPercent: segment.appealPercent,
            })),
            alerts: projection.economy?.alerts.length ?? 0,
          },
          null,
          2,
        ),
      );
      expect(state.clock.tick).toBe(GAME_MONTH_TICKS * months);
    },
    600_000,
  );
});

import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { dispatchPlaceTestStructure } from "./commands";
import { createBenchmarkScenario, canonicalBenchmarkState } from "./benchmark";
import { createInitialState } from "./state";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";

const environment = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
    memoryUsage?: () => { heapUsed: number; rss: number };
  };
  performance: { now(): number };
  console: { log(value: string): void };
};

describe("Gate 1 soak harness", () => {
  it.skipIf(environment.process?.env?.SOAK_FULL !== "1")(
    "runs the configured long headless soak and verifies save/restore afterward",
    () => {
      const ticks = Number(environment.process?.env?.SOAK_TICKS ?? 144_000);
      const sampleEvery = Number(environment.process?.env?.SOAK_SAMPLE_EVERY ?? 10_000);
      const scenario = createBenchmarkScenario(1);
      const memorySamples: Array<{ tick: number; heapUsed: number; rss: number }> = [];
      const start = environment.performance.now();
      for (let tick = 0; tick < ticks; tick += 1) {
        scenario.step();
        if ((tick + 1) % sampleEvery === 0 || tick + 1 === ticks) {
          const memory = environment.process?.memoryUsage?.();
          if (memory) memorySamples.push({ tick: tick + 1, ...memory });
        }
      }
      const elapsedMs = environment.performance.now() - start;

      const state = createInitialState(1);
      dispatchPlaceTestStructure(state, {
        commandId: parseCommandId("soak-command-1"),
        issuedByPersonId: parsePersonId("person_00000001"),
        actingAsOrganizationId: parseOrganizationId("org_00000001"),
        type: "PlaceTestStructure",
        payload: { cell: { x: 10, y: 10 } },
      });
      const restored = restoreStateFromSnapshot(serializeSnapshot(state));
      expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(state));
      expect(canonicalBenchmarkState(scenario)).toContain(`"tick":${ticks}`);
      environment.console.log(JSON.stringify({ ticks, elapsedMs, memorySamples }));
    },
    180_000,
  );
});

import { describe, expect, it } from "vitest";

import {
  BENCHMARK_AGENT_COUNT,
  BENCHMARK_BUILDING_COUNT,
  canonicalBenchmarkState,
  createBenchmarkScenario,
  runReferenceBenchmark,
  summarizeBenchmark,
} from "./benchmark";

const clock = globalThis as typeof globalThis & { performance: { now(): number } };

const measure = (operation: () => void): number => {
  const start = clock.performance.now();
  operation();
  return clock.performance.now() - start;
};

describe("reference benchmark scenario", () => {
  it("creates the versioned 100-building/500-agent fixture", () => {
    const scenario = createBenchmarkScenario(1, { navigation: false });
    expect(scenario.buildings).toHaveLength(BENCHMARK_BUILDING_COUNT);
    expect(scenario.agents.size).toBe(BENCHMARK_AGENT_COUNT);
    expect(scenario.blockedCells.size).toBe(BENCHMARK_BUILDING_COUNT);
  });

  it("is deterministic for the same seed and tick sequence", () => {
    const left = createBenchmarkScenario(42, { agentCount: 4 });
    const right = createBenchmarkScenario(42, { agentCount: 4 });
    for (let tick = 0; tick < 20; tick += 1) {
      left.step();
      right.step();
    }
    expect(canonicalBenchmarkState(left)).toBe(canonicalBenchmarkState(right));
  });

  it("records tick and projection samples without setting a machine-specific gate result", () => {
    const result = runReferenceBenchmark(1, {
      warmupTicks: 5,
      measuredTicks: 20,
      measure,
      navigation: false,
    });
    expect(result.samples).toHaveLength(20);
    expect(result.finalDigest).toContain('"tick":25');
  });

  const environment = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
    console: { log(value: string): void };
  };
  it.skipIf(environment.process?.env?.BENCHMARK_FULL !== "1")(
    "runs the documented five-seed/five-repetition benchmark when explicitly requested",
    () => {
      const seeds = [0, 1, 42, 4294967295];
      for (const seed of seeds) {
        for (let repetition = 0; repetition < 5; repetition += 1) {
          const result = runReferenceBenchmark(seed, {
            warmupTicks: 1000,
            measuredTicks: 20000,
            measure,
          });
          environment.console.log(JSON.stringify({ repetition, ...summarizeBenchmark(result) }));
        }
      }
    },
    180_000,
  );
});

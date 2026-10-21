import {
  canonicalBenchmarkState,
  createBenchmarkProjection,
  createBenchmarkScenario,
  type BenchmarkScenario,
} from "@landlord/simulation";

type BenchmarkMetric = {
  tickMs: number;
  at: number;
};

let scenario: BenchmarkScenario | null = null;
const samples: BenchmarkMetric[] = [];

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function digest(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function metrics() {
  const ticks = samples.map((sample) => sample.tickMs);
  return {
    tick: scenario?.tick ?? 0,
    tickP95: percentile(ticks, 0.95),
    tickP99: percentile(ticks, 0.99),
    samples: samples.length,
    digest: scenario ? digest(canonicalBenchmarkState(scenario)) : null,
  };
}

globalThis.addEventListener(
  "message",
  (event: MessageEvent<{ type: "Initialize"; seed: number }>) => {
    if (event.data.type !== "Initialize") return;
    scenario = createBenchmarkScenario(event.data.seed);
    globalThis.postMessage({ type: "Ready", projection: createBenchmarkProjection(scenario) });
  },
);

setInterval(() => {
  if (!scenario) return;
  const start = performance.now();
  scenario.step();
  samples.push({ tickMs: performance.now() - start, at: performance.now() });
  if (samples.length > 2_400) samples.shift();
  if (scenario.tick % 2 === 0) {
    globalThis.postMessage({ type: "Projection", projection: createBenchmarkProjection(scenario) });
    globalThis.postMessage({ type: "Metrics", metrics: metrics() });
  }
}, 50);

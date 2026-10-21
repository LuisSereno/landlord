import {
  canonicalBenchmarkState,
  createBenchmarkProjection,
  createBenchmarkScenario,
  createBenchmarkSnapshot,
  restoreBenchmarkSnapshot,
  type BenchmarkScenario,
  type BenchmarkSnapshot,
} from "@landlord/simulation";

type RequestId = string;
type BenchmarkRequest =
  | { type: "Initialize"; seed: number }
  | { type: "SubmitCommand"; requestId: RequestId; cell: { x: number; y: number } }
  | { type: "SaveSnapshot"; requestId: RequestId }
  | { type: "LoadSnapshot"; requestId: RequestId; snapshot: BenchmarkSnapshot }
  | { type: "GetMetrics"; requestId: RequestId }
  | { type: "ProjectionAck"; projectionId: number };

type BenchmarkMetric = { tickMs: number; at: number };
type QueuedCommand = {
  requestId: RequestId;
  cell: { x: number; y: number };
  queuedAt: number;
};

let scenario: BenchmarkScenario | null = null;
let continuationProbe: BenchmarkScenario | null = null;
const samples: BenchmarkMetric[] = [];
const commandLatencies: number[] = [];
const projectionTimings: number[] = [];
const serializeTimings: number[] = [];
const restoreTimings: number[] = [];
const pendingCommands: QueuedCommand[] = [];
let maxBacklog = 0;
let continuationChecks = 0;
let continuationDivergences = 0;
let snapshotBytes = 0;
let saveLoadOperations = 0;
let saveLoadFailures = 0;
let projectionNumber = 0;

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

function bounded(values: number[]): number[] {
  return values.length > 2_400 ? values.slice(-2_400) : values;
}

function metrics() {
  const ticks = bounded(samples.map((sample) => sample.tickMs));
  return {
    tick: scenario?.tick ?? 0,
    tickP95: percentile(ticks, 0.95),
    tickP99: percentile(ticks, 0.99),
    samples: ticks.length,
    backlog: pendingCommands.length,
    maxBacklog,
    commandP95: percentile(commandLatencies, 0.95),
    projectionP95: percentile(projectionTimings, 0.95),
    serializeP95: percentile(serializeTimings, 0.95),
    restoreP95: percentile(restoreTimings, 0.95),
    continuationChecks,
    continuationDivergences,
    snapshotBytes,
    saveLoadOperations,
    saveLoadFailures,
    digest: scenario ? digest(canonicalBenchmarkState(scenario)) : null,
  };
}

function publishMetrics(): void {
  globalThis.postMessage({ type: "Metrics", metrics: metrics() });
}

function fail(requestId: RequestId, message: string): void {
  globalThis.postMessage({ type: "RequestFailed", requestId, message });
}

function handleRequest(request: BenchmarkRequest): void {
  if (request.type === "Initialize") {
    scenario = createBenchmarkScenario(request.seed);
    continuationProbe = null;
    samples.length = 0;
    commandLatencies.length = 0;
    projectionTimings.length = 0;
    serializeTimings.length = 0;
    restoreTimings.length = 0;
    pendingCommands.length = 0;
    maxBacklog = 0;
    continuationChecks = 0;
    continuationDivergences = 0;
    snapshotBytes = 0;
    saveLoadOperations = 0;
    saveLoadFailures = 0;
    projectionNumber = 0;
    const projectionStart = performance.now();
    const projection = createBenchmarkProjection(scenario);
    projectionTimings.push(performance.now() - projectionStart);
    globalThis.postMessage({ type: "Ready", projection, metrics: metrics() });
    return;
  }
  if (!scenario) {
    if ("requestId" in request) fail(request.requestId, "Benchmark is not initialized");
    return;
  }
  if (request.type === "SubmitCommand") {
    pendingCommands.push({
      requestId: request.requestId,
      cell: request.cell,
      queuedAt: performance.now(),
    });
    maxBacklog = Math.max(maxBacklog, pendingCommands.length);
    return;
  }
  if (request.type === "ProjectionAck") {
    globalThis.postMessage({ type: "ProjectionAck", projectionId: request.projectionId });
    return;
  }
  if (request.type === "SaveSnapshot") {
    const start = performance.now();
    const snapshot = createBenchmarkSnapshot(scenario);
    serializeTimings.push(performance.now() - start);
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
    snapshotBytes = bytes;
    globalThis.postMessage({
      type: "Response",
      requestId: request.requestId,
      acceptedAtTick: scenario.tick,
      result: { snapshot, bytes },
    });
    publishMetrics();
    return;
  }
  if (request.type === "LoadSnapshot") {
    const start = performance.now();
    try {
      restoreBenchmarkSnapshot(scenario, request.snapshot);
      restoreTimings.push(performance.now() - start);
      continuationProbe = createBenchmarkScenario(request.snapshot.seed);
      restoreBenchmarkSnapshot(continuationProbe, request.snapshot);
      saveLoadOperations += 1;
      globalThis.postMessage({
        type: "Response",
        requestId: request.requestId,
        acceptedAtTick: scenario.tick,
      });
    } catch {
      saveLoadFailures += 1;
      fail(request.requestId, "Invalid benchmark snapshot");
    }
    publishMetrics();
    return;
  }
  if (request.type === "GetMetrics") {
    globalThis.postMessage({
      type: "Response",
      requestId: request.requestId,
      acceptedAtTick: scenario.tick,
      result: metrics(),
    });
  }
}

globalThis.addEventListener("message", (event: MessageEvent<BenchmarkRequest>) => {
  handleRequest(event.data);
});

setInterval(() => {
  if (!scenario) return;
  const tickStart = performance.now();
  for (const command of pendingCommands.splice(0)) {
    const responseAt = performance.now();
    commandLatencies.push(responseAt - command.queuedAt);
    const valid =
      Number.isInteger(command.cell.x) &&
      Number.isInteger(command.cell.y) &&
      command.cell.x >= 0 &&
      command.cell.y >= 0 &&
      command.cell.x < 64 &&
      command.cell.y < 64;
    globalThis.postMessage(
      valid
        ? {
            type: "Response",
            requestId: command.requestId,
            acceptedAtTick: scenario.tick,
            result: { accepted: true },
          }
        : { type: "RequestFailed", requestId: command.requestId, message: "Invalid cell" },
    );
  }
  scenario.step();
  samples.push({ tickMs: performance.now() - tickStart, at: performance.now() });
  if (continuationProbe) {
    continuationProbe.step();
    continuationChecks += 1;
    if (canonicalBenchmarkState(scenario) !== canonicalBenchmarkState(continuationProbe)) {
      continuationDivergences += 1;
    }
    if (continuationChecks >= 20) continuationProbe = null;
  }
  // Exercise D-052's maximum allowed projection cadence (10 Hz) in the browser fixture.
  if (scenario.tick % 2 === 0) {
    const projectionStart = performance.now();
    const projection = createBenchmarkProjection(scenario);
    projectionTimings.push(performance.now() - projectionStart);
    projectionNumber += 1;
    globalThis.postMessage({ type: "Projection", projection, projectionId: projectionNumber });
    publishMetrics();
  }
}, 50);

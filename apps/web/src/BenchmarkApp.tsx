import { useEffect, useRef, useState } from "react";

import type { ViewProjectionV2 } from "@landlord/shared";
import type { BenchmarkSnapshot } from "@landlord/simulation";
import { mountIsometricSpike, updateIsometricProjection } from "./isometric/mount";

type BenchmarkMetrics = {
  tick: number;
  tickP95: number;
  tickP99: number;
  samples: number;
  digest: string | null;
  backlog: number;
  maxBacklog: number;
  commandP95: number;
  projectionP95: number;
  serializeP95: number;
  restoreP95: number;
  continuationChecks: number;
  continuationDivergences: number;
};

type BenchmarkResponse = {
  type: "Response";
  requestId: string;
  result?: { snapshot?: BenchmarkSnapshot; bytes?: number };
};

type BenchmarkWorkerMessage =
  | BenchmarkResponse
  | { type: "RequestFailed"; requestId: string; message: string }
  | {
      type: "Ready" | "Projection";
      projection: ViewProjectionV2;
      projectionId?: number;
      metrics?: BenchmarkMetrics;
    }
  | { type: "Metrics"; metrics: BenchmarkMetrics }
  | { type: "ProjectionAck"; projectionId: number };

declare global {
  interface Window {
    __landlordBenchmark?: {
      ready: Promise<void>;
      getMetrics(): BenchmarkMetrics | null;
      getProjectionLatencyP95(): number;
      submitCommand(cell: { x: number; y: number }): Promise<boolean>;
      saveSnapshot(): Promise<{ snapshot: BenchmarkSnapshot; bytes: number }>;
      loadSnapshot(snapshot: BenchmarkSnapshot): Promise<void>;
    };
  }
}

export function BenchmarkApp() {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof mountIsometricSpike> | null>(null);
  const projection = useRef<ViewProjectionV2 | null>(null);
  const [status, setStatus] = useState("Inicializando fixture Gate 1…");

  useEffect(() => {
    if (!container.current) return undefined;
    game.current = mountIsometricSpike(container.current);
    const worker = new Worker(new URL("./worker/benchmark.worker.ts", import.meta.url), {
      type: "module",
    });
    let latestMetrics: BenchmarkMetrics | null = null;
    const projectionLatencies: number[] = [];
    const projectionAckStarts = new Map<number, number>();
    const pending = new Map<
      string,
      { resolve: (response: BenchmarkResponse) => void; reject: (error: Error) => void }
    >();
    let requestNumber = 0;
    let resolveReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const request = (message: Record<string, unknown>): Promise<BenchmarkResponse> =>
      new Promise((resolve, reject) => {
        const requestId = `benchmark-request-${requestNumber++}`;
        pending.set(requestId, { resolve, reject });
        worker.postMessage({ ...message, requestId });
      });
    window.__landlordBenchmark = {
      ready,
      getMetrics: () => latestMetrics,
      getProjectionLatencyP95: () => {
        const sorted = [...projectionLatencies].sort((left, right) => left - right);
        return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
      },
      submitCommand: async (cell) => {
        try {
          const response = await request({ type: "SubmitCommand", cell });
          return response.type === "Response";
        } catch {
          return false;
        }
      },
      saveSnapshot: async () => {
        const response = await request({ type: "SaveSnapshot" });
        if (
          response.type !== "Response" ||
          !response.result?.snapshot ||
          response.result.bytes === undefined
        ) {
          throw new Error("Benchmark save failed");
        }
        return { snapshot: response.result.snapshot, bytes: response.result.bytes };
      },
      loadSnapshot: async (snapshot) => {
        const response = await request({ type: "LoadSnapshot", snapshot });
        if (response.type !== "Response") throw new Error("Benchmark load failed");
      },
    };
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = event.data as BenchmarkWorkerMessage;
      if (message.type === "Response" || message.type === "RequestFailed") {
        const entry = pending.get(message.requestId);
        if (!entry) return;
        pending.delete(message.requestId);
        if (message.type === "RequestFailed") entry.reject(new Error(message.message));
        else entry.resolve(message);
        return;
      }
      if (message.type === "Metrics") {
        latestMetrics = message.metrics;
        return;
      }
      if (message.type === "ProjectionAck") {
        const started = projectionAckStarts.get(message.projectionId);
        if (started !== undefined) {
          projectionLatencies.push(performance.now() - started);
          projectionAckStarts.delete(message.projectionId);
        }
        return;
      }
      if (message.projectionId !== undefined) {
        projectionAckStarts.set(message.projectionId, performance.now());
        worker.postMessage({ type: "ProjectionAck", projectionId: message.projectionId });
      }
      if (message.type === "Ready" && message.metrics) latestMetrics = message.metrics;
      projection.current = message.projection;
      if (game.current) updateIsometricProjection(game.current, message.projection);
      if (message.type === "Ready") {
        setStatus("Fixture Gate 1 activo · 500 agentes · 100 estructuras · Worker a 20 Hz");
        resolveReady?.();
      }
    });
    worker.postMessage({ type: "Initialize", seed: 1 });
    return () => {
      worker.terminate();
      for (const entry of pending.values()) entry.reject(new Error("Benchmark disposed"));
      pending.clear();
      game.current?.destroy(true);
      game.current = null;
      delete window.__landlordBenchmark;
    };
  }, []);

  return (
    <main>
      <h1>Landlord · benchmark Gate 1</h1>
      <p>{status}</p>
      <div ref={container} aria-label="Fixture isométrico de benchmark Gate 1" />
    </main>
  );
}

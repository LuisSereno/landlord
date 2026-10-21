import { useEffect, useRef, useState } from "react";

import type { ViewProjectionV1 } from "@landlord/shared";
import { mountIsometricSpike, updateIsometricProjection } from "./isometric/mount";

type BenchmarkMetrics = {
  tick: number;
  tickP95: number;
  tickP99: number;
  samples: number;
  digest: string | null;
};

declare global {
  interface Window {
    __landlordBenchmark?: {
      ready: Promise<void>;
      getMetrics(): BenchmarkMetrics | null;
    };
  }
}

export function BenchmarkApp() {
  const container = useRef<HTMLDivElement>(null);
  const game = useRef<ReturnType<typeof mountIsometricSpike> | null>(null);
  const projection = useRef<ViewProjectionV1 | null>(null);
  const [status, setStatus] = useState("Inicializando fixture Gate 1…");

  useEffect(() => {
    if (!container.current) return undefined;
    game.current = mountIsometricSpike(container.current);
    const worker = new Worker(new URL("./worker/benchmark.worker.ts", import.meta.url), {
      type: "module",
    });
    let latestMetrics: BenchmarkMetrics | null = null;
    let resolveReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    window.__landlordBenchmark = { ready, getMetrics: () => latestMetrics };
    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = event.data as
        | { type: "Ready" | "Projection"; projection: ViewProjectionV1 }
        | { type: "Metrics"; metrics: BenchmarkMetrics };
      if (message.type === "Metrics") {
        latestMetrics = message.metrics;
        return;
      }
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

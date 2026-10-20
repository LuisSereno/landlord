import { SimulationWorkerRuntime } from "@landlord/simulation";

type WorkerMessagePort = {
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  postMessage(message: unknown): void;
};

const worker = globalThis as unknown as WorkerMessagePort;
const runtime = new SimulationWorkerRuntime();

worker.addEventListener("message", (event) => {
  for (const response of runtime.handle(event.data)) worker.postMessage(response);
});

const TICK_INTERVAL_MS = 50;
setInterval(() => {
  const state = runtime.getState();
  if (!state || state.clock.runState !== "running") return;
  for (const response of runtime.advanceTicks(state.clock.speed)) worker.postMessage(response);
}, TICK_INTERVAL_MS);

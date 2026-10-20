import { describe, expect, it } from "vitest";

import { SimulationWorkerClient, type WorkerPort } from "./client";

class FakeWorker implements WorkerPort {
  private listener?: (event: { data: unknown }) => void;
  public sent: unknown[] = [];

  public postMessage(message: never): void {
    this.sent.push(message);
  }

  public addEventListener(_type: "message", listener: (event: { data: unknown }) => void): void {
    this.listener = listener;
  }

  public emit(message: unknown): void {
    this.listener?.({ data: message });
  }
}

describe("SimulationWorkerClient", () => {
  it("sends versioned requests and resolves correlated responses", async () => {
    const worker = new FakeWorker();
    const projections: unknown[] = [];
    const errors: string[] = [];
    const client = new SimulationWorkerClient(
      worker,
      (projection) => projections.push(projection),
      (error) => errors.push(error),
    );
    const promise = client.initialize(1);
    expect(worker.sent[0]).toMatchObject({ type: "InitializeGame", protocolVersion: 1 });
    worker.emit({
      protocolVersion: 1,
      requestId: "request-1",
      type: "RequestSucceeded",
      payload: { acceptedAtTick: 0 },
    });
    await expect(promise).resolves.toMatchObject({ type: "RequestSucceeded" });
    worker.emit({
      protocolVersion: 1,
      requestId: null,
      type: "ProjectionPublished",
      payload: {
        projectionVersion: 1,
        tick: 0,
        map: { width: 64, height: 64 },
        structures: [],
        agents: [],
      },
    });
    expect(projections).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it("reports malformed Worker messages without mutating client state", () => {
    const worker = new FakeWorker();
    const errors: string[] = [];
    new SimulationWorkerClient(
      worker,
      () => undefined,
      (error) => errors.push(error),
    );
    worker.emit({ invalid: true });
    expect(errors).toEqual(["El Worker devolvió un mensaje inválido."]);
  });
});

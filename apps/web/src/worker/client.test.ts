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

  it("forwards validated session metrics without treating them as a request response", () => {
    const worker = new FakeWorker();
    const diagnostics: unknown[] = [];
    new SimulationWorkerClient(
      worker,
      () => undefined,
      () => undefined,
      (entry) => diagnostics.push(entry),
    );
    worker.emit({
      protocolVersion: 1,
      requestId: null,
      type: "SimulationMetricsPublished",
      payload: {
        tick: 20,
        pendingCommands: 0,
        structures: 1,
        acceptedCommands: 1,
        rejectedCommands: [{ code: "DUPLICATE_COMMAND", count: 1 }],
      },
    });
    expect(diagnostics).toEqual([
      {
        kind: "metrics",
        metrics: {
          tick: 20,
          pendingCommands: 0,
          structures: 1,
          acceptedCommands: 1,
          rejectedCommands: [{ code: "DUPLICATE_COMMAND", count: 1 }],
        },
      },
    ]);
  });

  it("uses a fresh command namespace after recreating the client", () => {
    const firstWorker = new FakeWorker();
    const secondWorker = new FakeWorker();
    const first = new SimulationWorkerClient(
      firstWorker,
      () => undefined,
      () => undefined,
    );
    const second = new SimulationWorkerClient(
      secondWorker,
      () => undefined,
      () => undefined,
    );
    void first.buyParcel("parcel_00000001");
    void second.buyParcel("parcel_00000001");
    const firstId = (firstWorker.sent[0] as { payload: { command: { commandId: string } } }).payload
      .command.commandId;
    const secondId = (secondWorker.sent[0] as { payload: { command: { commandId: string } } })
      .payload.command.commandId;
    expect(firstId).not.toBe(secondId);
  });
});

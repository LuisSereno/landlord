import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { ENGINE_VERSION } from "./snapshot";
import { SimulationWorkerRuntime } from "./worker-runtime";

const initialize = {
  protocolVersion: 2,
  requestId: "request-init",
  type: "InitializeGame" as const,
  payload: { seed: 1 },
};

const submit = {
  protocolVersion: 2,
  requestId: "request-command",
  type: "SubmitCommand" as const,
  payload: {
    command: {
      commandId: parseCommandId("command-1"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceTestStructure" as const,
      payload: { districtId: PLAYER_HOME_DISTRICT_ID, cell: { x: 10, y: 12 } },
    },
  },
};

describe("simulation Worker runtime", () => {
  it("handshakes, initializes and publishes a projection", () => {
    const runtime = new SimulationWorkerRuntime();
    const responses = runtime.handle(initialize);
    expect(responses.map((response) => response.type)).toEqual([
      "RequestSucceeded",
      "ProjectionPublished",
    ]);
    expect(runtime.getState()?.seed).toBe(1);
  });

  it("queues commands between ticks and correlates the result at the next tick", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    expect(runtime.handle(submit)).toEqual([]);
    expect(runtime.advanceTicks(1)).toMatchObject([
      {
        type: "RequestSucceeded",
        requestId: "request-command",
        payload: { acceptedAtTick: 0 },
      },
    ]);
    expect(runtime.getState()?.structures.size).toBe(1);
  });

  it("rejects malformed protocol and duplicate pending commands without mutation", () => {
    const runtime = new SimulationWorkerRuntime();
    // v1 is the only version the runtime must refuse by name; a v2 envelope missing its
    // discriminant is a payload error, not a protocol error.
    expect(runtime.handle({ protocolVersion: 1, requestId: "request-bad" })).toMatchObject([
      { type: "RequestFailed", payload: { code: "UNSUPPORTED_PROTOCOL" } },
    ]);
    expect(runtime.handle({ protocolVersion: 2, requestId: "request-bad" })).toMatchObject([
      { type: "RequestFailed", payload: { code: "INVALID_PAYLOAD" } },
    ]);
    runtime.handle(initialize);
    expect(runtime.handle(submit)).toEqual([]);
    expect(runtime.handle({ ...submit, requestId: "request-duplicate" })).toMatchObject([
      { type: "RequestFailed", payload: { code: "DUPLICATE_COMMAND" } },
    ]);
  });

  it("publishes session metrics without adding them to game state or snapshots", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    runtime.handle(submit);
    runtime.handle({ ...submit, requestId: "request-duplicate" });
    const notifications = runtime
      .advanceTicks(20)
      .filter((response) => response.type === "SimulationMetricsPublished");
    expect(notifications).toMatchObject([
      {
        payload: {
          acceptedCommands: 1,
          rejectedCommands: [{ code: "DUPLICATE_COMMAND", count: 1 }],
        },
      },
    ]);
    expect(
      runtime.handle({
        protocolVersion: 2,
        requestId: "request-metrics",
        type: "GetMetrics" as const,
        payload: {},
      })[0],
    ).toMatchObject({
      type: "RequestSucceeded",
      payload: { result: { tick: 20, acceptedCommands: 1 } },
    });
  });

  it("round-trips a snapshot and preserves the active state on invalid load", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    runtime.handle(submit);
    runtime.advanceTicks(1);
    const saved = runtime.handle({
      protocolVersion: 2,
      requestId: "request-save",
      type: "SaveSnapshot" as const,
      payload: {},
    });
    expect(saved[0]).toMatchObject({
      type: "RequestSucceeded",
      payload: {
        result: { engineVersion: ENGINE_VERSION, schemaVersion: 2 },
      },
    });
    const snapshot = (saved[0] as { payload: { result: { snapshot: unknown } } }).payload.result
      .snapshot;
    expect(
      runtime.handle({
        protocolVersion: 2,
        requestId: "request-invalid-load",
        type: "LoadSnapshot" as const,
        payload: { snapshot: { schemaVersion: 2 } },
      }),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "INVALID_SNAPSHOT" } }]);
    expect(
      runtime.handle({
        protocolVersion: 2,
        requestId: "request-v1-load",
        type: "LoadSnapshot" as const,
        payload: { snapshot: { schemaVersion: 1 } },
      }),
    ).toMatchObject([{ type: "RequestFailed", payload: { code: "UNSUPPORTED_SNAPSHOT_VERSION" } }]);
    expect(runtime.getState()?.structures.size).toBe(1);
    expect(
      runtime
        .handle({
          protocolVersion: 2,
          requestId: "request-load",
          type: "LoadSnapshot" as const,
          payload: { snapshot },
        })
        .map((response) => response.type),
    ).toEqual(["RequestSucceeded", "ProjectionPublished"]);
  });

  it("persists the authoritative pending command queue", () => {
    const runtime = new SimulationWorkerRuntime();
    runtime.handle(initialize);
    runtime.handle(submit);
    const saved = runtime.handle({
      protocolVersion: 2,
      requestId: "request-save-pending",
      type: "SaveSnapshot" as const,
      payload: {},
    });
    const snapshot = (
      saved[0] as { payload: { result: { snapshot: { pendingCommands: unknown[] } } } }
    ).payload.result.snapshot;
    expect(snapshot.pendingCommands).toHaveLength(1);

    const restored = new SimulationWorkerRuntime();
    restored.handle(initialize);
    restored.handle({
      protocolVersion: 2,
      requestId: "request-load-pending",
      type: "LoadSnapshot" as const,
      payload: { snapshot },
    });
    restored.advanceTicks(1);
    expect(restored.getState()?.structures.size).toBe(1);
    expect(restored.getState()?.pendingCommands).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { SimulationWorkerRuntime } from "./worker-runtime";

const initialize = {
  protocolVersion: 1,
  requestId: "request-init",
  type: "InitializeGame" as const,
  payload: { seed: 1 },
};

const submit = {
  protocolVersion: 1,
  requestId: "request-command",
  type: "SubmitCommand" as const,
  payload: {
    command: {
      commandId: parseCommandId("command-1"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceTestStructure" as const,
      payload: { cell: { x: 10, y: 12 } },
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
    expect(runtime.handle({ protocolVersion: 2, requestId: "request-bad" })).toMatchObject([
      { type: "RequestFailed", payload: { code: "UNSUPPORTED_PROTOCOL" } },
    ]);
    runtime.handle(initialize);
    expect(runtime.handle(submit)).toEqual([]);
    expect(runtime.handle({ ...submit, requestId: "request-duplicate" })).toMatchObject([
      { type: "RequestFailed", payload: { code: "DUPLICATE_COMMAND" } },
    ]);
  });
});

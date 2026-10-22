import { describe, expect, it } from "vitest";

import {
  projectionPublishedSchema,
  requestFailedSchema,
  requestSucceededSchema,
  simulationMetricsPublishedSchema,
} from "./responses";

const responseVersion = 1 as const;

describe("Worker responses", () => {
  it("keeps correlated responses separate from notifications", () => {
    expect(
      requestSucceededSchema.parse({
        protocolVersion: responseVersion,
        requestId: "request-1",
        type: "RequestSucceeded",
        payload: { acceptedAtTick: 2 },
      }).requestId,
    ).toBe("request-1");
    expect(
      projectionPublishedSchema.parse({
        protocolVersion: responseVersion,
        requestId: null,
        type: "ProjectionPublished",
        payload: {},
      }).requestId,
    ).toBeNull();
    expect(
      simulationMetricsPublishedSchema.parse({
        protocolVersion: responseVersion,
        requestId: null,
        type: "SimulationMetricsPublished",
        payload: {
          tick: 2,
          pendingCommands: 0,
          structures: 1,
          acceptedCommands: 1,
          rejectedCommands: [],
        },
      }).type,
    ).toBe("SimulationMetricsPublished");
  });

  it("validates stable errors and rejects unknown codes", () => {
    expect(
      requestFailedSchema.parse({
        protocolVersion: responseVersion,
        requestId: "request-1",
        type: "RequestFailed",
        payload: {
          code: "CELL_OCCUPIED",
          message: "The cell is occupied.",
          details: { x: 3, y: 4 },
        },
      }).payload.code,
    ).toBe("CELL_OCCUPIED");
    expect(() =>
      requestFailedSchema.parse({
        protocolVersion: responseVersion,
        requestId: "request-1",
        type: "RequestFailed",
        payload: { code: "UNKNOWN", message: "bad" },
      }),
    ).toThrow();
  });
});

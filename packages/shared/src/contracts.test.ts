import { describe, expect, it } from "vitest";

import {
  getMetricsRequestSchema,
  initializeGameRequestSchema,
  loadSnapshotRequestSchema,
  saveSnapshotRequestSchema,
  setRunStateRequestSchema,
  submitCommandRequestSchema,
} from "./contracts";

const envelope = {
  protocolVersion: 2,
  requestId: "request-17",
} as const;

describe("Worker request envelopes", () => {
  it("parses one valid request of each discriminant", () => {
    expect(
      initializeGameRequestSchema.parse({
        ...envelope,
        type: "InitializeGame",
        payload: { seed: 1 },
      }).type,
    ).toBe("InitializeGame");
    expect(
      submitCommandRequestSchema.parse({
        ...envelope,
        type: "SubmitCommand",
        payload: {
          command: {
            commandId: "command-9",
            issuedByPersonId: "person_00000001",
            actingAsOrganizationId: "org_00000001",
            type: "PlaceTestStructure",
            payload: { districtId: "district_00000004", cell: { x: 10, y: 12 } },
          },
        },
      }).type,
    ).toBe("SubmitCommand");
    expect(
      setRunStateRequestSchema.parse({
        ...envelope,
        type: "SetRunState",
        payload: { state: "running", speed: 2 },
      }).type,
    ).toBe("SetRunState");
    expect(
      saveSnapshotRequestSchema.parse({
        ...envelope,
        type: "SaveSnapshot",
        payload: {},
      }).type,
    ).toBe("SaveSnapshot");
    expect(
      loadSnapshotRequestSchema.parse({
        ...envelope,
        type: "LoadSnapshot",
        payload: { snapshot: {} },
      }).type,
    ).toBe("LoadSnapshot");
    expect(
      getMetricsRequestSchema.parse({
        ...envelope,
        type: "GetMetrics",
        payload: {},
      }).type,
    ).toBe("GetMetrics");
  });

  it("rejects unsupported protocol, invalid payload and unknown run speed", () => {
    expect(() =>
      initializeGameRequestSchema.parse({
        ...envelope,
        protocolVersion: 1,
        type: "InitializeGame",
        payload: { seed: 1 },
      }),
    ).toThrow();
    expect(() =>
      initializeGameRequestSchema.parse({
        ...envelope,
        type: "InitializeGame",
        payload: { seed: -1 },
      }),
    ).toThrow();
    expect(() =>
      setRunStateRequestSchema.parse({
        ...envelope,
        type: "SetRunState",
        payload: { state: "running", speed: 3 },
      }),
    ).toThrow();
  });
});

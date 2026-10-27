import { describe, expect, it } from "vitest";

import * as shared from "./index";

const clone = <T>(value: T): T =>
  (globalThis as typeof globalThis & { structuredClone<T>(value: T): T }).structuredClone(value);

const snapshot = {
  schemaVersion: 1,
  engineVersion: "gate1-dev",
  seed: 1,
  tick: 0,
  prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3, 4] },
  idCounters: { structure: 1, agent: 1, event: 0, commandOrder: 0 },
  map: { width: 64, height: 64, blockedCells: [] },
  playerIdentities: [{ id: "player_00000001", personId: "person_00000001" }],
  persons: [{ id: "person_00000001" }],
  organizations: [{ id: "org_00000001", kind: "company" }],
  controlGrants: [{ personId: "person_00000001", organizationId: "org_00000001" }],
  agents: [],
  structures: [],
  processedCommandIds: [],
  pendingCommands: [],
} as const;

describe("shared wire data", () => {
  it("structured-clones requests, responses, domain events, projections and snapshots", () => {
    const values = [
      shared.initializeGameRequestSchema.parse({
        protocolVersion: 1,
        requestId: "request-1",
        type: "InitializeGame",
        payload: { seed: 1 },
      }),
      shared.requestSucceededSchema.parse({
        protocolVersion: 1,
        requestId: "request-1",
        type: "RequestSucceeded",
        payload: { acceptedAtTick: 1 },
      }),
      shared.placeTestStructureSchema.parse({
        commandId: "command-1",
        issuedByPersonId: "person_00000001",
        actingAsOrganizationId: "org_00000001",
        type: "PlaceTestStructure",
        payload: { cell: { x: 1, y: 1 } },
      }),
      shared.testStructurePlacedSchema.parse({
        eventId: "event-1",
        tick: 1,
        causationCommandId: "command-1",
        type: "TestStructurePlaced",
        payload: {
          structureId: "structure_00000001",
          ownerOrganizationId: "org_00000001",
          cell: { x: 1, y: 1 },
        },
      }),
      shared.viewProjectionV1Schema.parse({
        projectionVersion: 1,
        tick: 1,
        map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells: [] } },
        structures: [],
        agents: [],
      }),
      shared.snapshotV1Schema.parse(snapshot),
    ];

    for (const value of values) {
      expect(clone(value)).toEqual(value);
    }
  });

  it("exposes the package through its public barrel", () => {
    expect(shared.sharedPackage).toBe("@landlord/shared");
    expect(shared.snapshotV1Schema).toBeDefined();
    expect(shared.placeTestStructureSchema).toBeDefined();
  });
});

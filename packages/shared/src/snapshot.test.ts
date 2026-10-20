import { describe, expect, it } from "vitest";

import { parseSnapshotV1, snapshotV1Schema, validateSnapshotReferences } from "./snapshot";

function validSnapshot() {
  return {
    schemaVersion: 1,
    engineVersion: "gate1-dev",
    seed: 1,
    tick: 0,
    prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3, 4] },
    idCounters: { structure: 1, agent: 1, event: 0, commandOrder: 0 },
    map: { width: 64, height: 64, blockedCells: [{ x: 0, y: 0 }] },
    playerIdentities: [{ id: "player_00000001", personId: "person_00000001" }],
    persons: [{ id: "person_00000001" }],
    organizations: [{ id: "org_00000001", kind: "company" }],
    controlGrants: [{ personId: "person_00000001", organizationId: "org_00000001" }],
    agents: [
      {
        id: "agent_00000001",
        cell: { x: 1, y: 1 },
        target: { x: 2, y: 2 },
        path: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      },
    ],
    structures: [
      { id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 3, y: 3 } },
    ],
    processedCommandIds: ["command-1"],
    pendingCommands: [],
  };
}

describe("snapshot v1", () => {
  it("parses a valid fixture and validates references", () => {
    const parsed = parseSnapshotV1(validSnapshot());
    expect(parsed.schemaVersion).toBe(1);
    expect(validateSnapshotReferences(parsed)).toEqual([]);
  });

  it("rejects incompatible schema, invalid PRNG shape and duplicate cells", () => {
    expect(() => snapshotV1Schema.parse({ ...validSnapshot(), schemaVersion: 2 })).toThrow();
    expect(() =>
      snapshotV1Schema.parse({
        ...validSnapshot(),
        prng: { algorithm: "xoshiro128ss-v1", state: [1, 2, 3] },
      }),
    ).toThrow();
    expect(
      validateSnapshotReferences({
        ...validSnapshot(),
        map: {
          width: 64,
          height: 64,
          blockedCells: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
        },
      } as never),
    ).toContainEqual({ code: "DUPLICATE_CELL", path: "map/structures" });
  });

  it("rejects broken entity references before hydration", () => {
    expect(() =>
      parseSnapshotV1({
        ...validSnapshot(),
        structures: [
          { id: "structure_00000001", ownerOrganizationId: "org_00000002", cell: { x: 3, y: 3 } },
        ],
      }),
    ).toThrow(/ownerOrganizationId/);
  });
});

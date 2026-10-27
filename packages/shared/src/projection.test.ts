import { describe, expect, it } from "vitest";

import { viewProjectionV1Schema } from "./projection";

describe("view projection v1", () => {
  it("accepts a serializable projection", () => {
    expect(
      viewProjectionV1Schema.parse({
        projectionVersion: 1,
        tick: 2,
        map: { width: 64, height: 64, roads: { revision: 0, digest: "811c9dc5", cells: [] } },
        structures: [
          { id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 1, y: 2 } },
        ],
        agents: [{ id: "agent_00000001", cell: { x: 2, y: 2 } }],
      }).tick,
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { dispatchPlaceTestStructure } from "./commands";
import { createViewProjection } from "./projection";
import { createInitialState } from "./state";

describe("simulation view projection", () => {
  it("projects confirmed state in stable entity order", () => {
    const state = createInitialState(1);
    dispatchPlaceTestStructure(state, {
      commandId: parseCommandId("command-1"),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceTestStructure",
      payload: { cell: { x: 3, y: 4 } },
    });
    const projection = createViewProjection(state);
    expect(projection).toMatchObject({
      projectionVersion: 1,
      tick: 0,
      map: { width: 64, height: 64 },
      structures: [{ id: "structure_00000001", ownerOrganizationId: "org_00000001", cell: { x: 3, y: 4 } }],
    });
    expect(projection.agents).toHaveLength(16);
  });
});

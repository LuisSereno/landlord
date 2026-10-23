import { describe, expect, it } from "vitest";

import {
  parseCommandId,
  parseOrganizationId,
  parsePersonId,
  parseStructureId,
  type PlaceTestStructure,
} from "@landlord/shared";
import { dispatchPlaceTestStructure } from "./commands";
import { createInitialState } from "./state";

function command(
  commandId: string,
  organizationId = "org_00000001",
  cell = { x: 10, y: 12 },
): PlaceTestStructure {
  return {
    commandId: parseCommandId(commandId),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: parseOrganizationId(organizationId),
    type: "PlaceTestStructure" as const,
    payload: { cell },
  };
}

function observableState(state: ReturnType<typeof createInitialState>) {
  return {
    counters: { ...state.idCounters },
    structures: [...state.structures.entries()],
    processed: [...state.processedCommandIds],
  };
}

describe("PlaceTestStructure command", () => {
  it("validates, transitions atomically and emits a causal event", () => {
    const state = createInitialState(1);
    const result = dispatchPlaceTestStructure(state, command("command-1"));

    expect(result).toMatchObject({
      accepted: true,
      event: { type: "TestStructurePlaced", tick: 0 },
    });
    expect(state.structures.get(parseStructureId("structure_00000001"))).toMatchObject({
      ownerOrganizationId: "org_00000001",
      cell: { x: 10, y: 12 },
    });
    expect(result.accepted && result.event.eventId).toBe("event_00000001");
    expect(state.processedCommandIds.has(parseCommandId("command-1"))).toBe(true);
  });

  it.each([
    [
      "unknown person",
      () => ({ ...command("command-2"), issuedByPersonId: parsePersonId("person_00000002") }),
      "PERSON_NOT_FOUND",
    ],
    ["unknown organization", () => command("command-3", "org_00000005"), "ORGANIZATION_NOT_FOUND"],
    ["without control", () => command("command-4", "org_00000002"), "ACTOR_NOT_AUTHORIZED"],
    [
      "out of bounds",
      () => command("command-5", "org_00000001", { x: 64, y: 0 }),
      "CELL_OUT_OF_BOUNDS",
    ],
  ] as const)("rejects %s without mutation", (_name, makeCommand, code) => {
    const state = createInitialState(1);
    const before = observableState(state);
    const result = dispatchPlaceTestStructure(state, makeCommand());
    expect(result).toEqual({ accepted: false, code });
    expect(observableState(state)).toEqual(before);
  });

  it("rejects occupied cells and duplicate commands without partial changes", () => {
    const state = createInitialState(1);
    expect(dispatchPlaceTestStructure(state, command("command-1")).accepted).toBe(true);
    const beforeOccupied = observableState(state);
    expect(dispatchPlaceTestStructure(state, command("command-2"))).toEqual({
      accepted: false,
      code: "CELL_OCCUPIED",
    });
    expect(observableState(state)).toEqual(beforeOccupied);
    const beforeDuplicate = observableState(state);
    expect(
      dispatchPlaceTestStructure(state, command("command-1", "org_00000001", { x: 11, y: 12 })),
    ).toEqual({
      accepted: false,
      code: "DUPLICATE_COMMAND",
    });
    expect(observableState(state)).toEqual(beforeDuplicate);
  });
});

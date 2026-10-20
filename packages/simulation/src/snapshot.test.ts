import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId, parseTick } from "@landlord/shared";
import { dispatchPlaceTestStructure } from "./commands";
import { createPrng } from "./prng";
import { createInitialState } from "./state";
import { restoreStateFromSnapshot, serializeSnapshot } from "./snapshot";

function command(id: string, x: number) {
  return {
    commandId: parseCommandId(id),
    issuedByPersonId: parsePersonId("person_00000001"),
    actingAsOrganizationId: parseOrganizationId("org_00000001"),
    type: "PlaceTestStructure" as const,
    payload: { cell: { x, y: 4 } },
  };
}

describe("simulation snapshots", () => {
  it("serializes maps in stable order and restores references", () => {
    const state = createInitialState(1);
    expect(dispatchPlaceTestStructure(state, command("command-2", 12)).accepted).toBe(true);
    expect(dispatchPlaceTestStructure(state, command("command-1", 10)).accepted).toBe(true);

    const snapshot = serializeSnapshot(state);
    expect(snapshot.structures.map((structure) => structure.id)).toEqual([
      "structure_00000001",
      "structure_00000002",
    ]);
    expect(restoreStateFromSnapshot(snapshot).structures).toEqual(state.structures);
  });

  it("restores PRNG and continuation exactly", () => {
    const uninterrupted = createInitialState(42);
    const generator = createPrng(42);
    for (let index = 0; index < 7; index += 1) generator.nextUint32();
    uninterrupted.prng = generator.exportState();
    const before = serializeSnapshot(uninterrupted);
    const restored = restoreStateFromSnapshot(before);
    const restoredGenerator = createPrng(42);
    restoredGenerator.restoreState(restored.prng);
    expect(restoredGenerator.nextUint32()).toBe(generator.nextUint32());
    expect(serializeSnapshot(restored)).toEqual(before);
  });

  it("keeps continuation equivalent after save at an intermediate tick", () => {
    const uninterrupted = createInitialState(1);
    expect(dispatchPlaceTestStructure(uninterrupted, command("command-1", 10)).accepted).toBe(true);
    uninterrupted.clock = { ...uninterrupted.clock, tick: parseTick(5) };

    const restored = restoreStateFromSnapshot(serializeSnapshot(uninterrupted));
    const next = command("command-2", 11);
    expect(dispatchPlaceTestStructure(uninterrupted, next)).toEqual(
      dispatchPlaceTestStructure(restored, next),
    );
    expect(serializeSnapshot(restored)).toEqual(serializeSnapshot(uninterrupted));
  });

  it("rejects broken snapshots before callers can replace active state", () => {
    const state = createInitialState(1);
    expect(() => restoreStateFromSnapshot({ schemaVersion: 2 })).toThrow();
    expect(state.clock.tick).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { parseOrganizationId, parsePersonId } from "@landlord/shared";
import { createInitialState, hasOrganizationControl } from "./state";

describe("minimum simulation state", () => {
  it("creates one person, two companies, one bank, one insurer and one control grant", () => {
    const state = createInitialState(1);
    const personId = parsePersonId("person_00000001");
    const controlledOrganizationId = parseOrganizationId("org_00000001");
    const independentOrganizationId = parseOrganizationId("org_00000002");

    expect(state.persons.size).toBe(17);
    expect(state.organizations.size).toBe(5);
    expect(hasOrganizationControl(state, personId, controlledOrganizationId)).toBe(true);
    expect(hasOrganizationControl(state, personId, independentOrganizationId)).toBe(false);
    expect(state.structures.size).toBe(0);
  });

  it("keeps seed, clock, allocator and ownership-ready maps explicit", () => {
    const state = createInitialState(42);
    expect(state.seed).toBe(42);
    expect(state.clock).toMatchObject({ tick: 0, runState: "paused", speed: 1 });
    expect(state.prng.algorithm).toBe("xoshiro128ss-v1");
    expect(state.idCounters).toEqual({ structure: 0, agent: 16, event: 0, commandOrder: 0 });
    expect(state.phase2.crews.size).toBe(4);
    expect(state.agents.size).toBe(16);
    expect(state.map).toMatchObject({ width: 64, height: 64 });
  });

  it("rejects an invalid seed before creating state", () => {
    expect(() => createInitialState(-1)).toThrow();
  });
});

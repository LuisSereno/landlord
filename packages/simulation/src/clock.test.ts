import { describe, expect, it } from "vitest";

import { orderEntityIds, orderSystemNames, SimulationClock, SYSTEM_ORDER } from "./clock";

describe("fixed simulation clock", () => {
  it("keeps logical ticks independent from run state and speed", () => {
    const direct = new SimulationClock();
    direct.step(100);

    const stepped = new SimulationClock();
    for (let index = 0; index < 100; index += 1) stepped.step();

    expect(direct.getState().tick).toBe(stepped.getState().tick);
    direct.setRunState("running", 4);
    expect(direct.getState()).toMatchObject({ tick: 100, runState: "running", speed: 4 });
    direct.setRunState("paused");
    expect(direct.getState().tick).toBe(100);
  });

  it("rejects invalid step counts and overflowing ticks", () => {
    const clock = new SimulationClock();
    expect(() => clock.step(-1)).toThrow();
    expect(() => clock.step(1.5)).toThrow();
    clock.step(Number.MAX_SAFE_INTEGER);
    expect(() => clock.step(1)).toThrow();
  });

  it("orders known systems and entity IDs explicitly", () => {
    expect(orderSystemNames(["metrics", "commands", "movement"])).toEqual(SYSTEM_ORDER);
    expect(orderEntityIds(["org_00000002", "org_00000001"])).toEqual([
      "org_00000001",
      "org_00000002",
    ]);
    expect(() => orderSystemNames(["commands", "commands"])).toThrow();
  });
});

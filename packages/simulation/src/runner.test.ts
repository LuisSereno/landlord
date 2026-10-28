import { PLAYER_HOME_DISTRICT_ID } from "./city";
import { describe, expect, it } from "vitest";

import { parseCommandId, parseOrganizationId, parsePersonId } from "@landlord/shared";
import { findFirstDivergentTick, runScenario, type ScheduledCommand } from "./runner";

function scheduled(commandId: string, atTick: number, x: number): ScheduledCommand {
  return {
    atTick,
    command: {
      commandId: parseCommandId(commandId),
      issuedByPersonId: parsePersonId("person_00000001"),
      actingAsOrganizationId: parseOrganizationId("org_00000001"),
      type: "PlaceTestStructure",
      payload: { districtId: PLAYER_HOME_DISTRICT_ID, cell: { x, y: 12 } },
    },
  };
}

describe("headless scenario runner", () => {
  it("runs a seeded sequence and records checkpoints", () => {
    const run = runScenario(1, [scheduled("command-1", 0, 10)], 10);
    expect(run.state.clock.tick).toBe(10);
    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.result.accepted).toBe(true);
    expect(run.checkpoints).toHaveLength(10);
  });

  it("rejects commands outside the scenario window", () => {
    expect(() => runScenario(1, [scheduled("command-1", 10, 10)], 10)).toThrow();
    expect(() => runScenario(1, [scheduled("command-1", -1, 10)], 10)).toThrow();
  });

  it("repeats the same seed and commands exactly", () => {
    const commands = [scheduled("command-1", 0, 10), scheduled("command-2", 3, 11)];
    const first = runScenario(1, commands, 1000, { checkpointEvery: 0 });
    const second = runScenario(1, commands, 1000, { checkpointEvery: 0 });
    expect(first.checkpoints.at(-1)?.canonicalState).toBe(
      second.checkpoints.at(-1)?.canonicalState,
    );
    expect(findFirstDivergentTick(first, second)).toBeNull();
  }, 30_000);

  it("reports the first checkpoint that diverges by seed or command", () => {
    const first = runScenario(1, [scheduled("command-1", 0, 10)], 10);
    const changedSeed = runScenario(2, [scheduled("command-1", 0, 10)], 10);
    const changedCommand = runScenario(1, [scheduled("command-1", 0, 11)], 10);
    expect(findFirstDivergentTick(first, changedSeed)).toBe(1);
    expect(findFirstDivergentTick(first, changedCommand)).toBe(1);
  });
});

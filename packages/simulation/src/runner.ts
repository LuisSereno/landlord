import { type ProductCommand } from "@landlord/shared";
import type { CommandResult, ProductCommandResult } from "./commands";
import { dispatchPlaceTestStructure, dispatchProductCommand } from "./commands";
import { createInitialState, type GameState } from "./state";
import { advanceProductSystems } from "./systems";

function orderedMapValues<T>(map: ReadonlyMap<string, T>): T[] {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

export type ScheduledCommand = {
  atTick: number;
  command: ProductCommand;
};

export type ScenarioCheckpoint = {
  tick: number;
  canonicalState: string;
};

export type ScenarioRun = {
  state: GameState;
  results: Array<{ atTick: number; result: CommandResult | ProductCommandResult }>;
  checkpoints: ScenarioCheckpoint[];
};

export function createScenarioState(seed: number): GameState {
  return createInitialState(seed);
}

export function canonicalizeState(state: GameState): string {
  return JSON.stringify({
    seed: state.seed,
    clock: state.clock,
    prng: state.prng,
    idCounters: state.idCounters,
    map: {
      width: state.map.width,
      height: state.map.height,
      blockedCells: [...state.map.blockedCells].sort(),
    },
    playerIdentities: orderedMapValues(state.playerIdentities),
    persons: orderedMapValues(state.persons),
    organizations: orderedMapValues(state.organizations),
    controlGrants: [...state.controlGrants.values()].sort((left, right) =>
      `${left.personId}:${left.organizationId}`.localeCompare(
        `${right.personId}:${right.organizationId}`,
      ),
    ),
    agents: orderedMapValues(state.agents),
    structures: orderedMapValues(state.structures),
    processedCommandIds: [...state.processedCommandIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    phase2: {
      district: state.phase2.district,
      parcels: orderedMapValues(state.phase2.parcels),
      balances: orderedMapValues(state.phase2.balances),
      inventories: orderedMapValues(state.phase2.inventories),
      facilities: orderedMapValues(state.phase2.facilities),
      buildings: orderedMapValues(state.phase2.buildings),
      constructionSites: orderedMapValues(state.phase2.constructionSites),
      tenants: orderedMapValues(state.phase2.tenants),
      transactions: state.phase2.transactions,
      ordinance: state.phase2.ordinance,
      crime: state.phase2.crime,
      influenceByOrganizationId: orderedMapValues(state.phase2.influenceByOrganizationId),
      loans: orderedMapValues(state.phase2.loans),
      taxation: state.phase2.taxation,
      maintenance: state.phase2.maintenance,
      insurance: state.phase2.insurance,
      permitting: state.phase2.permitting,
      insolvency: state.phase2.insolvency,
      rivalAi: state.phase2.rivalAi,
    },
  });
}

export function runScenario(
  seed: number,
  scheduledCommands: readonly ScheduledCommand[],
  totalTicks: number,
): ScenarioRun {
  if (!Number.isSafeInteger(totalTicks) || totalTicks < 0) {
    throw new RangeError("Scenario duration must be a non-negative safe integer");
  }
  const commands = [...scheduledCommands].sort((left, right) => left.atTick - right.atTick);
  if (
    commands.some((scheduled) => !Number.isSafeInteger(scheduled.atTick) || scheduled.atTick < 0)
  ) {
    throw new RangeError("Scheduled command ticks must be non-negative safe integers");
  }
  if (commands.some((scheduled) => scheduled.atTick >= totalTicks && totalTicks > 0)) {
    throw new RangeError("Scheduled command must execute before scenario end");
  }

  const state = createScenarioState(seed);
  const results: ScenarioRun["results"] = [];
  const checkpoints: ScenarioCheckpoint[] = [];
  let commandIndex = 0;

  for (let step = 0; step < totalTicks; step += 1) {
    const atTick = state.clock.tick;
    while (commandIndex < commands.length && commands[commandIndex]!.atTick === atTick) {
      const scheduled = commands[commandIndex]!;
      results.push({
        atTick,
        result:
          scheduled.command.type === "PlaceTestStructure"
            ? dispatchPlaceTestStructure(state, scheduled.command)
            : dispatchProductCommand(state, scheduled.command),
      });
      commandIndex += 1;
    }
    advanceProductSystems(state);
    checkpoints.push({ tick: state.clock.tick, canonicalState: canonicalizeState(state) });
  }

  if (commandIndex !== commands.length) {
    throw new Error("Scenario contains a command that was not scheduled");
  }
  return { state, results, checkpoints };
}

export function findFirstDivergentTick(left: ScenarioRun, right: ScenarioRun): number | null {
  const length = Math.max(left.checkpoints.length, right.checkpoints.length);
  for (let index = 0; index < length; index += 1) {
    if (left.checkpoints[index]?.canonicalState !== right.checkpoints[index]?.canonicalState) {
      return left.checkpoints[index]?.tick ?? right.checkpoints[index]?.tick ?? null;
    }
  }
  return null;
}

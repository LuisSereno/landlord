import { parseTick, type Tick } from "@landlord/shared";

export const SYSTEM_ORDER = ["commands", "movement", "metrics"] as const;

export type SimulationSystemName = (typeof SYSTEM_ORDER)[number];
export type RunState = "paused" | "running";
export type SimulationSpeed = 1 | 2 | 4;

export type ClockState = {
  tick: Tick;
  runState: RunState;
  speed: SimulationSpeed;
};

const systemRank = new Map<SimulationSystemName, number>(
  SYSTEM_ORDER.map((name, index) => [name, index]),
);

export function orderSystemNames(names: readonly SimulationSystemName[]): SimulationSystemName[] {
  const unique = new Set(names);
  if (unique.size !== names.length) throw new Error("Simulation systems must be unique");
  return [...names].sort((left, right) => systemRank.get(left)! - systemRank.get(right)!);
}

export function orderEntityIds(ids: readonly string[]): string[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

export class SimulationClock {
  private state: ClockState = {
    tick: parseTick(0),
    runState: "paused",
    speed: 1,
  };

  public getState(): ClockState {
    return { ...this.state };
  }

  public setRunState(runState: RunState, speed: SimulationSpeed = this.state.speed): void {
    this.state = { ...this.state, runState, speed };
  }

  public step(count = 1): Tick {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError("Clock step count must be a non-negative safe integer");
    }
    const next = this.state.tick + count;
    this.state = { ...this.state, tick: parseTick(next) };
    return this.state.tick;
  }

  public reset(tick: Tick = parseTick(0)): void {
    this.state = { ...this.state, tick };
  }
}

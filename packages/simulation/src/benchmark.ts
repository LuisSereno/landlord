import {
  parseAgentId,
  parseOrganizationId,
  parseSeed,
  parseStructureId,
  parseTick,
  type GridCell,
  type Seed,
  type Tick,
  type ViewProjectionV1,
} from "@landlord/shared";
import { createPrng } from "./prng";

export const BENCHMARK_MAP_SIZE = 64;
export const BENCHMARK_BUILDING_COUNT = 100;
export const BENCHMARK_AGENT_COUNT = 500;

type BenchmarkAgent = {
  id: ReturnType<typeof parseAgentId>;
  cell: GridCell;
  target: GridCell;
  path: GridCell[];
  pathIndex: number;
  completed: boolean;
};

export type BenchmarkScenario = {
  seed: Seed;
  tick: Tick;
  blockedCells: Set<string>;
  buildings: Array<{ id: ReturnType<typeof parseStructureId>; cell: GridCell }>;
  agents: Map<string, BenchmarkAgent>;
  step(): void;
};

export type BenchmarkScenarioOptions = {
  agentCount?: number;
  navigation?: boolean;
};

export type BenchmarkSample = {
  tickMs: number;
  projectionMs: number;
};

export type BenchmarkResult = {
  seed: Seed;
  warmupTicks: number;
  measuredTicks: number;
  samples: BenchmarkSample[];
  finalDigest: string;
};

type Measure = (operation: () => void) => number;

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function cellKey(cell: GridCell): string {
  return `${cell.x}:${cell.y}`;
}

function cellIndex(cell: GridCell): number {
  return cell.y * BENCHMARK_MAP_SIZE + cell.x;
}

function indexCell(index: number): GridCell {
  return { x: index % BENCHMARK_MAP_SIZE, y: Math.floor(index / BENCHMARK_MAP_SIZE) };
}

function inBounds(cell: GridCell): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < BENCHMARK_MAP_SIZE && cell.y < BENCHMARK_MAP_SIZE;
}

function manhattan(left: GridCell, right: GridCell): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function compareQueue(
  left: { index: number; f: number; h: number },
  right: { index: number; f: number; h: number },
): number {
  return left.f - right.f || left.h - right.h || left.index - right.index;
}

function pushQueue(
  queue: Array<{ index: number; f: number; h: number }>,
  item: { index: number; f: number; h: number },
): void {
  queue.push(item);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (compareQueue(queue[parent]!, queue[index]!) <= 0) break;
    [queue[parent], queue[index]] = [queue[index]!, queue[parent]!];
    index = parent;
  }
}

function popQueue(
  queue: Array<{ index: number; f: number; h: number }>,
): { index: number; f: number; h: number } | undefined {
  const first = queue[0];
  const last = queue.pop();
  if (last && queue.length > 0) {
    queue[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < queue.length && compareQueue(queue[left]!, queue[smallest]!) < 0) smallest = left;
      if (right < queue.length && compareQueue(queue[right]!, queue[smallest]!) < 0)
        smallest = right;
      if (smallest === index) break;
      [queue[index], queue[smallest]] = [queue[smallest]!, queue[index]!];
      index = smallest;
    }
  }
  return first;
}

function findPath(
  start: GridCell,
  target: GridCell,
  blockedCells: ReadonlySet<string>,
): GridCell[] {
  if (cellKey(start) === cellKey(target)) return [];
  const total = BENCHMARK_MAP_SIZE * BENCHMARK_MAP_SIZE;
  const gScore = new Float64Array(total);
  gScore.fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);
  const queue: Array<{ index: number; f: number; h: number }> = [];
  const startIndex = cellIndex(start);
  const targetIndex = cellIndex(target);
  gScore[startIndex] = 0;
  pushQueue(queue, { index: startIndex, f: manhattan(start, target), h: manhattan(start, target) });

  while (queue.length > 0) {
    const current = popQueue(queue)!;
    if (closed[current.index]) continue;
    closed[current.index] = 1;
    if (current.index === targetIndex) {
      const path: GridCell[] = [];
      let index = targetIndex;
      while (index !== startIndex) {
        path.push(indexCell(index));
        index = cameFrom[index]!;
      }
      path.reverse();
      return path;
    }
    const currentCell = indexCell(current.index);
    for (const direction of DIRECTIONS) {
      const neighbor = { x: currentCell.x + direction.x, y: currentCell.y + direction.y };
      if (!inBounds(neighbor) || blockedCells.has(cellKey(neighbor))) continue;
      const neighborIndex = cellIndex(neighbor);
      if (closed[neighborIndex]) continue;
      const tentative = gScore[current.index]! + 1;
      if (tentative >= gScore[neighborIndex]!) continue;
      cameFrom[neighborIndex] = current.index;
      gScore[neighborIndex] = tentative;
      const h = manhattan(neighbor, target);
      pushQueue(queue, { index: neighborIndex, f: tentative + h, h });
    }
  }
  return [];
}

function nextFreeCell(
  prng: ReturnType<typeof createPrng>,
  blockedCells: ReadonlySet<string>,
  occupied: Set<string>,
): GridCell {
  for (let attempt = 0; attempt < BENCHMARK_MAP_SIZE * BENCHMARK_MAP_SIZE; attempt += 1) {
    const cell = { x: prng.nextInt(0, BENCHMARK_MAP_SIZE), y: prng.nextInt(0, BENCHMARK_MAP_SIZE) };
    if (!blockedCells.has(cellKey(cell)) && !occupied.has(cellKey(cell))) return cell;
  }
  throw new Error("Benchmark fixture ran out of free cells");
}

export function createBenchmarkScenario(
  seedValue: number,
  options: BenchmarkScenarioOptions = {},
): BenchmarkScenario {
  const seed = parseSeed(seedValue);
  const prng = createPrng(seed);
  const agentCount = options.agentCount ?? BENCHMARK_AGENT_COUNT;
  const navigation = options.navigation ?? true;
  const blockedCells = new Set<string>();
  const buildings: BenchmarkScenario["buildings"] = [];
  for (let candidateIndex = 0; buildings.length < BENCHMARK_BUILDING_COUNT; candidateIndex += 1) {
    const candidate = {
      x: (candidateIndex * 17 + 3) % BENCHMARK_MAP_SIZE,
      y:
        (Math.floor(candidateIndex / BENCHMARK_MAP_SIZE) * 11 + candidateIndex * 31 + 7) %
        BENCHMARK_MAP_SIZE,
    };
    if (blockedCells.has(cellKey(candidate))) continue;
    const index = buildings.length;
    blockedCells.add(cellKey(candidate));
    buildings.push({
      id: parseStructureId(`structure_${String(index + 1).padStart(8, "0")}`),
      cell: candidate,
    });
  }

  const occupied = new Set(blockedCells);
  const agents = new Map<string, BenchmarkAgent>();
  for (let index = 0; index < agentCount; index += 1) {
    const cell = nextFreeCell(prng, blockedCells, occupied);
    occupied.add(cellKey(cell));
    const target = nextFreeCell(prng, blockedCells, occupied);
    const id = parseAgentId(`agent_${String(index + 1).padStart(8, "0")}`);
    const path = navigation ? findPath(cell, target, blockedCells) : [];
    agents.set(id, { id, cell, target, path, pathIndex: 0, completed: false });
  }

  const scenario: BenchmarkScenario = {
    seed,
    tick: parseTick(0),
    blockedCells,
    buildings,
    agents,
    step() {
      if (!navigation) {
        scenario.tick = parseTick(scenario.tick + 1);
        return;
      }
      const occupiedCells = new Set([...agents.values()].map((other) => cellKey(other.cell)));
      for (const agent of agents.values()) {
        if (agent.completed) continue;
        if (agent.pathIndex < agent.path.length) {
          occupiedCells.delete(cellKey(agent.cell));
          agent.cell = agent.path[agent.pathIndex]!;
          agent.pathIndex += 1;
          occupiedCells.add(cellKey(agent.cell));
          continue;
        }
        agent.completed = true;
      }
      scenario.tick = parseTick(scenario.tick + 1);
    },
  };
  return scenario;
}

export function createBenchmarkProjection(scenario: BenchmarkScenario): ViewProjectionV1 {
  return {
    projectionVersion: 1,
    tick: scenario.tick,
    map: { width: 64, height: 64 },
    structures: scenario.buildings.map((building) => ({
      id: building.id,
      ownerOrganizationId: parseOrganizationId("org_00000001"),
      cell: building.cell,
    })),
    agents: [...scenario.agents.values()].map((agent) => ({ id: agent.id, cell: agent.cell })),
  };
}

export function canonicalBenchmarkState(scenario: BenchmarkScenario): string {
  return JSON.stringify({
    seed: scenario.seed,
    tick: scenario.tick,
    buildings: scenario.buildings,
    agents: [...scenario.agents.values()].map((agent) => ({
      id: agent.id,
      cell: agent.cell,
      target: agent.target,
      pathIndex: agent.pathIndex,
      completed: agent.completed,
    })),
  });
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

export function runReferenceBenchmark(
  seedValue: number,
  options: { warmupTicks: number; measuredTicks: number; measure: Measure; navigation?: boolean },
): BenchmarkResult {
  const scenario = createBenchmarkScenario(
    seedValue,
    options.navigation === undefined ? {} : { navigation: options.navigation },
  );
  for (let tick = 0; tick < options.warmupTicks; tick += 1) scenario.step();
  const samples: BenchmarkSample[] = [];
  for (let tick = 0; tick < options.measuredTicks; tick += 1) {
    const tickMs = options.measure(() => scenario.step());
    const projectionMs = options.measure(() => void createBenchmarkProjection(scenario));
    samples.push({ tickMs, projectionMs });
  }
  return {
    seed: scenario.seed,
    warmupTicks: options.warmupTicks,
    measuredTicks: options.measuredTicks,
    samples,
    finalDigest: canonicalBenchmarkState(scenario),
  };
}

export function summarizeBenchmark(result: BenchmarkResult) {
  const ticks = result.samples.map((sample) => sample.tickMs);
  const projections = result.samples.map((sample) => sample.projectionMs);
  return {
    seed: result.seed,
    measuredTicks: result.measuredTicks,
    tick: {
      mean: ticks.reduce((sum, value) => sum + value, 0) / ticks.length,
      p50: percentile(ticks, 0.5),
      p95: percentile(ticks, 0.95),
      p99: percentile(ticks, 0.99),
      max: Math.max(...ticks),
    },
    projection: {
      mean: projections.reduce((sum, value) => sum + value, 0) / projections.length,
      p95: percentile(projections, 0.95),
      max: Math.max(...projections),
    },
  };
}

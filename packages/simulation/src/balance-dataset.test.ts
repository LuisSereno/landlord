import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contrato de los dos datasets de balance versionados. Los números los producen las campañas; esta
 * prueba sólo exige que cada archivo sea internamente coherente, que no se contradiga con sus propias
 * filas y que declare para qué sirve su mundo.
 */

type Comparison = {
  metric: string;
  candidate: string;
  baseline: string;
  wins: number;
  seeds: number;
  dominant: boolean;
};

type MetricRow = {
  strategy: string;
  seed: number;
  playerCash: number;
  vacancyPercent: number;
  topParcelSharePercent: number;
  parcelHhi: number;
  mobilityTotal: number;
  debtOutstanding: number;
  defaultedLoans: number;
  municipalReserve: number;
  deficitMonths: number;
};

type BaseDataset = {
  schemaVersion: number;
  datasetId: string;
  generatedAt: string;
  tool: string;
  worldKind: string;
  usage: string;
  engine: {
    commit: string;
    seeds: number[];
    months: number;
    districtProfileId: string;
  };
  strategies: string[];
  rows: MetricRow[];
  aggregates: Record<string, Record<string, number>>;
  comparisons: Comparison[];
  balanceFlags: string[];
  violations: string[];
};

type SyntheticDataset = BaseDataset & {
  worldKind: "synthetic_load_harness";
  tool: "pnpm balance:campaign";
  engine: BaseDataset["engine"] & { parcelCount: number };
};

type CommandTally = {
  accepted: number;
  rejected: number;
  rejectionCodes: Record<string, number>;
};

type PlayableRow = MetricRow & {
  worldParcelCount: number;
  playerDebt: number;
  playerParcels: number;
  playerBuildings: number;
  playerAssetBookValue: number;
  acceptedCommands: number;
  rejectedCommands: number;
};

type PlayableDataset = Omit<BaseDataset, "rows" | "worldKind" | "tool" | "engine"> & {
  worldKind: "playable_generated_district";
  tool: "pnpm balance:playable";
  engine: BaseDataset["engine"] & {
    startingCash: number;
    financeCashFloor: number;
    dominantThreshold: number;
  };
  rows: PlayableRow[];
  commandAudit: Record<string, Record<string, CommandTally>>;
  dominance: {
    metric: string;
    seeds: number;
    thresholdWins: number;
    winsByStrategy: Record<string, number>;
    anyDominant: boolean;
    note: string;
  };
};

function readDataset(fileName: string): BaseDataset {
  return JSON.parse(
    readFileSync(new URL(`../../../docs/balance/${fileName}`, import.meta.url), "utf8"),
  ) as BaseDataset;
}

const synthetic = readDataset("synthetic-city-balance-v1.json") as SyntheticDataset;
const playable = readDataset("playable-alpha-baseline-v1.json") as PlayableDataset;

const STRATEGIES = ["passive", "maintained", "delegated_deferred", "delegated_balanced"];

/** El desempate del ganador por semilla es el mismo que usan la campaña y el pipeline. */
function winnerBySeed(dataset: BaseDataset, seed: number): string {
  return dataset.strategies
    .map((strategy) => ({
      strategy,
      cash: dataset.rows.find((row) => row.strategy === strategy && row.seed === seed)?.playerCash,
    }))
    .sort(
      (left, right) =>
        (right.cash ?? Number.NaN) - (left.cash ?? Number.NaN) ||
        left.strategy.localeCompare(right.strategy),
    )[0]!.strategy;
}

function expectSharedContract(dataset: BaseDataset): void {
  expect(dataset.schemaVersion).toBe(1);
  expect(dataset.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(dataset.usage.length).toBeGreaterThan(0);
  expect(dataset.engine.seeds.length).toBeGreaterThan(0);
  expect(new Set(dataset.engine.seeds).size).toBe(dataset.engine.seeds.length);
  expect([...dataset.engine.seeds].sort((left, right) => left - right)).toEqual(
    dataset.engine.seeds,
  );
  expect(dataset.engine.months).toBeGreaterThan(0);
  expect(dataset.engine.districtProfileId.length).toBeGreaterThan(0);

  expect(dataset.strategies).toEqual(STRATEGIES);
  expect(dataset.rows).toHaveLength(dataset.strategies.length * dataset.engine.seeds.length);
  const combinations = new Set(dataset.rows.map((row) => `${row.strategy}:${row.seed}`));
  expect(combinations.size).toBe(dataset.rows.length);
  for (const row of dataset.rows) {
    expect(dataset.strategies).toContain(row.strategy);
    expect(dataset.engine.seeds).toContain(row.seed);
    for (const [key, value] of Object.entries(row)) {
      if (key === "strategy" || key === "seed") continue;
      expect(Number.isFinite(value), `${row.strategy}:${row.seed}:${key}`).toBe(true);
    }
    expect(row.vacancyPercent).toBeGreaterThanOrEqual(0);
    expect(row.vacancyPercent).toBeLessThanOrEqual(100);
    expect(row.topParcelSharePercent).toBeGreaterThanOrEqual(0);
    expect(row.topParcelSharePercent).toBeLessThanOrEqual(100);
    expect(row.parcelHhi).toBeGreaterThanOrEqual(0);
    expect(row.parcelHhi).toBeLessThanOrEqual(10_000);
    expect(row.defaultedLoans).toBeGreaterThanOrEqual(0);
    expect(row.deficitMonths).toBeGreaterThanOrEqual(0);
  }

  for (const strategy of dataset.strategies) {
    expect(dataset.aggregates[strategy], strategy).toBeDefined();
    expect(Object.keys(dataset.aggregates[strategy]!).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(dataset.aggregates[strategy]!)) {
      expect(Number.isFinite(value), `${strategy}:${key}`).toBe(true);
    }
  }

  expect(dataset.comparisons.length).toBeGreaterThan(0);
  for (const comparison of dataset.comparisons) {
    expect(comparison.metric).toBe("playerCash");
    expect(dataset.strategies).toContain(comparison.candidate);
    expect(dataset.strategies).toContain(comparison.baseline);
    expect(comparison.seeds).toBe(dataset.engine.seeds.length);
    expect(comparison.wins).toBeGreaterThanOrEqual(0);
    expect(comparison.wins).toBeLessThanOrEqual(comparison.seeds);
    expect(comparison.dominant).toBe(comparison.wins >= Math.ceil(comparison.seeds * 0.9));
    /** Recalcula la comparación desde las filas: el dataset no puede contradecirse. */
    const wins = dataset.engine.seeds.filter((seed) => {
      const candidate = dataset.rows.find(
        (row) => row.strategy === comparison.candidate && row.seed === seed,
      )!;
      const baseline = dataset.rows.find(
        (row) => row.strategy === comparison.baseline && row.seed === seed,
      )!;
      return candidate.playerCash > baseline.playerCash;
    }).length;
    expect(wins, `${comparison.candidate}:${comparison.baseline}`).toBe(comparison.wins);
  }
  for (const flag of dataset.balanceFlags) {
    expect(typeof flag).toBe("string");
    expect(flag.length).toBeGreaterThan(0);
  }
  expect(dataset.violations).toEqual([]);
}

describe("WP4.14 datasets de balance versionados", () => {
  it("el dataset de la ciudad sintética declara que es un arnés de carga", () => {
    expectSharedContract(synthetic);
    expect(synthetic.datasetId).toBe("synthetic-city-balance-v1");
    expect(synthetic.worldKind).toBe("synthetic_load_harness");
    expect(synthetic.tool).toBe("pnpm balance:campaign");
    expect(synthetic.engine.parcelCount).toBeGreaterThan(0);
    // El archivo tiene que decir por sí solo que no es una baseline de gameplay.
    expect(synthetic.usage).toContain("createScaledCity");
    expect(synthetic.usage).toContain("no balance de gameplay");
    expect(synthetic.usage).toContain("playable-alpha-baseline-v1.json");
  });

  it("el dataset jugable arranca de la posición legítima y audita sus comandos", () => {
    expectSharedContract(playable);
    expect(playable.datasetId).toBe("playable-alpha-baseline-v1");
    expect(playable.worldKind).toBe("playable_generated_district");
    expect(playable.tool).toBe("pnpm balance:playable");
    expect(playable.usage).toContain("createInitialState");
    expect(playable.usage).toContain("synthetic-city-balance-v1.json");
    expect(playable.engine.startingCash).toBe(12_000);
    expect(playable.engine.financeCashFloor).toBeGreaterThan(0);
    expect(playable.engine.dominantThreshold).toBe(Math.ceil(playable.engine.seeds.length * 0.9));

    for (const row of playable.rows) {
      expect(row.worldParcelCount, `${row.strategy}:${row.seed}`).toBeGreaterThan(0);
      expect(row.playerDebt, `${row.strategy}:${row.seed}`).toBeGreaterThanOrEqual(0);
      expect(row.playerParcels, `${row.strategy}:${row.seed}`).toBeGreaterThan(0);
      expect(row.playerAssetBookValue, `${row.strategy}:${row.seed}`).toBeGreaterThan(0);
      expect(row.acceptedCommands, `${row.strategy}:${row.seed}`).toBeGreaterThan(0);
      expect(row.rejectedCommands, `${row.strategy}:${row.seed}`).toBeGreaterThanOrEqual(0);
    }

    /** Cada estrategia hizo algo de verdad: ningún bloqueo silencioso de la rutina de crecimiento. */
    const growthCommands = [
      "BuyParcel",
      "RequestPermit",
      "StartConstruction",
      "AssignCrewToWorkOrder",
    ];
    for (const strategy of playable.strategies) {
      const audit = playable.commandAudit[strategy]!;
      expect(audit["SetMaintenancePolicy"]?.accepted, strategy).toBe(playable.engine.seeds.length);
      expect(audit["SetAutomationPolicy"]?.accepted, strategy).toBe(playable.engine.seeds.length);
      for (const type of growthCommands) {
        expect(audit[type]?.accepted ?? 0, `${strategy}:${type}`).toBeGreaterThan(0);
      }
      const accepted = Object.values(audit).reduce((total, tally) => total + tally.accepted, 0);
      const rejected = Object.values(audit).reduce((total, tally) => total + tally.rejected, 0);
      const rows = playable.rows.filter((row) => row.strategy === strategy);
      expect(accepted, strategy).toBe(rows.reduce((total, row) => total + row.acceptedCommands, 0));
      expect(rejected, strategy).toBe(rows.reduce((total, row) => total + row.rejectedCommands, 0));
    }
  });

  it("el dataset jugable no afirma una dominancia que sus datos no sostienen", () => {
    const anyComparisonDominant = playable.comparisons.some((comparison) => comparison.dominant);
    expect(playable.dominance.metric).toBe("playerCash");
    expect(playable.dominance.seeds).toBe(playable.engine.seeds.length);
    expect(playable.dominance.thresholdWins).toBe(playable.engine.dominantThreshold);
    expect(playable.dominance.anyDominant).toBe(anyComparisonDominant);
    expect(Object.keys(playable.dominance.winsByStrategy).sort()).toEqual(
      [...playable.strategies].sort(),
    );
    const wins = Object.values(playable.dominance.winsByStrategy);
    for (const value of wins) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(playable.engine.seeds.length);
    }
    expect(wins.reduce((total, value) => total + value, 0)).toBe(playable.engine.seeds.length);
    for (const strategy of playable.strategies) {
      const recounted = playable.engine.seeds.filter(
        (seed) => winnerBySeed(playable, seed) === strategy,
      ).length;
      expect(playable.dominance.winsByStrategy[strategy], strategy).toBe(recounted);
      expect(playable.dominance.winsByStrategy[strategy]!).toBeLessThan(
        playable.engine.dominantThreshold,
      );
    }
    expect(playable.balanceFlags).toContain("no_dominant_strategy_in_playable_campaign");
    expect(playable.balanceFlags).not.toContain("maintenance_balanced_dominated_on_cash");
    expect(playable.dominance.note.length).toBeGreaterThan(0);
  });
});

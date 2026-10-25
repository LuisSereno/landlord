import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type BalanceDataset = {
  schemaVersion: number;
  datasetId: string;
  generatedAt: string;
  tool: string;
  engine: {
    commit: string;
    seeds: number[];
    months: number;
    parcelCount: number;
    districtProfileId: string;
  };
  strategies: string[];
  rows: Array<{
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
  }>;
  aggregates: Record<string, Record<string, number>>;
  comparisons: Array<{
    metric: string;
    candidate: string;
    baseline: string;
    wins: number;
    seeds: number;
    dominant: boolean;
  }>;
  balanceFlags: string[];
  violations: string[];
};

const dataset = JSON.parse(
  readFileSync(new URL("../../../docs/balance/alpha-baseline-v1.json", import.meta.url), "utf8"),
) as BalanceDataset;

describe("WP4.14 dataset de balance versionado", () => {
  it("declara esquema, herramienta y seeds registradas", () => {
    expect(dataset.schemaVersion).toBe(1);
    expect(dataset.datasetId).toBe("alpha-baseline-v1");
    expect(dataset.tool).toBe("pnpm balance:campaign");
    expect(dataset.engine.seeds.length).toBeGreaterThan(0);
    expect(new Set(dataset.engine.seeds).size).toBe(dataset.engine.seeds.length);
    expect([...dataset.engine.seeds].sort((left, right) => left - right)).toEqual(
      dataset.engine.seeds,
    );
    expect(dataset.engine.months).toBeGreaterThan(0);
    expect(dataset.engine.parcelCount).toBeGreaterThan(0);
  });

  it("tiene una fila por estrategia y seed, con métricas finitas y en rango", () => {
    expect(new Set(dataset.strategies).size).toBe(dataset.strategies.length);
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
  });

  it("publica agregados por estrategia y comparaciones coherentes", () => {
    for (const strategy of dataset.strategies) {
      expect(dataset.aggregates[strategy], strategy).toBeDefined();
      expect(Object.keys(dataset.aggregates[strategy]!).length).toBeGreaterThan(0);
    }
    expect(dataset.comparisons.length).toBeGreaterThan(0);
    for (const comparison of dataset.comparisons) {
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
  });

  it("no registra ninguna invariante rota en la campaña", () => {
    expect(dataset.violations).toEqual([]);
  });
});

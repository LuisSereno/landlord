#!/usr/bin/env node
/**
 * Convierte la salida cruda de `pnpm balance:campaign` en el dataset versionado de balance.
 * Uso: node scripts/build-balance-dataset.mjs <salida-vitest.txt> <dataset.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("uso: node scripts/build-balance-dataset.mjs <salida-vitest.txt> <dataset.json>");
  process.exit(1);
}

const STRATEGIES = ["passive", "maintained", "delegated_deferred", "delegated_balanced"];
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const text = readFileSync(inputPath, "utf8").replace(ANSI, "");
const line = text.split("\n").find((entry) => entry.includes("BALANCE_CAMPAIGN"));
if (!line) {
  console.error("no se encontró la línea BALANCE_CAMPAIGN en la salida");
  process.exit(1);
}
const rows = JSON.parse(
  line.slice(line.indexOf("BALANCE_CAMPAIGN") + "BALANCE_CAMPAIGN".length).trim(),
);
const seeds = [...new Set(rows.map((row) => row.seed))].sort((left, right) => left - right);
const months = Number(process.env.BALANCE_MONTHS ?? 12);
const parcelCount = Number(process.env.BALANCE_PARCELS ?? 200);
const commit = process.env.BALANCE_COMMIT ?? "unknown";

const mean = (values) =>
  values.length === 0
    ? 0
    : Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;

const aggregates = Object.fromEntries(
  STRATEGIES.map((strategy) => {
    const subset = rows.filter((row) => row.strategy === strategy);
    return [
      strategy,
      {
        playerCash: mean(subset.map((row) => row.playerCash)),
        vacancyPercent: mean(subset.map((row) => row.metrics.vacancy.percent)),
        topParcelSharePercent: mean(
          subset.map((row) => row.metrics.concentration.topParcelSharePercent),
        ),
        parcelHhi: mean(subset.map((row) => row.metrics.concentration.parcelHhi)),
        mobilityTotal: mean(subset.map((row) => row.metrics.vacancy.mobilityTotal)),
        debtOutstanding: mean(subset.map((row) => row.metrics.debt.outstandingPrincipal)),
        defaultedLoans: mean(subset.map((row) => row.metrics.bankruptcies.defaultedLoans)),
        municipalReserve: mean(subset.map((row) => row.metrics.budget.municipalReserve)),
        deficitMonths: mean(subset.map((row) => row.metrics.budget.deficitMonths)),
      },
    ];
  }),
);

const pick = (strategy, seed) => rows.find((row) => row.strategy === strategy && row.seed === seed);
const compare = (candidate, baseline) => {
  const wins = seeds.filter((seed) => {
    const candidateRow = pick(candidate, seed);
    const baselineRow = pick(baseline, seed);
    return candidateRow && baselineRow && candidateRow.playerCash > baselineRow.playerCash;
  }).length;
  return {
    metric: "playerCash",
    candidate,
    baseline,
    wins,
    seeds: seeds.length,
    dominant: wins >= Math.ceil(seeds.length * 0.9),
  };
};
const comparisons = [
  compare("delegated_deferred", "passive"),
  compare("maintained", "passive"),
  compare("delegated_balanced", "delegated_deferred"),
];
const balanceFlags = [];
if (comparisons[1].wins === 0) balanceFlags.push("maintenance_balanced_dominated_on_cash");
if (comparisons[0].dominant) balanceFlags.push("automation_deferred_dominates_passive_on_cash");

const dataset = {
  schemaVersion: 1,
  datasetId: "alpha-baseline-v1",
  generatedAt: new Date().toISOString().slice(0, 10),
  tool: "pnpm balance:campaign",
  engine: { commit, seeds, months, parcelCount, districtProfileId: "default" },
  strategies: STRATEGIES,
  rows: rows.map((row) => ({
    strategy: row.strategy,
    seed: row.seed,
    playerCash: row.playerCash,
    vacancyPercent: row.metrics.vacancy.percent,
    topParcelSharePercent: row.metrics.concentration.topParcelSharePercent,
    parcelHhi: row.metrics.concentration.parcelHhi,
    mobilityTotal: row.metrics.vacancy.mobilityTotal,
    debtOutstanding: row.metrics.debt.outstandingPrincipal,
    defaultedLoans: row.metrics.bankruptcies.defaultedLoans,
    municipalReserve: row.metrics.budget.municipalReserve,
    deficitMonths: row.metrics.budget.deficitMonths,
  })),
  aggregates,
  comparisons,
  balanceFlags,
  violations: rows.flatMap((row) => row.violations),
};

writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`dataset escrito en ${outputPath}`);

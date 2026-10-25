#!/usr/bin/env node
/**
 * Convierte la salida cruda de las campañas de balance en los datasets versionados.
 *
 * Uso:
 *   node scripts/build-balance-dataset.mjs <salida-vitest.txt> <dataset.json> [--dataset synthetic|playable]
 *
 *   synthetic -> `pnpm balance:campaign` -> docs/balance/synthetic-city-balance-v1.json
 *                Arnés de carga: `createScaledCity` inyecta caja, inventario, parcelas, edificios,
 *                inquilinos, préstamos, cuadrillas y agentes que el jugador nunca compró. Sirve como
 *                test de esfuerzo y para detectar invariantes rotas bajo volumen; NO es una baseline
 *                de balance de gameplay.
 *   playable  -> `pnpm balance:playable` -> docs/balance/playable-alpha-baseline-v1.json
 *                Partida real: `createInitialState(seed)`, distrito generado, 12 000 de caja y sólo
 *                comandos del jugador despachados con `dispatchProductCommand`.
 *
 * Sin `--dataset` el modo se deduce del marcador presente en la salida; si aparecen los dos, hay que
 * indicarlo explícitamente. Los números salen siempre de la campaña: este script no los inventa.
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
let mode = null;
const flagIndex = args.findIndex((entry) => entry.startsWith("--dataset"));
if (flagIndex >= 0) {
  const flag = args[flagIndex];
  const inline = flag.includes("=");
  mode = inline ? flag.slice("--dataset=".length) : args[flagIndex + 1];
  args.splice(flagIndex, inline || mode === undefined ? 1 : 2);
}
const [inputPath, outputPath] = args;
if (!inputPath || !outputPath || (mode !== null && !["synthetic", "playable"].includes(mode))) {
  console.error(
    "uso: node scripts/build-balance-dataset.mjs <salida-vitest.txt> <dataset.json> [--dataset synthetic|playable]",
  );
  process.exit(1);
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const text = readFileSync(inputPath, "utf8").replace(ANSI, "");
const lines = text.split("\n");

function readMarker(marker, exclude = null) {
  const line = lines.find(
    (entry) => entry.includes(marker) && (exclude === null || !entry.includes(exclude)),
  );
  if (!line) return null;
  return JSON.parse(line.slice(line.indexOf(marker) + marker.length).trim());
}

const playableRows = readMarker("PLAYABLE_BALANCE_CAMPAIGN");
const syntheticRows = readMarker("BALANCE_CAMPAIGN", "PLAYABLE_BALANCE_CAMPAIGN");
const dominanceLine = readMarker("PLAYABLE_BALANCE_DOMINANCE");

if (mode === null) {
  if (playableRows && syntheticRows) {
    console.error("la salida contiene las dos campañas: indica --dataset synthetic|playable");
    process.exit(1);
  }
  mode = playableRows ? "playable" : syntheticRows ? "synthetic" : null;
}
const rows = mode === "playable" ? playableRows : syntheticRows;
if (!rows) {
  console.error(`no se encontró la salida de la campaña ${mode ?? "(sintética o jugable)"}`);
  process.exit(1);
}

const STRATEGIES = ["passive", "maintained", "delegated_deferred", "delegated_balanced"];
const COMPARISON_PAIRS = [
  ["delegated_deferred", "passive"],
  ["maintained", "passive"],
  ["delegated_balanced", "delegated_deferred"],
];
const commit = process.env.BALANCE_COMMIT ?? "unknown";
const generatedAt = new Date().toISOString().slice(0, 10);

const mean = (values) =>
  values.length === 0
    ? 0
    : Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;

const seeds = [...new Set(rows.map((row) => row.seed))].sort((left, right) => left - right);
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
const comparisons = COMPARISON_PAIRS.map(([candidate, baseline]) => compare(candidate, baseline));
const aggregate = (strategy, fields) => {
  const subset = rows.filter((row) => row.strategy === strategy);
  return Object.fromEntries(fields.map(([key, read]) => [key, mean(subset.map(read))]));
};

const METRIC_FIELDS = [
  ["vacancyPercent", (row) => row.metrics.vacancy.percent],
  ["topParcelSharePercent", (row) => row.metrics.concentration.topParcelSharePercent],
  ["parcelHhi", (row) => row.metrics.concentration.parcelHhi],
  ["mobilityTotal", (row) => row.metrics.vacancy.mobilityTotal],
  ["debtOutstanding", (row) => row.metrics.debt.outstandingPrincipal],
  ["defaultedLoans", (row) => row.metrics.bankruptcies.defaultedLoans],
  ["municipalReserve", (row) => row.metrics.budget.municipalReserve],
  ["deficitMonths", (row) => row.metrics.budget.deficitMonths],
];

function writeDataset(dataset) {
  writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`dataset ${dataset.datasetId} escrito en ${outputPath}`);
}

if (mode === "synthetic") {
  const months = Number(process.env.BALANCE_MONTHS ?? 12);
  const parcelCount = Number(process.env.BALANCE_PARCELS ?? 200);
  const balanceFlags = [];
  if (comparisons[1].wins === 0) balanceFlags.push("maintenance_balanced_dominated_on_cash");
  if (comparisons[0].dominant) balanceFlags.push("automation_deferred_dominates_passive_on_cash");
  writeDataset({
    schemaVersion: 1,
    datasetId: "synthetic-city-balance-v1",
    generatedAt,
    tool: "pnpm balance:campaign",
    worldKind: "synthetic_load_harness",
    usage:
      "Arnés de carga, no balance de gameplay: el mundo viene de createScaledCity " +
      "(packages/simulation/src/system-cost.ts), que regala caja HARNESS_BALANCE, capacidad de " +
      "inventario HARNESS_INVENTORY_CAPACITY, parcelas, edificios, inquilinos, préstamos, cuadrillas " +
      "y agentes que el jugador nunca compró ni construyó. Úsalo para detectar invariantes rotas y " +
      "degradación bajo volumen. La baseline jugable es playable-alpha-baseline-v1.json.",
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
    aggregates: Object.fromEntries(
      STRATEGIES.map((strategy) => [
        strategy,
        aggregate(strategy, [["playerCash", (row) => row.playerCash], ...METRIC_FIELDS]),
      ]),
    ),
    comparisons,
    balanceFlags,
    violations: rows.flatMap((row) => row.violations),
  });
} else {
  const months = Number(process.env.BALANCE_MONTHS ?? 12);
  const commandAudit = Object.fromEntries(
    STRATEGIES.map((strategy) => {
      const subset = rows.filter((row) => row.strategy === strategy);
      const types = [...new Set(subset.flatMap((row) => Object.keys(row.audit)))].sort();
      return [
        strategy,
        Object.fromEntries(
          types.map((type) => {
            const tallies = subset.map((row) => row.audit[type]).filter(Boolean);
            const rejectionCodes = {};
            for (const tally of tallies) {
              for (const [code, count] of Object.entries(tally.rejectionCodes)) {
                rejectionCodes[code] = (rejectionCodes[code] ?? 0) + count;
              }
            }
            return [
              type,
              {
                accepted: tallies.reduce((total, tally) => total + tally.accepted, 0),
                rejected: tallies.reduce((total, tally) => total + tally.rejected, 0),
                rejectionCodes,
              },
            ];
          }),
        ),
      ];
    }),
  );
  const balanceFlags = [];
  const maintainedVsPassive = comparisons[1];
  const delegatedVsPassive = comparisons[0];
  if (!comparisons.some((comparison) => comparison.dominant)) {
    balanceFlags.push("no_dominant_strategy_in_playable_campaign");
  }
  if (
    !maintainedVsPassive.dominant &&
    maintainedVsPassive.wins * 2 < maintainedVsPassive.seeds &&
    maintainedVsPassive.wins > 0
  ) {
    balanceFlags.push("maintenance_balanced_cash_signal_to_investigate");
  }
  if (delegatedVsPassive.wins * 2 <= delegatedVsPassive.seeds) {
    balanceFlags.push("automation_deferred_has_no_cash_advantage_playable");
  }
  const winnerBySeed = (seed) =>
    STRATEGIES.map((strategy) => ({
      strategy,
      cash: pick(strategy, seed)?.playerCash ?? null,
    })).sort(
      (left, right) =>
        (right.cash ?? Number.NaN) - (left.cash ?? Number.NaN) ||
        left.strategy.localeCompare(right.strategy),
    )[0].strategy;
  const winnerCounts = Object.fromEntries(
    STRATEGIES.map((strategy) => [
      strategy,
      seeds.filter((seed) => winnerBySeed(seed) === strategy).length,
    ]),
  );
  writeDataset({
    schemaVersion: 1,
    datasetId: "playable-alpha-baseline-v1",
    generatedAt,
    tool: "pnpm balance:playable",
    worldKind: "playable_generated_district",
    usage:
      "Baseline de balance de gameplay: cada campaña arranca de createInitialState(seed) con el " +
      "distrito generado y la posición económica legítima (12 000 de caja, inventario y cuadrillas " +
      "autoradas) y actúa sólo con comandos reales del jugador. Las cuatro políticas se fijan con " +
      "SetMaintenancePolicy y SetAutomationPolicy y comparten una rutina de crecimiento idéntica " +
      "(parcela asequible -> materiales -> permiso -> obra -> cuadrilla, mientras la caja alcance). " +
      "El mundo sintético de carga está en synthetic-city-balance-v1.json.",
    engine: {
      commit,
      seeds,
      months,
      districtProfileId: "barrio_del_umbral",
      startingCash: 12000,
      financeCashFloor: 2000,
      dominantThreshold: Math.ceil(seeds.length * 0.9),
    },
    strategies: STRATEGIES,
    rows: rows.map((row) => ({
      strategy: row.strategy,
      seed: row.seed,
      worldParcelCount: row.worldParcelCount,
      playerCash: row.playerCash,
      playerDebt: row.playerDebt,
      playerParcels: row.playerParcels,
      playerBuildings: row.playerBuildings,
      playerAssetBookValue: row.playerAssetBookValue,
      vacancyPercent: row.metrics.vacancy.percent,
      topParcelSharePercent: row.metrics.concentration.topParcelSharePercent,
      parcelHhi: row.metrics.concentration.parcelHhi,
      mobilityTotal: row.metrics.vacancy.mobilityTotal,
      debtOutstanding: row.metrics.debt.outstandingPrincipal,
      defaultedLoans: row.metrics.bankruptcies.defaultedLoans,
      municipalReserve: row.metrics.budget.municipalReserve,
      deficitMonths: row.metrics.budget.deficitMonths,
      acceptedCommands: row.acceptedCommands,
      rejectedCommands: row.rejectedCommands,
    })),
    commandAudit,
    aggregates: Object.fromEntries(
      STRATEGIES.map((strategy) => [
        strategy,
        aggregate(strategy, [
          ["playerCash", (row) => row.playerCash],
          ["playerDebt", (row) => row.playerDebt],
          ["playerAssetBookValue", (row) => row.playerAssetBookValue],
          ["playerParcels", (row) => row.playerParcels],
          ["playerBuildings", (row) => row.playerBuildings],
          ...METRIC_FIELDS,
          ["acceptedCommands", (row) => row.acceptedCommands],
          ["rejectedCommands", (row) => row.rejectedCommands],
        ]),
      ]),
    ),
    comparisons,
    dominance: {
      metric: "playerCash",
      seeds: seeds.length,
      thresholdWins: Math.ceil(seeds.length * 0.9),
      winsByStrategy: dominanceLine?.winsByStrategy ?? winnerCounts,
      anyDominant: dominanceLine
        ? dominanceLine.anyDominant
        : comparisons.some((comparison) => comparison.dominant),
      note:
        "Ninguna estrategia domina en la campaña jugable. La caja final tampoco es por sí sola una " +
        "medida de riqueza: la rutina de crecimiento reinvierte todo lo que puede, así que una " +
        "estrategia que ingresa más termina a menudo con menos caja y más activos. Léase junto a " +
        "playerParcels, playerBuildings y playerAssetBookValue.",
    },
    balanceFlags,
    violations: rows.flatMap((row) => row.violations),
  });
}

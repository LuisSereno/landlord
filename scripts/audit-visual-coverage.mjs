import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtime = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/generated/runtime-assets.json"), "utf8"),
);
const evidence = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/generated/building-evidence.json"), "utf8"),
);
const buildingCatalog = JSON.parse(
  readFileSync(path.join(root, "blender_artist/manifests/building-catalog.json"), "utf8"),
);
const gameData = readFileSync(path.join(root, "packages/simulation/src/game-data.ts"), "utf8");
const outputDir = path.join(root, "docs/art/visual-catalog");
const matrixPath = path.join(root, "docs/art/VISUAL-COVERAGE-MATRIX.md");
const auditPath = path.join(outputDir, "coverage-audit.json");

const catalogById = new Map(buildingCatalog.buildings.map((entry) => [entry.id, entry]));

function definitionSource(type) {
  const start = gameData.indexOf(`  ${type}: {`);
  if (start < 0) throw new Error(`No existe BUILDING_DEFINITIONS.${type}`);
  const nextDefinition = /\n {2}[a-z_]+: \{/gu;
  nextDefinition.lastIndex = start + type.length + 5;
  const next = nextDefinition.exec(gameData)?.index;
  return gameData.slice(start, next ?? undefined);
}

function numberFrom(block, expression, label) {
  const value = expression.exec(block)?.[1];
  if (!value) throw new Error(`No se pudo leer ${label}`);
  return Number(value);
}

function stateHashes(asset) {
  return Object.fromEntries(
    Object.entries(asset.states).map(([state, frame]) => [state, frame.sha256]),
  );
}

const rows = Object.entries(evidence.buildings).map(([type, asset]) => {
  const block = definitionSource(type);
  const targetFootprintCells = numberFrom(
    block,
    /targetFootprintCells:\s*(\d+)/u,
    `${type}.targetFootprintCells`,
  );
  const floors = numberFrom(block, /defaultFloors:\s*(\d+)/u, `${type}.defaultFloors`);
  const requiredParcels = numberFrom(block, /requiredParcels:\s*(\d+)/u, `${type}.requiredParcels`);
  const catalogEntry = catalogById.get(type);
  if (!catalogEntry) throw new Error(`${type}: falta en building-catalog.json`);
  const runtimeAsset = runtime.buildings[type];
  const renderedStates = stateHashes(asset);
  const expectedStates = ["complete", "construction", "damaged", "burning"];
  const missingStates = expectedStates.filter((state) => !renderedStates[state]);
  return {
    type,
    targetFootprintCells,
    preferredFootprint: runtimeAsset.domainFootprint,
    preferredFootprintStatus: "integrated V.d-7B preferredFootprint + shapePenalty",
    floors,
    requiredParcels,
    candidateSource: catalogEntry.sourceLabel,
    finalSource: catalogEntry.mode === "imported" ? "candidate evidence" : "legacy frozen",
    renderedStates,
    missingStates,
    mode: catalogEntry.mode,
    orientation: runtimeAsset.allowedOrientations,
    status: catalogEntry.mode === "imported" ? "CANDIDATE EVIDENCE" : "LEGACY FROZEN",
  };
});

const importedRows = rows.filter((row) => row.mode === "imported");
const legacyRows = rows.filter((row) => row.mode === "legacy-procedural");
const stateGaps = rows
  .filter((row) => row.missingStates.length > 0)
  .map((row) => ({ id: row.type, missingStates: row.missingStates }));

const audit = {
  schemaVersion: 1,
  inventoryDate: new Date().toISOString().slice(0, 10),
  totals: {
    domainBuildings: rows.length,
    candidateEvidenceBuildings: rows.filter((row) => Object.keys(row.renderedStates).length > 0)
      .length,
    renderedStates: rows.reduce((total, row) => total + Object.keys(row.renderedStates).length, 0),
    importedBuildings: importedRows.length,
    importedCompleteStates: importedRows.filter((row) => row.renderedStates.complete).length,
    legacyBuildings: legacyRows.length,
    legacyStates: legacyRows.reduce(
      (total, row) => total + Object.keys(row.renderedStates).length,
      0,
    ),
    runtimePromotion: "pending QA",
  },
  rows,
  stateGaps,
};

function stateIcon(row, state) {
  return row.renderedStates[state] ? "PASS" : "PENDING";
}

const lines = [
  "# Matriz de cobertura visual",
  "",
  "> Generada por `pnpm art:coverage:audit`. No promueve assets automáticamente.",
  "",
  `Estado actual: evidencia candidata ${audit.totals.candidateEvidenceBuildings}/15; ${audit.totals.renderedStates}/60 estados renderizados; ${audit.totals.importedBuildings} edificios importados (${audit.totals.importedCompleteStates}/${audit.totals.importedBuildings} complete); legacy congelado ${legacyRows.map((row) => row.type).join(", ")} ${audit.totals.legacyStates}/${legacyRows.length * 4}; promoción al runtime: ${audit.totals.runtimePromotion}.`,
  "`preferred footprint` y `shapePenalty` están integrados en V.d-7B y alimentan la enumeración autoritativa de V.d-7C.",
  "",
  "| Domain type | Gameplay footprint | Preferred footprint | Candidate source | Final source | Complete | Construction | Damaged | Burning/VFX | Orientation | Status | Notes |",
  "|---|---:|---:|---|---|---|---|---|---|---|---|---|",
];
for (const row of rows) {
  const dimensions = `${row.preferredFootprint.width}×${row.preferredFootprint.height}`;
  lines.push(
    `| \`${row.type}\` | ${row.targetFootprintCells} cells / ${row.requiredParcels} parcel(s) | ${dimensions} | ${row.candidateSource} | ${row.finalSource} | ${stateIcon(row, "complete")} | ${stateIcon(row, "construction")} | ${stateIcon(row, "damaged")} | ${stateIcon(row, "burning")} | ${row.orientation.join("/")} | ${row.status} | ${row.floors} floor baseline; ${row.preferredFootprintStatus} |`,
  );
}
lines.push(
  "",
  "## Missing imported states",
  "",
  stateGaps.length > 0
    ? stateGaps
        .map(
          (entry) =>
            `- \`${entry.id}\`: faltan ${entry.missingStates.join(", ")} sobre la fuente importada — **PENDING**.`,
        )
        .join("\n")
    : "No missing source states detected.",
  "",
  "La evidencia de edificios es candidata: los 14 importados tienen sólo `complete`; `courtyard_home` conserva su conjunto legacy congelado de cuatro estados. Nada se promociona al runtime sin QA visual.",
  "",
  "## Gate",
  "",
  "V.e puede pasar a revisión de candidatos, pero la producción no está completa: la evidencia importada es 14/14 en `complete`, el total es 18/60 estados y la promoción al runtime sigue pendiente de QA.",
  "",
);

const jsonOutput = `${JSON.stringify(audit, null, 2)}\n`;
const matrixOutput = lines.join("\n");
if (process.argv.includes("--check")) {
  if (!existsSync(auditPath) || !existsSync(matrixPath))
    throw new Error("Falta la cobertura generada");
  if (
    readFileSync(auditPath, "utf8") !== jsonOutput ||
    readFileSync(matrixPath, "utf8") !== matrixOutput
  )
    throw new Error("La cobertura visual está desactualizada; ejecuta pnpm art:coverage:audit");
} else {
  await mkdir(outputDir, { recursive: true });
  await writeFile(auditPath, jsonOutput);
  await writeFile(matrixPath, matrixOutput);
}
process.stdout.write(`${JSON.stringify(audit.totals)}\n`);

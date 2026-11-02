import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const procedural = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/generated/runtime-assets.json"), "utf8"),
);
const blender = JSON.parse(
  readFileSync(path.join(root, "apps/web/src/generated/runtime-assets-blender.json"), "utf8"),
);
const gameData = readFileSync(path.join(root, "packages/simulation/src/game-data.ts"), "utf8");
const outputDir = path.join(root, "docs/art/visual-catalog");
const matrixPath = path.join(root, "docs/art/VISUAL-COVERAGE-MATRIX.md");
const auditPath = path.join(outputDir, "coverage-audit.json");

const CANDIDATE_SOURCES = {
  courtyard_home: "Kenney Suburban / Blender E2E",
  row_house: "Kenney Suburban + Quaternius Downtown",
  apartment_block: "Kenney Commercial + Quaternius Downtown",
  mixed_tenement: "Kenney Commercial + Quaternius Downtown",
  workshop: "Kenney Industrial + KayKit props",
  warehouse: "Kenney Industrial",
  cement_plant: "Kenney Industrial + KayKit props",
  brickworks: "Kenney Industrial + Poly Haven brick",
  steelworks: "Kenney Industrial + rusty metal",
  town_hall: "Quaternius Downtown composition",
  school_block: "Quaternius Downtown composition",
  clinic: "Quaternius Downtown composition",
  police_station: "Quaternius Downtown + KayKit props",
  fire_station: "Quaternius Downtown + Kenney vehicle language",
  market_hall: "Kenney Commercial + Quaternius Downtown",
};

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

function duplicateStates(asset) {
  const hashes = stateHashes(asset);
  const states = Object.keys(hashes);
  return states.filter((state, index) =>
    states.slice(0, index).some((previous) => hashes[previous] === hashes[state]),
  );
}

const rows = Object.entries(procedural.buildings).map(([type, asset]) => {
  const block = definitionSource(type);
  const targetFootprintCells = numberFrom(
    block,
    /targetFootprintCells:\s*(\d+)/u,
    `${type}.targetFootprintCells`,
  );
  const floors = numberFrom(block, /defaultFloors:\s*(\d+)/u, `${type}.defaultFloors`);
  const requiredParcels = numberFrom(block, /requiredParcels:\s*(\d+)/u, `${type}.requiredParcels`);
  const proceduralDuplicates = duplicateStates(asset);
  const promotedAsset = blender.buildings[type] ?? null;
  const blenderDuplicates = promotedAsset ? duplicateStates(promotedAsset) : [];
  return {
    type,
    targetFootprintCells,
    preferredFootprint: asset.domainFootprint,
    preferredFootprintStatus: "manifest baseline; domain contract pending V.d-7B integration",
    floors,
    requiredParcels,
    candidateSource: CANDIDATE_SOURCES[type],
    finalSource: null,
    proceduralStates: stateHashes(asset),
    proceduralDuplicates,
    blenderAsset: promotedAsset ? type : null,
    blenderDuplicates,
    orientation: asset.allowedOrientations,
    status:
      proceduralDuplicates.length > 0
        ? "VISUAL STATE GAP"
        : promotedAsset && blenderDuplicates.length === 0
          ? "BLENDER CANDIDATE"
          : "PROCEDURAL BASELINE",
  };
});

const blenderStateGaps = Object.entries(blender.buildings)
  .map(([id, asset]) => ({ id, duplicateStates: duplicateStates(asset) }))
  .filter((entry) => entry.duplicateStates.length > 0);

const audit = {
  schemaVersion: 1,
  inventoryDate: new Date().toISOString().slice(0, 10),
  totals: {
    domainBuildings: rows.length,
    proceduralRepresented: rows.filter((row) => row.proceduralDuplicates.length === 0).length,
    proceduralStates: rows.reduce(
      (total, row) => total + Object.keys(row.proceduralStates).length,
      0,
    ),
    domainBlenderCandidates: rows.filter((row) => row.blenderAsset).length,
    blenderBundleAssets: Object.keys(blender.buildings).length,
    blenderAssetsWithDuplicateStates: blenderStateGaps.length,
  },
  rows,
  blenderStateGaps,
};

function icon(pass) {
  return pass ? "PASS" : "VISUAL STATE GAP";
}

const lines = [
  "# Matriz de cobertura visual",
  "",
  "> Generada por `pnpm art:coverage:audit`. No promueve assets automáticamente.",
  "",
  "Estado de baseline: procedural 15/15 y 60/60 estados diferenciados; bundle Blender parcial.",
  "`preferred footprint` lee `domainFootprint` del manifest V2 vigente; el contrato equivalente de `BuildingDefinition` permanece pendiente de integrar desde V.d-7B.",
  "",
  "| Domain type | Gameplay footprint | Preferred footprint | Candidate source | Final source | Complete | Construction | Damaged | Burning/VFX | Orientation | Status | Notes |",
  "|---|---:|---:|---|---|---|---|---|---|---|---|---|",
];
for (const row of rows) {
  const dimensions = `${row.preferredFootprint.width}×${row.preferredFootprint.height}`;
  const statesPass = row.proceduralDuplicates.length === 0;
  lines.push(
    `| \`${row.type}\` | ${row.targetFootprintCells} cells / ${row.requiredParcels} parcel(s) | ${dimensions} | ${row.candidateSource} | pending QA | ${icon(statesPass)} | ${icon(statesPass)} | ${icon(statesPass)} | ${icon(statesPass)} | ${row.orientation.join("/")} | ${row.status} | ${row.floors} floor baseline; ${row.preferredFootprintStatus} |`,
  );
}
lines.push(
  "",
  "## Blender state gaps",
  "",
  blenderStateGaps.length > 0
    ? blenderStateGaps
        .map(
          (entry) =>
            `- \`${entry.id}\`: ${entry.duplicateStates.join(", ")} duplicate an earlier state — **VISUAL STATE GAP**.`,
        )
        .join("\n")
    : "No duplicate Blender states detected.",
  "",
  "Only `courtyard_home` currently maps a domain type to a Blender candidate with four distinct state hashes. The six additional Blender archetypes are candidates, not domain coverage, and reuse one image across states.",
  "",
  "## Gate",
  "",
  "V.e.1 may proceed to candidate assignment, but production is not complete: `final source` remains pending for all 15 types and six Blender archetypes require differentiated states.",
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

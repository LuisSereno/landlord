#!/usr/bin/env node
/**
 * Render de evidencia V.e con geometría de fuente real (remediación 2026-11-02).
 *
 * Sustituye a render-building-factory-review.mjs (que renderizaba la fábrica procedural falsa).
 * Renderiza los 15 edificios de dominio desde `building-catalog.json` vía `build-blender-assets.mjs`
 * (14 imported desde GLB de Kenney + courtyard_home legacy procedural con sus 4 estados), verifica
 * que la procedencia declarada entró físicamente al render y publica las imágenes como evidencia
 * candidata en `apps/web/public/assets/evidence/buildings/` + `building-evidence.json`.
 *
 * No promueve nada al bundle runtime: la promoción exige los 4 estados y QA visual del responsable.
 *
 * Uso: node scripts/render-building-evidence.mjs
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const catalog = JSON.parse(
  readFileSync(join(REPO_ROOT, "blender_artist/manifests/building-catalog.json"), "utf8"),
);
const WORK_DIR = join(REPO_ROOT, "blender_artist/generated/ve-source-remediation");
const PUBLIC_DIR = join(REPO_ROOT, "apps/web/public/assets/evidence/buildings");
const EVIDENCE_PATH = join(REPO_ROOT, "apps/web/src/generated/building-evidence.json");
const PUBLIC_SRC = "/assets/evidence/buildings";

const errors = [];
function fail(message) {
  errors.push(message);
}

rmSync(WORK_DIR, { recursive: true, force: true });
mkdirSync(WORK_DIR, { recursive: true });
mkdirSync(PUBLIC_DIR, { recursive: true });

const jobIds = catalog.buildings.map((entry) => entry.jobId);
const render = spawnSync(
  process.execPath,
  ["scripts/build-blender-assets.mjs", `--only=${jobIds.join(",")}`, `--outDir=${WORK_DIR}`],
  { stdio: "inherit", cwd: REPO_ROOT },
);
if (render.status !== 0) process.exit(render.status ?? 1);

const buildings = {};
const completeSheets = [];
const seenHashes = new Map();
for (const entry of catalog.buildings) {
  const states =
    entry.mode === "legacy-procedural"
      ? ["complete", "construction", "damaged", "burning"]
      : ["complete"];
  const statesOut = {};
  for (const state of states) {
    const png = join(WORK_DIR, `${entry.id}-${state}.png`);
    const meta = join(WORK_DIR, `${entry.id}-${state}.json`);
    if (!existsSync(png) || !existsSync(meta)) {
      fail(`${entry.id}-${state}: render ausente en ${WORK_DIR}`);
      continue;
    }
    const metadata = JSON.parse(readFileSync(meta, "utf8"));
    if (metadata.assetId !== entry.id) fail(`${entry.id}: metadata.assetId '${metadata.assetId}'`);
    if (metadata.state !== state)
      fail(`${entry.id}: metadata.state '${metadata.state}' != ${state}`);
    if (entry.mode === "imported") {
      // La regla que V.e.2 violó: la fuente declarada debe entrar físicamente al render.
      if (metadata.origin !== "licensed") {
        fail(`${entry.id}: origin '${metadata.origin}', la fuente externa NO entró al render`);
      }
      if (metadata.source?.path !== entry.sourcePath) {
        fail(
          `${entry.id}: el render importa '${metadata.source?.path}', el catálogo declara '${entry.sourcePath}'`,
        );
      }
      if (metadata.source?.id !== entry.sourceId) {
        fail(`${entry.id}: sourceId renderizado '${metadata.source?.id}' != '${entry.sourceId}'`);
      }
      if (metadata.license !== "CC0-1.0") fail(`${entry.id}: license '${metadata.license}'`);
    } else if (metadata.origin !== "original") {
      fail(`${entry.id}: legacy procedural con origin '${metadata.origin}'`);
    }
    const buffer = readFileSync(png);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const previous = seenHashes.get(sha256);
    if (previous) fail(`${entry.id}-${state}: imagen idéntica a ${previous}`);
    seenHashes.set(sha256, `${entry.id}-${state}`);
    const file = `${entry.id}-${state}.png`;
    copyFileSync(png, join(PUBLIC_DIR, file));
    statesOut[state] = {
      src: `${PUBLIC_SRC}/${file}`,
      width: metadata.image.width,
      height: metadata.image.height,
      sha256,
      pivot: metadata.pivot,
    };
  }
  if (states.length > 1) {
    const hashes = Object.values(statesOut).map((image) => image.sha256);
    if (new Set(hashes).size !== hashes.length) fail(`${entry.id}: estados visualmente duplicados`);
  }
  if (statesOut.complete) completeSheets.push(join(PUBLIC_DIR, `${entry.id}-complete.png`));
  buildings[entry.id] = {
    jobId: entry.jobId,
    mode: entry.mode,
    category: entry.category,
    floorCount: entry.floorCount,
    footprint: entry.footprint,
    provenance:
      entry.mode === "imported"
        ? { sourceId: entry.sourceId, path: entry.sourcePath, license: "CC0-1.0" }
        : null,
    states: statesOut,
  };
}

if (errors.length > 0) {
  console.error(errors.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

const sheets = [];
if (existsSync("/usr/bin/montage") || spawnSync("which", ["montage"]).status === 0) {
  const complete = join(WORK_DIR, "complete-source-geometry.png");
  spawnSync(
    "montage",
    [
      ...completeSheets,
      "-background",
      "#182027",
      "-geometry",
      "260x240+12+12",
      "-tile",
      "5x3",
      "-label",
      "%f",
      complete,
    ],
    { stdio: "inherit" },
  );
  const courtyardStates = ["complete", "construction", "damaged", "burning"].map((state) =>
    join(PUBLIC_DIR, `courtyard_home-${state}.png`),
  );
  const statesSheet = join(WORK_DIR, "courtyard-states.png");
  spawnSync(
    "montage",
    [
      ...courtyardStates,
      "-background",
      "#182027",
      "-geometry",
      "170x150+8+8",
      "-tile",
      "4x1",
      statesSheet,
    ],
    { stdio: "inherit" },
  );
  sheets.push(complete, statesSheet);
}

writeFileSync(
  EVIDENCE_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generator: {
        id: "building-evidence-render",
        version: 1,
        method: "blender_render",
        source: "scripts/render-building-evidence.mjs",
      },
      note: "Evidencia candidata V.e: geometría de fuente real (Kenney CC0) + legacy procedural. No promovida al runtime; la promoción exige los 4 estados condicionados y QA visual.",
      buildings,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify({
    status: "passed",
    buildings: Object.keys(buildings).length,
    images: Object.values(buildings).reduce((total, b) => total + Object.keys(b.states).length, 0),
    sheets,
    evidence: EVIDENCE_PATH,
  }),
);

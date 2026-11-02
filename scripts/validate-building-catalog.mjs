#!/usr/bin/env node
/**
 * Valida `blender_artist/manifests/building-catalog.json` (remediación V.e de geometría de fuente).
 *
 * Regla central: un edificio no puede declarar una fuente externa que no importe. Cada entrada
 * `imported` se cruza contra su job en `asset-jobs.json` (sourceId y ruta exacta), y ningún job
 * de edificio puede mencionar una familia de terceros en su razón siendo `procedural`.
 *
 * Uso: node scripts/validate-building-catalog.mjs
 */
import { existsSync, readFileSync } from "node:fs";

const CATALOG_PATH = "blender_artist/manifests/building-catalog.json";
const JOBS_PATH = "blender_artist/manifests/asset-jobs.json";
const STAGING_PREFIX = "blender_artist/staging/third_party/";
const EXTERNAL_FAMILIES = ["kenney", "quaternius", "kaykit", "poly haven", "rocketbox"];
const CATEGORIES = ["residential", "mixed", "industrial", "civic"];

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const jobsManifest = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
const buildingJobs = jobsManifest.jobs.filter((job) => job.kind === "building");
const jobsById = new Map(buildingJobs.map((job) => [job.id, job]));
const stagingAvailable = existsSync(STAGING_PREFIX);
const errors = [];

function fail(message) {
  errors.push(message);
}

if (catalog.schemaVersion !== 2) fail("building-catalog.json: schemaVersion debe ser 2");
if (catalog.buildings?.length !== 15) fail("el catálogo debe declarar exactamente 15 edificios de dominio");

const seenIds = new Set();
for (const entry of catalog.buildings ?? []) {
  const id = entry.id ?? "?";
  if (seenIds.has(id)) fail(`${id}: entrada duplicada`);
  seenIds.add(id);
  if (!CATEGORIES.includes(entry.category)) fail(`${id}: category inválida '${entry.category}'`);
  if (!Number.isInteger(entry.floorCount) || entry.floorCount < 1) fail(`${id}: floorCount inválido`);
  if (!Number.isInteger(entry.footprint?.width) || !Number.isInteger(entry.footprint?.height)) {
    fail(`${id}: footprint inválido`);
  }
  if (!entry.sourceLabel) fail(`${id}: falta sourceLabel`);

  const job = jobsById.get(entry.jobId);
  if (!job) {
    fail(`${id}: jobId '${entry.jobId}' no existe entre los building jobs de asset-jobs.json`);
    continue;
  }
  if (job.assetId !== id) fail(`${id}: el job ${job.id} tiene assetId '${job.assetId}', no '${id}'`);

  if (entry.mode === "imported") {
    const source = job.source ?? {};
    if (!["glb", "gltf", "fbx"].includes(source.kind)) {
      fail(`${id}: declara geometría importada pero su job ${job.id} tiene source.kind '${source.kind}'`);
      continue;
    }
    if (source.sourceId !== entry.sourceId) {
      fail(`${id}: sourceId '${entry.sourceId}' no coincide con el job ('${source.sourceId}')`);
    }
    if (source.path !== entry.sourcePath) {
      fail(`${id}: sourcePath no coincide con la ruta real del job ${job.id}`);
    }
    if (stagingAvailable && !existsSync(entry.sourcePath)) {
      fail(`${id}: no existe el archivo de fuente ${entry.sourcePath}`);
    }
  } else if (entry.mode === "legacy-procedural") {
    if (job.source?.kind !== "procedural") {
      fail(`${id}: modo legacy-procedural pero su job ${job.id} declara source.kind '${job.source?.kind}'`);
    }
  } else {
    fail(`${id}: mode inválido '${entry.mode}'`);
  }
}

// Cobertura inversa sobre los edificios de dominio: cada assetId de dominio debe tener exactamente
// un building job en asset-jobs.json y estar referenciado por su entrada de catálogo. Los jobs de
// arquetipos del bundle runtime (shopfront, commercial_*, residential_*) quedan fuera del catálogo.
for (const id of seenIds) {
  const matching = buildingJobs.filter((job) => job.assetId === id);
  if (matching.length !== 1) {
    fail(`${id}: esperado 1 building job con assetId '${id}', encontrados ${matching.length}`);
    continue;
  }
  const entry = (catalog.buildings ?? []).find((item) => item.id === id);
  if (entry.jobId !== matching[0].id) {
    fail(`${id}: jobId '${entry.jobId}' no apunta al job real '${matching[0].id}'`);
  }
}

// La enfermedad V.e.2: texto que promete terceros mientras la fuente real es procedural.
for (const job of buildingJobs) {
  if (job.source?.kind !== "procedural") continue;
  const claims = EXTERNAL_FAMILIES.filter((family) =>
    (job.reason ?? "").toLowerCase().includes(family),
  );
  if (claims.length > 0) {
    fail(`job ${job.id}: reason menciona ${claims.join(", ")} pero la fuente es procedural`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((message) => `- ${message}`).join("\n"));
  process.exit(1);
}

const imported = catalog.buildings.filter((entry) => entry.mode === "imported").length;
console.log(
  `Building Catalog PASS: 15/15 edificios; ${imported} imported con fuente real verificada contra asset-jobs.json, ${15 - imported} legacy procedural congelado.`,
);

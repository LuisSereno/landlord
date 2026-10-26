#!/usr/bin/env node
/**
 * Valida `blender_artist/manifests/asset-jobs.json` (WP4.15-V.a 〔R4〕).
 *
 * Unión discriminada por `kind`: cada tipo tiene un conjunto EXACTO de claves admitidas, así que
 * un árbol no puede traer `animations` ni un personaje `states`. `source.sourceId` es FK contra
 * `staging-sources.json` y la ruta queda confinada al directorio registrado de esa fuente.
 *
 * Uso: node scripts/validate-asset-jobs.mjs
 */
import { existsSync, readFileSync } from "node:fs";

const JOBS_PATH = "blender_artist/manifests/asset-jobs.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";
const STAGING_PREFIX = "blender_artist/staging/third_party/";
const EXTRACTED_PREFIX = `${STAGING_PREFIX}cc0/extracted/`;
const LICENSE_FAMILIES = JSON.parse(
  readFileSync("blender_artist/manifests/license-allowlist.json", "utf8"),
).directoryByLicense;

// 〔R3〕/resolución: 256 es el preset del slice; 512 sigue siendo válido para el futuro.
// Estos límites evitan jobs accidentales gigantes, que es un error de tipeo, no una decisión.
const RENDER_MIN = 64;
const RENDER_MAX = 1024;

const KIND_KEYS = {
  building: new Set([
    "id",
    "kind",
    "assetId",
    "target",
    "reason",
    "source",
    "states",
    "camera",
    "render",
    "footprint",
  ]),
  character: new Set([
    "id",
    "kind",
    "assetId",
    "target",
    "reason",
    "source",
    "directions",
    "animations",
    "frameIndices",
    "frameDurationMs",
    "camera",
    "render",
  ]),
  terrain: new Set([
    "id",
    "kind",
    "assetId",
    "target",
    "reason",
    "source",
    "footprint",
    "camera",
    "render",
  ]),
  prop: new Set([
    "id",
    "kind",
    "assetId",
    "target",
    "reason",
    "source",
    "footprint",
    "camera",
    "render",
  ]),
  vehicle: new Set([
    "id",
    "kind",
    "assetId",
    "target",
    "reason",
    "source",
    "footprint",
    "states",
    "camera",
    "render",
  ]),
};
const BUILDING_STATES = ["complete", "construction", "damaged", "burning"];
const ANIMATION_NAMES = ["idle", "walk"];
const SOURCE_KINDS = ["procedural", "glb", "gltf", "fbx"];

const jobs = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
const registry = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));
const stagingAvailable = existsSync(STAGING_PREFIX);
const errors = [];

function fail(message) {
  errors.push(message);
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Directorio donde vive realmente el contenido de una fuente: para un archivo es el destino de
 * extracción declarado (`extractDir`, compartido con extract-cc0-packs.mjs); para una fuente
 * clonada sin ZIP, su propio `path`, que ya es un directorio.
 */
function expectedSourceDir(source) {
  if (source.integrity?.type === "git-commit") return source.path;
  if (source.extractDir) return `${EXTRACTED_PREFIX}${source.extractDir}`;
  return null;
}

function checkRender(job, render) {
  if (!Number.isInteger(render.width) || !Number.isInteger(render.height)) {
    fail(`${job.id}: render.width/height deben ser enteros`);
    return;
  }
  for (const [axis, value] of [
    ["width", render.width],
    ["height", render.height],
  ]) {
    if (value < RENDER_MIN || value > RENDER_MAX) {
      fail(`${job.id}: render.${axis}=${value} fuera de [${RENDER_MIN}, ${RENDER_MAX}]`);
    }
  }
}

function checkSource(job) {
  const source = job.source;
  if (!source || !SOURCE_KINDS.includes(source.kind)) {
    fail(`${job.id}: source.kind debe ser uno de ${SOURCE_KINDS.join(", ")}`);
    return;
  }
  if (source.kind === "procedural") {
    if (source.path || source.sourceId)
      fail(`${job.id}: un job procedural no declara fuente externa`);
    if (job.camera || job.render) {
      fail(
        `${job.id}: un job procedural no redeclara camera/render; sus parámetros están congelados en runtime_asset.py`,
      );
    }
    return;
  }
  if (!source.sourceId || !sourcesById.has(source.sourceId)) {
    fail(`${job.id}: sourceId desconocido ${source.sourceId ?? "(ausente)"}`);
  }
  if (typeof source.path !== "string" || source.path.length === 0) {
    fail(`${job.id}: falta source.path`);
    return;
  }
  if (source.path.startsWith("/") || source.path.includes("..")) {
    fail(`${job.id}: source.path debe ser relativa al repo y sin '..': ${source.path}`);
    return;
  }
  if (!source.path.startsWith(STAGING_PREFIX)) {
    fail(`${job.id}: source.path debe quedar bajo ${STAGING_PREFIX}`);
  }
  const registered = sourcesById.get(source.sourceId);
  const expectedDir = registered ? expectedSourceDir(registered) : null;
  if (expectedDir && !source.path.startsWith(`${expectedDir}/`)) {
    fail(
      `${job.id}: ${source.path} no está dentro de ${expectedDir}/ (directorio de ${registered.id})`,
    );
  }
  if (registered && expectedDir) {
    const family = LICENSE_FAMILIES[registered.license];
    if (family && !expectedDir.startsWith(`${STAGING_PREFIX}${family}/`)) {
      fail(
        `${job.id}: la fuente ${registered.id} declara ${registered.license} fuera de ${family}/`,
      );
    }
  }
  if (registered?.license === "MIT" || registered?.license === "CC-BY-4.0") {
    if (!registered.attribution || !registered.author) {
      fail(`${job.id}: la fuente ${registered.id} exige atribución y no la registra`);
    }
  }
  if (stagingAvailable && !existsSync(source.path)) {
    fail(`${job.id}: no existe el archivo de fuente ${source.path}`);
  }
  const camera = job.camera;
  if (typeof camera?.orthoScale !== "number" || !(camera.orthoScale > 0)) {
    fail(`${job.id}: camera.orthoScale debe ser un número positivo`);
  }
  if (typeof camera?.targetZ !== "number") {
    fail(`${job.id}: falta camera.targetZ`);
  }
  checkRender(job, job.render ?? {});
  if (source.unitScaleOverride !== undefined) {
    if (!isPositiveInt(source.unitScale) && typeof source.unitScale !== "number") {
      fail(`${job.id}: unitScaleOverride requiere unitScale numérico`);
    }
    if (!source.unitScaleReason) fail(`${job.id}: unitScale sin unitScaleReason documentado`);
  }
}

if (jobs.schemaVersion !== 1) fail("asset-jobs.json: schemaVersion debe ser 1");
if (!jobs.defaults?.render) fail("asset-jobs.json: falta defaults.render");
else checkRender({ id: "defaults" }, jobs.defaults.render);

const seenIds = new Set();
for (const job of jobs.jobs ?? []) {
  if (!/^(ter|bld|chr|veh|prp)_[a-z0-9_]+$/.test(job.id)) fail(`id de job inválido: ${job.id}`);
  if (seenIds.has(job.id)) fail(`id de job duplicado: ${job.id}`);
  seenIds.add(job.id);

  const allowed = KIND_KEYS[job.kind];
  if (!allowed) {
    fail(`${job.id}: kind desconocido '${job.kind}'`);
    continue;
  }
  for (const key of Object.keys(job)) {
    if (!allowed.has(key)) fail(`${job.id}: clave '${key}' no admitida para kind=${job.kind}`);
  }
  if (!job.assetId) fail(`${job.id}: falta assetId`);

  if (!["bundle", "evidence"].includes(job.target)) fail(`${job.id}: target inválido`);
  if (job.target === "evidence" && !job.reason) {
    fail(`${job.id}: un job evidence debe explicar por qué no se publica`);
  }

  checkSource(job);

  if (job.kind === "building" || job.kind === "vehicle") {
    const states = job.states ?? [];
    if (states.length === 0) fail(`${job.id}: falta states`);
    for (const state of states) {
      if (!BUILDING_STATES.includes(state)) fail(`${job.id}: state desconocido ${state}`);
    }
    if (job.target === "bundle" && states.length !== BUILDING_STATES.length) {
      fail(
        `${job.id}: runtimeAssetManifestV1 exige los cuatro estados para publicar; marca target=evidence o añade los que faltan`,
      );
    }
  }

  if (job.kind === "character") {
    if (![4, 8].includes(job.directions)) fail(`${job.id}: directions debe ser 4 u 8`);
    if (!Array.isArray(job.animations) || job.animations.length === 0) {
      fail(`${job.id}: falta animations`);
    }
    for (const animation of job.animations ?? []) {
      if (!ANIMATION_NAMES.includes(animation))
        fail(`${job.id}: animation desconocida ${animation}`);
      if (!isPositiveInt(job.frameDurationMs?.[animation])) {
        fail(`${job.id}: frameDurationMs.${animation} falta o no es entero positivo`);
      }
    }
    const frames = job.frameIndices ?? [];
    if (frames.length === 0) fail(`${job.id}: frameIndices no puede estar vacío`);
    if (new Set(frames).size !== frames.length) fail(`${job.id}: frameIndices duplicado`);
    for (const frame of frames) {
      if (!Number.isInteger(frame) || frame < 0) fail(`${job.id}: frameIndex inválido ${frame}`);
    }
    if (job.frameDurationMs) {
      for (const key of Object.keys(job.frameDurationMs)) {
        if (!(job.animations ?? []).includes(key)) {
          fail(`${job.id}: frameDurationMs.${key} no corresponde a ninguna animation`);
        }
      }
    }
  }

  if (["terrain", "prop", "vehicle"].includes(job.kind)) {
    const footprint = job.footprint;
    if (!footprint || !isPositiveInt(footprint.width) || !isPositiveInt(footprint.height)) {
      fail(`${job.id}: ${job.kind} requiere footprint {width,height} enteros positivos`);
    } else if (footprint.width > 8 || footprint.height > 8) {
      fail(`${job.id}: footprint fuera de presupuesto (${footprint.width}x${footprint.height})`);
    }
  }
}

if (errors.length > 0) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        jobs: (jobs.jobs ?? []).length,
        errors,
        hint: "Revisa asset-jobs.json; la unión es discriminada por kind y sourceId es FK contra staging-sources.json.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "passed",
    jobs: jobs.jobs.length,
    bundle: jobs.jobs.filter((job) => job.target === "bundle").length,
    evidence: jobs.jobs.filter((job) => job.target === "evidence").length,
    sourcesChecked: stagingAvailable ? "con archivos" : "sin staging (CI)",
  }),
);

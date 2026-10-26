#!/usr/bin/env node
/**
 * Ruta E2E de assets por Blender (WP4.15-H, ampliada a jobs data-driven en WP4.15-V.a 〔R4〕).
 *
 * Lee `blender_artist/manifests/asset-jobs.json` en vez de generar los trabajos con bucles
 * hardcodeados, resuelve `unitScale` y licencia contra `staging-sources.json` y ensambla el
 * bundle `runtime-assets-blender.json`. Los jobs `target: "evidence"` se renderizan para validar
 * ingesta pero no se publican.
 *
 * Uso:
 *   node scripts/build-blender-assets.mjs           # renderiza y publica el bundle
 *   node scripts/build-blender-assets.mjs --check   # verifica hashes, medidas y completitud
 *
 * El binario de Blender es local (no existe en CI): `BLENDER_BIN` lo puede sustituir.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender");
const BLENDER_SCRIPT = join(REPO_ROOT, "tools", "art-pipeline", "blender", "runtime_asset.py");
const JOBS_PATH = join(REPO_ROOT, "blender_artist", "manifests", "asset-jobs.json");
const SOURCES_PATH = join(REPO_ROOT, "blender_artist", "manifests", "staging-sources.json");
const PUBLIC_DIR = join(REPO_ROOT, "apps", "web", "public", "assets", "runtime", "blender");
const BUNDLE_PATH = join(
  REPO_ROOT,
  "apps",
  "web",
  "src",
  "generated",
  "runtime-assets-blender.json",
);
const METADATA_PATH = join(
  REPO_ROOT,
  "blender_artist",
  "manifests",
  "runtime-blender-e2e-metadata.json",
);
const EVIDENCE_DIR = join(REPO_ROOT, "blender_artist", "generated", "runtime-evidence");
const ASSET_GROUPS = ["buildings", "characters", "terrain", "props", "vehicles"];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Medidas declaradas en el IHDR del PNG: no hace falta decodificar la imagen. */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function publicSrc(file) {
  return `/assets/runtime/blender/${file}.png`;
}

function readJobs() {
  const manifest = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
  const registry = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  return { manifest, sourcesById: new Map(registry.sources.map((s) => [s.id, s])) };
}

function unitScaleFor(job, sourcesById) {
  if (job.source.unitScaleOverride !== undefined) return job.source.unitScaleOverride;
  const source = sourcesById.get(job.source.sourceId);
  if (source?.unitScale === undefined) {
    throw new Error(`${job.id}: la fuente ${job.source.sourceId} no declara unitScale`);
  }
  return source.unitScale;
}

function provenanceFor(job, sourcesById) {
  if (job.source.kind === "procedural") return undefined;
  const source = sourcesById.get(job.source.sourceId);
  const provenance = {
    license: source.license,
    author: source.author ?? source.id,
    sourceId: source.id,
  };
  if (source.attribution) {
    provenance.attribution = {
      sourceUrl: source.sourceUrl,
      licenseUrl: source.attribution.licenseUrl,
      attributionText: source.attribution.attributionText,
      verifiedAt: source.attribution.verifiedAt,
      licenseFileSha256: source.integrity?.licenseFileSha256 ?? "",
    };
  }
  return provenance;
}

/** Expande un job en las pasadas de render que necesita el contrato runtime. */
function tasksFor(job, defaults) {
  const render = job.render ?? defaults.render;
  // Un job `evidence` valida la ingesta de SU fuente: basta una pasada representativa. Expandir
  // la matriz completa de un personaje multiplicaría por 16 la misma pose en A.
  const representative = (values) => (job.target === "evidence" ? values.slice(0, 1) : values);
  const tasks = [];
  if (job.kind === "character") {
    const directions = representative(Array.from({ length: job.directions }, (_, d) => d));
    const animations = representative(job.animations);
    const frames = representative(job.frameIndices);
    for (const direction of directions) {
      for (const animation of animations) {
        for (const frame of frames) {
          tasks.push({
            file: `${job.assetId}-d${direction}-${animation}-${frame}`,
            state: null,
            direction,
            animation,
            frame,
            render,
          });
        }
      }
    }
    return tasks;
  }
  for (const state of representative(job.states ?? [null])) {
    tasks.push({
      file: state ? `${job.assetId}-${state}` : job.assetId,
      state,
      direction: null,
      animation: null,
      frame: null,
      render,
    });
  }
  return tasks;
}

function argsFor(job, task, sourcesById) {
  const args = ["--asset", job.assetId];
  if (job.source.kind !== "procedural") {
    // Un job procedural NO redeclara cámara ni resolución: sus parámetros están congelados en
    // runtime_asset.py y pasarlos de nuevo sería una segunda fuente de verdad.
    args.push(
      "--kind",
      job.kind,
      "--source",
      `${job.source.kind}:${job.source.path}`,
      "--unit-scale",
      String(unitScaleFor(job, sourcesById)),
      "--ortho-scale",
      String(job.camera.orthoScale),
      "--target-z",
      String(job.camera.targetZ),
      "--render-width",
      String(task.render.width),
      "--render-height",
      String(task.render.height),
      "--source-id",
      job.source.sourceId,
      "--license",
      sourcesById.get(job.source.sourceId).license,
    );
  }
  if (task.state) args.push("--state", task.state);
  if (task.direction !== null) {
    args.push("--direction", String(task.direction));
    args.push("--animation", task.animation);
    args.push("--frame", String(task.frame));
  }
  return args;
}

function expectedFiles(manifest) {
  return manifest.jobs
    .filter((job) => job.target === "bundle")
    .flatMap((job) => tasksFor(job, manifest.defaults).map((task) => task.file));
}

function readBundle() {
  return JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
}

function check() {
  if (!existsSync(BUNDLE_PATH)) throw new Error(`Falta el bundle: ${BUNDLE_PATH}`);
  const { manifest } = readJobs();
  const bundle = readBundle();
  const images = [];
  for (const group of ASSET_GROUPS) {
    for (const asset of Object.values(bundle[group] ?? {})) {
      if (asset.states) images.push(...Object.values(asset.states));
      if (asset.animations) {
        images.push(...Object.values(asset.animations).flatMap((animation) => animation.frames));
      }
      if (asset.image) images.push(asset.image);
    }
  }

  let totalBytes = 0;
  for (const image of images) {
    const buffer = readFileSync(join(REPO_ROOT, "apps", "web", "public", image.src));
    totalBytes += buffer.length;
    const size = pngSize(buffer);
    if (sha256(buffer) !== image.sha256) {
      throw new Error(`Hash distinto del publicado: ${image.src}`);
    }
    if (size.width !== image.width || size.height !== image.height) {
      throw new Error(`Medidas distintas de las publicadas: ${image.src}`);
    }
  }

  // Manifiesto ↔ bundle en las dos direcciones: ni job sin imagen, ni imagen huérfana.
  const declared = new Set(expectedFiles(manifest));
  const published = new Set(images.map((image) => image.src.split("/").pop().replace(".png", "")));
  for (const file of declared) {
    if (!published.has(file)) throw new Error(`Job declarado sin imagen publicada: ${file}`);
  }
  for (const file of published) {
    if (!declared.has(file)) throw new Error(`Imagen publicada sin job declarado: ${file}`);
  }
  for (const file of readdirSync(PUBLIC_DIR)) {
    const stem = file.replace(/\.png$/, "");
    if (file.endsWith(".png") && !declared.has(stem)) {
      throw new Error(`PNG huérfano en public/: ${file}`);
    }
  }

  console.log(
    JSON.stringify({
      status: "passed",
      images: images.length,
      jobs: declared.size,
      totalBytes,
      bundle: BUNDLE_PATH,
    }),
  );
}

function renderTask(job, task, sourcesById, workDir) {
  const workPng = join(workDir, `${task.file}.png`);
  const workJson = join(workDir, `${task.file}.json`);
  const result = spawnSync(
    BLENDER,
    [
      "--background",
      "--python",
      BLENDER_SCRIPT,
      "--",
      ...argsFor(job, task, sourcesById),
      "--output",
      workPng,
      "--metadata",
      workJson,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Blender falló para ${task.file}:\n${result.stderr ?? result.stdout}`);
  }
  return { workPng, workJson, entry: JSON.parse(readFileSync(workJson, "utf8")) };
}

function pixelsPerMeterFor(job, task) {
  // Los jobs procedurales ya están dibujados a la escala del juego; sólo las cámaras Blender
  // necesitan declarar su densidad para que el renderer las lleve a la celda de 4 m.
  if (job.source.kind === "procedural") return undefined;
  return task.render.width / job.camera.orthoScale;
}

function assembleInto(bundle, job, task, entry, image, provenance) {
  if (job.kind === "building") {
    const asset = (bundle.buildings[entry.assetId] ??= {
      type: entry.assetId,
      name: entry.label,
      footprint: job.footprint ?? entry.footprint,
      pivot: entry.pivot,
      states: {},
    });
    const pixelsPerMeter = pixelsPerMeterFor(job, task);
    if (pixelsPerMeter !== undefined) asset.pixelsPerMeter = pixelsPerMeter;
    if (provenance) asset.provenance = provenance;
    asset.states[entry.state] = image;
    return;
  }
  if (job.kind === "character") {
    const character = (bundle.characters[entry.assetId] ??= {
      id: entry.assetId,
      name: entry.label,
      directions: job.directions,
      animations: Object.fromEntries(
        job.animations.map((animation) => [
          animation,
          { frameDurationMs: job.frameDurationMs[animation], frames: [] },
        ]),
      ),
    });
    if (provenance) character.provenance = provenance;
    const slot = job.frameIndices.indexOf(entry.frame);
    if (slot < 0) throw new Error(`${entry.assetId}: frame ${entry.frame} fuera de frameIndices`);
    character.animations[entry.animation].frames[entry.direction * job.frameIndices.length + slot] =
      image;
    return;
  }
  const group = { terrain: "terrain", prop: "props", vehicle: "vehicles" }[job.kind];
  if (!group) {
    throw new Error(`${job.id}: kind '${job.kind}' no tiene grupo runtime`);
  }
  const asset = ((bundle[group] ??= {})[entry.assetId] = {
    id: entry.assetId,
    name: entry.label,
    footprint: job.footprint ?? { width: 1, height: 1 },
    pivot: entry.pivot,
    image,
  });
  const pixelsPerMeter = pixelsPerMeterFor(job, task);
  if (pixelsPerMeter !== undefined) asset.pixelsPerMeter = pixelsPerMeter;
  if (provenance) asset.provenance = provenance;
}

function render() {
  if (!existsSync(BLENDER)) {
    throw new Error(`No existe el binario de Blender: ${BLENDER} (define BLENDER_BIN)`);
  }
  const { manifest, sourcesById } = readJobs();
  const bundle = {
    schemaVersion: 1,
    generator: {
      id: "blender-runtime-asset-e2e",
      version: 1,
      method: "blender_render",
      source: "tools/art-pipeline/blender/runtime_asset.py",
    },
    provenance: {
      license: "original",
      author: "Landlord project",
      notes:
        "Resumen del bundle: la procedencia real es por asset (D-083). Los renders son obra del proyecto; la geometría de cada asset declara su fuente y su licencia.",
    },
    buildings: {},
    characters: {},
  };
  mkdirSync(PUBLIC_DIR, { recursive: true });
  mkdirSync(dirname(BUNDLE_PATH), { recursive: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const workDir = mkdtempSync(join(tmpdir(), "landlord-blender-assets-"));
  const metadata = [];
  const published = [];
  let evidenceCount = 0;

  for (const job of manifest.jobs) {
    for (const task of tasksFor(job, manifest.defaults)) {
      const { workPng, workJson, entry } = renderTask(job, task, sourcesById, workDir);
      if (job.target === "evidence") {
        copyFileSync(workPng, join(EVIDENCE_DIR, `${task.file}.png`));
        copyFileSync(workJson, join(EVIDENCE_DIR, `${task.file}.json`));
        evidenceCount += 1;
        continue;
      }
      const target = join(PUBLIC_DIR, `${task.file}.png`);
      copyFileSync(workPng, target);
      const buffer = readFileSync(target);
      const image = {
        src: publicSrc(task.file),
        width: entry.image.width,
        height: entry.image.height,
        sha256: sha256(buffer),
      };
      metadata.push(entry);
      published.push(task.file);
      assembleInto(bundle, job, task, entry, image, provenanceFor(job, sourcesById));
    }
  }
  rmSync(workDir, { recursive: true, force: true });
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  const totalBytes = published.reduce(
    (total, file) => total + readFileSync(join(PUBLIC_DIR, `${file}.png`)).length,
    0,
  );
  console.log(
    JSON.stringify({
      status: "rendered",
      images: published.length,
      evidence: evidenceCount,
      totalBytes,
      bundle: BUNDLE_PATH,
      metadata: METADATA_PATH,
    }),
  );
}

if (process.argv.includes("--check")) check();
else render();

#!/usr/bin/env node
/**
 * Ruta E2E de assets por Blender (WP4.15-H): render ortográfico con fondo transparente,
 * recorte al contenido real, reducción 2× y metadatos con pivote proyectado desde el origen 3D.
 * Demuestra la cadena Blender → render → trim → metadata → manifiesto → Phaser para UN edificio
 * (courtyard_home, cuatro estados) y UNA variante de personaje (vecino_variante, 4 direcciones).
 * El resto de assets Alpha sigue siendo procedural: esto prueba la ruta, no sustituye la factoría.
 *
 * Uso:
 *   node scripts/build-blender-assets.mjs           # renderiza y publica el bundle
 *   node scripts/build-blender-assets.mjs --check   # verifica hashes y medidas de lo publicado
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
const PUBLIC_DIR = join(REPO_ROOT, "apps", "web", "public", "assets", "runtime", "blender");
const BUNDLE_PATH = join(PUBLIC_DIR, "runtime-assets-blender.json");
const METADATA_PATH = join(
  REPO_ROOT,
  "blender_artist",
  "manifests",
  "runtime-blender-e2e-metadata.json",
);

const BUILDING_STATES = ["complete", "construction", "damaged", "burning"];
const ANIMATIONS = ["idle", "walk"];
const FRAME_DURATION_MS = { idle: 400, walk: 180 };

const jobs = [];
for (const state of BUILDING_STATES) {
  jobs.push({
    file: `courtyard_home-${state}`,
    args: ["--asset", "courtyard_home", "--state", state],
  });
}
for (let direction = 0; direction < 4; direction += 1) {
  for (const animation of ANIMATIONS) {
    for (let frame = 0; frame < 2; frame += 1) {
      jobs.push({
        file: `vecino_variante-d${direction}-${animation}-${frame}`,
        args: [
          "--asset",
          "vecino_variante",
          "--direction",
          String(direction),
          "--animation",
          animation,
          "--frame",
          String(frame),
        ],
      });
    }
  }
}

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

function readBundle() {
  return JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
}

function check() {
  if (!existsSync(BUNDLE_PATH)) throw new Error(`Falta el bundle: ${BUNDLE_PATH}`);
  const bundle = readBundle();
  const images = [
    ...Object.values(bundle.buildings).flatMap((asset) => Object.values(asset.states)),
    ...Object.values(bundle.characters).flatMap((character) =>
      Object.values(character.animations).flatMap((animation) => animation.frames),
    ),
  ];
  let totalBytes = 0;
  for (const image of images) {
    const buffer = readFileSync(join(REPO_ROOT, "apps", "web", "public", image.src));
    totalBytes += buffer.length;
    const size = pngSize(buffer);
    if (sha256(buffer) !== image.sha256)
      throw new Error(`Hash distinto del publicado: ${image.src}`);
    if (size.width !== image.width || size.height !== image.height)
      throw new Error(`Medidas distintas de las publicadas: ${image.src}`);
  }
  console.log(
    JSON.stringify({ status: "passed", images: images.length, totalBytes, bundle: BUNDLE_PATH }),
  );
}

function render() {
  if (!existsSync(BLENDER))
    throw new Error(`No existe el binario de Blender: ${BLENDER} (define BLENDER_BIN)`);
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const workDir = mkdtempSync(join(tmpdir(), "landlord-blender-assets-"));
  const metadata = [];
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
        "E2E de la ruta Blender para un edificio y una variante de personaje; el resto de assets Alpha sigue siendo procedural.",
    },
    buildings: {},
    characters: {},
  };
  for (const job of jobs) {
    const workPng = join(workDir, `${job.file}.png`);
    const workJson = join(workDir, `${job.file}.json`);
    const result = spawnSync(
      BLENDER,
      [
        "--background",
        "--python",
        BLENDER_SCRIPT,
        "--",
        ...job.args,
        "--output",
        workPng,
        "--metadata",
        workJson,
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(`Blender falló para ${job.file}:\n${result.stderr ?? result.stdout}`);
    }
    const target = join(PUBLIC_DIR, `${job.file}.png`);
    copyFileSync(workPng, target);
    const entry = JSON.parse(readFileSync(workJson, "utf8"));
    const buffer = readFileSync(target);
    metadata.push(entry);
    const image = {
      src: publicSrc(job.file),
      width: entry.image.width,
      height: entry.image.height,
      sha256: sha256(buffer),
    };
    if (entry.kind === "building") {
      const asset = (bundle.buildings[entry.assetId] ??= {
        type: entry.assetId,
        name: entry.label,
        footprint: entry.footprint,
        pivot: entry.pivot,
        states: {},
      });
      asset.states[entry.state] = image;
    } else {
      const character = (bundle.characters[entry.assetId] ??= {
        id: entry.assetId,
        name: entry.label,
        directions: 4,
        animations: {
          idle: { frameDurationMs: FRAME_DURATION_MS.idle, frames: [] },
          walk: { frameDurationMs: FRAME_DURATION_MS.walk, frames: [] },
        },
      });
      character.animations[entry.animation].frames[entry.direction * 2 + entry.frame] = image;
    }
  }
  rmSync(workDir, { recursive: true, force: true });
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  const totalBytes = jobs.reduce(
    (total, job) => total + readFileSync(join(PUBLIC_DIR, `${job.file}.png`)).length,
    0,
  );
  console.log(
    JSON.stringify({
      status: "rendered",
      images: jobs.length,
      totalBytes,
      bundle: BUNDLE_PATH,
      metadata: METADATA_PATH,
    }),
  );
}

if (process.argv.includes("--check")) check();
else render();

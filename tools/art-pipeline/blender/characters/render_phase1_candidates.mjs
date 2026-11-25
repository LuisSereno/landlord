#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourceRoot = resolve(
  option("--source-root") ?? process.env.LANDLORD_SOURCE_ROOT ?? resolve(repoRoot, "../landlord"),
);
const blender =
  option("--blender") ??
  process.env.BLENDER_BIN ??
  join(sourceRoot, "blender_artist/toolchain/blender-5.2.2-linux-x64/blender");
const jobsPath = resolve(
  repoRoot,
  option("--manifest") ?? "blender_artist/manifests/character-jobs-phase-1.json",
);
const compositor = option("--compositor") ? resolve(repoRoot, option("--compositor")) : null;
const manifest = JSON.parse(readFileSync(jobsPath, "utf8"));
const outputRoot = resolve(repoRoot, manifest.outputDirectory);
const runtimeScript = join(sourceRoot, "tools/art-pipeline/blender/runtime_asset.py");
const styleLayer = join(sourceRoot, "tools/art-pipeline/blender/style_layer_graphic_civic.json");

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const repoRelative = (path) => relative(repoRoot, path).split(sep).join("/");
const sourceRelative = (path) => relative(sourceRoot, path).split(sep).join("/");

function isInside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function sourceFile(path) {
  const file = resolve(sourceRoot, path);
  if (!isInside(sourceRoot, file) || !existsSync(file)) {
    throw new Error(`Fuente ausente o fuera del repositorio fuente: ${path}`);
  }
  return file;
}

function verifySource(path, expectedHash, label) {
  const file = sourceFile(path);
  const actual = sha256(file);
  if (actual !== expectedHash)
    throw new Error(`${label}: sha256 distinto del manifiesto (${actual})`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0 || output.includes("Traceback (most recent call last)")) {
    throw new Error(`${command} falló (${result.status}):\n${output}`);
  }
  return result.stdout;
}

if (!isInside(repoRoot, outputRoot)) throw new Error("La salida debe quedar dentro del worktree");
if (!existsSync(sourceRoot) || !existsSync(runtimeScript) || !existsSync(styleLayer)) {
  throw new Error(`Repositorio fuente incompleto: ${sourceRoot}`);
}
if (!existsSync(blender)) throw new Error(`Blender no disponible: ${blender}`);
if (compositor && !existsSync(compositor))
  throw new Error(`Compositor no disponible: ${compositor}`);
if (manifest.status !== "candidate" || manifest.runtimePromotion !== false) {
  throw new Error("El manifiesto debe declarar candidate y runtimePromotion=false");
}
if (manifest.directions !== 4 || !Array.isArray(manifest.jobs) || manifest.jobs.length === 0) {
  throw new Error("Se esperan trabajos y cuatro direcciones");
}

const blenderVersion = run(blender, ["--version"]);
if (!blenderVersion.includes("5.2.2 LTS")) throw new Error("Se requiere Blender 5.2.2 LTS");
const buildHash = blenderVersion.match(/build hash:\s*([0-9a-f]+)/i)?.[1] ?? null;
const sourceHead = run("git", ["-C", sourceRoot, "rev-parse", "HEAD"]).trim();
const dependencyHashes = new Map([
  [runtimeScript, sha256(runtimeScript)],
  [styleLayer, sha256(styleLayer)],
  [jobsPath, sha256(jobsPath)],
  ...(compositor ? [[compositor, sha256(compositor)]] : []),
]);

function assertDependenciesUnchanged() {
  for (const [path, expected] of dependencyHashes) {
    const actual = sha256(path);
    if (actual !== expected) throw new Error(`Dependencia cambió durante el render: ${path}`);
  }
}

verifySource(
  manifest.sourcePolicy.licenseFile,
  manifest.sourcePolicy.licenseFileSha256,
  "licencia Rocketbox",
);
for (const job of manifest.jobs) {
  verifySource(job.source.path, job.source.sha256, `${job.id} source`);
  for (const animation of manifest.animations) {
    verifySource(
      job.animationSources[animation].path,
      job.animationSources[animation].sha256,
      `${job.id} ${animation}`,
    );
  }
}

mkdirSync(outputRoot, { recursive: true });
for (const generated of [
  "candidate-manifest.json",
  "candidate-validation.json",
  "contact-sheets.json",
]) {
  rmSync(join(outputRoot, generated), { force: true });
}

const outputsByJob = new Map(manifest.jobs.map((job) => [job.id, []]));
for (const job of manifest.jobs) {
  const jobDirectory = join(outputRoot, job.id);
  mkdirSync(jobDirectory, { recursive: true });
  for (const direction of Array.from({ length: manifest.directions }, (_, index) => index)) {
    for (const animation of manifest.animations) {
      for (const frame of manifest.frameIndices) {
        assertDependenciesUnchanged();
        const fileBase = `${job.id}-d${direction}-${animation}-${frame}`;
        const png = join(jobDirectory, `${fileBase}.png`);
        const metadataPath = join(jobDirectory, `${fileBase}.json`);
        const sourcePath = sourceFile(job.source.path);
        const clipPath = sourceFile(job.animationSources[animation].path);
        rmSync(png, { force: true });
        rmSync(metadataPath, { force: true });
        rmSync(metadataPath.replace(/\.json$/, ".composition.json"), { force: true });
        const blenderOutput = run(blender, [
          "-t",
          "4",
          "--background",
          "--python-exit-code",
          "1",
          "--python",
          compositor ?? runtimeScript,
          "--",
          ...(compositor
            ? [
                "--runtime-asset",
                runtimeScript,
                "--character-config",
                jobsPath,
                "--character-job-id",
                job.id,
              ]
            : []),
          "--asset",
          job.id,
          "--kind",
          "character",
          "--source",
          `fbx:${sourcePath}`,
          "--animation-source",
          `fbx:${clipPath}`,
          "--source-id",
          manifest.sourcePolicy.sourceId,
          "--license",
          manifest.sourcePolicy.license,
          "--unit-scale",
          String(job.unitScale),
          "--ortho-scale",
          String(manifest.camera.orthoScale),
          "--target-z",
          String(manifest.camera.targetZ),
          "--render-width",
          String(manifest.render.width),
          "--render-height",
          String(manifest.render.height),
          "--direction",
          String(direction),
          "--animation",
          animation,
          "--frame",
          String(frame),
          "--output",
          png,
          "--metadata",
          metadataPath,
        ]);
        if (compositor && !blenderOutput.includes(`WP_CHAR_COMPOSITOR_OK ${job.id}`)) {
          throw new Error(`Blender no confirmó el compositor para ${fileBase}`);
        }
        if (!existsSync(png) || !existsSync(metadataPath)) {
          throw new Error(`Blender no produjo PNG/metadata para ${fileBase}`);
        }
        const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
        if (
          metadata.assetId !== job.id ||
          metadata.direction !== direction ||
          metadata.animation !== animation ||
          metadata.frame !== frame
        ) {
          throw new Error(`Metadata de slot incorrecta para ${fileBase}`);
        }
        let composition = null;
        if (compositor) {
          const compositionPath = metadataPath.replace(/\.json$/, ".composition.json");
          if (!existsSync(compositionPath)) {
            throw new Error(`Blender no produjo composición para ${fileBase}`);
          }
          composition = JSON.parse(readFileSync(compositionPath, "utf8"));
          if (
            composition.jobId !== job.id ||
            composition.factoryCharacterId !== job.factoryCharacterId ||
            composition.accessoryObjectCount < job.accessories.length ||
            composition.maxAnchorDrift > 1e-4 ||
            JSON.stringify(composition.accessories.map((entry) => [entry.type, entry.bone])) !==
              JSON.stringify(job.accessories.map((entry) => [entry.type, entry.bone]))
          ) {
            throw new Error(`Composición incorrecta para ${fileBase}`);
          }
        }
        const imageSha256 = sha256(png);
        if (metadata.image?.sha256 !== imageSha256) {
          throw new Error(`Hash de imagen incorrecto para ${fileBase}`);
        }
        outputsByJob.get(job.id).push({
          path: repoRelative(png),
          metadataPath: repoRelative(metadataPath),
          sha256: imageSha256,
          metadataSha256: sha256(metadataPath),
          ...(composition
            ? {
                compositionPath: repoRelative(metadataPath.replace(/\.json$/, ".composition.json")),
                compositionSha256: sha256(metadataPath.replace(/\.json$/, ".composition.json")),
                accessoryObjectCount: composition.accessoryObjectCount,
                maxAnchorDrift: composition.maxAnchorDrift,
              }
            : {}),
          width: metadata.image.width,
          height: metadata.image.height,
          worldSizeMeters:
            composition?.composedSizeMeters ?? metadata.source?.worldSizeMeters ?? null,
          direction,
          orientationDegrees:
            manifest.camera.azimuthBaseDegrees + direction * manifest.camera.azimuthStepDegrees,
          animation,
          frame,
          renderMs: metadata.render?.renderMs ?? null,
          totalMs: metadata.render?.totalMs ?? null,
          status: "candidate",
          validationStatus: "pending_independent_check",
        });
        console.log(`Rendered ${fileBase}`);
      }
    }
  }
}
assertDependenciesUnchanged();

for (const job of manifest.jobs) {
  const outputs = outputsByJob.get(job.id);
  const expected = manifest.directions * manifest.animations.length * manifest.frameIndices.length;
  if (outputs.length !== expected) throw new Error(`${job.id}: esperados ${expected} frames`);
  for (const direction of Array.from({ length: manifest.directions }, (_, index) => index)) {
    const idle = outputs.find(
      (output) =>
        output.direction === direction && output.animation === "idle" && output.frame === 0,
    );
    const walk = outputs.find(
      (output) =>
        output.direction === direction && output.animation === "walk" && output.frame === 0,
    );
    if (!idle || !walk || idle.sha256 === walk.sha256) {
      throw new Error(`${job.id}: idle/walk no diferenciados en dirección ${direction}`);
    }
  }
}

const generatedManifest = {
  schemaVersion: 1,
  status: "candidate",
  approval: "pending_human",
  runtimePromotion: false,
  technicalValidation: "pending_independent_check",
  jobsManifest: repoRelative(jobsPath),
  jobsManifestSha256: sha256(jobsPath),
  outputDirectory: repoRelative(outputRoot),
  matrix: {
    directions: manifest.directions,
    animations: manifest.animations,
    frameIndices: manifest.frameIndices,
  },
  ...(compositor
    ? {
        compositor: repoRelative(compositor),
        compositorSha256: dependencyHashes.get(compositor),
      }
    : {}),
  materialPolicy: manifest.materialPolicy ?? null,
  accessoryAnchorPolicy: manifest.accessoryAnchorPolicy ?? null,
  sourceRepository: {
    root: sourceRoot,
    head: sourceHead,
    runtimeScript: sourceRelative(runtimeScript),
    runtimeScriptSha256: dependencyHashes.get(runtimeScript),
    styleLayer: sourceRelative(styleLayer),
    styleLayerSha256: dependencyHashes.get(styleLayer),
  },
  toolchain: {
    blender: "5.2.2 LTS",
    buildHash,
    command: sourceRelative(blender),
  },
  presentation: manifest.presentation,
  jobs: manifest.jobs.map((job) => ({
    ...job,
    outputDirectory: repoRelative(join(outputRoot, job.id)),
    outputs: outputsByJob.get(job.id),
  })),
};
writeFileSync(
  join(outputRoot, "candidate-manifest.json"),
  `${JSON.stringify(generatedManifest, null, 2)}\n`,
  "utf8",
);
console.log(
  JSON.stringify({
    status: "rendered",
    candidates: generatedManifest.jobs.length,
    frames: generatedManifest.jobs.reduce((total, job) => total + job.outputs.length, 0),
    outputDirectory: repoRelative(outputRoot),
  }),
);

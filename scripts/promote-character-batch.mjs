#!/usr/bin/env node
/* global Buffer */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const argv = process.argv.slice(2);
const planPath = resolve(
  REPO_ROOT,
  argv.find((value) => value.startsWith("--plan="))?.slice("--plan=".length) ??
    "docs/art/characters/candidates/wp-char-04/promotion-plan.json",
);
const mood = argv.find((value) => value.startsWith("--mood="))?.slice("--mood=".length) ?? "day";
const checkOnly = argv.includes("--check");
if (!["day", "night"].includes(mood)) throw new Error("--mood debe ser day o night");

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const pngSize = (buffer) => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
const plan = JSON.parse(readFileSync(planPath, "utf8"));
if (plan.approvalStatus !== "approved_human") throw new Error("Falta aprobación humana");
if (!existsSync(resolve(REPO_ROOT, plan.approvalReference))) {
  throw new Error("Falta el acta de aprobación humana");
}
const runRoot = resolve(REPO_ROOT, plan.runRoot);
const execution = JSON.parse(readFileSync(join(runRoot, "execution.json"), "utf8"));
const validation = JSON.parse(readFileSync(join(runRoot, "batch-validation.json"), "utf8"));
if (
  execution.renderedFrames !== 504 ||
  execution.failures?.length !== 0 ||
  validation.status !== "passed" ||
  validation.counts?.frames !== 504 ||
  validation.runtimePromotion !== false
) {
  throw new Error("El batch no tiene una validación técnica completa de 504 frames");
}
const pipeline = JSON.parse(
  readFileSync(
    resolve(REPO_ROOT, "tools/art-pipeline/blender/characters/wp_char_04/manifest.json"),
    "utf8",
  ),
);
const roles = Object.keys(pipeline.candidates);
if (JSON.stringify([...roles].sort()) !== JSON.stringify([...plan.roles].sort())) {
  throw new Error("Los roles del plan no coinciden con el pipeline canónico");
}

const outputDir = resolve(REPO_ROOT, "apps/web/public/assets/runtime/characters-kenney");
const outputManifest =
  mood === "day"
    ? resolve(REPO_ROOT, "apps/web/src/generated/runtime-assets-blender.json")
    : resolve(REPO_ROOT, "apps/web/src/generated/runtime-assets-blender-day.json");
const promotionManifestPath = resolve(
  REPO_ROOT,
  "blender_artist/manifests/runtime-character-promotions.json",
);
const entries = [];
const files = [];
let plannedBytes = 0;
for (const role of roles) {
  const candidate = pipeline.candidates[role];
  const reportPath = join(runRoot, "roles", role, `${role}-batch.json`);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const byKey = new Map(
    report.outputs.map((output) => [
      `${output.direction}/${output.animation}/${output.sampleIndex}`,
      output,
    ]),
  );
  const idle = [];
  const walk = [];
  const roleHashes = [];
  for (const direction of [0, 1, 2, 3]) {
    const idleOutput = byKey.get(`${direction}/idle/0`);
    if (!idleOutput) throw new Error(`${role}: falta idle D${direction}`);
    idle.push(idleOutput);
    roleHashes.push(idleOutput.image.sha256);
    for (const sample of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const walkOutput = byKey.get(`${direction}/walk/${sample}`);
      if (!walkOutput) throw new Error(`${role}: falta walk D${direction} sample ${sample}`);
      walk.push(walkOutput);
      roleHashes.push(walkOutput.image.sha256);
    }
  }
  if (idle.length !== 4 || walk.length !== 32) throw new Error(`${role}: matriz incompleta`);
  const toImage = (output) => {
    const sourcePath = resolve(REPO_ROOT, output.image.path);
    const buffer = readFileSync(sourcePath);
    if (sha256(buffer) !== output.image.sha256) {
      throw new Error(`${role}: hash de frame divergente ${output.image.path}`);
    }
    const filename = basename(sourcePath);
    const size = pngSize(buffer);
    if (size.width !== output.image.width || size.height !== output.image.height) {
      throw new Error(`${role}: dimensiones divergentes ${filename}`);
    }
    files.push(filename);
    plannedBytes += buffer.length;
    if (!checkOnly) {
      mkdirSync(outputDir, { recursive: true });
      const target = join(outputDir, filename);
      if (!existsSync(target) || sha256(readFileSync(target)) !== output.image.sha256) {
        copyFileSync(sourcePath, target);
      }
    }
    return {
      src: `/assets/runtime/characters-kenney/${filename}`,
      width: size.width,
      height: size.height,
      sha256: output.image.sha256,
    };
  };
  entries.push({
    id: role,
    name: candidate.displayName,
    directions: 4,
    animations: {
      idle: {
        frameDurationMs: plan.frameDurationMs.idle,
        frames: idle.map(toImage),
      },
      walk: {
        frameDurationMs: plan.frameDurationMs.walk,
        frames: walk.map(toImage),
      },
    },
    provenance: {
      license: "CC0-1.0",
      author: "Kenney",
      sourceId: "src_kenney_mini_characters",
      notes: `Approved by ${plan.approvedBy} on ${plan.approvedAt}; ${plan.runRoot}; 34 px configuration B.`,
    },
    sourceFile: candidate.sourceFile,
    sourceSha256: candidate.sourceSha256,
    frameCount: 36,
    frameSetSha256: sha256(Buffer.from(roleHashes.join(""), "hex")),
  });
}

if (checkOnly) {
  console.log(
    JSON.stringify({
      status: "checked",
      roles: entries.length,
      frames: files.length,
      plannedBytes,
      outputManifest: outputManifest.slice(REPO_ROOT.length + 1),
    }),
  );
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, ".gitignore"), "*\n!.gitignore\n");
const bundle = JSON.parse(readFileSync(outputManifest, "utf8"));
for (const entry of entries) {
  bundle.characters[entry.id] = {
    id: entry.id,
    name: entry.name,
    directions: entry.directions,
    animations: entry.animations,
    provenance: entry.provenance,
  };
}
bundle.generator.version = (bundle.generator.version ?? 0) + 1;
writeFileSync(outputManifest, `${JSON.stringify(bundle, null, 2)}\n`);
const promotion = {
  schemaVersion: 1,
  promotionId: plan.planId,
  status: "promoted_approved_human",
  approvalStatus: plan.approvalStatus,
  approvalReference: plan.approvalReference,
  approvedBy: plan.approvedBy,
  approvedAt: plan.approvedAt,
  runRoot: plan.runRoot,
  batchValidation: {
    path: join(plan.runRoot, "batch-validation.json"),
    sha256: sha256(readFileSync(join(runRoot, "batch-validation.json"))),
  },
  targetHeightPixels: plan.targetHeightPixels,
  outputDirectory: "apps/web/public/assets/runtime/characters-kenney",
  bundleManifests: [
    "apps/web/src/generated/runtime-assets-blender.json",
    "apps/web/src/generated/runtime-assets-blender-day.json",
  ],
  frameCount: files.length,
  files,
  roles: entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    sourceFile: entry.sourceFile,
    sourceSha256: entry.sourceSha256,
    frameCount: entry.frameCount,
    frameSetSha256: entry.frameSetSha256,
  })),
};
writeFileSync(promotionManifestPath, `${JSON.stringify(promotion, null, 2)}\n`);
console.log(
  JSON.stringify({
    status: "promoted",
    mood,
    roles: entries.length,
    frames: files.length,
    bytes: plannedBytes,
    manifest: outputManifest.slice(REPO_ROOT.length + 1),
    promotionManifest: promotionManifestPath.slice(REPO_ROOT.length + 1),
  }),
);

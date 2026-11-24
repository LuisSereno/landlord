#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const sourceRoot = resolve(repoRoot, "../landlord");
const factory = JSON.parse(
  readFileSync(resolve(repoRoot, "blender_artist/manifests/character-factory.json"), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, "blender_artist/manifests/character-jobs-phase-1b.json"), "utf8"),
);
const inspection = JSON.parse(
  readFileSync(
    resolve(repoRoot, "docs/art/characters/candidates/phase-1b/source-inspection.json"),
    "utf8",
  ),
);
const expectedOperational = [
  "supervisor",
  "construction_worker_a",
  "construction_worker_b",
  "maintenance_technician",
  "enforcer_male",
  "enforcer_female",
];
const allowedAccessories = new Set([
  "hard_hat",
  "clipboard",
  "tool_belt",
  "work_cap",
  "tool_bag",
  "wrench",
  "flat_cap",
  "reinforced_collar",
  "jacket_lapels",
  "long_coat_panels",
  "brim_hat",
]);
const allowedBones = new Set(manifest.accessoryAnchorPolicy?.allowedBones ?? []);
const errors = [];
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

if (factory.characters.length !== 14) errors.push("Character Factory must contain 14 variants");
const operational = factory.characters
  .filter((entry) => entry.category === "operational")
  .map((entry) => entry.id)
  .sort();
if (JSON.stringify(operational) !== JSON.stringify([...expectedOperational].sort())) {
  errors.push("Character Factory operational ids do not match the six target variants");
}
if (manifest.status !== "candidate" || manifest.runtimePromotion !== false) {
  errors.push("phase-1b must remain candidate with runtimePromotion=false");
}
if (manifest.approval !== "pending_human")
  errors.push("phase-1b approval must remain pending_human");
if (!Array.isArray(manifest.jobs) || manifest.jobs.length !== 6) errors.push("expected six jobs");
const factoryIds = manifest.jobs.map((job) => job.factoryCharacterId).sort();
if (JSON.stringify(factoryIds) !== JSON.stringify([...expectedOperational].sort())) {
  errors.push("phase-1b jobs must map one-to-one to the operational factory ids");
}
const expectedFrames =
  manifest.jobs.length *
  manifest.directions *
  manifest.animations.length *
  manifest.frameIndices.length;
if (expectedFrames !== 96) errors.push(`expected 96 frames, received ${expectedFrames}`);
if (manifest.directions !== 4 || manifest.animations.join(",") !== "idle,walk") {
  errors.push("phase-1b must keep four directions and idle/walk");
}
if (manifest.frameIndices.join(",") !== "0,1")
  errors.push("phase-1b must keep two frames per clip");
if (manifest.accessoryAnchorPolicy?.weapons !== false) errors.push("weapons must remain disabled");

const inspectionByAvatar = new Map(inspection.avatars.map((avatar) => [avatar.id, avatar]));
for (const job of manifest.jobs) {
  if (job.id !== `phase1b_${job.factoryCharacterId}`) errors.push(`${job.id}: incompatible job id`);
  if (job.status !== "candidate") errors.push(`${job.id}: job must remain candidate`);
  const sourcePath = resolve(sourceRoot, job.source.path);
  if (!existsSync(sourcePath) || sha256(sourcePath) !== job.source.sha256) {
    errors.push(`${job.id}: source hash mismatch`);
  }
  for (const animation of manifest.animations) {
    const clip = job.animationSources?.[animation];
    const clipPath = resolve(sourceRoot, clip?.path ?? "");
    if (!clip || !existsSync(clipPath) || sha256(clipPath) !== clip.sha256) {
      errors.push(`${job.id}: ${animation} clip hash mismatch`);
    }
  }
  const tint = job.materialVariant?.bodyTint;
  if (
    !Array.isArray(tint) ||
    tint.length !== 3 ||
    tint.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    errors.push(`${job.id}: bodyTint must contain three normalized values`);
  }
  if (!Array.isArray(job.accessories) || job.accessories.length === 0) {
    errors.push(`${job.id}: at least one accessory is required`);
  }
  for (const accessory of job.accessories) {
    if (!allowedAccessories.has(accessory.type))
      errors.push(`${job.id}: unknown accessory ${accessory.type}`);
    if (!allowedBones.has(accessory.bone))
      errors.push(`${job.id}: unsupported bone ${accessory.bone}`);
    if (!accessory.material) errors.push(`${job.id}: accessory material is required`);
  }
  const avatarId = job.source.path.match(/avatars\/([^/]+)\/Export\//)?.[1];
  const evidence = inspectionByAvatar.get(avatarId);
  if (!evidence || evidence.sha256 !== job.source.sha256) {
    errors.push(`${job.id}: source inspection evidence does not match`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `WP-CHAR-01B manifest PASS: 14 factory variants; 6 operational recipes; ${expectedFrames} target frames; source/license/anchor contracts coherent.`,
  );
}

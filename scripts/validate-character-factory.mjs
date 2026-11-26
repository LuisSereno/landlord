#!/usr/bin/env node
/* global structuredClone */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPECTED_CHARACTERS = {
  civilian_male_a: { role: "civilian", category: "ambient", priority: "P1" },
  civilian_male_b: { role: "civilian", category: "ambient", priority: "P1" },
  civilian_female_a: { role: "civilian", category: "ambient", priority: "P1" },
  civilian_female_b: { role: "civilian", category: "ambient", priority: "P1" },
  supervisor: { role: "supervisor", category: "operational", priority: "P0" },
  construction_worker_a: {
    role: "construction_worker",
    category: "operational",
    priority: "P0",
  },
  construction_worker_b: {
    role: "construction_worker",
    category: "operational",
    priority: "P0",
  },
  maintenance_technician: {
    role: "maintenance_technician",
    category: "operational",
    priority: "P0",
  },
  enforcer_male: { role: "enforcer", category: "operational", priority: "P0" },
  enforcer_female: { role: "enforcer", category: "operational", priority: "P0" },
  police: { role: "police", category: "ambient", priority: "P1" },
  firefighter: { role: "firefighter", category: "ambient", priority: "P1" },
  medical_professional: {
    role: "medical_professional",
    category: "ambient",
    priority: "P1",
  },
  municipal_professional: {
    role: "municipal_professional",
    category: "ambient",
    priority: "P2",
  },
};
const DOMAIN_SPECIALTIES = [
  "supervisor",
  "construction_worker",
  "maintenance_technician",
  "enforcer",
];
const RUNTIME_ANIMATIONS = ["idle", "walk"];
const CANDIDATE_ANIMATIONS = [
  "work",
  "repair",
  "carry",
  "inspect",
  "sit",
  "panic",
  "sabotage_action",
];
const PRODUCTION_STATES = new Set(["runtime_existing", "candidate", "planned", "blocked"]);
const ART_REVIEWS = new Set(["not_reviewed", "pending_role_fidelity", "approved"]);
const PIPELINE_MANIFEST = "tools/art-pipeline/blender/characters/wp_char_04/manifest.json";
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const sameArray = (left, right) =>
  Array.isArray(left) &&
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

function isInside(parent, child) {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function sha256File(path, cache) {
  if (!cache.has(path)) {
    cache.set(path, createHash("sha256").update(readFileSync(path)).digest("hex"));
  }
  return cache.get(path);
}

function validateKenneyRuntime(asset, id, errors) {
  if (!isRecord(asset)) {
    errors.push(`${id}: runtime character missing`);
    return;
  }
  if (asset.id !== id || asset.directions !== 4) errors.push(`${id}: runtime id/directions`);
  if (asset.animations?.idle?.frames?.length !== 4) errors.push(`${id}: idle must have 4 frames`);
  if (asset.animations?.walk?.frames?.length !== 32) errors.push(`${id}: walk must have 32 frames`);
  if (
    asset.provenance?.sourceId !== "src_kenney_mini_characters" ||
    asset.provenance?.license !== "CC0-1.0"
  ) {
    errors.push(`${id}: runtime provenance must be Kenney CC0`);
  }
}

function validateCharacterFactory(manifest, runtimeManifest, jobsManifest, pipeline, repoRoot) {
  const errors = [];
  if (!isRecord(manifest)) return ["character-factory.json must contain an object"];
  if (manifest.schemaVersion !== 3) errors.push("schemaVersion must be 3");
  if (manifest.directions !== 4) errors.push("directions must be 4");
  if (!sameArray(manifest.runtimeAnimations, RUNTIME_ANIMATIONS)) {
    errors.push("runtimeAnimations must stay idle/walk");
  }
  if (!sameArray(manifest.showcaseAnimations, CANDIDATE_ANIMATIONS)) {
    errors.push("showcaseAnimations must list the seven candidate animations");
  }
  if (!sameArray(manifest.domainSpecialties, DOMAIN_SPECIALTIES)) {
    errors.push("domainSpecialties must contain exactly the four operational specialties");
  }
  for (const animation of [...RUNTIME_ANIMATIONS, ...CANDIDATE_ANIMATIONS]) {
    const expected = RUNTIME_ANIMATIONS.includes(animation) ? "runtime_required" : "candidate";
    if (manifest.animationStates?.[animation] !== expected) {
      errors.push(`animationStates.${animation} must be ${expected}`);
    }
  }
  for (const key of ["quaternius", "rocketbox", "kenney", "winner", "runtimeRule"]) {
    if (!isNonEmptyString(manifest.sourceDecision?.[key])) {
      errors.push(`sourceDecision.${key} is required`);
    }
  }
  for (const state of PRODUCTION_STATES) {
    if (!isNonEmptyString(manifest.productionStateDefinitions?.[state])) {
      errors.push(`productionStateDefinitions.${state} is required`);
    }
  }
  const promotion = manifest.candidatePipeline ?? {};
  if (promotion.manifest !== PIPELINE_MANIFEST) errors.push("candidatePipeline.manifest");
  if (promotion.stage !== "smoke") errors.push("candidatePipeline.stage must remain smoke");
  if (promotion.runtimePromotion !== true)
    errors.push("candidatePipeline.runtimePromotion must be true");
  if (promotion.batchRendered !== true) errors.push("candidatePipeline.batchRendered must be true");
  if (promotion.humanApproval !== "approved")
    errors.push("candidatePipeline.humanApproval must be approved");
  if (promotion.status !== "runtime_promoted_approved_human")
    errors.push("candidatePipeline.status");

  const evidenceKeys = [
    "batchRunRoot",
    "batchExecution",
    "batchFrameValidation",
    "batchValidation",
    "batchSheet",
    "scaleLabManifest",
    "scaleCaptureManifest",
    "runtimePromotionManifest",
  ];
  for (const key of evidenceKeys) {
    if (!isNonEmptyString(promotion[key])) errors.push(`candidatePipeline.${key} is required`);
  }
  const readEvidence = (key) => {
    const path = promotion[key];
    if (!isNonEmptyString(path)) return null;
    const absolute = resolve(repoRoot, path);
    if (!isInside(repoRoot, absolute) || !existsSync(absolute)) {
      errors.push(`candidatePipeline.${key} file missing`);
      return null;
    }
    try {
      return JSON.parse(readFileSync(absolute, "utf8"));
    } catch {
      errors.push(`candidatePipeline.${key} is not valid JSON`);
      return null;
    }
  };
  const execution = readEvidence("batchExecution");
  const frameValidation = readEvidence("batchFrameValidation");
  const validation = readEvidence("batchValidation");
  const sheet = readEvidence("batchSheet");
  const lab = readEvidence("scaleLabManifest");
  const captures = readEvidence("scaleCaptureManifest");
  const runtimePromotion = readEvidence("runtimePromotionManifest");
  if (execution && (execution.renderedFrames !== 504 || execution.failures?.length !== 0)) {
    errors.push("batchExecution must contain 504 failure-free frames");
  }
  if (
    frameValidation &&
    (frameValidation.status !== "passed" || frameValidation.counts?.frames !== 504)
  ) {
    errors.push("batchFrameValidation must pass 504 frames");
  }
  if (
    validation &&
    (validation.status !== "passed" ||
      validation.counts?.frames !== 504 ||
      validation.runtimePromotion !== false)
  ) {
    errors.push("batchValidation must pass 504 technical frames");
  }
  if (sheet && (sheet.frameCount !== 504 || sheet.runtimePromotion !== false)) {
    errors.push("batchSheet must cover 504 technical frames");
  }
  if (lab && lab.frames?.length !== 112) errors.push("scaleLabManifest must contain 112 frames");
  if (captures && (captures.captures?.length !== 16 || captures.pageErrors?.length !== 0)) {
    errors.push("scaleCaptureManifest must contain 16 error-free captures");
  }
  if (
    runtimePromotion &&
    (runtimePromotion.status !== "promoted_approved_human" ||
      runtimePromotion.approvalStatus !== "approved_human" ||
      runtimePromotion.frameCount !== 504 ||
      runtimePromotion.roles?.length !== 14)
  ) {
    errors.push("runtimePromotionManifest must declare 14 approved roles and 504 frames");
  }

  const characters = Array.isArray(manifest.characters) ? manifest.characters : [];
  if (characters.length !== 14)
    errors.push(`expected 14 characters, received ${characters.length}`);
  const ids = characters.map((entry) =>
    isRecord(entry) && typeof entry.id === "string" ? entry.id : "",
  );
  for (const id of Object.keys(EXPECTED_CHARACTERS)) {
    if (!ids.includes(id)) errors.push(`missing ${id}`);
  }
  for (const id of ids) {
    if (id && !EXPECTED_CHARACTERS[id]) errors.push(`unexpected character ${id}`);
  }
  if (new Set(ids).size !== ids.length) errors.push("character ids must be unique");
  const hashCache = new Map();
  const jobs = Array.isArray(jobsManifest?.jobs) ? jobsManifest.jobs : [];
  const promotedRoles = new Set(runtimePromotion?.roles?.map((role) => role.id) ?? []);
  characters.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`characters[${index}] must be an object`);
      return;
    }
    const id = isNonEmptyString(entry.id) ? entry.id : `characters[${index}]`;
    for (const key of [
      "displayName",
      "role",
      "category",
      "scope",
      "priority",
      "baseSource",
      "runtimeSource",
      "runtimeMappingStatus",
      "candidatePipeline",
      "candidateStage",
      "body",
      "hair",
      "clothing",
      "palette",
      "roleProp",
      "productionStatus",
      "artReview",
    ]) {
      if (!isNonEmptyString(entry[key])) errors.push(`${id}: ${key} is required`);
    }
    const expected = EXPECTED_CHARACTERS[entry.id];
    if (!expected) return;
    if (entry.role !== expected.role) errors.push(`${id}: role must be ${expected.role}`);
    if (entry.category !== expected.category)
      errors.push(`${id}: category must be ${expected.category}`);
    if (entry.priority !== expected.priority)
      errors.push(`${id}: priority must be ${expected.priority}`);
    const expectedScope = expected.category === "operational" ? "gameplay" : "ambient";
    if (entry.scope !== expectedScope) errors.push(`${id}: scope must match category`);
    if (expected.category === "operational" && entry.domainSpecialty !== expected.role) {
      errors.push(`${id}: domainSpecialty must be ${expected.role}`);
    }
    if (expected.category !== "operational" && entry.domainSpecialty !== undefined) {
      errors.push(`${id}: domainSpecialty is only valid for operational characters`);
    }
    if (entry.baseSource !== "kenney_mini_characters")
      errors.push(`${id}: baseSource must be Kenney`);
    if (entry.runtimeSource !== "kenney_mini_characters")
      errors.push(`${id}: runtimeSource must be Kenney`);
    if (entry.runtimeMappingStatus !== "kenney")
      errors.push(`${id}: runtimeMappingStatus must be kenney`);
    if (entry.productionStatus !== "runtime_existing")
      errors.push(`${id}: productionStatus must be runtime_existing`);
    if (!PRODUCTION_STATES.has(entry.productionStatus))
      errors.push(`${id}: invalid productionStatus`);
    if (entry.runtimeReady !== true) errors.push(`${id}: runtimeReady must be true`);
    if (!ART_REVIEWS.has(entry.artReview)) errors.push(`${id}: invalid artReview`);
    if (entry.artReview !== "approved") errors.push(`${id}: artReview must be approved`);
    if (entry.runtimeCharacterId !== undefined)
      errors.push(`${id}: runtimeCharacterId must be the canonical id`);
    if (
      entry.legacyRuntimeCharacterId !== undefined &&
      !isNonEmptyString(entry.legacyRuntimeCharacterId)
    ) {
      errors.push(`${id}: legacyRuntimeCharacterId must be non-empty`);
    }
    if (entry.candidatePipeline !== PIPELINE_MANIFEST)
      errors.push(`${id}: candidatePipeline must reference WP-CHAR-04`);
    if (entry.candidateStage !== "smoke") errors.push(`${id}: candidateStage must be smoke`);
    if (
      !Array.isArray(entry.blockers) ||
      entry.blockers.length === 0 ||
      entry.blockers.some((blocker) => !isNonEmptyString(blocker))
    ) {
      errors.push(`${id}: blockers must be non-empty strings`);
    }
    const pipelineCandidate = pipeline.candidates?.[entry.id];
    if (!isRecord(pipelineCandidate)) errors.push(`${id}: missing WP-CHAR-04 candidate`);
    if (!Array.isArray(entry.sourceReferences)) {
      errors.push(`${id}: sourceReferences must be an array`);
      return;
    }
    let hasCandidate = false;
    for (const reference of entry.sourceReferences) {
      if (!isRecord(reference)) {
        errors.push(`${id}: invalid source reference`);
        continue;
      }
      for (const key of ["sourceId", "path", "license", "sha256", "usage"]) {
        if (!isNonEmptyString(reference[key])) errors.push(`${id}: source reference ${key}`);
      }
      if (isAbsolute(reference.path)) errors.push(`${id}: source path must be repo-relative`);
      const file = resolve(repoRoot, reference.path);
      if (!isInside(repoRoot, file) || !existsSync(file)) {
        errors.push(`${id}: source reference file missing: ${reference.path}`);
      } else if (sha256File(file, hashCache) !== reference.sha256) {
        errors.push(`${id}: source reference sha256 mismatch: ${reference.path}`);
      }
      if (reference.usage === "candidate") {
        hasCandidate = true;
        if (
          reference.sourceId !== "src_kenney_mini_characters" ||
          reference.license !== "CC0-1.0" ||
          !pipelineCandidate ||
          reference.path !== pipelineCandidate.sourcePath ||
          reference.sha256 !== pipelineCandidate.sourceSha256
        ) {
          errors.push(`${id}: candidate source reference does not match WP-CHAR-04`);
        }
      } else if (reference.usage === "legacy_runtime") {
        if (reference.license !== "MIT") errors.push(`${id}: legacy reference must be MIT`);
        const job = jobs.find((candidate) => candidate?.source?.path === reference.path);
        if (!job) errors.push(`${id}: legacy source reference has no asset job`);
      } else {
        errors.push(`${id}: source reference usage invalid`);
      }
    }
    if (!hasCandidate) errors.push(`${id}: candidate source reference is required`);
    if (!promotedRoles.has(id)) errors.push(`${id}: missing runtime promotion role`);
    validateKenneyRuntime(runtimeManifest?.characters?.[id], id, errors);
  });
  return errors;
}

function runSelfTests(manifest, runtimeManifest, jobsManifest, pipeline, repoRoot) {
  const character = (candidate, id) => candidate.characters.find((entry) => entry.id === id);
  const cases = [
    [
      "missing medical variant",
      (candidate) => {
        candidate.characters = candidate.characters.filter(
          (entry) => entry.id !== "medical_professional",
        );
      },
      "missing medical_professional",
    ],
    [
      "enforcer scope",
      (candidate) => {
        character(candidate, "enforcer_male").scope = "showcase/future";
      },
      "scope must match category",
    ],
    [
      "worker role",
      (candidate) => {
        character(candidate, "construction_worker_a").role = "construction";
      },
      "role must be construction_worker",
    ],
    [
      "runtime-ready false",
      (candidate) => {
        character(candidate, "supervisor").runtimeReady = false;
      },
      "runtimeReady must be true",
    ],
    [
      "candidate animation promoted",
      (candidate) => {
        candidate.animationStates.work = "runtime_required";
      },
      "animationStates.work",
    ],
    [
      "ambient specialty",
      (candidate) => {
        character(candidate, "police").domainSpecialty = "enforcer";
      },
      "domainSpecialty is only valid",
    ],
    [
      "duplicate character id",
      (candidate) => {
        candidate.characters[1].id = candidate.characters[0].id;
      },
      "character ids must be unique",
    ],
    [
      "legacy source mismatch",
      (candidate) => {
        character(candidate, "construction_worker_a").sourceReferences.find(
          (reference) => reference.usage === "legacy_runtime",
        ).path = "missing.fbx";
      },
      "source reference file missing",
    ],
    [
      "approval revoked",
      (candidate) => {
        character(candidate, "enforcer_male").artReview = "pending_role_fidelity";
      },
      "artReview must be approved",
    ],
    [
      "candidate source replaced",
      (candidate) => {
        character(candidate, "enforcer_female").sourceReferences.find(
          (reference) => reference.usage === "candidate",
        ).sourceId = "src_microsoft_rocketbox";
      },
      "candidate source reference",
    ],
    [
      "runtime source replaced",
      (candidate) => {
        character(candidate, "municipal_professional").runtimeSource = "rocketbox_subset_legacy";
      },
      "runtimeSource must be Kenney",
    ],
    [
      "runtime promotion false",
      (candidate) => {
        candidate.candidatePipeline.runtimePromotion = false;
      },
      "runtimePromotion must be true",
    ],
    [
      "batch evidence omitted",
      (candidate) => {
        delete candidate.candidatePipeline.batchValidation;
      },
      "batchValidation is required",
    ],
  ];
  for (const [name, mutate, fragment] of cases) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    const errors = validateCharacterFactory(
      candidate,
      runtimeManifest,
      jobsManifest,
      pipeline,
      repoRoot,
    );
    if (!errors.some((error) => error.includes(fragment)))
      throw new Error(`self-test missed: ${name}`);
  }
  const corruptedRuntime = structuredClone(runtimeManifest);
  corruptedRuntime.characters.construction_worker_a.animations.walk.frames.pop();
  const runtimeErrors = validateCharacterFactory(
    manifest,
    corruptedRuntime,
    jobsManifest,
    pipeline,
    repoRoot,
  );
  if (!runtimeErrors.some((error) => error.includes("walk must have 32 frames"))) {
    throw new Error("self-test missed: runtime walk matrix");
  }
  return cases.length + 1;
}

try {
  const repoRoot = process.cwd();
  const manifest = JSON.parse(
    readFileSync("blender_artist/manifests/character-factory.json", "utf8"),
  );
  const runtimeManifest = JSON.parse(
    readFileSync("apps/web/src/generated/runtime-assets-blender.json", "utf8"),
  );
  const jobsManifest = JSON.parse(readFileSync("blender_artist/manifests/asset-jobs.json", "utf8"));
  const pipeline = JSON.parse(readFileSync(PIPELINE_MANIFEST, "utf8"));
  const errors = validateCharacterFactory(
    manifest,
    runtimeManifest,
    jobsManifest,
    pipeline,
    repoRoot,
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      "Character Factory PASS: 14/14 Kenney characters runtime-ready and human-approved; 504 frames; legacy Rocketbox fallback retained.",
    );
    if (process.argv.includes("--self-test")) {
      const count = runSelfTests(manifest, runtimeManifest, jobsManifest, pipeline, repoRoot);
      console.log(
        `Character Factory self-test PASS: ${count}/${count} invalid declarations rejected.`,
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

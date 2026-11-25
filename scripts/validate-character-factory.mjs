#!/usr/bin/env node
/* global structuredClone */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPECTED_CHARACTERS = {
  civilian_male_a: {
    role: "civilian",
    category: "ambient",
    priority: "P1",
    runtimeCharacterId: "chr_citizen",
  },
  civilian_male_b: { role: "civilian", category: "ambient", priority: "P1" },
  civilian_female_a: { role: "civilian", category: "ambient", priority: "P1" },
  civilian_female_b: { role: "civilian", category: "ambient", priority: "P1" },
  supervisor: { role: "supervisor", category: "operational", priority: "P0" },
  construction_worker_a: {
    role: "construction_worker",
    category: "operational",
    priority: "P0",
    runtimeCharacterId: "chr_worker",
  },
  construction_worker_b: { role: "construction_worker", category: "operational", priority: "P0" },
  maintenance_technician: {
    role: "maintenance_technician",
    category: "operational",
    priority: "P0",
  },
  enforcer_male: { role: "enforcer", category: "operational", priority: "P0" },
  enforcer_female: { role: "enforcer", category: "operational", priority: "P0" },
  police: { role: "police", category: "ambient", priority: "P1", runtimeCharacterId: "chr_police" },
  firefighter: {
    role: "firefighter",
    category: "ambient",
    priority: "P1",
    runtimeCharacterId: "chr_firefighter",
  },
  medical_professional: {
    role: "medical_professional",
    category: "ambient",
    priority: "P1",
    runtimeCharacterId: "chr_medical",
  },
  municipal_professional: { role: "municipal_professional", category: "ambient", priority: "P2" },
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
const BASE_SOURCES = new Set(["kenney_mini_characters"]);
const RUNTIME_SOURCES = new Set(["none", "rocketbox_subset_legacy"]);
const SOURCE_USAGES = new Set(["candidate", "legacy_runtime"]);
const REQUIRED_STRINGS = [
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
];
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
  if (!cache.has(path))
    cache.set(path, createHash("sha256").update(readFileSync(path)).digest("hex"));
  return cache.get(path);
}

function validateRuntimeReference(entry, asset, job, repoRoot, errors, hashCache) {
  const runtimeId = entry.runtimeCharacterId;
  if (!isRecord(asset)) {
    errors.push(`${entry.id}: runtime character ${runtimeId} is missing from the runtime manifest`);
    return;
  }
  if (!isRecord(job)) {
    errors.push(`${entry.id}: runtime character ${runtimeId} has no character asset job`);
    return;
  }
  if (job.kind !== "character" || job.target !== "bundle" || job.assetId !== runtimeId) {
    errors.push(`${entry.id}: asset job does not publish ${runtimeId} as a bundle character`);
  }
  if (asset.directions !== 4) errors.push(`${runtimeId}: runtime directions must be 4`);
  if (
    asset.provenance?.sourceId !== "src_microsoft_rocketbox" ||
    asset.provenance?.license !== "MIT"
  ) {
    errors.push(`${runtimeId}: runtime provenance must be Rocketbox MIT`);
  }
  const primaryReference = entry.sourceReferences.find(
    (reference) =>
      isRecord(reference) &&
      reference.usage === "legacy_runtime" &&
      reference.sourceId === job.source?.sourceId &&
      reference.path === job.source?.path,
  );
  if (!primaryReference) {
    errors.push(`${entry.id}: source reference does not match asset job`);
  }
  for (const animation of RUNTIME_ANIMATIONS) {
    if (!isNonEmptyString(job.animationSources?.[animation])) {
      errors.push(`${runtimeId}: asset job is missing ${animation} animation source`);
    }
    const clip = asset.animations?.[animation];
    if (!isRecord(clip) || !Array.isArray(clip.frames)) {
      errors.push(`${runtimeId}: runtime animation ${animation} is missing`);
      continue;
    }
    if (clip.frames.length < 4 || clip.frames.length % 4 !== 0) {
      errors.push(`${runtimeId}/${animation}: frame matrix must cover four directions evenly`);
      continue;
    }
    clip.frames.forEach((frame, index) => {
      if (!isNonEmptyString(frame?.src) || !isNonEmptyString(frame?.sha256)) {
        errors.push(`${runtimeId}/${animation}/frame ${index}: src and sha256 are required`);
        return;
      }
      if (!frame.src.startsWith("/assets/")) {
        errors.push(`${runtimeId}/${animation}/frame ${index}: src must be public-root relative`);
        return;
      }
      const file = resolve(repoRoot, "apps/web/public", frame.src.slice(1));
      if (!isInside(resolve(repoRoot, "apps/web/public"), file) || !existsSync(file)) {
        errors.push(`${runtimeId}/${animation}/frame ${index}: runtime file is missing`);
        return;
      }
      if (sha256File(file, hashCache) !== frame.sha256) {
        errors.push(`${runtimeId}/${animation}/frame ${index}: sha256 mismatch`);
      }
    });
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
  if (manifest.candidatePipeline?.manifest !== PIPELINE_MANIFEST) {
    errors.push(`candidatePipeline.manifest must be ${PIPELINE_MANIFEST}`);
  }
  if (manifest.candidatePipeline?.stage !== "smoke") {
    errors.push("candidatePipeline.stage must be smoke");
  }
  if (manifest.candidatePipeline?.runtimePromotion !== false) {
    errors.push("candidatePipeline.runtimePromotion must be false");
  }
  if (manifest.candidatePipeline?.batchRendered !== false) {
    errors.push("candidatePipeline.batchRendered must be false");
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

  const runtimeIds = new Set();
  const hashCache = new Map();
  const jobs = Array.isArray(jobsManifest?.jobs) ? jobsManifest.jobs : [];
  characters.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`characters[${index}] must be an object`);
      return;
    }
    const id = isNonEmptyString(entry.id) ? entry.id : `characters[${index}]`;
    for (const key of REQUIRED_STRINGS) {
      if (!isNonEmptyString(entry[key])) errors.push(`${id}: ${key} is required`);
    }
    const expected = EXPECTED_CHARACTERS[entry.id];
    if (!expected) return;
    if (entry.role !== expected.role) errors.push(`${id}: role must be ${expected.role}`);
    if (entry.category !== expected.category) {
      errors.push(`${id}: category must be ${expected.category}`);
    }
    if (entry.priority !== expected.priority)
      errors.push(`${id}: priority must be ${expected.priority}`);
    const expectedScope = expected.category === "operational" ? "gameplay" : "ambient";
    if (entry.scope !== expectedScope) errors.push(`${id}: scope must match category`);
    if (expected.category === "operational") {
      if (entry.domainSpecialty !== expected.role) {
        errors.push(`${id}: domainSpecialty must be ${expected.role}`);
      }
    } else if (entry.domainSpecialty !== undefined) {
      errors.push(`${id}: domainSpecialty is only valid for operational characters`);
    }

    const legacy = Boolean(expected.runtimeCharacterId);
    if (!BASE_SOURCES.has(entry.baseSource)) errors.push(`${id}: unsupported baseSource`);
    if (entry.baseSource !== "kenney_mini_characters") {
      errors.push(`${id}: baseSource must be kenney_mini_characters`);
    }
    if (!RUNTIME_SOURCES.has(entry.runtimeSource)) errors.push(`${id}: unsupported runtimeSource`);
    if (entry.runtimeSource !== (legacy ? "rocketbox_subset_legacy" : "none")) {
      errors.push(`${id}: runtimeSource must match legacy mapping policy`);
    }
    if (entry.runtimeMappingStatus !== (legacy ? "legacy" : "none")) {
      errors.push(`${id}: runtimeMappingStatus must be ${legacy ? "legacy" : "none"}`);
    }
    if (entry.productionStatus !== "candidate") {
      errors.push(`${id}: productionStatus must be candidate`);
    }
    if (!PRODUCTION_STATES.has(entry.productionStatus))
      errors.push(`${id}: invalid productionStatus`);
    if (entry.runtimeReady !== false) errors.push(`${id}: runtimeReady must be false`);
    if (typeof entry.runtimeReady !== "boolean") errors.push(`${id}: runtimeReady must be boolean`);
    if (!ART_REVIEWS.has(entry.artReview)) errors.push(`${id}: invalid artReview`);
    if (entry.artReview !== "pending_role_fidelity") {
      errors.push(`${id}: artReview must remain pending_role_fidelity`);
    }
    if (entry.artReview === "approved" && entry.productionStatus !== "runtime_existing") {
      errors.push(`${id}: candidates and planned characters cannot be approved`);
    }
    if (entry.candidatePipeline !== PIPELINE_MANIFEST) {
      errors.push(`${id}: candidatePipeline must reference WP-CHAR-04`);
    }
    if (entry.candidateStage !== "smoke") errors.push(`${id}: candidateStage must be smoke`);
    if (legacy) {
      if (entry.runtimeCharacterId !== expected.runtimeCharacterId) {
        errors.push(`${id}: runtimeCharacterId must be ${expected.runtimeCharacterId}`);
      }
      if (!isNonEmptyString(entry.legacyRuntimeNote)) {
        errors.push(`${id}: legacyRuntimeNote is required`);
      }
    } else if (entry.runtimeCharacterId !== undefined) {
      errors.push(`${id}: runtimeCharacterId is only valid for explicit legacy mappings`);
    }
    if (
      !Array.isArray(entry.blockers) ||
      entry.blockers.some((blocker) => !isNonEmptyString(blocker))
    ) {
      errors.push(`${id}: blockers must be an array of non-empty strings`);
    } else if (entry.blockers.length === 0) {
      errors.push(`${id}: candidate must declare a blocker`);
    }

    const pipelineCandidate = pipeline.candidates?.[entry.id];
    if (!isRecord(pipelineCandidate)) {
      errors.push(`${id}: missing WP-CHAR-04 candidate`);
    }
    if (!Array.isArray(entry.sourceReferences)) {
      errors.push(`${id}: sourceReferences must be an array`);
      return;
    }
    const expectedReferenceCount = legacy ? 2 : 1;
    if (entry.sourceReferences.length !== expectedReferenceCount) {
      errors.push(`${id}: sourceReferences must contain ${expectedReferenceCount} entries`);
    }
    const paths = new Set();
    const usages = new Set();
    entry.sourceReferences.forEach((reference, referenceIndex) => {
      if (!isRecord(reference)) {
        errors.push(`${id}: sourceReferences[${referenceIndex}] must be an object`);
        return;
      }
      for (const key of ["sourceId", "path", "license", "sha256", "usage"]) {
        if (!isNonEmptyString(reference[key])) {
          errors.push(`${id}: sourceReferences[${referenceIndex}].${key} is required`);
        }
      }
      if (!SOURCE_USAGES.has(reference.usage)) {
        errors.push(`${id}: sourceReferences[${referenceIndex}].usage is invalid`);
      }
      usages.add(reference.usage);
      if (isAbsolute(reference.path)) errors.push(`${id}: source path must be repo-relative`);
      if (paths.has(reference.path))
        errors.push(`${id}: duplicate source reference ${reference.path}`);
      paths.add(reference.path);
      const file = resolve(repoRoot, reference.path);
      if (!isInside(repoRoot, file) || !existsSync(file)) {
        errors.push(`${id}: source reference file missing: ${reference.path}`);
      } else if (sha256File(file, hashCache) !== reference.sha256) {
        errors.push(`${id}: source reference sha256 mismatch: ${reference.path}`);
      }
      if (reference.usage === "candidate") {
        if (
          reference.sourceId !== "src_kenney_mini_characters" ||
          reference.license !== "CC0-1.0" ||
          !pipelineCandidate ||
          reference.path !== pipelineCandidate.sourcePath ||
          reference.sha256 !== pipelineCandidate.sourceSha256
        ) {
          errors.push(`${id}: candidate source reference does not match WP-CHAR-04`);
        }
      } else if (reference.usage === "legacy_runtime" && reference.license !== "MIT") {
        errors.push(`${id}: Rocketbox legacy references must use MIT`);
      }
    });
    if (!usages.has("candidate")) errors.push(`${id}: candidate source reference is required`);
    if (legacy && !usages.has("legacy_runtime")) {
      errors.push(`${id}: legacy_runtime source reference is required`);
    }
    if (!legacy && usages.has("legacy_runtime")) {
      errors.push(`${id}: legacy_runtime reference is only valid for mapped runtime characters`);
    }
    if (legacy && isNonEmptyString(entry.runtimeCharacterId)) {
      if (runtimeIds.has(entry.runtimeCharacterId)) {
        errors.push(`duplicate runtimeCharacterId ${entry.runtimeCharacterId}`);
      }
      runtimeIds.add(entry.runtimeCharacterId);
      const asset = runtimeManifest?.characters?.[entry.runtimeCharacterId];
      const job = jobs.find((candidate) => candidate?.assetId === entry.runtimeCharacterId);
      validateRuntimeReference(entry, asset, job, repoRoot, errors, hashCache);
    }
  });
  return errors;
}

function runSelfTests(manifest, runtimeManifest, jobsManifest, pipeline, repoRoot) {
  const character = (candidate, id) => candidate.characters.find((entry) => entry.id === id);
  const cases = [
    {
      name: "missing canonical medical variant",
      mutate: (candidate) => {
        candidate.characters = candidate.characters.filter(
          (entry) => entry.id !== "medical_professional",
        );
      },
      fragment: "missing medical_professional",
    },
    {
      name: "enforcer classified as future",
      mutate: (candidate) => {
        character(candidate, "enforcer_male").scope = "showcase/future";
      },
      fragment: "enforcer_male: scope must match category",
    },
    {
      name: "worker role diverges from domain",
      mutate: (candidate) => {
        character(candidate, "construction_worker_a").role = "construction";
      },
      fragment: "construction_worker_a: role must be construction_worker",
    },
    {
      name: "false runtime-ready declaration",
      mutate: (candidate) => {
        character(candidate, "supervisor").runtimeReady = true;
      },
      fragment: "supervisor: runtimeReady must be false",
    },
    {
      name: "candidate animation promoted to runtime",
      mutate: (candidate) => {
        candidate.animationStates.work = "runtime_required";
      },
      fragment: "animationStates.work must be candidate",
    },
    {
      name: "ambient role given a domain specialty",
      mutate: (candidate) => {
        character(candidate, "police").domainSpecialty = "enforcer";
      },
      fragment: "police: domainSpecialty is only valid for operational characters",
    },
    {
      name: "duplicate runtime appearance",
      mutate: (candidate) => {
        character(candidate, "construction_worker_a").runtimeCharacterId = "chr_citizen";
      },
      fragment: "duplicate runtimeCharacterId chr_citizen",
    },
    {
      name: "legacy source reference diverges from asset job",
      mutate: (candidate) => {
        character(candidate, "construction_worker_a").sourceReferences.find(
          (reference) => reference.usage === "legacy_runtime",
        ).path =
          "blender_artist/staging/third_party/mit/rocketbox/avatars/Male_Adult_02/Export/Male_Adult_02.fbx";
      },
      fragment: "construction_worker_a: source reference does not match asset job",
    },
    {
      name: "candidate marked approved",
      mutate: (candidate) => {
        character(candidate, "enforcer_male").artReview = "approved";
      },
      fragment: "enforcer_male: artReview must remain pending_role_fidelity",
    },
    {
      name: "Kenney candidate reference replaced",
      mutate: (candidate) => {
        character(candidate, "enforcer_female").sourceReferences.find(
          (reference) => reference.usage === "candidate",
        ).sourceId = "src_microsoft_rocketbox";
      },
      fragment: "enforcer_female: candidate source reference does not match WP-CHAR-04",
    },
    {
      name: "candidate source hash mismatch",
      mutate: (candidate) => {
        character(candidate, "enforcer_female").sourceReferences.find(
          (reference) => reference.usage === "candidate",
        ).sha256 = "0".repeat(64);
      },
      fragment: "enforcer_female: source reference sha256 mismatch",
    },
    {
      name: "nonlegacy role declares legacy runtime source",
      mutate: (candidate) => {
        character(candidate, "municipal_professional").runtimeSource = "rocketbox_subset_legacy";
      },
      fragment: "municipal_professional: runtimeSource must match legacy mapping policy",
    },
  ];
  for (const testCase of cases) {
    const candidate = structuredClone(manifest);
    testCase.mutate(candidate);
    const errors = validateCharacterFactory(
      candidate,
      runtimeManifest,
      jobsManifest,
      pipeline,
      repoRoot,
    );
    if (!errors.some((error) => error.includes(testCase.fragment))) {
      throw new Error(`self-test missed: ${testCase.name}`);
    }
  }
  const corruptedRuntime = structuredClone(runtimeManifest);
  corruptedRuntime.characters.chr_worker.animations.idle.frames[0].sha256 = "0".repeat(64);
  const hashErrors = validateCharacterFactory(
    manifest,
    corruptedRuntime,
    jobsManifest,
    pipeline,
    repoRoot,
  );
  if (!hashErrors.some((error) => error.includes("chr_worker/idle/frame 0: sha256 mismatch"))) {
    throw new Error("self-test missed: runtime frame hash mismatch");
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
    const legacyCount = manifest.characters.filter(
      (entry) => entry.runtimeMappingStatus === "legacy",
    ).length;
    const runtimeReadyCount = manifest.characters.filter((entry) => entry.runtimeReady).length;
    console.log(
      `Character Factory PASS: ${manifest.characters.length}/14 Kenney candidates; ${legacyCount} explicit legacy Rocketbox mappings; ${runtimeReadyCount} runtime-ready; 4 directions; idle/walk runtime; ${manifest.showcaseAnimations.length} candidate animations.`,
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

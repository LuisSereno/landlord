#!/usr/bin/env node
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
const BASE_SOURCES = new Set(["quaternius_universal_base", "rocketbox_subset"]);
const REQUIRED_STRINGS = [
  "displayName",
  "role",
  "category",
  "scope",
  "priority",
  "baseSource",
  "runtimeSource",
  "body",
  "hair",
  "clothing",
  "palette",
  "roleProp",
  "productionStatus",
  "artReview",
];

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

function validateCharacterFactory(manifest, runtimeManifest, jobsManifest, repoRoot) {
  const errors = [];
  if (!isRecord(manifest)) return ["character-factory.json must contain an object"];
  if (manifest.schemaVersion !== 2) errors.push("schemaVersion must be 2");
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
    if (expected) {
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
      if (expected.runtimeCharacterId) {
        if (entry.runtimeReady !== true) errors.push(`${id}: runtimeReady must be true`);
        if (entry.runtimeCharacterId !== expected.runtimeCharacterId) {
          errors.push(`${id}: runtimeCharacterId must be ${expected.runtimeCharacterId}`);
        }
      } else if (entry.runtimeReady !== false) {
        errors.push(`${id}: runtimeReady must be false without a canonical runtime mapping`);
      }
    }
    if (!BASE_SOURCES.has(entry.baseSource)) errors.push(`${id}: unsupported baseSource`);
    if (entry.runtimeSource !== "rocketbox_subset") {
      errors.push(`${id}: runtimeSource must be rocketbox_subset`);
    }
    if (!PRODUCTION_STATES.has(entry.productionStatus))
      errors.push(`${id}: invalid productionStatus`);
    if (!ART_REVIEWS.has(entry.artReview)) errors.push(`${id}: invalid artReview`);
    if (typeof entry.runtimeReady !== "boolean") errors.push(`${id}: runtimeReady must be boolean`);
    if (entry.runtimeReady && entry.baseSource !== "rocketbox_subset") {
      errors.push(`${id}: runtime-existing characters must use the Rocketbox base`);
    }
    if (entry.productionStatus === "runtime_existing" && !entry.runtimeReady) {
      errors.push(`${id}: runtime_existing requires runtimeReady`);
    }
    if (entry.productionStatus !== "runtime_existing" && entry.runtimeReady) {
      errors.push(`${id}: only runtime_existing may be runtimeReady`);
    }
    if (entry.artReview === "approved" && entry.productionStatus !== "runtime_existing") {
      errors.push(`${id}: candidates and planned characters cannot be approved`);
    }
    if (
      !Array.isArray(entry.blockers) ||
      entry.blockers.some((blocker) => !isNonEmptyString(blocker))
    ) {
      errors.push(`${id}: blockers must be an array of non-empty strings`);
    } else if (entry.productionStatus !== "runtime_existing" && entry.blockers.length === 0) {
      errors.push(`${id}: non-runtime characters must declare a blocker`);
    }
    if (!Array.isArray(entry.sourceReferences)) {
      errors.push(`${id}: sourceReferences must be an array`);
    } else {
      if (entry.runtimeReady && entry.sourceReferences.length === 0) {
        errors.push(`${id}: runtime-existing characters require sourceReferences`);
      }
      const paths = new Set();
      entry.sourceReferences.forEach((reference, referenceIndex) => {
        if (!isRecord(reference)) {
          errors.push(`${id}: sourceReferences[${referenceIndex}] must be an object`);
          return;
        }
        for (const key of ["sourceId", "path", "license"]) {
          if (!isNonEmptyString(reference[key])) {
            errors.push(`${id}: sourceReferences[${referenceIndex}].${key} is required`);
          }
        }
        if (isAbsolute(reference.path)) errors.push(`${id}: source path must be repo-relative`);
        if (paths.has(reference.path))
          errors.push(`${id}: duplicate source reference ${reference.path}`);
        paths.add(reference.path);
        if (entry.runtimeReady && reference.license !== "MIT") {
          errors.push(`${id}: Rocketbox runtime references must use MIT`);
        }
      });
    }
    if (entry.runtimeReady && isNonEmptyString(entry.runtimeCharacterId)) {
      if (runtimeIds.has(entry.runtimeCharacterId)) {
        errors.push(`duplicate runtimeCharacterId ${entry.runtimeCharacterId}`);
      }
      runtimeIds.add(entry.runtimeCharacterId);
      const asset = runtimeManifest?.characters?.[entry.runtimeCharacterId];
      const job = jobs.find((candidate) => candidate?.assetId === entry.runtimeCharacterId);
      validateRuntimeReference(entry, asset, job, repoRoot, errors, hashCache);
    } else if (entry.runtimeCharacterId !== undefined) {
      errors.push(`${id}: runtimeCharacterId is only valid for runtime-existing characters`);
    }
  });
  return errors;
}

function runSelfTests(manifest, runtimeManifest, jobsManifest, repoRoot) {
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
        Object.assign(character(candidate, "supervisor"), {
          productionStatus: "runtime_existing",
          runtimeReady: true,
          runtimeCharacterId: "chr_worker",
        });
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
      name: "source reference diverges from asset job",
      mutate: (candidate) => {
        character(candidate, "construction_worker_a").sourceReferences[0].path =
          "blender_artist/staging/third_party/mit/rocketbox/avatars/Male_Adult_02/Export/Male_Adult_02.fbx";
      },
      fragment: "construction_worker_a: source reference does not match asset job",
    },
    {
      name: "candidate marked approved",
      mutate: (candidate) => {
        character(candidate, "enforcer_male").artReview = "approved";
      },
      fragment: "enforcer_male: candidates and planned characters cannot be approved",
    },
  ];
  for (const testCase of cases) {
    const candidate = structuredClone(manifest);
    testCase.mutate(candidate);
    const errors = validateCharacterFactory(candidate, runtimeManifest, jobsManifest, repoRoot);
    if (!errors.some((error) => error.includes(testCase.fragment))) {
      throw new Error(`self-test missed: ${testCase.name}`);
    }
  }
  const corruptedRuntime = structuredClone(runtimeManifest);
  corruptedRuntime.characters.chr_worker.animations.idle.frames[0].sha256 = "0".repeat(64);
  const hashErrors = validateCharacterFactory(manifest, corruptedRuntime, jobsManifest, repoRoot);
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
  const errors = validateCharacterFactory(manifest, runtimeManifest, jobsManifest, repoRoot);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    const runtimeCount = manifest.characters.filter((entry) => entry.runtimeReady).length;
    console.log(
      `Character Factory PASS: ${manifest.characters.length}/14 variants; ${runtimeCount} runtime-existing; 4 directions; idle/walk runtime; ${manifest.showcaseAnimations.length} candidate animations.`,
    );
    if (process.argv.includes("--self-test")) {
      const count = runSelfTests(manifest, runtimeManifest, jobsManifest, repoRoot);
      console.log(
        `Character Factory self-test PASS: ${count}/${count} invalid declarations rejected.`,
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

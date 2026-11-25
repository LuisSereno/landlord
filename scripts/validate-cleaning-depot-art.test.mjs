import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { validateCleaningDepotArt } from "./validate-cleaning-depot-art.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEPOT = join(ROOT, "docs/art/cleaning-depot");
const read = (name) => JSON.parse(readFileSync(join(DEPOT, name), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

function validate(overrides = {}) {
  return validateCleaningDepotArt({
    root: ROOT,
    matrix: read("candidate-matrix.json"),
    catalog: read("candidate-catalog.json"),
    jobs: read("candidate-jobs.json"),
    promotionPlan: read("promotion-plan.json"),
    ...overrides,
  });
}

test("cleaning depot candidate package passes without runtime promotion", () => {
  const result = validate();
  assert.equal(result.status, "valid", result.errors.join("\n"));
  assert.equal(result.matrix.totalAssets, 48);
  assert.deepEqual(result.matrix.summary.byMood, { day_civic: 24, night_civic: 24 });
});

test("matrix rejects a missing state/orientation/mood cell", () => {
  const matrix = read("candidate-matrix.json");
  matrix.assets.pop();
  matrix.totalAssets = matrix.assets.length;
  const result = validate({ matrix });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("matriz: se esperaban 48")));
});

test("matrix rejects duplicate keys", () => {
  const matrix = read("candidate-matrix.json");
  matrix.assets[1].key = matrix.assets[0].key;
  const result = validate({ matrix });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("clave duplicada")));
});

test("asset hash divergence is rejected", () => {
  const matrix = read("candidate-matrix.json");
  matrix.assets[0].pngSha256 = "0".repeat(64);
  const result = validate({ matrix });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("sha")));
});

test("metadata hash divergence is rejected", () => {
  const matrix = read("candidate-matrix.json");
  matrix.assets[0].metadataSha256 = "0".repeat(64);
  const result = validate({ matrix });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("sha metadata")));
});

test("human approval cannot be predeclared by the candidate package", () => {
  const promotionPlan = clone(read("promotion-plan.json"));
  promotionPlan.approvalStatus = "human_approved";
  const result = validate({ promotionPlan });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("aprobación humana")));
});

test("any generated runtime manifest change fails the protected-runtime gate", () => {
  const promotionPlan = clone(read("promotion-plan.json"));
  promotionPlan.protectedRuntime["apps/web/src/generated/runtime-building-variants.json"] =
    "0".repeat(64);
  const result = validate({ promotionPlan });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("runtime protegido cambió")));
});

test("jobs must retain the exact six state tokens and four orientations", () => {
  const jobs = clone(read("candidate-jobs.json"));
  jobs.jobs[0].states = ["complete"];
  const result = validate({ jobs });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.some((error) => error.includes("contrato incorrecto")));
});

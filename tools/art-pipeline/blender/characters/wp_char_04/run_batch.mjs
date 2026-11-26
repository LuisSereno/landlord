#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../../..");
const toolRoot = resolve(repoRoot, "tools/art-pipeline/blender/characters/wp_char_04");
const defaultManifest = resolve(toolRoot, "manifest.json");
const defaultOutput = resolve(repoRoot, "docs/art/characters/candidates/wp-char-04/batch");
const directions = [0, 1, 2, 3];
const walkSamples = [0, 1, 2, 3, 4, 5, 6, 7];
const walkActionFrames = [0, 2, 4, 6, 8, 10, 12, 14];

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function repositoryPath(path) {
  return resolve(repoRoot, path);
}

function validateContract(config) {
  const contract = config.matrix?.batchContract;
  const expected = {
    roles: 14,
    directions,
    idleSamples: [0],
    walkDirections: directions,
    walkSamples,
    walkActionFrames,
    framesPerRole: 36,
    totalFrames: 504,
    requiresHumanApproval: true,
  };
  if (!contract) throw new Error("Missing batchContract");
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(contract[key]) !== JSON.stringify(value)) {
      throw new Error(`Unexpected batchContract.${key}: ${JSON.stringify(contract[key])}`);
    }
  }
  if (config.runtimePromotion !== false || config.humanApprovalClaimed !== false) {
    throw new Error("Batch rendering cannot promote or claim human approval");
  }
  if (Object.keys(config.candidates ?? {}).length !== 14) {
    throw new Error("WP-CHAR-04 requires exactly 14 candidates");
  }
}

function expectedFrameNames(role) {
  const names = [];
  for (const direction of directions) {
    names.push(`${role}-d${direction}-idle-00.png`);
    for (const sample of walkSamples) {
      names.push(`${role}-d${direction}-walk-${String(sample).padStart(2, "0")}.png`);
    }
  }
  return names;
}

const manifestPath = resolve(argument("--manifest", defaultManifest));
const outputRoot = resolve(argument("--output-root", defaultOutput));
const runId = argument("--run-id", new Date().toISOString().replace(/[:.]/g, "-"));
const config = JSON.parse(readFileSync(manifestPath, "utf8"));
const blender = argument("--blender", config.toolchain.blenderPath);
const expectedBranch = argument("--expected-branch", config.branch);
const runRoot = resolve(outputRoot, runId);
const runStart = new Date();
const runStartMs = runStart.getTime();
const failures = [];
validateContract(config);
if (existsSync(runRoot)) throw new Error(`Run directory already exists: ${runRoot}`);
if (!existsSync(blender)) throw new Error(`Blender binary is missing: ${blender}`);

const branchResult = spawnSync("git", ["branch", "--show-current"], {
  cwd: repoRoot,
  encoding: "utf8",
});
const branch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
if (branch !== expectedBranch) {
  throw new Error(`Expected branch ${expectedBranch}, found ${branch ?? "unknown"}`);
}
const versionResult = spawnSync(blender, ["--version"], { cwd: repoRoot, encoding: "utf8" });
const versionText = `${versionResult.stdout}\n${versionResult.stderr}`;
if (
  versionResult.status !== 0 ||
  !versionText.includes(config.toolchain.blenderVersion) ||
  !versionText.includes(config.toolchain.blenderBuildHash)
) {
  throw new Error("Blender version/build does not match the manifest");
}

mkdirSync(resolve(runRoot, "logs"), { recursive: true });
const dependencyPaths = {
  manifest: manifestPath,
  batchRenderer: resolve(toolRoot, "render_batch.py"),
  smokeRenderer: repositoryPath(config.dependencies.renderer),
  batchRunner: resolve(toolRoot, "run_batch.mjs"),
  batchValidator: resolve(toolRoot, "validate_batch.py"),
  finalSheetComposer: resolve(toolRoot, "compose_final_sheet.py"),
  sheetHelpers: repositoryPath(
    "tools/art-pipeline/blender/characters/wp_char_02a/compose_worker_review_sheets.py",
  ),
  animationCommon: repositoryPath(config.dependencies.shared.animationCommon),
  workerRenderer: repositoryPath(config.dependencies.shared.workerRenderer),
  prototypeHelpers: repositoryPath(config.dependencies.shared.prototypeHelpers),
  compositor: repositoryPath(config.dependencies.shared.compositor),
  runtimeAsset: repositoryPath(config.dependencies.shared.runtimeAsset),
  sourceImport: repositoryPath(config.dependencies.shared.sourceImport),
  styleLayer: repositoryPath(config.dependencies.shared.styleLayer),
};
for (const path of Object.values(dependencyPaths)) {
  if (!existsSync(path)) throw new Error(`Batch dependency is missing: ${path}`);
}
const dependencies = Object.fromEntries(
  Object.entries(dependencyPaths).map(([name, path]) => [
    name,
    {
      path: resolve(path),
      repositoryPath: resolve(path).slice(repoRoot.length + 1),
      sha256: sha256(path),
    },
  ]),
);
const licensePath = repositoryPath(config.sourcePolicy.licenseFile);
if (sha256(licensePath) !== config.sourcePolicy.licenseFileSha256) {
  throw new Error("Kenney license hash does not match the manifest");
}
for (const [role, candidate] of Object.entries(config.candidates)) {
  const sourcePath = repositoryPath(candidate.sourcePath);
  if (!existsSync(sourcePath) || sha256(sourcePath) !== candidate.sourceSha256) {
    throw new Error(`${role}: source GLB missing or hash mismatch`);
  }
}

const roleResults = [];
for (const [role, candidate] of Object.entries(config.candidates)) {
  const roleOutput = resolve(runRoot, "roles", role);
  const logPath = resolve(runRoot, "logs", `${role}.log`);
  const args = [
    "--background",
    "--factory-startup",
    "--python-exit-code",
    "1",
    "--python",
    dependencyPaths.batchRenderer,
    "--",
    "--manifest",
    manifestPath,
    "--source-root",
    repoRoot,
    "--output",
    roleOutput,
    "--runtime-asset",
    dependencyPaths.runtimeAsset,
    "--role",
    role,
    "--run-id",
    runId,
  ];
  const startedAt = new Date().toISOString();
  const result = spawnSync(blender, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 900000,
  });
  const finishedAt = new Date().toISOString();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;
  const tracebackDetected =
    /Traceback \(most recent call last\)|Error: Python|script failed, file:/i.test(combined);
  const sentinel = `WP_CHAR_04_BATCH_OK ${role} ${runId}`;
  const sentinelDetected = combined.includes(sentinel);
  const expectedImages = expectedFrameNames(role).map((name) => resolve(roleOutput, name));
  const reportPath = resolve(roleOutput, `${role}-batch.json`);
  const expectedSidecars = expectedImages.map((path) =>
    resolve(path.slice(0, -4) + ".composition.json"),
  );
  const expectedPaths = [...expectedImages, ...expectedSidecars, reportPath];
  const missingOutputs = expectedPaths.filter((path) => !existsSync(path));
  const staleOutputs = expectedPaths
    .filter((path) => existsSync(path))
    .filter((path) => statSync(path).mtimeMs < runStartMs - 1)
    .map((path) => path.slice(repoRoot.length + 1));
  const undeclaredPngs = existsSync(roleOutput)
    ? readdirSync(roleOutput)
        .filter((name) => name.endsWith(".png"))
        .filter((name) => !expectedImages.some((path) => path.endsWith(name)))
    : [];
  const rolePassed =
    result.status === 0 &&
    !result.error &&
    !tracebackDetected &&
    sentinelDetected &&
    missingOutputs.length === 0 &&
    staleOutputs.length === 0 &&
    undeclaredPngs.length === 0;
  const outputHashes = Object.fromEntries(
    expectedImages
      .filter((path) => existsSync(path))
      .map((path) => [path.slice(repoRoot.length + 1), sha256(path)]),
  );
  const logHeader = `$ ${[blender, ...args].join(" ")}\nrunId=${runId}\nstartedAt=${startedAt}\n`;
  writeFileSync(logPath, `${logHeader}${combined}`, "utf8");
  const entry = {
    role,
    canonicalId: candidate.canonicalId,
    command: [blender, ...args],
    startedAt,
    finishedAt,
    exitCode: result.status,
    signal: result.signal,
    spawnError: result.error?.message ?? null,
    pythonExitCodeFlag: 1,
    sentinelExpected: sentinel,
    sentinelDetected,
    tracebackDetected,
    freshOutputRoot: true,
    staleOutputs,
    missingOutputs: missingOutputs.map((path) => path.slice(repoRoot.length + 1)),
    undeclaredPngs,
    outputHashes,
    log: {
      path: logPath.slice(repoRoot.length + 1),
      sha256: sha256(logPath),
    },
    passed: rolePassed,
  };
  roleResults.push(entry);
  if (!rolePassed) {
    failures.push({
      role,
      exitCode: result.status,
      tracebackDetected,
      sentinelDetected,
      missingOutputs: entry.missingOutputs,
      staleOutputs,
      undeclaredPngs,
      spawnError: entry.spawnError,
    });
  }
}

const renderedFrames = roleResults.reduce(
  (total, entry) => total + Object.keys(entry.outputHashes).length,
  0,
);
const execution = {
  schemaVersion: 1,
  stage: "batch",
  runId,
  runRoot: runRoot.slice(repoRoot.length + 1),
  startedAt: runStart.toISOString(),
  finishedAt: new Date().toISOString(),
  branch,
  expectedBranch,
  blender: {
    path: blender,
    version: config.toolchain.blenderVersion,
    buildHash: config.toolchain.blenderBuildHash,
    pythonExitCodeFlag: 1,
  },
  manifest: {
    path: manifestPath.slice(repoRoot.length + 1),
    sha256: sha256(manifestPath),
  },
  dependencies,
  sourcePolicy: config.sourcePolicy,
  matrix: config.matrix.batchContract,
  roleCount: roleResults.length,
  renderedRoleCount: roleResults.filter((entry) => entry.passed).length,
  renderedFrames,
  expectedFrames: config.matrix.batchContract.totalFrames,
  batchRendered: failures.length === 0 && renderedFrames === 504,
  runtimePromotion: false,
  humanApprovalClaimed: false,
  status:
    failures.length === 0 && renderedFrames === 504
      ? "technical_batch_rendered_pending_independent_validation"
      : "technical_batch_rendered_with_failures",
  failures,
  roles: roleResults,
};
const executionPath = resolve(runRoot, "execution.json");
writeFileSync(executionPath, `${JSON.stringify(execution, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      status: execution.status,
      runId,
      runRoot: execution.runRoot,
      renderedRoles: execution.renderedRoleCount,
      renderedFrames,
      expectedFrames: execution.expectedFrames,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length > 0 || renderedFrames !== 504) process.exitCode = 1;

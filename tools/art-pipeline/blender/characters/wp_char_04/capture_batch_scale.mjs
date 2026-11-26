/* global window, setTimeout */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const repoRoot = resolve(import.meta.dirname, "../../../../..");
const labManifestArgument = process.argv[process.argv.indexOf("--lab-manifest") + 1];
const runRootArgument = process.argv[process.argv.indexOf("--run-root") + 1];
if (!labManifestArgument || !runRootArgument) {
  throw new Error("--lab-manifest and --run-root are required");
}
const labManifestPath = resolve(labManifestArgument);
const runRoot = resolve(runRootArgument);
const labId = process.argv[process.argv.indexOf("--lab-id") + 1] ?? "character-batch-01";
const outputRoot = resolve(runRoot, "scale-captures");
const baseUrl = process.env.CHAR_SCALE_LAB_URL ?? "http://127.0.0.1:5174/char-scale-lab.html";
const server = process.env.CHAR_SCALE_LAB_URL
  ? null
  : spawn(
      "pnpm",
      [
        "exec",
        "vite",
        "--config",
        "apps/web/src/character-scale-lab/vite.config.ts",
        "--host",
        "127.0.0.1",
        "--port",
        "5174",
      ],
      { cwd: repoRoot, stdio: "ignore", detached: true },
    );
const labManifestBytes = readFileSync(labManifestPath);
const labManifest = JSON.parse(labManifestBytes.toString("utf8"));
const labManifestSha256 = createHash("sha256").update(labManifestBytes).digest("hex");
const validationReference = labManifest.batchValidation;
const validationBytes = readFileSync(resolve(repoRoot, validationReference.path));
const validation = JSON.parse(validationBytes.toString("utf8"));
if (
  validation.status !== "passed" ||
  validation.technicalValidation !== "passed" ||
  validation.errorCount !== 0 ||
  createHash("sha256").update(validationBytes).digest("hex") !== validationReference.sha256
) {
  throw new Error("Scale capture requires the exact passed batch validation");
}
const roles = [...new Set(labManifest.frames.map((frame) => frame.role))].sort();
const browser = await chromium.launch({ headless: true });
const manifest = {
  schemaVersion: 1,
  purpose:
    "All 14 Kenney candidates at 34 px in a dense real-building Phaser lab; not production gameplay or runtime promotion.",
  baseUrl,
  labId,
  labManifest: labManifestPath.slice(repoRoot.length + 1),
  labManifestSha256,
  batchValidation: validationReference,
  selection: labManifest.selection,
  captures: [],
  pageErrors: [],
};

try {
  if (existsSync(outputRoot)) throw new Error(`Capture output already exists: ${outputRoot}`);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) =>
      manifest.pageErrors.push(`${viewport.width}×${viewport.height}: ${error.message}`),
    );
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        await page.goto(`${baseUrl}?manifest=${labId}`, {
          waitUntil: "domcontentloaded",
          timeout: 1000,
        });
        await page.waitForFunction(() => window.__charScaleLab?.ready === true, null, {
          timeout: 5000,
        });
        ready = true;
        break;
      } catch {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
      }
    }
    if (!ready) throw new Error("Character Scale Lab did not start");
    await page.locator('[data-arrangement="catalog"]').click();
    await page.locator('[data-config="B"]').click();
    await page.evaluate(() => {
      window.__charScaleLab.setPaused(true);
      window.__charScaleLab.setMotionEnabled(false);
      window.__charScaleLab.setShowGrid(false);
      window.__charScaleLab.setShowReferences(false);
    });
    for (const animation of ["idle", "walk"]) {
      for (const direction of [0, 1, 2, 3]) {
        await page.evaluate(
          ({ roleIds, action, heading }) => {
            for (const role of roleIds) {
              window.__charScaleLab.setCharacterPose(
                role,
                action,
                heading,
                action === "idle" ? 0 : 4,
              );
            }
          },
          { roleIds: roles, action: animation, heading: direction },
        );
        await page.waitForTimeout(250);
        const state = await page.evaluate(() => window.__charScaleLab.getState());
        if (state.characters.length !== 14) {
          throw new Error(`Expected 14 visible characters, got ${state.characters.length}`);
        }
        if (state.characters.some((character) => !character.inView)) {
          throw new Error("Catalog capture contains an off-screen character");
        }
        const expectedSample = animation === "idle" ? 0 : 4;
        if (
          state.characters.some(
            (character) =>
              character.animation !== animation ||
              character.direction !== direction ||
              character.sampleIndex !== expectedSample ||
              !character.textureKey.endsWith(
                `_d${direction}_${String(expectedSample).padStart(2, "0")}_lift`,
              ) ||
              Math.abs(character.screenHeight - 34) > 0.2,
          )
        ) {
          throw new Error("Catalog capture pose, canonical sample or 34 px calibration diverged");
        }
        mkdirSync(outputRoot, { recursive: true });
        const file = `${outputRoot}/${viewport.width}x${viewport.height}-${animation}-d${direction}.png`;
        await page.locator("#phaser-root").screenshot({ path: file });
        const bytes = readFileSync(file);
        manifest.captures.push({
          viewport,
          animation,
          direction,
          cameraZoom: state.cameraZoom,
          visibleWorldArea: state.visibleWorldArea,
          visibleBuildingCount: state.visibleBuildingCount,
          characters: state.characters,
          file: file.slice(repoRoot.length + 1),
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(`${outputRoot}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      captures: manifest.captures.length,
      roles: roles.length,
      pageErrors: manifest.pageErrors,
      output: `${outputRoot.slice(repoRoot.length + 1)}/manifest.json`,
    },
    null,
    2,
  ),
);
if (manifest.pageErrors.length > 0) process.exitCode = 1;

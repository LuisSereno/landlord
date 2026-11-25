/* global window, setTimeout */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const baseUrl = process.env.CHAR_SCALE_LAB_URL ?? "http://127.0.0.1:5174/char-scale-lab.html";
const outputRoot = "docs/art/characters/candidates/wp-char-04/dense-comparison";
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
      { stdio: "ignore", detached: true },
    );
const browser = await chromium.launch({ headless: true });
const manifest = {
  schemaVersion: 1,
  purpose: "B/D comparison in a dense real-building Phaser lab; no production runtime promotion.",
  baseUrl,
  captures: [],
  pageErrors: [],
};

try {
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
        await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
        await page.waitForFunction(() => window.__charScaleLab?.ready === true, null, {
          timeout: 5000,
        });
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error("Character Scale Lab did not start");
    for (const config of ["B", "D"]) {
      await page.locator('[data-arrangement="dense"]').click();
      await page.locator(`[data-config="${config}"]`).click();
      await page.evaluate(() => {
        window.__charScaleLab.setPaused(true);
        window.__charScaleLab.setMotionEnabled(true);
        window.__charScaleLab.setMotionPhase(0.5);
        window.__charScaleLab.setShowGrid(true);
        window.__charScaleLab.setShowReferences(true);
      });
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => window.__charScaleLab.getState());
      const directory = `${outputRoot}/${viewport.width}x${viewport.height}`;
      mkdirSync(directory, { recursive: true });
      const file = `${directory}/${config}-dense.png`;
      await page.screenshot({ path: file });
      const bytes = readFileSync(file);
      manifest.captures.push({
        viewport,
        config,
        arrangement: state.arrangement,
        cameraZoom: state.cameraZoom,
        visibleWorldArea: state.visibleWorldArea,
        visibleBuildingCount: state.visibleBuildingCount,
        characters: state.characters,
        file,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
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
      pageErrors: manifest.pageErrors,
      configs: manifest.captures.map(({ viewport, config, visibleWorldArea, characters }) => ({
        viewport,
        config,
        visibleWorldArea,
        characterHeights: characters.map((character) => character.screenHeight),
        visibleBuildings: manifest.captures.find(
          (entry) => entry.viewport === viewport && entry.config === config,
        )?.visibleBuildingCount,
      })),
    },
    null,
    2,
  ),
);
if (manifest.pageErrors.length > 0) process.exitCode = 1;

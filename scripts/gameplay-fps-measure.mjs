#!/usr/bin/env node
/* global window, document */
/**
 * Mide FPS de la PARTIDA NORMAL `/` para WP4.15-V.c.2C (no reutiliza el dato del Visual Slice).
 * Verifica además que el suelo no se re-hornea en cada tick: `groundRebakes` debe quedarse en 1
 * mientras la simulación corre sin cambios de geometría (sin construir).
 *
 * Usage:
 *   node scripts/gameplay-fps-measure.mjs --base-url http://127.0.0.1:4179
 *
 * Output:
 *   artifacts/visual-slice/gameplay-performance.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const baseUrl = flag("--base-url", "http://127.0.0.1:4179");
const outputDir = "artifacts/visual-slice";
const artifactPath = `${outputDir}/gameplay-performance.json`;
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ZOOMS = [0.5, 1.0, 2.0, 2.5];
const WARMUP_MS = 2000;
const MEASUREMENT_MS = 10000;

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
const consoleErrors = [];
const httpErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("response", (response) => {
  if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() });
});

try {
  mkdirSync(outputDir, { recursive: true });
  await page.goto(`${baseUrl}/?cameraTest=1`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.locator("canvas").first().waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !!window.__landlordCameraTest, { timeout: 15_000 });
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Worker conectado") ||
      document.body.innerText.includes("simulación"),
    { timeout: 20_000 },
  );
  await page.waitForTimeout(4000);

  const statsBefore = await page.evaluate(() => window.__gameplayVisualStats?.() ?? null);

  const zoomResults = {};
  for (const zoom of ZOOMS) {
    await page.evaluate(
      ({ zoom }) => {
        const api = window.__landlordCameraTest;
        api.centerOnCell({ x: 12, y: 12 });
        const camera = api.getCamera();
        api.configure({ zoom, scrollX: camera.scrollX, scrollY: camera.scrollY });
        if (window.__visualSlicePerformance) window.__visualSlicePerformance.samples = [];
      },
      { zoom },
    );
    await page.waitForTimeout(WARMUP_MS);
    await page.waitForTimeout(MEASUREMENT_MS);
    const perf = await page.evaluate(() => {
      const p = window.__visualSlicePerformance;
      return p ? { samples: [...p.samples], currentFps: p.currentFps } : null;
    });
    if (perf && perf.samples.length > 0) {
      const half = Math.floor(perf.samples.length / 2);
      zoomResults[String(zoom)] = {
        samples: perf.samples.length,
        medianFps: percentile(perf.samples, 50),
        p10Fps: percentile(perf.samples, 10),
        minFps: Math.min(...perf.samples),
        maxFps: Math.max(...perf.samples),
        firstHalfMedian: percentile(perf.samples.slice(0, half), 50),
        secondHalfMedian: percentile(perf.samples.slice(half), 50),
      };
    } else {
      zoomResults[String(zoom)] = null;
    }
  }

  const statsAfter = await page.evaluate(() => window.__gameplayVisualStats?.() ?? null);

  const data = {
    head,
    timestamp: new Date().toISOString(),
    complete: true,
    browser: "Chromium (Playwright headed, GPU accelerated)",
    viewport: { width: 1440, height: 900 },
    mode: "preview",
    route: "/ (gameplay)",
    warmupMs: WARMUP_MS,
    measurementMs: MEASUREMENT_MS,
    statsBefore,
    statsAfter,
    groundRebakesStable:
      statsBefore && statsAfter ? statsBefore.groundRebakes === statsAfter.groundRebakes : false,
    zooms: zoomResults,
    pageErrors: pageErrors.length,
    pageErrorMessages: pageErrors,
    consoleErrors: consoleErrors.length,
    consoleErrorMessages: consoleErrors,
    httpErrors,
  };
  writeFileSync(artifactPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}

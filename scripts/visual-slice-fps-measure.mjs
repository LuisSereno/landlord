#!/usr/bin/env node
/* global window, setTimeout */
/**
 * FPS measurement for Visual Slice (WP4.15-V.b3.2).
 * Measures FPS at zoom 0.5, 1.0, 2.0, 2.5 with ~560 objects.
 *
 * Usage:
 *   node scripts/visual-slice-fps-measure.mjs
 *
 * Output:
 *   artifacts/visual-slice/vb3-performance.json
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4178;
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = "artifacts/visual-slice";
const ZOOMS = [0.5, 1.0, 2.0, 2.5];
const WARMUP_MS = 2000;
const MEASUREMENT_MS = 10000;
const SAMPLE_INTERVAL_MS = 500;

const server = spawn(
  "pnpm",
  ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
  { stdio: "ignore", detached: true },
);

async function waitForServer(page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/visual-slice?cameraTest=1`, {
        waitUntil: "domcontentloaded",
        timeout: 500,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not start");
}

async function measureFpsAtZoom(page, zoom) {
  // Check initial state
  const initialPerf = await page.evaluate(() => {
    return {
      hasPerformance: !!window.__visualSlicePerformance,
      hasReady: window.__visualSliceReady,
      hasObjects: window.__visualSliceObjects,
      samples: window.__visualSlicePerformance?.samples?.length ?? 0,
    };
  });
  console.log(`[Measure] Initial state at zoom ${zoom}:`, initialPerf);

  // Configure camera
  await page.evaluate(
    ({ zoom }) => {
      const api = window.__landlordCameraTest;
      if (!api) throw new Error("Missing camera hook");
      api.configure({ zoom, scrollX: 0, scrollY: 0 });
      api.centerOnCell({ x: 30, y: 30 });
    },
    { zoom },
  );

  // Check after configure
  const afterConfigure = await page.evaluate(() => {
    return {
      hasPerformance: !!window.__visualSlicePerformance,
      samples: window.__visualSlicePerformance?.samples?.length ?? 0,
      currentFps: window.__visualSlicePerformance?.currentFps,
    };
  });
  console.log(`[Measure] After configure:`, afterConfigure);

  // Clear previous samples
  await page.evaluate(() => {
    if (window.__visualSlicePerformance) {
      window.__visualSlicePerformance.samples = [];
    }
  });
  console.log(`[Measure] Cleared samples at zoom ${zoom}`);

  // Warm-up
  await page.waitForTimeout(WARMUP_MS);

  // Check if update is running
  const beforeSamples = await page.evaluate(() => {
    return window.__visualSlicePerformance?.samples?.length ?? 0;
  });
  console.log(`[Measure] After warmup: ${beforeSamples} samples`);

  // Measurement period
  await page.waitForTimeout(MEASUREMENT_MS);

  // Collect results
  const perf = await page.evaluate(() => {
    const p = window.__visualSlicePerformance;
    if (!p) return null;
    return {
      samples: [...p.samples],
      objectCount: p.objectCount,
      currentFps: p.currentFps,
    };
  });

  return perf;
}

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
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

try {
  mkdirSync(outputDir, { recursive: true });
  await waitForServer(page);
  await page.locator("[data-testid='visual-slice'] canvas").waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => window.__visualSliceReady === true, { timeout: 20_000 });

  console.log("Scene ready, starting FPS measurement...");

  const zoomResults = {};
  for (const zoom of ZOOMS) {
    console.log(`Measuring zoom ${zoom}...`);
    const perf = await measureFpsAtZoom(page, zoom);

    if (perf && perf.samples.length > 0) {
      const samples = perf.samples;
      const half = Math.floor(samples.length / 2);
      const firstHalf = samples.slice(0, half);
      const secondHalf = samples.slice(half);

      zoomResults[String(zoom)] = {
        samples: samples.length,
        medianFps: percentile(samples, 50),
        p10Fps: percentile(samples, 10),
        minFps: Math.min(...samples),
        maxFps: Math.max(...samples),
        firstHalfMedian: percentile(firstHalf, 50),
        secondHalfMedian: percentile(secondHalf, 50),
        objectCount: perf.objectCount,
      };
    } else {
      zoomResults[String(zoom)] = null;
    }
  }

  const performanceData = {
    timestamp: new Date().toISOString(),
    commit: "HEAD",
    browser: "Chromium (Playwright headless)",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    mode: "preview",
    warmupMs: WARMUP_MS,
    measurementMs: MEASUREMENT_MS,
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    objects: await page.evaluate(() => window.__visualSliceObjects ?? 0),
    zooms: zoomResults,
    pageErrors: pageErrors.length,
    pageErrorMessages: pageErrors,
    consoleErrors: consoleErrors.length,
    consoleErrorMessages: consoleErrors,
  };

  writeFileSync(`${outputDir}/vb3-performance.json`, JSON.stringify(performanceData, null, 2));
  console.log("\nPerformance data saved to artifacts/visual-slice/vb3-performance.json");
  console.log(JSON.stringify(performanceData, null, 2));
} finally {
  await browser.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

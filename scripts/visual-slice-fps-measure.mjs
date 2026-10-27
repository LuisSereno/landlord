#!/usr/bin/env node
/* global window, setTimeout */
/**
 * FPS measurement for Visual Slice (WP4.15-V.b3).
 * Measures FPS at zoom 0.5 and 1.0 with 560 objects.
 *
 * Usage:
 *   node scripts/visual-slice-fps-measure.mjs
 *
 * Output:
 *   artifacts/visual-slice/vb3-performance.json
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4178;
const baseUrl = `http://127.0.0.1:${port}`;
const outputDir = "artifacts/visual-slice";

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

async function measureFpsAtZoom(page, zoom, durationMs = 10000) {
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

  // Warm-up
  await page.waitForTimeout(2000);

  // Collect samples
  const samples = [];
  const startTime = Date.now();
  while (Date.now() - startTime < durationMs) {
    await page.waitForTimeout(500);
    const fps = await page.evaluate(() => window.__visualSliceFps ?? 0);
    if (fps > 0) samples.push(fps);
  }

  return samples;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await waitForServer(page);
  await page.locator("[data-testid='visual-slice'] canvas").waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => window.__visualSliceReady === true, { timeout: 20_000 });

  console.log("Measuring FPS at zoom 0.5...");
  const fps05Samples = await measureFpsAtZoom(page, 0.5);

  console.log("Measuring FPS at zoom 1.0...");
  const fps10Samples = await measureFpsAtZoom(page, 1.0);

  const performanceData = {
    timestamp: new Date().toISOString(),
    objects: await page.evaluate(() => window.__visualSliceObjects ?? 0),
    zoom05: fps05Samples.length > 0 ? {
      median: percentile(fps05Samples, 50),
      p10: percentile(fps05Samples, 10),
      min: Math.min(...fps05Samples),
      max: Math.max(...fps05Samples),
      samples: fps05Samples.length,
    } : null,
    zoom10: fps10Samples.length > 0 ? {
      median: percentile(fps10Samples, 50),
      p10: percentile(fps10Samples, 10),
      min: Math.min(...fps10Samples),
      max: Math.max(...fps10Samples),
      samples: fps10Samples.length,
    } : null,
    errors: pageErrors.length,
    errorMessages: pageErrors,
  };

  writeFileSync(`${outputDir}/vb3-performance.json`, JSON.stringify(performanceData, null, 2));
  console.log(JSON.stringify(performanceData, null, 2));
} finally {
  await browser.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

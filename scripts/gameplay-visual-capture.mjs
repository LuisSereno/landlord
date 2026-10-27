#!/usr/bin/env node
/* global window, document */
/**
 * Captura BEFORE/AFTER de la partida real `/` para WP4.15-V.c (no el Visual Slice).
 *
 * Se ejecuta dos veces: una contra el build anterior (BEFORE, ground plano) y otra contra el
 * actual (AFTER, Graphic Civic). Ambos usan el mismo seed (1), el mismo viewport y la misma cámara.
 *
 * Usage:
 *   node scripts/gameplay-visual-capture.mjs --base-url http://127.0.0.1:4179 --label BEFORE
 *   node scripts/gameplay-visual-capture.mjs --base-url http://127.0.0.1:4180 --label AFTER
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const baseUrl = flag("--base-url", "http://127.0.0.1:4179");
const label = flag("--label", "CAPTURE");
const outputDir = "artifacts/visual-slice";
const ZOOMS = [0.5, 1.0, 2.0, 2.5];

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  mkdirSync(outputDir, { recursive: true });
  await page.goto(`${baseUrl}/?cameraTest=1`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.locator("canvas").first().waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !!window.__landlordCameraTest, { timeout: 15_000 });
  // Esperar a que llegue la proyección con edificios (simulación arrancada con seed 1).
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes("Worker conectado") || text.includes("simulación");
    },
    { timeout: 20_000 },
  );
  // Dejar estabilizar la simulación y el render.
  await page.waitForTimeout(4000);

  const summary = { label, baseUrl, zooms: {}, pageErrors };
  for (const zoom of ZOOMS) {
    await page.evaluate(
      ({ zoom }) => {
        const api = window.__landlordCameraTest;
        api.centerOnCell({ x: 12, y: 12 });
        const camera = api.getCamera();
        api.configure({ zoom, scrollX: camera.scrollX, scrollY: camera.scrollY });
      },
      { zoom },
    );
    await page.waitForTimeout(1500);
    const file = `${outputDir}/gameplay-${label.toLowerCase()}-zoom-${zoom}.png`;
    await page.screenshot({ path: file });
    summary.zooms[String(zoom)] = file;
    console.log(`captured ${file}`);
  }
  writeFileSync(
    `${outputDir}/gameplay-${label.toLowerCase()}-capture.json`,
    JSON.stringify(summary, null, 2),
  );
  console.log(`page errors: ${pageErrors.length}`);
} finally {
  await browser.close();
}

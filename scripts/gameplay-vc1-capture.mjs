#!/usr/bin/env node
/* global window, document */
/**
 * Captura de gameplay `/` con una proyección REAL de simulación inyectada (WP4.15-V.c.1).
 *
 * La proyección la produce `VC1_PROJECTION=1 pnpm --filter @landlord/simulation test` (comandos
 * auténticos: comprar parcelas, levantar courtyard homes, dejar obras sin cuadrilla). Se inyecta a
 * través del hook de prueba de cámara (`?cameraTest=1`), que llama al mismo `setProjection` que usa
 * la partida real: los edificios y la construcción que se ven proceden del motor, no de una
 * composición fija. La simulación se pausa antes de inyectar para que el worker no la sobrescriba.
 *
 * Usage:
 *   node scripts/gameplay-vc1-capture.mjs --base-url http://127.0.0.1:4179 --label AFTER
 *   node scripts/gameplay-vc1-capture.mjs --base-url http://127.0.0.1:4180 --label BEFORE
 */
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
function flag(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const baseUrl = flag("--base-url", "http://127.0.0.1:4179");
const label = flag("--label", "AFTER");
const outputDir = "artifacts/visual-slice";
const ZOOMS = [1.0, 2.0];
const projection = JSON.parse(readFileSync("artifacts/visual-slice/vc1-projection.json", "utf8"));

// Centro sobre el cúmulo de parcelas con edificio u obra.
const builtParcelIds = new Set([
  ...projection.economy.buildings.map((b) => b.parcelId),
  ...projection.economy.constructionSites.map((s) => s.parcelId),
]);
const builtCells = projection.economy.parcels
  .filter((p) => p.buildingId || builtParcelIds.has(p.id))
  .map((p) => p.cell);
const center =
  builtCells.length > 0
    ? {
        x: Math.round(builtCells.reduce((s, c) => s + c.x, 0) / builtCells.length),
        y: Math.round(builtCells.reduce((s, c) => s + c.y, 0) / builtCells.length),
      }
    : { x: 12, y: 12 };

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

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
  await page.waitForTimeout(3000);
  // Pausar para que el worker no sobrescriba la proyección inyectada.
  await page
    .getByRole("button", { name: "Pausar" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate((proj) => window.__landlordCameraTest.injectProjection(proj), projection);
  await page.waitForTimeout(2500);

  const stats = await page.evaluate(() => window.__gameplayVisualStats?.() ?? null);
  console.log(`stats after inject: ${JSON.stringify(stats)} center=${JSON.stringify(center)}`);

  for (const zoom of ZOOMS) {
    await page.evaluate(
      ({ zoom, center }) => {
        const api = window.__landlordCameraTest;
        api.centerOnCell(center);
        const camera = api.getCamera();
        api.configure({ zoom, scrollX: camera.scrollX, scrollY: camera.scrollY });
      },
      { zoom, center },
    );
    await page.waitForTimeout(1200);
    const file = `${outputDir}/gameplay-${label.toLowerCase()}-built-zoom-${zoom}.png`;
    await page.screenshot({ path: file });
    console.log(`captured ${file}`);
  }
  console.log(`page errors: ${pageErrors.length}`);
} finally {
  await browser.close();
}

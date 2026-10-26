#!/usr/bin/env node
/* global setTimeout, window */
/**
 * Capturas del Visual Slice (WP4.15-V) sobre la escena Phaser real.
 *
 * Monta `/visual-slice` en el preview de producción, centra la cámara del gameplay en el cruce de
 * la microzona y guarda la evidencia por capas del suelo (WP4.15-V.b0, misma cámara), la misma
 * composición a zoom 0.5, 1.0, 2.0 y 2.5, y una variante con personajes (`?characters=1`).
 * No retoca las imágenes: son la salida literal de Phaser.
 *
 *   node scripts/visual-slice-capture.mjs
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4177;
const externalServerUrl = process.env.VISUAL_SLICE_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}`;
const outputDir = process.env.VISUAL_SLICE_OUTPUT ?? "artifacts/visual-slice";
/**
 * Prefijo para el par A/B de un pase de estilo (WP4.15-V.b1): `vb1-before`, `vb1-after`.
 * Duplica la serie de zooms sin borrar la evidencia canónica, así la comparación deja de
 * depender de qué bundle estaba montado cuando se tomó la captura.
 */
const evidencePrefix = process.env.VISUAL_SLICE_EVIDENCE;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const CENTER = { x: 30, y: 30 };
const ZOOMS = [0.5, 1.0, 2.0, 2.5];
/**
 * Capas del suelo horneadas por la escena, en orden de evidencia (WP4.15-V.b0). Todas las etapas
 * salen de la misma composición y de la misma cámara: sólo cambia hasta qué capa pinta el bake.
 */
const TERRAIN_STAGES = [
  { stage: "none", name: "terrain-stage-1-before-dressing" },
  { stage: "base", name: "terrain-stage-2-after-base-terrain" },
  { stage: "parcels", name: "terrain-stage-3-after-parcel-surfaces" },
  { stage: "full", name: "terrain-stage-4-after-vegetation-dressing" },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
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
  throw new Error("El servidor del Visual Slice no arrancó");
}

async function waitForSlice() {
  await page.locator("[data-testid='visual-slice'] canvas").waitFor({ timeout: 10_000 });
  await page.waitForFunction(() => window.__visualSliceReady === true, { timeout: 20_000 });
}

async function capture(name, zoom) {
  await page.evaluate(
    ({ zoom, center }) => {
      const api = window.__landlordCameraTest;
      if (!api) throw new Error("Falta el hook de cámara");
      api.configure({ zoom, scrollX: 0, scrollY: 0 });
      api.centerOnCell(center);
    },
    { zoom, center: CENTER },
  );
  await page.waitForTimeout(150);
  const file = `${outputDir}/${name}.png`;
  await page.screenshot({ path: file });
  return file;
}

async function openSlice(query) {
  await page.goto(`${baseUrl}/visual-slice?cameraTest=1${query}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForSlice();
}

try {
  mkdirSync(outputDir, { recursive: true });
  await waitForServer();
  await waitForSlice();
  const captures = [];
  /** Evidencia por capas: misma cámara, misma composición, distinto horneado de suelo. */
  for (const { stage, name } of TERRAIN_STAGES) {
    await openSlice(`&terrain=${stage}`);
    captures.push(await capture(name, 1.0));
  }
  for (const zoom of ZOOMS) {
    const name = `visual-slice-zoom-${zoom.toFixed(1)}`;
    const file = await capture(name, zoom);
    captures.push(file);
    if (evidencePrefix) {
      const copy = `${outputDir}/${evidencePrefix}-${name}.png`;
      copyFileSync(file, copy);
      captures.push(copy);
    }
  }
  /** Captura principal: misma composición sin personajes a zoom de gameplay estándar. */
  captures.push(await capture("visual-slice-main", 1.0));
  const tag = process.env.VISUAL_SLICE_TAG;
  if (tag) {
    copyFileSync(`${outputDir}/visual-slice-main.png`, `${outputDir}/visual-slice-main-${tag}.png`);
    captures.push(`${outputDir}/visual-slice-main-${tag}.png`);
  }

  await openSlice("&characters=1");
  captures.push(await capture("visual-slice-characters", 1.0));

  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  const objects = await page.evaluate(() => window.__visualSliceObjects ?? 0);
  console.log(JSON.stringify({ status: "captured", captures, objects }));
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

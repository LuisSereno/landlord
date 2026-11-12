#!/usr/bin/env node
/* global setTimeout, window, document */

/**
 * Gate D · QA de píxeles del sistema vial sobre la app real (Phaser). Captura avenida horizontal y
 * vertical, intersección, costura v2↔v4, edificios junto a calzada y vehículos; y la autovía de 7
 * mediante el fixture QA de presentación (?qaRoads=motorway, sólo canal vial, etiquetado en pantalla).
 * No inyecta estado de juego: el override es de presentación y el resto usa la ciudad real.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4183;
const externalServerUrl = process.env.VH_CAPTURE_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${String(port)}/`;
const outputDir = "docs/art/world-visual-foundation/pixel-qa";
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );

mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

function log(message) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${message}\n`);
}
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor para road QA no arrancó");
}
async function dismissOnboarding() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const skip = page.getByRole("button", { name: "Ahora no" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
  }
}
async function startCity(qaRoads) {
  const url = `${baseUrl}?cameraTest=1${qaRoads ? `&qaRoads=${qaRoads}` : ""}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const removal = indexedDB.deleteDatabase("landlord-gate1");
        removal.onsuccess = () => resolve();
        removal.onerror = () => resolve();
        removal.onblocked = () => resolve();
      }),
  );
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30_000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await dismissOnboarding();
}
async function selectDistrict(name) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await page
      .locator(".hud-district")
      .innerText()
      .catch(() => "");
    if (current.includes(name)) return;
    await page
      .locator(".hud-district")
      .click({ timeout: 5_000, force: true })
      .catch(() => {});
    const tile = page.locator('[aria-label="Distritos"] [role="gridcell"]', { hasText: name });
    try {
      await tile.waitFor({ state: "visible", timeout: 8_000 });
      await tile.click({ timeout: 8_000 });
      await page.waitForFunction(
        (expected) =>
          (document.querySelector(".hud-district")?.textContent ?? "").includes(expected),
        name,
        { timeout: 15_000 },
      );
      await page.waitForTimeout(900);
      return;
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  throw new Error(`No se pudo seleccionar ${name}`);
}
async function setCamera(cell, zoom) {
  await page.evaluate(
    ({ cell, value }) => {
      const api = window.__landlordCameraTest;
      api.centerOnCell(cell);
      const camera = api.getCamera();
      api.configure({ zoom: value, scrollX: camera.scrollX, scrollY: camera.scrollY });
    },
    { cell, value: zoom },
  );
  await page.waitForTimeout(800);
}
async function capture(id) {
  const path = `${outputDir}/road-${id}.png`;
  await page.screenshot({ path, type: "png" });
  return { id, path, sha256: sha256(path) };
}
async function roadSummary() {
  return await page.evaluate(() => window.__landlordUiTest?.roadSectionSummary() ?? null);
}

const manifest = { generatedAt: new Date().toISOString(), baseUrl, shots: [], pageErrors };
let runError = null;
try {
  await waitForServer();
  await startCity(null);

  // Avenida horizontal / vertical / intersección en el distrito full (Oeste).
  await selectDistrict("Ensanche Ferroviario Oeste");
  const section = await roadSummary();
  const segs = section?.segments ?? [];
  const hAvenue = segs.find((s) => s.profile === "avenue" && s.from.y === s.to.y);
  const vAvenue = segs.find((s) => s.profile === "avenue" && s.from.x === s.to.x);
  if (hAvenue) {
    await setCamera({ x: 32, y: hAvenue.from.y }, 2);
    manifest.shots.push(await capture("avenue-horizontal-20x"));
    log("✓ avenida horizontal");
  }
  if (vAvenue) {
    await setCamera({ x: vAvenue.from.x, y: 32 }, 2);
    manifest.shots.push(await capture("avenue-vertical-20x"));
    log("✓ avenida vertical");
  }
  if (hAvenue && vAvenue) {
    await setCamera({ x: vAvenue.from.x, y: hAvenue.from.y }, 2);
    manifest.shots.push(await capture("intersection-20x"));
    log("✓ intersección");
  }
  // Edificios junto a calzada y vehículos (detalle industrial ya anclado a parcela grande).
  await setCamera({ x: 24, y: 24 }, 2);
  manifest.shots.push(await capture("buildings-carriageway-20x"));

  // Costura v2 (Barrio) ↔ v4 (Oeste): borde este del Barrio y oeste del Oeste.
  await selectDistrict("Barrio del Umbral");
  await setCamera({ x: 63, y: 32 }, 2);
  manifest.shots.push(await capture("seam-v2-east-20x"));
  await selectDistrict("Ensanche Ferroviario Oeste");
  await setCamera({ x: 0, y: 32 }, 2);
  manifest.shots.push(await capture("seam-v4-west-20x"));
  log("✓ costura v2↔v4");

  // Autovía de 7 mediante fixture QA de presentación.
  await startCity("motorway");
  const banner = await page
    .locator('[data-testid="qa-road-banner"]')
    .isVisible()
    .catch(() => false);
  if (!banner) throw new Error("El banner QA de motorway no está visible");
  await selectDistrict("Ensanche Ferroviario Oeste");
  await setCamera({ x: 32, y: 32 }, 2);
  manifest.shots.push(await capture("motorway-qa-20x"));
  await setCamera({ x: 32, y: 32 }, 1);
  manifest.shots.push(await capture("motorway-qa-10x"));
  log("✓ motorway QA");

  if (pageErrors.length > 0) runError = `Errores de página: ${pageErrors.join(" | ")}`;
} catch (error) {
  runError = String(error);
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* preview ya terminó */
    }
  }
  writeFileSync(`${outputDir}/road-qa-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}
if (runError) {
  console.error(
    JSON.stringify({
      status: "incomplete",
      shots: manifest.shots.length,
      pageErrors,
      error: runError,
    }),
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      status: "captured",
      shots: manifest.shots.length,
      pageErrors: pageErrors.length,
    }),
  );
}

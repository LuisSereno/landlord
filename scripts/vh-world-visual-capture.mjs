#!/usr/bin/env node
/* global setTimeout, window, document, HTMLElement, HTMLButtonElement */

/**
 * V.h.12 · captura de píxeles de la app real: 9 distritos × 0.5/1/2 y cinco detalles.
 *
 * Usa el selector de distrito y la cámara Phaser de la aplicación. No inyecta proyecciones ni
 * estado. Las contact sheets se montan a partir de las 27 capturas individuales.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4182;
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

const ZOOMS = [
  { value: 0.5, token: "05x" },
  { value: 1, token: "10x" },
  { value: 2, token: "20x" },
];

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Progreso en stderr (sin buffer) para que el run sea observable desde fuera.
function log(message) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${message}\n`);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      log(`servidor accesible en ${baseUrl} (intento ${attempt + 1})`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor para V.h pixel QA no arrancó");
}

async function startFreshCity() {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const removal = indexedDB.deleteDatabase("landlord-gate1");
        removal.onsuccess = () => resolve();
        removal.onerror = () => resolve();
        removal.onblocked = () => resolve();
      }),
  );
  await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  log("navegador en ?cameraTest=1 · esperando hook de cámara");
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30_000,
  });
  log("hook de cámara presente · esperando worker conectado");
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30_000 });
  log("worker conectado · descartando onboarding");
  await page.waitForTimeout(1500);
  await dismissOnboarding();
}

// El tutorial "Compra tu primera parcela" aparece en ciudad nueva y su backdrop intercepta el
// clic sobre el selector de distrito. Se descarta (x / "Ahora no" / Escape) antes de operar la HUD.
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
  // Red de seguridad: si queda algún backdrop/modal de onboarding todavía montado, desactiva su
  // pointer-events para que no interfiera con los clics de la HUD. No toca el estado de juego.
  await page.evaluate(() => {
    const overlays = [
      ...document.querySelectorAll(
        '[class*="onboarding"], [class*="tour"], [class*="coachmark"], [class*="modal-backdrop"], [class*="scrim"]',
      ),
    ];
    for (const node of overlays) {
      const style = node instanceof HTMLElement ? window.getComputedStyle(node) : null;
      if (style && (style.position === "fixed" || style.position === "absolute")) {
        node.style.pointerEvents = "none";
        node.style.zIndex = "-1";
      }
    }
  });
}

/** Espera a que la HUD esté accionable: selector de distrito presente y visible, sin backdrop encima. */
async function ensureHudReady() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const button = page.locator(".hud-district");
    if (await button.isVisible().catch(() => false)) {
      await dismissOnboarding();
      if (await button.isVisible().catch(() => false)) return;
    } else {
      await page.waitForTimeout(1000);
    }
  }
  await page.locator(".hud-district").waitFor({ state: "visible", timeout: 30_000 });
}

/** Clic robusto en el selector: normal → force → JS, descartando onboarding entre intentos. */
async function clickDistrictSelector() {
  const button = page.locator(".hud-district");
  try {
    await button.click({ timeout: 5_000 });
    return;
  } catch {
    // continúa con los fallbacks
  }
  await dismissOnboarding();
  try {
    await button.click({ timeout: 5_000, force: true });
    return;
  } catch {
    // continúa con el clic por DOM
  }
  await page.evaluate(() => {
    const button = document.querySelector(".hud-district");
    if (button instanceof HTMLButtonElement) button.click();
  });
}

async function readDistricts() {
  await ensureHudReady();
  await clickDistrictSelector();
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  await tiles.first().waitFor({ timeout: 10_000 });
  const entries = [];
  for (let index = 0; index < (await tiles.count()); index += 1) {
    const tile = tiles.nth(index);
    entries.push({
      name: (await tile.locator("strong").innerText()).trim(),
      role: (await tile.locator(".city-role").innerText()).trim(),
    });
  }
  await page.keyboard.press("Escape");
  return entries;
}

async function selectDistrict(name) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ensureHudReady();
    const current = await page.locator(".hud-district").innerText();
    if (current.includes(name)) return;
    try {
      // Abrir la rejilla y confirmar que está montada antes de pulsar el tile: si el selector no
      // abrió (backdrop/racia intermitente), el tile no existe y reintentamos desde cero.
      await clickDistrictSelector();
      const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
      await tiles.first().waitFor({ state: "visible", timeout: 8_000 });
      const tile = page.locator('[aria-label="Distritos"] [role="gridcell"]', { hasText: name });
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
      // Reintentar: cerrar cualquier rejilla/modal abierta y volver a intentar la selección.
      await page.keyboard.press("Escape").catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`No se pudo seleccionar el distrito ${name}`);
}

async function anchorForDistrict(preferredFacility) {
  return await page.evaluate((facility) => {
    const ui = window.__landlordUiTest;
    return (
      (facility ? ui?.facilityCell(facility) : null) ??
      ui?.largestMarketableParcel()?.cell ??
      ui?.publicParcelCell() ?? { x: 24, y: 24 }
    );
  }, preferredFacility);
}

async function setCamera(anchor, zoom) {
  await page.evaluate(
    ({ cell, value }) => {
      const api = window.__landlordCameraTest;
      api.centerOnCell(cell);
      const camera = api.getCamera();
      api.configure({ zoom: value, scrollX: camera.scrollX, scrollY: camera.scrollY });
    },
    { cell: anchor, value: zoom },
  );
  await page.waitForTimeout(800);
}

async function capture(path) {
  await page.screenshot({ path, type: "png" });
  return { path, sha256: sha256(path) };
}

function makeContactSheet(files, token) {
  const output = `${outputDir}/district-contact-sheet-${token}.png`;
  const result = spawnSync(
    "montage",
    [...files, "-tile", "3x3", "-thumbnail", "480x300", "-geometry", "+4+4", output],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`montage ${token} falló: ${result.stderr || result.stdout}`);
  }
  return { path: output, sha256: sha256(output) };
}

const manifest = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  viewport: { width: 1440, height: 900 },
  districts: [],
  contactSheets: [],
  details: [],
  detailErrors: [],
  pageErrors,
};

let runError = null;

try {
  await waitForServer();
  await startFreshCity();
  const districts = await readDistricts();
  if (districts.length !== 9) throw new Error(`Se esperaban 9 distritos y hay ${districts.length}`);
  log(`9 distritos leídos: ${districts.map((d) => d.name).join(", ")}`);

  // Los closeups de contexto NO cívico comparten ancla (largestMarketableParcel) y zoom 2 con el
  // disparo de distrito, así que se producen en línea durante el bucle: re-seleccionar el distrito
  // hacia atrás desde un zoom 2x profundo entra en carrera con la reproyección y es poco fiable.
  const inlineDetailByDistrict = {
    "Barrio del Umbral": "residential",
    "Mercado del Norte": "commercial",
    "Ensanche Ferroviario Oeste": "industrial",
    "Vega del Cauce": "green",
  };

  for (const district of districts) {
    log(`distrito · ${district.name} (${district.role})`);
    await selectDistrict(district.name);
    const anchor = await anchorForDistrict(district.role === "Núcleo cívico" ? "town_hall" : null);
    const shots = [];
    for (const zoom of ZOOMS) {
      await setCamera(anchor, zoom.value);
      const path = `${outputDir}/district-${slug(district.name)}-${zoom.token}.png`;
      const shot = { zoom: zoom.value, ...(await capture(path)) };
      shots.push(shot);
      log(`  ✓ ${slug(district.name)} @ ${zoom.value}x`);
      const detailId = zoom.value === 2 ? inlineDetailByDistrict[district.name] : undefined;
      if (detailId) {
        const detailPath = `${outputDir}/detail-${detailId}-20x.png`;
        copyFileSync(path, detailPath);
        manifest.details.push({
          id: detailId,
          district: district.name,
          anchor,
          path: detailPath,
          sha256: sha256(detailPath),
          source: "inline district 20x (misma ancla y zoom)",
        });
        log(`  ✓ detalle ${detailId} (en línea)`);
      }
    }
    manifest.districts.push({ ...district, anchor, shots });
  }

  const detailSpecs = [{ id: "civic", districtName: "Centro Cívico", facility: "town_hall" }];
  // Sólo el closeup cívico tiene su propia ancla (facilityCell town_hall), así que se re-selecciona
  // hacia adelante desde el último distrito del bucle.
  for (const detail of detailSpecs) {
    const district = districts.find((entry) => entry.name === detail.districtName);
    if (!district) {
      manifest.detailErrors.push({ id: detail.id, error: "distrito no encontrado" });
      continue;
    }
    try {
      log(`detalle · ${detail.id} (${district.name})`);
      await selectDistrict(district.name);
      const anchor = await anchorForDistrict(detail.facility);
      await setCamera(anchor, 2);
      const evidence = await capture(`${outputDir}/detail-${detail.id}-20x.png`);
      manifest.details.push({ ...detail, district: district.name, anchor, ...evidence });
      log(`  ✓ detalle ${detail.id}`);
    } catch (error) {
      manifest.detailErrors.push({ id: detail.id, error: String(error) });
      log(`  ✗ detalle ${detail.id}: ${String(error).slice(0, 120)}`);
    }
  }

  if (pageErrors.length > 0) runError = `Errores de página: ${pageErrors.join(" | ")}`;
} catch (error) {
  runError = String(error);
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // El preview ya terminó; no queda proceso que limpiar.
    }
  }

  // Contact sheets y manifiesto se montan SIEMPRE a partir de los disparos que sí salieron,
  // incluso si el run abortó a mitad. Se omite una escala cuyo distrito falta.
  const completeZooms = ZOOMS.filter((zoom) =>
    manifest.districts.every((district) => district.shots.some((shot) => shot.zoom === zoom.value)),
  );
  for (const zoom of completeZooms) {
    const files = manifest.districts.map((district) => {
      const shot = district.shots.find((entry) => entry.zoom === zoom.value);
      return shot.path;
    });
    manifest.contactSheets.push({ zoom: zoom.value, ...makeContactSheet(files, zoom.token) });
  }
  writeFileSync(`${outputDir}/capture-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (runError) {
  console.error(
    JSON.stringify({
      status: "incomplete",
      districts: manifest.districts.length,
      contactSheets: manifest.contactSheets.length,
      details: manifest.details.length,
      detailErrors: manifest.detailErrors.length,
      pageErrors: pageErrors.length,
      error: runError,
      outputDir,
    }),
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({
      status: "captured",
      districts: manifest.districts.length,
      screenshots: manifest.districts.length * ZOOMS.length,
      contactSheets: manifest.contactSheets.length,
      details: manifest.details.length,
      pageErrors: pageErrors.length,
      outputDir,
    }),
  );
}

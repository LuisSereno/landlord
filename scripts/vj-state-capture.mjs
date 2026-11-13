#!/usr/bin/env node
/* global window, document, HTMLButtonElement, setTimeout */
/**
 * V.j.8 · evidencia 9×3×4: 9 distritos × 3 escalas × 4 estados (complete/construction/damaged/burning).
 * El estado se fuerza SÓLO en la capa de presentación vía window.__landlordQaState (hook QA que no
 * toca GameState ni la proyección del worker). Cada captura es la app real renderizando las variantes
 * reales del estado pedido. Contact sheets por (estado, zoom). NO es gameplay; es evidencia de render.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4183;
const baseUrl = process.env.VJ_CAPTURE_BASE_URL ?? `http://127.0.0.1:${port}/`;
const outputDir = "docs/art/quality-vj/evidence-9x3x4";
const server = process.env.VJ_CAPTURE_BASE_URL
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
page.on("pageerror", (e) => pageErrors.push(e.message));
const ZOOMS = [
  { value: 0.5, token: "05x" },
  { value: 1, token: "10x" },
  { value: 2, token: "20x" },
];
const STATES = ["complete", "construction", "damaged", "burning"];
const log = (m) => process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${m}\n`);
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const slug = (v) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("servidor no arrancó");
}
async function dismissOnboarding() {
  for (let i = 0; i < 3; i++) {
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
async function startFreshCity() {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.deleteDatabase("landlord-gate1");
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
  await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await dismissOnboarding();
}
async function readDistricts() {
  await page.locator(".hud-district").waitFor({ state: "visible", timeout: 30000 });
  await dismissOnboarding();
  await page.locator(".hud-district").click();
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  await tiles.first().waitFor({ timeout: 10000 });
  const out = [];
  for (let i = 0; i < (await tiles.count()); i++)
    out.push((await tiles.nth(i).locator("strong").innerText()).trim());
  await page.keyboard.press("Escape");
  return out;
}
async function clickSelector() {
  const b = page.locator(".hud-district");
  try {
    await b.click({ timeout: 4000 });
    return;
  } catch {
    // el onboarding puede tapar el selector: se descarta y se reintenta
  }
  await dismissOnboarding();
  try {
    await b.click({ timeout: 4000, force: true });
    return;
  } catch {
    // ni el click forzado pasó: se termina pinchando el botón desde el DOM
  }
  await page.evaluate(() => {
    const x = document.querySelector(".hud-district");
    if (x instanceof HTMLButtonElement) x.click();
  });
}
async function selectDistrict(name) {
  for (let a = 0; a < 6; a++) {
    await page
      .locator(".hud-district")
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
    const cur = await page
      .locator(".hud-district")
      .innerText()
      .catch(() => "");
    if (cur.includes(name)) return;
    try {
      await dismissOnboarding();
      await clickSelector();
      const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
      await tiles.first().waitFor({ state: "visible", timeout: 8000 });
      const tile = page.locator('[aria-label="Distritos"] [role="gridcell"]', { hasText: name });
      await tile.waitFor({ state: "visible", timeout: 8000 });
      await tile.click({ timeout: 8000 });
      await page.waitForFunction(
        (n) => (document.querySelector(".hud-district")?.textContent ?? "").includes(n),
        name,
        { timeout: 15000 },
      );
      await page.waitForTimeout(700);
      return;
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  throw new Error(`no se pudo seleccionar ${name}`);
}
async function setCamera(zoom) {
  await page.evaluate((value) => {
    const ui = window.__landlordUiTest;
    const api = window.__landlordCameraTest;
    const cell = ui?.firstBuildingCell?.() ??
      ui?.largestMarketableParcel()?.cell ??
      ui?.publicParcelCell() ?? { x: 24, y: 24 };
    api.centerOnCell(cell);
    const cam = api.getCamera();
    api.configure({ zoom: value, scrollX: cam.scrollX, scrollY: cam.scrollY });
  }, zoom);
  await page.waitForTimeout(600);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  kind: "qa-render-evidence",
  states: STATES,
  viewport: { width: 1440, height: 900 },
  districts: [],
  contactSheets: [],
  pageErrors,
};
let runError = null;
try {
  await waitForServer();
  await startFreshCity();
  const districts = await readDistricts();
  if (districts.length !== 9) throw new Error(`esperaba 9 distritos, hay ${districts.length}`);
  for (const state of STATES) {
    await page.evaluate((s) => {
      window.__landlordQaState = s;
      window.__landlordQaRefresh?.();
    }, state);
    await page.waitForTimeout(400);
    for (const name of districts) {
      await setCamera(0.5);
      await selectDistrict(name);
      await page.evaluate((s) => {
        window.__landlordQaState = s;
        window.__landlordQaRefresh?.();
      }, state);
      const shots = [];
      for (const z of ZOOMS) {
        await setCamera(z.value);
        await page.evaluate(() => window.__landlordQaRefresh?.());
        await page.waitForTimeout(300);
        const path = `${outputDir}/${state}-${slug(name)}-${z.token}.png`;
        await page.screenshot({ path, type: "png" });
        shots.push({ zoom: z.value, path, sha256: sha256(path) });
      }
      manifest.districts.push({ name, state, shots });
      log(`✓ ${state} · ${slug(name)}`);
    }
  }
  if (pageErrors.length) runError = `pageErrors: ${pageErrors.join(" | ")}`;
} catch (e) {
  runError = String(e);
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // el grupo ya se apagó solo al cerrar el navegador: no es un fallo de la corrida
    }
  }
  for (const state of STATES)
    for (const z of ZOOMS) {
      const files = manifest.districts
        .filter((d) => d.state === state)
        .map((d) => d.shots.find((s) => s.zoom === z.value)?.path)
        .filter(Boolean);
      if (files.length !== 9) continue;
      const out = `${outputDir}/sheet-${state}-${z.token}.png`;
      const r = spawnSync(
        "montage",
        [...files, "-tile", "3x3", "-thumbnail", "480x300", "-geometry", "+4+4", out],
        { encoding: "utf8" },
      );
      if (r.status === 0)
        manifest.contactSheets.push({ state, zoom: z.value, path: out, sha256: sha256(out) });
    }
  writeFileSync(`${outputDir}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    status: runError ? "incomplete" : "captured",
    captures: manifest.districts.length * 3,
    sheets: manifest.contactSheets.length,
    pageErrors: pageErrors.length,
    error: runError,
    outputDir,
  }),
);
if (runError) process.exitCode = 1;

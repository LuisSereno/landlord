/* global setTimeout, window */
/**
 * FINAL-ASSET-QA FASE 4 — demostraciones de incendio sobre arquitectura WP06.
 *
 * Cinco filas × día/noche: control histórico (calle legacy del lab con `bld_commercial_c` ardiendo),
 * `mixed_tenement` WP06 intenso y moderado (`?fxFoci=8`), `warehouse` WP06 intenso y moderado. Los
 * sprites burning son las variantes QA del Composer (reducidas con `qaFlamePeakEmission`, humo
 * horneado ⇒ rig sin columna propia) y los focos salen de sus `fireAnchors` en metros. Ninguna
 * entrada toca producción ni el catálogo.
 *
 * Produce en `docs/art/graphics-capabilities/evidence/v2/final-assets/`:
 *  - `<brazo>.png` + `<brazo>.json` (probe + sha del sprite servido),
 *  - `modern_fire_summary.json` con las cinco filas y los focos montados por brazo.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4210;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/final-assets";
const VIEWPORT = { width: 1440, height: 900 };

const CLOSURE_FIRE = "docs/art/graphics-capabilities/evidence/v2/closure/fire";
const CANDIDATES = "docs/art/graphics-capabilities/evidence/v2/candidates";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const ARMS = [
  { id: "legacy_control_day", mood: "day", legacy: true },
  { id: "legacy_control_night", mood: "night", legacy: true },
  { id: "mixed_intense_day", mood: "day", candidate: "mixed_tenement-burning", sprite: `${CLOSURE_FIRE}/hybrid_sprite_day` },
  { id: "mixed_intense_night", mood: "night", candidate: "mixed_tenement-burning", sprite: `${CLOSURE_FIRE}/hybrid_sprite_night` },
  { id: "mixed_moderate_day", mood: "day", candidate: "mixed_tenement-burning", sprite: `${CLOSURE_FIRE}/hybrid_sprite_day`, foci: 8 },
  { id: "mixed_moderate_night", mood: "night", candidate: "mixed_tenement-burning", sprite: `${CLOSURE_FIRE}/hybrid_sprite_night`, foci: 8 },
  { id: "warehouse_intense_day", mood: "day", candidate: "warehouse-burning", sprite: `${CANDIDATES}/wp06_warehouse-burning-day` },
  { id: "warehouse_intense_night", mood: "night", candidate: "warehouse-burning", sprite: `${CANDIDATES}/wp06_warehouse-burning` },
  { id: "warehouse_moderate_day", mood: "day", candidate: "warehouse-burning", sprite: `${CANDIDATES}/wp06_warehouse-burning-day`, foci: 6 },
  { id: "warehouse_moderate_night", mood: "night", candidate: "warehouse-burning", sprite: `${CANDIDATES}/wp06_warehouse-burning`, foci: 6 },
];

mkdirSync(join(REPO_ROOT, OUTPUT_DIR), { recursive: true });

const server = spawn(
  "pnpm",
  ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
  { stdio: "ignore", detached: true, cwd: REPO_ROOT },
);
let serverUp = false;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(`${BASE_URL}/art-lab?artQa=1`, {
        waitUntil: "domcontentloaded",
        timeout: 1000,
      });
      return;
    } catch {
      await new Promise((resolveTick) => setTimeout(resolveTick, 250));
    }
  }
  throw new Error("el preview no respondió en 45 s");
}

const distQa = join(REPO_ROOT, "apps/web/dist/qa-candidates");

function stageCandidate(arm) {
  mkdirSync(distQa, { recursive: true });
  for (const suffix of [".png", ".json"]) {
    copyFileSync(join(REPO_ROOT, `${arm.sprite}${suffix}`), join(distQa, `${arm.candidate}${suffix}`));
  }
}

const results = [];
try {
  await waitForServer();
  serverUp = true;
  const canvas = page.locator('[data-testid="fx-lab-scene"] canvas');
  for (const arm of ARMS) {
    if (!arm.legacy) stageCandidate(arm);
    const params = new URLSearchParams({
      artQa: "1",
      fx: "fire",
      fxMood: arm.mood,
      fxPerf: "1",
    });
    if (!arm.legacy) {
      params.set("fxCandidate", arm.candidate);
      if (arm.foci) params.set("fxFoci", String(arm.foci));
    }
    await page.goto(`${BASE_URL}/art-lab?${params.toString()}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => window.__fxLab?.ready && (window.__fxLab.fire?.foci ?? 0) > 0,
      { timeout: 45_000 },
    );
    // Dos ciclos de frame para que la coreografía de lenguas esté viva en la foto.
    await page.waitForTimeout(900);
    const probe = await page.evaluate(() => ({
      effects: window.__fxLab.effects,
      mood: window.__fxLab.mood,
      fire: window.__fxLab.fire,
      fireActive: window.__fxLab.fireActive,
      fireAnchors: window.__fxLab.fireAnchors,
      candidate: window.__fxLab.candidate,
      glRenderer: window.__fxLab.glRenderer,
    }));
    const png = await canvas.screenshot({ type: "png" });
    writeFileSync(join(REPO_ROOT, OUTPUT_DIR, `${arm.id}.png`), png);
    const record = {
      schemaVersion: 1,
      arm: arm.id,
      mood: arm.mood,
      legacy: Boolean(arm.legacy),
      fociLimit: arm.foci ?? null,
      candidateName: arm.candidate ?? null,
      candidate: probe.candidate,
      fire: probe.fire,
      fireAnchorsAvailable: probe.fireAnchors.length,
      glRenderer: probe.glRenderer,
      url: `${BASE_URL}/art-lab?${params.toString()}`,
      pngSha256: sha256(png),
      pngBytes: png.length,
    };
    writeFileSync(
      join(REPO_ROOT, OUTPUT_DIR, `${arm.id}.json`),
      JSON.stringify(record, null, 1) + "\n",
    );
    results.push(record);
    console.log(
      `${arm.id}: focos montados ${probe.fire?.foci ?? 0}/${probe.fireAnchors.length} · ${Math.round(png.length / 1024)} KiB`,
    );
  }
  const summary = {
    schemaVersion: 1,
    purpose:
      "incendios FINAL-ASSET-QA: control histórico legacy vs arquitectura WP06 (mixed_tenement, warehouse), intensidad intensa y moderada, día y noche",
    arms: results,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(REPO_ROOT, OUTPUT_DIR, "modern_fire_summary.json"),
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(`${results.length} brazos · errores de página: ${pageErrors.length}`);
} finally {
  await browser.close();
  if (serverUp) process.kill(-server.pid);
}

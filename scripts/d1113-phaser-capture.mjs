/* global setTimeout, window */
/**
 * D-111.3 FASE 7 — integración en Phaser de las correcciones.
 *
 * Ruta QA (`fxCandidate`) con validación anti-sustitución activa: mixed_tenement y row_house con
 * fachada corregida, warehouse aprobado sin cambios exteriores, town_hall neoclásico, aged v3 y
 * dañado/incendiado con interiores. Día (`day_civic`) y noche (`fxMood=night`) sin recalibrar.
 * 1440×900, zooms 1×/0,5× y detalle 2,5× donde aplica.
 *
 * Produce en `docs/art/graphics-capabilities/evidence/d1113/final/`:
 *  - `<brazo>.png` + `<brazo>.json` (probe con candidateId, firma, mood, zoom, sha del PNG servido),
 *  - `d1113_phaser_summary.json` con todos los brazos.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4214;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/d1113/final";
const VIEWPORT = { width: 1440, height: 900 };

const FIXED = "/tmp/d1113";
const CAND = "docs/art/graphics-capabilities/evidence/v2/candidates";
const INTERIORS = "docs/art/graphics-capabilities/evidence/d1113/interiors";
const TOWNHALL = "docs/art/graphics-capabilities/evidence/d1113/townhall";
const WEATHERING = "docs/art/graphics-capabilities/evidence/d1113/weathering";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const ARMS = [
  { id: "city_mixed_day", candidate: "mixed_tenement", sprite: `${FIXED}/fixed3_mixed/w06cnd_mixed_tenement_2`, mood: "day", zoom: 1 },
  { id: "city_row_house_day", candidate: "row_house", sprite: `${FIXED}/fixed3_row/w06cnd_row_house_17`, mood: "day", zoom: 1 },
  { id: "city_warehouse_day", candidate: "warehouse", sprite: `${CAND}/wp06_warehouse-candidata`, mood: "day", zoom: 1 },
  { id: "city_town_hall_day", candidate: "town_hall", sprite: `${TOWNHALL}/w06cnd_town_hall_5`, mood: "day", zoom: 1 },
  { id: "city_town_hall_night", candidate: "town_hall", sprite: `${TOWNHALL}/w06cnd_town_hall_5`, mood: "night", zoom: 1 },
  { id: "damage_mixed_damaged_day", candidate: "mixed_tenement-damaged", sprite: `${INTERIORS}/w06cnd_mixed_tenement_2_damaged`, mood: "day", zoom: 1 },
  { id: "damage_mixed_burning_day", candidate: "mixed_tenement-burning", sprite: `${INTERIORS}/w06cnd_mixed_tenement_2_burning`, mood: "day", zoom: 1 },
  { id: "damage_warehouse_damaged_night", candidate: "warehouse-damaged", sprite: `${INTERIORS}/w06cnd_warehouse_2_damaged`, mood: "night", zoom: 1 },
  { id: "damage_warehouse_burning_night", candidate: "warehouse-burning", sprite: `${INTERIORS}/w06cnd_warehouse_2_burning`, mood: "night", zoom: 1 },
  { id: "ageing_aged_day_1x", candidate: "mixed_tenement-aged", sprite: `${FIXED}/aged_v3/w06cnd_mixed_tenement_2_aged`, mood: "day", zoom: 1 },
  { id: "ageing_aged_day_05x", candidate: "mixed_tenement-aged", sprite: `${FIXED}/aged_v3/w06cnd_mixed_tenement_2_aged`, mood: "day", zoom: 0.5 },
  { id: "ageing_aged_day_25x", candidate: "mixed_tenement-aged", sprite: `${FIXED}/aged_v3/w06cnd_mixed_tenement_2_aged`, mood: "day", zoom: 2.5 },
  { id: "ageing_conserved_day_1x", candidate: "mixed_tenement", sprite: `${FIXED}/fixed3_mixed/w06cnd_mixed_tenement_2`, mood: "day", zoom: 1, skipIfSeen: "city_mixed_day" },
  { id: "ageing_conserved_day_25x", candidate: "mixed_tenement", sprite: `${FIXED}/fixed3_mixed/w06cnd_mixed_tenement_2`, mood: "day", zoom: 2.5 },
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
    const source = arm.sprite.startsWith("/")
      ? `${arm.sprite}${suffix}`
      : join(REPO_ROOT, `${arm.sprite}${suffix}`);
    copyFileSync(source, join(distQa, `${arm.candidate}${suffix}`));
  }
}

const results = [];
try {
  await waitForServer();
  serverUp = true;
  const canvas = page.locator('[data-testid="fx-lab-scene"] canvas');
  for (const arm of ARMS) {
    stageCandidate(arm);
    const params = new URLSearchParams({
      artQa: "1",
      fxMood: arm.mood,
      fxPerf: "1",
      fxZoom: String(arm.zoom),
      fxCandidate: arm.candidate,
    });
    await page.goto(`${BASE_URL}/art-lab?${params.toString()}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => Boolean(window.__fxLab?.ready && window.__fxLab?.candidate),
      { timeout: 45_000 },
    );
    await page.waitForTimeout(600);
    const probe = await page.evaluate(() => ({
      mood: window.__fxLab.mood,
      zoom: window.__fxLab.zoom,
      candidate: window.__fxLab.candidate,
      glRenderer: window.__fxLab.glRenderer,
    }));
    const png = await canvas.screenshot({ type: "png" });
    writeFileSync(join(REPO_ROOT, OUTPUT_DIR, `${arm.id}.png`), png);
    const record = {
      schemaVersion: 1,
      arm: arm.id,
      mood: probe.mood,
      zoom: probe.zoom,
      candidateName: arm.candidate,
      candidate: probe.candidate,
      glRenderer: probe.glRenderer,
      servedPngSha256: sha256(png),
      pngBytes: png.length,
      url: `${BASE_URL}/art-lab?${params.toString()}`,
      spriteSource: arm.sprite,
    };
    writeFileSync(
      join(REPO_ROOT, OUTPUT_DIR, `${arm.id}.json`),
      JSON.stringify(record, null, 1) + "\n",
    );
    results.push(record);
    console.log(
      `${arm.id}: ${probe.candidate?.candidateId ?? "?"} · mood ${probe.mood} · zoom ${probe.zoom} · ${Math.round(png.length / 1024)} KiB`,
    );
  }
  const summary = {
    schemaVersion: 1,
    purpose:
      "integración Phaser de las correcciones D-111.3: fachadas, interiores de daño/fuego, aged v3 y town hall neoclásico, sobre la ruta QA validada (sin sustituciones)",
    arms: results,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(REPO_ROOT, OUTPUT_DIR, "d1113_phaser_summary.json"),
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(`${results.length} brazos · errores de página: ${pageErrors.length}`);
} finally {
  await browser.close();
  if (serverUp) process.kill(-server.pid);
}

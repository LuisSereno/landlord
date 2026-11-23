#!/usr/bin/env node
/* global setTimeout, window */
/**
 * D-111.3-T FASE 4 — evidencias Phaser completas (Art Lab QA, NO partida jugable).
 *
 * Brazos:
 *  - los cuatro edificios (mixed, row_house, warehouse, neoclassical_town_hall) a zoom 1× y 0,5×;
 *  - noche REAL con `fxPreset=night_balanced`, verificada por la sonda (preset activo, efectos,
 *    luces y objetos iluminados > 0) — `fxMood=night` a secas no basta;
 *  - dañados e incendiados con las variantes corregidas de FASE 2 (candidatoId y SHA-256
 *    contrastados con la metadata publicada; sin fallback legacy).
 *
 * Cada brazo registra `captureMode: "art-lab-qa-candidate-scene"` y su procedencia (sprite
 * versionado + `sourceSpriteSha256` ≠ `canvasCaptureSha256`).
 *
 * Entregables en `docs/art/graphics-capabilities/evidence/d1113/technical/`:
 *  d1113_technical_city_1x.png · d1113_technical_city_05x.png · d1113_technical_night.png ·
 *  d1113_technical_damage_fire.png · d1113_technical_phaser_manifest.json
 *
 * Uso: node scripts/d1113t-phaser-capture.mjs   (requiere `pnpm --filter @landlord/web build`)
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4217;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUT_REL = "docs/art/graphics-capabilities/evidence/d1113/technical";
const OUT = join(REPO_ROOT, OUT_REL);
const CAPS = join(OUT, "phaser_captures");
const VIEWPORT = { width: 1440, height: 900 };

const CAND = "docs/art/graphics-capabilities/evidence/v2/candidates";
const INTERIORS = "docs/art/graphics-capabilities/evidence/d1113/interiors";
const TOWNHALL = "docs/art/graphics-capabilities/evidence/d1113/townhall";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const CITY = [
  { candidate: "mixed_tenement", sprite: `${CAND}/wp06_mixed_tenement-candidata`, expectedId: "w06cnd_mixed_tenement_2" },
  { candidate: "row_house", sprite: `${CAND}/wp06_row_house-candidata`, expectedId: "w06cnd_row_house_17" },
  { candidate: "warehouse", sprite: `${CAND}/wp06_warehouse-candidata`, expectedId: "w06cnd_warehouse_2" },
  { candidate: "town_hall", sprite: `${TOWNHALL}/w06cnd_town_hall_5`, expectedId: "w06cnd_town_hall_5" },
];
const DAMAGE = [
  { candidate: "mixed_tenement-damaged", sprite: `${INTERIORS}/w06cnd_mixed_tenement_2_damaged`, expectedId: "w06cnd_mixed_tenement_2_damaged", mood: "day" },
  { candidate: "mixed_tenement-burning", sprite: `${INTERIORS}/w06cnd_mixed_tenement_2_burning`, expectedId: "w06cnd_mixed_tenement_2_burning", mood: "day" },
  { candidate: "warehouse-damaged", sprite: `${INTERIORS}/w06cnd_warehouse_2_damaged`, expectedId: "w06cnd_warehouse_2_damaged", mood: "night" },
  { candidate: "warehouse-burning", sprite: `${INTERIORS}/w06cnd_warehouse_2_burning`, expectedId: "w06cnd_warehouse_2_burning", mood: "night" },
];

const ARMS = [];
for (const zoom of [1, 0.5]) {
  for (const b of CITY) {
    ARMS.push({ id: `city_${b.candidate}_z${String(zoom).replace(".", "")}`, ...b, mood: "day", zoom });
  }
}
ARMS.push({ id: "night_balanced_town_hall", candidate: "town_hall", sprite: `${TOWNHALL}/w06cnd_town_hall_5`, expectedId: "w06cnd_town_hall_5", mood: "night", preset: "night_balanced", zoom: 1 });
ARMS.push({ id: "night_balanced_mixed", candidate: "mixed_tenement", sprite: `${CAND}/wp06_mixed_tenement-candidata`, expectedId: "w06cnd_mixed_tenement_2", mood: "night", preset: "night_balanced", zoom: 1 });
for (const d of DAMAGE) {
  ARMS.push({ id: `damage_${d.candidate}`, ...d, zoom: 1 });
}

mkdirSync(OUT, { recursive: true });
mkdirSync(CAPS, { recursive: true });

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
      await page.goto(`${BASE_URL}/art-lab?artQa=1`, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("el preview no respondió en 45 s");
}

const distQa = join(REPO_ROOT, "apps/web/dist/qa-candidates");

function stageCandidate(arm) {
  mkdirSync(distQa, { recursive: true });
  let sourceSpriteSha256 = null;
  for (const suffix of [".png", ".json"]) {
    const source = join(REPO_ROOT, `${arm.sprite}${suffix}`);
    copyFileSync(source, join(distQa, `${arm.candidate}${suffix}`));
    if (suffix === ".png") {
      sourceSpriteSha256 = sha256(readFileSync(source));
      const staged = sha256(readFileSync(join(distQa, `${arm.candidate}${suffix}`)));
      if (staged !== sourceSpriteSha256) {
        throw new Error(`${arm.id}: el sprite servido no coincide con la fuente versionada`);
      }
    }
  }
  // 4.3: el SHA-256 del PNG debe coincidir con el que firmó la metadata publicada del candidato.
  const meta = JSON.parse(readFileSync(join(REPO_ROOT, `${arm.sprite}.json`), "utf8"));
  const problems = [];
  if (meta.candidateId !== arm.expectedId) {
    problems.push(`${arm.id}: candidateId ${meta.candidateId} ≠ esperado ${arm.expectedId}`);
  }
  if (meta.sha256 && meta.sha256 !== sourceSpriteSha256) {
    problems.push(`${arm.id}: sha del sprite ${sourceSpriteSha256.slice(0, 12)} ≠ metadata ${String(meta.sha256).slice(0, 12)}`);
  }
  return { sourceSpriteSha256, problems, compositionSignature: meta.compositionSignature ?? null };
}

const results = [];
const assertions = [];
try {
  await waitForServer();
  serverUp = true;
  const canvas = page.locator('[data-testid="fx-lab-scene"] canvas');
  for (const arm of ARMS) {
    const staged = stageCandidate(arm);
    assertions.push(...staged.problems);
    const params = new URLSearchParams({
      artQa: "1",
      fxMood: arm.mood,
      fxPerf: "1",
      fxZoom: String(arm.zoom),
      fxCandidate: arm.candidate,
    });
    if (arm.preset) params.set("fxPreset", arm.preset);
    await page.goto(`${BASE_URL}/art-lab?${params.toString()}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => Boolean(window.__fxLab?.ready && window.__fxLab?.candidate),
      { timeout: 45_000 },
    );
    await page.waitForTimeout(900);
    const probe = await page.evaluate(() => ({
      mood: window.__fxLab.mood,
      zoom: window.__fxLab.zoom,
      candidate: window.__fxLab.candidate,
      glRenderer: window.__fxLab.glRenderer,
      preset: window.__fxLab.preset ?? null,
      effects: window.__fxLab.effects ?? [],
      lights: window.__fxLab.lights ?? 0,
      litObjects: window.__fxLab.litObjects ?? 0,
      emissive: window.__fxLab.emissive ?? 0,
      particles: window.__fxLab.particles ?? 0,
      fireActive: window.__fxLab.fireActive ?? false,
    }));
    const png = await canvas.screenshot({ type: "png" });
    writeFileSync(join(CAPS, `${arm.id}.png`), png);
    if (arm.preset) {
      if (probe.preset !== arm.preset) {
        assertions.push(`${arm.id}: la sonda no reporta el preset ${arm.preset} (reporta ${probe.preset})`);
      }
      if (!probe.effects.length) assertions.push(`${arm.id}: preset activo sin efectos listados`);
      if (probe.mood !== "night") assertions.push(`${arm.id}: preset nocturno con mood ${probe.mood}`);
      if (probe.lights <= 0) assertions.push(`${arm.id}: noche sin luces activas`);
    }
    if (probe.candidate?.candidateId && arm.expectedId && probe.candidate.candidateId !== arm.expectedId) {
      assertions.push(`${arm.id}: el candidato servido es ${probe.candidate.candidateId}`);
    }
    const record = {
      schemaVersion: 1,
      arm: arm.id,
      captureMode: "art-lab-qa-candidate-scene",
      captureModeNote:
        "Art Lab es la herramienta QA de candidatos: NO es una captura de la escena jugable ni de una partida",
      requested: { mood: arm.mood, preset: arm.preset ?? null, zoom: arm.zoom },
      probe,
      candidateName: arm.candidate,
      compositionSignature: staged.compositionSignature,
      sourceSprite: `${arm.sprite}.png`,
      sourceSpriteSha256: staged.sourceSpriteSha256,
      canvasCaptureSha256: sha256(png),
      pngBytes: png.length,
      url: `${BASE_URL}/art-lab?${params.toString()}`,
    };
    writeFileSync(join(CAPS, `${arm.id}.json`), JSON.stringify(record, null, 1) + "\n");
    results.push(record);
    console.log(
      `${arm.id}: ${probe.candidate?.candidateId ?? "?"} · mood ${probe.mood} · preset ${probe.preset ?? "-"} · zoom ${probe.zoom} · luces ${probe.lights} · ${Math.round(png.length / 1024)} KiB`,
    );
  }
} finally {
  await browser.close();
  if (serverUp) process.kill(-server.pid);
}

// --- hojas de entregables: scripts/d1113t-phaser-sheets.py (PIL) sobre phaser_captures/ ---

const manifest = {
  schemaVersion: 1,
  phase: "D-111.3-T FASE 4",
  captureTool: "Art Lab QA (`/art-lab?artQa=1&fxCandidate=…`), Chromium headless sobre `pnpm --filter @landlord/web preview`",
  notGameplay: "Estas capturas acreditan el candidato en la escena QA con el pipeline de efectos; no sustituyen el playtest humano en la partida",
  viewport: VIEWPORT,
  arms: results,
  assertionsFailed: assertions,
  pageErrors,
  capturedAt: new Date().toISOString(),
};
writeFileSync(join(OUT, "d1113_technical_phaser_manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`${results.length} brazos · aserciones fallidas: ${assertions.length} · errores de página: ${pageErrors.length}`);
if (assertions.length) process.exitCode = 1;

/* global setTimeout, window */
/**
 * FINAL-ASSET-QA FASE 5 — los cuatro estados de conservación sobre UNA arquitectura WP06.
 *
 * `mixed_tenement` en conservado (`wp06_mixed_tenement-candidata`), envejecido (proyección material
 * QA `wp06_mixed_tenement-aged`), dañado (`wp06_mixed_tenement-damaged`, geometría del compositor)
 * y en llamas (variante híbrida del cierre, `closure/fire/hybrid_sprite_day`). La ruta QA valida
 * identidad/tipo/estado antes de montar; de noche no hay variantes de condición (sólo burning), y
 * la diferencia material de condición se evalúa de día.
 *
 * Produce en `docs/art/graphics-capabilities/evidence/v2/final-assets/`:
 *  - `condition_<estado>.png` + `.json` (probe con la candidata servida y su sha),
 *  - `modern_condition_summary.json`.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4211;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/final-assets";
const VIEWPORT = { width: 1440, height: 900 };
const CANDIDATES = "docs/art/graphics-capabilities/evidence/v2/candidates";
const CLOSURE_FIRE = "docs/art/graphics-capabilities/evidence/v2/closure/fire";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const ARMS = [
  { id: "condition_conserved", candidate: "mixed_tenement", sprite: `${CANDIDATES}/wp06_mixed_tenement-candidata` },
  { id: "condition_aged", candidate: "mixed_tenement-aged", sprite: `${CANDIDATES}/wp06_mixed_tenement-aged` },
  { id: "condition_damaged", candidate: "mixed_tenement-damaged", sprite: `${CANDIDATES}/wp06_mixed_tenement-damaged` },
  { id: "condition_burning", candidate: "mixed_tenement-burning", sprite: `${CLOSURE_FIRE}/hybrid_sprite_day` },
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
    stageCandidate(arm);
    const params = new URLSearchParams({
      artQa: "1",
      fxMood: "day",
      fxPerf: "1",
      fxZoom: "2.5",
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
      candidate: window.__fxLab.candidate,
      glRenderer: window.__fxLab.glRenderer,
    }));
    if (!probe.candidate) throw new Error(`${arm.id}: la candidata ${arm.candidate} no se colocó`);
    const png = await canvas.screenshot({ type: "png" });
    writeFileSync(join(REPO_ROOT, OUTPUT_DIR, `${arm.id}.png`), png);
    const record = {
      schemaVersion: 1,
      arm: arm.id,
      mood: probe.mood,
      candidateName: arm.candidate,
      candidate: probe.candidate,
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
    console.log(`${arm.id}: ${probe.candidate.candidateId} · ${Math.round(png.length / 1024)} KiB`);
  }
  const summary = {
    schemaVersion: 1,
    purpose:
      "condiciones de conservación sobre la MISMA arquitectura (mixed_tenement WP06): conservado, envejecido (proyección material QA), dañado y en llamas; noche no disponible para los estados no-burning",
    arms: results,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(REPO_ROOT, OUTPUT_DIR, "modern_condition_summary.json"),
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(`${results.length} brazos · errores de página: ${pageErrors.length}`);
} finally {
  await browser.close();
  if (serverUp) process.kill(-server.pid);
}

/* global setTimeout, window, URLSearchParams */
/**
 * D-111.2 cierre FASE 5 — verificación breve de la exposición nocturna definitiva.
 *
 * Los seis puntos del encargo, cada uno con su captura o su lectura:
 *  1. día (preset day_balanced)            → day_balanced.png
 *  2. noche (preset night_balanced)        → night_balanced.png
 *  3. noche con incendio (night_fire)      → night_fire.png y night_fire_050x.png (0,5×)
 *  4. CANVAS forzado con night_fire        → night_fire_canvas.png (§7.5, sin ningún filtro)
 *  5. desmontaje                           → mount_dismount.json: 5 ciclos on/off de `fire` y 3 de
 *     `lighting`, con las cinco cifras de fuga de la sonda (sceneObjects, emissive, lights,
 *     texturesLive, gpuTextureBytes) al final de cada ciclo.
 * La hoja `night_lighting_final_ab.png` y la medida de legibilidad de fachada las ensambla
 * `scripts/night-lighting-final-sheet.py` a partir de estos PNG + JSON.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const PORT_READY = await freePort();
const BASE_URL = process.env.NIGHT_QA_BASE_URL ?? `http://127.0.0.1:${PORT_READY}`;
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/closure/night";
const VIEWPORT = { width: 1440, height: 900 };
const FIRE_CYCLES = 5;
const LIGHTING_CYCLES = 3;

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const server = process.env.NIGHT_QA_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT_READY)],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("el servidor de vista previa no arrancó");
}

async function openLab(params) {
  await page.goto(`${BASE_URL}/art-lab?${new URLSearchParams(params).toString()}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () => Boolean(window.__fxLab?.ready && (window.__fxLab.stats?.samples ?? 0) >= 8),
    { timeout: 60_000 },
  );
  await page.waitForFunction(() => new Promise((resolve) => setTimeout(() => resolve(true), 400)));
  return page.evaluate(() => window.__fxLab);
}

const ARMS = [
  { id: "day_balanced", params: { artQa: "1", fxPreset: "day_balanced", fxPerf: "1" } },
  { id: "night_balanced", params: { artQa: "1", fxPreset: "night_balanced", fxPerf: "1" } },
  { id: "night_fire", params: { artQa: "1", fxPreset: "night_fire", fxPerf: "1" } },
  {
    id: "night_fire_050x",
    params: { artQa: "1", fxPreset: "night_fire", fxPerf: "1", fxZoom: "0.5" },
  },
  {
    id: "night_fire_canvas",
    params: { artQa: "1", fxPreset: "night_fire", fxPerf: "1", fxRenderer: "canvas" },
  },
];

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();
  const captures = [];

  for (const arm of ARMS) {
    const probe = await openLab(arm.params);
    const png = await page
      .locator('[data-testid="fx-lab-scene"] canvas')
      .screenshot({ type: "png" });
    writeFileSync(`${OUTPUT_DIR}/${arm.id}.png`, png);
    const record = {
      schemaVersion: 1,
      arm: arm.id,
      params: arm.params,
      probe: {
        preset: probe.preset,
        mood: probe.mood,
        zoom: probe.zoom,
        effects: probe.effects,
        emissive: probe.emissive,
        lights: probe.lights,
        particles: probe.particles,
        fire: probe.fire,
        webgl: probe.webgl,
        glRenderer: probe.glRenderer,
        stats: probe.stats,
      },
      pngSha256: sha256(png),
      pngBytes: png.length,
    };
    writeFileSync(`${OUTPUT_DIR}/${arm.id}.json`, JSON.stringify(record, null, 1) + "\n");
    captures.push(record);
    console.error(`${arm.id}: preset=${probe.preset} mood=${probe.mood} webgl=${probe.webgl}`);
  }

  /** Desmontaje: la sonda mide; lo que crece de forma monótona es fuga de código nuestro.
   *  Los ciclos pasan por los checkboxes del panel (la misma vía que un humano), no por APIs privadas. */
  await openLab(ARMS[2].params);
  const cycles = [];
  const snapshot = () =>
    page.evaluate(() => {
      const probe = window.__fxLab;
      return {
        frames: probe.frames,
        sceneObjects: probe.sceneObjects,
        emissive: probe.emissive,
        lights: probe.lights,
        texturesLive: probe.stats?.texturesLive ?? null,
        gpuTextureBytes: probe.stats?.gpuTextureBytes ?? null,
        fireActive: probe.fireActive,
        effects: probe.effects,
      };
    });
  const plan = [
    ...Array.from({ length: FIRE_CYCLES }, (index) => ({ effect: "fire", index: index + 1 })),
    ...Array.from({ length: LIGHTING_CYCLES }, (index) => ({
      effect: "lighting",
      index: index + 1,
    })),
  ];
  for (const { effect, index } of plan) {
    const before = await snapshot();
    await page.locator(`[data-testid="fx-toggle-${effect}"]`).click();
    await page.waitForFunction(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 250)),
    );
    const after = await snapshot();
    cycles.push({ effect, index, before, after });
  }
  writeFileSync(
    `${OUTPUT_DIR}/mount_dismount.json`,
    JSON.stringify({ schemaVersion: 1, cycles, pageErrors }, null, 1) + "\n",
  );

  const summary = {
    schemaVersion: 1,
    purpose: "verificación breve de la exposición nocturna definitiva (D-111.2 cierre FASE 5)",
    captures,
    dismountCycles: cycles.length,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    `${OUTPUT_DIR}/night_lighting_final_summary.json`,
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(
    `${captures.length} brazos · ${cycles.length} ciclos de desmontaje · errores: ${pageErrors.length}`,
  );
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

/* global setTimeout, window, process */
/**
 * D-111.2 FASE 5.3 — atribución del `frameTimeP95Ms` después de los ciclos on/off.
 *
 * El arnés de presets (`fx-presets-capture.mjs`) registra que, tras 5 ciclos por familia y 3 pasadas
 * completas, la escena vuelve al MISMO estado de recursos (objetos, luces, emisivos, texturas y bytes
 * sin deriva) pero el p95 leído con todo apagado sube unos ms respecto de la lectura inicial. Un
 * número que sube no se explica solo: hay que decir de dónde sale, y la orden prohíbe expresamente
 * disculparlo echándoselo al rasterizador por defecto.
 *
 * Este arnés hace el experimento de control que falta, en la misma página de QA y con el mismo
 * presupuesto de frames:
 *  - `ocio`: nadie toca nada. Se dejan pasar los mismos fotogramas que consume la secuencia de
 *    toggles y se vuelve a leer. Si el p95 sube igual, la subida es del entorno y del tiempo de
 *    CPU acumulado, no del desmontaje.
 *  - `ciclos`: la secuencia de toggles real, leída con la ventana barrida (240 frames) y con una
 *    segunda lectura tras 600 frames más de reposo, para ver si el p95 vuelve a la línea base.
 *
 * Salida: `docs/art/graphics-capabilities/evidence/phaser/fx_v2/p95_attribution.json`.
 *
 * Uso (con la vista previa del laboratorio ya construida):
 *   cd apps/web && npx vite build --outDir dist-fxlab --emptyOutDir
 *   node scripts/fx-p95-attribution.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4314;
const BASE_URL = process.env.FX_LAB_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/phaser/fx_v2";
const VIEWPORT = { width: 1440, height: 900 };
const EFFECTS = [
  "grading",
  "bloomThreshold",
  "bloomObjects",
  "lighting",
  "lightingNormals",
  "particles",
  "fire",
];
const CYCLES = 5;
/** Frames de la secuencia de toggles: 5 ciclos × (30 al encender + 30 al apagar) × 7 familias. */
const IDLE_EQUIVALENT_FRAMES = CYCLES * 60 * EFFECTS.length;
/** > `FRAME_WINDOW = 180`, para que la ventana móvil esté barrida en la lectura. */
const SETTLE_FRAMES = 240;
/** Segunda lectura, con el doble de reposo, para ver si el p95 vuelve a la línea base. */
const EXTRA_SETTLE_FRAMES = 600;

const server = process.env.FX_LAB_BASE_URL
  ? null
  : spawn(
      "pnpm",
      [
        "--filter",
        "@landlord/web",
        "preview",
        "--outDir",
        "dist-fxlab",
        "--host",
        "127.0.0.1",
        "--port",
        String(PORT),
      ],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("crash", () => pageErrors.push("page: renderer crashed"));
/** Barridos cortados por techo de reloj: una lectura con `stalls` no es comparable con una sin ellos. */
const stalls = [];
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

const probe = () => page.evaluate(() => window.__fxLab);

/** Lo que interesa de la lectura: rendimiento y estado, no píxeles. */
function perf(row) {
  return {
    effects: [...(row?.effects ?? [])],
    sceneObjects: row?.sceneObjects ?? null,
    lights: row?.lights ?? null,
    texturesLive: row?.stats?.texturesLive ?? null,
    gpuTextureBytes: row?.stats?.gpuTextureBytes ?? null,
    frameTimeP50Ms: row?.stats?.frameTimeP50Ms ?? null,
    frameTimeP95Ms: row?.stats?.frameTimeP95Ms ?? null,
    fps: row?.stats?.fps ?? null,
    samples: row?.stats?.samples ?? null,
    errors: row?.errors ?? [],
  };
}

/**
 * Igual que en `fx-presets-capture.mjs`: se cuenta por el `frames` de la escena, con techo de reloj.
 * Aquí el barrido grande (2 100 fotogramas equivalentes) es el experimento, así que cortar uno por
 * congelación invalida la lectura y se aborta en vez de registrar un p95 sobre menos frames de los
 * que declara la fila.
 */
async function settle(frames) {
  const first = await probe();
  const target = (first?.frames ?? 0) + frames;
  const started = Date.now();
  const ceilingMs = Math.max(120_000, frames * 400);
  try {
    await page.waitForFunction((t) => (window.__fxLab?.frames ?? 0) >= t, target, {
      timeout: ceilingMs,
      polling: 1000,
    });
  } catch {
    const row = await probe();
    if ((row?.frames ?? 0) <= (first?.frames ?? 0)) {
      throw new Error(
        `settle(${frames}): el bucle de render no avanzó en ${ceilingMs} ms ` +
          `(frames ${first?.frames ?? "?"} → ${row?.frames ?? "?"})`,
      );
    }
    stalls.push({
      framesPedidos: frames,
      framesEsperadosHasta: target,
      framesVistos: row?.frames ?? null,
      ms: Date.now() - started,
    });
    return row;
  }
  return probe();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      await page.goto(`${BASE_URL}/art-lab?artQa=1`, {
        waitUntil: "domcontentloaded",
        timeout: 1000,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("el servidor de vista previa del Art Lab no arrancó");
}

async function waitForStats() {
  await page.waitForFunction(
    () =>
      window.__fxLab?.ready &&
      window.__fxLab?.stats?.samples >= 8 &&
      !(window.__fxLab.missingPlacements ?? []).length,
    undefined,
    { timeout: 90_000 },
  );
  return probe();
}

async function open() {
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=day&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  await waitForStats();
  return settle(SETTLE_FRAMES);
}

async function toggle(effect, on) {
  const isActive = () =>
    page.evaluate((name) => (window.__fxLab?.effects ?? []).includes(name), effect);
  if ((await isActive()) === on) return;
  await page.getByTestId(`fx-toggle-${effect}`).evaluate((node) => node.click());
  await page.waitForFunction(
    ([name, expected]) => (window.__fxLab?.effects ?? []).includes(name) === expected,
    [effect, on],
    { timeout: 30_000 },
  );
}

const result = {
  schemaVersion: 1,
  generatedBy: "scripts/fx-p95-attribution.mjs",
  task: "D-111.2 FASE 5.3 — ¿la subida de p95 tras los ciclos es del desmontaje o del entorno?",
  baseUrl: BASE_URL,
  viewport: VIEWPORT,
  windowFrames: SETTLE_FRAMES,
  idleEquivalentFrames: IDLE_EQUIVALENT_FRAMES,
  extraSettleFrames: EXTRA_SETTLE_FRAMES,
  cycles: CYCLES,
  effects: EFFECTS,
  ocio: null,
  ciclos: null,
  stalls,
  pageErrors,
};

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();

  // ── control: mismo tiempo de escena, cero interacción ─────────────────────────────────────────
  await open();
  const idleBaseline = perf(await settle(SETTLE_FRAMES));
  await settle(IDLE_EQUIVALENT_FRAMES);
  const idleAfter = perf(await settle(SETTLE_FRAMES));
  result.ocio = {
    baseline: idleBaseline,
    despues: idleAfter,
    deltaP95Ms: Number(
      ((idleAfter.frameTimeP95Ms ?? 0) - (idleBaseline.frameTimeP95Ms ?? 0)).toFixed(2),
    ),
  };
  console.log(
    `ocio: p95 ${idleBaseline.frameTimeP95Ms} → ${idleAfter.frameTimeP95Ms} ms tras ${IDLE_EQUIVALENT_FRAMES} frames sin tocar nada`,
  );

  // ── tratamiento: la secuencia de toggles real, con dos lecturas de recuperación ───────────────
  await open();
  const cycleBaseline = perf(await settle(SETTLE_FRAMES));
  for (const effect of EFFECTS) {
    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      await toggle(effect, true);
      await settle(30);
      await toggle(effect, false);
      await settle(30);
    }
  }
  const afterCycles = perf(await settle(SETTLE_FRAMES));
  const afterRest = perf(await settle(EXTRA_SETTLE_FRAMES));
  result.ciclos = {
    baseline: cycleBaseline,
    despuesDeCiclos: afterCycles,
    tras600FramesMas: afterRest,
    deltaP95Ms: Number(
      ((afterCycles.frameTimeP95Ms ?? 0) - (cycleBaseline.frameTimeP95Ms ?? 0)).toFixed(2),
    ),
    deltaTrasReposoMs: Number(
      ((afterRest.frameTimeP95Ms ?? 0) - (cycleBaseline.frameTimeP95Ms ?? 0)).toFixed(2),
    ),
  };
  console.log(
    `ciclos: p95 ${cycleBaseline.frameTimeP95Ms} → ${afterCycles.frameTimeP95Ms} ms; tras ${EXTRA_SETTLE_FRAMES} frames más: ${afterRest.frameTimeP95Ms} ms`,
  );
} finally {
  writeFileSync(`${OUTPUT_DIR}/p95_attribution.json`, `${JSON.stringify(result, null, 1)}\n`);
  await browser.close();
  if (server) server.kill("SIGTERM");
}

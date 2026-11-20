/* global setTimeout, window, process */
/**
 * D-111 §7 — captura del laboratorio de capacidades de Phaser 4.
 *
 * Una sola página, un solo juego montado: cada efecto se enciende y se apaga por su toggle (la
 * misma API que usa el humano en `?artQa=1`) y se mide sobre la ventana móvil de frame times de la
 * escena. Medir on/off en la misma corrida es lo que hace comparable el coste: otra página sería
 * otro contexto WebGL, otra carga de texturas y otro estado del rasterizador por software.
 *
 * Produce tres cosas en `docs/art/graphics-capabilities/evidence/phaser/`:
 *  - una PNG por caso (calle de día y de noche, con y sin cada efecto),
 *  - `fx-lab-perf.json` con la tabla on/off (p50, p95, draw calls, texturas vivas),
 *  - `fx-lab-summary.json` con la cadena de mando, el renderer WebGL real y los errores de página.
 *
 * Ningún efecto se activa fuera de esta ruta de QA: el laboratorio vive en `/art-lab` y no tiene
 * relación con el HUD de juego.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4191;
const BASE_URL = process.env.FX_LAB_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/phaser";
const VIEWPORT = { width: 1440, height: 900 };
const EFFECTS = [
  "grading",
  "bloomThreshold",
  "bloomObjects",
  "lighting",
  "lightingNormals",
  "particles",
];
/** Frames que se dejan acumular por etapa: la ventana de la escena son 180, con 200 el estado
 *  anterior se lava casi por completo y la mediana pertenece ya al efecto que se está midiendo. */
const SETTLE_FRAMES = 200;

const server = process.env.FX_LAB_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
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

/** Espera a que la escena del laboratorio exista y tenga frames medidos. */
async function waitForProbe({ withStats = true } = {}) {
  await page.waitForFunction(
    (options) => {
      const probe = window.__fxLab;
      if (!probe?.ready) return false;
      if (!options.withStats) return true;
      return Boolean(probe.stats && probe.stats.samples >= 8);
    },
    { withStats },
    { timeout: 60000 },
  );
  return page.evaluate(() => window.__fxLab);
}

function readProbeRow(probe, label) {
  return {
    label,
    effects: [...probe.effects],
    mood: probe.mood,
    zoom: probe.zoom,
    rendererType: probe.webgl ? "WEBGL" : "CANVAS",
    /** El bucle vivo es lo único que prueba que la PNG siguiente no es el mismo fotograma. */
    frames: probe.frames,
    defaultNormalTexture: probe.defaultNormalTexture,
    emissiveObjects: probe.emissive,
    litObjects: probe.litObjects,
    lights: probe.lights,
    particlesAlive: probe.particles,
    sceneObjects: probe.sceneObjects,
    capabilities: probe.capabilities,
    stats: probe.stats,
    errors: probe.errors,
  };
}

/** Deja pasar `frames` en el bucle de render y lee la sonda al final. */
async function settleAndRead(label, frames = SETTLE_FRAMES) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => {
          seen += 1;
          if (seen >= count) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
  return readProbeRow(await page.evaluate(() => window.__fxLab), label);
}

async function shot(name) {
  const buffer = await page.getByTestId("fx-lab-scene").screenshot();
  const path = `${OUTPUT_DIR}/${name}.png`;
  writeFileSync(path, buffer);
  return { path, bytes: buffer.length, sha256: sha256(buffer) };
}

/** Asienta, lee la sonda y captura. Se registra lo que la escena tiene puesto, no lo que se pidió. */
async function captureShot(name, requested, frames = 40) {
  const row = await settleAndRead(`captura-${name}`, frames);
  images.push({
    case: name,
    mood: row.mood,
    zoom: row.zoom,
    fx: requested,
    active: row.effects,
    frames: row.frames,
    ...(await shot(name)),
  });
}

async function toggle(effect, on) {
  // La fuente de verdad es la escena: `lightingNormals` enciende el rig y el checkbox va por detrás
  // del sondeo de 400 ms de React. Se dispara `click()` en el DOM y se espera la confirmación de la
  // sonda; mirar `isChecked()` aquí leería un estado viejo y invertiría el toggle.
  const active = () =>
    page.evaluate((name) => (window.__fxLab?.effects ?? []).includes(name), effect);
  if ((await active()) === on) return;
  await page.getByTestId(`fx-toggle-${effect}`).evaluate((node) => node.click());
  await page.waitForFunction(
    ([name, expected]) => (window.__fxLab?.effects ?? []).includes(name) === expected,
    [effect, on],
    { timeout: 15000 },
  );
}

async function setMood(mood) {
  await page.getByTestId(`fx-mood-${mood}`).click();
}

async function setZoom(value) {
  // `input[type=range]` controlado por React: `fill()` no dispara el onChange, hay que usar el
  // setter nativo y mandar el evento `input` para que el componente re-renderice.
  await page.getByTestId("fx-zoom").evaluate((node, next) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(node, String(next));
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

const perf = [];
const images = [];

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();

  // ── Medición on/off en WebGL, de día ────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=day&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  const first = await waitForProbe();
  const webglRenderer = first.glRenderer;
  /**
   * `waitForProbe` sale en cuanto hay 8 muestras: esa lectura es un arranque, no una baseline. La
   * tabla on/off exige que el control se mida con la misma ventana de 180 fotogramas que los efectos,
   * si no la comparación es entre tamaños de muestra distintos.
   */
  perf.push(readProbeRow(first, "control-arranque"));
  perf.push(await settleAndRead("control"));
  for (const effect of EFFECTS) {
    await toggle(effect, true);
    perf.push(await settleAndRead(effect));
    await toggle(effect, false);
    await settleAndRead("control-intermedio", 60);
  }
  for (const effect of EFFECTS) await toggle(effect, true);
  perf.push(await settleAndRead("todos"));
  for (const effect of EFFECTS) await toggle(effect, false);
  perf.push(await settleAndRead("control-final"));

  // ── Capturas de la calle (día) ──────────────────────────────────────────────────────────────
  for (const effect of EFFECTS) {
    await toggle(effect, true);
    await captureShot(`street_day_${effect}`, [effect]);
    await toggle(effect, false);
  }
  for (const effect of EFFECTS) await toggle(effect, true);
  await captureShot("street_day_all_effects", EFFECTS);
  for (const effect of EFFECTS) await toggle(effect, false);
  await captureShot("street_day_control", []);

  // ── Capturas de la calle (noche) ────────────────────────────────────────────────────────────
  await setMood("night");
  await settleAndRead("noche", 60);
  await captureShot("street_night_control", [], 20);
  /** `lightingNormals` arrastra el rig: la pareja con `lighting` es el A/B de relieve. */
  for (const effect of ["lighting", "lightingNormals", "bloomObjects", "particles"]) {
    await toggle(effect, true);
    await captureShot(`street_night_${effect}`, [effect]);
    await toggle(effect, false);
  }
  for (const effect of EFFECTS) await toggle(effect, true);
  await captureShot("street_night_all_effects", EFFECTS);
  for (const effect of EFFECTS) await toggle(effect, false);
  await setMood("day");

  // ── Escala de lectura a zoom de calle y a 0,5× (§8.5/§8.6) ──────────────────────────────────
  await setZoom(1);
  await captureShot("street_day_zoom_1x", []);
  await setZoom(0.5);
  await captureShot("street_day_zoom_050x", []);
  await setZoom(1);

  // ── Degradación sin WebGL: el mismo laboratorio con el renderer CANVAS ───────────────────────
  await page.goto(
    `${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxRenderer=canvas&fxMood=day&fx=${EFFECTS.join(",")}`,
    { waitUntil: "domcontentloaded" },
  );
  const canvasProbe = await waitForProbe({ withStats: false });
  await settleAndRead("canvas", 60);
  images.push({
    case: "degrade_canvas_all_effects",
    mood: canvasProbe.mood,
    zoom: canvasProbe.zoom,
    fx: EFFECTS,
    active: canvasProbe.effects,
    frames: canvasProbe.frames,
    ...(await shot("degrade_canvas_all_effects")),
  });
  const canvasRow = readProbeRow(await page.evaluate(() => window.__fxLab), "canvas-todos");

  /**
   * Dos PNG con el mismo sha256 = el canvas no se recompuso entre casos: la evidencia mintió y es
   * mejor escribirlo aquí que descubrirlo al montar la hoja de revisión.
   */
  const hashGroups = new Map();
  for (const image of images) {
    hashGroups.set(image.sha256, [...(hashGroups.get(image.sha256) ?? []), image.case]);
  }
  const identicalFrameGroups = [...hashGroups.values()].filter((cases) => cases.length > 1);
  const allRows = perf.concat([canvasRow]);
  const frozenRows = allRows
    .filter((row, index) => index > 0 && row.frames === allRows[index - 1].frames)
    .map((row) => row.label);

  writeFileSync(
    `${OUTPUT_DIR}/fx-lab-perf.json`,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        task: "D-111 §7 coste on/off de los efectos de Phaser 4",
        frameWindow: 180,
        settleFrames: SETTLE_FRAMES,
        webglRenderer,
        canvasRendererType: canvasRow.rendererType,
        canvasCapabilities: canvasRow.capabilities,
        canvasErrors: canvasRow.errors,
        rows: perf.concat([canvasRow]),
      },
      null,
      1,
    )}\n`,
    "utf8",
  );
  writeFileSync(
    `${OUTPUT_DIR}/fx-lab-summary.json`,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedBy: "scripts/fx-lab-capture.mjs",
        command: `node scripts/fx-lab-capture.mjs`,
        baseUrl: BASE_URL,
        viewport: VIEWPORT,
        page: "/art-lab?artQa=1",
        webglRenderer,
        canvasProbe: {
          webgl: canvasProbe.webgl,
          effects: canvasProbe.effects,
          errors: canvasProbe.errors,
        },
        images,
        pageErrors,
        distinctFrameCount: hashGroups.size,
        identicalFrameGroups,
        frozenRows,
      },
      null,
      1,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        status: "captured",
        webglRenderer,
        images: images.length,
        distinctImages: hashGroups.size,
        identicalFrameGroups,
        frozenRows,
        perfRows: perf.length + 1,
        canvas: canvasRow.rendererType,
        pageErrors: pageErrors.length,
      },
      null,
      1,
    ),
  );
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid);
    } catch {
      // el proceso ya había terminado
    }
  }
}

/* global setTimeout, window, process */
/**
 * D-111.2 FASE 4 — evidencia del incendio animado en Phaser 4.2.1.
 *
 * El encargo pide una secuencia de 6-8 fotogramas del MISMO incendio en momentos diferentes que
 * permita comprobar que no es un sprite estático al que se le añadió brillo. Para que la secuencia
 * valga como prueba tiene que cumplir tres cosas, y las tres se registran aquí:
 *  - la escena está idéntica entre fotograma y fotograma (mismos efectos, mismo mood, mismo zoom,
 *    mismo seed de presentación): lo único que cambia es el reloj de la animación;
 *  - cada fotograma lleva el contador de frames con el que se tomó, así que dos PNG con el mismo
 *    sha256 denuncian un compositor congelado en vez de pasar por «el fuego no se mueve»;
 *  - se mide lo que el rig afirma ser: focos, imágenes de llama, emisores y partículas vivas.
 *
 * Los momentos se muestrean por tiempo de reloj (no por frames) porque los periodos de la envolvente
 * son 1150 ms y 1790 ms: lo que hay que recorrer es el eje temporal, y con rasterizado por software
 * el número de frames por segundo no es constante.
 *
 * Salida en `docs/art/graphics-capabilities/evidence/phaser/fire_sheet/`:
 *  - `frame_NN.png` (los siete momentos) y `fire_sheet.json` (sha256 + sonda por fotograma),
 *  - capturas A/B día/noche y a 0,5× del incendio sobre la calle.
 *
 * Uso (con la vista previa del laboratorio ya construida):
 *   npx vite build --outDir dist-fxlab --emptyOutDir
 *   node scripts/fx-fire-sheet.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4312;
const BASE_URL = process.env.FX_LAB_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/phaser/fire_sheet";
const VIEWPORT = { width: 1440, height: 900 };
/** Siete momentos separados 260 ms: 1560 ms de recorrido, más de un ciclo de la senoide lenta. */
const MOMENTS = 7;
const MOMENT_STEP_MS = 260;

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
const scene = () => page.getByTestId("fx-lab-scene");

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

/** Lee la sonda sólo cuando el incendio está realmente montado y emitiendo. */
async function waitForFire() {
  await page.waitForFunction(
    () => {
      const probe = window.__fxLab;
      return Boolean(probe?.ready && probe.fireActive && (probe.fire?.particlesAlive ?? 0) > 0);
    },
    undefined,
    { timeout: 90_000 },
  );
  return page.evaluate(() => window.__fxLab);
}

async function shot(name) {
  const buffer = await scene().screenshot();
  const path = `${OUTPUT_DIR}/${name}.png`;
  writeFileSync(path, buffer);
  return { path, bytes: buffer.length, sha256: sha256(buffer) };
}

const frames = [];
const shots = [];

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();

  // ── Secuencia: noche, zoom 1, sólo el toggle `fire` (ningún otro efecto en movimiento) ────────
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=night&fxZoom=1&fx=fire`, {
    waitUntil: "domcontentloaded",
  });
  const first = await waitForFire();
  for (let moment = 0; moment < MOMENTS; moment += 1) {
    /** `settle` por reloj: la envolvente depende de `time`, no del número de frames transcurridos. */
    if (moment > 0) await page.waitForTimeout(MOMENT_STEP_MS);
    const probe = await page.evaluate(() => window.__fxLab);
    frames.push({
      moment,
      elapsedMs: moment * MOMENT_STEP_MS,
      frames: probe.frames,
      clockMs: probe.clockMs ?? null,
      fire: probe.fire,
      effects: probe.effects,
      mood: probe.mood,
      zoom: probe.zoom,
      ...(await shot(`frame_${String(moment + 1).padStart(2, "0")}`)),
    });
  }
  const last = await page.evaluate(() => window.__fxLab);
  const distinct = new Set(frames.map((frame) => frame.sha256)).size;
  const identicalGroups = frames
    .map((frame) => frame.sha256)
    .filter((hash, index, all) => all.indexOf(hash) !== index);

  // ── A/B de mood y escala de lectura, con el mismo rig de fuego ────────────────────────────────
  const moodShot = async (mood, extra = []) => {
    await page.goto(
      `${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=${mood}&fxZoom=1&fx=${["fire", ...extra].join(",")}`,
      { waitUntil: "domcontentloaded" },
    );
    const probe = await waitForFire();
    await page.waitForTimeout(900);
    shots.push({
      case: `street_${mood}_fire${extra.length ? `_${extra.join("-")}` : ""}`,
      mood: probe.mood,
      zoom: probe.zoom,
      effects: probe.effects,
      fire: probe.fire,
      fireAnchors: probe.fireAnchors,
      errors: probe.errors,
      ...(await shot(`street_${mood}_fire${extra.length ? `_${extra.join("-")}` : ""}`)),
    });
  };
  await moodShot("day");
  await moodShot("night");
  await moodShot("night", ["lighting"]);
  /**
   * FASE 3 lo exige explícitamente: con `particles` (humo industrial y polvo de obra) encendido junto
   * a `fire`, el edificio tiene que verse UNA vez ardiendo. Es la prueba de que el incendio viejo ya
   * no está en `fx-particles.ts` y de que los dos sistemas no se duplican.
   */
  await moodShot("night", ["particles"]);

  // 0,5×: el encargo exige que la columna siga siendo reconocible a escala de calle.
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=night&fxZoom=0.5&fx=fire`, {
    waitUntil: "domcontentloaded",
  });
  const zoomed = await waitForFire();
  await page.waitForTimeout(900);
  shots.push({
    case: "street_night_fire_050x",
    mood: zoomed.mood,
    zoom: zoomed.zoom,
    effects: zoomed.effects,
    fire: zoomed.fire,
    errors: zoomed.errors,
    ...(await shot("street_night_fire_050x")),
  });

  // ── Control apagado: el mismo encuadre sin el toggle, para atribuir el píxel al efecto ────────
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=night&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__fxLab?.ready, undefined, { timeout: 90_000 });
  await page.waitForTimeout(900);
  const control = await page.evaluate(() => window.__fxLab);
  shots.push({
    case: "street_night_control",
    mood: control.mood,
    zoom: control.zoom,
    effects: control.effects,
    fire: control.fire,
    fireActive: control.fireActive,
    ...(await shot("street_night_control")),
  });

  writeFileSync(
    `${OUTPUT_DIR}/fire_sheet.json`,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedBy: "scripts/fx-fire-sheet.mjs",
        command: "node scripts/fx-fire-sheet.mjs",
        task: "D-111.2 FASE 4 · incendio animado en Phaser 4.2.1",
        page: "/art-lab?artQa=1&fxMood=night&fxZoom=1&fx=fire",
        viewport: VIEWPORT,
        webglRenderer: first.glRenderer ?? null,
        moments: MOMENTS,
        momentStepMs: MOMENT_STEP_MS,
        presentationSeed: 20261121,
        anchors: first.fireAnchors,
        frames,
        /** Dos fotogramas con el mismo sha256 = compositor congelado; `distinct` es la prueba bruta. */
        distinctFrameHashes: distinct,
        identicalFrameHashes: identicalGroups,
        control: { fireActive: control.fireActive, particles: control.particles },
        liveAtEnd: last.fire,
        shots,
        sceneErrors: last.errors,
        pageErrors,
      },
      null,
      1,
    )}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        status:
          distinct === MOMENTS && !pageErrors.length && !last.errors.length ? "ok" : "revisar",
        distinctFrameHashes: distinct,
        of: MOMENTS,
        identicalFrameHashes: identicalGroups,
        anchors: first.fireAnchors,
        liveAtEnd: last.fire,
        sceneErrors: last.errors,
        pageErrors,
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

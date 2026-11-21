/* global setTimeout, window, process */
/**
 * D-111.2 FASE 5 — evidencia de los presets, del balance de exposición y del desmontaje.
 *
 * El encargo exige cuatro cosas comprobables, y este arnés las mide en la página de QA real, por la
 * misma vía que usa un humano:
 *  1. §5.1 los presets existen como CONFIGURACIONES: se pulsan los botones y se registra lo que la
 *     escena dice tener puesto (sonda), no lo que se pidió. Se comprueba además que la URL
 *     (`?fxPreset=…`) llega al mismo estado, que es lo que hace falta para poder reproducir una
 *     captura sin pasar por el ratón.
 *  2. §5.2 el balance nocturno se captura con y sin el preset para poder atribuir el píxel.
 *  3. §5.3 el desmontaje se mide, no se afirma: N ciclos on/off de cada familia y lectura de la
 *     sonda al final de cada ciclo. Si algo no se libera, `sceneObjects`, `emissive`, `lights`,
 *     `texturesLive` o `gpuTextureBytes` crece de forma monótona y aquí queda registrado. Ninguna
 *     cifra se disculpa atribuyéndola al rasterizador: lo que crece es código nuestro.
 *  4. §5.4 el mismo preset nocturno con el renderer CANVAS forzado, para verificar que la calle,
 *     los edificios y el estado de incendio siguen siendo legables sin NINGÚN filtro.
 *
 * Salida en `docs/art/graphics-capabilities/evidence/phaser/fx_v2/`:
 *  - `preset_*.png`, `fallback_canvas_*.png` y `fx_v2.json`.
 *
 * Uso (con la vista previa del laboratorio ya construida):
 *   cd apps/web && npx vite build --outDir dist-fxlab --emptyOutDir
 *   node scripts/fx-presets-capture.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4313;
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
const PRESETS = ["day_balanced", "night_balanced", "night_fire"];
/** Ciclos por familia en §5.3. Con 5 ya se ve cualquier fuga acumulativa; con 20 sería ruido. */
const CYCLES = 5;
/** Frames que se dejan transcurrir entre lecturas para que el bucle estabilice. */
const SETTLE_FRAMES = 45;
/**
 * Techo de reloj por `settle`, en ms. El bucle de Phaser puede congelarse bajo SwiftShader; sin
 * techo el arnés se queda colgado sin dejar evidencia ni error (así murió la corrida del 22:29).
 */
const SETTLE_CEILING_MS = 120_000;

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
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});
/** Los `settle` cortados por techo de reloj: van a la evidencia, no se callan. */
const settleStalls = [];
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const scene = () => page.getByTestId("fx-lab-scene");
const probe = () => page.evaluate(() => window.__fxLab);

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

/**
 * Espera el estado pedido y devuelve la sonda.
 *
 * `complete: true` exige ADEMÁS que ninguna colocación haya quedado sin sprite. Sin ese gate la
 * batería entera se fotografía sobre una calle vacía y sale numéricamente coherente: el 21-11 el
 * estado derivado llegó `undefined`, el `preload` no pidió 7 de 8 edificios y el arnés lo aceptó.
 */
async function waitForReady(options = {}) {
  try {
    await page.waitForFunction(
      (wanted) => {
        const value = window.__fxLab;
        if (!value?.ready) return false;
        if (wanted.complete && (value.missingPlacements ?? []).length) return false;
        if (wanted.preset && value.preset !== wanted.preset) return false;
        if (wanted.effects && value.effects.join(",") !== wanted.effects.join(",")) return false;
        if (wanted.fire && !(value.fireActive && (value.fire?.particlesAlive ?? 0) > 0))
          return false;
        if (wanted.stats && !(value.stats && value.stats.samples >= 8)) return false;
        return true;
      },
      options,
      { timeout: 90_000 },
    );
  } catch (error) {
    const value = await probe().catch(() => null);
    throw new Error(
      `waitForReady(${JSON.stringify(options)}): ${error.name} ` +
        `(ready=${value?.ready}, preset=${value?.preset}, fx=${value?.effects}, ` +
        `objs=${value?.sceneObjects}, sinSprite=${JSON.stringify(value?.missingPlacements)})`,
    );
  }
  return probe();
}

/**
 * Deja pasar fotogramas reales (no milisegundos) y lee la sonda: con rasterizado por software el reloj
 * no es una unidad estable y `setTimeout` mediría estados de animación distintos. Se cuenta por el
 * `frames` de la escena y no por un bucle propio de `requestAnimationFrame` porque el `settle` también
 * tiene que terminar cuando el bucle se congela: la corrida del 22:29 se colgó exactamente ahí.
 */
async function settle(frames = SETTLE_FRAMES) {
  const first = await probe();
  const target = (first?.frames ?? 0) + frames;
  const started = Date.now();
  /** 400 ms/fotograma = 2,5 fps, lo que tarda el rasterizador por software en un barrido grande. */
  const ceilingMs = Math.max(SETTLE_CEILING_MS, frames * 400);
  try {
    await page.waitForFunction((t) => (window.__fxLab?.frames ?? 0) >= t, target, {
      timeout: ceilingMs,
      /** Sondeando por RAF volveríamos a depender del bucle congelado que queremos detectar. */
      polling: 500,
    });
  } catch {
    const row = await probe();
    if ((row?.frames ?? 0) <= (first?.frames ?? 0)) {
      /**
       * Ni un fotograma en el techo de reloj: el bucle está muerto y cualquier captura posterior sería
       * un fijo. Se aborta con el estado a la vista en vez de seguir fotografiando una escena congelada.
       */
      throw new Error(
        `settle(${frames}): el bucle de render no avanzó en ${ceilingMs} ms ` +
          `(frames ${first?.frames ?? "?"} → ${row?.frames ?? "?"}, effects=${row?.effects ?? []})`,
      );
    }
    settleStalls.push({
      framesPedidos: frames,
      framesEsperadosHasta: target,
      framesVistos: row?.frames ?? null,
      ms: Date.now() - started,
    });
    return row;
  }
  return probe();
}

/** Resumen de la sonda que interesa a §5.3: contadores de recursos, no de píxeles. */
function resources(row) {
  return {
    effects: [...(row?.effects ?? [])],
    preset: row?.preset ?? null,
    sceneObjects: row?.sceneObjects ?? null,
    emissiveObjects: row?.emissive ?? null,
    litObjects: row?.litObjects ?? null,
    lights: row?.lights ?? null,
    particlesAlive: row?.particles ?? null,
    texturesLive: row?.stats?.texturesLive ?? null,
    gpuTextureBytes: row?.stats?.gpuTextureBytes ?? null,
    drawCalls: row?.stats?.drawCalls ?? null,
    frameTimeP50Ms: row?.stats?.frameTimeP50Ms ?? null,
    frameTimeP95Ms: row?.stats?.frameTimeP95Ms ?? null,
    fps: row?.stats?.fps ?? null,
    fire: row?.fire ?? null,
    errors: row?.errors ?? [],
  };
}

async function shot(name) {
  const buffer = await scene().screenshot();
  const path = `${OUTPUT_DIR}/${name}.png`;
  writeFileSync(path, buffer);
  return { path, bytes: buffer.length, sha256: sha256(buffer) };
}

/** Enciende/apaga por el toggle de la página y espera la confirmación de la escena. */
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

/** Aplica el preset pulsando su botón (§5.1: es una configuración, no una macro). */
async function applyPreset(name, { requireFire = false } = {}) {
  await page.getByTestId(`fx-preset-${name}`).evaluate((node) => node.click());
  return waitForReady(
    requireFire ? { preset: name, fire: true, complete: true } : { preset: name, complete: true },
  );
}

const presets = [];
const teardown = { cycles: [], baseline: null, final: null };
const fallback = [];

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();
  log("servidor y página listos");

  // ── §5.1 presets aplicados desde la UI ────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=day&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  const control = await waitForReady({ stats: true, complete: true });
  await settle(120);
  teardown.baseline = resources(await settle(120));
  const controlShot = { case: "control_day", ...(await shot("control_day")), ...teardown.baseline };

  log("§5.1 presets aplicados por botón");
  for (const name of PRESETS) {
    /**
     * `night_fire` no se fotografía con el humo apagado: en la corrida del 21-11 el frame salió con
     * `fire.particlesAlive = 0`, así que la hoja documentaba un incendio sin humo. Se espera a que el
     * rig tenga partículas vivas y la sonda se lee DESPUÉS del settle, sobre el frame que se dispara.
     */
    await applyPreset(name, { requireFire: name === "night_fire" });
    await settle(60);
    presets.push({
      preset: name,
      via: "botón",
      probe: resources(await probe()),
      expectedMood: name === "day_balanced" ? "day" : "night",
      ...(await shot(`preset_${name}`)),
    });
  }

  /** 0,5× con el preset de incendio: el encargo exige la comparación de escala en esta hoja. */
  log("zoom 0,5 sobre night_fire");
  await page.getByTestId("fx-zoom").evaluate((node) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(node, "0.5");
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.__fxLab?.zoom === 0.5, undefined, { timeout: 30_000 });
  await waitForReady({ preset: "night_fire", fire: true, complete: true });
  await settle(40);
  const zoomRow = await probe();
  presets.push({
    preset: "night_fire",
    via: "botón + zoom 0,5",
    probe: resources(zoomRow),
    expectedMood: "night",
    ...(await shot("preset_night_fire_050x")),
  });
  await page.getByTestId("fx-zoom").evaluate((node) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(node, "1");
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => window.__fxLab?.zoom === 1, undefined, { timeout: 30_000 });

  /** Control nocturno SIN ningún preset: es la referencia contra la que se lee el preset equilibrado. */
  log("control nocturno apagado");
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=night&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  const nightControl = await waitForReady({ complete: true });
  await settle(60);
  presets.push({
    preset: null,
    via: "control nocturno apagado",
    probe: resources(nightControl),
    expectedMood: "night",
    ...(await shot("control_night")),
  });

  // ── §5.1 el preset también entra por URL (reproducibilidad de las capturas) ───────────────────
  log("preset por URL fxPreset=night_fire");
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxPreset=night_fire&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  const fromUrl = await waitForReady({ preset: "night_fire", fire: true, complete: true });
  const urlRow = { preset: "night_fire", via: "URL fxPreset=", probe: resources(fromUrl) };

  // ── §5.3 ciclos on/off por familia, con la sonda al final de cada ciclo ───────────────────────
  log("§5.3 ciclos on/off por familia");
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=day&fxZoom=1`, {
    waitUntil: "domcontentloaded",
  });
  await waitForReady({ stats: true, complete: true });
  const before = resources(await settle(120));
  for (const effect of EFFECTS) {
    log(`§5.3 ${effect} ${CYCLES} ciclos`);
    const perCycle = [];
    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      await toggle(effect, true);
      await settle(30);
      await toggle(effect, false);
      perCycle.push(resources(await settle(30)));
    }
    const last = perCycle[perCycle.length - 1];
    teardown.cycles.push({
      effect,
      cycles: CYCLES,
      primeraLectura: perCycle[0],
      ultimaLectura: last,
      /** Diferencia entre el ciclo 1 y el ciclo 5 con el mismo estado (todo apagado). */
      deriva: {
        sceneObjects: (last?.sceneObjects ?? 0) - (perCycle[0]?.sceneObjects ?? 0),
        emissiveObjects: (last?.emissiveObjects ?? 0) - (perCycle[0]?.emissiveObjects ?? 0),
        lights: (last?.lights ?? 0) - (perCycle[0]?.lights ?? 0),
        litObjects: (last?.litObjects ?? 0) - (perCycle[0]?.litObjects ?? 0),
        particlesAlive: (last?.particlesAlive ?? 0) - (perCycle[0]?.particlesAlive ?? 0),
        texturesLive: (last?.texturesLive ?? 0) - (perCycle[0]?.texturesLive ?? 0),
        gpuTextureBytes: (last?.gpuTextureBytes ?? 0) - (perCycle[0]?.gpuTextureBytes ?? 0),
      },
    });
  }
  /** Y el ciclo completo: todo ON / todo OFF, que es donde se vería un efecto duplicado. */
  for (let pass = 1; pass <= 3; pass += 1) {
    for (const effect of EFFECTS) await toggle(effect, true);
    await settle(30);
    for (const effect of EFFECTS) await toggle(effect, false);
  }
  teardown.before = before;
  /**
   * 240 fotogramas > la ventana móvil de la escena (`FRAME_WINDOW = 180`): si se lee antes, el p95
   * «final» todavía lleva dentro los frames con TODO encendido y la recuperación parece falsa. Con la
   * ventana barrida por completo, lo que queda es el coste real del estado apagado.
   */
  teardown.final = resources(await settle(240));
  teardown.recovered = EFFECTS.map((effect, index) => ({
    effect,
    deriva: teardown.cycles[index].deriva,
  }));
  teardown.p95BaselineMs = before.frameTimeP95Ms;
  teardown.p95AfterCyclesMs = teardown.final.frameTimeP95Ms;

  // ── §5.4 degradación CANVAS con el preset de incendio ─────────────────────────────────────────
  log("§5.4 fallback CANVAS");
  for (const [caseName, query, requireFire] of [
    ["fallback_canvas_night_control", "&fxMood=night", false],
    ["fallback_canvas_night_fire", "&fxPreset=night_fire", true],
  ]) {
    await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxRenderer=canvas&fxZoom=1${query}`, {
      waitUntil: "domcontentloaded",
    });
    const row = await waitForReady(
      requireFire ? { fire: true, complete: true } : { complete: true },
    );
    await settle(40);
    const live = await probe();
    fallback.push({
      case: caseName,
      probe: resources(live),
      /** Sin WebGL los filtros no existen: lo que hay que probar es que la CALLE se reconoce igual. */
      buildings: live.ready,
      rendererType: live.webgl ? "WEBGL" : "CANVAS",
      capabilitiesWebGlOnly: {
        filters: live.capabilities?.["Camera.filters.internal.addColorMatrix"] ?? null,
        applied: live.effects,
      },
      ...(await shot(caseName)),
    });
    if (row.errors.length) fallback[fallback.length - 1].errorsAtBoot = row.errors;
  }

  const evidence = {
    schemaVersion: 1,
    generatedBy: "scripts/fx-presets-capture.mjs",
    command: "node scripts/fx-presets-capture.mjs",
    task: "D-111.2 FASE 5 · presets, balance de exposición, desmontaje y fallback CANVAS",
    baseUrl: BASE_URL,
    viewport: VIEWPORT,
    webglRenderer: control.glRenderer ?? null,
    cyclesPerEffect: CYCLES,
    /** `settle` cortados por `SETTLE_CEILING_MS`: si hay alguno, el p95 de esa lectura es sobre menos
     *  fotogramas de los pedidos y se dice aquí en vez de presentarlo como una medida limpia. */
    settleStalls,
    presetFromUrl: urlRow,
    presets,
    controlDay: controlShot,
    teardown,
    canvasFallback: fallback,
    pageErrors,
  };
  writeFileSync(`${OUTPUT_DIR}/fx_v2.json`, `${JSON.stringify(evidence, null, 1)}\n`, "utf8");

  const leaked = teardown.cycles.filter((entry) =>
    Object.values(entry.deriva).some((value) => value !== 0),
  );
  console.log(
    JSON.stringify(
      {
        status: leaked.length || pageErrors.length || settleStalls.length ? "revisar" : "ok",
        settleStalls,
        presets: presets.map(
          (entry) => `${entry.preset ?? "control"}:${entry.probe.effects.length}`,
        ),
        presetFromUrl: urlRow.probe.effects,
        leaks: leaked.map((entry) => ({ effect: entry.effect, deriva: entry.deriva })),
        finalVsBaseline: {
          sceneObjects: `${before.sceneObjects} → ${teardown.final.sceneObjects}`,
          texturesLive: `${before.texturesLive} → ${teardown.final.texturesLive}`,
          gpuTextureBytes: `${before.gpuTextureBytes} → ${teardown.final.gpuTextureBytes}`,
          lights: `${before.lights} → ${teardown.final.lights}`,
          emissiveObjects: `${before.emissiveObjects} → ${teardown.final.emissiveObjects}`,
          p95Ms: `${before.frameTimeP95Ms} → ${teardown.final.frameTimeP95Ms}`,
        },
        canvasFallback: fallback.map((entry) => ({
          case: entry.case,
          renderer: entry.rendererType,
          effects: entry.probe.effects,
          fire: entry.probe.fire,
          errors: entry.probe.errors.length,
        })),
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

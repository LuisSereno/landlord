/* global process */
/**
 * D-111 §9.8 — smoke de la escena QA de Phaser (`/art-lab?artQa=1`).
 *
 * comprueba lo que la captura a fondo no puede comprobar barato, en tres minutos en vez de veinte:
 *  - que el bucle sigue vivo entre casos (contador de frames),
 *  - que ningún toggle lanza dentro del batcher WebGL,
 *  - que apagar un efecto devuelve EXACTAMENTE el fotograma anterior (disposer idempotente),
 *  - que cambiar el zoom cambia el canvas: si no cambia, el compositor está congelado y cualquier
 *    PNG de la batería grande sería una evidencia falsa.
 *
 * Los tres primeros se rompieron el 2026-11-20 al iluminar la escena; la batería larga los detectaba
 * nueve minutos tarde y sin decir cuál.
 *
 * Requiere la vista previa del laboratorio:
 *   npx vite build --outDir dist-fxlab --emptyOutDir
 *   npx vite preview --outDir dist-fxlab --host 127.0.0.1 --port 4311
 *   FX_LAB_BASE_URL=http://127.0.0.1:4311 node scripts/fx-lab-smoke.mjs [day|night]
 */
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.FX_LAB_BASE_URL ?? "http://127.0.0.1:4311";
const MOOD = process.argv[2] === "night" ? "night" : "day";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));

const probe = () => page.evaluate(() => window.__fxLab);
const settle = (frames) =>
  page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => (++seen >= count ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    frames,
  );
const shot = async () => sha(await page.getByTestId("fx-lab-scene").screenshot());
/** El click va por DOM: el checkbox de React refleja la escena con el retardo del sondeo. */
const toggle = (effect) => page.getByTestId(`fx-toggle-${effect}`).evaluate((node) => node.click());

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  return ok;
};

try {
  await page.goto(`${BASE_URL}/art-lab?artQa=1&fxPerf=1&fxMood=${MOOD}&fx=lighting`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__fxLab?.ready, undefined, { timeout: 60000 });

  const lit = await probe();
  check(
    "rig montado desde la URL",
    lit.effects.join(",") === "lighting" && lit.litObjects > 0,
    `effects=${lit.effects.join(",")} lit=${lit.litObjects} lights=${lit.lights}`,
  );
  const before = await shot();
  await settle(90);
  const still = await probe();
  check("bucle vivo", still.frames > lit.frames, `${lit.frames} → ${still.frames} frames`);
  check("fotograma estable sin toggles", (await shot()) === before, before);

  await toggle("lightingNormals");
  await settle(120);
  const withNormals = await probe();
  check(
    "las normales arrastran el rig",
    withNormals.effects.join(",") === "lighting,lightingNormals",
    withNormals.effects.join(","),
  );
  const relief = await shot();
  check("el relieve cambia la imagen", relief !== before, `${before} → ${relief}`);

  await toggle("lightingNormals");
  await settle(120);
  const restored = await probe();
  check(
    "apagar normales deja sólo el rig",
    restored.effects.join(",") === "lighting",
    restored.effects.join(","),
  );
  check("el disposer devuelve el fotograma anterior", (await shot()) === before, before);

  await page.getByTestId("fx-zoom").evaluate((node) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(node, "0.5");
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle(60);
  check("el zoom llega al canvas", (await shot()) !== before, "compositor vivo a 0,5×");
  check("sin errores de escena", restored.errors.length === 0, restored.errors.join(" | ") || "0");
  check("sin errores de página", pageErrors.length === 0, pageErrors.join(" | ") || "0");
} finally {
  await browser.close();
}

const failed = checks.filter((entry) => !entry.ok);
console.log(
  JSON.stringify(
    {
      status: failed.length ? "failed" : "ok",
      mood: MOOD,
      checks: checks.length,
      failed: failed.map((f) => f.name),
    },
    null,
    1,
  ),
);
for (const entry of checks)
  console.log(`${entry.ok ? "ok  " : "FAIL"} ${entry.name} · ${entry.detail}`);
process.exitCode = failed.length ? 1 : 0;

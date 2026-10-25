/* global setTimeout, window */
/**
 * Smoke del Art Lab en navegador (WP4.15-H): comprueba las tres direcciones, la galería procedural,
 * la tarjeta de la ruta Blender y —a diferencia del smoke anterior— que el perfil denso es una escena
 * Phaser real con texturas registradas, incluidas las cuatro de Blender.
 */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4175;
const externalServerUrl = process.env.ART_LAB_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/art-lab?static=1`, {
        waitUntil: "domcontentloaded",
        timeout: 500,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor del Art Lab no arrancó");
}

try {
  await waitForServer();
  await page.getByRole("heading", { name: "Art Lab" }).waitFor();
  const cards = page.locator("[data-direction]");
  if ((await cards.count()) !== 3) throw new Error("El Art Lab no muestra las tres direcciones");
  const images = page.locator("[data-direction] img");
  for (let index = 0; index < 3; index += 1) {
    const image = images.nth(index);
    await image.waitFor({ state: "visible" });
    if ((await image.evaluate((element) => element.naturalWidth)) !== 1024) {
      throw new Error(`El render ${index} no tiene el ancho esperado`);
    }
  }
  const buildings = page.locator("[data-building]");
  if ((await buildings.count()) !== 5)
    throw new Error("La factoría no muestra los cinco edificios");
  const characters = page.locator("[data-character]");
  if ((await characters.count()) !== 2) throw new Error("La factoría no muestra dos personajes");
  for (const card of await buildings.all()) {
    const stateImages = card.locator("img");
    if ((await stateImages.count()) !== 4) throw new Error("Faltan estados de edificio");
    for (const image of await stateImages.all()) {
      await image.waitFor({ state: "visible" });
      if ((await image.evaluate((element) => element.naturalWidth)) === 0) {
        throw new Error("Una imagen de estado no cargó");
      }
    }
  }
  const blenderCard = page.locator("[data-blender-e2e]");
  if ((await blenderCard.count()) !== 1) throw new Error("Falta la tarjeta de la ruta Blender");
  const blenderImages = blenderCard.locator("img");
  const blenderImageCount = await blenderImages.count();
  if (blenderImageCount !== 8)
    throw new Error(
      `La tarjeta Blender no muestra 4 estados y 4 direcciones (${blenderImageCount})`,
    );
  for (const image of await blenderImages.all()) {
    await image.waitFor({ state: "visible" });
    if ((await image.evaluate((element) => element.naturalWidth)) === 0) {
      throw new Error("Una imagen de la ruta Blender no cargó");
    }
  }
  await page.screenshot({ path: "artifacts/art-lab-visual-direction-spike.png", fullPage: true });

  await page.goto(`${baseUrl}/art-lab?density=60&static=1`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="dense-scene"]').waitFor();
  await page.waitForFunction(() => window.__artLabDenseReady === true, undefined, {
    timeout: 30_000,
  });
  if ((await page.locator('[data-testid="dense-scene"] canvas').count()) < 1)
    throw new Error("El perfil denso no monta un canvas de Phaser");
  const blenderTextures = await page.evaluate(() => window.__artLabBlenderTextures ?? 0);
  if (blenderTextures !== 4)
    throw new Error(`Phaser no registró las cuatro texturas de Blender (${blenderTextures})`);
  await page.waitForFunction(() => typeof window.__artLabFps === "number", undefined, {
    timeout: 10_000,
  });
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: "passed",
      url: `${baseUrl}/art-lab`,
      directions: await cards.count(),
      buildings: await buildings.count(),
      characters: await characters.count(),
      blenderImages: blenderImageCount,
      denseSprites: await page.evaluate(() => window.__artLabSprites ?? 0),
      denseFps: await page.evaluate(() => window.__artLabFps ?? 0),
      screenshot: "artifacts/art-lab-visual-direction-spike.png",
    }),
  );
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

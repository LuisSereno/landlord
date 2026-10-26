/* global setTimeout, window */
/**
 * Smoke del Art Lab / Asset QA (WP4.15-H.1): comprueba edificios, comparación procedural/Blender,
 * personajes, QA técnico y archivo visual secundario. El perfil denso sigue siendo opt-in y usa una
 * escena Phaser real con las cuatro texturas Blender registradas.
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
  await page.getByRole("heading", { name: "Art Lab / Asset QA" }).waitFor();
  await page.getByTestId("asset-qa").waitFor();
  await page.getByTestId("procedural-blender-comparison").waitFor();
  await page.getByTestId("character-qa").waitFor();
  await page.getByTestId("technical-qa").waitFor();
  const archive = page.getByTestId("visual-direction-archive");
  await archive.waitFor();
  if (await archive.evaluate((element) => element.hasAttribute("open"))) {
    throw new Error("El archivo visual no debe dominar la pantalla por defecto");
  }
  await archive.locator("summary").click();
  const cards = page.locator("[data-direction]");
  if ((await cards.count()) !== 3) throw new Error("El archivo no conserva las tres direcciones");
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
  if ((await characters.count()) !== 3)
    throw new Error("Character QA no muestra dos personajes procedurales y el E2E Blender");
  for (const card of await characters.all()) {
    const directionFrames = card.locator("[data-walk-direction]");
    const directionCount = Number(await card.getAttribute("data-character-directions"));
    if ((await directionFrames.count()) !== directionCount || directionCount < 4) {
      throw new Error("Character QA no muestra walk por dirección");
    }
    if (!(await card.innerText()).includes("idle") || !(await card.innerText()).includes("walk")) {
      throw new Error("Character QA no identifica idle y walk");
    }
  }
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
    throw new Error(`La comparación no muestra 4 estados por fuente (${blenderImageCount})`);
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

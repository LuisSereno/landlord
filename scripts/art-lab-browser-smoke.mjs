/* global setTimeout */

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
      await page.goto(`${baseUrl}/art-lab`, { waitUntil: "domcontentloaded", timeout: 500 });
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
  const cards = page.locator(".art-lab-card");
  if ((await cards.count()) !== 3) throw new Error("El Art Lab no muestra las tres direcciones");
  const images = page.locator(".art-lab-card img");
  for (let index = 0; index < 3; index += 1) {
    const image = images.nth(index);
    await image.waitFor({ state: "visible" });
    if ((await image.evaluate((element) => element.naturalWidth)) !== 1024) {
      throw new Error(`El render ${index} no tiene el ancho esperado`);
    }
  }
  await page.screenshot({ path: "artifacts/art-lab-visual-direction-spike.png", fullPage: true });
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: "passed",
      url: `${baseUrl}/art-lab`,
      directions: await cards.count(),
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

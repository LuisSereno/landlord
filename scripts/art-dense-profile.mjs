/* global setTimeout, window */
/**
 * Perfil de contenido denso del Art Lab (WP4.15): pinta N sprites del manifiesto y mide FPS de
 * pintado DOM. No sustituye al benchmark Phaser (`pnpm benchmark:browser`), que mide el frame del
 * juego; aquí se comprueba que la factoría escala en la superficie de contenido.
 */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4177;
const count = Math.max(1, Math.min(600, Number(process.env.ART_DENSE_SPRITES ?? 400)));
const externalServerUrl = process.env.ART_DENSE_BASE_URL;
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

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/art-lab?density=${count}`, {
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
  await page.locator('[data-testid="dense-scene"]').waitFor();
  await page.waitForFunction(() => typeof window.__artLabFps === "number");
  const samples = [];
  for (let index = 0; index < 10; index += 1) {
    await page.waitForTimeout(500);
    samples.push(await page.evaluate(() => window.__artLabFps ?? 0));
  }
  const sorted = [...samples].sort((left, right) => left - right);
  console.log(
    JSON.stringify({
      status: "profiled",
      sprites: count,
      samples,
      min: sorted[0],
      median: sorted[Math.floor(sorted.length / 2)],
      max: sorted.at(-1),
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

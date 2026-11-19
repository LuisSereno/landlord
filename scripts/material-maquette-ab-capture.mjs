/* global setTimeout, window */
/** Captura reproducible del control/candidata en la misma ciudad, zoom y viewport. */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4187;
const baseUrl = process.env.MATERIAL_MAQUETTE_BASE_URL ?? `http://127.0.0.1:${port}`;
const server = process.env.MATERIAL_MAQUETTE_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const outputDir = "docs/art/material-maquette-spike/ab";
const viewport = { width: 1440, height: 900 };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/?cameraTest=1`, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor de la comparación visual no arrancó");
}

try {
  mkdirSync(outputDir, { recursive: true });
  await waitForServer();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
  if ((await page.getByRole("group", { name: "Comparación de dirección visual" }).count()) > 0) {
    throw new Error("El selector A/B de arte apareció en el HUD normal sin artQa=1");
  }
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("landlord-gate1");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }),
  );
  await page.goto(`${baseUrl}/?cameraTest=1&artQa=1&artDirection=graphic_civic`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
  await page.locator(".map-canvas canvas").first().waitFor();
  await page
    .getByRole("button", { name: "Pausar simulación" })
    .click()
    .catch(() => {});
  await page.waitForTimeout(700);

  const records = [];
  for (const mood of ["day", "night"]) {
    await page.getByRole("button", { name: mood === "day" ? "Día" : "Noche" }).click();
    await page.waitForTimeout(250);
    for (const direction of ["graphic_civic", "material_maquette_candidate"]) {
      await page
        .getByRole("button", { name: direction === "graphic_civic" ? "Control" : "Maqueta" })
        .click();
      await page.locator(".map-canvas canvas").first().waitFor();
      await page.waitForFunction(
        ({ expectedDirection, expectedMood }) => {
          const selector = document.querySelector('[aria-label="Comparación de dirección visual"]');
          const pressedDirection = [...(selector?.querySelectorAll("button") ?? [])].find(
            (button) => button.getAttribute("aria-pressed") === "true",
          )?.textContent;
          return (
            document.documentElement.dataset.visualDirection === expectedDirection &&
            document.documentElement.dataset.visualMood === expectedMood &&
            pressedDirection === (expectedDirection === "graphic_civic" ? "Control" : "Maqueta")
          );
        },
        { expectedDirection: direction, expectedMood: mood },
        { timeout: 3000 },
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => ({
        direction: document.documentElement.dataset.visualDirection,
        mood: document.documentElement.dataset.visualMood,
        camera: window.__landlordCameraTest?.getCamera(),
        visual: window.__gameplayVisualStats?.(),
      }));
      if (state.direction !== direction || state.mood !== mood) {
        throw new Error(
          `A/B no coincide: ${JSON.stringify({ expected: { direction, mood }, state })}`,
        );
      }
      const filename = `${mood}-${direction}.png`;
      const screenshot = await page.screenshot({ path: `${outputDir}/${filename}` });
      records.push({
        filename,
        direction,
        mood,
        viewport,
        camera: state.camera,
        sha256: createHash("sha256").update(screenshot).digest("hex"),
        bytes: screenshot.length,
      });
    }
  }
  if (pageErrors.length) throw new Error(`Errores de página: ${pageErrors.join("; ")}`);
  writeFileSync(
    `${outputDir}/manifest.json`,
    `${JSON.stringify({ schemaVersion: 1, scene: "fresh default city", pageErrors, captures: records }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      { status: "captured", count: records.length, outputDir, captures: records },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  if (server?.pid) process.kill(-server.pid, "SIGTERM");
}

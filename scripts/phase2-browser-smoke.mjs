/* global setTimeout */

import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4174;
const externalServerUrl = process.env.PHASE2_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}/`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 500 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor del smoke de Gate 2 no arrancó");
}

try {
  await waitForServer();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByText("Velocidad ajustada a 4×.").waitFor();
  await page.getByText("Materiales y producción").click();
  await page.getByRole("button", { name: "Comprar 2" }).first().click();
  await page.getByText(/Compradas 2 unidades/).waitFor();
  await page.getByRole("button", { name: "Invertir" }).first().click();
  await page.getByText(/Producción propia/).waitFor();
  const canvas = page.locator("canvas").first();
  let parcelFound = false;
  for (const position of [
    { x: 512, y: 288 },
    { x: 576, y: 320 },
    { x: 640, y: 352 },
    { x: 704, y: 384 },
  ]) {
    await canvas.click({ position });
    await page.waitForTimeout(30);
    const inspector = await page.getByLabel("Inspección de parcela").innerText();
    if (inspector.includes("Disponible")) {
      parcelFound = true;
      break;
    }
  }
  if (!parcelFound) throw new Error("No se encontró una parcela disponible en el canvas");
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page.getByText(/Parcela comprada/).waitFor();
  await page.locator("button.construction-option").first().click();
  await page.getByText(/en construcción/).waitFor();
  await page.getByRole("button", { name: "Asignar 2 cuadrillas" }).click();
  await page.getByText(/Dos cuadrillas concentradas/).waitFor();
  await page.getByText(/1 edificios/).waitFor({ timeout: 45000 });
  await page
    .getByRole("button", { name: /Ocupar con/ })
    .first()
    .click();
  await page.getByText(/Inquilino asignado/).waitFor();
  await page.getByRole("button", { name: /^Mejorar:/ }).click();
  await page.getByText(/Mejora iniciada/).waitFor();
  await page.getByRole("button", { name: "Asignar 2 cuadrillas" }).click();
  await page.getByText(/Mejora completada/).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Promover ordenanza" }).click();
  await page.getByText(/propuesta fue resuelta/).waitFor();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor();

  await page.reload();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor();
  await page.getByRole("button", { name: "Intentar ruta ilegal" }).click();
  await page.getByText(/acción de riesgo fue procesada/).waitFor();
  await page.getByText(/^Rival:/).waitFor();
  await page.getByRole("button", { name: "Ocultar panel" }).click();
  if ((await page.locator("#operations-panel").getAttribute("aria-hidden")) !== "true") {
    throw new Error("El panel operativo no se plegó");
  }
  await page.getByRole("button", { name: "Abrir panel" }).click();
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: await page.locator('[role="status"]').innerText(),
      selected: await page.getByLabel("Inspección de parcela").innerText(),
      metrics: (await page.locator("main").innerText()).match(/CAJA\n.*|ACTIVOS\n.*/g),
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

/* global setTimeout */

import { mkdirSync, writeFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
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
const artifactPath = "artifacts/browser/phase2-smoke-result.json";
mkdirSync("artifacts/browser", { recursive: true });
const result = {
  head: execSync("git rev-parse HEAD").toString().trim(),
  startedAt: new Date().toISOString(),
  functionalAssertionsComplete: false,
  functionalStatus: "RUNNING",
  cleanupComplete: false,
  steps: [],
  failure: null,
};
function saveResult() {
  writeFileSync(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
}
function milestone(name, status = "PASS") {
  result.steps.push({ name, status, elapsedMs: Math.round(performance.now() - startedAt) });
  saveResult();
}
const startedAt = performance.now();
saveResult();
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

let pendingError = null;
try {
  await waitForServer();
  milestone("server-ready");
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  milestone("worker-connected");
  await page.getByRole("button", { name: "4×" }).click();
  await page.getByText("Velocidad ajustada a 4×.").waitFor();
  await page.getByText("Materiales y producción").click();
  await page.getByRole("button", { name: "Comprar 2" }).first().click();
  await page.getByText(/Compradas 2 unidades/).waitFor();
  milestone("materials-purchased");
  const canvas = page.locator("canvas").first();
  let parcelFound = false;
  for (const position of [
    { x: 512, y: 288 },
    { x: 576, y: 320 },
    { x: 640, y: 352 },
    { x: 704, y: 384 },
    { x: 384, y: 352 },
    { x: 512, y: 416 },
  ]) {
    await canvas.click({ position });
    await page.waitForTimeout(30);
    const inspector = await page.getByLabel("Inspección de parcela").innerText();
    if (inspector.includes("Industrial") && inspector.includes("Disponible")) {
      parcelFound = true;
      break;
    }
  }
  if (!parcelFound) throw new Error("No se encontró una parcela disponible en el canvas");
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page.getByText(/Parcela comprada/).waitFor();
  await page.getByText(/Aptitud productiva/).waitFor();
  await page.getByRole("button", { name: /Planta de cemento/ }).click();
  await page.getByText(/en construcción/).waitFor();
  milestone("construction-started");
  await page.getByRole("button", { name: /crew_00000001/ }).click();
  await page.getByText(/Crew enviada a la obra/).waitFor();
  await page.getByRole("button", { name: /crew_00000002/ }).click();
  await page.getByText(/Crew enviada a la obra/).waitFor();
  await page.getByText(/1 edificios/).waitFor({ timeout: 60000 });
  await page.getByText(/Producción media:/).waitFor();
  milestone("construction-completed");
  await page.getByRole("button", { name: /Ampliar fábrica/ }).click();
  await page.getByText(/Ampliación iniciada/).waitFor();
  await page.getByRole("button", { name: /crew_00000001/ }).click();
  await page.getByText(/Crew enviada a la obra/).waitFor();
  await page.getByRole("button", { name: /crew_00000002/ }).click();
  await page.getByText(/Ampliación completada/).waitFor({ timeout: 60000 });
  milestone("upgrade-completed");
  await page.getByRole("button", { name: "Promover ordenanza" }).click();
  await page.getByText(/propuesta fue resuelta/).waitFor();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor();

  await page.reload();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor();
  await page.getByText(/Riesgo táctico/).waitFor();
  await page.getByText(/^Rival:/).waitFor();
  await page.getByRole("button", { name: "Ocultar panel" }).click();
  if ((await page.locator("#operations-panel").getAttribute("aria-hidden")) !== "true") {
    throw new Error("El panel operativo no se plegó");
  }
  result.functionalAssertionsComplete = true;
  result.functionalStatus = "PASS";
  milestone("functional-assertions-complete");
  await page.getByRole("button", { name: "Abrir panel" }).click();
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: await page.locator('[role="status"]').innerText(),
      selected: await page.getByLabel("Inspección de parcela").innerText(),
      metrics: (await page.locator("main").innerText()).match(/CAJA\n.*|ACTIVOS\n.*/g),
    }),
  );
} catch (error) {
  result.functionalStatus = "FAIL";
  result.failure = { phase: "functional", message: String(error) };
  saveResult();
  pendingError = error;
} finally {
  try {
    await browser.close();
    if (server) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
    result.cleanupComplete = true;
    saveResult();
  } catch (error) {
    result.functionalStatus =
      result.functionalStatus === "RUNNING" ? "FAIL" : result.functionalStatus;
    result.failure ??= { phase: "cleanup", message: String(error) };
    saveResult();
    pendingError ??= error;
  }
}
if (pendingError) throw pendingError;

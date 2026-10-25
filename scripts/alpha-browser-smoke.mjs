/* global setTimeout */

import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4175;
const externalServerUrl = process.env.ALPHA_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}/`;
const fixturePath = new URL("./fixtures/alpha-phase4.snapshot.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
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
  throw new Error("El servidor del smoke Alpha no arrancó");
}

async function injectSnapshot() {
  await page.evaluate(async (snapshot) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("landlord-gate1", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("snapshots", { keyPath: "slotId" });
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("snapshots", "readwrite");
        transaction.objectStore("snapshots").put({
          slotId: "default",
          schemaVersion: 1,
          engineVersion: snapshot.engineVersion,
          savedAt: Date.now(),
          snapshot,
        });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, fixture);
}

function readCash(text) {
  const match = text.match(/CAJA\n(\d+)/);
  if (!match) throw new Error("No se pudo leer la caja del panel");
  return Number(match[1]);
}

try {
  await waitForServer();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await injectSnapshot();
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor({ timeout: 15000 });

  const body = await page.locator("main").innerText();
  for (const category of ["administración", "seguridad", "transporte", "limpieza"]) {
    if (!body.includes(category)) throw new Error(`Falta la categoría municipal ${category}`);
  }
  if (!/gasto planificado \d+ u\./.test(body)) throw new Error("El gasto municipal no suma");
  if (body.includes("RAZON-PRIVADA-RIVAL") || body.includes("ACCION-PRIVADA-RIVAL")) {
    throw new Error("La proyección filtró el razonamiento privado del rival");
  }

  await page.getByText("Concejo municipal").click();
  const council = await page
    .getByText(/Gobierna:/)
    .locator("..")
    .innerText();
  if (!/participación \d+%/.test(council)) throw new Error("El concejo no muestra participación");
  const seats = await page
    .getByText(/escaños ·/)
    .first()
    .innerText();
  if (!/\d+% de apoyo/.test(seats)) throw new Error("El concejo no muestra apoyo por partido");
  const mood = await page
    .getByText(/Ánimo del distrito:/)
    .locator("..")
    .innerText();
  for (const issue of ["vivienda", "empleo", "seguridad", "servicios", "impuestos"]) {
    if (!mood.includes(issue)) throw new Error(`Falta el eje de ánimo ${issue}`);
  }

  await page.getByRole("button", { name: /Presentar oferta/ }).click();
  await page.getByText(/Oferta presentada/).waitFor({ timeout: 15000 });
  await page.getByText(/tu oferta 260 u\./).waitFor({ timeout: 15000 });

  const cashBefore = readCash(await page.locator("main").innerText());
  await page.getByRole("button", { name: /Investigar caja disponible/ }).click();
  await page.getByText(/Encargo de caja disponible enviado/).waitFor({ timeout: 15000 });
  await page.getByText(/caja disponible estimada .* por contacto/).waitFor({ timeout: 15000 });
  const cashAfter = readCash(await page.locator("main").innerText());
  if (cashAfter > cashBefore - 150) {
    throw new Error(
      `La caja no refleja el coste de la investigación: ${cashBefore} → ${cashAfter}`,
    );
  }

  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor({ timeout: 15000 });
  await page.reload();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor({ timeout: 15000 });
  await page.getByText("Concejo municipal").click();
  await page.getByText(/Gobierna:/).waitFor({ timeout: 15000 });
  await page.getByText(/tu oferta 260 u\./).waitFor({ timeout: 15000 });

  const finalBody = await page.locator("main").innerText();
  if (finalBody.includes("RAZON-PRIVADA-RIVAL")) {
    throw new Error("El estado privado del rival llegó al DOM tras la carga");
  }
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: await page.locator('[role="status"]').innerText(),
      council: await page
        .getByText(/Gobierna:/)
        .locator("..")
        .innerText(),
      metrics: finalBody.match(/CAJA\n.*/g),
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

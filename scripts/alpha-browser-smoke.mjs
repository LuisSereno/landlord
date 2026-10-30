/* global setTimeout, window */

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

const CAMERA_CELL = { x: 25, y: 20 };

async function canvasPointForCell(cell) {
  const point = await page.evaluate(
    (target) => window.__landlordCameraTest.getCellScreenPoint(target),
    cell,
  );
  const canvas = page.locator(".map-canvas canvas").first();
  const metrics = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      x: bounds.x,
      y: bounds.y,
      scaleX: bounds.width / element.width,
      scaleY: bounds.height / element.height,
      width: element.width,
      height: element.height,
    };
  });
  if (point.x < 0 || point.y < 0 || point.x > metrics.width || point.y > metrics.height) {
    throw new Error(`La celda ${cell.x},${cell.y} no queda visible: ${JSON.stringify(point)}`);
  }
  return {
    game: point,
    page: {
      x: metrics.x + point.x * metrics.scaleX,
      y: metrics.y + point.y * metrics.scaleY,
    },
    metrics,
  };
}

async function configureCamera(zoom, scrollX, scrollY) {
  await page.evaluate((next) => window.__landlordCameraTest.configure(next), {
    zoom,
    scrollX,
    scrollY,
  });
  await page.waitForFunction(
    (expected) => Math.abs(window.__landlordCameraTest.getCamera().zoom - expected) < 0.001,
    zoom,
  );
}

async function pickCell(cell) {
  /**
   * V.d-UX: el viewport ya no es el mismo lienzo que en Alpha (HUD compacto arriba, sin panel
   * permanente) así que una celda concreta puede caer fuera con un scroll fijo. Se centra antes
   * de medir: el test verifica picking y cámara, no una posición de píxel concreta.
   */
  await page.evaluate((target) => window.__landlordCameraTest.centerOnCell(target), cell);
  const point = await canvasPointForCell(cell);
  await page.mouse.click(point.page.x, point.page.y);
  await page.waitForFunction((expected) => {
    const selected = window.__landlordCameraTest.getSelectedCell();
    return selected?.x === expected.x && selected?.y === expected.y;
  }, cell);
  return point;
}

async function dragCameraAtZoom(zoom) {
  await configureCamera(zoom, 1_000, 1_000);
  const before = await page.evaluate(() => window.__landlordCameraTest.getCamera());
  const canvas = page.locator(".map-canvas canvas").first();
  const metrics = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      x: bounds.x,
      y: bounds.y,
      scaleX: bounds.width / element.width,
      scaleY: bounds.height / element.height,
      width: element.width,
      height: element.height,
    };
  });
  const start = {
    x: metrics.x + metrics.width * 0.45 * metrics.scaleX,
    y: metrics.y + metrics.height * 0.45 * metrics.scaleY,
  };
  const screenDelta = { x: 120, y: 60 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(
    start.x + screenDelta.x * metrics.scaleX,
    start.y + screenDelta.y * metrics.scaleY,
    { steps: 5 },
  );
  await page.mouse.up({ button: "right" });
  const after = await page.evaluate(() => window.__landlordCameraTest.getCamera());
  const visualX = (after.scrollX - before.scrollX) * zoom;
  const visualY = (after.scrollY - before.scrollY) * zoom;
  if (Math.abs(visualX + screenDelta.x) > 1.5 || Math.abs(visualY + screenDelta.y) > 1.5) {
    throw new Error(
      `Pan inconsistente a ${zoom}x: world ${after.scrollX - before.scrollX},${after.scrollY - before.scrollY}; visual ${visualX},${visualY}`,
    );
  }
  return after;
}

async function verifyCameraRegression() {
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined);
  await page.locator(".map-canvas canvas").first().waitFor();

  for (const zoom of [0.5, 1, 2, 2.5]) {
    await configureCamera(zoom, 300, 500);
    await pickCell(CAMERA_CELL);
  }

  for (const zoom of [0.5, 1, 2]) await dragCameraAtZoom(zoom);

  await configureCamera(1, 1_000, 1_000);
  await dragCameraAtZoom(1);
  await pickCell({ x: 45, y: 20 });

  await dragCameraAtZoom(1);
  /** V.d-UX: se centra el ancla para que el zoom no toque los límites de la cámara. */
  const anchoredCell = { x: 45, y: 20 };
  await page.evaluate((target) => window.__landlordCameraTest.centerOnCell(target), anchoredCell);
  const anchor = await canvasPointForCell(anchoredCell);
  const before = await page.evaluate(
    (point) => window.__landlordCameraTest.getWorldPoint(point),
    anchor.game,
  );
  await page.mouse.move(anchor.page.x, anchor.page.y);
  await page.mouse.wheel(0, -750);
  await page.waitForFunction(() => window.__landlordCameraTest.getCamera().zoom > 1.7);
  const after = await page.evaluate(
    (point) => window.__landlordCameraTest.getWorldPoint(point),
    anchor.game,
  );
  if (Math.abs(before.x - after.x) > 0.05 || Math.abs(before.y - after.y) > 0.05) {
    throw new Error(
      `El zoom no conservó el punto bajo cursor: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
    );
  }
  await page.mouse.click(anchor.page.x, anchor.page.y);
  await page.waitForFunction((expected) => {
    const selected = window.__landlordCameraTest.getSelectedCell();
    return selected?.x === expected.x && selected?.y === expected.y;
  }, anchoredCell);
}

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
          schemaVersion: 2,
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
  const cameraTestUrl = new URL(baseUrl);
  cameraTestUrl.searchParams.set("cameraTest", "1");
  await page.goto(cameraTestUrl.toString(), { waitUntil: "domcontentloaded" });
  await verifyCameraRegression();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  await injectSnapshot();
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor({ timeout: 15000 });

  /** V.d-UX: los sistemas globales viven en hubs; el HUD sólo muestra estado frecuente. */
  const openGovernment = async () => {
    await page.getByRole("button", { name: "Gobierno", exact: true }).click();
    await page
      .getByRole("complementary", { name: "Gobierno municipal" })
      .waitFor({ timeout: 15000 });
  };
  await openGovernment();
  const body = await page.getByRole("complementary", { name: "Gobierno municipal" }).innerText();
  for (const category of ["administración", "seguridad", "transporte", "limpieza"]) {
    if (!body.includes(category)) throw new Error(`Falta la categoría municipal ${category}`);
  }
  if (!/Gasto planificado\s+\d+ u\./i.test(body)) throw new Error("El gasto municipal no suma");
  if (body.includes("RAZON-PRIVADA-RIVAL") || body.includes("ACCION-PRIVADA-RIVAL")) {
    throw new Error("La proyección filtró el razonamiento privado del rival");
  }

  if (!/Gobierna /i.test(body)) throw new Error("El concejo no se renderizó en Gobierno");
  if (!/participación \d+ %/.test(body)) throw new Error("El concejo no muestra participación");
  if (!/\d+ % de apoyo/.test(body)) throw new Error("El concejo no muestra apoyo por partido");
  const moodIndex = body.indexOf("Ánimo del distrito");
  if (moodIndex < 0) throw new Error("Falta el ánimo del distrito");
  const mood = body.slice(moodIndex);
  for (const issue of ["vivienda", "empleo", "seguridad", "servicios", "impuestos"]) {
    if (!mood.includes(issue)) throw new Error(`Falta el eje de ánimo ${issue}`);
  }

  // V.d.0: la vista de ciudad lista los nueve distritos; cambiar el observado no ejecuta un comando.
  await page.locator(".hud-district").click();
  const cityTiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  const tileCount = await cityTiles.count();
  if (tileCount !== 9)
    throw new Error(`La vista de ciudad debería listar 9 distritos y lista ${tileCount}`);
  // La caja es de ciudad: cambiar de distrito no puede moverla.
  const cashBeforeSwitch = readCash(await page.locator("main").innerText());
  await cityTiles.filter({ hasText: "Patios del Este" }).click();
  await page
    .locator(".hud-district")
    .filter({ hasText: "Patios del Este" })
    .waitFor({ timeout: 15000 });
  const cashAfterSwitch = readCash(await page.locator("main").innerText());
  if (cashAfterSwitch !== cashBeforeSwitch) {
    throw new Error(`Cambiar de distrito movió la caja: ${cashBeforeSwitch} → ${cashAfterSwitch}`);
  }
  await page.locator(".hud-district").click();
  await cityTiles.filter({ hasText: "Barrio del Umbral" }).click();
  await page
    .locator(".hud-district")
    .filter({ hasText: "Barrio del Umbral" })
    .waitFor({ timeout: 15000 });

  await openGovernment();
  const bidButton = page.getByRole("button", { name: /Presentar oferta/ });
  const tenderLine = await page
    .getByText(/presupuesto \d+ u\. · fianza/)
    .first()
    .innerText();
  const budget = Number(tenderLine.match(/presupuesto (\d+) u\./)[1]);
  const submittedBid = Number(
    (await bidButton.innerText()).match(/Presentar oferta · (\d+) u\./)[1],
  );
  if (!(submittedBid >= 1 && submittedBid <= budget)) {
    throw new Error(`La puja por defecto ${submittedBid} no cabe en el presupuesto ${budget}`);
  }
  await bidButton.click();
  await page.getByText(/Oferta presentada/).waitFor({ timeout: 15000 });
  await page.getByText(new RegExp(`tu oferta ${submittedBid} u\\.`)).waitFor({ timeout: 15000 });

  await page.locator(".hud-district").click();
  await page.getByRole("complementary", { name: "Ciudad" }).waitFor({ timeout: 15000 });
  const cashBefore = readCash(await page.locator("main").innerText());
  await page.getByRole("button", { name: /Investigar caja disponible/ }).click();
  await page.getByText(/Encargo de inteligencia enviado/).waitFor({ timeout: 15000 });
  await page.getByText(/caja disponible: \d+ u\. · \d+ % de acierto/).waitFor({ timeout: 15000 });
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
  await openGovernment();
  await page
    .getByText(/Gobierna /)
    .first()
    .waitFor({ timeout: 15000 });
  await page.getByText(new RegExp(`tu oferta ${submittedBid} u\\.`)).waitFor({ timeout: 15000 });

  const finalBody = await page.locator("main").innerText();
  if (finalBody.includes("RAZON-PRIVADA-RIVAL")) {
    throw new Error("El estado privado del rival llegó al DOM tras la carga");
  }
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: await page.locator('[role="status"]').innerText(),
      council: await page
        .getByRole("complementary", { name: "Gobierno municipal" })
        .getByText(/Gobierna /i)
        .first()
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

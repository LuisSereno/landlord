/* global window, document, setTimeout */

/**
 * Captura la evidencia de revisión humana de V.d-7B. Los hooks usados sólo viven bajo
 * `?cameraTest=1`; cada selección de mapa y entidad sigue pasando por el input real de Phaser.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const port = 4187;
const baseUrl = process.env.VD7B_BASE_URL ?? `http://127.0.0.1:${port}/`;
const server = process.env.VD7B_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const output = "docs/art/golden/vd7b";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("No arrancó el preview para la evidencia V.d-7B");
}

async function freshCity() {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("landlord-gate1");
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }),
  );
  await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest && window.__landlordUiTest, null, {
    timeout: 30000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
}

async function shot(name) {
  await page.screenshot({ path: `${output}/${name}`, type: "png" });
}

async function clickCell(cell) {
  await page.evaluate((target) => window.__landlordCameraTest.centerOnCell(target), cell);
  const point = await page.evaluate(
    (target) => window.__landlordCameraTest.getCellScreenPoint(target),
    cell,
  );
  const metrics = await page
    .locator(".map-canvas canvas")
    .first()
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        scaleX: bounds.width / element.width,
        scaleY: bounds.height / element.height,
      };
    });
  await page.mouse.click(
    metrics.x + point.x * metrics.scaleX,
    metrics.y + point.y * metrics.scaleY,
  );
}

async function buyCurrentParcel() {
  const buy = page.getByRole("button", { name: /Comprar (?:para ampliar · |parcela)/ }).first();
  await buy.waitFor({ timeout: 15000 });
  await buy.click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 });
}

async function selectIndustrialDistrict() {
  await page.locator(".hud-district").click();
  const tile = page
    .locator('[aria-label="Distritos"] [role="gridcell"]')
    .filter({ hasText: "Industria" })
    .first();
  await tile.click();
  await page.waitForTimeout(1200);
  await page.waitForFunction(
    () => window.__landlordUiTest?.marketableParcelCellForType("cement_plant") !== null,
    null,
    { timeout: 30000 },
  );
}

async function beginAssembly(buildingType, visibleName) {
  const anchor = await page.evaluate(
    (type) => window.__landlordUiTest.marketableParcelCellForType(type),
    buildingType,
  );
  if (!anchor) throw new Error(`No hay solar para ${buildingType}`);
  await clickCell(anchor);
  await buyCurrentParcel();
  const card = page.locator(".build-card", { hasText: visibleName }).first();
  await card.click();
  await page.getByRole("button", { name: "Elegir solares" }).click();
  const assembly = page.getByLabel("Ensamblado de solar");
  await assembly.waitFor({ timeout: 10000 });
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Ensamblado de solar"]')?.textContent?.includes("1/"),
    null,
    { timeout: 10000 },
  );
  return anchor;
}

async function buyAndAddNextAssemblyParcel() {
  const pending = await page.evaluate(() => window.__landlordUiTest.pendingSite());
  const target = pending?.adjacentAvailableCells[0];
  if (!target) throw new Error("No hay parcela adyacente comprable para el ensamblado");
  await clickCell(target);
  await buyCurrentParcel();
  await page.getByRole("button", { name: "Añadir este solar" }).click();
  await page.getByLabel("Ensamblado de solar").waitFor({ timeout: 10000 });
}

async function capturePrimaryStates() {
  await freshCity();
  await shot("01-normal-city.png");

  const toolbar = page.getByRole("toolbar", { name: "Capas del mapa" });
  await toolbar.getByRole("button", { name: "Propiedad", exact: true }).click();
  await toolbar.getByRole("button", { name: "Propiedad", exact: true }).last().click();
  await shot("02-ownership-parcels.png");
  await toolbar.getByRole("button", { name: "Riesgo", exact: true }).click();
  await toolbar.getByRole("button", { name: "Riesgo regulatorio", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.overlay-toolbar [aria-pressed="true"]')
        ?.textContent?.includes("Riesgo"),
    null,
    { timeout: 10000 },
  );
  await shot("03-risk-parcels.png");
  await toolbar.getByRole("button", { name: "Vista normal" }).click();

  const large = await page.evaluate(() => window.__landlordUiTest.largestMarketableParcel());
  if (!large) throw new Error("No hay parcela grande marketable");
  await clickCell(large.cell);
  await page.getByRole("complementary", { name: "Inspección de parcela" }).waitFor();
  await shot("04-large-parcel-selected.png");
  await page
    .locator(".map-canvas")
    .screenshot({ path: `${output}/05-road-frontage-selected.png`, type: "png" });

  const tooltip = page.getByRole("button", { name: "Ayuda: Valor del suelo" });
  await tooltip.hover();
  await page.locator(".help-tooltip-floating").waitFor({ timeout: 10000 });
  const bounds = await page.locator(".help-tooltip-floating").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  if (
    bounds.left < 8 ||
    bounds.right > bounds.width - 8 ||
    bounds.top < 8 ||
    bounds.bottom > bounds.height - 8
  )
    throw new Error(`Tooltip fuera de viewport: ${JSON.stringify(bounds)}`);
  await shot("13-tooltip-land-value.png");

  const school = await page.evaluate(() => window.__landlordUiTest.facilityCell("school"));
  if (!school) throw new Error("No hay escuela proyectada");
  await clickCell(school);
  const inspector = page.getByRole("complementary", { name: "Inspección de parcela" });
  await inspector.waitFor();
  await shot("06-school-selected.png");
  await inspector.screenshot({ path: `${output}/14-facility-panel.png`, type: "png" });
}

async function captureDirectPicking() {
  await freshCity();
  const parcel = await page.evaluate(() => window.__landlordUiTest.marketableParcelCell());
  if (!parcel) throw new Error("No hay solar para vivienda");
  await clickCell(parcel);
  await buyCurrentParcel();
  await page.locator(".build-card", { hasText: "Patio residencial" }).first().click();
  await page.getByRole("button", { name: "Construir" }).click();
  await page.getByText(/Obra nueva en curso/).waitFor({ timeout: 20000 });
  const siteId = await page.evaluate(() => {
    const pending = window.__landlordUiTest.pendingSite();
    return pending?.buildingType ?? null;
  });
  if (siteId !== null) throw new Error("La obra directa no debe dejar ensamblado pendiente");
  const constructionPoint = await page.evaluate(() => {
    const api = window.__landlordCameraTest;
    return window.__landlordUiTest.ownedBuildingId()
      ? null
      : api.getEntityScreenPoint("site_00000001");
  });
  if (constructionPoint) {
    const canvas = await page.locator(".map-canvas canvas").first().boundingBox();
    if (!canvas) throw new Error("No hay canvas");
    await page.mouse.click(canvas.x + constructionPoint.x, canvas.y + constructionPoint.y);
  }
  await shot("08-construction-selected.png");
  await page
    .getByRole("button", { name: /Asignar Cuadrilla/ })
    .first()
    .click();
  await page.getByText(/Cuadrilla asignada/).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('nav[aria-label="Secciones del edificio"]') !== null,
    null,
    { timeout: 240000 },
  );
  const buildingId = await page.evaluate(() => window.__landlordUiTest.ownedBuildingId());
  const point = buildingId
    ? await page.evaluate((id) => window.__landlordCameraTest.getEntityScreenPoint(id), buildingId)
    : null;
  if (!point) throw new Error("No se pudo localizar el sprite del edificio terminado");
  const canvas = await page.locator(".map-canvas canvas").first().boundingBox();
  if (!canvas) throw new Error("No hay canvas");
  await page.mouse.click(canvas.x + point.x, canvas.y + point.y);
  await page.locator('nav[aria-label="Secciones del edificio"]').waitFor({ timeout: 10000 });
  await shot("07-private-building-selected.png");
  await page.setViewportSize({ width: 1280, height: 720 });
  await shot("15-1280x720.png");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot("16-1920x1080.png");
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function captureAssemblies() {
  await freshCity();
  await selectIndustrialDistrict();
  await beginAssembly("cement_plant", "Planta de cemento");
  await page.getByLabel("Ensamblado de solar").scrollIntoViewIfNeeded();
  await shot("09-cement-assembly-1-of-2.png");
  await buyAndAddNextAssemblyParcel();
  await shot("10-cement-assembly-2-of-2.png");

  // La cementera es el proyecto multi-parcela legítimo de menor trabajo disponible (120), por
  // delante de la acería (168) que ya documenta el ensamblado 3/3 en la evidencia 11.
  await page.getByRole("button", { name: /Iniciar obra con 2 solares/ }).click();
  await page.getByText(/Obra nueva en curso/).waitFor({ timeout: 20_000 });
  await page
    .getByRole("button", { name: /Asignar Cuadrilla/ })
    .first()
    .click();
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.waitForFunction(() => window.__landlordUiTest?.ownedBuildingId() !== null, null, {
    // 120 unidades a 4×, con margen 1,5× sobre el avance observado en la proyección.
    timeout: 300_000,
  });
  const cementBuildingId = await page.evaluate(() => window.__landlordUiTest.ownedBuildingId());
  const cementPoint = cementBuildingId
    ? await page.evaluate(
        (id) => window.__landlordCameraTest.getEntityScreenPoint(id),
        cementBuildingId,
      )
    : null;
  if (!cementPoint) throw new Error("No se pudo localizar la cementera terminada");
  const cementCanvas = await page.locator(".map-canvas canvas").first().boundingBox();
  if (!cementCanvas) throw new Error("No hay canvas para la cementera terminada");
  await page.mouse.click(cementCanvas.x + cementPoint.x, cementCanvas.y + cementPoint.y);
  await page.locator('nav[aria-label="Secciones del edificio"]').waitFor({ timeout: 10_000 });
  await shot("12-multiparcel-building.png");

  await freshCity();
  await selectIndustrialDistrict();
  await beginAssembly("steelworks", "Acería");
  await buyAndAddNextAssemblyParcel();
  await buyAndAddNextAssemblyParcel();
  await shot("11-steelworks-assembly-3-of-3.png");
}

function assertEvidenceIntegrity() {
  const names = [
    "01-normal-city.png",
    "02-ownership-parcels.png",
    "03-risk-parcels.png",
    "04-large-parcel-selected.png",
    "05-road-frontage-selected.png",
    "06-school-selected.png",
    "07-private-building-selected.png",
    "08-construction-selected.png",
    "09-cement-assembly-1-of-2.png",
    "10-cement-assembly-2-of-2.png",
    "11-steelworks-assembly-3-of-3.png",
    "12-multiparcel-building.png",
    "13-tooltip-land-value.png",
    "14-facility-panel.png",
    "15-1280x720.png",
    "16-1920x1080.png",
  ];
  const hashes = new Map();
  for (const name of names) {
    const hash = createHash("sha256")
      .update(readFileSync(`${output}/${name}`))
      .digest("hex");
    if (hashes.has(hash)) throw new Error(`Evidencia duplicada: ${name} == ${hashes.get(hash)}`);
    hashes.set(hash, name);
  }
}

try {
  await waitForServer();
  const capture = process.env.VD7B_CAPTURE ?? "all";
  if (capture === "all" || capture === "primary") await capturePrimaryStates();
  if (capture === "all" || capture === "direct") await captureDirectPicking();
  if (capture === "all" || capture === "assemblies") await captureAssemblies();
  if (capture === "all") assertEvidenceIntegrity();
  if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(JSON.stringify({ status: "ok", output, pageErrors: 0 }, null, 2));
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

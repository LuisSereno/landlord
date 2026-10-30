/* global setTimeout, window, document */

/**
 * §2.3 · Smoke del core loop de V.d sobre la UI real (React + worker de simulación + Phaser).
 *
 * No sustituye tests unitarios ni gates: su trabajo es detectar roturas de integración en el camino
 * que recorre el jugador —seleccionar, comprar, permiso, construir, cuadrilla, terminar, gestionar,
 * guardar, cargar, cambiar de distrito, suelo público bloqueado, overlays y ordenanza de densidad— y
 * fallar nombrando el paso concreto.
 */

import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = 4176;
const externalServerUrl = process.env.VD_SMOKE_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}/`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
const steps = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

function step(name) {
  steps.push(name);
  console.log(`VD-SMOKE ${String(steps.length).padStart(2, "0")} · ${name}`);
}

function fail(name, detail) {
  throw new Error(`Paso "${name}" falló — ${detail}`);
}

async function canvasPointForCell(cell) {
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
        width: element.width,
        height: element.height,
      };
    });
  if (point.x < 0 || point.y < 0 || point.x > metrics.width || point.y > metrics.height)
    return null;
  return {
    x: metrics.x + point.x * metrics.scaleX,
    y: metrics.y + point.y * metrics.scaleY,
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

/** Clic en una celda sin exigir que el picking acierte: quien decide si sirvió es el panel. */
async function clickCell(cell) {
  const point = await canvasPointForCell(cell);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  await page
    .waitForFunction(
      (expected) => {
        const selected = window.__landlordCameraTest.getSelectedCell();
        return selected?.x === expected.x && selected?.y === expected.y;
      },
      cell,
      { timeout: 1200 },
    )
    .catch(() => {});
  const selected = await page.evaluate(() => {
    const value = window.__landlordCameraTest.getSelectedCell();
    return value ? { x: value.x, y: value.y } : null;
  });
  return selected !== null && selected.x === cell.x && selected.y === cell.y;
}

async function inspectorText() {
  const panel = page.locator('[aria-label="Inspección de parcela"]');
  if ((await panel.count()) === 0) return "";
  return await panel.innerText();
}

function cashOf(body) {
  const match = body.match(/CAJA\n(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor del smoke V.d no arrancó");
}

/** Ciudad nueva: se borra el slot para no heredar el guardado del smoke Alpha. */
async function startFreshCity() {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const removal = indexedDB.deleteDatabase("landlord-gate1");
        removal.onsuccess = () => resolve();
        removal.onerror = () => resolve();
        removal.onblocked = () => resolve();
      }),
  );
  await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(() => window.__landlordCameraTest !== undefined, null, { timeout: 30000 })
    .catch(() => {});
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
}

try {
  await waitForServer();

  // 1 · iniciar ciudad
  await startFreshCity();
  step("1 · ciudad iniciada con worker conectado");

  // 2 · nueve distritos (V.d-UX: la ciudad vive en su hub, no en un panel permanente)
  await page.locator(".hud-district").click();
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  await tiles.first().waitFor({ timeout: 20000 });
  const tileCount = await tiles.count();
  if (tileCount !== 9) fail("nueve distritos", `la vista de ciudad lista ${tileCount}`);
  step("2 · cuadrícula 3×3 con 9 distritos");
  await page.getByRole("button", { name: "Cerrar panel" }).click();

  // 3 · seleccionar una parcela marketable (localizada por el hook observacional de test)
  await configureCamera(0.5, 1000, 1000);
  const marketableCell = await page.evaluate(
    () => window.__landlordUiTest?.marketableParcelCell() ?? null,
  );
  if (!marketableCell)
    fail("seleccionar parcela", "la proyección no publica ninguna parcela comprable");
  await page.evaluate((cell) => window.__landlordCameraTest.centerOnCell(cell), marketableCell);
  await clickCell(marketableCell);
  const buyButton = page.getByRole("button", { name: "Comprar parcela" });
  if ((await buyButton.count()) === 0 || !(await buyButton.isEnabled()))
    fail("seleccionar parcela", "la parcela localizada no ofrece compra");
  step(`3 · parcela marketable seleccionada en ${marketableCell.x},${marketableCell.y}`);

  // 4 · comprar
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  let panel = await inspectorText();
  if (!/Tu solar|Tu empresa/.test(panel))
    fail("comprar parcela", `el inspector no refleja la propiedad: ${panel.slice(0, 180)}`);
  step("4 · parcela comprada");

  // 5 y 6 · iniciar construcción desde el catálogo visual (StartConstruction emite el permiso)
  const housingOption = page
    .locator(".construction-option", { hasText: "Patio residencial" })
    .first();
  await housingOption.waitFor({ timeout: 20000 }).catch(() => {});
  if ((await housingOption.count()) === 0)
    fail("opciones de construcción", `sin oferta de vivienda: ${await inspectorText()}`);
  const optionText = await housingOption.innerText();
  if (/Necesitas|No tienes una cuadrilla|La parcela no permite/.test(optionText))
    fail("opciones de construcción", `el jugador no puede pagar su primera obra: ${optionText}`);
  /** La tarjeta abre el detalle; «Construir» es la acción que envía el comando. */
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (/Obra nueva en curso|en curso/.test(await inspectorText())) break;
    await housingOption.click({ timeout: 5000 }).catch(() => {});
    const build = page.getByRole("button", { name: "Construir" });
    if ((await build.count()) > 0 && (await build.isEnabled()))
      await build.click({ timeout: 5000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  panel = await inspectorText();
  if (!/en curso/.test(panel))
    fail("iniciar construcción", `la obra no aparece en el inspector: ${panel.slice(0, 220)}`);
  if (/\b(approved|consumed)\b/.test(panel))
    fail("permiso", `el inspector filtra el enum del permiso: ${panel.slice(0, 220)}`);
  step("5-6 · permiso obtenido y construcción iniciada");

  // 7 · asignar cuadrilla (nombre legible, sin `crew_…`)
  const crewButton = page.getByRole("button", { name: /Asignar Cuadrilla \d+/ }).first();
  await crewButton.waitFor({ timeout: 20000 }).catch(() => {});
  if ((await crewButton.count()) === 0)
    fail("asignar cuadrilla", `sin cuadrilla libre: ${await inspectorText()}`);
  await crewButton.click();
  await page
    .getByText(/Cuadrilla asignada/)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => fail("asignar cuadrilla", "la asignación no se confirmó"));
  step("7 · cuadrilla asignada a la obra");

  // 8 · avanzar hasta completar
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page
    .waitForFunction(
      () => document.querySelector('nav[aria-label="Secciones del edificio"]') !== null,
      null,
      { timeout: 240000 },
    )
    .catch(() => {});
  panel = await inspectorText();
  if (/en curso/.test(panel) || !/Inquilinos/.test(panel))
    fail(
      "terminar la construcción",
      JSON.stringify({
        enObra: panel.match(/.{0,50}en curso.{0,50}/s)?.[0] ?? null,
        asset: /Inquilinos/.test(panel),
        head: panel.slice(0, 260),
      }),
    );
  step("8 · construcción terminada");

  // 9 · gestionar el edificio desde su pestaña de inquilinos
  await page.getByRole("button", { name: "Inquilinos" }).first().click();
  const occupy = page.getByRole("button", { name: /Ocupar con/ }).first();
  if ((await occupy.count()) > 0 && (await occupy.isEnabled())) {
    await occupy.click();
    await page
      .getByText(/Inquilino asignado/)
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => fail("gestionar edificio", "la asignación de unidad no se confirmó"));
    step("9 · edificio gestionable: unidad asignada");
  } else {
    step("9 · edificio gestionable (sin unidad compatible en cartera)");
  }

  // 10 y 11 · guardar y cargar
  const cashBeforeSave = cashOf(await page.locator("main").innerText());
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor({ timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Cargar" }).click();
  await page
    .getByText(/Snapshot cargado/)
    .first()
    .waitFor({ timeout: 30000 });
  step("10-11 · guardado y cargado desde IndexedDB");

  // 12 · persistencia
  await page.locator(".hud-district").waitFor({ timeout: 30000 });
  const afterLoad = await page.locator("main").innerText();
  if (cashOf(afterLoad) !== cashBeforeSave)
    fail("persistencia", `la caja cambió al cargar: ${cashBeforeSave} → ${cashOf(afterLoad)}`);
  /** La selección es estado de UI: tras cargar hay que volver a señalar la parcela propia. */
  await configureCamera(0.5, 1000, 1000);
  const reopened = await page.evaluate(
    () => window.__landlordUiTest?.ownedBuildingParcelCell() ?? null,
  );
  if (!reopened)
    fail("persistencia", "el edificio terminado no aparece tras recargar la partida guardada");
  await page.evaluate((cell) => window.__landlordCameraTest.centerOnCell(cell), reopened);
  await clickCell(reopened);
  if ((await page.locator('nav[aria-label="Secciones del edificio"]').count()) === 0)
    fail("persistencia", "el panel del edificio no abre tras recargar la partida guardada");
  step(`12 · persistencia verificada (caja y edificio en ${reopened.x},${reopened.y})`);

  // 13 y 14 · cambiar de distrito sin mover la caja
  await page.locator(".hud-district").click();
  await tiles.first().waitFor({ timeout: 20000 });
  const districtNames = await tiles.allInnerTexts();
  const observed = await page.locator(".hud-district").innerText();
  let targetIndex = districtNames.findIndex(
    (name) => !observed.includes(name.split("\n")[0].trim()),
  );
  if (targetIndex < 0) targetIndex = 1;
  const cashBeforeSwitch = cashOf(afterLoad);
  await tiles.nth(targetIndex).click();
  const wanted = districtNames[targetIndex].split("\n")[0].trim();
  await page
    .locator(".hud-district")
    .filter({ hasText: wanted })
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => fail("cambiar distrito", `el observado sigue sin ser ${wanted}`));
  const cashAfterSwitch = cashOf(await page.locator("main").innerText());
  if (cashAfterSwitch !== cashBeforeSwitch)
    fail(
      "observar distrito",
      `la caja se movió al observar: ${cashBeforeSwitch} → ${cashAfterSwitch}`,
    );
  step(`13-14 · distrito observado ${wanted} sin tocar la caja`);

  // 15 y 16 · suelo público inspeccionable y cerrado a la operación privada
  /** El programa municipal se concentra en el Centro Cívico: allí se busca el suelo público. */
  await page.locator(".hud-district").click();
  const civicTile = tiles.filter({ hasText: "Centro Cívico" }).first();
  await civicTile.waitFor({ timeout: 20000 });
  await civicTile.click();
  await page
    .locator(".hud-district")
    .filter({ hasText: "Centro Cívico" })
    .first()
    .waitFor({ timeout: 30000 })
    .catch(() => fail("suelo público", "no se pudo observar el Centro Cívico"));
  await configureCamera(0.5, 1000, 1000);
  const publicCell = await page.evaluate(() => window.__landlordUiTest?.publicParcelCell() ?? null);
  if (!publicCell) fail("suelo público", "la proyección no publica suelo público en el distrito");
  await page.evaluate((cell) => window.__landlordCameraTest.centerOnCell(cell), publicCell);
  await clickCell(publicCell);
  panel = await inspectorText();
  if (!/suelo municipal/i.test(panel))
    fail("suelo público", `el inspector no declara la reserva: ${panel.slice(0, 260)}`);
  if (!/ayuntamiento/i.test(panel))
    fail("suelo público", `el propietario público no se nombra como tal: ${panel.slice(0, 260)}`);
  const buyOnPublic = page.getByRole("button", { name: "Comprar parcela" });
  if ((await buyOnPublic.count()) > 0 && (await buyOnPublic.isEnabled()))
    fail("suelo público", "la UI ofrece comprar suelo público");
  if ((await page.locator(".construction-option").count()) > 0)
    fail("suelo público", "la UI ofrece construir sobre suelo público");
  step(`15-16 · suelo público en ${publicCell.x},${publicCell.y} inspeccionado y bloqueado`);

  // 17 y 18 · overlays de servicio y de valor desde la toolbar visual
  for (const [group, option, file, label] of [
    ["Servicios", "Seguridad", "overlay-security.jpg", "seguridad"],
    ["Valor", "Valor del suelo", "overlay-land-value.jpg", "valor del suelo"],
  ]) {
    await page.getByRole("button", { name: group, exact: true }).click();
    await page.getByRole("button", { name: option, exact: true }).click();
    await page
      .locator(".overlay-legend")
      .filter({ hasText: label })
      .first()
      .waitFor({ timeout: 10000 })
      .catch(() => fail("overlay", `sin leyenda para ${label}`));
    await page.screenshot({ path: `docs/art/golden/vd-h1/${file}`, type: "jpeg", quality: 82 });
    step(`17-18 · overlay de ${label} aplicado`);
  }

  // 19 · ordenanza de densidad desde el hub de Gobierno
  await page.getByRole("button", { name: "Gobierno" }).click();
  await page.getByLabel("Gobierno municipal").waitFor({ timeout: 20000 });
  const politicsBody = await page.locator("main").innerText();
  if (!/Gobierna /i.test(politicsBody)) fail("ordenanza de densidad", "el concejo no se renderizó");
  if (!/Ensayo de densidad de corredor/.test(politicsBody))
    fail("ordenanza de densidad", "no aparece en la oferta de políticas");
  step("19 · ordenanza de densidad de corredor inspeccionada");

  if (pageErrors.length > 0) fail("consola del navegador", pageErrors.join("; "));
  console.log(JSON.stringify({ status: "ok", steps: steps.length, pageErrors: 0 }, null, 1));
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

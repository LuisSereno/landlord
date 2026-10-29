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
  return await page.locator('section[aria-label="Inspección de parcela"]').innerText();
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

/** Barrido determinista de celdas hasta que el panel ofrezca lo que busca el paso. */
async function scanCells(predicate, limit = 260) {
  let visited = 0;
  for (let y = 6; y <= 58; y += 2) {
    for (let x = 6; x <= 58; x += 2) {
      if (visited >= limit) return null;
      visited += 1;
      if (!(await clickCell({ x, y }))) continue;
      if (await predicate(x, y)) return { x, y };
    }
  }
  return null;
}

try {
  await waitForServer();

  // 1 · iniciar ciudad
  await startFreshCity();
  step("1 · ciudad iniciada con worker conectado");

  // 2 · nueve distritos
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  await tiles.first().waitFor({ timeout: 20000 });
  const tileCount = await tiles.count();
  if (tileCount !== 9) fail("nueve distritos", `la vista de ciudad lista ${tileCount}`);
  step("2 · cuadrícula 3×3 con 9 distritos");

  // 3 · seleccionar una parcela marketable
  await configureCamera(0.5, 1000, 1000);
  const marketableCell = await scanCells(async () => {
    const buy = page.getByRole("button", { name: "Comprar parcela" });
    return (await buy.count()) > 0 && (await buy.isEnabled());
  });
  if (!marketableCell) fail("seleccionar parcela", "ninguna parcela comprable fue alcanzable");
  step(`3 · parcela marketable seleccionada en ${marketableCell.x},${marketableCell.y}`);

  // 4 · comprar
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  let panel = await inspectorText();
  if (!/Tu organización/.test(panel))
    fail("comprar parcela", `el inspector no refleja la propiedad: ${panel.slice(0, 180)}`);
  step("4 · parcela comprada");

  // 5 y 6 · obtener permiso e iniciar construcción (StartConstruction emite el permiso si falta)

  const housingOption = page.locator(".construction-option", { hasText: "Patio compacto" }).first();
  await housingOption.waitFor({ timeout: 20000 }).catch(() => {});
  if ((await housingOption.count()) === 0)
    fail("opciones de construcción", `sin oferta de vivienda: ${await inspectorText()}`);
  const optionText = await housingOption.innerText();
  if (/Faltan:|Falta caja\./.test(optionText))
    fail("opciones de construcción", `el jugador no puede pagar su primera obra: ${optionText}`);
  /** El panel re-renderiza con cada proyección: se reintenta el clic hasta que la obra exista. */
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (/en obra/.test(await inspectorText())) break;
    await housingOption.click({ timeout: 5000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  panel = await inspectorText();
  if (!/en obra/.test(panel))
    fail("iniciar construcción", `la obra no aparece en el inspector: ${panel.slice(0, 220)}`);
  if (!/permiso (approved|consumed)/.test(panel))
    fail("permiso", `el inspector no publica el permiso de la obra: ${panel.slice(0, 220)}`);
  step("5-6 · permiso obtenido y construcción iniciada");

  // 7 · asignar cuadrilla
  const crewButton = page.getByRole("button", { name: /crew_\d+ · libre/ }).first();
  await crewButton.waitFor({ timeout: 20000 }).catch(() => {});
  if ((await crewButton.count()) === 0)
    fail("asignar cuadrilla", `sin cuadrilla libre: ${await inspectorText()}`);
  await crewButton.click();
  await page
    .getByText(/Crew enviada a la obra|cuadrilla\(s\) asignada/)
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => fail("asignar cuadrilla", "la asignación no se confirmó"));
  step("7 · cuadrilla asignada a la obra");

  // 8 · avanzar hasta completar
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page
    .waitForFunction(
      () => {
        const text =
          document.querySelector('section[aria-label="Inspección de parcela"]')?.innerText ?? "";
        return /· operational ·/.test(text) && !/en obra/.test(text);
      },
      null,
      { timeout: 240000 },
    )
    .catch(() => {});
  panel = await inspectorText();
  if (/en obra/.test(panel) || !/explotación del activo|operación de la fábrica/i.test(panel))
    fail(
      "terminar la construcción",
      JSON.stringify({
        enObra: panel.match(/.{0,50}en obra.{0,50}/s)?.[0] ?? null,
        asset: /explotación del activo|operación de la fábrica/i.test(panel),
        head: panel.slice(0, 260),
        tail: panel.slice(-500),
      }),
    );
  step("8 · construcción terminada");

  // 9 · interactuar con el edificio
  panel = await inspectorText();
  if (!/explotación del activo|operación de la fábrica/i.test(panel))
    fail("gestionar edificio", `el inspector no gestiona el activo: ${panel.slice(0, 700)}`);
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
  await page.waitForFunction(
    () => document.querySelectorAll('[aria-label="Distritos"] [role="gridcell"]').length === 9,
    null,
    { timeout: 30000 },
  );
  const afterLoad = await page.locator("main").innerText();
  if (cashOf(afterLoad) !== cashBeforeSave)
    fail("persistencia", `la caja cambió al cargar: ${cashBeforeSave} → ${cashOf(afterLoad)}`);
  /** La selección es estado de UI: tras cargar hay que volver a señalar la parcela propia. */
  await configureCamera(0.5, 1000, 1000);
  const reopened = await scanCells(async () => /· operational ·/i.test(await inspectorText()), 60);
  if (!reopened)
    fail("persistencia", "el edificio terminado no aparece tras recargar la partida guardada");
  step(`12 · persistencia verificada (caja y edificio en ${reopened.x},${reopened.y})`);

  // 13 y 14 · cambiar de distrito sin mover la caja
  const districtNames = await tiles.allInnerTexts();
  const observed = await page.getByLabel("Distrito observado").first().innerText();
  let targetIndex = districtNames.findIndex(
    (name) => !observed.includes(name.split("\n")[0].trim()),
  );
  if (targetIndex < 0) targetIndex = 1;
  const cashBeforeSwitch = cashOf(afterLoad);
  await tiles.nth(targetIndex).click();
  const wanted = districtNames[targetIndex].split("\n")[0].trim();
  await page
    .getByLabel("Distrito observado")
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
  await configureCamera(0.5, 1000, 1000);
  const publicCell = await scanCells(async () => /Suelo público/.test(await inspectorText()), 320);
  if (!publicCell) fail("suelo público", "ninguna parcela pública fue alcanzable");
  panel = await inspectorText();
  if (!/suelo público/i.test(panel))
    fail("suelo público", `el inspector no declara la reserva: ${panel.slice(0, 260)}`);
  if (!/ayuntamiento/i.test(panel))
    fail("suelo público", `el propietario público no se nombra como tal: ${panel.slice(0, 260)}`);
  const buyOnPublic = page.getByRole("button", { name: "Comprar parcela" });
  if ((await buyOnPublic.count()) > 0 && (await buyOnPublic.isEnabled()))
    fail("suelo público", "la UI ofrece comprar suelo público");
  if ((await page.locator(".construction-option").count()) > 0)
    fail("suelo público", "la UI ofrece construir sobre suelo público");
  if ((await page.getByRole("button", { name: /Solicitar 600 u\./ }).count()) > 0)
    fail("suelo público", "la UI ofrece hipotecar suelo público");
  step(`15-16 · suelo público en ${publicCell.x},${publicCell.y} inspeccionado y bloqueado`);

  // 17 y 18 · overlays de servicio y de valor
  const overlay = page.getByLabel("Capa del mapa");
  for (const [value, file, label] of [
    ["security", "overlay-security.jpg", "seguridad"],
    ["landValue", "overlay-land-value.jpg", "valor del suelo"],
  ]) {
    await overlay.selectOption(value);
    await page.waitForFunction(
      (expected) =>
        document.querySelector('select[aria-label="Capa del mapa"]')?.value === expected,
      value,
    );
    await page.screenshot({ path: `docs/art/golden/vd-h1/${file}`, type: "jpeg", quality: 82 });
    step(`17-18 · overlay de ${label} aplicado`);
  }

  // 19 · ordenanza de densidad
  await page.getByText("Concejo municipal").first().click();
  const politicsBody = await page.locator("main").innerText();
  if (!/Gobierna:/.test(politicsBody)) fail("ordenanza de densidad", "el concejo no se renderizó");
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

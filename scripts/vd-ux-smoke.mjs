/* global setTimeout, window, document */

/**
 * V.d-UX · smoke de la interfaz jugable y generador de evidencia visual.
 *
 * Recorre el camino que el jugador debe poder completar sin conocer la arquitectura interna:
 * HUD → seleccionar parcela → comprar → abrir el catálogo visual → elegir edificio → iniciar obra →
 * asignar cuadrilla → notificaciones → navegar desde una alerta → Gobierno → Finanzas → ayuda →
 * overlay → comprobación de que no hay ticks ni IDs técnicos visibles. Guarda las capturas de
 * `docs/art/golden/vd-ux/` en las resoluciones objetivo.
 *
 * No sustituye el playtest humano (spec §23).
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4177;
const externalServerUrl = process.env.VD_UX_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}/`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const SHOTS = "docs/art/golden/vd-ux";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
const steps = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

function step(name) {
  steps.push(name);
  console.log(`VD-UX ${String(steps.length).padStart(2, "0")} · ${name}`);
}

function fail(name, detail) {
  throw new Error(`Paso "${name}" falló — ${detail}`);
}

async function shot(file) {
  await page.screenshot({ path: `${SHOTS}/${file}`, type: "jpeg", quality: 84 });
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
  throw new Error("El servidor del smoke V.d-UX no arrancó");
}

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
  await page
    .waitForFunction(
      (expected) => {
        const selected = window.__landlordCameraTest.getSelectedCell();
        return selected?.x === expected.x && selected?.y === expected.y;
      },
      cell,
      { timeout: 2000 },
    )
    .catch(() => {});
}

/** Los comandos se resuelven cuando el reloj avanza: los pasos que compran exigen simulación activa. */
async function ensureRunning() {
  const resume = page.getByRole("button", { name: "Continuar simulación" });
  if ((await resume.count()) > 0) await resume.click({ timeout: 5000 }).catch(() => {});
  await page
    .getByRole("button", { name: "Pausar simulación" })
    .first()
    .waitFor({ timeout: 5000 })
    .catch(() => {});
}

async function mainText() {
  return await page.locator("main").innerText();
}

try {
  await waitForServer();
  await startFreshCity();
  step("1 · partida cargada con el worker conectado");

  // 2 · HUD compacto con estado frecuente y accesos globales
  const hud = await page.locator(".hud").innerText();
  for (const required of [
    "CAJA",
    "FECHA",
    "CUADRILLA",
    "Guardar",
    "Cargar",
    "Gobierno",
    "Finanzas",
    "Cartera",
  ])
    if (!hud.includes(required)) fail("HUD", `falta «${required}» en el HUD: ${hud}`);
  if ((await page.getByRole("button", { name: /Notificaciones/ }).count()) === 0)
    fail("HUD", "no hay campana de notificaciones");
  if ((await page.locator(".sidebar").count()) > 0)
    fail("HUD", "el panel lateral permanente sigue existiendo");
  await shot("01-normal-1440x900.jpg");
  step("2 · HUD compacto, sin panel lateral permanente");

  // 3 · seleccionar una parcela comprable
  const marketable = await page.evaluate(
    () => window.__landlordUiTest?.marketableParcelCell() ?? null,
  );
  if (!marketable) fail("seleccionar parcela", "la proyección no publica parcelas comprables");
  await clickCell(marketable);
  await page
    .getByRole("complementary", { name: "Inspección de parcela" })
    .waitFor({ timeout: 10000 });
  await shot("02-parcela.jpg");
  step(`3 · parcela seleccionada en ${marketable.x},${marketable.y}`);

  // 4 · comprar
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 });
  step("4 · parcela comprada");

  // 5 · abrir el catálogo visual
  const card = page.locator(".build-card", { hasText: "Patio residencial" }).first();
  await card.waitFor({ timeout: 20000 });
  await shot("03-catalogo-construccion.jpg");
  step("5 · catálogo de construcción abierto");

  // 6 · miniaturas reales en las tarjetas
  const thumbs = page.locator(".build-card .building-thumbnail img");
  const thumbCount = await thumbs.count();
  if (thumbCount < 4) fail("miniaturas", `sólo ${thumbCount} tarjetas con miniatura`);
  const broken = await thumbs.evaluateAll(
    (images) => images.filter((image) => !image.complete || image.naturalWidth === 0).length,
  );
  if (broken > 0) fail("miniaturas", `${broken} miniaturas no cargaron`);
  step(`6 · ${thumbCount} tarjetas con miniatura cargada`);

  // 7 · elegir edificio
  await card.click();
  await page.getByRole("button", { name: "Construir" }).waitFor({ timeout: 10000 });
  step("7 · edificio elegido con su detalle");

  // 8 · iniciar obra
  await page.getByRole("button", { name: "Construir" }).click();
  await page
    .getByText(/Obra nueva en curso/)
    .first()
    .waitFor({ timeout: 20000 });
  await shot("06-obra.jpg");
  step("8 · obra iniciada");

  // 9 · asignar cuadrilla
  await page
    .getByRole("button", { name: /Asignar Cuadrilla \d+/ })
    .first()
    .click();
  await page
    .getByText(/Cuadrilla asignada/)
    .first()
    .waitFor({ timeout: 20000 });
  step("9 · cuadrilla asignada");

  // Avanzar hasta terminar la obra para tener un activo y sus alertas derivadas
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page
    .waitForFunction(
      () => document.querySelector('nav[aria-label="Secciones del edificio"]') !== null,
      null,
      {
        timeout: 240000,
      },
    )
    .catch(() => {});
  if ((await page.locator('nav[aria-label="Secciones del edificio"]').count()) === 0)
    fail("edificio", "la obra no terminó");
  await shot("05-residencial.jpg");
  step("9b · edificio residencial seleccionado");

  // 10 · centro de notificaciones
  await page.getByRole("button", { name: /Notificaciones/ }).click();
  await page
    .getByRole("complementary", { name: "Centro de notificaciones" })
    .waitFor({ timeout: 10000 });
  await shot("09-notificaciones.jpg");
  const notificationText = await page
    .getByRole("complementary", { name: "Centro de notificaciones" })
    .innerText();
  step(
    `10 · centro de notificaciones abierto (${notificationText.split("\n")[1] ?? "sin avisos"})`,
  );

  // 11 · navegar desde una notificación al origen
  const navigate = page.getByRole("button", { name: /Ver parcela/ }).first();
  if ((await navigate.count()) > 0) {
    await navigate.click();
    await page
      .getByRole("complementary", { name: "Inspección de parcela" })
      .waitFor({ timeout: 10000 });
    step("11 · navegación desde la notificación a la parcela");
  } else {
    await page.getByRole("button", { name: "Cerrar notificaciones" }).click();
    step("11 · sin alertas accionables en este estado (no hay destino que navegar)");
  }

  // 12 · Gobierno
  await page.getByRole("button", { name: "Gobierno", exact: true }).click();
  await page.getByRole("complementary", { name: "Gobierno municipal" }).waitFor({ timeout: 10000 });
  const government = await page
    .getByRole("complementary", { name: "Gobierno municipal" })
    .innerText();
  if (!/Ordenanza|Concejo|Presupuesto/.test(government))
    fail("Gobierno", `el hub no agrupa los sistemas: ${government.slice(0, 200)}`);
  await shot("07-gobierno.jpg");
  step("12 · hub de Gobierno con ordenanza, presupuesto y concejo");

  // 13 · Finanzas
  await page.getByRole("button", { name: "Finanzas", exact: true }).click();
  await page.getByRole("complementary", { name: "Finanzas" }).waitFor({ timeout: 10000 });
  const finance = await page.getByRole("complementary", { name: "Finanzas" }).innerText();
  if (!/Posición|Préstamos|Subastas/.test(finance))
    fail("Finanzas", `el hub no agrupa la banca: ${finance.slice(0, 200)}`);
  await shot("08-finanzas.jpg");
  step("13 · hub de Finanzas con posición, préstamos y subastas");

  // 14 · ayuda contextual
  await page.getByRole("button", { name: "Abrir ayuda" }).click();
  await page.getByRole("complementary", { name: "Ayuda" }).waitFor({ timeout: 10000 });
  const help = await page.getByRole("complementary", { name: "Ayuda" }).innerText();
  if (!/Primeros pasos|Construcción/.test(help)) fail("Ayuda", "el catálogo no se renderizó");
  await shot("10-ayuda.jpg");
  await page.getByRole("button", { name: "Cerrar ayuda" }).click();
  step("14 · ayuda contextual desde el catálogo central");

  // 15 · overlays
  await page.getByRole("button", { name: "Servicios", exact: true }).click();
  await page.getByRole("button", { name: "Seguridad", exact: true }).click();
  await page
    .locator(".overlay-legend")
    .filter({ hasText: "Seguridad" })
    .waitFor({ timeout: 10000 });
  await shot("11-overlay-servicios.jpg");
  await page.getByRole("button", { name: "Vista normal" }).click();
  if ((await page.locator(".overlay-legend").count()) > 0)
    fail("overlays", "la vista normal conserva leyenda");
  step("15 · overlay de servicios con leyenda y vuelta a vista normal");

  // 16 · catálogo de producción (detalle de cementera) en un solar industrial
  await ensureRunning();
  await page.locator(".hud-district").click();
  const industrialTile = page
    .locator('[aria-label="Distritos"] [role="gridcell"]')
    .filter({ hasText: "Industria" })
    .first();
  if ((await industrialTile.count()) > 0) {
    await industrialTile.click();
    await page
      .locator(".hud-district")
      .filter({ hasText: "Industria" })
      .first()
      .waitFor({ timeout: 30000 })
      .catch(() => {});
    /** La proyección del distrito nuevo llega por el worker: se espera antes de pedir celdas. */
    await page.waitForTimeout(1200);
    const industrialCell = await page.evaluate(
      () => window.__landlordUiTest?.marketableParcelCellForType("cement_plant") ?? null,
    );
    if (industrialCell) {
      await clickCell(industrialCell);
      const panel = page.getByRole("complementary", { name: "Inspección de parcela" });
      const buy = page.getByRole("button", { name: "Comprar parcela" });
      /** El panel anterior puede seguir montado: se espera al botón de la parcela nueva. */
      await buy
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {});
      if ((await buy.count()) > 0 && (await buy.isEnabled())) {
        await buy.click();
        await page
          .getByText(/Parcela comprada/)
          .first()
          .waitFor({ timeout: 20000 })
          .catch(async () => {
            const status = await page.locator(".status-strip").innerText();
            const body = (await panel.count())
              ? (await panel.innerText()).slice(0, 200)
              : "sin panel";
            fail("compra industrial", `estado «${status}» · panel «${body}»`);
          });
      } else {
        const status = await page.locator(".status-strip").innerText();
        fail(
          "compra industrial",
          `sin botón de compra activo (panel: ${(await panel.count()) ? (await panel.innerText()).slice(0, 500) : "cerrado"}; estado: ${status})`,
        );
      }
      const cementCard = page.locator(".build-card", { hasText: "Planta de cemento" }).first();
      if ((await cementCard.count()) > 0) {
        await cementCard.click();
        await page.getByRole("button", { name: "Construir" }).waitFor({ timeout: 10000 });
        await page.evaluate(() => {
          const body = document.querySelector('[aria-label="Inspección de parcela"] .context-body');
          if (body) body.scrollTop = body.scrollHeight;
        });
        await page.waitForTimeout(200);
        await shot("04-detalle-produccion.jpg");
        step("16 · detalle de planta de cemento con materiales y producción");
      } else {
        step("16 · el solar industrial no ofrece cementera en este estado");
      }
    } else {
      step("16 · sin solar industrial comprable en el distrito observado");
    }
  } else {
    step("16 · sin distrito industrial en la ciudad");
  }

  // 17 · lenguaje del jugador: cero ticks y cero IDs internos
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const text = await mainText();
  const leaks = [
    [/\btick\b/i, "tick"],
    [/\b(?:building|parcel|crew|org|loan|facility|contract)_\d+/i, "id técnico"],
    [/\b(?:approved|consumed|operational|collapse_pending|paid_off|delinquent)\b/i, "enum"],
  ].filter(([pattern]) => pattern.test(text));
  if (leaks.length > 0)
    fail(
      "lenguaje",
      `la UI filtra ${leaks.map(([, label]) => label).join(", ")}: ${text.slice(0, 400)}`,
    );
  step("17 · sin ticks, IDs técnicos ni enums en la UI del jugador");

  // 12-13 · resoluciones objetivo
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(400);
  await shot("12-1280x720.jpg");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  await shot("13-1920x1080.jpg");
  step("18 · capturas en 1280×720 y 1920×1080");

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

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
  await page.getByRole("button", { name: "Elegir ubicación" }).waitFor({ timeout: 10000 });
  step("7 · edificio elegido con su detalle");

  // 7b · V.d-7C · el modo de colocación muestra las candidatas legales del motor
  await page.getByRole("button", { name: "Elegir ubicación" }).click();
  await page.locator(".placement-panel").waitFor({ timeout: 10000 });
  await page
    .waitForFunction(
      () => (window.__landlordPlacementTest?.() ?? { candidates: 0 }).candidates > 0,
      null,
      {
        timeout: 20000,
      },
    )
    .catch(async () => {
      const panel = await page.locator(".placement-panel").innerText();
      fail("colocación", `el motor no devolvió candidatas: ${panel.slice(0, 300)}`);
    });
  const entryProbe = await page.evaluate(() => window.__landlordPlacementTest());
  if (entryProbe.candidates === 0) fail("colocación", "la ficha está vacía sin razón visible");
  if (entryProbe.ghostVisible !== true)
    fail("colocación", `no se ve el fantasma de la colocación seleccionada`);
  await shot("15-colocacion-candidatas.jpg");
  step(
    `7b · ${entryProbe.candidates} colocaciones legales con fantasma en ${entryProbe.selectedFootprint
      .map((cell) => `${cell.x},${cell.y}`)
      .join(" ")}`,
  );

  // 7c · cambiar de candidata y que el mapa siga la selección
  const choices = page.locator(".placement-choice");
  const choiceCount = await choices.count();
  if (choiceCount > 1) {
    await choices.last().click();
    await page.waitForFunction(
      (previous) => (window.__landlordPlacementTest?.() ?? {}).selectedId !== previous,
      entryProbe.selectedId,
      { timeout: 10000 },
    );
    const switched = await page.evaluate(() => window.__landlordPlacementTest());
    if (switched.selectedId === entryProbe.selectedId) fail("colocación", "la selección no cambió");
    if (JSON.stringify(switched.selectedFootprint) === JSON.stringify(entryProbe.selectedFootprint))
      fail("colocación", "el fantasma no se movió al cambiar de candidata");
    await shot("16-colocacion-alternativa.jpg");
    step(
      `7c · candidata ${choiceCount} seleccionada en ${switched.selectedFootprint
        .map((cell) => `${cell.x},${cell.y}`)
        .join(" ")}`,
    );
  } else {
    step("7c · una sola colocación legal en este solar (no hay a qué cambiar)");
  }

  // 7d · cancelar sin efectos: ni obra, ni caja, ni materiales
  const cashBefore = await page.evaluate(() => window.__landlordUiTest?.cash() ?? null);
  const inventoryBefore = await page.evaluate(() =>
    JSON.stringify(window.__landlordUiTest?.inventory() ?? null),
  );
  const sitesBefore = await page.evaluate(
    () => window.__landlordUiTest?.constructionSiteCount() ?? 0,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__landlordPlacementTest?.().candidates === 0, null, {
    timeout: 10000,
  });
  if ((await page.locator(".placement-panel").count()) > 0)
    fail("cancelar colocación", "la ficha sigue abierta después de Escape");
  const afterCancel = {
    cash: await page.evaluate(() => window.__landlordUiTest?.cash() ?? null),
    inventory: await page.evaluate(() =>
      JSON.stringify(window.__landlordUiTest?.inventory() ?? null),
    ),
    sites: await page.evaluate(() => window.__landlordUiTest?.constructionSiteCount() ?? 0),
  };
  if (afterCancel.sites !== sitesBefore)
    fail("cancelar colocación", `cambió el número de obras: ${sitesBefore} → ${afterCancel.sites}`);
  if (afterCancel.cash !== cashBefore)
    fail(
      "cancelar colocación",
      `la caja cambió sin confirmar: ${cashBefore} → ${afterCancel.cash}`,
    );
  if (afterCancel.inventory !== inventoryBefore)
    fail("cancelar colocación", "los materiales cambiaron sin confirmar");
  await shot("17-colocacion-cancelada.jpg");
  step("7d · cancelar colocación no gasta caja, materiales ni crea obra");

  // 7e · confirmar una candidata NO recomendada y exigir ésa huella exacta
  await card.click();
  await page.getByRole("button", { name: "Elegir ubicación" }).click();
  await page.waitForFunction(
    () => (window.__landlordPlacementTest?.() ?? { candidates: 0 }).candidates > 0,
    null,
    { timeout: 20000 },
  );
  const confirmChoices = page.locator(".placement-choice");
  if ((await confirmChoices.count()) > 1) await confirmChoices.last().click();
  const preview = await page.evaluate(() => window.__landlordPlacementTest());
  await page.getByRole("button", { name: "Confirmar proyecto" }).click();
  await page
    .waitForFunction(() => window.__landlordUiTest?.ownedSiteFootprint() !== null, null, {
      timeout: 20000,
    })
    .catch(async () => {
      const status = await page.locator(".status-strip").innerText();
      fail("confirmar colocación", `no nació la obra · estado «${status}»`);
    });
  const built = await page.evaluate(() => window.__landlordUiTest?.ownedSiteFootprint());
  const previewSignature = preview.selectedFootprint
    .map((cell) => `${cell.x},${cell.y}`)
    .sort()
    .join("|");
  if (built.signature !== previewSignature)
    fail(
      "confirmar colocación",
      `la obra nació en otra huella: vista ${previewSignature} · construida ${built.signature}`,
    );
  if (preview.selectedOrientation !== null && built.orientation !== preview.selectedOrientation)
    fail(
      "confirmar colocación",
      `la orientación construida (${built.orientation}) difiere de la vista (${preview.selectedOrientation})`,
    );
  if ((await page.locator(".placement-panel").count()) > 0)
    fail("confirmar colocación", "el modo sigue abierto después de confirmar");
  await page
    .getByRole("complementary", { name: "Inspección de parcela" })
    .waitFor({ timeout: 10000 });
  await shot("18-colocacion-confirmada.jpg");
  step(`7e · obra confirmada exactamente en la huella elegida (${built.signature})`);

  // 8 · la obra existe y se puede seleccionar
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

  // 9c · el sprite se selecciona directamente (no debe resolver la celda de suelo posterior).
  const buildingId = await page.evaluate(() => window.__landlordUiTest?.ownedBuildingId() ?? null);
  const buildingPoint = buildingId
    ? await page.evaluate((id) => window.__landlordCameraTest.getEntityScreenPoint(id), buildingId)
    : null;
  if (!buildingPoint) fail("picking directo", "no se encontró el sprite del edificio propio");
  const canvasBox = await page.locator(".map-canvas canvas").first().boundingBox();
  if (!canvasBox) fail("picking directo", "no se encontró el canvas del mapa");
  await page.mouse.click(canvasBox.x + buildingPoint.x, canvasBox.y + buildingPoint.y);
  await page.locator('nav[aria-label="Secciones del edificio"]').waitFor({ timeout: 10000 });
  step("9c · click directo sobre edificio conserva su ficha, sin caída al suelo");

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

  /**
   * V.d-7C · multi-parcela real: se compran los solares con comandos normales, se ensambla el solar
   * y se entra en colocación sobre la unión. No se inyecta dinero ni materiales: si la partida no
   * da para comprar el conjunto, el paso lo documenta (§33, §47).
   */
  async function buyParcels(ids) {
    const bought = [];
    for (const id of ids) {
      const cell = await page.evaluate(
        (parcelId) => window.__landlordUiTest?.parcelCellById(parcelId) ?? null,
        id,
      );
      if (!cell) break;
      await clickCell(cell);
      const buy = page
        .getByRole("button", { name: /Comprar parcela|Comprar para ampliar/ })
        .first();
      await buy.waitFor({ timeout: 8000 }).catch(() => {});
      if ((await buy.count()) === 0 || !(await buy.isEnabled())) break;
      await buy.click();
      await page
        .getByText(/Parcela comprada/)
        .first()
        .waitFor({ timeout: 20000 })
        .catch(() => {});
      bought.push(id);
    }
    return bought;
  }

  async function assembleAndPlace(buildingType, cardLabel, required, shotName) {
    const site = await page.evaluate(
      (type) => window.__landlordUiTest?.purchasableSiteForType(type) ?? null,
      buildingType,
    );
    if (!site || site.length !== required) {
      step(
        `${required} parcelas · sin conjunto comprable de ${cardLabel} en el distrito observado`,
      );
      return false;
    }
    const bought = await buyParcels(site);
    if (bought.length < required) {
      step(
        `${required} parcelas · sólo ${bought.length}/${required} comprables con la caja de la partida (sin inyectar recursos)`,
      );
      return false;
    }
    await clickCell(
      await page.evaluate((id) => window.__landlordUiTest.parcelCellById(id), bought[0]),
    );
    const panel = page.getByRole("complementary", { name: "Inspección de parcela" });
    await panel.waitFor({ timeout: 10000 });
    const projectCard = page.locator(".build-card", { hasText: cardLabel }).first();
    if ((await projectCard.count()) === 0) {
      step(`${required} parcelas · ${cardLabel} no se ofrece en este solar`);
      return false;
    }
    await projectCard.click();
    const begin = page.getByRole("button", { name: "Elegir solares" });
    await begin.waitFor({ timeout: 10000 });
    await begin.click();
    await page.getByText("Proyecto en preparación").waitFor({ timeout: 10000 });
    await page.getByText(`1/${required} parcelas`).first().waitFor({ timeout: 10000 });
    if (required === 2) await shot("14-cement-assembly-1-of-2.jpg");
    for (const id of bought.slice(1)) {
      await clickCell(
        await page.evaluate((parcelId) => window.__landlordUiTest.parcelCellById(parcelId), id),
      );
      const add = page.getByRole("button", { name: "Añadir este solar" });
      await add.waitFor({ timeout: 8000 }).catch(() => {});
      if ((await add.count()) === 0) {
        step(`${required} parcelas · la parcela comprada no resultó elegible para el proyecto`);
        return false;
      }
      await add.click();
      await page
        .getByText(`${Math.min(2 + bought.indexOf(id), required)}/${required} parcelas`)
        .first()
        .waitFor({ timeout: 8000 })
        .catch(() => {});
    }
    await page.getByText(`${required}/${required} parcelas`).first().waitFor({ timeout: 10000 });
    if (required === 2) await shot("19-cement-assembly-2-of-2.jpg");
    const place = page.getByRole("button", {
      name: new RegExp(`Elegir ubicación para ${required}`),
    });
    await place.waitFor({ timeout: 10000 });
    const sitesBefore = await page.evaluate(() => window.__landlordUiTest.constructionSiteCount());
    await place.click();
    await page
      .waitForFunction(
        () => (window.__landlordPlacementTest?.() ?? { candidates: 0 }).candidates > 0,
        null,
        { timeout: 25000 },
      )
      .catch(() => {});
    const probe = await page.evaluate(() => window.__landlordPlacementTest());
    if (probe.candidates > 0) {
      if (probe.parcelIds.length !== required)
        fail(
          `colocación ${required} parcelas`,
          "la ficha no abarca el conjunto exacto del proyecto",
        );
      const union = await page.evaluate(
        (ids) =>
          ids.every((id) => window.__landlordUiTest.parcelCellById(id) !== null) ? ids.length : 0,
        probe.parcelIds,
      );
      if (union !== required) fail(`colocación ${required} parcelas`, "una parcela no existe");
      if (
        (await page.evaluate(() => window.__landlordUiTest.constructionSiteCount())) !== sitesBefore
      )
        fail(`colocación ${required} parcelas`, "entrar en colocación creó una obra");
      await shot(shotName);
      step(
        `${required} parcelas · ${probe.candidates} colocaciones sobre la unión (${probe.selectedFootprint.length} celdas visibles en el fantasma)`,
      );
    } else {
      const issue = await page
        .locator(".placement-issue")
        .innerText()
        .catch(() => "");
      await shot(shotName.replace(".jpg", "-sin-hueco.jpg"));
      step(`${required} parcelas · sin hueco legal sobre la unión: ${issue || "sin copia"}`);
    }
    await page.keyboard.press("Escape");
    if ((await page.locator(".placement-panel").count()) > 0)
      fail(`colocación ${required} parcelas`, "Escape no cerró el modo");
    if (
      (await page.evaluate(() => window.__landlordUiTest.constructionSiteCount())) !== sitesBefore
    )
      fail(`colocación ${required} parcelas`, "cancelar creó una obra");
    return true;
  }

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
    await assembleAndPlace(
      "cement_plant",
      "Planta de cemento",
      2,
      "20-colocacion-dos-parcelas.jpg",
    );
    await assembleAndPlace("steelworks", "Acería", 3, "21-colocacion-tres-parcelas.jpg");
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

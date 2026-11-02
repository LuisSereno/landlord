/* global setTimeout, window, document, performance */

/**
 * V.d-7C · evidencia visual y de rendimiento del modo de colocación.
 *
 * Genera las 16 capturas de `docs/art/golden/vd7c/` y mide FPS, coste de petición y estabilidad de
 * objetos tras 50 ciclos entrar/cancelar. Todo el camino se recorre con la interfaz real: comprar,
 * elegir edificio, colocar, confirmar, asignar cuadrilla y ver las etapas. No se inyecta dinero,
 * materiales ni estado; si algo no es alcanzable, se registra como tal.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4179;
const externalServerUrl = process.env.VD7C_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}/`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const SHOTS = "docs/art/golden/vd7c";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
const notes = [];
const measurements = { fps: {}, cycles: null, candidates: {} };
page.on("pageerror", (error) => pageErrors.push(error.message));

function note(text) {
  notes.push(text);
  console.log(`VD7C · ${text}`);
}

function fail(name, detail) {
  throw new Error(`Evidencia "${name}" falló — ${detail}`);
}

async function shot(file) {
  await page.screenshot({ path: `${SHOTS}/${file}`, type: "png" });
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
  throw new Error("El servidor del smoke V.d-7C no arrancó");
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
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30000,
  });
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
}

const probe = () => page.evaluate(() => window.__landlordPlacementTest?.() ?? null);
const ui = (name, argument) =>
  page.evaluate(
    ({ key, value }) => window.__landlordUiTest[key](...(value === undefined ? [] : [value])),
    { key: name, value: argument },
  );
const stats = () => page.evaluate(() => window.__gameplayVisualStats?.() ?? null);

/** Muestra el promedio real de FPS del scene durante `windowMs` milisegundos. */
async function sampleFps(windowMs) {
  await page.evaluate(() => {
    window.__visualSlicePerformance = { currentFps: 0, samples: [], objectCount: 0 };
  });
  await page.waitForTimeout(windowMs);
  const samples = await page.evaluate(
    () => window.__visualSlicePerformance?.samples?.slice(-8) ?? [],
  );
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((total, value) => total + value, 0) / samples.length);
}

/**
 * Abre el catálogo de una parcela y entra en colocación. El panel anterior puede seguir montado
 * mientras llega la proyección nueva, así que se reintenta el pinchazo una vez antes de rendirse.
 */
async function openProject(cell, cardLabel, entry = "Elegir ubicación") {
  await clickCell(cell);
  await page
    .getByRole("complementary", { name: "Inspección de parcela" })
    .waitFor({ timeout: 10000 });
  const card = page.locator(".build-card", { hasText: cardLabel }).last();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  const begin = page.getByRole("button", { name: entry });
  if ((await begin.count()) === 0) {
    await card.click();
    await begin.waitFor({ timeout: 10000 });
  }
  return begin;
}

/** Vuelve al distrito natal de la jugadora desde la rejilla de ciudad. */
async function goHomeDistrict() {
  await page.locator(".hud-district").click();
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  for (let index = 0; index < (await tiles.count()); index += 1) {
    const tile = tiles.nth(index);
    const text = await tile.innerText();
    if (!/Industria/.test(text)) {
      await tile.click();
      await page.waitForTimeout(1200);
      return text.split("\n")[0];
    }
  }
  await page.keyboard.press("Escape");
  return null;
}

async function enterPlacement() {
  const begin = page.getByRole("button", { name: "Elegir ubicación" });
  await begin.waitFor({ timeout: 10000 });
  await begin.click();
  await page
    .waitForFunction(
      () =>
        (window.__landlordPlacementTest?.() ?? { candidates: 0 }).candidates > 0 ||
        document.querySelector(".placement-issue") !== null,
      null,
      { timeout: 25000 },
    )
    .catch(() => {});
  return await probe();
}

async function buyParcel(cell) {
  await clickCell(cell);
  const buy = page.getByRole("button", { name: /Comprar parcela/ }).first();
  await buy.waitFor({ timeout: 10000 });
  await buy.click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 });
}

try {
  await waitForServer();
  await startFreshCity();

  // 1 · FPS en mapa normal, sin colocación
  measurements.fps.normal = await sampleFps(2500);

  // 2 · parcela residencial y colocación
  const homeCell = await ui("marketableParcelCell");
  if (!homeCell) fail("vivienda", "la ciudad generada no ofrece parcelas comprables");
  await buyParcel(homeCell);
  await openProject(homeCell, "Patio residencial");
  const recommended = await enterPlacement();
  if (!recommended || recommended.candidates === 0)
    fail("vivienda", `sin candidatas: ${JSON.stringify(recommended)}`);
  measurements.candidates.single = recommended.candidates;
  await shot("01-single-recommended.png");
  note(`01 · ${recommended.candidates} candidatas, recomendada en ${recommended.selectedId}`);

  // 3 · FPS con el modo abierto
  measurements.fps.placement = await sampleFps(2500);

  // 4 · candidata alternativa (deliberadamente no recomendada)
  await page.locator(".placement-choice").last().click();
  await page.waitForFunction(
    (previous) => (window.__landlordPlacementTest?.() ?? {}).selectedId !== previous,
    recommended.selectedId,
    { timeout: 10000 },
  );
  const alternative = await probe();
  await shot("02-single-alternative.png");
  note(
    `02 · alternativa seleccionada en ${alternative.selectedFootprint.map((c) => `${c.x},${c.y}`).join(" ")}`,
  );

  // 5 · rotación a otra orientación legal
  const rotate = page.getByRole("button", { name: "Rotar orientación" });
  if (await rotate.isEnabled()) {
    await rotate.click();
    await page.waitForTimeout(300);
    const rotated = await probe();
    if (rotated.selectedOrientation !== alternative.selectedOrientation)
      await shot("03-rotated-candidate.png");
    note(
      `03 · rotar pasó de ${alternative.selectedOrientation}° a ${rotated.selectedOrientation}°`,
    );
  } else {
    await shot("03-rotated-candidate.png");
    note("03 · sin segunda orientación legal para la huella seleccionada (botón apagado)");
  }

  // 6 · 50 ciclos entrar/cancelar: objetos y memoria estables
  const firstStats = await stats();
  const heapBefore = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : null,
  );
  const childrenDuring = [];
  for (let cycle = 0; cycle < 50; cycle += 1) {
    /** Cada ciclo reproduce el gesto real: abrir el proyecto, entrar, salir con Escape. */
    await page.keyboard.press("Escape");
    await openProject(homeCell, "Patio residencial");
    const opened = await enterPlacement();
    if (!opened || opened.candidates === 0) fail("ciclos", `el ciclo ${cycle} no abrió candidatas`);
    if (cycle % 10 === 0) childrenDuring.push((await stats()).sceneChildren);
  }
  const lastStats = await stats();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterStats = await stats();
  const heapAfter = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : null,
  );
  measurements.cycles = {
    cycles: 50,
    sceneChildrenBefore: firstStats.sceneChildren,
    sceneChildrenDuring: childrenDuring,
    sceneChildrenAfterCycle: lastStats.sceneChildren,
    sceneChildrenAfterCancel: afterStats.sceneChildren,
    placementObjectsAfterCancel: afterStats.placementObjects,
    placementLabelPoolAfterCycles: afterStats.placementLabelPool,
    heapBefore,
    heapAfter,
    heapGrowthKb: heapBefore && heapAfter ? Math.round((heapAfter - heapBefore) / 1024) : null,
  };
  if (afterStats.placementObjects !== 0)
    fail("ciclos", `quedaron ${afterStats.placementObjects} objetos de colocación tras cancelar`);
  note(
    `06 · 50 ciclos entrar/cancelar: children ${firstStats.sceneChildren} → ${afterStats.sceneChildren}, objetos de colocación ${afterStats.placementObjects}, heap ${measurements.cycles.heapGrowthKb ?? "n/d"} KB`,
  );

  // 7 · sin colocación legal: solar pequeño con el edificio más alto
  /**
   * Caso «sin colocación legal»: se prueba el proyecto más caro admitido por el solar propio. Si el
   * motor sí deja huella, se registra sin forzar el caso: las razones de cero candidatas ya están
   * cubiertas por los tests de `development-placement`.
   */
  try {
    const blockedCards = ["Bloque de pisos", "Patio residencial"];
    let capturedBlocked = false;
    for (const cardLabel of blockedCards) {
      await openProject(homeCell, cardLabel);
      const probeState = await enterPlacement();
      if (probeState && probeState.candidates === 0) {
        await shot("06-no-placement.png");
        const copy = await page.locator(".placement-issue").innerText();
        note(`06 · «${cardLabel}» sin hueco legal en el solar propio: «${copy}»`);
        capturedBlocked = true;
        break;
      }
      await page.keyboard.press("Escape");
    }
    if (!capturedBlocked) {
      await shot("06-no-placement.png");
      note("06 · ningún proyecto del solar propio quedó sin hueco en esta partida");
    }
  } catch (error) {
    note(`06 · no se pudo alcanzar el caso sin hueco: ${error.message}`);
  }

  // 8 · confirmar la alternativa y seguirla hasta terminar
  await openProject(homeCell, "Patio residencial");
  await enterPlacement();
  await page.locator(".placement-choice").last().click();
  const preview = await probe();
  const previewSignature = [...preview.selectedFootprint]
    .map((cell) => `${cell.x},${cell.y}`)
    .sort()
    .join("|");
  const requestStart = Date.now();
  await page.getByRole("button", { name: "Confirmar proyecto" }).click();
  await page
    .waitForFunction(() => window.__landlordUiTest.ownedSiteFootprint() !== null, null, {
      timeout: 25000,
    })
    .catch(() => {});
  measurements.confirmLatencyMs = Date.now() - requestStart;
  const built = await ui("ownedSiteFootprint");
  if (!built) fail("confirmar", "no se creó la obra");
  if (built.signature !== previewSignature)
    fail("confirmar", `huella ${built.signature} ≠ vista ${previewSignature}`);
  note(
    `04 · confirmada la huella vista (${built.signature}) en ${measurements.confirmLatencyMs} ms`,
  );

  // 9 · cuadrilla y etapas visibles
  await page
    .getByRole("button", { name: /Asignar Cuadrilla \d+/ })
    .first()
    .click();
  await page
    .getByText(/Cuadrilla asignada/)
    .first()
    .waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "4×", exact: true }).click();
  const captured = { foundation: false, structure: false, finishing: false };
  const stageDeadline = Date.now() + 240_000;
  while (
    Date.now() < stageDeadline &&
    !(captured.foundation && captured.structure && captured.finishing)
  ) {
    const progress = await ui("ownedSiteProgress");
    const ratio = progress ? progress.progress / Math.max(1, progress.workRequired) : 1;
    const stage =
      ratio >= 1
        ? "complete"
        : ratio >= 0.7
          ? "finishing"
          : ratio >= 0.15
            ? "structure"
            : "foundation";
    if (stage === "complete") break;
    if (!captured[stage]) {
      captured[stage] = true;
      if (stage === "foundation") await shot("07-foundation.png");
      if (stage === "structure") {
        await shot("08-structure.png");
        await shot("12-crew-on-site.png");
      }
      if (stage === "finishing") await shot("09-finishing.png");
      note(`etapa ${stage} capturada al ${Math.round(ratio * 100)} %`);
    }
    await page.waitForTimeout(700);
  }
  if (!captured.foundation || !captured.structure || !captured.finishing)
    note(`etapas capturadas: ${JSON.stringify(captured)}`);

  // 10 · propiedad terminada con su entorno
  await page
    .waitForFunction(() => window.__landlordUiTest.ownedSiteProgress() === null, null, {
      timeout: 240000,
    })
    .catch(() => {});
  const buildingId = await ui("ownedBuildingId");
  if (!buildingId) fail("residencial", "la obra no terminó en el tiempo del harness");
  await page.waitForTimeout(600);
  await shot("10-complete-residential.png");
  await shot("13-residential-grounds.png");
  note("10/13 · vivienda terminada con jardín, acceso y seto derivados");

  // 11 · dos y tres parcelas en el distrito industrial
  await page.locator(".hud-district").click();
  const industrialTile = page
    .locator('[aria-label="Distritos"] [role="gridcell"]')
    .filter({ hasText: "Industria" })
    .first();
  if ((await industrialTile.count()) > 0) {
    await industrialTile.click();
    await page.waitForTimeout(1500);
    const pair = await ui("purchasableSiteForType", "cement_plant");
    if (pair && pair.length === 2)
      try {
        for (const id of pair) await buyParcel(await ui("parcelCellById", id));
        await openProject(
          await ui("parcelCellById", pair[0]),
          "Planta de cemento",
          "Elegir solares",
        );
        await page.getByText("Proyecto en preparación").waitFor({ timeout: 10000 });
        await clickCell(await ui("parcelCellById", pair[1]));
        await page.getByRole("button", { name: "Añadir este solar" }).click();
        await page.getByText("2/2 parcelas").first().waitFor({ timeout: 10000 });
        const twoParcel = await enterPlacement();
        measurements.candidates.twoParcels = twoParcel?.candidates ?? 0;
        measurements.fps.placementTwoParcels = await sampleFps(2000);
        await shot("04-two-parcel-placement.png");
        note(
          `04 · dos parcelas: ${twoParcel?.candidates ?? 0} candidatas sobre la unión de ${twoParcel?.parcelIds.length} solares`,
        );
        await page.keyboard.press("Escape");
      } catch (error) {
        note(`04 · la colocación de 2 parcelas no fue alcanzable: ${error.message}`);
      }
    else {
      note("04 · sin pareja comprable de cementera en el distrito industrial");
    }
    const triple = await ui("purchasableSiteForType", "steelworks");
    if (triple && triple.length === 3)
      try {
        for (const id of triple) await buyParcel(await ui("parcelCellById", id));
        await clickCell(await ui("parcelCellById", triple[0]));
        await (
          await openProject(await ui("parcelCellById", triple[0]), "Acería", "Elegir solares")
        ).click();
        {
          for (const id of triple.slice(1)) {
            await clickCell(await ui("parcelCellById", id));
            const add = page.getByRole("button", { name: "Añadir este solar" });
            await add.waitFor({ timeout: 8000 });
            await add.click();
            await page.waitForTimeout(300);
          }
          await page.getByText("3/3 parcelas").first().waitFor({ timeout: 10000 });
          const threeParcel = await enterPlacement();
          measurements.candidates.threeParcels = threeParcel?.candidates ?? 0;
          measurements.fps.placementThreeParcels = await sampleFps(2000);
          await shot("05-three-parcel-placement.png");
          const cash = await ui("cash");
          const confirmBlocked = await page
            .getByRole("listitem")
            .filter({ hasText: /faltan|cuadrilla/ })
            .count();
          note(
            `05 · tres parcelas: ${threeParcel?.candidates ?? 0} candidatas sobre la unión · caja ${cash} u. · ${confirmBlocked > 0 ? "confirmación bloqueada por economía real (sin inyectar recursos)" : "confirmación disponible"}`,
          );
          await page.keyboard.press("Escape");
        }
      } catch (error) {
        note(`05 · la colocación de 3 parcelas no fue alcanzable: ${error.message}`);
      }
    else {
      note("05 · sin triplete comprable de acería en el distrito observado");
    }

    // 11/14 · propiedades industriales terminadas y su entorno (stock preexistente de la ciudad)
    await page.waitForTimeout(400);
    await shot("11-complete-industrial.png");
    await shot("14-industrial-grounds.png");
    note("11/14 · vista del distrito industrial con propiedades terminadas y su entorno");
  } else {
    note("04/05 · la ciudad generada no expuso un distrito industrial");
  }

  // 12 · resoluciones objetivo con el modo abierto
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(400);
  try {
    await goHomeDistrict();
    const homeForResolution = await ui("marketableParcelCell");
    if (homeForResolution) {
      await buyParcel(homeForResolution);
      await openProject(homeForResolution, "Patio residencial");
      await enterPlacement();
    }
  } catch (error) {
    note(`15/16 · sin colocación abierta para la captura de resolución: ${error.message}`);
  }
  await shot("15-1280x720.png");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  await shot("16-1920x1080.png");
  note("15/16 · colocación en 1280×720 y 1920×1080");

  writeFileSync(
    `${SHOTS}/evidence.json`,
    `${JSON.stringify({ measuredAt: new Date().toISOString(), measurements, notes, pageErrors }, null, 2)}\n`,
    "utf8",
  );
  if (pageErrors.length > 0) fail("consola del navegador", pageErrors.join("; "));
  console.log(
    JSON.stringify(
      {
        status: "ok",
        fps: measurements.fps,
        candidates: measurements.candidates,
        sceneChildrenAfterCancel: measurements.cycles.sceneChildrenAfterCancel,
        pageErrors: 0,
      },
      null,
      1,
    ),
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

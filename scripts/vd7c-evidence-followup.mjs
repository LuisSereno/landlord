/* global setTimeout, window, document */

/**
 * V.d-7C · corrida de evidencia dedicada para cerrar P1-3.
 *
 * Las tres capturas que quedaron abiertas en la corrida de 16 (`06-no-placement`,
 * `11-complete-industrial`, `14-industrial-grounds`) no enseñaban el caso que nombran: dos salieron
 * byte a byte idénticas y la otra era un fallback tras un timeout. Este harness se escribe sólo para
 * esos tres casos, recorre el camino real (comprar → elegir ubicación → confirmar → cuadrillas →
 * terminar la obra) y no inyecta dinero, materiales ni estado: si algo no es alcanzable, se registra
 * con la medición que lo demuestra. Escribe `evidence-followup.json` y deja las otras 13 capturas
 * intactas.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4180;
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

/** Sólo se reescriben estos tres ficheros; el resto del set de 16 no se toca. */
const OWNED = ["06-no-placement.png", "11-complete-industrial.png", "14-industrial-grounds.png"];
const hashFile = (file) =>
  createHash("md5")
    .update(readFileSync(`${SHOTS}/${file}`))
    .digest("hex");
const before = Object.fromEntries(OWNED.map((file) => [file, hashFile(file)]));
/** La corrida es determinista: para probar que la captura se rehízo se mira el mtime, no el hash. */
const beforeMtime = Object.fromEntries(
  OWNED.map((file) => [file, statSync(`${SHOTS}/${file}`).mtimeMs]),
);
const untouchedBefore = Object.fromEntries(
  ["01-single-recommended.png", "10-complete-residential.png", "16-1920x1080.png"].map((file) => [
    file,
    hashFile(file),
  ]),
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
const notes = [];
const facts = {};
page.on("pageerror", (error) => pageErrors.push(error.message));

function note(text) {
  notes.push(text);
  console.log(`VD7C-FUERA · ${text}`);
}

function fail(caseName, detail) {
  throw new Error(`Caso "${caseName}" no cerró — ${detail}`);
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
  throw new Error("El servidor de la corrida dedicada no arrancó");
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
  await page
    .waitForFunction(
      (expected) => {
        const selected = window.__landlordCameraTest.getSelectedCell();
        return selected?.x === expected.x && selected?.y === expected.y;
      },
      cell,
      { timeout: 3000 },
    )
    .catch(() => {});
}

const probe = () => page.evaluate(() => window.__landlordPlacementTest?.() ?? null);
const ui = (name, argument) =>
  page.evaluate(
    ({ key, value }) => window.__landlordUiTest[key](...(value === undefined ? [] : [value])),
    { key: name, value: argument },
  );
const camera = () => page.evaluate(() => window.__landlordCameraTest.getCamera());
const stats = () => page.evaluate(() => window.__gameplayVisualStats?.() ?? null);
const parcelPanel = () => page.getByRole("complementary", { name: "Inspección de parcela" }).last();

/** Zoom real de jugador: rueda del ratón sobre el canvas, sin tocar la cámara por API. */
async function zoomInWithWheel(notches) {
  const box = await page.locator(".map-canvas canvas").first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let index = 0; index < notches; index += 1) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(120);
  }
  return await camera();
}

/** El sugeridor de pasos se descarta por paso: se oculta antes de cada captura, como haría una jugadora. */
async function dismissOnboarding() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dismiss = page.getByRole("button", { name: "Ahora no" });
    if ((await dismiss.count()) === 0) return;
    await dismiss.first().click();
    await page.waitForTimeout(250);
  }
}

async function openProject(cell, cardLabel, entry = "Elegir ubicación") {
  await clickCell(cell);
  const panel = parcelPanel();
  await panel.waitFor({ timeout: 10000 });
  const card = panel.locator(".build-card", { hasText: cardLabel }).last();
  await card.waitFor({ timeout: 10000 });
  await card.click();
  const begin = panel.getByRole("button", { name: entry });
  if ((await begin.count()) === 0) {
    await card.click();
    await begin.waitFor({ timeout: 10000 });
  }
  return begin;
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
  const buy = parcelPanel()
    .getByRole("button", { name: /Comprar parcela|Comprar para ampliar/ })
    .first();
  await buy.waitFor({ timeout: 6000 }).catch(() => {});
  if ((await buy.count()) === 0 || !(await buy.isEnabled())) return false;
  await buy.click();
  await page
    .getByText(/Parcela comprada/)
    .first()
    .waitFor({ timeout: 20000 });
  return true;
}

try {
  await waitForServer();
  await startFreshCity();
  facts.homeDistrictName = (await page.locator(".hud-district").innerText()).split("\n")[0];
  facts.cashAtStart = await ui("cash");
  note(`distrito natal: ${facts.homeDistrictName} · caja inicial ${facts.cashAtStart} u.`);

  /* ------------------------------------------------------------------ *
   * 06 · «sin colocación»: suelo municipal. Es el único «aquí no cabe nada»
   * que la interfaz deja abrir en una partida nueva: el recuento autoritativo
   * de `pnpm placement:reachability` (2 297 proyectos en la semilla de la app)
   * no produce ni un solo solar comprable con cero candidatas.
   * ------------------------------------------------------------------ */
  try {
    const publicCell = await ui("publicParcelCell");
    if (!publicCell) fail("06", "la ciudad generada no expone ningún solar municipal");
    /** Se prueban celdas del mismo solar: el anchor puede caer sobre el edificio municipal. */
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: 6 },
      { dx: 6, dy: 0 },
      { dx: -6, dy: 0 },
      { dx: 0, dy: -6 },
      { dx: 6, dy: 6 },
    ];
    let picked = null;
    for (const offset of offsets) {
      const cell = { x: publicCell.x + offset.dx, y: publicCell.y + offset.dy };
      await clickCell(cell);
      const panel = parcelPanel();
      await panel.waitFor({ timeout: 10000 });
      const text = (await panel.innerText()).replace(/\s+/g, " ");
      const buy = await panel.getByRole("button", { name: /Comprar/ }).count();
      const place = await page.getByRole("button", { name: "Elegir ubicación" }).count();
      if (!/Suelo municipal|Ayuntamiento/.test(text) || buy > 0 || place > 0) continue;
      const candidate = {
        cell: `${cell.x},${cell.y}`,
        eyebrow: await panel.locator(".eyebrow").first().innerText(),
        title: await panel.locator("h2").first().innerText(),
        panelExcerpt: text.slice(0, 220),
        buyButton: buy,
        placeButton: place,
        catalog: await panel.locator(".build-catalog").count(),
        placementIssueRendered: await page.locator(".placement-issue").count(),
      };
      /** Se prefiere la ficha del SOLAR (un erial municipal sin proyecto posible); el equipamiento vale como fallback. */
      if (candidate.eyebrow === "PARCELA") {
        picked = candidate;
        break;
      }
      picked = picked ?? candidate;
    }
    if (!picked)
      fail("06", "ninguna celda del solar municipal devolvió una ficha sin compra ni colocación");
    facts.noPlacement = picked;
    await dismissOnboarding();
    await shot("06-no-placement.png");
    facts.noPlacement.visualStats = await stats();
    note(
      `06 · ${picked.eyebrow} «${picked.title}» en ${picked.cell}: sin compra, sin catálogo y sin colocación posible`,
    );
  } catch (error) {
    fail("06", error.message);
  }

  /* ------------------------------------------------------------------ *
   * 11 y 14 · propiedad industrial terminada por la jugadora: se compra un
   * solar industrial, se coloca el Taller con el modo de colocación, se
   * asignan cuadrillas libres y se espera el fin de la obra a 4×.
   * ------------------------------------------------------------------ */
  const workshopCell = await ui("marketableParcelCellForType", "workshop");
  if (!workshopCell) fail("11", "ningún solar del distrito observado admite un Taller");
  facts.industrialParcel = { cell: `${workshopCell.x},${workshopCell.y}` };
  if (!(await buyParcel(workshopCell)))
    fail(
      "11",
      "el solar industrial no fue comprable con la caja de la partida (sin inyectar recursos)",
    );

  await openProject(workshopCell, "Taller");
  const placement = await enterPlacement();
  if (!placement || placement.candidates === 0)
    fail("11", `el modo de colocación no devolvió candidatas: ${JSON.stringify(placement)}`);
  facts.industrialPlacement = {
    candidates: placement.candidates,
    selectedId: placement.selectedId,
    orientation: placement.selectedOrientation,
    footprint: placement.selectedFootprint.map((cell) => `${cell.x},${cell.y}`).join(" "),
  };
  note(
    `11 · ${placement.candidates} candidatas para el Taller en ${facts.industrialPlacement.footprint}`,
  );

  await page.getByRole("button", { name: "Confirmar proyecto" }).click();
  await page
    .waitForFunction(() => window.__landlordUiTest.ownedSiteFootprint() !== null, null, {
      timeout: 25000,
    })
    .catch(() => {});
  const site = await ui("ownedSiteFootprint");
  if (!site) fail("11", "la confirmación no creó la obra");
  if (site.buildingType !== "workshop")
    fail("11", `la obra creada es ${site.buildingType}, no un taller industrial`);
  facts.industrialSite = site;

  /** Se asignan TODAS las cuadrillas libres del jugador: es el camino real y acorta la obra. */
  const crewButton = page.getByRole("button", { name: /Asignar Cuadrilla \d+/ });
  let crewsAssigned = 0;
  while ((await crewButton.count()) > 0 && crewsAssigned < 4) {
    await crewButton.first().click();
    await page
      .waitForFunction(
        (count) => window.__landlordUiTest.ownedSiteProgress().assignedCrewIds.length > count,
        crewsAssigned,
        { timeout: 20000 },
      )
      .catch(() => {});
    crewsAssigned += 1;
    await page.waitForTimeout(250);
  }
  const withCrews = await ui("ownedSiteProgress");
  facts.industrialCrews = withCrews?.assignedCrewIds?.length ?? 0;
  if (facts.industrialCrews === 0)
    fail("11", "ninguna cuadrilla quedó asignada a la obra industrial");
  note(`11 · ${facts.industrialCrews} cuadrilla(s) asignada(s) a la obra del Taller`);

  await page.getByRole("button", { name: "4×", exact: true }).click();
  const buildDeadline = Date.now() + 600_000;
  const progressSamples = [];
  let workRequired = null;
  while (Date.now() < buildDeadline) {
    const progress = await ui("ownedSiteProgress");
    if (!progress) break;
    workRequired = progress.workRequired;
    progressSamples.push(progress.progress);
    await page.waitForTimeout(1200);
  }
  const stillBuilding = await ui("ownedSiteProgress");
  if (stillBuilding)
    fail(
      "11",
      `la obra no terminó en 10 min a 4× (progreso ${stillBuilding.progress}/${stillBuilding.workRequired})`,
    );
  facts.industrialBuild = {
    workRequired,
    lastProgress: progressSamples.at(-1) ?? null,
    samples: progressSamples.length,
  };

  const finishedCell = await ui("finishedBuildingCell", "workshop");
  if (!finishedCell) fail("11", "no hay un edificio industrial terminado en el distrito observado");
  const ownedBuilding = await ui("ownedBuildingId");
  if (!ownedBuilding) fail("11", "la jugadora no tiene ningún edificio terminado");
  facts.industrialFinished = {
    buildingId: ownedBuilding,
    cell: `${finishedCell.x},${finishedCell.y}`,
  };
  note(
    `11/14 · Taller terminado (${ownedBuilding}) en ${facts.industrialFinished.cell} tras ${progressSamples.length} sondeos`,
  );

  /* 11 · la propiedad completa con su ficha identidad visible. */
  await clickCell(finishedCell);
  await parcelPanel().waitFor({ timeout: 10000 });
  facts.industrialPanel = {
    eyebrow: await parcelPanel().locator(".eyebrow").first().innerText(),
    title: await parcelPanel().locator("h2").first().innerText(),
    excerpt: (await parcelPanel().innerText()).replace(/\s+/g, " ").slice(0, 200),
  };
  facts.zoomForComplete = await camera();
  await dismissOnboarding();
  await shot("11-complete-industrial.png");
  facts.visualStatsComplete = await stats();

  /* 14 · mismo recinto, encuadre acercado con la rueda real para leer el entorno derivado. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const zoomed = await zoomInWithWheel(2);
  facts.zoomForGrounds = zoomed;
  if (zoomed.zoom <= (facts.zoomForComplete?.zoom ?? 1))
    fail("14", `la rueda no acercó la cámara (zoom ${zoomed.zoom})`);
  await page.waitForTimeout(400);
  await dismissOnboarding();
  await shot("14-industrial-grounds.png");
  facts.visualStatsGrounds = await stats();
  note(`14 · recinto industrial acercado a zoom ${zoomed.zoom.toFixed(2)}`);

  /* Integridad del set: sólo los tres ficheros de esta corrida cambian. */
  const after = Object.fromEntries(OWNED.map((file) => [file, hashFile(file)]));
  const untouchedAfter = Object.fromEntries(
    Object.keys(untouchedBefore).map((file) => [file, hashFile(file)]),
  );
  facts.captures = { before, after };
  facts.untouchedControl = { before: untouchedBefore, after: untouchedAfter };
  if (after["11-complete-industrial.png"] === after["14-industrial-grounds.png"])
    fail("14", "las dos capturas industriales vuelven a ser idénticas byte a byte");
  for (const file of OWNED) {
    const mtime = statSync(`${SHOTS}/${file}`).mtimeMs;
    if (mtime <= beforeMtime[file]) fail(file, "la captura no se reescribió");
  }
  for (const file of Object.keys(untouchedBefore))
    if (untouchedAfter[file] !== untouchedBefore[file])
      fail(file, "la corrida dedicada tocó una captura que no le corresponde");

  if (pageErrors.length > 0) fail("consola del navegador", pageErrors.join("; "));
  console.log(
    JSON.stringify(
      {
        status: "ok",
        industrial: facts.industrialFinished,
        crews: facts.industrialCrews,
        pageErrors: 0,
      },
      null,
      1,
    ),
  );
} finally {
  writeFileSync(
    `${SHOTS}/evidence-followup.json`,
    `${JSON.stringify({ measuredAt: new Date().toISOString(), facts, notes, pageErrors }, null, 2)}\n`,
    "utf8",
  );
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

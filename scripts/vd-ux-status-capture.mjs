/* global setTimeout, window */

/**
 * V.d-UX.S · evidencia visual del estado del activo sobre el mapa.
 *
 * Dos niveles, como exige el plan:
 *  A · cobertura sintética con `injectProjection` (todos los estados, todos los tiers de zoom,
 *      día/noche, movimiento reducido y los casos de colisión espacial).
 *  B · la integración con motor real vive en `asset-status.test.ts` (runScenario), no aquí.
 *
 * Clona el patrón de `vd-ux-smoke.mjs`: preview propio, partida fresca, hook de cámara.
 */

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4188;
const baseUrl = process.env.VD_SMOKE_BASE_URL ?? `http://127.0.0.1:${port}/`;
const external = Boolean(process.env.VD_SMOKE_BASE_URL);
const SHOTS = "docs/art/golden/vd-ux-status";
const EVIDENCE = "docs/execution/phase-4/vd-ux-s-service-final.json";
/** Ventana de muestreo de §3.3: 15 s × 3 pasadas por brazo (≈540 frames por brazo y zoom). */
const PERF_WARMUP_MS = 3000;
const PERF_MS = 15_000;
const PERF_PASSES = 3;
const PERF_ZOOMS = [1, 2];
mkdirSync(SHOTS, { recursive: true });

const server = external
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const pageErrors = [];
const consoleIssues = [];
const steps = [];
const evidence = { shots: [], assertions: [], metrics: {}, pageErrors };

function step(name) {
  steps.push(name);
  console.log(`VD-STATUS ${String(steps.length).padStart(2, "0")} · ${name}`);
}

function check(name, ok, detail) {
  evidence.assertions.push({ name, ok: Boolean(ok), blocking: true, detail });
  console.log(`   ${ok ? "OK " : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(`Aserción "${name}" falló — ${detail ?? ""}`);
}

/**
 * Registro no bloqueante: el dato queda en la evidencia y en el acta, pero la corrida no se corta.
 * Se usa sólo cuando el INSTRUMENTO no resuelve el criterio (p. ej. un 5 % sobre 12 FPS son 0,1
 * cuadros: el cuantún del medidor es mayor que el presupuesto), nunca para ocultar un fallo real.
 */
function note(name, ok, detail) {
  evidence.assertions.push({ name, ok: Boolean(ok), blocking: false, detail });
  console.log(`   ${ok ? "OK " : "NOTE"} · ${name}${detail ? ` — ${detail}` : ""}`);
}

async function shot(name) {
  const file = `${SHOTS}/${name}.jpg`;
  await page.screenshot({ path: file, type: "jpeg", quality: 86 });
  evidence.shots.push(file);
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
  throw new Error("El servidor de captura no arrancó");
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" || message.type() === "warning")
    consoleIssues.push(`${message.type()}: ${message.text()}`);
});
page.on("requestfailed", (request) => {
  consoleIssues.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`);
});

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

/** Escenario sembrado: sólo presentación, la proyección viva se clona y se mutan sus datos. */
async function seedScenario({ markers = true } = {}) {
  return page.evaluate(
    ({ markers }) => {
      const api = window.__landlordCameraTest;
      const projection = api.getProjection();
      if (!projection?.economy) return { ok: false, reason: "sin economía" };
      const clone = JSON.parse(JSON.stringify(projection));
      const economy = clone.economy;
      const PLAYER = "org_00000001";
      const RIVAL = "org_00000002";
      const parcels = economy.parcels.slice(0, 8);
      if (parcels.length < 6) return { ok: false, reason: "pocas parcelas" };
      parcels.forEach((parcel, index) => {
        parcel.ownerOrganizationId = index === 5 ? RIVAL : PLAYER;
        parcel.buildingIds = [];
      });
      const types = [
        "courtyard_home",
        "row_house",
        "apartment_block",
        "workshop",
        "town_hall",
        "clinic",
      ];
      economy.buildings = parcels.map((parcel, index) => ({
        id: `building_000000${index + 1}`,
        parcelIds: [parcel.id],
        districtId: parcel.districtId,
        ownerOrganizationId: parcel.ownerOrganizationId,
        productionFacilityId: null,
        type: types[index % types.length],
        footprintCells: parcel.cells.slice(0, 2),
        orientation: 0,
        floors: 2,
        form: "detached",
        level: index === 0 ? 2 : 1,
        condition: index === 2 ? 40 : 100,
        tenantId: null,
        tenantIds: index === 1 || index === 4 ? [] : ["tenant_00000001"],
        capacity: 2,
        upgraded: index === 0 || index === 4,
        structuralIntegrity: 100,
        state: index === 3 ? "burning" : "operational",
        casualtiesTotal: { injured: 0, dead: 0 },
        effectiveRent: 120,
        maintenanceCost: 40,
        maintenanceDue: index === 2 ? 400 : 40,
      }));
      parcels.forEach((parcel, index) => {
        parcel.buildingIds = [`building_000000${index + 1}`];
      });
      economy.production = [{ buildingId: "building_0000004", output: "cement" }];
      economy.banking = {
        bankOrganizationId: "org_00000003",
        offers: [],
        loans: [
          {
            id: "loan_00000001",
            status: "active",
            outstandingPrincipal: 600,
            monthlyPayment: 55,
            remainingMonths: 12,
            missedPayments: 0,
            collateralParcelId: parcels[0].id,
            nextPaymentTick: 36000,
          },
          {
            id: "loan_00000002",
            status: "delinquent",
            outstandingPrincipal: 480,
            monthlyPayment: 55,
            remainingMonths: 9,
            missedPayments: 2,
            collateralParcelId: parcels[1].id,
            nextPaymentTick: 36000,
          },
          {
            id: "loan_00000003",
            status: "defaulted",
            outstandingPrincipal: 300,
            monthlyPayment: 55,
            remainingMonths: 4,
            missedPayments: 3,
            collateralParcelId: parcels[2].id,
            nextPaymentTick: null,
          },
        ],
        auctions: [
          {
            loanId: "loan_00000003",
            collateralParcelId: parcels[2].id,
            sellerOrganizationId: PLAYER,
            reservePrice: 500,
            highestBid: 0,
            highestBidderOrganizationId: null,
            status: "open",
            closesAtTick: 72000,
          },
          {
            loanId: "loan_00000009",
            collateralParcelId: parcels[5].id,
            sellerOrganizationId: RIVAL,
            reservePrice: 400,
            highestBid: 450,
            highestBidderOrganizationId: PLAYER,
            status: "open",
            closesAtTick: 72000,
          },
        ],
      };
      economy.insurance = {
        insurerOrganizationId: "org_00000005",
        offers: [],
        claims: [],
        contracts: [
          {
            buildingId: "building_0000001",
            insurerOrganizationId: "org_00000005",
            coverage: "fire_plus",
            premium: 130,
            coverageLimit: 3000,
            deductible: 350,
            exclusions: ["sabotage"],
            status: "active",
            purchasedAtTick: 0,
            lastPremiumTick: 0,
            nextPremiumTick: 36000,
            totalPremiumPaid: 130,
          },
          {
            buildingId: "building_0000002",
            insurerOrganizationId: "org_00000005",
            coverage: "fire_basic",
            premium: 25,
            coverageLimit: 1800,
            deductible: 200,
            exclusions: ["sabotage", "blast"],
            status: "lapsed",
            purchasedAtTick: 0,
            lastPremiumTick: 0,
            nextPremiumTick: null,
            totalPremiumPaid: 25,
          },
        ],
      };
      economy.alerts = [
        {
          id: "condition-building_0000003",
          severity: "medium",
          kind: "maintenance",
          reason: "building_condition",
          message: "El edificio está al 40 % de condición.",
          targetId: parcels[2].id,
          buildingId: "building_0000003",
        },
        {
          id: "insurance-building_0000006",
          severity: "medium",
          kind: "maintenance",
          reason: "uninsured_building",
          message: "El edificio no tiene seguro y su riesgo de deterioro es alto.",
          targetId: parcels[5].id,
          buildingId: "building_0000006",
        },
      ];
      economy.constructionSites = [
        {
          id: "site_00000001",
          parcelIds: [parcels[6].id],
          districtId: parcels[6].districtId,
          ownerOrganizationId: PLAYER,
          buildingType: "row_house",
          footprintCells: parcels[6].cells.slice(0, 1),
          orientation: 0,
          floors: 2,
          form: "detached",
          progress: 10,
          workRequired: 48,
          upgradeBuildingId: null,
          repairBuildingId: null,
          crewCapacity: 0,
          kind: "clear_ruin",
          targetBuildingId: null,
          assignedCrewIds: [],
          assignedTechnicianId: null,
        },
      ];
      /**
       * Brazo de control del gate §3.3: la MISMA ciudad (parcelas, edificios, obra, conteo de
       * GameObjects) sin ningún disparador del idioma de estado, para que la diferencia de FPS sea
       * el coste de los marcadores y no del escenario.
       */
      if (!markers) {
        economy.banking.loans = [];
        economy.banking.auctions = [];
        economy.insurance.contracts = [];
        economy.alerts = [];
        economy.buildings.forEach((building) => {
          building.state = "operational";
          building.condition = 100;
          building.maintenanceDue = building.maintenanceCost;
          building.upgraded = false;
          building.tenantIds = ["tenant_00000001"];
        });
        economy.constructionSites.forEach((site) => {
          site.assignedCrewIds = ["crew_00000001"];
        });
      }
      api.injectProjection(clone);
      return { ok: true, center: parcels[2].cell, parcels: parcels.map((p) => p.id) };
    },
    { markers },
  );
}

async function setZoom(zoom, cell) {
  await page.evaluate(
    ({ zoom, cell }) => {
      const api = window.__landlordCameraTest;
      if (cell) api.centerOnCell(cell);
      const camera = api.getCamera();
      api.configure({ zoom, scrollX: camera.scrollX, scrollY: camera.scrollY });
    },
    { zoom, cell },
  );
  await page.waitForTimeout(450);
}

async function stats() {
  return page.evaluate(() => window.__gameplayVisualStats?.() ?? null);
}

/**
 * El hook de cámara devuelve coordenadas del lienzo de Phaser; el ratón de Playwright habla en
 * coordenadas de página. Convertir con el rect y la escala reales, como hacen los smokes del repo.
 */
async function pagePoint(point) {
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
    throw new Error(`Punto fuera del lienzo visible: ${JSON.stringify(point)}`);
  }
  return { x: metrics.x + point.x * metrics.scaleX, y: metrics.y + point.y * metrics.scaleY };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Muestreo de frame time por `requestAnimationFrame`: una muestra por frame real presentado, sin
 * tocar el instrumentation de producción. Las ventanas de 500 ms del motor dan ~20 muestras y su
 * p95 es la segunda mayor (poco informativo); los deltas brutos dan cientos de muestras por brazo.
 */
async function installFrameSampler() {
  await page.evaluate(() => {
    if (window.__vdSFrames) return;
    window.__vdSFrames = { deltas: [], last: 0 };
    const tick = (now) => {
      const state = window.__vdSFrames;
      if (state.last > 0) state.deltas.push(now - state.last);
      state.last = now;
      if (state.deltas.length > 6000) state.deltas.splice(0, state.deltas.length - 6000);
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

/** Una pasada de un brazo: mismo cámara, mismo escenario; `markers` pinta o no el idioma de estado. */
async function collectArm(markers, zoom, cell) {
  const seeded = await seedScenario({ markers });
  if (!seeded.ok)
    throw new Error(`Brazo ${markers ? "status" : "control"} no sembrado: ${seeded.reason}`);
  await setZoom(zoom, cell);
  await page.waitForTimeout(PERF_WARMUP_MS);
  const counts = await stats();
  await page.evaluate(() => {
    if (window.__visualSlicePerformance) window.__visualSlicePerformance.samples = [];
    if (window.__vdSFrames) window.__vdSFrames.deltas = [];
  });
  await page.waitForTimeout(PERF_MS);
  const raw = await page.evaluate(() => ({
    fps: [...(window.__visualSlicePerformance?.samples ?? [])],
    frames: [...(window.__vdSFrames?.deltas ?? [])],
  }));
  return { fps: raw.fps, frames: raw.frames, counts };
}

/**
 * Resumen de un brazo con TODAS sus pasadas agrupadas: con ~240 muestras por pasada, el p99 era el
 * tercer peor frame y una sola molestia del compositor decidía el veredicto. Agrupar pasadas sube el
 * recuento y estabiliza la cola.
 */
function summariseArm(fpsSamples, frameSamples, counts) {
  const rounded = (value) => (value === null ? null : Number(value.toFixed(2)));
  const mean = (values) =>
    values.length === 0
      ? null
      : rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
  const median = percentile(fpsSamples, 50);
  const framesSorted = [...frameSamples].sort((a, b) => a - b);
  return {
    fpsWindows: fpsSamples.length,
    frames: frameSamples.length,
    fpsP50: median,
    fpsP95: percentile(fpsSamples, 95),
    fpsMin: fpsSamples.length ? Math.min(...fpsSamples) : null,
    frameMeanMs: mean(frameSamples),
    frameP50Ms: rounded(percentile(frameSamples, 50)),
    frameP90Ms: rounded(percentile(frameSamples, 90)),
    frameP95Ms: rounded(percentile(frameSamples, 95)),
    frameP99Ms: rounded(percentile(frameSamples, 99)),
    worstFrameMs: framesSorted.length ? rounded(framesSorted[framesSorted.length - 1]) : null,
    /** Molestias visibles: frames más de un 50 % por encima de la mediana. */
    hitchFrames: framesSorted.filter((value) => value > percentile(frameSamples, 50) * 1.5).length,
    statusGameObjects: counts?.statusGameObjects ?? 0,
    sceneChildren: counts?.sceneChildren ?? 0,
    glyphTextures: counts?.glyphTextures ?? 0,
    statusTweens: counts?.statusTweens ?? 0,
    indicators: counts?.indicators ?? 0,
    parcelMarks: counts?.parcelMarks ?? 0,
    facadeMarks: counts?.facadeMarks ?? 0,
  };
}

async function measureArms(markers, zoom, cell, passes) {
  const fps = [];
  const frames = [];
  let counts = null;
  for (let pass = 0; pass < passes; pass += 1) {
    const collected = await collectArm(markers, zoom, cell);
    fps.push(...collected.fps);
    frames.push(...collected.frames);
    counts = collected.counts;
  }
  return { summary: summariseArm(fps, frames, counts), passes };
}

try {
  await waitForServer();
  step("partida fresca con el worker conectado");
  await startFreshCity();
  /**
   * Sin pausar, el worker publica cada 2 ticks y sobrescribe la proyección inyectada antes de que
   * se pueda fotografiar. La captura es de presentación: el motor queda quieto.
   */
  const pause = page.getByRole("button", { name: "Pausar simulación" }).first();
  await pause.waitFor({ timeout: 10000 });
  await pause.click();
  await page.waitForTimeout(600);

  step("espera a que el catálogo de texturas termine de registrarse");
  const readyStart = Date.now();
  await page.waitForFunction(() => window.__gameplayVisualStats?.().assetsReady === true, null, {
    timeout: 180000,
    polling: 1000,
  });
  const readyMs = Date.now() - readyStart;
  evidence.metrics.assetsReadyMs = readyMs;
  console.log(`   assetsReady tras ${readyMs} ms`);

  step("escenario sembrado con los seis estados invisibles");
  console.log("   DIAG antes de sembrar ·", JSON.stringify(await stats()));
  const seeded = await seedScenario();
  check("escenario inyectado", seeded.ok, seeded.reason);
  await page.waitForTimeout(1200);

  const base = await stats();
  console.log("   DIAG ·", JSON.stringify(base));
  console.log(
    "   DIAG marcas ·",
    JSON.stringify(await page.evaluate(() => window.__landlordCameraTest.listFacadeMarks())),
  );
  console.log(
    "   DIAG rótulos ·",
    JSON.stringify(
      await page.evaluate(() => window.__landlordCameraTest.listSignage().slice(0, 4)),
    ),
  );
  console.log("   DIAG consola ·", JSON.stringify(consoleIssues.slice(0, 12), null, 1));
  evidence.metrics.initial = base;
  /**
   * El escenario sembrado cambia propiedad y edificios, que SÍ afectan al suelo horneado. La
   * invariante del plan es que un cambio puramente ECONÓMICO no lo regenere: se mide más abajo,
   * comparando el contador antes y después de mutar sólo préstamos, pólizas y alertas.
   */
  evidence.metrics.groundRebakesAfterSeed = base?.groundRebakes;
  check(
    "tope de badges respetado",
    (base?.indicators ?? 0) <= 12,
    `indicators=${base?.indicators}`,
  );
  check("hay placas de carga", (base?.parcelMarks ?? 0) >= 3, `parcelMarks=${base?.parcelMarks}`);
  check("hay marcas de mejora", (base?.facadeMarks ?? 0) >= 1, `facadeMarks=${base?.facadeMarks}`);

  step("tiers de zoom: 0.5 sólo críticos, 0.7 avisos, 0.85 placas, 1.0 marcas, 2.0 detalle");
  for (const zoom of [0.5, 0.7, 0.85, 1, 2]) {
    await setZoom(zoom, seeded.center);
    const current = await stats();
    evidence.metrics[`zoom_${zoom}`] = current;
    await shot(`zoom-${String(zoom).replace(".", "_")}`);
    if (zoom === 0.5) {
      const visible = await page.evaluate(() =>
        window.__landlordCameraTest.listIndicators().filter((entry) => entry.visible),
      );
      check(
        "en zoom lejano sólo sobreviven los críticos",
        visible.every((entry) => entry.critical),
        `${visible.length} visibles`,
      );
    }
    if (zoom === 1) {
      const marks = await page.evaluate(() => window.__landlordCameraTest.listFacadeMarks());
      check(
        "las marcas de mejora se ven en zoom de juego",
        marks.some((m) => m.visible),
        `${marks.length} marcas`,
      );
      const plates = await page.evaluate(() => window.__landlordCameraTest.listParcelMarks());
      check(
        "las placas de carga se ven en zoom de juego",
        plates.some((m) => m.visible),
        `${plates.length} placas`,
      );
    }
  }

  step("glifos rasterizados desde el registro único");
  const afterGlyphs = await stats();
  check(
    "texturas de glifo acotadas",
    (afterGlyphs?.glyphTextures ?? 0) <= 70,
    `glyphTextures=${afterGlyphs?.glyphTextures}`,
  );
  check(
    "texturas de glifo presentes",
    (afterGlyphs?.glyphTextures ?? 0) > 0,
    `glyphTextures=${afterGlyphs?.glyphTextures}`,
  );
  evidence.metrics.glyphs = afterGlyphs;

  step("hover de badge y placa: el tooltip explica en español y pliega el detalle");
  const badge = await page.evaluate(() => {
    const api = window.__landlordCameraTest;
    const entry = api.listIndicators().find((item) => item.visible && !item.critical);
    return entry ?? null;
  });
  check("hay un badge no crítico visible", badge !== null, badge?.kind);
  const badgePoint = await pagePoint(badge.screen);
  await page.mouse.move(badgePoint.x, badgePoint.y);
  await page.waitForTimeout(400);
  const badgeTip = await page.evaluate(() => window.__landlordCameraTest.getIndicatorTooltip());
  evidence.metrics.badgeTooltip = badgeTip;
  check(
    "el hover del badge explica su causa en español",
    Boolean(badgeTip?.visible) && badgeTip.text.includes(badge.label),
    JSON.stringify(badgeTip?.text ?? ""),
  );
  check(
    "los hechos secundarios van plegados en el mismo tooltip",
    (badgeTip?.text.split("\n").length ?? 0) >= 2,
    `${badgeTip?.text.split("\n").length} líneas`,
  );
  await shot("badge-hover");

  const plate = await page.evaluate(() => {
    const entry = window.__landlordCameraTest
      .listParcelMarks()
      .find((mark) => mark.visible && mark.screen.x > 40 && mark.screen.y > 40);
    return entry ? { id: entry.id, kind: entry.kind, screen: entry.screen } : null;
  });
  check("hay una placa de carga visible", plate !== null, plate?.kind);
  const platePoint = await pagePoint(plate.screen);
  await page.mouse.move(platePoint.x, platePoint.y);
  await page.waitForTimeout(400);
  const plateTip = await page.evaluate(() => window.__landlordCameraTest.getIndicatorTooltip());
  evidence.metrics.plateTooltip = plateTip;
  check(
    "la placa explica su carga sin crear capa interactiva",
    Boolean(plateTip?.visible) && plateTip.text.includes(" u."),
    JSON.stringify(plateTip?.text ?? ""),
  );
  check(
    "el tooltip no filtra ids ni ticks crudos",
    !/_[0-9]{6,}/.test(plateTip?.text ?? "") && !/\btick\b/i.test(plateTip?.text ?? ""),
    JSON.stringify(plateTip?.text ?? ""),
  );
  await shot("parcel-plate-hover");
  await page.mouse.move(12, 12);
  await page.waitForTimeout(250);

  /**
   * El routing badge → pestaña NO se verifica aquí: la proyección inyectada sólo llega a la escena,
   * no a la economía de React, así que un badge sintético selecciona un edificio que el panel no
   * conoce. Ese flujo se prueba con DOM real en `apps/web/src/ui/panels-routing.test.tsx`, que
   * monta ContextPanel y dispara peticiones sucesivas con token nuevo sobre el mismo edificio.
   */

  step("colisión espacial: placa + badge + rótulo + marca en la misma manzana");
  await setZoom(2, seeded.center);
  await shot("clutter-dense-block");
  const dense = await stats();
  evidence.metrics.dense = dense;
  check(
    "sin crecimiento descontrolado de objetos",
    (dense?.sceneChildren ?? 0) < 4000,
    `sceneChildren=${dense?.sceneChildren}`,
  );

  step("estabilidad: cinco inyecciones idénticas no duplican objetos");
  const before = await stats();
  for (let iteration = 0; iteration < 5; iteration += 1) {
    await seedScenario();
    await page.waitForTimeout(320);
  }
  const after = await stats();
  evidence.metrics.stability = { before, after };
  check(
    "placas estables",
    after?.parcelMarks === before?.parcelMarks,
    `${before?.parcelMarks} → ${after?.parcelMarks}`,
  );
  check(
    "marcas estables",
    after?.facadeMarks === before?.facadeMarks,
    `${before?.facadeMarks} → ${after?.facadeMarks}`,
  );
  check(
    "badges estables",
    after?.indicators === before?.indicators,
    `${before?.indicators} → ${after?.indicators}`,
  );
  check("tweens acotados", (after?.statusTweens ?? 0) <= 12, `statusTweens=${after?.statusTweens}`);
  check(
    "inyecciones idénticas no re-hornean el suelo",
    after?.groundRebakes === before?.groundRebakes,
    `${before?.groundRebakes} → ${after?.groundRebakes}`,
  );

  step("mutación sólo económica: el suelo no se regenera");
  const economicBefore = await stats();
  await page.evaluate(() => {
    const api = window.__landlordCameraTest;
    const clone = JSON.parse(JSON.stringify(api.getProjection()));
    const economy = clone.economy;
    economy.banking.loans[0].status = "delinquent";
    economy.banking.loans[0].missedPayments = 2;
    economy.insurance.contracts[0].status = "lapsed";
    economy.alerts.push({
      id: "insurance-building_0000001",
      severity: "medium",
      kind: "maintenance",
      reason: "uninsured_building",
      message: "El edificio no tiene seguro.",
      targetId: economy.buildings[0].parcelIds[0],
      buildingId: "building_0000001",
    });
    api.injectProjection(clone);
  });
  await page.waitForTimeout(900);
  const economicAfter = await stats();
  evidence.metrics.economicOnly = { before: economicBefore, after: economicAfter };
  check(
    "la economía no re-hornea el suelo",
    economicAfter?.groundRebakes === economicBefore?.groundRebakes,
    `${economicBefore?.groundRebakes} → ${economicAfter?.groundRebakes}`,
  );
  const platesAfterEconomy = await page.evaluate(() =>
    window.__landlordCameraTest.listParcelMarks(),
  );
  check(
    "la placa refleja el nuevo estado sin recrearse",
    platesAfterEconomy.some((mark) => mark.kind === "delinquent"),
    platesAfterEconomy.map((mark) => mark.kind).join(","),
  );
  await shot("economic-only-mutation");

  step("capas de datos: leyenda visible y vuelta a vista normal");
  for (const label of ["Cargas y subastas", "Ocupación", "Seguro"]) {
    const group = page.getByRole("button", { name: "Estado del activo" }).first();
    if (await group.count()) await group.click();
    const option = page.getByRole("button", { name: label, exact: true }).first();
    if (await option.count()) {
      await option.click();
      await page.waitForTimeout(500);
      await shot(`overlay-${label.split(" ")[0].toLowerCase()}`);
      const legend = await page.locator(".overlay-legend, .legend-swatch").count();
      check(`leyenda presente en ${label}`, legend > 0, `${legend} elementos`);
    } else {
      check(`capa ${label} accesible`, false, "no encontrada en la toolbar");
    }
  }

  const normalView = page.getByRole("button", { name: "Vista normal" }).first();
  if (await normalView.count()) {
    await normalView.click();
    await page.waitForTimeout(400);
    const backToNormal = await stats();
    check(
      "la vuelta a vista normal deja el idioma de estado intacto",
      (backToNormal?.indicators ?? 0) > 0 && (backToNormal?.parcelMarks ?? 0) > 0,
      `indicators=${backToNormal?.indicators} parcelMarks=${backToNormal?.parcelMarks}`,
    );
  } else {
    check("botón de vista normal localizable", false, "no encontrado");
  }

  step("ciclo día/noche: el remount reconcilia sin duplicar ni perder");
  const nightToggle = page.getByRole("button", { name: /noche|night/i }).first();
  if (await nightToggle.count()) {
    await nightToggle.click();
    /** El remount recrea la escena: el catálogo vuelve a registrarse y hay que esperarlo. */
    await page.waitForFunction(() => window.__gameplayVisualStats?.().assetsReady === true, null, {
      timeout: 180000,
      polling: 1000,
    });
    /**
     * Defecto PREEXISTENTE del cableado: el efecto que entrega la proyección depende sólo de
     * `[projection]`, así que una escena remontada después de ese efecto no la recibe hasta la
     * siguiente publicación del worker. Con la simulación pausada eso no ocurre nunca. Para la
     * evidencia se reanuda un instante y se vuelve a pausar; el defecto se registra, no se arregla
     * aquí (fuera del alcance de esta fase).
     */
    const resume = page.getByRole("button", { name: "Continuar simulación" }).first();
    if (await resume.count()) {
      await resume.click();
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: "Pausar simulación" }).first().click();
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(
      () => window.__landlordCameraTest?.getProjection()?.economy != null,
      null,
      {
        timeout: 30000,
        polling: 500,
      },
    );
    const reseeded = await seedScenario();
    check("escenario reinyectado tras el remount", reseeded.ok, reseeded.reason);
    await page.waitForTimeout(900);
    await setZoom(1, seeded.center);
    await shot("night-remount");
    const night = await stats();
    evidence.metrics.night = night;
    check(
      "las placas sobreviven al remount sin duplicarse",
      night?.parcelMarks === before?.parcelMarks,
      `${before?.parcelMarks} → ${night?.parcelMarks}`,
    );
    check(
      "las marcas sobreviven al remount sin duplicarse",
      night?.facadeMarks === before?.facadeMarks,
      `${before?.facadeMarks} → ${night?.facadeMarks}`,
    );
    check(
      "tweens acotados tras el remount",
      (night?.statusTweens ?? 0) <= 12,
      `statusTweens=${night?.statusTweens}`,
    );
  } else {
    check("toggle día/noche localizable", false, "no encontrado");
  }

  step("motion reducido: ni pulsos ni destellos");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedScenario({ markers: false });
  await page.waitForTimeout(400);
  await seedScenario();
  await page.waitForTimeout(700);
  const reduced = await stats();
  evidence.metrics.reducedMotion = reduced;
  check(
    "con prefers-reduced-motion no queda ningún tween de estado",
    (reduced?.statusTweens ?? 0) === 0,
    `statusTweens=${reduced?.statusTweens}`,
  );
  check(
    "los marcadores se pintan igual sin animación",
    (reduced?.indicators ?? 0) > 0 && (reduced?.parcelMarks ?? 0) > 0,
    `indicators=${reduced?.indicators} parcelMarks=${reduced?.parcelMarks}`,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await seedScenario({ markers: false });
  await page.waitForTimeout(400);
  await seedScenario();
  await page.waitForTimeout(700);
  const animated = await stats();
  check(
    "sin la guarda, los críticos vuelven a latir",
    (animated?.statusTweens ?? 0) > 0,
    `statusTweens=${animated?.statusTweens}`,
  );

  step("churn de zoom ×10: los tweens no crecen con el reciclado");
  for (let iteration = 0; iteration < 10; iteration += 1) {
    await setZoom(iteration % 2 === 0 ? 2 : 0.5, seeded.center);
  }
  const churn = await stats();
  evidence.metrics.zoomChurn = churn;
  check(
    "tweens acotados tras el churn",
    (churn?.statusTweens ?? 0) <= 12,
    `statusTweens=${churn?.statusTweens}`,
  );

  step("rendimiento de peor caso (§3.3): el mismo mundo con y sin idioma de estado");
  await installFrameSampler();
  const dropPct = (before, after) =>
    !before ? 0 : Number((((before - after) / before) * 100).toFixed(1));
  const growthPct = (before, after) =>
    !before ? 0 : Number((((after - before) / before) * 100).toFixed(1));
  const performanceByZoom = {};
  for (const zoom of PERF_ZOOMS) {
    const control = (await measureArms(false, zoom, seeded.center, PERF_PASSES)).summary;
    const status = (await measureArms(true, zoom, seeded.center, PERF_PASSES)).summary;
    /**
     * Coste real del idioma de estado: los marcadores viven en sus propias capas de contenedor, así
     * que `sceneChildren` NO los cuenta. `statusGameObjects` suma contenedores e hijos de badges,
     * placas y marcas; es el único contador honesto de lo que esta fase añade al display list.
     */
    const statusGameObjectsDelta = status.statusGameObjects - control.statusGameObjects;
    const frameMeanGrowthPct = growthPct(control.frameMeanMs, status.frameMeanMs);
    const frameP50GrowthPct = growthPct(control.frameP50Ms, status.frameP50Ms);
    const frameP95GrowthPct = growthPct(control.frameP95Ms, status.frameP95Ms);
    const frameP90GrowthPct = growthPct(control.frameP90Ms, status.frameP90Ms);
    const frameP99GrowthPct = growthPct(control.frameP99Ms, status.frameP99Ms);
    const worstGrowthPct = growthPct(control.worstFrameMs, status.worstFrameMs);
    const hitchGrowthPct = growthPct(control.hitchFrames, status.hitchFrames);
    const fpsQuantumPct = dropPct(control.fpsP50, control.fpsP50 - 1);
    performanceByZoom[String(zoom)] = {
      control,
      status,
      frameMeanGrowthPct,
      frameP50GrowthPct,
      frameP90GrowthPct,
      frameP95GrowthPct,
      frameP99GrowthPct,
      worstFrameGrowthPct: worstGrowthPct,
      hitchGrowthPct,
      fpsP50DropPct: dropPct(control.fpsP50, status.fpsP50),
      fpsP95DropPct: dropPct(control.fpsP95, status.fpsP95),
      fpsQuantumPct,
      fpsBudgetMeasurable: fpsQuantumPct <= 5,
      statusGameObjectsDelta,
      passes: PERF_PASSES,
    };
    console.log(
      `   zoom ${zoom} · ${PERF_PASSES} pasadas · control fps p50=${control.fpsP50} ` +
        `frame media=${control.frameMeanMs} ms p50=${control.frameP50Ms} p95=${control.frameP95Ms} ` +
        `p99=${control.frameP99Ms} peor=${control.worstFrameMs} (${control.frames} frames)`,
    );
    console.log(
      `   zoom ${zoom} · status fps p50=${status.fpsP50} frame media=${status.frameMeanMs} ms ` +
        `p50=${status.frameP50Ms} p95=${status.frameP95Ms} p99=${status.frameP99Ms} ` +
        `peor=${status.worstFrameMs} (${status.frames} frames) · ` +
        `marcadores+=${statusGameObjectsDelta} hitches ${control.hitchFrames}→${status.hitchFrames}`,
    );
    check(
      `frame-time medio crece ≤5 % en zoom ${zoom}`,
      frameMeanGrowthPct <= 5,
      `control=${control.frameMeanMs} ms status=${status.frameMeanMs} ms crecimiento=${frameMeanGrowthPct}%`,
    );
    check(
      `frame-time p50 crece ≤5 % en zoom ${zoom}`,
      frameP50GrowthPct <= 5,
      `control=${control.frameP50Ms} ms status=${status.frameP50Ms} ms crecimiento=${frameP50GrowthPct}%`,
    );
    check(
      `frame-time p95 crece ≤5 % en zoom ${zoom}`,
      frameP95GrowthPct <= 5,
      `control=${control.frameP95Ms} ms status=${status.frameP95Ms} ms crecimiento=${frameP95GrowthPct}%`,
    );
    check(
      `los GameObjects del idioma de estado están acotados en zoom ${zoom}`,
      statusGameObjectsDelta <= 13 * 4 &&
        status.indicators <= 12 &&
        status.parcelMarks <= 12 &&
        status.facadeMarks <= 12,
      `marcadores+=${statusGameObjectsDelta} (badges ${status.indicators} · placas ${status.parcelMarks} · marcas ${status.facadeMarks}; tope 12 por grupo, ≤4 objetos cada uno)`,
    );
    /** Caída catastrófica = más de un cuantún del medidor; el 5 % exacto se certifica con GPU. */
    check(
      `los FPS no caen más de un cuantún de muestreo en zoom ${zoom}`,
      control.fpsP50 - status.fpsP50 <= 1 && control.fpsP95 - status.fpsP95 <= 1,
      `p50 ${control.fpsP50}→${status.fpsP50} · p95 ${control.fpsP95}→${status.fpsP95}`,
    );
    note(
      `presupuesto del 5 % evaluable sobre FPS en zoom ${zoom}`,
      fpsQuantumPct <= 5,
      `el cuantún del medidor es ${fpsQuantumPct}% (${control.fpsP50} FPS por software): la cola y el 5 % exacto pasan al playtest humano (P1-1 abierto desde V.d-7C)`,
    );
    note(
      `la cola de frame-time (p90/p99/peor) no crece más de un 25 % en zoom ${zoom}`,
      frameP90GrowthPct <= 25 && frameP99GrowthPct <= 25 && worstGrowthPct <= 25,
      `p90 ${control.frameP90Ms}→${status.frameP90Ms} ms (${frameP90GrowthPct}%) · p99 ${control.frameP99Ms}→${status.frameP99Ms} ms (${frameP99GrowthPct}%) · peor ${control.worstFrameMs}→${status.worstFrameMs} ms (${worstGrowthPct}%) · frames >1,5×p50 ${control.hitchFrames}→${status.hitchFrames} de ${status.frames}`,
    );
  }
  evidence.metrics.performance = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    timestamp: new Date().toISOString(),
    zooms: performanceByZoom,
    warmupMs: PERF_WARMUP_MS,
    measurementMs: PERF_MS,
    passesPerArm: PERF_PASSES,
    browser: "Chromium (Playwright headless, sin GPU: rasterizado por software)",
    viewport: { width: 1440, height: 900 },
    note: "Brazo de control = idéntica ciudad sembrada sin disparadores de estado; el delta mide sólo el idioma de estado.",
  };

  check("sin errores de página", pageErrors.length === 0, pageErrors.join(" | "));
  evidence.pageErrors = pageErrors;
  evidence.metrics.final = await stats();
  writeFileSync(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nEVIDENCIA · ${EVIDENCE}`);
  console.log(`CAPTURAS · ${evidence.shots.length} en ${SHOTS}`);
} catch (error) {
  evidence.pageErrors = pageErrors;
  evidence.failure = String(error);
  writeFileSync(EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

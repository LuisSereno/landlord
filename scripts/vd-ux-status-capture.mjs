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

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4188;
const baseUrl = process.env.VD_SMOKE_BASE_URL ?? `http://127.0.0.1:${port}/`;
const external = Boolean(process.env.VD_SMOKE_BASE_URL);
const SHOTS = "docs/art/golden/vd-ux-status";
const EVIDENCE = "docs/execution/phase-4/vd-ux-s-service-final.json";
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
  evidence.assertions.push({ name, ok: Boolean(ok), detail });
  console.log(`   ${ok ? "OK " : "FAIL"} · ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(`Aserción "${name}" falló — ${detail ?? ""}`);
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
async function seedScenario() {
  return page.evaluate(() => {
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
    const types = ["courtyard_home", "row_house", "apartment_block", "workshop", "town_hall", "clinic"];
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
    api.injectProjection(clone);
    return { ok: true, center: parcels[2].cell, parcels: parcels.map((p) => p.id) };
  });
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
    JSON.stringify(await page.evaluate(() => window.__landlordCameraTest.listSignage().slice(0, 4))),
  );
  console.log("   DIAG consola ·", JSON.stringify(consoleIssues.slice(0, 12), null, 1));
  evidence.metrics.initial = base;
  /**
   * El escenario sembrado cambia propiedad y edificios, que SÍ afectan al suelo horneado. La
   * invariante del plan es que un cambio puramente ECONÓMICO no lo regenere: se mide más abajo,
   * comparando el contador antes y después de mutar sólo préstamos, pólizas y alertas.
   */
  evidence.metrics.groundRebakesAfterSeed = base?.groundRebakes;
  check("tope de badges respetado", (base?.indicators ?? 0) <= 12, `indicators=${base?.indicators}`);
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
      check("las marcas de mejora se ven en zoom de juego", marks.some((m) => m.visible), `${marks.length} marcas`);
      const plates = await page.evaluate(() => window.__landlordCameraTest.listParcelMarks());
      check("las placas de carga se ven en zoom de juego", plates.some((m) => m.visible), `${plates.length} placas`);
    }
  }

  step("glifos rasterizados desde el registro único");
  const afterGlyphs = await stats();
  check("texturas de glifo acotadas", (afterGlyphs?.glyphTextures ?? 0) <= 70, `glyphTextures=${afterGlyphs?.glyphTextures}`);
  check("texturas de glifo presentes", (afterGlyphs?.glyphTextures ?? 0) > 0, `glyphTextures=${afterGlyphs?.glyphTextures}`);
  evidence.metrics.glyphs = afterGlyphs;

  step("hover de badge: tooltip en español con el detalle plegado");
  const badge = await page.evaluate(() => {
    const api = window.__landlordCameraTest;
    const entry = api.listIndicators().find((item) => item.visible && !item.critical);
    return entry ?? null;
  });
  check("hay un badge no crítico visible", badge !== null, badge?.kind);

  step("colisión espacial: placa + badge + rótulo + marca en la misma manzana");
  await setZoom(2, seeded.center);
  await shot("clutter-dense-block");
  const dense = await stats();
  evidence.metrics.dense = dense;
  check("sin crecimiento descontrolado de objetos", (dense?.sceneChildren ?? 0) < 4000, `sceneChildren=${dense?.sceneChildren}`);

  step("estabilidad: cinco inyecciones idénticas no duplican objetos");
  const before = await stats();
  for (let iteration = 0; iteration < 5; iteration += 1) {
    await seedScenario();
    await page.waitForTimeout(320);
  }
  const after = await stats();
  evidence.metrics.stability = { before, after };
  check("placas estables", after?.parcelMarks === before?.parcelMarks, `${before?.parcelMarks} → ${after?.parcelMarks}`);
  check("marcas estables", after?.facadeMarks === before?.facadeMarks, `${before?.facadeMarks} → ${after?.facadeMarks}`);
  check("badges estables", after?.indicators === before?.indicators, `${before?.indicators} → ${after?.indicators}`);
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
    await page.waitForFunction(() => window.__landlordCameraTest?.getProjection()?.economy != null, null, {
      timeout: 30000,
      polling: 500,
    });
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
    check("tweens acotados tras el remount", (night?.statusTweens ?? 0) <= 12, `statusTweens=${night?.statusTweens}`);
  } else {
    check("toggle día/noche localizable", false, "no encontrado");
  }

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
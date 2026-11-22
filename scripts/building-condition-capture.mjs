/* global setTimeout, window, document, HTMLElement */
/**
 * D-111.2 cierre FASE 4 — conservación, envejecimiento, ruina y fuego sobre el camino de render real.
 *
 * Cuatro casos de condición viajan por la MISMA cadena que la partida: proyección sintética →
 * `injectProjection` (la misma vía de la partida) → adaptador → `buildingAssetStateFor(state,
 * condition, structuralIntegrity)` → sprite. La variante REALMENTE seleccionada se lee del
 * renderizador (`listScenery().buildings[].texture`), no de lo que el caso pide. El caso `aged` tiene
 * que caer en `complete`: el catálogo runtime no tiene sprite envejecido y esa ausencia se registra,
 * no se simula.
 *
 * Uso: `cd apps/web && npx vite build --emptyOutDir` y `node scripts/building-condition-capture.mjs`.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/closure/condition";
const VIEWPORT = { width: 1440, height: 900 };

const CASES = [
  {
    id: "conserved",
    label: "Conservado",
    type: "row_house",
    state: "operational",
    condition: 95,
    structuralIntegrity: 100,
    expectTier: "conserved",
    expectAssetState: "complete",
  },
  {
    id: "aged",
    label: "Operativo con mala conservación (condition 40, estructura intacta)",
    type: "courtyard_home",
    state: "operational",
    condition: 40,
    structuralIntegrity: 80,
    expectTier: "aged",
    expectAssetState: "complete (fallback: sin sprite aged en el catálogo runtime)",
  },
  {
    id: "ruin",
    label: "Ruina",
    type: "mixed_tenement",
    state: "ruin",
    condition: 35,
    structuralIntegrity: 0,
    expectTier: "damaged",
    expectAssetState: "damaged",
  },
  {
    id: "burning",
    label: "En llamas",
    type: "warehouse",
    state: "burning",
    condition: 60,
    structuralIntegrity: 50,
    expectTier: "burning",
    expectAssetState: "burning",
  },
];

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const PORT = await freePort();
const BASE_URL = process.env.CONDITION_QA_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const server = process.env.CONDITION_QA_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("el servidor de vista previa no arrancó");
}

async function startFreshCity() {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const removal = indexedDB.deleteDatabase("landlord-gate1");
        removal.onsuccess = () => resolve();
        removal.onerror = () => resolve();
        removal.onblocked = () => resolve();
      }),
  );
  await page.goto(`${BASE_URL}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 60_000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean(window.__landlordCameraTest?.getProjection?.()), null, {
    timeout: 60_000,
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const skip = page.getByRole("button", { name: "Ahora no" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function hideDomOverlays() {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    for (const node of document.querySelectorAll("body *")) {
      if (node === canvas || node.contains(canvas) || canvas.contains(node)) continue;
      if (!(node instanceof HTMLElement)) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const overlaps =
        box.left < rect.right &&
        box.right > rect.left &&
        box.top < rect.bottom &&
        box.bottom > rect.top;
      if (overlaps) node.style.display = "none";
    }
  });
}

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();
  await startFreshCity();
  await hideDomOverlays();

  /** Sin pausar, el worker publica cada 2 ticks y sobrescribe la proyección inyectada. */
  const pause = page.getByRole("button", { name: "Pausar simulación" }).first();
  await pause.waitFor({ timeout: 10_000 });
  await pause.click();
  await page.waitForTimeout(300);

  const seeded = await page.evaluate((cases) => {
    const api = window.__landlordCameraTest;
    const projection = api.getProjection();
    if (!projection?.economy) return { ok: false, reason: "sin economía" };
    const clone = JSON.parse(JSON.stringify(projection));
    const economy = clone.economy;
    const parcels = economy.parcels.slice(0, cases.length);
    if (parcels.length < cases.length) return { ok: false, reason: "pocas parcelas" };
    economy.constructionSites = [];
    economy.buildings = cases.map((testCase, index) => {
      const parcel = parcels[index];
      parcel.buildingIds = [`qa_condition_${testCase.id}`];
      return {
        id: `qa_condition_${testCase.id}`,
        parcelIds: [parcel.id],
        districtId: parcel.districtId,
        ownerOrganizationId: parcel.ownerOrganizationId ?? "org_00000001",
        productionFacilityId: null,
        type: testCase.type,
        footprintCells: parcel.cells.slice(0, 2),
        orientation: 0,
        floors: 2,
        form: "detached",
        level: 1,
        condition: testCase.condition,
        tenantId: null,
        tenantIds: [],
        capacity: 2,
        upgraded: false,
        structuralIntegrity: testCase.structuralIntegrity,
        state: testCase.state,
        casualtiesTotal: { injured: 0, dead: 0 },
        effectiveRent: 120,
        maintenanceCost: 40,
        maintenanceDue: 40,
      };
    });
    api.injectProjection(clone);
    return { ok: true, cells: parcels.map((parcel) => parcel.cells[0]) };
  }, CASES);
  if (!seeded.ok) throw new Error(`escenario de condición no sembrado: ${seeded.reason}`);
  if (process.env.CONDITION_QA_DEBUG) {
    console.error(`sembrado: cells=${JSON.stringify(seeded.cells)}`);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const probe = await page.evaluate(() => {
      const scenery = window.__landlordCameraTest.listScenery();
      return {
        total: scenery.buildings.length,
        qa: scenery.buildings.filter((entry) => entry.id.startsWith("building:qa_condition_")),
        ids: scenery.buildings.slice(0, 5).map((entry) => `${entry.id}:${entry.texture}`),
      };
    });
    console.error(
      `escena: total=${probe.total} qa=${JSON.stringify(probe.qa)} primeras=${JSON.stringify(probe.ids)}`,
    );
  }

  /** Espera a que el renderizador tenga los cuatro sprites con su textura real. */
  await page.waitForFunction(
    () => {
      const scenery = window.__landlordCameraTest.listScenery();
      return (
        scenery.buildings.filter((entry) => entry.id.startsWith("building:qa_condition_")).length >=
        4
      );
    },
    { timeout: 30_000 },
  );
  const observed = await page.evaluate((cases) => {
    const api = window.__landlordCameraTest;
    const scenery = api.listScenery();
    return cases.map((testCase, index) => {
      const id = `building:qa_condition_${testCase.id}`;
      const sprite = scenery.buildings.find((entry) => entry.id === id);
      return {
        case: testCase.id,
        buildingId: id,
        cell: scenery.buildings.find((entry) => entry.id === id)?.cell ?? null,
        texture: sprite?.texture ?? null,
        screen: api.getCellScreenPoint({ x: index + 2, y: 2 }),
      };
    });
  }, CASES);

  const canvas = page.locator("canvas").first();

  /** Encuadre por Newton: la relación scroll↔zoom de esta escena no es la de Phaser por defecto. */
  async function setCamera(cell, zoom) {
    const camera0 = await page.evaluate(() => window.__landlordCameraTest.getCamera());
    await page.evaluate((config) => window.__landlordCameraTest.configure(config), {
      zoom: 1,
      scrollX: camera0.scrollX,
      scrollY: camera0.scrollY,
    });
    await page.evaluate((target) => window.__landlordCameraTest.centerOnCell(target), cell);
    await page.evaluate((z) => {
      const camera = window.__landlordCameraTest.getCamera();
      window.__landlordCameraTest.configure({
        zoom: z,
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
      });
    }, zoom);
    for (let step = 0; step < 3; step += 1) {
      const state = await page.evaluate((target) => {
        const camera = window.__landlordCameraTest.getCamera();
        const point = window.__landlordCameraTest.getCellScreenPoint(target);
        return { scrollX: camera.scrollX, scrollY: camera.scrollY, point };
      }, cell);
      const dx = (state.point.x - VIEWPORT.width / 2) / zoom;
      const dy = (state.point.y - VIEWPORT.height / 2) / zoom;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
      await page.evaluate((config) => window.__landlordCameraTest.configure(config), {
        zoom,
        scrollX: state.scrollX + dx,
        scrollY: state.scrollY + dy,
      });
    }
  }

  const captures = [];
  for (const [index, testCase] of CASES.entries()) {
    const cell = seeded.cells[index];
    await setCamera(cell, 2.5);
    const png = await canvas.screenshot({ type: "png" });
    const file = `condition_${testCase.id}.png`;
    writeFileSync(`${OUTPUT_DIR}/${file}`, png);
    const sprite = observed[index];
    const observedState = sprite?.texture
      ? sprite.texture.replace(/^blender-building-[\w]+-/, "").replace(/^building-[\w]+-/, "")
      : null;
    captures.push({
      file,
      case: testCase.id,
      label: testCase.label,
      buildingType: testCase.type,
      input: {
        state: testCase.state,
        condition: testCase.condition,
        structuralIntegrity: testCase.structuralIntegrity,
      },
      expectedTier: testCase.expectTier,
      expectedAssetState: testCase.expectAssetState,
      observedTexture: sprite?.texture ?? null,
      observedAssetState: observedState,
      pngSha256: sha256(png),
      pngBytes: png.length,
    });
  }

  const summary = {
    schemaVersion: 1,
    purpose:
      "los cuatro casos de condición del contrato de weathering, con la variante que el renderizador realmente seleccionó",
    route:
      "proyección sintética → injectProjection → buildingAssetStateFor(state, condition, structuralIntegrity)",
    agedNote:
      "el tier `aged` cae en el sprite `complete`: el catálogo runtime no tiene sprite envejecido (D-080 pendiente de autorización); la ausencia está registrada aquí, no simulada",
    captures,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    `${OUTPUT_DIR}/building_condition_summary.json`,
    JSON.stringify(summary, null, 1) + "\n",
  );
  const mismatched = captures.filter((capture) => {
    if (!capture.observedAssetState) return true;
    const expected = capture.expectedAssetState.startsWith("complete")
      ? "complete"
      : capture.expectedAssetState;
    return capture.observedAssetState !== expected;
  });
  console.log(
    `${captures.length} casos · texturas: ${captures.map((capture) => capture.observedAssetState).join(", ")} · ` +
      `desajustes: ${mismatched.length} · errores: ${pageErrors.length}`,
  );
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

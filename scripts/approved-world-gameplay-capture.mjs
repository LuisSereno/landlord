/* global window, document, HTMLElement, setTimeout, structuredClone, performance, requestAnimationFrame, TextEncoder, crypto */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUTPUT_DIR = `${ROOT}/docs/art/world-activation-2026-11-26`;
const VIEWPORT = { width: 1440, height: 900 };
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

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

if (existsSync(OUTPUT_DIR)) throw new Error(`La salida ya existe: ${OUTPUT_DIR}`);
mkdirSync(OUTPUT_DIR, { recursive: true });
const port = await freePort();
const baseUrl = process.env.APPROVED_WORLD_BASE_URL ?? `http://127.0.0.1:${port}`;
const server = process.env.APPROVED_WORLD_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});
const captures = [];
let saveLoad;

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("El servidor de producción no arrancó");
}

async function pauseAndHideOverlays() {
  const pause = page.getByRole("button", { name: "Pausar simulación" }).first();
  await pause.waitFor({ timeout: 15_000 });
  await pause.click();
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    for (const node of document.querySelectorAll("body *")) {
      if (node === canvas || node.contains(canvas) || canvas.contains(node)) continue;
      if (!(node instanceof HTMLElement)) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (
        box.left < rect.right &&
        box.right > rect.left &&
        box.top < rect.bottom &&
        box.bottom > rect.top
      ) {
        node.style.visibility = "hidden";
      }
    }
  });
}

async function installFixture() {
  await page.evaluate(() => {
    const api = window.__landlordCameraTest;
    const base = structuredClone(api.getProjection());
    window.__approvedWorldBaseProjection = base;
    const occupied = new Set();
    for (const item of [...base.economy.buildings, ...base.economy.constructionSites]) {
      for (const cell of item.footprintCells) occupied.add(`${cell.x},${cell.y}`);
    }
    const find = (width, height) => {
      for (let y = 4; y < 60; y += 1) {
        for (let x = 4; x < 60; x += 1) {
          let free = true;
          for (let dx = 0; dx < width; dx += 1) {
            for (let dy = 0; dy < height; dy += 1) {
              if (occupied.has(`${x + dx},${y + dy}`)) free = false;
            }
          }
          if (!free) continue;
          for (let dx = 0; dx < width; dx += 1) {
            for (let dy = 0; dy < height; dy += 1) occupied.add(`${x + dx},${y + dy}`);
          }
          return { x, y, width, height };
        }
      }
      throw new Error("No free fixture footprint");
    };
    const cellsFor = (anchor, width, height) => {
      const cells = [];
      for (let dx = 0; dx < width; dx += 1) {
        for (let dy = 0; dy < height; dy += 1) cells.push({ x: anchor.x + dx, y: anchor.y + dy });
      }
      return cells;
    };
    const cupola = find(4, 2);
    const courtyard = find(4, 2);
    const depot = find(3, 1);
    const crew = find(4, 2);
    window.__approvedWorldCells = {
      cupola: { anchor: cupola, cells: cellsFor(cupola, 4, 2), orientation: 0 },
      courtyard: { anchor: courtyard, cells: cellsFor(courtyard, 4, 2), orientation: 180 },
      depot: { anchor: depot, cells: cellsFor(depot, 3, 1), orientation: 90 },
      crew: { anchor: crew, cells: cellsFor(crew, 4, 2), orientation: 0 },
    };
  });
}

async function injectFixture({ state, mood, animation = "idle", phase = 0 }) {
  await page.evaluate(
    ({ visualState, visualMood, characterAnimation, characterPhase }) => {
      const api = window.__landlordCameraTest;
      api.setVisualMood(visualMood);
      const projection = structuredClone(window.__approvedWorldBaseProjection);
      const economy = projection.economy;
      const fixture = window.__approvedWorldCells;
      const template = economy.buildings[0];
      if (!template) throw new Error("La ciudad base no tiene edificio plantilla");
      economy.buildings = economy.buildings.filter((entry) => !entry.id.startsWith("qa_approved_"));
      economy.constructionSites = economy.constructionSites.filter(
        (entry) => !entry.id.startsWith("qa_approved_"),
      );
      economy.crews = economy.crews.filter((entry) => !entry.id.startsWith("qa_approved_"));
      projection.agents = projection.agents.filter((entry) => !entry.id.startsWith("qa_approved_"));
      const specs = [
        {
          key: "cupola",
          id: "qa_approved_hq_cupola",
          type: "headquarters",
          variant: "cupola",
          floors: 2,
        },
        {
          key: "courtyard",
          id: "qa_approved_hq_courtyard",
          type: "headquarters",
          variant: "courtyard",
          floors: 2,
        },
        { key: "depot", id: "qa_approved_depot", type: "cleaning_depot", variant: null, floors: 1 },
      ];
      const progressFor = {
        foundation: 0.05,
        structure: 0.45,
        finishing: 0.85,
      };
      for (const spec of specs) {
        const cells = fixture[spec.key];
        if (["foundation", "structure", "finishing"].includes(visualState)) {
          economy.constructionSites.push({
            id: spec.id,
            parcelIds: [],
            districtId: projection.observedDistrictId,
            ownerOrganizationId: template.ownerOrganizationId,
            buildingType: spec.type,
            headquartersVariantId: spec.variant,
            headquartersAccess: null,
            footprintCells: cells.cells,
            siteCells: cells.cells,
            orientation: cells.orientation,
            floors: spec.floors,
            form: template.form,
            progress: progressFor[visualState] ?? 0.5,
            workRequired: 1,
            upgradeBuildingId: null,
            repairBuildingId: null,
            crewCapacity: 3,
            kind: "construction",
            assignedCrewIds: [],
            assignedTechnicianId: null,
          });
          continue;
        }
        economy.buildings.push({
          ...template,
          id: spec.id,
          type: spec.type,
          headquartersVariantId: spec.variant,
          headquartersAccess: null,
          parcelIds: [],
          districtId: projection.observedDistrictId,
          footprintCells: cells.cells,
          siteCells: cells.cells,
          orientation: cells.orientation,
          floors: spec.floors,
          condition: visualState === "damaged" ? 40 : 100,
          structuralIntegrity: visualState === "damaged" ? 0 : 100,
          state:
            visualState === "burning"
              ? "burning"
              : visualState === "damaged"
                ? "ruin"
                : "operational",
        });
      }
      const crewSite = {
        id: "qa_approved_crew_site",
        parcelIds: [],
        districtId: projection.observedDistrictId,
        ownerOrganizationId: template.ownerOrganizationId,
        buildingType: "workshop",
        headquartersVariantId: null,
        headquartersAccess: null,
        footprintCells: fixture.crew.cells,
        siteCells: fixture.crew.cells,
        orientation: 0,
        floors: 1,
        form: template.form,
        progress: 0.5,
        workRequired: 1,
        upgradeBuildingId: null,
        repairBuildingId: null,
        crewCapacity: 3,
        kind: "construction",
        assignedCrewIds: ["qa_approved_crew"],
        assignedTechnicianId: null,
      };
      economy.constructionSites.push(crewSite);
      economy.crews.push({
        id: "qa_approved_crew",
        organizationId: template.ownerOrganizationId,
        supervisorAgentId: "qa_approved_agent_supervisor",
        workerAgentIds: ["qa_approved_agent_worker_a", "qa_approved_agent_worker_b"],
        assignedWorkOrderId: crewSite.id,
      });
      const start = { x: fixture.crew.anchor.x - 2, y: fixture.crew.anchor.y + 2 };
      const specialties = ["supervisor", "construction_worker", "construction_worker"];
      const ids = [
        "qa_approved_agent_supervisor",
        "qa_approved_agent_worker_a",
        "qa_approved_agent_worker_b",
      ];
      for (let index = 0; index < ids.length; index += 1) {
        const offset = index % 2;
        const cell =
          characterAnimation === "walk"
            ? { x: start.x + characterPhase, y: start.y + offset }
            : { x: fixture.crew.anchor.x - 1, y: fixture.crew.anchor.y + 1 + offset };
        projection.agents.push({
          id: ids[index],
          districtId: projection.observedDistrictId,
          cell,
          nextCell: characterAnimation === "walk" ? { x: cell.x + 1, y: cell.y } : null,
          organizationId: template.ownerOrganizationId,
          specialty: specialties[index],
          health: 100,
          state: characterAnimation === "walk" ? "moving" : "working",
          atBase: false,
          returningToBase: false,
        });
      }
      projection.tick += Math.floor(characterPhase * 3);
      api.injectProjection(projection);
    },
    { visualState: state, visualMood: mood, characterAnimation: animation, characterPhase: phase },
  );
  await page.waitForTimeout(1_000);
  await page.evaluate(() => window.__landlordQaRefresh?.());
  try {
    await page.waitForFunction(
      ({ visualMood, visualState }) => {
        const construction = ["foundation", "structure", "finishing"].includes(visualState);
        const prefix = construction ? "site" : "building";
        const expected = [
          `${prefix}:qa_approved_hq_cupola`,
          `${prefix}:qa_approved_hq_courtyard`,
          `${prefix}:qa_approved_depot`,
        ];
        const rendered = window.__landlordCameraTest.listScenery().buildings;
        return expected.every((id) => {
          const sprite = rendered.find((entry) => entry.id === id);
          return (
            sprite?.visible === true && sprite.texture.includes(`blender-variant-${visualMood}-`)
          );
        });
      },
      { visualMood: mood, visualState: state },
      { timeout: 20_000 },
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        await page.evaluate((visualMood) => ({
          ready: {
            cupola: window.__landlordQaVariantReady?.("headquarters_cupola", visualMood),
            courtyard: window.__landlordQaVariantReady?.("headquarters_courtyard", visualMood),
            depot: window.__landlordQaVariantReady?.("cleaning_depot", visualMood),
          },
          variantStatus: {
            cupola: window.__landlordQaVariantStatus?.("headquarters_cupola", visualMood),
            courtyard: window.__landlordQaVariantStatus?.("headquarters_courtyard", visualMood),
            depot: window.__landlordQaVariantStatus?.("cleaning_depot", visualMood),
          },
          scenery: window.__landlordCameraTest
            .listScenery()
            .buildings.filter((entry) => entry.id.includes("qa_approved_")),
          projection: window.__landlordCameraTest
            .getProjection()
            .economy.buildings.filter((entry) => entry.id.startsWith("qa_approved_"))
            .map(({ id, type, headquartersVariantId, orientation, state, condition }) => ({
              id,
              type,
              headquartersVariantId,
              orientation,
              state,
              condition,
            })),
          districtAssets: window.__districtAssetStats?.(),
          gameplay: window.__gameplayVisualStats?.(),
        })),
        mood,
        null,
        2,
      ),
    );
    console.error(JSON.stringify({ pageErrors }, null, 2));
    throw error;
  }
  if (animation === "walk") {
    await page.waitForFunction(() => window.__gameplayVisualStats?.().crewSprites === 3, null, {
      timeout: 20_000,
    });
  }
}

async function capture(name, options) {
  await injectFixture(options);
  await page.waitForTimeout(350);
  const file = `${OUTPUT_DIR}/${name}.png`;
  await page.locator("canvas").screenshot({ path: file });
  const bytes = readFileSync(file);
  const scenery = await page.evaluate(() => window.__landlordCameraTest.listScenery());
  const expectedIds = ["qa_approved_hq_cupola", "qa_approved_hq_courtyard", "qa_approved_depot"];
  const rendered = scenery.buildings.filter((entry) =>
    expectedIds.some((id) => entry.id === `building:${id}` || entry.id === `site:${id}`),
  );
  if (
    rendered.length !== 3 ||
    rendered.some((entry) => !entry.visible || !entry.texture.includes("blender-variant-"))
  ) {
    throw new Error(`${name}: los assets aprobados no resolvieron a variantes runtime visibles`);
  }
  captures.push({
    name,
    ...options,
    file: `docs/art/world-activation-2026-11-26/${name}.png`,
    bytes: bytes.length,
    sha256: sha256(bytes),
    rendered: rendered.map(({ id, texture, scale, visible }) => ({ id, texture, scale, visible })),
    gameplay: await page.evaluate(() => window.__gameplayVisualStats()),
    districtAssets: await page.evaluate(() => window.__districtAssetStats()),
    characterAssets: await page.evaluate(() => window.__characterAssetStats()),
  });
}

async function readStoredSnapshot() {
  return await page.evaluate(async () => {
    const open = indexedDB.open("landlord-gate1", 1);
    const database = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const transaction = database.transaction("snapshots", "readonly");
    const request = transaction.objectStore("snapshots").get("default");
    const record = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    const bytes = new TextEncoder().encode(JSON.stringify(record.snapshot));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    return {
      schemaVersion: record.schemaVersion,
      tick: record.snapshot.tick,
      sha256: hash,
    };
  });
}

async function frameTimeSample() {
  return await page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let previous = performance.now();
        const tick = (now) => {
          samples.push(now - previous);
          previous = now;
          if (samples.length < 60) requestAnimationFrame(tick);
          else {
            const sorted = [...samples].sort((left, right) => left - right);
            resolve({
              samples: samples.length,
              p50Ms: sorted[Math.floor(sorted.length * 0.5)],
              p95Ms: sorted[Math.floor(sorted.length * 0.95)],
              maxMs: sorted[sorted.length - 1],
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
}

try {
  await waitForServer();
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 60_000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => window.__gameplayVisualStats?.().assetsReady === true, null, {
    timeout: 60_000,
  });
  await pauseAndHideOverlays();
  await installFixture();
  await capture("day-complete-idle", { state: "complete", mood: "day", animation: "idle" });
  captures[captures.length - 1].frameTime = await frameTimeSample();
  await capture("day-foundation-idle", { state: "foundation", mood: "day", animation: "idle" });
  await capture("day-structure-idle", { state: "structure", mood: "day", animation: "idle" });
  await capture("day-finishing-idle", { state: "finishing", mood: "day", animation: "idle" });
  await capture("day-damaged-idle", { state: "damaged", mood: "day", animation: "idle" });
  await capture("night-complete-idle", { state: "complete", mood: "night", animation: "idle" });
  captures[captures.length - 1].frameTime = await frameTimeSample();
  await capture("night-finishing-idle", { state: "finishing", mood: "night", animation: "idle" });
  await capture("night-burning-idle", { state: "burning", mood: "night", animation: "idle" });
  for (const phase of [0, 1, 2, 3]) {
    await capture(`day-crew-walk-${phase}`, {
      state: "complete",
      mood: "day",
      animation: "walk",
      phase,
    });
  }
  await capture("night-crew-walk-2", {
    state: "complete",
    mood: "night",
    animation: "walk",
    phase: 2,
  });
  await page.evaluate(() => {
    for (const node of document.querySelectorAll("body *")) {
      if (node instanceof HTMLElement) node.style.visibility = "";
    }
  });
  await page.reload();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pausar simulación" }).first().click();
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30_000,
  });
  const beforeSave = await page.evaluate(() => {
    const projection = window.__landlordCameraTest.getProjection();
    return {
      schemaVersion: projection.schemaVersion,
      tick: projection.tick,
      cash: projection.economy.cash,
    };
  });
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor({ timeout: 15_000 });
  const storedBeforeLoad = await readStoredSnapshot();
  await page.reload();
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pausar simulación" }).first().click();
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor({ timeout: 15_000 });
  const pauseAfterLoad = page.getByRole("button", { name: "Pausar simulación" }).first();
  if (await pauseAfterLoad.isVisible().catch(() => false)) await pauseAfterLoad.click();
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30_000,
  });
  const afterLoad = await page.evaluate(() => {
    const projection = window.__landlordCameraTest.getProjection();
    return {
      schemaVersion: projection.schemaVersion,
      tick: projection.tick,
      cash: projection.economy.cash,
    };
  });
  const storedAfterLoad = await readStoredSnapshot();
  saveLoad = {
    status:
      beforeSave.schemaVersion === afterLoad.schemaVersion &&
      beforeSave.cash === afterLoad.cash &&
      storedBeforeLoad.schemaVersion === 3 &&
      storedBeforeLoad.sha256 === storedAfterLoad.sha256 &&
      storedBeforeLoad.tick <= afterLoad.tick
        ? "passed"
        : "failed",
    beforeSave,
    afterLoad,
    storedBeforeLoad,
    storedAfterLoad,
    workerTickDelta: afterLoad.tick - beforeSave.tick,
    exactBrowserTickComparison: false,
  };
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

const manifest = {
  schemaVersion: 1,
  status: pageErrors.length === 0 && saveLoad?.status === "passed" ? "captured" : "failed",
  purpose:
    "Approved assets resolved through production runtime manifests in the real Phaser city; QA projection fixture only.",
  viewport: VIEWPORT,
  pageErrors,
  captures,
  saveLoad,
};
writeFileSync(`${OUTPUT_DIR}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      status: manifest.status,
      captures: captures.length,
      pageErrors,
      output: "docs/art/world-activation-2026-11-26/manifest.json",
    },
    null,
    2,
  ),
);
if (pageErrors.length > 0 || saveLoad?.status !== "passed") process.exitCode = 1;

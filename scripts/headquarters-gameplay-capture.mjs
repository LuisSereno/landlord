/* global setTimeout, window, document, HTMLElement */
/**
 * D-110 candidate-only gameplay capture.
 *
 * Loads the 96 neutral Composer candidates into the REAL Phaser city through the existing
 * `__landlordCameraTest.placeCandidateQa` hook. Each render is shown twice, once with the player's
 * turquoise/diamond identity and once with the rival's terracotta/triangle identity. Nothing is
 * promoted: production manifests and runtime-promotions.json are not read or written by this file.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const SOURCE_DIRS = {
  day_civic: "docs/art/organization-headquarters/candidates-day-v1",
  night_civic: "docs/art/organization-headquarters/candidates-night-v1",
};
const OUTPUT_DIR = process.env.HQ_CAPTURE_OUT
  ? `${ROOT}/${process.env.HQ_CAPTURE_OUT}`
  : `${ROOT}/docs/art/organization-headquarters/gameplay-capture-v1`;
const VIEWPORT = { width: 1440, height: 900 };
const VARIANTS = ["headquarters_cupola", "headquarters_courtyard"];
const STATES = ["complete", "foundation", "structure", "finishing", "damaged", "burning"];
const ORIENTATIONS = [0, 90, 180, 270];
const MOODS = ["day_civic", "night_civic"];
const ZOOMS = [0.5, 1, 1.5];
const IDENTITIES = [
  { key: "player", id: "company_turquoise", label: "PLAYER · turquesa/rombo" },
  { key: "rival", id: "rival_terracotta", label: "RIVAL · terracota/triángulo" },
];

const sha256 = (source) =>
  createHash("sha256")
    .update(typeof source === "string" ? readFileSync(source) : source)
    .digest("hex");

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
const BASE_URL = process.env.HQ_CAPTURE_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const server = process.env.HQ_CAPTURE_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "ignore", detached: true },
    );

if (existsSync(OUTPUT_DIR)) {
  throw new Error(`la salida debe ser fresca: ${OUTPUT_DIR} ya existe; usa HQ_CAPTURE_OUT`);
}
mkdirSync(OUTPUT_DIR, { recursive: true });

function loadCandidates() {
  const candidates = [];
  for (const moodId of MOODS) {
    const dir = `${ROOT}/${SOURCE_DIRS[moodId]}`;
    for (const buildingType of VARIANTS) {
      for (const stateToken of STATES) {
        for (const orientation of ORIENTATIONS) {
          const stateSuffix = stateToken === "complete" ? "" : `_${stateToken}`;
          const orientSuffix = orientation === 0 ? "" : `_o${orientation}`;
          const candidateId = `hq_${buildingType}_5101${stateSuffix}${orientSuffix}`;
          const metadataPath = `${dir}/${candidateId}.json`;
          const pngPath = `${dir}/${candidateId}.png`;
          if (!existsSync(metadataPath) || !existsSync(pngPath)) {
            throw new Error(`falta candidato ${moodId}/${candidateId}`);
          }
          const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
          if (metadata.moodId !== moodId || metadata.buildingType !== buildingType) {
            throw new Error(`procedencia no coincide para ${candidateId}`);
          }
          candidates.push({
            candidateId,
            buildingType,
            stateToken,
            orientation,
            moodId,
            metadata,
            pngPath,
          });
        }
      }
    }
  }
  if (candidates.length !== 96)
    throw new Error(`se esperaban 96 candidatos, hay ${candidates.length}`);
  return candidates;
}

const candidates = loadCandidates();
const stagedDir = `${ROOT}/apps/web/dist/qa-headquarters`;
mkdirSync(stagedDir, { recursive: true });
for (const candidate of candidates) {
  const moodDir = `${stagedDir}/${candidate.moodId}`;
  mkdirSync(moodDir, { recursive: true });
  copyFileSync(candidate.pngPath, `${moodDir}/${candidate.candidateId}.png`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

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
      await page.waitForTimeout(200);
      continue;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(150);
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
      if (
        box.left < rect.right &&
        box.right > rect.left &&
        box.top < rect.bottom &&
        box.bottom > rect.top
      ) {
        node.style.display = "none";
      }
    }
  });
}

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
  for (let step = 0; step < 4; step += 1) {
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

const keyOf = (cell) => `${cell.x}:${cell.y}`;
const rectangle = (startX, startY, width, height) => {
  const cells = [];
  for (let y = startY; y < startY + height; y += 1) {
    for (let x = startX; x < startX + width; x += 1) cells.push({ x, y });
  }
  return cells;
};

/** Real vacant parcel cells + visible terrain + clearance from existing buildings. */
async function findPairPlacement(width, height, occupiedCells) {
  const gap = 4;
  const span = width * 2 + gap;
  const projection = await page.evaluate(() => window.__landlordCameraTest.getProjection());
  const occupiedParcels = new Set([
    ...(projection.economy?.constructionSites ?? []).flatMap((site) => site.parcelIds),
    ...(projection.economy?.buildings ?? []).flatMap((building) => building.parcelIds),
  ]);
  const buildings = await page.evaluate(() =>
    window.__landlordCameraTest
      .listScenery()
      .buildings.map((entry) => ({ x: entry.x, y: entry.y })),
  );
  for (let row = 58; row >= 20; row -= 1) {
    for (const center of [12, 22, 32, 42, 52, 62]) {
      for (let start = center - span; start <= center; start += 1) {
        if (start < 1 || start + span > 63) continue;
        const first = rectangle(start, row, width, height);
        const second = rectangle(start + width + gap, row, width, height);
        const cells = [...first, ...second];
        if (cells.some((cell) => occupiedCells.has(keyOf(cell)))) continue;
        const vacant = cells.every((cell) =>
          projection.economy?.parcels.some(
            (parcel) =>
              !occupiedParcels.has(parcel.id) &&
              (parcel.cells ?? [parcel.cell]).some(
                (entry) => entry.x === cell.x && entry.y === cell.y,
              ),
          ),
        );
        if (!vacant) continue;
        await setCamera({ x: start + span / 2, y: row + height / 2 }, 0.5);
        const screenPoints = await page.evaluate(
          (targets) => targets.map((cell) => window.__landlordCameraTest.getCellScreenPoint(cell)),
          cells,
        );
        if (
          screenPoints.some(
            (point) =>
              point.x < 20 ||
              point.x > VIEWPORT.width - 20 ||
              point.y < 20 ||
              point.y > VIEWPORT.height - 20,
          )
        ) {
          continue;
        }
        const worldPoints = await page.evaluate(
          (targets) =>
            targets.map((cell) =>
              window.__landlordCameraTest.getWorldPoint(
                window.__landlordCameraTest.getCellScreenPoint(cell),
              ),
            ),
          cells,
        );
        if (
          buildings.some((building) =>
            worldPoints.some(
              (point) => Math.hypot(point.x - building.x, point.y - building.y) < 220,
            ),
          )
        ) {
          continue;
        }
        for (const cell of cells) occupiedCells.add(keyOf(cell));
        return {
          firstCell: { x: start, y: row },
          secondCell: { x: start + width + gap, y: row },
          centerCell: { x: start + span / 2, y: row + height / 2 },
          cells,
        };
      }
    }
  }
  throw new Error(`no hay terreno QA libre para huella ${width}×${height}`);
}

try {
  await waitForServer();
  await startFreshCity();
  await hideDomOverlays();
  const occupiedCells = new Set();
  const placements = new Map();
  for (const buildingType of VARIANTS) {
    for (const orientation of ORIENTATIONS) {
      const sample = candidates.find(
        (candidate) =>
          candidate.buildingType === buildingType &&
          candidate.orientation === orientation &&
          candidate.stateToken === "complete" &&
          candidate.moodId === "day_civic",
      );
      placements.set(
        `${buildingType}:${orientation}`,
        await findPairPlacement(
          sample.metadata.footprint.width,
          sample.metadata.footprint.height,
          occupiedCells,
        ),
      );
      console.log(`colocación ${buildingType} o${orientation}`);
    }
  }

  const captures = [];
  for (const buildingType of VARIANTS) {
    for (const orientation of ORIENTATIONS) {
      const placement = placements.get(`${buildingType}:${orientation}`);
      for (const moodId of MOODS) {
        await page.evaluate(
          (mood) => window.__landlordCameraTest.setVisualMood(mood),
          moodId === "day_civic" ? "day" : "night",
        );
        for (const stateToken of STATES) {
          const candidate = candidates.find(
            (entry) =>
              entry.buildingType === buildingType &&
              entry.orientation === orientation &&
              entry.stateToken === stateToken &&
              entry.moodId === moodId,
          );
          await page.evaluate(() => window.__landlordCameraTest.clearCandidateQa());
          const items = IDENTITIES.map((identity, index) => ({
            name: `${candidate.candidateId}-${identity.key}`,
            url: `/qa-headquarters/${moodId}/${candidate.candidateId}.png`,
            pivot: candidate.metadata.pivot,
            footprint: candidate.metadata.footprint,
            pixelsPerMeter: candidate.metadata.framing.pixelsPerMeter,
            cell: index === 0 ? placement.firstCell : placement.secondCell,
            label: `${buildingType.replace("headquarters_", "").toUpperCase()} · ${stateToken} · o${orientation} · ${moodId.replace("_civic", "").toUpperCase()} · ${identity.label}`,
            organizationIdentityId: identity.id,
            organizationBadges: candidate.metadata.organizationBadges,
          }));
          await page.evaluate(
            (placementsToAdd) => window.__landlordCameraTest.placeCandidateQa(placementsToAdd),
            items,
          );
          await page.waitForFunction(
            (count) => window.__landlordCameraTest.listCandidateQa().length === count,
            items.length,
            { timeout: 30_000 },
          );
          const loadErrors = await page.evaluate(() =>
            window.__landlordCameraTest.listCandidateQaErrors(),
          );
          if (loadErrors.length)
            throw new Error(`${candidate.candidateId}: ${loadErrors.join(" | ")}`);
          for (const zoom of ZOOMS) {
            await setCamera(placement.centerCell, zoom);
            await page.evaluate(() => window.__landlordCameraTest.refreshCandidateQa());
            await page.waitForTimeout(120);
            const png = await page.screenshot({ type: "png" });
            const file = `hq_${buildingType}_${stateToken}_o${orientation}_${moodId}_z${String(zoom).replace(".", "")}.png`;
            writeFileSync(`${OUTPUT_DIR}/${file}`, png);
            const probe = await page.evaluate(() => window.__landlordCameraTest.listCandidateQa());
            const scenery = await page.evaluate(() => window.__landlordCameraTest.listScenery());
            captures.push({
              file,
              buildingType,
              variant: buildingType.replace("headquarters_", ""),
              stateToken,
              runtimeState: candidate.metadata.state,
              constructionStage: candidate.metadata.constructionStage,
              orientation,
              moodId,
              zoom,
              candidateId: candidate.candidateId,
              compositionSignature: candidate.metadata.compositionSignature,
              sourcePngSha256: sha256(candidate.pngPath),
              sourceMetadataSha256: sha256(
                `${ROOT}/${SOURCE_DIRS[moodId]}/${candidate.candidateId}.json`,
              ),
              canvasSha256: sha256(png),
              canvasBytes: png.length,
              organizationBadgeAnchors: candidate.metadata.organizationBadges,
              placed: probe,
              realCity: {
                observedDistrictId: (
                  await page.evaluate(() => window.__landlordCameraTest.getProjection())
                ).observedDistrictId,
                buildingsInScene: scenery.buildings.length,
                populatedLayers: scenery.layers.filter((layer) => layer.pintados > 0).length,
              },
              pageErrors: [...pageErrors],
            });
            if (captures.length % 24 === 0) console.log(`${captures.length}/288 capturas`);
          }
        }
      }
    }
  }
  if (captures.length !== 288) throw new Error(`se esperaban 288 capturas, hay ${captures.length}`);
  if (pageErrors.length) throw new Error(`errores de página: ${pageErrors.join(" | ")}`);
  const manifest = {
    schemaVersion: 1,
    purpose:
      "candidatas D-110 en la ciudad Phaser real; muestras QA, no promoción ni estado autoritativo",
    productionRuntimeTouched: false,
    sourceCandidateCount: candidates.length,
    captureCount: captures.length,
    variants: VARIANTS,
    stateTokens: STATES,
    orientations: ORIENTATIONS,
    moods: MOODS,
    zooms: ZOOMS,
    organizations: IDENTITIES,
    placements: [...placements.entries()].map(([key, value]) => ({ key, ...value })),
    captures,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUTPUT_DIR}/capture-manifest.json`, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(
    `${captures.length} capturas · ${candidates.length} candidatos · 0 errores de página`,
  );
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

/* global setTimeout, window, document, Buffer, Image, HTMLElement */
/**
 * D-111.2 cierre FASE 3 — las cuatro candidatas WP06 dentro de Phaser, sobre el mundo real.
 *
 * La ruta QA es `__landlordCameraTest.placeCandidateQa`: el arnés le pasa a la escena, por parejas,
 * el control aprobado del catálogo (servido de `/assets/runtime/blender/`, sin copiar nada) y la
 * candidata WP06 (`/qa-candidates/`, staging efímero del dist). La escena las coloca en una fila de
 * terreno vacío del mundo real con el pivote, la huella y la escala que publica cada metadata, y las
 * rotula como muestra de candidatos — nada entra en la simulación ni sustituye un sprite del
 * catálogo. La sonda `listCandidateQa` distingue lo colocado para revisión de lo que la partida
 * generó; el manifest hermano registra, por edificio: candidateProfile, candidateId,
 * compositionSignature, ruta y sha256 del PNG, pivote, escala y zoom.
 *
 * Uso: `cd apps/web && npx vite build --emptyOutDir` y luego `node scripts/candidate-phaser-capture.mjs`.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

const CANDIDATES_DIR = "docs/art/graphics-capabilities/evidence/v2/candidates";
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/closure/urban";
const VIEWPORT = { width: 1440, height: 900 };
const TYPES = ["row_house", "mixed_tenement", "town_hall", "warehouse"];
/** Separación entre parejas: huellas de hasta 5 celdas + hueco de manzana. */
const CANDIDATA_OFFSET = 7;
const FOOTPRINT_SPAN = 5;

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
const BASE_URL = process.env.CAND_QA_BASE_URL ?? `http://127.0.0.1:${PORT}`;

const server = process.env.CAND_QA_BASE_URL
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

const sha256 = (source) =>
  createHash("sha256")
    .update(typeof source === "string" ? readFileSync(source) : source)
    .digest("hex");

mkdirSync(OUTPUT_DIR, { recursive: true });

/** Los PNG candidata pasan al dist de captura; los controles los sirve el bundle de siempre. */
function stageCandidates() {
  const distQa = "apps/web/dist/qa-candidates";
  mkdirSync(distQa, { recursive: true });
  const staged = {};
  for (const type of TYPES) {
    const source = `${CANDIDATES_DIR}/wp06_${type}-candidata.png`;
    copyFileSync(source, `${distQa}/wp06_${type}-candidata.png`);
    staged[type] = {
      url: `/qa-candidates/wp06_${type}-candidata.png`,
      metadata: JSON.parse(readFileSync(`${CANDIDATES_DIR}/wp06_${type}-candidata.json`, "utf8")),
      pngSha256: sha256(source),
    };
  }
  return staged;
}

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

/** Ciudad nueva determinista: se borra el IndexedDB para que el seed reconstruya el mismo mundo. */
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

/** El HUD de React vive sobre el canvas: para la captura se ocultan los overlays que lo tapen. */
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
  await waitForServer();
  const staged = stageCandidates();
  const catalog = JSON.parse(
    readFileSync("apps/web/src/generated/runtime-assets-blender.json", "utf8"),
  );
  await startFreshCity();
  await hideDomOverlays();

  /** Muestreo de color por píxel en los puntos de pantalla indicados; el llamador centra la cámara. */
  async function sampleColors(points) {
    const visible = points.every(
      (point) =>
        point.x >= 0 && point.x <= VIEWPORT.width && point.y >= 0 && point.y <= VIEWPORT.height,
    );
    if (!visible) return null;
    const png = await page.locator("canvas").first().screenshot({ type: "png" });
    const dataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    return await page.evaluate(
      async ({ image, samplePoints }) => {
        const img = new Image();
        img.src = image;
        await img.decode();
        const probe = document.createElement("canvas");
        probe.width = img.width;
        probe.height = img.height;
        const context = probe.getContext("2d");
        context.drawImage(img, 0, 0);
        return samplePoints.map((point) => {
          const data = context.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
          return [data[0], data[1], data[2]];
        });
      },
      { image: dataUrl, samplePoints: points },
    );
  }

  /**
   * `centerOnCell` centra bien sólo a zoom 1. Para los demás zooms NO se asume la relación
   * scroll↔zoom de Phaser (medida: el worldView de esta escena no responde a width/zoom): se centra a
   * zoom 1, se pone el zoom pedido y se corrige el scroll con dos pasos de Newton sobre
   * `getCellScreenPoint` hasta que la celda cae en el centro exacto del fotograma.
   */
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

  const terrainLike = ([r, g, b]) => r + g + b > 100 && b - r < 12;

  /**
   * Cada pareja se coloca de forma independiente pero ACUMULANDO ocupación: las celdas de las parejas
   * ya decididas se convierten en obstáculo para las siguientes (el sprite real se coloca después del
   * escaneo completo, así que sin esta lista las cuatro caerían en el primer hueco).
   */
  const qaPairs = [];
  const occupiedWorldPoints = [];
  for (let pair = 0; pair < TYPES.length; pair += 1) {
    let placed = null;
    for (let row = 61; row >= 28 && !placed; row -= 1) {
      for (const windowCenter of [8, 17, 26, 35, 44, 53]) {
        await setCamera({ x: windowCenter, y: row }, 0.5);
        const footprintCells = (start) =>
          [
            ...Array.from({ length: FOOTPRINT_SPAN }, (_element, step) => start + step),
            ...Array.from(
              { length: FOOTPRINT_SPAN },
              (_element, step) => start + CANDIDATA_OFFSET + step,
            ),
          ].map((x) => ({ x, y: row }));
        const screenFor = (cells) =>
          page.evaluate(
            (targets) =>
              targets.map((cell) => window.__landlordCameraTest.getCellScreenPoint(cell)),
            cells,
          );
        const worldFor = (cells) =>
          page.evaluate(
            (targets) =>
              targets.map((cell) => {
                const screen = window.__landlordCameraTest.getCellScreenPoint(cell);
                return window.__landlordCameraTest.getWorldPoint(screen);
              }),
            cells,
          );
        /** Una captura por ventana: todos los inicios candidatos se muestrean del mismo fotograma. */
        const starts = [];
        for (let start = windowCenter - 10; start <= windowCenter + 9; start += 1) {
          if (start < 1 || start + CANDIDATA_OFFSET + FOOTPRINT_SPAN - 1 > 63) continue;
          starts.push(start);
        }
        const cellsByStart = new Map(starts.map((start) => [start, footprintCells(start)]));
        const allCells = starts.flatMap((start) => cellsByStart.get(start));
        const worldPointsByCell = await worldFor(allCells);
        const buildings = await page.evaluate(() =>
          window.__landlordCameraTest
            .listScenery()
            .buildings.map((entry) => ({ x: entry.x, y: entry.y })),
        );
        const screenPointsByCell = await screenFor(allCells);
        const colorsByCell = await sampleColors(screenPointsByCell);
        if (!colorsByCell) continue;
        const terrainByCell = colorsByCell.map(terrainLike);
        for (const [index, start] of starts.entries()) {
          const cellStart = index * (FOOTPRINT_SPAN * 2);
          const span = terrainByCell.slice(cellStart, cellStart + FOOTPRINT_SPAN * 2);
          const worldPoints = worldPointsByCell.slice(cellStart, cellStart + FOOTPRINT_SPAN * 2);
          const tooClose = [...buildings, ...occupiedWorldPoints].some((obstacle) =>
            worldPoints.some(
              (point) => Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < 240,
            ),
          );
          if (tooClose) {
            if (process.env.CAND_QA_DEBUG)
              console.error(`r${row} x${start}: edificio/ocupado <240 px mundo`);
            continue;
          }
          if (span.every(Boolean)) {
            placed = { row, start, cells: cellsByStart.get(start) };
            for (const point of worldPoints) occupiedWorldPoints.push(point);
            break;
          }
          if (process.env.CAND_QA_DEBUG) {
            console.error(
              `r${row} x${start}: terreno ${JSON.stringify(span.map((ok, i) => (ok ? 1 : colorsByCell[cellStart + i])))}`,
            );
          }
        }
      }
    }
    if (!placed)
      throw new Error(
        `la pareja ${TYPES[pair]} no encontró terreno QA verificado entre las filas 61 y 28`,
      );
    qaPairs.push(placed);
    console.error(`pareja ${TYPES[pair]}: fila ${placed.row}, x=${placed.start}`);
  }

  const items = [];
  const manifestCandidates = [];
  TYPES.forEach((type, index) => {
    const asset = catalog.buildings[type];
    const candidate = staged[type].metadata;
    const pair = qaPairs[index];
    const controlCell = { x: pair.start, y: pair.row };
    const candidataCell = { x: pair.start + CANDIDATA_OFFSET, y: pair.row };
    items.push({
      name: `${type}-control`,
      url: asset.states.complete.src,
      pivot: asset.pivot,
      footprint: asset.footprint,
      pixelsPerMeter: asset.pixelsPerMeter,
      cell: controlCell,
      label: `CONTROL · ${type} · catálogo aprobado`,
    });
    items.push({
      name: `${type}-candidata`,
      url: staged[type].url,
      pivot: candidate.pivot,
      footprint: candidate.footprintCells,
      pixelsPerMeter: candidate.framing.pixelsPerMeter,
      cell: candidataCell,
      label: `CANDIDATA WP06 · ${type} · ${candidate.candidateProfile}`,
    });
    manifestCandidates.push({
      buildingType: type,
      control: {
        role: "simulacion_no: sprite aprobado del catálogo, colocado como muestra QA",
        textureSrc: asset.states.complete.src,
        sha256: asset.states.complete.sha256,
        pivot: asset.pivot,
        footprint: asset.footprint,
        pixelsPerMeter: asset.pixelsPerMeter,
        cell: controlCell,
      },
      candidata: {
        role: "sprite candidato QA, colocado para revisión — NO promocionado",
        candidateProfile: candidate.candidateProfile,
        candidateId: candidate.candidateId,
        compositionSignature: candidate.compositionSignature,
        variantSeed: candidate.variantSeed,
        state: candidate.state,
        url: staged[type].url,
        pngSha256: staged[type].pngSha256,
        pivot: candidate.pivot,
        footprint: candidate.footprintCells,
        pixelsPerMeter: candidate.framing.pixelsPerMeter,
        cell: candidataCell,
      },
    });
  });

  await page.evaluate((placements) => {
    window.__landlordCameraTest.placeCandidateQa(placements);
  }, items);
  await page.waitForFunction(
    (count) => window.__landlordCameraTest.listCandidateQa().length === count,
    items.length,
    { timeout: 30_000 },
  );
  const probe = await page.evaluate(() => window.__landlordCameraTest.listCandidateQa());

  const canvas = page.locator("canvas").first();
  const captures = [];
  TYPES.forEach((type, index) => {
    const pair = qaPairs[index];
    const midCell = { x: pair.start + 3, y: pair.row };
    pair.midCell = midCell;
    pair.zooms = [];
  });
  for (const zoom of [1, 0.5]) {
    for (const [index, type] of TYPES.entries()) {
      const pair = qaPairs[index];
      await setCamera(pair.midCell, zoom);
      const png = await canvas.screenshot({ type: "png" });
      const file = `${type}_pair_${zoom === 1 ? "10x" : "05x"}.png`;
      writeFileSync(`${OUTPUT_DIR}/${file}`, png);
      captures.push({
        file,
        buildingType: type,
        zoom,
        centerCell: pair.midCell,
        pairRow: pair.row,
        pairStartX: pair.start,
        pngSha256: sha256(png),
        pngBytes: png.length,
        placed: probe.filter((entry) => entry.name.startsWith(`${type}-`)),
      });
    }
  }

  const manifest = {
    schemaVersion: 1,
    purpose:
      "cuatro candidatas WP06 dentro de Phaser sobre el mundo real; la fila QA es muestra rotulada, no evolución de la partida",
    bundle: { servedFrom: BASE_URL, cameraTest: true },
    qaPlacements: qaPairs,
    candidates: manifestCandidates,
    placed: probe,
    captures,
    pageErrors,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    `${OUTPUT_DIR}/candidate-runtime-qa-manifest.json`,
    JSON.stringify(manifest, null, 1) + "\n",
  );
  console.log(
    `${probe.length} muestras colocadas · ${captures.length} capturas · errores: ${pageErrors.length}`,
  );
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

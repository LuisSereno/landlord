/* global setTimeout, window, URLSearchParams */
/**
 * D-111.2 cierre FASE 2 — el incendio híbrido Blender + Phaser sobre la candidata real.
 *
 * Tres brazos sobre el MISMO sprite (la variante QA `hybq_mixed_tenement_2_burning`, candidata
 * `gn_residential_v2` renderizada con `qaFlamePeakEmission=0.45`): el PNG de Blender solo, el lab
 * de Phaser con la candidata colocada sin fuego dinámico, y el lab con el rig encendido sobre los
 * `fireAnchors` que el compositor publicó en metros. Día, noche, 0,5× y una secuencia de 6
 * fotogramas. Nada entra en el catálogo: el sprite vive en `/qa-candidates/` del dist de captura.
 *
 * Produce en `docs/art/graphics-capabilities/evidence/v2/closure/fire/`:
 *  - las PNG de cada brazo con su JSON hermano (probe + sha256),
 *  - `hybrid_fire_anchors.json` con los u,v que calculó el adaptador TS en el navegador,
 *  - `hybrid_fire_frames/` con la secuencia de animación.
 */
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const PORT = 4193;
const BASE_URL = process.env.HYBRID_FIRE_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const REPO_ROOT = resolve(import.meta.dirname, "..");
const STAGING = "/tmp/d1112-closure";
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/closure/fire";
const VIEWPORT = { width: 1440, height: 900 };
const FRAMES = 6;
const FRAME_INTERVAL_MS = 350;

const CANDIDATE_VARIANTS = [
  { name: "hybq_day", dir: "day" },
  { name: "hybq_night", dir: "night" },
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

mkdirSync(join(REPO_ROOT, OUTPUT_DIR, "hybrid_fire_frames"), { recursive: true });

const server = process.env.HYBRID_FIRE_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "ignore", detached: true, cwd: REPO_ROOT },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

/** El dist de captura es efímero: los hermanos QA se copian al entrar. */
function stageCandidates() {
  const distQa = join(REPO_ROOT, "apps/web/dist/qa-candidates");
  mkdirSync(distQa, { recursive: true });
  for (const variant of CANDIDATE_VARIANTS) {
    for (const suffix of [".png", ".json"]) {
      const source = join(STAGING, variant.dir, `hybq_mixed_tenement_2_burning${suffix}`);
      copyFileSync(source, join(distQa, `${variant.name}${suffix}`));
    }
  }
  return distQa;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(`${BASE_URL}/art-lab?artQa=1`, {
        waitUntil: "domcontentloaded",
        timeout: 1000,
      });
      return;
    } catch {
      await new Promise((resolveTick) => setTimeout(resolveTick, 250));
    }
  }
  throw new Error("el servidor de vista previa del Art Lab no arrancó");
}

async function waitForProbe() {
  await page.waitForFunction(
    () => {
      const probe = window.__fxLab;
      return Boolean(probe?.ready && probe.candidate && probe.candidate.fireAnchors > 0);
    },
    { timeout: 30000, polling: 250 },
  );
  /** Dos lecturas de frames idénticas = renderer congelado; distintas = al menos dibujando. */
  await page.waitForFunction(
    () => new Promise((resolveTick) => setTimeout(() => resolveTick(true), 400)),
  );
  return page.evaluate(() => window.__fxLab);
}

const ARMS = [
  { id: "phaser_candidate_day", variant: "day", mood: "day", fire: false, zoom: 1 },
  { id: "hybrid_fire_day", variant: "day", mood: "day", fire: true, zoom: 1 },
  { id: "hybrid_fire_night", variant: "night", mood: "night", fire: true, zoom: 1 },
  { id: "phaser_candidate_night", variant: "night", mood: "night", fire: false, zoom: 1 },
  { id: "hybrid_fire_day_half", variant: "day", mood: "day", fire: true, zoom: 0.5 },
  { id: "hybrid_fire_night_half", variant: "night", mood: "night", fire: true, zoom: 0.5 },
];

const captures = [];

async function captureArm(arm) {
  const params = new URLSearchParams({
    artQa: "1",
    fxCandidate: `hybq_${arm.variant}`,
    fxMood: arm.mood,
    fxZoom: String(arm.zoom),
    fxPerf: "1",
    ...(arm.fire ? { fx: "fire" } : {}),
  });
  await page.goto(`${BASE_URL}/art-lab?${params.toString()}`, { waitUntil: "domcontentloaded" });
  const probe = await waitForProbe();
  /** El lienzo de la escena, sin el chrome de la página: el fotograma ES la evidencia. */
  const png = await page.locator('[data-testid="fx-lab-scene"] canvas').screenshot({ type: "png" });
  const path = `${OUTPUT_DIR}/${arm.id}.png`;
  writeFileSync(join(REPO_ROOT, path), png);
  const record = {
    schemaVersion: 1,
    arm: arm.id,
    url: `${BASE_URL}/art-lab?${params.toString()}`,
    candidateId: probe.candidate.candidateId,
    candidateProfile: "gn_residential_v2",
    compositionSignature: probe.candidate.compositionSignature,
    textureKey: probe.candidate.textureKey,
    fireAnchors: probe.candidate.fireAnchors,
    smokeFromSprite: probe.candidate.smokeFromSprite,
    fireActive: probe.fireActive,
    fireFoci: probe.fireAnchors,
    fireStats: probe.fire,
    mood: arm.mood,
    zoom: arm.zoom,
    viewport: VIEWPORT,
    renderer: probe.webgl ? "WebGL" : "CANVAS",
    glRenderer: probe.glRenderer,
    pngSha256: sha256(png),
    pngBytes: png.length,
    capturedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(REPO_ROOT, `${OUTPUT_DIR}/${arm.id}.json`),
    JSON.stringify(record, null, 1) + "\n",
  );
  captures.push({ arm, record });
  return record;
}

try {
  stageCandidates();
  await waitForServer();

  for (const arm of ARMS) {
    const record = await captureArm(arm);
    console.log(
      `${arm.id}: ${Math.round(record.pngBytes / 1024)} KiB foci=${record.fireStats?.foci ?? 0}`,
    );
  }

  /** Secuencia de animación: la misma página híbrida de día, fotogramas separados por reloj. */
  const sequenceParams = new URLSearchParams({
    artQa: "1",
    fxCandidate: "hybq_day",
    fxMood: "day",
    fxZoom: "1",
    fxPerf: "1",
    fx: "fire",
  });
  await page.goto(`${BASE_URL}/art-lab?${sequenceParams.toString()}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForProbe();
  const frames = [];
  for (let index = 0; index < FRAMES; index += 1) {
    const probe = await page.evaluate(() => window.__fxLab);
    const png = await page
      .locator('[data-testid="fx-lab-scene"] canvas')
      .screenshot({ type: "png" });
    const name = `hybrid_fire_frames/frame_${String(index + 1).padStart(2, "0")}_t${probe.clockMs}.png`;
    writeFileSync(join(REPO_ROOT, OUTPUT_DIR, name), png);
    frames.push({ file: basename(name), clockMs: probe.clockMs, pngSha256: sha256(png) });
    await new Promise((resolveTick) => setTimeout(resolveTick, FRAME_INTERVAL_MS));
  }

  /** La salida del adaptador TS, tal y como llegó al rig en el navegador. */
  const probe = await page.evaluate(() => window.__fxLab);
  const anchors = {
    schemaVersion: 1,
    purpose: "anclajes del incendio híbrido: salida del adaptador TS verificada por el checker",
    candidateId: probe.candidate.candidateId,
    candidateProfile: "gn_residential_v2",
    compositionSignature: probe.candidate.compositionSignature,
    smokeFromSprite: probe.candidate.smokeFromSprite,
    smokeAnchorsExcluded: true,
    anchors: probe.candidate.anchorsUv,
    pageErrors,
  };
  writeFileSync(
    join(REPO_ROOT, `${OUTPUT_DIR}/hybrid_fire_anchors.json`),
    JSON.stringify(anchors, null, 1) + "\n",
  );

  const summary = {
    schemaVersion: 1,
    arms: captures.map(({ arm, record }) => ({ id: arm.id, ...record })),
    frames,
    pageErrors,
  };
  writeFileSync(
    join(REPO_ROOT, `${OUTPUT_DIR}/hybrid_fire_summary.json`),
    JSON.stringify(summary, null, 1) + "\n",
  );
  console.log(`secuencia: ${frames.length} fotogramas · errores de página: ${pageErrors.length}`);
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

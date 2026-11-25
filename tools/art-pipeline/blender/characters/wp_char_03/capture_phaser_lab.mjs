import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.CHAR_SCALE_LAB_URL ?? "http://127.0.0.1:5173/char-scale-lab.html";
const outputRoot = path.resolve(process.env.CHAR_SCALE_LAB_OUTPUT ?? "docs/art/characters/prototypes/wp-char-03/phaser-captures");
const viewports = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];
const configs = ["A", "B", "C", "D"];
const shots = [
  { id: "general", arrangement: "street" },
  { id: "door", arrangement: "door" },
  { id: "vehicle", arrangement: "vehicle" },
  { id: "lineup", arrangement: "lineup" },
  { id: "walking", arrangement: "street", walking: true },
  { id: "buildings", arrangement: "street" },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function state(page) {
  return page.evaluate(() => window.__charScaleLab.getState());
}

async function call(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.__charScaleLab[method](...args), { method, args });
}

async function capture(page, filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath });
  const buffer = await readFile(filePath);
  return { path: path.relative(process.cwd(), filePath).split(path.sep).join("/"), bytes: buffer.length, sha256: sha256(buffer) };
}

async function measurePerformance(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick(now) {
          frames += 1;
          if (now - start >= 2000) {
            resolve({ frames, elapsedMs: now - start, fps: (frames * 1000) / (now - start), state: window.__charScaleLab.getState() });
          } else {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      }),
  );
}

const browser = await chromium.launch({ headless: true });
const manifest = {
  schemaVersion: 1,
  status: "phaser_capture_in_progress",
  baseUrl,
  viewports,
  configs,
  screenshots: [],
  performance: [],
  functionalChecks: [],
  pageErrors: [],
  consoleErrors: [],
};

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (error) => manifest.pageErrors.push(`${viewport.width}×${viewport.height}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") manifest.consoleErrors.push(`${viewport.width}×${viewport.height}: ${message.text()}`);
    });
    await page.goto(baseUrl);
    await page.waitForFunction(() => window.__charScaleLab?.ready === true, { timeout: 120000 });
    await page.waitForTimeout(800);
    const viewportDir = path.join(outputRoot, `${viewport.width}x${viewport.height}`);
    for (const config of configs) {
      await call(page, "setConfig", config);
      for (const shot of shots) {
        await call(page, "setArrangement", shot.arrangement);
        await call(page, "setPaused", true);
        await call(page, "setMotionEnabled", Boolean(shot.walking));
        await call(page, "setShowGrid", true);
        await call(page, "setShowReferences", true);
        await call(page, "setShowPivots", false);
        if (shot.walking) await call(page, "setMotionPhase", 0.5);
        await page.waitForTimeout(180);
        const filePath = path.join(viewportDir, `${config}-${shot.id}.png`);
        const screenshot = await capture(page, filePath);
        manifest.screenshots.push({ ...screenshot, viewport, config, shot: shot.id, state: await state(page) });
      }
      await call(page, "setArrangement", "street");
      await call(page, "setPaused", false);
      await call(page, "setMotionEnabled", true);
      await page.waitForTimeout(900);
      const performance = await measurePerformance(page);
      manifest.performance.push({ viewport, config, ...performance });
    }

    const checks = [];
    const check = (condition, label, details = undefined) => checks.push({ label, passed: Boolean(condition), details });
    await call(page, "reset");
    const resetState = await state(page);
    check(resetState.config === "B", "lab reset restores recommended B default", resetState.config);
    for (const zoom of [0.5, 1, 1.15, 1.25, 2.5]) {
      await call(page, "setZoom", zoom);
      const current = await state(page);
      check(Math.abs(current.cameraZoom - zoom) < 1e-9, `camera zoom ${zoom}`, current.cameraZoom);
    }
    await call(page, "setArrangement", "lineup");
    const beforeZoom = await state(page);
    await call(page, "setZoom", 2.5);
    const afterZoom = await state(page);
    check(
      JSON.stringify(beforeZoom.characters.map((item) => item.cell)) === JSON.stringify(afterZoom.characters.map((item) => item.cell)),
      "zoom preserves logical character cells",
    );

    await call(page, "reset");
    const beforePan = await state(page);
    await page.mouse.move(700, 360);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(790, 405, { steps: 8 });
    await page.mouse.up({ button: "right" });
    const afterPan = await state(page);
    check(
      Math.abs(afterPan.cameraScroll.x - beforePan.cameraScroll.x) > 20 && Math.abs(afterPan.cameraScroll.y - beforePan.cameraScroll.y) > 10,
      "right drag pans camera",
      { before: beforePan.cameraScroll, after: afterPan.cameraScroll },
    );

    await call(page, "reset");
    const canvasBox = await page.locator("#phaser-root canvas").boundingBox();
    if (!canvasBox) throw new Error("Phaser canvas is not visible");
    await page.mouse.move(640, 360);
    const localPointer = { x: 640 - canvasBox.x, y: 360 - canvasBox.y };
    const worldBeforeWheel = await call(page, "screenToWorld", localPointer.x, localPointer.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(120);
    const worldAfterWheel = await call(page, "screenToWorld", localPointer.x, localPointer.y);
    check(
      Math.hypot(worldAfterWheel.x - worldBeforeWheel.x, worldAfterWheel.y - worldBeforeWheel.y) < 2,
      "wheel zoom preserves cursor world point",
      { before: worldBeforeWheel, after: worldAfterWheel },
    );

    await call(page, "reset");
    const targetWorld = await call(page, "gridCellToScreen", { x: 12, y: 9 });
    const targetScreen = await call(page, "worldToScreen", targetWorld.x, targetWorld.y);
    const picked = await call(page, "pickAtScreen", targetScreen.x, targetScreen.y);
    check(picked?.x === 12 && picked?.y === 9, "pickGridCell resolves visible cell", picked);
    await page.mouse.click(targetScreen.x + canvasBox.x, targetScreen.y + canvasBox.y);
    const clicked = await state(page);
    check(clicked.pickedCell?.x === 12 && clicked.pickedCell?.y === 9, "canvas click updates picked cell", clicked.pickedCell);
    const zoomScreenshot = await capture(page, path.join(viewportDir, "functional-zoom.png"));
    const pickingScreenshot = await capture(page, path.join(viewportDir, "functional-picking.png"));
    manifest.screenshots.push(
      { ...zoomScreenshot, viewport, config: "functional", shot: "zoom" },
      { ...pickingScreenshot, viewport, config: "functional", shot: "picking" },
    );

    await call(page, "setArrangement", "street");
    await call(page, "setPaused", true);
    await call(page, "setMotionEnabled", true);
    const cycle = [];
    for (const phase of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      await call(page, "setMotionPhase", phase);
      cycle.push(await state(page));
    }
    const workerCycle = cycle.map((item) => item.characters.find((character) => character.role === "worker"));
    const enforcerCycle = cycle.map((item) => item.characters.find((character) => character.role === "enforcer"));
    check(workerCycle.every(Boolean) && enforcerCycle.every(Boolean), "worker and enforcer visible during walk");
    check(
      workerCycle.map((item) => item.sampleIndex).join(",") === "0,1,2,3,4,5,6,7,0",
      "walk frame sequence closes after eight samples",
      workerCycle.map((item) => item.sampleIndex),
    );
    check(
      Math.max(...workerCycle.map((item) => item.scale)) - Math.min(...workerCycle.map((item) => item.scale)) < 1e-9 &&
        Math.max(...enforcerCycle.map((item) => item.scale)) - Math.min(...enforcerCycle.map((item) => item.scale)) < 1e-9,
      "walk scale remains stable across frames",
    );
    check(
      workerCycle[0].x !== workerCycle[4].x && enforcerCycle[0].x !== enforcerCycle[4].x,
      "walk changes world position",
    );

    await call(page, "setArrangement", "lineup");
    await call(page, "setMotionEnabled", false);
    for (const role of ["worker", "supervisor", "enforcer", "police", "firefighter"]) {
      for (const direction of [0, 1, 2, 3]) {
        await call(page, "setCharacterDirection", role, direction);
        const current = await state(page);
        const visual = current.characters.find((character) => character.role === role);
        check(visual?.direction === direction && visual.textureKey.includes(`_d${direction}_`), `${role} direction ${direction}`, visual?.textureKey);
      }
    }
    const lineup = await state(page);
    const ordered = [...lineup.characters].sort((first, second) => first.cell.x - second.cell.x);
    check(ordered.every((item, index) => index === 0 || item.depth > ordered[index - 1].depth), "lineup depth follows isometric cell order");
    await call(page, "setZoom", 0.5);
    const far = await state(page);
    check(far.characters.every((character) => character.inView), "five characters remain in view at 0.5x");
    const lineupScreenshot = await capture(page, path.join(viewportDir, "functional-lineup.png"));
    manifest.screenshots.push({ ...lineupScreenshot, viewport, config: "functional", shot: "lineup" });
    manifest.functionalChecks.push({ viewport, checks });
    await page.close();
  }
  manifest.status = manifest.pageErrors.length === 0 && manifest.consoleErrors.length === 0 ? "captured" : "captured_with_browser_errors";
} finally {
  await browser.close();
}

await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, "capture-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
const failedChecks = manifest.functionalChecks.flatMap((entry) => entry.checks.filter((check) => !check.passed));
console.log(JSON.stringify({ status: manifest.status, screenshots: manifest.screenshots.length, performance: manifest.performance.length, failedChecks, pageErrors: manifest.pageErrors, consoleErrors: manifest.consoleErrors }, null, 2));
if (failedChecks.length > 0 || manifest.pageErrors.length > 0 || manifest.consoleErrors.length > 0) process.exitCode = 1;

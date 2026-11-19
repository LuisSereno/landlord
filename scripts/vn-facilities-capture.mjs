#!/usr/bin/env node
/* global window, document, setTimeout, HTMLButtonElement */
/**
 * D-109 · QA de capturas diurna/nocturna de los seis equipamientos con su patio equipado.
 * La app real (seed fresco, cameraTest=1) renderiza las variantes promocionadas; el hook de cámara
 * centra cada edificio y el selector Día/Noche del HUD cambia el mood. Evidencia versionada en
 * docs/art/golden/vn-facilities/ con resumen JSON y errores de página.
 *
 * Usage: node scripts/vn-facilities-capture.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4184;
const baseUrl = process.env.VN_CAPTURE_BASE_URL ?? `http://127.0.0.1:${port}/`;
const outputDir = "docs/art/golden/vn-facilities";
const TYPES = [
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
];
const server = process.env.VN_CAPTURE_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const log = (m) => process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${m}\n`);

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("servidor no arrancó");
}

async function dismissOnboarding() {
  for (let i = 0; i < 3; i++) {
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

try {
  await waitForServer();
  await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.deleteDatabase("landlord-gate1");
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
  await page.goto(`${baseUrl}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 30000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 30000 });
  await dismissOnboarding();
  await page.waitForFunction(() => window.__gameplayVisualStats?.().assetsReady === true, null, {
    timeout: 60000,
  });
  await page.waitForTimeout(2000);
  log("assets ready");

  const summary = { captures: [], pageErrors };
  /**
   * El programa municipal es de ciudad (14 equipamientos repartidos en nueve distritos), así que
   * hay que visitar cada distrito y capturar los tipos que hospeda. El selector del HUD es la
   * puerta real: el worker cambia el distrito observado y la proyección se resincroniza.
   */
  await page.evaluate(() => {
    const trigger = document.querySelector(".hud-district");
    if (trigger instanceof HTMLButtonElement) trigger.click();
  });
  await page
    .locator('[aria-label="Distritos"] [role="gridcell"]')
    .first()
    .waitFor({ timeout: 10000 });
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  const names = [];
  for (let i = 0; i < (await tiles.count()); i++) {
    names.push((await tiles.nth(i).locator("strong").innerText()).trim());
  }
  await page.keyboard.press("Escape");
  log(`distritos: ${names.join(", ")}`);

  async function selectDistrict(name) {
    await page.evaluate(() => {
      const trigger = document.querySelector(".hud-district");
      if (trigger instanceof HTMLButtonElement) trigger.click();
    });
    const grid = page.locator('[aria-label="Distritos"] [role="gridcell"]');
    await grid.first().waitFor({ timeout: 10000 });
    const count = await grid.count();
    for (let i = 0; i < count; i++) {
      const text = (await grid.nth(i).locator("strong").innerText()).trim();
      if (text === name) {
        await grid.nth(i).click();
        break;
      }
    }
    await page
      .waitForFunction(
        (expected) =>
          window.__landlordCameraTest
            .getProjection()
            ?.city?.districts?.find(
              (d) => d.id === window.__landlordCameraTest.getProjection().observedDistrictId,
            )?.name === expected,
        name,
        { timeout: 15000 },
      )
      .catch(() => {});
    await page.waitForTimeout(1500);
  }

  const captured = new Set();
  for (const mood of ["day", "night"]) {
    await page.getByRole("button", { name: mood === "day" ? "Día" : "Noche" }).click();
    await page.waitForTimeout(2500);
    for (const name of names) {
      await selectDistrict(name);
      for (const type of TYPES) {
        const key = `${mood}-${type}`;
        if (captured.has(key)) continue;
        const center = await page.evaluate((buildingType) => {
          const projection = window.__landlordCameraTest.getProjection();
          const building = projection?.economy?.buildings.find((b) => b.type === buildingType);
          if (!building || building.footprintCells.length === 0) return null;
          const cells = building.footprintCells;
          return {
            x: cells.reduce((s, c) => s + c.x, 0) / cells.length,
            y: cells.reduce((s, c) => s + c.y, 0) / cells.length,
            siteCells: building.siteCells?.length ?? 0,
            footprintCells: cells.length,
            district: projection.observedDistrictId,
          };
        }, type);
        if (!center) continue;
        await page.evaluate(
          ({ cell, zoom }) => {
            const api = window.__landlordCameraTest;
            api.centerOnCell(cell);
            const camera = api.getCamera();
            api.configure({ zoom, scrollX: camera.scrollX, scrollY: camera.scrollY });
          },
          { cell: { x: center.x, y: center.y }, zoom: 2 },
        );
        await page.waitForTimeout(1500);
        await page.waitForFunction(
          ({ buildingType, expectedMood }) =>
            window.__landlordQaVariantReady?.(buildingType, expectedMood) === true,
          { buildingType: type, expectedMood: mood },
          { timeout: 30000 },
        );
        await page
          .waitForFunction(
            (buildingType) => window.__landlordQaCourtyardReady?.(buildingType) === true,
            type,
            { timeout: 10000 },
          )
          .catch(async () => {
            const status = await page.evaluate(
              (buildingType) => window.__landlordQaCourtyardStatus?.(buildingType),
              type,
            );
            throw new Error(`Patio incompleto ${mood}/${type}: ${JSON.stringify(status)}`);
          });
        const file = `${outputDir}/${mood}-${type}.png`;
        await page.screenshot({ path: file });
        captured.add(key);
        summary.captures.push({
          mood,
          type,
          file,
          district: center.district,
          siteCells: center.siteCells,
          footprintCells: center.footprintCells,
        });
        log(
          `captured ${mood} ${type} en ${name} (site ${center.siteCells} / fp ${center.footprintCells})`,
        );
      }
    }
  }
  summary.stats = await page.evaluate(() => window.__gameplayVisualStats());
  writeFileSync(`${outputDir}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
  log(`done: ${summary.captures.length} capturas, ${pageErrors.length} errores de página`);
} finally {
  await browser.close();
  if (server) server.kill("SIGTERM");
}

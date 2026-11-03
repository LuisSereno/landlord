/* global setTimeout, document */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4182;
const external = process.env.VISUAL_CATALOG_BASE_URL;
const baseUrl = external ?? `http://127.0.0.1:${port}`;
const server = external
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function ready() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/visual-catalog?static=1`, {
        waitUntil: "domcontentloaded",
        timeout: 500,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Visual Catalog server did not start");
}
async function shot(name, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  await locator.screenshot({ path: `docs/art/golden/visual-catalog/${name}` });
}
try {
  await ready();
  await page.getByRole("heading", { name: "Landlord visual catalog" }).waitFor();
  const cards = page.locator("[data-building-card]");
  if ((await cards.count()) !== 15) throw new Error("Expected 15 building cards");
  const rows = page.locator("[data-state-row]");
  if ((await rows.count()) !== 15) throw new Error("Expected 15 state rows");
  if ((await rows.locator("img").count()) !== 18)
    throw new Error("Expected 18 state images (complete + legacy courtyard states)");
  if ((await page.locator("[data-character-card]").count()) !== 13)
    throw new Error("Expected 13 character cards");
  for (const image of await page.locator("#buildings img,#building-states img").all()) {
    await image.scrollIntoViewIfNeeded();
    if ((await image.evaluate((node) => node.naturalWidth)) === 0)
      throw new Error("Missing catalog image");
  }
  await page.locator("#showcase").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll("#showcase canvas").length === 1, {
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
  if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);
  const text = await page.locator("#coverage").innerText();
  for (const expected of ["15/15", "18/60", "13/13", "6/6", "purchaseGaps", "0"])
    if (!text.includes(expected)) throw new Error(`Missing coverage ${expected}`);
  mkdirSync("docs/art/golden/visual-catalog", { recursive: true });
  await shot("01-overview.png", page.locator(".catalog-hero"));
  await shot("02-buildings-all.png", page.locator("#buildings"));
  await shot("03-building-states.png", page.locator("#building-states .state-row").first());
  await page.locator("#buildings select").selectOption("residential");
  await shot("04-residential.png", page.locator("#buildings"));
  await page.locator("#buildings select").selectOption("industrial");
  await shot("05-industrial.png", page.locator("#buildings"));
  await page.locator("#buildings select").selectOption("civic");
  await shot("06-civic.png", page.locator("#buildings"));
  await shot("07-characters.png", page.locator("#characters"));
  await shot("08-character-animations.png", page.locator("#animations"));
  await shot("09-vehicles-props.png", page.locator("#vehicles"));
  await shot("10-terrain-parcels.png", page.locator("#terrain"));
  await shot("11-overlays.png", page.locator("#overlays"));
  await shot("12-construction-sequence.png", page.locator("#construction-sequence"));
  await shot("13-showcase-city.png", page.locator("#showcase"));
  await shot("14-showcase-canvas.png", page.locator("#showcase canvas"));
  await shot("15-coverage.png", page.locator("#coverage"));
  await shot("16-scale-reference.png", page.locator("#scale-reference"));
  console.log(
    JSON.stringify({
      status: "passed",
      buildings: 15,
      states: 18,
      characters: 13,
      screenshots: 16,
      pageErrors: 0,
    }),
  );
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

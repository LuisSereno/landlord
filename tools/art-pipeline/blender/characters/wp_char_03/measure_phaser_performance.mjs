import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.CHAR_SCALE_LAB_URL ?? "http://127.0.0.1:5173/char-scale-lab.html";
const output = path.resolve("docs/art/characters/prototypes/wp-char-03/phaser-captures/performance-balanced.json");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(baseUrl);
await page.waitForFunction(() => window.__charScaleLab?.ready === true, { timeout: 120000 });

async function measure(config) {
  await page.evaluate((id) => {
    window.__charScaleLab.setConfig(id);
    window.__charScaleLab.setArrangement("street");
    window.__charScaleLab.setPaused(false);
    window.__charScaleLab.setMotionEnabled(true);
  }, config);
  await page.waitForTimeout(900);
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick(now) {
          frames += 1;
          if (now - start >= 2000) {
            const state = window.__charScaleLab.getState();
            resolve({ frames, elapsedMs: now - start, fps: (frames * 1000) / (now - start), spriteCount: state.spriteCount, textureCount: state.textureCount, estimatedTextureBytes: state.estimatedTextureBytes });
          } else {
            requestAnimationFrame(tick);
          }
        }
        requestAnimationFrame(tick);
      }),
  );
}

const rounds = [];
for (const order of [["A", "B", "C", "D"], ["D", "C", "B", "A"]]) {
  const entries = [];
  for (const config of order) entries.push({ config, ...(await measure(config)) });
  rounds.push({ order, entries });
}
await browser.close();
const byConfig = Object.fromEntries(
  ["A", "B", "C", "D"].map((config) => {
    const values = rounds.flatMap((round) => round.entries.filter((entry) => entry.config === config).map((entry) => entry.fps));
    const sorted = [...values].sort((first, second) => first - second);
    return [config, { samples: values, median: (sorted[0] + sorted[1]) / 2, min: Math.min(...values), max: Math.max(...values) }];
  }),
);
const result = { schemaVersion: 1, status: "measured", environment: "headless Chromium software rendering; relative comparison only", rounds, byConfig };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(byConfig, null, 2));

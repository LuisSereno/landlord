/* global setTimeout, Image, document */
/**
 * Regresión visual del Art Lab (WP4.15-H). Captura la página en modo estático (`?static=1`, sin
 * animaciones que hagan variar el frame) y la compara contra el golden versionado con un pixel-diff
 * tolerante: cuenta los píxeles cuya diferencia por canal supera el umbral y falla si el porcentaje
 * supera el máximo. La comparación ocurre en el propio navegador (canvas), sin dependencias nuevas.
 *
 *   node scripts/art-visual-capture.mjs                 # captura y compara (fallo si se sale de tolerancia)
 *   ART_VISUAL_UPDATE=1 node scripts/art-visual-capture.mjs   # regenera el golden tras un cambio aprobado
 *
 * Tolerancias: ART_VISUAL_CHANNEL_THRESHOLD (default 12/255) y ART_VISUAL_MAX_RATIO (default 0,5 %).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const port = 4176;
const externalServerUrl = process.env.ART_VISUAL_BASE_URL;
const baseUrl = externalServerUrl ?? `http://127.0.0.1:${port}`;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );
const output = process.env.ART_VISUAL_OUTPUT ?? "artifacts/art-lab-runtime-assets.png";
const goldenPng = process.env.ART_VISUAL_GOLDEN ?? "docs/art/golden/art-lab-runtime-assets.png";
const goldenMeta = goldenPng.replace(/\.png$/, ".golden.json");
const update = process.env.ART_VISUAL_UPDATE === "1";
const channelThreshold = Number(process.env.ART_VISUAL_CHANNEL_THRESHOLD ?? 12);
const maxRatio = Number(process.env.ART_VISUAL_MAX_RATIO ?? 0.005);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/art-lab?static=1`, {
        waitUntil: "domcontentloaded",
        timeout: 500,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor del Art Lab no arrancó");
}

/** Pixel-diff tolerante en el navegador: devuelve píxeles comparados, distintos y ratio. */
async function pixelDiff(leftBase64, rightBase64) {
  return page.evaluate(
    async ({ left, right, threshold }) => {
      const load = async (dataUrl) => {
        const element = new Image();
        element.src = dataUrl;
        await element.decode();
        return element;
      };
      const leftImage = await load(left);
      const rightImage = await load(right);
      await Promise.all([leftImage.decode(), rightImage.decode()]);
      const commonWidth = Math.min(leftImage.width, rightImage.width);
      const commonHeight = Math.min(leftImage.height, rightImage.height);
      if (commonWidth === 0 || commonHeight === 0) {
        return {
          sizeMismatch: true,
          left: [leftImage.width, leftImage.height],
          right: [rightImage.width, rightImage.height],
        };
      }
      const canvas = document.createElement("canvas");
      canvas.width = commonWidth;
      canvas.height = commonHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(leftImage, 0, 0, commonWidth, commonHeight, 0, 0, commonWidth, commonHeight);
      const leftData = context.getImageData(0, 0, commonWidth, commonHeight).data;
      context.clearRect(0, 0, commonWidth, commonHeight);
      context.drawImage(rightImage, 0, 0, commonWidth, commonHeight, 0, 0, commonWidth, commonHeight);
      const rightData = context.getImageData(0, 0, commonWidth, commonHeight).data;
      let different = 0;
      for (let index = 0; index < leftData.length; index += 4) {
        const delta = Math.max(
          Math.abs(leftData[index] - rightData[index]),
          Math.abs(leftData[index + 1] - rightData[index + 1]),
          Math.abs(leftData[index + 2] - rightData[index + 2]),
          Math.abs(leftData[index + 3] - rightData[index + 3]),
        );
        if (delta > threshold) different += 1;
      }
      const pixels = leftData.length / 4;
      return {
        sizeMismatch: false,
        pixels,
        different,
        ratio: different / pixels,
        leftSize: [leftImage.width, leftImage.height],
        rightSize: [rightImage.width, rightImage.height],
        comparedSize: [commonWidth, commonHeight],
      };
    },
    { left: leftBase64, right: rightBase64, threshold: channelThreshold },
  );
}

try {
  await waitForServer();
  await page.locator("[data-building]").first().waitFor();
  await page.locator("[data-character]").first().waitFor();
  await page.locator("[data-blender-e2e]").first().waitFor();
  await page.waitForTimeout(500);
  const screenshot = await page.screenshot({ fullPage: true });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(output, screenshot);
  const sha256 = createHash("sha256").update(screenshot).digest("hex");
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  if (update) {
    mkdirSync("docs/art/golden", { recursive: true });
    writeFileSync(goldenPng, screenshot);
    writeFileSync(
      goldenMeta,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          page: "/art-lab?static=1",
          viewport: { width: 1440, height: 1000 },
          deviceScaleFactor: 1,
          channelThreshold,
          maxRatio,
          sha256,
        },
        null,
        2,
      )}\n`,
    );
    console.log(JSON.stringify({ status: "golden-updated", output, goldenPng, sha256 }));
  } else {
    if (!existsSync(goldenPng))
      throw new Error(`Falta el golden ${goldenPng}: regenera con ART_VISUAL_UPDATE=1`);
    const golden = readFileSync(goldenPng);
    const diff = await pixelDiff(
      `data:image/png;base64,${golden.toString("base64")}`,
      `data:image/png;base64,${screenshot.toString("base64")}`,
    );
    const result = {
      status: diff.sizeMismatch ? "size-mismatch" : diff.ratio <= maxRatio ? "passed" : "failed",
      output,
      bytes: screenshot.length,
      sha256,
      golden: goldenPng,
      channelThreshold,
      maxRatio,
      diff,
    };
    console.log(JSON.stringify(result));
    if (result.status !== "passed") process.exit(1);
  }
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

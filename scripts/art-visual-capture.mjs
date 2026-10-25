/* global setTimeout */
/**
 * Captura visual del Art Lab con los assets runtime (WP4.15). Genera un PNG en artifacts/ y publica
 * su SHA-256. Con ART_VISUAL_STRICT=1 compara contra el baseline versionado; la comparación es
 * opt-in porque el antialiasing puede variar entre runners.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const baselinePath =
  process.env.ART_VISUAL_BASELINE ?? "docs/art/golden/art-lab-runtime-assets.sha256";
const strict = process.env.ART_VISUAL_STRICT === "1";
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
      await page.goto(`${baseUrl}/art-lab`, { waitUntil: "domcontentloaded", timeout: 500 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("El servidor del Art Lab no arrancó");
}

try {
  await waitForServer();
  await page.locator("[data-building]").first().waitFor();
  await page.locator("[data-character]").first().waitFor();
  await page.waitForTimeout(500);
  const screenshot = await page.screenshot({ fullPage: true });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(output, screenshot);
  const sha256 = createHash("sha256").update(screenshot).digest("hex");
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  const result = { status: "captured", output, bytes: screenshot.length, sha256 };
  if (strict) {
    const expected = readFileSync(baselinePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .at(-1);
    result.baseline = expected;
    result.match = expected === sha256;
    if (!result.match) {
      console.error(JSON.stringify(result));
      process.exit(1);
    }
  }
  console.log(JSON.stringify(result));
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

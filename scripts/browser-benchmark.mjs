/* global navigator, performance, requestAnimationFrame, setTimeout */

import { spawn } from "node:child_process";
import { chromium, firefox } from "@playwright/test";

const durationMs = Number(process.env.BROWSER_BENCHMARK_MS ?? 10_000);
const warmupMs = Number(process.env.BROWSER_BENCHMARK_WARMUP_MS ?? 2_000);
const port = 4173;
const externalServerUrl = process.env.BROWSER_SERVER_URL;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "dev", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );

async function waitForServer(page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(externalServerUrl ?? `http://127.0.0.1:${port}`, {
        waitUntil: "domcontentloaded",
        timeout: 500,
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Web benchmark server did not start");
}

async function measure(browserName, launcher) {
  const browser = await launcher.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && browserName === "chromium"
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage();
  await waitForServer(page);
  const result = await page.evaluate(
    async ({ duration, warmup }) => {
      const warmupEnd = performance.now() + warmup;
      while (performance.now() < warmupEnd)
        await new Promise((resolve) => requestAnimationFrame(resolve));
      const frames = [];
      let previous = performance.now();
      const end = previous + duration;
      while (previous < end) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        frames.push(now - previous);
        previous = now;
      }
      frames.sort((left, right) => left - right);
      const percentile = (fraction) =>
        frames[Math.min(frames.length - 1, Math.floor(frames.length * fraction))] ?? 0;
      return {
        browser: navigator.userAgent,
        durationMs: duration,
        frames: frames.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: frames.at(-1) ?? 0,
      };
    },
    { duration: durationMs, warmup: warmupMs },
  );
  await browser.close();
  console.log(JSON.stringify({ browserName, ...result }));
}

try {
  const requested = process.env.BROWSER_ONLY;
  if (!requested || requested === "chromium") await measure("chromium", chromium);
  if (!requested || requested === "firefox") await measure("firefox", firefox);
} finally {
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

/* global clearInterval, navigator, performance, requestAnimationFrame, setInterval, setTimeout, window, PerformanceObserver */

import { spawn } from "node:child_process";
import { chromium, firefox } from "@playwright/test";

const durationMs = Number(process.env.BROWSER_BENCHMARK_MS ?? 600_000);
const warmupMs = Number(process.env.BROWSER_BENCHMARK_WARMUP_MS ?? 50_000);
const port = 4173;
const externalServerUrl = process.env.BROWSER_SERVER_URL;
const server = externalServerUrl
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(port)],
      { stdio: "ignore", detached: true },
    );

async function waitForServer(page) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await page.goto(
        `${externalServerUrl ?? `http://127.0.0.1:${port}`}?benchmark=gate1-reference-v1`,
        {
          waitUntil: "domcontentloaded",
          timeout: 500,
        },
      );
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await waitForServer(page);
  await page.waitForFunction(() => window.__landlordBenchmark !== undefined);
  await page.evaluate(() => window.__landlordBenchmark?.ready);
  const result = await page.evaluate(
    async ({ duration, warmup }) => {
      const benchmark = window.__landlordBenchmark;
      if (!benchmark) throw new Error("Benchmark API is unavailable");
      const longTasks = [];
      const memorySamples = [];
      const operationErrors = [];
      const operations = [];
      let commandNumber = 0;
      let saveBusy = false;
      const submitCommands = () => {
        const commands = Array.from({ length: 5 }, (_, index) => {
          const cell =
            commandNumber++ % 10 === 9
              ? { x: 64, y: index }
              : { x: index, y: (commandNumber + index) % 64 };
          return benchmark.submitCommand(cell);
        });
        operations.push(Promise.all(commands));
      };
      const saveAndLoad = async () => {
        if (saveBusy) return;
        saveBusy = true;
        try {
          const saved = await benchmark.saveSnapshot();
          await benchmark.loadSnapshot(saved.snapshot);
        } catch (error) {
          operationErrors.push(String(error));
        } finally {
          saveBusy = false;
        }
      };
      const commandTimer = setInterval(submitCommands, 5_000);
      const saveInterval = duration >= 7_200_000 ? 1_800_000 : Math.max(30_000, duration / 3);
      const saveTimer = setInterval(() => void saveAndLoad(), saveInterval);
      const memoryTimer = setInterval(() => {
        if (performance.memory) {
          memorySamples.push({
            at: performance.now(),
            usedJsHeapSize: performance.memory.usedJSHeapSize,
            totalJsHeapSize: performance.memory.totalJSHeapSize,
          });
        }
      }, 60_000);
      const observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) longTasks.push(entry.duration);
      });
      try {
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Firefox does not expose the Long Tasks API.
      }
      const warmupEnd = performance.now() + warmup;
      while (performance.now() < warmupEnd)
        await new Promise((resolve) => requestAnimationFrame(resolve));
      await saveAndLoad();
      const frames = [];
      let previous = performance.now();
      const end = previous + duration;
      while (previous < end) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        frames.push(now - previous);
        previous = now;
      }
      observer.disconnect();
      clearInterval(commandTimer);
      clearInterval(saveTimer);
      clearInterval(memoryTimer);
      await Promise.all(operations);
      if (performance.memory) {
        memorySamples.push({
          at: performance.now(),
          usedJsHeapSize: performance.memory.usedJSHeapSize,
          totalJsHeapSize: performance.memory.totalJSHeapSize,
        });
      }
      frames.sort((left, right) => left - right);
      const percentile = (fraction) =>
        frames[Math.min(frames.length - 1, Math.floor(frames.length * fraction))] ?? 0;
      const metrics = window.__landlordBenchmark?.getMetrics() ?? null;
      return {
        browser: navigator.userAgent,
        durationMs: duration,
        frames: frames.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: frames.at(-1) ?? 0,
        worker: metrics,
        projectionLatencyP95: benchmark.getProjectionLatencyP95(),
        longTasks: longTasks.length,
        longTaskP95: percentile(longTasks, 0.95),
        memorySamples,
        operationErrors,
        memory: performance.memory
          ? {
              usedJsHeapSize: performance.memory.usedJSHeapSize,
              totalJsHeapSize: performance.memory.totalJSHeapSize,
            }
          : null,
      };
    },
    { duration: durationMs, warmup: warmupMs },
  );
  await browser.close();
  console.log(JSON.stringify({ browserName, pageErrors, ...result }));
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

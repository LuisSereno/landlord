#!/usr/bin/env node
/**
 * Executes the V.h remediation after escaping the single nested template literal used to generate
 * the Vitest file. The generated repository changes remain identical; this wrapper only makes the
 * remediation source parseable without rewriting the large audited script by hand.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(scriptsDir, "vh-visual-remediation-v2.mjs");
const runnablePath = join(scriptsDir, ".vh-visual-remediation-v2-runnable.mjs");
const original = readFileSync(sourcePath, "utf8");
const nested = "const visual = visualArchetypeForBuilding(type, `building:${type}`);";
const escaped = 'const visual = visualArchetypeForBuilding(type, "building:" + type);';
if (!original.includes(nested)) {
  throw new Error("[vh-remediation-runner] no se encontró el template literal anidado esperado");
}
writeFileSync(runnablePath, original.replace(nested, escaped), "utf8");
try {
  await import(`${pathToFileURL(runnablePath).href}?run=${Date.now()}`);
} finally {
  rmSync(runnablePath, { force: true });
}

#!/usr/bin/env node
/** Completes vehicle-orientation expectations after the four-axis remediation. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(ROOT, "apps/web/src/isometric/gameplay-visual-adapter.test.ts");
let source = readFileSync(path, "utf8");
const before = "expect([45, 225]).toContain(vehicle.azimuth);";
const after = "expect([45, 135, 225, 315]).toContain(vehicle.azimuth);";
if (!source.includes(after)) {
  if (!source.includes(before)) {
    throw new Error("[vh-remediation-testfix2] no se encontró la aserción de azimut antigua");
  }
  source = source.replace(before, after);
}
writeFileSync(path, source, "utf8");
console.log(JSON.stringify({ status: "vh-remediation-four-axis-test-updated" }));

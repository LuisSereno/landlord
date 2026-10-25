#!/usr/bin/env node
/**
 * Presupuesto de binarios de arte (D-081). Git LFS queda reclasificado como requisito de Beta, pero
 * Alpha no puede seguir engordando el repo con renders grandes sin que nadie lo decida: este check
 * falla si algún binario versionado nuevo supera `maxBinaryBytes`, salvo las excepciones nombradas
 * del spike (WP2.14), que quedan como deuda registrada. Añadir una excepción exige editar a mano
 * `docs/art/BINARY-ALLOWLIST.json`, un acto visible en revisión.
 *
 * Uso: node scripts/check-binary-budget.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BINARY_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".blend",
  ".psd",
  ".mp3",
  ".ogg",
  ".wav",
];
const allowlistPath = "docs/art/BINARY-ALLOWLIST.json";
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
const maxBytes = allowlist.maxBinaryBytes;
const exceptions = new Map(allowlist.exceptions.map((entry) => [entry.path, entry.reason]));

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(
    (file) => file.length > 0 && BINARY_EXTENSIONS.includes(file.slice(file.lastIndexOf("."))),
  );

const violations = [];
const stale = new Set(exceptions.keys());
let totalBytes = 0;
for (const file of files) {
  const { size } = statSync(join(process.cwd(), file));
  totalBytes += size;
  if (size <= maxBytes) continue;
  if (exceptions.has(file)) {
    stale.delete(file);
    continue;
  }
  violations.push({ path: file, bytes: size });
}
for (const path of stale) violations.push({ path, bytes: 0, error: "excepción obsoleta" });

if (violations.length > 0) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        maxBytes,
        violations,
        hint: "D-081: binarios nuevos por encima del presupuesto requieren LFS (Beta) o una excepción registrada en docs/art/BINARY-ALLOWLIST.json",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
console.log(
  JSON.stringify({
    status: "passed",
    binaries: files.length,
    totalBytes,
    maxBytes,
    exceptions: exceptions.size,
  }),
);

#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const publicRoot = join(repoRoot, "apps/web/public");
const runtimeRoot = join(publicRoot, "assets/runtime");
const manifests = [
  "apps/web/src/generated/runtime-assets.json",
  "apps/web/src/generated/runtime-assets-blender.json",
  "apps/web/src/generated/runtime-assets-blender-day.json",
  "apps/web/src/generated/runtime-building-variants.json",
  "apps/web/src/generated/runtime-building-variants-night.json",
].filter((path) => existsSync(join(repoRoot, path)));

const referenced = new Set();
const hashChecks = [];

function visit(value) {
  if (Array.isArray(value)) {
    for (const entry of value) visit(entry);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (typeof value.src === "string" && value.src.startsWith("/assets/")) {
    const path = value.src.slice(1);
    referenced.add(path);
    if (typeof value.sha256 === "string") hashChecks.push({ path, sha256: value.sha256 });
  }
  for (const entry of Object.values(value)) visit(entry);
}

for (const manifest of manifests) visit(JSON.parse(readFileSync(join(repoRoot, manifest), "utf8")));

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return entry.name === ".gitignore" ? [] : [path];
  });
}

const diskFiles = filesUnder(runtimeRoot);
const disk = new Set(diskFiles.map((path) => relative(publicRoot, path).replaceAll("\\", "/")));
const missing = [...referenced].filter((path) => !disk.has(path)).sort();
const orphans = [...disk].filter((path) => !referenced.has(path)).sort();
const hashMismatches = hashChecks
  .filter(({ path }) => disk.has(path))
  .filter(({ path, sha256 }) => {
    const actual = createHash("sha256").update(readFileSync(join(publicRoot, path))).digest("hex");
    return actual !== sha256;
  })
  .map(({ path, sha256 }) => ({ path, expected: sha256 }));
const forbidden = diskFiles
  .map((path) => relative(publicRoot, path).replaceAll("\\", "/"))
  .filter((path) => /(?:^|\/)vf_town_hall_1006[^/]*\.png$|qa_mini_/u.test(path))
  .sort();

const report = {
  status: missing.length + orphans.length + hashMismatches.length + forbidden.length === 0 ? "passed" : "failed",
  manifests,
  referencedFiles: referenced.size,
  runtimeFiles: disk.size,
  missing,
  orphans,
  hashMismatches,
  forbidden,
};
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 1;

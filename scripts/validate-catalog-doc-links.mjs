#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEFAULT_TARGETS = [
  "docs/INDEX.md",
  "docs/art/ART-PIPELINE.md",
  "docs/art/CHARACTER-FACTORY.md",
  "docs/art/organization-headquarters",
  "docs/art/cleaning-depot",
  "docs/execution/phase-4/catalog-closure",
  "docs/execution/phase-4/characters/wp-char-04",
  "docs/execution/phase-4/characters/05-wp-char-01b-results.md",
];

function markdownFiles(path) {
  if (!existsSync(path)) return [];
  const stat = statSync(path);
  if (stat.isFile()) return extname(path) === ".md" ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return markdownFiles(child);
    return entry.isFile() && extname(child) === ".md" ? [child] : [];
  });
}

function localTarget(raw) {
  const target = raw
    .trim()
    .replace(/^<|>$/g, "")
    .split(/\s+["']/u, 1)[0];
  if (!target || target.startsWith("#") || /^(?:https?|mailto|data):/iu.test(target)) return null;
  return target.split("#", 1)[0];
}

export function findBrokenMarkdownLinks(root, files) {
  const broken = [];
  for (const file of files) {
    const absolute = resolve(root, file);
    const lines = readFileSync(absolute, "utf8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const targets = [];
      for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
        targets.push(match[1]);
      }
      const definition = line.match(/^\s*\[[^\]]+\]:\s*(\S+)/u);
      if (definition) targets.push(definition[1]);
      for (const raw of targets) {
        const target = localTarget(raw);
        if (!target) continue;
        const destination = resolve(dirname(absolute), target);
        if (!existsSync(destination)) {
          broken.push({ file: file.replaceAll("\\", "/"), line: index + 1, target });
        }
      }
    }
  }
  return broken;
}

export function validateCatalogDocLinks({ root = REPO_ROOT, targets = DEFAULT_TARGETS } = {}) {
  const files = [...new Set(targets.flatMap((target) => markdownFiles(resolve(root, target))))]
    .map((path) => path.slice(root.length + 1))
    .sort();
  const broken = findBrokenMarkdownLinks(root, files);
  return { status: broken.length === 0 ? "passed" : "failed", files: files.length, broken };
}

function main() {
  const result = validateCatalogDocLinks();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "passed") process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();

#!/usr/bin/env node

/**
 * Extract and inventory CC0 asset packs from staging ZIPs.
 *
 * Usage:
 *   node scripts/extract-cc0-packs.mjs --verify    # verify ZIP hashes only
 *   node scripts/extract-cc0-packs.mjs --inventory # regenerate inventory without re-extracting
 *   node scripts/extract-cc0-packs.mjs             # verify + extract + inventory
 */

import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { extract as tarExtract } from "tar";
import unzipper from "unzipper";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STAGING = join(ROOT, "blender_artist/staging/third_party/cc0");
const EXTRACTED = join(STAGING, "extracted");
const MANIFESTS = join(ROOT, "blender_artist/manifests");
const STAGING_SOURCES = join(MANIFESTS, "staging-sources.json");
const INVENTORY_PATH = join(MANIFESTS, "cc0-inventory.json");

const args = process.argv.slice(2);
const VERIFY_ONLY = args.includes("--verify");
const INVENTORY_ONLY = args.includes("--inventory");

const ARCHIVE_SUFFIXES = [".zip", ".tar.gz", ".tgz"];

function isArchiveSource(source) {
  return ARCHIVE_SUFFIXES.some((suffix) => source.path.endsWith(suffix));
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function verifyZip(source) {
  const fullPath = join(ROOT, source.path);
  if (!existsSync(fullPath)) {
    return { ok: false, reason: "missing", path: fullPath };
  }
  const hash = await sha256File(fullPath);
  if (hash !== source.sha256) {
    return { ok: false, reason: "hash_mismatch", expected: source.sha256, actual: hash };
  }
  return { ok: true };
}

async function extractZip(source) {
  const fullPath = join(ROOT, source.path);
  const packDir = getPackDirectory(source);
  const targetDir = join(EXTRACTED, packDir);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Detect archive type by extension
  if (fullPath.endsWith(".zip")) {
    const zip = await unzipper.Open.file(fullPath);
    await zip.extract({ path: targetDir });
  } else if (fullPath.endsWith(".tar.gz") || fullPath.endsWith(".tgz")) {
    await tarExtract({ file: fullPath, cwd: targetDir });
  }

  return targetDir;
}

function getPackDirectory(source) {
  // El directorio de extracción es dato del registro, no una tabla en este script:
  // `validate-asset-jobs.mjs` confina las rutas de los jobs contra ese mismo valor, y dos
  // copias del mapeo acabarían divergiendo.
  if (!source.extractDir) {
    throw new Error(`${source.id}: falta extractDir en staging-sources.json`);
  }
  return source.extractDir;
}

function scanDirectory(dir, relativeTo) {
  const files = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, relativeTo));
    } else if (entry.isFile()) {
      const stat = statSync(fullPath);
      const relPath = relative(relativeTo, fullPath);
      const ext = entry.name.split(".").pop().toLowerCase();
      files.push({
        path: relPath,
        size: stat.size,
        type: ext,
        name: entry.name,
      });
    }
  }
  return files;
}

async function main() {
  console.log("=== CC0 Pack Extractor ===\n");

  // Load staging sources
  const stagingData = JSON.parse(readFileSync(STAGING_SOURCES, "utf-8"));
  const sources = stagingData.sources;

  console.log(`Found ${sources.length} approved sources in staging-sources.json\n`);

  // Las fuentes obtenidas por clon (integridad git-commit) ya vienen desempaquetadas: no hay ZIP
  // que verificar ni extraer. Su evidencia la valida scripts/validate-art-staging.mjs.
  const archiveSources = sources.filter(isArchiveSource);
  const clonedSources = sources.filter((source) => !isArchiveSource(source));
  if (clonedSources.length > 0) {
    console.log(
      `Skipping ${clonedSources.length} cloned source(s) with no archive: ${clonedSources
        .map((source) => source.id)
        .join(", ")}\n`,
    );
  }

  // Phase 1: Verify all ZIPs
  console.log("Phase 1: Verifying ZIP hashes...");
  const verificationResults = [];
  for (const source of archiveSources) {
    const result = await verifyZip(source);
    verificationResults.push({ id: source.id, ...result });
    if (result.ok) {
      console.log(`  ✓ ${source.id}`);
    } else {
      console.log(`  ✗ ${source.id}: ${result.reason}`);
    }
  }

  const allVerified = verificationResults.every((r) => r.ok);
  if (!allVerified) {
    console.error("\nError: Some ZIPs failed verification. Aborting.");
    process.exit(1);
  }
  console.log("\nAll ZIPs verified.\n");

  if (VERIFY_ONLY) {
    console.log("Verify-only mode. Exiting.");
    return;
  }

  // Phase 2: Extract
  if (!INVENTORY_ONLY) {
    console.log("Phase 2: Extracting packs...");
    for (const source of archiveSources) {
      console.log(`  Extracting ${source.id}...`);
      const targetDir = await extractZip(source);
      console.log(`    → ${relative(ROOT, targetDir)}`);
    }
    console.log("\nExtraction complete.\n");
  }

  // Phase 3: Generate inventory
  console.log("Phase 3: Generating inventory...");
  const inventory = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packs: {},
  };

  for (const source of archiveSources) {
    const packDir = getPackDirectory(source);
    const fullPackDir = join(EXTRACTED, packDir);
    const files = scanDirectory(fullPackDir, EXTRACTED);

    inventory.packs[source.id] = {
      source: source.sourceUrl,
      license: source.license,
      directory: packDir,
      fileCount: files.length,
      files: files,
    };

    console.log(`  ${source.id}: ${files.length} files`);
  }

  writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
  console.log(`\nInventory written to ${relative(ROOT, INVENTORY_PATH)}`);

  // Summary
  const totalFiles = Object.values(inventory.packs).reduce((sum, p) => sum + p.fileCount, 0);
  console.log(`\n=== Summary ===`);
  console.log(`Total packs: ${archiveSources.length}`);
  console.log(`Total files: ${totalFiles}`);
  if (clonedSources.length > 0) {
    console.log(`Cloned sources (no archive): ${clonedSources.length}`);
  }
  console.log(`Inventory: ${relative(ROOT, INVENTORY_PATH)}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Genera evidencia A/B de sombras para WP4.15-V.b2.
 *
 * Renderiza una muestra mínima (1 edificio, 1 árbol, 1 vehículo) con y sin sombras,
 * y compone un contact sheet para comparación visual.
 *
 * Uso:
 *   node scripts/shadow-ab-evidence.mjs
 *
 * Salida:
 *   artifacts/visual-slice/shadow-ab-contact.png
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender");
const BLENDER_SCRIPT = join(REPO_ROOT, "tools", "art-pipeline", "blender", "runtime_asset.py");
const OUTPUT_DIR = join(REPO_ROOT, "artifacts", "visual-slice");

// Muestra mínima: 1 edificio con ventanas, 1 árbol, 1 vehículo
const SAMPLE_ASSETS = [
  {
    id: "bld_residential_a-complete",
    args: [
      "--asset", "bld_residential_a",
      "--state", "complete",
    ],
    label: "Building",
  },
  {
    id: "prp_tree_oak",
    args: [
      "--asset", "prp_tree_oak",
      "--kind", "prop",
      "--source", "glb:blender_artist/staging/third_party/cc0/extracted/nature-kit/models/tree_oak.glb",
      "--unit-scale", "4",
      "--ortho-scale", "1.6",
      "--target-z", "0.65",
      "--render-width", "256",
      "--render-height", "256",
      "--source-id", "src_nature_kit",
      "--license", "CC0-1.0",
    ],
    label: "Tree",
  },
  {
    id: "veh_sedan",
    args: [
      "--asset", "veh_sedan",
      "--kind", "vehicle",
      "--source", "glb:blender_artist/staging/third_party/cc0/extracted/kenney/vehicles/gltf/sedan.glb",
      "--unit-scale", "4",
      "--ortho-scale", "1.6",
      "--target-z", "0.65",
      "--render-width", "256",
      "--render-height", "256",
      "--source-id", "src_kenney_vehicles",
      "--license", "CC0-1.0",
    ],
    label: "Vehicle",
  },
];

function renderAsset(assetId, args, noShadow) {
  const workDir = join(tmpdir(), `landlord-shadow-ab-${assetId}-${noShadow ? "off" : "on"}`);
  mkdirSync(workDir, { recursive: true });
  const outputPng = join(workDir, `${assetId}.png`);
  const outputJson = join(workDir, `${assetId}.json`);

  const cmdArgs = [
    "--background",
    "--python",
    BLENDER_SCRIPT,
    "--",
    ...args,
    "--output",
    outputPng,
    "--metadata",
    outputJson,
  ];
  if (noShadow) cmdArgs.push("--no-shadow");
  else cmdArgs.push("--shadow");

  const result = spawnSync(BLENDER, cmdArgs, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Blender falló para ${assetId} (shadow=${!noShadow}):\n${result.stderr ?? result.stdout}`);
  }
  return { png: outputPng, json: outputJson };
}

function composeContactSheet(pairs) {
  // pairs: [{label, onPng, offPng}]
  const cellWidth = 256;
  const cellHeight = 256;
  const gap = 20;
  const cols = pairs.length;
  const rows = 2; // on, off
  const width = cols * cellWidth + (cols + 1) * gap;
  const height = rows * cellHeight + (rows + 1) * gap + 60; // +60 for labels

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Fondo oscuro
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, width, height);

  pairs.forEach((pair, col) => {
    const x = gap + col * (cellWidth + gap);

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(pair.label, x + cellWidth / 2, 30);

    // Shadow ON
    const onImg = new Image();
    onImg.src = `file://${pair.onPng}`;
    ctx.drawImage(onImg, x, 50, cellWidth, cellHeight);

    // Shadow OFF
    const offImg = new Image();
    offImg.src = `file://${pair.offPng}`;
    ctx.drawImage(offImg, x, 50 + cellHeight + gap, cellWidth, cellHeight);

    // Labels ON/OFF
    ctx.fillStyle = "#00ff00";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SHADOW ON", x + cellWidth / 2, 50 + cellHeight + 15);
    ctx.fillStyle = "#ff0000";
    ctx.fillText("SHADOW OFF", x + cellWidth / 2, 50 + 2 * cellHeight + gap + 15);
  });

  return canvas.toBuffer("image/png");
}

async function main() {
  console.log("Rendering A/B shadow evidence...");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const pairs = [];
  for (const asset of SAMPLE_ASSETS) {
    console.log(`  Rendering ${asset.id} with shadow ON...`);
    const onResult = renderAsset(asset.id, asset.args, false);
    console.log(`  Rendering ${asset.id} with shadow OFF...`);
    const offResult = renderAsset(asset.id, asset.args, true);
    pairs.push({
      label: asset.label,
      onPng: onResult.png,
      offPng: offResult.png,
    });
  }

  console.log("Composing contact sheet...");
  const contactPng = composeContactSheet(pairs);
  const outputPath = join(OUTPUT_DIR, "shadow-ab-contact.png");
  writeFileSync(outputPath, contactPng);
  console.log(`Contact sheet saved to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

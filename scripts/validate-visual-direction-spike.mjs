import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(
  root,
  "blender_artist/manifests/visual-direction-spike-result-2026-10-23.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requiredCoverage = new Set([
  "road",
  "sidewalk",
  "parcel",
  "residential building",
  "industrial building",
  "worker",
  "civilian",
  "vehicle",
  "scaffold",
  "smoke",
  "selection",
  "ownership",
]);

function fail(message) {
  throw new Error(`Visual Direction Spike inválido: ${message}`);
}

function inspectPng(bytes) {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) fail("no es PNG");
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") fail("carece de IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes.readUInt8(24),
    colorType: bytes.readUInt8(25),
  };
}

if (manifest.status !== "approved_baseline") fail(`estado ${manifest.status}`);
if (manifest.recommendation.baseline !== "graphic_civic") fail("baseline inesperada");
if (!Array.from(requiredCoverage).every((item) => manifest.kitCoverage.includes(item))) fail("kit incompleto");

const checked = [];
for (const direction of manifest.directions) {
  for (const relativePath of [direction.render.path, direction.render.runtimePath]) {
    const absolutePath = path.join(root, relativePath);
    const bytes = await readFile(absolutePath);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const png = inspectPng(bytes);
    if (hash !== direction.render.sha256) fail(`${relativePath}: hash distinto`);
    if (png.width !== 1024 || png.height !== 576) fail(`${relativePath}: dimensiones distintas`);
    if (png.bitDepth !== 16 || png.colorType !== 6) fail(`${relativePath}: no es RGBA16`);
    checked.push({ path: relativePath, bytes: bytes.byteLength, ...png, sha256: hash });
  }
}

await readFile(path.join(root, manifest.pipeline.source));
console.log(
  JSON.stringify(
    {
      status: "passed",
      baseline: manifest.recommendation.baseline,
      directions: manifest.directions.length,
      checked,
    },
    null,
    2,
  ),
);

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const manifestUrl = new URL("../blender_artist/manifests/staging-sources.json", import.meta.url);
const kitUrl = new URL(
  "../blender_artist/manifests/visual-direction-spike-kit.json",
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const kit = JSON.parse(await readFile(kitUrl, "utf8"));
const sourceIds = new Set();
const errors = [];

for (const source of manifest.sources) {
  if (!/^src_[a-z0-9_]+$/.test(source.id)) errors.push(`Invalid source id: ${source.id}`);
  if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  if (!source.path.startsWith("blender_artist/staging/third_party/cc0/")) {
    errors.push(`Approved source outside CC0 staging: ${source.path}`);
  }
  if (source.license !== "CC0-1.0" || !source.sourceUrl || !source.verification) {
    errors.push(`Incomplete provenance: ${source.id}`);
  }
  const fileUrl = new URL(`../${source.path}`, import.meta.url);
  try {
    const bytes = await readFile(fileUrl);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== source.sha256) errors.push(`Checksum mismatch: ${source.id}`);
  } catch {
    errors.push(`Missing staged source: ${source.path}`);
  }
}

const assetIds = new Set();
for (const asset of kit.assets) {
  if (!/^(ter|bld|chr|veh|prp|vfx|ui|ico)_[a-z0-9_]+$/.test(asset.assetId)) {
    errors.push(`Invalid asset id: ${asset.assetId}`);
  }
  if (assetIds.has(asset.assetId)) errors.push(`Duplicate asset id: ${asset.assetId}`);
  assetIds.add(asset.assetId);
  for (const input of asset.inputs)
    if (!sourceIds.has(input)) errors.push(`Unknown asset input ${input} in ${asset.assetId}`);
}

for (const reference of kit.generatedReferences ?? []) {
  if (reference.origin !== "generated" || !reference.generator || !reference.usage) {
    errors.push(`Incomplete generated-reference provenance: ${reference.path}`);
  }
  try {
    const bytes = await readFile(new URL(`../${reference.path}`, import.meta.url));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== reference.sha256) errors.push(`Checksum mismatch: ${reference.path}`);
  } catch {
    errors.push(`Missing generated reference: ${reference.path}`);
  }
}

try {
  await access(new URL("../constructor_1y2", import.meta.url));
  if (
    JSON.stringify(manifest).includes("constructor_1y2") ||
    JSON.stringify(kit).includes("constructor_1y2")
  ) {
    errors.push("Forbidden reference-game path appears in art metadata");
  }
} catch {
  // The reference directory is optional; it is never an art-pipeline input.
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${manifest.sources.length} approved sources and ${kit.assets.length} original asset briefs.`,
  );
}

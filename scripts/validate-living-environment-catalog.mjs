#!/usr/bin/env node
import { readFileSync } from "node:fs";

const index = JSON.parse(readFileSync("blender_artist/manifests/world-asset-index.json", "utf8"));
const catalog = JSON.parse(
  readFileSync("blender_artist/manifests/living-environment-catalog.json", "utf8"),
);
const jobs = JSON.parse(readFileSync("blender_artist/manifests/asset-jobs.json", "utf8"));
const assets = new Map(index.assets.map((asset) => [asset.assetId, asset]));
const published = new Set(
  jobs.jobs.filter((job) => job.target === "bundle").map((job) => job.assetId),
);
const errors = [];
for (const entry of catalog.candidates ?? []) {
  const source = assets.get(entry.sourceAssetId);
  if (!source) errors.push(`${entry.sourceAssetId}: ausente del índice`);
  else {
    if (!source.license || !source.sourceId || !source.sourcePath)
      errors.push(`${entry.sourceAssetId}: provenance incompleta`);
    if (
      source.qualityTier === "unmeasured" &&
      entry.status === "approved" &&
      !source.sourcePath.endsWith(".fbx")
    )
      errors.push(`${entry.sourceAssetId}: geometría sin medir`);
  }
  if (entry.status === "approved" && !published.has(entry.runtimeAssetId))
    errors.push(`${entry.runtimeAssetId}: sin job runtime`);
}
if ((catalog.inventory?.absentFromLocalPackages ?? []).length === 0)
  errors.push("faltan ausencias documentadas");
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  JSON.stringify({
    status: "passed",
    candidates: catalog.candidates.length,
    absent: catalog.inventory.absentFromLocalPackages.length,
  }),
);

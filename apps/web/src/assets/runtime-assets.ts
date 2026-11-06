import { parseRuntimeAssetManifest, validateRuntimeAssetManifestV2 } from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";
import runtimeVisualOverrides from "../generated/runtime-visual-overrides.json";

export const PROCEDURAL_ASSETS = parseRuntimeAssetManifest(runtimeAssets);
const RAW_BLENDER_ASSETS = parseRuntimeAssetManifest(runtimeAssetsBlender);
const LEGACY_GAMEPLAY_EXCLUSIONS = new Set(runtimeVisualOverrides.legacyGameplayExclusions);

/**
 * The raw bundle remains available as generated evidence, but gameplay never consumes the early
 * residential/commercial placeholders. Only reviewed Composer overrides are merged back.
 */
export const BLENDER_ASSETS = {
  ...RAW_BLENDER_ASSETS,
  buildings: {
    ...Object.fromEntries(
      Object.entries(RAW_BLENDER_ASSETS.buildings).filter(
        ([assetId]) => !LEGACY_GAMEPLAY_EXCLUSIONS.has(assetId),
      ),
    ),
    ...runtimeVisualOverrides.buildings,
  },
} as unknown as typeof RAW_BLENDER_ASSETS;

const blenderIssues = validateRuntimeAssetManifestV2(BLENDER_ASSETS);
if (blenderIssues.length > 0) {
  throw new Error(
    `El bundle Blender curado no cumple RuntimeAssetManifestV2: ${blenderIssues.join(" | ")}`,
  );
}

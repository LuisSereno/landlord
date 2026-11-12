import { parseRuntimeAssetManifest, validateRuntimeAssetManifestV2 } from "@landlord/shared";
import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";
import runtimeAssetsBlenderDay from "../generated/runtime-assets-blender-day.json";
import runtimeVisualOverrides from "../generated/runtime-visual-overrides.json";
import { readVisualMood } from "../visual-mood";

export const PROCEDURAL_ASSETS = parseRuntimeAssetManifest(runtimeAssets);
const RAW_BLENDER_ASSETS = parseRuntimeAssetManifest(runtimeAssetsBlender);
const RAW_BLENDER_ASSETS_DAY = parseRuntimeAssetManifest(runtimeAssetsBlenderDay);
const LEGACY_GAMEPLAY_EXCLUSIONS = new Set(runtimeVisualOverrides.legacyGameplayExclusions);

/**
 * The raw bundle remains available as generated evidence, but gameplay never consumes the early
 * residential/commercial placeholders. Only reviewed Composer overrides are merged back.
 */
function curatedBlenderAssets(raw: typeof RAW_BLENDER_ASSETS, includeNightOverrides: boolean) {
  return {
    ...raw,
    buildings: {
      ...Object.fromEntries(
        Object.entries(raw.buildings).filter(
          ([assetId]) => !LEGACY_GAMEPLAY_EXCLUSIONS.has(assetId),
        ),
      ),
      ...(includeNightOverrides ? runtimeVisualOverrides.buildings : {}),
    },
  } as unknown as typeof RAW_BLENDER_ASSETS;
}

const NIGHT_BLENDER_ASSETS = curatedBlenderAssets(RAW_BLENDER_ASSETS, true);
const DAY_BLENDER_ASSETS = curatedBlenderAssets(RAW_BLENDER_ASSETS_DAY, false);

/** La preferencia es de presentación: el proxy elige bundle sin tocar estado de dominio. */
export const BLENDER_ASSETS = new Proxy(NIGHT_BLENDER_ASSETS, {
  get(_target, property) {
    return (readVisualMood() === "day" ? DAY_BLENDER_ASSETS : NIGHT_BLENDER_ASSETS)[
      property as keyof typeof NIGHT_BLENDER_ASSETS
    ];
  },
}) as typeof NIGHT_BLENDER_ASSETS;

for (const [mood, assets] of Object.entries({
  night: NIGHT_BLENDER_ASSETS,
  day: DAY_BLENDER_ASSETS,
})) {
  const blenderIssues = validateRuntimeAssetManifestV2(assets);
  if (blenderIssues.length > 0) {
    throw new Error(
      `El bundle Blender ${mood} no cumple RuntimeAssetManifestV2: ${blenderIssues.join(" | ")}`,
    );
  }
}

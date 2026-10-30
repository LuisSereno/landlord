import { parseRuntimeAssetManifest, type RuntimeAssetManifestV2 } from "@landlord/shared";

import runtimeAssets from "../generated/runtime-assets.json";
import runtimeAssetsBlender from "../generated/runtime-assets-blender.json";

/**
 * Bundles de assets parseados una sola vez. El renderer y las miniaturas de la UI comparten la
 * misma instancia: la miniatura no mantiene una colección paralela, sólo lee el frame `complete`
 * del mismo contrato (`RuntimeAssetManifestV2`). Si mañana Blender sustituye un tipo, la escena y
 * la miniatura cambian juntas (spec §7.2).
 */
export const PROCEDURAL_ASSETS: RuntimeAssetManifestV2 = parseRuntimeAssetManifest(runtimeAssets);
export const BLENDER_ASSETS: RuntimeAssetManifestV2 =
  parseRuntimeAssetManifest(runtimeAssetsBlender);

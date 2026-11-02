#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";

const check = process.argv.includes("--check");
const runtime = JSON.parse(readFileSync("apps/web/src/generated/runtime-assets.json", "utf8"));
const factory = JSON.parse(readFileSync("blender_artist/manifests/building-factory.json", "utf8"));
const characters = JSON.parse(
  readFileSync("blender_artist/manifests/character-factory.json", "utf8"),
);
const world = JSON.parse(readFileSync("blender_artist/manifests/world-asset-catalog.json", "utf8"));
const outputPath = "apps/web/src/generated/visual-catalog.json";
const sha = (path) =>
  createHash("sha256")
    .update(path.startsWith("data:") ? path : readFileSync(`apps/web/public${path}`))
    .digest("hex");
const buildings = factory.buildings.map((preset) => {
  const asset = runtime.buildings[preset.id];
  if (!asset) throw new Error(`${preset.id}: missing runtime representation`);
  const hashes = Object.fromEntries(
    Object.entries(asset.states).map(([state, image]) => [state, sha(image.src)]),
  );
  return {
    id: preset.id,
    displayName: asset.name,
    category:
      preset.facadePreset.includes("civic") ||
      ["clinic", "police_station", "fire_station", "school_block"].includes(preset.id)
        ? "civic"
        : ["workshop", "warehouse", "cement_plant", "brickworks", "steelworks"].includes(preset.id)
          ? "industrial"
          : ["mixed_tenement", "market_hall"].includes(preset.id)
            ? "mixed"
            : "residential",
    footprint: preset.footprint,
    floors: preset.floorCount,
    source: preset.baseSource,
    status: "candidate",
    states: asset.states,
    duplicateStates: Object.keys(hashes).filter(
      (state, index, all) => all.findIndex((other) => hashes[other] === hashes[state]) !== index,
    ),
  };
});
const payload = {
  schemaVersion: 1,
  buildings,
  characters: characters.characters,
  characterAnimations: {
    runtime: characters.runtimeAnimations,
    showcase: characters.showcaseAnimations,
  },
  world,
  coverage: {
    buildings: `${buildings.length}/15`,
    buildingStates: `${buildings.length * 4}/60`,
    characterRoles: `${characters.characters.length}/13`,
    animations: `${characters.runtimeAnimations.length}/2`,
    vehicles: `${world.vehicles.length}/6`,
    props: world.props.length,
    terrain: world.terrain.length,
    purchaseGaps: 0,
  },
};
const serialized = await format(JSON.stringify(payload), { parser: "json", printWidth: 100 });
if (check) {
  if (readFileSync(outputPath, "utf8") !== serialized)
    throw new Error("visual-catalog.json is stale");
  console.log(JSON.stringify(payload.coverage));
} else {
  writeFileSync(outputPath, serialized);
  console.log(`Generated ${outputPath}`);
}

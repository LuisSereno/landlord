#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";

const check = process.argv.includes("--check");
const runtime = JSON.parse(readFileSync("apps/web/src/generated/runtime-assets.json", "utf8"));
const buildingCatalog = JSON.parse(
  readFileSync("blender_artist/manifests/building-catalog.json", "utf8"),
);
const characters = JSON.parse(
  readFileSync("blender_artist/manifests/character-factory.json", "utf8"),
);
const world = JSON.parse(readFileSync("blender_artist/manifests/world-asset-catalog.json", "utf8"));
const evidence = JSON.parse(readFileSync("apps/web/src/generated/building-evidence.json", "utf8"));
const outputPath = "apps/web/src/generated/visual-catalog.json";
const sha = (path) =>
  createHash("sha256")
    .update(path.startsWith("data:") ? path : readFileSync(`apps/web/public${path}`))
    .digest("hex");
const buildings = buildingCatalog.buildings.map((entry) => {
  const asset = runtime.buildings[entry.id];
  if (!asset) throw new Error(`${entry.id}: missing runtime representation`);
  const rendered = evidence.buildings[entry.id];
  if (!rendered)
    throw new Error(`${entry.id}: missing evidence render; run pnpm art:building-evidence:render`);
  const hashes = Object.fromEntries(
    Object.entries(rendered.states).map(([state, image]) => [state, sha(image.src)]),
  );
  return {
    id: entry.id,
    displayName: asset.name,
    category: entry.category,
    footprint: entry.footprint,
    floors: entry.floorCount,
    source: entry.sourceLabel,
    status: entry.mode === "imported" ? "candidate-evidence" : "runtime-bundle",
    states: rendered.states,
    duplicateStates: Object.keys(hashes).filter(
      (state, index, all) => all.findIndex((other) => hashes[other] === hashes[state]) !== index,
    ),
  };
});
const payload = {
  schemaVersion: 1,
  buildings,
  characters: characters.characters,
  characterPreview: runtime.characters.vecino_variante.animations.idle.frames[0].src,
  characterAnimations: {
    runtime: characters.runtimeAnimations,
    showcase: characters.showcaseAnimations,
  },
  world,
  coverage: {
    buildings: `${buildings.length}/15`,
    buildingStates: `${buildings.reduce((total, b) => total + Object.keys(b.states).length, 0)}/60`,
    stateConditioning: "pendiente: la geometría importada sólo renderiza complete",
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

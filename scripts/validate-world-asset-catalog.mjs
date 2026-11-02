#!/usr/bin/env node
import { readFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync("blender_artist/manifests/world-asset-catalog.json", "utf8"),
);
const requiredVehicles = ["sedan", "taxi", "delivery_truck", "police_vehicle", "service_vehicle"];
const requiredProps = [
  "trees",
  "street_lights",
  "traffic_lights",
  "benches",
  "trash",
  "hydrant_service",
  "signage",
  "crates",
  "barrels",
  "pallets",
  "construction_barriers",
  "cones",
  "industrial_clutter",
  "park_props",
  "market_props",
];
const requiredTerrain = [
  "road_straight",
  "road_corner",
  "intersection",
  "sidewalk",
  "residential_ground",
  "commercial_civic_paving",
  "industrial_yard",
  "park_grass",
  "park_path",
  "construction_dirt",
  "plaza_paving",
];
const missing = [];
for (const id of requiredVehicles)
  if (!catalog.vehicles.some((x) => x.id === id)) missing.push(`vehicle:${id}`);
for (const id of requiredProps)
  if (!catalog.props.some((x) => x.category === id)) missing.push(`prop:${id}`);
for (const id of requiredTerrain)
  if (!catalog.terrain.some((x) => x.id === id)) missing.push(`terrain:${id}`);
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(
  `World catalog PASS: ${catalog.vehicles.length} vehicles, ${catalog.props.length} prop categories, ${catalog.terrain.length} terrain treatments.`,
);

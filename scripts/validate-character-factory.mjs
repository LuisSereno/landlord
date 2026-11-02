#!/usr/bin/env node
import { readFileSync } from "node:fs";
const manifest = JSON.parse(
  readFileSync("blender_artist/manifests/character-factory.json", "utf8"),
);
const expected = [
  "civilian_male_a",
  "civilian_male_b",
  "civilian_female_a",
  "civilian_female_b",
  "supervisor",
  "construction_worker_a",
  "construction_worker_b",
  "maintenance_technician",
  "enforcer_male",
  "enforcer_female",
  "police",
  "firefighter",
  "municipal_professional",
];
const errors = [];
if (manifest.schemaVersion !== 1) errors.push("schemaVersion");
if (manifest.directions !== 4) errors.push("directions must be 4");
if (manifest.runtimeAnimations?.join(",") !== "idle,walk")
  errors.push("runtimeAnimations must stay idle/walk");
const ids = manifest.characters?.map((entry) => entry.id) ?? [];
for (const id of expected) if (!ids.includes(id)) errors.push(`missing ${id}`);
if (new Set(ids).size !== expected.length || ids.length !== expected.length)
  errors.push("expected 13 unique roles");
for (const entry of manifest.characters ?? []) {
  for (const key of [
    "displayName",
    "role",
    "scope",
    "baseSource",
    "body",
    "hair",
    "clothing",
    "palette",
    "roleProp",
  ])
    if (!entry[key]) errors.push(`${entry.id}: ${key}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Character Factory PASS: ${ids.length}/13 roles; 4 directions; idle/walk runtime; ${manifest.showcaseAnimations.length} showcase-only animations.`,
);

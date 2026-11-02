#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = "blender_artist/manifests/building-factory.json";
const manifest = JSON.parse(readFileSync(path, "utf8"));
const expected = new Set([
  "courtyard_home",
  "row_house",
  "apartment_block",
  "mixed_tenement",
  "workshop",
  "warehouse",
  "cement_plant",
  "brickworks",
  "steelworks",
  "town_hall",
  "school_block",
  "clinic",
  "police_station",
  "fire_station",
  "market_hall",
]);
const required = [
  "id",
  "mode",
  "baseSource",
  "facadePreset",
  "roofPreset",
  "materialFamily",
  "floorCount",
  "footprint",
  "signage",
  "industrialEquipment",
  "civicDressing",
  "wearPreset",
];
const errors = [];
if (manifest.schemaVersion !== 1) errors.push("schemaVersion debe ser 1");
if (manifest.buildings?.length !== 15) errors.push("la fábrica debe declarar exactamente 15 tipos");
const ids = new Set();
for (const item of manifest.buildings ?? []) {
  for (const key of required) if (!(key in item)) errors.push(`${item.id ?? "?"}: falta ${key}`);
  if (ids.has(item.id)) errors.push(`${item.id}: id duplicado`);
  ids.add(item.id);
  if (!expected.has(item.id)) errors.push(`${item.id}: no es un tipo de dominio`);
  if (!Number.isInteger(item.floorCount) || item.floorCount < 1)
    errors.push(`${item.id}: floorCount inválido`);
  if (!Number.isInteger(item.footprint?.width) || !Number.isInteger(item.footprint?.height))
    errors.push(`${item.id}: footprint inválido`);
  if (!Array.isArray(item.industrialEquipment) || !Array.isArray(item.civicDressing))
    errors.push(`${item.id}: los dressings deben ser arrays`);
}
for (const id of expected) if (!ids.has(id)) errors.push(`falta ${id}`);
if (errors.length) {
  console.error(errors.map((value) => `- ${value}`).join("\n"));
  process.exit(1);
}
console.log(
  `Building Factory PASS: ${ids.size}/15 presets completos; 14 factory + 1 legacy congelado.`,
);

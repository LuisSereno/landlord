#!/usr/bin/env node
/** Contract correction executed after vh-visual-remediation.mjs. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(ROOT, "apps/web/src/generated/runtime-visual-overrides.json");
const document = JSON.parse(readFileSync(target, "utf8"));

const provenance = (sourceId, notes) => ({
  license: "CC0-1.0",
  author: "Landlord Building Composer",
  sourceId,
  notes,
});

document.buildings.courtyard_home = {
  type: "courtyard_home",
  name: "Casa con patio V.g",
  states: document.buildings.courtyard_home.states,
  footprint: { width: 2, height: 2 },
  domainFootprint: { width: 2, height: 2 },
  pivot: { x: 0.6692, y: 0.6465 },
  allowedOrientations: [45],
  symmetry: "none",
  pixelsPerMeter: 30.1,
  stateFallback: "procedural",
  provenance: provenance(
    "building_composer:vg_courtyard_home_1002",
    "Candidato V.g curado; los estados no publicados vuelven al procedural semántico.",
  ),
};

document.buildings.town_hall = {
  type: "town_hall",
  name: "Ayuntamiento cívico con cubierta inclinada",
  states: document.buildings.town_hall.states,
  footprint: { width: 4, height: 3 },
  domainFootprint: { width: 8, height: 4 },
  pivot: { x: 0.4612, y: 0.8324 },
  allowedOrientations: [45],
  symmetry: "none",
  pixelsPerMeter: 15.05,
  stateFallback: "procedural",
  provenance: provenance(
    "building_composer:vf_town_hall_1000_roofed",
    "Variante cívica con gable_dormers restaurada tras la regresión de cubierta plana V7.",
  ),
};

writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "runtime-visual-overrides-contract-fixed" }));

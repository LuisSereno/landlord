#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const domainIds = [
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
];
const jobIds = ["bld_courtyard_home", ...domainIds.slice(1).map((id) => `bld_${id}_factory`)];
const output = resolve("blender_artist/generated/ve2-buildings");
mkdirSync(output, { recursive: true });

const render = spawnSync(
  process.execPath,
  ["scripts/build-blender-assets.mjs", `--only=${jobIds.join(",")}`, `--outDir=${output}`],
  { stdio: "inherit" },
);
if (render.status !== 0) process.exit(render.status ?? 1);

const inputs = domainIds.map((id) => `${output}/${id}-complete.png`);
for (const input of inputs) {
  if (!existsSync(input)) throw new Error(`Falta el render complete: ${input}`);
}
const sheet = `${output}/complete-silhouettes-unlabelled.png`;
const montage = spawnSync(
  "montage",
  [...inputs, "-background", "#182027", "-geometry", "260x240+12+12", "-tile", "5x3", sheet],
  { stdio: "inherit" },
);
if (montage.status !== 0) process.exit(montage.status ?? 1);
const states = ["complete", "construction", "damaged", "burning"];
const stateInputs = domainIds.flatMap((id) =>
  states.map((state) => `${output}/${id}-${state}.png`),
);
for (const id of domainIds) {
  const hashes = states.map((state) =>
    createHash("sha256")
      .update(readFileSync(`${output}/${id}-${state}.png`))
      .digest("hex"),
  );
  if (new Set(hashes).size !== states.length) throw new Error(`${id}: estados visuales duplicados`);
}
const statesSheet = `${output}/all-building-states.png`;
const statesMontage = spawnSync(
  "montage",
  [
    ...stateInputs,
    "-background",
    "#182027",
    "-geometry",
    "170x150+8+8",
    "-tile",
    "4x15",
    statesSheet,
  ],
  { stdio: "inherit" },
);
if (statesMontage.status !== 0) process.exit(statesMontage.status ?? 1);
console.log(
  JSON.stringify({ status: "passed", buildings: domainIds.length, states: 60, sheet, statesSheet }),
);

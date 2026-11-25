#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const factory = JSON.parse(
  readFileSync(resolve(repoRoot, "blender_artist/manifests/character-factory.json"), "utf8"),
);
const generated = JSON.parse(
  readFileSync(resolve(repoRoot, "apps/web/src/generated/visual-catalog.json"), "utf8"),
);
const errors = [];
const factoryIds = factory.characters.map((entry) => entry.id).sort();
const generatedIds = generated.characters.map((entry) => entry.id).sort();
const operational = factory.characters.filter((entry) => entry.category === "operational");
const runtimeExisting = factory.characters.filter((entry) => entry.runtimeReady);

if (factory.characters.length !== 14) errors.push("Character Factory must contain 14 variants");
if (operational.length !== 6) errors.push("Character Factory must contain 6 operational variants");
if (runtimeExisting.length !== 5)
  errors.push("Character Factory must contain 5 runtime-existing mappings");
if (generated.characters.length !== 14) {
  errors.push(
    `Generated visual catalog contains ${generated.characters.length} characters, expected 14`,
  );
}
for (const id of factoryIds) {
  if (!generatedIds.includes(id)) errors.push(`Generated visual catalog is missing ${id}`);
}
for (const id of generatedIds) {
  if (!factoryIds.includes(id)) errors.push(`Generated visual catalog has unknown character ${id}`);
}
if (generated.coverage?.characterDefinitions !== "14/14") {
  errors.push(
    `characterDefinitions is ${generated.coverage?.characterDefinitions ?? "missing"}, expected 14/14`,
  );
}
if (generated.coverage?.characterRenderedRoles !== "0/14") {
  errors.push(
    `characterRenderedRoles is ${generated.coverage?.characterRenderedRoles ?? "missing"}, expected 0/14 until previews are integrated`,
  );
}

if (errors.length) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        factoryVariants: factory.characters.length,
        generatedVariants: generated.characters.length,
        operationalVariants: operational.length,
        runtimeExistingMappings: runtimeExisting.length,
        errors,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  console.log(
    "Character catalog coherence PASS: 14 definitions, 6 operational, 5 runtime-existing mappings, coverage 14/14 and 0/14 previews.",
  );
}

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
const legacyMappings = factory.characters.filter(
  (entry) => entry.runtimeMappingStatus === "legacy",
);
const candidates = factory.characters.filter((entry) => entry.productionStatus === "candidate");
const runtimeReady = factory.characters.filter((entry) => entry.runtimeReady);
const characterCount = factory.characters.length;

if (characterCount !== 14) errors.push("Character Factory must contain 14 variants");
if (operational.length !== 6) errors.push("Character Factory must contain 6 operational variants");
if (legacyMappings.length !== 5)
  errors.push("Character Factory must contain 5 explicit legacy runtime mappings");
if (candidates.length !== 14) errors.push("All 14 variants must be Kenney candidates");
if (runtimeReady.length !== 0) errors.push("Kenney candidates must not be runtime-ready");
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
const expectedDefinitions = `${characterCount}/${characterCount}`;
const expectedRendered = `0/${characterCount}`;
if (generated.coverage?.characterDefinitions !== expectedDefinitions) {
  errors.push(
    `characterDefinitions is ${generated.coverage?.characterDefinitions ?? "missing"}, expected ${expectedDefinitions}`,
  );
}
if (generated.coverage?.characterRenderedRoles !== expectedRendered) {
  errors.push(
    `characterRenderedRoles is ${generated.coverage?.characterRenderedRoles ?? "missing"}, expected ${expectedRendered} until previews are integrated`,
  );
}
for (const entry of factory.characters) {
  const generatedEntry = generated.characters.find((candidate) => candidate.id === entry.id);
  if (JSON.stringify(generatedEntry) !== JSON.stringify(entry)) {
    errors.push(`Generated character entry is stale for ${entry.id}`);
  }
}

if (errors.length) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        factoryVariants: factory.characters.length,
        generatedVariants: generated.characters.length,
        operationalVariants: operational.length,
        candidateVariants: candidates.length,
        legacyRuntimeMappings: legacyMappings.length,
        runtimeReadyVariants: runtimeReady.length,
        errors,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Character catalog coherence PASS: ${characterCount} Kenney candidate definitions, ${operational.length} operational, ${legacyMappings.length} explicit legacy runtime mappings, ${runtimeReady.length} runtime-ready, coverage ${expectedDefinitions} and ${expectedRendered} previews.`,
  );
}

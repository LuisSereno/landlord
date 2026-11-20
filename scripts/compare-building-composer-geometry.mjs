#!/usr/bin/env node
/** Verify D-111 A/B changes only treatment, not geometry, seed, camera contract or footprint. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.replace(/^--/u, "").split("=");
    return [key, rest.join("=")];
  }),
);
if (!args.control || !args.candidate || !args.out) {
  throw new Error("uso: node scripts/compare-building-composer-geometry.mjs --control=dir --candidate=dir --out=file");
}
const read = (dir, type) =>
  JSON.parse(readFileSync(resolve(dir, `d111_${type}_1010.json`), "utf8"));
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const types = ["row_house", "mixed_tenement", "warehouse"];
const comparisons = types.map((type) => {
  const control = read(args.control, type);
  const candidate = read(args.candidate, type);
  for (const field of ["buildingType", "variantSeed", "orientation", "footprintCells", "footprintMeters", "floors", "volumes", "axisChoices", "transforms"]) {
    if (JSON.stringify(control[field]) !== JSON.stringify(candidate[field])) {
      throw new Error(`${type}: A/B cambió ${field}; no es comparación de tratamiento aislada`);
    }
  }
  const geometry = control.transforms.map(({ moduleId, position, rotationDegrees, purpose, mirrorX }) => ({
    moduleId, position, rotationDegrees, purpose, mirrorX: Boolean(mirrorX),
  }));
  return {
    buildingType: type,
    variantSeed: 1010,
    control: {styleProfileId: control.styleProfileId, moodId: control.moodId, sha256: control.sha256},
    candidate: {styleProfileId: candidate.styleProfileId, moodId: candidate.moodId, sha256: candidate.sha256},
    compositionSignature: {control: control.compositionSignature, candidate: candidate.compositionSignature},
    geometryTransformSha256: digest(geometry),
    transforms: geometry.length,
    sameGeometry: true,
  };
});
const report = {
  schemaVersion: 1,
  purpose: "D-111 controlled geometry A/B: same seed, dimensions, axes and placed modules; material/render treatment differs",
  controlDirectory: args.control,
  candidateDirectory: args.candidate,
  comparisons,
};
const output = resolve(args.out);
mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({status: "same-geometry", candidates: comparisons.length, transforms: comparisons.map((x) => [x.buildingType, x.transforms])}));

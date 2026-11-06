#!/usr/bin/env node
/** Type-level completion for the V.h remediation output. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(ROOT, "apps/web/src/isometric/gameplay-visual-adapter.ts");
let source = readFileSync(path, "utf8");

// GameplayParkedVehicle and every compatible context vehicle must expose both road axes.
source = source.replaceAll(
  "  azimuth: 45 | 225;",
  "  azimuth: 45 | 135 | 225 | 315;",
);

// `roadVisuals.filter(shape === straight)` is a runtime invariant, but TypeScript does not refine
// the orientation discriminant through the array callback. Accept the full union and fail closed.
source = source.replace(
  `export function vehicleAzimuthForRoad(
  orientation: "straight_ns" | "straight_ew",
  reverse: boolean,
): 45 | 135 | 225 | 315 {
  if (orientation === "straight_ns") return reverse ? 315 : 135;
  return reverse ? 225 : 45;
}`,
  `export function vehicleAzimuthForRoad(
  orientation: RoadOrientation,
  reverse: boolean,
): 45 | 135 | 225 | 315 {
  if (orientation === "straight_ns") return reverse ? 315 : 135;
  if (orientation === "straight_ew") return reverse ? 225 : 45;
  throw new Error(\`vehicleAzimuthForRoad requiere una vía recta, recibió: \${orientation}\`);
}`,
);

if (!source.includes("azimuth: 45 | 135 | 225 | 315;")) {
  throw new Error("[vh-remediation-typefix] no se amplió el contrato de azimut");
}
if (!source.includes("orientation: RoadOrientation")) {
  throw new Error("[vh-remediation-typefix] no se amplió el contrato de orientación vial");
}
writeFileSync(path, source, "utf8");
console.log(JSON.stringify({ status: "vh-remediation-type-contracts-fixed" }));

#!/usr/bin/env node
/** Uses the map bounds carried by contextual planners instead of leaving dead API parameters. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(ROOT, "apps/web/src/isometric/gameplay-visual-adapter.ts");
let source = readFileSync(path, "utf8");

for (const [signature, returnType] of [
  ["export function planGameplayContextVehicles(", "GameplayContextVehicle[]"],
  ["export function planGameplayContextActors(", "GameplayContextActor[]"],
]) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`[vh-remediation-lintfix] falta ${signature}`);
  const bodyMarker = `): ${returnType} {`;
  const body = source.indexOf(bodyMarker, start);
  if (body < 0) throw new Error(`[vh-remediation-lintfix] falta cuerpo ${signature}`);
  const insertionPoint = body + bodyMarker.length;
  const guard = "\n  if (mapWidth <= 0 || mapHeight <= 0) return [];";
  if (!source.slice(insertionPoint, insertionPoint + guard.length + 4).includes(guard.trim())) {
    source = `${source.slice(0, insertionPoint)}${guard}${source.slice(insertionPoint)}`;
  }
}

writeFileSync(path, source, "utf8");
console.log(JSON.stringify({ status: "vh-remediation-map-bounds-guards-added" }));

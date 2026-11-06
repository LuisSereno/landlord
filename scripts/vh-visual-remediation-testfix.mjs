#!/usr/bin/env node
/** Updates tests whose former purpose was to preserve the now-rejected legacy archetype pools. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(ROOT, "apps/web/src/isometric/gameplay-visual-adapter.test.ts");
let source = readFileSync(path, "utf8");

const beforeResidential = `  it("asigna un archetype estable por identidad de edificio", () => {
    const a = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    const b = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    expect(a).toBe(b);
    expect([
      "bld_residential_a",
      "bld_residential_b",
      "bld_residential_c",
      "courtyard_home",
    ]).toContain(a);
  });`;
const afterResidential = `  it("asigna el Composer aprobado a courtyard_home sin mezclar casas heredadas", () => {
    const a = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    const b = visualArchetypeForBuilding("courtyard_home", "bld_00000007");
    expect(a).toBe("courtyard_home");
    expect(b).toBe(a);
  });`;

const beforeWorkshop = `  it("resuelve workshop a un archetype comercial compatible", () => {
    const archetype = visualArchetypeForBuilding("workshop", "bld_00000042");
    expect(["bld_shopfront", "bld_commercial_b", "bld_commercial_c"]).toContain(archetype);
  });`;
const afterWorkshop = `  it("mantiene workshop en su fallback procedural semántico exacto", () => {
    expect(visualArchetypeForBuilding("workshop", "bld_00000042")).toBe("workshop");
  });`;

for (const [before, after, label] of [
  [beforeResidential, afterResidential, "courtyard_home"],
  [beforeWorkshop, afterWorkshop, "workshop"],
]) {
  if (source.includes(after)) continue;
  if (!source.includes(before)) throw new Error(`[vh-remediation-testfix] falta test ${label}`);
  source = source.replace(before, after);
}

writeFileSync(path, source, "utf8");
console.log(JSON.stringify({ status: "vh-remediation-tests-updated" }));

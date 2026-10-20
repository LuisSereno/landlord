import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repositoryRoot =
  process.env.ARCHITECTURE_CHECK_ROOT ?? new URL("..", import.meta.url).pathname;

const forbiddenImports = [
  '"react"',
  '"react-dom"',
  '"phaser"',
  '"idb"',
  '"fake-indexeddb"',
  "@landlord/web",
];

const forbiddenGlobals = /\b(document|window|indexedDB|localStorage|sessionStorage|fetch|crypto)\b/;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [absolute] : [];
  });
}

const violations = [];

for (const [packageName, packageDirectory] of [
  ["simulation", join(repositoryRoot, "packages/simulation/src")],
  ["shared", join(repositoryRoot, "packages/shared/src")],
]) {
  for (const file of sourceFiles(packageDirectory)) {
    const content = readFileSync(file, "utf8");
    const display = relative(repositoryRoot, file);

    if (packageName === "simulation") {
      for (const forbiddenImport of forbiddenImports) {
        if (
          content.includes(`from ${forbiddenImport}`) ||
          content.includes(`import(${forbiddenImport}`)
        ) {
          violations.push(`${display}: forbidden import ${forbiddenImport}`);
        }
      }
      if (forbiddenGlobals.test(content)) {
        violations.push(`${display}: forbidden browser global`);
      }
    }

    if (
      packageName === "shared" &&
      /@landlord\/(simulation|web)|from ["']\.\.\/simulation/.test(content)
    ) {
      violations.push(`${display}: shared cannot depend on simulation or web`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries pass for simulation and shared.");
}

#!/usr/bin/env node
/**
 * Guarda de licencias de terceros sobre lo que realmente se publica (WP4.15-V.a 〔R1〕, D-083).
 *
 * `art:staging:validate` mira el staging; este script mira los manifiestos runtime generados y
 * cruza cada procedencia declarada contra el registro de fuentes y el allowlist. Cubre el hueco
 * que deja un `provenance` escrito a mano: que un asset MIT se declare CC0 en el bundle, o que
 * desaparezca la evidencia de atribución que la licencia exige.
 *
 * Uso: node scripts/check-third-party-license.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GENERATED_DIR = "apps/web/src/generated";
const ALLOWLIST_PATH = "blender_artist/manifests/license-allowlist.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
const registry = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
const allowed = new Set(allowlist.allowed);
const denied = new Set(allowlist.denied);
const needsAttribution = new Set(allowlist.attributionRequiredFor);
const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));

const errors = [];

/**
 * 〔R1〕 No-deriva: el enum de Zod y el allowlist versionado tienen que ser la misma lista. Se
 * compara leyendo la fuente TS porque `packages/shared` se typechea sin tipos de Node a propósito
 * y por tanto sus tests no pueden tocar el sistema de ficheros.
 */
function literalsFromTs(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`));
  if (!match) {
    errors.push(`no se encuentra "export const ${name} = [...]" en assets.ts: ¿cambió de forma?`);
    return [];
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((found) => found[1]);
}

const assetsTs = readFileSync("packages/shared/src/assets.ts", "utf8");
const zodLicenses = literalsFromTs(assetsTs, "ASSET_LICENSES");
const zodAttribution = literalsFromTs(assetsTs, "ATTRIBUTION_REQUIRED_LICENSES");
if (zodLicenses.length > 0 && JSON.stringify(zodLicenses) !== JSON.stringify(allowlist.allowed)) {
  errors.push(
    `ASSET_LICENSES en Zod [${zodLicenses.join(", ")}] diverge del allowlist [${allowlist.allowed.join(", ")}]`,
  );
}
if (
  zodAttribution.length > 0 &&
  JSON.stringify(zodAttribution) !== JSON.stringify(allowlist.attributionRequiredFor)
) {
  errors.push("ATTRIBUTION_REQUIRED_LICENSES en Zod diverge del allowlist");
}

function checkProvenance(provenance, where) {
  if (!provenance) return;
  const { license, sourceId, attribution } = provenance;

  if (denied.has(license)) {
    errors.push(`${where}: licencia denegada ${license}`);
    return;
  }
  if (!allowed.has(license)) {
    errors.push(`${where}: licencia fuera del allowlist: ${license}`);
    return;
  }

  if (sourceId) {
    const source = sourcesById.get(sourceId);
    if (!source) {
      errors.push(`${where}: sourceId desconocido ${sourceId}`);
      return;
    }
    if (source.license !== license) {
      errors.push(
        `${where}: declara ${license} pero la fuente ${sourceId} está registrada como ${source.license}`,
      );
    }
  }

  if (needsAttribution.has(license)) {
    if (!attribution) {
      errors.push(`${where}: ${license} exige atribución y no la declara`);
      return;
    }
    for (const field of ["sourceUrl", "licenseUrl", "attributionText", "verifiedAt"]) {
      if (!attribution[field]) errors.push(`${where}: atribución sin ${field}`);
    }
    if (!/^[0-9a-f]{64}$/.test(attribution.licenseFileSha256 ?? "")) {
      errors.push(`${where}: atribución sin licenseFileSha256 válido`);
    }
    const source = sourceId ? sourcesById.get(sourceId) : undefined;
    if (source && attribution.sourceUrl && attribution.sourceUrl !== source.sourceUrl) {
      errors.push(
        `${where}: attribution.sourceUrl no coincide con la fuente registrada ${sourceId}`,
      );
    }
  }
}

const bundles = readdirSync(GENERATED_DIR).filter(
  (file) => file.startsWith("runtime-assets") && file.endsWith(".json"),
);

for (const file of bundles) {
  const manifest = JSON.parse(readFileSync(join(GENERATED_DIR, file), "utf8"));
  const label = file.replace("runtime-assets", "bundle").replace(".json", "");
  let declared = 0;

  checkProvenance(manifest.provenance, `${label}.provenance`);
  for (const group of ["buildings", "characters", "terrain", "props", "vehicles"]) {
    for (const [id, asset] of Object.entries(manifest[group] ?? {})) {
      if (asset?.provenance) {
        declared += 1;
        checkProvenance(asset.provenance, `${label}.${group}.${id}`);
      }
    }
  }
  console.log(`${file}: ${declared} asset(s) con procedencia propia`);
}

if (errors.length > 0) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        checkedBundles: bundles.length,
        errors,
        hint: "D-083: la licencia de un asset debe coincidir con su fuente registrada, y MIT/CC-BY exigen evidencia de atribución.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(`Third-party licence guard passed for ${bundles.length} bundle(s).`);

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const manifestUrl = new URL("../blender_artist/manifests/staging-sources.json", import.meta.url);
const allowlistUrl = new URL("../blender_artist/manifests/license-allowlist.json", import.meta.url);
const kitUrl = new URL(
  "../blender_artist/manifests/visual-direction-spike-kit.json",
  import.meta.url,
);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const allowlist = JSON.parse(await readFile(allowlistUrl, "utf8"));
const kit = JSON.parse(await readFile(kitUrl, "utf8"));
const sourceIds = new Set();
const errors = [];

const allowedLicenses = new Set(allowlist.allowed);
const deniedLicenses = new Set(allowlist.denied);
const STAGING_PREFIX = "blender_artist/staging/third_party/";

async function sha256Of(url) {
  return createHash("sha256")
    .update(await readFile(url))
    .digest("hex");
}

for (const source of manifest.sources) {
  if (!/^src_[a-z0-9_]+$/.test(source.id)) errors.push(`Invalid source id: ${source.id}`);
  if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  if (!source.path || !source.sourceUrl || !source.verification) {
    errors.push(`Incomplete provenance: ${source.id}`);
    continue;
  }

  // 〔R1〕 La lista canónica de licencias es license-allowlist.json; aquí sólo se aplica, para
  // que contrato (Zod) y staging no puedan volver a divergir.
  if (deniedLicenses.has(source.license)) {
    errors.push(`Denied license ${source.license} in ${source.id}`);
  } else if (!allowedLicenses.has(source.license)) {
    errors.push(`License not in allowlist: ${source.license} (${source.id})`);
  }

  const family = allowlist.directoryByLicense[source.license];
  if (family === null) {
    errors.push(`Material propio no pertenece al staging de terceros: ${source.id}`);
  } else if (family && !source.path.startsWith(`${STAGING_PREFIX}${family}/`)) {
    errors.push(
      `${source.id} con licencia ${source.license} debe vivir bajo ${STAGING_PREFIX}${family}/`,
    );
  }

  // Dos anclas de integridad: el ZIP físico (D-054) o, para fuentes clonadas sin archivo,
  // el commit de origen más el hash del aviso de licencia que viaja con el material.
  const integrity = source.integrity ?? { type: "zip-sha256" };
  if (integrity.type === "git-commit") {
    if (!/^[0-9a-f]{40}$/.test(integrity.commit ?? "")) {
      errors.push(`Integridad git-commit sin commit válido: ${source.id}`);
    }
    try {
      const hash = await sha256Of(new URL(`../${integrity.licenseFile}`, import.meta.url));
      if (hash !== integrity.licenseFileSha256) {
        errors.push(`License evidence checksum mismatch: ${source.id}`);
      }
    } catch {
      errors.push(`Falta el aviso de licencia: ${integrity.licenseFile}`);
    }
  } else {
    try {
      const hash = await sha256Of(new URL(`../${source.path}`, import.meta.url));
      if (hash !== source.sha256) errors.push(`Checksum mismatch: ${source.id}`);
    } catch {
      errors.push(`Missing staged source: ${source.path}`);
    }
  }
}

const assetIds = new Set();
for (const asset of kit.assets) {
  if (!/^(ter|bld|chr|veh|prp|vfx|ui|ico)_[a-z0-9_]+$/.test(asset.assetId)) {
    errors.push(`Invalid asset id: ${asset.assetId}`);
  }
  if (assetIds.has(asset.assetId)) errors.push(`Duplicate asset id: ${asset.assetId}`);
  assetIds.add(asset.assetId);
  for (const input of asset.inputs)
    if (!sourceIds.has(input)) errors.push(`Unknown asset input ${input} in ${asset.assetId}`);
}

for (const reference of kit.generatedReferences ?? []) {
  if (reference.origin !== "generated" || !reference.generator || !reference.usage) {
    errors.push(`Incomplete generated-reference provenance: ${reference.path}`);
  }
  try {
    const bytes = await readFile(new URL(`../${reference.path}`, import.meta.url));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== reference.sha256) errors.push(`Checksum mismatch: ${reference.path}`);
  } catch {
    errors.push(`Missing generated reference: ${reference.path}`);
  }
}

try {
  await access(new URL("../constructor_1y2", import.meta.url));
  if (
    JSON.stringify(manifest).includes("constructor_1y2") ||
    JSON.stringify(kit).includes("constructor_1y2")
  ) {
    errors.push("Forbidden reference-game path appears in art metadata");
  }
} catch {
  // The reference directory is optional; it is never an art-pipeline input.
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${manifest.sources.length} approved sources and ${kit.assets.length} original asset briefs.`,
  );
}

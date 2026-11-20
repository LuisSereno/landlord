import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
/** Geometría propia del proyecto: no es staging de terceros; su procedencia es el script que la genera. */
const ORIGINAL_PREFIX = "blender_artist/sources/original/";
// Misma raíz de extracción que usan extract-cc0-packs.mjs y audit-visual-sources.mjs: el
// `extractDir` del registro resuelve aquí, no en una tabla duplicada por cada script.
const CC0_EXTRACTED_PREFIX = `${STAGING_PREFIX}cc0/extracted/`;

async function sha256Of(url) {
  return createHash("sha256")
    .update(await readFile(url))
    .digest("hex");
}

// Para packs recibidos como carpeta, fija el contenido completo sin fabricar un hash de ZIP.
// Cada entrada aporta ruta relativa POSIX y hash de bytes; el orden queda estable entre SO.
async function sha256OfTree(rootUrl) {
  const root = fileURLToPath(rootUrl);
  const files = [];
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) await visit(full, `${relative}/`);
      else if (entry.isFile()) files.push([relative, full]);
      else throw new Error(`Tipo de entrada no admitido: ${relative}`);
    }
  }
  await visit(root);
  files.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const tree = createHash("sha256");
  for (const [relative, full] of files) {
    tree.update(relative);
    tree.update("\0");
    tree.update(
      createHash("sha256")
        .update(await readFile(full))
        .digest(),
    );
    tree.update("\n");
  }
  return { sha256: tree.digest("hex"), fileCount: files.length };
}

for (const source of manifest.sources) {
  if (!/^src_[a-z0-9_]+$/.test(source.id)) errors.push(`Invalid source id: ${source.id}`);
  if (sourceIds.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
  sourceIds.add(source.id);
  /**
   * Material original (D-109): vive fuera del staging de terceros y su ancla de procedencia es el
   * script generador + el hash del GLB. Las reglas de terceros no se relajan: esta rama sólo cubre
   * licencia `original` con origen `original` bajo el directorio canónico.
   */
  if (source.license === "original" && source.origin === "original") {
    if (!source.path?.startsWith(ORIGINAL_PREFIX)) {
      errors.push(`Material propio fuera de ${ORIGINAL_PREFIX}: ${source.id}`);
    }
    if (!source.sourceUrl || !source.verification) {
      errors.push(`Incomplete provenance: ${source.id}`);
    }
    if (source.path && existsSync(source.path)) {
      if (source.sha256) {
        const actual = await sha256Of(new URL(`../${source.path}`, import.meta.url));
        if (actual !== source.sha256) errors.push(`Original source hash mismatch: ${source.id}`);
      }
    } else if (source.path) {
      errors.push(`Missing original source file: ${source.id}`);
    }
    continue;
  }
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

  // Tres anclas de integridad: el ZIP físico (D-054), el commit de origen más el hash del aviso de
  // licencia para fuentes clonadas sin archivo, y `archived` cuando el archivo ya no se retiene.
  const integrity = source.integrity ?? { type: "zip-sha256" };
  if (integrity.type === "tree-sha256") {
    const expectedPath = `${CC0_EXTRACTED_PREFIX}${source.extractDir}`;
    if (!source.extractDir || source.path !== expectedPath) {
      errors.push(`Árbol extraído fuera de su ruta canónica: ${source.id}`);
    } else {
      try {
        const actual = await sha256OfTree(new URL(`../${source.path}/`, import.meta.url));
        if (actual.fileCount === 0 || actual.fileCount !== integrity.fileCount) {
          errors.push(`Tree file count mismatch: ${source.id}`);
        }
        if (actual.sha256 !== source.sha256) errors.push(`Tree checksum mismatch: ${source.id}`);
      } catch (error) {
        errors.push(`Cannot validate source tree ${source.id}: ${error.message}`);
      }
    }
  } else if (integrity.type === "git-commit") {
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
  } else if (integrity.type === "archived") {
    // 〔R2〕 La trazabilidad no depende del archivo: `sha256` + `sourceUrl` son el contrato de
    // reprovisión y `extractDir` es la copia de trabajo. Si el archivo vuelve a estar en disco,
    // manda su hash otra vez, así que re-descargar un pack no deja el registro obsoleto.
    const archiveUrl = new URL(`../${source.path}`, import.meta.url);
    let archivePresent = true;
    try {
      await access(archiveUrl);
    } catch {
      archivePresent = false;
    }
    if (archivePresent) {
      const hash = await sha256Of(archiveUrl);
      if (hash !== source.sha256) errors.push(`Checksum mismatch: ${source.id}`);
    } else if (!source.extractDir) {
      errors.push(`Fuente archivada sin extractDir: ${source.id}`);
    } else {
      const packUrl = new URL(`../${CC0_EXTRACTED_PREFIX}${source.extractDir}`, import.meta.url);
      try {
        if ((await readdir(packUrl)).length === 0) {
          errors.push(`Extracción vacía de fuente archivada: ${source.id}`);
        }
      } catch {
        errors.push(`Falta la extracción de la fuente archivada: ${source.extractDir}`);
      }
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

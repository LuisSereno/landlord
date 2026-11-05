#!/usr/bin/env node
/**
 * Inventario real de geometría modular para el Building Composer (V.f.0).
 *
 * No clasifica por nombres: recorre el staging licenciado, importa cada archivo candidato con
 * Blender headless y registra lo que hay dentro (objetos, jerarquía, materiales, dimensiones en
 * metros normalizados, componentes separables, pivot). Con esos datos `inventory_building_modules.py`
 * clasifica cada fuente como `modular | partially_modular | whole_asset_only | unsuitable`.
 *
 * Uso: node scripts/inventory-building-modules.mjs [--out=blender_artist/manifests/building-module-inventory.json]
 *
 * Sólo se inspeccionan fuentes ya registradas en `staging-sources.json` (D-083/D-098): el spike no
 * amplía el inventario externo.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender");
const BLENDER_SCRIPT = join(
  REPO_ROOT,
  "tools",
  "art-pipeline",
  "blender",
  "inventory_building_modules.py",
);
const SOURCES_PATH = join(REPO_ROOT, "blender_artist", "manifests", "staging-sources.json");
const EXTRACTED = "blender_artist/staging/third_party/cc0/extracted";

/**
 * Ámbito del spike: fuentes registradas, nunca packs nuevos. Los patrones acotan qué archivos de
 * cada pack se inspeccionan (el resto del pack no aporta módulos de edificio).
 */
const SCOPE = [
  {
    sourceId: "src_kenney_city_suburban",
    directory: `${EXTRACTED}/kenney/city-kit-suburban/Models/GLB format`,
    pattern: "\\.glb$",
  },
  {
    sourceId: "src_kenney_city_industrial",
    directory: `${EXTRACTED}/kenney/city-kit-industrial/Models/GLB format`,
    pattern: "\\.glb$",
  },
  {
    sourceId: "src_kenney_city_commercial",
    directory: `${EXTRACTED}/kenney/city-kit-commercial/Models/GLB format`,
    pattern: "\\.glb$",
  },
  {
    sourceId: "src_kenney_city_roads",
    directory: `${EXTRACTED}/kenney/city-kit-roads/Models/GLB format`,
    pattern: "\\.glb$",
  },
  {
    sourceId: "src_kenney_nature_kit",
    directory: `${EXTRACTED}/kenney/nature-kit/Models/GLTF format`,
    pattern: "^(tree|bush|plant|rock|log|stump|statue|bridge|pot|sign)_.*\\.glb$",
  },
  {
    sourceId: "src_kenney_car_kit",
    directory: `${EXTRACTED}/kenney/car-kit/Models/GLB format`,
    pattern:
      "^(sedan|suv|van|truck|taxi|police|firetruck|ambulance|delivery|garbage|hatchback).*\\.glb$",
  },
  {
    sourceId: "src_kaykit_city_builder_bits",
    directory: `${EXTRACTED}/kaykit/city-builder-bits/KayKit-City-Builder-Bits-1.0-main/addons/kaykit_city_builder_bits/Assets/gltf`,
    pattern:
      "^(building_\\w+|watertower|dumpster|box_[AB]|bench|firehydrant|streetlight|trafficlight_A|bush|trash_A|base)\\.gltf$",
  },
  {
    sourceId: "src_quaternius_downtown_city_megakit",
    directory: `${EXTRACTED}/quaternius/downtown-city-megakit/Exports/glTF (Godot)`,
    pattern: "\\.gltf$",
  },
];

const CLASSIFICATION_RULE = {
  unsuitable:
    "import falla, sin meshes, sin triángulos, eje mayor < 0.25 m (geometría degenerada) o texturas sin resolver (el render abortaría en magenta). La degeneración se mide sobre el eje MÁS LARGO: una columna de 0.3 m de ancho es un módulo legítimo, no basura.",
  modular:
    ">= 3 UNIDADES SUSTANCIALES (objetos raíz independientes o componentes conexas) y la mayor < 75 % de los triángulos",
  partially_modular: "2 unidades sustanciales, o una de ellas domina la masa",
  whole_asset_only:
    "1 sola unidad sustancial: utilizable como módulo de masa completo, no fragmentable en piezas útiles",
  thresholds: {
    minPieceSizeMeters: 0.25,
    minPieceTriangles: 24,
    minLargestAxisMeters: 0.25,
    // Sin este umbral, la geometría glTF SIN SOLDAR de Kenney (554-737 cáscaras por edificio)
    // se leería como un kit modular cuando fragmentarla sería reconstruirlo a mano.
    substantialPieceTriangleShare: 0.1,
  },
  note: "La modularidad de un pack puede estar a nivel de ARCHIVO (MegaKit, KayKit: un módulo por gltf) y no a nivel de objeto dentro del archivo; por eso el catálogo de módulos referencia rutas de archivo, no sólo selecciones de nodo.",
};

const registry = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));
const outArg = process.argv.slice(2).find((flag) => flag.startsWith("--out="));
const CHECK = process.argv.includes("--check");
const OUTPUT = resolve(
  REPO_ROOT,
  outArg?.slice("--out=".length) ?? "blender_artist/manifests/building-module-inventory.json",
);

const scope = [];
const missingDirectories = [];
for (const rule of SCOPE) {
  const source = sourcesById.get(rule.sourceId);
  if (!source) {
    throw new Error(`fuente no registrada en staging-sources.json: ${rule.sourceId}`);
  }
  const absolute = join(REPO_ROOT, rule.directory);
  if (!existsSync(absolute)) {
    missingDirectories.push(rule.directory);
    continue;
  }
  const pattern = new RegExp(rule.pattern);
  for (const file of readdirSync(absolute)
    .filter((name) => pattern.test(name))
    .sort()) {
    scope.push({
      sourceId: rule.sourceId,
      path: `${rule.directory}/${file}`,
      unitScale: source.unitScale ?? 1.0,
      license: source.license,
    });
  }
}

const workDir = join(tmpdir(), "landlord-vf-inventory");
mkdirSync(workDir, { recursive: true });
const scopePath = join(workDir, "vf-module-scope.json");
const rawPath = join(workDir, "vf-module-inventory-raw.json");
writeFileSync(scopePath, `${JSON.stringify(scope, null, 2)}\n`);

if (!existsSync(BLENDER)) throw new Error(`no existe el binario de Blender: ${BLENDER}`);
console.log(`Inventariando ${scope.length} archivos desde ${SCOPE.length} fuentes registradas…`);
const result = spawnSync(
  BLENDER,
  ["--background", "--python", BLENDER_SCRIPT, "--", "--scope", scopePath, "--output", rawPath],
  // Heredamos el tty: un inventario de 517 archivos tarda minutos y un fallo de Blender debe verse
  // mientras ocurre, no sólo en el summary que imprime el proceso padre al terminar.
  { stdio: "inherit" },
);
if (result.status !== 0) {
  throw new Error(`Blender falló al inventariar (status ${result.status})`);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const bySource = {};
for (const entry of raw.sources) {
  bySource[entry.sourceId] = (bySource[entry.sourceId] ?? 0) + 1;
}

const manifest = {
  schemaVersion: 1,
  purpose:
    "V.f.0: inventario medido de la geometría real disponible en staging licenciado, para decidir qué módulos puede aportar cada fuente al Building Composer. Las clasificaciones derivan de la geometría importada, no del nombre del archivo.",
  generator: {
    script: "scripts/inventory-building-modules.mjs",
    blenderScript: "tools/art-pipeline/blender/inventory_building_modules.py",
    toolchain: raw.toolchain,
  },
  provenance:
    "Cada entrada declara sourceId, sourcePath, licencia y unitScale resueltos desde blender_artist/manifests/staging-sources.json (D-083, D-098).",
  scopeRules: SCOPE,
  missingDirectories: missingDirectories,
  classificationRule: CLASSIFICATION_RULE,
  counts: {
    sources: raw.sources.length,
    withUnresolvedTextures: raw.sources.filter((entry) => (entry.unresolvedTextures ?? []).length)
      .length,
    bySource,
    byClassification: {
      modular: raw.sources.filter((entry) => entry.classification === "modular").length,
      partially_modular: raw.sources.filter((entry) => entry.classification === "partially_modular")
        .length,
      whole_asset_only: raw.sources.filter((entry) => entry.classification === "whole_asset_only")
        .length,
      unsuitable: raw.sources.filter((entry) => entry.classification === "unsuitable").length,
    },
  },
  sources: raw.sources,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (CHECK) {
  // El inventario es la evidencia en la que se apoya el catálogo de módulos: si volver a medirlo
  // da otro resultado, o bien la fuente cambió sin que nadie lo declare, o bien la medición no es
  // reproducible. Ambos casos deben fallar, no pasar desapercibidos.
  if (!existsSync(OUTPUT)) throw new Error(`no hay manifiesto que comparar: ${OUTPUT}`);
  const committed = readFileSync(OUTPUT, "utf8");
  if (committed === serialized) {
    console.log(
      JSON.stringify({ status: "inventory-unchanged", sources: manifest.counts.sources }),
    );
    process.exit(0);
  }
  const previous = JSON.parse(committed);
  const changed = manifest.sources.filter((entry, index) => {
    const before = previous.sources?.[index];
    return !before || JSON.stringify(before) !== JSON.stringify(entry);
  });
  throw new Error(
    `el inventario medido ya no coincide con el manifiesto versionado ` +
      `(${changed.length} fuentes cambiadas de ${manifest.sources.length}; ` +
      `primera: ${changed[0]?.path ?? "conteo distinto"}). ` +
      "Regenera con `pnpm art:modules:inventory` y revisa el diff.",
  );
}

writeFileSync(OUTPUT, serialized);
console.log(
  JSON.stringify({
    status: "inventoried",
    manifest: OUTPUT,
    sources: manifest.counts.sources,
    byClassification: manifest.counts.byClassification,
    missingDirectories,
  }),
);

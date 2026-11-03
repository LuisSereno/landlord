#!/usr/bin/env node
/**
 * Construye el catálogo de módulos del Building Composer (V.f.1, §6 y §9).
 *
 * La curación es humana (`building-modules-selection.json`: qué archivos licenciados entran, con
 * qué rol y para qué familias). Todo lo medible —licencia, escala, huella, pivote, triángulos,
 * materiales— sale de importar la geometría REAL en Blender (`measure_building_modules.py`), así
 * que un módulo no puede existir sólo en el JSON: si el selector no aporta triángulos, el catálogo
 * no se escribe (§7 "módulos puramente declarativos").
 *
 * Uso:
 *   node scripts/build-building-modules.mjs          # regenera el catálogo
 *   node scripts/build-building-modules.mjs --check  # falla si el catálogo publicado difiere
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELECTION_PATH = "blender_artist/manifests/building-modules-selection.json";
const INVENTORY_PATH = "blender_artist/manifests/building-module-inventory.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";
const OUTPUT_PATH = "blender_artist/manifests/building-modules.json";
const BLENDER_SCRIPT = "tools/art-pipeline/blender/measure_building_modules.py";
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender");

const FRONT_AXIS_BY_Y_CONVENTION = {
  "positive-from-origin": "+Y",
  "negative-from-origin": "-Y",
};
const ROTATIONS = [0, 90, 180, 270];

function fail(message) {
  throw new Error(`[building-modules] ${message}`);
}

const selection = JSON.parse(readFileSync(join(REPO_ROOT, SELECTION_PATH), "utf8"));
const inventory = JSON.parse(readFileSync(join(REPO_ROOT, INVENTORY_PATH), "utf8"));
const registry = JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_PATH), "utf8"));

const inventoryByPath = new Map(inventory.sources.map((entry) => [entry.path, entry]));
const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));
const stagingPrefix = "blender_artist/staging/";

// Un archivo puede alimentar varios módulos (aerogenerador: torre + palas juntos o separados).
const files = [];
const fileByPath = new Map();
for (const module of selection.modules) {
  const entry = inventoryByPath.get(module.sourcePath);
  if (!entry) fail(`módulo ${module.id} apunta a un archivo sin medir en el inventario`);
  if (!module.sourcePath.startsWith(stagingPrefix)) {
    fail(`módulo ${module.id}: sourcePath fuera de staging`);
  }
  if (entry.classification === "unsuitable") {
    fail(`módulo ${module.id}: fuente inhábil (${entry.classificationReason})`);
  }
  const source = sourcesById.get(entry.sourceId);
  if (!source) fail(`fuente no registrada en staging-sources.json: ${entry.sourceId}`);
  if (source.license !== entry.license) {
    fail(
      `licencia declarada (${entry.license}) distinta de la registrada (${source.license}) en ${entry.path}`,
    );
  }
  let file = fileByPath.get(module.sourcePath);
  if (!file) {
    file = {
      sourcePath: module.sourcePath,
      sourceId: entry.sourceId,
      license: entry.license,
      unitScale: entry.unitScale,
      modules: [],
    };
    files.push(file);
    fileByPath.set(module.sourcePath, file);
  }
  file.modules.push({ id: module.id, meshes: module.meshes });
}

const workDir = join(tmpdir(), "landlord-vf-module-measure");
mkdirSync(workDir, { recursive: true });
writeFileSync(join(workDir, "selection.json"), `${JSON.stringify(files, null, 2)}\n`);

const measurementsPath = join(workDir, "measurements.json");
rmSync(measurementsPath, { force: true });
if (!existsSync(BLENDER)) fail(`no existe el binario de Blender: ${BLENDER}`);
console.log(`Midiendo ${selection.modules.length} módulos sobre ${files.length} archivos…`);
const result = spawnSync(
  BLENDER,
  [
    "--background",
    "--python",
    resolve(REPO_ROOT, BLENDER_SCRIPT),
    "--",
    "--selection",
    join(workDir, "selection.json"),
    "--output",
    measurementsPath,
  ],
  // Heredamos el tty: la trazada de Blender debe verse mientras ocurre, no sólo en el error del padre.
  { stdio: "inherit" },
);
// Blender 5.x sale con status 0 aunque el script python reviente, así que el status no basta:
// sin fichero de mediciones no hay catálogo.
if (!existsSync(measurementsPath)) {
  fail(`Blender no escribió mediciones (status ${result.status}): revisa la trazada arriba`);
}

const measured = JSON.parse(readFileSync(measurementsPath, "utf8"));
const measurementByModule = new Map();
const fileMeasurementByPath = new Map();
for (const file of measured.files) {
  fileMeasurementByPath.set(file.sourcePath, file);
  for (const module of file.modules) measurementByModule.set(module.id, module);
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function anchorOf(module, entry) {
  const measure = measurementByModule.get(module.id);
  if (!measure) fail(`módulo ${module.id} sin medición`);
  const bounds = measure.moduleBounds.relativeToNormalizedFrame;
  const pivot = entry.pivot ?? {};
  // El datum autoral sólo es válido si el pivote medido pertenece a la geometría del módulo.
  const usesFilePivot = pivot.object && measure.selectedObjects.includes(pivot.object);
  const convention = usesFilePivot
    ? pivot.convention
    : { x: "centered", y: "centered", z: "centered" };
  const frontAxis = FRONT_AXIS_BY_Y_CONVENTION[convention.y] ?? "symmetric-Y";
  return {
    measure,
    block: {
      datum: usesFilePivot ? "authored_object_origin" : "normalized_import_root",
      datumObject: usesFilePivot ? pivot.object : null,
      convention,
      frontAxis,
      symmetricAboutFront: convention.y === "centered",
      boundsRelativeToOriginMeters: usesFilePivot ? pivot.boundsRelativeToOrigin : null,
      datumOffsetFromGroundCenterMeters: usesFilePivot ? pivot.offsetFromGroundCenter : null,
      moduleBoundsInPlacementFrameMeters: bounds,
      originToGroundMeters: round(-measure.moduleBounds.minZ),
      offsetToFootprintCenterMeters: measure.anchor.offsetToFootprintCenterMeters.map((v) =>
        round(v),
      ),
      anchorTransform: {
        translation: [
          round(-measure.moduleBounds.centerXY[0]),
          round(-measure.moduleBounds.centerXY[1]),
          round(-measure.moduleBounds.minZ),
        ],
        rotationZDegrees: 0,
      },
    },
  };
}

const modules = selection.modules.map((module) => {
  const entry = inventoryByPath.get(module.sourcePath);
  const { measure, block } = anchorOf(module, entry);
  const file = fileMeasurementByPath.get(module.sourcePath);
  const size = measure.moduleBounds.sizeMeters;
  return {
    id: module.id,
    category: module.category,
    role: module.role,
    note: module.note,
    sourceId: entry.sourceId,
    sourcePath: entry.path,
    license: entry.license,
    unitScale: entry.unitScale,
    objectSelector: { meshes: module.meshes },
    nodeSelector: { root: "IMPORT_ROOT", reparentTo: "COMPOSITION_ROOT" },
    allowedFamilies: module.allowedFamilies,
    extraction: {
      strategy: module.extractionStrategy,
      classification: entry.classification,
      reason: entry.classificationReason,
    },
    nominalBounds: {
      widthMeters: round(size.width),
      depthMeters: round(size.depth),
      heightMeters: round(size.height),
    },
    anchor: block,
    orientation: {
      allowedRotationsDegrees: ROTATIONS,
      symmetricAboutFront: block.symmetricAboutFront,
    },
    measured: { ...measure.measured, selectedObjects: measure.selectedObjects },
    provenance: {
      sourceBounds: file.normalized.sourceBounds,
      importScale: file.normalized.importScale,
      importOffset: file.normalized.importOffset,
      fileTriangles: entry.triangles,
      fileHierarchy: file.hierarchy.map((record) => `${record.name}:${record.type}`),
    },
  };
});

const catalog = {
  schemaVersion: 1,
  moduleCatalogVersion: "vf-1",
  purpose:
    "V.f.1: catálogo de módulos del Building Composer. La selección la escribe un humano; la geometría la mide Blender al importar el archivo licenciado, así que cada módulo declara procedencia verificable y bounds reales (§6, §7, §9).",
  generator: {
    script: "scripts/build-building-modules.mjs",
    blenderScript: BLENDER_SCRIPT,
    selection: SELECTION_PATH,
    inventory: INVENTORY_PATH,
    toolchain: measured.toolchain,
  },
  provenance:
    "sourceId, licencia y unitScale se resuelven contra blender_artist/manifests/staging-sources.json (D-083, D-098); nominalBounds, anchor y measured salen de importar el archivo en Blender. Ningún campo geométrico se escribe a mano.",
  families: selection.families,
  categories: selection.categories,
  extractionStrategies: selection.extractionStrategies,
  anchorGlossary: {
    datum:
      "authored_object_origin = el módulo declara su plano de apoyo en el origen que el artista del pack autoró; normalized_import_root = sólo hay el marco normalizado del archivo.",
    frontAxis:
      "lado del módulo que da a la calle, deducido de dónde queda la geometría respecto al origen autoral en Y. 'symmetric-Y' = el módulo es pasable sin cambiar su lectura.",
    originToGroundMeters:
      "-Zmin del módulo medido en metros tras normalizar el archivo. Un módulo que ocupa todo el " +
      "asset vale ~0 porque normalize_import_root ya apoya el asset entero en Z=0; deja de ser 0 " +
      "cuando el selector recorta parte de un archivo (una losa que cuelga bajo su origen, un " +
      "recorte geométrico) y entonces es el levantamiento que el compositor debe aplicar. La " +
      "posición del datum autoral respecto al suelo sí es llamativa: anchor.datumOffsetFromGroundCenterMeters.",
    anchorTransform:
      "traslación [x,y,z] que aplica el compositor al nodo del módulo para que su huella quede " +
      "centrada en XY y apoyada en Z=0 en el marco normalizado (metros de Landlord).",
    conventionValues: [
      "centered",
      "positive-from-origin",
      "negative-from-origin",
      "offset",
      "degenerate",
    ],
  },
  orientationPolicy:
    "Los módulos sólo rotan en múltiplos de 90°: la retícula del dominio y el rig isométrico (azimut 45°) no admiten giros arbitrarios sin romper el encaje de fachadas.",
  counts: {
    modules: modules.length,
    sources: fileMeasurementByPath.size,
    byCategory: modules.reduce((acc, module) => {
      acc[module.category] = (acc[module.category] ?? 0) + 1;
      return acc;
    }, {}),
    byFamily: Object.fromEntries(
      Object.keys(selection.families).map((family) => [
        family,
        modules.filter((module) => module.allowedFamilies.includes(family)).length,
      ]),
    ),
    bySource: modules.reduce((acc, module) => {
      acc[module.sourceId] = (acc[module.sourceId] ?? 0) + 1;
      return acc;
    }, {}),
  },
  modules,
};

const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
const outputPath = join(REPO_ROOT, OUTPUT_PATH);
const check = process.argv.includes("--check");
if (check) {
  const published = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (published !== serialized) {
    const current = published.length === 0 ? [] : JSON.parse(published).modules;
    const changed =
      current.length !== modules.length
        ? `número de módulos (${current.length} publicado vs ${modules.length} medido)`
        : modules.findIndex(
            (module, index) => JSON.stringify(module) !== JSON.stringify(current[index]),
          ) + 1;
    fail(`el catálogo publicado está obsoleto: ${OUTPUT_PATH} (${changed})`);
  }
  console.log(JSON.stringify({ status: "catalog-unchanged", modules: modules.length }));
} else {
  writeFileSync(outputPath, serialized);
  console.log(
    JSON.stringify({
      status: "catalog-written",
      catalog: OUTPUT_PATH,
      modules: modules.length,
      sources: fileMeasurementByPath.size,
      byCategory: catalog.counts.byCategory,
    }),
  );
}

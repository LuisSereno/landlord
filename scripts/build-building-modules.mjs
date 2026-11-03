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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  MEASURE_SCRIPT,
  groupSelectionModules,
  measureModules,
} from "./lib/building-measurement.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELECTION_PATH = "blender_artist/manifests/building-modules-selection.json";
const INVENTORY_PATH = "blender_artist/manifests/building-module-inventory.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";
const OUTPUT_PATH = "blender_artist/manifests/building-modules.json";

const FRONT_AXIS_BY_Y_CONVENTION = {
  "positive-from-origin": "+Y",
  "negative-from-origin": "-Y",
};

/**
 * Lado de la calle, deducido de la geometría medida respecto al origen autoral.
 *
 * La tabla anterior sólo conocía los casos flush (origen pegado a una cara). Un panel cuyo origen
 * queda a 0,4 m de cualquier cara (`offset`) no es simétrico: simplemente no nace en una cara. Si
 * se tratara como symmetric-Y el compositor podría girarlo 180° y montar el toldo hacia dentro o
 * la marquesina atravesada, así que en `offset` la cara exterior es el extremo más lejano al
 * origen y el plano de apoyo es el más cercano.
 */
function frontAxisOf(convention, boundsRelativeToOrigin) {
  if (convention.y === "centered" || convention.y === "degenerate") return "symmetric-Y";
  const mapped = FRONT_AXIS_BY_Y_CONVENTION[convention.y];
  if (mapped) return mapped;
  if (!boundsRelativeToOrigin) return "symmetric-Y";
  const { min, max } = boundsRelativeToOrigin.y;
  return Math.abs(max) >= Math.abs(min) ? "+Y" : "-Y";
}
const ROTATIONS = [0, 90, 180, 270];

function fail(message) {
  throw new Error(`[building-modules] ${message}`);
}

const selection = JSON.parse(readFileSync(join(REPO_ROOT, SELECTION_PATH), "utf8"));
const inventory = JSON.parse(readFileSync(join(REPO_ROOT, INVENTORY_PATH), "utf8"));
const registry = JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_PATH), "utf8"));

// La agrupación por archivo y sus comprobaciones de procedencia las comparte el generador del
// perfil de estilo: un archivo puede alimentar varios módulos (aerogenerador: torre y palas).
const { files, inventoryByPath } = groupSelectionModules({ selection, inventory, registry, fail });

const workDir = join(tmpdir(), "landlord-vf-module-measure");
console.log(`Midiendo ${selection.modules.length} módulos sobre ${files.length} archivos…`);
// Blender 5.x sale con status 0 aunque el script python reviente, así que el status no basta:
// sin fichero de mediciones no hay catálogo (lo comprueba la lib compartida).
const { measurements: measured } = measureModules({
  repoRoot: REPO_ROOT,
  files,
  workDir,
  label: "building-modules",
});
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
  const boundsRelativeToOrigin = usesFilePivot ? pivot.boundsRelativeToOrigin : null;
  const frontAxis = frontAxisOf(convention, boundsRelativeToOrigin);
  return {
    measure,
    block: {
      datum: usesFilePivot ? "authored_object_origin" : "normalized_import_root",
      datumObject: usesFilePivot ? pivot.object : null,
      convention,
      frontAxis,
      symmetricAboutFront: convention.y === "centered",
      boundsRelativeToOriginMeters: boundsRelativeToOrigin,
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
    blenderScript: MEASURE_SCRIPT,
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
      "lado del módulo que da a la calle, medido sobre boundsRelativeToOriginMeters.y: flush con el " +
      "origen → ese lado; centrado o degenerado → 'symmetric-Y' (pasable sin cambiar su lectura); " +
      "offset → la cara exterior es el extremo más lejano al origen.",
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

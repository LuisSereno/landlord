#!/usr/bin/env node
/**
 * Construye el perfil de estilo del Building Composer (V.f.2, §10 y §11).
 *
 * §10 prohíbe inventar parámetros: cada número de `graphic_civic_buildings_v1` sale de
 *  - medir la geometría REAL de los módulos del catálogo vf-1 en Blender (altura de piso, hueco de puerta, vuelo
 *    de cornisa, triángulos, pivotes),
 *  - medir los materiales reales (rugosidad del canal G de un ORM, metallic del B, cadenas de nodos
 *    que alimentan Base Color),
 *  - aplicar el tratamiento cromático canónico (`style_layer_math`, el mismo código del render) a los
 *    colores medidos y quedarse con el resultado como destino,
 *  - leer las cámaras y luces que ya embarcaron los edificios de V.d.
 *
 * Donde la fuente contradice al style layer (puerta 2,20 m vs 2,10 m), el perfil registra el valor
 * medido y la desviación en lugar de reescribir a mano el número canónico.
 *
 * Uso:
 *   node scripts/build-building-style.mjs          # regenera el perfil
 *   node scripts/build-building-style.mjs --check  # falla si el publicado difiere
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  MEASURE_SCRIPT,
  groupSelectionModules,
  measureModules,
  runBlender,
} from "./lib/building-measurement.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = "blender_artist/manifests/building-modules.json";
const SELECTION_PATH = "blender_artist/manifests/building-modules-selection.json";
const INVENTORY_PATH = "blender_artist/manifests/building-module-inventory.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";
const STYLE_LAYER_PATH = "tools/art-pipeline/blender/style_layer_graphic_civic.json";
const DOMAIN_CATALOG_PATH = "blender_artist/manifests/building-catalog.json";
const METADATA_PATH = "blender_artist/manifests/runtime-blender-e2e-metadata.json";
const ASSET_JOBS_PATH = "blender_artist/manifests/asset-jobs.json";
const ASSET_METRICS_PATH = "blender_artist/manifests/asset-metrics.json";
const OUTPUT_PATH = "blender_artist/manifests/building-style-profiles.json";
const PREVIEW_SCRIPT = "tools/art-pipeline/blender/preview_building_style.py";

const PROFILE_ID = "graphic_civic_buildings_v1";
const CELL_METERS_FALLBACK = 4.0;
const DIAG = Math.SQRT1_2; // cos(45°) = sin(45°): la cámara isométrica canónica está a 45°.

function fail(message) {
  throw new Error(`[building-style] ${message}`);
}

function readJson(relativePath) {
  const absolute = join(REPO_ROOT, relativePath);
  if (!existsSync(absolute)) fail(`falta el insumo ${relativePath}`);
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function sha256(relativePath) {
  return createHash("sha256")
    .update(readFileSync(join(REPO_ROOT, relativePath)))
    .digest("hex");
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return round(sorted[low] + (sorted[high] - sorted[low]) * (position - low));
}

/** Resumen de una familia de valores medidos: moda, todos los valores y ejemplos de módulo. */
function histogram(values, examples = {}) {
  const counts = new Map();
  for (const value of values) {
    const key = round(value, 3);
    const bucket = counts.get(key) ?? { value: key, count: 0, moduleIds: [] };
    bucket.count += 1;
    if (bucket.moduleIds.length < 3 && !bucket.moduleIds.includes(examples[value])) {
      bucket.moduleIds.push(examples[value]);
    }
    counts.set(key, bucket);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value - b.value);
}

function weightedMean(rows, key) {
  const usable = rows.filter((row) => row[key] !== null && row[key] !== undefined);
  if (!usable.length) return null;
  const total = usable.reduce((sum, row) => sum + row.share, 0);
  return round(usable.reduce((sum, row) => sum + row[key] * row.share, 0) / total);
}

/** Media circular de tonos: un bucket que cruza 0/360 no puede promediarse aritméticamente. */
function weightedHue(rows) {
  const usable = rows.filter((row) => row.hueDegrees !== null);
  if (!usable.length) return null;
  let x = 0;
  let y = 0;
  for (const row of usable) {
    const radians = (row.hueDegrees * Math.PI) / 180;
    x += Math.cos(radians) * row.share;
    y += Math.sin(radians) * row.share;
  }
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return round((degrees + 360) % 360, 1);
}

// ---------------------------------------------------------------- evidencias de geometría

const catalog = readJson(CATALOG_PATH);
const modules = catalog.modules;

// Roles de remate y losa: su altura no es la de un piso, así que no entran en la moda de 3 m.
const storeyRoles = new Set(["cornice", "slab", "flat", "pilaster_cap"]);
const storeyPanels = modules.filter(
  (module) =>
    ["facade", "window"].includes(module.category) &&
    module.nominalBounds.depthMeters <= 0.6 &&
    module.nominalBounds.heightMeters >= 2.5 &&
    !storeyRoles.has(module.role),
);
const bayPanels = storeyPanels.filter((module) => module.nominalBounds.widthMeters >= 1.5);
// La hoja (role=door) y el marco (role=doorframe) miden distinto: mezclarlos daría la moda del marco.
const doorModules = modules.filter((module) => module.role === "door");
const frameModules = modules.filter((module) => module.role === "doorframe");
const windowModules = modules.filter((module) =>
  ["window_bay", "curtain_wall"].includes(module.role),
);
const corniceModules = modules.filter((module) => module.role === "cornice");
const propModules = modules.filter((module) =>
  ["intrinsic_prop", "utility", "chimney", "canopy"].includes(module.category),
);
const massModules = modules.filter((module) =>
  ["mass", "civic", "industrial"].includes(module.category),
);

const panelHeights = histogram(
  storeyPanels.map((module) => module.nominalBounds.heightMeters),
  Object.fromEntries(
    storeyPanels.map((module) => [
      module.nominalBounds.heightMeters,
      `${module.id} (${module.nominalBounds.heightMeters} m)`,
    ]),
  ),
);
const bayWidths = histogram(
  bayPanels.map((module) => module.nominalBounds.widthMeters),
  Object.fromEntries(bayPanels.map((module) => [module.nominalBounds.widthMeters, module.id])),
);
const wallDepths = histogram(
  storeyPanels.map((module) => module.nominalBounds.depthMeters),
  Object.fromEntries(storeyPanels.map((module) => [module.nominalBounds.depthMeters, module.id])),
);

const floorHeight = panelHeights[0]?.value ?? null;
if (!floorHeight) fail("ningún panel de fachada de un piso medido: no hay altura de piso");
const baseWallDepth = wallDepths[0]?.value ?? null;

const doorHeights = histogram(
  doorModules.map((module) => module.nominalBounds.heightMeters),
  Object.fromEntries(doorModules.map((module) => [module.nominalBounds.heightMeters, module.id])),
);
const doorWidths = histogram(
  doorModules.map((module) => module.nominalBounds.widthMeters),
  Object.fromEntries(doorModules.map((module) => [module.nominalBounds.widthMeters, module.id])),
);

/** Un panel que no mide lo que la retícula pide no se escala: se cambia de módulo (§10 windowScale). */
const windowHeightsEqualFloor = windowModules.filter(
  (module) => Math.abs(module.nominalBounds.heightMeters - floorHeight) < 0.05,
);

// ---------------------------------------------------------------- evidencias de materiales

const workDir = join(tmpdir(), "landlord-vf-style");
if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
const selection = readJson(SELECTION_PATH);
const inventory = readJson(INVENTORY_PATH);
const registry = readJson(SOURCES_PATH);
const { files } = groupSelectionModules({ selection, inventory, registry, fail });
console.log(`Midiendo ${modules.length} módulos y sus materiales para el perfil de estilo…`);
const { measurements, measurementsPath } = measureModules({
  repoRoot: REPO_ROOT,
  files,
  workDir,
  label: "building-style",
});

const preview = runBlender({
  repoRoot: REPO_ROOT,
  script: PREVIEW_SCRIPT,
  args: [
    "--measurements",
    measurementsPath,
    "--style-layer",
    join(REPO_ROOT, STYLE_LAYER_PATH),
    "--kind",
    "building",
    "--output",
    join(workDir, "style-preview.json"),
  ],
  expectOutput: join(workDir, "style-preview.json"),
  label: "building-style",
});

const styleLayer = readJson(STYLE_LAYER_PATH);
const treatment = styleLayer.externalTreatment;
const textureStats = new Map(
  measurements.imageSamples.map((entry) => [entry.filePath, entry.statistics]),
);
const previewImages = new Map(preview.images.map((entry) => [entry.filePath, entry]));
const textureNames = new Map(
  measurements.imageSamples.map((entry) => [entry.filePath, entry.name]),
);

/** El nombre del datablock NO identifica la textura: Kenney trae tres `colormap.png` distintos con el
 *  mismo nombre (uno por pack) y el muestreo va por archivo. Etiqueta legible = nombre + archivo. */
function nameOfTexture(fileKey) {
  return textureNames.get(fileKey) ?? fileKey.split("/").pop();
}
function sampleLabel(entry) {
  return `${entry.name} ← ${entry.filePath.replace(/^.*blender_artist\//, "blender_artist/")}`;
}

// Regla de familia aplicada a nombres REALES de material medidos (no a ids de módulo).
const FAMILY_RULES = [
  ["glass", /glass/i],
  ["metal", /metal/i],
  ["brick", /brick/i],
  ["wood", /wood|timber|oak|plank/i],
  ["stone", /concrete|asphalt|slate|marble|stone/i],
  ["plaster", /trim|ornament|paint|stucco|plaster/i],
];
const INTERIOR_RULE = /interior|fake/i;

function familyOf(materialName) {
  if (INTERIOR_RULE.test(materialName)) return "interior";
  for (const [family, pattern] of FAMILY_RULES) {
    if (pattern.test(materialName)) return family;
  }
  return "atlas";
}

const families = new Map();
const packs = new Map();
/** Cadena de Base Color por instancia real de (módulo, material). No es una propiedad del material:
 *  medido sobre los glb licenciados, MI_Trim, MI_RedBrick y MI_Trim_MetalConcrete aparecen con atlas
 *  directo en algunos archivos y mezclado con el color de vértice (MIX) en otros del MISMO pack. Por eso
 *  se cuenta por módulo: es el grano con el que el compositor va a colocar geometría. */
const imageReach = new Map();
const moduleReach = new Map();
for (const file of measurements.files) {
  for (const module of file.modules) {
    let moduleEntry = moduleReach.get(module.id);
    if (!moduleEntry) {
      moduleEntry = { pack: file.sourceId, sourcePath: file.sourcePath, treated: 0, raw: 0 };
      moduleReach.set(module.id, moduleEntry);
    }
    for (const material of module.materialReport) {
      const family = familyOf(material.name);
      const record = families.get(family) ?? {
        family,
        materials: new Map(),
        moduleIds: new Set(),
        sourceIds: new Set(),
        images: new Set(),
        scalarRoughness: new Set(),
        scalarMetallic: new Set(),
        ormRoughness: new Set(),
        ormMetallic: new Set(),
        baseColorLinkedTo: new Set(),
        blendMethods: new Set(),
      };
      const pack = packs.get(file.sourceId) ?? {
        sourceId: file.sourceId,
        license: file.license,
        moduleIds: new Set(),
        materialNames: new Set(),
        baseColorChains: new Set(),
        materialDetail: new Map(),
        scalarRoughness: new Set(),
        ormImages: new Set(),
        colorImages: new Set(),
        otherImages: new Set(),
      };
      record.materials.set(material.name, (record.materials.get(material.name) ?? 0) + 1);
      record.moduleIds.add(module.id);
      record.sourceIds.add(file.sourceId);
      record.blendMethods.add(material.blendMethod);
      for (const image of material.images) record.images.add(image.filePath);
      const surface = material.surface ?? {};
      const roughness = surface.Roughness ?? {};
      const metallic = surface.Metallic ?? {};
      const baseColor = surface["Base Color"] ?? {};
      // Sin socket resuelto = el nodo no es un Principled BSDF; no es un "factor plano", es otra cadena.
      const noPrincipled = !material.surface || surface["Base Color"] === undefined;
      const chain = noPrincipled
        ? "sin Principled BSDF"
        : baseColor.linked
          ? `${baseColor.linked}:${baseColor.image ?? "sin imagen"}`
          : "factor plano";
      record.baseColorLinkedTo.add(chain);
      if (typeof roughness.value === "number") record.scalarRoughness.add(roughness.value);
      if (typeof metallic.value === "number") record.scalarMetallic.add(metallic.value);
      const orm = material.images.find((image) => image.name.endsWith("_ORM"));
      if (roughness.linked && orm) {
        const stats = textureStats.get(orm.filePath);
        if (stats) {
          record.ormRoughness.add(stats.channelMeans.g);
          record.ormMetallic.add(stats.channelMeans.b);
        }
      }
      families.set(family, record);

      // runtime_asset.py decide el remape mirando UN solo salto del socket (líneas 620-622): sólo una
      // TEX_IMAGE directa entra en la escalera de bandas; MIX, factor plano o sin Principled quedan en bruto.
      const reached = baseColor.linked === "TEX_IMAGE";
      if (reached) moduleEntry.treated += 1;
      else moduleEntry.raw += 1;

      pack.moduleIds.add(module.id);
      pack.materialNames.add(material.name);
      pack.baseColorChains.add(chain);
      let detail = pack.materialDetail.get(material.name);
      if (!detail) {
        detail = {
          chains: new Map(),
          colorTextures: new Set(),
          roughness: new Set(),
          modulesReached: new Set(),
          modulesRaw: new Set(),
        };
        pack.materialDetail.set(material.name, detail);
      }
      detail.chains.set(chain, (detail.chains.get(chain) ?? 0) + 1);
      (reached ? detail.modulesReached : detail.modulesRaw).add(module.id);
      if (typeof roughness.value === "number") {
        detail.roughness.add(roughness.value);
        pack.scalarRoughness.add(roughness.value);
      }
      for (const image of material.images) {
        if (image.name.endsWith("_ORM")) pack.ormImages.add(image.filePath);
        else if (previewImages.get(image.filePath)?.buckets.length)
          pack.colorImages.add(image.filePath);
        else pack.otherImages.add(image.filePath);
        if (!previewImages.get(image.filePath)?.buckets.length) continue;
        detail.colorTextures.add(image.filePath);
        const imageEntry = imageReach.get(image.filePath) ?? { reached: new Set(), raw: new Set() };
        (reached && baseColor.imageFile === image.filePath
          ? imageEntry.reached
          : imageEntry.raw
        ).add(module.id);
        imageReach.set(image.filePath, imageEntry);
      }
      packs.set(file.sourceId, pack);
    }
  }
}

/** Qué módulos de cada pack entran hoy en la escalera de bandas completos (ningún material en bruto). */
const modulesFullyTreated = [...moduleReach.values()].filter((entry) => entry.raw === 0);
const modulesWithRawMaterial = [...moduleReach.values()].filter((entry) => entry.raw > 0);

/** Color de destino de una textura: la media ponderada por share de los buckets que predice el
 *  tratamiento canónico. `null` cuando la textura no tiene buckets de color (ORM, normales). */
function textureTarget(fileKey) {
  const image = previewImages.get(fileKey);
  if (!image || !image.buckets.length) return null;
  const rows = image.buckets.map((bucket) => ({ ...bucket.predicted, share: bucket.share }));
  const inputRows = image.buckets.map((bucket) => ({
    ...bucket.input,
    share: bucket.share,
    hueDegrees: bucket.input.hueDegrees,
  }));
  return {
    image: image.name,
    filePath: fileKey,
    reachedByTreatment: (imageReach.get(fileKey)?.reached.size ?? 0) > 0,
    modulesReachedByTreatment: imageReach.get(fileKey)?.reached.size ?? 0,
    modulesRawByTreatment: imageReach.get(fileKey)?.raw.size ?? 0,
    saturation: weightedMean(rows, "saturation"),
    value: weightedMean(rows, "value"),
    hueDegrees: weightedHue(rows),
    inputSaturation: weightedMean(inputRows, "saturation"),
    inputValue: weightedMean(inputRows, "value"),
    inputHueDegrees: weightedHue(inputRows),
    bands: [...new Set(image.buckets.map((bucket) => bucket.claimedByBand))].sort(),
    windowGlow: image.buckets.some((bucket) => bucket.windowGlow),
    buckets: image.buckets.map((bucket) => ({
      hue: bucket.hue,
      share: bucket.share,
      input: bucket.input,
      predicted: bucket.predicted,
      claimedByBand: bucket.claimedByBand,
      windowGlow: bucket.windowGlow,
    })),
  };
}

const REQUIRED_FAMILIES = ["brick", "plaster", "metal", "glass", "stone", "wood"];

function familyRecord(family) {
  const record = families.get(family);
  const canonicalTargets = {
    brick: styleLayer.materialRecipes.residential_brick,
    plaster: styleLayer.paletteOverrides.plaster,
    metal: styleLayer.materialRecipes.industrial_metal,
    glass: styleLayer.paletteOverrides.window,
    stone: styleLayer.materialRecipes.concrete,
    wood: styleLayer.materialRecipes.wood,
  };
  const textures = record
    ? [...record.images].filter((fileKey) => nameOfTexture(fileKey).endsWith("_BaseColor"))
    : [];
  const targets = textures.map(textureTarget).filter(Boolean);
  return {
    family,
    present: Boolean(record),
    measuredMaterials: record ? [...record.materials.keys()].sort() : [],
    moduleCount: record ? record.moduleIds.size : 0,
    moduleExamples: record ? [...record.moduleIds].sort().slice(0, 4) : [],
    sourceIds: record ? [...record.sourceIds].sort() : [],
    baseColorChain: record ? [...record.baseColorLinkedTo].sort() : [],
    blendMethods: record ? [...record.blendMethods].sort() : [],
    roughnessMeasured: {
      ormChannelG: record ? [...record.ormRoughness].sort() : [],
      scalarFactor: record ? [...record.scalarRoughness].sort() : [],
    },
    metallicMeasured: {
      ormChannelB: record ? [...record.ormMetallic].sort() : [],
      scalarFactor: record ? [...record.scalarMetallic].sort() : [],
    },
    // "Treated" en sentido estricto: TODAS las instancias de los atlas de la familia llevan el color
    // directo a Base Color. Si una sola cadena MIX queda fuera, la familia se renderiza a dos escaleras.
    reachedByTreatment: targets.length
      ? targets.every(
          (target) => target.modulesRawByTreatment === 0 && target.modulesReachedByTreatment > 0,
        )
      : null,
    treatmentReach: targets.map((target) => ({
      image: target.image,
      textureFile: target.filePath,
      modulesWithAtlasDirect: target.modulesReachedByTreatment,
      modulesWithAtlasMixed: target.modulesRawByTreatment,
    })),
    colorMeasured: targets.map((target) => ({
      image: target.image,
      textureFile: target.filePath,
      input: target.buckets.map((bucket) => bucket.input),
      inputMean: {
        hueDegrees: target.inputHueDegrees,
        saturation: target.inputSaturation,
        value: target.inputValue,
      },
      predicted: {
        hueDegrees: target.hueDegrees,
        saturation: target.saturation,
        value: target.value,
      },
      claimedByBands: target.bands,
      windowGlow: target.windowGlow,
      reachedByTreatment: target.reachedByTreatment,
      modulesWithAtlasDirect: target.modulesReachedByTreatment,
      modulesWithAtlasMixed: target.modulesRawByTreatment,
    })),
    canonicalTarget: canonicalTargets[family] ?? null,
  };
}

const familyRecords = REQUIRED_FAMILIES.map(familyRecord);

// ---------------------------------------------------------------- separación §11
const SEPARATION = {
  minHueDeltaDegrees: 20,
  minSaturationDelta: 0.1,
  minValueDelta: 0.06,
  minMetallicDelta: 0.1,
  minRoughnessDelta: 0.05,
};

function familySummary(family) {
  const record = familyRecords.find((entry) => entry.family === family);
  if (!record || !record.present || !record.colorMeasured.length) return null;
  const colors = record.colorMeasured;
  const total = colors.length;
  const mean = (field) =>
    round(colors.reduce((sum, color) => sum + color.predicted[field], 0) / total);
  const meanInput = (field) =>
    round(colors.reduce((sum, color) => sum + color.inputMean[field], 0) / total);
  const hueRows = colors
    .filter((color) => color.predicted.hueDegrees !== null)
    .map((color) => ({ hueDegrees: color.predicted.hueDegrees, share: 1 }));
  return {
    family,
    hueDegrees: hueRows.length ? weightedHue(hueRows) : null,
    saturation: mean("saturation"),
    value: mean("value"),
    inputSaturation: meanInput("saturation"),
    inputValue: meanInput("value"),
    roughness:
      record.roughnessMeasured.ormChannelG[0] ?? record.roughnessMeasured.scalarFactor[0] ?? null,
    metallic:
      record.metallicMeasured.ormChannelB[0] ?? record.metallicMeasured.scalarFactor[0] ?? null,
    // Estricto: la familia sólo está cubierta hoy si NINGUNA instancia de sus atlas pasa por una cadena MIX.
    reachedByTreatment: colors.every(
      (color) => color.modulesWithAtlasMixed === 0 && color.modulesWithAtlasDirect > 0,
    ),
  };
}

function hueDelta(a, b) {
  if (a === null || b === null) return null;
  return round(Math.abs(((a - b + 540) % 360) - 180), 1);
}

const separableFamilies = REQUIRED_FAMILIES.map(familySummary).filter(Boolean);
const pairChecks = [];
for (let index = 0; index < separableFamilies.length; index += 1) {
  for (let other = index + 1; other < separableFamilies.length; other += 1) {
    const a = separableFamilies[index];
    const b = separableFamilies[other];
    const deltas = {
      hueDegrees: hueDelta(a.hueDegrees, b.hueDegrees),
      saturation: round(Math.abs(a.saturation - b.saturation)),
      value: round(Math.abs(a.value - b.value)),
      roughness:
        a.roughness === null || b.roughness === null
          ? null
          : round(Math.abs(a.roughness - b.roughness)),
      metallic:
        a.metallic === null || b.metallic === null
          ? null
          : round(Math.abs(a.metallic - b.metallic)),
    };
    const channels = [];
    if (deltas.hueDegrees !== null && deltas.hueDegrees >= SEPARATION.minHueDeltaDegrees) {
      channels.push("tono");
    }
    if (deltas.saturation >= SEPARATION.minSaturationDelta) channels.push("saturación");
    if (deltas.value >= SEPARATION.minValueDelta) channels.push("valor");
    if (deltas.roughness !== null && deltas.roughness >= SEPARATION.minRoughnessDelta) {
      channels.push("rugosidad");
    }
    if (deltas.metallic !== null && deltas.metallic >= SEPARATION.minMetallicDelta) {
      channels.push("metallic");
    }
    pairChecks.push({
      pair: `${a.family} vs ${b.family}`,
      deltas,
      separatingChannels: channels,
      distinguishable: channels.length > 0,
    });
  }
}
const collapsedPairs = pairChecks.filter((check) => !check.distinguishable);
/** Pares que sólo separa el shading: si V.f.4 aplanara metallic/rugosidad, esas familias colapsarían. */
const shadingOnlyPairs = pairChecks.filter(
  (check) =>
    check.distinguishable &&
    check.separatingChannels.every((channel) => channel === "rugosidad" || channel === "metallic"),
);
const missingFamilies = familyRecords
  .filter((record) => !record.present)
  .map((record) => record.family);
const untexturedFamilies = familyRecords
  .filter((record) => record.present && !record.colorMeasured.length)
  .map(
    (record) =>
      `${record.family} (materiales ${record.measuredMaterials.join(", ")} sin textura de color mapeable)`,
  );

// ---------------------------------------------------------------- cámara: jobs declarados vs geometría real medida
const metadata = readJson(METADATA_PATH);
const assetJobs = readJson(ASSET_JOBS_PATH);
const inventoryByPath = new Map(inventory.sources.map((entry) => [entry.path, entry]));
const shippedAssetIds = new Set(
  metadata.filter((entry) => entry.kind === "building").map((entry) => entry.assetId),
);
const shippedTreatment = metadata.filter((entry) => entry.kind === "building" && entry.styleLayer);
const litWindowsObserved = shippedTreatment
  .map((entry) => entry.styleLayer.litWindows)
  .filter((value) => typeof value === "number");
const litWindowsBand = [quantile(litWindowsObserved, 0), quantile(litWindowsObserved, 1)];
const cellMeters = styleLayer.proportions.cellSizeMeters ?? CELL_METERS_FALLBACK;

/**
 * Margen de encuadre = orthoScale del job / ancho proyectado del asset REAL medido en el inventario.
 * No se usa la huella de dominio: los edificios Kenney embarcados no llenan la huella que declaran
 * (deuda V.e), así que dividir entre celdas mediría una convención que ningún render sostiene.
 */
const framingObserved = [];
const framingUnmeasured = [];
for (const job of assetJobs.jobs.filter((entry) => entry.kind === "building")) {
  if (!job.camera?.orthoScale) {
    framingUnmeasured.push({
      jobId: job.id,
      assetId: job.assetId,
      reason: "job procedural sin cámara declarada: su encuadre está congelado en runtime_asset.py",
    });
    continue;
  }
  const entry = inventoryByPath.get(job.source.path);
  const size = entry?.normalized?.sizeMeters;
  if (!size) {
    framingUnmeasured.push({
      jobId: job.id,
      assetId: job.assetId,
      sourcePath: job.source.path,
      reason:
        "la exportación que usa el job no está en el inventario vf-0 (el catálogo de módulos mide los glTF del pack, no el FBX)",
    });
    continue;
  }
  const projectedWidth = (size.width + size.depth) * DIAG;
  const publishedWidthPx = job.render?.width ?? assetJobs.defaults.render?.width ?? null;
  framingObserved.push({
    jobId: job.id,
    assetId: job.assetId,
    sourceId: job.source.sourceId,
    footprintCells: `${job.footprint.width}×${job.footprint.height}`,
    measuredEnvelopeMeters: [size.width, size.depth, size.height],
    projectedWidthMeters: round(projectedWidth, 2),
    orthoScale: round(job.camera.orthoScale, 3),
    targetZ: job.camera.targetZ,
    publishedWidthPx,
    margin: round(job.camera.orthoScale / projectedWidth, 3),
    pixelsPerMeter: publishedWidthPx ? round(publishedWidthPx / job.camera.orthoScale, 1) : null,
    fillRatioAgainstFootprint: round(size.width / (job.footprint.width * cellMeters), 3),
    shippedInRuntime: shippedAssetIds.has(job.assetId),
  });
}
const observedMargins = framingObserved.map((row) => row.margin);
const distinctCamera = [
  ...new Set(
    metadata
      .filter((entry) => entry.kind === "building")
      .map(
        (entry) =>
          `${entry.camera.projection} ${entry.camera.azimuthDegrees}/${entry.camera.elevationDegrees}°`,
      ),
  ),
];
const targetZCounts = new Map();
for (const row of framingObserved) {
  targetZCounts.set(row.targetZ, (targetZCounts.get(row.targetZ) ?? 0) + 1);
}
const targetZHistogram = [...targetZCounts.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([targetZMeters, jobs]) => ({ targetZMeters, jobs }));
const medianMargin = quantile(observedMargins, 0.5);

const domain = readJson(DOMAIN_CATALOG_PATH);
const spikeBuildings = domain.buildings.filter((building) =>
  ["row_house", "cement_plant", "town_hall"].includes(building.id),
);
const familyFraming = spikeBuildings.map((building) => {
  const width = building.footprint.width * cellMeters;
  const depth = building.footprint.height * cellMeters;
  const projectedWidth = (width + depth) * DIAG;
  return {
    buildingId: building.id,
    footprintCells: `${building.footprint.width}×${building.footprint.height}`,
    floorCount: building.floorCount,
    envelopeMeters: [width, depth],
    projectedWidthMeters: round(projectedWidth, 2),
    suggestedOrthoScale: round(projectedWidth * medianMargin, 2),
    note: "huella leída del catálogo de dominio; el perfil NO la redefine (§2)",
  };
});

// ---------------------------------------------------------------- parámetros §10
function evidence(measured, how, source) {
  return { measured, how, source };
}

const massHeights = massModules.map((module) => {
  const height = module.nominalBounds.heightMeters;
  const nearest = Math.max(1, Math.round(height / floorHeight));
  return {
    id: module.id,
    heightMeters: height,
    nearestFloorCount: nearest,
    deviationPercent: round(((height - nearest * floorHeight) / (nearest * floorHeight)) * 100, 1),
  };
});
const offGridMasses = massHeights.filter((row) => Math.abs(row.deviationPercent) > 1);

const reliefSteps = wallDepths
  .filter((bucket) => bucket.value - baseWallDepth > 0.005)
  .map((bucket) => round(bucket.value - baseWallDepth));

const overhangs = corniceModules
  .map((module) => ({
    id: module.id,
    depthMeters: module.nominalBounds.depthMeters,
    projectionMeters: round(module.nominalBounds.depthMeters - baseWallDepth),
  }))
  .filter((row) => row.projectionMeters > 0)
  .sort((a, b) => a.projectionMeters - b.projectionMeters);

const facadeAreas = storeyPanels
  .filter((module) => module.measured.triangles > 0)
  .map((module) =>
    round(
      module.measured.triangles /
        (module.nominalBounds.widthMeters * module.nominalBounds.heightMeters),
      1,
    ),
  );

const propRatios = propModules.map((module) => ({
  id: module.id,
  heightMeters: module.nominalBounds.heightMeters,
  ratioToCharacter: round(
    module.nominalBounds.heightMeters / styleLayer.proportions.characterHeight,
    2,
  ),
}));

/** Texturas con buckets de color medidos: los atlases y base colors que el tratamiento puede remapear. */
const colorTextures = measurements.imageSamples
  .filter((entry) => entry.hueMeaningful && entry.statistics?.hueBuckets?.length)
  .map((entry) => textureTarget(entry.filePath))
  .filter(Boolean);
/** Bandas canónicas explícitamente declaradas para edificios: las que deciden el alzado de una fachada. */
const buildingBands = (treatment.hueBands ?? [])
  .filter((band) => band.kinds?.includes("building"))
  .map((band) => band.id);
const buildingBandBuckets = colorTextures.flatMap((target) =>
  target.buckets
    .filter((bucket) => buildingBands.includes(bucket.claimedByBand))
    .map((bucket) => ({
      image: target.image,
      textureFile: target.filePath,
      band: bucket.claimedByBand,
      hueBucket: bucket.hue,
      share: bucket.share,
      inputValue: bucket.input.value,
      predictedValue: bucket.predicted.value,
      predictedSaturation: bucket.predicted.saturation,
    })),
);
/** Orms que declaran metal medido (>0,01): son los que el override canónico no puede tocar. */
const metallicSources = measurements.imageSamples
  .filter((entry) => entry.name.endsWith("_ORM") && entry.statistics.channelMeans.b > 0.01)
  .map((entry) => `${sampleLabel(entry)} B=${entry.statistics.channelMeans.b}`);
/** Factores de Roughness planos por pack: lo que el override canónico sí puede unificar. */
const scalarRoughnessByPack = [...packs.values()]
  .filter((pack) => pack.scalarRoughness.size)
  .map((pack) => `${pack.sourceId}: ${[...pack.scalarRoughness].sort().join("/")}`);
const ormRoughnessMeans = measurements.imageSamples
  .filter((entry) => entry.name.endsWith("_ORM"))
  .map((entry) => entry.statistics.channelMeans.g);

const parameters = {
  floorHeightMeters: {
    value: floorHeight,
    unit: "m",
    status: "confirmado",
    evidence: [
      evidence(
        panelHeights.slice(0, 4),
        "altura medida de los paneles de fachada de un piso (categorías facade/window, espesor ≤ 0,6 m, alto ≥ 2,5 m) al importar los GLB en Blender",
        `${CATALOG_PATH} → nominalBounds.heightMeters`,
      ),
      evidence(
        massModules
          .filter(
            (module) =>
              module.role === "civic_block" &&
              module.nominalBounds.heightMeters % floorHeight < 0.01,
          )
          .map(
            (module) =>
              `${module.id}: ${module.nominalBounds.heightMeters} m = ${module.nominalBounds.heightMeters / floorHeight} pisos`,
          )
          .slice(0, 3),
        "los bloques enteros miden múltiplos exactos de la altura de piso modal: retícula compartida entre packs",
        `${CATALOG_PATH} → nominalBounds.heightMeters`,
      ),
      evidence(
        styleLayer.proportions.buildingFloorHeight,
        "valor canónico copiado de la dirección aprobada, no medido por este perfil",
        `${STYLE_LAYER_PATH} → proportions.buildingFloorHeight`,
      ),
    ],
    rationale:
      `El piso de ${floorHeight} m está medido en la geometría de los paneles y coincide con el número canónico ` +
      `(${styleLayer.proportions.buildingFloorHeight} m). El compositor apila módulos a este paso; no escala paneles ` +
      "para ajustarlo.",
  },
  bays: {
    value: {
      bayWidthMeters: bayWidths.slice(0, 2).map((bucket) => bucket.value),
      cellSizeMeters: cellMeters,
    },
    unit: "m",
    status: "confirmado",
    evidence: [
      evidence(
        bayWidths.slice(0, 4),
        "anchos medidos de los paneles de una y dos crujías",
        `${CATALOG_PATH} → nominalBounds.widthMeters`,
      ),
    ],
    rationale:
      `La crujía mínima mide ${bayWidths[0].value} m y la doble ${bayWidths[1]?.value} m: son exactamente ` +
      `${round(bayWidths[0].value / cellMeters, 3)} y ${round((bayWidths[1]?.value ?? 0) / cellMeters, 3)} celdas de ${cellMeters} m. ` +
      "El compositor coloca sobre la retícula de celdas del dominio, no sobre una retícula propia.",
  },
  doorScale: {
    value: {
      widthMeters: doorWidths[0]?.value ?? null,
      heightMeters: doorHeights[0]?.value ?? null,
    },
    unit: "m",
    status: "enmendado",
    evidence: [
      evidence(
        doorModules.map(
          (module) =>
            `${module.id}: ${module.nominalBounds.widthMeters}×${module.nominalBounds.heightMeters} m`,
        ),
        "hueco de puerta medido sobre la hoja real importada",
        `${CATALOG_PATH} → nominalBounds`,
      ),
      evidence(
        styleLayer.proportions.doorHeight,
        "valor canónico de la dirección aprobada, para contrastarlo con la hoja medida",
        `${STYLE_LAYER_PATH} → proportions.doorHeight`,
      ),
      evidence(
        frameModules.map(
          (module) =>
            `${module.id}: ${module.nominalBounds.widthMeters}×${module.nominalBounds.heightMeters} m`,
        ),
        "los marcos también se miden: son paneles de piso completo, no huecos a la altura de la hoja",
        `${CATALOG_PATH} → nominalBounds`,
      ),
    ],
    rationale:
      `La hoja licenciada mide ${doorHeights[0]?.value} m de alto, un ${round(
        ((doorHeights[0].value - styleLayer.proportions.doorHeight) /
          styleLayer.proportions.doorHeight) *
          100,
        1,
      )} % más que los ${styleLayer.proportions.doorHeight} m del style layer. No se escala la hoja: escalarla ` +
      `desalinearía el marco (que autoran ${[...new Set(frameModules.map((module) => module.nominalBounds.heightMeters))].join("/")} m) ` +
      "y la densidad de texeles del atlas. El perfil registra la puerta medida como valor de la IP y anota la " +
      "desviación contra proportions.doorHeight para que se corrija el style layer cuando revise un humano este spike.",
  },
  windowScale: {
    value: {
      rule: "sustituir módulo, nunca escalar",
      windowBaysMeasured: windowModules.length,
      windowBaysAtFloorHeight: windowHeightsEqualFloor.length,
      widthsMeters: [
        ...new Set(windowModules.map((module) => module.nominalBounds.widthMeters)),
      ].sort((a, b) => a - b),
    },
    status: "confirmado",
    evidence: [
      evidence(
        windowModules
          .slice(0, 6)
          .map(
            (module) =>
              `${module.id}: ${module.nominalBounds.widthMeters}×${module.nominalBounds.heightMeters} m`,
          ),
        "los módulos de ventana son crujías completas: el acristalamiento está autorado dentro del panel",
        `${CATALOG_PATH} → nominalBounds`,
      ),
      evidence(
        [
          ...new Set(windowModules.map((module) => round(module.nominalBounds.depthMeters, 3))),
        ].sort(),
        "profundidades medidas de las crujías acristaladas (el relieve del hueco, no un cristal aparte)",
        `${CATALOG_PATH} → nominalBounds.depthMeters`,
      ),
    ],
    rationale:
      `${windowHeightsEqualFloor.length} de ${windowModules.length} crujías acristaladas miden exactamente la altura de piso. ` +
      `La variedad se consigue cambiando de módulo (${windowModules.length} crujías licenciadas distintas en el ` +
      `catálogo), así que el compositor no escala ventanas en Z: escalarlas rompería el dintel contra el marco de ` +
      `${floorHeight} m.`,
  },
  bevel: {
    value: {
      modifier: false,
      authoredReliefStepsMeters: reliefSteps,
      baseWallThicknessMeters: baseWallDepth,
      measuredThicknessesMeters: wallDepths.slice(0, 8).map((bucket) => bucket.value),
    },
    unit: "m",
    status: "confirmado",
    evidence: [
      evidence(
        wallDepths.slice(0, 8),
        "espesores de fachada medidos al importar: el relieve viene autorado en la geometría",
        `${CATALOG_PATH} → nominalBounds.depthMeters`,
      ),
    ],
    rationale:
      (reliefSteps.length
        ? "Las fuentes resuelven el filo con pasos de perfil de " +
          `${reliefSteps[0]}–${reliefSteps[reliefSteps.length - 1]} m (zócalos, remates, marcos), no con bisel. `
        : `Ningún panel medido aporta pasos sobre el espesor base de ${baseWallDepth} m: el relieve lo ponen los remates. `) +
      "Añadir un modificador de bisel en el compositor duplicaría triángulos sin cambiar la lectura a la escala de " +
      "trabajo (§29 pide 0,5×/1×/2×). El perfil declara bisel = ninguno y lo justifica con los pasos ya autorados.",
  },
  roofOverhangMeters: {
    value: {
      min: overhangs.length ? overhangs[0].projectionMeters : null,
      max: overhangs.length ? overhangs[overhangs.length - 1].projectionMeters : null,
    },
    unit: "m",
    status: "confirmado",
    evidence: [
      evidence(
        overhangs,
        "vuelo = profundidad medida de la cornisa menos el espesor de pared base " +
          `(${baseWallDepth} m): lo que sobresale del plano de fachada`,
        `${CATALOG_PATH} → nominalBounds.depthMeters de los módulos role=cornice`,
      ),
      evidence(
        modules
          .filter((module) => module.category === "roof" && module.role === "flat")
          .map(
            (module) =>
              `${module.id}: ${module.nominalBounds.widthMeters}×${module.nominalBounds.depthMeters} m`,
          ),
        "las cubiertas planas no vuelan: son losas a hueso de la crujía",
        `${CATALOG_PATH} → nominalBounds`,
      ),
    ],
    rationale:
      "El vuelo de cornisa utilizable está entre los dos extremos medidos. El compositor elige un valor dentro de la " +
      "banda según la familia; no inventa un vuelo que la geometría licenciada no pueda apoyar.",
  },
  materialRoughness: {
    value: {
      canonicalOverride: treatment.roughness,
      measuredOrmBand: [quantile(ormRoughnessMeans, 0), quantile(ormRoughnessMeans, 1)],
      scalarFactorsByPack: scalarRoughnessByPack,
      perFamily: Object.fromEntries(
        familyRecords
          .filter((record) => record.present)
          .map((record) => [
            record.family,
            {
              ormChannelG: record.roughnessMeasured.ormChannelG,
              scalarFactor: record.roughnessMeasured.scalarFactor,
              preservedWhenLinked: true,
            },
          ]),
      ),
    },
    status: "confirmado",
    evidence: [
      evidence(
        measurements.imageSamples
          .filter((entry) => entry.name.endsWith("_ORM"))
          .map((entry) => `${sampleLabel(entry)}: G=${entry.statistics.channelMeans.g}`),
        "media del canal G de cada mapa ORM: la rugosidad real de la fuente, no el factor del material",
        `${measurementsPath} → imageSamples[].statistics.channelMeans.g`,
      ),
      evidence(
        scalarRoughnessByPack,
        "factores de Roughness por pack donde el socket NO está enlazado: son los únicos que el override toca",
        `${measurementsPath} → materialReport[].surface.Roughness.value`,
      ),
    ],
    rationale:
      `El override canónico (${treatment.roughness}) sólo se aplica a sockets NO enlazados ` +
      "(runtime_asset.py:669-672): unifica los factores planos " +
      `(${scalarRoughnessByPack.join("; ")}) y respeta los ORM enlazados, cuyas medias reales (${quantile(ormRoughnessMeans, 0)}–${quantile(ormRoughnessMeans, 1)}) ` +
      "ya caen dentro de la banda que la dirección acepta. Por eso el perfil no fija una rugosidad única: §11 prohíbe " +
      "aplanar todos los materiales y la pipeline ya preserva el relieve cuando existe.",
  },
  materialMetallic: {
    value: {
      canonicalOverride: treatment.metallic,
      perFamily: Object.fromEntries(
        familyRecords
          .filter((record) => record.present)
          .map((record) => [
            record.family,
            {
              ormChannelB: record.metallicMeasured.ormChannelB,
              scalarFactor: record.metallicMeasured.scalarFactor,
            },
          ]),
      ),
    },
    status: "confirmado",
    evidence: [
      evidence(
        measurements.imageSamples
          .filter((entry) => entry.name.endsWith("_ORM"))
          .map((entry) => `${sampleLabel(entry)}: B=${entry.statistics.channelMeans.b}`),
        "media del canal B de cada ORM = metallic medido de la fuente",
        `${measurementsPath} → imageSamples[].statistics.channelMeans.b`,
      ),
    ],
    rationale:
      "Casi todas las fuentes son dieléctricas (B≈0), así que el override a 0 es inofensivo; pero los ORM con " +
      `B>0,01 (${metallicSources.join(", ")}) vienen ENLAZADOS, donde el override no toca nada. ` +
      "El perfil fija la regla: metallic se preserva si la fuente lo enlaza, y sólo se aplana en los factores " +
      "planos. Es el canal que separa metal de piedra cuando el albedo no lo hace (ver separacion).",
  },
  saturationAndValue: {
    value: {
      mechanism: `externalTreatment v${treatment.version} aplicado por style_pixels() sobre el atlas de Base Color`,
      global: treatment.global,
      buildingScopedBands: buildingBands,
      perFamily: separableFamilies.map((family) => ({
        family,
        hueDegrees: family.hueDegrees,
        saturation: family.saturation,
        value: family.value,
        inputSaturation: family.inputSaturation,
        inputValue: family.inputValue,
        fullyTreatedToday: family.reachedByTreatment,
      })),
      atlases: colorTextures.map((target) => ({
        image: target.image,
        textureFile: target.filePath,
        dominantPredicted: {
          hueDegrees: target.hueDegrees,
          saturation: target.saturation,
          value: target.value,
        },
        dominantInput: {
          hueDegrees: target.inputHueDegrees,
          saturation: target.inputSaturation,
          value: target.inputValue,
        },
        bandsClaimingIt: target.bands,
        windowGlow: target.windowGlow,
      })),
    },
    status: "confirmado",
    evidence: [
      evidence(
        measurements.imageSamples
          .filter((entry) => entry.hueMeaningful && entry.statistics?.hueBuckets?.length)
          .map(
            (entry) =>
              `${sampleLabel(entry)}: ${entry.statistics.hueBuckets
                .map(
                  (bucket) =>
                    `${bucket.hue} ${bucket.share}→H${bucket.meanHueDegrees ?? "n/a"} S${bucket.meanSaturation} V${bucket.meanValue}`,
                )
                .join(", ")}`,
          ),
        "media HSV por familia de texeles (buckets ≥ 2 % del atlas), con media de tono circular",
        `${measurementsPath} → imageSamples[].statistics.hueBuckets`,
      ),
      evidence(
        preview.images
          .filter((image) => image.buckets.length)
          .map(
            (image) =>
              `${sampleLabel(image)}: ${image.buckets
                .map((bucket) => `${bucket.hue} ${bucket.claimedByBand}→V${bucket.predicted.value}`)
                .join(", ")}`,
          ),
        "destino después de pasar por `style_pixels(…, kind=building)`, es decir el mismo código del render",
        `${PREVIEW_SCRIPT} → claimedByBand / predicted`,
      ),
    ],
    rationale:
      "Los destinos no se eligen a ojo: son el resultado de meter los colores medidos de las fuentes en el " +
      "tratamiento aprobado. Así el perfil puede prometer un HSV por familia y, además, detectar dónde el tratamiento " +
      "canónico no llega a la textura (ver packCoexistence).",
  },
  detailDensity: {
    value: {
      trianglesPerModule: {
        p50: quantile(
          modules.map((module) => module.measured.triangles),
          0.5,
        ),
        p90: quantile(
          modules.map((module) => module.measured.triangles),
          0.9,
        ),
        max: Math.max(...modules.map((module) => module.measured.triangles)),
      },
      facadeTrianglesPerSquareMeter: {
        p50: quantile(facadeAreas, 0.5),
        p90: quantile(facadeAreas, 0.9),
      },
      budgetReference: {
        maxBinaryBytes: readJson(ASSET_METRICS_PATH).budget.maxBinaryBytes,
        policy: "D-081: ningún binario nuevo por encima del tope sin LFS",
      },
    },
    unit: "triángulos",
    status: "confirmado",
    evidence: [
      evidence(
        modules
          .slice()
          .sort((a, b) => b.measured.triangles - a.measured.triangles)
          .slice(0, 5)
          .map(
            (module) =>
              `${module.id}: ${module.measured.triangles} tri / ${module.nominalBounds.widthMeters}×${module.nominalBounds.depthMeters}×${module.nominalBounds.heightMeters} m`,
          ),
        "conteo de triángulos medido por módulo en Blender (Σ de las mallas del selector)",
        `${CATALOG_PATH} → measured.triangles`,
      ),
    ],
    rationale:
      "No hay tope de triángulos declarado en el repo; el presupuesto vinculante es de binario (D-081). El perfil " +
      "registra la banda medida para que el compositor no apile módulos de máximo detalle en un mismo alzado y para " +
      "que V.f.5 reporte la densidad real de cada candidato.",
  },
  propScale: {
    value: {
      characterHeightMeters: styleLayer.proportions.characterHeight,
      ratioBand: {
        min: quantile(
          propRatios.map((row) => row.ratioToCharacter),
          0,
        ),
        p50: quantile(
          propRatios.map((row) => row.ratioToCharacter),
          0.5,
        ),
        max: quantile(
          propRatios.map((row) => row.ratioToCharacter),
          1,
        ),
      },
      measured: propRatios,
    },
    unit: "ratio",
    status: "confirmado",
    evidence: [
      evidence(
        propRatios.slice(0, 12),
        "altura medida de cada elemento intrínseco o de apoyo frente a la altura de personaje canónica",
        `${CATALOG_PATH} → nominalBounds.heightMeters`,
      ),
      evidence(
        propRatios
          .slice()
          .sort((a, b) => a.ratioToCharacter - b.ratioToCharacter)
          .slice(0, 2)
          .map((row) => `${row.id}: ${row.heightMeters} m = ${row.ratioToCharacter}× personaje`),
        "los dos extremos inferiores de la banda, que son los que un humano leería como fuera de escala",
        `${CATALOG_PATH} → nominalBounds.heightMeters`,
      ),
    ],
    rationale:
      `La escala de props se ancla al personaje de ${styleLayer.proportions.characterHeight} m que ya usa la ciudad. ` +
      "Las razones medidas caen en una banda continua, sin elementos por encima de una planta baja mal medidos: el " +
      "compositor escala props sólo por familia y verifica la razón contra esta banda, no contra una intuición. " +
      "Los props que exigen contexto de parcela (valla, jardín, acceso) no entran aquí: §22 los deja en el sistema " +
      "de grounds de V.d-7C y este perfil no lo duplica.",
  },
  camera: {
    value: {
      projection: styleLayer.camera.projection,
      azimuthDegrees: styleLayer.camera.azimuthDegrees,
      elevationDegrees: styleLayer.camera.elevationDegrees,
      rollDegrees: styleLayer.camera.rollDegrees,
      framingRule:
        "orthoScale = ancho proyectado del candidato × margen mediano observado en los jobs embarcados",
      observedMargins: framingObserved,
      marginsNotMeasurable: framingUnmeasured,
      marginBand: {
        min: quantile(observedMargins, 0),
        p50: medianMargin,
        max: quantile(observedMargins, 1),
      },
      medianMargin,
      targetZObserved: targetZHistogram,
      suggestedPerFamily: familyFraming,
      pixelsPerMeterObserved: [
        ...new Set(framingObserved.map((row) => row.pixelsPerMeter).filter(Boolean)),
      ],
    },
    status: "confirmado",
    evidence: [
      evidence(
        distinctCamera,
        "proyección y ángulos de todas las entradas de edificio en el metadato embarcado",
        `${METADATA_PATH} → camera`,
      ),
      evidence(
        framingObserved.map(
          (row) =>
            `${row.assetId}: orthoScale ${row.orthoScale} sobre ${row.projectedWidthMeters} m proyectados ` +
            `(envolvente real ${row.measuredEnvelopeMeters.join("×")} m) → margen ${row.margin}`,
        ),
        "margen de encuadre = orthoScale del job / ancho proyectado del asset REAL, medido desde el inventario; " +
          "el ancho proyectado de la isométrica canónica es (w+d)·sin 45°",
        `${ASSET_JOBS_PATH} → camera.orthoScale × ${INVENTORY_PATH} → normalized.sizeMeters`,
      ),
      evidence(
        framingObserved.map(
          (row) => `${row.assetId}: ${row.fillRatioAgainstFootprint} del ancho de su huella`,
        ),
        "fracción del ancho de huella que el asset licenciado realmente ocupa: los edificios embarcados no llenan " +
          "la huella que declaran, por eso el margen se mide contra la geometría y no contra la huella",
        `${ASSET_JOBS_PATH} → footprint vs ${INVENTORY_PATH} → normalized.sizeMeters.width`,
      ),
      evidence(
        targetZHistogram.map((bucket) => `targetZ ${bucket.value} m en ${bucket.count} jobs`),
        "altura del punto de mira declarada job a job",
        `${ASSET_JOBS_PATH} → camera.targetZ`,
      ),
    ],
    rationale:
      `Todos los edificios embarcados comparten ${distinctCamera[0]}; el perfil hereda el rig y deriva el encuadre por ` +
      `familia con el margen mediano ${medianMargin} (banda ${quantile(observedMargins, 0)}–${quantile(observedMargins, 1)}) ` +
      "en lugar de inventar una distancia. El margen es una razón, no una constante: los candidatos sí llenan su huella " +
      "de dominio, así que su orthoScale será mayor que el de los archivos sueltos de V.a3 y eso es esperable. " +
      "`targetZ` se registra como banda observada porque no sigue una fórmula derivable (§10 prohíbe inventarla): " +
      "el compositor arranca con el valor observado para la huella más parecida y lo juzga el contacto sheet de V.f.5. " +
      "Las huellas de destino se leen del catálogo de dominio y no se redefinen (§2).",
  },
  lighting: {
    value: {
      ...styleLayer.lighting,
      shadow: styleLayer.shadow,
      rendering: styleLayer.rendering,
      acceptance: treatment.acceptance,
    },
    status: "confirmado",
    evidence: [
      evidence(
        {
          sha256: sha256(STYLE_LAYER_PATH),
          palette: styleLayer.palette,
          treatmentVersion: treatment.version,
        },
        "hash del archivo de dirección de estilo canónico del que se copian luz, sombra y rendering",
        STYLE_LAYER_PATH,
      ),
      evidence(
        shippedTreatment.map(
          (entry) => `${entry.assetId}/${entry.state}: ${JSON.stringify(entry.styleLayer)}`,
        ),
        "el metadato de cada edificio embarcado registra el tratamiento v6 que produjo este mismo rig, " +
          "incluidas las ventanas encendidas por atlas",
        `${METADATA_PATH} → styleLayer`,
      ),
    ],
    rationale:
      "Los candidatos del spike se renderizan con la luz aprobada, no con una nueva: si la comparación con los assets " +
      "en runtime no fuese bajo el mismo rig, la revisión humana mediría luz en vez de geometría.",
  },
  massingGrid: {
    value: {
      offGridMasses,
      rule: "no estirar masas: elegir el módulo cuyo alto cae en la retícula de pisos",
    },
    status: "confirmado",
    evidence: [
      evidence(
        massHeights,
        "altura medida de cada masa completa frente a múltiplos de la altura de piso",
        `${CATALOG_PATH} → nominalBounds.heightMeters`,
      ),
    ],
    rationale:
      `${offGridMasses.length} de ${massHeights.length} masas licenciadas no caen en la retícula de ${floorHeight} m. ` +
      "El compositor decide con los datos: o usa la masa tal cual (y la azotea no alineará con el paso de piso) o " +
      "compone la masa con paneles. Escalar una masa para forzar la retícula deformaría sus marcos, así que está prohibido.",
  },
};

// ---------------------------------------------------------------- coexistencia de packs (§11)
const jobsBySourceId = new Map();
for (const job of assetJobs.jobs.filter(
  (entry) => entry.kind === "building" && entry.source.sourceId,
)) {
  const list = jobsBySourceId.get(job.source.sourceId) ?? [];
  list.push(job);
  jobsBySourceId.set(job.source.sourceId, list);
}

const mechanismMeasured = [...packs.values()]
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId))
  .map((pack) => {
    const jobs = jobsBySourceId.get(pack.sourceId) ?? [];
    const packModules = [...pack.moduleIds].map((id) => moduleReach.get(id));
    const materialReach = [...pack.materialDetail.entries()]
      .map(([name, detail]) => ({
        material: name,
        family: familyOf(name),
        baseColorChains: [...detail.chains]
          .map(([chain, instances]) => `${chain} ×${instances}`)
          .sort(),
        colorTextures: [...detail.colorTextures].map(nameOfTexture).sort(),
        colorTextureFiles: [...detail.colorTextures].sort(),
        roughness: [...detail.roughness].sort((a, b) => a - b),
        modulesWithAtlasDirect: detail.modulesReached.size,
        modulesRaw: detail.modulesRaw.size,
        // El tratamiento recorre la cadena del socket, no el nombre: el mismo material puede estar
        // alcanzado en un archivo de la fuente y en bruto en otro.
        splitWithinPack: detail.modulesReached.size > 0 && detail.modulesRaw.size > 0,
        reachedByTreatment: detail.modulesRaw.size === 0 && detail.modulesReached.size > 0,
      }))
      .sort((a, b) => a.material.localeCompare(b.material));
    return {
      pack: pack.sourceId,
      license: pack.license,
      moduleCount: pack.moduleIds.size,
      materials: pack.materialNames.size,
      materialsReachedByTreatment: materialReach
        .filter((row) => row.reachedByTreatment)
        .map((row) => row.material),
      materialsRawAlways: materialReach
        .filter((row) => !row.reachedByTreatment)
        .map((row) => row.material),
      materialsSplitWithinPack: materialReach
        .filter((row) => row.splitWithinPack)
        .map((row) => row.material),
      modulesFullyTreated: packModules.filter((entry) => entry.raw === 0).length,
      modulesWithRawMaterial: packModules.filter((entry) => entry.raw > 0).length,
      rawModuleExamples: packModules
        .filter((entry) => entry.raw > 0)
        .slice(0, 6)
        .map(
          (entry) =>
            `${entry.pack === pack.sourceId ? entry.sourcePath.split("/").pop() : ""}: ` +
            `${entry.raw} de ${entry.raw + entry.treated} materiales en bruto`,
        ),
      mixesTreatmentLadders:
        packModules.some((entry) => entry.raw === 0) && packModules.some((entry) => entry.raw > 0),
      baseColorChains: [...pack.baseColorChains].sort(),
      materialReach,
      colorTextures: [...pack.colorImages].map(nameOfTexture).sort(),
      colorTextureFiles: [...pack.colorImages].sort(),
      ormImages: [...pack.ormImages].sort(),
      otherImages: [...pack.otherImages].sort(),
      scalarRoughness: [...pack.scalarRoughness].sort(),
      shippedJobs: jobs.map(
        (job) =>
          `${job.assetId}${shippedAssetIds.has(job.assetId) ? " (embarcado)" : " (sin metadato embarcado)"}`,
      ),
    };
  });

const packsPartlyRaw = mechanismMeasured.filter((row) => row.mixesTreatmentLadders);
/** Módulos cuyo material NO está cubierto hoy por el tratamiento: el listador que el compositor puede usar. */
const modulesRawList = [...moduleReach.values()]
  .filter((entry) => entry.raw > 0)
  .sort((a, b) => a.pack.localeCompare(b.pack) || a.sourcePath.localeCompare(b.sourcePath))
  .map(
    (entry) =>
      `${entry.sourcePath.replace("blender_artist/staging/", "")} (${entry.pack}): ${entry.raw} de ` +
      `${entry.raw + entry.treated} materiales con Base Color fuera de la banda`,
  );
const atlasOnlyPacks = [...packs.values()]
  .filter((pack) => [...pack.materialNames].every((name) => familyOf(name) === "atlas"))
  .map((pack) => ({
    pack: pack.sourceId,
    colorTextures: [...pack.colorImages].map(nameOfTexture).sort(),
    colorTextureFiles: [...pack.colorImages].sort(),
  }));
const pbrPacks = [...packs.values()]
  .filter((pack) => [...pack.materialNames].some((name) => familyOf(name) !== "atlas"))
  .map((pack) => pack.sourceId);
/** Cadena de nodos de cada textura de color: si ninguna material la lleva directa a Base Color,
 *  el tratamiento canónico no la alcanza y su destino medido es un objetivo, no el render de hoy. */
const textureReach = [...imageReach.entries()]
  .map(([fileKey, reach]) => {
    const target = textureTarget(fileKey);
    return {
      image: nameOfTexture(fileKey),
      textureFile: fileKey,
      modulesWithAtlasDirect: [...reach.reached].sort(),
      modulesWithAtlasMixed: [...reach.raw].sort(),
      reachedByTreatment: reach.reached.size > 0,
      rawForEveryModule: reach.reached.size === 0,
      // Donde conviven las dos cadenas, el mismo atlas se remapa en unos módulos y en otros no: la
      // diferencia de brillo se lee entre módulos contiguos del mismo alzado, no entre packs.
      splitAcrossModules: reach.reached.size > 0 && reach.raw.size > 0,
      modulesReached: reach.reached.size,
      modulesRaw: reach.raw.size,
      inputValue: target?.inputValue ?? null,
      treatedValue: target?.value ?? null,
      rawIsBrighterBy:
        target && target.inputValue !== null && target.value !== null
          ? round(target.inputValue - target.value, 3)
          : null,
    };
  })
  .sort(
    (a, b) =>
      Number(b.splitAcrossModules) - Number(a.splitAcrossModules) ||
      Number(b.reachedByTreatment) - Number(a.reachedByTreatment) ||
      a.image.localeCompare(b.image),
  );
const unreachedTextures = textureReach.filter((row) => row.rawForEveryModule);
const splitTextures = textureReach.filter((row) => row.splitAcrossModules);
/** Familias cuyo color medido existe, pero no en TODAS las instancias de módulo: hoy se renderizan a
 *  dos escaleras de brillo y su separación por albedo sólo vale en el lado tratado. */
const familiesPartlyTreated = familyRecords
  .filter((family) => family.reachedByTreatment === false)
  .map((family) => ({ family: family.family, treatmentReach: family.treatmentReach }));
/** Texturas cuyo nombre de datablock no es único: varios archivos licenciados comparten nombre. */
const collidingTextureNames = [...new Set(measurements.imageSamples.map((entry) => entry.name))]
  .map((name) => ({
    name,
    files: measurements.imageSamples
      .filter((entry) => entry.name === name)
      .map((entry) => entry.filePath),
  }))
  .filter((row) => row.files.length > 1)
  .sort((a, b) => b.files.length - a.files.length || a.name.localeCompare(b.name));

const packCoexistence = {
  problem:
    "Los packs no comparten mecanismo de color y dentro del MegaKit tampoco, pero el grano real no es el material: " +
    "es la instancia de (módulo, material) que se importa. Medido sobre los archivos licenciados, MI_Trim, " +
    "MI_RedBrick y MI_Trim_MetalConcrete aparecen unas veces con su atlas enlazado directo a Base Color y otras " +
    "pasando antes por un MIX que lo multiplica con el color de vértice. `apply_external_treatment` mira un solo " +
    "salto del socket (runtime_asset.py:620-622), así que el MISMO nombre de material entra en la escalera nocturna " +
    "en unos módulos y se queda en su albedo de origen en otros. Kenney (`colormap`) y KayKit " +
    "(`citybits_texture`) son siempre directos: ahí el remape sí es una propiedad del pack. Ojo con el nombre: los " +
    "tres packs de Kenney traen cada uno su propio `colormap.png` y el datablock se llama igual, así que la identidad " +
    "de la textura es su archivo (ver `textureFile` en `measuredBrightnessGap.textureReach`); agruparla por nombre " +
    "atribuiría el color de uno solo a los tres.",
  rule:
    "El compositor remapea por material con las bandas canónicas y elige los módulos por su cadena medida, no por el " +
    "nombre del material: un alzado visible sólo combina módulos del mismo lado de la escalera (§11).",
  mechanismMeasured,
  packsPartlyRaw: packsPartlyRaw.map((row) => row.pack),
  modulesRawList,
  atlasOnlyPacks,
  pbrPacks,
  requiredWork:
    "V.f.4 debe extender el traversal hasta la TEX_IMAGE real que alimenta el MIX (o aplicar las bandas sobre la " +
    "imagen de entrada del mezclador) para que las instancias en bruto entren en la misma escalera de valor. Sin " +
    "eso hay que listar módulos: los de `modulesRawList` quedan fuera de los alzados que se juzguen tratados.",
  measuredBrightnessGap: {
    facadeBandPredictions: buildingBandBuckets,
    textureReach,
    texturesNeverReachedByTreatment: unreachedTextures.map((row) => row.image),
    texturesSplitAcrossModules: splitTextures.map((row) => row.image),
    nightValueCeiling: treatment.acceptance.nightValueCeiling,
    darkestValueFloor: treatment.acceptance.darkestValueFloor,
    note:
      "`rawIsBrighterBy` es cuánto queda por encima de su destino nocturno el albedo en bruto de una textura. Donde " +
      "`splitAcrossModules` es verdadero la diferencia se lee ENTRE módulos contiguos del mismo alzado (comparten " +
      "atlas, no cadena de nodos), no entre packs. El umbral `acceptance` se comprueba sobre el albedo tratado, así " +
      "que una instancia en bruto puede quedar por encima del techo nocturno sin que ningún chequeo actual lo vea.",
  },
  mixedPackRule:
    "Mientras el traversal no llegue a las cadenas MIX, cada variante compone un alzado visible con módulos cuyo " +
    "Base Color esté del mismo lado de la escalera: o todos alcanzados (`modulesFullyTreated`), o todos en bruto " +
    "(`modulesRawList`). §11 no permite que la diferencia de cadena de nodos se lea como dos temperaturas de brillo " +
    "en la misma fachada.",
  windowGlow: {
    atlasPacks: [...packs.values()].flatMap((pack) =>
      [...pack.colorImages]
        .map((fileKey) => ({
          pack: pack.sourceId,
          image: nameOfTexture(fileKey),
          textureFile: fileKey,
          windowGlow: textureTarget(fileKey)?.windowGlow ?? false,
          modulesWithAtlasDirect: imageReach.get(fileKey)?.reached.size ?? 0,
          modulesWithAtlasMixed: imageReach.get(fileKey)?.raw.size ?? 0,
        }))
        .sort((a, b) => a.image.localeCompare(b.image)),
    ),
    litWindowsObserved: shippedTreatment.map(
      (entry) =>
        `${entry.assetId}/${entry.state}: ${entry.styleLayer.litWindows} ventanas encendidas`,
    ),
    materialsWithRawInstances: [...packs.values()]
      .flatMap((pack) =>
        [...pack.materialDetail.entries()]
          .filter(([, detail]) => detail.modulesRaw.size > 0)
          .map(([name, detail]) => {
            const chains = [...detail.chains]
              .map(([chain, instances]) => `${chain} ×${instances}`)
              .sort()
              .join(", ");
            return (
              `${pack.sourceId}/${name}: Base Color ${chains}; atlas de color ` +
              `${detail.colorTextures.size ? [...detail.colorTextures].map(nameOfTexture).sort().join(", ") : "ninguno"}; ` +
              `módulos alcanzados ${detail.modulesReached.size}, en bruto ${detail.modulesRaw.size}`
            );
          }),
      )
      .sort(),
    gap:
      "El `windowGlow` canónico se calcula por texeles del atlas que el tratamiento alcanza, así que sólo enciende " +
      "en las instancias con Base Color directo. Los materiales de `materialsWithRawInstances` sacan ventana encendida " +
      "en unos módulos y en otros no, y donde el factor Roughness es plano el override canónico lo unifica, apagando " +
      "el brillo del vidrio.",
    decisionNeeded:
      "El compositor debe dar emisión a las caras de los materiales de vidrio sin atlas (familia glass en " +
      "materialFamilies) con el color canónico `paletteOverrides.window` y la misma fracción encendida " +
      "(litFraction) por hash de baricentro, o renunciar a la firma de ventana encendida en ese pack. Se decide " +
      "en V.f.4 y lo juzga el humano en V.f.5.",
  },
};

// ---------------------------------------------------------------- deudas y límites
if (collapsedPairs.length) {
  fail(
    `§11 violado: ${collapsedPairs
      .map((check) => check.pair)
      .join(
        ", ",
      )} colapsan tras el remape. No se publica un perfil que contradiga la dirección aprobada: ` +
      "hay que decidir bandas o canales antes (STOP para revisión humana, §37).",
  );
}
const profile = {
  id: PROFILE_ID,
  label: "Edificios cívicos gráficos nocturnos, compuestos con geometría licenciada",
  moduleCatalogVersion: catalog.moduleCatalogVersion,
  moduleCatalogSha256: sha256(CATALOG_PATH),
  selectionSha256: sha256(SELECTION_PATH),
  appliesToFamilies: Object.keys(catalog.families),
  parameters,
  materialFamilies: familyRecords,
  separacion: {
    rule: SEPARATION,
    rationale:
      "§11 exige que las familias " +
      `${REQUIRED_FAMILIES.join("/")} sigan siendo distinguibles. Dos familias se consideran ` +
      "separadas si difieren de forma visible por ALMENOS un canal: tono, saturación, valor, rugosidad o metallic. " +
      "Ninguna familia puede obligarse a un albedo único.",
    basis:
      "Los deltas se comparan sobre los DESTINOS que predice el tratamiento canónico aplicado a los atlas medidos, " +
      "no sobre el albedo en bruto de las instancias con Base Color mezclado (ver `scopeNote.familiesPartlyTreated`).",
    pairs: pairChecks,
    collapsedPairs,
    scopeNote: {
      atlasOnlyPacks,
      pbrPacks,
      familiesPartlyTreated,
      note:
        "La separación no opera igual en los dos mecanismos de color. En los packs de atlas único " +
        `(${atlasOnlyPacks.map((row) => row.pack).join(", ")}) la deciden las bandas de tono texel a texel: un ` +
        "solo material puede dar ladrillo en unos texeles y cristal en otros, así que esas familias se miden sobre " +
        "los buckets de la imagen, no sobre el material. En el pack PBR " +
        `(${pbrPacks.join(", ")}) la decide la cadena de nodos de cada instancia de material, y sólo separa si el ` +
        "nombre casa con la regla de familia. " +
        (familiesPartlyTreated.length
          ? `Las familias ${familiesPartlyTreated
              .map((row) => row.family)
              .join(
                ", ",
              )} tienen destino medido pero el tratamiento no alcanza todos sus módulos (ver ` +
            "`treatmentReach`): su separación por albedo es un objetivo de V.f.4, no el render de hoy."
          : "Todas las familias medidas entran hoy completas en la escalera de bandas."),
    },
    state: collapsedPairs.length ? "VIOLADA" : "satisfecha",
  },
  packCoexistence,
  knownGaps: [
    missingFamilies.length
      ? `${missingFamilies.join(", ")}: sin material licenciado en el catálogo ${catalog.moduleCatalogVersion} ` +
        `(medido sobre los ${modules.length} módulos: ningún nombre de material casa con la regla de familia). La ` +
        "familia queda reservada con el destino canónico de materialRecipes/paletteOverrides y no se usa en los 12 " +
        "candidatos."
      : null,
    untexturedFamilies.length
      ? `${untexturedFamilies.join("; ")}: la familia existe en la geometría, pero su color no vive en un atlas ` +
        "mapeable, así que §11 no puede separarla por albedo. Se decide por emisión y roughness en V.f.4."
      : null,
    collidingTextureNames.length
      ? `nombres de textura que no identifican un archivo (${collidingTextureNames
          .map((row) => `${row.name} ×${row.files.length}`)
          .join(
            ", ",
          )}): son PNG distintos con el mismo nombre de datablock, porque cada archivo se importa en una ` +
        "escena limpia. El muestreo y el remape van por ruta (`textureFile`); cualquier consumidor que agrupe por nombre " +
        "atribuiría el color de un pack a los demás."
      : null,
    shadingOnlyPairs.length
      ? `${shadingOnlyPairs.map((check) => check.pair).join(", ")}: sólo los separa el shading (rugosidad o ` +
        "metallic), no el albedo. Si V.f.4 aplanara esos canales, esas familias colapsarían."
      : null,
    unreachedTextures.length
      ? `atlas que el tratamiento no alcanza en NINGÚN módulo (${unreachedTextures
          .map((row) => `${row.image} (${row.modulesRaw} módulos)`)
          .join(
            ", ",
          )}): su destino en este perfil es un objetivo para V.f.4, medido sobre la misma textura pero ` +
        "por una cadena de nodos que el render actual no recorre."
      : null,
    splitTextures.length
      ? `atlas alcanzados sólo en parte (${splitTextures
          .map(
            (row) =>
              `${row.image}: ${row.modulesReached} módulos directos / ${row.modulesRaw} con Base Color mezclado`,
          )
          .join("; ")}): ` +
        "el valor medido en `materialFamilies` es el del lado tratado. El compositor listador debe elegir módulos " +
        "por `packCoexistence.modulesRawList`, no por nombre de material, o un mismo alzado mostrará dos temperaturas " +
        "de brillo."
      : null,
    `El bucket medio de un atlas no decide el windowGlow texel a texel: la media de una familia de tono puede caer ` +
      `bajo el umbral de la banda de cristal y aun así dejar texeles encendidos (ventanas observadas en los renders ` +
      `embarcados: ${litWindowsBand[0]}–${litWindowsBand[1]} por edificio).`,
    `proportions.doorHeight del style layer (${styleLayer.proportions.doorHeight} m) queda desactualizado contra la ` +
      `hoja medida (${doorHeights[0]?.value} m); se corrige en la documentación tras la revisión humana, no a mano ` +
      "en el JSON canónico.",
  ].filter(Boolean),
  notInScope: {
    footprints:
      "targetFootprintCells / preferredFootprint / siteRequirements / placement son autoridad del dominio; este perfil " +
      "sólo los lee para encuadrar la cámara (§2, §16).",
    promotion:
      "El perfil no promociona nada al runtime (§26); se consume en Blender para renderizar candidatos.",
    runtimeHashes: "No toca apps/web/src/generated/runtime-assets*.json (§3).",
  },
};

const output = {
  schemaVersion: 1,
  purpose:
    "V.f.2: perfiles de estilo del Building Composer. Cada parámetro está medido sobre la geometría y los materiales " +
    "reales de los módulos de vf-1 o copiado del style layer canónico; ningún valor se escribe a mano (§10, §11).",
  generator: {
    script: "scripts/build-building-style.mjs",
    measureScript: MEASURE_SCRIPT,
    previewScript: PREVIEW_SCRIPT,
    catalog: CATALOG_PATH,
    styleLayer: { path: STYLE_LAYER_PATH, sha256: sha256(STYLE_LAYER_PATH) },
    toolchain: { ...measurements.toolchain, ...preview.toolchain },
    selection: SELECTION_PATH,
  },
  provenance:
    `Geometría: ${CATALOG_PATH} (medida en Blender). Materiales: ${measurementsPath} (nodos, factores y canales ORM ` +
    `reales). Color: ${PREVIEW_SCRIPT} aplica style_layer_math.style_pixels del style layer canónico a los colores ` +
    "medidos. Cámara y luz: metadato embarcado de los edificios de V.d.",
  profiles: [profile],
  counts: {
    modules: modules.length,
    texturesSampled: measurements.imageSamples.length,
    familiesPresentInGeometry: familyRecords.filter((record) => record.present).length,
    familiesMeasuredByAlbedo: separableFamilies.length,
    familyPairsChecked: pairChecks.length,
    collapsedPairs: collapsedPairs.length,
    modulesFullyTreatedToday: modulesFullyTreated.length,
    modulesWithRawMaterial: modulesWithRawMaterial.length,
    texturesSplitAcrossModules: splitTextures.length,
  },
};

const serialized = `${JSON.stringify(output, null, 2)}\n`;
const outputPath = join(REPO_ROOT, OUTPUT_PATH);

const summary = {
  profile: PROFILE_ID,
  modules: modules.length,
  texturesSampled: measurements.imageSamples.length,
  familiesMeasuredByAlbedo: output.counts.familiesMeasuredByAlbedo,
  collapsedPairs: collapsedPairs.length,
  modulesWithRawMaterial: modulesWithRawMaterial.length,
  separacion: profile.separacion.state,
};

if (process.argv.includes("--check")) {
  const published = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (published !== serialized) {
    fail(`${OUTPUT_PATH} no es reproducible: vuelve a correr pnpm art:building-style:build`);
  }
  console.log(JSON.stringify({ status: "style-profile-unchanged", ...summary }, null, 0));
} else {
  writeFileSync(outputPath, serialized);
  console.log(
    JSON.stringify(
      { status: "style-profile-written", profilePath: OUTPUT_PATH, ...summary },
      null,
      0,
    ),
  );
}

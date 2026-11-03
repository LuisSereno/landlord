#!/usr/bin/env node
/**
 * Validador del catálogo de módulos del Building Composer (V.f.1, §7).
 *
 * Regla de fondo: un módulo no es válido porque el JSON lo afirme, sino porque la geometría que
 * declara existe de verdad en un archivo licenciado ya registrado. Por eso cada comprobación
 * contrasta el catálogo con dos medidas independientes de Blender: el inventario de V.f.0 (archivo
 * completo) y la pasada de V.f.1 (selección del módulo). Si alguna diverge, hay mentiras en el
 * catálogo y el gate falla.
 *
 * Falla (§7): sourceId inexistente · sourcePath fuera de staging · licencia no permitida ·
 * selector inexistente · familia incompatible · bounds inválidos · anchor inválido · ID duplicado ·
 * source declarada distinta de la realmente importada · módulo puramente declarativo (sin
 * geometría real).
 * Falla además (§22): módulos de contenido contextual que duplicarían `property-grounds` de V.d-7C.
 *
 * Uso: node scripts/validate-building-modules.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = "blender_artist/manifests/building-modules.json";
const SELECTION_PATH = "blender_artist/manifests/building-modules-selection.json";
const INVENTORY_PATH = "blender_artist/manifests/building-module-inventory.json";
const SOURCES_PATH = "blender_artist/manifests/staging-sources.json";

const STAGING_PREFIX = "blender_artist/staging/";
const ALLOWED_LICENSES = ["CC0-1.0"];
const ALLOWED_CONVENTIONS = new Set([
  "centered",
  "positive-from-origin",
  "negative-from-origin",
  "offset",
  "degenerate",
]);
const ALLOWED_DATUMS = new Set(["authored_object_origin", "normalized_import_root"]);
const ALLOWED_FRONT_AXES = new Set(["+Y", "-Y", "symmetric-Y"]);
const BOUNDS_TOLERANCE_M = 0.02;
const MIN_MODULE_M = 0.05;
const MAX_MODULE_M = 60;
const MAX_GROUND_LIFT_M = 5;

/**
 * §22: el Building Composer compone EDIFICIOS. Todo lo que pertenezca al entorno de la parcela
 * (cercas, jardín, accesos rodados, contenedores, vegetación) lo sigue sirviendo `property-grounds`
 * de V.d-7C y no puede colarse como módulo intrínseco: duplicaría el sistema y rompería la
 * separación. Se comprueba contra id, rol y ruta real del archivo, no contra la nota humana.
 */
const CONTEXTUAL_DENYLIST = [
  /\bfence\b|boundary|\bgate\b/i,
  /\bhedge\b|\bplanter\b|flower|garden|vegetat|\btree\b|shrub|grass|\bpark\b|\bjardin\b|\barbol/i,
  /driveway|sidewalk|pavement|curb_?stone|crossing|speed.?bump|road_?mark/i,
  /\bcontainer\b|contenedor|dumpster|\btrash\b|basura|waste|recycl|\bbin\b|pallet|pal\w*et|crate|\bbox\b/i,
  /street.?lamp|lamppost|traffic|sign.?post|billboard|\bkiosk\b|bench|\bpole\b/i,
  /car|vehicle|\bvan\b|truck_?park|parking/i,
];

/** Cobertura mínima por familia para que el compositor pueda variante-ary 4 edificios (§"12"). */
const MINIMUM_COVERAGE = { mass: 2, facade: 3, window: 2, door: 1, roof: 2 };

const errors = [];
const fail = (moduleId, message) => errors.push(`${moduleId}: ${message}`);

// `--catalog=` permite apuntar el gate a una copia mutada: así los tests de §32 demuestran que
// cada modo de fallo de §7 se detecta de verdad y no sólo que el catálogo bueno pasa.
const catalogArg = process.argv.slice(2).find((flag) => flag.startsWith("--catalog="));
const catalogPath = catalogArg ? catalogArg.slice("--catalog=".length) : CATALOG_PATH;
const catalog = JSON.parse(readFileSync(resolve(catalogPath), "utf8"));
const selection = JSON.parse(readFileSync(join(REPO_ROOT, SELECTION_PATH), "utf8"));
const inventory = JSON.parse(readFileSync(join(REPO_ROOT, INVENTORY_PATH), "utf8"));
const registry = JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_PATH), "utf8"));

const inventoryByPath = new Map(inventory.sources.map((entry) => [entry.path, entry]));
const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));
const families = new Set(Object.keys(catalog.families ?? {}));
const categories = new Set(catalog.categories ?? []);
const strategies = new Set(catalog.extractionStrategies ?? []);

if (catalog.generator?.toolchain?.blender !== inventory.generator?.toolchain?.blender) {
  errors.push(
    `catálogo e inventario medidos con Blender distinto (${catalog.generator?.toolchain?.blender} vs ${inventory.generator?.toolchain?.blender})`,
  );
}
if (!catalogArg && catalog.generator?.selection !== SELECTION_PATH) {
  errors.push(
    `el catálogo no declara la selección curada esperada (${catalog.generator?.selection})`,
  );
}
if (!catalog.modules?.length) errors.push("catálogo sin módulos");

const seen = new Set();
const coverage = new Map();
for (const module of catalog.modules ?? []) {
  const id = module.id ?? "(sin id)";
  // 8) ID duplicado.
  if (seen.has(id)) fail(id, "ID de módulo duplicado");
  seen.add(id);

  // Campos mínimos que exige §6.
  for (const field of [
    "id",
    "category",
    "sourceId",
    "sourcePath",
    "objectSelector",
    "nodeSelector",
    "allowedFamilies",
    "anchor",
    "nominalBounds",
    "orientation",
  ]) {
    if (module[field] === undefined || module[field] === null)
      fail(id, `campo obligatorio ausente: ${field}`);
  }
  if (!categories.has(module.category))
    fail(id, `categoría fuera del vocabulario: ${module.category}`);
  if (!strategies.has(module.extraction?.strategy)) {
    fail(id, `estrategia de extracción fuera del vocabulario: ${module.extraction?.strategy}`);
  }

  // 5) Familia incompatible.
  if (!module.allowedFamilies?.length) fail(id, "sin familias permitidas");
  for (const family of module.allowedFamilies ?? []) {
    if (!families.has(family)) fail(id, `familia no declarada en el catálogo: ${family}`);
    const key = `${family}/${module.category}`;
    coverage.set(key, (coverage.get(key) ?? 0) + 1);
  }

  // 1) sourceId inexistente + 3) licencia no permitida.
  const source = sourcesById.get(module.sourceId);
  if (!source) fail(id, `sourceId inexistente en staging-sources.json: ${module.sourceId}`);
  if (!ALLOWED_LICENSES.includes(module.license)) {
    fail(id, `licencia no permitida: ${module.license}`);
  }
  if (source && source.license !== module.license) {
    fail(
      id,
      `licencia del módulo (${module.license}) distinta de la registrada (${source.license})`,
    );
  }

  // 2) sourcePath fuera de staging.
  if (!module.sourcePath?.startsWith(STAGING_PREFIX)) {
    fail(id, `sourcePath fuera de staging: ${module.sourcePath}`);
  } else if (!existsSync(join(REPO_ROOT, module.sourcePath))) {
    fail(id, `sourcePath no existe en disco: ${module.sourcePath}`);
  }
  const entry = inventoryByPath.get(module.sourcePath);
  if (!entry) fail(id, `sourcePath sin medir en el inventario de V.f.0: ${module.sourcePath}`);

  // 9) la fuente declarada debe ser la realmente importada.
  if (entry) {
    if (entry.sourceId !== module.sourceId) {
      fail(
        id,
        `sourceId declarado (${module.sourceId}) ≠ fuente realmente importada (${entry.sourceId})`,
      );
    }
    if (entry.unitScale !== module.unitScale) {
      fail(
        id,
        `unitScale declarado (${module.unitScale}) ≠ registrado para la fuente (${entry.unitScale})`,
      );
    }
    if (entry.license !== module.license) {
      fail(id, "licencia distinta de la medida en el inventario");
    }
    if (entry.classification === "unsuitable") {
      fail(id, `fuente inhábil según el inventario: ${entry.classificationReason}`);
    }
    if ((entry.unresolvedTextures ?? []).length) {
      fail(id, `fuente con texturas sin resolver (render magenta): ${entry.unresolvedTextures[0]}`);
    }
    if (module.extraction?.classification !== entry.classification) {
      fail(
        id,
        `clasificación declarada (${module.extraction?.classification}) ≠ medida (${entry.classification})`,
      );
    }
    const fileNames = entry.hierarchy.map((record) => `${record.name}:${record.type}`);
    if (JSON.stringify(fileNames) !== JSON.stringify(module.provenance?.fileHierarchy ?? [])) {
      fail(
        id,
        "la jerarquía importada no coincide con la registrada (fuente cambiante o mal declarada)",
      );
    }
    if (module.provenance?.fileTriangles !== entry.triangles) {
      fail(id, "el recuento de triángulos del archivo no coincide con el inventario");
    }
    const knownMeshes = new Set(
      entry.hierarchy.filter((r) => r.type === "MESH").map((r) => r.name),
    );
    const declared = module.objectSelector?.meshes ?? [];
    // 4) selector inexistente.
    if (!declared.length) fail(id, "objectSelector sin ningún mesh: módulo puramente declarativo");
    for (const mesh of declared) {
      if (!knownMeshes.has(mesh)) fail(id, `selector inexistente en la fuente: ${mesh}`);
    }
    // `selectedObjects` es lo que Blender efectivamente añadió a la escena: debe ser el selector.
    if (
      JSON.stringify([...declared].sort()) !==
      JSON.stringify([...(module.measured?.selectedObjects ?? [])].sort())
    ) {
      fail(id, "los objetos realmente importados difieren del selector declarado");
    }

    // 10) geometría real: los triángulos del módulo deben salir de sumar los de sus objetos.
    const expected = entry.hierarchy
      .filter((record) => declared.includes(record.name))
      .reduce((total, record) => total + (record.triangles ?? 0), 0);
    if (module.measured?.triangles !== expected) {
      fail(
        id,
        `triángulos del módulo (${module.measured?.triangles}) ≠ suma medida de sus objetos (${expected})`,
      );
    }
    if (!module.measured?.triangles) fail(id, "módulo sin geometría real (0 triángulos)");
    if (!module.measured?.meshObjects) fail(id, "módulo sin objetos de mesh seleccionados");
    if (!module.measured?.materials?.length) fail(id, "módulo sin materiales resueltos");
    if (!module.measured?.images?.length)
      fail(id, "módulo sin texturas resueltas (quedaría magenta)");
  }

  // 6) bounds inválidos.
  const nominal = module.nominalBounds ?? {};
  // Un eje puede ser degenerado (una cubierta plana no tiene canto, un tapajuntas no tiene
  // holgura), pero sólo si Blender lo midió así: se acepta un único eje por debajo del umbral y
  // exige convención "degenerate" en ese eje. Dos ejes degenerados serían una línea: no es módulo.
  const axes = [
    ["widthMeters", "x"],
    ["depthMeters", "y"],
    ["heightMeters", "z"],
  ];
  let thin = 0;
  for (const [field, axis] of axes) {
    const value = nominal[field];
    if (!Number.isFinite(value) || value < 0) fail(id, `${field} no numérico: ${value}`);
    else if (value > MAX_MODULE_M) fail(id, `${field} fuera de escala de parcela: ${value} m`);
    else if (value < MIN_MODULE_M) {
      thin += 1;
      if (module.anchor?.convention?.[axis] !== "degenerate") {
        fail(
          id,
          `${field} = ${value} m sin que la medición declare el eje ${axis} como degenerado`,
        );
      }
    }
  }
  if (thin > 1) fail(id, `módulo degenerado en ${thin} ejes: es una línea, no un componente`);
  const measuredBounds = module.anchor?.moduleBoundsInPlacementFrameMeters;
  if (!measuredBounds) fail(id, "sin bounds medidos en el marco de colocación");
  else {
    const pairs = [
      ["widthMeters", "x"],
      ["depthMeters", "y"],
      ["heightMeters", "z"],
    ];
    for (const [field, axis] of pairs) {
      const span = measuredBounds[axis].max - measuredBounds[axis].min;
      if (Math.abs(span - nominal[field]) > BOUNDS_TOLERANCE_M) {
        fail(id, `${field} nominal (${nominal[field]}) ≠ medido (${span.toFixed(3)})`);
      }
    }
  }

  // 7) anchor inválido.
  const anchor = module.anchor ?? {};
  if (!ALLOWED_DATUMS.has(anchor.datum)) fail(id, `datum inválido: ${anchor.datum}`);
  for (const axis of ["x", "y", "z"]) {
    if (!ALLOWED_CONVENTIONS.has(anchor.convention?.[axis])) {
      fail(id, `convención inválida en ${axis}: ${anchor.convention?.[axis]}`);
    }
  }
  if (!ALLOWED_FRONT_AXES.has(anchor.frontAxis))
    fail(id, `eje frontal inválido: ${anchor.frontAxis}`);
  if (
    !Number.isFinite(anchor.originToGroundMeters) ||
    Math.abs(anchor.originToGroundMeters) > MAX_GROUND_LIFT_M
  ) {
    fail(id, `levantamiento de apoyo absurdo: ${anchor.originToGroundMeters}`);
  }
  const translation = anchor.anchorTransform?.translation ?? [];
  if (translation.length !== 3 || translation.some((value) => !Number.isFinite(value))) {
    fail(id, `anchorTransform inválido: ${JSON.stringify(translation)}`);
  } else {
    const expected = [...anchor.offsetToFootprintCenterMeters, anchor.originToGroundMeters];
    // anchorTransform debe ser derivable de los offsets medidos: si no lo es, alguien lo editó a mano.
    if (expected.some((value, index) => Math.abs(value - translation[index]) > 1e-6)) {
      fail(
        id,
        `anchorTransform ${JSON.stringify(translation)} incoherente con los offsets medidos`,
      );
    }
  }
  if (anchor.symmetricAboutFront !== (anchor.convention?.y === "centered")) {
    fail(id, "symmetricAboutFront no se deriva de la convención medida en Y");
  }
  if (!module.orientation?.allowedRotationsDegrees?.length) fail(id, "sin rotaciones permitidas");
  for (const angle of module.orientation?.allowedRotationsDegrees ?? []) {
    if (angle % 90 !== 0) fail(id, `rotación fuera de la retícula ortogonal: ${angle}°`);
  }

  // §22: nada de contenido contextual que duplicaría property-grounds.
  // Los `_` y `-` de ids y roles se convierten en espacios: si no, `shipping_container` no casa con
  // \bcontainer\b y la prohibición de §22 se salta por un guion bajo.
  const haystack = `${module.id} ${module.role ?? ""} ${module.sourcePath ?? ""}`
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  for (const pattern of CONTEXTUAL_DENYLIST) {
    if (pattern.test(haystack)) {
      fail(
        id,
        `módulo contextual prohibido por §22 (duplicaría property-grounds de V.d-7C): ${pattern}`,
      );
    }
  }
}

// La selección curada y el catálogo generado tienen que decir lo mismo (§7, modo "declarado ≠ real").
const selectionIds = new Set(selection.modules.map((module) => module.id));
for (const module of catalog.modules ?? []) {
  if (!selectionIds.has(module.id))
    fail(module.id, "módulo en el catálogo sin entrada en la selección curada");
}
for (const module of selection.modules) {
  if (seen.has(module.id)) continue;
  fail(module.id, "módulo curado ausente del catálogo generado");
}

// Cobertura por familia: sin estas piezas el compositor no puede generar 4 variantes distintas.
for (const family of families) {
  for (const [category, minimum] of Object.entries(MINIMUM_COVERAGE)) {
    const available = coverage.get(`${family}/${category}`) ?? 0;
    if (available < minimum) {
      errors.push(
        `familia ${family}: ${available} módulos de "${category}" (< ${minimum} necesarios para variantar)`,
      );
    }
  }
}

if (errors.length) {
  console.error(`El catálogo de módulos falla (${errors.length} problemas):`);
  for (const error of errors) console.error(`  · ${error}`);
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: "valid",
    catalog: catalogPath,
    modules: catalog.modules.length,
    sources: new Set(catalog.modules.map((module) => module.sourcePath)).size,
    families: [...families],
    byCategory: catalog.counts.byCategory,
  }),
);

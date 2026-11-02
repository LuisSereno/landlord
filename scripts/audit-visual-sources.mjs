import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "blender_artist/manifests/staging-sources.json");
const EXTRACTED_ROOT = path.join(ROOT, "blender_artist/staging/third_party/cc0/extracted");
const OUTPUT_DIR = path.join(ROOT, "docs/art/visual-catalog");
const MODEL_EXTENSIONS = new Set([".blend", ".dae", ".fbx", ".glb", ".gltf", ".obj", ".stl"]);
const TEXTURE_EXTENSIONS = new Set([".bmp", ".exr", ".jpeg", ".jpg", ".png", ".tga", ".webp"]);

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      b.name.localeCompare(a.name),
    )) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  return files.sort();
}

function hash(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function categoryFor(file, sourceId) {
  const value = relative(file).toLowerCase();
  const tokenized = value.replaceAll("/", "_");
  if (/avatar|character|people|human|animation|walk|idle/.test(value)) return "characters";
  if (/(?:^|[_-])(car|vehicle|truck|taxi|sedan|van)(?:[_-]|\.|$)/.test(tokenized))
    return "vehicles";
  if (/tree|nature|plant|grass|rock|bush/.test(value)) return "nature";
  if (/industrial|factory|warehouse|chimney|tank|barrel|pallet/.test(value)) return "industrial";
  if (/suburban|house|residential|home/.test(value)) return "residential";
  if (/commercial|shop|office|store|market/.test(value)) return "commercial";
  if (/(?:town.hall|school|clinic|police|fire.station|civic|municipal)/.test(value)) return "civic";
  if (/road|street|sidewalk|crossing|asphalt|paving|ground/.test(value)) return "terrain";
  if (sourceId.includes("industrial")) return "industrial";
  if (sourceId.includes("suburban")) return "residential";
  if (sourceId.includes("commercial") || sourceId.includes("downtown")) return "commercial";
  if (sourceId.includes("roads") || sourceId.includes("asphalt")) return "terrain";
  if (sourceId.includes("car_kit")) return "vehicles";
  if (sourceId.includes("nature")) return "nature";
  if (
    sourceId.includes("character") ||
    sourceId.includes("animation") ||
    sourceId.includes("rocketbox")
  )
    return "characters";
  return "props";
}

function mergeBounds(bounds, minimum, maximum) {
  if (
    !Array.isArray(minimum) ||
    !Array.isArray(maximum) ||
    minimum.length < 3 ||
    maximum.length < 3
  )
    return bounds;
  const next = bounds ?? { min: [...minimum.slice(0, 3)], max: [...maximum.slice(0, 3)] };
  for (let axis = 0; axis < 3; axis += 1) {
    next.min[axis] = Math.min(next.min[axis], minimum[axis]);
    next.max[axis] = Math.max(next.max[axis], maximum[axis]);
  }
  return next;
}

function gltfJson(file) {
  const buffer = readFileSync(file);
  if (path.extname(file).toLowerCase() === ".gltf") return JSON.parse(buffer.toString("utf8"));
  if (buffer.toString("utf8", 0, 4) !== "glTF" || buffer.length < 20) return null;
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) return null;
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/u, ""));
}

function inspectGltf(file) {
  const document = gltfJson(file);
  if (!document) return {};
  let bounds = null;
  for (const accessor of document.accessors ?? [])
    bounds = mergeBounds(bounds, accessor.min, accessor.max);
  return {
    objectCount: document.nodes?.length ?? null,
    meshCount: document.meshes?.length ?? null,
    materialCount: document.materials?.length ?? 0,
    textureCount: document.textures?.length ?? document.images?.length ?? 0,
    armature: (document.skins?.length ?? 0) > 0,
    animations: (document.animations?.length ?? 0) > 0,
    approxBounds: bounds,
    metricsSource: "gltf-structure",
  };
}

function inspectObj(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/u);
  let objectCount = 0;
  let materialCount = 0;
  let bounds = null;
  for (const line of lines) {
    if (/^(?:o|g)\s+/u.test(line)) objectCount += 1;
    else if (/^usemtl\s+/u.test(line)) materialCount += 1;
    else if (/^v\s+/u.test(line)) {
      const point = line.trim().split(/\s+/u).slice(1, 4).map(Number);
      if (point.every(Number.isFinite)) bounds = mergeBounds(bounds, point, point);
    }
  }
  return {
    objectCount: Math.max(1, objectCount),
    meshCount: null,
    materialCount,
    textureCount: null,
    armature: false,
    animations: false,
    approxBounds: bounds,
    metricsSource: "obj-text",
  };
}

function inspectModel(file) {
  const extension = path.extname(file).toLowerCase();
  try {
    if (extension === ".glb" || extension === ".gltf") return inspectGltf(file);
    if (extension === ".obj") return inspectObj(file);
  } catch (error) {
    return { inspectionError: error instanceof Error ? error.message : String(error) };
  }
  return { metricsSource: "filename-only" };
}

function sourceRoot(source) {
  if (source.extractDir) return path.join(EXTRACTED_ROOT, source.extractDir);
  return path.join(ROOT, source.path);
}

function summarize(records) {
  const countBy = (field) =>
    Object.fromEntries(
      [...new Set(records.map((record) => record[field]))]
        .sort()
        .map((value) => [value, records.filter((record) => record[field] === value).length]),
    );
  return {
    modelCount: records.length,
    formats: countBy("format"),
    categories: countBy("candidateCategory"),
  };
}

function markdownFor(inventory) {
  const lines = [
    "# Inventario de fuentes visuales",
    "",
    "> Generado por `pnpm art:sources:audit`. No edites las tablas manualmente.",
    "",
    `Fecha: ${inventory.generatedAt.slice(0, 10)}. Decisión de compra: **${inventory.purchaseDecision}**.`,
    "",
    "## Ejecutar la auditoría",
    "",
    "```bash",
    "pnpm art:staging:validate",
    "pnpm art:licenses:check",
    "pnpm art:jobs:validate",
    "pnpm art:sources:audit",
    "```",
    "",
    `Se localizaron **${inventory.totals.models} modelos** y **${inventory.totals.textures} texturas** en ${inventory.sources.length} fuentes aprobadas.`,
    "Las métricas `null` significan que el formato requiere inspección Blender; no se infieren.",
    "",
    "## Cobertura por fuente",
    "",
    "| Fuente | Licencia | Presente | Modelos | Texturas | Formatos | Categorías |",
    "|---|---|---:|---:|---:|---|---|",
  ];
  for (const source of inventory.sources) {
    lines.push(
      `| \`${source.id}\` | ${source.license} | ${source.present ? "sí" : "NO"} | ${source.summary.modelCount} | ${source.textureCount} | ${
        Object.entries(source.summary.formats)
          .map(([key, value]) => `${key} ${value}`)
          .join(", ") || "—"
      } | ${
        Object.entries(source.summary.categories)
          .map(([key, value]) => `${key} ${value}`)
          .join(", ") || "—"
      } |`,
    );
  }
  lines.push(
    "",
    "## Hallazgos",
    "",
    "- Las fuentes declaradas están físicamente disponibles cuando `Presente` indica `sí`; la guarda de staging verifica además su integridad.",
    "- El staging contiene arquitectura urbana e industrial, personajes/animaciones, vehículos, naturaleza, props y materiales.",
    "- Esta auditoría no promueve ningún asset ni declara calidad final. La selección artística ocurre en V.e.1 y posteriores.",
    "- `PURCHASE DECISION = DEFER`: el inventario no demuestra todavía un gap que satisfaga los cuatro criterios de compra.",
    "",
    "## Revisar contact sheets",
    "",
    "```bash",
    "pnpm art:sources:contact-sheets",
    "```",
    "",
    "La salida local está en `blender_artist/generated/catalog-sources/` y contiene hojas de residencial, comercial, industria, cívico, personajes, vehículos, props y naturaleza. No se versiona. La ingesta cruda de Rocketbox evidencia materiales magenta; es una señal de remapeo pendiente, no una promoción fallida.",
    "",
    "## Evidencia detallada",
    "",
    "Los registros por archivo, hashes y métricas estructurales están en [`source-inventory.json`](./source-inventory.json).",
    "",
  );
  return lines.join("\n");
}

function selectContactSheetCandidates(sources) {
  const plans = {
    residential: { sourceId: "src_kenney_city_suburban", format: "glb", include: /building/u },
    commercial: {
      sourceId: "src_kenney_city_commercial",
      format: "glb",
      include: /building/u,
      exclude: /low-detail/u,
    },
    industrial: { sourceId: "src_kenney_city_industrial", format: "glb" },
    civic: {
      sourceId: "src_quaternius_downtown_city_megakit",
      format: "gltf",
      include: /Building_/u,
    },
    vehicles: {
      sourceId: "src_kenney_car_kit",
      format: "glb",
      names: ["sedan", "taxi", "delivery", "police", "ambulance", "firetruck"],
    },
    props: {
      sourceId: "src_kaykit_city_builder_bits",
      format: "gltf",
      exclude: /(?:^base\.|building|road|car_|tree|bush)/u,
    },
    nature: {
      sourceId: "src_kenney_nature_kit",
      format: "glb",
      names: [
        "tree_default",
        "tree_detailed",
        "tree_oak",
        "plant_bushDetailed",
        "rock_largeA",
        "grass_large",
      ],
    },
  };
  const selected = Object.fromEntries(
    Object.entries(plans).map(([category, plan]) => {
      const source = sources.find((entry) => entry.id === plan.sourceId);
      let candidates = (source?.records ?? [])
        .filter((record) => record.format === plan.format)
        .filter((record) => !plan.include || plan.include.test(path.basename(record.file)))
        .filter((record) => !plan.exclude || !plan.exclude.test(path.basename(record.file)));
      if (plan.names) {
        candidates = plan.names
          .map((name) =>
            candidates.find(
              (record) => path.basename(record.file, path.extname(record.file)) === name,
            ),
          )
          .filter(Boolean);
      } else candidates = candidates.slice(0, 6);
      candidates = candidates.map((record) => ({
        sourceId: record.sourceId,
        file: record.file,
        sha256: record.sha256,
      }));
      return [category, candidates];
    }),
  );
  const quaternius =
    sources
      .find((source) => source.id === "src_quaternius_base_characters")
      ?.records.filter((record) => record.format === "gltf" && /FullBody/u.test(record.file)) ?? [];
  const rocketbox =
    sources
      .find((source) => source.id === "src_microsoft_rocketbox")
      ?.records.filter(
        (record) =>
          record.format === "fbx" &&
          /\/avatars\//u.test(record.file) &&
          !/_facial\.fbx$/u.test(record.file),
      )
      .slice(0, 4) ?? [];
  selected.characters = [...quaternius, ...rocketbox].map((record) => ({
    sourceId: record.sourceId,
    file: record.file,
    sha256: record.sha256,
  }));
  return selected;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const sources = [];
for (const source of manifest.sources) {
  const root = sourceRoot(source);
  const files =
    existsSync(root) && statSync(root).isDirectory() ? walk(root) : existsSync(root) ? [root] : [];
  const modelFiles = files.filter((file) => MODEL_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const records = modelFiles.map((file) => ({
    sourceId: source.id,
    sourcePack: path.basename(source.path),
    license: source.license,
    file: relative(file),
    format: path.extname(file).slice(1).toLowerCase(),
    bytes: statSync(file).size,
    sha256: hash(file),
    candidateCategory: categoryFor(file, source.id),
    ...inspectModel(file),
  }));
  const textureCount = files.filter((file) =>
    TEXTURE_EXTENSIONS.has(path.extname(file).toLowerCase()),
  ).length;
  sources.push({
    id: source.id,
    sourcePack: path.basename(source.path),
    license: source.license,
    sourceUrl: source.sourceUrl,
    root: relative(root),
    present: existsSync(root),
    textureCount,
    summary: summarize(records),
    records,
  });
}

const inventory = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  purchaseDecision: "DEFER",
  totals: {
    sources: sources.length,
    presentSources: sources.filter((source) => source.present).length,
    models: sources.reduce((total, source) => total + source.summary.modelCount, 0),
    textures: sources.reduce((total, source) => total + source.textureCount, 0),
  },
  contactSheetCandidates: selectContactSheetCandidates(sources),
  sources,
};

const jsonOutput = `${JSON.stringify(inventory, null, 2)}\n`;
const markdownOutput = markdownFor(inventory);
const jsonPath = path.join(OUTPUT_DIR, "source-inventory.json");
const markdownPath = path.join(OUTPUT_DIR, "source-inventory.md");
if (process.argv.includes("--check")) {
  if (!existsSync(jsonPath) || !existsSync(markdownPath))
    throw new Error("Falta el inventario generado");
  if (
    readFileSync(jsonPath, "utf8") !== jsonOutput ||
    readFileSync(markdownPath, "utf8") !== markdownOutput
  )
    throw new Error("El inventario visual no coincide con staging; ejecuta pnpm art:sources:audit");
} else {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(jsonPath, jsonOutput);
  await writeFile(markdownPath, markdownOutput);
}
process.stdout.write(`${JSON.stringify(inventory.totals)}\n`);

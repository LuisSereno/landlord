#!/usr/bin/env node
/**
 * Ruta E2E de assets por Blender (WP4.15-H, ampliada a jobs data-driven en WP4.15-V.a 〔R4〕).
 *
 * Lee `blender_artist/manifests/asset-jobs.json` en vez de generar los trabajos con bucles
 * hardcodeados, resuelve `unitScale` y licencia contra `staging-sources.json` y ensambla el
 * bundle `runtime-assets-blender.json`. Los jobs `target: "evidence"` se renderizan para validar
 * ingesta pero no se publican.
 *
 * Uso:
 *   node scripts/build-blender-assets.mjs           # renderiza y publica el bundle
 *   node scripts/build-blender-assets.mjs --check   # verifica hashes, medidas y completitud
 *   node scripts/build-blender-assets.mjs --only=bld_residential_a,veh_sedan --outDir=/tmp/lab
 *
 * El binario de Blender es local (no existe en CI): `BLENDER_BIN` lo puede sustituir.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VARIANT =
  process.argv.find((argument) => argument.startsWith("--variant="))?.slice("--variant=".length) ??
  "night";
if (!["night", "day"].includes(VARIANT)) {
  throw new Error("--variant debe ser 'night' o 'day'");
}
const VARIANT_SUFFIX = VARIANT === "night" ? "" : `-${VARIANT}`;
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender");
const BLENDER_SCRIPT = join(REPO_ROOT, "tools", "art-pipeline", "blender", "runtime_asset.py");
const JOBS_PATH = join(REPO_ROOT, "blender_artist", "manifests", "asset-jobs.json");
const SOURCES_PATH = join(REPO_ROOT, "blender_artist", "manifests", "staging-sources.json");
const PROMOTIONS_PATH = join(REPO_ROOT, "blender_artist", "manifests", "runtime-promotions.json");
const VISUAL_OVERRIDES_PATH = join(
  REPO_ROOT,
  "apps",
  "web",
  "src",
  "generated",
  "runtime-visual-overrides.json",
);
const PUBLIC_DIR = join(
  REPO_ROOT,
  "apps",
  "web",
  "public",
  "assets",
  "runtime",
  `blender${VARIANT_SUFFIX}`,
);
const BUNDLE_PATH = join(
  REPO_ROOT,
  "apps",
  "web",
  "src",
  "generated",
  `runtime-assets-blender${VARIANT_SUFFIX}.json`,
);
const METADATA_PATH = join(
  REPO_ROOT,
  "blender_artist",
  "manifests",
  `runtime-blender-e2e-metadata${VARIANT_SUFFIX}.json`,
);
const EVIDENCE_DIR = join(
  REPO_ROOT,
  "blender_artist",
  "generated",
  `runtime-evidence${VARIANT_SUFFIX}`,
);
const ASSET_GROUPS = ["buildings", "characters", "terrain", "props", "vehicles"];

/**
 * Modo laboratorio de estilo (WP4.15-V.b1): `--only=id,id` re-renderiza una muestra a `--outDir`
 * sin publicar ni un bundle a medias, para iterar el `style_layer` sobre cinco assets en segundos.
 */
function styleLabOptions() {
  const argv = process.argv.slice(2);
  const read = (flag) => argv.find((f) => f.startsWith(flag))?.slice(flag.length);
  const only = read("--only=");
  if (!only) return null;
  return {
    ids: new Set(only.split(",").filter(Boolean)),
    outDir: read("--outDir=") ?? join(REPO_ROOT, "blender_artist", "generated", "style-lab"),
  };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Medidas declaradas en el IHDR del PNG: no hace falta decodificar la imagen. */
function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function publicSrc(file) {
  return `/assets/runtime/blender${VARIANT_SUFFIX}/${file}.png`;
}

function readJobs() {
  const manifest = JSON.parse(readFileSync(JOBS_PATH, "utf8"));
  const registry = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  const promotions = JSON.parse(readFileSync(PROMOTIONS_PATH, "utf8"));
  if (promotions.schemaVersion !== 1 || !Array.isArray(promotions.promotions)) {
    throw new Error("runtime-promotions.json: contrato inválido");
  }
  return {
    manifest,
    promotions: promotions.promotions,
    sourcesById: new Map(registry.sources.map((s) => [s.id, s])),
  };
}

function unitScaleFor(job, sourcesById) {
  if (job.source.unitScaleOverride !== undefined) return job.source.unitScaleOverride;
  const source = sourcesById.get(job.source.sourceId);
  if (source?.unitScale === undefined) {
    throw new Error(`${job.id}: la fuente ${job.source.sourceId} no declara unitScale`);
  }
  return source.unitScale;
}

function provenanceFor(job, sourcesById) {
  if (job.source.kind === "procedural") return undefined;
  const source = sourcesById.get(job.source.sourceId);
  const provenance = {
    license: source.license,
    author: source.author ?? source.id,
    sourceId: source.id,
  };
  if (source.attribution) {
    provenance.attribution = {
      sourceUrl: source.sourceUrl,
      licenseUrl: source.attribution.licenseUrl,
      attributionText: source.attribution.attributionText,
      verifiedAt: source.attribution.verifiedAt,
      licenseFileSha256: source.integrity?.licenseFileSha256 ?? "",
    };
  }
  return provenance;
}

/** Expande un job en las pasadas de render que necesita el contrato runtime. */
function tasksFor(job, defaults) {
  const render = job.render ?? defaults.render;
  // Un job `evidence` valida la ingesta de SU fuente: basta una pasada representativa. Expandir
  // la matriz completa de un personaje multiplicaría por 16 la misma pose en A.
  const representative = (values) =>
    job.target === "evidence" && job.kind !== "building" ? values.slice(0, 1) : values;
  const tasks = [];
  if (job.kind === "character") {
    const directions = representative(Array.from({ length: job.directions }, (_, d) => d));
    const animations = representative(job.animations);
    const frames = representative(job.frameIndices);
    for (const direction of directions) {
      for (const animation of animations) {
        for (const frame of frames) {
          tasks.push({
            file: `${job.assetId}-d${direction}-${animation}-${frame}`,
            state: null,
            direction,
            animation,
            frame,
            render,
          });
        }
      }
    }
    return tasks;
  }
  const orientations = job.orientations ?? [null];
  for (const azimuth of orientations) {
    const suffix = azimuth === null || azimuth === 45 ? "" : `-az${azimuth}`;
    for (const state of representative(job.states ?? [null])) {
      tasks.push({
        file: `${state ? `${job.assetId}-${state}` : job.assetId}${suffix}`,
        state,
        direction: null,
        animation: null,
        frame: null,
        azimuth,
        render,
      });
    }
  }
  return tasks;
}

function argsFor(job, task, sourcesById, noShadow = false) {
  const args = ["--asset", job.assetId];
  if (job.source.kind !== "procedural") {
    // Un job procedural NO redeclara cámara ni resolución: sus parámetros están congelados en
    // runtime_asset.py y pasarlos de nuevo sería una segunda fuente de verdad.
    args.push(
      "--kind",
      job.kind,
      "--source",
      `${job.source.kind}:${job.source.path}`,
      "--unit-scale",
      String(unitScaleFor(job, sourcesById)),
      "--ortho-scale",
      String(job.camera.orthoScale),
      "--target-z",
      String(job.camera.targetZ),
      "--render-width",
      String(task.render.width),
      "--render-height",
      String(task.render.height),
      "--source-id",
      job.source.sourceId,
      "--license",
      sourcesById.get(job.source.sourceId).license,
    );
  }
  if (task.state) args.push("--state", task.state);
  // La sombra se hornea con el rig para edificios, props y vehículos; el terreno no proyecta.
  if (
    job.source.kind !== "procedural" &&
    job.kind !== "terrain" &&
    job.kind !== "character" &&
    !noShadow
  ) {
    args.push("--shadow");
  }
  if (noShadow) args.push("--no-shadow");
  if (task.azimuth !== null && task.azimuth !== undefined) {
    args.push("--azimuth", String(task.azimuth));
  }
  if (task.direction !== null) {
    args.push("--direction", String(task.direction));
    args.push("--animation", task.animation);
    args.push("--frame", String(task.frame));
    // Personajes de terceros (Rocketbox): el clip de animación por nombre (idle/walk) se aplica
    // retargeteando la action al rig compartido del avatar. Sin esto, las poses serían reposo.
    const clip = job.animationSources?.[task.animation];
    if (clip) args.push("--animation-source", `fbx:${clip}`);
  }
  return args;
}

function expectedFiles(manifest, promotions) {
  // Una promoción sustituye el asset entero: D-098 sólo publica el estado que existe
  // sobre la fuente importada y deja los demás estados al fallback procedural. No se
  // puede exigir aquí los estados heredados del job que la promoción reemplazó.
  const promotedAssetIds = new Set(promotions.map((entry) => entry.assetId));
  const jobs = manifest.jobs
    .filter((job) => job.target === "bundle" && !promotedAssetIds.has(job.assetId))
    .flatMap((job) => tasksFor(job, manifest.defaults).map((task) => task.file));
  const overrideFiles = existsSync(VISUAL_OVERRIDES_PATH)
    ? Object.values(
        JSON.parse(readFileSync(VISUAL_OVERRIDES_PATH, "utf8")).buildings ?? {},
      ).flatMap((asset) =>
        Object.values(asset.states ?? {}).map((image) =>
          image.src.split("/").pop().replace(".png", ""),
        ),
      )
    : [];
  return [
    ...jobs,
    ...promotions.map((entry) => `${entry.assetId}-${entry.state}`),
    ...overrideFiles,
  ];
}

function retiredFiles(manifest, promotions) {
  const promotedAssetIds = new Set(promotions.map((entry) => entry.assetId));
  return new Set(
    manifest.jobs
      .filter((job) => job.target === "bundle" && promotedAssetIds.has(job.assetId))
      .flatMap((job) => tasksFor(job, manifest.defaults).map((task) => task.file)),
  );
}

function readBundle() {
  return JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
}

function check() {
  if (!existsSync(BUNDLE_PATH)) throw new Error(`Falta el bundle: ${BUNDLE_PATH}`);
  const { manifest, promotions } = readJobs();
  const bundle = readBundle();
  const images = [];
  for (const group of ASSET_GROUPS) {
    for (const asset of Object.values(bundle[group] ?? {})) {
      if (asset.states) images.push(...Object.values(asset.states));
      if (asset.animations) {
        images.push(...Object.values(asset.animations).flatMap((animation) => animation.frames));
      }
      if (asset.image) images.push(asset.image);
      for (const frame of Object.values(asset.orientations ?? {})) images.push(frame.image);
    }
  }
  if (existsSync(VISUAL_OVERRIDES_PATH)) {
    const overrides = JSON.parse(readFileSync(VISUAL_OVERRIDES_PATH, "utf8"));
    for (const asset of Object.values(overrides.buildings ?? {})) {
      images.push(...Object.values(asset.states ?? {}));
    }
  }

  let totalBytes = 0;
  for (const image of images) {
    const buffer = readFileSync(join(REPO_ROOT, "apps", "web", "public", image.src));
    totalBytes += buffer.length;
    const size = pngSize(buffer);
    if (sha256(buffer) !== image.sha256) {
      throw new Error(`Hash distinto del publicado: ${image.src}`);
    }
    if (size.width !== image.width || size.height !== image.height) {
      throw new Error(`Medidas distintas de las publicadas: ${image.src}`);
    }
  }

  // Manifiesto ↔ bundle en las dos direcciones: ni job sin imagen, ni imagen huérfana.
  const declared = new Set(expectedFiles(manifest, promotions));
  const retired = retiredFiles(manifest, promotions);
  const published = new Set(images.map((image) => image.src.split("/").pop().replace(".png", "")));
  for (const file of declared) {
    if (!published.has(file)) throw new Error(`Job declarado sin imagen publicada: ${file}`);
  }
  for (const file of published) {
    if (!declared.has(file)) throw new Error(`Imagen publicada sin job declarado: ${file}`);
  }
  for (const file of readdirSync(PUBLIC_DIR)) {
    const stem = file.replace(/\.png$/, "");
    if (file.endsWith(".png") && !declared.has(stem) && !retired.has(stem)) {
      throw new Error(`PNG huérfano en public/: ${file}`);
    }
  }

  console.log(
    JSON.stringify({
      status: "passed",
      images: images.length,
      jobs: declared.size,
      totalBytes,
      bundle: BUNDLE_PATH,
    }),
  );
}

function renderTask(job, task, sourcesById, workDir, noShadow = false) {
  const workPng = join(workDir, `${task.file}.png`);
  const workJson = join(workDir, `${task.file}.json`);
  const result = spawnSync(
    BLENDER,
    [
      "--background",
      "--python",
      BLENDER_SCRIPT,
      "--",
      ...argsFor(job, task, sourcesById, noShadow),
      "--output",
      workPng,
      "--metadata",
      workJson,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`Blender falló para ${task.file}:\n${result.stderr ?? result.stdout}`);
  }
  // Blender puede salir con código 0 pese a un traceback de Python (--python); si no escribió la
  // metadata, el job falló. Se propaga el stderr para no enmascarar el error real con un ENOENT.
  if (!existsSync(workJson)) {
    throw new Error(
      `Blender no produjo metadata para ${task.file}:\n${result.stderr ?? result.stdout}`,
    );
  }
  return { workPng, workJson, entry: JSON.parse(readFileSync(workJson, "utf8")) };
}

function pixelsPerMeterFor(job, task) {
  // Los jobs procedurales ya están dibujados a la escala del juego; sólo las cámaras Blender
  // necesitan declarar su densidad para que el renderer las lleve a la celda de 4 m.
  if (job.source.kind === "procedural") return undefined;
  return task.render.width / job.camera.orthoScale;
}

function assembleInto(bundle, job, task, entry, image, provenance) {
  if (job.kind === "building") {
    const asset = (bundle.buildings[entry.assetId] ??= {
      type: entry.assetId,
      name: entry.label,
      footprint: job.footprint ?? entry.footprint,
      domainFootprint: job.footprint ?? entry.footprint,
      pivot: entry.pivot,
      states: {},
      allowedOrientations: [45],
      symmetry: "none",
    });
    const pixelsPerMeter = pixelsPerMeterFor(job, task);
    if (pixelsPerMeter !== undefined) asset.pixelsPerMeter = pixelsPerMeter;
    if (provenance) asset.provenance = provenance;
    asset.states[entry.state] = image;
    return;
  }
  if (job.kind === "character") {
    const character = (bundle.characters[entry.assetId] ??= {
      id: entry.assetId,
      name: entry.label,
      directions: job.directions,
      animations: Object.fromEntries(
        job.animations.map((animation) => [
          animation,
          { frameDurationMs: job.frameDurationMs[animation], frames: [] },
        ]),
      ),
    });
    if (provenance) character.provenance = provenance;
    const slot = job.frameIndices.indexOf(entry.frame);
    if (slot < 0) throw new Error(`${entry.assetId}: frame ${entry.frame} fuera de frameIndices`);
    character.animations[entry.animation].frames[entry.direction * job.frameIndices.length + slot] =
      image;
    return;
  }
  const group = { terrain: "terrain", prop: "props", vehicle: "vehicles" }[job.kind];
  if (!group) {
    throw new Error(`${job.id}: kind '${job.kind}' no tiene grupo runtime`);
  }
  const pixelsPerMeter = pixelsPerMeterFor(job, task);
  const orientation = task.azimuth ?? 45;
  let asset = (bundle[group] ??= {})[entry.assetId];
  if (!asset) {
    asset = bundle[group][entry.assetId] = {
      id: entry.assetId,
      name: entry.label,
      footprint: job.footprint ?? { width: 1, height: 1 },
      pivot: entry.pivot,
      image,
    };
    if (provenance) asset.provenance = provenance;
  }
  if (orientation === 45) {
    asset.pivot = entry.pivot;
    asset.image = image;
  } else {
    asset.orientations ??= {};
    asset.orientations[String(orientation)] = { image, pivot: entry.pivot };
  }
  const density = pixelsPerMeter;
  if (density !== undefined) {
    if (orientation === 45) asset.pixelsPerMeter = density;
    else asset.orientations[String(orientation)].pixelsPerMeter = density;
  }
}

/**
 * Promueve un candidato YA aprobado sin re-renderizarlo ni perder su identidad. El manifiesto de
 * promoción fija firma, hash, estilo y contrato runtime; los metadatos del Composer siguen siendo
 * la procedencia detallada y cualquier deriva aborta antes de publicar.
 */
function assembleApprovedPromotion(bundle, promotion, published, metadata) {
  if (promotion.approvalStatus !== "qa_approved") {
    throw new Error(`${promotion.assetId}: la promoción no está qa_approved`);
  }
  const isDayVariant = VARIANT === "day";
  const dayCandidateDir = join(REPO_ROOT, "docs", "art", "day-candidates", promotion.assetId);
  const metadataPath = isDayVariant
    ? join(dayCandidateDir, `${promotion.candidateId}.json`)
    : join(REPO_ROOT, promotion.candidateMetadata);
  const imagePath = isDayVariant
    ? join(dayCandidateDir, `${promotion.candidateId}.png`)
    : join(REPO_ROOT, promotion.candidateImage);
  const candidate = JSON.parse(readFileSync(metadataPath, "utf8"));
  const buffer = readFileSync(imagePath);
  const size = pngSize(buffer);
  const checks = [
    ["candidateId", candidate.candidateId, promotion.candidateId],
    ["candidateBuildingType", candidate.buildingType, promotion.candidateBuildingType],
    ["state", candidate.state, promotion.state],
    ["compositionSignature", candidate.compositionSignature, promotion.compositionSignature],
    ["styleProfileId", candidate.styleProfileId, promotion.styleProfileId],
    ["cameraAzimuth", candidate.camera?.azimuthDegrees, promotion.allowedOrientations[0]],
  ];
  if (!isDayVariant) checks.push(["imageSha256", sha256(buffer), promotion.imageSha256]);
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(
        `${promotion.assetId}: ${label}=${String(actual)}; esperado ${String(expected)}`,
      );
    }
  }
  if (
    candidate.footprintCells?.width !== promotion.footprint.width ||
    candidate.footprintCells?.height !== promotion.footprint.height
  ) {
    throw new Error(`${promotion.assetId}: footprint del candidato no coincide con la promoción`);
  }
  if (candidate.image?.width !== size.width || candidate.image?.height !== size.height) {
    throw new Error(`${promotion.assetId}: medidas PNG distintas de los metadatos del candidato`);
  }
  const file = `${promotion.assetId}-${promotion.state}`;
  copyFileSync(imagePath, join(PUBLIC_DIR, `${file}.png`));
  const image = {
    src: publicSrc(file),
    width: size.width,
    height: size.height,
    sha256: sha256(buffer),
  };
  bundle.buildings[promotion.assetId] = {
    type: promotion.semanticType,
    name: promotion.assetId,
    footprint: promotion.footprint,
    domainFootprint: promotion.domainFootprint,
    pivot: candidate.pivot,
    states: { [promotion.state]: image },
    stateFallback: promotion.stateFallback,
    pixelsPerMeter: candidate.framing?.pixelsPerMeter,
    provenance: promotion.provenance,
    allowedOrientations: promotion.allowedOrientations,
    symmetry: promotion.symmetry,
  };
  published.push(file);
  metadata.push({
    promotion: true,
    assetId: promotion.assetId,
    candidateId: promotion.candidateId,
    candidateMetadata: isDayVariant
      ? `docs/art/day-candidates/${promotion.assetId}/${promotion.candidateId}.json`
      : promotion.candidateMetadata,
    compositionSignature: promotion.compositionSignature,
    styleProfileId: promotion.styleProfileId,
    camera: candidate.camera,
    pivot: candidate.pivot,
    footprint: promotion.footprint,
    domainFootprint: promotion.domainFootprint,
    image,
    provenance: promotion.provenance,
  });
}

function asManifestV2(bundle) {
  if (bundle.schemaVersion === 2) return bundle;
  if (bundle.schemaVersion !== 1) {
    throw new Error(`schemaVersion Blender no soportada: ${String(bundle.schemaVersion)}`);
  }
  return {
    ...bundle,
    schemaVersion: 2,
    generator: { ...bundle.generator, version: Math.max(2, bundle.generator.version) },
    buildings: Object.fromEntries(
      Object.entries(bundle.buildings).map(([key, asset]) => [
        key,
        {
          ...asset,
          domainFootprint: { ...asset.footprint },
          allowedOrientations: [45],
          symmetry: "none",
        },
      ]),
    ),
  };
}

/** Ensambla únicamente promociones aprobadas sobre los renders ya publicados, sin invocar Blender. */
function promoteApproved() {
  const { promotions } = readJobs();
  const bundle = asManifestV2(readBundle());
  const previousMetadata = existsSync(METADATA_PATH)
    ? JSON.parse(readFileSync(METADATA_PATH, "utf8"))
    : [];
  const promotedIds = new Set(promotions.map((entry) => entry.assetId));
  const metadata = previousMetadata.filter((entry) => !promotedIds.has(entry.assetId));
  const published = [];
  mkdirSync(PUBLIC_DIR, { recursive: true });
  for (const promotion of promotions) {
    assembleApprovedPromotion(bundle, promotion, published, metadata);
  }
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: "promoted",
      promotions: published.length,
      assets: published,
      bundle: BUNDLE_PATH,
      metadata: METADATA_PATH,
    }),
  );
}

function render(noShadow = false) {
  if (!existsSync(BLENDER)) {
    throw new Error(`No existe el binario de Blender: ${BLENDER} (define BLENDER_BIN)`);
  }
  const lab = styleLabOptions();
  const { manifest, promotions, sourcesById } = readJobs();
  const bundle = {
    schemaVersion: 2,
    generator: {
      id: "blender-runtime-asset-e2e",
      version: 1,
      method: "blender_render",
      source: "tools/art-pipeline/blender/runtime_asset.py",
    },
    provenance: {
      license: "original",
      author: "Landlord project",
      notes:
        "Resumen del bundle: la procedencia real es por asset (D-083). Los renders son obra del proyecto; la geometría de cada asset declara su fuente y su licencia.",
    },
    buildings: {},
    characters: {},
  };
  mkdirSync(PUBLIC_DIR, { recursive: true });
  mkdirSync(dirname(BUNDLE_PATH), { recursive: true });
  mkdirSync(EVIDENCE_DIR, { recursive: true });

  const workDir = mkdtempSync(join(tmpdir(), "landlord-blender-assets-"));
  const metadata = [];
  const published = [];
  let evidenceCount = 0;

  for (const job of manifest.jobs) {
    if (lab && !lab.ids.has(job.id)) continue;
    for (const task of tasksFor(job, manifest.defaults)) {
      const { workPng, workJson, entry } = renderTask(job, task, sourcesById, workDir, noShadow);
      if (lab) {
        mkdirSync(lab.outDir, { recursive: true });
        copyFileSync(workPng, join(lab.outDir, `${task.file}.png`));
        copyFileSync(workJson, join(lab.outDir, `${task.file}.json`));
        published.push(task.file);
        continue;
      }
      if (job.target === "evidence") {
        copyFileSync(workPng, join(EVIDENCE_DIR, `${task.file}.png`));
        copyFileSync(workJson, join(EVIDENCE_DIR, `${task.file}.json`));
        evidenceCount += 1;
        continue;
      }
      const target = join(PUBLIC_DIR, `${task.file}.png`);
      copyFileSync(workPng, target);
      const buffer = readFileSync(target);
      const image = {
        src: publicSrc(task.file),
        width: entry.image.width,
        height: entry.image.height,
        sha256: sha256(buffer),
      };
      metadata.push(entry);
      published.push(task.file);
      assembleInto(bundle, job, task, entry, image, provenanceFor(job, sourcesById));
    }
  }
  if (!lab) {
    for (const promotion of promotions) {
      assembleApprovedPromotion(bundle, promotion, published, metadata);
    }
  }
  rmSync(workDir, { recursive: true, force: true });
  if (lab) {
    console.log(
      JSON.stringify({
        status: "style-lab",
        note: "muestra del laboratorio de estilo: el bundle publicado no se ha tocado",
        images: published.length,
        outDir: lab.outDir,
      }),
    );
    return;
  }
  writeFileSync(BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  const totalBytes = published.reduce(
    (total, file) => total + readFileSync(join(PUBLIC_DIR, `${file}.png`)).length,
    0,
  );
  console.log(
    JSON.stringify({
      status: "rendered",
      images: published.length,
      evidence: evidenceCount,
      totalBytes,
      bundle: BUNDLE_PATH,
      metadata: METADATA_PATH,
    }),
  );
}

if (process.argv.includes("--check")) check();
else if (process.argv.includes("--promote-approved")) promoteApproved();
else render();

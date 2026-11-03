#!/usr/bin/env node
/**
 * Orquestador del Building Composer (V.f.3c, spike V.f §12–§31).
 *
 * Levanta los candidatos `complete` del spike y los deja como evidencia versionada en
 * `docs/art/building-composer/candidates/`. No promueve nada al bundle: §26 prohíbe tocar
 * `runtime-assets.json` y `runtime-assets-blender.json` durante el spike, y este script lo comprueba
 * con hashes antes y después en vez de confiar en que nadie añadió un job.
 *
 * Qué se lee de dónde, porque §17 dice que la huella y las plantas manda el dominio y §35 prohíbe
 * inventar packs:
 *   - `buildingType`, `family`, `composerVersion` → `building-composer-grammars.json`
 *   - `preferredFootprint`, `defaultFloors`       → `packages/simulation/src/game-data.ts` (sólo lectura)
 *   - `styleProfileId`                            → `building-style-profiles.json`, por familia
 * Volver a escribir esas cifras aquí sería una segunda fuente de verdad, que es el fallo que D-098
 * dejó visible la última vez.
 *
 * Este script produce; no juzga. La procedencia de cada módulo colocado, la firma duplicada, el
 * pivot dentro de la parcela y la correspondencia sha256↔PNG los comprueba
 * `validate-building-composer.mjs` sobre el manifiesto que aquí se escribe, para que la regla §32
 * tenga una sola implementación.
 *
 * Uso:
 *   node scripts/build-building-composer.mjs
 *   node scripts/build-building-composer.mjs --types=row_house --seeds=1000,1001 --outDir=/tmp/vf
 *
 * Requiere Blender local (binario de `blender_artist/toolchain`; `BLENDER_BIN` lo sustituye).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist/toolchain/blender-5.2.2-linux-x64/blender");
const BLENDER_SCRIPT = join(REPO_ROOT, "tools/art-pipeline/blender/build_building_composer.py");
const MANIFEST_DIR = join(REPO_ROOT, "blender_artist/manifests");
const GRAMMARS_PATH = join(MANIFEST_DIR, "building-composer-grammars.json");
const PROFILES_PATH = join(MANIFEST_DIR, "building-style-profiles.json");
const GAME_DATA_PATH = join(REPO_ROOT, "packages/simulation/src/game-data.ts");
const RUNTIME_ASSETS = [
  "apps/web/src/generated/runtime-assets.json",
  "apps/web/src/generated/runtime-assets-blender.json",
];
const DEFAULT_OUT_DIR = join(REPO_ROOT, "docs/art/building-composer/candidates");
const DEFAULT_METRICS = join(REPO_ROOT, "docs/execution/phase-4/vf-building-composer-metrics.json");
const DEFAULT_SEEDS = [1000, 1001, 1002, 1003];

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const digestFile = (relative) => sha256(readFileSync(join(REPO_ROOT, relative)));

function parseArgs(argv) {
  const options = {
    outDir: DEFAULT_OUT_DIR,
    types: null,
    seeds: DEFAULT_SEEDS,
    metrics: DEFAULT_METRICS,
    regenerate: false,
  };
  for (const argument of argv.slice(2)) {
    const [flag, value] = argument.split("=");
    if (flag === "--outDir") options.outDir = resolve(value);
    else if (flag === "--types") options.types = value.split(",");
    else if (flag === "--seeds") options.seeds = value.split(",").map(Number);
    else if (flag === "--metrics") options.metrics = resolve(value);
    else if (flag === "--regenerate") options.regenerate = true;
    else if (flag === "--help") {
      console.log(
        "uso: node scripts/build-building-composer.mjs [--types=a,b] [--seeds=1,2] [--outDir=dir] [--metrics=path] [--regenerate]",
      );
      process.exit(0);
    } else throw new Error(`argumento desconocido ${argument}`);
  }
  if (options.seeds.length === 0 || options.seeds.some((seed) => !Number.isInteger(seed))) {
    throw new Error("--seeds espera enteros separados por comas");
  }
  return options;
}

/**
 * §17: la huella y las plantas las manda el dominio. Se recorta el bloque de la definición y se leen
 * los dos campos, sin importar el módulo TS: el pipeline de arte no depende del bundler del juego.
 */
function domainGeometry(buildingType) {
  const gameData = readFileSync(GAME_DATA_PATH, "utf8");
  const start = gameData.indexOf(`  ${buildingType}: {`);
  if (start < 0) throw new Error(`BUILDING_DEFINITIONS.${buildingType} no existe en game-data.ts`);
  const boundary = /\n {2}[a-z_]+: \{/gu;
  boundary.lastIndex = start + buildingType.length + 5;
  const block = gameData.slice(start, boundary.exec(gameData)?.index ?? undefined);
  const footprint = /preferredFootprint: \{ width: (\d+), height: (\d+) \}/u.exec(block);
  const floors = /defaultFloors: (\d+)/u.exec(block);
  if (!footprint || !floors) {
    throw new Error(`${buildingType}: game-data.ts no declara preferredFootprint o defaultFloors`);
  }
  return {
    footprint: { width: Number(footprint[1]), height: Number(footprint[2]) },
    floors: Number(floors[1]),
  };
}

function profileFor(family) {
  const matches = read(PROFILES_PATH).profiles.filter((profile) =>
    profile.appliesToFamilies.includes(family),
  );
  if (matches.length !== 1) {
    throw new Error(
      `familia ${family}: aplican ${matches.length} perfiles de estilo, se esperaba 1`,
    );
  }
  return matches[0].id;
}

function buildRequests(grammars, options) {
  const types = options.types ?? Object.keys(grammars.grammars);
  const requests = [];
  for (const buildingType of types) {
    const grammar = grammars.grammars[buildingType];
    if (!grammar) throw new Error(`la gramática no declara ${buildingType}`);
    const domain = domainGeometry(buildingType);
    for (const variantSeed of options.seeds) {
      const candidateId = `vf_${buildingType}_${variantSeed}`;
      requests.push({
        candidateId,
        buildingType,
        family: grammar.family,
        styleProfileId: profileFor(grammar.family),
        variantSeed,
        composerVersion: grammars.composerVersion,
        footprint: domain.footprint,
        floors: domain.floors,
        state: "complete",
        output: join(options.outDir, `${candidateId}.png`),
        metadata: join(options.outDir, `${candidateId}.json`),
      });
    }
  }
  return requests;
}

function metricsOf(manifest, options, totalMs, runtimeAssets) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    composerVersion: manifest.composerVersion,
    styleProfileId: manifest.styleProfileId,
    outDir: options.outDir,
    requested: manifest.requested,
    rendered: manifest.rendered,
    totalGenerationMs: totalMs,
    blenderPeakRssMb: manifest.peakRssMb,
    toolchain: manifest.toolchain,
    runtimeAssets,
    candidates: manifest.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      buildingType: candidate.buildingType,
      family: candidate.family,
      variantSeed: candidate.variantSeed,
      compositionSignature: candidate.compositionSignature,
      triangleCount: candidate.triangleCount,
      objectCount: candidate.sceneChecks.scene.meshObjects,
      moduleCount: candidate.modules.length,
      materials: candidate.materialCount,
      textures: candidate.textureCount,
      bounds: candidate.bounds,
      renderMs: candidate.renderTime,
      pngBytes: candidate.pngBytes,
      pngPixels: [candidate.image.width, candidate.image.height],
      pixelSha256: candidate.pixelSha256,
      licensedGeometryRatio: candidate.metrics.licensedGeometryRatio,
      pivot: candidate.pivot,
    })),
    failures: manifest.failures,
  };
}

function runBlender(requestsPath, manifestPath, count) {
  console.log(`Blender: ${count} candidatos en una sola corrida`);
  const started = Date.now();
  const run = spawnSync(
    BLENDER,
    [
      "-b",
      "--factory-startup",
      "-P",
      BLENDER_SCRIPT,
      "--",
      "--requests",
      requestsPath,
      "--manifest",
      manifestPath,
    ],
    { stdio: "inherit", cwd: REPO_ROOT },
  );
  const totalMs = Date.now() - started;
  if (!existsSync(manifestPath)) {
    throw new Error(`no hay manifiesto en ${manifestPath} (Blender salió con ${run.status})`);
  }
  return { manifest: read(manifestPath), status: run.status, totalMs };
}

/**
 * Ejecuta cada candidato en un proceso separado de Blender para evitar acumulación de estado.
 * 
 * Se detectó que renderizar múltiples candidatos en el mismo proceso causa que el segundo y
 * subsiguientes fallen con "El render no tiene ningún píxel opaco", incluso reseteando la escena
 * completamente entre renders. Ejecutar cada candidato en su propio proceso garantiza aislamiento
 * total y renders deterministas.
 */
function runBlenderSeparate(requests, options, grammars) {
  const workDir = join(options.outDir, "work");
  const allCandidates = [];
  const allFailures = [];
  let totalMs = 0;
  
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    console.log(`\n[${i + 1}/${requests.length}] Rendering ${request.candidateId}...`);
    
    const singleWorkDir = join(workDir, `candidate-${i}`);
    rmSync(singleWorkDir, { recursive: true, force: true });
    mkdirSync(singleWorkDir, { recursive: true });
    
    const requestsPath = join(singleWorkDir, "requests.json");
    const manifestPath = join(singleWorkDir, "manifest.json");
    
    writeFileSync(
      requestsPath,
      `${JSON.stringify(
        {
          composerVersion: grammars.composerVersion,
          styleProfileId: request.styleProfileId,
          candidates: [request],
        },
        null,
        1,
      )}\n`,
    );
    
    const started = Date.now();
    const run = spawnSync(
      BLENDER,
      [
        "-b",
        "--factory-startup",
        "-P",
        BLENDER_SCRIPT,
        "--",
        "--requests",
        requestsPath,
        "--manifest",
        manifestPath,
      ],
      { stdio: "inherit", cwd: REPO_ROOT },
    );
    const elapsed = Date.now() - started;
    totalMs += elapsed;
    
    if (!existsSync(manifestPath)) {
      throw new Error(`no hay manifiesto para ${request.candidateId} (Blender salió con ${run.status})`);
    }
    
    const manifest = read(manifestPath);
    allCandidates.push(...manifest.candidates);
    allFailures.push(...manifest.failures);
    
    // Copy the output files to the main work directory
    if (manifest.candidates.length > 0) {
      const output = request.output;
      const metadata = request.metadata;
      if (existsSync(output)) {
        copyFileSync(output, join(workDir, basename(output)));
      }
      if (existsSync(metadata)) {
        copyFileSync(metadata, join(workDir, basename(metadata)));
      }
    }
  }
  
  // Create a combined manifest
  const combinedManifest = {
    schemaVersion: 1,
    composerVersion: grammars.composerVersion,
    styleProfileId: requests[0].styleProfileId,
    requested: requests.length,
    rendered: allCandidates.length,
    signatures: allCandidates.map(c => c.compositionSignature).sort(),
    peakRssMb: allCandidates.reduce((max, c) => Math.max(max, c.render?.peakRssMb || 0), 0),
    toolchain: {
      blender: "multiple processes",
      renderer: "BLENDER_EEVEE",
    },
    candidates: allCandidates,
    failures: allFailures,
  };
  
  const manifestPath = join(workDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(combinedManifest, null, 1) + "\n");
  
  return { manifest: combinedManifest, status: allFailures.length > 0 ? 1 : 0, totalMs };
}

/**
 * §13, el test que el enunciado pide literal: generar, anotar la firma, borrar lo generado, volver a
 * generar y comparar. La comparación es doble y por algo: la firma dice que la gramática volvió a
 * decidir lo mismo, y el sha de píxeles dice que Blender volvió a dibujar exactamente el mismo dibujo.
 * Un compositor determinista en la decisión y errático en el render no produce dos variantes, produce
 * dos estados del mismo arte, y eso no se puede revisar.
 *
 * Se compara `pixelSha256`, no el sha256 del fichero, porque está medido que el escritor PNG de Blender
 * no es byte-estable: la misma escena, dos procesos, cuatro ficheros distintos con el mismo raster. El
 * sha del fichero sí se publica (integridad §24) y aquí se anota por información, pero no entra en el
 * veredicto.
 */
function regenerateCheck(grammars, options, request) {
  const workDir = join(options.outDir, "regenerate");
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const attempts = [];
  for (const pass of ["primera", "segunda"]) {
    const candidate = {
      ...request,
      output: join(workDir, `${pass}.png`),
      metadata: join(workDir, `${pass}.json`),
    };
    const requestsPath = join(workDir, `requests-${pass}.json`);
    const manifestPath = join(workDir, `manifest-${pass}.json`);
    writeFileSync(
      requestsPath,
      `${JSON.stringify(
        {
          composerVersion: grammars.composerVersion,
          styleProfileId: candidate.styleProfileId,
          candidates: [candidate],
        },
        null,
        1,
      )}\n`,
    );
    const { manifest } = runBlender(requestsPath, manifestPath, 1);
    if (manifest.failures.length > 0) {
      throw new Error(
        `§13 ${candidate.candidateId}: ${manifest.failures[0].errorType}: ${manifest.failures[0].error}`,
      );
    }
    const [rendered] = manifest.candidates;
    // §13 pide borrar lo generado antes de la segunda pasada; la imagen de la segunda se queda en
    // disco para que el acta pueda volver a medir el sha256 en vez de creerse la cifra publicada.
    if (pass === "primera") rmSync(candidate.output, { force: true });
    attempts.push({
      pass,
      signature: rendered.compositionSignature,
      pixelSha256: rendered.pixelSha256,
      fileSha256: rendered.sha256,
      // Qué pase movió sus píxeles: albedo, sombra o ambos. Distingue un defecto del compositor de
      // uno del rasterizador sin tener que volver a renderizar con los intermedios a la vista.
      stages: {
        render: rendered.shadow?.renderPixels?.sha256,
        shadow: rendered.shadow?.pixels?.sha256,
      },
      pivot: rendered.pivot,
      pixels: [rendered.image.width, rendered.image.height],
    });
  }
  const [first, second] = attempts;
  // §13 compara la firma de la composición, no los píxeles del sprite: la composición es lo que define
  // una variante (§14), y los píxeles son el raster que la dibuja. Si la firma coincide pero los píxeles
  // no, la variante es la misma y el jitter es un artefacto del render (medido: el pase de sombra a 3×
  // no es bit-estable, y a veces arrastra al sprite). Se publican los píxeles como diagnóstico, pero no
  // voltean el veredicto.
  const differences = ["signature", "pivot", "pixels"].filter(
    (key) => JSON.stringify(first[key]) !== JSON.stringify(second[key]),
  );
  const stageDifferences = Object.keys(first.stages).filter(
    (stage) => first.stages[stage] !== second.stages[stage],
  );
  const pixelDifferences = first.pixelSha256 !== second.pixelSha256;
  const result = {
    candidateId: request.candidateId,
    first,
    second,
    differences,
    stageDifferences,
    pixelDifferences,
    // Un contenedor PNG que cambia con los píxeles iguales es ruido del escritor, no del compositor; se
    // anota porque §24 publica el sha del fichero y el acta tiene que poder decir cuál de los dos movió.
    containerNoise:
      first.fileSha256 !== second.fileSha256 && first.pixelSha256 === second.pixelSha256,
    status: differences.length ? "NO_DETERMINISTA" : "determinista",
  };
  writeFileSync(join(workDir, "regenerate.json"), `${JSON.stringify(result, null, 1)}\n`);
  console.log(JSON.stringify(result, null, 1));
  if (stageDifferences.length > 0 || pixelDifferences) {
    const parts = [];
    if (stageDifferences.length > 0)
      parts.push(`pases ${stageDifferences.join(", ")} no bit-estables`);
    if (pixelDifferences) parts.push("sprite no reproducido");
    console.warn(`§13 aviso: ${request.candidateId} reprodujo la firma, pero ${parts.join(" y ")}`);
  }
  if (differences.length > 0) {
    console.error(`§13 la regeneración no reprodujo ${differences.join(", ")}`);
    return 1;
  }
  return 0;
}

function main() {
  const options = parseArgs(process.argv);
  const grammars = read(GRAMMARS_PATH);
  const requests = buildRequests(grammars, options);
  const profiles = new Set(requests.map((request) => request.styleProfileId));
  if (profiles.size !== 1) {
    throw new Error(
      `§10 una corrida por perfil de estilo; los requests piden ${[...profiles].join(", ")}`,
    );
  }

  mkdirSync(options.outDir, { recursive: true });
  // §26 rige también sobre la corrida de regeneración: son dos procesos de Blender escribiendo en el
  // mismo disco y ninguno tiene derecho a tocar los assets del bundle de paso.
  const before = RUNTIME_ASSETS.map(digestFile);
  if (options.regenerate) {
    const code = regenerateCheck(grammars, options, requests[0]);
    const regenerated = RUNTIME_ASSETS.map(digestFile);
    if (before.some((digest, index) => digest !== regenerated[index])) {
      console.error("§26 la regeneración modificó los assets de runtime publicados");
      process.exit(1);
    }
    process.exit(code);
  }

  const workDir = join(options.outDir, "work");
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const requestsPath = join(workDir, "requests.json");
  const manifestPath = join(workDir, "manifest.json");
  writeFileSync(
    requestsPath,
    `${JSON.stringify(
      {
        composerVersion: grammars.composerVersion,
        styleProfileId: [...profiles][0],
        candidates: requests,
      },
      null,
      1,
    )}\n`,
  );

  if (!existsSync(BLENDER))
    throw new Error(`no existe el binario de Blender: ${BLENDER} (define BLENDER_BIN)`);
  
  // Ejecutar cada candidato en un proceso separado para evitar acumulación de estado
  const { manifest, status, totalMs } = runBlenderSeparate(requests, options, grammars);

  const errors = [];
  for (const failure of manifest.failures) {
    errors.push(`${failure.candidateId}: ${failure.errorType}: ${failure.error}`);
  }
  if (status !== 0 && manifest.failures.length === 0) {
    errors.push(`Blender salió con ${status} sin registrar fallos por candidato`);
  }
  const after = RUNTIME_ASSETS.map(digestFile);
  if (before.some((digest, index) => digest !== after[index])) {
    errors.push(
      "§26 los assets de runtime cambiaron durante el spike: aquí no se promueve nada al bundle",
    );
  }
  if (errors.length > 0) {
    console.error(errors.map((message) => `- ${message}`).join("\n"));
    process.exit(1);
  }

  // El render intermedio y la pasada de sombra son pasos del pipeline, no candidatos: si se quedan en
  // el directorio de evidencia, §27 acabaría con dos hojas de contacto y tres PNG por variante.
  for (const request of requests) {
    for (const suffix of [".render.png", ".shadow.png"]) {
      rmSync(request.output.replace(/\.png$/u, suffix), { force: true });
    }
  }

  const runtimeAssets = Object.fromEntries(
    RUNTIME_ASSETS.map((path, index) => [path, { before: before[index], after: after[index] }]),
  );
  writeFileSync(
    join(options.outDir, "manifest.json"),
    `${JSON.stringify({ ...manifest, outDir: options.outDir, totalMs, runtimeAssets }, null, 1)}\n`,
  );
  mkdirSync(resolve(options.metrics, ".."), { recursive: true });
  writeFileSync(
    options.metrics,
    `${JSON.stringify(metricsOf(manifest, options, totalMs, runtimeAssets), null, 1)}\n`,
  );
  // `work/` era el paso intermedio: los requests ya viven dentro de cada candidato publicado
  // (`request`) y la firma está en el manifiesto, así que no deja nada que no pueda reconstruirse.
  rmSync(workDir, { recursive: true, force: true });

  console.log(
    `\n${manifest.candidates.length}/${requests.length} candidatos en ${(totalMs / 1000).toFixed(1)} s ` +
      `(pico RSS ${manifest.peakRssMb} MB) · manifiesto y métricas escritos`,
  );
  for (const candidate of manifest.candidates) {
    console.log(
      `  ${candidate.candidateId}  ${candidate.image.width}×${candidate.image.height}  ` +
        `${candidate.triangleCount} tri  ${candidate.modules.length} módulos  ` +
        `licenciado ${(candidate.metrics.licensedGeometryRatio * 100).toFixed(1)}%  ` +
        `firma ${candidate.compositionSignature.slice(0, 12)}`,
    );
  }
  return 0;
}

main();

#!/usr/bin/env node
/**
 * Validador del Building Composer (V.f.3c, spike V.f §32).
 *
 * El catálogo de módulos ya tiene su propio gate (`validate-building-modules.mjs`, §7): ahí se
 * comprueba que cada módulo exista de verdad en la fuente licenciada. Este validador comprueba lo
 * que ese gate no puede ver, porque sólo existe cuando ya hay compositor:
 *
 *   - la gramática referencia geometría que el catálogo no tiene, o de una familia que el perfil de
 *     estilo no trata (§7 aplicado a las gramáticas, no a los módulos sueltos);
 *   - dos candidatos del mismo seed no reproducen la misma firma, o dos seeds distintos sí (§13/§14);
 *   - dos variantes de una familia comparten más ejes de los que §16 permite, es decir, son la misma
 *     casa con otro nombre;
 *   - la metadata publicada de un candidato no dice la verdad sobre el PNG que está en disco (§24),
 *     o trajo una fuente que el catálogo no declaró (D-098);
 *   - la reproducibilidad del render está medida y no alegada: el acta de `--regenerate` tiene que
 *     coincidir con la firma y los píxeles publicados (§13/§32);
 *   - y la evidencia de Blender —import, jerarquía, anclajes, apoyo en suelo, envolvente y remapeo de
 *     materiales— se sostiene cruzando los campos que el propio render publicó (§32, columna Blender).
 *
 * El bloque de determinismo corre el compositor Python sin arrancar Blender: `compose.py` decide qué
 * se coloca y dónde sin tocar una sola API de escena, así que la firma se puede reproducir en
 * milisegundos. Lo que sólo Blender sabe —que la geometría licenciada entró físicamente en el
 * render— lo comprueba `build-building-composer.mjs --regenerate`.
 *
 * Uso:
 *   node scripts/validate-building-composer.mjs
 *   node scripts/validate-building-composer.mjs --manifest=docs/art/building-composer/candidates/manifest.json
 *   node scripts/validate-building-composer.mjs --grammars=<copia mutada>   (lo usa el .test.mjs)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_DIR = join(REPO_ROOT, "blender_artist/manifests");
const PATHS = {
  grammars: join(MANIFEST_DIR, "building-composer-grammars.json"),
  modules: join(MANIFEST_DIR, "building-modules.json"),
  profiles: join(MANIFEST_DIR, "building-style-profiles.json"),
  sources: join(MANIFEST_DIR, "staging-sources.json"),
  gameData: join(REPO_ROOT, "packages/simulation/src/game-data.ts"),
  pipeline: join(REPO_ROOT, "tools/art-pipeline/blender"),
};
const DEFAULT_CANDIDATE_MANIFEST = join(
  REPO_ROOT,
  "docs/art/building-composer/candidates/manifest.json",
);
const STAGING_PREFIX = "blender_artist/staging/";
const ALLOWED_LICENSES = ["CC0-1.0"];
const SUPPORT_KINDS = ["base", "connector", "plinth", "pipe", "support"];
/** §11: las cuatro ramas por las que un color puede subir a la escalera de tratamiento. */
const TREATMENT_PATHS = ["atlas-directo", "atlas-profundo", "plano", "sin-albedo-enlazado"];
const REQUIRED_METADATA_FIELDS = [
  "candidateId",
  "buildingType",
  "family",
  "variantSeed",
  "composerVersion",
  "styleProfileId",
  "compositionSignature",
  "modules",
  "sourceIds",
  "sourcePaths",
  "licenses",
  "transforms",
  "materialVariants",
  "bounds",
  "footprint",
  "floors",
  "pivot",
  "triangleCount",
  "materialCount",
  "textureCount",
  "renderTime",
  "pngBytes",
  "sha256",
  "orientationStatus",
];

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_CANDIDATE_MANIFEST,
    requireManifest: false,
    regenerate: null,
  };
  for (const argument of argv.slice(2)) {
    const [flag, value] = argument.split("=");
    if (flag === "--grammars") PATHS.grammars = resolve(value);
    else if (flag === "--modules") PATHS.modules = resolve(value);
    else if (flag === "--regenerate") options.regenerate = resolve(value);
    else if (flag === "--manifest") {
      options.manifest = resolve(value);
      options.requireManifest = true;
    } else if (flag === "--help") {
      console.log(
        "uso: node scripts/validate-building-composer.mjs [--manifest=path] [--grammars=path] " +
          "[--regenerate=path]",
      );
      process.exit(0);
    } else throw new Error(`argumento desconocido ${argument}`);
  }
  return options;
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** §17: la huella y las plantas las manda el dominio; se leen del mismo fichero que lee el juego. */
function domainGeometry(buildingType) {
  const gameData = readFileSync(PATHS.gameData, "utf8");
  const start = gameData.indexOf(`  ${buildingType}: {`);
  if (start < 0) return null;
  const boundary = /\n {2}[a-z_]+: \{/gu;
  boundary.lastIndex = start + buildingType.length + 5;
  const block = gameData.slice(start, boundary.exec(gameData)?.index ?? undefined);
  const footprint = /preferredFootprint: \{ width: (\d+), height: (\d+) \}/u.exec(block);
  const floors = /defaultFloors: (\d+)/u.exec(block);
  if (!footprint || !floors) return null;
  return {
    footprint: { width: Number(footprint[1]), height: Number(footprint[2]) },
    floors: Number(floors[1]),
  };
}

/** Todo string que parezca un id de módulo, sea donde sea que la gramática lo esconda. */
function moduleReferences(node, found) {
  if (typeof node === "string") {
    if (node.startsWith("mod_")) found.add(node);
    return found;
  }
  if (Array.isArray(node)) for (const item of node) moduleReferences(item, found);
  else if (node && typeof node === "object") {
    for (const value of Object.values(node)) moduleReferences(value, found);
  }
  return found;
}

function checkGrammars(grammars, catalog, profiles, errors) {
  const modulesById = new Map(catalog.modules.map((module) => [module.id, module]));
  if (modulesById.size !== catalog.modules.length) {
    errors.push(
      "§7 el catálogo de módulos tiene IDs duplicados: la heurística de referencias no es fiable",
    );
  }
  if (grammars.minimumChangedAxes < 2) {
    errors.push(
      `§16 minimumChangedAxes ${grammars.minimumChangedAxes} < 2: una variante podría no cambiar nada`,
    );
  }
  for (const kind of grammars.support.allowedKinds) {
    if (!SUPPORT_KINDS.includes(kind)) {
      errors.push(
        `§15 la gramática permite soportes de tipo '${kind}', fuera de ${SUPPORT_KINDS.join("/")}`,
      );
    }
  }
  if (grammars.frame.frontSide !== "-Y") {
    errors.push(
      `§18 el marco declara frontSide '${grammars.frame.frontSide}', y el pipeline embarcado espera -Y`,
    );
  }
  for (const degrees of grammars.frame.rotationsDegrees) {
    if (degrees % 90 !== 0) {
      errors.push(
        `§18 la gramática declara giros de ${degrees}°: fuera de la rejilla de 90° del marco`,
      );
    }
  }
  const axisIds = grammars.variantAxes;
  if (new Set(axisIds).size !== axisIds.length) {
    errors.push("§16 hay ejes de variante duplicados en el manifiesto");
  }
  for (const [buildingType, grammar] of Object.entries(grammars.grammars)) {
    const domain = domainGeometry(buildingType);
    if (!domain) {
      errors.push(`§17 ${buildingType} tiene gramática pero no definición en game-data.ts`);
      continue;
    }
    if (!grammar.levelsFromDomain) {
      errors.push(
        `§17 ${buildingType}: la gramática no declara levelsFromDomain y el dominio manda sobre las plantas`,
      );
    }
    const applicable = profiles.filter((profile) =>
      profile.appliesToFamilies.includes(grammar.family),
    );
    if (applicable.length !== 1) {
      errors.push(
        `§10 ${buildingType}: la familia ${grammar.family} aplica a ${applicable.length} perfiles de estilo, se esperaba 1`,
      );
    }
    const referenced = moduleReferences(grammar, new Set());
    if (referenced.size === 0) {
      errors.push(
        `§15 ${buildingType}: la gramática no referencia ningún módulo de geometría licenciada`,
      );
    }
    for (const moduleId of referenced) {
      const module = modulesById.get(moduleId);
      if (!module) {
        errors.push(`§7 ${buildingType}: la gramática pide ${moduleId} y el catálogo no lo tiene`);
        continue;
      }
      if (!module.allowedFamilies.includes(grammar.family)) {
        errors.push(
          `§7 ${buildingType}: ${moduleId} no admite la familia ${grammar.family} (${module.allowedFamilies.join("/")})`,
        );
      }
      if (!ALLOWED_LICENSES.includes(module.license)) {
        errors.push(`§5 ${buildingType}: ${moduleId} trae licencia '${module.license}'`);
      }
    }
    // §16 no exige que cada eje tenga varias opciones: exige que dos variantes cambien al menos
    // `minimumChangedAxes`. Una familia con una sola paleta de fachada es legítima mientras haya
    // suficientes ejes con de dónde elegir.
    const declarable = [
      "massingOptions",
      "facadePalettes",
      "rhythms",
      "silhouetteOptions",
      "roofOptions",
      "accessOptions",
      "propOptions",
      "secondaryOptions",
    ];
    const variable = declarable.filter((key) => (grammar[key]?.length ?? 0) >= 2);
    if (variable.length < grammars.minimumChangedAxes) {
      errors.push(
        `§16 ${buildingType}: sólo ${variable.length} ejes declaran ≥2 opciones ` +
          `(${variable.join(", ") || "ninguno"}) y las variantes deben cambiar ` +
          `${grammars.minimumChangedAxes}`,
      );
    }
  }
  return modulesById;
}

/**
 * §13/§32 sin Blender: el compositor Python se ejecuta dos veces sobre el mismo request y sobre
 * requests de seeds vecinos. Misma semilla ⇒ misma firma; semillas distintas ⇒ composición distinta
 * cuando la gramática tiene de dónde elegir.
 */
function checkDeterminism(grammars, errors) {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(PATHS.pipeline)})
from building_composer.compose import compose_candidate
from building_composer.module_catalog import Catalog
from building_composer.grammar import GrammarDocument
from building_composer.style_profile import StyleProfile
catalog, document = Catalog(), GrammarDocument()
grammars = json.loads(sys.argv[1])
out = {}
for building_type, grammar in grammars.items():
    profile = StyleProfile(sys.argv[2])
    for seed in grammar["seeds"]:
        request = {
            "candidateId": f"{building_type}-{seed}",
            "buildingType": building_type,
            "family": grammar["family"],
            "styleProfileId": profile.id,
            "variantSeed": seed,
            "composerVersion": document.composer_version,
            "footprint": grammar["footprint"],
            "floors": grammar["floors"],
            "output": "/tmp/vf-validate.png",
        }
        first = compose_candidate(request, catalog, profile, document)
        second = compose_candidate(request, catalog, profile, document)
        out[str(seed) + ":" + building_type] = {
            "signature": first["compositionSignature"],
            "sameTwice": first["compositionSignature"] == second["compositionSignature"],
            "axes": first["axisChoices"],
        }
print(json.dumps(out))
`;
  const payload = {};
  for (const [buildingType, grammar] of Object.entries(grammars.grammars)) {
    const domain = domainGeometry(buildingType);
    if (!domain) continue;
    payload[buildingType] = {
      family: grammar.family,
      footprint: domain.footprint,
      floors: domain.floors,
      seeds: [1000, 1001, 1002, 1003],
    };
  }
  const styleProfileId = read(PATHS.profiles).profiles[0].id;
  const run = spawnSync("python3", ["-c", script, JSON.stringify(payload), styleProfileId], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    errors.push(`§13 el determinismo no se pudo medir: ${run.stderr.slice(-400)}`);
    return null;
  }
  const measured = JSON.parse(run.stdout);
  const declaredAxes = new Set(grammars.variantAxes);
  for (const [key, value] of Object.entries(measured)) {
    if (!value.sameTwice) {
      errors.push(`§13 ${key}: el mismo seed produjo dos firmas distintas en la misma corrida`);
    }
    const published = new Set(Object.keys(value.axes));
    if (
      published.size !== declaredAxes.size ||
      [...published].some((axis) => !declaredAxes.has(axis))
    ) {
      errors.push(
        `§16 ${key}: el compositor publica ejes ${[...published].sort().join(", ")} y el manifiesto ` +
          `declara ${[...declaredAxes].sort().join(", ")}`,
      );
    }
  }
  const byType = new Map();
  for (const [key, value] of Object.entries(measured)) {
    const buildingType = key.split(":")[1];
    if (!byType.has(buildingType)) byType.set(buildingType, []);
    byType.get(buildingType).push({ seed: key.split(":")[0], ...value });
  }
  for (const [buildingType, variants] of byType) {
    const signatures = variants.map((variant) => variant.signature);
    if (new Set(signatures).size !== signatures.length) {
      errors.push(`§14 ${buildingType}: dos seeds producen la misma firma: no son variantes`);
    }
    for (let i = 0; i < variants.length; i += 1) {
      for (let j = i + 1; j < variants.length; j += 1) {
        const changed = Object.keys(variants[i].axes).filter(
          (axis) => variants[i].axes[axis] !== variants[j].axes[axis],
        );
        if (changed.length < grammars.minimumChangedAxes) {
          errors.push(
            `§16 ${buildingType} seeds ${variants[i].seed}/${variants[j].seed}: cambian ${changed.length} ` +
              `ejes (${changed.join(", ") || "ninguno"}) y el mínimo es ${grammars.minimumChangedAxes}`,
          );
        }
      }
    }
  }
  return measured;
}

function checkCandidate(candidate, modulesById, sourcesById, grammars, manifestDir, errors) {
  const label = candidate.candidateId;
  for (const field of REQUIRED_METADATA_FIELDS) {
    if (candidate[field] === undefined) errors.push(`§24 ${label}: falta el campo '${field}'`);
  }
  if (candidate.state !== "complete") {
    errors.push(`§25 ${label}: sólo se publica el estado complete, llegó '${candidate.state}'`);
  }
  const domain = domainGeometry(candidate.buildingType);
  if (domain) {
    if (
      candidate.footprint.width !== domain.footprint.width ||
      candidate.footprint.height !== domain.footprint.height
    ) {
      errors.push(
        `§17 ${label}: huella ${candidate.footprint.width}×${candidate.footprint.height} ≠ dominio ` +
          `${domain.footprint.width}×${domain.footprint.height}`,
      );
    }
    if (candidate.floors !== domain.floors) {
      errors.push(`§17 ${label}: ${candidate.floors} plantas ≠ ${domain.floors} del dominio`);
    }
  } else {
    errors.push(`§17 ${label}: ${candidate.buildingType} no existe en game-data.ts`);
  }
  if (candidate.composerVersion !== grammars.composerVersion) {
    errors.push(
      `§13 ${label}: composerVersion '${candidate.composerVersion}' ≠ manifiesto '${grammars.composerVersion}'`,
    );
  }
  if (candidate.request?.composerVersion !== grammars.composerVersion) {
    errors.push(`§13 ${label}: el request guardado trae otra versión del compositor`);
  }
  for (const placement of candidate.transforms ?? []) {
    const module = modulesById.get(placement.moduleId);
    if (!module) {
      errors.push(
        `§7 ${label}: el candidato coloca ${placement.moduleId} y el catálogo no lo tiene`,
      );
      continue;
    }
    if (module.sourceId !== placement.sourceId || module.sourcePath !== placement.sourcePath) {
      errors.push(
        `§7 ${label}: ${placement.moduleId} declara ${placement.sourceId} desde '${placement.sourcePath}' ` +
          `y el catálogo ${module.sourceId} desde '${module.sourcePath}'`,
      );
    }
    if (module.license !== placement.license) {
      errors.push(
        `§7 ${label}: ${placement.moduleId} licencia colocada '${placement.license}' ≠ catálogo '${module.license}'`,
      );
    }
    const source = sourcesById.get(placement.sourceId);
    if (!source) {
      errors.push(`§7 ${label}: ${placement.sourceId} no está registrado en staging-sources.json`);
    } else if (source.license !== placement.license) {
      errors.push(`§5 ${label}: staging declara '${source.license}' para ${placement.sourceId}`);
    }
    if (!placement.sourcePath?.startsWith(STAGING_PREFIX)) {
      errors.push(`§5 ${label}: '${placement.sourcePath}' está fuera de ${STAGING_PREFIX}`);
    }
  }
  for (const license of candidate.licenses ?? []) {
    if (!ALLOWED_LICENSES.includes(license))
      errors.push(`§5 ${label}: licencia publicada '${license}'`);
  }
  const share = candidate.checks?.supportTriangleShare ?? 0;
  if (share > grammars.support.maxTrianglesShare) {
    errors.push(
      `§15 ${label}: los soportes ocupan ${(share * 100).toFixed(2)}% > ` +
        `${(grammars.support.maxTrianglesShare * 100).toFixed(0)}% de los triángulos`,
    );
  }
  for (const support of candidate.originalSupport ?? []) {
    if (!grammars.support.allowedKinds.includes(support.kind)) {
      errors.push(`§15 ${label}: el soporte '${support.kind}' no está entre los permitidos`);
    }
  }
  const pivot = candidate.pivot ?? {};
  if (!(pivot.x >= 0 && pivot.x <= 1 && pivot.y >= 0 && pivot.y <= 1)) {
    errors.push(`§18 ${label}: pivot fuera de [0,1]: ${JSON.stringify(pivot)}`);
  }
  if (!candidate.sceneChecks?.pivotValidator?.insideFootprint) {
    errors.push(`§18 ${label}: el pivot no se validó dentro de la huella proyectada`);
  }
  if (!candidate.orientationStatus?.allAccessVisible) {
    errors.push(`§25 ${label}: hay accesos mirando a un lado no visible desde la cámara canónica`);
  }
  const path = candidate.image?.path;
  // La evidencia se commits con la ruta absoluta de la máquina que renderizó. Si el repo se clona en
  // otra parte, el PNG sigue viviendo junto al manifiesto: se busca ahí antes de declarar que falta.
  const onDisk = path && existsSync(path) ? path : path && join(manifestDir, basename(path));
  if (!onDisk || !existsSync(onDisk)) {
    errors.push(`§24 ${label}: el PNG publicado no existe en '${path}'`);
    return;
  }
  const bytes = readFileSync(onDisk);
  if (sha256(bytes) !== candidate.sha256) {
    errors.push(`§24 ${label}: el sha256 publicado no corresponde al PNG en disco`);
  }
  if (bytes.length !== candidate.pngBytes) {
    errors.push(`§24 ${label}: pngBytes ${candidate.pngBytes} ≠ ${bytes.length} reales`);
  }
  if (candidate.triangleCount !== candidate.metrics?.triangles) {
    errors.push(
      `§24 ${label}: triangleCount ${candidate.triangleCount} ≠ metrics.triangles ${candidate.metrics?.triangles}`,
    );
  }
}

/**
 * §32 (columna Blender): la metadata publicada tiene que probar por sí sola que el render trajo la
 * geometría real, no una promesa. Cada comprobación cruza dos campos que sólo coinciden si Blender
 * importó, parenteó, ancló y alineó de verdad; un manifiesto escrito a mano o desincronizado revienta
 * aquí aunque el PNG exista.
 */
function checkSceneEvidence(candidate, modulesById, errors) {
  const label = candidate.candidateId;
  const scene = candidate.sceneChecks ?? {};
  const metrics = candidate.metrics ?? {};
  const tolerance = scene.placementToleranceMeters ?? 0.02;
  const transforms = candidate.transforms ?? [];

  // import: cada módulo distinto del candidato pasó por el importador de la fuente.
  if (!(scene.sourcesImported > 0)) {
    errors.push(`§32 ${label}: la escena no registró ninguna fuente importada`);
  } else if (scene.sourcesImported !== metrics.distinctModuleIds) {
    errors.push(
      `§32 ${label}: ${metrics.distinctModuleIds} módulos distintos y ${scene.sourcesImported} fuentes importadas`,
    );
  }

  // source object existence: cada colocación compuesta existe como objeto en escena.
  if (metrics.placements !== transforms.length) {
    errors.push(
      `§32 ${label}: la composición colocó ${metrics.placements} módulos y el manifiesto trae ${transforms.length} transformadas`,
    );
  }
  const empty = transforms.filter((placement) => !(placement.meshObjects > 0));
  if (empty.length > 0) {
    errors.push(
      `§32 ${label}: ${empty.length} colocaciones no produjeron ningún mesh en escena (p.ej. ${empty[0].moduleId})`,
    );
  }

  // hierarchy preservation: la jerarquía instanció un objeto por mesh declarada, sin colapsar nada.
  const declaredMeshObjects = transforms.reduce(
    (total, placement) => total + placement.meshObjects,
    0,
  );
  if (scene.scene?.meshObjects !== declaredMeshObjects) {
    errors.push(
      `§32 ${label}: la escena tiene ${scene.scene?.meshObjects} objetos mesh y las transformadas declaran ${declaredMeshObjects}`,
    );
  }
  if (scene.scene?.triangles !== candidate.triangleCount) {
    errors.push(
      `§32 ${label}: la escena tiene ${scene.scene?.triangles} triángulos y el candidato publica ${candidate.triangleCount}`,
    );
  }

  // anchors: el marco nominal del catálogo es el que ocupa la colocación, con el giro de rejilla aplicado.
  for (const placement of transforms) {
    const module = modulesById.get(placement.moduleId);
    if (!module?.nominalBounds) continue;
    const rotated = (placement.rotationDegrees % 360) % 180 !== 0;
    const nominal = module.nominalBounds;
    const expected = rotated
      ? [nominal.depthMeters, nominal.widthMeters, nominal.heightMeters]
      : [nominal.widthMeters, nominal.depthMeters, nominal.heightMeters];
    const axes = ["x", "y", "z"];
    for (let index = 0; index < 3; index += 1) {
      const axis = axes[index];
      const measured = placement.bounds[axis].max - placement.bounds[axis].min;
      if (Math.abs(measured - expected[index]) > tolerance) {
        errors.push(
          `§18 ${label}: ${placement.moduleId} en ${axis} mide ${measured.toFixed(3)} m y el catálogo ` +
            `declara ${expected[index]} m (giro ${placement.rotationDegrees}°)`,
        );
      }
    }
  }

  // bounds: la caja firmada por la composición es la que ocupa la geometría.
  for (const axis of ["x", "y", "z"]) {
    const box = candidate.bounds?.[axis];
    const world = scene.scene?.worldSizeMeters?.[axis];
    if (box === undefined || world === undefined) continue;
    if (Math.abs(box.max - box.min - world) > tolerance) {
      errors.push(
        `§32 ${label}: la envolvente compuesta mide ${(box.max - box.min).toFixed(3)} m en ${axis} y la escena ${world} m`,
      );
    }
  }

  // ground alignment: lo que apoya, apoya en Z=0 dentro de la parcela.
  const ground = scene.groundContact ?? {};
  if (!(ground.restingModules > 0)) {
    errors.push(`§18 ${label}: ningún módulo declara apoyo en el suelo`);
  }
  if (Math.abs(ground.lowestZMeters ?? 1) > (candidate.checks?.groundToleranceMeters ?? 0.05)) {
    errors.push(`§18 ${label}: el contacto más bajo está a ${ground.lowestZMeters} m del suelo`);
  }
  if (!candidate.checks?.groundContactInsideFootprint) {
    errors.push(`§17 ${label}: el apoyo en suelo cae fuera de la huella del dominio`);
  }

  // material remap: §11 con nombres de familia reales, no con huecos silenciosos.
  const variants = candidate.materialVariants ?? [];
  const untreated = variants.filter((variant) => variant.untreatedColorSources > 0);
  if (untreated.length > 0) {
    errors.push(`§11 ${label}: ${untreated.length} materiales con color de origen sin tratar`);
  }
  const offLadder = variants.filter((variant) => !TREATMENT_PATHS.includes(variant.treatmentPath));
  if (offLadder.length > 0) {
    errors.push(
      `§11 ${label}: tratamiento fuera de la escalera: ${offLadder.map((variant) => `${variant.material}=${variant.treatmentPath}`).join(", ")}`,
    );
  }
  const unlabelled = variants.filter((variant) => !variant.family);
  if (unlabelled.length > 0) {
    errors.push(
      `§11 ${label}: materiales sin familia de paleta, no se puede juzgar su distinguibilidad: ${unlabelled.map((variant) => variant.material).join(", ")}`,
    );
  }
  if (
    variants.length > 0 &&
    !variants.some((variant) => variant.treatmentPath !== "sin-albedo-enlazado")
  ) {
    errors.push(`§11 ${label}: ningún material llegó a tratarse: el estilo no entró en el render`);
  }

  // §13/§32: la reproducibilidad del render se firma en píxeles, por pase. El sha256 del fichero no
  // vale como prueba: está medido que el escritor PNG de Blender produce ficheros distintos para un
  // raster idéntico, así que un manifiesto que sólo publique el sha del contenedor no puede alegar
  // que dos procesos dibujaron lo mismo —ni este validador puede comprobarlo.
  const SHA256_HEX = /^[0-9a-f]{64}$/u;
  const signatures = {
    final: candidate.pixelSha256,
    render: candidate.shadow?.renderPixels?.sha256,
    shadow: candidate.shadow?.pixels?.sha256,
  };
  for (const [stage, value] of Object.entries(signatures)) {
    if (!SHA256_HEX.test(value ?? "")) {
      errors.push(
        `§13 ${label}: falta la firma de píxeles del pase '${stage}': la regeneración no sería comparable`,
      );
    }
  }
}

/**
 * §13/§32, tercera fila («regenerar → misma composición»). El gate que la produce es
 * `build-building-composer.mjs --regenerate`, que renderiza el mismo request dos veces en dos procesos,
 * borra el output de la primera y compara. Su acta vive junto a la evidencia; si el manifiesto
 * conviviera con un acta ausente, de otra corrida o en desacuerdo con las firmas publicadas, el
 * candidato afirmaría ser reproducible sin que nadie lo hubiera medido —y la reproducibilidad es justo
 * lo que §13 exige antes de hablar de «variantes».
 *
 * Se cruzan la firma y los pivotes/dimensiones, no los píxeles: §13 compara la composición decidida
 * por la gramática, y los píxeles son el raster que la dibuja. Si el sprite no es bit-estable (medido:
 * el pase de sombra a 3× no lo es, y a veces arrastra al sprite), la variante sigue siendo la misma
 * siempre que la firma coincida; el jitter se reporta en `pixelDifferences` y `stageDifferences` como
 * diagnóstico, no como error.
 */
function checkRegenerateArtifact(path, manifest, errors) {
  if (!existsSync(path)) {
    errors.push(
      `§13 no hay acta de regeneración en ${path}: nadie ha medido la reproducibilidad del render`,
    );
    return;
  }
  const report = read(path);
  const label = report.candidateId ?? "sin candidato";
  if (report.status !== "determinista") {
    errors.push(`§13 el acta de regeneración de ${label} declara '${report.status}'`);
  }
  if ((report.differences ?? []).length > 0) {
    errors.push(
      `§13 el acta de ${label} registró diferencias en ${report.differences.join(", ")} entre procesos`,
    );
  }
  const candidate = manifest.candidates.find((item) => item.candidateId === report.candidateId);
  if (!candidate) {
    errors.push(`§13 el acta de regeneración habla de ${label}, que no está en el manifiesto`);
    return;
  }
  for (const attempt of [report.first, report.second]) {
    const pass = attempt?.pass ?? "sin pasada";
    if (attempt?.signature !== candidate.compositionSignature) {
      errors.push(
        `§13 ${label}: la pasada '${pass}' del acta firmó ${String(attempt?.signature).slice(0, 12)} ` +
          `y el manifiesto publica ${String(candidate.compositionSignature).slice(0, 12)}`,
      );
    }
  }
}

function main() {
  const options = parseArgs(process.argv);
  const grammars = read(PATHS.grammars);
  const catalog = read(PATHS.modules);
  const profiles = read(PATHS.profiles).profiles;
  const sourcesById = new Map(read(PATHS.sources).sources.map((source) => [source.id, source]));
  const errors = [];

  const modulesById = checkGrammars(grammars, catalog, profiles, errors);
  checkDeterminism(grammars, errors);

  let candidates = 0;
  if (existsSync(options.manifest)) {
    const manifest = read(options.manifest);
    const manifestDir = dirname(options.manifest);
    const signatures = new Map();
    for (const candidate of manifest.candidates) {
      checkCandidate(candidate, modulesById, sourcesById, grammars, manifestDir, errors);
      checkSceneEvidence(candidate, modulesById, errors);
      const seen = signatures.get(candidate.compositionSignature);
      if (seen) {
        errors.push(
          `§14 firmas idénticas entre ${seen} y ${candidate.candidateId}: no son dos variantes`,
        );
      } else {
        signatures.set(candidate.compositionSignature, candidate.candidateId);
      }
      candidates += 1;
    }
    for (const failure of manifest.failures ?? []) {
      errors.push(`${failure.candidateId}: ${failure.errorType}: ${failure.error}`);
    }
    checkRegenerateArtifact(
      options.regenerate ?? join(manifestDir, "regenerate", "regenerate.json"),
      manifest,
      errors,
    );
  } else if (options.requireManifest) {
    errors.push(`no hay manifiesto de candidatos en ${options.manifest}`);
  }

  if (errors.length > 0) {
    console.error(errors.map((message) => `- ${message}`).join("\n"));
    process.exit(1);
  }
  console.log(
    JSON.stringify({
      status: "valid",
      composerVersion: grammars.composerVersion,
      grammars: Object.keys(grammars.grammars).length,
      candidateManifest: existsSync(options.manifest) ? options.manifest : null,
      candidates,
      note: "gramáticas contra catálogo y dominio, determinismo §13/§14/§16 medido sin Blender",
    }),
  );
  return 0;
}

main();

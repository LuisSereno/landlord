#!/usr/bin/env node
/**
 * Tests del validador del Building Composer (V.f.3c, §32).
 *
 * Cada caso muta una copia del material publicado (gramáticas, catálogo o manifiesto de candidatos)
 * y exige que `validate-building-composer.mjs` la rechace con el mensaje de ese modo de fallo. El
 * caso bueno va primero: si el material íntegro no pasa, los rechazos serían falsos.
 *
 * Se muta el manifiesto real de candidatos, no una síntesis: la columna Blender de §32 comprueba que
 * dos campos publicados se contradicen (objetos de escena contra transformadas, envolvente compuesta
 * contra caja de la escena, marco nominal del catálogo contra el bounds de la colocación). Un fixture
 * escrito a mano coincidiría porque yo quise que coincidiera, que es justo lo que el gate no puede
 * detectar.
 *
 * Uso: node scripts/validate-building-composer.test.mjs
 * Requiere haber renderizado al menos un candidato: pnpm art:composer:render
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATOR = join(REPO_ROOT, "scripts/validate-building-composer.mjs");
const MANIFEST_DIR = join(REPO_ROOT, "blender_artist/manifests");
const CANDIDATES_DIR = join(REPO_ROOT, "docs/art/building-composer/candidates");
const SOURCES = {
  grammars: join(MANIFEST_DIR, "building-composer-grammars.json"),
  modules: join(MANIFEST_DIR, "building-modules.json"),
  manifest: join(CANDIDATES_DIR, "manifest.json"),
};

const read = (key) => JSON.parse(readFileSync(SOURCES[key], "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * La evidencia se commits con la ruta absoluta de la máquina que renderizó. El test la apunta al PNG
 * que está en el repo para que el gate dependa del material, no del home de quien lo ejecuta.
 */
function candidateManifest() {
  const manifest = read("manifest");
  for (const candidate of manifest.candidates) {
    candidate.image.path = join(CANDIDATES_DIR, basename(candidate.image.path));
  }
  return manifest;
}

const first = (manifest) => manifest.candidates[0];

/**
 * Qué módulo atacar en las mutaciones de gramática. Se deriva del material publicado en vez de
 * escribirse a mano: si la gramática cambia de proveedor, el caso debe seguir mutando una referencia
 * real y no morir con un "ya no existe" mal dirigido.
 */
const GRAMMAR_BASE = read("grammars");
const CATALOG_BASE = read("modules");
const catalogIds = new Set(CATALOG_BASE.modules.map((module) => module.id));
const rowHouseModule = [
  ...new Set(JSON.stringify(GRAMMAR_BASE.grammars.row_house).match(/mod_[A-Za-z0-9_]+/gu) ?? []),
].find((id) => catalogIds.has(id));
if (!rowHouseModule) {
  throw new Error("la gramática de row_house no referencia ningún módulo catalogado");
}

const CASES = [
  // -- caso bueno: el material íntegro pasa -----------------------------------------------
  {
    name: "gramáticas, catálogo y el candidato publicado pasan",
    good: true,
    file: "manifest",
    mutate: () => {},
  },

  // -- §32 manifiestos: procedencia de las gramáticas --------------------------------------
  {
    name: "la gramática pide un módulo que el catálogo no tiene (source FK)",
    expect: "el catálogo no lo tiene",
    file: "grammars",
    mutate: (grammars) => {
      grammars.grammars.row_house = JSON.parse(
        JSON.stringify(grammars.grammars.row_house).replaceAll(
          rowHouseModule,
          `${rowHouseModule}_sin_catalogar`,
        ),
      );
    },
  },
  {
    name: "el módulo no admite la familia de la gramática (allowed family)",
    expect: "no admite la familia",
    file: "modules",
    mutate: (catalog) => {
      catalog.modules.find((module) => module.id === rowHouseModule).allowedFamilies = [
        "suburban_shop",
      ];
    },
  },
  {
    name: "la gramática trae geometría con licencia no permitida",
    expect: "trae licencia",
    file: "modules",
    mutate: (catalog) => {
      catalog.modules.find((module) => module.id === rowHouseModule).license = "CC-BY-4.0";
    },
  },
  {
    name: "IDs de módulo duplicados: la heurística de referencias deja de ser fiable",
    expect: "IDs duplicados",
    file: "modules",
    mutate: (catalog) => {
      catalog.modules.push(clone(catalog.modules[0]));
    },
  },
  {
    name: "familia sin perfil de estilo aplicable (§10)",
    expect: "aplica a 0 perfiles",
    file: "grammars",
    mutate: (grammars) => {
      grammars.grammars.row_house.family = "familia_inventada";
    },
  },
  {
    name: "gramática sin definición en el dominio (§17)",
    expect: "tiene gramática pero no definición en game-data.ts",
    file: "grammars",
    mutate: (grammars) => {
      grammars.grammars.row_house_extra = clone(grammars.grammars.row_house);
    },
  },
  {
    name: "ejes de variante duplicados en el manifiesto (§16)",
    expect: "ejes de variante duplicados",
    file: "grammars",
    mutate: (grammars) => {
      grammars.variantAxes = [...grammars.variantAxes, grammars.variantAxes[0]];
    },
  },
  {
    name: "minimumChangedAxes por debajo de 2 (§16)",
    expect: "una variante podría no cambiar nada",
    file: "grammars",
    mutate: (grammars) => {
      grammars.minimumChangedAxes = 1;
    },
  },
  {
    name: "sin suficientes ejes con de dónde elegir (§16)",
    expect: "declaran ≥2 opciones",
    file: "grammars",
    mutate: (grammars) => {
      const grammar = grammars.grammars.row_house;
      for (const key of [
        "massingOptions",
        "facadePalettes",
        "rhythms",
        "silhouetteOptions",
        "roofOptions",
        "accessOptions",
        "propOptions",
        "secondaryOptions",
      ]) {
        if (Array.isArray(grammar[key])) grammar[key] = grammar[key].slice(0, 1);
      }
    },
  },
  {
    name: "soporte de una forma no permitida (§15)",
    expect: "fuera de base/connector/plinth/pipe/support",
    file: "grammars",
    mutate: (grammars) => {
      grammars.support.allowedKinds = ["base", "torre_de_20m"];
    },
  },
  {
    name: "el marco no mira a -Y (§18)",
    expect: "espera -Y",
    file: "grammars",
    mutate: (grammars) => {
      grammars.frame.frontSide = "+X";
    },
  },
  {
    name: "giros fuera de la rejilla de 90° (§18)",
    expect: "fuera de la rejilla de 90°",
    file: "grammars",
    mutate: (grammars) => {
      grammars.frame.rotationsDegrees = [0, 45, 90];
    },
  },

  // -- §32 determinismo: firma duplicada ----------------------------------------------------
  {
    name: "dos candidatos con la misma firma no son dos variantes (§14)",
    expect: "no son dos variantes",
    file: "manifest",
    mutate: (manifest) => {
      const copy = clone(manifest.candidates[0]);
      copy.candidateId = "vf_clon";
      manifest.candidates.push(copy);
      manifest.requested = manifest.candidates.length;
    },
  },

  // -- §24 metadata publicada ---------------------------------------------------------------
  {
    name: "falta un campo obligatorio de la metadata (§24)",
    expect: "falta el campo 'renderTime'",
    file: "manifest",
    mutate: (manifest) => {
      delete first(manifest).renderTime;
    },
  },
  {
    name: "un candidato incompleto no se publica (§25)",
    expect: "sólo se publica el estado complete",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).state = "draft";
    },
  },
  {
    name: "el candidato cambia la huella del dominio (§17)",
    expect: "≠ dominio",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).footprint.width = 6;
    },
  },
  {
    name: "el candidato cambia las plantas del dominio (§17)",
    expect: "plantas ≠",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).floors = 7;
    },
  },
  {
    name: "la firma no es comparable con otra versión del compositor (§13)",
    expect: "≠ manifiesto 'vf-3'",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).composerVersion = "vf-2";
    },
  },
  {
    name: "el sha256 publicado no corresponde al PNG en disco (§24)",
    expect: "no corresponde al PNG",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sha256 = "0".repeat(64);
    },
  },
  {
    name: "el candidato no firma los píxeles del sprite final (§13)",
    expect: "falta la firma de píxeles del pase 'final'",
    file: "manifest",
    mutate: (manifest) => {
      delete first(manifest).pixelSha256;
    },
  },
  {
    name: "un pase del render queda sin firmar (§13)",
    expect: "falta la firma de píxeles del pase 'shadow'",
    file: "manifest",
    mutate: (manifest) => {
      delete first(manifest).shadow.pixels;
    },
  },
  {
    name: "los bytes publicados no son los del PNG (§24)",
    expect: "≠",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).pngBytes += 1;
    },
  },
  {
    name: "el PNG publicado no está donde dice la metadata (§24)",
    expect: "el PNG publicado no existe",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).image.path = join(CANDIDATES_DIR, "vf_no_existe.png");
    },
  },

  // -- §32 colocación y procedencia del candidato --------------------------------------------
  {
    name: "el candidato coloca un módulo que el catálogo no tiene (source FK)",
    expect: "el catálogo no lo tiene",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].moduleId = "mod_no_existe";
    },
  },
  {
    name: "la fuente colocada no es la del catálogo (source path)",
    expect: "el catálogo",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].sourcePath =
        "blender_artist/staging/third_party/cc0/extracted/otro/otro.gltf";
    },
  },
  {
    name: "una fuente fuera de staging (§5: sólo lo licenciado y registrado)",
    expect: "está fuera de blender_artist/staging/",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].sourcePath = "/home/alguien/Downloads/pack.gltf";
    },
  },
  {
    name: "un sourceId que no está en el inventario (§7)",
    expect: "no está registrado en staging-sources.json",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].sourceId = "src_inventado";
    },
  },
  {
    name: "licencia colocada distinta de la registrada (§5)",
    expect: "licencia colocada",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].license = "CC-BY-4.0";
    },
  },
  {
    name: "los soportes se comen la geometría licenciada (§15)",
    expect: "los soportes ocupan",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).checks.supportTriangleShare = 0.5;
    },
  },
  {
    name: "un soporte de forma no permitida en el candidato (§15)",
    expect: "no está entre los permitidos",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).originalSupport = [{ kind: "torre", shape: "box" }];
    },
  },

  // -- §18 pivot y orientación ---------------------------------------------------------------
  {
    name: "pivot fuera de [0,1] (§18)",
    expect: "pivot fuera de [0,1]",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).pivot = { x: 1.4, y: 0.5 };
    },
  },
  {
    name: "el pivot no se validó dentro de la huella (§18)",
    expect: "no se validó dentro de la huella proyectada",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.pivotValidator.insideFootprint = false;
    },
  },
  {
    name: "un acceso mira a un lado no visible (§25)",
    expect: "accesos mirando a un lado no visible",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).orientationStatus.allAccessVisible = false;
    },
  },

  // -- §32 columna Blender: evidencia de escena ----------------------------------------------
  {
    name: "menos fuentes importadas que módulos distintos (§32 import)",
    expect: "fuentes importadas",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.sourcesImported = 1;
    },
  },
  {
    name: "la escena no tiene un objeto por colocación (§32 jerarquía)",
    expect: "objetos mesh y las transformadas declaran",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.scene.meshObjects = 1;
    },
  },
  {
    name: "una colocación no produjo geometría (§32 source object existence)",
    expect: "no produjeron ningún mesh en escena",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].meshObjects = 0;
    },
  },
  {
    name: "triángulos de escena ≠ triángulos publicados (§32)",
    expect: "la escena tiene 999 triángulos",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.scene.triangles = 999;
    },
  },
  {
    name: "la colocación no respeta el marco nominal del catálogo (§18 anchors)",
    expect: "el catálogo declara",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).transforms[0].bounds.x.max += 0.5;
    },
  },
  {
    name: "la envolvente de escena no es la caja compuesta (§32 bounds)",
    expect: "la envolvente compuesta mide",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.scene.worldSizeMeters.x = 12;
    },
  },
  {
    name: "el edificio flota sobre la parcela (§18 ground alignment)",
    expect: "el contacto más bajo",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).sceneChecks.groundContact.lowestZMeters = 0.4;
    },
  },
  {
    name: "el apoyo en suelo cae fuera de la huella (§17)",
    expect: "cae fuera de la huella del dominio",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).checks.groundContactInsideFootprint = false;
    },
  },

  // -- §11 remapeo de materiales --------------------------------------------------------------
  {
    name: "un material con el color de origen sin tratar (§11)",
    expect: "sin tratar",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).materialVariants[0].untreatedColorSources = 2;
    },
  },
  {
    name: "un tratamiento fuera de la escalera de §11",
    expect: "tratamiento fuera de la escalera",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).materialVariants[0].treatmentPath = "a_mano";
    },
  },
  {
    name: "un material sin familia de paleta: no se puede juzgar §11",
    expect: "sin familia de paleta",
    file: "manifest",
    mutate: (manifest) => {
      first(manifest).materialVariants[0].family = null;
    },
  },
  {
    name: "ningún material tratado: el estilo no entró en el render (§11)",
    expect: "ningún material llegó a tratarse",
    file: "manifest",
    mutate: (manifest) => {
      for (const variant of first(manifest).materialVariants) {
        variant.treatmentPath = "sin-albedo-enlazado";
      }
    },
  },

  // -- §38 un candidato caído no puede pasar por éxito --------------------------------------
  {
    name: "un fallo registrado en el manifiesto aborta el gate",
    expect: "SceneError: §18: el pivot",
    file: "manifest",
    mutate: (manifest) => {
      manifest.failures = [
        {
          candidateId: "vf_town_hall_1000",
          errorType: "SceneError",
          error: "§18: el pivot no cae dentro de la huella",
        },
      ];
    },
  },

  // -- §13 acta de regeneración --------------------------------------------------------------
  {
    name: "no hay acta de regeneración junto al manifiesto (§13)",
    expect: "no hay acta de regeneración",
    file: "manifest",
    dropReport: true,
    mutate: () => {},
  },
  {
    name: "el acta declara NO_DETERMINISTA (§13)",
    expect: "declara 'NO_DETERMINISTA'",
    file: "manifest",
    mutate: () => {},
    mutateReport: (report) => {
      report.status = "NO_DETERMINISTA";
      report.differences = ["pixelSha256"];
    },
  },
  {
    name: "el acta registró diferencias entre procesos (§13)",
    expect: "registró diferencias en signature",
    file: "manifest",
    mutate: () => {},
    mutateReport: (report) => {
      report.differences = ["signature"];
      report.status = "NO_DETERMINISTA";
    },
  },
  {
    name: "el acta firma distinto que el manifiesto (§13)",
    expect: "la pasada 'primera' del acta firmó",
    file: "manifest",
    mutate: () => {},
    mutateReport: (report) => {
      report.first.signature = "0".repeat(64);
    },
  },
];

const failures = [];
let ran = 0;
// El acta de `--regenerate` es parte de la evidencia: el validador la busca junto al manifiesto, así
// que cada caso monta el mismo layout (manifest.json + regenerate/ + PNG real) en un directorio
// temporal y lo muta desde ahí. Un caso que no la encuentre sería un falso verde sobre §13.
const REGENERATE_PATH = join(CANDIDATES_DIR, "regenerate", "regenerate.json");
const REGENERATE_BASE = JSON.parse(readFileSync(REGENERATE_PATH, "utf8"));
for (const testCase of CASES) {
  const material = clone(testCase.file === "manifest" ? candidateManifest() : read(testCase.file));
  testCase.mutate(material);
  const dir = join(tmpdir(), `vf-composer-${testCase.file}-${ran++}`);
  mkdirSync(join(dir, "regenerate"), { recursive: true });
  const path = join(dir, `${testCase.file}.json`);
  writeFileSync(path, `${JSON.stringify(material, null, 1)}\n`);
  const report = JSON.parse(JSON.stringify(REGENERATE_BASE));
  if (testCase.mutateReport) testCase.mutateReport(report, material);
  writeFileSync(join(dir, "regenerate", "regenerate.json"), `${JSON.stringify(report, null, 1)}\n`);
  const argumentsList = [VALIDATOR, `--${testCase.file}=${path}`];
  if (testCase.dropReport) rmSync(join(dir, "regenerate", "regenerate.json"));
  const result = spawnSync(process.execPath, argumentsList, { encoding: "utf8", cwd: REPO_ROOT });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const failed = result.status !== 0;
  if (testCase.good) {
    if (failed) failures.push(`${testCase.name}: el material bueno debería pasar\n${output}`);
    continue;
  }
  if (!failed) {
    failures.push(`${testCase.name}: el validador aceptó una mutación que debía rechazar`);
  } else if (!output.includes(testCase.expect)) {
    failures.push(
      `${testCase.name}: falló, pero por otro motivo (buscaba "${testCase.expect}")\n${output}`,
    );
  }
}

if (failures.length) {
  console.error(
    `Tests del validador del Building Composer: ${failures.length} fallos de ${CASES.length} casos`,
  );
  for (const failure of failures) console.error(`  · ${failure}`);
  process.exit(1);
}
console.log(
  JSON.stringify({
    status: "valid",
    cases: CASES.length,
    note: "cada modo de fallo de §32 (manifiestos, determinismo, Blender y §11/§15/§17/§18/§24) se comprueba mutando el material publicado",
  }),
);

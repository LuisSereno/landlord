#!/usr/bin/env node
/**
 * Tests del validador de módulos (V.f.1, §32).
 *
 * Un gate que nunca falla no es un gate. Cada caso muta una copia del catálogo publicado y exige
 * que `validate-building-modules.mjs` la rechace con el mensaje del modo de fallo de §7 (o §22)
 * correspondiente. Incluye el caso bueno: si el catálogo íntegro no pasa, los fallos serían falsos.
 *
 * Uso: node scripts/validate-building-modules.test.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = join(REPO_ROOT, "blender_artist/manifests/building-modules.json");
const VALIDATOR = join(REPO_ROOT, "scripts/validate-building-modules.mjs");
const base = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));

function clone() {
  return JSON.parse(JSON.stringify(base));
}

/** Busca un módulo por predicado sin que los casos dependan de un índice frágil. */
function pick(catalog, predicate) {
  const module = catalog.modules.find(predicate);
  if (!module)
    throw new Error("el catálogo publicado ya no contiene el módulo que prueba este caso");
  return module;
}

const CASES = [
  {
    name: "catálogo íntegro pasa",
    good: true,
    mutate: () => base,
  },
  {
    name: "ID duplicado",
    expect: "ID de módulo duplicado",
    mutate: (catalog) => {
      catalog.modules.push({ ...catalog.modules[0] });
    },
  },
  {
    name: "sourceId inexistente",
    expect: "sourceId inexistente",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "facade").sourceId = "src_quien_sea";
    },
  },
  {
    name: "sourcePath fuera de staging",
    expect: "fuera de staging",
    mutate: (catalog) => {
      pick(catalog, (m) => m.role === "wall_panel").sourcePath = "/tmp/alguno.gltf";
    },
  },
  {
    name: "licencia no permitida",
    expect: "licencia no permitida",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "roof").license = "CC-BY-4.0";
    },
  },
  {
    name: "selector inexistente",
    expect: "selector inexistente",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "door").objectSelector.meshes = [
        "MeshQueNoEstaEnElArchivo",
      ];
    },
  },
  {
    name: "familia incompatible",
    expect: "familia no declarada",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "window").allowedFamilies = ["suburban_shop"];
    },
  },
  {
    name: "bounds inválidos (nominal ≠ medido)",
    expect: "≠ medido",
    mutate: (catalog) => {
      pick(catalog, (m) => m.role === "civic_block").nominalBounds.widthMeters = 12;
    },
  },
  {
    name: "bounds inválidos (eje fino no declarado como degenerado)",
    expect: "degenerado",
    mutate: (catalog) => {
      pick(catalog, (m) => m.id === "mod_megakit_brick_wall_2m").nominalBounds.depthMeters = 0.001;
    },
  },
  {
    name: "anchor inválido (eje frontal imposible)",
    expect: "eje frontal inválido",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "chimney").anchor.frontAxis = "diagonal";
    },
  },
  {
    name: "anchor inválido (eje frontal del revés sobre geometría offset)",
    expect: "eje frontal contradice la geometría",
    mutate: (catalog) => {
      // Valor del vocabulario, pero imposible para esta geometría: el toldo nace en -0,99 m y su
      // plano de apoyo en -0,4 m, así que la calle está en -Y. Puesto a +Y el compositor lo
      // montaría mirando hacia dentro del edificio.
      const module = pick(catalog, (m) => m.id === "mod_kenney_com_parasol_a");
      if (module.anchor.convention.y !== "offset")
        throw new Error("el caso exige una convención offset");
      module.anchor.frontAxis = "+Y";
    },
  },
  {
    name: "anchor inválido (levantamiento absurdo)",
    expect: "levantamiento de apoyo absurdo",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "mass").anchor.originToGroundMeters = 42;
    },
  },
  {
    name: "anchorTransform editado a mano",
    expect: "incoherente con los offsets medidos",
    mutate: (catalog) => {
      pick(catalog, (m) => m.id === "mod_kenney_ind_windmill").anchor.anchorTransform.translation =
        [1, 1, 1];
    },
  },
  {
    name: "source declarada distinta de la realmente importada",
    expect: "jerarquía importada no coincide",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "canopy").provenance.fileHierarchy = ["Cube.001:MESH"];
    },
  },
  {
    name: "fuente realmente distinta (sourceId del inventario)",
    expect: "fuente realmente importada",
    mutate: (catalog) => {
      const module = pick(catalog, (m) => m.sourceId === "src_kenney_city_industrial");
      module.sourceId = "src_kaykit_city_builder_bits";
    },
  },
  {
    name: "módulo puramente declarativo (0 triángulos)",
    expect: "sin geometría real",
    mutate: (catalog) => {
      const module = pick(catalog, (m) => m.category === "utility");
      module.measured.triangles = 0;
    },
  },
  {
    name: "módulo sin texturas resueltas",
    expect: "sin texturas resueltas",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "intrinsic_prop").measured.images = [];
    },
  },
  {
    name: "objetos importados ≠ selector",
    expect: "difieren del selector declarado",
    mutate: (catalog) => {
      pick(catalog, (m) => m.role === "slab").measured.selectedObjects = ["OtroObjeto"];
    },
  },
  {
    name: "triángulos que no suman los de sus objetos",
    expect: "suma medida de sus objetos",
    mutate: (catalog) => {
      pick(catalog, (m) => m.role === "hall").measured.triangles = 999999;
    },
  },
  {
    name: "§22: cerca de parcela colándose como módulo",
    expect: "prohibido por §22",
    mutate: (catalog) => {
      catalog.modules.push({
        ...clone().modules.find((m) => m.role === "wall_panel"),
        id: "mod_cerca_parcela",
        role: "parcel_fence",
        sourcePath:
          "blender_artist/staging/third_party/cc0/extracted/kenney/city-kit-suburban/Models/GLB format/fence-straight.glb",
      });
    },
  },
  {
    name: "§22: contenedor externalizado colándose como módulo",
    expect: "prohibido por §22",
    mutate: (catalog) => {
      catalog.modules.push({
        ...clone().modules.find((m) => m.role === "tank"),
        id: "mod_contenedor",
        role: "shipping_container",
      });
    },
  },
  {
    name: "categoría fuera del vocabulario",
    expect: "categoría fuera del vocabulario",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "civic").category = "decoracion";
    },
  },
  {
    name: "rotación fuera de la retícula ortogonal",
    expect: "fuera de la retícula ortogonal",
    mutate: (catalog) => {
      pick(catalog, (m) => m.category === "facade").orientation.allowedRotationsDegrees = [0, 45];
    },
  },
  {
    name: "familia sin cobertura para variantar",
    expect: 'módulos de "mass"',
    mutate: (catalog) => {
      catalog.modules = catalog.modules.filter(
        (module) =>
          !(module.category === "mass" && module.allowedFamilies.includes("industrial_heavy")),
      );
    },
  },
];

const failures = [];
let ran = 0;
for (const testCase of CASES) {
  const catalog = clone();
  testCase.mutate(catalog);
  const path = join(tmpdir(), `vf-modules-mutation-${ran++}.json`);
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
  const result = spawnSync(process.execPath, [VALIDATOR, `--catalog=${path}`], {
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const failed = result.status !== 0;
  if (testCase.good) {
    if (failed) failures.push(`${testCase.name}: el catálogo bueno debería pasar\n${output}`);
    continue;
  }
  if (!failed)
    failures.push(`${testCase.name}: el validador aceptó una mutación que debía rechazar`);
  else if (!output.includes(testCase.expect)) {
    failures.push(
      `${testCase.name}: falló, pero por otro motivo (buscaba "${testCase.expect}")\n${output}`,
    );
  }
}

if (failures.length) {
  console.error(
    `Tests del validador de módulos: ${failures.length} fallos de ${CASES.length} casos`,
  );
  for (const failure of failures) console.error(`  · ${failure}`);
  process.exit(1);
}
console.log(
  JSON.stringify({
    status: "valid",
    cases: CASES.length,
    note: "cada modo de fallo de §7 y la prohibición de §22 se comprueba mutando el catálogo real",
  }),
);

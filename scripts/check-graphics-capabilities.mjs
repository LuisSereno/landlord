#!/usr/bin/env node
/**
 * D-111 §10 — guarda del catálogo de capacidades gráficas.
 *
 * El catálogo existe para que otra persona (o otro agente) pueda repetir una prueba sin preguntar.
 * Eso sólo se sostiene si cada entrada es completa y sus rutas apuntan a algo que está en el repo:
 * un `reproducibleExample` que no corre o un `evidenceCaptures` roto es peor que no tener entrada.
 *
 * Comprueba, sin ejecutar ninguna de las herramientas:
 *  1. que las 17 campos obligatorios están y no hay campos no declarados;
 *  2. que `state` pertenece a la leyenda del propio README;
 *  3. que toda ruta de `evidenceCaptures` existe (las que son hueco declarado van en `limitations`);
 *  4. que lo que se vende como probado (`tested`, `qa_integrated`, `production_ready`, `rejected`)
 *     tiene al menos una imagen, porque «probado sin imagen» no es revisable;
 *  5. que `reproducibleExample` y `scriptOrModule` no citan archivos que ya no están.
 *
 * Uso:
 *   node scripts/check-graphics-capabilities.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(REPO, "docs/art/graphics-capabilities/capabilities.json");

const FIELDS = [
  "id",
  "kind",
  "technology",
  "versionTested",
  "officialSource",
  "license",
  "hostCompatibility",
  "state",
  "scriptOrModule",
  "objectTypeUse",
  "reproducibleExample",
  "inputResources",
  "outputResources",
  "evidenceCaptures",
  "visualResult",
  "limitations",
  "integrationDecision",
];
const KINDS = ["capability", "asset_pack"];
/** Estados que afirman «esto se ha ejecutado»: necesitan una imagen que revisar. */
const NEEDS_EVIDENCE = new Set(["tested", "qa_integrated", "production_ready", "rejected"]);

const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));
const errors = [];
const warn = (id, message) => errors.push(`${id}: ${message}`);

for (const entry of catalog.capabilities) {
  const { id } = entry;
  for (const field of FIELDS) {
    if (!(field in entry)) warn(id, `falta el campo obligatorio «${field}»`);
    else if (field !== "evidenceCaptures" && !entry[field])
      warn(id, `el campo «${field}» está vacío`);
  }
  for (const extra of Object.keys(entry).filter((key) => !FIELDS.includes(key))) {
    warn(id, `campo no declarado en el esquema: «${extra}»`);
  }
  if (!KINDS.includes(entry.kind)) warn(id, `kind «${entry.kind}» fuera de la leyenda`);
  if (!Object.keys(catalog.states).includes(entry.state)) {
    warn(id, `state «${entry.state}» no está en la leyenda del catálogo`);
  }
  if (!Array.isArray(entry.evidenceCaptures))
    warn(id, "evidenceCaptures debe ser un array de rutas");
  else {
    for (const capture of entry.evidenceCaptures) {
      if (isAbsolute(capture)) warn(id, `ruta absoluta en evidenceCaptures: ${capture}`);
      else if (/[ ·]/.test(capture.split("/").pop())) {
        warn(id, `la ruta lleva anotaciones, el matiz va en visualResult: ${capture}`);
      } else if (!existsSync(join(REPO, capture))) {
        warn(id, `evidencia inexistente: ${capture}`);
      }
    }
    if (NEEDS_EVIDENCE.has(entry.state) && entry.evidenceCaptures.length === 0) {
      warn(id, `estado «${entry.state}» sin ninguna imagen que revisar`);
    }
  }
  /**
   * Las rutas citadas en el ejemplo y en el módulo son la única forma de saber si la prueba sigue
   * siendo reproducible después de un refactor: si el archivo ya no está, la entrada miente.
   */
  for (const field of ["scriptOrModule", "reproducibleExample"]) {
    for (const candidate of String(entry[field]).matchAll(
      /((?:tools|scripts|apps|blender_artist|docs)\/[\w./@-]+\.(?:py|mjs|ts|tsx|json|blend|glb))/g,
    )) {
      if (!existsSync(join(REPO, candidate[1])))
        warn(id, `${field} apunta a un archivo que no existe: ${candidate[1]}`);
    }
  }
}

const ids = catalog.capabilities.map((entry) => entry.id);
if (new Set(ids).size !== ids.length) warn("catálogo", "hay ids duplicados");

if (errors.length) {
  console.error(`catálogo de capacidades: ${errors.length} problema(s)`);
  for (const line of errors) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(
  JSON.stringify(
    {
      status: "capabilities-valid",
      entries: ids.length,
      fields: FIELDS.length,
      states: catalog.capabilities.reduce(
        (acc, entry) => ({ ...acc, [entry.state]: (acc[entry.state] ?? 0) + 1 }),
        {},
      ),
    },
    null,
    1,
  ),
);

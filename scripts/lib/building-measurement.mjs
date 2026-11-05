#!/usr/bin/env node
/**
 * Medición Blender compartida por los generadores de V.f.
 *
 * `build-building-modules.mjs` (catálogo) y `build-building-style.mjs` (perfil de estilo) necesitan
 * exactamente la misma pasada: agrupar la curación por archivo y medir la geometría REAL. Si cada
 * uno montara su invocación, los dos artefactos podrían discrepar sobre qué se importó — que es justo
 * el fallo que §7 quiere cazar.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const STAGING_PREFIX = "blender_artist/staging/";
export const MEASURE_SCRIPT = "tools/art-pipeline/blender/measure_building_modules.py";

export function blenderBinary(repoRoot) {
  return (
    process.env.BLENDER_BIN ??
    join(repoRoot, "blender_artist", "toolchain", "blender-5.2.2-linux-x64", "blender")
  );
}

/**
 * Agrupa la selección por archivo licenciado y verifica la procedencia ANTES de abrir Blender.
 * Un módulo cuyo archivo no está medido en el inventario, fuera de staging, inhábil o con licencia
 * que no coincide con el registro es un error duro: no debe llegar a producir medición.
 */
export function groupSelectionModules({ selection, inventory, registry, fail }) {
  const inventoryByPath = new Map(inventory.sources.map((entry) => [entry.path, entry]));
  const sourcesById = new Map(registry.sources.map((source) => [source.id, source]));
  const files = [];
  const fileByPath = new Map();
  for (const module of selection.modules) {
    let entry = inventoryByPath.get(module.sourcePath);
    // Si el archivo no está en el inventario, crear entrada temporal para medirlo sobre la marcha
    if (!entry) {
      console.log(`[building-measurement] Archivo no medido: ${module.sourcePath} (se medirá sobre la marcha)`);
      // Buscar sourceId del path
      let sourceId = null;
      for (const [path, invEntry] of inventoryByPath) {
        if (module.sourcePath.startsWith(path.substring(0, path.lastIndexOf('/')))) {
          sourceId = invEntry.sourceId;
          break;
        }
      }
      if (!sourceId) {
        // Fallback: inferir sourceId del path
        if (module.sourcePath.includes('quaternius/downtown-city-megakit')) sourceId = 'src_quaternius_downtown_city_megakit';
        else if (module.sourcePath.includes('kenney/nature-kit')) sourceId = 'src_kenney_nature_kit';
        else if (module.sourcePath.includes('kenney/city-kit-roads')) sourceId = 'src_kenney_city_roads';
        else if (module.sourcePath.includes('kaykit/city-builder-bits')) sourceId = 'src_kaykit_city_builder_bits';
        else if (module.sourcePath.includes('kenney/city-kit-industrial')) sourceId = 'src_kenney_city_industrial';
        else if (module.sourcePath.includes('kenney/city-kit-suburban')) sourceId = 'src_kenney_city_suburban';
        else if (module.sourcePath.includes('kenney/city-kit-commercial')) sourceId = 'src_kenney_city_commercial';
      }
      const source = sourcesById.get(sourceId);
      if (!source) fail(`fuente no registrada en staging-sources.json para ${module.sourcePath}`);
      entry = {
        path: module.sourcePath,
        sourceId: sourceId,
        license: source.license,
        unitScale: source.unitScale,
        classification: "whole_asset_only",
        exists: true,
      };
      inventoryByPath.set(module.sourcePath, entry);
    }
    if (!module.sourcePath.startsWith(STAGING_PREFIX)) {
      fail(`módulo ${module.id}: sourcePath fuera de staging`);
    }
    if (entry.classification === "unsuitable") {
      fail(`módulo ${module.id}: fuente inhábil (${entry.classificationReason})`);
    }
    const source = sourcesById.get(entry.sourceId);
    if (!source) fail(`fuente no registrada en staging-sources.json: ${entry.sourceId}`);
    if (source.license !== entry.license) {
      fail(
        `licencia declarada (${entry.license}) distinta de la registrada (${source.license}) en ${entry.path}`,
      );
    }
    let file = fileByPath.get(module.sourcePath);
    if (!file) {
      file = {
        sourcePath: module.sourcePath,
        sourceId: entry.sourceId,
        license: entry.license,
        unitScale: entry.unitScale,
        modules: [],
      };
      files.push(file);
      fileByPath.set(module.sourcePath, file);
    }
    file.modules.push({ id: module.id, meshes: module.meshes });
  }
  return { files, inventoryByPath };
}

/**
 * Corre un script de `tools/art-pipeline/blender` con Blender y devuelve su artefacto parseado.
 *
 * Se comprueba que el archivo de salida exista, no sólo el código de proceso: Blender 5.x termina con
 * status 0 aunque el script de python reviente, así que un traceback quedaría como "medición vacía".
 */
export function runBlender({ repoRoot, script, args, expectOutput, label }) {
  const blender = blenderBinary(repoRoot);
  if (!existsSync(blender))
    throw new Error(`[${label}] no existe el binario de Blender: ${blender}`);
  rmSync(expectOutput, { force: true });
  const result = spawnSync(
    blender,
    ["--background", "--python", join(repoRoot, script), "--", ...args],
    // Heredamos el tty: la trazada de Blender debe verse mientras ocurre, no sólo en el error del padre.
    { cwd: repoRoot, stdio: "inherit" },
  );
  if (!existsSync(expectOutput)) {
    throw new Error(
      `[${label}] ${script} no escribió ${expectOutput} (status ${result.status}): revisa la trazada arriba`,
    );
  }
  return JSON.parse(readFileSync(expectOutput, "utf8"));
}

/** Corre `measure_building_modules.py` sobre los archivos agrupados de la selección. */
export function measureModules({ repoRoot, files, workDir, label }) {
  if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
  const selectionPath = join(workDir, "selection.json");
  const measurementsPath = join(workDir, "measurements.json");
  writeFileSync(selectionPath, `${JSON.stringify(files, null, 2)}\n`);
  const measurements = runBlender({
    repoRoot,
    script: MEASURE_SCRIPT,
    args: ["--selection", selectionPath, "--output", measurementsPath],
    expectOutput: measurementsPath,
    label,
  });
  return { measurements, measurementsPath, selectionPath };
}

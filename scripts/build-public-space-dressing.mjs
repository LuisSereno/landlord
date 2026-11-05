#!/usr/bin/env node
/**
 * Orquestador de V.g public-space dressing.
 *
 * Ata las tres piezas del spike sin duplicar su lógica:
 *   1. fixture   → `PSD_FIXTURE=1 vitest psd-fixture.test.ts` vuelca las celdas REALES de plazas y
 *                  parques desde `generateDistrict` (fuente de verdad = dominio, no composición fija).
 *   2. dressing  → `build_public_space_dressing.py` planifica determinista (SplitMix64) y renderiza
 *                  cada espacio en Blender con el rig Graphic Civic del compositor.
 *   3. validator → `validate_public_space_dressing.py` comprueba provenance, bounds, no-solape con
 *                  el town_hall y que la firma sea reproducible.
 *
 * Uso:
 *   node scripts/build-public-space-dressing.mjs
 *   node scripts/build-public-space-dressing.mjs --outDir=blender_artist/showcase/vg-public-space-dressing --no-fixture
 *
 * Requiere Blender local (`blender_artist/toolchain`; `BLENDER_BIN` lo sustituye).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const BLENDER =
  process.env.BLENDER_BIN ??
  join(REPO_ROOT, "blender_artist/toolchain/blender-5.2.2-linux-x64/blender");
const BLENDER_SCRIPT = join(REPO_ROOT, "tools/art-pipeline/blender/build_public_space_dressing.py");
const VALIDATOR = join(REPO_ROOT, "tools/art-pipeline/blender/validate_public_space_dressing.py");
const DEFAULT_OUT_DIR = join(REPO_ROOT, "blender_artist/showcase/vg-public-space-dressing");

function parseArgs(argv) {
  const options = { outDir: DEFAULT_OUT_DIR, regenerateFixture: true };
  for (const argument of argv.slice(2)) {
    const [flag, value] = argument.split("=");
    if (flag === "--outDir") options.outDir = resolve(value);
    else if (flag === "--no-fixture") options.regenerateFixture = false;
    else if (flag === "--help") {
      console.log("uso: node scripts/build-public-space-dressing.mjs [--outDir=dir] [--no-fixture]");
      process.exit(0);
    } else throw new Error(`argumento desconocido ${argument}`);
  }
  return options;
}

function run(command, args, env = {}) {
  console.log(`[dressing] $ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`[dressing] fallo ${command} (status ${result.status})`);
}

function main() {
  const options = parseArgs(process.argv);
  mkdirSync(options.outDir, { recursive: true });

  if (options.regenerateFixture) {
    run("npx", ["vitest", "run", "packages/simulation/src/psd-fixture.test.ts"], {
      PSD_FIXTURE: "1",
      PATH: `/home/luis/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    });
  }

  run(BLENDER, [
    "--background",
    "--python",
    BLENDER_SCRIPT,
    "--",
    "--outDir",
    options.outDir,
    "--spaces=all",
  ]);

  const dressingManifest = join(options.outDir, "dressing-manifest.json");
  if (!existsSync(dressingManifest)) throw new Error(`[dressing] falta ${dressingManifest}`);

  // El manifest del Blender lleva las spaces completas; se valida ese artefacto.
  run("python3", [VALIDATOR, dressingManifest]);

  console.log(`[dressing] OK → ${options.outDir}`);
}

main();

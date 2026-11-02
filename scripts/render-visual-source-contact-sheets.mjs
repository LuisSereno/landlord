import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const blender =
  process.env.BLENDER_BIN ??
  path.join(root, "blender_artist/toolchain/blender-5.2.2-linux-x64/blender");
const localBlender = "/home/luis/.local/blender/blender-5.2.2-linux-x64/blender";
const executable = existsSync(blender) ? blender : localBlender;
const inventory = path.join(root, "docs/art/visual-catalog/source-inventory.json");
const output = path.join(root, "blender_artist/generated/catalog-sources");

if (!existsSync(executable)) throw new Error(`No existe Blender 5.2.2: ${executable}`);
if (!existsSync(inventory)) throw new Error("Ejecuta primero pnpm art:sources:audit");
await mkdir(output, { recursive: true });

const blenderResult = spawnSync(
  executable,
  [
    "--background",
    "--python",
    path.join(root, "tools/art-pipeline/blender/catalog_source_thumbnails.py"),
    "--",
    inventory,
    output,
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);
if (blenderResult.status !== 0) process.exit(blenderResult.status ?? 1);
if (!existsSync(path.join(output, "rendered.json"))) {
  throw new Error("Blender no produjo rendered.json; revisa el traceback anterior");
}

const composeResult = spawnSync(
  "python3",
  [path.join(root, "scripts/compose-visual-source-contact-sheets.py"), output],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);
if (composeResult.status !== 0) process.exit(composeResult.status ?? 1);
process.stdout.write(`${output}\n`);

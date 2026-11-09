#!/usr/bin/env node
/**
 * V.j.7 — adquiere materiales CC0 de Poly Haven (categorías gap de la librería semántica) a 2k.
 * Descarga el .blend + sus texturas `include` a staging/cc0/extracted/polyhaven/<id>/ (gitignored).
 * Imprime sha256 del .blend para registrar la fuente en staging-sources.json.
 *
 * Uso: node scripts/provision-polyhaven-materials.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTRACTED = join(ROOT, "blender_artist/staging/third_party/cc0/extracted/polyhaven");

const MATERIALS = [
  { id: "cobblestone_pavement", category: "pavement" },
  { id: "stone_wall_02", category: "stone" },
  { id: "corrugated_iron_03", category: "metal" },
  { id: "brown_mud_03", category: "soil" },
  { id: "grass_ground", category: "grass" },
];

async function download(url, dest) {
  if (existsSync(dest)) return { skipped: true };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return { bytes: buf.length };
}

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

for (const { id, category } of MATERIALS) {
  const api = await fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json());
  const blend = api.blend?.["2k"]?.blend;
  if (!blend) throw new Error(`${id}: sin blend 2k`);
  const dir = join(EXTRACTED, id);
  const blendDest = join(dir, `${id}_2k.blend`);
  await download(blend.url, blendDest);
  let texCount = 0;
  for (const [rel, file] of Object.entries(blend.include ?? {})) {
    await download(file.url, join(dir, rel));
    texCount++;
  }
  console.log(
    JSON.stringify({ id, category, blend: `${id}_2k.blend`, sha256: sha256(blendDest), textures: texCount, sourceUrl: `https://polyhaven.com/a/${id}` }),
  );
}

#!/usr/bin/env node
/**
 * V.j.5 — Promueve los candidatos del batch (tipo × estado × etapa × orientación) a un manifiesto
 * por-variante + PNGs servidos bajo demanda. Los PNG viven en un dir gitignored (no se commitean,
 * decisión de storage 2026-11-09); sólo el manifiesto JSON se versiona. D-102: el arranque no carga
 * este catálogo; V.j.6 lo carga por distrito.
 *
 * Uso: node scripts/promote-building-variants.mjs [--batch=docs/art/quality-vj/batch]
 */
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const argv = process.argv.slice(2);
const batchArg = argv.find((a) => a.startsWith("--batch="))?.slice("--batch=".length);
const mood = argv.find((a) => a.startsWith("--mood="))?.slice("--mood=".length);
const outputArg = argv.find((a) => a.startsWith("--output="))?.slice("--output=".length);
const variantDirArg = argv
  .find((a) => a.startsWith("--variantDir="))
  ?.slice("--variantDir=".length);
const typesArg = argv.find((a) => a.startsWith("--types="))?.slice("--types=".length);
const selectedTypes = typesArg ? new Set(typesArg.split(",").filter(Boolean)) : null;
const BATCH = resolve(REPO_ROOT, batchArg ?? "docs/art/quality-vj/batch");
const BUNDLE = join(REPO_ROOT, "apps/web/src/generated/runtime-assets-blender.json");
const OUT_MANIFEST = resolve(
  REPO_ROOT,
  outputArg ?? "apps/web/src/generated/runtime-building-variants.json",
);
const VARIANTS_DIR = resolve(REPO_ROOT, variantDirArg ?? "apps/web/public/assets/runtime/variants");
const PUBLIC_DIR = join(REPO_ROOT, "apps", "web", "public");
if (!VARIANTS_DIR.startsWith(`${PUBLIC_DIR}/`)) {
  throw new Error("--variantDir debe estar dentro de apps/web/public");
}
const PUBLIC_VARIANTS_DIR = `/${VARIANTS_DIR.slice(PUBLIC_DIR.length + 1).replaceAll("\\\\", "/")}`;

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const pngSize = (b) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
const variantKey = (type, state, orientation, stage) =>
  `${type}:${state}:${state === "construction" ? (stage ?? "finishing") : "-"}:${orientation}`;

const bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
mkdirSync(VARIANTS_DIR, { recursive: true });
const gitignore = join(VARIANTS_DIR, ".gitignore");
if (!existsSync(gitignore)) writeFileSync(gitignore, "*\n!.gitignore\n");

// Una promoción parcial sólo sustituye los tipos solicitados. Así se puede reparar una familia
// artística sin borrar las variantes ya aprobadas de las demás familias.
const previous = existsSync(OUT_MANIFEST) ? JSON.parse(readFileSync(OUT_MANIFEST, "utf8")) : null;
const variants = selectedTypes ? { ...(previous?.variants ?? {}) } : {};
let copied = 0;
for (const type of readdirSync(BATCH).sort()) {
  if (selectedTypes && !selectedTypes.has(type)) continue;
  const dir = join(BATCH, type);
  if (!existsSync(join(dir, "manifest.json"))) continue; // sólo dirs de tipo
  const base = bundle.buildings[type];
  if (!base)
    throw new Error(`${type}: no está en el bundle runtime (domainFootprint/pixelsPerMeter)`);
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json") || file === "manifest.json") continue;
    const cand = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (mood && cand.moodId !== mood) continue;
    const pngPath = join(dir, `${cand.candidateId}.png`);
    if (!existsSync(pngPath)) throw new Error(`${cand.candidateId}: falta el PNG`);
    const buffer = readFileSync(pngPath);
    if (sha256(buffer) !== cand.sha256) throw new Error(`${cand.candidateId}: sha no coincide`);
    if (!cand.moodId)
      throw new Error(
        `${cand.candidateId}: la procedencia no registra moodId; sin él el manifiesto no puede ` +
          "distinguir grades y dependería del prefijo del archivo",
      );
    const size = pngSize(buffer);
    const key = variantKey(cand.buildingType, cand.state, cand.orientation, cand.constructionStage);
    if (variants[key] && !selectedTypes?.has(type)) {
      throw new Error(`clave de variante duplicada: ${key}`);
    }
    copyFileSync(pngPath, join(VARIANTS_DIR, `${cand.candidateId}.png`));
    variants[key] = {
      moodId: cand.moodId,
      image: {
        src: `${PUBLIC_VARIANTS_DIR}/${cand.candidateId}.png`,
        width: size.width,
        height: size.height,
        sha256: cand.sha256,
      },
      pivot: cand.pivot,
      footprint: cand.footprint,
      domainFootprint: base.domainFootprint,
      pixelsPerMeter: base.pixelsPerMeter,
    };
    copied++;
  }
}

const manifest = {
  schemaVersion: 1,
  generator: { id: "building-composer-vj", method: "blender_render" },
  variants,
};
writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  JSON.stringify({
    status: "promoted",
    variants: copied,
    preserved: Object.keys(variants).length - copied,
    types: selectedTypes ? [...selectedTypes].sort() : "all",
    mood: mood ?? "all",
    moods: [...new Set(Object.values(variants).map((v) => v.moodId))].sort(),
    manifest: OUT_MANIFEST,
    dir: VARIANTS_DIR,
  }),
);

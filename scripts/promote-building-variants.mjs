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
const matrixArg = argv.find((a) => a.startsWith("--matrix="))?.slice("--matrix=".length);
const planArg = argv.find((a) => a.startsWith("--plan="))?.slice("--plan=".length);
const reportArg = argv.find((a) => a.startsWith("--report="))?.slice("--report=".length);
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

if (matrixArg) {
  if (!planArg || !mood) throw new Error("--matrix requiere --plan y --mood");
  const matrixPath = resolve(REPO_ROOT, matrixArg);
  const planPath = resolve(REPO_ROOT, planArg);
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  if (plan.approvalStatus !== "approved_human" || plan.automaticPromotion !== false) {
    throw new Error("La matriz sólo se promueve con aprobación humana registrada y acción manual");
  }
  if (!existsSync(resolve(REPO_ROOT, plan.approvalReference))) {
    throw new Error("Falta la referencia del acta de aprobación humana");
  }
  const matrixTypes = new Set(matrix.assets.map((asset) => asset.buildingType));
  const promotedTypes = selectedTypes ?? matrixTypes;
  for (const type of promotedTypes) {
    if (!matrixTypes.has(type)) throw new Error(`${type}: no pertenece a la matriz`);
  }
  const previous = existsSync(OUT_MANIFEST) ? JSON.parse(readFileSync(OUT_MANIFEST, "utf8")) : null;
  const variants = { ...(previous?.variants ?? {}) };
  for (const key of Object.keys(variants)) {
    if (promotedTypes.has(key.split(":")[0])) delete variants[key];
  }
  mkdirSync(VARIANTS_DIR, { recursive: true });
  const gitignore = join(VARIANTS_DIR, ".gitignore");
  if (!existsSync(gitignore)) writeFileSync(gitignore, "*\n!.gitignore\n");
  const selected = matrix.assets.filter((asset) => asset.moodId === mood);
  if (selected.length === 0) throw new Error(`La matriz no tiene assets para ${mood}`);
  const seen = new Set();
  let copied = 0;
  for (const asset of selected.sort((left, right) => left.key.localeCompare(right.key))) {
    if (!promotedTypes.has(asset.buildingType)) continue;
    const metadataPath = resolve(REPO_ROOT, asset.metadataPath);
    const pngPath = resolve(REPO_ROOT, asset.pngPath);
    const metadataBytes = readFileSync(metadataPath);
    const pngBytes = readFileSync(pngPath);
    if (sha256(metadataBytes) !== asset.metadataSha256) {
      throw new Error(`${asset.candidateId}: hash metadata divergente`);
    }
    if (sha256(pngBytes) !== asset.pngSha256) {
      throw new Error(`${asset.candidateId}: hash PNG divergente`);
    }
    const metadata = JSON.parse(metadataBytes.toString("utf8"));
    if (
      metadata.candidateId !== asset.candidateId ||
      metadata.buildingType !== asset.buildingType ||
      metadata.moodId !== mood ||
      metadata.orientation !== asset.orientation ||
      metadata.state !== asset.runtimeState ||
      metadata.constructionStage !== asset.constructionStage
    ) {
      throw new Error(`${asset.candidateId}: procedencia/estado/orientación divergente`);
    }
    const key = variantKey(
      asset.buildingType,
      asset.runtimeState,
      asset.orientation,
      asset.constructionStage,
    );
    if (seen.has(key)) throw new Error(`Clave duplicada en matriz: ${key}`);
    seen.add(key);
    const size = pngSize(pngBytes);
    copyFileSync(pngPath, join(VARIANTS_DIR, `${asset.candidateId}.png`));
    variants[key] = {
      moodId: mood,
      image: {
        src: `${PUBLIC_VARIANTS_DIR}/${asset.candidateId}.png`,
        width: size.width,
        height: size.height,
        sha256: asset.pngSha256,
      },
      pivot: asset.pivot,
      footprint: asset.footprint,
      domainFootprint: metadata.footprintCells,
      pixelsPerMeter: asset.pixelsPerMeter,
    };
    copied += 1;
  }
  const manifest = {
    schemaVersion: 1,
    generator: { id: "building-composer-approved-matrices", method: "blender_render" },
    variants: Object.fromEntries(
      Object.entries(variants).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  const report = {
    schemaVersion: 1,
    status: "promoted_approved_human",
    matrix: matrixPath.slice(REPO_ROOT.length + 1),
    matrixSha256: sha256(readFileSync(matrixPath)),
    plan: planPath.slice(REPO_ROOT.length + 1),
    planSha256: sha256(readFileSync(planPath)),
    approvalStatus: plan.approvalStatus,
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt,
    mood,
    types: [...promotedTypes].sort(),
    promoted: copied,
    totalVariants: Object.keys(variants).length,
    output: OUT_MANIFEST.slice(REPO_ROOT.length + 1),
    outputSha256: sha256(readFileSync(OUT_MANIFEST)),
  };
  if (reportArg) {
    const reportPath = resolve(REPO_ROOT, reportArg);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

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

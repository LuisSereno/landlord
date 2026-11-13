#!/usr/bin/env node
/**
 * §27 — QA visual obligatoria del Building Composer (V.f.5a).
 *
 * Una lámina por familia con seis columnas:
 *
 *   procedural | source evidence | v1 | v2 | v3 | v4
 *
 * El procedural baseline y la evidencia D-098 son fijos (vienen del bundle publicado). Las cuatro
 * variantes se leen del manifiesto de la corrida canónica. No se etiqueta ninguna como aprobada:
 * §27 lo juzga el responsable con los ojos, no un script.
 *
 * Uso:
 *   node scripts/build-building-composer-contact-sheets.mjs
 *   node scripts/build-building-composer-contact-sheets.mjs --candidates=<dir> --out=<dir>
 *     --types=cement_plant,brickworks,steelworks --prefix=vg
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CANDIDATES = join(REPO_ROOT, "docs/art/building-composer/candidates");
const DEFAULT_OUT = join(REPO_ROOT, "docs/art/golden/vf-building-composer");

const FAMILIES = [
  {
    buildingType: "row_house",
    label: "Vivienda en hilera",
    procedural: "docs/art/golden/visual-catalog/04-residential.png",
  },
  {
    buildingType: "cement_plant",
    label: "Planta de cemento",
    procedural: "docs/art/golden/visual-catalog/05-industrial.png",
  },
  {
    buildingType: "brickworks",
    label: "Ladrillera",
    procedural: "docs/art/golden/visual-catalog/05-industrial.png",
  },
  {
    buildingType: "steelworks",
    label: "Acería",
    procedural: "docs/art/golden/visual-catalog/05-industrial.png",
  },
  {
    buildingType: "town_hall",
    label: "Ayuntamiento",
    procedural: "docs/art/golden/visual-catalog/06-civic.png",
  },
];
const SEEDS = [1000, 1001, 1002, 1003];

function parseArgs(argv) {
  const options = { candidates: DEFAULT_CANDIDATES, out: DEFAULT_OUT, types: null, prefix: "vf" };
  for (const argument of argv.slice(2)) {
    const [flag, value] = argument.split("=");
    if (flag === "--candidates") options.candidates = resolve(value);
    else if (flag === "--out") options.out = resolve(value);
    else if (flag === "--types") options.types = value.split(",");
    else if (flag === "--prefix") options.prefix = value;
    else throw new Error(`argumento desconocido ${argument}`);
  }
  return options;
}

function composeSheets(options) {
  const families = options.types
    ? options.types.map((buildingType) => {
        const family = FAMILIES.find((candidate) => candidate.buildingType === buildingType);
        if (!family) throw new Error(`tipo sin configuración de lámina: ${buildingType}`);
        return family;
      })
    : FAMILIES.filter(({ buildingType }) =>
        ["row_house", "cement_plant", "town_hall"].includes(buildingType),
      );
  const script = `
from PIL import Image, ImageDraw, ImageFont
import json, os

REPO = "${REPO_ROOT}"
CANDIDATES = "${options.candidates}"
OUT = "${options.out}"
CELL = 384
MARGIN = 24
LABEL_H = 48
SEEDS = ${JSON.stringify(SEEDS)}

families = ${JSON.stringify(families)}
prefix = ${JSON.stringify(options.prefix)}

def load(path):
    if not os.path.exists(path):
        return None
    img = Image.open(path).convert("RGBA")
    img.thumbnail((CELL, CELL), Image.LANCZOS)
    return img

def font(size):
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

manifest_path = os.path.join(CANDIDATES, "manifest.json")
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {"candidates": []}
by_id = {c["candidateId"]: c for c in manifest.get("candidates", [])}

written = []
for fam in families:
    bt = fam["buildingType"]
    columns = []
    proc = load(os.path.join(REPO, fam["procedural"]))
    if proc:
        columns.append(("procedural", proc))
    for seed in SEEDS:
        cid = f"{prefix}_{bt}_{seed}"
        path = os.path.join(CANDIDATES, f"{cid}.png")
        img = load(path)
        if img is None:
            continue
        entry = by_id.get(cid, {})
        signature = entry.get("compositionSignature", "?")[:8]
        columns.append((f"v{seed - 999} · {signature}", img))
    if not columns:
        print(f"SIN COLUMNAS para {bt}: revisa {CANDIDATES}")
        continue
    width = MARGIN + len(columns) * (CELL + MARGIN)
    height = MARGIN + LABEL_H + CELL + LABEL_H + MARGIN
    sheet = Image.new("RGBA", (width, height), (24, 26, 32, 255))
    draw = ImageDraw.Draw(sheet)
    title_font = font(22)
    caption_font = font(16)
    draw.text((MARGIN, MARGIN), f"{fam['label']} — {bt}", fill=(232, 234, 240, 255), font=title_font)
    x = MARGIN
    for caption, img in columns:
        sheet.alpha_composite(img, (x + (CELL - img.width) // 2, MARGIN + LABEL_H + (CELL - img.height) // 2))
        draw.text((x, MARGIN + LABEL_H + CELL + 8), caption, fill=(180, 184, 196, 255), font=caption_font)
        x += CELL + MARGIN
    out_path = os.path.join(OUT, f"{bt}-contact-sheet.png")
    sheet.save(out_path)
    written.append(out_path)
    print(f"escrita: {out_path} ({len(columns)} columnas)")

print(json.dumps(written))
`;
  const tempDir = mkdtempSync(join(tmpdir(), "landlord-composer-sheets-"));
  const scriptPath = join(tempDir, "compose-sheets.py");
  try {
    writeFileSync(scriptPath, script);
    const run = spawnSync("python3", [scriptPath], { stdio: "inherit", cwd: REPO_ROOT });
    if (run.status !== 0) {
      throw new Error(`la composición de láminas §27 falló (exit ${run.status})`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv);
  mkdirSync(options.out, { recursive: true });
  composeSheets(options);
  console.log(`\nláminas §27 escritas en ${options.out}`);
}

main();

#!/usr/bin/env python3
"""D-111.2 cierre FASE 3 — hojas `four_candidates_in_phaser{,_half}.png`.

Cada pareja control/candidata se fotografió por separado a su zoom (el mundo real a 1× no cabe en
1440×900 con las cuatro); la hoja las junta en un tablero 2×2 con su rotulo medido — candidatoId,
firma de composición, fila QA y zoom. No re-captura nada: lee las PNG del manifiesto.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

URBAN_DIR = Path("docs/art/graphics-capabilities/evidence/v2/closure/urban")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
TYPES = ["row_house", "mixed_tenement", "town_hall", "warehouse"]
CELL_W, CELL_H = 690, 420
CAPTION_H = 96
PAD = 24


def fit(image: Image.Image) -> Image.Image:
    scale = min((CELL_W - 2 * PAD) / image.width, (CELL_H - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def main() -> None:
    manifest = json.loads((URBAN_DIR / "candidate-runtime-qa-manifest.json").read_text(encoding="utf-8"))
    by_file = {capture["file"][: -len(".png")]: capture for capture in manifest["captures"]}
    for token, zoom in (("10x", 1), ("05x", 0.5)):
        sheet_w = 2 * (CELL_W + PAD) + PAD
        sheet_h = 92 + 2 * (CELL_H + CAPTION_H + PAD) + 56
        sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
        draw = ImageDraw.Draw(sheet)
        draw.text((PAD, 24), f"D-111.2 cierre FASE 3 · cuatro candidatas WP06 dentro de Phaser · zoom {zoom}×", fill=TEXT)
        draw.text(
            (PAD, 50),
            "control aprobado y candidata en el mismo fotograma, sobre terreno del mundo real · "
            "muestra QA rotulada en el propio lienzo · nada promocionado",
            fill=MUTED,
        )
        for index, building_type in enumerate(TYPES):
            capture = by_file[f"{building_type}_pair_{token}"]
            entry = next(
                item for item in manifest["candidates"] if item["buildingType"] == building_type
            )
            candidata = entry["candidata"]
            control = entry["control"]
            col, row = index % 2, index // 2
            x = PAD + col * (CELL_W + PAD)
            y = 92 + row * (CELL_H + CAPTION_H + PAD)
            draw.rectangle([x, y, x + CELL_W, y + CELL_H], fill=PANEL_BG)
            image = Image.open(URBAN_DIR / capture["file"]).convert("RGB")
            fitted = fit(image)
            sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + (CELL_H - fitted.height) // 2))
            draw.text((x + 6, y + CELL_H + 8), f"{building_type} · {candidata['candidateProfile']}", fill=ACCENT)
            lines = [
                f"candidata {candidata['candidateId']} · firma {candidata['compositionSignature'][:12]} · seed {candidata['variantSeed']}",
                f"fila QA y={capture['pairRow']} desde x={capture['pairStartX']} · control del catálogo: {control['textureSrc'].split('/')[-1]}",
            ]
            for line_index, line in enumerate(lines):
                draw.text((x + 6, y + CELL_H + 30 + line_index * 20), line, fill=MUTED)
        draw.text(
            (PAD, sheet_h - 34),
            "procedencia: candidate-runtime-qa-manifest.json · ruta QA __landlordCameraTest.placeCandidateQa · "
            "capturas scripts/candidate-phaser-capture.mjs",
            fill=MUTED,
        )
        name = f"four_candidates_in_phaser{'' if zoom == 1 else '_half'}.png"
        out = URBAN_DIR / name
        sheet.save(out)
        print(f"{out} {sheet_w}x{sheet_h}")


if __name__ == "__main__":
    main()

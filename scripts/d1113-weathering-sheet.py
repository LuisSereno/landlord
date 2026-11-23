#!/usr/bin/env python3
"""D-111.3 FASE 5 — hoja `weathering_v3_ab.png`.

Tres columnas sobre la MISMA base (fachada corregida + ambiente neutro): conservado, envejecido con
la receta v2 (la que exigía zoom 2,5×) y envejecido con la receta v3 reforzada. Filas: 1×, 0,5× y
detalle a ~2,5×. Cifras medidas en las etiquetas: diferencia media contra el conservado.
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 460, 470
CAPTION_H = 92
PAD = 20
CONS = Path("/tmp/d1113/fixed3_mixed/w06cnd_mixed_tenement_2.png")
V2 = Path("/tmp/d1113/aged_v2b/w06cnd_mixed_tenement_2_aged.png")
V3 = Path("/tmp/d1113/aged_v3/w06cnd_mixed_tenement_2_aged.png")
COLUMNS = [
    (CONS, "CONSERVADO · tier conserved"),
    (V2, "ENVEJECIDO v2 · receta anterior (diff 9,2/255)"),
    (V3, "ENVEJECIDO v3 · receta reforzada (diff 16,1/255)"),
]
# Detalle a 2,5×: cabecera de los paños con regueros y hollín bajo cornisa.
DETAIL = (180, 430, 620, 870)


def fit(image: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def main() -> None:
    (OUT / "weathering").mkdir(parents=True, exist_ok=True)
    header_h = 64
    width = CELL_W * 3 + PAD * 4
    height = header_h + 3 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "D-111.3 FASE 5 · envejecimiento legible a escala de juego — misma arquitectura (mixed_tenement seed 2)",
        fill=ACCENT,
    )
    for index, (png, title) in enumerate(COLUMNS):
        shutil.copy(png, OUT / "weathering" / f"{'conserved' if index == 0 else ('aged_v2' if index == 1 else 'aged_v3')}.png")
        image = Image.open(png).convert("RGB")
        for row, (scale, label) in enumerate(((1.0, "1×"), (0.5, "0,5×"))):
            x = PAD + index * (CELL_W + PAD)
            y = header_h + row * (CELL_H + CAPTION_H + PAD)
            shown = image if scale == 1.0 else image.resize((image.width // 2, image.height // 2))
            shown = fit(shown, CELL_W, CELL_H)
            draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
            sheet.paste(shown, (x + (CELL_W - shown.width) // 2, y + CAPTION_H + (CELL_H - shown.height) // 2))
            draw.text((x, y + 4), f"{title} · {label}", fill=TEXT)
        y = header_h + 2 * (CELL_H + CAPTION_H + PAD)
        detail = image.crop(DETAIL)
        target_w = CELL_W - 2 * PAD
        shown = detail.resize((target_w, int(target_w * detail.height / detail.width)))
        if shown.height > CELL_H - 2 * PAD:
            shown = shown.crop((0, 0, shown.width, CELL_H - 2 * PAD))
        draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
        sheet.paste(shown, (x + PAD, y + CAPTION_H + (CELL_H - shown.height) // 2))
        draw.text((x, y + 4), f"{title} · detalle ~2,5×", fill=TEXT)
    sheet.save(OUT / "weathering_v3_ab.png")
    # cifras de la comparación
    cons = np.array(Image.open(CONS).convert("RGB"), dtype=np.float32)
    stats = {}
    for index, (png, _title) in enumerate(COLUMNS[1:], start=1):
        im = np.array(Image.open(png).convert("RGB"), dtype=np.float32)
        stats["aged_v2" if index == 1 else "aged_v3"] = {
            "diffMedio255_1x": round(float(np.abs(im - cons).mean()), 2),
            "pxDifieren18Pct": round(float((np.abs(im - cons).max(axis=-1) > 18).mean()) * 100, 1),
            "diffMedio255_05x": round(float(
                np.abs(
                    np.array(Image.open(png).convert("RGB").resize((524, 523)), dtype=np.float32)
                    - np.array(Image.open(CONS).convert("RGB").resize((524, 523)), dtype=np.float32)
                ).mean()
            ), 2),
        }
    meta = {
        "schemaVersion": 1,
        "sheet": "weathering_v3_ab.png",
        "building": "mixed_tenement",
        "seed": 2,
        "candidateProfile": "gn_residential_v2",
        "base": "fachada FASE 2 corregida + ambiente day_civic neutro (misma base para las tres columnas)",
        "columns": {"conserved": "fixed3_mixed", "aged_v2": "receta anterior re-renderizada sobre la nueva base", "aged_v3": "receta reforzada (contract fase5v3)"},
        "measured": stats,
        "note": "el aged sigue sin promocionarse (D-080); las exclusiones del contrato intactas",
    }
    (OUT / "weathering_v3_ab.json").write_text(
        json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"weathering_v3_ab.png {sheet.width}×{sheet.height} · {json.dumps(stats)}")


if __name__ == "__main__":
    main()

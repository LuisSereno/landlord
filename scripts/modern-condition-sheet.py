#!/usr/bin/env python3
"""FINAL-ASSET-QA FASE 5 — hoja `modern_building_condition_ab.png`.

Cuatro paneles del MISMO mixed_tenement WP06: conservado, envejecido (proyección material QA),
dañado y en llamas. La comparativa exige que las cuatro apariencias compartan arquitectura —
la firma de composición del aged es la del complete porque el weathering no mueve geometría.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path("docs/art/graphics-capabilities/evidence/v2/final-assets")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 700, 470
CAPTION_H = 130
PAD = 24
# Recorte alrededor del candidato (colocación fija del lab, zoom 2,5): el estado se juzga en el
# edificio, no en la calle entera.
CROP = (60, 40, 760, 540)
PANELS = [
    ("condition_conserved", "CONSERVADO · tier conserved (sprite complete)"),
    ("condition_aged", "ENVEJECIDO · proyección material QA (weathering aged)"),
    ("condition_damaged", "DAÑADO · geometría damaged del compositor"),
    ("condition_burning", "EN LLAMAS · variante híbrida con anclajes reales"),
]


def fit(image: Image.Image) -> Image.Image:
    cropped = image.crop(CROP)
    scale = min((CELL_W - 2 * PAD) / cropped.width, (CELL_H - 2 * PAD) / cropped.height)
    return cropped.resize((max(1, int(cropped.width * scale)), max(1, int(cropped.height * scale))))


def caption(arm: str) -> str:
    record = json.loads((OUT_DIR / f"{arm}.json").read_text(encoding="utf-8"))
    candidate = record.get("candidate") or {}
    return "\n".join(
        [
            f"{record['candidateName']} · {candidate.get('candidateId', '?')} · "
            f"perfil {candidate.get('candidateProfile', '?')}",
            f"firma {candidate.get('compositionSignature', '?')[:12]} · "
            f"anclajes {candidate.get('fireAnchors', 0)}",
            f"{record['pngBytes'] // 1024} KiB · {record['glRenderer'] or 'renderer'}",
        ]
    )


def main() -> None:
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + 2 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "FINAL-ASSET-QA · cuatro estados de conservación sobre la MISMA arquitectura "
        "(mixed_tenement WP06) — día",
        fill=ACCENT,
    )
    for index, (arm, title) in enumerate(PANELS):
        col = index % 2
        row = index // 2
        x = PAD + col * (CELL_W + PAD)
        y = header_h + row * (CELL_H + CAPTION_H + PAD)
        panel_y = y + CAPTION_H
        png = Image.open(OUT_DIR / f"{arm}.png").convert("RGB")
        draw.rectangle([x, panel_y, x + CELL_W, panel_y + CELL_H], fill=PANEL_BG)
        fitted = fit(png)
        sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, panel_y + (CELL_H - fitted.height) // 2))
        draw.text((x, y + 4), title, fill=TEXT)
        draw.multiline_text((x, y + 26), caption(arm), fill=MUTED, spacing=6)
    sheet.save(OUT_DIR / "modern_building_condition_ab.png")
    print(f"modern_building_condition_ab.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

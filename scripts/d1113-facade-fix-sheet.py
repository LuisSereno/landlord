#!/usr/bin/env python3
"""D-111.3 FASE 2 — hojas `facade_fix_{mixed_tenement,row_house}_ab.png`.

Fila 1: control publicado (antes) vs corrección (después) a 1×. Fila 2: detalle ampliado de la zona
corregida. Fila 3: ambas a 0,5× (la escala del juego al medio zoom). El "después" es el re-render del
pipeline oficial con la corrección de carpintería GN y ambiente de día calentado; el "antes" es el
candidata publicado de D-111.2, congelado como control.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113/facades")
CAND = Path("docs/art/graphics-capabilities/evidence/v2/candidates")
FIXED = Path("/tmp/d1113")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 700, 500
CAPTION_H = 96
PAD = 24

SHEETS = [
    {
        "name": "facade_fix_mixed_tenement_ab",
        "building": "mixed_tenement",
        "seed": 2,
        "control": CAND / "wp06_mixed_tenement-candidata.png",
        "fixed": FIXED / "fixed3_mixed/w06cnd_mixed_tenement_2.png",
        # Detalle: cabecera de los paños encastrados de la fachada izquierda
        "detail": (180, 430, 620, 870),
    },
    {
        "name": "facade_fix_row_house_ab",
        "building": "row_house",
        "seed": 17,
        "control": CAND / "wp06_row_house-candidata.png",
        "fixed": FIXED / "fixed3_row/w06cnd_row_house_17.png",
        # Detalle: muro lateral de ladrillo bajo el alero de la mansarda
        "detail": (640, 560, 996, 980),
    },
]


def fit(image: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def panel(sheet: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, png: Path, title: str) -> None:
    image = Image.open(png).convert("RGB")
    draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
    fitted = fit(image, CELL_W, CELL_H)
    sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + CAPTION_H + (CELL_H - fitted.height) // 2))
    draw.text((x, y + 4), title, fill=TEXT)


def detail_panel(sheet: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, png: Path, rect: tuple, title: str) -> None:
    image = Image.open(png).convert("RGB").crop(rect)
    image = image.resize((CELL_W - 2 * PAD, int((CELL_W - 2 * PAD) * image.height / image.width)))
    if image.height > CELL_H - 2 * PAD:
        image = image.crop((0, 0, image.width, CELL_H - 2 * PAD))
    draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
    sheet.paste(image, (x + PAD, y + CAPTION_H + (CELL_H - image.height) // 2))
    draw.text((x, y + 4), title, fill=TEXT)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for spec in SHEETS:
        header_h = 64
        rows = 3
        width = CELL_W * 2 + PAD * 3
        height = header_h + rows * (CELL_H + CAPTION_H + PAD) + PAD
        sheet = Image.new("RGB", (width, height), BG)
        draw = ImageDraw.Draw(sheet)
        draw.text(
            (PAD, 20),
            f"D-111.3 FASE 2 · {spec['building']} seed {spec['seed']} — fachada ANTES (control D-111.2) "
            f"vs DESPUÉS (carpintería GN corregida + ambiente neutro)",
            fill=ACCENT,
        )
        y = header_h
        for col, (png, title) in enumerate(
            [
                (spec["control"], "ANTES · control publicado (franja negra-verdosa)"),
                (spec["fixed"], "DESPUÉS · corrección FASE 2 (sombra natural, sin franja)"),
            ]
        ):
            panel(sheet, draw, PAD + col * (CELL_W + PAD), y, png, title)
        y += CELL_H + CAPTION_H + PAD
        for col, (png, title) in enumerate(
            [
                (spec["control"], "ANTES · detalle ampliado de la zona corregida"),
                (spec["fixed"], "DESPUÉS · detalle ampliado"),
            ]
        ):
            detail_panel(sheet, draw, PAD + col * (CELL_W + PAD), y, png, spec["detail"], title)
        y += CELL_H + CAPTION_H + PAD
        for col, (png, title) in enumerate(
            [
                (spec["control"], "ANTES · 0,5× (escala de juego al medio zoom)"),
                (spec["fixed"], "DESPUÉS · 0,5×"),
            ]
        ):
            image = Image.open(png).convert("RGB")
            half = image.resize((image.width // 2, image.height // 2))
            half = fit(half, CELL_W, CELL_H)
            x = PAD + col * (CELL_W + PAD)
            draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
            sheet.paste(half, (x + (CELL_W - half.width) // 2, y + CAPTION_H + (CELL_H - half.height) // 2))
            draw.text((x, y + 4), title, fill=TEXT)
        y += CELL_H + CAPTION_H + PAD
        sheet.save(OUT / f"{spec['name']}.png")
        meta = {
            "schemaVersion": 1,
            "sheet": f"{spec['name']}.png",
            "building": spec["building"],
            "seed": spec["seed"],
            "before": str(spec["control"]),
            "afterSource": "re-render del pipeline oficial (gn_facade_grammar.py carpintería corregida + style layer day_civic ambiente neutro)",
            "detailRect": list(spec["detail"]),
            "controlsKept": True,
        }
        (OUT / f"{spec['name']}.json").write_text(
            json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        print(f"{spec['name']}.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

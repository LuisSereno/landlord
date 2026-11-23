#!/usr/bin/env python3
"""D-111.3 FASE 3 — hoja `damaged_interior_mixed_tenement_ab.png`.

Arriba: dañado actual (control D-111.2, cascarón vacío) vs dañado con interior dressing. Medio:
detalle ampliado de la sección abierta. Abajo: ambos a 0,5×. El "después" añade forjados parciales,
un tabique, un tramo de escalera, vigas del arranque de cubierta y palés dentro del rectángulo del
daño; la masa intacta y los escombros no cambian.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113")
CAND = Path("docs/art/graphics-capabilities/evidence/v2/candidates")
AFTER = Path("/tmp/d1113/f4b_mixed_dmg/w06cnd_mixed_tenement_2_damaged.png")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 700, 500
CAPTION_H = 96
PAD = 24
# Detalle: la sección abierta (mitad derecha, niveles ventilados).
DETAIL = (520, 260, 1050, 720)


def fit(image: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def panel(sheet, draw, x, y, png, title):
    image = Image.open(png).convert("RGB")
    draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
    fitted = fit(image, CELL_W, CELL_H)
    sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + CAPTION_H + (CELL_H - fitted.height) // 2))
    draw.text((x, y + 4), title, fill=TEXT)


def detail_panel(sheet, draw, x, y, png, rect, title):
    image = Image.open(png).convert("RGB").crop(rect)
    image = image.resize((CELL_W - 2 * PAD, int((CELL_W - 2 * PAD) * image.height / image.width)))
    if image.height > CELL_H - 2 * PAD:
        image = image.crop((0, 0, image.width, CELL_H - 2 * PAD))
    draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
    sheet.paste(image, (x + PAD, y + CAPTION_H + (CELL_H - image.height) // 2))
    draw.text((x, y + 4), title, fill=TEXT)


def main() -> None:
    (OUT / "interiors").mkdir(parents=True, exist_ok=True)
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + 3 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "D-111.3 FASE 3 · mixed_tenement dañado — control (cascarón vacío) vs interior dressing "
        "(forjados, tabique, escalera, vigas, palés)",
        fill=ACCENT,
    )
    y = header_h
    for col, (png, title) in enumerate(
        [
            (CAND / "wp06_mixed_tenement-damaged.png", "ANTES · dañado D-111.2 (cascarón vacío)"),
            (AFTER, "DESPUÉS · interior dressing FASE 3"),
        ]
    ):
        panel(sheet, draw, PAD + col * (CELL_W + PAD), y, png, title)
    y += CELL_H + CAPTION_H + PAD
    for col, (png, title) in enumerate(
        [
            (CAND / "wp06_mixed_tenement-damaged.png", "ANTES · detalle de la sección"),
            (AFTER, "DESPUÉS · detalle de la sección"),
        ]
    ):
        detail_panel(sheet, draw, PAD + col * (CELL_W + PAD), y, png, DETAIL, title)
    y += CELL_H + CAPTION_H + PAD
    for col, (png, title) in enumerate(
        [
            (CAND / "wp06_mixed_tenement-damaged.png", "ANTES · 0,5×"),
            (AFTER, "DESPUÉS · 0,5×"),
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
    sheet.save(OUT / "damaged_interior_mixed_tenement_ab.png")
    meta = {
        "schemaVersion": 1,
        "sheet": "damaged_interior_mixed_tenement_ab.png",
        "building": "mixed_tenement",
        "seed": 2,
        "candidateProfile": "gn_residential_v2",
        "before": "evidence/v2/candidates/wp06_mixed_tenement-damaged.png (firma d1685fc830ea…)",
        "after": {
            "signature": "d59f2ab367bc…",
            "newModules": [
                "mod_megakit_floor_slab_2m (forjados parciales)",
                "mod_megakit_brick_wall_2m (tabique)",
                "mod_kenney_stairs_center (tramo de escalera, registro nuevo CC0)",
                "mod_kenney_detail_beam (vigas de cubierta, registro nuevo CC0)",
                "mod_kenney_pallet (palés, registro nuevo CC0)",
            ],
            "implementation": "_compose_damage_interior() en compose.py; determinista por semilla, limitado al rectángulo del daño",
        },
        "detailRect": list(DETAIL),
    }
    (OUT / "damaged_interior_mixed_tenement_ab.json").write_text(
        json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    shutil = __import__("shutil")
    shutil.copy(AFTER, OUT / "interiors" / "w06cnd_mixed_tenement_2_damaged.png")
    shutil.copy(
        "/tmp/d1113/interior/w06cnd_mixed_tenement_2_damaged.json",
        OUT / "interiors" / "w06cnd_mixed_tenement_2_damaged.json",
    )
    print(f"damaged_interior_mixed_tenement_ab.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

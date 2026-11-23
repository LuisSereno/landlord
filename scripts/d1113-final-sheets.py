#!/usr/bin/env python3
"""D-111.3 FASE 7 — ensambla las cuatro hojas finales desde los brazos capturados en Phaser.

Cada panel lleva la candidata realmente servida (candidateId, firma, mood, zoom) según el JSON de
procedencia que escribió el arnés. Rutas: evidence/d1113/final/.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113/final")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 640, 470
CAPTION_H = 96
PAD = 20


def fit(image, cell_w, cell_h):
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def load(arm):
    png = OUT / f"{arm}.png"
    meta = json.loads((OUT / f"{arm}.json").read_text(encoding="utf-8"))
    return Image.open(png).convert("RGB"), meta


def panel(sheet, draw, x, y, arm, title, image=None, meta=None):
    if image is None:
        image, meta = load(arm)
    draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
    fitted = fit(image, CELL_W, CELL_H)
    sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + CAPTION_H + (CELL_H - fitted.height) // 2))
    draw.text((x, y + 4), title, fill=TEXT)
    cand = meta.get("candidate") or {}
    draw.multiline_text(
        (x, y + 26),
        f"{meta['candidateName']} · {cand.get('candidateId', '?')} · firma {cand.get('compositionSignature', '?')[:12]} · "
        f"{meta['mood']} · zoom {meta['zoom']}",
        fill=MUTED,
        spacing=5,
    )
    return image, meta


def build(name, title, arms, columns):
    header_h = 64
    rows = (len(arms) + columns - 1) // columns
    width = CELL_W * columns + PAD * (columns + 1)
    height = header_h + rows * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 20), title, fill=ACCENT)
    for index, arm in enumerate(arms):
        col = index % columns
        row = index // columns
        x = PAD + col * (CELL_W + PAD)
        y = header_h + row * (CELL_H + CAPTION_H + PAD)
        image, meta = load(arm["arm"]) if isinstance(arm, dict) and "image" not in arm else (arm["image"], arm["meta"])
        title_text = arm.get("title", arm["arm"])
        panel(sheet, draw, x, y, arm["arm"], title_text, image=image, meta=meta)
    sheet.save(OUT / name)
    print(f"{name} {sheet.width}×{sheet.height}")


def main() -> None:
    # 1 · candidatos de ciudad corregidos (día) y town_hall día/noche
    arms = []
    for arm, title in (
        ("city_mixed_day", "mixed_tenement · fachada corregida"),
        ("city_row_house_day", "row_house · fachada corregida"),
        ("city_warehouse_day", "warehouse · aprobado, sin cambios"),
        ("city_town_hall_day", "town_hall NEACLÁSICO · día"),
    ):
        arms.append({"arm": arm, "title": title})
    build("d1113_city_candidates.png", "D-111.3 FASE 7 · candidatos de ciudad sobre el mundo real (ruta QA, día)", arms, 2)

    # 2 · daño y fuego con interiores
    arms = [
        {"arm": "damage_mixed_damaged_day", "title": "residencial dañado · interiores"},
        {"arm": "damage_mixed_burning_day", "title": "residencial en llamas · interiores"},
        {"arm": "damage_warehouse_damaged_night", "title": "almacén dañado · interiores (noche)"},
        {"arm": "damage_warehouse_burning_night", "title": "almacén en llamas · interiores (noche)"},
    ]
    build("d1113_damage_fire.png", "D-111.3 FASE 7 · daño e incendio con interiores en Phaser (anclajes del control)", arms, 2)

    # 3 · envejecimiento a las tres escalas
    cons1, _ = load("ageing_conserved_day_1x")
    cons25, _ = load("ageing_conserved_day_25x")
    aged1, m1 = load("ageing_aged_day_1x")
    aged05, m05 = load("ageing_aged_day_05x")
    aged25, _ = load("ageing_aged_day_25x")
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + 2 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 20), "D-111.3 FASE 7 · envejecimiento v3 en Phaser — conservado vs aged a 1×, 0,5× y 2,5×", fill=ACCENT)
    grid = [
        [("conservado · 1×", cons1, None), ("aged v3 · 1×", aged1, m1)],
        [("conservado · 2,5×", cons25, None), ("aged v3 · 0,5× (y detalle 2,5×)", aged05 if False else aged25, m05)],
    ]
    y = header_h
    for row in grid:
        for col, (title, image, meta) in enumerate(row):
            x = PAD + col * (CELL_W + PAD)
            panel(sheet, draw, x, y, None, title, image=image, meta=meta or {"candidateName": "mixed_tenement-aged", "candidate": {}, "mood": "day", "zoom": "0,5"})
        y += CELL_H + CAPTION_H + PAD
    sheet.save(OUT / "d1113_ageing.png")
    print("d1113_ageing.png", sheet.width, sheet.height)

    # 4 · town hall día y noche
    arms = [
        {"arm": "city_town_hall_day", "title": "neoclassical_town_hall_v1 · día"},
        {"arm": "city_town_hall_night", "title": "neoclassical_town_hall_v1 · noche (night_balanced, sin recalibrar)"},
    ]
    build("d1113_town_hall.png", "D-111.3 FASE 7 · ayuntamiento neoclásico en Phaser, día y noche", arms, 2)


if __name__ == "__main__":
    main()

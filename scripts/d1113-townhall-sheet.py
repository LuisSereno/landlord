#!/usr/bin/env python3
"""D-111.3 FASE 6 — hoja `town_hall_neoclassical_ab.png`.

Fila 1: ayuntamiento anterior (candidata ag_civic_v2, control congelado) vs nuevo neoclásico a 1×.
Fila 2: vista de entrada (pórtico, escalinata y frontón) ampluada de cada uno. Fila 3: 0,5×.
"""

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113")
CAND = Path("docs/art/graphics-capabilities/evidence/v2/candidates")
AFTER = Path("docs/art/graphics-capabilities/evidence/d1113/townhall/w06cnd_town_hall_5.png")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 640, 480
CAPTION_H = 92
PAD = 20
# Vista de entrada: mitad central de la fachada principal.
DETAIL_OLD = (330, 300, 900, 1160)
DETAIL_NEW = (520, 420, 1180, 1250)


def fit(image: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def main() -> None:
    (OUT / "townhall").mkdir(parents=True, exist_ok=True)
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + 3 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "D-111.3 FASE 6 · town_hall — RECHAZADO como ayuntamiento (ag_civic_v2, control) vs "
        "propuesta neoclásica monumental (neoclassical_town_hall_v1, seed 5)",
        fill=ACCENT,
    )
    y = header_h
    for col, (png, title) in enumerate(
        [
            (CAND / "wp06_town_hall-candidata.png", "ANTERIOR · ag_civic_v2 (arcada, patio desnudo)"),
            (AFTER, "NUEVO · neoclassical_town_hall_v1 (pórtico, frontón, escalinata)"),
        ]
    ):
        image = Image.open(png).convert("RGB")
        draw.rectangle([x := PAD + col * (CELL_W + PAD), y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
        fitted = fit(image, CELL_W, CELL_H)
        sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + CAPTION_H + (CELL_H - fitted.height) // 2))
        draw.text((x, y + 4), title, fill=TEXT)
    y += CELL_H + CAPTION_H + PAD
    for col, (png, rect, title) in enumerate(
        [
            (CAND / "wp06_town_hall-candidata.png", DETAIL_OLD, "ANTERIOR · acceso"),
            (AFTER, DETAIL_NEW, "NUEVO · acceso monumental"),
        ]
    ):
        image = Image.open(png).convert("RGB").crop(rect)
        target_w = CELL_W - 2 * PAD
        shown = image.resize((target_w, int(target_w * image.height / image.width)))
        if shown.height > CELL_H - 2 * PAD:
            shown = shown.crop((0, 0, shown.width, CELL_H - 2 * PAD))
        x = PAD + col * (CELL_W + PAD)
        draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
        sheet.paste(shown, (x + PAD, y + CAPTION_H + (CELL_H - shown.height) // 2))
        draw.text((x, y + 4), title, fill=TEXT)
    y += CELL_H + CAPTION_H + PAD
    for col, (png, title) in enumerate(
        [
            (CAND / "wp06_town_hall-candidata.png", "ANTERIOR · 0,5×"),
            (AFTER, "NUEVO · 0,5×"),
        ]
    ):
        image = Image.open(png).convert("RGB")
        half = image.resize((image.width // 2, image.height // 2))
        half = fit(half, CELL_W, CELL_H)
        x = PAD + col * (CELL_W + PAD)
        draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
        sheet.paste(half, (x + (CELL_W - half.width) // 2, y + CAPTION_H + (CELL_H - half.height) // 2))
        draw.text((x, y + 4), title, fill=TEXT)
    sheet.save(OUT / "townhall" / "town_hall_neoclassical_ab.png")
    meta = {
        "schemaVersion": 1,
        "sheet": "town_hall_neoclassical_ab.png",
        "building": "town_hall",
        "seed": 5,
        "recipe": "grand_neoclassical_hall (receta de la gramática de producción, elegida por sorteo de seed)",
        "profile": "neoclassical_town_hall_v1",
        "profileChanges": [
            "recipe.grand_neoclassical_hall.grand_portico_columns=mod_original_neoclassical_column (blanca, original)",
            "facade.warm_limestone.wall_panel=mod_original_neoclassical_wall_2m (caliza clara, original)",
            "facade.warm_limestone.window_bay=mod_megakit_civic_piano_nobile_window",
            "silhouette.metal_cornice.corniceModule=mod_megakit_cornice_trim_center_2m (pálida)",
        ],
        "after": {"signature": "8a193df6dc8b…", "footprintCells": "5×3", "floors": 3},
        "agCivicV2Kept": True,
        "before": "evidence/v2/candidates/wp06_town_hall-candidata.png (firma d950e513e67e…)",
    }
    (OUT / "townhall" / "town_hall_neoclassical_ab.json").write_text(
        json.dumps(meta, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    if AFTER.resolve() != (OUT / "townhall" / "w06cnd_town_hall_5.png").resolve():
        shutil.copy(AFTER, OUT / "townhall" / "w06cnd_town_hall_5.png")
        shutil.copy(AFTER.with_suffix(".json"), OUT / "townhall" / "w06cnd_town_hall_5.json")
    print(f"town_hall_neoclassical_ab.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

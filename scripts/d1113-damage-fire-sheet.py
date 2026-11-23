#!/usr/bin/env python3
"""D-111.3 FASE 4 — hoja `damage_fire_interiors_ab.png`.

Fila 1 (1×): residencial dañado, residencial incendiado, almacén dañado, almacén incendiado —
las cuatro variantes con interior dressing. Fila 2: las mismas a 0,5×. Las llamas, el humo y los
anclajes son los aprobados; el interior sólo añade forjados, vigas, tabiques y palés en la sección.
"""

import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path("docs/art/graphics-capabilities/evidence/d1113")
TMP = Path("docs/art/graphics-capabilities/evidence/d1113/interiors")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 500, 430
CAPTION_H = 84
PAD = 20
PANELS = [
    ("mixed_damaged", "residencial DAÑADO · mixed_tenement", TMP / "w06cnd_mixed_tenement_2_damaged.png"),
    ("mixed_burning", "residencial EN LLAMAS · mixed_tenement", TMP / "w06cnd_mixed_tenement_2_burning.png"),
    ("warehouse_damaged", "almacén DAÑADO · warehouse", TMP / "w06cnd_warehouse_2_damaged.png"),
    ("warehouse_burning", "almacén EN LLAMAS · warehouse", TMP / "w06cnd_warehouse_2_burning.png"),
]


def fit(image: Image.Image, cell_w: int, cell_h: int) -> Image.Image:
    scale = min((cell_w - 2 * PAD) / image.width, (cell_h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def main() -> None:
    (OUT / "interiors").mkdir(parents=True, exist_ok=True)
    header_h = 64
    width = CELL_W * 4 + PAD * 5
    height = header_h + 2 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "D-111.3 FASE 4 · daño e incendio con interior dressing — residencial y almacén, día y noche, 1× y 0,5×",
        fill=ACCENT,
    )
    signatures = {}
    for index, (key, title, png) in enumerate(PANELS):
        meta = json.loads(png.with_suffix(".json").read_text(encoding="utf-8"))
        signatures[key] = {
            "signature": meta["compositionSignature"],
            "mood": meta["moodId"],
            "fireAnchors": len(meta.get("fireAnchors") or []),
            "png": png.name,
        }
        shutil.copy(png, OUT / "interiors" / png.name)
        shutil.copy(png.with_suffix(".json"), OUT / "interiors" / png.with_suffix(".json").name)
        image = Image.open(png).convert("RGB")
        for row, scale in enumerate((1.0, 0.5)):
            x = PAD + index * (CELL_W + PAD)
            y = header_h + row * (CELL_H + CAPTION_H + PAD)
            shown = image if scale == 1.0 else image.resize((image.width // 2, image.height // 2))
            shown = fit(shown, CELL_W, CELL_H)
            draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=PANEL_BG)
            sheet.paste(shown, (x + (CELL_W - shown.width) // 2, y + CAPTION_H + (CELL_H - shown.height) // 2))
            label = title if scale == 1.0 else f"{title} · 0,5×"
            draw.text((x, y + 4), label, fill=TEXT)
            draw.multiline_text(
                (x, y + 26),
                f"firma {meta['compositionSignature'][:12]} · {meta['moodId']} · "
                f"anclajes de fuego {len(meta.get('fireAnchors') or [])}",
                fill=MUTED,
                spacing=5,
            )
    sheet.save(OUT / "damage_fire_interiors_ab.png")
    (OUT / "damage_fire_interiors_ab.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "sheet": "damage_fire_interiors_ab.png",
                "panels": signatures,
                "note": "llamas/humo/anclajes aprobados intactos; el interior dressing añade forjados, vigas, tabiques y palés sólo en la sección abierta",
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"damage_fire_interiors_ab.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

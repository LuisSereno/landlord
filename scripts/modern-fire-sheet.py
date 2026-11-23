#!/usr/bin/env python3
"""FINAL-ASSET-QA FASE 4 — hoja `modern_building_fire_ab.png`.

Cinco filas × dos columnas (día | noche): control histórico legacy, mixed_tenement WP06 intenso y
moderado, warehouse WP06 intenso y moderado. Cada pie lleva las cifras de su JSON hermano — focos
montados sobre los disponibles, firma de la candidata — para que la hoja se juzgue sin abrir JSON.
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
CELL_W, CELL_H = 700, 430
CAPTION_H = 118
PAD = 24
ROWS = [
    ("legacy_control", "CONTROL HISTÓRICO · calle legacy `bld_commercial_c` (arquitectura antigua)"),
    ("mixed_intense", "mixed_tenement WP06 · incendio INTENSO (todos los anclajes)"),
    ("mixed_moderate", "mixed_tenement WP06 · incendio MODERADO (fxFoci=8)"),
    ("warehouse_intense", "warehouse WP06 · incendio INTENSO (todos los anclajes)"),
    ("warehouse_moderate", "warehouse WP06 · incendio MODERADO (fxFoci=6)"),
]
MOODS = ["day", "night"]


def fit(image: Image.Image) -> Image.Image:
    scale = min((CELL_W - 2 * PAD) / image.width, (CELL_H - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def caption(arm: str) -> str:
    record = json.loads((OUT_DIR / f"{arm}.json").read_text(encoding="utf-8"))
    fire = record.get("fire") or {}
    lines = []
    if record.get("legacy"):
        lines.append("calle legacy del laboratorio · fuego dinámico del rig sobre silueta")
        lines.append(
            f"focos {fire.get('foci')} · emisores {fire.get('emitters')} · "
            f"partículas {fire.get('particlesAlive')}"
        )
    else:
        lines.append(f"{record['candidateName']} · anclajes disponibles {record['fireAnchorsAvailable']}")
        lines.append(
            f"focos montados {fire.get('foci')} · llamas {fire.get('flameImages')} · "
            f"emisores {fire.get('emitters')} · partículas {fire.get('particlesAlive')}"
        )
    lines.append(f"{record['glRenderer'] or 'renderer'} · {record['pngBytes'] // 1024} KiB")
    return "\n".join(lines)


def main() -> None:
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + len(ROWS) * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "FINAL-ASSET-QA · incendios sobre arquitectura WP06 vs control histórico — día | noche",
        fill=ACCENT,
    )
    y = header_h
    for row_key, row_title in ROWS:
        for col, mood in enumerate(MOODS):
            arm = f"{row_key}_{mood}"
            png = Image.open(OUT_DIR / f"{arm}.png").convert("RGB")
            x = PAD + col * (CELL_W + PAD)
            panel_y = y + CAPTION_H
            draw.rectangle([x, panel_y, x + CELL_W, panel_y + CELL_H], fill=PANEL_BG)
            fitted = fit(png)
            sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, panel_y + (CELL_H - fitted.height) // 2))
            title = row_title if col == 0 else row_title.replace("·", "|")
            draw.text((x, y + 4), f"{mood.upper()} · {title}", fill=TEXT)
            # Pie con cifras: la primera columna lleva el detalle, la segunda lo repite compacto.
            draw.multiline_text((x, y + 24), caption(arm), fill=MUTED, spacing=6)
        y += CELL_H + CAPTION_H + PAD
    sheet.save(OUT_DIR / "modern_building_fire_ab.png")
    print(f"modern_building_fire_ab.png {sheet.width}×{sheet.height}")


if __name__ == "__main__":
    main()

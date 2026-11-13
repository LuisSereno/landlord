#!/usr/bin/env python3
"""V.g town_hall spike: contact sheet + silhouette sheet.

No autopuntúa. Los PNGs que se juntan aquí son exactamente los que produjo
`scripts/build-building-composer.mjs` sobre el pipeline canónico (Graphic Civic,
rig, iluminación, materiales reales). La única operación es montar las tres
variantes lado a lado.

La silueta se deriva del canal alpha de la misma render —no es un render
especial— porque un silhouette sheet debe contestar a la pregunta
"¿se distinguen las tres recetas sin leer etiquetas?" sobre la geometría
que el pipeline realmente dibuja.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPIKE_DIR = ROOT / "docs/art/building-catalog-vg/town-hall-spike"
MANIFEST = json.loads((SPIKE_DIR / "manifest.json").read_text())

PANELS = [
    ("vf_town_hall_1000", "neoclassical_portico", "seed 1000 · civic_block"),
    ("vf_town_hall_42", "municipal_block", "seed 42 · stepped_civic"),
    ("vf_town_hall_1002", "civic_wing", "seed 1002 · single_wing_plaza"),
]

PANEL_W = 420
PANEL_H = 500
PAD = 20
LABEL_H = 40
BAND_H = PANEL_H + LABEL_H + PAD * 2
TOTAL_W = (PANEL_W + PAD * 2) * len(PANELS) + PAD


def paste_fit(sheet, image, x, y, w, h):
    image.thumbnail((w, h), Image.LANCZOS)
    offset_x = x + (w - image.size[0]) // 2
    offset_y = y + (h - image.size[1]) // 2
    sheet.paste(image, (offset_x, offset_y), image)


def build_contact_sheet():
    sheet = Image.new("RGBA", (TOTAL_W, BAND_H), (245, 245, 245, 255))
    draw = ImageDraw.Draw(sheet)
    x = PAD
    for candidate_id, label, sublabel in PANELS:
        draw.rectangle((x - 6, PAD - 6, x + PANEL_W + 6, PAD + PANEL_H + 6),
                       fill=(220, 220, 220, 255), outline=(180, 180, 180, 255))
        render_path = SPIKE_DIR / f"{candidate_id}.png"
        render = Image.open(render_path).convert("RGBA")
        paste_fit(sheet, render, x, PAD, PANEL_W, PANEL_H)
        draw.text((x, PAD + PANEL_H + 6), f"{label}", fill=(30, 30, 30, 255))
        draw.text((x, PAD + PANEL_H + 22), sublabel, fill=(90, 90, 90, 255))
        x += PANEL_W + PAD * 2
    out = SPIKE_DIR / "contact-sheet.png"
    sheet.save(out)
    print(f"contact sheet: {out} ({sheet.size[0]}×{sheet.size[1]})")


def silhouette_from_alpha(image):
    silhouette = Image.new("RGBA", image.size, (255, 255, 255, 255))
    alpha = image.split()[3]
    mask = alpha.point(lambda v: 255 if v > 8 else 0)
    ink = Image.new("RGBA", image.size, (20, 20, 20, 255))
    silhouette.paste(ink, mask=mask)
    return silhouette


def build_silhouette_sheet():
    sheet = Image.new("RGBA", (TOTAL_W, BAND_H), (250, 250, 250, 255))
    draw = ImageDraw.Draw(sheet)
    x = PAD
    for candidate_id, label, sublabel in PANELS:
        draw.rectangle((x - 6, PAD - 6, x + PANEL_W + 6, PAD + PANEL_H + 6),
                       fill=(235, 235, 235, 255), outline=(180, 180, 180, 255))
        render = Image.open(SPIKE_DIR / f"{candidate_id}.png").convert("RGBA")
        silhouette = silhouette_from_alpha(render)
        paste_fit(sheet, silhouette, x, PAD, PANEL_W, PANEL_H)
        draw.text((x, PAD + PANEL_H + 6), label, fill=(30, 30, 30, 255))
        draw.text((x, PAD + PANEL_H + 22), sublabel, fill=(90, 90, 90, 255))
        x += PANEL_W + PAD * 2
    out = SPIKE_DIR / "silhouette-sheet.png"
    sheet.save(out)
    print(f"silhouette sheet: {out} ({sheet.size[0]}×{sheet.size[1]})")


if __name__ == "__main__":
    build_contact_sheet()
    build_silhouette_sheet()

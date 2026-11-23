#!/usr/bin/env python3
"""D-111.3 FASE 1 — hoja `facade_diagnosis.png`.

Cuatro paneles del laboratorio de fachada sobre `mixed_tenement` seed 2 (`gn_residential_v2`,
day_civic): A control, B materiales neutros, C sin sombra de la key, E cristales opacos. Cada pie
lleva la medición de la franja de su render. Generado por scripts/d1113-facade-diagnosis.py a partir
de /tmp/d1113/lab; los PNG fuente se copian a evidence/d1113/ como procedencia.
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SRC = Path("/tmp/d1113/lab")
OUT = Path("docs/art/graphics-capabilities/evidence/d1113")
BG = (11, 20, 34)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 700, 470
CAPTION_H = 118
PAD = 24
PANELS = [
    ("A_control", "A · CONTROL — franja negra-verdosa sobre cada paño (10 968 px oscuros)"),
    ("C_noshadow", "C · SIN SOMBRA DE LA KEY, materiales reales — franja desaparece (5 505 px)"),
    ("G_key_overhead", "G · KEY CENITAL — la franja casi desaparece: la proyectan elementos salientes"),
    ("E_glass_opaque", "E · CRISTALES REALES OPACOS — el vidrio oscurece y tiñe la sombra (4 319 px)"),
]
# Región muestreada: cabeceras de los paños encastrados de la fachada izquierda (720² del lab).
BAND = (60, 240, 60, 400)


def band_stats(png: Path) -> dict:
    im = np.array(Image.open(png).convert("RGB"), dtype=np.float32)
    y0, y1, x0, x1 = BAND
    region = im[y0:y1, x0:x1]
    dark = region[(region.sum(axis=-1) < 230)]
    return {
        "pxOscuros": int(len(dark)),
        "rgbMedio": [round(float(v), 1) for v in dark.mean(axis=0)] if len(dark) else None,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "facade_lab").mkdir(exist_ok=True)
    stats = {}
    for arm, _title in PANELS:
        shutil.copy(SRC / f"mixed_tenement_{arm}.png", OUT / "facade_lab" / f"{arm}.png")
        stats[arm] = band_stats(SRC / f"mixed_tenement_{arm}.png")
    header_h = 64
    width = CELL_W * 2 + PAD * 3
    height = header_h + 2 * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text(
        (PAD, 20),
        "D-111.3 FASE 1 · diagnóstico de la franja negra de fachada — mixed_tenement seed 2 "
        "(gn_residential_v2, day_civic)",
        fill=ACCENT,
    )
    for index, (arm, title) in enumerate(PANELS):
        col = index % 2
        row = index // 2
        x = PAD + col * (CELL_W + PAD)
        y = header_h + row * (CELL_H + CAPTION_H + PAD)
        png = Image.open(OUT / "facade_lab" / f"{arm}.png").convert("RGB")
        fitted = png.resize((CELL_W - 2 * PAD, CELL_H - 2 * PAD))
        draw.rectangle([x, y + CAPTION_H, x + CELL_W, y + CAPTION_H + CELL_H], fill=(17, 27, 43))
        sheet.paste(fitted, (x + PAD, y + CAPTION_H + (CELL_H - fitted.height) // 2))
        draw.text((x, y + 4), title, fill=TEXT)
        s = stats[arm]
        draw.multiline_text(
            (x, y + 26),
            f"px oscuros en las cabeceras de paño: {s['pxOscuros']} · "
            f"RGB medio {s['rgbMedio']} (umbral suma RGB < 230)",
            fill=MUTED,
            spacing=6,
        )
    sheet.save(OUT / "facade_diagnosis.png")
    (OUT / "facade_diagnosis.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "sheet": "facade_diagnosis.png",
                "building": "mixed_tenement",
                "seed": 2,
                "candidateProfile": "gn_residential_v2",
                "mood": "day_civic",
                "region": {"rect": list(BAND), "note": "cabecera del paño encastrado, fachada izquierda"},
                "arms": stats,
                "labSource": "facade_lab/*.png (render Blender 720², misma cámara y encuadre del compositor)",
                "publishedControl": "evidence/v2/candidates/wp06_mixed_tenement-candidata.png (reproducido a ±3/255)",
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"facade_diagnosis.png {sheet.width}×{sheet.height}")
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()

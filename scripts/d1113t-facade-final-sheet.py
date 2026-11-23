#!/usr/bin/env python3
"""D-111.3-T FASE 1 — láminas definitivas de las franjas negro-verdosas.

Lee SOLO recursos versionados (〔FASE 3〕: sin /tmp) y produce:

  facade_black_green_artifacts_final_ab.png   ANTES/DESPUÉS a 1×, 0,5× y recorte ampliado,
                                              para mixed_tenement (seed 2), row_house (seed 17)
                                              y mixed a orientación 90° (comprobación de regresión)
  gn_window_rebuild_ab.png                    primer plano del vano de ventana GN antes/después
                                              de publicar el GLB corregido

Uso: python3 scripts/d1113t-facade-final-sheet.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
EV = REPO / "docs/art/graphics-capabilities/evidence"
OUT = EV / "d1113/technical"
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
GOOD = (120, 220, 150)
BAD = (230, 120, 110)
CELL_W, CELL_H = 660, 470
CAPTION_H = 74
PAD = 22

BEFORE_MIXED = EV / "d1113/technical/controls_d1112/wp06_mixed_tenement-candidata.png"
BEFORE_ROW = EV / "d1113/technical/controls_d1112/wp06_row_house-candidata.png"
AFTER_MIXED = EV / "v2/candidates/wp06_mixed_tenement-candidata.png"
AFTER_ROW = EV / "v2/candidates/wp06_row_house-candidata.png"
BEFORE_O90 = EV / "d1113/technical/facade_states/mixed_o90_before.png"
AFTER_O90 = EV / "d1113/technical/facade_states/mixed_o90_after.png"


def teal_count(png: Path, rect) -> int:
    im = np.array(Image.open(png).convert("RGB"), dtype=np.int16)
    x0, x1, y0, y1 = rect
    r = im[y0:y1, x0:x1]
    s = r.sum(-1)
    t = (s < 250) & ((r[:, :, 2] > r[:, :, 0] + 8) | (r[:, :, 1] > r[:, :, 0] + 8))
    return int(t.sum())


def lum_step(png: Path, rect) -> float:
    im = np.array(Image.open(png).convert("RGB"), dtype=np.float32)
    x0, x1, y0, y1 = rect
    rows = im[y0:y1, x0:x1].mean(-1).mean(1)
    k = max(1, int(0.18 * len(rows)))
    return round(float(np.sort(rows)[-k:].mean() - np.sort(rows)[:k].mean()), 1)


def fit(image: Image.Image, w: int, h: int) -> Image.Image:
    scale = min((w - 2 * PAD) / image.width, (h - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def panel(sheet, draw, x, y, png, title, sub=None, half=False, rect=None, zoom=None):
    image = Image.open(png).convert("RGB")
    if zoom:
        image = image.crop(zoom)
    if half:
        image = image.resize((image.width // 2, image.height // 2))
    draw.rectangle([x, y, x + CELL_W, y + CELL_H + CAPTION_H], fill=PANEL_BG)
    fitted = fit(image, CELL_W, CELL_H)
    sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + (CELL_H - fitted.height) // 2))
    draw.text((x + 8, y + CELL_H + 6), title, fill=TEXT)
    if sub:
        color = GOOD if "→ 0" in sub or "desaparece" in sub else MUTED
        draw.text((x + 8, y + CELL_H + 28), sub, fill=color)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = [
        (
            "mixed_tenement · seed 2 · day_civic · 1x",
            BEFORE_MIXED,
            AFTER_MIXED,
            dict(rect=(30, 120, 230, 560)),
            None,
            False,
        ),
        (
            "mixed_tenement · 0,5x (escala de juego)",
            BEFORE_MIXED,
            AFTER_MIXED,
            None,
            None,
            True,
        ),
        (
            "mixed_tenement · recorte paño izquierdo (cabecera de panel)",
            BEFORE_MIXED,
            AFTER_MIXED,
            dict(rect=(30, 120, 230, 560)),
            (30, 230, 130, 560),
            False,
        ),
        (
            "row_house · seed 17 · day_civic · 1x",
            BEFORE_ROW,
            AFTER_ROW,
            dict(rect=(820, 996, 640, 900), lum=False),
            None,
            False,
        ),
        (
            "row_house · 0,5x (escala de juego)",
            BEFORE_ROW,
            AFTER_ROW,
            None,
            None,
            True,
        ),
        (
            "row_house · recorte muro lateral de ladrillo",
            BEFORE_ROW,
            AFTER_ROW,
            dict(rect=(820, 996, 640, 900), lum=False),
            (800, 600, 996, 920),
            False,
        ),
        (
            "mixed_tenement · orientacion 90° · 1x (regresion)",
            BEFORE_O90,
            AFTER_O90,
            dict(rect=(60, 360, 480, 720)),
            None,
            False,
        ),
    ]
    header_h = 70
    width = CELL_W * 2 + PAD * 3
    height = header_h + len(rows) * (CELL_H + CAPTION_H + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 16), "D-111.3-T FASE 1 · franjas negro-verdosas en fachadas de ladrillo — ANTES (GLB/vertex-color publicados, 743aea4) vs DESPUES (GLB corregido + COLOR_0 horneado neutralizado)", fill=TEXT)
    metrics = {}
    y = header_h
    for title, before, after, metric, zoom, half in rows:
        sub_b = sub_a = None
        if metric:
            tb, ta = teal_count(before, metric["rect"]), teal_count(after, metric["rect"])
            if metric.get("lum", True):
                gb, ga = lum_step(before, metric["rect"]), lum_step(after, metric["rect"])
                sub_b = f"pixeles verde-negros: {tb} · salto lum. vertical: {gb}"
                sub_a = f"pixeles verde-negros: {ta} · salto lum. vertical: {ga}"
                metrics[title] = {"tealAntes": tb, "tealDespues": ta, "lumStepAntes": gb, "lumStepDespues": ga}
            else:
                sub_b = f"pixeles verde-negros en zona: {tb}"
                sub_a = f"pixeles verde-negros en zona: {ta} → 0" if ta <= 8 else f"pixeles verde-negros en zona: {ta}"
                metrics[title] = {"tealAntes": tb, "tealDespues": ta}
        panel(sheet, draw, PAD, y, before, f"ANTES · {title}", sub_b, half=half, zoom=zoom)
        panel(sheet, draw, PAD * 2 + CELL_W, y, after, f"DESPUES · {title}", sub_a, half=half, zoom=zoom)
        y += CELL_H + CAPTION_H + PAD
    sheet.save(OUT / "facade_black_green_artifacts_final_ab.png")

    # --- GLB ventana GN: primer plano del vano antes/después ---
    zoom = (110, 290, 340, 560)
    sheet2 = Image.new("RGB", (CELL_W * 2 + PAD * 3, CELL_H + CAPTION_H + 60 + PAD), BG)
    d2 = ImageDraw.Draw(sheet2)
    d2.text((PAD, 12), "D-111.3-T FASE 1 · gn_window_bay_2m.glb regenerado con la carpinteria corregida (alfizar/dintel menos salientes)", fill=TEXT)
    panel(sheet2, d2, PAD, 44, BEFORE_MIXED, "ANTES · vano publicado (blob 9c7df2c3)", "y-max 0.250 m", zoom=zoom)
    panel(sheet2, d2, PAD * 2 + CELL_W, 44, AFTER_MIXED, "DESPUES · vano regenerado (nuevo blob)", "y-max 0.183 m", zoom=zoom)
    sheet2.save(OUT / "gn_window_rebuild_ab.png")

    (OUT / "facade_black_green_metrics.json").write_text(
        json.dumps(metrics, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print("sheets written")


if __name__ == "__main__":
    main()

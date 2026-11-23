#!/usr/bin/env python3
"""D-111.3-T FASE 4 — hojas de entregables a partir de `phaser_captures/`.

Compone, sólo desde capturas versionadas del propio brazo QA:
  d1113_technical_city_1x.png · d1113_technical_city_05x.png · d1113_technical_night.png ·
  d1113_technical_damage_fire.png

Uso: python3 scripts/d1113t-phaser-sheets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[1]
TECH = REPO / "docs/art/graphics-capabilities/evidence/d1113/technical"
CAPS = TECH / "phaser_captures"
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
CELL_W, CELL_H = 720, 470
CAPTION_H = 56
PAD = 18


def sheet(name, arms, header):
    width = CELL_W * 2 + PAD * 3
    height = 56 + ((CELL_H + CAPTION_H + PAD) * ((len(arms) + 1) // 2)) + PAD
    out = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(out)
    draw.text((PAD, 16), header, fill=TEXT)
    for index, (arm, caption) in enumerate(arms):
        row, column = divmod(index, 2)
        x = PAD + column * (CELL_W + PAD)
        y = 56 + row * (CELL_H + CAPTION_H + PAD)
        image = Image.open(CAPS / f"{arm}.png").convert("RGB")
        scale = min((CELL_W - 16) / image.width, (CELL_H - 16) / image.height)
        image = image.resize((int(image.width * scale), int(image.height * scale)))
        draw.rectangle([x, y, x + CELL_W, y + CELL_H + CAPTION_H], fill=PANEL_BG)
        out.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
        draw.text((x + 8, y + CELL_H + 6), caption, fill=TEXT)
        draw.text((x + 8, y + CELL_H + 26), "Art Lab QA · no partida jugable", fill=MUTED)
    out.save(TECH / name)
    print("written", name)


def main() -> None:
    city = [
        ("mixed_tenement", "mixed_tenement · w06cnd_mixed_tenement_2"),
        ("row_house", "row_house · w06cnd_row_house_17"),
        ("warehouse", "warehouse · w06cnd_warehouse_2"),
        ("town_hall", "town_hall neoclásico · w06cnd_town_hall_5"),
    ]
    sheet(
        "d1113_technical_city_1x.png",
        [(f"city_{key}_z1", f"{label} · zoom 1x · dia") for key, label in city],
        "D-111.3-T FASE 4 · candidatos corregidos en Phaser a zoom 1x (sprite versionado, hash verificado)",
    )
    sheet(
        "d1113_technical_city_05x.png",
        [(f"city_{key}_z05", f"{label} · zoom 0,5x (escala de juego)") for key, label in city],
        "D-111.3-T FASE 4 · los mismos cuatro candidatos a zoom 0,5x",
    )
    sheet(
        "d1113_technical_night.png",
        [
            ("night_balanced_town_hall", "town_hall · fxPreset=night_balanced · sonda: preset activo, 4 luces"),
            ("night_balanced_mixed", "mixed_tenement · fxPreset=night_balanced · sonda: preset activo, 4 luces"),
        ],
        "D-111.3-T FASE 4 · noche REAL: el preset night_balanced se verifica en la sonda de Phaser (no basta fxMood=night)",
    )
    sheet(
        "d1113_technical_damage_fire.png",
        [
            ("damage_mixed_tenement-damaged", "mixed · damaged (varianta FASE 2, sin refs invalidas)"),
            ("damage_mixed_tenement-burning", "mixed · burning (focos 19=19 vs control, variacion justificada)"),
            ("damage_warehouse-damaged", "warehouse · damaged (pilares del portico)"),
            ("damage_warehouse-burning", "warehouse · burning (pilares + fuego)"),
        ],
        "D-111.3-T FASE 4 · dano e incendio con las variantes regeneradas en FASE 2 (candidateId y SHA-256 contrastados)",
    )


if __name__ == "__main__":
    main()

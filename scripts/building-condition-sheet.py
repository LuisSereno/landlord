#!/usr/bin/env python3
"""D-111.2 cierre FASE 4 — hoja `building_condition_in_phaser.png`.

Los cuatro casos del contrato de weathering fotografiados sobre el camino de render real
(proyección sintética → injectProjection → buildingAssetStateFor → sprite). Cada pieza lleva la
entrada (state, condition, structuralIntegrity), el tier que exige el contrato y la textura que el
renderizador realmente seleccionó — leída de `listScenery`, no de lo que el caso pide.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

DIR = Path("docs/art/graphics-capabilities/evidence/v2/closure/condition")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 690, 430
CAPTION_H = 116
PAD = 24

ORDER = ["conserved", "aged", "ruin", "burning"]
TITLES = {
    "conserved": "1 · Conservado",
    "aged": "2 · Operativo, condition 40, estructura intacta",
    "ruin": "3 · Ruina",
    "burning": "4 · En llamas",
}


def main() -> None:
    summary = json.loads((DIR / "building_condition_summary.json").read_text(encoding="utf-8"))
    by_case = {capture["case"]: capture for capture in summary["captures"]}
    sheet_w = 2 * (CELL_W + PAD) + PAD
    sheet_h = 92 + 2 * (CELL_H + CAPTION_H + PAD) + 56
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 24), "D-111.2 cierre FASE 4 · conservación, envejecimiento, ruina y fuego en Phaser", fill=TEXT)
    draw.text(
        (PAD, 50),
        "proyección sintética → injectProjection → buildingAssetStateFor(state, condition, "
        "structuralIntegrity) → sprite · la variante REAL la lee listScenery, no el caso",
        fill=MUTED,
    )
    for index, case in enumerate(ORDER):
        capture = by_case[case]
        col, row = index % 2, index // 2
        x = PAD + col * (CELL_W + PAD)
        y = 92 + row * (CELL_H + CAPTION_H + PAD)
        draw.rectangle([x, y, x + CELL_W, y + CELL_H], fill=PANEL_BG)
        image = Image.open(DIR / capture["file"]).convert("RGB")
        scale = min((CELL_W - 2 * PAD) / image.width, (CELL_H - 2 * PAD) / image.height)
        fitted = image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))
        sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + (CELL_H - fitted.height) // 2))
        draw.text((x + 6, y + CELL_H + 8), TITLES[case], fill=ACCENT)
        lines = [
            f"entrada: state={capture['input']['state']} · condition={capture['input']['condition']} · "
            f"structuralIntegrity={capture['input']['structuralIntegrity']} · tipo {capture['buildingType']}",
            f"tier esperado {capture['expectedTier']} · textura real: {capture['observedTexture']}",
        ]
        if case == "aged":
            lines.append(
                "tier `aged` ⇒ sprite `complete`: el catálogo runtime no tiene sprite envejecido "
                "(D-080); ausencia registrada, no simulada"
            )
        for line_index, line in enumerate(lines):
            draw.text((x + 6, y + CELL_H + 30 + line_index * 20), line, fill=MUTED if line_index else TEXT)
    draw.text(
        (PAD, sheet_h - 34),
        "procedencia: building_condition_summary.json · scripts/building-condition-capture.mjs · "
        "consume la misma cadena que la partida (injectProjection)",
        fill=MUTED,
    )
    out = DIR / "building_condition_in_phaser.png"
    sheet.save(out)
    print(f"{out} {sheet_w}x{sheet_h}")


if __name__ == "__main__":
    main()

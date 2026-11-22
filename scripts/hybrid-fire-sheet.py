#!/usr/bin/env python3
"""D-111.2 cierre FASE 2 — hoja `hybrid_fire_ab.png`.

Seis paneles: el sprite QA de Blender solo, el lab de Phaser con la candidata sin fuego dinámico, el
híbrido de día y de noche a 1×, y los híbridos a 0,5× (la escala real del juego al medio zoom). Cada
pie lleva las cifras medidas de su JSON hermano — focos, humo, recorte a blanco — para que la hoja
se juzgue sin abrir los JSON. No re-renderiza ni re-captura nada.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

FIRE_DIR = Path("docs/art/graphics-capabilities/evidence/v2/closure/fire")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
CELL_W, CELL_H = 700, 420
CAPTION_H = 118
PAD = 24


def fit(image: Image.Image) -> Image.Image:
    scale = min((CELL_W - 2 * PAD) / image.width, (CELL_H - 2 * PAD) / image.height)
    return image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))


def caption(arm: str) -> str:
    record = json.loads((FIRE_DIR / f"{arm}.json").read_text(encoding="utf-8"))
    stats = record.get("fireStats") or {}
    foci = record.get("fireFoci") or []
    lines = [f"{record['candidateId']} · {record['candidateProfile']} · firma {record['compositionSignature'][:12]}"]
    if stats:
        lines.append(
            f"focos {stats.get('foci')} · llamas {stats.get('flameImages')} · emisores "
            f"{stats.get('emitters')} · partículas vivas {stats.get('particlesAlive')}"
        )
    else:
        lines.append("fuego dinámico APAGADO — el cuerpo de llama es sólo el bake de Blender")
    if foci:
        kinds = {}
        for focus in foci:
            kinds[focus["kind"]] = kinds.get(focus["kind"], 0) + 1
        lines.append("anclajes: " + ", ".join(f"{kind}×{count}" for kind, count in sorted(kinds.items())))
    lines.append(f"{record['renderer']} · zoom {record['zoom']} · {record['pngBytes'] // 1024} KiB")
    return "\n".join(lines)


def blender_caption() -> str:
    meta = json.loads((FIRE_DIR / "hybrid_sprite_day.json").read_text(encoding="utf-8"))
    flames = meta["damageTreatment"]["flames"]
    return "\n".join(
        [
            "Blender solo · variante QA del sprite (focos estáticos reducidos)",
            f"pico de llama horneado {flames['flamePeakEmission']} (escala {flames['flameEmissionScale']}) · "
            f"anclajes publicados {len(meta['fireAnchors'])}",
            f"huella {meta['footprintCells']['width']}×{meta['footprintCells']['height']} celdas · "
            f"{meta['image']['width']}×{meta['image']['height']} px · ppm {meta['framing']['pixelsPerMeter']}",
            "hollín, daños y columna de humo intactos — lo que Phaser anima son los mismos focos",
        ]
    )


def main() -> None:
    panels = [
        ("Blender solo (sprite QA)", "hybrid_sprite_day.png", blender_caption()),
        ("Phaser · candidata sin fuego dinámico", "phaser_candidate_day.png", caption("phaser_candidate_day")),
        ("Híbrido · día 1×", "hybrid_fire_day.png", caption("hybrid_fire_day")),
        ("Híbrido · noche 1×", "hybrid_fire_night.png", caption("hybrid_fire_night")),
        ("Híbrido · día 0,5×", "hybrid_fire_day_half.png", caption("hybrid_fire_day_half")),
        ("Híbrido · noche 0,5×", "hybrid_fire_night_half.png", caption("hybrid_fire_night_half")),
    ]
    columns = 2
    rows = (len(panels) + columns - 1) // columns
    sheet_w = columns * (CELL_W + PAD) + PAD
    header_h = 92
    sheet_h = header_h + rows * (CELL_H + CAPTION_H + PAD) + PAD + 56
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)

    title = "D-111.2 cierre FASE 2 · incendio híbrido Blender + Phaser sobre la candidata gn_residential_v2"
    draw.text((PAD, 26), title, fill=TEXT)
    draw.text(
        (PAD, 54),
        "el mismo sprite en los tres brazos · candidata hybq_mixed_tenement_2_burning · seed 2 · "
        "qaFlamePeakEmission 0,45 · ninguna promoción al catálogo",
        fill=MUTED,
    )

    for index, (title_text, file, caption_text) in enumerate(panels):
        col, row = index % columns, index // columns
        x = PAD + col * (CELL_W + PAD)
        y = header_h + row * (CELL_H + CAPTION_H + PAD)
        draw.rectangle([x, y, x + CELL_W, y + CELL_H], fill=PANEL_BG)
        image = Image.open(FIRE_DIR / file).convert("RGB")
        fitted = fit(image)
        sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + (CELL_H - fitted.height) // 2))
        draw.text((x + 6, y + CELL_H + 8), title_text, fill=ACCENT)
        for line_index, line in enumerate(caption_text.split("\n")):
            draw.text((x + 6, y + CELL_H + 30 + line_index * 20), line, fill=TEXT if line_index else MUTED)

    footer = (
        "procedencia: hybrid_sprite_*.png/json = render Blender con metadata §24 · phaser_candidate_* e "
        "hybrid_fire_* = scripts/hybrid-fire-capture.mjs sobre /art-lab?fxCandidate · "
        "anclajes verificados por scripts/hybrid-fire-anchor-check.py"
    )
    draw.text((PAD, sheet_h - 40), footer, fill=MUTED)
    out = FIRE_DIR / "hybrid_fire_ab.png"
    sheet.save(out)
    print(f"{out} {sheet.size[0]}x{sheet.size[1]}")


if __name__ == "__main__":
    main()

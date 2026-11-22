#!/usr/bin/env python3
"""D-111.2 cierre FASE 5 — hoja `night_lighting_final_ab.png`.

Cinco paneles (día, noche, noche+fuego, noche+fuego 0,5×, CANVAS sin filtros) con su pie medido:
luma del CONTENIDO del fotograma —excluido el fondo plano de la escena— (media, P5, P95, σ) y
recorte a blanco. La comparación día/noche es la prueba de que las fachadas no se lavan ni se
apagan: el σ del contenido nocturno frente al diurno dice si queda gradación que leer.
El pie del CANVAS lleva su propio renderer declarado por la sonda.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

DIR = Path("docs/art/graphics-capabilities/evidence/v2/closure/night")
BG = (11, 20, 34)
PANEL_BG = (17, 27, 43)
TEXT = (232, 236, 244)
MUTED = (148, 163, 184)
ACCENT = (255, 170, 90)
BACKGROUNDS = [(20, 26, 38), (43, 53, 66)]  # #141a26 noche · #2b3542 día
CELL_W, CELL_H = 580, 340
CAPTION_H = 104
PAD = 24

ARMS = [
    ("day_balanced", "Día · preset day_balanced"),
    ("night_balanced", "Noche · preset night_balanced"),
    ("night_fire", "Noche con incendio · night_fire"),
    ("night_fire_050x", "Noche con incendio · 0,5×"),
    ("night_fire_canvas", "CANVAS forzado · night_fire sin filtros"),
]


def luma_stats(path: Path) -> dict:
    import numpy as np

    image = np.asarray(Image.open(path).convert("RGB"), dtype=np.uint64)
    flat = image.reshape(-1, 3)
    luma = (flat[:, 0] * 2126 + flat[:, 1] * 7152 + flat[:, 2] * 722) // 10000
    # El grading desplaza el color plano de fondo: exclusión por distancia en vez de igualdad.
    night_bg = np.array([20, 26, 38], dtype=np.int64)
    day_bg = np.array([43, 53, 66], dtype=np.int64)
    diff_night = np.abs(flat.astype(np.int64) - night_bg).sum(axis=1)
    diff_day = np.abs(flat.astype(np.int64) - day_bg).sum(axis=1)
    bg_mask = (diff_night <= 10) | (diff_day <= 10)
    content = luma[~bg_mask].astype(np.float64)
    white = int(((flat[:, 0] == 255) & (flat[:, 1] == 255) & (flat[:, 2] == 255)).sum())
    return {
        "contentShare": round(100 * content.size / luma.size, 1),
        "mean": round(float(content.mean()), 1),
        "p5": round(float(np.percentile(content, 5)), 1),
        "p95": round(float(np.percentile(content, 95)), 1),
        "spread": round(float(np.percentile(content, 95) - np.percentile(content, 5)), 1),
        "std": round(float(content.std()), 1),
        "whiteClip": white,
        "pixels": int(luma.size),
    }


def caption(arm: str, stats: dict, record: dict) -> str:
    probe = record["probe"]
    fire = probe.get("fire") or {}
    lines = [
        f"preset {probe.get('preset')} · mood {probe.get('mood')} · renderer "
        f"{'WebGL' if probe.get('webgl') else 'CANVAS'} · zoom {probe.get('zoom')}",
        f"contenido {stats['contentShare']} % del fotograma · luma media {stats['mean']} · "
        f"P5–P95 {stats['p5']}–{stats['p95']} (σ {stats['std']})",
        f"recorte a blanco {stats['whiteClip']} px de {stats['pixels']} · "
        f"focos {fire.get('foci', 0)} · emisivos {probe.get('emissive')} · luces {probe.get('lights')}",
    ]
    return "\n".join(lines)


def main() -> None:
    stats = {arm: luma_stats(DIR / f"{arm}.png") for arm, _ in ARMS}
    day, night = stats["day_balanced"], stats["night_balanced"]
    sheet_w = 2 * (CELL_W + PAD) + PAD
    sheet_h = 108 + 3 * (CELL_H + CAPTION_H + PAD) + 56
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 24), "D-111.2 cierre FASE 5 · exposición nocturna definitiva", fill=TEXT)
    draw.text(
        (PAD, 50),
        "presets intactos (day_balanced / night_balanced / night_fire, FASE 5 del runbook) · "
        "verificación fresca de los seis puntos · sin ajustes nuevos salvo medición",
        fill=MUTED,
    )
    draw.text(
        (PAD, 74),
        f"legibilidad del contenido — día: σ {day['std']} · noche: σ {night['std']} "
        f"({round(100 * night['std'] / day['std'])} % del día) · noche+fuego: σ {stats['night_fire']['std']}",
        fill=TEXT,
    )
    summary = json.loads((DIR / "night_lighting_final_summary.json").read_text(encoding="utf-8"))
    for index, (arm, title) in enumerate(ARMS):
        col, row = index % 2, index // 2
        x = PAD + col * (CELL_W + PAD)
        y = 108 + row * (CELL_H + CAPTION_H + PAD)
        draw.rectangle([x, y, x + CELL_W, y + CELL_H], fill=PANEL_BG)
        image = Image.open(DIR / f"{arm}.png").convert("RGB")
        scale = min((CELL_W - 2 * PAD) / image.width, (CELL_H - 2 * PAD) / image.height)
        fitted = image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))))
        sheet.paste(fitted, (x + (CELL_W - fitted.width) // 2, y + (CELL_H - fitted.height) // 2))
        draw.text((x + 6, y + CELL_H + 8), title, fill=ACCENT)
        for line_index, line in enumerate(caption(arm, stats[arm], summary["captures"][index]).split(chr(10))):
            draw.text((x + 6, y + CELL_H + 30 + line_index * 20), line, fill=MUTED if line_index else TEXT)
    cycles = summary["dismountCycles"]
    draw.text(
        (PAD, sheet_h - 34),
        f"desmontaje: {cycles} ciclos on/off (5 fuego + 3 luz) medidos en mount_dismount.json · "
        "procedencia: scripts/night-lighting-final-capture.mjs sobre /art-lab?fxPreset",
        fill=MUTED,
    )
    out = DIR / "night_lighting_final_ab.png"
    sheet.save(out)
    print(f"{out} {sheet_w}x{sheet_h}")
    print(f"día σ {day['std']} · noche σ {night['std']} · noche+fuego σ {stats['night_fire']['std']}")


if __name__ == "__main__":
    main()

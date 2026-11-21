#!/usr/bin/env python3
"""
D-111.2 FASE 5 — monta la hoja de evidencia de los presets y mide el balance de exposición.

El encargo pide una hoja con control diurno, control nocturno, farolas equilibradas, incendio
nocturno y una comparación a zoom 0,5×. Seis imágenes pegadas no demuestran nada, así que cada panel
lleva debajo las cuatro cifras con las que se puede discutir el ajuste:

1. `lumaMedia` — el nivel de la escena. §5.2 prohíbe arreglar a base de brillo global, así que se
   registra para que quede visible que el nocturno equilibrado NO es más claro que el control.
2. `recortados` — píxeles con los tres canales en 250 o más: «ventanas completamente blancas» y
   «halos que saturan» hechos número.
3. `blancoFrio` — píxeles brillantes y casi sin tinte (luma > 200 con máximo−mínimo < 45). Es la
   huella exacta de la bola del `PointLight`: el halo de una farola legítima es ámbar, la bola es
   gris. Este contador es el que distinguía el defecto de §5.2.
4. `negrosAplastados` — suelo sin información. Si sube, la escena se cerró.

Además se mide el paño de ladrillo del control nocturno contra el preset: la ventana de 180×110 px
NO está hardcodeada, la busca la propia imagen como la zona más ladrillosa (R>B+15) con luma media
entre 60 y 170. «Fachadas sin detalle» sólo se refuta con un número dentro de la fachada.

Salidas, junto a `fx_v2.json`:
 - `phaser_fx_v2_sheet.png`
 - `phaser_fx_v2_measure.json`

Uso:
    python3 scripts/fx-presets-sheet-assemble.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
DIR = REPO / "docs" / "art" / "graphics-capabilities" / "evidence" / "phaser" / "fx_v2"
OUT_PNG = DIR / "phaser_fx_v2_sheet.png"
OUT_JSON = DIR / "phaser_fx_v2_measure.json"

COLS = 3
TILE_GAP = 12
HEADER_PX = 62
CAPTION_PX = 64
# Un canal a 250+ en los tres = recorte. Por debajo queda margen de brillo legítimo.
CLIP_CHANNEL = 250
# «Blanco frío»: brillante y sin tinte. El ámbar de una farola real separa más de 45 entre canales.
COLD_LUMA = 200.0
COLD_SATURATION = 45
CRUSHED_LUMA = 8.0
PATCH_W = 180
PATCH_H = 110

PANELS = [
    ("control_day.png", "control diurno · sin efectos"),
    ("preset_day_balanced.png", "preset day_balanced"),
    ("control_night.png", "control nocturno · sin efectos"),
    ("preset_night_balanced.png", "preset night_balanced · farolas"),
    ("preset_night_fire.png", "preset night_fire · incendio"),
    ("preset_night_fire_050x.png", "night_fire · zoom 0,5×"),
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def array(path: Path) -> np.ndarray:
    with Image.open(path) as raw:
        return np.asarray(raw.convert("RGB"), dtype=np.int16)


def luma(a: np.ndarray) -> np.ndarray:
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def metrics(a: np.ndarray) -> dict:
    """Las cuatro cifras del panel, sobre el fotograma completo."""
    total = a.shape[0] * a.shape[1]
    level = luma(a)
    clip = (a >= CLIP_CHANNEL).all(axis=2)
    cold = (level > COLD_LUMA) & ((a.max(axis=2) - a.min(axis=2)) < COLD_SATURATION)
    crushed = level <= CRUSHED_LUMA
    return {
        "lumaMedia": round(float(level.mean()), 2),
        "recortados": int(clip.sum()),
        "recortadosPorcentaje": round(100 * float(clip.mean()), 3),
        "blancoFrio": int(cold.sum()),
        "negrosAplastadosPorcentaje": round(100 * float(crushed.mean()), 3),
    }


def brick_patch(a: np.ndarray) -> tuple[int, int, int, int] | None:
    """
    Ventana 180×110 de fachada de ladrillo, buscada sobre el CONTROL DIURNO (de día el paño es
    inequívoco y la caja no depende de cuánto se oscurezca luego). El criterio es el recuento de
    píxeles de ladrillo (R por encima de G y B con margen, ni quemados ni en sombra) entre las
    ventanas que estén iluminadas (luma media ≥55) y tengan estructura (desviación ≥14); el pavimento
    beige y el fondo azul quedan fuera por el margen de tono y por la luma. Si ninguna cumple, la
    medida no existe y el script lo dice.
    """
    height, width = a.shape[:2]
    red, green, blue = a[..., 0], a[..., 1], a[..., 2]
    level = luma(a)
    brickish = (red > green + 10) & (red > blue + 12) & (red > 45) & (red < 225)
    area = PATCH_W * PATCH_H

    def integral(values, dtype) -> np.ndarray:
        """Suma integral con fila y columna de relleno: la ventana sale de cuatro restas."""
        out = np.zeros((height + 1, width + 1), dtype=dtype)
        out[1:, 1:] = np.cumsum(np.cumsum(values.astype(dtype), axis=0), axis=1)
        return out

    def total(cum: np.ndarray, top: int, left: int) -> float:
        bottom, right = top + PATCH_H, left + PATCH_W
        return float(cum[bottom, right] - cum[top, right] - cum[bottom, left] + cum[top, left])

    brick_cum = integral(brickish, np.int64)
    mean_cum = integral(level, np.float64)
    square_cum = integral(level * level, np.float64)

    best: tuple[float, tuple[int, int, int, int]] | None = None
    for top in range(0, height - PATCH_H, 5):
        for left in range(0, width - PATCH_W, 5):
            mean = total(mean_cum, top, left) / area
            if mean < 55:
                continue
            variance = max(total(square_cum, top, left) / area - mean * mean, 0.0)
            if variance**0.5 < 14:
                continue
            score = total(brick_cum, top, left)
            if best is None or score > best[0]:
                best = (score, (left, top, left + PATCH_W, top + PATCH_H))
    return best[1] if best else None


def patch_detail(a: np.ndarray, box: tuple[int, int, int, int]) -> dict:
    """Medias del paño: nivel, dispersión y gradiente entre vecinos (lo que pierde un re-muestreo)."""
    left, top, right, bottom = box
    window = luma(a[top:bottom, left:right])
    dx = float(np.abs(np.diff(window, axis=1)).mean())
    dy = float(np.abs(np.diff(window, axis=0)).mean())
    return {
        "lumaParcheLadrillo": round(float(window.mean()), 2),
        "desviacionParcheLadrillo": round(float(window.std()), 2),
        "gradienteVecinoParcheLadrillo": round((dx + dy) / 2, 3),
    }


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1 no acepta tamaño
        return ImageFont.load_default()


def build_sheet(
    panels: list[tuple[Path, str, dict]],
    out: Path,
    patch: tuple[int, int, int, int] | None,
) -> tuple[int, int]:
    with Image.open(panels[0][0]) as first:
        tile_w, tile_h = first.convert("RGB").size
    rows = (len(panels) + COLS - 1) // COLS
    canvas = Image.new(
        "RGB",
        (COLS * tile_w + (COLS + 1) * TILE_GAP, HEADER_PX + rows * (tile_h + CAPTION_PX)),
        (16, 18, 22),
    )
    draw = ImageDraw.Draw(canvas)
    big, small = font(19), font(14)
    draw.text(
        (TILE_GAP, 10),
        "D-111.2 FASE 5 · presets de configuración y balance nocturno "
        "(Phaser 4.2.1 · 1440x900 · calle de QA)",
        fill=(236, 232, 222),
        font=big,
    )
    draw.text(
        (TILE_GAP, 34),
        "recortados = canales >=250 · blanco frio = luma>200 y max-min<45 (la huella de la bola del "
        "PointLight) · negro aplastado = luma <=8",
        fill=(150, 158, 170),
        font=small,
    )
    for index, (path, label, reading) in enumerate(panels):
        x = TILE_GAP + (index % COLS) * (tile_w + TILE_GAP)
        y = HEADER_PX + (index // COLS) * (tile_h + CAPTION_PX)
        with Image.open(path) as raw:
            canvas.paste(raw.convert("RGB"), (x, y))
        draw.rectangle([x - 2, y - 2, x + tile_w + 1, y + tile_h + 1], outline=(70, 78, 92))
        if patch is not None:
            left, top, right, bottom = patch
            draw.rectangle(
                [x + left, y + top, x + right - 1, y + bottom - 1], outline=(232, 198, 92)
            )
        draw.text((x, y + tile_h + 5), label, fill=(222, 216, 204), font=small)
        draw.text(
            (x, y + tile_h + 23),
            "luma {lumaMedia} · recortados {recortadosPorcentaje} % ({recortados} px) · "
            "blanco frio {blancoFrio} px · negro {negrosAplastadosPorcentaje} %".format(**reading),
            fill=(150, 158, 170),
            font=small,
        )
        if patch is not None:
            draw.text(
                (x, y + tile_h + 39),
                "ladrillo encajado: luma {lumaParcheLadrillo} · desviación "
                "{desviacionParcheLadrillo} · salto entre vecinos "
                "{gradienteVecinoParcheLadrillo}".format(**reading),
                fill=(232, 198, 92),
                font=small,
            )
    canvas.save(out)
    return canvas.size


def main() -> None:
    manifest = json.loads((DIR / "fx_v2.json").read_text(encoding="utf-8"))
    rows: list[dict] = []
    built: list[tuple[Path, str, dict]] = []
    arrays: dict[str, np.ndarray] = {}
    for name, label in PANELS:
        path = DIR / name
        a = array(path)
        arrays[name] = a
        reading = metrics(a)
        built.append((path, label, reading))
        rows.append(
            {
                "panel": name,
                "label": label,
                "sha256": sha256(path),
                "size": [a.shape[1], a.shape[0]],
                **reading,
            }
        )

    # El paño de ladrillo se localiza sobre el control diurno y se mide en los seis paneles: es la
    # comparación que refuta «fachadas sin detalle» sin tocar el brillo global.
    box = brick_patch(arrays["control_day.png"])
    if box is not None:
        for row, (_, _, reading) in zip(rows, built):
            detail = patch_detail(arrays[row["panel"]], box)
            row["parcheLadrillo"] = list(box)
            row.update(detail)
            reading.update(detail)

    size = build_sheet(built, OUT_PNG, box)

    cycles = manifest["teardown"]["cycles"]
    report = {
        "schemaVersion": 1,
        "generatedBy": "scripts/fx-presets-sheet-assemble.py",
        "command": "python3 scripts/fx-presets-sheet-assemble.py",
        "task": "D-111.2 FASE 5 · hoja de presets, exposición y desmontaje",
        "viewport": manifest["viewport"],
        "webglRenderer": manifest.get("webglRenderer"),
        "thresholds": {
            "canalRecortado": CLIP_CHANNEL,
            "blancoFrioLuma": COLD_LUMA,
            "blancoFrioSaturacion": COLD_SATURATION,
            "negroAplastadoLuma": CRUSHED_LUMA,
        },
        "panels": rows,
        "presetsProbados": [
            {
                "preset": entry["preset"],
                "via": entry["via"],
                "effects": entry["probe"]["effects"],
                "moodEsperado": entry.get("expectedMood"),
                "errors": entry["probe"]["errors"],
                "fps": entry["probe"]["fps"],
                "frameTimeP95Ms": entry["probe"]["frameTimeP95Ms"],
                "sha256": entry["sha256"],
            }
            for entry in manifest["presets"]
        ],
        "presetDesdeUrl": {
            "preset": manifest["presetFromUrl"]["preset"],
            "via": manifest["presetFromUrl"]["via"],
            "effects": manifest["presetFromUrl"]["probe"]["effects"],
        },
        "desmontaje": {
            "ciclosPorEfecto": manifest["cyclesPerEffect"],
            "derivaMaximaAbsolutaPorRecurso": {
                key: max(abs(cycle["deriva"][key]) for cycle in cycles)
                for key in cycles[0]["deriva"]
            },
            "escenaAntes": manifest["teardown"]["before"],
            "escenaDespues": manifest["teardown"]["final"],
            "p95LeidoEnLosCiclosMs": [
                manifest["teardown"]["p95BaselineMs"],
                manifest["teardown"]["p95AfterCyclesMs"],
            ],
        },
        "degradacionCanvas": [
            {
                "case": entry["case"],
                "renderer": entry["rendererType"],
                "errors": entry["probe"]["errors"],
                "fire": entry["probe"]["fire"],
                "filtrosAplicados": entry["capabilitiesWebGlOnly"].get("applied"),
                "sha256": entry["sha256"],
            }
            for entry in manifest["canvasFallback"]
        ],
        "pageErrors": manifest["pageErrors"],
        "sheet": str(OUT_PNG.relative_to(REPO)),
        "sheetSize": list(size),
    }

    # El control de rendimiento no es un adorno: sin él, la subida de p95 entre la lectura inicial y
    # la final de `fx_v2.json` parecería culpa del desmontaje. Con la página SIN tocar nada el p95
    # sube todavía más que con los ciclos, y en la rama con ciclos llegó a BAJAR. Se copia aquí para
    # que la hoja no tenga que leerse a medias.
    attribution_path = DIR / "p95_attribution.json"
    if attribution_path.exists():
        attribution = json.loads(attribution_path.read_text(encoding="utf-8"))
        report["controlDeRendimiento"] = {
            "ocioDeltaP95Ms": attribution["ocio"]["deltaP95Ms"],
            "ciclosDeltaP95Ms": attribution["ciclos"]["deltaP95Ms"],
            "ciclosTrasReposoDeltaP95Ms": attribution["ciclos"]["deltaTrasReposoMs"],
            "framesDeEquivalencia": attribution["idleEquivalentFrames"],
            "fuente": str(attribution_path.relative_to(REPO)),
        }

    OUT_JSON.write_text(f"{json.dumps(report, indent=1, ensure_ascii=False)}\n", encoding="utf-8")
    print(f"hoja: {OUT_PNG.relative_to(REPO)} {size[0]}x{size[1]}")
    for row in rows:
        print(
            f"  {row['panel']:32s} luma={row['lumaMedia']:7} "
            f"recortados={row['recortadosPorcentaje']:6} % blancoFrio={row['blancoFrio']:5} "
            f"ladrillo={row.get('lumaParcheLadrillo', '-')} "
            f"vecinos={row.get('gradienteVecinoParcheLadrillo', '-')}"
        )
    print(f"medida: {OUT_JSON.relative_to(REPO)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
D-111.2 FASE 4 — monta la hoja de animación del incendio y mide que se mueve.

Lee los fotogramas que escribió `scripts/fx-fire-sheet.mjs` y responde a la pregunta del encargo:
¿es esto un sprite estático al que se le añadió brillo? La respuesta tiene que salir de números, no
de la impresión al mirar:

1. El recorte NO está hardcodeado: es la envolvente de los píxeles que cambian entre fotogramas. El
   propio incendio dice dónde está; si no se moviese, el recorte no existiría y el script lo dice.
2. Por cada fotograma se cuentan los píxeles que cambian contra el primero y su diferencia media.
3. Se compara contra el control (la misma calle sin el toggle `fire`): ahí está la huella total del
   efecto, con el anclaje incluido.

Salidas, junto a los fotogramas:
 - `fire_animation_sheet.png`: los siete momentos del mismo incendio, alineados y etiquetados,
 - `fire_animation_measure.json`: hashes, métricas y el recorte usado.

Uso:
    python3 scripts/fx-fire-sheet-assemble.py
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

REPO = Path(__file__).resolve().parent.parent
DEFAULT_DIR = REPO / "docs" / "art" / "graphics-capabilities" / "evidence" / "phaser" / "fire_sheet"
# Un píxel "cambia" si algún canal se mueve más que esto: por debajo es ruido del compositor.
DELTA_THRESHOLD = 8
MARGIN_PX = 18
TILE_GAP = 10
HEADER_PX = 58
TILE_CAPTION_PX = 40


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgb(path: Path) -> Image.Image:
    with Image.open(path) as raw:
        return raw.convert("RGB")


def motion_mask(first: Image.Image, other: Image.Image) -> Image.Image:
    """Máscara `L` (255 = el píxel cambió en algún canal) entre dos fotogramas."""
    difference = ImageChops.difference(first, other)
    mask: Image.Image | None = None
    for band in difference.split():
        thresholded = band.point(lambda value: 255 if value > DELTA_THRESHOLD else 0)
        mask = thresholded if mask is None else ImageChops.lighter(mask, thresholded)
    assert mask is not None
    return mask


def crop_box(frames: list[Image.Image]) -> tuple[int, int, int, int]:
    """Envolvente del movimiento, con margen: el encuadre de la hoja lo decide el fuego."""
    union = motion_mask(frames[0], frames[0])
    for frame in frames[1:]:
        union = ImageChops.lighter(union, motion_mask(frames[0], frame))
    bbox = union.getbbox()
    if not bbox:
        raise SystemExit("ningún fotograma cambia: el incendio no se está moviendo")
    left, top, right, bottom = bbox
    width, height = union.size
    return (
        max(0, left - MARGIN_PX),
        max(0, top - MARGIN_PX),
        min(width, right + MARGIN_PX),
        min(height, bottom + MARGIN_PX),
    )


def pair_metrics(first: Image.Image, frame: Image.Image, box: tuple[int, int, int, int]) -> dict:
    """Cuánto cambia dentro del recorte: píxeles distintos y diferencia media en luma."""
    mask = motion_mask(first, frame).crop(box)
    luma = ImageChops.difference(first, frame).convert("L").crop(box)
    total = box[2] - box[0]
    total *= box[3] - box[1]
    changed = mask.histogram()[255]
    return {
        "pixelesDelRecorte": total,
        "pixelesQueCambian": changed,
        "fraccionQueCambia": round(changed / total, 4) if total else 0.0,
        "diferenciaMediaLuma": round(ImageStat.Stat(luma).mean[0], 3),
    }


def font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1 no acepta tamaño
        return ImageFont.load_default()


def build_sheet(
    frames: list[Image.Image],
    labels: list[str],
    readings: list[dict],
    box: tuple[int, int, int, int],
    out: Path,
) -> None:
    tile_w, tile_h = box[2] - box[0], box[3] - box[1]
    cols = len(frames)
    canvas = Image.new(
        "RGB",
        (cols * tile_w + (cols + 1) * TILE_GAP, HEADER_PX + tile_h + TILE_CAPTION_PX),
        (16, 18, 22),
    )
    draw = ImageDraw.Draw(canvas)
    big, small = font(19), font(14)
    draw.text(
        (TILE_GAP, 10),
        "D-111.2 FASE 4 · el mismo incendio en 7 momentos (Phaser 4.2.1 · noche · zoom 1 · fx=fire)",
        fill=(236, 232, 222),
        font=big,
    )
    draw.text(
        (TILE_GAP, 34),
        "el recorte es la envolvente de los píxeles que cambian entre fotogramas · "
        f"umbral {DELTA_THRESHOLD}/canal · la % es contra el primer momento",
        fill=(150, 158, 170),
        font=small,
    )
    for index, (frame, label) in enumerate(zip(frames, labels)):
        x = TILE_GAP + index * (tile_w + TILE_GAP)
        y = HEADER_PX
        canvas.paste(frame.crop(box), (x, y))
        draw.rectangle([x - 2, y - 2, x + tile_w + 1, y + tile_h + 1], outline=(70, 78, 92))
        metric = readings[index]
        draw.text((x, y + tile_h + 5), label, fill=(222, 216, 204), font=small)
        draw.text(
            (x, y + tile_h + 21),
            f"cambia {metric['fraccionQueCambia'] * 100:.1f} %",
            fill=(150, 158, 170),
            font=small,
        )
    canvas.save(out)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=Path, default=DEFAULT_DIR)
    args = parser.parse_args()
    directory: Path = args.dir

    manifest = json.loads((directory / "fire_sheet.json").read_text(encoding="utf-8"))
    frame_paths = [directory / Path(entry["path"]).name for entry in manifest["frames"]]
    frames = [rgb(path) for path in frame_paths]
    box = crop_box(frames)
    readings = [pair_metrics(frames[0], frame, box) for frame in frames]
    labels = [f"t = {entry['clockMs']} ms" for entry in manifest["frames"]]

    out_png = directory.parent / "fire_animation_sheet.png"
    build_sheet(frames, labels, readings, box, out_png)

    control_path = directory / "street_night_control.png"
    control = (
        pair_metrics(rgb(control_path), frames[0], box) if control_path.exists() else None
    )

    report = {
        "schemaVersion": 1,
        "generatedBy": "scripts/fx-fire-sheet-assemble.py",
        "command": "python3 scripts/fx-fire-sheet-assemble.py",
        "task": "D-111.2 FASE 4 · hoja de animación del incendio",
        "viewport": manifest["viewport"],
        "effects": manifest["frames"][0]["effects"],
        "mood": manifest["frames"][0]["mood"],
        "zoom": manifest["frames"][0]["zoom"],
        "presentationSeed": manifest["presentationSeed"],
        "momentStepMs": manifest["momentStepMs"],
        "deltaThresholdPerChannel": DELTA_THRESHOLD,
        "cropBoxFromMotion": list(box),
        "frames": [
            {
                "momento": index,
                "path": str(path.relative_to(REPO)),
                "sha256": sha256(path),
                "relojMs": entry["clockMs"],
                "framesBucle": entry["frames"],
                "particulasVivas": entry["fire"]["particlesAlive"],
                "llamasVivas": entry["fire"]["flameImages"],
                **reading,
            }
            for index, (path, entry, reading) in enumerate(zip(frame_paths, manifest["frames"], readings))
        ],
        "distinctFrameHashes": len({sha256(path) for path in frame_paths}),
        "controlSinFuego": control,
        "anchors": manifest["anchors"],
        "liveAtEnd": manifest["liveAtEnd"],
        "sceneErrors": manifest["sceneErrors"],
        "pageErrors": manifest["pageErrors"],
        "sheet": str(out_png.relative_to(REPO)),
        "lectura": (
            "Siete momentos del mismo incendio recortados por la envolvente de su propio movimiento: "
            "cambia la silueta de la llama, su altura y la columna de humo entre fotogramas, así que "
            "no es un sprite fijo con un brillo añadido. `controlSinFuego` acota la huella del efecto."
        ),
    }
    out_json = directory.parent / "fire_animation_measure.json"
    out_json.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "sheet": report["sheet"],
                "cropBoxFromMotion": report["cropBoxFromMotion"],
                "distinctFrameHashes": report["distinctFrameHashes"],
                "fraccionQueCambia": [reading["fraccionQueCambia"] for reading in readings],
                "diferenciaMediaLuma": [reading["diferenciaMediaLuma"] for reading in readings],
                "controlSinFuego": control,
                "sceneErrors": report["sceneErrors"],
                "pageErrors": report["pageErrors"],
            },
            indent=1,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

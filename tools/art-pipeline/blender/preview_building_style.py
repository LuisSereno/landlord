"""Predicción del color de los módulos bajo el tratamiento canónico, headless y sin renderizar.

§10 pide saturación y valor JUSTIFICADOS y §11 exige que brick/plaster/metal/glass/stone/wood sigan
siendo distinguibles después del remap. Ninguna de esas dos cosas se puede escribir a ojo: hay que
aplicar a los colores RELEVADOS de las fuentes el mismo código que aplica el render. Por eso este
script importa `style_layer_math` (el módulo que usan `runtime_asset.py` y `check_style_layer.py`)
en lugar de reimplementar las bandas: si la matemática se duplicara, el perfil prometería un color
que la pipeline no produce.

Entrada: `imageSamples` de `measure_building_modules.py` (media HSV por bucket de tono, con su
share) + `style_layer_graphic_civic.json`. Salida: por cada textura y bucket, el HSV de origen, el
HSV predicho, qué banda se lo quedó y si el `windowGlow` lo reclama.

Uso (desde la raíz del repo):
  blender --background --python tools/art-pipeline/blender/preview_building_style.py -- \
    --measurements /tmp/measurements.json --output /tmp/style-preview.json
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy  # noqa: F401  (el ejecutable es Blender: fija el hash de herramienta del artefacto)
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from style_layer_math import hsv_to_rgb, rgb_to_hsv, style_pixels  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", required=True)
    parser.add_argument("--style-layer", default=str(HERE / "style_layer_graphic_civic.json"))
    parser.add_argument("--output", required=True)
    parser.add_argument("--kind", default="building")
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def toolchain():
    build_hash = bpy.app.build_hash
    if isinstance(build_hash, bytes):
        build_hash = build_hash.decode("utf-8")
    return {
        "blender": f"{bpy.app.version_string}",
        "buildHash": build_hash,
        "numpy": np.__version__,
    }


def swatch(record):
    """RGB del color medio de un bucket, reconstruido con la misma conversión del tratamiento."""
    # Un bucket gris no tiene tono definido (se reconstruye con hue 0), pero su saturación medida sí
    # importa: decide si lo reclama `near_white_trim` (sat ≤ 0,16) o una banda cromática.
    hue = 0.0 if record["meanHueDegrees"] is None else record["meanHueDegrees"]
    return hsv_to_rgb(
        np.array([hue], dtype=np.float32),
        np.array([record["meanSaturation"]], dtype=np.float32),
        np.array([record["meanValue"]], dtype=np.float32),
    )


def predict(record, treatment, kind):
    source = swatch(record)
    result = style_pixels(source, treatment, kind)
    out_hue, out_sat, out_val = rgb_to_hsv(result["styled_rgb"])
    hue_meaningful = record["meanHueDegrees"] is not None
    predicted_hue = round(float(out_hue[0]), 1) if hue_meaningful else None
    window = result["window_mask"]
    return {
        "hue": record["hue"],
        "share": record["share"],
        "input": {
            "hueDegrees": record["meanHueDegrees"],
            "saturation": record["meanSaturation"],
            "value": record["meanValue"],
        },
        "predicted": {
            "hueDegrees": predicted_hue,
            "saturation": round(float(out_sat[0]), 3),
            "value": round(float(out_val[0]), 3),
        },
        "claimedByBand": record_band(result, treatment),
        "claimedIndex": int(result["claimed_by"][0]),
        "windowGlow": bool(window is not None and bool(window[0])),
        "hueShiftDegrees": (
            None
            if not (hue_meaningful and predicted_hue is not None)
            else round(((predicted_hue - record["meanHueDegrees"] + 540) % 360) - 180, 1)
        ),
    }


def record_band(result, treatment):
    index = int(result["claimed_by"][0])
    bands = treatment.get("hueBands", [])
    return bands[index]["id"] if 0 <= index < len(bands) else None


def main():
    args = parse_args()
    measurements = json.loads(Path(args.measurements).read_text(encoding="utf-8"))
    style_layer = json.loads(Path(args.style_layer).read_text(encoding="utf-8"))
    treatment = style_layer["externalTreatment"]

    images = []
    for sample in measurements.get("imageSamples", []):
        statistics = sample.get("statistics") or {}
        buckets = statistics.get("hueBuckets") or []
        entry = {
            "name": sample["name"],
            # Identidad = archivo: los tres packs de Kenney traen su propio `colormap.png` con el
            # mismo nombre de datablock; sin filePath el perfil atribuiría un color a los tres.
            "filePath": sample.get("filePath") or sample["name"],
            "colorspace": sample["colorspace"],
            "hueMeaningful": sample["hueMeaningful"],
            "buckets": [],
        }
        if sample["hueMeaningful"] and buckets:
            entry["buckets"] = [predict(record, treatment, args.kind) for record in buckets]
        elif not sample["hueMeaningful"]:
            # ORM / Normal: no son color, pero sus canales sí son rugosidad y metallic medidos.
            entry["channels"] = statistics.get("channelMeans")
        images.append(entry)

    output = {
        "toolchain": toolchain(),
        "kind": args.kind,
        "styleLayer": {
            "path": args.style_layer,
            "sha256": hashlib.sha256(Path(args.style_layer).read_bytes()).hexdigest(),
            "palette": style_layer["palette"],
            "treatmentVersion": treatment["version"],
            "global": treatment["global"],
        },
        "images": images,
    }
    Path(args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    treated = sum(1 for image in images if image["buckets"])
    print(json.dumps({"status": "predicted", "images": len(images), "withColorBuckets": treated}))


main()

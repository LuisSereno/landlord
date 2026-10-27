"""Comprobación de que los PNGs renderizados mantienen el grade nocturno.

V.b2.0: el `check_style_layer.py` valida los atlas de ENTRADA, pero no garantiza que la
cadena de render (style_layer → runtime_asset.py → PNG publicado) preserve el grade. Si
alguien cambia el JSON a valores de día, los atlas pasan el check pero los renders salen
quemados. Este script cierra ese hueco midiendo los píxeles de SALIDA.

Uso (desde la raíz del repo):
  python3 tools/art-pipeline/blender/check_rendered_night.py

Selecciona un representative de cada kind (building, tree, vehicle) y verifica que la
mediana de valor HSV esté por debajo del techo nocturno declarado en el style layer.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from style_layer_math import rgb_to_hsv  # noqa: E402

STYLE_LAYER_PATH = HERE / "style_layer_graphic_civic.json"
BUNDLE_PATH = REPO_ROOT / "apps" / "web" / "src" / "generated" / "runtime-assets-blender.json"
PUBLIC_DIR = REPO_ROOT / "apps" / "web" / "public" / "assets" / "runtime" / "blender"

# Muestra mínima: 1 edificio, 1 árbol, 1 vehículo. Suficiente para detectar un revert a día.
SAMPLE_ASSETS = {
    "building": "bld_residential_a-complete",
    "prop": "prp_tree_oak",
    "vehicle": "veh_sedan",
}


def read_png_rgba(path):
    """Lee PNG con PIL (ya disponible en el entorno Blender)."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img, dtype=np.float32) / 255.0
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    return rgb, alpha


def main():
    style_layer = json.loads(STYLE_LAYER_PATH.read_text())
    night_ceiling = float(style_layer["externalTreatment"]["acceptance"]["nightValueCeiling"])
    bundle = json.loads(BUNDLE_PATH.read_text())

    failures = []
    results = []
    for kind, asset_stem in SAMPLE_ASSETS.items():
        png_path = PUBLIC_DIR / f"{asset_stem}.png"
        if not png_path.exists():
            failures.append(f"{asset_stem}: no existe el PNG en {PUBLIC_DIR}")
            continue
        rgb, alpha = read_png_rgba(png_path)
        opaque_mask = alpha > 0.5
        if not opaque_mask.any():
            failures.append(f"{asset_stem}: no hay píxeles opacos")
            continue
        opaque_rgb = rgb[opaque_mask]
        _, _, value = rgb_to_hsv(opaque_rgb)
        median_v = float(np.median(value))
        p90_v = float(np.percentile(value, 90))
        results.append(
            {
                "asset": asset_stem,
                "kind": kind,
                "medianV": round(median_v, 3),
                "p90V": round(p90_v, 3),
                "ceiling": night_ceiling,
            }
        )
        if median_v > night_ceiling:
            failures.append(
                f"{asset_stem} ({kind}): mediana V={median_v:.3f} supera el techo nocturno {night_ceiling}"
            )
        if p90_v > night_ceiling + 0.1:
            failures.append(
                f"{asset_stem} ({kind}): P90 V={p90_v:.3f} indica áreas en luz de día (techo+0.1={night_ceiling+0.1})"
            )

    print(f"{'asset':32} {'kind':10} {'mediana':>8} {'P90':>8} {'techo':>8}")
    for r in results:
        print(f"{r['asset']:32} {r['kind']:10} {r['medianV']:>8.3f} {r['p90V']:>8.3f} {r['ceiling']:>8.2f}")

    if failures:
        print("\nFALLA el check de render nocturno:")
        for msg in failures:
            print("  - " + msg)
        return 1
    print("\nOK: todos los renders están en rango nocturno.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

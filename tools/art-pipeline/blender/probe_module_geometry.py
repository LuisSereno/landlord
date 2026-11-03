"""Sonda de vértices sobre módulos concretos del catálogo (`python3` no basta: corre en Blender).

El catálogo publica AABB, `frontAxis` y anclajes medidos; cuando una convención de colocación no se
decide con esa caja hace falta ver los vértices reales. Se usó para fijar dónde está el alero de las
pendientes (`Roof_Slate_Center`: pie de agua en -Y con z=0, meseta de cumbrera en +Y con z=3) y para
confirmar que un módulo `symmetric-Y` no tiene cara.

    blender -b --factory-startup --python tools/art-pipeline/blender/probe_module_geometry.py -- \
        mod_megakit_roof_slate_center_2m
"""

import json
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from source_import import import_source, normalize_import_root  # noqa: E402

CATALOG_PATH = REPO_ROOT / "blender_artist/manifests/building-modules.json"
# Franja de 0,5 m a cada lado del eje Y: por debajo del pie de agua, por encima de la meseta.
SHOULDER_METERS = 0.5


def stats(points):
    if not len(points):
        return "vacío"
    return (
        f"x[{points[:, 0].min():.2f},{points[:, 0].max():.2f}] "
        f"z[{points[:, 2].min():.2f},{points[:, 2].max():.2f}] n={len(points)}"
    )


def probe(record):
    objects = import_source(str(REPO_ROOT / record["sourcePath"]))
    normalize_import_root(objects, record["unitScale"])
    bpy.context.view_layer.update()
    wanted = set(record["objectSelector"]["meshes"])
    for obj in objects:
        if obj.name not in wanted or obj.type != "MESH":
            continue
        coords = np.array(
            [obj.matrix_world @ vertex.co for vertex in obj.data.vertices], dtype=np.float64
        )
        low = coords[coords[:, 1] <= -SHOULDER_METERS]
        high = coords[coords[:, 1] >= SHOULDER_METERS]
        middle = coords[
            (coords[:, 1] > -SHOULDER_METERS) & (coords[:, 1] < SHOULDER_METERS)
        ]
        print(
            f"{record['id']} / {obj.name} (frontAxis {record['anchor']['frontAxis']}): "
            f"-Y {stats(low)} | centro {stats(middle)} | +Y {stats(high)}"
        )


def main():
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    modules = {record["id"]: record for record in catalog["modules"]}
    for module_id in sys.argv[sys.argv.index("--") + 1 :]:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        probe(modules[module_id])


main()

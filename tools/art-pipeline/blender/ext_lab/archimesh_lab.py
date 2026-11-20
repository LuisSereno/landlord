"""D-111 §4 — Laboratorio de Archimesh (extensión `archimesh`).

Pregunta que responde: ¿los componentes históricos de Archimesh (puerta con marco, ventana con
marco y alféizar, cubierta de tejas) aportan arquitectura que el Building Composer no pueda ya
montar con los módulos CC0 que tenemos en staging?

La evidencia es UNA sola imagen con una rejilla de 3x3: filas = componente, columnas = autoría
(Archimesh / Quaternius MegaKit / Kenney Retro Urban). Todo se posa sobre el mismo plano de
referencia y a escala real (1 BU = 1 m), así que la comparación es geométrica, no de encuadre.

Uso (ver README.md del directorio para el aislamiento de configuración):

  blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/archimesh_lab.py -- \
    --output docs/art/graphics-capabilities/evidence/extensions/archimesh_components.png \
    --metadata docs/art/graphics-capabilities/evidence/extensions/archimesh_components.json
"""

import argparse
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import lab_common as lab  # noqa: E402
from runtime_asset import cube, material  # noqa: E402

EXT_ID = "archimesh"

CELL = 6.0
COLUMNS = ("archimesh", "quaternius", "kenney")
ROWS = ("door", "window", "roof")
LABELS = {
    "archimesh": "ARCHIMESH 1.2.5",
    "quaternius": "QUATERNIUS MEGAKIT",
    "kenney": "KENNEY RETRO URBAN",
    "door": "PUERTA",
    "window": "VENTANA",
    "roof": "CUBIERTA",
}

# Fuentes CC0 reales del staging, con el `unitScale` y el `objectSelector` que declara
# blender_artist/manifests/building-modules.json.
CC0_SOURCES = {
    ("quaternius", "door"): {
        "moduleId": "mod_megakit_doorframe_trim",
        "path": "blender_artist/staging/third_party/cc0/extracted/quaternius/"
                "downtown-city-megakit/Exports/glTF (Godot)/DoorFrame_Trim.gltf",
        "unitScale": 1,
        "note": "marco de puerta con moldura; el MegaKit no trae hoja con marco propio de 1 m",
    },
    ("quaternius", "window"): {
        "moduleId": "mod_megakit_brick_window_trim_2m",
        "path": "blender_artist/staging/third_party/cc0/extracted/quaternius/"
                "downtown-city-megakit/Exports/glTF (Godot)/Brick_Window_Trim_Single.gltf",
        "unitScale": 1,
        "note": "ventana de 2 m con trim perimetral",
    },
    ("quaternius", "roof"): {
        "moduleId": "mod_megakit_roof_slate_center_2m",
        "path": "blender_artist/staging/third_party/cc0/extracted/quaternius/"
                "downtown-city-megakit/Exports/glTF (Godot)/Roof_Slate_Center.gltf",
        "unitScale": 1,
        "note": "tramo central de pizarra, modulo de 2 m",
    },
    ("kenney", "door"): {
        "moduleId": "mod_kenney_retro_door_a",
        "path": "blender_artist/staging/third_party/cc0/extracted/kenney/retro-urban-kit/"
                "Models/GLB format/door-type-a.glb",
        "unitScale": 1,
        "note": "el unitScale del Retro Urban Kit sigue sin resolver en el repo; se mide aqui",
    },
    ("kenney", "window"): {
        "moduleId": "mod_kenney_retro_window_wide_a",
        "path": "blender_artist/staging/third_party/cc0/extracted/kenney/retro-urban-kit/"
                "Models/GLB format/window-wide-type-a.glb",
        "unitScale": 1,
        "note": "idem",
    },
    ("kenney", "roof"): {
        "moduleId": "mod_kenney_retro_roof_metal_a",
        "path": "blender_artist/staging/third_party/cc0/extracted/kenney/retro-urban-kit/"
                "Models/GLB format/roof-metal-type-a.glb",
        "unitScale": 1,
        "note": "idem",
    },
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--ortho-scale", type=float, default=23.0)
    parser.add_argument("--target-z", type=float, default=1.9)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--mood", default=lab.DEFAULT_MOOD)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


# ---------------------------------------------------------------------------------------------
# Archimesh headless
# ---------------------------------------------------------------------------------------------
def _archimesh(package):
    import importlib

    try:
        return importlib.import_module(f"bl_ext.user_default.archimesh.{package}")
    except ModuleNotFoundError as error:
        raise lab.LabError(f"archimesh.{package} no importable: {error}") from error


def _descendants(root):
    found = [root]
    for child in root.children:
        found.extend(_descendants(child))
    return found


def archimesh_component(collection_prop, settings, operator, operator_kwargs, label):
    """Una llamada real a Archimesh.

    Los operadores `mesh.archimesh_door` y `mesh.archimesh_window` NO exponen propiedades: se
    documentan en el panel N y viven en la CollectionProperty del objeto
    (`Object.DoorObjectGenerator` / `Object.WindowObjectGenerator`), que el propio operador crea.
    El orden correcto en headless es: crear el objeto, activarlo (el callback `update_object`
    lee `context.active_object`) y escribir las propiedades; cada escritura reconstruye la malla
    y DESTRUYE y vuelve a crear los hijos, por eso el lote se recolecta al final comparando con
    el antes, no con el `created` inicial.

    Ojo: `obj.keys()` no lista la CollectionProperty (devuelve solo ID properties libres como
    `archimesh.hole_enable`); hay que acceder por atributo RNA.
    """
    before = set(bpy.data.objects.keys())
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    result = operator(**operator_kwargs) if operator_kwargs else operator()
    if result != {"FINISHED"}:
        raise lab.LabError(f"{label} devolvio {result}")
    main = next(
        (obj for obj in bpy.data.objects
         if obj.name not in before and len(getattr(obj, collection_prop, []) or []) > 0),
        None,
    )
    if main is None:
        raise lab.LabError(f"{label} no creo un objeto con {collection_prop}")

    bpy.ops.object.select_all(action="DESELECT")
    main.select_set(True)
    bpy.context.view_layer.objects.active = main
    props = getattr(main, collection_prop)[0]
    applied = {}
    for key, value in settings.items():
        setattr(props, key, value)
        applied[key] = value

    parts = [obj for obj in bpy.data.objects if obj.name not in before]
    controls = [obj for obj in parts if obj.name.startswith("CTRL_")]
    for obj in controls:
        # Los mallas CTRL_* son el troquel del "autohole" (booleano sobre la pared). No son
        # geometria de la pieza: si se dejan renderizar salen como cajas negras en la imagen.
        obj.hide_render = True
    for obj in parts:
        obj["ext_lab_author"] = "archimesh"
    return {
        "element": label,
        "root": main.name,
        "objects": sorted(obj.name for obj in parts),
        "autoholeControls": sorted(obj.name for obj in controls),
        "properties": applied,
        "operator": label,
    }


def make_door():
    return archimesh_component(
        "DoorObjectGenerator",
        {
            "crt_mat": False,
            "model": "2",
            "openside": "1",
            "factor": 0.5,
            "frame_width": 1.1,
            "frame_height": 2.2,
            "frame_thick": 0.14,
            "frame_size": 0.14,
            "r": 0.0,
        },
        bpy.ops.mesh.archimesh_door,
        None,
        "mesh.archimesh_door",
    )


def make_window():
    return archimesh_component(
        "WindowObjectGenerator",
        {
            "crt_mat": False,
            "opentype": "1",
            "width": 1.4,
            "height": 1.4,
            "depth": 0.12,
            "external": True,
            "frame": 0.09,
            "frame_L": 0.09,
            "wf": 0.07,
            "leafratio": 0.5,
            "handle": True,
            "sill": True,
            "sill_thickness": 0.06,
            "sill_front": 0.16,
            "sill_back": 0.06,
            "blind": False,
            "r": 0.0,
        },
        bpy.ops.mesh.archimesh_window,
        None,
        "mesh.archimesh_window",
    )


def make_roof():
    before = set(bpy.data.objects.keys())
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    result = bpy.ops.mesh.archimesh_roof(
        model="3", roof_width=11, roof_height=6, roof_scale=1.0,
        roof_thick=0.02, roof_angle=22.0, crt_mat=False,
    )
    if result != {"FINISHED"}:
        raise lab.LabError(f"mesh.archimesh_roof devolvio {result}")
    parts = [obj for obj in bpy.data.objects if obj.name not in before]
    for obj in parts:
        obj["ext_lab_author"] = "archimesh"
    return {
        "element": "roof",
        "root": parts[0].name,
        "objects": sorted(obj.name for obj in parts),
        "properties": {
            "model": "3", "roof_width": 11, "roof_height": 6, "roof_scale": 1.0,
            "roof_thick": 0.02, "roof_angle": 22.0, "crt_mat": False,
        },
        "operator": "mesh.archimesh_roof (esta YES expone propiedades de operador)",
    }


# ---------------------------------------------------------------------------------------------
# Colocacion y rejilla
# ---------------------------------------------------------------------------------------------
def place(objects, name, cell):
    """Traduce el lote para que su centro XY quede en `cell` y su base en z=0."""
    measurable = [obj for obj in objects if obj.type == "MESH" and not obj.hide_render]
    mins, maxs = lab.world_bounds(measurable)
    center = (mins + maxs) / 2
    offset = (cell[0] - center.x, cell[1] - center.y, cell[2] - mins.z)
    return lab.attach(objects, name, offset)


def cell_center(column, row):
    return ((COLUMNS.index(column) - 1) * CELL, (ROWS.index(row) - 1) * CELL, 0.12)


def label_object(text, location, size=0.52):
    curve = bpy.data.curves.new(f"TXT_{text}", "FONT")
    curve.body = text
    curve.size = size
    curve.extrude = 0.005
    curve.align_x = "CENTER"
    curve.align_y = "BOTTOM"
    obj = bpy.data.objects.new(f"TXT_{text}", curve)
    obj.location = location
    obj.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material("lab_label", (0.03, 0.05, 0.07, 1.0), roughness=0.7))
    obj["ext_lab_author"] = "lab_annotation"
    return obj


def build_grid(mats):
    cells = []
    for row in ROWS:
        for column in COLUMNS:
            center = cell_center(column, row)
            cube(f"PAD_{column}_{row}", (center[0], center[1], 0.06), (5.0, 5.0, 0.12),
                 mats["ground"])
            if column == "archimesh":
                maker = {"door": make_door, "window": make_window, "roof": make_roof}[row]
                info = maker()
                parts = [bpy.data.objects[n] for n in info["objects"]]
                lab.paint(parts, mats["trim"], force=True)
            else:
                spec = CC0_SOURCES[(column, row)]
                imported, root, source, normalization = lab.import_cc0_module(
                    spec["path"], unit_scale=spec["unitScale"],
                    name_hint=f"{column}_{row}",
                )
                parts = imported + [root]
                for obj in parts:
                    obj["ext_lab_author"] = "cc0_staging"
                info = {
                    "element": row,
                    "root": root.name,
                    "objects": sorted(obj.name for obj in parts),
                    "source": spec["path"],
                    "moduleId": spec["moduleId"],
                    "unitScale": spec["unitScale"],
                    "normalization": normalization,
                    "note": spec["note"],
                }
            controller = place(parts, f"CELL_{column}_{row}", center)
            mesh_parts = [obj for obj in parts if obj.type == "MESH" and not obj.hide_render]
            info["column"] = column
            info["row"] = row
            info["boundsMeters"] = lab.bounds_of(mesh_parts)
            info["triangles"] = sum(
                len(p.vertices) - 2 for obj in mesh_parts for p in obj.data.polygons
            )
            info["meshObjects"] = len(mesh_parts)
            info["controller"] = controller.name
            cells.append(info)

    for column in COLUMNS:
        label_object(LABELS[column], ((COLUMNS.index(column) - 1) * CELL, 3.4, 0.13))
    for row in ROWS:
        label_object(LABELS[row], (-CELL * 1.62, (ROWS.index(row) - 1) * CELL, 0.13))
    return cells


def main():
    args = parse_args()
    lab.clear_scene()
    module = lab.install_and_enable(EXT_ID)
    _archimesh("achm_door_maker")
    _archimesh("achm_window_maker")
    _archimesh("achm_roof_maker")
    mats = lab.palette_materials()

    cells = build_grid(mats)

    provenance = dict(lab.EXTENSIONS[EXT_ID])
    provenance.update({
        "registryId": EXT_ID,
        "moduleId": module,
        "mood": args.mood,
        "headless": True,
        "invocation": (
            "bpy.ops.mesh.archimesh_door()/archimesh_window() + Object.DoorObjectGenerator[0] / "
            "Object.WindowObjectGenerator[0] (el operador no expone props) + "
            "bpy.ops.mesh.archimesh_roof(model, roof_width, roof_height, roof_scale, "
            "roof_thick, roof_angle, crt_mat)"
        ),
        "generatorCalls": len([c for c in cells if c["column"] == "archimesh"]),
        "bundledInBlender": False,
    })
    generated = {
        "grid": {"columns": COLUMNS, "rows": ROWS, "cellSpacingMeters": CELL},
        "cells": cells,
        "note": (
            "Los tres componentes de Archimesh se pintan con la paleta mate del laboratorio para "
            "que la imagen compare geometria; los modulos CC0 conservan sus materiales propios "
            "porque asi es como entran hoy en el pipeline. Cada celda esta a escala real "
            "(1 BU = 1 m) sobre un pad de 5 x 5 m."
        ),
    }
    lab.render_evidence(
        label="Archimesh vs Quaternius vs Kenney - puerta, ventana con alfeizar y cubierta "
              "a escala real",
        png_path=args.output,
        json_path=args.metadata,
        ortho_scale=args.ortho_scale,
        target_z=args.target_z,
        resolution=args.resolution,
        samples=args.samples,
        provenance=provenance,
        generated=generated,
    )


if __name__ == "__main__":
    main()

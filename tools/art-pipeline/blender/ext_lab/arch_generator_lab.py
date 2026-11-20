"""D-111 §4 — Laboratorio de Arch Generator (extensión `arch_generator`).

Pregunta que responde: ¿los arcos, columnas y porticos procedurales de Arch Generator dan a un
edificio civico tipo `town_hall` una presencia arquitectonica reconocible de edificio publico,
superior a la que produce hoy el Building Composer con su vocabulario de modulos CC0?

Uso (ver README.md del directorio para el aislamiento de configuracion):

  blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/arch_generator_lab.py -- \
    --output docs/art/graphics-capabilities/evidence/extensions/arch_generator_town_hall.png \
    --metadata docs/art/graphics-capabilities/evidence/extensions/arch_generator_town_hall.json

Autoria de cada pieza
---------------------
`arch_generator`   -> todo lo que sale de `bpy.ops.mesh.arch_create()` + `obj.arch_props`
                      (portico de 7 crujias, portal monumental, arcos de cabecera de ventana).
`lab_massing`      -> masa civica 20 x 12 x 10,2 m, zocalo, cornisas, escalinata y fronton, que la
                      extension no genera y que se montan con la primitiva `cube` del propio
                      pipeline para no inventar un segundo lenguaje de formas.
"""

import argparse
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import lab_common as lab  # noqa: E402
from runtime_asset import cube  # noqa: E402

EXT_ID = "arch_generator"

# town_hall del enunciado: 20 x 12 m, 3 plantas, crujia de 2 m.
BODY_W, BODY_D, FLOOR_H, FLOORS = 20.0, 12.0, 3.4, 3
PLINTH_H = 0.6
BODY_H = FLOOR_H * FLOORS
BAY = 2.0


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--ortho-scale", type=float, default=27.0)
    parser.add_argument("--target-z", type=float, default=5.6)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--mood", default=lab.DEFAULT_MOOD)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def arch_instance(label, offset, settings, mats, mat_key, rotation_z_degrees=0.0):
    module = _arch_generator_module()
    rebuild_mesh = module.builders.rebuild_mesh

    before = set(bpy.data.objects.keys())
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    result = bpy.ops.mesh.arch_create()
    if result != {"FINISHED"}:
        raise lab.LabError(f"mesh.arch_create devolvio {result} para {label}")
    created = [obj for obj in bpy.data.objects if obj.name not in before]
    obj = next(item for item in created if item.name.startswith("Arch Mansion"))
    obj.name = f"AG_{label}"

    props = obj.arch_props
    applied = {}
    for key, value in settings.items():
        setattr(props, key, value)
        applied[key] = value
    rebuild_mesh(bpy.context, obj)

    obj.data.materials.clear()
    obj.data.materials.append(mats[mat_key])
    obj["ext_lab_author"] = "arch_generator"
    controller = lab.attach([obj], f"AGC_{label}", offset, rotation_z_degrees)
    return {
        "element": label,
        "object": obj.name,
        "controller": controller.name,
        "offset": [round(v, 3) for v in offset],
        "rotationZDegrees": rotation_z_degrees,
        "archProps": applied,
        "vertices": len(obj.data.vertices),
        "triangles": sum(len(p.vertices) - 2 for p in obj.data.polygons),
    }


def _arch_generator_module():
    import importlib

    package = "bl_ext.user_default.arch_generator"
    try:
        module = importlib.import_module(package)
        importlib.import_module(f"{package}.builders")
    except ModuleNotFoundError as error:
        raise lab.LabError(f"arch_generator no esta importable: {error}") from error
    if not hasattr(module, "builders"):
        raise lab.LabError("el paquete arch_generator no expone su submodulo builders")
    return module


def massing(mats):
    """Masa civica con la primitiva del pipeline. Se marca como `lab_massing` en el JSON."""
    made = []
    made.append(cube("LM_plinth", (0, 0, PLINTH_H / 2), (BODY_W + 1.2, BODY_D + 1.2, PLINTH_H),
                     mats["trim"], bevel=0.02))
    made.append(cube("LM_body", (0, 0.3, PLINTH_H + BODY_H / 2), (BODY_W, BODY_D, BODY_H),
                     mats["stone"], bevel=0.03))
    for floor in (1, 2):
        made.append(cube(f"LM_stringcourse_{floor}", (0, 0.28, PLINTH_H + floor * FLOOR_H),
                         (BODY_W + 0.5, BODY_D + 0.4, 0.24), mats["trim"], bevel=0.01))
    made.append(cube("LM_cornice", (0, 0.2, PLINTH_H + BODY_H + 0.28),
                     (BODY_W + 1.8, BODY_D + 1.6, 0.56), mats["trim"], bevel=0.02))
    # Torre/ataico DETRAS del fronton: si queda mas alto que el remate del templo, el fronton se
    # lee como una rampa tumbada en vez de como un timpano.
    attic_base = PLINTH_H + BODY_H + 0.56
    made.append(cube("LM_attic", (0, 3.2, attic_base + 1.1),
                     (BODY_W - 9.0, BODY_D - 6.0, 2.2), mats["stone"], bevel=0.02))
    made.append(cube("LM_attic_cap", (0, 3.2, attic_base + 2.35),
                     (BODY_W - 8.4, BODY_D - 5.4, 0.3), mats["trim"], bevel=0.01))
    # Ventanas en ritmo de crujia de 2 m sobre los paramentos vistos (-Y y +X).
    for index, x in enumerate(range(-8, 9, 2)):
        for floor in range(FLOORS):
            z = PLINTH_H + floor * FLOOR_H + 2.05
            made.append(cube(f"LM_win_front_{index}_{floor}", (x, -5.72, z), (0.95, 0.16, 1.5),
                             mats["glass"]))
    for index, y in enumerate(range(-4, 6, 2)):
        for floor in range(FLOORS):
            z = PLINTH_H + floor * FLOOR_H + 2.05
            made.append(cube(f"LM_win_side_{index}_{floor}", (10.05, y, z), (0.16, 0.95, 1.5),
                             mats["glass"]))
    # Marcos de ventana en relieve: sin ellos el paramento de piedra queda plano y la fachada
    # pierde el ritmo de crujia que hace legible un edificio publico. La planta noble se deja
    # limpia porque su remate lo aportan las cabeceras de arco de la extension.
    for index, x in enumerate(range(-8, 9, 2)):
        for floor in range(FLOORS):
            if floor == 1:
                continue
            z = PLINTH_H + floor * FLOOR_H + 2.05
            made.append(cube(f"LM_frame_front_{index}_{floor}", (x, -5.80, z), (1.35, 0.18, 1.95),
                             mats["trim"]))
            made.append(cube(f"LM_sill_front_{index}_{floor}", (x, -5.86, z - 1.02),
                             (1.6, 0.3, 0.16), mats["trim"]))
    for index, y in enumerate(range(-4, 6, 2)):
        for floor in range(FLOORS):
            z = PLINTH_H + floor * FLOOR_H + 2.05
            made.append(cube(f"LM_frame_side_{index}_{floor}", (10.13, y, z), (0.18, 1.35, 1.95),
                             mats["trim"]))
    # Escalinata frontal: 6 peldanos macizos de 0,45 m de huella, 22 m de ancho. Cada peldano es
    # un bloque hasta el suelo, no una lamina: una lamina no proyecta la sombra de escalon que es
    # lo que hace legible una escalinata civica a 0,5x.
    tread = 0.45
    for step in range(6):
        height = PLINTH_H - step * (PLINTH_H / 6.0)
        made.append(cube(
            f"LM_step_{step}",
            (0.0, -6.15 - (step + 0.5) * tread, height / 2),
            (22.0 - step * 0.7, tread, height),
            mats["trim"],
        ))
    for obj in made:
        obj["ext_lab_author"] = "lab_massing"
    return made


def pediment(mats):
    """Fronton triangular: prisma de 3 vertices construido con bmesh, no aportado por la extension.

    Se construye a mano porque `primitive_cylinder(vertices=3)` orienta el triangulo con un vertice
    hacia +X, y el orden de Euler de Blender terminaba con el fronton tumbado sobre la fachada.
    """
    import bmesh

    mesh = bpy.data.meshes.new("LM_pediment")
    bm = bmesh.new()
    half_w, rise, half_d = 9.2, 2.15, 0.55
    front = [bm.verts.new(v) for v in ((-half_w, -half_d, 0.0), (half_w, -half_d, 0.0), (0.0, -half_d, rise))]
    back = [bm.verts.new(v) for v in ((-half_w, half_d, 0.0), (half_w, half_d, 0.0), (0.0, half_d, rise))]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((front[i], front[j], back[j], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LM_pediment", mesh)
    # Apoyado sobre el cornisamiento (11,36 m) y alineado con el plano del portico, para que lea
    # como timpano de un frontis y no como cubierta inclinada.
    obj.location = (0.0, -6.3, PLINTH_H + BODY_H + 0.56)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats["trim"])
    obj["ext_lab_author"] = "lab_massing"
    return obj


def build(mats):
    steps = []
    facade_y = -5.72
    portico_z = PLINTH_H

    # --- Portico de 7 crujias (arcada) --------------------------------------------------------
    steps.append(arch_instance("portico_7_bays", (0.0, -6.35, portico_z), {
        "mode": "MULTI",
        "frame_type": "FULL",
        "multi_stambha_mode": "SHARED",
        "arch_style": "ROMAN",
        "arch_count": 7,
        "arch_segments": 32,
        "width": BAY,
        "gap_between_arches": 0.9,
        "height": 1.0,
        "depth": 0.9,
        "thickness": 0.34,
        "stambha_width": 0.62,
        "stambha_depth": 0.62,
        "stambha_height": 4.0,
        "pillar_style": "FLUTED",
        "flute_count": 14,
        "flute_depth": 0.09,
        "base_style": "ATTIC",
        "base_width": 0.95,
        "base_depth": 0.95,
        "base_height": 0.42,
        "capital_style": "IONIC",
        "capital_width": 0.95,
        "capital_depth": 0.9,
        "capital_height": 0.46,
        "trim_resolution": 28,
        "enable_support_beam": True,
        "enable_spring_block": True,
        "enable_arch_root": True,
    }, mats, "trim"))

    # --- Portal monumental bajo el vano central -----------------------------------------------
    steps.append(arch_instance("portal_monumental", (0.0, -7.25, portico_z), {
        "mode": "SINGLE",
        "frame_type": "FULL",
        "arch_style": "TUDOR",
        "arch_tudor_corner": 0.12,
        "width": 2.6,
        "height": 1.1,
        "depth": 0.7,
        "thickness": 0.3,
        "stambha_width": 0.6,
        "stambha_depth": 0.6,
        "stambha_height": 2.6,
        "pillar_style": "FLUTED",
        "flute_count": 12,
        "flute_depth": 0.09,
        "base_style": "ATTIC",
        "capital_style": "IONIC",
        "trim_resolution": 32,
        "enable_support_beam": True,
        "frame_beam_height": 0.4,
    }, mats, "trim"))

    # --- Cabeceras de arco sobre la planta noble -----------------------------------------------
    # Cabeceras de arco sobre la planta noble (foro 1): arrancan en el dintel de la ventana.
    spring_z = PLINTH_H + 1 * FLOOR_H + 2.05 + 0.75
    for index, x in enumerate(range(-8, 9, 2)):
        steps.append(arch_instance(f"cabecera_ventana_{index}", (x, facade_y - 0.12, spring_z), {
            "mode": "SINGLE",
            "frame_type": "ARCH_ONLY",
            "arch_style": "SEGMENTAL",
            "width": 1.5,
            "height": 0.5,
            "depth": 0.26,
            "thickness": 0.2,
            "stambha_height": 0.0,
            "enable_spring_block": True,
            "spring_block_width": 0.14,
            "spring_block_height": 0.14,
            "enable_arch_root": False,
            "arch_segments": 24,
        }, mats, "trim"))

    # --- Columnas exentas de remate en la escalinata ------------------------------------------
    for index, x in enumerate((-10.2, 10.2)):
        steps.append(arch_instance("columna_exenta", (x, -8.5, 0.0), {
            "mode": "SINGLE",
            "frame_type": "FULL",
            "arch_style": "FLAT",
            "arch_flat_camber": 0.02,
            "width": 0.9,
            "height": 0.35,
            "depth": 0.9,
            "thickness": 0.16,
            "stambha_width": 0.78,
            "stambha_depth": 0.78,
            "stambha_height": 3.6,
            "pillar_style": "TUSCAN",
            "pillar_entasis_bulge": 0.12,
            "base_style": "ATTIC",
            "base_width": 1.05,
            "base_depth": 1.05,
            "base_height": 0.45,
            "capital_style": "CIRCULAR",
            "capital_width": 1.05,
            "capital_depth": 1.05,
            "capital_height": 0.4,
            "trim_resolution": 24,
            "enable_support_beam": True,
            "frame_beam_height": 0.35,
        }, mats, "trim"))
    return steps


def main():
    args = parse_args()
    lab.clear_scene()
    module = lab.install_and_enable(EXT_ID)
    mats = lab.palette_materials()

    massing_objects = massing(mats)
    pediment(mats)
    steps = build(mats)

    provenance = dict(lab.EXTENSIONS[EXT_ID])
    provenance.update({
        "registryId": EXT_ID,
        "moduleId": module,
        "mood": args.mood,
        "headless": True,
        "invocation": "bpy.ops.mesh.arch_create() + obj.arch_props + builders.rebuild_mesh()",
        "generatorCalls": len(steps),
        "archStyles": sorted({step["archProps"].get("arch_style") for step in steps}),
    })
    generated = {
        "recipe": steps,
        "labMassing": sorted(obj.name for obj in massing_objects) + ["LM_pediment"],
        "note": (
            "town_hall civico 20 x 12 m, 3 plantas, crujia 2 m. La extension aporta el portico "
            "arcado de 7 vanos, el portal monumental Tudor, las 9 cabeceras de arco segmental y "
            "las 2 columnas exentas. La masa, las impostas, la escalinata y el fronton son cubos "
            "de la primitiva del pipeline (lab_massing)."
        ),
    }
    lab.render_evidence(
        label="Arch Generator - town_hall civico 20x12 m con portico arcado y portal monumental",
        png_path=args.output,
        json_path=args.metadata,
        ortho_scale=args.ortho_scale,
        target_z=args.target_z,
        resolution=args.resolution,
        samples=args.samples,
        ground_plane=False,
        provenance=provenance,
        generated=generated,
    )


if __name__ == "__main__":
    main()

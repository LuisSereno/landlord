#!/usr/bin/env python3
"""Correcciones artísticas finales WP-CHAR-03 sobre el renderizador 02C."""

import importlib.util
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
GEOMETRY_CHANGES = {}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def delete_components(mesh, component_indices, components):
    selected = {polygon_index for index in component_indices for polygon_index in components[index]}
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    bm_faces = [bm.faces[index] for index in sorted(selected)]
    if bm_faces:
        bmesh.ops.delete(bm, geom=bm_faces, context="FACES")
        bm.to_mesh(mesh)
        mesh.update()
    bm.free()
    return sum(len(components[index]) for index in component_indices)


def apply_head_materials(head, candidate, compositor):
    head.data = head.data.copy()
    components = BASE.components_by_position(head.data)
    selected = sorted(set(candidate.get("headComponents", [])))
    if max([*selected, *candidate.get("headRemoveComponents", [])], default=-1) >= len(components):
        raise RuntimeError("Componente de cabeza fuera de rango")
    material = BASE.make_material(compositor, candidate["canonicalId"], "hair", candidate["palette"]["hair"])
    material_index = len(head.data.materials)
    head.data.materials.append(material)
    modified = []
    for component_index in selected:
        polygons = components[component_index]
        for polygon_index in polygons:
            head.data.polygons[polygon_index].material_index = material_index
        coordinates = [head.data.vertices[vertex].co for polygon_index in polygons for vertex in head.data.polygons[polygon_index].vertices]
        modified.append(
            {
                "component": component_index,
                "polygons": len(polygons),
                "localBounds": {
                    "min": [round(min(value[axis] for value in coordinates), 6) for axis in range(3)],
                    "max": [round(max(value[axis] for value in coordinates), 6) for axis in range(3)],
                },
            }
        )
    remove = sorted(set(candidate.get("headRemoveComponents", [])))
    mouth_component = candidate.get("mouthComponent")
    mouth_center = None
    if mouth_component is not None:
        mouth_polygons = components[mouth_component]
        mouth_vertices = sorted({vertex for polygon_index in mouth_polygons for vertex in head.data.polygons[polygon_index].vertices})
        mouth_center = sum((head.data.vertices[index].co for index in mouth_vertices), Vector()) / len(mouth_vertices)
        head["wp03_mouth_center_local"] = list(mouth_center)
        remove = sorted(set([*remove, mouth_component]))
    removed_polygons = delete_components(head.data, remove, components) if remove else 0
    changes = []
    if remove:
        changes.append(
            {
                "mesh": head.name,
                "operation": "delete_local_components",
                "components": remove,
                "polygons": removed_polygons,
                "sourceModified": False,
            }
        )
    if mouth_center is not None:
        changes.append(
            {
                "mesh": head.name,
                "operation": "replace_smile_with_neutral_mouth_line",
                "component": mouth_component,
                "sourceModified": False,
            }
        )
    GEOMETRY_CHANGES[candidate["canonicalId"]] = changes
    return {
        "modifiedComponents": modified,
        "polygonCount": sum(item["polygons"] for item in modified),
        "removedComponents": remove,
        "removedPolygonCount": removed_polygons,
        "material": material.name,
        "geometryChanges": changes,
    }


def attach(compositor, objects, armature, role, accessory_type, bone):
    for obj in objects:
        compositor.attach_to_bone(obj, armature, bone, f"wp03_{role}", accessory_type)


def add_supervisor_helmet(armature, head, compositor, created):
    top = BASE.prototype_head_top(armature, head)
    helmet = BASE.make_material(compositor, "supervisor", "helmet", "sand")
    band = BASE.make_material(compositor, "supervisor", "helmet_band", "charcoal")
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.43, radius2=0.36, depth=0.24, location=top + Vector((0, 0, -0.025)))
    crown = bpy.context.object
    crown.name = "wp03_supervisor_helmet_crown"
    compositor.finish_object(crown, crown.name, helmet, bevel=0.012)
    brim = compositor.make_cylinder("wp03_supervisor_helmet_brim", top + Vector((0, 0, -0.15)), 0.50, 0.05, helmet)
    visor = compositor.make_box("wp03_supervisor_helmet_visor", top + Vector((0, -0.36, -0.14)), (0.54, 0.24, 0.05), helmet, bevel=0.014)
    band_ring = compositor.make_torus("wp03_supervisor_helmet_band", top + Vector((0, 0, -0.135)), 0.405, 0.022, band, scale=(1.04, 0.92, 0.75))
    ridge = compositor.make_box("wp03_supervisor_helmet_ridge", top + Vector((0, 0, 0.105)), (0.055, 0.28, 0.035), helmet, bevel=0.008)
    objects = [crown, brim, visor, band_ring, ridge]
    attach(compositor, objects, armature, "supervisor", "supervisor_helmet_v2", "head")
    created.extend(objects)


def add_lowered_clipboard(armature, compositor, created):
    anchor = BASE.prototype_bone_point(armature, "arm-left", "tail") + Vector((0.035, -0.10, -0.24))
    leather = BASE.make_material(compositor, "supervisor", "clipboard", "leather")
    paper = BASE.make_material(compositor, "supervisor", "paper", "paper")
    metal = BASE.make_material(compositor, "supervisor", "clip", "metal")
    board = compositor.make_box("wp03_supervisor_clipboard_board", anchor, (0.22, 0.035, 0.30), leather, bevel=0.01)
    sheet = compositor.make_box("wp03_supervisor_clipboard_paper", anchor + Vector((0, -0.023, 0.01)), (0.18, 0.009, 0.245), paper, bevel=0.004)
    clip = compositor.make_box("wp03_supervisor_clipboard_clip", anchor + Vector((0, -0.03, 0.135)), (0.06, 0.018, 0.026), metal, bevel=0.004)
    objects = [board, sheet, clip]
    attach(compositor, objects, armature, "supervisor", "clipboard_lowered", "arm-left")
    created.extend(objects)


def add_serious_mouth(armature, head, compositor, created):
    local = head.get("wp03_mouth_center_local")
    if local is None:
        raise RuntimeError("Falta el anclaje local de la boca del enforcer")
    anchor = head.matrix_world @ Vector(local)
    mouth = BASE.make_material(compositor, "enforcer", "mouth", "black")
    line = compositor.make_box("wp03_enforcer_neutral_mouth", anchor, (0.09, 0.012, 0.014), mouth, bevel=0.003)
    attach(compositor, [line], armature, "enforcer", "serious_mouth", "head")
    created.append(line)


def add_fire_helmet_v2(armature, head, compositor, created):
    top = BASE.prototype_head_top(armature, head)
    helmet = BASE.make_material(compositor, "firefighter", "helmet", "fire_yellow")
    shield = BASE.make_material(compositor, "firefighter", "helmet_shield", "charcoal")
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.50, radius2=0.40, depth=0.25, location=top + Vector((0, 0, -0.02)))
    crown = bpy.context.object
    crown.name = "wp03_firefighter_helmet_crown"
    compositor.finish_object(crown, crown.name, helmet, bevel=0.015)
    brim = compositor.make_cylinder("wp03_firefighter_helmet_brim", top + Vector((0, 0, -0.18)), 0.56, 0.06, helmet)
    visor = compositor.make_box("wp03_firefighter_helmet_visor", top + Vector((0, -0.40, -0.17)), (0.58, 0.22, 0.05), helmet, bevel=0.016)
    rear = compositor.make_box(
        "wp03_firefighter_helmet_rear_flap",
        top + Vector((0, 0.36, -0.095)),
        (0.56, 0.065, 0.19),
        shield,
        rotation=(math.radians(-18), 0, 0),
        bevel=0.02,
    )
    front = compositor.make_box("wp03_firefighter_helmet_front_shield", top + Vector((0, -0.405, 0.015)), (0.22, 0.04, 0.16), shield, bevel=0.016)
    crest = compositor.make_box("wp03_firefighter_helmet_crest", top + Vector((0, 0, 0.125)), (0.06, 0.36, 0.05), helmet, bevel=0.01)
    objects = [crown, brim, visor, rear, front, crest]
    attach(compositor, objects, armature, "firefighter", "fire_helmet_v2", "head")
    created.extend(objects)


def build_accessories(armature, head, candidate, compositor):
    created = []
    for accessory in candidate["accessories"]:
        if accessory == "supervisor_helmet_v2":
            add_supervisor_helmet(armature, head, compositor, created)
        elif accessory == "clipboard_lowered":
            add_lowered_clipboard(armature, compositor, created)
        elif accessory == "belt":
            BASE.add_belt(armature, candidate["canonicalId"], compositor, created)
        elif accessory == "serious_mouth":
            add_serious_mouth(armature, head, compositor, created)
        elif accessory == "fire_helmet_v2":
            add_fire_helmet_v2(armature, head, compositor, created)
        else:
            raise RuntimeError(f"Accesorio no soportado: {accessory}")
    return created


def main():
    global BASE
    BASE = load_module("wp03_base_renderer", TOOL_DIR.parent / "wp_char_02c/render_profession_rework.py")
    BASE.apply_head_materials = apply_head_materials
    BASE.build_accessories = build_accessories
    BASE.main()
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]

    def value(name):
        return script_args[script_args.index(name) + 1]

    role = value("--role")
    output_root = Path(value("--output")).resolve()
    stage = "final" if "--final" in script_args else "smoke"
    report_path = output_root / role / stage / f"{role}-prototype.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["geometryChanges"] = GEOMETRY_CHANGES[report["canonicalId"]]
    report["artRevision"] = "wp_char_03_targeted_corrections"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

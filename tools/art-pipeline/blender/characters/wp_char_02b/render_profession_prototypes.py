#!/usr/bin/env python3
"""Produce los cuatro prototipos profesionales WP-CHAR-02B sobre Kenney."""

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"

PALETTE = {
    "ochre": "#B77932",
    "navy": "#263B53",
    "denim": "#39566E",
    "dark_brown": "#3B2A22",
    "pale_yellow": "#E6C86A",
    "charcoal": "#292D31",
    "coal": "#202428",
    "black": "#171A1D",
    "dark_blue": "#243446",
    "protective_charcoal": "#343A3D",
    "fire_yellow": "#E3B83F",
    "leather": "#4A3021",
    "paper": "#D8CFB5",
    "metal": "#7C858A",
    "badge_gold": "#D5AD4A",
    "helmet_white": "#E4DDC8",
}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color_linear(hex_color):
    value = hex_color.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4)]
    return tuple(srgb_to_linear(channel) for channel in channels)


def make_role_material(compositor, name, palette_key):
    return compositor.make_material(
        f"wp02b_{name}",
        (*color_linear(PALETTE[palette_key]), 1.0),
        metallic=0.0,
        roughness=0.9,
    )


def dominant_group(poly, obj, target_groups):
    sums = {name: 0.0 for name in target_groups}
    for vertex_index in poly.vertices:
        for item in obj.data.vertices[vertex_index].groups:
            name = obj.vertex_groups[item.group].name
            if name in sums:
                sums[name] += item.weight
    if not sums or max(sums.values()) <= 0:
        return None
    return max(sums, key=sums.get)


def apply_region_materials(body, candidate, compositor):
    palette = candidate["palette"]
    role = candidate["canonicalId"]
    materials = {
        "torso": make_role_material(compositor, f"{role}_torso", palette["torso"]),
        "arms": make_role_material(compositor, f"{role}_arms", palette["arms"]),
        "legs": make_role_material(compositor, f"{role}_legs", palette["legs"]),
        "boots": make_role_material(compositor, f"{role}_boots", palette["boots"]),
    }
    if palette.get("reflective"):
        materials["reflective"] = make_role_material(compositor, f"{role}_reflective", palette["reflective"])
    if palette.get("gloves"):
        materials["gloves"] = make_role_material(compositor, f"{role}_gloves", palette["gloves"])
    original = body.material_slots[0].material
    body.material_slots[0].link = "DATA"
    body.data.materials.clear()
    body.data.materials.append(original)
    indices = {"original": 0}
    for key, material in materials.items():
        body.data.materials.append(material)
        indices[key] = len(body.data.materials) - 1
    target_groups = ("torso", "arm-left", "arm-right", "leg-left", "leg-right")
    group_values = {name: [] for name in target_groups}
    for poly in body.data.polygons:
        group = dominant_group(poly, body, target_groups)
        if group:
            group_values[group].append(float(poly.center.z))
    ranges = {
        name: (min(values), max(values))
        for name, values in group_values.items()
        if values
    }
    body_min = min(v.co.z for v in body.data.vertices)
    body_max = max(v.co.z for v in body.data.vertices)
    body_span = max(body_max - body_min, 1e-6)
    counts = {key: 0 for key in indices}
    for poly in body.data.polygons:
        group = dominant_group(poly, body, target_groups)
        z = float(poly.center.z)
        material_key = "original"
        if group in ("leg-left", "leg-right"):
            group_min, group_max = ranges[group]
            ratio = (z - group_min) / max(group_max - group_min, 1e-6)
            material_key = "boots" if ratio < 0.18 else "legs"
        elif group in ("arm-left", "arm-right"):
            group_min, group_max = ranges[group]
            ratio = (z - group_min) / max(group_max - group_min, 1e-6)
            if role == "firefighter" and ratio < 0.18:
                material_key = "gloves"
            elif role == "firefighter" and 0.64 <= ratio <= 0.78:
                material_key = "reflective"
            elif ratio < 0.16:
                material_key = "original"
            else:
                material_key = "arms"
        elif group == "torso":
            group_min, group_max = ranges[group]
            ratio = (z - group_min) / max(group_max - group_min, 1e-6)
            if role == "firefighter" and (0.42 <= ratio <= 0.55 or 0.80 <= ratio <= 0.91):
                material_key = "reflective"
            elif role == "supervisor" and 0.58 <= ratio <= 0.70:
                material_key = "reflective"
            else:
                material_key = "torso"
        poly.material_index = indices[material_key]
        counts[material_key] += 1
    return {
        "method": "Assign solid materials to polygons of the existing skinned body mesh by dominant vertex group and local height bands.",
        "bodyMinZ": round(body_min, 6),
        "bodyMaxZ": round(body_max, 6),
        "bodySpan": round(body_span, 6),
        "groupRanges": {name: [round(value, 6) for value in bounds] for name, bounds in ranges.items()},
        "polygonCounts": counts,
        "materials": {key: material.name for key, material in materials.items()},
    }


def bone_point(armature, bone_name, endpoint="tail"):
    pose_bone = armature.pose.bones[bone_name]
    local = pose_bone.head if endpoint == "head" else pose_bone.tail
    return armature.matrix_world @ local


def head_top(armature, head_mesh):
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = head_mesh.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        points = [head_mesh.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()
    top = max(point.z for point in points)
    crown = [point for point in points if point.z >= top - 0.025]
    center = sum(crown, Vector()) / len(crown)
    return Vector((center.x, center.y, top))


def add_hard_hat(armature, head_mesh, compositor, created, role):
    top = head_top(armature, head_mesh)
    material = make_role_material(compositor, f"{role}_helmet", "helmet_white" if role == "supervisor" else "ochre")
    objects = [
        compositor.make_sphere(f"wp02b_{role}_helmet_dome", top + Vector((0, 0, -0.045)), (0.27, 0.24, 0.15), material),
        compositor.make_cylinder(f"wp02b_{role}_helmet_brim", top + Vector((0, 0, -0.12)), 0.32, 0.035, material),
        compositor.make_box(f"wp02b_{role}_helmet_ridge", top + Vector((0, 0, 0.095)), (0.035, 0.30, 0.035), material, bevel=0.006),
    ]
    for obj in objects:
        compositor.attach_to_bone(obj, armature, "head", f"wp02b_{role}", "hard_hat")
    created.extend(objects)


def add_flat_cap(armature, head_mesh, compositor, created, role):
    top = head_top(armature, head_mesh)
    material = make_role_material(compositor, f"{role}_cap", "charcoal")
    crown = compositor.make_sphere(f"wp02b_{role}_cap_crown", top + Vector((0, 0, -0.02)), (0.25, 0.23, 0.08), material)
    brim = compositor.make_box(f"wp02b_{role}_cap_brim", top + Vector((0, -0.20, -0.055)), (0.30, 0.16, 0.025), material, bevel=0.01)
    for obj in (crown, brim):
        compositor.attach_to_bone(obj, armature, "head", f"wp02b_{role}", "flat_cap")
    created.extend((crown, brim))


def add_fire_helmet(armature, head_mesh, compositor, created, role):
    top = head_top(armature, head_mesh)
    helmet = make_role_material(compositor, f"{role}_helmet", "fire_yellow")
    shield = make_role_material(compositor, f"{role}_helmet_shield", "charcoal")
    objects = [
        compositor.make_sphere(f"wp02b_{role}_helmet_dome", top + Vector((0, 0, -0.015)), (0.29, 0.27, 0.18), helmet),
        compositor.make_cylinder(f"wp02b_{role}_helmet_brim", top + Vector((0, 0, -0.14)), 0.36, 0.045, helmet),
        compositor.make_box(f"wp02b_{role}_helmet_rear_shield", top + Vector((0, 0.23, -0.08)), (0.34, 0.045, 0.20), shield, bevel=0.015),
        compositor.make_box(f"wp02b_{role}_helmet_front_shield", top + Vector((0, -0.255, 0.015)), (0.20, 0.035, 0.16), shield, bevel=0.015),
        compositor.make_box(f"wp02b_{role}_helmet_crest", top + Vector((0, 0, 0.16)), (0.055, 0.34, 0.045), helmet, bevel=0.008),
    ]
    for obj in objects:
        compositor.attach_to_bone(obj, armature, "head", f"wp02b_{role}", "fire_helmet")
    created.extend(objects)


def add_belt(armature, compositor, created, role):
    anchor = bone_point(armature, "torso", "tail") + Vector((0, 0, 0.015))
    leather = make_role_material(compositor, f"{role}_belt", "leather")
    belt = compositor.make_torus(
        f"wp02b_{role}_belt",
        anchor,
        0.29,
        0.035,
        leather,
        scale=(1.12, 0.78, 0.75),
    )
    buckle = compositor.make_box(
        f"wp02b_{role}_belt_buckle",
        anchor + Vector((0, -0.235, 0)),
        (0.075, 0.025, 0.055),
        make_role_material(compositor, f"{role}_buckle", "metal"),
        bevel=0.006,
    )
    for obj in (belt, buckle):
        compositor.attach_to_bone(obj, armature, "torso", f"wp02b_{role}", "belt")
    created.extend((belt, buckle))


def add_badge(armature, compositor, created, role):
    anchor = bone_point(armature, "torso", "tail") + Vector((0.14, -0.225, 0.20))
    material = make_role_material(compositor, f"{role}_badge", "badge_gold")
    badge = compositor.make_cylinder(
        f"wp02b_{role}_badge",
        anchor,
        0.045,
        0.018,
        material,
        bevel=0.003,
    )
    badge.rotation_euler = (math.pi / 2, 0, 0)
    compositor.attach_to_bone(badge, armature, "torso", f"wp02b_{role}", "badge")
    created.append(badge)


def add_clipboard(armature, compositor, created, role):
    anchor = bone_point(armature, "arm-left", "tail") + Vector((0.02, -0.10, 0.04))
    leather = make_role_material(compositor, f"{role}_clipboard", "leather")
    paper = make_role_material(compositor, f"{role}_paper", "paper")
    metal = make_role_material(compositor, f"{role}_clip", "metal")
    board = compositor.make_box(f"wp02b_{role}_clipboard_board", anchor, (0.20, 0.028, 0.29), leather, bevel=0.01)
    sheet = compositor.make_box(f"wp02b_{role}_clipboard_paper", anchor + Vector((0, -0.02, 0.01)), (0.16, 0.008, 0.23), paper, bevel=0.004)
    clip = compositor.make_box(f"wp02b_{role}_clipboard_clip", anchor + Vector((0, -0.025, 0.135)), (0.06, 0.018, 0.025), metal, bevel=0.004)
    for obj in (board, sheet, clip):
        compositor.attach_to_bone(obj, armature, "arm-left", f"wp02b_{role}", "clipboard")
    created.extend((board, sheet, clip))


def build_accessories(armature, head_mesh, candidate, compositor):
    created = []
    for accessory in candidate["accessories"]:
        role = candidate["canonicalId"]
        if accessory == "distinct_hard_hat":
            add_hard_hat(armature, head_mesh, compositor, created, role)
        elif accessory == "flat_cap":
            add_flat_cap(armature, head_mesh, compositor, created, role)
        elif accessory == "fire_helmet":
            add_fire_helmet(armature, head_mesh, compositor, created, role)
        elif accessory == "belt":
            add_belt(armature, compositor, created, role)
        elif accessory == "badge":
            add_badge(armature, compositor, created, role)
        elif accessory == "clipboard":
            add_clipboard(armature, compositor, created, role)
        else:
            raise RuntimeError(f"Accesorio no soportado: {accessory}")
    return created


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--role", choices=("supervisor", "enforcer", "police", "firefighter"))
    parser.add_argument("--final", action="store_true")
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(script_args)
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_root = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    prototype_config = config["professionPrototypes"]
    common = load_module("wp02b_proto_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp02b_proto_worker", WP02A_TOOLS / "render_worker_reference.py")
    compositor = load_module("wp02b_proto_compositor", REPO_ROOT / "tools/art-pipeline/blender/characters/character_compositor.py")
    runtime_asset = load_module("wp02b_proto_runtime", runtime_path)
    source_import = load_module("wp02b_proto_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    roles = [args.role] if args.role else list(prototype_config["candidates"])
    summary = []
    for role in roles:
        candidate = prototype_config["candidates"][role]
        output_dir = output_root / role / ("final" if args.final else "smoke")
        if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
            raise RuntimeError(f"La salida no contiene archivos previos: {output_dir}")
        output_dir.mkdir(parents=True, exist_ok=True)
        source_path = source_root / candidate["sourcePath"]
        if common.sha256(source_path) != candidate["sourceSha256"]:
            raise RuntimeError(f"Hash incorrecto de {role}: {source_path}")
        common.clear_scene()
        imported = source_import.import_source(source_path)
        source_import.assert_textures_resolved(imported, source_path)
        armature = next(obj for obj in imported if obj.type == "ARMATURE")
        objects = worker.character_objects(armature)
        worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
        source_mins, source_maxs = source_import.world_bounds(objects)
        unit_scale = 1.8 / float(source_maxs.z - source_mins.z)
        normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
        material_report = worker.local_material_treatment(objects, "source")
        body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
        head_mesh = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
        region_report = apply_region_materials(body, candidate, compositor)
        idle_action = bpy.data.actions.get("idle")
        walk_action = bpy.data.actions.get("walk")
        if idle_action is None or walk_action is None:
            raise RuntimeError(f"Acciones idle/walk ausentes en {role}")
        worker.bind_action(armature, idle_action)
        accessories = build_accessories(armature, head_mesh, candidate, compositor)
        objects.extend(accessories)
        drift = compositor.validate_anchor_drift(bpy.context.scene, armature, accessories)
        camera_config = prototype_config.get("camera", config["camera"])
        runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = config["render"]["width"]
        scene.render.resolution_y = config["render"]["height"]
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.color_depth = "8"
        scene.render.image_settings.compression = 15
        scene.render.film_transparent = True
        runtime_asset.apply_render_settings(scene, style_layer)
        report = {
            "schemaVersion": 1,
            "status": "smoke_rendered" if not args.final else "limited_prototype_rendered",
            "role": role,
            "canonicalId": candidate["canonicalId"],
            "manifest": str(manifest_path.relative_to(REPO_ROOT)),
            "manifestSha256": common.sha256(manifest_path),
            "blender": bpy.app.version_string,
            "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
            "source": {"path": str(source_path), "sha256": common.sha256(source_path), "license": "CC0-1.0"},
            "normalization": normalization,
            "unitScale": round(unit_scale, 8),
            "materialTreatment": material_report,
            "regionMaterials": region_report,
            "accessories": [
                {
                    "name": obj.name,
                    "type": obj.get("wp_character_accessory"),
                    "bone": obj.get("wp_character_bone"),
                    "constraint": [constraint.type for constraint in obj.constraints],
                }
                for obj in accessories
            ],
            "maxAnchorDrift": drift,
            "rig": {"armature": armature.name, "bones": len(armature.data.bones)},
            "camera": camera_config,
            "render": config["render"],
            "outputs": [],
        }
        if args.final:
            directions = list(range(prototype_config["directions"]))
        else:
            directions = [0]
        for direction in directions:
            camera, _ = runtime_asset.place_camera(
                camera_config["targetZ"],
                camera_config["orthoScale"],
                name=f"WP02B_{role.upper()}_CAM_D{direction}",
                azimuth_degrees=camera_config["azimuthBaseDegrees"] + direction * camera_config["azimuthStepDegrees"],
            )
            worker.bind_action(armature, idle_action)
            path = output_dir / f"{role}-d{direction}-idle-00.png"
            sample = worker.render_frame(
                objects,
                armature,
                scene,
                camera,
                int(round(idle_action.frame_range[0])),
                direction,
                "idle",
                0,
                path,
                common,
                source_import,
                {**config, "materialMode": "source", "walkSamples": prototype_config["walkSamples"]},
            )
            sample["actionReport"] = common.action_report(idle_action)
            report["outputs"].append(sample)
            if direction == 0:
                worker.bind_action(armature, walk_action)
                frames, _, _ = common.useful_frames(walk_action, prototype_config["walkSamples"])
                walk_indices = range(prototype_config["walkSamples"]) if args.final else [prototype_config["walkSamples"] // 2]
                for index in walk_indices:
                    path = output_dir / f"{role}-d{direction}-walk-{index:02d}.png"
                    sample = worker.render_frame(
                        objects,
                        armature,
                        scene,
                        camera,
                        frames[index],
                        direction,
                        "walk",
                        index,
                        path,
                        common,
                        source_import,
                        {**config, "materialMode": "source", "walkSamples": prototype_config["walkSamples"]},
                    )
                    sample["actionReport"] = common.action_report(walk_action)
                    report["outputs"].append(sample)
        report_path = output_dir / f"{role}-prototype.json"
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        summary.append({"role": role, "frames": len(report["outputs"]), "report": str(report_path.relative_to(REPO_ROOT))})
    print(json.dumps({"status": "final" if args.final else "smoke", "roles": summary}, ensure_ascii=False))
    print("WP_CHAR_02B_PROTOTYPES_OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Renderiza el rework visual WP-CHAR-02C sobre Kenney, sin promoción runtime."""

import argparse
import hashlib
import importlib.util
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"
WP02B_TOOLS = TOOL_DIR.parent / "wp_char_02b"
PALETTE = {
    "ochre": "#A9682C",
    "navy": "#2F465B",
    "denim": "#38546B",
    "dark_brown": "#3B2A22",
    "pale_yellow": "#E6C86A",
    "charcoal": "#292D31",
    "coal": "#202428",
    "black": "#171A1D",
    "slate": "#465463",
    "muted_blue": "#5E7180",
    "protective_charcoal": "#343A3D",
    "fire_yellow": "#E3B83F",
    "leather": "#4A3021",
    "paper": "#D8CFB5",
    "metal": "#7C858A",
    "sand": "#C8A56A",
}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color_linear(hex_color):
    value = hex_color.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4)]
    return tuple(srgb_to_linear(channel) for channel in channels)


def make_material(compositor, role, name, palette_key):
    return compositor.make_material(
        f"wp02c_{role}_{name}",
        (*color_linear(PALETTE[palette_key]), 1.0),
        metallic=0.0,
        roughness=0.9,
    )


def vector_list(vector):
    return [round(float(value), 6) for value in vector]


def components_by_position(mesh):
    parent = list(range(len(mesh.vertices)))
    owners = {}

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(first, second):
        first_root, second_root = find(first), find(second)
        if first_root != second_root:
            parent[second_root] = first_root

    for index, vertex in enumerate(mesh.vertices):
        key = tuple(round(float(axis), 6) for axis in vertex.co)
        if key in owners:
            union(index, owners[key])
        else:
            owners[key] = index
    for polygon in mesh.polygons:
        first = polygon.vertices[0]
        for vertex in polygon.vertices[1:]:
            union(first, vertex)
    grouped = defaultdict(list)
    for polygon in mesh.polygons:
        grouped[find(polygon.vertices[0])].append(polygon.index)
    return sorted(grouped.values(), key=lambda indices: (-len(indices), indices[0]))


def apply_head_materials(head, candidate, compositor):
    selected = sorted(set(candidate.get("headComponents", [])))
    if not selected:
        return {"modifiedComponents": [], "polygonCount": 0, "material": None}
    components = components_by_position(head.data)
    if max(selected) >= len(components):
        raise RuntimeError(f"Componente de cabeza fuera de rango para {candidate['canonicalId']}: {selected}")
    material = make_material(compositor, candidate["canonicalId"], "hair", candidate["palette"]["hair"])
    index = len(head.data.materials)
    head.data.materials.append(material)
    polygon_count = 0
    modified = []
    for component_index in selected:
        polygons = components[component_index]
        for polygon_index in polygons:
            head.data.polygons[polygon_index].material_index = index
        polygon_count += len(polygons)
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
    return {"modifiedComponents": modified, "polygonCount": polygon_count, "material": material.name}


def in_bands(value, bands):
    return any(lower <= value <= upper for lower, upper in bands)


def apply_body_materials(body, candidate, compositor, prototype):
    palette = candidate["palette"]
    role = candidate["canonicalId"]
    keys = ("torso", "arms", "legs", "boots")
    for optional in ("reflective", "gloves", "shirt"):
        if optional in palette:
            keys += (optional,)
    materials = {key: make_material(compositor, role, key, palette[key]) for key in keys}
    original = body.material_slots[0].material
    body.material_slots[0].link = "DATA"
    body.data.materials.clear()
    body.data.materials.append(original)
    indices = {"original": 0}
    for key, material in materials.items():
        body.data.materials.append(material)
        indices[key] = len(body.data.materials) - 1
    groups = ("torso", "arm-left", "arm-right", "leg-left", "leg-right")
    ranges = {}
    for group in groups:
        values = [float(polygon.center.z) for polygon in body.data.polygons if prototype.dominant_group(polygon, body, groups) == group]
        if values:
            ranges[group] = (min(values), max(values))
    counts = {key: 0 for key in indices}
    bands = candidate["bodyBands"]
    for polygon in body.data.polygons:
        group = prototype.dominant_group(polygon, body, groups)
        z = float(polygon.center.z)
        material_key = "original"
        if group in ranges:
            minimum, maximum = ranges[group]
            ratio = (z - minimum) / max(maximum - minimum, 1e-6)
            if group in ("leg-left", "leg-right"):
                material_key = "boots" if ratio < bands["bootRatio"] else "legs"
            elif group in ("arm-left", "arm-right"):
                if role == "firefighter" and in_bands(ratio, [bands["armReflective"]]):
                    material_key = "reflective"
                elif ratio < bands["armHands"][1]:
                    material_key = "gloves" if role == "firefighter" else "original"
                else:
                    material_key = "arms"
            elif group == "torso":
                if role == "firefighter" and in_bands(ratio, bands["torsoReflective"]):
                    material_key = "reflective"
                elif role == "supervisor" and in_bands(ratio, bands["torsoReflective"]):
                    material_key = "reflective"
                elif role == "enforcer" and in_bands(ratio, [bands["torsoShirt"]]):
                    material_key = "shirt"
                else:
                    material_key = "torso"
        polygon.material_index = indices[material_key]
        counts[material_key] += 1
    return {
        "method": "Solid local materials assigned to existing skinned body polygons by dominant vertex group and height bands.",
        "groupRanges": {name: [round(value, 6) for value in bounds] for name, bounds in ranges.items()},
        "polygonCounts": counts,
        "materials": {key: material.name for key, material in materials.items()},
    }


def attach(compositor, objects, armature, role, accessory_type, bone):
    for obj in objects:
        compositor.attach_to_bone(obj, armature, bone, f"wp02c_{role}", accessory_type)


def add_supervisor_helmet(armature, head, candidate, compositor, created):
    top = prototype_head_top(armature, head)
    helmet = make_material(compositor, "supervisor", "helmet", "sand")
    band = make_material(compositor, "supervisor", "helmet_band", "charcoal")
    dome = compositor.make_sphere("wp02c_supervisor_helmet_dome", top + Vector((0, 0, -0.055)), (0.46, 0.42, 0.23), helmet)
    brim = compositor.make_cylinder("wp02c_supervisor_helmet_brim", top + Vector((0, 0, -0.17)), 0.53, 0.055, helmet)
    visor = compositor.make_box("wp02c_supervisor_helmet_visor", top + Vector((0, -0.39, -0.16)), (0.62, 0.28, 0.055), helmet, bevel=0.015)
    band_ring = compositor.make_torus("wp02c_supervisor_helmet_band", top + Vector((0, 0, -0.145)), 0.415, 0.025, band, scale=(1.05, 0.92, 0.75))
    objects = [dome, brim, visor, band_ring]
    attach(compositor, objects, armature, "supervisor", "supervisor_helmet", "head")
    created.extend(objects)


def add_clipboard(armature, candidate, compositor, created):
    anchor = prototype_bone_point(armature, "arm-left", "tail") + Vector((0.04, -0.11, 0.025))
    leather = make_material(compositor, "supervisor", "clipboard", "leather")
    paper = make_material(compositor, "supervisor", "paper", "paper")
    metal = make_material(compositor, "supervisor", "clip", "metal")
    board = compositor.make_box("wp02c_supervisor_clipboard_board", anchor, (0.25, 0.035, 0.35), leather, bevel=0.012)
    sheet = compositor.make_box("wp02c_supervisor_clipboard_paper", anchor + Vector((0, -0.023, 0.012)), (0.205, 0.009, 0.285), paper, bevel=0.005)
    clip = compositor.make_box("wp02c_supervisor_clipboard_clip", anchor + Vector((0, -0.03, 0.158)), (0.07, 0.018, 0.028), metal, bevel=0.005)
    objects = [board, sheet, clip]
    attach(compositor, objects, armature, "supervisor", "clipboard_large", "arm-left")
    created.extend(objects)


def add_enforcer_cap(armature, head, candidate, compositor, created):
    top = prototype_head_top(armature, head)
    cap = make_material(compositor, "enforcer", "cap", "charcoal")
    crown = compositor.make_sphere("wp02c_enforcer_cap_crown", top + Vector((0, 0, -0.055)), (0.43, 0.39, 0.18), cap)
    brim = compositor.make_box("wp02c_enforcer_cap_brim", top + Vector((0, -0.34, -0.12)), (0.52, 0.26, 0.05), cap, bevel=0.018)
    objects = [crown, brim]
    attach(compositor, objects, armature, "enforcer", "enforcer_cap", "head")
    created.extend(objects)


def add_belt(armature, role, compositor, created):
    anchor = prototype_bone_point(armature, "torso", "tail") + Vector((0, 0, 0.015))
    leather = make_material(compositor, role, "belt", "leather")
    metal = make_material(compositor, role, "buckle", "metal")
    belt = compositor.make_torus(f"wp02c_{role}_belt", anchor, 0.29, 0.035, leather, scale=(1.12, 0.78, 0.75))
    buckle = compositor.make_box(f"wp02c_{role}_belt_buckle", anchor + Vector((0, -0.235, 0)), (0.075, 0.025, 0.055), metal, bevel=0.006)
    objects = [belt, buckle]
    attach(compositor, objects, armature, role, "belt", "torso")
    created.extend(objects)


def add_fire_helmet(armature, head, candidate, compositor, created):
    top = prototype_head_top(armature, head)
    helmet = make_material(compositor, "firefighter", "helmet", "fire_yellow")
    shield = make_material(compositor, "firefighter", "helmet_shield", "charcoal")
    dome = compositor.make_sphere("wp02c_firefighter_helmet_dome", top + Vector((0, 0, -0.10)), (0.52, 0.47, 0.27), helmet)
    brim = compositor.make_cylinder("wp02c_firefighter_helmet_brim", top + Vector((0, 0, -0.22)), 0.58, 0.06, helmet)
    visor = compositor.make_box("wp02c_firefighter_helmet_visor", top + Vector((0, -0.46, -0.205)), (0.66, 0.25, 0.06), helmet, bevel=0.018)
    rear = compositor.make_box("wp02c_firefighter_helmet_rear_shield", top + Vector((0, 0.39, -0.11)), (0.62, 0.07, 0.30), shield, bevel=0.025)
    front = compositor.make_box("wp02c_firefighter_helmet_front_shield", top + Vector((0, -0.455, 0.005)), (0.25, 0.045, 0.20), shield, bevel=0.02)
    crest = compositor.make_box("wp02c_firefighter_helmet_crest", top + Vector((0, 0, 0.155)), (0.07, 0.42, 0.06), helmet, bevel=0.012)
    objects = [dome, brim, visor, rear, front, crest]
    attach(compositor, objects, armature, "firefighter", "fire_helmet", "head")
    created.extend(objects)


def build_accessories(armature, head, candidate, compositor):
    created = []
    for accessory in candidate["accessories"]:
        if accessory == "supervisor_helmet":
            add_supervisor_helmet(armature, head, candidate, compositor, created)
        elif accessory == "clipboard_large":
            add_clipboard(armature, candidate, compositor, created)
        elif accessory == "enforcer_cap":
            add_enforcer_cap(armature, head, candidate, compositor, created)
        elif accessory == "belt":
            add_belt(armature, candidate["canonicalId"], compositor, created)
        elif accessory == "fire_helmet":
            add_fire_helmet(armature, head, candidate, compositor, created)
        else:
            raise RuntimeError(f"Accesorio no soportado: {accessory}")
    return created


def packed_atlas_hashes(objects):
    result = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if not material or not material.node_tree:
                continue
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and node.image.packed_file:
                    result[f"{obj.name}/{material.name}/{node.image.name}"] = sha256_bytes(node.image.packed_file.data)
    return result


def measure_accessory_drift(armature, accessories, frames):
    first_frame = frames[0]
    bpy.context.scene.frame_set(first_frame)
    bpy.context.view_layer.update()

    def relative():
        bpy.context.view_layer.update()
        return {
            obj.name: (armature.matrix_world @ armature.pose.bones[obj["wp_character_bone"]].matrix).inverted() @ obj.matrix_world
            for obj in accessories
        }

    first = relative()
    maximum = 0.0
    try:
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            current = relative()
            for name in first:
                for row in range(4):
                    for column in range(4):
                        maximum = max(maximum, abs(first[name][row][column] - current[name][row][column]))
    finally:
        bpy.context.scene.frame_set(first_frame)
        bpy.context.view_layer.update()
    if maximum > 1e-4:
        raise RuntimeError(f"Deriva de accesorio fuera de tolerancia: {maximum}")
    return maximum


def configure_render(runtime_asset, style_layer, config):
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


def prototype_head_top(armature, head):
    return PROTOTYPE.head_top(armature, head)


def prototype_bone_point(armature, bone, endpoint):
    return PROTOTYPE.bone_point(armature, bone, endpoint)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--role", required=True, choices=("supervisor", "enforcer", "firefighter"))
    parser.add_argument("--final", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_root = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    candidate = config["candidates"][args.role]
    output_dir = output_root / args.role / ("final" if args.final else "smoke")
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida no está vacía: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    global PROTOTYPE
    common = load_module("wp02c_rework_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp02c_rework_worker", WP02A_TOOLS / "render_worker_reference.py")
    PROTOTYPE = load_module("wp02c_rework_prototype", WP02B_TOOLS / "render_profession_prototypes.py")
    compositor = load_module("wp02c_rework_compositor", REPO_ROOT / "tools/art-pipeline/blender/characters/character_compositor.py")
    runtime_asset = load_module("wp02c_rework_runtime", runtime_path)
    source_import = load_module("wp02c_rework_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    source_path = source_root / candidate["sourcePath"]
    license_path = source_root / config["sourcePolicy"]["licenseFile"]
    if common.sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError(f"Hash incorrecto de fuente: {args.role}")
    if common.sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("Hash incorrecto de licencia Kenney")
    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    expected_bones = {"root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"}
    if {bone.name for bone in armature.data.bones} != expected_bones:
        raise RuntimeError(f"Rig Kenney inesperado: {[bone.name for bone in armature.data.bones]}")
    if len(bpy.data.actions) != 32:
        raise RuntimeError(f"Se esperaban 32 acciones Kenney, hay {len(bpy.data.actions)}")
    objects = worker.character_objects(armature)
    worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    source_mins, source_maxs = source_import.world_bounds(objects)
    unit_scale = 1.8 / float(source_maxs.z - source_mins.z)
    normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
    atlas_before = packed_atlas_hashes(objects)
    material_treatment = worker.local_material_treatment(objects, "source")
    body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
    head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
    body_report = apply_body_materials(body, candidate, compositor, PROTOTYPE)
    head_report = apply_head_materials(head, candidate, compositor)
    idle_action = bpy.data.actions.get("idle")
    walk_action = bpy.data.actions.get("walk")
    if idle_action is None or walk_action is None:
        raise RuntimeError("Faltan idle/walk")
    worker.bind_action(armature, idle_action)
    accessories = build_accessories(armature, head, candidate, compositor)
    objects.extend(accessories)
    bpy.context.view_layer.update()
    head_mins, head_maxs = source_import.world_bounds([head])
    head_size = head_maxs - head_mins
    accessory_report = []
    for obj in accessories:
        mins, maxs = source_import.world_bounds([obj])
        size = maxs - mins
        accessory_report.append(
            {
                "name": obj.name,
                "type": obj.get("wp_character_accessory"),
                "bone": obj.get("wp_character_bone"),
                "constraints": [constraint.type for constraint in obj.constraints],
                "dimensionsMeters": vector_list(size),
                "boundsMeters": {"min": vector_list(mins), "max": vector_list(maxs)},
                "widthToHeadRatio": round(float(size.x / head_size.x), 6),
            }
        )
    walk_frames, _, _ = common.useful_frames(walk_action, config["matrix"]["walkSamples"])
    drift_frames = [int(round(idle_action.frame_range[0])), *walk_frames]
    max_drift = measure_accessory_drift(armature, accessories, drift_frames)
    configure_render(runtime_asset, style_layer, config)
    report = {
        "schemaVersion": 1,
        "status": "smoke_rendered_pending_visual_review" if not args.final else "limited_prototype_rendered_pending_validation",
        "role": args.role,
        "canonicalId": candidate["canonicalId"],
        "worktree": str(REPO_ROOT),
        "branch": "wip/wp-char-02c-visual-rework",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": common.sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "source": {"path": str(source_path), "sha256": common.sha256(source_path), "license": "CC0-1.0"},
        "license": {"path": str(license_path), "sha256": common.sha256(license_path)},
        "baseDecision": candidate["baseDecision"],
        "normalization": normalization,
        "unitScale": round(unit_scale, 8),
        "materialTreatment": material_treatment,
        "bodyMaterials": body_report,
        "headMaterials": head_report,
        "geometryChanges": [],
        "accessories": accessory_report,
        "anchors": sorted({obj["wp_character_bone"] for obj in accessories}),
        "maxAccessoryDrift": max_drift,
        "rig": {"armature": armature.name, "bones": len(armature.data.bones), "boneNames": [bone.name for bone in armature.data.bones], "actions": len(bpy.data.actions)},
        "animations": {"idle": common.action_report(idle_action), "walk": common.action_report(walk_action), "walkFrames": walk_frames},
        "camera": config["camera"],
        "render": config["render"],
        "headDimensionsMeters": vector_list(head_size),
        "atlasHashesBefore": atlas_before,
        "atlasHashesAfter": packed_atlas_hashes(objects),
        "runtimePromotion": False,
        "approval": "pending_human",
        "defectsPending": ["human_visual_review"],
        "outputs": [],
    }
    if sorted(report["atlasHashesBefore"].values()) != sorted(report["atlasHashesAfter"].values()):
        raise RuntimeError("Un atlas empaquetado cambió durante el rework")
    directions = list(range(config["matrix"]["directions"])) if args.final else [0]
    for direction in directions:
        camera, _ = runtime_asset.place_camera(
            config["camera"]["targetZ"],
            config["camera"]["orthoScale"],
            name=f"WP02C_{args.role.upper()}_D{direction}",
            azimuth_degrees=config["camera"]["azimuthBaseDegrees"] + direction * config["camera"]["azimuthStepDegrees"],
        )
        worker.bind_action(armature, idle_action)
        path = output_dir / f"{args.role}-d{direction}-idle-00.png"
        sample = worker.render_frame(
            objects, armature, bpy.context.scene, camera, int(round(idle_action.frame_range[0])), direction, "idle", 0, path,
            common, source_import, {**config, "materialMode": "source", "walkSamples": config["matrix"]["walkSamples"]},
        )
        sample["actionReport"] = common.action_report(idle_action)
        report["outputs"].append(sample)
        if direction == 0:
            worker.bind_action(armature, walk_action)
            indices = range(config["matrix"]["walkSamples"]) if args.final else [config["matrix"]["walkSamples"] // 2]
            for index in indices:
                path = output_dir / f"{args.role}-d{direction}-walk-{index:02d}.png"
                sample = worker.render_frame(
                    objects, armature, bpy.context.scene, camera, walk_frames[index], direction, "walk", index, path,
                    common, source_import, {**config, "materialMode": "source", "walkSamples": config["matrix"]["walkSamples"]},
                )
                sample["actionReport"] = common.action_report(walk_action)
                report["outputs"].append(sample)
    if common.sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError("El GLB fuente cambió durante la ejecución")
    report_path = output_dir / f"{args.role}-prototype.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "final" if args.final else "smoke", "role": args.role, "frames": len(report["outputs"]), "report": str(report_path)}, ensure_ascii=False))
    print("WP_CHAR_02C_REWORK_OK")


if __name__ == "__main__":
    main()

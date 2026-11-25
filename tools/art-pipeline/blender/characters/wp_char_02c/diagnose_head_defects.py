#!/usr/bin/env python3
"""Diagnóstico A/B/C de los defectos de cabeza de WP-CHAR-02C."""

import argparse
import importlib.util
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"
WP02B_TOOLS = TOOL_DIR.parent / "wp_char_02b"
ROLES = ("supervisor", "enforcer", "firefighter")
DIAGNOSTIC_COLORS = (
    (0.95, 0.12, 0.08, 1.0),
    (0.08, 0.75, 0.22, 1.0),
    (0.08, 0.28, 0.95, 1.0),
    (0.95, 0.78, 0.08, 1.0),
    (0.75, 0.10, 0.70, 1.0),
    (0.05, 0.78, 0.82, 1.0),
    (0.95, 0.35, 0.08, 1.0),
    (0.38, 0.22, 0.75, 1.0),
)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def linear_to_srgb(value):
    value = min(1.0, max(0.0, float(value)))
    return 12.92 * value if value <= 0.0031308 else 1.055 * value ** (1.0 / 2.4) - 0.055


def color_srgb(color):
    return [round(linear_to_srgb(channel) * 255.0, 2) for channel in color[:3]]


def image_for_material(material):
    if not material or not material.use_nodes:
        return None
    principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        return None
    socket = principled.inputs.get("Base Color")
    if socket is None:
        return None
    for link in material.node_tree.links:
        if link.to_socket == socket and link.from_node.type == "TEX_IMAGE":
            return link.from_node.image
    return None


def sample_image(image, uv):
    if image is None or image.size[0] == 0 or image.size[1] == 0:
        return None
    width, height = image.size
    x = min(width - 1, max(0, int(uv[0] * width)))
    y = min(height - 1, max(0, int(uv[1] * height)))
    offset = (y * width + x) * 4
    return list(image.pixels[offset : offset + 3])


def connected_components(mesh):
    parent = list(range(len(mesh.vertices)))
    coordinate_owner = {}

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
        if key in coordinate_owner:
            union(index, coordinate_owner[key])
        else:
            coordinate_owner[key] = index
    for polygon in mesh.polygons:
        first = polygon.vertices[0]
        for vertex in polygon.vertices[1:]:
            union(first, vertex)
    grouped = defaultdict(list)
    for polygon in mesh.polygons:
        grouped[find(polygon.vertices[0])].append(polygon.index)
    return sorted(grouped.values(), key=lambda indices: (-len(indices), indices[0]))


def head_report(obj):
    mesh = obj.data
    uv_layer = mesh.uv_layers.active
    center_local = sum((vertex.co for vertex in mesh.vertices), Vector()) / len(mesh.vertices)
    material_polygons = Counter(polygon.material_index for polygon in mesh.polygons)
    material_samples = defaultdict(list)
    for polygon in mesh.polygons:
        material = mesh.materials[polygon.material_index] if polygon.material_index < len(mesh.materials) else None
        image = image_for_material(material)
        if uv_layer is None:
            continue
        uv = sum((uv_layer.data[loop].uv for loop in polygon.loop_indices), Vector((0.0, 0.0))) / len(polygon.loop_indices)
        sample = sample_image(image, uv)
        if sample is not None:
            material_samples[polygon.material_index].append(sample)
    materials = []
    for index, polygon_count in sorted(material_polygons.items()):
        material = mesh.materials[index] if index < len(mesh.materials) else None
        image = image_for_material(material)
        samples = material_samples[index]
        average = [sum(sample[channel] for sample in samples) / len(samples) for channel in range(3)] if samples else None
        materials.append(
            {
                "slot": index,
                "name": material.name if material else None,
                "polygons": polygon_count,
                "atlas": str(image.filepath) if image else None,
                "atlasSize": list(image.size) if image else None,
                "packed": bool(image and image.packed_file),
                "averageAtlasSrgb255": color_srgb(average) if average else None,
            }
        )
    inward = 0
    for polygon in mesh.polygons:
        radial = polygon.center - center_local
        if radial.length > 1e-8 and polygon.normal.dot(radial.normalized()) < -0.05:
            inward += 1
    components = []
    for rank, polygon_indices in enumerate(connected_components(mesh)):
        polygons = [mesh.polygons[index] for index in polygon_indices]
        vertex_indices = sorted({index for polygon in polygons for index in polygon.vertices})
        coordinates = [mesh.vertices[index].co for index in vertex_indices]
        material_counts = Counter(polygon.material_index for polygon in polygons)
        uv_values = []
        component_samples = []
        if uv_layer:
            for polygon in polygons:
                material = mesh.materials[polygon.material_index] if polygon.material_index < len(mesh.materials) else None
                image = image_for_material(material)
                polygon_uv = sum((uv_layer.data[loop].uv for loop in polygon.loop_indices), Vector((0.0, 0.0))) / len(polygon.loop_indices)
                uv_values.append(polygon_uv)
                sample = sample_image(image, polygon_uv)
                if sample is not None:
                    component_samples.append(sample)
        average_sample = (
            [sum(sample[channel] for sample in component_samples) / len(component_samples) for channel in range(3)]
            if component_samples
            else None
        )
        components.append(
            {
                "component": rank,
                "polygons": len(polygons),
                "vertices": len(vertex_indices),
                "materialSlots": dict(sorted(material_counts.items())),
                "averageAtlasSrgb255": color_srgb(average_sample) if average_sample else None,
                "localBounds": {
                    "min": [round(min(value[axis] for value in coordinates), 6) for axis in range(3)],
                    "max": [round(max(value[axis] for value in coordinates), 6) for axis in range(3)],
                },
                "uvBounds": {
                    "min": [round(min(value[axis] for value in uv_values), 6) for axis in range(2)],
                    "max": [round(max(value[axis] for value in uv_values), 6) for axis in range(2)],
                }
                if uv_values
                else None,
            }
        )
    return {
        "mesh": obj.name,
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "componentCount": len(components),
        "components": components,
        "materials": materials,
        "inwardFacingPolygons": inward,
        "inwardFacingRatio": round(inward / max(1, len(mesh.polygons)), 6),
        "vertexGroups": [group.name for group in obj.vertex_groups],
        "armatureModifiers": [modifier.name for modifier in obj.modifiers if modifier.type == "ARMATURE"],
    }


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


def render_variant(role, mode, output_dir, source_path, candidate, config, modules):
    common = modules["common"]
    worker = modules["worker"]
    source_import = modules["source_import"]
    runtime_asset = modules["runtime_asset"]
    compositor = modules["compositor"]
    prototype = modules["prototype"]
    style_layer = modules["style_layer"]
    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    objects = worker.character_objects(armature)
    worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    source_mins, source_maxs = source_import.world_bounds(objects)
    unit_scale = 1.8 / float(source_maxs.z - source_mins.z)
    normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
    material_treatment = worker.local_material_treatment(objects, "source")
    body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
    head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
    before = head_report(head)
    region_report = None
    accessories = []
    if mode != "A_original":
        region_report = prototype.apply_region_materials(body, candidate, compositor)
    worker.bind_action(armature, bpy.data.actions["idle"])
    if mode in ("B_wp02b_candidate", "C_no_accessories"):
        accessories = prototype.build_accessories(armature, head, candidate, compositor)
        objects.extend(accessories)
        drift = compositor.validate_anchor_drift(bpy.context.scene, armature, accessories)
    else:
        drift = None
    bpy.context.view_layer.update()
    top = prototype.head_top(armature, head)
    head_mins, head_maxs = source_import.world_bounds([head])
    head_dimensions = head_maxs - head_mins
    accessory_measurements = []
    for accessory in accessories:
        mins, maxs = source_import.world_bounds([accessory])
        size = maxs - mins
        accessory_measurements.append(
            {
                "name": accessory.name,
                "type": accessory.get("wp_character_accessory"),
                "bone": accessory.get("wp_character_bone"),
                "dimensionsMeters": [round(float(value), 6) for value in size],
                "boundsMeters": {
                    "min": [round(float(value), 6) for value in mins],
                    "max": [round(float(value), 6) for value in maxs],
                },
            }
        )
    configure_render(runtime_asset, style_layer, config)
    camera_config = config["professionPrototypes"]["camera"]
    camera, _ = runtime_asset.place_camera(
        camera_config["targetZ"],
        camera_config["orthoScale"],
        name=f"WP02C_{role.upper()}_{mode}",
        azimuth_degrees=camera_config["azimuthBaseDegrees"],
    )
    if mode in ("C_material_map", "C_component_map"):
        body.hide_render = True
        materials = []
        if mode == "C_material_map":
            for slot in range(max(1, len(head.data.materials))):
                materials.append(
                    compositor.make_material(
                        f"wp02c_{role}_head_slot_{slot}",
                        DIAGNOSTIC_COLORS[slot % len(DIAGNOSTIC_COLORS)],
                        metallic=0.0,
                        roughness=0.9,
                    )
                )
            head.data.materials.clear()
            for material in materials:
                head.data.materials.append(material)
        else:
            polygon_components = {}
            for rank, polygon_indices in enumerate(connected_components(head.data)):
                for polygon_index in polygon_indices:
                    polygon_components[polygon_index] = rank
            for rank in range(len(connected_components(head.data))):
                materials.append(
                    compositor.make_material(
                        f"wp02c_{role}_head_component_{rank}",
                        DIAGNOSTIC_COLORS[rank % len(DIAGNOSTIC_COLORS)],
                        metallic=0.0,
                        roughness=0.9,
                    )
                )
            head.data.materials.clear()
            for material in materials:
                head.data.materials.append(material)
            for polygon in head.data.polygons:
                polygon.material_index = polygon_components[polygon.index]
        objects = [armature, head]
    path = output_dir / f"{role}-{mode}-d0-idle-00.png"
    sample = worker.render_frame(
        objects,
        armature,
        bpy.context.scene,
        camera,
        int(round(bpy.data.actions["idle"].frame_range[0])),
        0,
        "idle",
        0,
        path,
        common,
        source_import,
        {**config, "materialMode": "source", "walkSamples": 8},
    )
    return {
        "mode": mode,
        "normalization": normalization,
        "unitScale": round(unit_scale, 8),
        "materialTreatment": material_treatment,
        "regionMaterials": region_report,
        "sourceHead": before,
        "headTopWorld": [round(float(value), 6) for value in top],
        "headWorldDimensionsMeters": [round(float(value), 6) for value in head_dimensions],
        "headWorldBounds": {
            "min": [round(float(value), 6) for value in head_mins],
            "max": [round(float(value), 6) for value in head_maxs],
        },
        "accessories": accessory_measurements,
        "maxAnchorDrift": drift,
        "sample": sample,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_dir = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida diagnóstica no está vacía: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    modules = {
        "common": load_module("wp02c_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py"),
        "worker": load_module("wp02c_worker", WP02A_TOOLS / "render_worker_reference.py"),
        "prototype": load_module("wp02c_prototype", WP02B_TOOLS / "render_profession_prototypes.py"),
        "compositor": load_module("wp02c_compositor", REPO_ROOT / "tools/art-pipeline/blender/characters/character_compositor.py"),
        "runtime_asset": load_module("wp02c_runtime", runtime_path),
        "source_import": load_module("wp02c_source_import", runtime_path.parent / "source_import.py"),
        "style_layer": json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8")),
    }
    license_path = source_root / config["sourcePolicy"]["licenseFile"]
    if modules["common"].sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("Hash de licencia Kenney incorrecto")
    report = {
        "schemaVersion": 1,
        "status": "diagnostic_rendered_pending_analysis",
        "worktree": str(REPO_ROOT),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": modules["common"].sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "license": {"path": str(license_path), "sha256": modules["common"].sha256(license_path)},
        "runtimePromotion": False,
        "camera": config["professionPrototypes"]["camera"],
        "roles": {},
    }
    for role in ROLES:
        candidate = config["professionPrototypes"]["candidates"][role]
        source_path = source_root / candidate["sourcePath"]
        if modules["common"].sha256(source_path) != candidate["sourceSha256"]:
            raise RuntimeError(f"Hash de fuente incorrecto: {role}")
        variants = {}
        for mode in ("A_original", "B_wp02b_candidate", "C_no_accessories", "C_material_map", "C_component_map"):
            variants[mode] = render_variant(role, mode, output_dir, source_path, candidate, config, modules)
        report["roles"][role] = {
            "source": {"path": str(source_path), "sha256": modules["common"].sha256(source_path), "license": "CC0-1.0"},
            "variants": variants,
        }
    report_path = output_dir / "head-defects-diagnosis.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "diagnostic_complete", "roles": list(report["roles"]), "report": str(report_path)}, ensure_ascii=False))
    print("WP_CHAR_02C_HEAD_DIAGNOSIS_OK")


if __name__ == "__main__":
    main()

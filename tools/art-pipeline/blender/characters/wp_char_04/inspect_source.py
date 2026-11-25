#!/usr/bin/env python3
"""Inspect position-welded Kenney mesh components before local rework."""

import argparse
import colorsys
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"
WP02C_TOOLS = TOOL_DIR.parent / "wp_char_02c"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def dominant_group(polygon, obj, groups):
    weights = {name: 0.0 for name in groups}
    for vertex_index in polygon.vertices:
        for item in obj.data.vertices[vertex_index].groups:
            name = obj.vertex_groups[item.group].name
            if name in weights:
                weights[name] += item.weight
    if not weights or max(weights.values()) <= 0:
        return None
    return max(weights, key=weights.get)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--source-file", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--render-components", action="store_true")
    parser.add_argument("--render-original", action="store_true")
    parser.add_argument("--remove-components")
    parser.add_argument("--render-output")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    if (args.render_components or args.render_original or args.remove_components is not None) and not args.render_output:
        raise RuntimeError("--render-output is required for diagnostic renders")
    if args.render_components and (args.render_original or args.remove_components is not None):
        raise RuntimeError("Choose either a component map or a full-character control")
    source_root = Path(args.source_root).resolve()
    source_path = source_root / args.source_file
    output_path = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    if output_path.exists():
        raise RuntimeError(f"Output already exists: {output_path}")

    common = load_module("wp04_inspect_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp04_inspect_worker", WP02A_TOOLS / "render_worker_reference.py")
    diagnostic = load_module("wp04_inspect_diagnostic", WP02C_TOOLS / "diagnose_head_defects.py")
    source_import = load_module("wp04_inspect_source", runtime_path.parent / "source_import.py")
    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    objects = worker.character_objects(armature)
    worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    source_mins, source_maxs = source_import.world_bounds(objects)
    source_import.normalize_import_root(objects, unit_scale=1.8 / float(source_maxs.z - source_mins.z))
    groups = ("torso", "arm-left", "arm-right", "leg-left", "leg-right", "head")
    report = {
        "schemaVersion": 1,
        "purpose": "WP-CHAR-04 source component inspection; no rendering or source mutation",
        "source": {"path": str(source_path), "sha256": common.sha256(source_path)},
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "runtimePromotion": False,
        "meshes": [],
    }
    for obj in objects:
        if obj.type != "MESH":
            continue
        mesh_report = diagnostic.head_report(obj)
        components = diagnostic.connected_components(obj.data)
        for rank, polygon_indices in enumerate(components):
            counts = Counter(
                dominant_group(obj.data.polygons[index], obj, groups) for index in polygon_indices
            )
            mesh_report["components"][rank]["dominantGroups"] = dict(
                sorted(counts.items(), key=lambda item: str(item[0]))
            )
        report["meshes"].append(mesh_report)
    if args.remove_components is not None or args.render_original:
        render_output = Path(args.render_output).resolve()
        if render_output.exists():
            raise RuntimeError(f"Render output already exists: {render_output}")
        removed = [int(value) for value in (args.remove_components or "").split(",") if value.strip()]
        body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
        components = diagnostic.connected_components(body.data)
        if any(index < 0 or index >= len(components) for index in removed):
            raise RuntimeError("Removal component index out of range")
        selected = {polygon_index for index in removed for polygon_index in components[index]}
        if selected:
            bm = bmesh.new()
            bm.from_mesh(body.data)
            bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[bm.faces[index] for index in sorted(selected)], context="FACES")
            bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context="VERTS")
            bm.to_mesh(body.data)
            bm.free()
            body.data.update()
        worker.local_material_treatment(objects, "source")
        worker.bind_action(armature, bpy.data.actions["idle"])
        runtime_asset = load_module("wp04_inspect_runtime", runtime_path)
        style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
        runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 512
        scene.render.resolution_y = 512
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.color_depth = "8"
        scene.render.film_transparent = True
        runtime_asset.apply_render_settings(scene, style_layer)
        camera, _ = runtime_asset.place_camera(0.95, 2.3, name="WP04_REMOVAL_CAM", azimuth_degrees=45)
        scene.render.filepath = str(render_output)
        bpy.ops.render.render(write_still=True)
        report["removalControl"] = {
            "removedComponents": removed,
            "removedPolygons": len(selected),
            "path": str(render_output),
            "sha256": common.sha256(render_output),
            "cameraBounds": common.camera_bounds(objects, scene, camera),
            "note": "Offline diagnostic only; local imported mesh copy, source GLB unchanged.",
        }
    if args.render_components:
        render_output = Path(args.render_output).resolve()
        if render_output.exists():
            raise RuntimeError(f"Render output already exists: {render_output}")
        runtime_asset = load_module("wp04_inspect_runtime", runtime_path)
        style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
        body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
        head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
        components = diagnostic.connected_components(body.data)
        body.data.materials.clear()
        legend = []
        for rank, polygon_indices in enumerate(components):
            rgb = colorsys.hsv_to_rgb(rank / max(1, len(components)), 0.68, 0.95)
            material = common.make_material(f"wp04_component_{rank:02d}", rgb)
            body.data.materials.append(material)
            for polygon_index in polygon_indices:
                body.data.polygons[polygon_index].material_index = rank
            legend.append({"component": rank, "polygons": len(polygon_indices), "srgb": [round(value * 255) for value in rgb]})
        head.hide_render = True
        worker.bind_action(armature, bpy.data.actions["idle"])
        runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.resolution_x = 512
        scene.render.resolution_y = 512
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.color_depth = "8"
        scene.render.film_transparent = True
        runtime_asset.apply_render_settings(scene, style_layer)
        camera, _ = runtime_asset.place_camera(0.95, 2.3, name="WP04_COMPONENT_CAM", azimuth_degrees=45)
        scene.render.filepath = str(render_output)
        bpy.ops.render.render(write_still=True)
        projected = []
        for rank, polygon_indices in enumerate(components):
            coordinates = [
                body.data.vertices[vertex_index].co
                for polygon_index in polygon_indices
                for vertex_index in body.data.polygons[polygon_index].vertices
            ]
            center = sum(coordinates, Vector()) / len(coordinates)
            point = world_to_camera_view(scene, camera, body.matrix_world @ center)
            projected.append({"component": rank, "x": round(float(point.x), 6), "y": round(float(point.y), 6)})
        report["componentMap"] = {
            "path": str(render_output),
            "sha256": common.sha256(render_output),
            "cameraBounds": common.camera_bounds([body], scene, camera),
            "legend": legend,
            "projectedCenters": projected,
            "note": "Offline diagnostic only; body components use position-welded ordering.",
        }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "inspected", "source": source_path.name, "output": str(output_path)}))
    print("WP_CHAR_04_SOURCE_INSPECTION_OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Renderiza una comparación mínima de Rocketbox, Kenney y Quaternius."""

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent


def argument(name):
    args = sys.argv[sys.argv.index("--") + 1 :]
    return args[args.index(name) + 1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def remove_objects(objects):
    for obj in list(objects):
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)


def skinned_character_objects(armature):
    meshes = [
        obj
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and any(
            modifier.type == "ARMATURE" and modifier.object == armature
            for modifier in obj.modifiers
        )
    ]
    if not meshes:
        raise RuntimeError(f"La armature {armature.name} no tiene mallas skineadas")
    return [armature, *meshes]


def fix_quaternius_texture_paths(source_path):
    fixed = []
    for material in bpy.data.materials:
        nodes = getattr(getattr(material, "node_tree", None), "nodes", None)
        if nodes is None:
            continue
        for node in nodes:
            if node.type != "TEX_IMAGE" or node.image is None or node.image.packed_file:
                continue
            path = Path(bpy.path.abspath(node.image.filepath))
            if path.exists():
                continue
            candidate = path.with_name(path.name.replace("_png.png", ".png"))
            if candidate.exists():
                node.image.filepath = str(candidate)
                node.image.reload()
                fixed.append({"from": str(path), "to": str(candidate)})
    return fixed


def action_by_name(name):
    action = bpy.data.actions.get(name)
    if action is None:
        raise RuntimeError(f"Acción ausente: {name}")
    return action


def assign_action(armature, action):
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    start, end = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
    bpy.context.scene.frame_start = start
    bpy.context.scene.frame_end = end
    bpy.context.scene.frame_set(start)


def import_clip_and_assign(base_armature, clip_path, action_name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(clip_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    action_by_name(action_name)
    assign_action(base_armature, action_by_name(action_name))
    remove_objects(imported)


def mesh_summary(objects):
    meshes = [obj for obj in objects if obj.type == "MESH"]
    return {
        "meshCount": len(meshes),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
        "triangles": sum(len(obj.data.polygons) for obj in meshes),
        "materials": sorted({material.name for obj in meshes for material in obj.data.materials if material}),
        "images": sorted(
            {
                node.image.name
                for material in bpy.data.materials
                for node in getattr(getattr(material, "node_tree", None), "nodes", [])
                if node.type == "TEX_IMAGE" and node.image
            }
        ),
    }


def setup_render(camera, style_layer, runtime_asset):
    camera.data.ortho_scale = 2.05
    runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    runtime_asset.apply_render_settings(scene, style_layer)


def render_pose(objects, scene, camera, frame, path, common, source_import, root_compensation=None):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    if root_compensation is not None:
        import_root = root_compensation["importRoot"]
        base_location = root_compensation["baseLocation"]
        origin = root_compensation["origin"]
        root_name = root_compensation["rootBone"]
        armature = root_compensation["armature"]
        import_root.location = base_location
        bpy.context.view_layer.update()
        root_world = common.bone_position(armature, root_name, "head")
        left = common.foot_metrics(objects, armature, "L")
        right = common.foot_metrics(objects, armature, "R")
        import_root.location = (
            base_location[0] + origin[0] - root_world.x,
            base_location[1] + origin[1] - root_world.y,
            base_location[2] - min(left["minZ"], right["minZ"]),
        )
        bpy.context.view_layer.update()
    mins, maxs = source_import.world_bounds(objects)
    sample = {
        "frame": int(frame),
        "worldSizeMeters": common.vector_list(maxs - mins),
        "minZ": round(float(mins.z), 6),
        "cameraBounds": common.camera_bounds(objects, scene, camera),
    }
    common.render_sample(scene, path, sample)
    return sample


def main():
    manifest_path = Path(argument("--manifest")).resolve()
    source_root = Path(argument("--source-root")).resolve()
    output_dir = Path(argument("--output")).resolve()
    runtime_path = Path(argument("--runtime-asset")).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    comparison = config["sourceComparison"]
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida de comparación no contiene archivos previos: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    common = load_module("wp02a_common_diagnosis", TOOL_DIR / "diagnose_rocketbox_animation.py")
    runtime_asset = load_module("wp02a_comparison_runtime", runtime_path)
    source_import = load_module("wp02a_comparison_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    report = {
        "schemaVersion": 1,
        "status": "rendered_pending_validation",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": common.sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "camera": {"azimuthDegrees": 45, "elevationDegrees": 30, "orthoScale": 2.05, "targetZ": 0.9},
        "render": {"width": 512, "height": 512, "background": "0.25 m diagnostic grid"},
        "sources": {},
        "outputs": [],
    }
    for source_name, source_config in comparison["candidates"].items():
        common.clear_scene()
        source_path = source_root / source_config["path"]
        if common.sha256(source_path) != source_config["sha256"]:
            raise RuntimeError(f"Hash de fuente incorrecto: {source_name}")
        license_path = source_root / source_config["licenseFile"]
        if common.sha256(license_path) != source_config["licenseFileSha256"]:
            raise RuntimeError(f"Hash de licencia incorrecto: {source_name}")
        objects = source_import.import_source(source_path)
        if source_name == "rocketbox":
            source_import.fix_texture_paths(source_path)
        texture_fixes = fix_quaternius_texture_paths(source_path) if source_name == "quaternius" else []
        source_import.assert_textures_resolved(objects, source_path)
        armature = next(obj for obj in objects if obj.type == "ARMATURE")
        objects = skinned_character_objects(armature)
        remove_objects([obj for obj in bpy.data.objects if obj not in objects])
        normalization = source_import.normalize_import_root(objects, unit_scale=source_config["unitScale"])
        if source_name == "quaternius":
            for clip_key in ("idleClip", "walkClip"):
                clip_path = source_root / source_config[clip_key]["path"]
                if common.sha256(clip_path) != source_config[clip_key]["sha256"]:
                    raise RuntimeError(f"Hash de clip incorrecto: {source_name} {clip_key}")
        runtime_asset.apply_external_treatment(objects, style_layer, "character")
        camera, _ = runtime_asset.place_camera(0.9, 2.05, azimuth_degrees=45)
        setup_render(camera, style_layer, runtime_asset)
        common.add_ground(show_foot_markers=False)
        source_report = {
            "path": str(source_path),
            "sha256": common.sha256(source_path),
            "licenseFile": str(license_path),
            "licenseFileSha256": common.sha256(license_path),
            "license": source_config["license"],
            "unitScale": source_config["unitScale"],
            "normalization": normalization,
            "textureFixes": texture_fixes,
            "mesh": mesh_summary(objects),
            "armature": {"name": armature.name, "bones": len(armature.data.bones)},
            "animations": {},
        }
        for animation, action_name in source_config["actions"].items():
            if source_name == "rocketbox":
                clip_path = source_root / source_config[f"{animation}Clip"]["path"]
                runtime_asset.apply_animation_clip(objects, clip_path, 0)
                action = armature.animation_data.action
            elif source_name == "quaternius":
                clip_path = source_root / source_config[f"{animation}Clip"]["path"]
                import_clip_and_assign(armature, clip_path, action_name)
                action = armature.animation_data.action
            else:
                action = action_by_name(action_name)
                assign_action(armature, action)
            action_report = common.action_report(action)
            slot = armature.animation_data.action_slot
            action_report["boundActionSlot"] = getattr(slot, "identifier", None) if slot else None
            source_report["animations"][animation] = action_report
            if animation == "idle":
                frames = [int(round(action.frame_range[0]))]
            else:
                frames, _, _ = common.useful_frames(action, 3)
            root_compensation = None
            if source_name == "rocketbox" and animation == "walk":
                first = frames[0]
                bpy.context.scene.frame_set(first)
                bpy.context.view_layer.update()
                root_name = next(bone.name for bone in armature.data.bones if bone.parent is None)
                root_compensation = {
                    "armature": armature,
                    "importRoot": bpy.data.objects["IMPORT_ROOT"],
                    "baseLocation": tuple(bpy.data.objects["IMPORT_ROOT"].location),
                    "origin": common.vector_list(common.bone_position(armature, root_name, "head")),
                    "rootBone": root_name,
                }
            samples = []
            for index, frame in enumerate(frames):
                path = output_dir / f"{source_name}-{animation}-{index:02d}.png"
                sample = render_pose(objects, bpy.context.scene, camera, frame, path, common, source_import, root_compensation)
                sample.update(
                    {
                        "source": source_name,
                        "animation": animation,
                        "sampleIndex": index,
                        "phase": round(index / max(1, len(frames)), 6),
                        "action": action.name,
                    }
                )
                samples.append(sample)
                report["outputs"].append(sample["image"])
            source_report["animations"][animation]["samples"] = samples
        report["sources"][source_name] = source_report
    report_path = output_dir / "source-comparison.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WP02A_SOURCE_COMPARISON_OUTPUTS {len(report['outputs'])}")
    print("WP_CHAR_02A_SOURCE_COMPARISON_OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Produce el obrero de referencia WP-CHAR-02A sobre Kenney, sin promoción runtime."""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent


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


def character_objects(armature):
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
        raise RuntimeError("El worker no tiene mallas skineadas")
    return [armature, *meshes]


def local_material_treatment(objects, mode):
    if mode == "styled":
        return {"mode": mode, "note": "Uses the shared Graphic Civic external atlas treatment."}
    changes = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material is None:
                continue
            original = slot.material
            variant = original.copy()
            variant.name = f"{original.name}_WP02A_{mode}"
            slot.link = "OBJECT"
            slot.material = variant
            principled = next(
                (node for node in variant.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
                None,
            )
            if principled is None:
                continue
            if not principled.inputs["Metallic"].is_linked:
                principled.inputs["Metallic"].default_value = 0.0
            if not principled.inputs["Roughness"].is_linked:
                principled.inputs["Roughness"].default_value = 0.9
            specular = principled.inputs.get("Specular IOR Level")
            if specular is not None:
                for link in list(variant.node_tree.links):
                    if link.to_socket == specular:
                        variant.node_tree.links.remove(link)
                specular.default_value = 0.22
            changes.append(
                {
                    "mesh": obj.name,
                    "originalMaterial": original.name,
                    "localMaterial": variant.name,
                    "metallic": 0.0,
                    "roughness": 0.9,
                    "specular": 0.22,
                }
            )
    return {"mode": mode, "materials": changes}


def bind_action(armature, action):
    armature.animation_data_create()
    armature.animation_data.action = action
    if action.slots:
        armature.animation_data.action_slot = action.slots[0]
    start, end = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
    bpy.context.scene.frame_start = start
    bpy.context.scene.frame_end = end
    bpy.context.scene.frame_set(start)


def root_position(armature):
    root = next(bone.name for bone in armature.data.bones if bone.parent is None)
    return root, armature.matrix_world @ armature.pose.bones[root].head


def mesh_min_z(objects, source_import):
    mins, _ = source_import.world_bounds(objects)
    return float(mins.z)


def render_frame(objects, armature, scene, camera, frame, direction, animation, index, path, common, source_import, config):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    import_root = bpy.data.objects["IMPORT_ROOT"]
    base_location = tuple(import_root.location)
    root_name, root_world = root_position(armature)
    minimum_z = mesh_min_z(objects, source_import)
    import_root.location = (base_location[0], base_location[1], base_location[2] - minimum_z)
    bpy.context.view_layer.update()
    mins, maxs = source_import.world_bounds(objects)
    sample = {
        "direction": direction,
        "azimuthDegrees": config["camera"]["azimuthBaseDegrees"] + direction * config["camera"]["azimuthStepDegrees"],
        "animation": animation,
        "sampleIndex": index,
        "frame": int(frame),
        "phase": round(index / config["walkSamples"], 6) if animation == "walk" else 0.0,
        "action": armature.animation_data.action.name,
        "actionSlot": getattr(armature.animation_data.action_slot, "identifier", None),
        "rootBone": root_name,
        "rootPositionBeforeGrounding": common.vector_list(root_world),
        "groundingOffsetMeters": round(-minimum_z, 6),
        "worldSizeMeters": common.vector_list(maxs - mins),
        "minZ": round(float(mins.z), 6),
        "cameraBounds": common.camera_bounds(objects, scene, camera),
        "materialMode": config["materialMode"],
    }
    common.render_sample(scene, path, sample)
    return sample


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--material-mode", choices=("source", "styled"), default="source")
    parser.add_argument("--smoke", action="store_true")
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(script_args)
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_dir = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    worker = config["workerReference"]
    if worker["source"] != "kenney_character_worker":
        raise RuntimeError("El obrero de referencia debe usar Kenney")
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida no contiene archivos previos: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    common = load_module("wp02a_worker_common", TOOL_DIR / "diagnose_rocketbox_animation.py")
    runtime_asset = load_module("wp02a_worker_runtime", runtime_path)
    source_import = load_module("wp02a_worker_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    source_path = source_root / worker["sourcePath"]
    if common.sha256(source_path) != worker["sourceSha256"]:
        raise RuntimeError("Hash incorrecto del worker Kenney")
    license_path = source_root / config["sourceComparison"]["candidates"]["kenney"]["licenseFile"]
    if common.sha256(license_path) != config["sourceComparison"]["candidates"]["kenney"]["licenseFileSha256"]:
        raise RuntimeError("Hash incorrecto de licencia Kenney")
    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    objects = character_objects(armature)
    remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    normalization = source_import.normalize_import_root(objects, unit_scale=worker["unitScale"])
    if args.material_mode == "styled":
        runtime_asset.apply_external_treatment(objects, style_layer, "character")
    material_report = local_material_treatment(objects, args.material_mode)
    report = {
        "schemaVersion": 1,
        "status": "smoke_rendered" if args.smoke else "rendered_pending_validation",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": common.sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "source": {
            "path": str(source_path),
            "sha256": common.sha256(source_path),
            "licenseFile": str(license_path),
            "licenseFileSha256": common.sha256(license_path),
            "license": "CC0-1.0",
        },
        "normalization": normalization,
        "materialTreatment": material_report,
        "camera": worker["camera"],
        "render": worker["render"],
        "materialMode": args.material_mode,
        "rig": {
            "armature": armature.name,
            "bones": len(armature.data.bones),
            "meshes": [
                {
                    "name": obj.name,
                    "vertices": len(obj.data.vertices),
                    "polygons": len(obj.data.polygons),
                    "materials": [material.name if material else None for material in obj.data.materials],
                    "armatureModifiers": [
                        modifier.name for modifier in obj.modifiers if modifier.type == "ARMATURE"
                    ],
                }
                for obj in objects
                if obj.type == "MESH"
            ],
        },
        "outputs": [],
    }
    runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = worker["render"]["width"]
    scene.render.resolution_y = worker["render"]["height"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    runtime_asset.apply_render_settings(scene, style_layer)
    directions = [0] if args.smoke else list(range(worker["directions"]))
    for direction in directions:
        camera, _ = runtime_asset.place_camera(
            worker["camera"]["targetZ"],
            worker["camera"]["orthoScale"],
            name=f"WP02A_CAM_D{direction}",
            azimuth_degrees=worker["camera"]["azimuthBaseDegrees"] + direction * worker["camera"]["azimuthStepDegrees"],
        )
        for animation, action_name in (("idle", worker["idleAction"]), ("walk", worker["walkAction"])):
            action = bpy.data.actions.get(action_name)
            if action is None:
                raise RuntimeError(f"Acción ausente: {action_name}")
            bind_action(armature, action)
            action_report = common.action_report(action)
            if animation == "idle":
                frames = [int(round(action.frame_range[0]))]
            else:
                frames, _, _ = common.useful_frames(action, worker["walkSamples"])
            for index, frame in enumerate(frames):
                path = output_dir / f"worker-a-d{direction}-{animation}-{index:02d}.png"
                sample = render_frame(
                    objects,
                    armature,
                    scene,
                    camera,
                    frame,
                    direction,
                    animation,
                    index,
                    path,
                    common,
                    source_import,
                    {**worker, "materialMode": args.material_mode},
                )
                sample["actionReport"] = {
                    key: action_report[key]
                    for key in ("name", "frameRange", "layerCount", "slotCount", "fcurveCount", "keyframeCount", "interpolation")
                }
                report["outputs"].append(sample)
    report_path = output_dir / "worker-reference.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WP02A_WORKER_OUTPUTS {len(report['outputs'])}")
    print("WP_CHAR_02A_WORKER_OK")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Audita y renderiza un idle de los 20 personajes Kenney para WP-CHAR-02B."""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def material_names(objects):
    return sorted(
        {
            material.name
            for obj in objects
            if obj.type == "MESH"
            for material in obj.data.materials
            if material
        }
    )


def image_names(objects):
    return sorted(
        {
            node.image.name
            for obj in objects
            if obj.type == "MESH"
            for material in obj.data.materials
            if material and material.node_tree
            for node in material.node_tree.nodes
            if node.type == "TEX_IMAGE" and node.image
        }
    )


def action_inventory():
    return [
        {
            "name": action.name,
            "frameRange": [round(float(value), 6) for value in action.frame_range],
            "layerCount": len(action.layers),
            "slotCount": len(action.slots),
        }
        for action in bpy.data.actions
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(script_args)
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_dir = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    inventory = config["inventory"]
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida del catálogo no contiene archivos previos: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    common = load_module("wp02b_catalog_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp02b_catalog_worker", WP02A_TOOLS / "render_worker_reference.py")
    runtime_asset = load_module("wp02b_catalog_runtime", runtime_path)
    source_import = load_module("wp02b_catalog_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    model_dir = source_root / inventory["modelDirectory"]
    license_path = source_root / config["sourcePolicy"]["licenseFile"]
    if common.sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("Hash incorrecto de licencia Kenney")
    report = {
        "schemaVersion": 1,
        "status": "rendered_pending_visual_classification",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": common.sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "licenseFile": str(license_path),
        "licenseFileSha256": common.sha256(license_path),
        "camera": config["camera"],
        "render": config["render"],
        "models": [],
        "outputs": [],
    }
    for filename in inventory["models"]:
        source_path = model_dir / filename
        if not source_path.exists():
            report["models"].append({"file": filename, "path": str(source_path), "exists": False, "classification": "UNVERIFIED"})
            continue
        common.clear_scene()
        imported = source_import.import_source(source_path)
        source_import.assert_textures_resolved(imported, source_path)
        armatures = [obj for obj in imported if obj.type == "ARMATURE"]
        if len(armatures) != 1:
            report["models"].append(
                {
                    "file": filename,
                    "path": str(source_path),
                    "exists": True,
                    "sha256": common.sha256(source_path),
                    "bytes": source_path.stat().st_size,
                    "armatureCount": len(armatures),
                    "classification": "UNVERIFIED",
                    "reason": "Expected exactly one armature",
                }
            )
            continue
        armature = armatures[0]
        objects = worker.character_objects(armature)
        worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
        source_mins, source_maxs = source_import.world_bounds(objects)
        source_height = float(source_maxs.z - source_mins.z)
        if source_height <= 0:
            raise RuntimeError(f"Altura visible inválida: {filename}")
        unit_scale = 1.8 / source_height
        normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
        actions = action_inventory()
        idle_action = bpy.data.actions.get("idle")
        if idle_action is None:
            report["models"].append(
                {
                    "file": filename,
                    "path": str(source_path),
                    "exists": True,
                    "sha256": common.sha256(source_path),
                    "bytes": source_path.stat().st_size,
                    "armature": armature.name,
                    "bones": len(armature.data.bones),
                    "actions": actions,
                    "classification": "UNVERIFIED",
                    "reason": "No idle action",
                }
            )
            continue
        worker.bind_action(armature, idle_action)
        material_report = worker.local_material_treatment(objects, "source")
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
        camera, _ = runtime_asset.place_camera(
            config["camera"]["targetZ"],
            config["camera"]["orthoScale"],
            name="WP02B_CATALOG_CAM",
            azimuth_degrees=config["camera"]["azimuthBaseDegrees"],
        )
        path = output_dir / f"{source_path.stem}.png"
        sample = worker.render_frame(
            objects,
            armature,
            scene,
            camera,
            int(round(idle_action.frame_range[0])),
            0,
            "idle",
            0,
            path,
            common,
            source_import,
            {**config, "materialMode": "source", "walkSamples": 8},
        )
        sample["sourceFile"] = filename
        sample["sourceSha256"] = common.sha256(source_path)
        meshes = [obj for obj in objects if obj.type == "MESH"]
        model = {
            "file": filename,
            "path": str(source_path),
            "exists": True,
            "sha256": common.sha256(source_path),
            "bytes": source_path.stat().st_size,
            "license": "CC0-1.0",
            "armature": armature.name,
            "bones": len(armature.data.bones),
            "meshCount": len(meshes),
            "vertices": sum(len(obj.data.vertices) for obj in meshes),
            "triangles": sum(len(obj.data.polygons) for obj in meshes),
            "materials": material_names(objects),
            "images": image_names(objects),
            "actions": actions,
            "idleAction": idle_action.name,
            "sourceBounds": {
                "width": round(float(source_maxs.x - source_mins.x), 6),
                "depth": round(float(source_maxs.y - source_mins.y), 6),
                "height": round(source_height, 6),
            },
            "unitScale": round(unit_scale, 8),
            "normalization": normalization,
            "materialTreatment": material_report,
            "render": sample,
            "visualDescription": None,
            "classification": "UNVERIFIED",
            "potentialLandlordUse": None,
        }
        report["models"].append(model)
        report["outputs"].append(sample["image"])
    report_path = output_dir / "kenney-character-catalog.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WP02B_CATALOG_MODELS {len(report['models'])}")
    print(f"WP02B_CATALOG_OUTPUTS {len(report['outputs'])}")
    print("WP_CHAR_02B_CATALOG_OK")


if __name__ == "__main__":
    main()

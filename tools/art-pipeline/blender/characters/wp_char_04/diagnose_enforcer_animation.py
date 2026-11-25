import importlib.util
import json
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


renderer = load("wp04_diag_renderer", TOOL_DIR / "render_smoke.py")
common = load("wp04_diag_common", TOOL_DIR.parent / "wp_char_02a/diagnose_rocketbox_animation.py")
worker = load("wp04_diag_worker", TOOL_DIR.parent / "wp_char_02a/render_worker_reference.py")
compositor = load("wp04_diag_compositor", TOOL_DIR.parent / "character_compositor.py")
runtime = load("wp04_diag_runtime", REPO_ROOT / "tools/art-pipeline/blender/runtime_asset.py")
source_import = load("wp04_diag_source", REPO_ROOT / "tools/art-pipeline/blender/source_import.py")
config = json.loads((TOOL_DIR / "manifest.json").read_text())
candidate = config["candidates"]["enforcer_female"]
palette = {**config["palette"], **{key: config["palette"][value] for key, value in candidate["palette"].items() if value in config["palette"]}}
common.clear_scene()
source_path = REPO_ROOT / candidate["sourcePath"]
imported = source_import.import_source(source_path)
armature = next(obj for obj in imported if obj.type == "ARMATURE")
objects = worker.character_objects(armature)
worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
mins, maxs = source_import.world_bounds(objects)
unit_scale = config["render"]["visibleHeightMeters"] / float(maxs.z - mins.z)
source_import.normalize_import_root(objects, unit_scale=unit_scale)
worker.local_material_treatment(objects, "source")
body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
collar, adaptation = renderer.apply_mesh_adaptation(body, candidate, compositor, palette, unit_scale, armature)
renderer.apply_head_corrections(head, candidate, compositor, palette)
renderer.apply_body_materials(body, candidate, compositor, palette)
report = {}
for label, action_name, frame in (("idle", "idle", 0), *[(f"walk{frame}", "walk", frame) for frame in (0, 2, 4, 6, 8, 10, 12, 14)]):
    worker.bind_action(armature, bpy.data.actions[action_name])
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    entry = {"action": armature.animation_data.action.name, "bones": {}, "bounds": {}}
    for bone in armature.pose.bones:
        entry["bones"][bone.name] = {
            "head": [round(float(value), 6) for value in armature.matrix_world @ bone.head],
            "rotation": [round(float(value), 6) for value in bone.rotation_quaternion],
        }
    for obj in (body, head, collar):
        if obj is None:
            continue
        low, high = source_import.world_bounds([obj])
        entry["bounds"][obj.name] = {"min": [round(float(value), 6) for value in low], "max": [round(float(value), 6) for value in high], "modifiers": [modifier.type for modifier in obj.modifiers]}
    report[label] = entry
print(json.dumps(report, indent=2))

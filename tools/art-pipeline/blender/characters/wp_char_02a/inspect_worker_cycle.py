#!/usr/bin/env python3
"""Mide root motion y cierre del ciclo del obrero Kenney."""

import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy

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


def vector_list(vector):
    return [round(float(value), 6) for value in vector]


def main():
    manifest_path = Path(argument("--manifest")).resolve()
    source_root = Path(argument("--source-root")).resolve()
    output_path = Path(argument("--output")).resolve()
    runtime_path = Path(argument("--runtime-asset")).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    worker = config["workerReference"]
    common = load_module("wp02a_cycle_common", TOOL_DIR / "diagnose_rocketbox_animation.py")
    runtime_asset = load_module("wp02a_cycle_runtime", runtime_path)
    source_import = load_module("wp02a_cycle_source_import", runtime_path.parent / "source_import.py")
    common.clear_scene()
    source_path = source_root / worker["sourcePath"]
    imported = source_import.import_source(source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    meshes = [
        obj
        for obj in imported
        if obj.type == "MESH"
        and any(modifier.type == "ARMATURE" and modifier.object == armature for modifier in obj.modifiers)
    ]
    objects = [armature, *meshes]
    for obj in list(bpy.data.objects):
        if obj not in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    source_import.normalize_import_root(objects, unit_scale=worker["unitScale"])
    action = bpy.data.actions[worker["walkAction"]]
    armature.animation_data_create()
    armature.animation_data.action = action
    armature.animation_data.action_slot = action.slots[0]
    start, end = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
    root_name = next(bone.name for bone in armature.data.bones if bone.parent is None)
    samples = []
    for frame in range(start, end + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        root = armature.matrix_world @ armature.pose.bones[root_name].head
        bones = {
            bone.name: vector_list(armature.matrix_world @ armature.pose.bones[bone.name].head)
            for bone in armature.data.bones
        }
        mins, maxs = source_import.world_bounds(objects)
        samples.append(
            {
                "frame": frame,
                "root": vector_list(root),
                "bones": bones,
                "minZ": round(float(mins.z), 6),
                "worldSizeMeters": vector_list(maxs - mins),
            }
        )
    first, last = samples[0], samples[-1]
    root_travel = max(
        math.hypot(a["root"][0] - b["root"][0], a["root"][1] - b["root"][1])
        for a in samples
        for b in samples
    )
    bone_closure = max(
        math.dist(first["bones"][name], last["bones"][name])
        for name in first["bones"]
    )
    report = {
        "schemaVersion": 1,
        "status": "measured",
        "source": str(source_path),
        "sourceSha256": common.sha256(source_path),
        "action": action.name,
        "actionSlot": getattr(armature.animation_data.action_slot, "identifier", None),
        "frameRange": [start, end],
        "fps": bpy.context.scene.render.fps,
        "rootBone": root_name,
        "rootPlanarTravelMeters": round(root_travel, 6),
        "loopClosureMaxBoneHeadDeltaMeters": round(bone_closure, 6),
        "loopClosureRootDeltaMeters": round(math.dist(first["root"], last["root"]), 6),
        "minZRange": [min(sample["minZ"] for sample in samples), max(sample["minZ"] for sample in samples)],
        "samples": samples,
    }
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("rootPlanarTravelMeters", "loopClosureMaxBoneHeadDeltaMeters", "loopClosureRootDeltaMeters", "minZRange")}, ensure_ascii=False))
    print("WP_CHAR_02A_WORKER_CYCLE_OK")


if __name__ == "__main__":
    main()

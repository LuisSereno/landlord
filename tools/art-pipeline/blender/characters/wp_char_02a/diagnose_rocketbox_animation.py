#!/usr/bin/env python3
"""Diagnóstico aislado del rig y del ciclo de marcha Rocketbox para WP-CHAR-02A."""

import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
FOOT_CONTACT_TOLERANCE_M = 0.02
PENETRATION_TOLERANCE_M = 0.02


def argument(name, default=None):
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv
    if name not in args:
        if default is not None:
            return default
        raise KeyError(name)
    return args[args.index(name) + 1]


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def matrix_list(matrix):
    return [[round(float(value), 8) for value in row] for row in matrix]


def vector_list(vector):
    return [round(float(value), 6) for value in vector]


def signature_hash(signature):
    payload = json.dumps(signature, ensure_ascii=False, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def transform_report(obj):
    return {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "matrixWorld": matrix_list(obj.matrix_world),
        "scale": vector_list(obj.scale),
        "deltaScale": vector_list(obj.delta_scale),
        "deltaLocation": vector_list(obj.delta_location),
        "rotationEuler": vector_list(obj.rotation_euler),
        "rotationMode": obj.rotation_mode,
    }


def modifier_report(obj):
    return [
        {
            "name": modifier.name,
            "type": modifier.type,
            "object": modifier.object.name if getattr(modifier, "object", None) else None,
            "showViewport": modifier.show_viewport,
            "showRender": modifier.show_render,
        }
        for modifier in obj.modifiers
    ]


def shape_key_report(obj):
    keys = getattr(obj.data, "shape_keys", None)
    if keys is None:
        return []
    return [
        {
            "name": key.name,
            "value": round(float(key.value), 6),
            "relativeKey": key.relative_key.name if key.relative_key else None,
        }
        for key in keys.key_blocks
    ]


def mesh_report(objects):
    report = []
    for obj in sorted(objects, key=lambda item: item.name):
        if obj.type != "MESH":
            continue
        report.append(
            {
                **transform_report(obj),
                "vertices": len(obj.data.vertices),
                "polygons": len(obj.data.polygons),
                "vertexGroups": len(obj.vertex_groups),
                "materials": [material.name if material else None for material in obj.data.materials],
                "modifiers": modifier_report(obj),
                "shapeKeys": shape_key_report(obj),
            }
        )
    return report


def bone_report(armature):
    return [
        {
            "name": bone.name,
            "parent": bone.parent.name if bone.parent else None,
            "headLocal": vector_list(bone.head_local),
            "tailLocal": vector_list(bone.tail_local),
            "length": round(float(bone.length), 6),
            "useDeform": bone.use_deform,
            "useConnect": bone.use_connect,
        }
        for bone in armature.data.bones
    ]


def action_curves(action):
    curves = list(getattr(action, "fcurves", []))
    if curves:
        return curves
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                curves.extend(channelbag.fcurves)
    return curves


def action_report(action):
    if action is None:
        return None
    curves = action_curves(action)
    keyframes = [key.co.x for curve in curves for key in curve.keyframe_points]
    return {
        "name": action.name,
        "frameRange": [round(float(value), 6) for value in action.frame_range],
        "layerCount": len(action.layers),
        "slotCount": len(action.slots),
        "fcurveCount": len(curves),
        "keyframeCount": len(keyframes),
        "firstKeyframe": round(float(min(keyframes)), 6) if keyframes else None,
        "lastKeyframe": round(float(max(keyframes)), 6) if keyframes else None,
        "interpolation": sorted({key.interpolation for curve in curves for key in curve.keyframe_points}),
        "cyclicCurves": sum(
            1
            for curve in curves
            if any(modifier.type == "CYCLES" for modifier in curve.modifiers)
        ),
        "locationCurves": [
            {
                "path": curve.data_path,
                "index": curve.array_index,
                "frameRange": [round(float(value), 6) for value in curve.range()],
            }
            for curve in curves
            if curve.data_path.endswith(".location")
        ],
    }


def animation_report(armature):
    data = armature.animation_data
    return {
        "activeAction": action_report(data.action if data else None),
        "useNla": bool(data and data.use_nla),
        "nlaTracks": (
            [
                {
                    "name": track.name,
                    "strips": [
                        {
                            "name": strip.name,
                            "action": strip.action.name if strip.action else None,
                            "frameStart": round(float(strip.frame_start), 6),
                            "frameEnd": round(float(strip.frame_end), 6),
                        }
                        for strip in track.strips
                    ],
                }
                for track in data.nla_tracks
            ]
            if data
            else []
        ),
    }


def rig_report(objects):
    armature = next((obj for obj in objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise RuntimeError("El avatar no contiene armature")
    return {
        "activeArmature": armature.name,
        "armatureTransform": transform_report(armature),
        "boneCount": len(armature.data.bones),
        "bones": bone_report(armature),
        "meshes": mesh_report(objects),
        "animation": animation_report(armature),
        "sceneFps": bpy.context.scene.render.fps,
        "sceneFrameStart": bpy.context.scene.frame_start,
        "sceneFrameEnd": bpy.context.scene.frame_end,
    }


def pick_bone(armature, candidates):
    for name in candidates:
        if name in armature.pose.bones:
            return name
    raise RuntimeError(f"No se encontró ninguno de {candidates}")


def bone_position(armature, name, endpoint="head"):
    pose_bone = armature.pose.bones[name]
    local = pose_bone.head if endpoint == "head" else pose_bone.tail
    return armature.matrix_world @ local


def knee_bend(hip, knee, ankle):
    upper = knee - hip
    lower = ankle - knee
    if upper.length < 1e-8 or lower.length < 1e-8:
        return 0.0
    return round(180.0 - math.degrees(upper.angle(lower)), 4)


def foot_metrics(objects, armature, side):
    prefix = f"Bip01 {side}"
    foot_name = pick_bone(armature, [f"{prefix} Foot"])
    ankle = bone_position(armature, f"{prefix} Calf", "tail")
    foot_head = bone_position(armature, foot_name, "head")
    foot_tail = bone_position(armature, foot_name, "tail")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        group_indices = {
            group.index
            for group in obj.vertex_groups
            if group.name.startswith(prefix) and ("Foot" in group.name or "Toe" in group.name)
        }
        if not group_indices:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            for vertex in mesh.vertices:
                weight = sum(item.weight for item in vertex.groups if item.group in group_indices)
                if weight >= 0.1:
                    points.append(obj.matrix_world @ vertex.co)
        finally:
            evaluated.to_mesh_clear()
    if not points:
        points = [foot_tail]
    minimum_z = min(point.z for point in points)
    contact_points = [point for point in points if point.z <= minimum_z + 0.015]
    center = sum(contact_points, Vector()) / len(contact_points)
    return {
        "bone": foot_name,
        "ankle": vector_list(ankle),
        "head": vector_list(foot_head),
        "tail": vector_list(foot_tail),
        "weightedVertices": len(points),
        "minZ": round(float(minimum_z), 6),
        "contactCenter": vector_list(center),
        "contact": abs(minimum_z) <= FOOT_CONTACT_TOLERANCE_M,
        "penetration": max(0.0, -minimum_z),
    }


def camera_bounds(objects, scene, camera):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            points.extend(
                world_to_camera_view(scene, camera, obj.matrix_world @ vertex.co)
                for vertex in mesh.vertices
            )
        finally:
            evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError("No hay malla para medir el encuadre")
    return {
        "minX": round(min(point.x for point in points), 6),
        "maxX": round(max(point.x for point in points), 6),
        "minY": round(min(point.y for point in points), 6),
        "maxY": round(max(point.y for point in points), 6),
        "clipped": any(point.x < 0 or point.x > 1 or point.y < 0 or point.y > 1 for point in points),
    }


def pose_sample(objects, armature, scene, camera, frame, phase, render_path=None, root_compensation=None):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    if root_compensation is not None:
        root_name = root_compensation["rootBone"]
        import_root = root_compensation["importRoot"]
        base_location = root_compensation["baseLocation"]
        origin = root_compensation["origin"]
        import_root.location = base_location
        bpy.context.view_layer.update()
        root_world = bone_position(armature, root_name, "head")
        compensation_z = 0.0
        if root_compensation.get("groundAlign"):
            left = foot_metrics(objects, armature, "L")
            right = foot_metrics(objects, armature, "R")
            compensation_z = -min(left["minZ"], right["minZ"])
        import_root.location = (
            base_location[0] + origin[0] - root_world.x,
            base_location[1] + origin[1] - root_world.y,
            base_location[2] + compensation_z,
        )
        if root_compensation.get("cameraOrthoScale") is not None:
            camera.data.ortho_scale = root_compensation["cameraOrthoScale"]
        bpy.context.view_layer.update()
    names = {
        "root": next((bone.name for bone in armature.data.bones if bone.parent is None), "Bip01 Pelvis"),
        "pelvis": pick_bone(armature, ["Bip01 Pelvis"]),
        "spine": pick_bone(armature, ["Bip01 Spine", "Bip01 Spine1"]),
        "chest": pick_bone(armature, ["Bip01 Spine2"]),
        "neck": pick_bone(armature, ["Bip01 Neck"]),
        "head": pick_bone(armature, ["Bip01 Head"]),
        "leftThigh": pick_bone(armature, ["Bip01 L Thigh"]),
        "leftCalf": pick_bone(armature, ["Bip01 L Calf"]),
        "rightThigh": pick_bone(armature, ["Bip01 R Thigh"]),
        "rightCalf": pick_bone(armature, ["Bip01 R Calf"]),
        "leftUpperArm": pick_bone(armature, ["Bip01 L UpperArm"]),
        "leftForearm": pick_bone(armature, ["Bip01 L Forearm"]),
        "leftHand": pick_bone(armature, ["Bip01 L Hand"]),
        "rightUpperArm": pick_bone(armature, ["Bip01 R UpperArm"]),
        "rightForearm": pick_bone(armature, ["Bip01 R Forearm"]),
        "rightHand": pick_bone(armature, ["Bip01 R Hand"]),
    }
    positions = {
        key: {
            "head": vector_list(bone_position(armature, name, "head")),
            "tail": vector_list(bone_position(armature, name, "tail")),
        }
        for key, name in names.items()
    }
    left = foot_metrics(objects, armature, "L")
    right = foot_metrics(objects, armature, "R")
    left_knee = Vector(positions["leftCalf"]["head"])
    right_knee = Vector(positions["rightCalf"]["head"])
    sample = {
        "frame": int(frame),
        "phase": round(float(phase), 6),
        "bones": positions,
        "leftFoot": left,
        "rightFoot": right,
        "leftKneeBendDegrees": knee_bend(
            Vector(positions["leftThigh"]["tail"]), left_knee, Vector(left["ankle"])
        ),
        "rightKneeBendDegrees": knee_bend(
            Vector(positions["rightThigh"]["tail"]), right_knee, Vector(right["ankle"])
        ),
        "footSeparationXY": round(
            math.hypot(
                left["contactCenter"][0] - right["contactCenter"][0],
                left["contactCenter"][1] - right["contactCenter"][1],
            ),
            6,
        ),
        "cameraBounds": camera_bounds(objects, scene, camera),
    }
    if root_compensation is not None:
        sample["rootCompensationMeters"] = vector_list(import_root.location - Vector(base_location))
    if render_path is not None:
        sample["imagePath"] = str(render_path.relative_to(REPO_ROOT))
    return sample


def render_sample(scene, path, sample):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(path))
    width, height = image.size
    bpy.data.images.remove(image)
    sample["image"] = {
        "path": str(path.relative_to(REPO_ROOT)),
        "sha256": sha256(path),
        "width": width,
        "height": height,
    }
    return sample["image"]


def make_material(name, color, emission=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1.0)
    principled.inputs["Roughness"].default_value = 0.9
    if emission:
        principled.inputs["Emission Color"].default_value = (*color, 1.0)
        principled.inputs["Emission Strength"].default_value = emission
    return material


def add_ground(show_foot_markers=True):
    ground_material = make_material("WP02A_DIAG_GROUND", (0.58, 0.57, 0.53))
    grid_material = make_material("WP02A_DIAG_GRID", (0.28, 0.30, 0.31))
    left_material = make_material("WP02A_DIAG_LEFT_FOOT", (0.05, 0.65, 0.75), 0.4)
    right_material = make_material("WP02A_DIAG_RIGHT_FOOT", (0.95, 0.38, 0.08), 0.4)
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0.0, 0.0, -0.006))
    plane = bpy.context.object
    plane.name = "WP02A_DIAG_GROUND"
    plane.data.materials.append(ground_material)
    for index in range(-4, 5):
        offset = index * 0.25
        for axis in (0, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(offset, 0.0, 0.0) if axis == 0 else (0.0, offset, 0.0))
            line = bpy.context.object
            line.name = f"WP02A_DIAG_GRID_{axis}_{index}"
            line.scale = (0.003, 2.2, 0.002) if axis == 0 else (2.2, 0.003, 0.002)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            line.data.materials.append(grid_material)
    markers = {}
    if show_foot_markers:
        for side, material in (("L", left_material), ("R", right_material)):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.004, location=(0.0, 0.0, 0.004))
            marker = bpy.context.object
            marker.name = f"WP02A_DIAG_FOOT_{side}"
            marker.data.materials.append(material)
            markers[side] = marker
    bpy.context.scene.render.film_transparent = False
    return markers


def move_markers(markers, sample):
    for side in ("L", "R"):
        center = sample[f"{'left' if side == 'L' else 'right'}Foot"]["contactCenter"]
        markers[side].location = (center[0], center[1], 0.004)


def useful_frames(action, count):
    curves = action_curves(action)
    keys = [key.co.x for curve in curves for key in curve.keyframe_points]
    if not keys:
        raise RuntimeError("La acción no contiene keyframes")
    first = int(round(min(keys)))
    last = int(round(max(keys)))
    span = last - first
    if span < count:
        raise RuntimeError(f"El ciclo útil tiene {span} frames, insuficientes para {count} muestras")
    frames = [int(round(first + span * index / count)) for index in range(count)]
    if len(set(frames)) != count:
        raise RuntimeError("El muestreo produjo frames duplicados")
    return frames, first, last


def range_summary(samples, side):
    values = [sample[f"{side}Foot"]["minZ"] for sample in samples]
    return {
        "contactSamples": sum(sample[f"{side}Foot"]["contact"] for sample in samples),
        "minZ": round(min(values), 6),
        "maxZ": round(max(values), 6),
        "maxPenetrationMeters": round(max(sample[f"{side}Foot"]["penetration"] for sample in samples), 6),
    }


def vector_range(samples, bone, endpoint="head"):
    values = [Vector(sample["bones"][bone][endpoint]) for sample in samples]
    return {
        "min": vector_list(Vector((min(v.x for v in values), min(v.y for v in values), min(v.z for v in values)))),
        "max": vector_list(Vector((max(v.x for v in values), max(v.y for v in values), max(v.z for v in values)))),
        "range": vector_list(Vector((max(v.x for v in values) - min(v.x for v in values), max(v.y for v in values) - min(v.y for v in values), max(v.z for v in values) - min(v.z for v in values)))),
    }


def max_pose_delta(first, second):
    return round(
        max(
            (Vector(first["bones"][name]["head"]) - Vector(second["bones"][name]["head"])).length
            for name in first["bones"]
        ),
        6,
    )


def walk_summary(samples, loop_sample):
    pelvis_values = [Vector(sample["bones"]["pelvis"]["head"]) for sample in samples]
    relative_neck = [
        (Vector(sample["bones"]["neck"]["head"]) - Vector(sample["bones"]["pelvis"]["head"])).length
        for sample in samples
    ]
    root_values = [Vector(sample["bones"]["root"]["head"]) for sample in samples]
    return {
        "sampleCount": len(samples),
        "rootRange": vector_range(samples, "root"),
        "rootPlanarTravel": round(
            max(
                math.hypot(a.x - b.x, a.y - b.y)
                for a in root_values
                for b in root_values
            ),
            6,
        ),
        "pelvisZRange": round(max(v.z for v in pelvis_values) - min(v.z for v in pelvis_values), 6),
        "neckPelvisDistanceRange": [round(min(relative_neck), 6), round(max(relative_neck), 6)],
        "leftFoot": range_summary(samples, "left"),
        "rightFoot": range_summary(samples, "right"),
        "minFootSeparationXY": round(min(sample["footSeparationXY"] for sample in samples), 6),
        "maxFootSeparationXY": round(max(sample["footSeparationXY"] for sample in samples), 6),
        "leftKneeBendDegrees": [
            round(min(sample["leftKneeBendDegrees"] for sample in samples), 4),
            round(max(sample["leftKneeBendDegrees"] for sample in samples), 4),
        ],
        "rightKneeBendDegrees": [
            round(min(sample["rightKneeBendDegrees"] for sample in samples), 4),
            round(max(sample["rightKneeBendDegrees"] for sample in samples), 4),
        ],
        "cameraClippedSamples": sum(sample["cameraBounds"]["clipped"] for sample in samples),
        "loopClosureMaxBoneHeadDeltaMeters": max_pose_delta(samples[0], loop_sample),
        "loopClosureRootDeltaMeters": round(
            (Vector(samples[0]["bones"]["root"]["head"]) - Vector(loop_sample["bones"]["root"]["head"])).length,
            6,
        ),
    }


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def inspect_clip(path, source_import):
    clear_scene()
    objects = source_import.import_source(path)
    armature = next((obj for obj in objects if obj.type == "ARMATURE"), None)
    if armature is None:
        raise RuntimeError(f"El clip {path.name} no contiene armature")
    report = {
        "path": str(path),
        "sha256": sha256(path),
        "armatureTransform": transform_report(armature),
        "boneCount": len(armature.data.bones),
        "animation": animation_report(armature),
        "sceneFps": bpy.context.scene.render.fps,
    }
    clear_scene()
    return report


def external_args(source, clip, config):
    return SimpleNamespace(
        asset="wp_char_02a_rocketbox_diagnosis",
        kind="character",
        source=f"fbx:{source}",
        animation_source=f"fbx:{clip}" if clip else None,
        source_id="src_microsoft_rocketbox",
        license="MIT",
        unit_scale=1.0,
        ortho_scale=config["camera"]["orthoScale"],
        target_z=config["camera"]["targetZ"],
        render_width=config["render"]["width"],
        render_height=config["render"]["height"],
        direction=0,
        azimuth=config["camera"]["azimuthBaseDegrees"],
        frame=0,
    )


def main():
    manifest_path = Path(argument("--manifest")).resolve()
    source_root = Path(argument("--source-root")).resolve()
    output_dir = Path(argument("--output")).resolve()
    runtime_path = Path(argument("--runtime-asset")).resolve()
    compositor_path = Path(argument("--compositor")).resolve()
    phase1b_path = Path(argument("--phase1b-manifest")).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    diagnosis = config["animationDiagnosis"]
    source = source_root / diagnosis["avatar"]["path"]
    idle_clip = source_root / diagnosis["idleClip"]["path"]
    walk_clip = source_root / diagnosis["walkClip"]["path"]
    license_file = source_root / diagnosis["licenseFile"]["path"]
    for item, label in (
        (source, "avatar"),
        (idle_clip, "idle"),
        (walk_clip, "walk"),
        (license_file, "licencia"),
    ):
        if not item.exists():
            raise RuntimeError(f"Fuente ausente ({label}): {item}")
        expected = diagnosis["licenseFile" if label == "licencia" else f"{label}Clip" if label in ("idle", "walk") else "avatar"]["sha256"]
        if sha256(item) != expected:
            raise RuntimeError(f"Hash incorrecto ({label}): {item}")
    if diagnosis["walkSamples"] != 8:
        raise RuntimeError("WP-CHAR-02A exige ocho muestras de marcha")
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"La salida diagnóstica no contiene archivos previos: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(runtime_path.parent))
    runtime_asset = load_module("wp02a_runtime_asset", runtime_path)
    source_import = load_module("wp02a_source_import", runtime_path.parent / "source_import.py")
    compositor = load_module("wp02a_character_compositor", compositor_path)
    phase1b = json.loads(phase1b_path.read_text(encoding="utf-8"))
    job = next(item for item in phase1b["jobs"] if item["id"] == "phase1b_construction_worker_a")
    original_normalize = runtime_asset.normalize_import_root
    original_apply_clip = runtime_asset.apply_animation_clip
    captured = {"objects": [], "normalization": [], "animation": []}

    def normalize_wrapper(objects, unit_scale=1.0):
        before = {
            "transforms": [transform_report(obj) for obj in objects],
            "hierarchyHash": signature_hash(source_import.hierarchy_signature(objects)),
        }
        result = original_normalize(objects, unit_scale=unit_scale)
        after = {
            "transforms": [transform_report(obj) for obj in objects],
            "hierarchyHash": signature_hash(source_import.hierarchy_signature(objects)),
        }
        captured["objects"] = list(objects)
        captured["normalization"].append({"before": before, "after": after, "result": result})
        return result

    def animation_wrapper(avatar_objects, clip_path, frame):
        armature = next(obj for obj in avatar_objects if obj.type == "ARMATURE")
        before = transform_report(armature)
        result = original_apply_clip(avatar_objects, clip_path, frame)
        captured["animation"].append(
            {
                "clip": str(clip_path),
                "legacyFrameArgument": frame,
                "armatureBefore": before,
                "armatureAfter": transform_report(armature),
                "selectedFrame": bpy.context.scene.frame_current,
                "action": action_report(armature.animation_data.action),
            }
        )
        return result

    runtime_asset.normalize_import_root = normalize_wrapper
    runtime_asset.apply_animation_clip = animation_wrapper
    style_layer = json.loads((runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
    report = {
        "schemaVersion": 1,
        "status": "rendered_pending_independent_validation",
        "worktree": str(REPO_ROOT),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "source": {
            "avatar": {"path": str(source), "sha256": sha256(source)},
            "idleClip": {"path": str(idle_clip), "sha256": sha256(idle_clip)},
            "walkClip": {"path": str(walk_clip), "sha256": sha256(walk_clip)},
            "licenseFile": {"path": str(license_file), "sha256": sha256(license_file)},
        },
        "dependencies": {
            "runtimeAsset": {"path": str(runtime_path), "sha256": sha256(runtime_path)},
            "sourceImport": {"path": str(runtime_path.parent / "source_import.py"), "sha256": sha256(runtime_path.parent / "source_import.py")},
            "compositor": {"path": str(compositor_path), "sha256": sha256(compositor_path)},
            "styleLayer": {"path": str(runtime_path.parent / "style_layer_graphic_civic.json"), "sha256": sha256(runtime_path.parent / "style_layer_graphic_civic.json")},
        },
        "diagnosticConventions": {
            "groundGridSpacingMeters": 0.25,
            "footContactToleranceMeters": FOOT_CONTACT_TOLERANCE_M,
            "penetrationToleranceMeters": PENETRATION_TOLERANCE_M,
            "leftFootMarker": "cyan",
            "rightFootMarker": "orange",
            "camera": diagnosis["camera"],
            "note": "Diagnostic ground is local to this tool; shared lighting and camera functions are reused unchanged.",
        },
        "clipInspection": {
            "idle": inspect_clip(idle_clip, source_import),
            "walk": inspect_clip(walk_clip, source_import),
        },
        "controls": {},
        "outputs": [],
    }
    for control, clip_name, use_compositor, compensate_root in (
        ("A_original_model", None, False, False),
        ("B_original_animation_idle", "idle", False, False),
        ("B_original_animation_walk", "walk", False, False),
        ("B_in_place_grounded_walk", "walk", False, True),
        ("C_wp_char_01b_idle", "idle", True, False),
        ("C_wp_char_01b_walk", "walk", True, False),
        ("C_in_place_grounded_walk", "walk", True, True),
    ):
        clear_scene()
        captured["objects"] = []
        captured["normalization"] = []
        captured["animation"] = []
        clip = idle_clip if clip_name == "idle" else walk_clip if clip_name == "walk" else None
        args = external_args(source, clip, diagnosis)
        scene, camera, body, normalization, style_summary, ground_z = runtime_asset.create_external_scene(args, source, style_layer)
        objects = list(captured["objects"])
        armature = next(obj for obj in objects if obj.type == "ARMATURE")
        composition = compositor.compose_scene(scene, job, phase1b) if use_compositor else None
        markers = add_ground()
        control_report = {
            "clip": clip_name,
            "compositor": use_compositor,
            "rootCompensated": compensate_root,
            "normalization": captured["normalization"],
            "animationImport": captured["animation"],
            "styleSummary": style_summary,
            "composition": composition,
            "rig": rig_report(objects),
            "samples": [],
        }
        if clip is None:
            path = output_dir / "A-original-rest.png"
            sample = pose_sample(objects, armature, scene, camera, bpy.context.scene.frame_current, 0.0, path)
            move_markers(markers, sample)
            control_report["samples"].append(sample)
            report["outputs"].append(render_sample(scene, path, sample))
        else:
            action = armature.animation_data.action
            if clip_name == "idle":
                start = int(round(action.frame_range[0]))
                path = output_dir / f"{control}-idle.png"
                sample = pose_sample(objects, armature, scene, camera, start, 0.0, path)
                move_markers(markers, sample)
                control_report["samples"].append(sample)
                report["outputs"].append(render_sample(scene, path, sample))
            else:
                frames, first, last = useful_frames(action, diagnosis["walkSamples"])
                control_report["usefulRange"] = {"first": first, "last": last, "sampledFrames": frames}
                legacy_start, legacy_end = int(round(action.frame_range[0])), int(round(action.frame_range[1]))
                control_report["legacySelection"] = {
                    "frame0": legacy_start,
                    "frame1": legacy_start + max(0, legacy_end - legacy_start) // 2,
                }
                root_compensation = None
                if compensate_root:
                    scene.frame_set(first)
                    bpy.context.view_layer.update()
                    root_name = next(bone.name for bone in armature.data.bones if bone.parent is None)
                    import_root = bpy.data.objects["IMPORT_ROOT"]
                    root_compensation = {
                        "rootBone": root_name,
                        "importRoot": import_root,
                        "baseLocation": tuple(import_root.location),
                        "origin": vector_list(bone_position(armature, root_name, "head")),
                        "groundAlign": True,
                        "cameraOrthoScale": 2.05,
                    }
                    control_report["rootCompensation"] = {
                        "method": "Counter-translate IMPORT_ROOT in XY so the root bone remains at the first useful frame; align the lower foot to Z=0 and use a local 2.05 orthographic scale. Pose and skin data remain unchanged.",
                        "rootBone": root_name,
                        "origin": root_compensation["origin"],
                        "baseImportRootLocation": vector_list(import_root.location),
                        "cameraOrthoScale": root_compensation["cameraOrthoScale"],
                    }
                for index, frame in enumerate(frames):
                    path = output_dir / f"{control}-walk-{index:02d}.png"
                    sample = pose_sample(objects, armature, scene, camera, frame, index / diagnosis["walkSamples"], path, root_compensation)
                    if frame == control_report["legacySelection"]["frame0"]:
                        sample["legacyFrame0"] = True
                    if frame == control_report["legacySelection"]["frame1"]:
                        sample["legacyFrame1"] = True
                    move_markers(markers, sample)
                    control_report["samples"].append(sample)
                    report["outputs"].append(render_sample(scene, path, sample))
                loop_sample = pose_sample(objects, armature, scene, camera, last, 1.0, root_compensation=root_compensation)
                control_report["loopSample"] = loop_sample
                control_report["summary"] = walk_summary(control_report["samples"], loop_sample)
        report["controls"][control] = control_report
    report_path = output_dir / "rocketbox-animation-diagnosis.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"WP02A_DIAGNOSIS_OUTPUTS {len(report['outputs'])}")
    print(f"WP02A_DIAGNOSIS_JSON {report_path}")
    print("WP_CHAR_02A_DIAGNOSIS_OK")


if __name__ == "__main__":
    main()

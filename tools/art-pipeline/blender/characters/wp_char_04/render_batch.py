#!/usr/bin/env python3
"""Render the complete non-promoted WP-CHAR-04 candidate batch for one role."""

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
EXPECTED_BONES = {"root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"}
DIRECTIONS = [0, 1, 2, 3]
WALK_SAMPLES = list(range(8))
WALK_ACTION_FRAMES = [0, 2, 4, 6, 8, 10, 12, 14]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_contract(config):
    contract = config.get("matrix", {}).get("batchContract")
    if not isinstance(contract, dict):
        raise RuntimeError("Missing batchContract")
    expected = {
        "roles": 14,
        "directions": DIRECTIONS,
        "idleSamples": [0],
        "walkDirections": DIRECTIONS,
        "walkSamples": WALK_SAMPLES,
        "walkActionFrames": WALK_ACTION_FRAMES,
        "framesPerRole": 36,
        "totalFrames": 504,
        "requiresHumanApproval": True,
    }
    for key, value in expected.items():
        if contract.get(key) != value:
            raise RuntimeError(f"Unexpected batchContract.{key}: {contract.get(key)!r}")
    if config.get("runtimePromotion") is not False or config.get("humanApprovalClaimed") is not False:
        raise RuntimeError("Batch rendering cannot promote or claim human approval")
    if len(config.get("candidates", {})) != 14:
        raise RuntimeError("WP-CHAR-04 requires exactly 14 candidates")


def expected_outputs(role):
    outputs = []
    for direction in DIRECTIONS:
        outputs.append((direction, "idle", 0, 0))
        for sample_index, action_frame in enumerate(WALK_ACTION_FRAMES):
            outputs.append((direction, "walk", sample_index, action_frame))
    return [
        (
            direction,
            animation,
            sample_index,
            action_frame,
            f"{role}-d{direction}-{animation}-{sample_index:02d}.png",
        )
        for direction, animation, sample_index, action_frame in outputs
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_dir = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_contract(config)
    if args.role not in config["candidates"]:
        raise RuntimeError(f"Unknown role: {args.role}")
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"Output is not fresh: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    smoke = load_module("wp04_smoke_renderer", TOOL_DIR / "render_smoke.py")
    common = smoke.load_module("wp04_batch_common", TOOL_DIR.parent / "wp_char_02a/diagnose_rocketbox_animation.py")
    worker = smoke.load_module("wp04_batch_worker", TOOL_DIR.parent / "wp_char_02a/render_worker_reference.py")
    smoke.PROTOTYPE = smoke.load_module(
        "wp04_batch_prototype", TOOL_DIR.parent / "wp_char_02b/render_profession_prototypes.py"
    )
    compositor = smoke.load_module("wp04_batch_compositor", REPO_ROOT / config["dependencies"]["shared"]["compositor"])
    runtime_asset = smoke.load_module("wp04_batch_runtime", runtime_path)
    source_import = smoke.load_module("wp04_batch_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads(
        (runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    candidate = config["candidates"][args.role]
    resolved_palette = {
        **config["palette"],
        **{
            key: config["palette"][value]
            for key, value in candidate["palette"].items()
            if value in config["palette"]
        },
    }
    source_path = source_root / candidate["sourcePath"]
    license_path = source_root / config["sourcePolicy"]["licenseFile"]
    if sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError(f"Source hash mismatch: {args.role}")
    if sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("Kenney license hash mismatch")

    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    if {bone.name for bone in armature.data.bones} != EXPECTED_BONES:
        raise RuntimeError(f"Unexpected Kenney rig: {[bone.name for bone in armature.data.bones]}")
    if len(bpy.data.actions) != 32:
        raise RuntimeError(f"Expected 32 Kenney actions, found {len(bpy.data.actions)}")
    objects = worker.character_objects(armature)
    worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    source_mins, source_maxs = source_import.world_bounds(objects)
    unit_scale = config["render"]["visibleHeightMeters"] / float(source_maxs.z - source_mins.z)
    normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
    material_treatment = worker.local_material_treatment(objects, "source")
    atlas_before = smoke.packed_atlas_hashes(objects)
    body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
    head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")

    jacket, adaptation = smoke.apply_mesh_adaptation(
        body, candidate, compositor, resolved_palette, unit_scale, armature
    )
    if jacket is not None:
        objects.append(jacket)
    head_report, head_changes = smoke.apply_head_corrections(head, candidate, compositor, resolved_palette)
    body_report, body_changes = smoke.apply_body_materials(body, candidate, compositor, resolved_palette)
    geometry_changes = [*(adaptation["geometryChanges"] if adaptation else []), *head_changes, *body_changes]

    idle_action = bpy.data.actions.get("idle")
    walk_action = bpy.data.actions.get("walk")
    if idle_action is None or walk_action is None:
        raise RuntimeError("Missing idle/walk actions")
    worker.bind_action(armature, idle_action)
    accessories = smoke.build_accessories(armature, head, candidate, compositor, resolved_palette)
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
                "dimensionsMeters": smoke.vector_list(size),
                "boundsMeters": {"min": smoke.vector_list(mins), "max": smoke.vector_list(maxs)},
                "widthToHeadRatio": round(float(size.x / head_size.x), 6),
            }
        )
    walk_frames, _, _ = common.useful_frames(walk_action, len(WALK_SAMPLES))
    if walk_frames != WALK_ACTION_FRAMES:
        raise RuntimeError(f"Unexpected walk sampling: {walk_frames}")
    idle_frame = int(round(idle_action.frame_range[0]))
    worker.bind_action(armature, idle_action)
    idle_drift = smoke.measure_accessory_drift(armature, accessories, [idle_frame])
    worker.bind_action(armature, walk_action)
    walk_drift = smoke.measure_accessory_drift(armature, accessories, walk_frames)
    max_drift = max(idle_drift, walk_drift)
    drift_report = {"idle": idle_drift, "walk": walk_drift, "max": max_drift}
    smoke.configure_render(runtime_asset, style_layer, config)

    skinned_clothing = adaptation["skinnedClothing"] if adaptation else None
    if skinned_clothing:
        skinned_clothing["batchPoseBounds"] = []
    dependencies = smoke.dependency_report(config, manifest_path, runtime_path)
    batch_renderer_path = Path(__file__).resolve()
    dependencies["batchRenderer"] = {
        "path": str(batch_renderer_path),
        "repositoryPath": str(batch_renderer_path.relative_to(REPO_ROOT)),
        "sha256": sha256(batch_renderer_path),
    }
    camera_config = {
        **config["camera"],
        "orthoScale": round(config["camera"]["orthoScale"] * 1.05, 6),
        "batchPaddingScale": 1.05,
    }
    report = {
        "schemaVersion": 1,
        "status": "batch_technical_complete_pending_human_review",
        "stage": "batch",
        "pipelineVersion": config["pipelineVersion"],
        "revision": config["revision"],
        "runId": args.run_id,
        "role": args.role,
        "canonicalId": candidate["canonicalId"],
        "worktree": str(REPO_ROOT),
        "branch": config["branch"],
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "source": {
            "path": str(source_path),
            "repositoryPath": str(source_path.relative_to(REPO_ROOT)),
            "sha256": sha256(source_path),
            "license": config["sourcePolicy"]["license"],
        },
        "license": {
            "path": str(license_path),
            "repositoryPath": str(license_path.relative_to(REPO_ROOT)),
            "sha256": sha256(license_path),
        },
        "coverage": candidate["coverage"],
        "technicalCorrection": candidate["technicalCorrection"],
        "normalization": normalization,
        "unitScale": round(unit_scale, 8),
        "materialTreatment": material_treatment,
        "bodyMaterials": body_report,
        "headMaterials": head_report,
        "geometryChanges": geometry_changes,
        "skinnedClothing": skinned_clothing,
        "accessories": accessory_report,
        "declaredAccessoryOrder": candidate["accessories"],
        "anchors": sorted({obj["wp_character_bone"] for obj in accessories}),
        "maxAccessoryDrift": max_drift,
        "accessoryDriftByAction": drift_report,
        "rig": {
            "armature": armature.name,
            "bones": len(armature.data.bones),
            "boneNames": [bone.name for bone in armature.data.bones],
            "actions": len(bpy.data.actions),
        },
        "animations": {
            "idle": common.action_report(idle_action),
            "walk": common.action_report(walk_action),
            "walkFrames": walk_frames,
        },
        "camera": camera_config,
        "sourceCamera": config["camera"],
        "render": config["render"],
        "matrix": config["matrix"]["batchContract"],
        "headDimensionsMeters": smoke.vector_list(head_size),
        "atlasHashesBefore": atlas_before,
        "atlasHashesAfter": {},
        "dependencies": dependencies,
        "batchRendered": True,
        "runtimePromotion": False,
        "approval": "pending_human",
        "humanApprovalClaimed": False,
        "visualRisks": candidate["visualRisks"],
        "outputs": [],
    }
    for direction in DIRECTIONS:
        camera, _ = runtime_asset.place_camera(
            camera_config["targetZ"],
            camera_config["orthoScale"],
            name=f"WP04_BATCH_{args.role.upper()}_D{direction}",
            azimuth_degrees=config["camera"]["azimuthBaseDegrees"]
            + direction * config["camera"]["azimuthStepDegrees"],
        )
        for expected_direction, animation, sample_index, action_frame, filename in expected_outputs(args.role):
            if expected_direction != direction:
                continue
            action = idle_action if animation == "idle" else walk_action
            worker.bind_action(armature, action)
            path = output_dir / filename
            sample = worker.render_frame(
                objects,
                armature,
                bpy.context.scene,
                camera,
                action_frame,
                direction,
                animation,
                sample_index,
                path,
                common,
                source_import,
                {**config, "materialMode": "source", "walkSamples": 8},
            )
            sample["runId"] = args.run_id
            body_mins, _ = source_import.world_bounds([body])
            sample["bodyMinZ"] = round(float(body_mins.z), 6)
            sample["supportMesh"] = body.name
            sample["bonePositions"] = {
                bone.name: {
                    "head": smoke.vector_list(common.bone_position(armature, bone.name, "head")),
                    "tail": smoke.vector_list(common.bone_position(armature, bone.name, "tail")),
                }
                for bone in armature.data.bones
            }
            sample["compositionSidecar"] = str(path.with_suffix(".composition.json").relative_to(REPO_ROOT))
            sample["actionReport"] = common.action_report(action)
            if skinned_clothing:
                mins, maxs = source_import.world_bounds([jacket])
                skinned_clothing["batchPoseBounds"].append(
                    {
                        "direction": direction,
                        "animation": animation,
                        "sampleIndex": sample_index,
                        "actionFrame": action_frame,
                        "boundsMeters": {"min": smoke.vector_list(mins), "max": smoke.vector_list(maxs)},
                        "sizeMeters": smoke.vector_list(maxs - mins),
                    }
                )
            report["outputs"].append(sample)

    if len(report["outputs"]) != 36:
        raise RuntimeError(f"Expected 36 outputs, got {len(report['outputs'])}")
    report["atlasHashesAfter"] = smoke.packed_atlas_hashes(objects)
    report["atlasHashPayloadsUnchanged"] = sorted(report["atlasHashesBefore"].values()) == sorted(report["atlasHashesAfter"].values())
    # Blender renames local material keys after render; packed payload hashes must remain identical.
    if not report["atlasHashPayloadsUnchanged"]:
        raise RuntimeError("Packed atlas payload hashes changed during batch rendering")
    if sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError("Source GLB changed during rendering")
    if sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("License file changed during rendering")
    report_path = output_dir / f"{args.role}-batch.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report_hash = sha256(report_path)
    for sample in report["outputs"]:
        image_path = REPO_ROOT / sample["image"]["path"]
        sidecar_path = REPO_ROOT / sample["compositionSidecar"]
        sidecar = {
            "schemaVersion": 1,
            "runId": args.run_id,
            "role": args.role,
            "canonicalId": candidate["canonicalId"],
            "stage": "batch",
            "direction": sample["direction"],
            "animation": sample["animation"],
            "sampleIndex": sample["sampleIndex"],
            "actionFrame": sample["frame"],
            "source": report["source"],
            "license": report["license"],
            "manifest": report["manifest"],
            "manifestSha256": report["manifestSha256"],
            "dependencies": dependencies,
            "blender": report["blender"],
            "buildHash": report["buildHash"],
            "declaredAccessoryOrder": candidate["accessories"],
            "accessoryObjectCount": len(accessories),
            "accessories": accessory_report,
            "maxAccessoryDrift": max_drift,
            "accessoryDriftByAction": drift_report,
            "skinnedClothing": skinned_clothing,
            "geometryChanges": geometry_changes,
            "camera": camera_config,
            "render": config["render"],
            "cameraBounds": sample["cameraBounds"],
            "ground": {
                "minZ": sample["minZ"],
                "bodyMinZ": sample["bodyMinZ"],
                "supportMesh": sample["supportMesh"],
                "groundingOffsetMeters": sample["groundingOffsetMeters"],
                "toleranceMeters": config["acceptance"]["groundToleranceMeters"],
            },
            "output": sample["image"],
            "metadata": {
                "path": str(report_path.relative_to(REPO_ROOT)),
                "sha256": report_hash,
            },
            "atlasHashesBefore": atlas_before,
            "atlasHashesAfter": report["atlasHashesAfter"],
            "batchRendered": True,
            "runtimePromotion": False,
            "approval": "pending_human",
            "humanApprovalClaimed": False,
        }
        sidecar_path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        if sha256(image_path) != sample["image"]["sha256"]:
            raise RuntimeError("Rendered image hash changed while writing sidecar")
    print(
        json.dumps(
            {
                "status": "batch_rendered_pending_human_review",
                "role": args.role,
                "canonicalId": candidate["canonicalId"],
                "frames": len(report["outputs"]),
                "report": str(report_path),
            },
            ensure_ascii=False,
        )
    )
    print(f"WP_CHAR_04_BATCH_OK {args.role} {args.run_id}")


if __name__ == "__main__":
    main()

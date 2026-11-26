#!/usr/bin/env python3
"""Independently validate the complete non-promoted WP-CHAR-04 batch."""

import argparse
import copy
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
DIRECTIONS = [0, 1, 2, 3]
WALK_SAMPLES = list(range(8))
WALK_ACTION_FRAMES = [0, 2, 4, 6, 8, 10, 12, 14]
WALK_DELTA_REVIEW_THRESHOLD = 0.01
WALK_SEQUENCE_MIN_THRESHOLD = 0.005


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def expected_contract():
    return {
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


def contract_errors(config):
    errors = []
    contract = config.get("matrix", {}).get("batchContract")
    if not isinstance(contract, dict):
        return ["missing batchContract"]
    for key, value in expected_contract().items():
        if contract.get(key) != value:
            errors.append(f"batchContract.{key} must be {value!r}")
    if config.get("runtimePromotion") is not False:
        errors.append("runtimePromotion must be false")
    if config.get("humanApprovalClaimed") is not False:
        errors.append("humanApprovalClaimed must be false")
    if len(config.get("candidates", {})) != 14:
        errors.append("exactly 14 candidates are required")
    return errors


def expected_matrix():
    matrix = []
    for direction in DIRECTIONS:
        matrix.append((direction, "idle", 0, 0))
        for sample_index, action_frame in enumerate(WALK_ACTION_FRAMES):
            matrix.append((direction, "walk", sample_index, action_frame))
    return matrix


def expected_filename(role, direction, animation, sample_index):
    return f"{role}-d{direction}-{animation}-{sample_index:02d}.png"


def run_self_tests(manifest_path):
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    cases = []
    mutated = copy.deepcopy(config)
    mutated["matrix"]["batchContract"]["totalFrames"] = 28
    cases.append(("smoke count rejected", contract_errors(mutated), "batchContract.totalFrames"))
    mutated = copy.deepcopy(config)
    mutated["matrix"]["batchContract"]["directions"] = [0]
    cases.append(("single direction rejected", contract_errors(mutated), "batchContract.directions"))
    mutated = copy.deepcopy(config)
    mutated["runtimePromotion"] = True
    cases.append(("runtime promotion rejected", contract_errors(mutated), "runtimePromotion"))
    mutated = copy.deepcopy(config)
    mutated["humanApprovalClaimed"] = True
    cases.append(("human approval claim rejected", contract_errors(mutated), "humanApprovalClaimed"))
    for name, errors, fragment in cases:
        if not any(fragment in error for error in errors):
            raise RuntimeError(f"self-test missed: {name}")
    matrix = expected_matrix()
    if len(matrix) != 36 or len(set(matrix)) != 36:
        raise RuntimeError("self-test missed: batch matrix must contain 36 unique samples")
    if expected_filename("role", 3, "walk", 7) != "role-d3-walk-07.png":
        raise RuntimeError("self-test missed: batch filename contract")
    print(json.dumps({"status": "passed", "tests": len(cases) + 2, "framesPerRole": len(matrix)}))


def pixel_mad(left, right, left_alpha, right_alpha):
    visible = (left_alpha > 2) | (right_alpha > 2)
    if not visible.any():
        return 0.0
    return float(np.abs(left[:, :, :3] - right[:, :, :3])[visible].mean())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--run-root")
    parser.add_argument("--output")
    parser.add_argument("--skip-sheet", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    if args.self_test:
        run_self_tests(manifest_path)
        return
    if not args.run_root:
        parser.error("--run-root is required unless --self-test is used")
    run_root = Path(args.run_root).resolve()
    output_path = Path(args.output).resolve() if args.output else run_root / "batch-validation.json"
    if output_path.exists():
        raise RuntimeError(f"Validation output already exists: {output_path}")
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    execution = json.loads((run_root / "execution.json").read_text(encoding="utf-8"))
    sheet_available = not args.skip_sheet
    sheet = json.loads((run_root / "final-sheet.json").read_text(encoding="utf-8")) if sheet_available else {"inputs": [], "roleSheets": [], "sheet": {}}
    errors = []
    warnings = []
    checks = []
    role_summaries = []
    all_image_hashes = []
    hash_paths = defaultdict(list)

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    for error in contract_errors(config):
        check(False, error)
    check(execution.get("stage") == "batch", "execution stage is batch")
    check(execution.get("runId") == run_root.name, "run id matches fresh directory")
    check(execution.get("roleCount") == 14, "execution covers 14 roles")
    check(execution.get("renderedRoleCount") == 14, "execution rendered 14 roles")
    check(execution.get("renderedFrames") == 504, "execution rendered 504 frames")
    check(execution.get("expectedFrames") == 504, "execution expects 504 frames")
    check(execution.get("batchRendered") is True, "execution declares complete batch")
    check(execution.get("runtimePromotion") is False, "execution did not promote runtime")
    check(execution.get("humanApprovalClaimed") is False, "execution claims no human approval")
    check(execution.get("failures") == [], "execution has no failures")
    check(execution.get("branch") == config.get("branch"), "execution branch matches manifest")
    check(execution.get("blender", {}).get("version") == config["toolchain"]["blenderVersion"], "Blender version")
    check(execution.get("blender", {}).get("buildHash") == config["toolchain"]["blenderBuildHash"], "Blender build hash")
    check(execution.get("blender", {}).get("pythonExitCodeFlag") == 1, "Python exit-code flag is 1")
    check(execution.get("manifest", {}).get("sha256") == sha256(manifest_path), "execution manifest hash")
    check(execution.get("matrix") == config["matrix"]["batchContract"], "execution matrix matches contract")
    for name, dependency in execution.get("dependencies", {}).items():
        path = REPO_ROOT / dependency["repositoryPath"]
        check(path.exists() and sha256(path) == dependency["sha256"], f"dependency hash: {name}")
    license_path = REPO_ROOT / config["sourcePolicy"]["licenseFile"]
    check(sha256(license_path) == config["sourcePolicy"]["licenseFileSha256"], "Kenney license hash")

    execution_roles = {entry["role"]: entry for entry in execution.get("roles", [])}
    check(set(execution_roles) == set(config["candidates"]), "execution role set is exact")
    sheet_inputs = {(item["role"], item["direction"], item["animation"], item["sampleIndex"]): item for item in sheet.get("inputs", [])}
    if sheet_available:
        check(len(sheet_inputs) == 504 and len(sheet.get("inputs", [])) == 504, "final sheet lists 504 unique frame inputs")
        check(sheet.get("roleCount") == 14 and sheet.get("frameCount") == 504, "final sheet counts")
        check(sheet.get("offlineComposition") is True and sheet.get("engineCapture") is False, "final sheet is offline")
        check(sheet.get("runtimePromotion") is False and sheet.get("humanApprovalClaimed") is False, "final sheet claims no approval or promotion")
        check(sheet.get("batchRendered") is True, "final sheet identifies complete batch")
        check(sheet.get("scaleMode") == "full_canvas_common_scale", "final sheet preserves common scale and grounding")

    for role, candidate in config["candidates"].items():
        role_error_start = len(errors)
        run = execution_roles.get(role)
        check(run is not None, f"execution entry: {role}")
        if run is None:
            continue
        check(run.get("passed") is True, f"execution role passed: {role}")
        check(run.get("exitCode") == 0 and run.get("signal") is None, f"zero process exit: {role}")
        check(run.get("tracebackDetected") is False, f"no traceback: {role}")
        check(run.get("sentinelDetected") is True, f"current-run sentinel: {role}")
        check(run.get("freshOutputRoot") is True and not run.get("staleOutputs"), f"fresh outputs: {role}")
        check(not run.get("missingOutputs") and not run.get("undeclaredPngs"), f"exact output set: {role}")
        command = run.get("command", [])
        check(
            bool(command)
            and command[0] == config["toolchain"]["blenderPath"]
            and "--python-exit-code" in command
            and command[command.index("--python-exit-code") + 1] == "1",
            f"hardened Blender invocation: {role}",
        )
        log_path = REPO_ROOT / run["log"]["path"]
        check(log_path.exists() and sha256(log_path) == run["log"]["sha256"], f"execution log hash: {role}")
        if log_path.exists():
            log_text = log_path.read_text(encoding="utf-8")
            check("Traceback (most recent call last)" not in log_text, f"log has no traceback: {role}")
            check(run["sentinelExpected"] in log_text, f"log contains sentinel: {role}")

        report_path = run_root / "roles" / role / f"{role}-batch.json"
        check(report_path.exists(), f"batch report exists: {role}")
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        check(report.get("status") == "batch_technical_complete_pending_human_review", f"report status: {role}")
        check(report.get("stage") == "batch" and report.get("runId") == execution["runId"], f"report identity: {role}")
        check(report.get("canonicalId") == candidate["canonicalId"], f"canonical id: {role}")
        check(report.get("manifestSha256") == sha256(manifest_path), f"report manifest hash: {role}")
        check(report.get("batchRendered") is True, f"report complete batch: {role}")
        check(report.get("runtimePromotion") is False and report.get("humanApprovalClaimed") is False, f"report no promotion/approval: {role}")
        check(report.get("approval") == "pending_human", f"report approval pending: {role}")
        check(report.get("matrix") == config["matrix"]["batchContract"], f"report matrix: {role}")
        expected_ortho = round(config["camera"]["orthoScale"] * 1.05, 6)
        check(report.get("camera", {}).get("orthoScale") == expected_ortho, f"batch camera padding: {role}")
        check(report.get("camera", {}).get("batchPaddingScale") == 1.05, f"batch padding declaration: {role}")
        check(report.get("sourceCamera") == config["camera"], f"source camera preserved: {role}")
        source_path = REPO_ROOT / candidate["sourcePath"]
        check(source_path.exists() and sha256(source_path) == candidate["sourceSha256"], f"source GLB hash: {role}")
        check(report["source"]["sha256"] == candidate["sourceSha256"], f"report source hash: {role}")
        check(report["license"]["sha256"] == config["sourcePolicy"]["licenseFileSha256"], f"report license hash: {role}")
        check(report["rig"]["bones"] == 7 and report["rig"]["actions"] == 32, f"Kenney rig/actions: {role}")
        check(set(report["rig"]["boneNames"]) == {"root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"}, f"Kenney bone names: {role}")
        check(sorted(report["atlasHashesBefore"].values()) == sorted(report["atlasHashesAfter"].values()), f"packed atlas payload hashes unchanged: {role}")
        check(report.get("atlasHashPayloadsUnchanged") is True, f"atlas payload declaration: {role}")
        check(report["maxAccessoryDrift"] <= config["acceptance"]["accessoryDriftTolerance"], f"accessory drift: {role}")
        drift = report.get("accessoryDriftByAction", {})
        check(drift.get("idle", 1) <= config["acceptance"]["accessoryDriftTolerance"], f"idle accessory drift measured: {role}")
        check(drift.get("walk", 1) <= config["acceptance"]["accessoryDriftTolerance"], f"walk accessory drift measured: {role}")
        check(drift.get("max") == report["maxAccessoryDrift"], f"accessory drift summary: {role}")
        check(report["declaredAccessoryOrder"] == candidate["accessories"], f"declared accessory order: {role}")
        for name, dependency in report["dependencies"].items():
            execution_name = "smokeRenderer" if name == "renderer" else name
            check(execution["dependencies"].get(execution_name, {}).get("sha256") == dependency["sha256"], f"report dependency {name}: {role}")

        outputs = report.get("outputs", [])
        check(len(outputs) == 36, f"36 batch frames: {role}")
        by_key = {(item["direction"], item["animation"], item["sampleIndex"]): item for item in outputs}
        check(set(by_key) == {(direction, animation, sample) for direction, animation, sample, _ in expected_matrix()}, f"batch matrix keys: {role}")
        direction_summaries = []
        for direction in DIRECTIONS:
            images = {}
            alphas = {}
            walk_deltas = []
            for expected_direction, animation, sample_index, action_frame in expected_matrix():
                if expected_direction != direction:
                    continue
                key = (direction, animation, sample_index)
                item = by_key.get(key)
                check(item is not None, f"output identity: {role} {key}")
                if item is None:
                    continue
                check(item["direction"] == direction, f"direction: {role} {key}")
                check(item["frame"] == action_frame, f"action frame: {role} {key}")
                check(item["action"] == animation, f"action identity: {role} {key}")
                check(item["azimuthDegrees"] == config["camera"]["azimuthBaseDegrees"] + direction * config["camera"]["azimuthStepDegrees"], f"camera azimuth: {role} {key}")
                filename = expected_filename(role, direction, animation, sample_index)
                image_path = run_root / "roles" / role / filename
                check(str(image_path.relative_to(REPO_ROOT)) == item["image"]["path"], f"image path: {role} {key}")
                check(image_path.exists() and sha256(image_path) == item["image"]["sha256"], f"image hash: {role} {key}")
                check(run["outputHashes"].get(item["image"]["path"]) == item["image"]["sha256"], f"execution image hash: {role} {key}")
                if sheet_available:
                    sheet_input = sheet_inputs.get((role, direction, animation, sample_index))
                    check(sheet_input is not None and sheet_input["path"] == item["image"]["path"] and sheet_input["sha256"] == item["image"]["sha256"], f"sheet input hash: {role} {key}")
                if not image_path.exists():
                    continue
                with Image.open(image_path) as image:
                    check(image.size == (512, 512) and image.mode == "RGBA", f"RGBA 512x512: {role} {key}")
                    array = np.asarray(image)
                    alpha = array[:, :, 3]
                    check(bool((alpha > 2).any()), f"nonempty alpha: {role} {key}")
                    check(not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"transparent borders: {role} {key}")
                    magenta = (array[:, :, 0] > 240) & (array[:, :, 1] < 40) & (array[:, :, 2] > 240)
                    check(not bool(magenta.any()), f"no magenta pixels: {role} {key}")
                    images[(animation, sample_index)] = array.astype(np.float32)
                    alphas[(animation, sample_index)] = alpha
                check(not item["cameraBounds"]["clipped"], f"camera unclipped: {role} {key}")
                check(min(item["cameraBounds"]["minX"], item["cameraBounds"]["minY"]) >= 0 and max(item["cameraBounds"]["maxX"], item["cameraBounds"]["maxY"]) <= 1, f"camera bounds in frame: {role} {key}")
                check(abs(item["minZ"]) <= config["acceptance"]["groundToleranceMeters"], f"ground support: {role} {key}")
                check(item.get("supportMesh") == "body-mesh" and abs(item.get("bodyMinZ", 1)) <= config["acceptance"]["groundToleranceMeters"], f"body support grounding: {role} {key}")
                all_image_hashes.append(item["image"]["sha256"])
                hash_paths[item["image"]["sha256"]].append(f"{role}/d{direction}/{animation}-{sample_index}")
                sidecar_path = REPO_ROOT / item["compositionSidecar"]
                check(sidecar_path.exists(), f"composition sidecar exists: {role} {key}")
                if sidecar_path.exists():
                    sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
                    check(sidecar["runId"] == execution["runId"], f"sidecar run id: {role} {key}")
                    check(sidecar["role"] == role and sidecar["canonicalId"] == candidate["canonicalId"], f"sidecar identity: {role} {key}")
                    check(sidecar["direction"] == direction and sidecar["animation"] == animation and sidecar["sampleIndex"] == sample_index and sidecar["actionFrame"] == action_frame, f"sidecar frame identity: {role} {key}")
                    check(sidecar["stage"] == "batch" and sidecar["batchRendered"] is True, f"sidecar batch identity: {role} {key}")
                    check(sidecar["output"]["sha256"] == item["image"]["sha256"], f"sidecar image hash: {role} {key}")
                    check(sidecar["metadata"]["sha256"] == sha256(report_path), f"sidecar metadata hash: {role} {key}")
                    check(sidecar["maxAccessoryDrift"] <= config["acceptance"]["accessoryDriftTolerance"], f"sidecar drift: {role} {key}")
                    check(sidecar["runtimePromotion"] is False and sidecar["humanApprovalClaimed"] is False and sidecar["approval"] == "pending_human", f"sidecar status: {role} {key}")
            if ("idle", 0) in images:
                idle = images[("idle", 0)]
                idle_alpha = alphas[("idle", 0)]
                for sample_index in WALK_SAMPLES:
                    key = ("walk", sample_index)
                    if key not in images:
                        continue
                    delta = pixel_mad(idle, images[key], idle_alpha, alphas[key])
                    walk_deltas.append(delta)
                    if delta < WALK_DELTA_REVIEW_THRESHOLD:
                        warnings.append(f"{role}: D{direction} walk sample {sample_index} vs idle pixel MAD {delta:.8f} is below {WALK_DELTA_REVIEW_THRESHOLD}; source pose needs visual review, not automatic walk approval.")
                adjacent = []
                for left, right in zip(WALK_SAMPLES, WALK_SAMPLES[1:]):
                    if ("walk", left) in images and ("walk", right) in images:
                        adjacent.append(pixel_mad(images[("walk", left)], images[("walk", right)], alphas[("walk", left)], alphas[("walk", right)]))
                check(len(adjacent) == 7 and all(delta >= WALK_SEQUENCE_MIN_THRESHOLD for delta in adjacent), f"every adjacent walk pair has visible motion: {role} D{direction}")
                direction_summaries.append(
                    {
                        "direction": direction,
                        "idleToWalkMinPixelMad": min(walk_deltas) if walk_deltas else None,
                        "idleToWalkMaxPixelMad": max(walk_deltas) if walk_deltas else None,
                        "maxAdjacentWalkPixelMad": max(adjacent) if adjacent else None,
                    }
                )
        if role == "enforcer_female":
            clothing = report.get("skinnedClothing")
            check(clothing is not None and clothing["type"] == "skinned_padded_jacket_v2", "enforcer-female justified skinned jacket exists")
            check(clothing and clothing["rigidPanels"] is False, "enforcer-female has no rigid jacket panels")
            check(clothing and len(clothing.get("batchPoseBounds", [])) == 36, "enforcer-female jacket measured in all 36 poses")
            check(clothing and any(modifier["type"] == "ARMATURE" for modifier in clothing["collarModifiers"]), "enforcer-female collar is skinned")
        role_summaries.append(
            {
                "role": role,
                "canonicalId": candidate["canonicalId"],
                "frames": len(outputs),
                "maxAccessoryDrift": report["maxAccessoryDrift"],
                "cameraClipped": any(item["cameraBounds"]["clipped"] for item in outputs),
                "groundMaxAbsMinZ": max(abs(item["minZ"]) for item in outputs),
                "directions": direction_summaries,
                "technicalStatus": "passed_pending_human_visual_review" if len(errors) == role_error_start else "failed",
            }
        )

    check(len(all_image_hashes) == 504, "504 frame hashes recorded")
    duplicate_groups = [
        {"sha256": digest, "frames": paths}
        for digest, paths in sorted(hash_paths.items())
        if len(paths) > 1
    ]
    cross_role_or_direction_duplicates = [
        group
        for group in duplicate_groups
        if len({frame.split("/")[0] for frame in group["frames"]}) > 1
        or len({frame.split("/")[1] for frame in group["frames"]}) > 1
    ]
    check(not cross_role_or_direction_duplicates, "no duplicate frames across roles or directions")
    walk_duplicate_groups = [
        group
        for group in duplicate_groups
        if all("/walk-" in frame for frame in group["frames"])
    ]
    check(not walk_duplicate_groups, "no duplicate walk samples within a role and direction")
    if sheet_available:
        overview_path = REPO_ROOT / sheet["sheet"]["path"]
        check(overview_path.exists() and sha256(overview_path) == sheet["sheet"]["sha256"], "final overview sheet hash")
        check(overview_path.exists() and overview_path.stat().st_size < 8 * 1024 * 1024, "final overview sheet below 8 MiB")
        check(len(sheet.get("roleSheets", [])) == 14, "14 per-role review sheets")
        for role_sheet in sheet.get("roleSheets", []):
            path = REPO_ROOT / role_sheet["path"]
            check(path.exists() and sha256(path) == role_sheet["sha256"], f"role sheet hash: {role_sheet['role']}")
            check(role_sheet["frames"] == 36, f"role sheet frame count: {role_sheet['role']}")

    result = {
        "schemaVersion": 1,
        "stage": "batch",
        "status": "passed" if not errors else "failed",
        "runId": execution["runId"],
        "runRoot": str(run_root.relative_to(REPO_ROOT)),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "checkCount": len(checks),
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "errors": errors,
        "warnings": warnings,
        "roles": role_summaries,
        "counts": {
            "roles": len(role_summaries),
            "frames": len(all_image_hashes),
            "uniqueFrameHashes": len(set(all_image_hashes)),
            "duplicateHashGroups": len(duplicate_groups),
            "directions": 4,
            "idleFramesPerRole": 4,
            "walkFramesPerRole": 32,
            "finalSheetInputs": len(sheet.get("inputs", [])),
            "roleSheets": len(sheet.get("roleSheets", [])),
        },
        "duplicateHashGroups": duplicate_groups,
        "walkDeltaReviewThreshold": WALK_DELTA_REVIEW_THRESHOLD,
        "walkSequenceMinThreshold": WALK_SEQUENCE_MIN_THRESHOLD,
        "technicalValidation": "passed" if not errors else "failed",
        "artisticApproval": "pending_human",
        "humanApprovalClaimed": False,
        "runtimePromotion": False,
        "productionReady": False,
        "batchRendered": not errors,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": result["checkCount"], "errors": result["errorCount"], "warnings": result["warningCount"], "counts": result["counts"], "output": str(output_path)}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

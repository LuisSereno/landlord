#!/usr/bin/env python3
"""Independently validate WP-CHAR-04 SMOKE execution and evidence."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WALK_DELTA_REVIEW_THRESHOLD = 0.01


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    run_root = Path(args.run_root).resolve()
    output_path = Path(args.output).resolve() if args.output else run_root / "smoke-validation.json"
    if output_path.exists():
        raise RuntimeError(f"Validation output already exists: {output_path}")
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    execution_path = run_root / "execution.json"
    contact_manifest_path = run_root / "contact-sheet.json"
    execution = json.loads(execution_path.read_text(encoding="utf-8"))
    contact = json.loads(contact_manifest_path.read_text(encoding="utf-8"))
    errors = []
    warnings = []
    checks = []
    role_summaries = []
    all_image_hashes = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(config["stage"] == "smoke", "manifest stage is smoke")
    check(config["runtimePromotion"] is False, "manifest forbids runtime promotion")
    check(config["humanApprovalClaimed"] is False, "manifest claims no human approval")
    check(config["matrix"]["batchContract"]["rendered"] is False, "eventual batch is not rendered")
    check(config["matrix"]["smoke"]["totalFrames"] == 28, "manifest declares 28 smoke frames")
    check(len(config["candidates"]) == 14, "manifest declares 14 candidates")
    check(execution["stage"] == "smoke", "execution stage is smoke")
    check(execution["runId"] == run_root.name, "run id matches fresh run directory")
    check(execution["branch"] == config["branch"], "execution branch matches manifest")
    check(execution["roleCount"] == 14, "execution covers 14 roles")
    check(execution["renderedRoleCount"] == 14, "execution rendered 14 roles")
    check(execution["renderedFrames"] == 28, "execution rendered 28 frames")
    check(execution["expectedFrames"] == 28, "execution expects 28 frames")
    check(execution["failures"] == [], "execution has no role failures")
    check(execution["batchRendered"] is False, "execution did not render batch")
    check(execution["runtimePromotion"] is False, "execution did not promote runtime")
    check(execution["humanApprovalClaimed"] is False, "execution claims no human approval")
    check(execution["blender"]["path"] == config["toolchain"]["blenderPath"], "exact Blender path")
    check(execution["blender"]["version"] == config["toolchain"]["blenderVersion"], "Blender version")
    check(execution["blender"]["buildHash"] == config["toolchain"]["blenderBuildHash"], "Blender build hash")
    check(execution["blender"]["pythonExitCodeFlag"] == 1, "Python exit-code flag is 1")
    check(execution["manifest"]["sha256"] == sha256(manifest_path), "execution manifest hash")
    for name, dependency in execution["dependencies"].items():
        path = REPO_ROOT / dependency["repositoryPath"]
        check(path.exists() and sha256(path) == dependency["sha256"], f"dependency hash: {name}")
    license_path = REPO_ROOT / config["sourcePolicy"]["licenseFile"]
    check(sha256(license_path) == config["sourcePolicy"]["licenseFileSha256"], "Kenney license hash")

    execution_roles = {entry["role"]: entry for entry in execution["roles"]}
    for role, candidate in config["candidates"].items():
        run = execution_roles.get(role)
        check(run is not None, f"execution entry: {role}")
        if run is None:
            continue
        check(run["passed"] is True, f"execution role passed: {role}")
        check(run["exitCode"] == 0 and run["signal"] is None, f"zero process exit: {role}")
        check(run["tracebackDetected"] is False, f"no traceback: {role}")
        check(run["sentinelDetected"] is True, f"current-run sentinel: {role}")
        check(run["pythonExitCodeFlag"] == 1, f"python-exit-code 1: {role}")
        check(run["freshOutputRoot"] is True and not run["staleOutputs"], f"fresh outputs: {role}")
        check(not run["missingOutputs"] and not run["undeclaredPngs"], f"exact output set: {role}")
        command = run["command"]
        check(
            command[0] == config["toolchain"]["blenderPath"]
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

        report_path = run_root / "roles" / role / f"{role}-prototype.json"
        check(report_path.exists(), f"role report exists: {role}")
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        check(report["status"] == "smoke_technical_complete_pending_human_review", f"report status: {role}")
        check(report["stage"] == "smoke" and report["runId"] == execution["runId"], f"report identity: {role}")
        check(report["canonicalId"] == candidate["canonicalId"], f"canonical id: {role}")
        check(report["manifestSha256"] == sha256(manifest_path), f"report manifest hash: {role}")
        check(report["blender"] == config["toolchain"]["blenderVersion"], f"report Blender version: {role}")
        check(report["buildHash"] == config["toolchain"]["blenderBuildHash"], f"report Blender build: {role}")
        check(report["runtimePromotion"] is False and report["batchRendered"] is False, f"report no promotion/batch: {role}")
        check(report["approval"] == "pending_human" and report["humanApprovalClaimed"] is False, f"report approval pending: {role}")
        source_path = REPO_ROOT / candidate["sourcePath"]
        check(source_path.exists() and sha256(source_path) == candidate["sourceSha256"], f"source GLB hash: {role}")
        check(report["source"]["sha256"] == candidate["sourceSha256"], f"report source hash: {role}")
        check(report["license"]["sha256"] == config["sourcePolicy"]["licenseFileSha256"], f"report license hash: {role}")
        check(report["rig"]["bones"] == 7 and report["rig"]["actions"] == 32, f"Kenney rig/actions: {role}")
        check(set(report["rig"]["boneNames"]) == {"root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"}, f"Kenney bone names: {role}")
        check(
            sorted(report["atlasHashesBefore"].values()) == sorted(report["atlasHashesAfter"].values()),
            f"packed atlas hashes unchanged: {role}",
        )
        check(report["maxAccessoryDrift"] <= config["acceptance"]["accessoryDriftTolerance"], f"accessory drift: {role}")
        check(report["declaredAccessoryOrder"] == candidate["accessories"], f"declared accessory order: {role}")
        check(
            (not candidate["accessories"] and len(report["accessories"]) == 0)
            or (bool(candidate["accessories"]) and len(report["accessories"]) >= len(candidate["accessories"])),
            f"accessory objects: {role}",
        )
        for name, dependency in report["dependencies"].items():
            check(execution["dependencies"].get(name, {}).get("sha256") == dependency["sha256"], f"report dependency {name}: {role}")

        outputs = report["outputs"]
        check(len(outputs) == 2, f"two smoke frames: {role}")
        by_key = {(item["animation"], item["sampleIndex"]): item for item in outputs}
        smoke_walk_sample = candidate.get("smokeWalkSample", config["matrix"]["smoke"]["walkSamples"][0])
        check(set(by_key) == {("idle", 0), ("walk", smoke_walk_sample)}, f"smoke matrix keys: {role}")
        expected_frames = {("idle", 0): 0, ("walk", smoke_walk_sample): smoke_walk_sample * 2}
        images = {}
        alphas = {}
        for key, item in by_key.items():
            animation, sample_index = key
            check(item["direction"] == 0, f"D0 only: {role} {animation}")
            check(item["frame"] == expected_frames[key], f"action frame: {role} {animation}")
            check(item["action"] == animation, f"action identity: {role} {animation}")
            image_path = REPO_ROOT / item["image"]["path"]
            check(image_path.exists() and sha256(image_path) == item["image"]["sha256"], f"image hash: {role} {animation}")
            check(run["outputHashes"].get(item["image"]["path"]) == item["image"]["sha256"], f"execution image hash: {role} {animation}")
            if not image_path.exists():
                continue
            with Image.open(image_path) as image:
                check(image.size == (512, 512) and image.mode == "RGBA", f"RGBA 512x512: {role} {animation}")
                array = np.asarray(image)
                alpha = array[:, :, 3]
                check(bool((alpha > 2).any()), f"nonempty alpha: {role} {animation}")
                check(
                    not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()),
                    f"transparent borders: {role} {animation}",
                )
                magenta = (array[:, :, 0] > 240) & (array[:, :, 1] < 40) & (array[:, :, 2] > 240)
                check(not bool(magenta.any()), f"no magenta pixels: {role} {animation}")
                images[animation] = array.astype(np.float32)
                alphas[animation] = alpha
            check(not item["cameraBounds"]["clipped"], f"camera unclipped: {role} {animation}")
            check(
                min(item["cameraBounds"]["minX"], item["cameraBounds"]["minY"]) >= 0
                and max(item["cameraBounds"]["maxX"], item["cameraBounds"]["maxY"]) <= 1,
                f"camera bounds in frame: {role} {animation}",
            )
            check(abs(item["minZ"]) <= config["acceptance"]["groundToleranceMeters"], f"ground support: {role} {animation}")
            all_image_hashes.append(item["image"]["sha256"])
            sidecar_path = REPO_ROOT / item["compositionSidecar"]
            check(sidecar_path.exists(), f"composition sidecar exists: {role} {animation}")
            if sidecar_path.exists():
                sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
                check(sidecar["runId"] == execution["runId"], f"sidecar run id: {role} {animation}")
                check(sidecar["role"] == role and sidecar["canonicalId"] == candidate["canonicalId"], f"sidecar identity: {role} {animation}")
                check(sidecar["direction"] == 0 and sidecar["animation"] == animation and sidecar["sampleIndex"] == sample_index and sidecar["actionFrame"] == item["frame"], f"sidecar frame identity: {role} {animation}")
                check(sidecar["output"]["sha256"] == item["image"]["sha256"], f"sidecar image hash: {role} {animation}")
                check(sidecar["metadata"]["sha256"] == sha256(report_path), f"sidecar metadata hash: {role} {animation}")
                check(sidecar["declaredAccessoryOrder"] == candidate["accessories"], f"sidecar accessory order: {role} {animation}")
                check(sidecar["accessoryObjectCount"] == len(report["accessories"]), f"sidecar accessory count: {role} {animation}")
                check(sidecar["maxAccessoryDrift"] <= config["acceptance"]["accessoryDriftTolerance"], f"sidecar drift: {role} {animation}")
                check(sidecar["runtimePromotion"] is False and sidecar["approval"] == "pending_human", f"sidecar status: {role} {animation}")
                for name, dependency in sidecar["dependencies"].items():
                    check(execution["dependencies"].get(name, {}).get("sha256") == dependency["sha256"], f"sidecar dependency {name}: {role} {animation}")
        walk_delta = None
        if "idle" in images and "walk" in images:
            visible = (alphas["idle"] > 2) | (alphas["walk"] > 2)
            walk_delta = float(np.abs(images["idle"][:, :, :3] - images["walk"][:, :, :3])[visible].mean())
            if walk_delta < WALK_DELTA_REVIEW_THRESHOLD:
                warnings.append(f"{role}: D0 idle-00 vs walk-04 pixel MAD {walk_delta:.8f} is below the visual-review threshold {WALK_DELTA_REVIEW_THRESHOLD}; do not claim visible walk approval.")
        role_summaries.append(
            {
                "role": role,
                "canonicalId": candidate["canonicalId"],
                "frames": len(outputs),
                "maxAccessoryDrift": report["maxAccessoryDrift"],
                "walkIdlePixelMad": walk_delta,
                "cameraClipped": any(item["cameraBounds"]["clipped"] for item in outputs),
                "groundMaxAbsMinZ": max(abs(item["minZ"]) for item in outputs),
                "technicalStatus": "passed_pending_human_visual_review",
            }
        )

        if role == "enforcer_female":
            clothing = report.get("skinnedClothing")
            check(clothing is not None and clothing["type"] == "skinned_padded_jacket_v2", "enforcer-female justified skinned jacket exists")
            check(clothing and clothing["rigidPanels"] is False, "enforcer-female has no rigid jacket panels")
            check(clothing and clothing["volumeComponents"] == candidate["meshAdaptation"]["volumeComponents"], "enforcer-female jacket volume components")
            check(clothing and clothing["collarSourceComponents"] == candidate["meshAdaptation"]["collarSourceComponents"], "enforcer-female collar source components")
            check(clothing and any(modifier["type"] == "ARMATURE" for modifier in clothing["collarModifiers"]), "enforcer-female collar is skinned")
            weapon_change = next((item for item in report["geometryChanges"] if item["operation"] == "identified_incompatible_weapon_components"), None)
            check(weapon_change and weapon_change["components"] == candidate["bodyRemoveComponents"], "enforcer-female weapon components removed")
            check(weapon_change and weapon_change["polygons"] == 176, "enforcer-female removed 176 weapon polygons")
        if role == "supervisor":
            check(any(item.get("components") == [2] for item in report["geometryChanges"] if item["operation"] == "delete_local_components"), "supervisor glasses correction reused")
        if role == "enforcer_male":
            check(any(item.get("components") == [1, 5] for item in report["geometryChanges"] if item["operation"] == "delete_local_components"), "enforcer ponytail/mouth correction reused")
        if role == "firefighter":
            check(any(item.get("components") == [2] for item in report["geometryChanges"] if item["operation"] == "delete_local_components"), "firefighter glasses correction reused")

    check(len(all_image_hashes) == 28 and len(set(all_image_hashes)) == 28, "28 globally unique smoke images")
    check(contact["offlineComposition"] is True and contact["engineCapture"] is False, "contact sheet is offline")
    check(contact["roleCount"] == 14 and contact["frameCount"] == 28, "contact sheet counts")
    check(contact["runtimePromotion"] is False and contact["humanApprovalClaimed"] is False, "contact sheet status")
    check(len(contact["inputs"]) == 28, "contact sheet input count")
    sheet_path = REPO_ROOT / contact["sheet"]["path"]
    check(sheet_path.exists() and sha256(sheet_path) == contact["sheet"]["sha256"], "contact sheet hash")
    check(sheet_path.exists() and sheet_path.stat().st_size < 1024 * 1024, "contact sheet below 1 MiB")
    for item in contact["inputs"]:
        path = REPO_ROOT / item["path"]
        check(path.exists() and sha256(path) == item["sha256"], f"contact input hash: {item['role']} {item['animation']}")
    diagnostics = REPO_ROOT / config["enforcerFemaleDiagnostics"]["controlsDirectory"]
    for name in config["enforcerFemaleDiagnostics"]["controls"]:
        check((diagnostics / name).exists(), f"enforcer-female diagnostic control: {name}")

    result = {
        "schemaVersion": 1,
        "stage": "smoke",
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
            "contactSheetInputs": len(contact["inputs"]),
        },
        "walkDeltaReviewThreshold": WALK_DELTA_REVIEW_THRESHOLD,
        "technicalValidation": "passed" if not errors else "failed",
        "artisticApproval": "pending_human",
        "humanApprovalClaimed": False,
        "runtimePromotion": False,
        "productionReady": False,
        "batchRendered": False,
        "unresolvedVisualIssues": [*config["unresolvedIssues"], *warnings],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": result["status"],
                "checks": result["checkCount"],
                "errors": result["errorCount"],
                "warnings": result["warningCount"],
                "counts": result["counts"],
                "output": str(output_path),
            },
            ensure_ascii=False,
        )
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

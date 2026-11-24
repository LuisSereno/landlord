#!/usr/bin/env python3
"""Valida arte, sprites, capturas Phaser y controles WP-CHAR-03."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
BASE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-03"
EXPECTED_SOURCES = {
    "supervisor": "7b67dbd3b1873a8182e78b1764db008496e4c3b871db59f45ed224852c238fd4",
    "enforcer": "00db0d50e4da865d95c7fd9caad9a49277f8809423f5d318387caa1dce7861d4",
    "firefighter": "c1cba637e1d946822df07385fabf9d1bc55255ce19e0e8f7124d767e03987126",
}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    checks = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    all_hashes = []
    for role, expected_source in EXPECTED_SOURCES.items():
        report_path = BASE / "prototypes" / role / "final" / f"{role}-prototype.json"
        check(report_path.exists(), f"final report exists: {role}")
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        outputs = report["outputs"]
        check(len(outputs) == 12, f"12 final frames: {role}")
        check(report["source"]["sha256"] == expected_source, f"source hash: {role}")
        check(report["manifestSha256"] == sha256(manifest_path), f"manifest hash: {role}")
        check(report["rig"]["bones"] == 7 and report["rig"]["actions"] == 32, f"Kenney rig/actions: {role}")
        check(report["maxAccessoryDrift"] <= 1e-4, f"accessory drift: {role}")
        check(bool(report["geometryChanges"]), f"documented local geometry correction: {role}")
        idle = [item for item in outputs if item["animation"] == "idle"]
        walk = sorted((item for item in outputs if item["animation"] == "walk"), key=lambda item: item["sampleIndex"])
        check(len(idle) == 4 and {item["direction"] for item in idle} == {0, 1, 2, 3}, f"four idle directions: {role}")
        check(len(walk) == 8 and [item["frame"] for item in walk] == [0, 2, 4, 6, 8, 10, 12, 14], f"eight walk D0: {role}")
        for item in outputs:
            path = REPO_ROOT / item["image"]["path"]
            check(path.exists() and sha256(path) == item["image"]["sha256"], f"frame hash: {role} {item['image']['path']}")
            if not path.exists():
                continue
            with Image.open(path) as image:
                check(image.size == (512, 512) and image.mode == "RGBA", f"frame format: {role} {item['image']['path']}")
                alpha = np.asarray(image)[:, :, 3]
                check(bool((alpha > 2).any()) and not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"frame alpha: {role} {item['image']['path']}")
            check(not item["cameraBounds"]["clipped"] and abs(item["minZ"]) <= 1e-6, f"frame camera/ground: {role} {item['image']['path']}")
            all_hashes.append(item["image"]["sha256"])
        differences = []
        for previous, current in zip(walk, walk[1:]):
            first = np.asarray(Image.open(REPO_ROOT / previous["image"]["path"]).convert("RGBA"), dtype=np.float32)
            second = np.asarray(Image.open(REPO_ROOT / current["image"]["path"]).convert("RGBA"), dtype=np.float32)
            differences.append(float(np.abs(first - second).mean()))
        check(all(value > 1 for value in differences), f"visible walk changes: {role}")
    check(len(all_hashes) == 36 and len(set(all_hashes)) == 36, "36 globally unique final frames")

    qa_path = REPO_ROOT / "apps/web/public/qa-character-scale/manifest.json"
    qa = json.loads(qa_path.read_text(encoding="utf-8"))
    check(len(qa["frames"]) == 84, "84 measured lab sprites")
    for frame in qa["frames"]:
        path = REPO_ROOT / "apps/web/public" / frame["path"].lstrip("/")
        check(path.exists() and sha256(path) == frame["sha256"], f"QA sprite hash: {frame['path']}")
        check(frame["visibleHeight"] > 0 and frame["support"]["y"] == frame["visible"]["bottom"], f"QA sprite calibration: {frame['path']}")

    capture_path = BASE / "phaser-captures/capture-manifest.json"
    capture = json.loads(capture_path.read_text(encoding="utf-8"))
    check(capture["status"] == "captured", "Phaser capture status")
    check(not capture["pageErrors"] and not capture["consoleErrors"], "no browser errors")
    check(len(capture["screenshots"]) == 54, "54 Phaser screenshots")
    for screenshot in capture["screenshots"]:
        path = REPO_ROOT / screenshot["path"]
        check(path.exists() and sha256(path) == screenshot["sha256"], f"Phaser screenshot hash: {screenshot['path']}")
        check(path.stat().st_size < 1024 * 1024, f"Phaser screenshot below 1 MiB: {screenshot['path']}")
    for entry in capture["functionalChecks"]:
        check(all(item["passed"] for item in entry["checks"]), f"Phaser functional checks: {entry['viewport']}")
    check(sum(len(entry["checks"]) for entry in capture["functionalChecks"]) == 74, "74 Phaser functional checks")
    balanced = json.loads((BASE / "phaser-captures/performance-balanced.json").read_text(encoding="utf-8"))
    check(all(len(item["samples"]) == 2 for item in balanced["byConfig"].values()), "two balanced performance samples per config")

    contact = json.loads((BASE / "scale-comparison/manifest.json").read_text(encoding="utf-8"))
    for sheet in contact["sheets"]:
        path = REPO_ROOT / sheet["path"]
        check(path.exists() and sha256(path) == sheet["sha256"], f"contact sheet hash: {sheet['path']}")
    recommended = json.loads((BASE / "review/recommended-default.json").read_text(encoding="utf-8"))
    check(recommended["config"] == "B" and recommended["cameraZoom"] == 1, "recommended B is lab default")

    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "checkCount": len(checks),
        "errors": errors,
        "checks": checks,
        "artisticApproval": "pending_human",
        "runtimePromotion": False,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": len(checks), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

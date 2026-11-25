#!/usr/bin/env python3
"""Valida los 36 frames nuevos y el control policial de WP-CHAR-02C."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
ROLES = ("supervisor", "enforcer", "firefighter")
EXPECTED_SOURCES = {
    "supervisor": "7b67dbd3b1873a8182e78b1764db008496e4c3b871db59f45ed224852c238fd4",
    "enforcer": "00db0d50e4da865d95c7fd9caad9a49277f8809423f5d318387caa1dce7861d4",
    "firefighter": "c1cba637e1d946822df07385fabf9d1bc55255ce19e0e8f7124d767e03987126",
}


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    root = Path(args.root).resolve()
    output_path = Path(args.output).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    checks = []
    metrics = {"consecutiveWalkMeanAbsoluteDifference": {}, "beforeAfterIdleMeanAbsoluteDifference": {}}
    all_hashes = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    for role in ROLES:
        report_path = root / role / "final" / f"{role}-prototype.json"
        check(report_path.exists(), f"report exists: {role}")
        if not report_path.exists():
            continue
        report = json.loads(report_path.read_text(encoding="utf-8"))
        outputs = report["outputs"]
        check(report.get("role") == role, f"role: {role}")
        check(report.get("manifestSha256") == sha256(manifest_path), f"manifest hash: {role}")
        check(report.get("status") == "technical_complete_pending_human_review", f"limited status: {role}")
        check(report.get("runtimePromotion") is False and report.get("approval") == "pending_human", f"no approval/runtime: {role}")
        check(len(outputs) == 12, f"12 frames: {role}")
        check(len({item["image"]["path"] for item in outputs}) == 12, f"unique paths: {role}")
        check(len({item["image"]["sha256"] for item in outputs}) == 12, f"unique hashes: {role}")
        all_hashes.extend(item["image"]["sha256"] for item in outputs)
        source = Path(report["source"]["path"])
        check(source.exists() and sha256(source) == EXPECTED_SOURCES[role], f"source hash: {role}")
        check(report["source"]["license"] == "CC0-1.0", f"license: {role}")
        check(report["rig"]["bones"] == 7 and report["rig"]["actions"] == 32, f"Kenney rig/actions: {role}")
        check(report["maxAccessoryDrift"] <= 1e-4, f"accessory drift: {role}")
        check(report["headMaterials"]["polygonCount"] > 0, f"local head materials: {role}")
        check(report["bodyMaterials"]["polygonCounts"], f"local body materials: {role}")
        check(report["geometryChanges"] == [], f"no source mesh edits: {role}")
        check(sorted(report["atlasHashesBefore"].values()) == sorted(report["atlasHashesAfter"].values()), f"atlas unchanged: {role}")
        idle = [item for item in outputs if item["animation"] == "idle"]
        walk = sorted((item for item in outputs if item["animation"] == "walk"), key=lambda item: item["sampleIndex"])
        check(len(idle) == 4 and {item["direction"] for item in idle} == {0, 1, 2, 3}, f"four idle directions: {role}")
        check(len(walk) == 8 and {item["direction"] for item in walk} == {0}, f"eight walk D0: {role}")
        check([item["frame"] for item in walk] == [0, 2, 4, 6, 8, 10, 12, 14], f"equidistant walk: {role}")
        for item in outputs:
            image_path = REPO_ROOT / item["image"]["path"]
            label = f"{role} {item['image']['path']}"
            check(image_path.exists(), f"exists: {label}")
            if not image_path.exists():
                continue
            check(sha256(image_path) == item["image"]["sha256"], f"sha256: {label}")
            with Image.open(image_path) as image:
                check(image.size == (512, 512), f"512x512: {label}")
                check(image.mode == "RGBA", f"RGBA: {label}")
                rgba = np.asarray(image)
                alpha = rgba[:, :, 3]
                check(bool((alpha > 2).any()), f"nonempty alpha: {label}")
                check(not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"clear alpha edge: {label}")
                magenta = (rgba[:, :, 0] > 200) & (rgba[:, :, 1] < 60) & (rgba[:, :, 2] > 200) & (alpha > 2)
                check(not magenta.any(), f"no magenta: {label}")
            check(not item["cameraBounds"]["clipped"], f"camera framing: {label}")
            check(abs(item["minZ"]) <= 1e-6, f"ground contact: {label}")
            check(item["actionSlot"] is not None, f"action slot: {label}")
            check(abs(item["worldSizeMeters"][2] - 1.8) < 0.30, f"coherent normalized height: {label}")
        differences = []
        for previous, current in zip(walk, walk[1:]):
            first = np.asarray(Image.open(REPO_ROOT / previous["image"]["path"]).convert("RGBA"), dtype=np.float32)
            second = np.asarray(Image.open(REPO_ROOT / current["image"]["path"]).convert("RGBA"), dtype=np.float32)
            differences.append(float(np.abs(first - second).mean()))
        metrics["consecutiveWalkMeanAbsoluteDifference"][role] = [round(value, 4) for value in differences]
        check(all(value > 1.0 for value in differences), f"visible walk changes: {role}")
        old_path = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes" / role / "final" / f"{role}-d0-idle-00.png"
        new_path = REPO_ROOT / root / role / "final" / f"{role}-d0-idle-00.png"
        old = np.asarray(Image.open(old_path).convert("RGBA"), dtype=np.float32)
        new = np.asarray(Image.open(new_path).convert("RGBA"), dtype=np.float32)
        delta = float(np.abs(old - new).mean())
        metrics["beforeAfterIdleMeanAbsoluteDifference"][role] = round(delta, 4)
        check(delta > 2.0, f"visible rework delta: {role}")

    check(len(all_hashes) == 36, "36 new frames")
    check(len(set(all_hashes)) == 36, "36 globally unique new frame hashes")

    police_path = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes/police/final/police-prototype.json"
    check(police_path.exists(), "police control report exists")
    if police_path.exists():
        police = json.loads(police_path.read_text(encoding="utf-8"))
        check(len(police["outputs"]) == 12, "police control has 12 frames")
        check(police["source"]["sha256"] == "6bb3b1ac8b196fd005dd5cb73621cd88d8a44d1f0f92fcf0c03f3b47ac9b9a74", "police source hash")
        for item in police["outputs"]:
            path = REPO_ROOT / item["image"]["path"]
            check(path.exists() and sha256(path) == item["image"]["sha256"], f"police control hash: {item['image']['path']}")
            check(not item["cameraBounds"]["clipped"] and abs(item["minZ"]) <= 1e-6, f"police control framing/ground: {item['image']['path']}")

    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "root": str(root.relative_to(REPO_ROOT)),
        "newFrameCount": len(all_hashes),
        "policeFrames": 12,
        "checkCount": len(checks),
        "metrics": metrics,
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

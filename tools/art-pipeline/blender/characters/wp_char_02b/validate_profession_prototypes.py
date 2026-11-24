#!/usr/bin/env python3
"""Valida los cuatro prototipos profesionales WP-CHAR-02B."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
ROLES = ("supervisor", "enforcer", "police", "firefighter")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    output_path = Path(args.output).resolve()
    errors = []
    checks = []
    metrics = {"consecutiveWalkMeanAbsoluteDifference": {}}
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
        check(report.get("status") == "limited_prototype_rendered", f"limited prototype status: {role}")
        check(report.get("canonicalId") in {"supervisor", "enforcer_male", "police", "firefighter"}, f"canonical id: {role}")
        check(len(outputs) == 12, f"12 frames: {role}")
        check(len({item["image"]["path"] for item in outputs}) == 12, f"unique paths: {role}")
        check(len({item["image"]["sha256"] for item in outputs}) == 12, f"unique hashes: {role}")
        all_hashes.extend(item["image"]["sha256"] for item in outputs)
        source = Path(report["source"]["path"])
        check(source.exists() and sha256(source) == report["source"]["sha256"], f"source hash: {role}")
        check(report["source"]["license"] == "CC0-1.0", f"license: {role}")
        check(report["rig"]["bones"] == 7, f"7 bones: {role}")
        check(report["maxAnchorDrift"] <= 1e-4, f"accessory anchor drift: {role}")
        check(report["regionMaterials"]["method"].startswith("Assign solid materials"), f"skinned material regions: {role}")
        idle = [item for item in outputs if item["animation"] == "idle"]
        walk = sorted((item for item in outputs if item["animation"] == "walk"), key=lambda item: item["sampleIndex"])
        check(len(idle) == 4 and {item["direction"] for item in idle} == {0, 1, 2, 3}, f"four idle directions: {role}")
        check(len(walk) == 8 and {item["direction"] for item in walk} == {0}, f"eight walk frames in direction 0: {role}")
        check([item["frame"] for item in walk] == [0, 2, 4, 6, 8, 10, 12, 14], f"equidistant walk frames: {role}")
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
                check(not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"alpha edge clear: {label}")
                magenta = (rgba[:, :, 0] > 200) & (rgba[:, :, 1] < 60) & (rgba[:, :, 2] > 200) & (alpha > 2)
                check(not magenta.any(), f"no magenta: {label}")
            check(not item["cameraBounds"]["clipped"], f"camera framing: {label}")
            check(abs(item["minZ"]) <= 1e-6, f"ground contact: {label}")
            check(item["actionSlot"] is not None, f"action slot bound: {label}")
        differences = []
        for previous, current in zip(walk, walk[1:]):
            first = np.asarray(Image.open(REPO_ROOT / previous["image"]["path"]).convert("RGBA"), dtype=np.float32)
            second = np.asarray(Image.open(REPO_ROOT / current["image"]["path"]).convert("RGBA"), dtype=np.float32)
            differences.append(float(np.abs(first - second).mean()))
        metrics["consecutiveWalkMeanAbsoluteDifference"][role] = [round(value, 4) for value in differences]
        check(all(value > 1.0 for value in differences), f"visible walk changes: {role}")
    check(len(all_hashes) == 48, "48 total prototype frames")
    check(len(set(all_hashes)) == 48, "48 globally unique frame hashes")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "root": str(root.relative_to(REPO_ROOT)),
        "frameCount": len(all_hashes),
        "checkCount": len(checks),
        "metrics": metrics,
        "errors": errors,
        "checks": checks,
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": len(checks), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

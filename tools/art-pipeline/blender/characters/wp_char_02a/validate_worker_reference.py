#!/usr/bin/env python3
"""Valida el obrero de referencia WP-CHAR-02A sin promoción runtime."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    report_path = Path(args.report).resolve()
    output_path = Path(args.output).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    errors = []
    checks = []
    metrics = {"consecutiveWalkMeanAbsoluteDifference": {}}

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(report.get("blender") == "5.2.2 LTS", "Blender 5.2.2 LTS")
    check(report.get("buildHash") == "d13f752e3b9c", "Blender build hash")
    check(report.get("materialMode") == "source", "local source-atlas material mode")
    check(report.get("render", {}).get("background") == "transparent", "transparent render declared")
    check(len(report.get("outputs", [])) == 36, "36 worker frames")
    check(len({item["image"]["path"] for item in report["outputs"]}) == 36, "unique frame paths")
    check(len({item["image"]["sha256"] for item in report["outputs"]}) == 36, "unique frame hashes")
    source = report["source"]
    source_path = Path(source["path"])
    license_path = Path(source["licenseFile"])
    check(source_path.exists() and sha256(source_path) == source["sha256"], "Kenney source hash")
    check(license_path.exists() and sha256(license_path) == source["licenseFileSha256"], "Kenney license hash")
    check(report["rig"]["bones"] == 7, "7-bone Kenney rig")
    check(sum(mesh["polygons"] for mesh in report["rig"]["meshes"]) == 893, "893 triangles")
    check(all(mesh["armatureModifiers"] for mesh in report["rig"]["meshes"]), "all meshes skinned")
    check(
        all(item["localMaterial"].startswith("colormap_WP02A_source") for item in report["materialTreatment"]["materials"])
        and len(report["materialTreatment"]["materials"]) == 2,
        "local duplicate materials only",
    )
    for item in report["outputs"]:
        path = REPO_ROOT / item["image"]["path"]
        image_path = item["image"]["path"]
        check(path.exists(), f"exists: {image_path}")
        if not path.exists():
            continue
        check(sha256(path) == item["image"]["sha256"], f"sha256: {image_path}")
        with Image.open(path) as image:
            check(image.size == (512, 512), f"512x512: {image_path}")
            check(image.mode == "RGBA", f"RGBA: {image_path}")
            rgba = np.asarray(image)
            alpha = rgba[:, :, 3]
            check(bool((alpha > 2).any()), f"nonempty alpha: {image_path}")
            check(not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"alpha clear of canvas edge: {image_path}")
            magenta = (rgba[:, :, 0] > 200) & (rgba[:, :, 1] < 60) & (rgba[:, :, 2] > 200) & (alpha > 2)
            check(not magenta.any(), f"no magenta: {image_path}")
        check(not item["cameraBounds"]["clipped"], f"camera framing: {image_path}")
        check(abs(item["minZ"]) <= 1e-6, f"ground contact: {image_path}")
        check(item["actionSlot"] is not None, f"action slot bound: {image_path}")
    for direction in range(4):
        frames = [item for item in report["outputs"] if item["direction"] == direction]
        walk = sorted((item for item in frames if item["animation"] == "walk"), key=lambda item: item["sampleIndex"])
        idle = [item for item in frames if item["animation"] == "idle"]
        check(len(frames) == 9, f"9 frames direction {direction}")
        check(len(idle) == 1, f"one idle direction {direction}")
        check(len(walk) == 8, f"8 walk frames direction {direction}")
        check([item["frame"] for item in walk] == [0, 2, 4, 6, 8, 10, 12, 14], f"8 equidistant walk frames direction {direction}")
        check(len({item["image"]["sha256"] for item in walk}) == 8, f"distinct walk frames direction {direction}")
        differences = []
        for previous, current in zip(walk, walk[1:]):
            first = np.asarray(Image.open(REPO_ROOT / previous["image"]["path"]).convert("RGBA"), dtype=np.float32)
            second = np.asarray(Image.open(REPO_ROOT / current["image"]["path"]).convert("RGBA"), dtype=np.float32)
            differences.append(float(np.abs(first - second).mean()))
        metrics["consecutiveWalkMeanAbsoluteDifference"][str(direction)] = [round(value, 4) for value in differences]
        check(all(value > 1.0 for value in differences), f"visible change between walk frames direction {direction}")
        check(idle[0]["image"]["sha256"] != walk[0]["image"]["sha256"], f"idle/walk distinct direction {direction}")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "report": str(report_path.relative_to(REPO_ROOT)),
        "reportSha256": sha256(report_path),
        "frameCount": len(report["outputs"]),
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

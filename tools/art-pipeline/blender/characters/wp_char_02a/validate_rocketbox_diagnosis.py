#!/usr/bin/env python3
"""Valida hashes, matriz, rig y métricas del diagnóstico Rocketbox."""

import argparse
import hashlib
import json
from pathlib import Path

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

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(report.get("blender") == "5.2.2 LTS", "Blender 5.2.2 LTS")
    check(report.get("buildHash") == "d13f752e3b9c", "Blender build hash")
    check(len(report.get("outputs", [])) == 35, "35 diagnostic renders")
    check(len({item["path"] for item in report["outputs"]}) == 35, "unique output paths")
    check(len({item["sha256"] for item in report["outputs"]}) == 35, "unique output hashes")
    for item in report["outputs"]:
        path = REPO_ROOT / item["path"]
        check(path.exists(), f"exists: {item['path']}")
        if path.exists():
            check(sha256(path) == item["sha256"], f"sha256: {item['path']}")
            with Image.open(path) as image:
                check(image.size == (512, 512), f"512x512: {item['path']}")
                check(image.mode == "RGBA", f"RGBA: {item['path']}")
    for label, source in report["source"].items():
        path = Path(source["path"])
        check(path.exists(), f"source exists: {label}")
        if path.exists():
            check(sha256(path) == source["sha256"], f"source sha256: {label}")
    for label, dependency in report["dependencies"].items():
        path = Path(dependency["path"])
        check(path.exists(), f"dependency exists: {label}")
        if path.exists():
            check(sha256(path) == dependency["sha256"], f"dependency sha256: {label}")

    controls = report["controls"]
    expected_walk = {
        "B_original_animation_walk",
        "B_in_place_grounded_walk",
        "C_wp_char_01b_walk",
        "C_in_place_grounded_walk",
    }
    for name in expected_walk:
        control = controls[name]
        samples = control["samples"]
        check(len(samples) == 8, f"8 samples: {name}")
        check(len({sample["frame"] for sample in samples}) == 8, f"8 distinct frames: {name}")
        check(len({sample["image"]["sha256"] for sample in samples}) == 8, f"8 distinct images: {name}")
        check(control["usefulRange"]["sampledFrames"] == [1, 5, 9, 13, 17, 21, 25, 29], f"equidistant useful frames: {name}")
        check(control["rig"]["boneCount"] == 80, f"80 bones: {name}")
        check(control["rig"]["animation"]["activeAction"]["fcurveCount"] == 809, f"809 F-curves: {name}")
        check(control["normalization"][0]["before"]["hierarchyHash"] == control["normalization"][0]["after"]["hierarchyHash"], f"hierarchy preserved: {name}")
        check(sum(sample.get("legacyFrame0", False) for sample in samples) == 1, f"legacy frame 0 identified: {name}")
        check(sum(sample.get("legacyFrame1", False) for sample in samples) == 1, f"legacy frame 1 identified: {name}")
    original = controls["B_original_animation_walk"]
    composed = controls["C_wp_char_01b_walk"]
    check(
        [sample["bones"] for sample in original["samples"]] == [sample["bones"] for sample in composed["samples"]],
        "compositor preserves all sampled bone transforms",
    )
    check(original["summary"] == composed["summary"], "compositor preserves walk metrics")
    check(original["summary"]["rootPlanarTravel"] > 1.2, "root motion measured above 1.2 m")
    check(original["summary"]["cameraClippedSamples"] == 8, "uncorrected clipping measured in 8/8")
    check(original["summary"]["loopClosureRootDeltaMeters"] > 1.4, "uncorrected loop does not close in place")
    for name in ("B_in_place_grounded_walk", "C_in_place_grounded_walk"):
        summary = controls[name]["summary"]
        check(summary["rootPlanarTravel"] == 0.0, f"root motion removed: {name}")
        check(summary["cameraClippedSamples"] == 0, f"no camera clipping: {name}")
        check(summary["loopClosureMaxBoneHeadDeltaMeters"] <= 1e-5, f"loop closes: {name}")
        check(summary["leftFoot"]["maxPenetrationMeters"] <= 1e-6, f"left foot grounded: {name}")
        check(summary["rightFoot"]["maxPenetrationMeters"] <= 1e-6, f"right foot grounded: {name}")
        check(summary["leftFoot"]["contactSamples"] + summary["rightFoot"]["contactSamples"] >= 8, f"support foot each sample: {name}")
    check(controls["C_in_place_grounded_walk"]["summary"] == controls["B_in_place_grounded_walk"]["summary"], "corrected compositor preserves walk metrics")
    check(controls["C_wp_char_01b_idle"]["composition"]["accessoryObjectCount"] == 6, "WP-CHAR-01B accessory count")
    check(controls["C_wp_char_01b_idle"]["composition"]["maxAnchorDrift"] <= 1e-4, "WP-CHAR-01B anchor drift tolerance")

    sheet = report_path.parent / "rocketbox-animation-diagnosis-sheet.png"
    check(sheet.exists(), "diagnostic sheet exists")
    if sheet.exists():
        with Image.open(sheet) as image:
            check(image.width >= 2000 and image.height >= 1200, "diagnostic sheet dimensions")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "report": str(report_path.relative_to(REPO_ROOT)),
        "reportSha256": sha256(report_path),
        "renderCount": len(report["outputs"]),
        "checkCount": len(checks),
        "errors": errors,
        "checks": checks,
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": len(checks), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

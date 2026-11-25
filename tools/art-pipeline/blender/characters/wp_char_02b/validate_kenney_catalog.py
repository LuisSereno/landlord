#!/usr/bin/env python3
"""Valida inventario, renders y catálogo Kenney de WP-CHAR-02B."""

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

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(report.get("blender") == "5.2.2 LTS", "Blender 5.2.2 LTS")
    check(report.get("buildHash") == "d13f752e3b9c", "Blender build hash")
    check(len(report.get("models", [])) == 20, "20 character models")
    check(len({model["file"] for model in report["models"]}) == 20, "unique model filenames")
    check(len(report.get("outputs", [])) == 20, "20 idle renders")
    check(len({item["sha256"] for item in report["outputs"]}) == 20, "unique render hashes")
    allowed = {"SUITABLE", "ADAPTABLE", "UNSUITABLE", "UNVERIFIED"}
    for model in report["models"]:
        name = model["file"]
        check(model.get("exists") is True, f"source exists: {name}")
        check(model.get("classification") in allowed, f"classification: {name}")
        check(model.get("visualDescription") is not None, f"visual description: {name}")
        check(model.get("potentialLandlordUse") is not None, f"potential use: {name}")
        source = Path(model["path"])
        check(source.exists() and sha256(source) == model["sha256"], f"source hash: {name}")
        check(model["bones"] == 7, f"7 bones: {name}")
        check(len(model["actions"]) == 32, f"32 actions: {name}")
        check(any(action["name"] == "idle" for action in model["actions"]), f"idle action: {name}")
        check(any(action["name"] == "walk" for action in model["actions"]), f"walk action: {name}")
        check(abs(model["normalization"]["normalizedSize"]["height"] - 1.8) <= 1e-5, f"normalized height: {name}")
        item = model["render"]["image"]
        path = REPO_ROOT / item["path"]
        check(path.exists() and sha256(path) == item["sha256"], f"render hash: {name}")
        if path.exists():
            with Image.open(path) as image:
                check(image.size == (512, 512), f"512x512: {name}")
                check(image.mode == "RGBA", f"RGBA: {name}")
                rgba = np.asarray(image)
                alpha = rgba[:, :, 3]
                check(bool((alpha > 2).any()), f"nonempty alpha: {name}")
                check(not bool(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), f"alpha edge clear: {name}")
                magenta = (rgba[:, :, 0] > 200) & (rgba[:, :, 1] < 60) & (rgba[:, :, 2] > 200) & (alpha > 2)
                check(not magenta.any(), f"no magenta: {name}")
        check(not model["render"]["cameraBounds"]["clipped"], f"camera framing: {name}")
    license_path = Path(report["licenseFile"])
    check(license_path.exists() and sha256(license_path) == report["licenseFileSha256"], "Kenney license hash")
    sheets_path = report_path.parent / "kenney-character-catalog-sheets.json"
    check(sheets_path.exists(), "catalog sheet manifest exists")
    if sheets_path.exists():
        sheets = json.loads(sheets_path.read_text(encoding="utf-8"))
        check(len(sheets["sheets"]) == 2, "two catalog sheets")
        for sheet in sheets["sheets"]:
            path = REPO_ROOT / sheet["path"]
            check(path.exists() and sha256(path) == sheet["sha256"], f"sheet hash: {sheet['path']}")
            check(path.stat().st_size < 1024 * 1024, f"sheet below 1 MiB: {sheet['path']}")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "report": str(report_path.relative_to(REPO_ROOT)),
        "reportSha256": sha256(report_path),
        "modelCount": len(report["models"]),
        "classificationCounts": {key: sum(model["classification"] == key for model in report["models"]) for key in sorted(allowed)},
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

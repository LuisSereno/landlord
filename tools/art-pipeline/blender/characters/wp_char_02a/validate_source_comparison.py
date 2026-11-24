#!/usr/bin/env python3
"""Valida la comparación de fuentes de personajes de WP-CHAR-02A."""

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
    check(set(report.get("sources", {})) == {"rocketbox", "kenney", "quaternius"}, "three sources")
    check(len(report.get("outputs", [])) == 12, "12 comparison renders")
    check(len({item["path"] for item in report["outputs"]}) == 12, "unique output paths")
    check(len({item["sha256"] for item in report["outputs"]}) == 12, "unique output hashes")
    for item in report["outputs"]:
        path = REPO_ROOT / item["path"]
        check(path.exists(), f"exists: {item['path']}")
        if path.exists():
            check(sha256(path) == item["sha256"], f"sha256: {item['path']}")
            with Image.open(path) as image:
                check(image.size == (512, 512), f"512x512: {item['path']}")
                check(image.mode == "RGBA", f"RGBA: {item['path']}")
                pixels = np.asarray(image.convert("RGB"))
                magenta = (pixels[:, :, 0] > 200) & (pixels[:, :, 1] < 60) & (pixels[:, :, 2] > 200)
                check(not magenta.any(), f"no magenta: {item['path']}")
    expected = {
        "rocketbox": {"bones": 80, "triangles": 6722, "idle": 1, "walk": 3},
        "kenney": {"bones": 7, "triangles": 893, "idle": 1, "walk": 3},
        "quaternius": {"bones": 65, "triangles": 14318, "idle": 1, "walk": 3},
    }
    for name, values in expected.items():
        source = report["sources"][name]
        check(source["armature"]["bones"] == values["bones"], f"bone count: {name}")
        check(source["mesh"]["triangles"] == values["triangles"], f"triangle count: {name}")
        check(1.75 <= source["normalization"]["normalizedSize"]["height"] <= 1.85, f"normalized height: {name}")
        source_path = Path(source["path"])
        license_path = Path(source["licenseFile"])
        check(source_path.exists() and sha256(source_path) == source["sha256"], f"source hash: {name}")
        check(license_path.exists() and sha256(license_path) == source["licenseFileSha256"], f"license hash: {name}")
        for animation, count in (("idle", values["idle"]), ("walk", values["walk"])):
            action = source["animations"][animation]
            samples = action["samples"]
            check(len(samples) == count, f"sample count: {name} {animation}")
            check(len({sample["image"]["sha256"] for sample in samples}) == count, f"distinct images: {name} {animation}")
            check(action["boundActionSlot"] is not None, f"bound action slot: {name} {animation}")
            check(action["fcurveCount"] > 0, f"action curves: {name} {animation}")
            check(all(not sample["cameraBounds"]["clipped"] for sample in samples), f"no clipping: {name} {animation}")
    check(report["sources"]["quaternius"]["animations"]["walk"]["fcurveCount"] == 650, "Quaternius UAL walk curves")
    check(len(report["sources"]["quaternius"]["textureFixes"]) == 2, "Quaternius texture path fixes")
    check(report["sources"]["kenney"]["mesh"]["materials"] == ["colormap"], "Kenney integrated atlas material")
    check(set(report["sources"]["kenney"]["mesh"]["images"]) == {"styled_colormap"}, "Kenney styled integrated atlas")
    for filename, minimum in (
        ("source-comparison-enlarged.png", (1100, 900)),
        ("source-comparison-28px.png", (1100, 400)),
    ):
        path = report_path.parent / filename
        check(path.exists(), f"sheet exists: {filename}")
        if path.exists():
            with Image.open(path) as image:
                check(image.width >= minimum[0] and image.height >= minimum[1], f"sheet dimensions: {filename}")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "report": str(report_path.relative_to(REPO_ROOT)),
        "reportSha256": sha256(report_path),
        "renderCount": len(report["outputs"]),
        "checkCount": len(checks),
        "selectedBase": "kenney_character_worker",
        "errors": errors,
        "checks": checks,
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": len(checks), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

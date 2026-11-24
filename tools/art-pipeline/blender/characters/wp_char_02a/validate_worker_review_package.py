#!/usr/bin/env python3
"""Valida el paquete de revisión visual del obrero WP-CHAR-02A."""

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
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    checks = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(manifest.get("runtimePromotion") is False, "runtime promotion disabled")
    check(manifest.get("approval") == "pending_human", "human approval pending")
    check(len(manifest.get("sheets", [])) == 9, "nine review sheets")
    check(len({sheet["path"] for sheet in manifest["sheets"]}) == 9, "unique sheet paths")
    check(len({sheet["sha256"] for sheet in manifest["sheets"]}) == 9, "unique sheet hashes")
    expected_names = {
        "01-before-after.png",
        "02-original-vs-new.png",
        "03-idle-before-after.png",
        "04-walk-eight-poses.png",
        "05-four-directions.png",
        "06-silhouette-28px.png",
        "07-scales.png",
        "08-worker-vs-citizen.png",
        "09-street-context-offline.png",
    }
    check({Path(sheet["path"]).name for sheet in manifest["sheets"]} == expected_names, "required sheet set")
    for sheet in manifest["sheets"]:
        path = REPO_ROOT / sheet["path"]
        check(path.exists(), f"sheet exists: {sheet['path']}")
        if not path.exists():
            continue
        check(sha256(path) == sheet["sha256"], f"sheet sha256: {sheet['path']}")
        check(path.stat().st_size == sheet["bytes"], f"sheet bytes: {sheet['path']}")
        check(path.stat().st_size < 1024 * 1024, f"sheet below 1 MiB: {sheet['path']}")
        with Image.open(path) as image:
            check(image.size == (sheet["width"], sheet["height"]), f"sheet dimensions: {sheet['path']}")
    for item in manifest["inputs"]:
        path = REPO_ROOT / item["path"]
        check(path.exists(), f"input exists: {item['path']}")
        if path.exists():
            check(sha256(path) == item["sha256"], f"input sha256: {item['path']}")
    source_report = REPO_ROOT / manifest["sourceReport"]
    check(source_report.exists(), "worker source report exists")
    if source_report.exists():
        check(sha256(source_report) == manifest["sourceReportSha256"], "worker source report hash")
    cycle_path = source_report.parent / "worker-cycle-closure.json"
    check(cycle_path.exists(), "worker cycle closure exists")
    if cycle_path.exists():
        cycle = json.loads(cycle_path.read_text(encoding="utf-8"))
        check(cycle["rootPlanarTravelMeters"] == 0.0, "Kenney root motion is zero")
        check(cycle["loopClosureMaxBoneHeadDeltaMeters"] == 0.0, "Kenney loop closes exactly")
        check(cycle["actionSlot"] is not None, "Kenney action slot bound")
    validation_path = source_report.parent / "worker-reference-validation.json"
    check(validation_path.exists(), "worker frame validation exists")
    if validation_path.exists():
        validation = json.loads(validation_path.read_text(encoding="utf-8"))
        check(validation["status"] == "passed", "worker frame validation passed")
        check(validation["frameCount"] == 36, "worker validation covers 36 frames")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "sheetCount": len(manifest["sheets"]),
        "inputCount": len(manifest["inputs"]),
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

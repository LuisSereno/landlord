#!/usr/bin/env python3
"""Valida hashes, entradas y presupuesto del paquete visual WP-CHAR-02C."""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
REQUIRED_SHEETS = (
    "01-before-after-supervisor.png",
    "02-before-after-enforcer.png",
    "03-before-after-firefighter.png",
    "04-controls.png",
    "05-five-family.png",
    "06-five-family-28px.png",
    "07-four-directions.png",
    "08-walk-samples.png",
    "09-silhouettes-before-after.png",
    "10-scales.png",
    "11-unlabeled-professions.png",
    "12-street-context-offline.png",
)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--review-root", required=True)
    parser.add_argument("--rework-validation", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    review_root = Path(args.review_root).resolve()
    rework_path = Path(args.rework_validation).resolve()
    output_path = Path(args.output).resolve()
    manifest_path = review_root / "review-manifest.json"
    errors = []
    checks = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(manifest_path.exists(), "review manifest exists")
    check(rework_path.exists(), "rework validation exists")
    if not manifest_path.exists() or not rework_path.exists():
        result = {"status": "failed", "errors": errors, "checks": checks}
        output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        raise SystemExit(1)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rework = json.loads(rework_path.read_text(encoding="utf-8"))
    check(manifest.get("runtimePromotion") is False, "review manifest has no runtime promotion")
    check(manifest.get("approval") == "pending_human", "review manifest pending human approval")
    check(rework.get("status") == "passed", "36-frame validation passed")
    check(rework.get("newFrameCount") == 36, "36 new frames declared")
    check(rework.get("policeFrames") == 12, "12 police control frames declared")
    check(len(manifest.get("sheets", [])) == 12, "12 final review sheets")
    names = [Path(sheet["path"]).name for sheet in manifest.get("sheets", [])]
    check(set(names) == set(REQUIRED_SHEETS), "required review sheet set")
    for sheet in manifest.get("sheets", []):
        path = REPO_ROOT / sheet["path"]
        label = sheet["path"]
        check(path.exists(), f"sheet exists: {label}")
        if not path.exists():
            continue
        check(sha256(path) == sheet["sha256"], f"sheet hash: {label}")
        check(path.stat().st_size == sheet["bytes"], f"sheet bytes: {label}")
        check(path.stat().st_size < 1024 * 1024, f"sheet below 1 MiB: {label}")
        with Image.open(path) as image:
            check(image.mode == "RGB", f"sheet RGB: {label}")
            check(image.width == sheet["width"] and image.height == sheet["height"], f"sheet dimensions: {label}")
            check(image.width >= 1000 and image.height >= 500, f"sheet review resolution: {label}")
    for item in manifest.get("inputs", []):
        path = REPO_ROOT / item["path"]
        check(path.exists() and sha256(path) == item["sha256"], f"input hash: {item['path']}")
    input_paths = {item["path"] for item in manifest.get("inputs", [])}
    check(any("wp-char-02a/worker-reference/final/worker-a-d0-idle-00.png" in path for path in input_paths), "worker control input")
    check(any("wp-char-02b/prototypes/police/final/police-d0-idle-00.png" in path for path in input_paths), "police control input")
    for role in ("supervisor", "enforcer", "firefighter"):
        check(any(f"wp-char-02c/prototypes/{role}/final/{role}-d0-idle-00.png" in path for path in input_paths), f"new {role} input")
        check(any(f"wp-char-02b/prototypes/{role}/final/{role}-d0-idle-00.png" in path for path in input_paths), f"old {role} input")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "reviewManifest": str(manifest_path.relative_to(REPO_ROOT)),
        "reviewManifestSha256": sha256(manifest_path),
        "reworkValidation": str(rework_path.relative_to(REPO_ROOT)),
        "reworkValidationSha256": sha256(rework_path),
        "sheetCount": len(manifest.get("sheets", [])),
        "inputCount": len(manifest.get("inputs", [])),
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

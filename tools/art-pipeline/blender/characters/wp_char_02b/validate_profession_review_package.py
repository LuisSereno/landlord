#!/usr/bin/env python3
"""Valida las láminas de revisión WP-CHAR-02B y sus entradas."""

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
    check(len(manifest.get("sheets", [])) == 11, "11 new review sheets")
    check(len({sheet["path"] for sheet in manifest["sheets"]}) == 11, "unique sheet paths")
    check(len({sheet["sha256"] for sheet in manifest["sheets"]}) == 11, "unique sheet hashes")
    expected = {
        "03-worker-vs-supervisor.png",
        "04-worker-vs-enforcer.png",
        "05-worker-vs-police.png",
        "06-worker-vs-firefighter.png",
        "07-five-family.png",
        "08-four-directions.png",
        "09-walk-samples.png",
        "10-scales.png",
        "11-street-context-offline.png",
        "12-silhouettes.png",
        "13-unlabeled-professions.png",
    }
    check({Path(sheet["path"]).name for sheet in manifest["sheets"]} == expected, "required review sheet set")
    for sheet in manifest["sheets"]:
        path = REPO_ROOT / sheet["path"]
        check(path.exists(), f"sheet exists: {sheet['path']}")
        if not path.exists():
            continue
        check(sha256(path) == sheet["sha256"], f"sheet hash: {sheet['path']}")
        check(path.stat().st_size == sheet["bytes"], f"sheet bytes: {sheet['path']}")
        check(path.stat().st_size < 1024 * 1024, f"sheet below 1 MiB: {sheet['path']}")
        with Image.open(path) as image:
            check(image.size == (sheet["width"], sheet["height"]), f"sheet dimensions: {sheet['path']}")
    for item in manifest["inputs"]:
        path = REPO_ROOT / item["path"]
        check(path.exists(), f"input exists: {item['path']}")
        if path.exists():
            check(sha256(path) == item["sha256"], f"input hash: {item['path']}")
    catalog_manifest = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/catalog/kenney-character-catalog-sheets.json"
    check(catalog_manifest.exists(), "catalog sheet manifest exists")
    if catalog_manifest.exists():
        catalog = json.loads(catalog_manifest.read_text(encoding="utf-8"))
        check(len(catalog["sheets"]) == 2, "two catalog sheets")
        for sheet in catalog["sheets"]:
            path = REPO_ROOT / sheet["path"]
            check(path.exists() and sha256(path) == sheet["sha256"], f"catalog sheet hash: {sheet['path']}")
            check(path.stat().st_size < 1024 * 1024, f"catalog sheet below 1 MiB: {sheet['path']}")
    prototype_validation = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes/prototype-validation.json"
    check(prototype_validation.exists(), "prototype validation exists")
    if prototype_validation.exists():
        validation = json.loads(prototype_validation.read_text(encoding="utf-8"))
        check(validation["status"] == "passed", "prototype validation passed")
        check(validation["frameCount"] == 48, "prototype validation covers 48 frames")
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

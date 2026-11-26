#!/usr/bin/env python3
"""Audit candidate PNGs, declared sources and gameplay hashes per building asset."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
FAMILIES = ("organization-headquarters", "cleaning-depot")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def audit_family(family):
    base = REPO_ROOT / "docs/art" / family
    matrix = json.loads((base / "candidate-matrix.json").read_text(encoding="utf-8"))
    capture = json.loads((base / "gameplay-capture-v1/capture-manifest.json").read_text(encoding="utf-8"))
    source_cache = {}
    assets = []
    errors = []
    warnings = []
    hashes = []
    for item in matrix["assets"]:
        png = REPO_ROOT / item["pngPath"]
        metadata_path = REPO_ROOT / item["metadataPath"]
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        label = f"{item['candidateId']}|{item['moodId']}"
        entry = {
            "candidateId": item["candidateId"],
            "moodId": item["moodId"],
            "buildingType": item["buildingType"],
            "stateToken": item["stateToken"],
            "orientation": item["orientation"],
            "pngPath": item["pngPath"],
            "pngSha256": sha256(png),
            "metadataPath": item["metadataPath"],
            "metadataSha256": sha256(metadata_path),
            "footprint": item["footprint"],
            "pivot": item["pivot"],
            "pixelsPerMeter": item["pixelsPerMeter"],
            "sources": [],
        }
        if entry["pngSha256"] != item["pngSha256"]:
            errors.append(f"{label}: matrix PNG hash")
        if entry["metadataSha256"] != item["metadataSha256"]:
            errors.append(f"{label}: matrix metadata hash")
        with Image.open(png) as image:
            array = np.asarray(image.convert("RGBA"))
            alpha = array[:, :, 3]
            border = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
            entry["image"] = {
                "width": image.width,
                "height": image.height,
                "mode": image.mode,
                "format": image.format,
                "alphaPixels": int((alpha > 2).sum()),
                "borderAlphaPixels": int((border > 2).sum()),
                "borderAlphaMax": int(border.max()),
            }
            entry["magentaPixels"] = int(
                ((array[:, :, 0] > 240) & (array[:, :, 1] < 40) & (array[:, :, 2] > 240)).sum()
            )
            if image.mode != "RGBA" or image.size != (metadata["image"]["width"], metadata["image"]["height"]):
                errors.append(f"{label}: PNG mode/size")
            if entry["image"]["alphaPixels"] == 0:
                errors.append(f"{label}: empty PNG alpha")
            if entry["magentaPixels"]:
                errors.append(f"{label}: magenta pixels")
            if entry["image"]["borderAlphaPixels"]:
                warnings.append(
                    f"{label}: {entry['image']['borderAlphaPixels']} border pixels have alpha >2 "
                    f"(max {entry['image']['borderAlphaMax']}); inspect shadow/effects clipping in gameplay"
                )
        declared_source_ids = set(metadata.get("metrics", {}).get("sources", []))
        transform_source_ids = {transform.get("sourceId") for transform in metadata.get("transforms", [])}
        if declared_source_ids and not transform_source_ids.issubset(declared_source_ids):
            errors.append(f"{label}: transformed source ids are absent from declared sources")
        for key in ("sourceIds", "sourcePaths"):
            if key in metadata and not metadata[key]:
                errors.append(f"{label}: empty declared {key}")
        seen = set()
        for transform in metadata.get("transforms", []):
            key = (transform.get("sourceId"), transform.get("sourcePath"), transform.get("license"))
            if key in seen:
                continue
            seen.add(key)
            source_path = REPO_ROOT / transform["sourcePath"]
            if not source_path.exists():
                errors.append(f"{label}: missing source {transform['sourcePath']}")
            if transform.get("license") not in ("CC0-1.0", "original"):
                errors.append(f"{label}: unsupported license {transform.get('license')}")
            if source_path.exists():
                if transform["sourcePath"] not in source_cache:
                    source_cache[transform["sourcePath"]] = sha256(source_path)
                source_hash = source_cache[transform["sourcePath"]]
            else:
                source_hash = None
            entry["sources"].append(
                {
                    "sourceId": transform.get("sourceId"),
                    "path": transform.get("sourcePath"),
                    "license": transform.get("license"),
                    "sha256": source_hash,
                    "exists": source_path.exists(),
                }
            )
        entry["technicalStatus"] = "passed" if not any(error.startswith(f"{label}:") for error in errors) else "failed"
        entry["visualReviewStatus"] = "pending_human"
        assets.append(entry)
        hashes.append(entry["pngSha256"])
    capture_errors = []
    if capture.get("pageErrors"):
        capture_errors.append("pageErrors declared in capture manifest")
    matrix_by_candidate = {
        (item["candidateId"], item["moodId"]): item for item in matrix["assets"]
    }
    for capture_entry in capture["captures"]:
        path = REPO_ROOT / "docs/art" / family / "gameplay-capture-v1" / capture_entry["file"]
        if not path.exists() or sha256(path) != capture_entry["canvasSha256"]:
            capture_errors.append(f"capture hash/missing: {capture_entry['file']}")
        if capture_entry.get("pageErrors"):
            capture_errors.append(f"capture pageErrors: {capture_entry['file']}")
        source = matrix_by_candidate.get((capture_entry.get("candidateId"), capture_entry.get("moodId")))
        if not source:
            capture_errors.append(f"capture source missing from matrix: {capture_entry['file']}")
        elif (
            source["pngSha256"] != capture_entry.get("sourcePngSha256")
            or source["metadataSha256"] != capture_entry.get("sourceMetadataSha256")
        ):
            capture_errors.append(f"capture source hash mismatch: {capture_entry['file']}")
    return {
        "schemaVersion": 1,
        "tool": "scripts/audit-building-candidate-evidence.py",
        "family": family,
        "status": "passed" if not errors and not capture_errors else "failed",
        "scope": "candidate PNG mode/size/nonempty alpha/hash, metadata hash, source paths/licenses/hashes and gameplay canvas hashes; border alpha is a visual-review warning; protected-runtime guard is reported separately by the canonical validator",
        "assetCount": len(assets),
        "uniquePngHashes": len(set(hashes)),
        "captureCount": len(capture["captures"]),
        "captureErrors": capture_errors,
        "errors": errors,
        "warnings": warnings,
        "sourceFiles": [{"path": path, "sha256": digest} for path, digest in sorted(source_cache.items())],
        "assets": assets,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--family", choices=(*FAMILIES, "all"), default="all")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    families = FAMILIES if args.family == "all" else (args.family,)
    failed = False
    for family in families:
        result = audit_family(family)
        output = REPO_ROOT / "docs/art" / family / "technical-audit.json"
        if args.check:
            if not output.exists():
                failed = True
                print(json.dumps({"family": family, "status": "failed", "error": "saved technical-audit.json is missing"}))
                continue
            saved = json.loads(output.read_text(encoding="utf-8"))
            if saved != result:
                failed = True
                print(json.dumps({"family": family, "status": "failed", "error": "saved technical-audit.json is stale"}))
                continue
        else:
            output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            json.dumps(
                {
                    "family": family,
                    "status": result["status"],
                    "assets": result["assetCount"],
                    "uniquePngHashes": result["uniquePngHashes"],
                    "captures": result["captureCount"],
                    "errors": len(result["errors"]) + len(result["captureErrors"]),
                    "warnings": len(result["warnings"]),
                    "output": str(output.relative_to(REPO_ROOT)),
                }
            )
        )
        failed |= result["status"] != "passed"
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

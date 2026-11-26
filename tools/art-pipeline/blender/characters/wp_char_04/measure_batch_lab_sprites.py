#!/usr/bin/env python3
"""Measure a review subset of batch frames and publish it to the isolated Phaser lab."""

import argparse
import hashlib
import json
import shutil
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def measure(path, role, direction, animation, sample_index, qa_root, lab_id):
    with Image.open(path) as image:
        rgba = np.asarray(image.convert("RGBA"))
        alpha = rgba[:, :, 3]
        rows, columns = np.where(alpha > 2)
        if not len(rows):
            raise RuntimeError(f"Empty image: {path}")
        left, top = int(columns.min()), int(rows.min())
        right, bottom = int(columns.max()) + 1, int(rows.max()) + 1
        width, height = image.size
        target = qa_root / "sprites" / path.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        return {
            "role": role,
            "direction": direction,
            "animation": animation,
            "sampleIndex": sample_index,
            "sourcePath": str(path.relative_to(REPO_ROOT)),
            "sourceSha256": sha256(path),
            "path": f"/qa-{lab_id}/sprites/{path.name}",
            "sha256": sha256(target),
            "width": width,
            "height": height,
            "visible": {"left": left, "top": top, "right": right, "bottom": bottom},
            "visibleWidth": right - left,
            "visibleHeight": bottom - top,
            "support": {"x": (left + right) / 2, "y": bottom},
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--lab-id", default="character-batch-01")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run_root = Path(args.run_root).resolve()
    output_path = Path(args.output).resolve()
    qa_root = REPO_ROOT / "apps/web" / f"qa-{args.lab_id}"
    if output_path.exists() or qa_root.exists():
        raise RuntimeError("Lab manifest/output already exists")
    validation_path = run_root / "batch-validation.json"
    validation = json.loads(validation_path.read_text(encoding="utf-8"))
    if validation.get("status") != "passed" or validation.get("technicalValidation") != "passed" or validation.get("errorCount") != 0:
        raise RuntimeError("Scale lab requires passed full batch validation")
    if validation.get("runId") != run_root.name or validation.get("counts", {}).get("frames") != 504:
        raise RuntimeError("Scale lab validation identity/count mismatch")
    sheet = json.loads((run_root / "final-sheet.json").read_text(encoding="utf-8"))
    selected = [
        item
        for item in sheet["inputs"]
        if item["animation"] == "idle" or (item["animation"] == "walk" and item["sampleIndex"] == 4)
    ]
    if len(selected) != 112:
        raise RuntimeError(f"Expected 112 review frames, got {len(selected)}")
    qa_root.mkdir(parents=True, exist_ok=True)
    frames = []
    for item in selected:
        source = REPO_ROOT / item["path"]
        if sha256(source) != item["sha256"]:
            raise RuntimeError(f"Source hash mismatch: {source}")
        frames.append(
            measure(
                source,
                item["role"],
                item["direction"],
                item["animation"],
                item["sampleIndex"],
                qa_root,
                args.lab_id,
            )
        )
    frames.sort(key=lambda item: (item["role"], item["animation"], item["direction"], item["sampleIndex"]))
    groups = {}
    for frame in frames:
        key = (frame["role"], frame["animation"], frame["direction"])
        groups.setdefault(key, []).append(frame)
    summaries = []
    for (role, animation, direction), items in sorted(groups.items()):
        heights = [item["visibleHeight"] for item in items]
        summaries.append(
            {
                "role": role,
                "animation": animation,
                "direction": direction,
                "frames": len(items),
                "minVisibleHeight": min(heights),
                "maxVisibleHeight": max(heights),
                "medianVisibleHeight": statistics.median(heights),
                "stableScale28": 28 / max(heights),
                "stableScale34": 34 / max(heights),
            }
        )
    manifest = {
        "schemaVersion": 1,
        "status": "measured_candidate_lab_subset_pending_human_review",
        "runRoot": str(run_root.relative_to(REPO_ROOT)),
        "batchValidation": {
            "path": str(validation_path.relative_to(REPO_ROOT)),
            "sha256": sha256(validation_path),
            "status": validation["status"],
        },
        "selection": "four idle directions plus walk sample 4 in each direction for all 14 roles; full 504-frame validation remains batch-validation.json",
        "runtimePromotion": False,
        "humanApprovalClaimed": False,
        "alphaThreshold": 2,
        "supportRule": "horizontal center of the lowest visible alpha row",
        "calibrationRule": "one scale per role/animation/direction using the maximum visible height; per-frame support origin",
        "frames": frames,
        "summaries": summaries,
    }
    (qa_root / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "measured", "roles": len({frame["role"] for frame in frames}), "frames": len(frames), "manifest": str(output_path.relative_to(REPO_ROOT)), "qaRoot": str(qa_root.relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

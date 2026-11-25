#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
CANDIDATE_ROOT = REPO_ROOT / "docs/art/characters/candidates/phase-1b"
REQUIRED_SHEETS = {
    "phase1b-scale-0_5x.png",
    "phase1b-scale-1x.png",
    "phase1b-scale-2x.png",
    "phase1b-scale-2_5x.png",
    "phase1b-before-after.png",
    "phase1b-workers-pair.png",
    "phase1b-enforcers-pair.png",
    "phase1b-technician-vs-workers.png",
    "phase1b-six-operational.png",
    "phase1b-four-directions.png",
    "phase1b-six-with-runtime-controls.png",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=CANDIDATE_ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    errors = []
    manifest = load_json(root / "candidate-manifest.json")
    validation = load_json(root / "candidate-validation.json")
    review = load_json(root / "review-sheets.json")
    metrics = load_json(root / "visual-metrics.json")

    if manifest.get("status") != "candidate" or manifest.get("runtimePromotion") is not False:
        errors.append("Candidate manifest must remain candidate with runtimePromotion=false")
    if validation.get("status") != "passed":
        errors.append("Candidate technical validation is not passed")
    jobs = manifest.get("jobs", [])
    if len(jobs) != 6:
        errors.append(f"Expected 6 jobs, received {len(jobs)}")
    frame_count = sum(len(job.get("outputs", [])) for job in jobs)
    if frame_count != 96:
        errors.append(f"Expected 96 frames, received {frame_count}")
    for job in jobs:
        if len(job.get("outputs", [])) != 16:
            errors.append(f"{job.get('id')}: expected 16 frames")
        if job.get("status") != "candidate":
            errors.append(f"{job.get('id')}: job is not candidate")

    if review.get("status") != "visual_review" or review.get("runtimePromotion") is not False:
        errors.append("Review sheets must remain visual_review with runtimePromotion=false")
    if review.get("captureType") != "offline_pillow_composition_not_phaser":
        errors.append("Review sheets must be labelled as offline composition, not Phaser capture")
    sheet_paths = {Path(entry["path"]).name for entry in review.get("sheets", [])}
    if sheet_paths != REQUIRED_SHEETS:
        errors.append(f"Review sheet set differs: missing={sorted(REQUIRED_SHEETS - sheet_paths)} extra={sorted(sheet_paths - REQUIRED_SHEETS)}")
    for sheet in review.get("sheets", []):
        path = REPO_ROOT / sheet["path"]
        if not path.is_file() or sha256(path) != sheet["sha256"]:
            errors.append(f"Review sheet hash mismatch: {sheet['path']}")
        elif path.stat().st_size >= 1024 * 1024:
            errors.append(f"Review sheet exceeds 1 MiB: {sheet['path']}")

    if metrics.get("status") != "measured" or metrics.get("approval") != "pending_human":
        errors.append("Visual metrics must remain measured and pending human approval")
    if len(metrics.get("characters", [])) != 6 or len(metrics.get("pairs", [])) != 5:
        errors.append("Visual metrics must cover 6 characters and 5 required pairs")
    if metrics.get("duplicateFrameHashes"):
        errors.append("Duplicate frame hashes detected across the candidate batch")

    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "approval": "pending_human",
        "runtimePromotion": False,
        "jobs": len(jobs),
        "frames": frame_count,
        "reviewSheets": len(review.get("sheets", [])),
        "visualPairs": len(metrics.get("pairs", [])),
        "errors": errors,
    }
    output = root / "delivery-validation.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose_phase1_candidate_sheets import prepared_sprite, sha256

REPO_ROOT = Path(__file__).resolve().parents[4]
CANDIDATE_ROOT = REPO_ROOT / "docs/art/characters/candidates/phase-1b"
OLD_MANIFEST = REPO_ROOT / "docs/art/characters/candidates/candidate-manifest.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def output_for(job, direction, animation, frame):
    return REPO_ROOT / next(
        entry["path"]
        for entry in job["outputs"]
        if entry["direction"] == direction
        and entry["animation"] == animation
        and entry["frame"] == frame
    )


def normalized_sprite(path: Path, gamma: float, height: int = 64):
    sprite = prepared_sprite(path, height, gamma)
    canvas = Image.new("RGBA", (height, height), (0, 0, 0, 0))
    canvas.paste(sprite, ((height - sprite.width) // 2, (height - sprite.height) // 2), sprite)
    return canvas


def luminance_and_mask(path: Path, gamma: float):
    rgba = normalized_sprite(path, gamma)
    background = Image.new("RGBA", rgba.size, (214, 196, 161, 255))
    background.paste(rgba, (0, 0), rgba)
    luminance = background.convert("L")
    histogram = luminance.histogram()
    total = sum(histogram)
    mean = sum(index * count for index, count in enumerate(histogram)) / total
    variance = sum((index - mean) ** 2 * count for index, count in enumerate(histogram)) / total
    mask = rgba.getchannel("A").point(lambda value: 255 if value >= 128 else 0, mode="1")
    return luminance, mask, {
        "meanLuminance": round(mean, 3),
        "luminanceStdDev": round(variance**0.5, 3),
        "luminanceRange": [
            next(index for index, count in enumerate(histogram) if count),
            max(index for index, count in enumerate(histogram) if count),
        ],
        "visibleMaskPixels": sum(mask.histogram()[1:]),
    }


def pair_metrics(left_path: Path, right_path: Path, gamma: float):
    left_luma, left_mask, left_stats = luminance_and_mask(left_path, gamma)
    right_luma, right_mask, right_stats = luminance_and_mask(right_path, gamma)
    intersection = sum(ImageChops.logical_and(left_mask, right_mask).histogram()[1:])
    union = sum(ImageChops.logical_or(left_mask, right_mask).histogram()[1:])
    difference = ImageChops.difference(left_luma, right_luma)
    return {
        "maskIoU": round(intersection / union, 4) if union else 0,
        "meanAbsoluteLuminanceDifference": round(ImageStat.Stat(difference).mean[0], 3),
        "left": left_stats,
        "right": right_stats,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=CANDIDATE_ROOT / "candidate-manifest.json",
    )
    parser.add_argument(
        "--validation",
        type=Path,
        default=CANDIDATE_ROOT / "candidate-validation.json",
    )
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    validation_path = args.validation.resolve()
    manifest = load_json(manifest_path)
    validation = load_json(validation_path)
    if validation.get("status") != "passed":
        raise SystemExit("Candidate validation is not passed; visual metrics were not generated")
    old = load_json(OLD_MANIFEST)
    jobs = {job["factoryCharacterId"]: job for job in manifest["jobs"]}
    old_jobs = {job["factoryCharacterId"]: job for job in old["jobs"]}
    gamma = manifest["presentation"]["gamma"]

    characters = []
    for factory_id, job in jobs.items():
        directions = []
        for direction in range(4):
            _, _, stats = luminance_and_mask(output_for(job, direction, "idle", 0), gamma)
            directions.append({"direction": direction, **stats})
        characters.append(
            {
                "id": factory_id,
                "jobId": job["id"],
                "directions": directions,
                "idleWalkHashesDiffer": all(
                    next(
                        entry["sha256"]
                        for entry in job["outputs"]
                        if entry["direction"] == direction
                        and entry["animation"] == "idle"
                        and entry["frame"] == 0
                    )
                    != next(
                        entry["sha256"]
                        for entry in job["outputs"]
                        if entry["direction"] == direction
                        and entry["animation"] == "walk"
                        and entry["frame"] == 0
                    )
                    for direction in range(4)
                ),
            }
        )

    pairs = []
    for label, left_id, right_id, left_job, right_job in (
        ("Worker A vs Worker B", "construction_worker_a", "construction_worker_b", jobs, jobs),
        ("Enforcer A vs Enforcer B", "enforcer_male", "enforcer_female", jobs, jobs),
        ("Supervisor old vs new", "supervisor", "supervisor", old_jobs, jobs),
        ("Worker old vs new", "construction_worker_a", "construction_worker_a", old_jobs, jobs),
        ("Enforcer old vs new", "enforcer_male", "enforcer_male", old_jobs, jobs),
    ):
        pairs.append(
            {
                "label": label,
                "leftId": left_id,
                "rightId": right_id,
                **pair_metrics(
                    output_for(left_job[left_id], 0, "idle", 0),
                    output_for(right_job[right_id], 0, "idle", 0),
                    gamma,
                ),
            }
        )

    hashes = {}
    for job in jobs.values():
        for output in job["outputs"]:
            hashes.setdefault(output["sha256"], []).append(output["path"])
    duplicate_hashes = [paths for paths in hashes.values() if len(paths) > 1]
    payload = {
        "schemaVersion": 1,
        "status": "measured",
        "approval": "pending_human",
        "runtimePromotion": False,
        "purpose": "Objective visual orientation metrics only; not an automatic art approval.",
        "sourceManifestSha256": sha256(manifest_path),
        "validationSha256": sha256(validation_path),
        "gamma": gamma,
        "normalizedHeightPixels": 64,
        "characters": characters,
        "pairs": pairs,
        "duplicateFrameHashes": duplicate_hashes,
    }
    output = CANDIDATE_ROOT / "visual-metrics.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "measured",
                "characters": len(characters),
                "pairs": len(pairs),
                "duplicateFrameHashes": len(duplicate_hashes),
                "output": str(output.relative_to(REPO_ROOT)),
            }
        )
    )


if __name__ == "__main__":
    main()

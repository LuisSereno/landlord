#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compose_phase1_candidate_sheets import prepared_sprite, sha256

REPO_ROOT = Path(__file__).resolve().parents[4]
CANDIDATE_ROOT = REPO_ROOT / "docs/art/characters/candidates/phase-1b"
OLD_MANIFEST = REPO_ROOT / "docs/art/characters/candidates/candidate-manifest.json"
RUNTIME_MANIFEST = REPO_ROOT / "apps/web/src/generated/runtime-assets-blender.json"


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


def runtime_frame(character, direction, animation, frame):
    frames = character["animations"][animation]["frames"]
    return REPO_ROOT / "apps/web/public" / frames[direction * 2 + frame]["src"].lstrip("/")


def build_sheet(path: Path, title: str, rows, columns, sprite_height: int, gamma: float):
    label_width = 185
    cell_width = max(96, sprite_height + 34)
    cell_height = sprite_height + 38
    title_height = 48
    header_height = 34
    canvas = Image.new(
        "RGB",
        (
            label_width + cell_width * len(columns),
            title_height + header_height + cell_height * len(rows),
        ),
        "#D6C4A1",
    )
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 12), title, fill="#25282A")
    for column_index, label in enumerate(columns):
        draw.text(
            (label_width + column_index * cell_width + 6, title_height + 9),
            label,
            fill="#25282A",
        )
    for row_index, row in enumerate(rows):
        top = title_height + header_height + row_index * cell_height
        draw.text((10, top + 9), row["label"], fill="#25282A")
        for column_index, sprite_path in enumerate(row["sprites"]):
            left = label_width + column_index * cell_width
            draw.rectangle(
                (left + 2, top + 2, left + cell_width - 2, top + cell_height - 2),
                outline="#6F6658",
                width=1,
            )
            sprite = prepared_sprite(sprite_path, sprite_height, gamma)
            x = left + (cell_width - sprite.width) // 2
            y = top + (cell_height - sprite.height) // 2
            canvas.paste(sprite, (x, y), sprite)
    canvas.save(path, optimize=True, compress_level=9)
    with Image.open(path) as image:
        return {"width": image.width, "height": image.height}


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
        raise SystemExit("Candidate validation is not passed; review sheets were not generated")
    old = load_json(OLD_MANIFEST)
    runtime = load_json(RUNTIME_MANIFEST)
    jobs = {job["factoryCharacterId"]: job for job in manifest["jobs"]}
    old_jobs = {job["factoryCharacterId"]: job for job in old["jobs"]}
    gamma = manifest["presentation"]["gamma"]
    base_height = manifest["presentation"]["targetHeightPixels"]
    sheets = []

    def emit(file_name, title, rows, columns, sprite_height):
        path = CANDIDATE_ROOT / file_name
        size = build_sheet(path, title, rows, columns, sprite_height, gamma)
        if path.stat().st_size >= 1024 * 1024:
            raise RuntimeError(f"Review sheet exceeds 1 MiB: {path}")
        sheets.append(
            {
                "path": str(path.relative_to(REPO_ROOT)),
                "sha256": sha256(path),
                "spriteHeight": sprite_height,
                "gamma": gamma,
                **size,
            }
        )

    scale_columns = ["d0 idle0", "d0 walk1", "d1 idle0", "d2 idle0", "d3 idle0"]
    scale_rows = [
        {
            "label": job["displayName"],
            "sprites": [
                output_for(job, 0, "idle", 0),
                output_for(job, 0, "walk", 1),
                output_for(job, 1, "idle", 0),
                output_for(job, 2, "idle", 0),
                output_for(job, 3, "idle", 0),
            ],
        }
        for job in jobs.values()
    ]
    for scale in manifest["presentation"]["reviewScales"]:
        label = str(scale).replace(".", "_")
        emit(
            f"phase1b-scale-{label}x.png",
            f"WP-CHAR-01B six operational candidates - {scale}x - offline composition",
            scale_rows,
            scale_columns,
            round(base_height * scale),
        )

    before_after_rows = []
    for factory_id, label in (
        ("supervisor", "Supervisor"),
        ("construction_worker_a", "Worker A"),
        ("enforcer_male", "Enforcer A"),
    ):
        before_after_rows.append(
            {
                "label": label,
                "sprites": [
                    output_for(old_jobs[factory_id], 0, "idle", 0),
                    output_for(jobs[factory_id], 0, "idle", 0),
                    output_for(jobs[factory_id], 0, "walk", 1),
                ],
            }
        )
    emit(
        "phase1b-before-after.png",
        "WP-CHAR-01B before/after - old idle0 / new idle0 / new walk1",
        before_after_rows,
        ["Old idle0", "New idle0", "New walk1"],
        140,
    )

    def pair_rows(factory_ids):
        return [
            {
                "label": jobs[factory_id]["displayName"],
                "sprites": [
                    output_for(jobs[factory_id], 0, "idle", 0),
                    output_for(jobs[factory_id], 0, "walk", 1),
                ],
            }
            for factory_id in factory_ids
        ]

    emit(
        "phase1b-workers-pair.png",
        "WP-CHAR-01B worker A vs worker B",
        pair_rows(["construction_worker_a", "construction_worker_b"]),
        ["Idle0", "Walk1"],
        140,
    )
    emit(
        "phase1b-enforcers-pair.png",
        "WP-CHAR-01B enforcer A vs enforcer B",
        pair_rows(["enforcer_male", "enforcer_female"]),
        ["Idle0", "Walk1"],
        140,
    )
    emit(
        "phase1b-technician-vs-workers.png",
        "WP-CHAR-01B technician vs construction workers",
        pair_rows(["maintenance_technician", "construction_worker_a", "construction_worker_b"]),
        ["Idle0", "Walk1"],
        140,
    )
    emit(
        "phase1b-six-operational.png",
        "WP-CHAR-01B six operational candidates",
        pair_rows(list(jobs)),
        ["Idle0", "Walk1"],
        120,
    )

    orientation_rows = [
        {
            "label": job["displayName"],
            "sprites": [output_for(job, direction, "idle", 0) for direction in range(4)],
        }
        for job in jobs.values()
    ]
    emit(
        "phase1b-four-directions.png",
        "WP-CHAR-01B four-direction idle comparison",
        orientation_rows,
        ["d0", "d1", "d2", "d3"],
        100,
    )

    control_ids = [
        "chr_worker",
        "chr_citizen",
        "chr_police",
        "chr_firefighter",
        "chr_medical",
    ]
    control_rows = pair_rows(list(jobs)) + [
        {
            "label": f"Runtime {character_id}",
            "sprites": [
                runtime_frame(runtime["characters"][character_id], 0, "idle", 0),
                runtime_frame(runtime["characters"][character_id], 0, "walk", 1),
            ],
        }
        for character_id in control_ids
    ]
    emit(
        "phase1b-six-with-runtime-controls.png",
        "WP-CHAR-01B candidates with existing Rocketbox runtime controls",
        control_rows,
        ["Idle0", "Walk1"],
        90,
    )

    payload = {
        "schemaVersion": 1,
        "status": "visual_review",
        "approval": "pending_human",
        "runtimePromotion": False,
        "captureType": "offline_pillow_composition_not_phaser",
        "sourceManifestSha256": sha256(manifest_path),
        "validationSha256": sha256(validation_path),
        "baseHeightPixels": base_height,
        "reviewScales": manifest["presentation"]["reviewScales"],
        "controls": control_ids,
        "sheets": sheets,
    }
    output = CANDIDATE_ROOT / "review-sheets.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "generated", "sheets": len(sheets), "output": str(output.relative_to(REPO_ROOT))}))


if __name__ == "__main__":
    main()

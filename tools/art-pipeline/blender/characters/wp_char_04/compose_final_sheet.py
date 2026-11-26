#!/usr/bin/env python3
"""Compose review sheets for the complete non-promoted WP-CHAR-04 batch."""

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
DIRECTIONS = [0, 1, 2, 3]
WALK_SAMPLES = list(range(8))


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp04_final_sheet_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--output-dir")
    args = parser.parse_args([value for value in sys.argv[1:] if value != "--"])
    manifest_path = Path(args.manifest).resolve()
    run_root = Path(args.run_root).resolve()
    output_dir = Path(args.output_dir).resolve() if args.output_dir else run_root
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    execution = json.loads((run_root / "execution.json").read_text(encoding="utf-8"))
    frame_validation_path = run_root / "batch-frame-validation.json"
    frame_validation = json.loads(frame_validation_path.read_text(encoding="utf-8"))
    if execution.get("runId") != run_root.name or execution.get("failures") != [] or execution.get("renderedFrames") != 504:
        raise RuntimeError("Final sheet requires a complete failure-free 504-frame execution")
    if frame_validation.get("status") != "passed" or frame_validation.get("technicalValidation") != "passed" or frame_validation.get("errorCount") != 0:
        raise RuntimeError("Final sheet requires passed frame validation")
    if frame_validation.get("runId") != run_root.name or frame_validation.get("humanApprovalClaimed") is not False:
        raise RuntimeError("Final sheet frame validation identity/status mismatch")
    overview_path = output_dir / "final-sheet.png"
    manifest_out = output_dir / "final-sheet.json"
    role_sheets_dir = output_dir / "role-sheets"
    if overview_path.exists() or manifest_out.exists() or role_sheets_dir.exists():
        raise RuntimeError("Final-sheet outputs already exist")
    output_dir.mkdir(parents=True, exist_ok=True)
    role_sheets_dir.mkdir(parents=True, exist_ok=True)
    helpers = load_helpers()
    roles = list(config["candidates"].items())
    inputs = []
    role_entries = []
    role_sheets = []
    reports = {}
    for role, candidate in roles:
        report_path = run_root / "roles" / role / f"{role}-batch.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        if report["stage"] != "batch" or len(report["outputs"]) != 36:
            raise RuntimeError(f"Invalid batch report: {report_path}")
        reports[role] = report

    cell = 76
    gap = 4
    left = 250
    top = 132
    row_height = 104
    columns = 36
    canvas_width = left + columns * cell + (columns - 1) * gap + 24
    canvas_height = top + len(roles) * row_height + 42
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 18), "WP-CHAR-04 · 14 Kenney characters · COMPLETE CANDIDATE BATCH", fill=(30, 35, 38), font=helpers.font(27))
    draw.text(
        (24, 54),
        "504 frames = 14 roles × 4 directions × (1 idle + 8 walk) · gamma 1.8 · offline review composition",
        fill=(70, 75, 77),
        font=helpers.font(14),
    )
    draw.text(
        (24, 80),
        "Technical candidate evidence only · human approval pending · runtime promotion false",
        fill=(110, 72, 38),
        font=helpers.font(13),
    )
    for column in range(columns):
        direction = column // 9
        animation = "idle" if column % 9 == 0 else "walk"
        sample = 0 if animation == "idle" else column % 9 - 1
        label = f"D{direction} {animation}" if animation == "idle" else f"D{direction} w{sample}"
        draw.text(
            (left + column * (cell + gap), 108),
            label,
            fill=(70, 75, 77),
            font=helpers.font(9),
        )

    def draw_cell(target, target_draw, image, x, y, width, height, label, large=False):
        frame = Image.new("RGBA", (width, height), (218, 221, 216, 255))
        fitted = Image.new("RGBA", (width - 8, height - (22 if large else 16)), (0, 0, 0, 0))
        image.thumbnail(fitted.size, Image.Resampling.LANCZOS)
        fitted.alpha_composite(image, ((fitted.width - image.width) // 2, (fitted.height - image.height) // 2))
        frame.alpha_composite(fitted, (4, 4))
        target_draw.text(
            (x + 5, y + height - (17 if large else 13)),
            label,
            fill=(30, 35, 37),
            font=helpers.font(12 if large else 8),
        )
        target.alpha_composite(frame, (x, y))

    for role_index, (role, candidate) in enumerate(roles):
        report = reports[role]
        outputs = {
            (item["direction"], item["animation"], item["sampleIndex"]): item
            for item in report["outputs"]
        }
        base_y = top + role_index * row_height
        status_color = (146, 91, 38) if candidate["coverage"] == "MESH_ADAPTATION" else (55, 65, 68)
        draw.text((24, base_y + 8), candidate["displayName"], fill=status_color, font=helpers.font(15))
        draw.text((24, base_y + 30), role, fill=(70, 75, 77), font=helpers.font(10))
        draw.text((24, base_y + 48), candidate["sourceFile"], fill=(95, 100, 102), font=helpers.font(10))
        draw.text((24, base_y + 66), "36 frames · pending human review", fill=(110, 72, 38), font=helpers.font(9))
        role_inputs = []
        column = 0
        for direction in DIRECTIONS:
            for animation, sample in [("idle", 0), *[("walk", index) for index in WALK_SAMPLES]]:
                item = outputs[(direction, animation, sample)]
                image_path = REPO_ROOT / item["image"]["path"]
                image_hash = sha256(image_path)
                if image_hash != item["image"]["sha256"]:
                    raise RuntimeError(f"Image hash mismatch: {image_path}")
                entry = {
                    "role": role,
                    "canonicalId": candidate["canonicalId"],
                    "direction": direction,
                    "animation": animation,
                    "sampleIndex": sample,
                    "actionFrame": item["frame"],
                    "path": str(image_path.relative_to(REPO_ROOT)),
                    "sha256": image_hash,
                }
                inputs.append(entry)
                role_inputs.append(str(image_path.relative_to(REPO_ROOT)))
                image = helpers.gamma(Image.open(image_path).convert("RGBA"))
                x = left + column * (cell + gap)
                label = "idle" if animation == "idle" else f"w{sample}"
                draw_cell(canvas, draw, image, x, base_y, cell, cell + 20, label)
                column += 1
        role_entries.append(
            {
                "role": role,
                "canonicalId": candidate["canonicalId"],
                "displayName": candidate["displayName"],
                "sourceFile": candidate["sourceFile"],
                "coverage": candidate["coverage"],
                "technicalCorrection": candidate["technicalCorrection"],
                "visualRisks": candidate["visualRisks"],
                "frames": 36,
                "inputs": role_inputs,
                "approval": "pending_human",
                "runtimePromotion": False,
            }
        )

        role_cell = 150
        role_gap = 8
        role_left = 235
        role_top = 120
        role_canvas = Image.new(
            "RGBA",
            (
                role_left + 9 * role_cell + 8 * role_gap + 24,
                role_top + 4 * (role_cell + 30) + 30,
            ),
            (238, 235, 225, 255),
        )
        role_draw = ImageDraw.Draw(role_canvas)
        role_draw.text((24, 18), f"{candidate['displayName']} · complete candidate batch", fill=(30, 35, 38), font=helpers.font(27))
        role_draw.text((24, 54), f"{role} · {candidate['sourceFile']} · 4 directions × (1 idle + 8 walk)", fill=(70, 75, 77), font=helpers.font(14))
        role_draw.text((24, 80), "Technical evidence only · human approval pending · runtime promotion false", fill=(110, 72, 38), font=helpers.font(13))
        for column in range(9):
            label = "idle" if column == 0 else f"walk {column - 1}"
            role_draw.text((role_left + column * (role_cell + role_gap), 96), label, fill=(70, 75, 77), font=helpers.font(11))
        for direction in DIRECTIONS:
            for column, (animation, sample) in enumerate([("idle", 0), *[("walk", index) for index in WALK_SAMPLES]]):
                item = outputs[(direction, animation, sample)]
                image_path = REPO_ROOT / item["image"]["path"]
                image = helpers.gamma(Image.open(image_path).convert("RGBA"))
                x = role_left + column * (role_cell + role_gap)
                y = role_top + direction * (role_cell + 30)
                label = f"D{direction} · {animation}" + (f" · sample {sample}" if animation == "walk" else "")
                draw_cell(role_canvas, role_draw, image, x, y, role_cell, role_cell, label, large=True)
            role_draw.text((24, role_top + direction * (role_cell + 30) + 60), f"Direction {direction}", fill=(55, 65, 68), font=helpers.font(14))
        role_sheet_path = role_sheets_dir / f"{role}.png"
        role_canvas.convert("RGB").save(role_sheet_path, optimize=True, compress_level=9)
        role_sheets.append(
            {
                "role": role,
                "path": str(role_sheet_path.relative_to(REPO_ROOT)),
                "sha256": sha256(role_sheet_path),
                "bytes": role_sheet_path.stat().st_size,
                "width": role_canvas.width,
                "height": role_canvas.height,
                "frames": 36,
            }
        )

    draw.text(
        (24, canvas_height - 26),
        "Review priorities: common scale/grounding, profession at 28/34 px in scale-lab captures, four-direction silhouette, full walk cycle, jacket/collar fit, dark-role contrast and accessory clearance.",
        fill=(70, 75, 77),
        font=helpers.font(12),
    )
    canvas.convert("RGB").save(overview_path, optimize=True, compress_level=9)
    payload = {
        "schemaVersion": 1,
        "stage": "batch",
        "status": "offline_final_sheet_pending_human_review",
        "runRoot": str(run_root.relative_to(REPO_ROOT)),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "offlineComposition": True,
        "engineCapture": False,
        "gamma": 1.8,
        "scaleMode": "full_canvas_common_scale",
        "frameValidation": {
            "path": str(frame_validation_path.relative_to(REPO_ROOT)),
            "sha256": sha256(frame_validation_path),
            "status": frame_validation["status"],
        },
        "roleCount": len(role_entries),
        "frameCount": len(inputs),
        "framesPerRole": 36,
        "humanApprovalClaimed": False,
        "runtimePromotion": False,
        "batchRendered": True,
        "inputs": inputs,
        "roles": role_entries,
        "roleSheets": role_sheets,
        "sheet": {
            "path": str(overview_path.relative_to(REPO_ROOT)),
            "sha256": sha256(overview_path),
            "bytes": overview_path.stat().st_size,
            "width": canvas.width,
            "height": canvas.height,
        },
    }
    manifest_out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "offline_final_sheet_created",
                "roles": len(role_entries),
                "frames": len(inputs),
                "roleSheets": len(role_sheets),
                "sheet": payload["sheet"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

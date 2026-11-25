#!/usr/bin/env python3
"""Compose the offline WP-CHAR-04 SMOKE contact sheet."""

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


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp04_sheet_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--run-root", required=True)
    parser.add_argument("--output-dir")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    manifest_path = Path(args.manifest).resolve()
    run_root = Path(args.run_root).resolve()
    output_dir = Path(args.output_dir).resolve() if args.output_dir else run_root
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    sheet_path = output_dir / "contact-sheet.png"
    manifest_out = output_dir / "contact-sheet.json"
    if sheet_path.exists() or manifest_out.exists():
        raise RuntimeError("Contact-sheet outputs already exist")
    output_dir.mkdir(parents=True, exist_ok=True)
    helpers = load_helpers()
    roles = list(config["candidates"].items())
    cell_width = 270
    cell_height = 250
    column_gap = 10
    row_height = 315
    canvas_width = 40 + 4 * cell_width + 3 * column_gap
    canvas_height = 155 + 7 * row_height
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-04 · 14 Kenney candidates · SMOKE", fill=(30, 35, 38), font=helpers.font(27))
    draw.text(
        (28, 56),
        "D0 idle-00 + role-specific D0 walk smoke · gamma 1.8 · offline composition",
        fill=(70, 75, 77),
        font=helpers.font(14),
    )
    draw.text(
        (28, 80),
        "Technical smoke only · human approval pending · runtime promotion false",
        fill=(110, 72, 38),
        font=helpers.font(13),
    )
    inputs = []
    role_entries = []
    for index, (role, candidate) in enumerate(roles):
        pair = index // 2
        column_pair = index % 2
        row = pair
        base_x = 20 + column_pair * (2 * cell_width + column_gap)
        base_y = 145 + row * row_height
        status_color = (146, 91, 38) if candidate["coverage"] == "MESH_ADAPTATION" else (55, 65, 68)
        draw.text(
            (base_x, base_y - 38),
            f"{candidate['displayName']} · {candidate['coverage']}",
            fill=status_color,
            font=helpers.font(14),
        )
        draw.text(
            (base_x, base_y - 20),
            candidate["sourceFile"],
            fill=(95, 100, 102),
            font=helpers.font(10),
        )
        report_path = run_root / "roles" / role / f"{role}-prototype.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        outputs = {item["animation"]: item for item in report["outputs"]}
        role_inputs = []
        for offset, animation in enumerate(("idle", "walk")):
            item = outputs[animation]
            image_path = REPO_ROOT / item["image"]["path"]
            image_hash = sha256(image_path)
            if image_hash != item["image"]["sha256"]:
                raise RuntimeError(f"Image hash mismatch: {image_path}")
            inputs.append(
                {
                    "role": role,
                    "canonicalId": candidate["canonicalId"],
                    "animation": animation,
                    "sampleIndex": item["sampleIndex"],
                    "actionFrame": item["frame"],
                    "path": str(image_path.relative_to(REPO_ROOT)),
                    "sha256": image_hash,
                }
            )
            role_inputs.append(str(image_path.relative_to(REPO_ROOT)))
            image = helpers.crop_alpha(Image.open(image_path).convert("RGBA"))
            image = helpers.gamma(image)
            x = base_x + offset * (cell_width + column_gap)
            helpers.panel(
                canvas,
                draw,
                image,
                x,
                base_y,
                cell_width,
                cell_height,
                f"{animation} · {item['sampleIndex']:02d}",
                f"action frame {item['frame']} · D0",
            )
        role_entries.append(
            {
                "role": role,
                "canonicalId": candidate["canonicalId"],
                "displayName": candidate["displayName"],
                "sourceFile": candidate["sourceFile"],
                "coverage": candidate["coverage"],
                "technicalCorrection": candidate["technicalCorrection"],
                "visualRisks": candidate["visualRisks"],
                "inputs": role_inputs,
                "approval": "pending_human",
                "runtimePromotion": False,
            }
        )
    draw.text(
        (28, canvas_height - 30),
        "Review priorities: profession readability at 28/34 px, enforcer-female jacket/collar fit, dark-role contrast, accessory clearance.",
        fill=(70, 75, 77),
        font=helpers.font(13),
    )
    canvas.convert("RGB").save(sheet_path, optimize=True, compress_level=9)
    payload = {
        "schemaVersion": 1,
        "stage": "smoke",
        "status": "offline_contact_sheet_pending_human_review",
        "runRoot": str(run_root.relative_to(REPO_ROOT)),
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "offlineComposition": True,
        "engineCapture": False,
        "gamma": 1.8,
        "roleCount": len(role_entries),
        "frameCount": len(inputs),
        "humanApprovalClaimed": False,
        "runtimePromotion": False,
        "batchRendered": False,
        "inputs": inputs,
        "roles": role_entries,
        "sheet": {
            "path": str(sheet_path.relative_to(REPO_ROOT)),
            "sha256": sha256(sheet_path),
            "bytes": sheet_path.stat().st_size,
            "width": Image.open(sheet_path).width,
            "height": Image.open(sheet_path).height,
        },
    }
    manifest_out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": "offline_contact_sheet_created",
                "roles": len(role_entries),
                "frames": len(inputs),
                "sheet": payload["sheet"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

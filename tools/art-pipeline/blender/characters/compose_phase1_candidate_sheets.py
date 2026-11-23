#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[4]
CANDIDATE_ROOT = REPO_ROOT / "docs/art/characters/candidates"
RUNTIME_MANIFEST = REPO_ROOT / "apps/web/src/generated/runtime-assets-blender.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def gamma_correct(image: Image.Image, gamma: float) -> Image.Image:
    rgba = image.convert("RGBA")
    red, green, blue, alpha = rgba.split()
    lut = [round(255 * (value / 255) ** (1 / gamma)) for value in range(256)]
    return Image.merge("RGBA", (red.point(lut), green.point(lut), blue.point(lut), alpha))


def prepared_sprite(path: Path, height: int, gamma: float | None) -> Image.Image:
    with Image.open(path) as source:
        image = source.convert("RGBA")
    if gamma is not None:
        image = gamma_correct(image, gamma)
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def build_sheet(
    path: Path,
    rows,
    columns,
    sprite_height: int,
    gamma: float | None,
    title: str,
) -> None:
    compact = sprite_height <= 28
    label_width = 150 if compact else 210
    cell_width = 70 if compact else 140
    cell_height = 110 if compact else 200
    title_height = 50
    header_height = 36
    canvas = Image.new(
        "RGB",
        (label_width + cell_width * len(columns), title_height + header_height + cell_height * len(rows)),
        "#D6C4A1",
    )
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 12), title, fill="#25282A")
    for column_index, label in enumerate(columns):
        draw.text(
            (label_width + column_index * cell_width + 6, title_height + 10),
            label,
            fill="#25282A",
        )
    for row_index, row in enumerate(rows):
        top = title_height + header_height + row_index * cell_height
        label = row["shortLabel"] if compact else row["label"]
        draw.text((10, top + 8), label, fill="#25282A")
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


def main() -> None:
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
        raise SystemExit("Candidate validation is not passed; contact sheets were not generated")
    runtime = load_json(RUNTIME_MANIFEST)
    columns = [
        f"d{direction} {animation}{frame}"
        for direction in range(4)
        for animation in ("idle", "walk")
        for frame in (0, 1)
    ]
    rows = []
    for job in manifest["jobs"]:
        sprites = []
        for direction in range(4):
            for animation in ("idle", "walk"):
                for frame in (0, 1):
                    output = next(
                        entry
                        for entry in job["outputs"]
                        if entry["direction"] == direction
                        and entry["animation"] == animation
                        and entry["frame"] == frame
                    )
                    sprites.append(REPO_ROOT / output["path"])
        rows.append(
            {
                "label": job["displayName"],
                "shortLabel": job["role"].replace("_", " ").title(),
                "sprites": sprites,
            }
        )
    for character_id in ("chr_worker", "chr_citizen"):
        character = runtime["characters"][character_id]
        sprites = []
        for direction in range(4):
            for animation in ("idle", "walk"):
                for frame_index in (0, 1):
                    frame = character["animations"][animation]["frames"][direction * 2 + frame_index]
                    sprites.append(REPO_ROOT / "apps/web/public" / frame["src"].lstrip("/"))
        rows.append(
            {
                "label": f"Control: {character_id}",
                "shortLabel": f"Control {character_id.removeprefix('chr_')}",
                "sprites": sprites,
            }
        )

    sheets = [
        {
            "file": "phase1-candidates-raw.png",
            "title": "WP-CHAR-01 candidates - raw bake",
            "spriteHeight": 140,
            "gamma": None,
        },
        {
            "file": "phase1-candidates-gameplay.png",
            "title": "WP-CHAR-01 candidates - gameplay gamma 1.8",
            "spriteHeight": 140,
            "gamma": manifest["presentation"]["gamma"],
        },
        {
            "file": "phase1-candidates-1x.png",
            "title": "WP-CHAR-01 candidates - 28 px gameplay height",
            "spriteHeight": manifest["presentation"]["targetHeightPixels"],
            "gamma": manifest["presentation"]["gamma"],
        },
    ]
    results = []
    for sheet in sheets:
        path = CANDIDATE_ROOT / sheet["file"]
        build_sheet(
            path,
            rows,
            columns,
            sheet["spriteHeight"],
            sheet["gamma"],
            sheet["title"],
        )
        with Image.open(path) as image:
            size = list(image.size)
        results.append(
            {
                "path": str(path.relative_to(REPO_ROOT)),
                "sha256": sha256(path),
                "width": size[0],
                "height": size[1],
                "spriteHeight": sheet["spriteHeight"],
                "gamma": sheet["gamma"],
            }
        )
    payload = {
        "schemaVersion": 1,
        "status": "candidate",
        "approval": "pending_human",
        "runtimePromotion": False,
        "sourceManifestSha256": sha256(manifest_path),
        "validationSha256": sha256(validation_path),
        "controls": ["chr_worker", "chr_citizen"],
        "sheets": results,
    }
    output = CANDIDATE_ROOT / "contact-sheets.json"
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "generated", "sheets": len(results), "output": str(output.relative_to(REPO_ROOT))}))


if __name__ == "__main__":
    main()

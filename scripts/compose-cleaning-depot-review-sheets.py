#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEPOT = ROOT / "docs/art/cleaning-depot"
STATES = ["complete", "foundation", "structure", "finishing", "damaged", "burning"]
ORIENTATIONS = [0, 90, 180, 270]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    path = Path("/usr/share/fonts/truetype/dejavu") / name
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def candidate_id(state, orientation):
    state_suffix = "" if state == "complete" else f"_{state}"
    orientation_suffix = "" if orientation == 0 else f"_o{orientation}"
    return f"cd_cleaning_depot_5101{state_suffix}{orientation_suffix}"


def compose(title, mood, entries, output):
    cell_width, cell_height, gap = 340, 300, 18
    columns = 4
    rows = (len(entries) + columns - 1) // columns
    canvas = Image.new("RGB", (40 + columns * cell_width + (columns - 1) * gap, 110 + rows * cell_height), (238, 235, 225))
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 20), title, fill=(30, 35, 38), font=font(26, True))
    draw.text((24, 58), "Composer candidates · human visual review pending · no runtime promotion", fill=(110, 72, 38), font=font(14))
    inputs = []
    for index, (state, orientation) in enumerate(entries):
        identifier = candidate_id(state, orientation)
        source = DEPOT / f"candidates-{'day' if mood == 'day_civic' else 'night'}-v1" / f"{identifier}.png"
        if not source.exists():
            raise FileNotFoundError(source)
        image = Image.open(source).convert("RGBA")
        image.thumbnail((cell_width - 20, cell_height - 58), Image.LANCZOS)
        x = 20 + (index % columns) * (cell_width + gap)
        y = 100 + (index // columns) * cell_height
        panel = Image.new("RGBA", (cell_width, cell_height), (215, 219, 213, 255))
        panel.alpha_composite(image, ((cell_width - image.width) // 2, 8))
        canvas.paste(panel.convert("RGB"), (x, y))
        draw.text((x + 8, y + cell_height - 42), f"cleaning_depot · {state} · o{orientation}", fill=(35, 40, 42), font=font(13, True))
        inputs.append({"path": str(source.relative_to(ROOT)), "sha256": sha256(source)})
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True, compress_level=9)
    return {"path": str(output.relative_to(ROOT)), "sha256": sha256(output), "bytes": output.stat().st_size, "inputs": inputs}


def main():
    review = DEPOT / "review"
    sheets = {
        "complete-day.png": compose("Cleaning depot · complete · day", "day_civic", [("complete", orientation) for orientation in ORIENTATIONS], review / "complete-day.png"),
        "states-day.png": compose("Cleaning depot · states · day · orientation 0", "day_civic", [(state, 0) for state in STATES], review / "states-day.png"),
        "complete-night.png": compose("Cleaning depot · complete · night", "night_civic", [("complete", orientation) for orientation in ORIENTATIONS], review / "complete-night.png"),
    }
    fallback = review / "fallback-signage.png"
    if fallback.exists():
        sheets["fallback-signage.png"] = {
            "path": str(fallback.relative_to(ROOT)),
            "sha256": sha256(fallback),
            "bytes": fallback.stat().st_size,
            "inputs": [],
            "captureKind": "runtime_semantic_fallback",
        }
    payload = {"schemaVersion": 1, "status": "candidate_review_pending_human", "runtimePromotion": False, "sheets": sheets}
    (review / "manifest.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({name: value["bytes"] for name, value in sheets.items()}))


if __name__ == "__main__":
    main()

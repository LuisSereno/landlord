#!/usr/bin/env python3
"""Compone hojas de contacto a partir de capturas auténticas de Phaser."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[5]
BASE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-03"
CAPTURES = BASE / "phaser-captures/1280x720"


def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compose(shot, output, title):
    canvas = Image.new("RGB", (1280, 830), (238, 235, 225))
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 18), title, fill=(30, 35, 38), font=font(24))
    draw.text((24, 52), "Capturas reales de Phaser · 1280×720 · mismo punto mundial y estado", fill=(70, 75, 77), font=font(13))
    labels = {"A": "A · 1× / 28px", "B": "B · 1× / 34px", "C": "C · 1,25× / 28px", "D": "D · 1,15× / 34px"}
    for index, config in enumerate(("A", "B", "C", "D")):
        source = CAPTURES / f"{config}-{shot}.png"
        image = Image.open(source).convert("RGB").resize((640, 360), Image.Resampling.LANCZOS)
        x = (index % 2) * 640
        y = 90 + (index // 2) * 370
        canvas.paste(image, (x, y))
        draw.rectangle((x, y, x + 640, y + 28), fill=(35, 45, 48))
        draw.text((x + 10, y + 6), labels[config], fill=(245, 242, 232), font=font(14))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, optimize=True, compress_level=9)
    return {"path": str(output.relative_to(REPO_ROOT)), "sha256": sha256(output), "bytes": output.stat().st_size}


def main():
    sheets = [
        compose("lineup", BASE / "review/five-by-four-configs.png", "WP-CHAR-03 · Cinco personajes × cuatro configuraciones"),
        compose("general", BASE / "scale-comparison/general-four-configs.png", "WP-CHAR-03 · Escena general A–D"),
        compose("door", BASE / "scale-comparison/door-four-configs.png", "WP-CHAR-03 · Personaje y puerta A–D"),
    ]
    (BASE / "scale-comparison/manifest.json").write_text(json.dumps({"schemaVersion": 1, "status": "phaser_capture_contact_sheets", "sheets": sheets}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(sheets)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

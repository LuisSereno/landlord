"""Compose the Blender thumbnails generated for V.e.0 into eight review sheets."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def main() -> None:
    output = Path(sys.argv[1])
    rendered = json.loads((output / "rendered.json").read_text(encoding="utf8"))
    for category, entries in rendered.items():
        width, cell_height = 768, 304
        rows = (len(entries) + 2) // 3
        sheet = Image.new("RGB", (width, 54 + rows * cell_height), "#0b1422")
        draw = ImageDraw.Draw(sheet)
        draw.text((18, 16), f"Landlord staging · {category}", fill="#f4c44e")
        for index, entry in enumerate(entries):
            column, row = index % 3, index // 3
            x, y = column * 256, 54 + row * cell_height
            image = Image.open(output / entry["thumbnail"]).convert("RGB")
            sheet.paste(image, (x, y))
            label = Path(entry["file"]).stem[:34]
            draw.rectangle((x, y + 256, x + 255, y + 303), fill="#111d2e")
            draw.text((x + 8, y + 266), label, fill="#dbe7f7")
        sheet.save(output / f"contact-sheet-{category}.png", optimize=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Compone láminas de comparación de fuentes a tamaño ampliado y 28 px."""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[5]
SOURCE_DIR = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/source-comparison"
REPORT_PATH = SOURCE_DIR / "source-comparison.json"


def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def gamma(image, power=1.8):
    array = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    array = np.clip(array, 0, 1) ** (1.0 / power)
    return Image.fromarray(np.rint(array * 255).astype(np.uint8), "RGB")


def character_crop(image, bounds, padding=8):
    width, height = image.size
    left = max(0, int(np.floor(bounds["minX"] * width)) - padding)
    right = min(width, int(np.ceil(bounds["maxX"] * width)) + padding)
    top = max(0, int(np.floor((1.0 - bounds["maxY"]) * height)) - padding)
    bottom = min(height, int(np.ceil((1.0 - bounds["minY"]) * height)) + padding)
    return image.crop((left, top, right, bottom))


def fit(image, size):
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    image.thumbnail(size, Image.Resampling.LANCZOS)
    result.alpha_composite(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return result


def main():
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    labels = {
        "rocketbox": "Rocketbox corregido",
        "kenney": "Kenney worker",
        "quaternius": "Quaternius + UAL1",
    }
    columns = ["idle", "walk-00", "walk-01", "walk-02"]
    margin = 24
    header = 86
    row_height = 330
    panel = 280
    sheet = Image.new("RGB", (margin * 2 + panel * 4, header + row_height * 3 + margin), (238, 235, 225))
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 20), "WP-CHAR-02A · Comparación de fuentes", fill=(30, 35, 38), font=font(27))
    draw.text((margin, 56), "Misma cámara 45°/30°, ortográfica 2,05, suelo 0,25 m y escala aproximada 1,8 m · composiciones offline", fill=(65, 70, 72), font=font(14))
    crops = []
    for row, source_name in enumerate(("rocketbox", "kenney", "quaternius")):
        source = report["sources"][source_name]
        y = header + row * row_height
        draw.text((margin, y + 8), labels[source_name], fill=(30, 35, 38), font=font(19))
        draw.text((margin, y + 34), f"{source['armature']['bones']} huesos · {source['mesh']['triangles']} triángulos", fill=(75, 80, 82), font=font(13))
        for column, key in enumerate(columns):
            animation, index = ("idle", 0) if key == "idle" else ("walk", int(key[-2:]))
            sample = source["animations"][animation]["samples"][index]
            image = Image.open(REPO_ROOT / sample["image"]["path"]).convert("RGBA")
            crop = character_crop(image, sample["cameraBounds"])
            crops.append((source_name, key, crop))
            x = margin + column * panel
            framed = fit(crop, (panel - 16, 250))
            sheet.paste(framed, (x + 8, y + 58), framed)
            draw.text((x + 10, y + 314), key, fill=(40, 45, 47), font=font(14))
    sheet.save(SOURCE_DIR / "source-comparison-enlarged.png", optimize=True, compress_level=9)

    game = Image.new("RGB", (margin * 2 + panel * 4, header + 118 * 3 + margin), (238, 235, 225))
    game_draw = ImageDraw.Draw(game)
    game_draw.text((margin, 20), "WP-CHAR-02A · Comparación a 28 px", fill=(30, 35, 38), font=font(27))
    game_draw.text((margin, 56), "Altura de personaje = 28 px · gamma 1,8 · recorte desde bounds de vértices evaluados", fill=(65, 70, 72), font=font(14))
    for row, source_name in enumerate(("rocketbox", "kenney", "quaternius")):
        y = header + row * 118
        game_draw.text((margin, y + 12), labels[source_name], fill=(30, 35, 38), font=font(17))
        for column, key in enumerate(columns):
            crop = next(item[2] for item in crops if item[0] == source_name and item[1] == key)
            target_height = 28
            target_width = max(1, round(crop.width * target_height / crop.height))
            small = gamma(crop).resize((target_width, target_height), Image.Resampling.LANCZOS)
            x = margin + column * panel
            game.paste(small, (x + 12, y + 48))
            game_draw.text((x + 12 + target_width + 12, y + 54), f"{target_width}px", fill=(80, 84, 85), font=font(12))
            enlarged = gamma(crop).resize((crop.width * 3, crop.height * 3), Image.Resampling.NEAREST)
            framed = fit(enlarged.convert("RGBA"), (120, 84))
            game.paste(framed, (x + 145, y + 20), framed)
    game.save(SOURCE_DIR / "source-comparison-28px.png", optimize=True, compress_level=9)
    print(SOURCE_DIR / "source-comparison-enlarged.png")
    print(SOURCE_DIR / "source-comparison-28px.png")


if __name__ == "__main__":
    main()

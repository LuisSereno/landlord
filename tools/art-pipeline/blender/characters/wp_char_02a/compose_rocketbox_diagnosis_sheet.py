#!/usr/bin/env python3
"""Compone la lámina de diagnóstico Rocketbox sin modificar los renders."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[5]
DIAGNOSTIC_DIR = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/diagnostics/rocketbox"
REPORT_PATH = DIAGNOSTIC_DIR / "rocketbox-animation-diagnosis.json"
OUTPUT_PATH = DIAGNOSTIC_DIR / "rocketbox-animation-diagnosis-sheet.png"
PANEL = 256
MARGIN = 20
HEADER = 78
ROW_HEIGHT = 292
COLUMNS = 8


def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def main():
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    width = MARGIN * 2 + COLUMNS * PANEL
    height = HEADER + ROW_HEIGHT * 4 + MARGIN
    sheet = Image.new("RGB", (width, height), (238, 235, 225))
    draw = ImageDraw.Draw(sheet)
    draw.text((MARGIN, 18), "WP-CHAR-02A · Rocketbox animation diagnosis", fill=(30, 35, 38), font=font(26))
    draw.text(
        (MARGIN, 52),
        "Offline Blender evidence · 8 equidistant walk samples · cyan = left foot · orange = right foot · grid = 0.25 m",
        fill=(62, 67, 69),
        font=font(15),
    )

    def panel(image_path, column, row, title, subtitle=""):
        x = MARGIN + column * PANEL
        y = HEADER + row * ROW_HEIGHT
        image = Image.open(image_path).convert("RGBA")
        image.thumbnail((PANEL - 8, PANEL - 8), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (PANEL - 8, PANEL - 8), (218, 221, 218, 255))
        canvas.alpha_composite(image, ((PANEL - 8 - image.width) // 2, (PANEL - 8 - image.height) // 2))
        sheet.paste(canvas.convert("RGB"), (x + 4, y + 4))
        draw.text((x + 6, y + PANEL + 2), title, fill=(28, 32, 34), font=font(15))
        if subtitle:
            draw.text((x + 6, y + PANEL + 22), subtitle, fill=(76, 80, 81), font=font(12))

    controls = report["controls"]
    panel(DIAGNOSTIC_DIR / "A-original-rest.png", 0, 0, "A · original model", "80 bones · source action")
    panel(DIAGNOSTIC_DIR / "B_original_animation_idle-idle.png", 1, 0, "B · original idle", "no compositor")
    panel(DIAGNOSTIC_DIR / "C_wp_char_01b_idle-idle.png", 2, 0, "C · WP-CHAR-01B idle", "tint + rigid accessories")
    draw.text((MARGIN + 3 * PANEL, HEADER + 28), "Confirmed causes", fill=(30, 35, 38), font=font(20))
    causes = [
        "Walk action: frames 1–33, 30 FPS, 809 F-curves.",
        "Root/pelvis translates 1.247 m in XY.",
        "Uncorrected camera clips 8/8 samples.",
        "Feet penetrate up to 0.069 m without ground alignment.",
        "Legacy frame 1 = frame 17, only the cycle midpoint.",
        "Compositor does not change rig or root motion.",
    ]
    for index, line in enumerate(causes):
        draw.text((MARGIN + 3 * PANEL, HEADER + 66 + index * 28), "· " + line, fill=(55, 60, 62), font=font(15))

    rows = (
        ("B_original_animation_walk", 1, "B · original walk", "root motion + clipping"),
        ("B_in_place_grounded_walk", 2, "B · corrected in-place walk", "root fixed · foot grounded · no clipping"),
        ("C_in_place_grounded_walk", 3, "C · compositor + corrected walk", "same rig metrics as B"),
    )
    for control_name, row, title, subtitle in rows:
        control = controls[control_name]
        for index, sample in enumerate(control["samples"]):
            legacy = " · legacy 0" if sample.get("legacyFrame0") else " · legacy 1" if sample.get("legacyFrame1") else ""
            panel(
                REPO_ROOT / sample["image"]["path"],
                index,
                row,
                f"{index}/8 · f{sample['frame']}{legacy}",
                subtitle if index == 0 else f"L {sample['leftFoot']['minZ']:.3f} · R {sample['rightFoot']['minZ']:.3f} m",
            )
        draw.text((MARGIN, HEADER + row * ROW_HEIGHT + PANEL + 42), title, fill=(30, 35, 38), font=font(13))

    sheet.save(OUTPUT_PATH, optimize=True, compress_level=9)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()

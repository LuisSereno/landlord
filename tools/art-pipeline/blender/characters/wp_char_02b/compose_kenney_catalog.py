#!/usr/bin/env python3
"""Compone los catálogos visuales Kenney ampliado y a 28 px."""

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
CATALOG = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/catalog"
REPORT_PATH = CATALOG / "kenney-character-catalog.json"


def load_sheet_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp02b_sheet_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    helpers = load_sheet_helpers()
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    models = report["models"]
    columns = 5
    rows = (len(models) + columns - 1) // columns
    margin = 24
    header = 82
    panel_width = 250
    panel_height = 292
    canvas = Image.new("RGBA", (margin * 2 + columns * panel_width, header + rows * panel_height + margin), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 20), "WP-CHAR-02B · Catálogo Kenney Mini Characters", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((margin, 56), "20 GLB · idle · cámara 45°/30° · escala normalizada 1,8 m · composición offline", fill=(68, 73, 75), font=helpers.font(14))
    for index, model in enumerate(models):
        row, column = divmod(index, columns)
        x = margin + column * panel_width
        y = header + row * panel_height
        image = helpers.crop_alpha(Image.open(REPO_ROOT / model["render"]["image"]["path"]).convert("RGBA"))
        helpers.panel(canvas, draw, helpers.gamma(image), x, y, panel_width - 10, panel_height - 10, model["file"].replace("character-", "").replace(".glb", ""), f"{model['bones']} huesos · {model['triangles']} tri")
    enlarged = CATALOG / "kenney-character-catalog.png"
    canvas.convert("RGB").save(enlarged, optimize=True, compress_level=9)

    game_panel_width = 220
    game_panel_height = 142
    game = Image.new("RGBA", (margin * 2 + columns * game_panel_width, header + rows * game_panel_height + margin), (238, 235, 225, 255))
    game_draw = ImageDraw.Draw(game)
    game_draw.text((margin, 20), "WP-CHAR-02B · Catálogo Kenney a 28 px", fill=(30, 35, 38), font=helpers.font(27))
    game_draw.text((margin, 56), "Altura 28 px · gamma 1,8 · ampliación nearest 3× para inspección · composición offline", fill=(68, 73, 75), font=helpers.font(14))
    for index, model in enumerate(models):
        row, column = divmod(index, columns)
        x = margin + column * game_panel_width
        y = header + row * game_panel_height
        image = helpers.gamma(helpers.crop_alpha(Image.open(REPO_ROOT / model["render"]["image"]["path"]).convert("RGBA")))
        small = helpers.resize_height(image, 28)
        enlarged_small = small.resize((small.width * 3, small.height * 3), Image.Resampling.NEAREST)
        game_draw.text((x + 8, y + 8), model["file"].replace("character-", "").replace(".glb", ""), fill=(35, 40, 42), font=helpers.font(14))
        helpers.place(game, small, x + 12, y + 48)
        helpers.place(game, enlarged_small, x + 86, y + 34)
        game_draw.text((x + 12, y + 84), f"{small.width}px ancho", fill=(75, 80, 82), font=helpers.font(11))
    game_path = CATALOG / "kenney-character-catalog-28px.png"
    game.convert("RGB").save(game_path, optimize=True, compress_level=9)
    sheets = {
        "schemaVersion": 1,
        "status": "offline_catalog_sheets",
        "runtimePromotion": False,
        "sourceReport": str(REPORT_PATH.relative_to(REPO_ROOT)),
        "sourceReportSha256": sha256(REPORT_PATH),
        "sheets": [
            {
                "path": str(path.relative_to(REPO_ROOT)),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "width": Image.open(path).width,
                "height": Image.open(path).height,
            }
            for path in (enlarged, game_path)
        ],
    }
    (CATALOG / "kenney-character-catalog-sheets.json").write_text(json.dumps(sheets, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"models": len(models), "sheets": len(sheets["sheets"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()

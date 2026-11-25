#!/usr/bin/env python3
"""Comparativas offline de las correcciones artísticas WP-CHAR-03."""

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
BASE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-03"
NEW = BASE / "prototypes"
OLD = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c/prototypes"
REVIEW = BASE / "art-before-after"
LABELS = {"supervisor": "Supervisor", "enforcer": "Enforcer", "firefighter": "Bombero"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp03_art_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    helpers = load_helpers()
    REVIEW.mkdir(parents=True, exist_ok=True)
    inputs = []
    sheets = []
    for role, label in LABELS.items():
        paths = {
            "old_idle": OLD / role / "final" / f"{role}-d0-idle-00.png",
            "new_idle": NEW / role / "smoke" / f"{role}-d0-idle-00.png",
            "old_walk": OLD / role / "final" / f"{role}-d0-walk-04.png",
            "new_walk": NEW / role / "smoke" / f"{role}-d0-walk-04.png",
        }
        for path in paths.values():
            inputs.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path)})
        images = {key: helpers.crop_alpha(Image.open(path).convert("RGBA")) for key, path in paths.items()}
        canvas = Image.new("RGBA", (1500, 850), (238, 235, 225, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((28, 20), f"WP-CHAR-03 · {label} · corrección final", fill=(30, 35, 38), font=helpers.font(27))
        draw.text((28, 58), "02C frente a 03 · idle y walk 4/8 · composición offline", fill=(70, 75, 77), font=helpers.font(14))
        helpers.panel(canvas, draw, helpers.gamma(images["old_idle"]), 25, 100, 350, 310, "02C · idle", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(images["new_idle"]), 395, 100, 350, 310, "03 · idle", "Después")
        helpers.panel(canvas, draw, helpers.gamma(images["old_walk"]), 25, 440, 350, 310, "02C · walk 4/8", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(images["new_walk"]), 395, 440, 350, 310, "03 · walk 4/8", "Después")
        old_head = images["old_idle"].crop((0, 0, images["old_idle"].width, int(images["old_idle"].height * 0.45)))
        new_head = images["new_idle"].crop((0, 0, images["new_idle"].width, int(images["new_idle"].height * 0.45)))
        helpers.panel(canvas, draw, helpers.gamma(old_head), 780, 100, 330, 300, "Cabeza · antes", "Detalle ampliado")
        helpers.panel(canvas, draw, helpers.gamma(new_head), 1130, 100, 330, 300, "Cabeza · después", "Detalle ampliado")
        draw.text((790, 450), "Escala 1× · 28 px", fill=(35, 40, 42), font=helpers.font(18))
        for row, (name, image) in enumerate((("02C", images["old_idle"]), ("03", images["new_idle"]))):
            small = helpers.gamma(helpers.resize_height(image, 28))
            y = 510 + row * 120
            draw.text((790, y - 30), name, fill=(55, 60, 62), font=helpers.font(14))
            helpers.place(canvas, small, 850, y)
            draw.text((790, y + 45), f"{small.width}px ancho", fill=(70, 75, 77), font=helpers.font(12))
        notes = {
            "supervisor": ["Gafas eliminadas", "Casco angular ajustado", "Clipboard bajado al costado"],
            "enforcer": ["Coleta eliminada", "Boca neutra", "Chaqueta/mangas contrastadas"],
            "firefighter": ["Gafas eliminadas", "Casco posterior inclinado", "Franjas anchas visibles"],
        }[role]
        for index, note in enumerate(notes):
            draw.text((1050, 500 + index * 45), f"• {note}", fill=(55, 60, 62), font=helpers.font(15))
        draw.text((28, 800), "Composición offline; no es captura de Phaser. Revisión artística humana pendiente.", fill=(70, 75, 77), font=helpers.font(14))
        path = REVIEW / f"{role}-before-after.png"
        canvas.convert("RGB").save(path, optimize=True, compress_level=9)
        sheets.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path), "bytes": path.stat().st_size})
    manifest = {"schemaVersion": 1, "status": "offline_art_smoke_review_pending", "runtimePromotion": False, "inputs": inputs, "sheets": sheets}
    (REVIEW / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(sheets), "manifest": str((REVIEW / "manifest.json").relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

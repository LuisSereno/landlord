#!/usr/bin/env python3
"""Compone comparaciones smoke de WP-CHAR-02C sin tocar evidencias anteriores."""

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
REVIEW = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c/review"
SMOKE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c/prototypes"
OLD = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes"
WORKER = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/worker-reference/final"
LABELS = {"supervisor": "Supervisor", "enforcer": "Enforcer", "firefighter": "Bombero"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp02c_smoke_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    helpers = load_helpers()
    REVIEW.mkdir(parents=True, exist_ok=True)
    worker_idle = helpers.crop_alpha(Image.open(WORKER / "worker-a-d0-idle-00.png").convert("RGBA"))
    worker_walk = helpers.crop_alpha(Image.open(WORKER / "worker-a-d0-walk-04.png").convert("RGBA"))
    inputs = [
        {"path": str((WORKER / "worker-a-d0-idle-00.png").relative_to(REPO_ROOT)), "sha256": sha256(WORKER / "worker-a-d0-idle-00.png")},
        {"path": str((WORKER / "worker-a-d0-walk-04.png").relative_to(REPO_ROOT)), "sha256": sha256(WORKER / "worker-a-d0-walk-04.png")},
    ]
    sheets = []
    for role, label in LABELS.items():
        new_idle_path = SMOKE / role / "smoke" / f"{role}-d0-idle-00.png"
        new_walk_path = SMOKE / role / "smoke" / f"{role}-d0-walk-04.png"
        if not new_idle_path.exists() or not new_walk_path.exists():
            continue
        old_idle_path = OLD / role / "final" / f"{role}-d0-idle-00.png"
        old_walk_path = OLD / role / "final" / f"{role}-d0-walk-04.png"
        for path in (new_idle_path, new_walk_path, old_idle_path, old_walk_path):
            inputs.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path)})
        new_idle = helpers.crop_alpha(Image.open(new_idle_path).convert("RGBA"))
        new_walk = helpers.crop_alpha(Image.open(new_walk_path).convert("RGBA"))
        old_idle = helpers.crop_alpha(Image.open(old_idle_path).convert("RGBA"))
        old_walk = helpers.crop_alpha(Image.open(old_walk_path).convert("RGBA"))
        canvas = Image.new("RGBA", (1600, 940), (238, 235, 225, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((28, 20), f"WP-CHAR-02C · Smoke · {label}", fill=(30, 35, 38), font=helpers.font(27))
        draw.text((28, 58), "Antes/después, obrero de referencia y escala 1× · composición offline", fill=(70, 75, 77), font=helpers.font(14))
        helpers.panel(canvas, draw, helpers.gamma(old_idle), 25, 100, 360, 300, "02B · idle", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(new_idle), 405, 100, 360, 300, "02C · idle", "Después")
        helpers.panel(canvas, draw, helpers.gamma(old_walk), 25, 430, 360, 300, "02B · walk 4/8", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(new_walk), 405, 430, 360, 300, "02C · walk 4/8", "Después")
        helpers.panel(canvas, draw, helpers.gamma(worker_idle), 800, 100, 360, 300, "Obrero · idle", "Referencia 02A")
        helpers.panel(canvas, draw, helpers.gamma(worker_walk), 800, 430, 360, 300, "Obrero · walk 4/8", "Referencia 02A")
        draw.text((1190, 112), "Escala 1× · 28 px", fill=(35, 40, 42), font=helpers.font(18))
        for row, (name, image) in enumerate((("02B", old_idle), ("02C", new_idle), ("Obrero", worker_idle))):
            small = helpers.gamma(helpers.resize_height(image, 28))
            y = 175 + row * 150
            draw.text((1190, y - 35), name, fill=(55, 60, 62), font=helpers.font(14))
            helpers.place(canvas, small, 1230, y)
            draw.text((1190, y + 55), f"{small.width}px ancho", fill=(70, 75, 77), font=helpers.font(12))
        draw.text((1190, 660), "Revisión local", fill=(35, 40, 42), font=helpers.font(16))
        notes = {
            "supervisor": ["Mancha blanca: ausente", "Casco: cobertura ampliada", "Clipboard: anclado", "Silueta: capataz distinto"],
            "enforcer": ["Círculo negro: ausente", "Rostro: sin barba dominante", "Chaqueta: contraste interno", "Silueta: distinta de policía"],
            "firefighter": ["Casco: dominante", "Rostro: sin barba", "Franjas: visibles", "Silueta: distinta de obrero"],
        }[role]
        for index, note in enumerate(notes):
            draw.text((1190, 700 + index * 32), f"• {note}", fill=(55, 60, 62), font=helpers.font(13))
        draw.text((28, 820), "La revisión local no equivale a aprobación artística humana. Estado: smoke pendiente de revisión.", fill=(70, 75, 77), font=helpers.font(14))
        path = REVIEW / f"02-smoke-{role}.png"
        canvas.convert("RGB").save(path, optimize=True, compress_level=9)
        sheets.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path), "bytes": path.stat().st_size, "width": canvas.width, "height": canvas.height})
    manifest = {"schemaVersion": 1, "status": "smoke_visual_review_pending", "runtimePromotion": False, "inputs": inputs, "sheets": sheets}
    (REVIEW / "smoke-review-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(sheets), "manifest": str((REVIEW / "smoke-review-manifest.json").relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

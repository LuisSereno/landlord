#!/usr/bin/env python3
"""Genera las láminas de revisión de los cuatro prototipos WP-CHAR-02B."""

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
PROTOTYPE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b"
FINAL = PROTOTYPE / "prototypes"
REVIEW = PROTOTYPE / "review"
WORKER_REFERENCE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/worker-reference/final"
RUNTIME = REPO_ROOT / "apps/web/public/assets/runtime/blender-day"
ROLES = ("supervisor", "enforcer", "police", "firefighter")
LABELS = {"worker": "Obrero A · referencia", "supervisor": "Supervisor", "enforcer": "Enforcer", "police": "Policía", "firefighter": "Bombero"}


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp02b_review_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def role_image(role, animation="idle", index=0, direction=0):
    return Image.open(FINAL / role / "final" / f"{role}-d{direction}-{animation}-{index:02d}.png").convert("RGBA")


def worker_image(animation="idle", index=0, direction=0):
    return Image.open(WORKER_REFERENCE / f"worker-a-d{direction}-{animation}-{index:02d}.png").convert("RGBA")


def main():
    helpers = load_helpers()
    REVIEW.mkdir(parents=True, exist_ok=True)
    generated = []
    inputs = []

    def register(path, role):
        inputs.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path), "role": role})

    def save(canvas, filename):
        path = REVIEW / filename
        canvas.convert("RGB").save(path, optimize=True, compress_level=9)
        generated.append(path)
        return path

    worker_idle = helpers.crop_alpha(worker_image())
    worker_walk = helpers.crop_alpha(worker_image("walk", 4))
    register(WORKER_REFERENCE / "worker-a-d0-idle-00.png", "approved style reference idle")
    register(WORKER_REFERENCE / "worker-a-d0-walk-04.png", "approved style reference walk")
    role_idles = {}
    role_walks = {}
    for role in ROLES:
        role_idles[role] = helpers.crop_alpha(role_image(role))
        role_walks[role] = helpers.crop_alpha(role_image(role, "walk", 4))
        register(FINAL / role / "final" / f"{role}-d0-idle-00.png", f"{role} idle")
        register(FINAL / role / "final" / f"{role}-d0-walk-04.png", f"{role} walk midpoint")

    for number, role in enumerate(ROLES, start=3):
        canvas = Image.new("RGBA", (1120, 780), (238, 235, 225, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((28, 20), f"WP-CHAR-02B · Obrero de referencia vs {LABELS[role]}", fill=(30, 35, 38), font=helpers.font(27))
        draw.text((28, 58), "Idle y walk medio · gamma 1,8 · composición offline", fill=(70, 75, 77), font=helpers.font(14))
        helpers.panel(canvas, draw, helpers.gamma(worker_idle), 30, 100, 500, 300, "Obrero A · idle", "Referencia artística 02A")
        helpers.panel(canvas, draw, helpers.gamma(role_idles[role]), 590, 100, 500, 300, f"{LABELS[role]} · idle", "Prototipo 02B")
        helpers.panel(canvas, draw, helpers.gamma(worker_walk), 30, 430, 500, 300, "Obrero A · walk 4/8", "Frame 8")
        helpers.panel(canvas, draw, helpers.gamma(role_walks[role]), 590, 430, 500, 300, f"{LABELS[role]} · walk 4/8", "Frame 8")
        save(canvas, f"{number:02d}-worker-vs-{role}.png")

    canvas = Image.new("RGBA", (1500, 720), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02B · Familia de cinco personajes", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Obrero aprobado como referencia más cuatro profesiones · composición offline", fill=(70, 75, 77), font=helpers.font(14))
    family = (("worker", worker_idle), *((role, role_idles[role]) for role in ROLES))
    for index, (role, image) in enumerate(family):
        helpers.panel(canvas, draw, helpers.gamma(image), 25 + index * 292, 110, 275, 430, LABELS[role], "idle · misma escala relativa")
        small = helpers.gamma(helpers.resize_height(image, 28))
        helpers.place(canvas, small, 55 + index * 292, 590)
        draw.text((45 + index * 292, 630), f"{small.width}px ancho", fill=(65, 70, 72), font=helpers.font(12))
    save(canvas, "07-five-family.png")

    canvas = Image.new("RGBA", (1040, 1460), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02B · Cuatro direcciones de los nuevos candidatos", fill=(30, 35, 38), font=helpers.font(27))
    for row, role in enumerate(ROLES):
        y = 75 + row * 340
        draw.text((26, y), LABELS[role], fill=(35, 40, 42), font=helpers.font(18))
        for direction in range(4):
            image = helpers.crop_alpha(role_image(role, direction=direction))
            helpers.panel(canvas, draw, helpers.gamma(image), 25 + direction * 250, y + 30, 235, 285, f"D{direction} · idle", f"azimut {45 + direction * 90}°")
    save(canvas, "08-four-directions.png")

    canvas = Image.new("RGBA", (8 * 215 + 32, 4 * 315 + 90), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((22, 18), "WP-CHAR-02B · Muestras de marcha", fill=(30, 35, 38), font=helpers.font(26))
    for row, role in enumerate(ROLES):
        y = 60 + row * 315
        draw.text((22, y), LABELS[role], fill=(35, 40, 42), font=helpers.font(17))
        for index in range(8):
            image = helpers.crop_alpha(role_image(role, "walk", index))
            helpers.panel(canvas, draw, helpers.gamma(image), 16 + index * 215, y + 25, 200, 260, f"{index}/8 · f{index * 2}", "dirección 0")
    save(canvas, "09-walk-samples.png")

    canvas = Image.new("RGBA", (1500, 1480), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02B · Escala comparativa 0,5× / 1× / 2× / 2,5×", fill=(30, 35, 38), font=helpers.font(27))
    scales = ((0.5, 14), (1.0, 28), (2.0, 56), (2.5, 70))
    for column, (scale, height) in enumerate(scales):
        x = 25 + column * 368
        draw.text((x + 10, 70), f"{scale:g}× · {height}px", fill=(35, 40, 42), font=helpers.font(18))
        for row, (role, image) in enumerate(family):
            small = helpers.gamma(helpers.resize_height(image, height))
            helpers.panel(canvas, draw, small, x, 110 + row * 265, 350, 240, LABELS[role], f"altura {height}px")
    save(canvas, "10-scales.png")

    row_house = helpers.crop_alpha(Image.open(RUNTIME / "row_house-complete.png").convert("RGBA"))
    workshop = helpers.crop_alpha(Image.open(RUNTIME / "workshop-complete.png").convert("RGBA"))
    delivery = helpers.crop_alpha(Image.open(RUNTIME / "veh_delivery.png").convert("RGBA"))
    truck = helpers.crop_alpha(Image.open(RUNTIME / "veh_truck.png").convert("RGBA"))
    for path, role in (
        (RUNTIME / "row_house-complete.png", "existing row house"),
        (RUNTIME / "workshop-complete.png", "existing workshop"),
        (RUNTIME / "veh_delivery.png", "existing delivery vehicle"),
        (RUNTIME / "veh_truck.png", "existing truck"),
    ):
        register(path, role)
    canvas = Image.new("RGBA", (1500, 950), (205, 210, 204, 255))
    draw = ImageDraw.Draw(canvas)
    draw.polygon([(0, 640), (1500, 560), (1500, 950), (0, 950)], fill=(77, 83, 84))
    draw.polygon([(0, 590), (1500, 510), (1500, 640), (0, 750)], fill=(181, 176, 161))
    draw.line([(0, 750), (1500, 640)], fill=(226, 219, 195), width=5)
    for x in range(80, 1500, 190):
        y = 830 - x * 0.073
        draw.line([(x, y), (x + 95, y - 7)], fill=(202, 190, 142), width=4)
    row_house.thumbnail((560, 500), Image.Resampling.LANCZOS)
    workshop.thumbnail((520, 450), Image.Resampling.LANCZOS)
    delivery.thumbnail((150, 110), Image.Resampling.LANCZOS)
    truck.thumbnail((175, 125), Image.Resampling.LANCZOS)
    helpers.place(canvas, row_house, 60, 75)
    helpers.place(canvas, workshop, 810, 105)
    helpers.place(canvas, truck, 1110, 585)
    helpers.place(canvas, delivery, 390, 650)
    for index, (role, image) in enumerate(family):
        context = helpers.gamma(helpers.resize_height(image, 56))
        helpers.place(canvas, context, 650 + index * 105, 610 - index * 4)
    draw.rectangle((0, 0, 1500, 58), fill=(238, 235, 225))
    draw.text((24, 16), "WP-CHAR-02B · Composición urbana OFFLINE (no es captura de Phaser)", fill=(30, 35, 38), font=helpers.font(24))
    draw.text((1120, 70), "Activos runtime existentes", fill=(40, 45, 47), font=helpers.font(15))
    draw.text((1120, 92), "row_house · workshop · vehículos", fill=(40, 45, 47), font=helpers.font(13))
    save(canvas, "11-street-context-offline.png")

    canvas = Image.new("RGBA", (1500, 760), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02B · Siluetas negras a 28 px", fill=(30, 35, 38), font=helpers.font(27))
    for index, (role, image) in enumerate(family):
        small = helpers.gamma(helpers.resize_height(image, 28))
        alpha = np.asarray(small.getchannel("A"))
        silhouette = Image.new("RGBA", small.size, (22, 26, 28, 255))
        silhouette.putalpha(Image.fromarray(alpha))
        x = 30 + index * 292
        helpers.place(canvas, silhouette, x + 20, 130)
        draw.text((x + 10, 180), f"{index + 1} · {small.width}px", fill=(55, 60, 62), font=helpers.font(14))
        enlarged = silhouette.resize((small.width * 6, small.height * 6), Image.Resampling.NEAREST)
        helpers.place(canvas, enlarged, x + 20, 300)
    draw.text((28, 500), "Siluetas sin color ni detalle interno; la diferenciación debe venir de la forma.", fill=(70, 75, 77), font=helpers.font(15))
    save(canvas, "12-silhouettes.png")

    canvas = Image.new("RGBA", (1500, 720), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02B · Identidad sin etiquetas de profesión", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Sólo números 1–5; el observador debe inferir el oficio por la forma y el vestuario.", fill=(70, 75, 77), font=helpers.font(14))
    for index, (role, image) in enumerate(family):
        helpers.panel(canvas, draw, helpers.gamma(image), 25 + index * 292, 110, 275, 430, f"{index + 1}", "sin etiqueta profesional")
        small = helpers.gamma(helpers.resize_height(image, 28))
        helpers.place(canvas, small, 75 + index * 292, 590)
    save(canvas, "13-unlabeled-professions.png")

    manifest = {
        "schemaVersion": 1,
        "status": "offline_review_package",
        "runtimePromotion": False,
        "approval": "pending_human",
        "inputs": inputs,
        "sheets": [
            {
                "path": str(path.relative_to(REPO_ROOT)),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "width": Image.open(path).width,
                "height": Image.open(path).height,
            }
            for path in generated
        ],
    }
    (REVIEW / "review-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(generated), "manifest": str((REVIEW / "review-manifest.json").relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

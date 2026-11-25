#!/usr/bin/env python3
"""Genera el paquete final de revisión visual WP-CHAR-02C."""

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
BASE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c"
NEW = BASE / "prototypes"
OLD = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes"
WORKER = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/worker-reference/final"
REVIEW = BASE / "review"
RUNTIME = REPO_ROOT / "apps/web/public/assets/runtime/blender-day"
ROLES = ("supervisor", "enforcer", "firefighter")
LABELS = {"worker": "Obrero · referencia", "supervisor": "Supervisor", "enforcer": "Enforcer", "police": "Policía · control", "firefighter": "Bombero"}
FAMILY = ("worker", "supervisor", "enforcer", "police", "firefighter")


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp02c_final_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def role_path(role, animation="idle", index=0, direction=0, old=False):
    if role == "worker":
        return WORKER / f"worker-a-d{direction}-{animation}-{index:02d}.png"
    root = OLD if old or role == "police" else NEW
    return root / role / "final" / f"{role}-d{direction}-{animation}-{index:02d}.png"


def main():
    helpers = load_helpers()
    REVIEW.mkdir(parents=True, exist_ok=True)
    generated = []
    inputs = {}

    def register(path):
        path = Path(path)
        key = str(path.relative_to(REPO_ROOT))
        if key not in inputs:
            inputs[key] = {"path": key, "sha256": sha256(path)}

    def image(role, animation="idle", index=0, direction=0, old=False):
        path = role_path(role, animation, index, direction, old)
        register(path)
        return helpers.crop_alpha(Image.open(path).convert("RGBA"))

    def save(canvas, filename):
        path = REVIEW / filename
        canvas.convert("RGB").save(path, optimize=True, compress_level=9)
        if path.stat().st_size >= 1024 * 1024:
            raise RuntimeError(f"Lámina >=1 MiB: {path} ({path.stat().st_size} B)")
        generated.append(path)
        return path

    idles = {role: image(role) for role in FAMILY}
    walks = {role: image(role, "walk", 4) for role in FAMILY}
    old_idles = {role: image(role, old=True) for role in ROLES}
    old_walks = {role: image(role, "walk", 4, old=True) for role in ROLES}

    for number, role in enumerate(ROLES, start=1):
        canvas = Image.new("RGBA", (1500, 900), (238, 235, 225, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((28, 20), f"WP-CHAR-02C · {LABELS[role]} · antes/después", fill=(30, 35, 38), font=helpers.font(27))
        draw.text((28, 58), "Mismo idle y walk 4/8 · cámara/iluminación comparables · composición offline", fill=(70, 75, 77), font=helpers.font(14))
        helpers.panel(canvas, draw, helpers.gamma(old_idles[role]), 25, 100, 360, 320, "WP-CHAR-02B · idle", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(idles[role]), 405, 100, 360, 320, "WP-CHAR-02C · idle", "Después")
        helpers.panel(canvas, draw, helpers.gamma(old_walks[role]), 25, 450, 360, 320, "WP-CHAR-02B · walk 4/8", "Antes")
        helpers.panel(canvas, draw, helpers.gamma(walks[role]), 405, 450, 360, 320, "WP-CHAR-02C · walk 4/8", "Después")
        old_head = old_idles[role].crop((0, 0, old_idles[role].width, int(old_idles[role].height * 0.46)))
        new_head = idles[role].crop((0, 0, idles[role].width, int(idles[role].height * 0.46)))
        helpers.panel(canvas, draw, helpers.gamma(old_head), 800, 100, 330, 300, "Cabeza · antes", "Detalle ampliado")
        helpers.panel(canvas, draw, helpers.gamma(new_head), 1150, 100, 330, 300, "Cabeza · después", "Detalle ampliado")
        helpers.panel(canvas, draw, helpers.gamma(idles["worker"]), 800, 450, 330, 320, "Obrero · control", "Referencia artística 02A")
        helpers.panel(canvas, draw, helpers.gamma(idles["police"]), 1150, 450, 330, 320, "Policía · control", "Conservada de 02B")
        draw.text((800, 810), "La comparación no atribuye aprobación humana; muestra el cambio producido.", fill=(70, 75, 77), font=helpers.font(14))
        save(canvas, f"{number:02d}-before-after-{role}.png")

    canvas = Image.new("RGBA", (1500, 760), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02C · Controles artísticos conservados", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Obrero de referencia y policía original · ninguna regeneración preventiva", fill=(70, 75, 77), font=helpers.font(14))
    for column, role in enumerate(("worker", "police")):
        x = 25 + column * 520
        helpers.panel(canvas, draw, helpers.gamma(idles[role]), x, 100, 500, 330, f"{LABELS[role]} · idle", "Control conservado")
        helpers.panel(canvas, draw, helpers.gamma(walks[role]), x, 460, 500, 270, f"{LABELS[role]} · walk 4/8", "Control conservado")
        small = helpers.gamma(helpers.resize_height(idles[role], 28))
        helpers.place(canvas, small, x + 210, 420)
    helpers.panel(canvas, draw, helpers.gamma(idles["enforcer"]), 1070, 100, 400, 330, "Enforcer · nuevo", "Comparar paleta y silueta")
    helpers.panel(canvas, draw, helpers.gamma(idles["firefighter"]), 1070, 460, 400, 270, "Bombero · nuevo", "Comparar con obrero")
    save(canvas, "04-controls.png")

    canvas = Image.new("RGBA", (1500, 720), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02C · Familia de cinco personajes", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Tres correcciones más obrero y policía conservados · composición offline", fill=(70, 75, 77), font=helpers.font(14))
    for index, role in enumerate(FAMILY):
        helpers.panel(canvas, draw, helpers.gamma(idles[role]), 25 + index * 292, 110, 275, 430, LABELS[role], "idle · misma escala relativa")
        small = helpers.gamma(helpers.resize_height(idles[role], 28))
        helpers.place(canvas, small, 55 + index * 292, 590)
        draw.text((45 + index * 292, 630), f"{small.width}px ancho", fill=(65, 70, 72), font=helpers.font(12))
    save(canvas, "05-five-family.png")

    canvas = Image.new("RGBA", (1500, 520), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02C · Familia a 28 px", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Altura 28 px y ampliación nearest-neighbor ×5 para inspección de silueta", fill=(70, 75, 77), font=helpers.font(14))
    for index, role in enumerate(FAMILY):
        small = helpers.gamma(helpers.resize_height(idles[role], 28))
        x = 35 + index * 292
        helpers.place(canvas, small, x + 75, 145)
        draw.text((x + 55, 200), f"{index + 1} · {small.width}px", fill=(55, 60, 62), font=helpers.font(14))
        enlarged = small.resize((small.width * 5, small.height * 5), Image.Resampling.NEAREST)
        helpers.place(canvas, enlarged, x + 40, 270)
    save(canvas, "06-five-family-28px.png")

    canvas = Image.new("RGBA", (1040, 1460), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02C · Cuatro direcciones", fill=(30, 35, 38), font=helpers.font(27))
    for row, role in enumerate(("supervisor", "enforcer", "police", "firefighter")):
        y = 75 + row * 340
        draw.text((26, y), LABELS[role], fill=(35, 40, 42), font=helpers.font(18))
        for direction in range(4):
            directional = image(role, direction=direction)
            helpers.panel(canvas, draw, helpers.gamma(directional), 25 + direction * 250, y + 30, 235, 285, f"D{direction} · idle", f"azimut {45 + direction * 90}°")
    save(canvas, "07-four-directions.png")

    canvas = Image.new("RGBA", (1672, 1270), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((22, 18), "WP-CHAR-02C · Ocho muestras de marcha", fill=(30, 35, 38), font=helpers.font(26))
    for row, role in enumerate(("supervisor", "enforcer", "police", "firefighter")):
        y = 60 + row * 295
        draw.text((22, y), LABELS[role], fill=(35, 40, 42), font=helpers.font(17))
        for index in range(8):
            sample = image(role, "walk", index)
            helpers.panel(canvas, draw, helpers.gamma(sample), 16 + index * 205, y + 25, 190, 240, f"{index}/8 · f{index * 2}", "dirección 0")
    save(canvas, "08-walk-samples.png")

    canvas = Image.new("RGBA", (1500, 1120), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02C · Siluetas 02B frente a 02C", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Negro a 28 px; ampliación ×5. Diferencia profesional por forma, color y accesorio.", fill=(70, 75, 77), font=helpers.font(14))
    for row, old in enumerate((True, False)):
        draw.text((28, 105 + row * 500), "WP-CHAR-02B · anterior" if old else "WP-CHAR-02C · corregido", fill=(35, 40, 42), font=helpers.font(18))
        for index, role in enumerate(FAMILY):
            source = old_idles[role] if old and role in ROLES else old_idles.get(role, idles[role]) if old else idles[role]
            small = helpers.gamma(helpers.resize_height(source, 28))
            alpha = np.asarray(small.getchannel("A"))
            silhouette = Image.new("RGBA", small.size, (22, 26, 28, 255))
            silhouette.putalpha(Image.fromarray(alpha))
            x = 30 + index * 292
            helpers.place(canvas, silhouette, x + 20, 150 + row * 500)
            enlarged = silhouette.resize((small.width * 5, small.height * 5), Image.Resampling.NEAREST)
            helpers.place(canvas, enlarged, x + 20, 300 + row * 500)
            draw.text((x + 10, 210 + row * 500), f"{index + 1} · {small.width}px", fill=(55, 60, 62), font=helpers.font(14))
    save(canvas, "09-silhouettes-before-after.png")

    canvas = Image.new("RGBA", (1500, 1480), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02C · Escala 0,5× / 1× / 2× / 2,5×", fill=(30, 35, 38), font=helpers.font(27))
    for column, (scale, height) in enumerate(((0.5, 14), (1.0, 28), (2.0, 56), (2.5, 70))):
        x = 25 + column * 368
        draw.text((x + 10, 70), f"{scale:g}× · {height}px", fill=(35, 40, 42), font=helpers.font(18))
        for row, role in enumerate(FAMILY):
            small = helpers.gamma(helpers.resize_height(idles[role], height))
            helpers.panel(canvas, draw, small, x, 110 + row * 265, 350, 240, LABELS[role], f"altura {height}px")
    save(canvas, "10-scales.png")

    canvas = Image.new("RGBA", (1500, 720), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02C · Identidad sin etiquetas", fill=(30, 35, 38), font=helpers.font(27))
    draw.text((28, 58), "Sólo números 1–5; inferir el oficio por forma, vestuario, color y accesorio.", fill=(70, 75, 77), font=helpers.font(14))
    for index, role in enumerate(FAMILY):
        helpers.panel(canvas, draw, helpers.gamma(idles[role]), 25 + index * 292, 110, 275, 430, f"{index + 1}", "sin etiqueta profesional")
        small = helpers.gamma(helpers.resize_height(idles[role], 28))
        helpers.place(canvas, small, 75 + index * 292, 590)
    save(canvas, "11-unlabeled-professions.png")

    row_house = helpers.crop_alpha(Image.open(RUNTIME / "row_house-complete.png").convert("RGBA"))
    workshop = helpers.crop_alpha(Image.open(RUNTIME / "workshop-complete.png").convert("RGBA"))
    delivery = helpers.crop_alpha(Image.open(RUNTIME / "veh_delivery.png").convert("RGBA"))
    truck = helpers.crop_alpha(Image.open(RUNTIME / "veh_truck.png").convert("RGBA"))
    for path in (RUNTIME / "row_house-complete.png", RUNTIME / "workshop-complete.png", RUNTIME / "veh_delivery.png", RUNTIME / "veh_truck.png"):
        register(path)
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
    for index, role in enumerate(FAMILY):
        context = helpers.gamma(helpers.resize_height(idles[role], 56))
        helpers.place(canvas, context, 650 + index * 105, 610 - index * 4)
    draw.rectangle((0, 0, 1500, 58), fill=(238, 235, 225))
    draw.text((24, 16), "WP-CHAR-02C · Composición urbana OFFLINE (no es captura de Phaser)", fill=(30, 35, 38), font=helpers.font(24))
    draw.text((1120, 70), "Activos runtime existentes", fill=(40, 45, 47), font=helpers.font(15))
    draw.text((1120, 92), "row_house · workshop · vehículos", fill=(40, 45, 47), font=helpers.font(13))
    save(canvas, "12-street-context-offline.png")

    manifest = {
        "schemaVersion": 1,
        "status": "offline_review_package_pending_human",
        "runtimePromotion": False,
        "approval": "pending_human",
        "inputs": list(inputs.values()),
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

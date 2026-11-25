#!/usr/bin/env python3
"""Genera las láminas de revisión del obrero WP-CHAR-02A y su manifiesto de hashes."""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[5]
PROTOTYPE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a"
FINAL = PROTOTYPE / "worker-reference/final"
REVIEW = PROTOTYPE / "worker-reference/review"
REFERENCE = PROTOTYPE / "reference"
RUNTIME = REPO_ROOT / "apps/web/public/assets/runtime/blender-day"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def gamma(image, power=1.8):
    array = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255.0
    rgb = np.clip(array[:, :, :3], 0, 1) ** (1.0 / power)
    array[:, :, :3] = rgb
    return Image.fromarray(np.rint(array * 255).astype(np.uint8), "RGBA")


def crop_alpha(image, padding=6):
    alpha = np.asarray(image.getchannel("A"))
    rows, columns = np.where(alpha > 2)
    if not len(rows):
        raise ValueError("Imagen sin alfa visible")
    box = (
        max(0, int(columns.min()) - padding),
        max(0, int(rows.min()) - padding),
        min(image.width, int(columns.max()) + 1 + padding),
        min(image.height, int(rows.max()) + 1 + padding),
    )
    return image.crop(box)


def crop_bounds(image, bounds, padding=8):
    width, height = image.size
    return image.crop(
        (
            max(0, int(np.floor(bounds["minX"] * width)) - padding),
            max(0, int(np.floor((1 - bounds["maxY"]) * height)) - padding),
            min(width, int(np.ceil(bounds["maxX"] * width)) + padding),
            min(height, int(np.ceil((1 - bounds["minY"]) * height)) + padding),
        )
    )


def resize_height(image, height, nearest=False):
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.Resampling.NEAREST if nearest else Image.Resampling.LANCZOS)


def place(canvas, image, x, y):
    canvas.alpha_composite(image, (int(x), int(y)))


def panel(canvas, draw, image, x, y, width, height, title, subtitle="", background=(218, 221, 216)):
    frame = Image.new("RGBA", (width, height), (*background, 255))
    fitted = Image.new("RGBA", (width - 12, height - 48), (0, 0, 0, 0))
    image.thumbnail((width - 12, height - 48), Image.Resampling.LANCZOS)
    fitted.alpha_composite(image, ((fitted.width - image.width) // 2, (fitted.height - image.height) // 2))
    frame.alpha_composite(fitted, (6, 6))
    draw.text((x + 8, y + height - 36), title, fill=(30, 35, 37), font=font(15))
    if subtitle:
        draw.text((x + 8, y + height - 18), subtitle, fill=(75, 80, 82), font=font(11))
    place(canvas, frame, x, y)


def save(canvas, filename):
    path = REVIEW / filename
    canvas.convert("RGB").save(path, optimize=True, compress_level=9)
    return path


def main():
    REVIEW.mkdir(parents=True, exist_ok=True)
    report = json.loads((FINAL / "worker-reference.json").read_text(encoding="utf-8"))
    outputs = report["outputs"]
    by_key = {(item["direction"], item["animation"], item["sampleIndex"]): item for item in outputs}
    generated = []
    inputs = []

    def register_input(path, role):
        inputs.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path), "role": role})

    for direction in range(4):
        for animation, index in (("idle", 0), ("walk", 4)):
            path = FINAL / f"worker-a-d{direction}-{animation}-{index:02d}.png"
            register_input(path, f"new worker d{direction} {animation} {index}")
    register_input(REFERENCE / "phase1b-worker-a-idle0.png", "WP-CHAR-01B worker A idle")
    register_input(REFERENCE / "phase1b-worker-a-walk1.png", "WP-CHAR-01B worker A walk midpoint")
    register_input(PROTOTYPE / "source-comparison/kenney-idle-00.png", "Kenney source idle")
    register_input(PROTOTYPE / "source-comparison/kenney-walk-01.png", "Kenney source walk midpoint")
    register_input(RUNTIME / "chr_citizen-d0-idle-0.png", "existing runtime citizen")
    register_input(RUNTIME / "row_house-complete.png", "existing row house")
    register_input(RUNTIME / "workshop-complete.png", "existing workshop")
    register_input(RUNTIME / "veh_delivery.png", "existing delivery vehicle")
    register_input(RUNTIME / "veh_truck.png", "existing truck")

    old_idle = crop_alpha(Image.open(REFERENCE / "phase1b-worker-a-idle0.png").convert("RGBA"))
    old_walk = crop_alpha(Image.open(REFERENCE / "phase1b-worker-a-walk1.png").convert("RGBA"))
    new_idle = crop_alpha(Image.open(FINAL / "worker-a-d0-idle-00.png").convert("RGBA"))
    new_walk = crop_alpha(Image.open(FINAL / "worker-a-d0-walk-04.png").convert("RGBA"))

    canvas = Image.new("RGBA", (1120, 780), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02A · Obrero A anterior vs nuevo", fill=(30, 35, 38), font=font(27))
    draw.text((28, 58), "Mismo instante de ciclo: idle y walk medio · gamma 1,8 · composición offline", fill=(70, 75, 77), font=font(14))
    panel(canvas, draw, gamma(old_idle), 30, 100, 500, 300, "WP-CHAR-01B · idle", "Rocketbox + tinte + accesorios rígidos")
    panel(canvas, draw, gamma(new_idle), 590, 100, 500, 300, "WP-CHAR-02A · idle", "Kenney + vestuario integrado")
    panel(canvas, draw, gamma(old_walk), 30, 430, 500, 300, "WP-CHAR-01B · walk medio", "Frame 17 con root motion")
    panel(canvas, draw, gamma(new_walk), 590, 430, 500, 300, "WP-CHAR-02A · walk medio", "Frame 8 con suelo alineado")
    generated.append(save(canvas, "01-before-after.png"))

    source_report = json.loads((PROTOTYPE / "source-comparison/source-comparison.json").read_text(encoding="utf-8"))
    source_idle_sample = source_report["sources"]["kenney"]["animations"]["idle"]["samples"][0]
    source_walk_sample = source_report["sources"]["kenney"]["animations"]["walk"]["samples"][1]
    source_idle = crop_bounds(Image.open(REPO_ROOT / source_idle_sample["image"]["path"]).convert("RGBA"), source_idle_sample["cameraBounds"])
    source_walk = crop_bounds(Image.open(REPO_ROOT / source_walk_sample["image"]["path"]).convert("RGBA"), source_walk_sample["cameraBounds"])
    canvas = Image.new("RGBA", (1120, 780), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((28, 20), "WP-CHAR-02A · Modelo original vs nuevo", fill=(30, 35, 38), font=font(27))
    draw.text((28, 58), "Kenney character-worker sin ajuste local vs obrero de referencia · composición offline", fill=(70, 75, 77), font=font(14))
    panel(canvas, draw, gamma(source_idle), 30, 100, 500, 300, "Kenney original · idle", "style layer compartido")
    panel(canvas, draw, gamma(new_idle), 590, 100, 500, 300, "Nuevo · idle", "atlas original + material local mate")
    panel(canvas, draw, gamma(source_walk), 30, 430, 500, 300, "Kenney original · walk", "sin alineación de suelo")
    panel(canvas, draw, gamma(new_walk), 590, 430, 500, 300, "Nuevo · walk", "pie de apoyo en Z=0")
    generated.append(save(canvas, "02-original-vs-new.png"))

    canvas = Image.new("RGBA", (900, 430), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02A · Idle anterior vs nuevo", fill=(30, 35, 38), font=font(26))
    panel(canvas, draw, gamma(old_idle), 30, 80, 390, 300, "Anterior · A-pose", "Brazos demasiado abiertos")
    panel(canvas, draw, gamma(new_idle), 480, 80, 390, 300, "Nuevo · idle", "Brazos y hombros relajados")
    generated.append(save(canvas, "03-idle-before-after.png"))

    canvas = Image.new("RGBA", (8 * 250 + 40, 390), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((22, 18), "WP-CHAR-02A · Ciclo walk · dirección 0", fill=(30, 35, 38), font=font(26))
    for index in range(8):
        item = by_key[(0, "walk", index)]
        image = crop_alpha(Image.open(FINAL / f"worker-a-d0-walk-{index:02d}.png").convert("RGBA"))
        panel(canvas, draw, gamma(image), 20 + index * 250, 70, 235, 285, f"{index}/8 · frame {item['frame']}", f"fase {index}/8")
    generated.append(save(canvas, "04-walk-eight-poses.png"))

    canvas = Image.new("RGBA", (1040, 760), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02A · Cuatro direcciones", fill=(30, 35, 38), font=font(27))
    for direction in range(4):
        idle = crop_alpha(Image.open(FINAL / f"worker-a-d{direction}-idle-00.png").convert("RGBA"))
        walk = crop_alpha(Image.open(FINAL / f"worker-a-d{direction}-walk-04.png").convert("RGBA"))
        x = 25 + direction * 250
        panel(canvas, draw, gamma(idle), x, 80, 235, 300, f"D{direction} · idle", f"azimut {45 + direction * 90}°")
        panel(canvas, draw, gamma(walk), x, 410, 235, 300, f"D{direction} · walk 4/8", "mismo personaje y escala")
    generated.append(save(canvas, "05-four-directions.png"))

    canvas = Image.new("RGBA", (1040, 430), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02A · Silueta a 28 px", fill=(30, 35, 38), font=font(27))
    for direction in range(4):
        image = gamma(crop_alpha(Image.open(FINAL / f"worker-a-d{direction}-idle-00.png").convert("RGBA")))
        small = resize_height(image, 28)
        alpha = np.asarray(small.getchannel("A"))
        silhouette = Image.new("RGBA", small.size, (25, 30, 32, 255))
        silhouette.putalpha(Image.fromarray(alpha))
        x = 25 + direction * 250
        place(canvas, small, x + 20, 105)
        place(canvas, silhouette, x + 20, 210)
        draw.text((x + 20, 150), f"D{direction} · {small.width}px ancho", fill=(55, 60, 62), font=font(13))
        draw.text((x + 20, 255), "silueta", fill=(55, 60, 62), font=font(13))
    draw.text((26, 330), "Gamma 1,8 · recorte por alfa · mismo criterio de escala que la revisión runtime", fill=(75, 80, 82), font=font(14))
    generated.append(save(canvas, "06-silhouette-28px.png"))

    canvas = Image.new("RGBA", (1040, 930), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02A · Escalas 0,5× / 1× / 2× / 2,5×", fill=(30, 35, 38), font=font(27))
    scales = ((0.5, 14), (1.0, 28), (2.0, 56), (2.5, 70))
    for column, (scale, height) in enumerate(scales):
        x = 25 + column * 250
        draw.text((x + 10, 75), f"{scale:g}× · {height}px", fill=(35, 40, 42), font=font(18))
        for row, image in enumerate((new_idle, new_walk)):
            small = gamma(resize_height(image, height))
            panel(canvas, draw, small, x, 120 + row * 370, 235, 330, "idle" if row == 0 else "walk 4/8", f"altura {height}px")
    generated.append(save(canvas, "07-scales.png"))

    citizen = crop_alpha(Image.open(RUNTIME / "chr_citizen-d0-idle-0.png").convert("RGBA"))
    canvas = Image.new("RGBA", (900, 520), (238, 235, 225, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((26, 20), "WP-CHAR-02A · Obrero vs ciudadano existente", fill=(30, 35, 38), font=font(26))
    panel(canvas, draw, gamma(citizen), 30, 80, 390, 300, "chr_citizen · runtime", "Rocketbox existente")
    panel(canvas, draw, gamma(new_idle), 480, 80, 390, 300, "Obrero A · nuevo", "Kenney con vestuario integrado")
    citizen_small = gamma(resize_height(citizen, 28))
    worker_small = gamma(resize_height(new_idle, 28))
    place(canvas, citizen_small, 120, 420)
    place(canvas, worker_small, 570, 420)
    draw.text((90, 455), f"ciudadano · {citizen_small.width}px", fill=(55, 60, 62), font=font(13))
    draw.text((540, 455), f"obrero · {worker_small.width}px", fill=(55, 60, 62), font=font(13))
    generated.append(save(canvas, "08-worker-vs-citizen.png"))

    row_house = crop_alpha(Image.open(RUNTIME / "row_house-complete.png").convert("RGBA"))
    workshop = crop_alpha(Image.open(RUNTIME / "workshop-complete.png").convert("RGBA"))
    delivery = crop_alpha(Image.open(RUNTIME / "veh_delivery.png").convert("RGBA"))
    truck = crop_alpha(Image.open(RUNTIME / "veh_truck.png").convert("RGBA"))
    canvas = Image.new("RGBA", (1400, 900), (205, 210, 204, 255))
    draw = ImageDraw.Draw(canvas)
    draw.polygon([(0, 610), (1400, 540), (1400, 900), (0, 900)], fill=(77, 83, 84))
    draw.polygon([(0, 565), (1400, 495), (1400, 610), (0, 720)], fill=(181, 176, 161))
    draw.line([(0, 720), (1400, 610)], fill=(226, 219, 195), width=5)
    for x in range(80, 1400, 180):
        y = 790 - x * 0.078
        draw.line([(x, y), (x + 90, y - 7)], fill=(202, 190, 142), width=4)
    row_house.thumbnail((520, 470), Image.Resampling.LANCZOS)
    workshop.thumbnail((500, 430), Image.Resampling.LANCZOS)
    delivery.thumbnail((150, 110), Image.Resampling.LANCZOS)
    truck.thumbnail((170, 120), Image.Resampling.LANCZOS)
    place(canvas, row_house, 70, 70)
    place(canvas, workshop, 760, 100)
    place(canvas, truck, 1020, 565)
    place(canvas, delivery, 380, 620)
    worker_context = gamma(resize_height(new_walk, 56))
    citizen_context = gamma(resize_height(citizen, 56))
    place(canvas, worker_context, 690, 590)
    place(canvas, citizen_context, 810, 575)
    draw.rectangle((0, 0, 1400, 58), fill=(238, 235, 225))
    draw.text((24, 16), "WP-CHAR-02A · Composición urbana OFFLINE (no es captura de Phaser)", fill=(30, 35, 38), font=font(24))
    draw.text((1050, 70), "Activos runtime existentes", fill=(40, 45, 47), font=font(15))
    draw.text((1050, 92), "row_house · workshop", fill=(40, 45, 47), font=font(13))
    draw.text((1050, 112), "veh_delivery · veh_truck · chr_citizen", fill=(40, 45, 47), font=font(13))
    generated.append(save(canvas, "09-street-context-offline.png"))

    manifest = {
        "schemaVersion": 1,
        "status": "offline_review_package",
        "runtimePromotion": False,
        "approval": "pending_human",
        "sourceReport": "docs/art/characters/prototypes/wp-char-02a/worker-reference/final/worker-reference.json",
        "sourceReportSha256": sha256(FINAL / "worker-reference.json"),
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
    manifest_path = REVIEW / "review-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(generated), "manifest": str(manifest_path.relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

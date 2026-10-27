#!/usr/bin/env python3
"""
Golden visual para assets externos (WP4.15-V.b2).

Genera un contact sheet determinista con 1 edificio Kenney (con ventanas), 1 árbol, 1 vehículo
y sus sombras. Sirve como referencia de regresión visual para detectar cambios de:
- paleta
- saturación
- ventanas
- iluminación
- sombras
- transparencia

Uso:
  python3 scripts/external_visual_golden.py --update   # genera el golden
  python3 scripts/external_visual_golden.py            # compara contra el golden

Salida:
  docs/art/golden/external-assets-golden.png
  docs/art/golden/external-assets-golden.json
"""

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
BLENDER = (
    REPO_ROOT
    / "blender_artist"
    / "toolchain"
    / "blender-5.2.2-linux-x64"
    / "blender"
)
BLENDER_SCRIPT = REPO_ROOT / "tools" / "art-pipeline" / "blender" / "runtime_asset.py"
GOLDEN_DIR = REPO_ROOT / "docs" / "art" / "golden"
JOBS_PATH = REPO_ROOT / "blender_artist" / "manifests" / "asset-jobs.json"
SOURCES_PATH = REPO_ROOT / "blender_artist" / "manifests" / "staging-sources.json"

# Muestra: 1 edificio con ventanas, 1 árbol, 1 vehículo
SAMPLE_JOB_IDS = ["bld_residential_a", "prp_tree_oak", "veh_sedan"]


def load_jobs():
    jobs = json.loads(JOBS_PATH.read_text())["jobs"]
    sources = json.loads(SOURCES_PATH.read_text())["sources"]
    sources_by_id = {s["id"]: s for s in sources}
    return {j["id"]: j for j in jobs}, sources_by_id


def args_for_job(job, sources_by_id):
    source = sources_by_id.get(job["source"]["sourceId"])
    if not source:
        raise RuntimeError(f"Fuente no encontrada: {job['source']['sourceId']}")

    args = [
        "--asset", job["assetId"],
        "--kind", job["kind"],
        "--source", f"{job['source']['kind']}:{job['source']['path']}",
        "--unit-scale", str(source.get("unitScale", 4)),
        "--ortho-scale", str(job["camera"]["orthoScale"]),
        "--target-z", str(job["camera"]["targetZ"]),
        "--render-width", str(job["render"]["width"]),
        "--render-height", str(job["render"]["height"]),
        "--source-id", job["source"]["sourceId"],
        "--license", source.get("license", "CC0-1.0"),
        "--shadow",
    ]

    if job["kind"] == "building":
        args.extend(["--state", "complete"])

    return args


def render_asset(job_id, job, sources_by_id):
    work_dir = Path(tempfile.mkdtemp(prefix=f"landlord-external-golden-{job_id}-"))
    output_png = work_dir / f"{job_id}.png"
    output_json = work_dir / f"{job_id}.json"

    args = args_for_job(job, sources_by_id)
    cmd_args = [
        str(BLENDER),
        "--background",
        "--python",
        str(BLENDER_SCRIPT),
        "--",
        *args,
        "--output",
        str(output_png),
        "--metadata",
        str(output_json),
    ]

    result = subprocess.run(
        cmd_args,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Blender falló para {job_id}:\n{result.stderr or result.stdout}"
        )
    return {"png": output_png, "json": output_json}


def compose_contact_sheet(images_with_labels):
    cell_width = 256
    cell_height = 256
    gap = 20
    cols = len(images_with_labels)
    width = cols * cell_width + (cols + 1) * gap
    height = cell_height + 2 * gap + 40

    canvas = Image.new("RGB", (width, height), "#1a1a1a")
    draw = ImageDraw.Draw(canvas)

    try:
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except OSError:
        font_bold = ImageFont.load_default()

    for col, (img, label) in enumerate(images_with_labels):
        x = gap + col * (cell_width + gap)
        img_resized = img.resize((cell_width, cell_height))
        canvas.paste(img_resized, (x, 50))
        draw.text((x + cell_width // 2, 10), label, fill="#ffffff", font=font_bold, anchor="mt")

    return canvas


def sha256_file(path):
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true", help="Genera el golden (no compara)")
    parser.add_argument("--compare", action="store_true", help="Compara contra el golden existente")
    args = parser.parse_args()

    print("Loading jobs...")
    jobs_by_id, sources_by_id = load_jobs()

    print("Rendering assets...")
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)

    images = []
    for job_id in SAMPLE_JOB_IDS:
        if job_id not in jobs_by_id:
            raise RuntimeError(f"Job no encontrado: {job_id}")
        job = jobs_by_id[job_id]
        print(f"  Rendering {job_id}...")
        result = render_asset(job_id, job, sources_by_id)
        img = Image.open(result["png"])
        label = job_id.replace("prp_", "").replace("bld_", "").replace("veh_", "").title()
        images.append((img, label))

    print("Composing contact sheet...")
    contact = compose_contact_sheet(images)
    golden_png = GOLDEN_DIR / "external-assets-golden.png"
    golden_json = GOLDEN_DIR / "external-assets-golden.json"

    if args.update:
        contact.save(golden_png)
        metadata = {
            "schemaVersion": 1,
            "generator": "external_visual_golden.py",
            "assets": SAMPLE_JOB_IDS,
            "sha256": sha256_file(golden_png),
            "size": {"width": contact.width, "height": contact.height},
        }
        golden_json.write_text(json.dumps(metadata, indent=2) + "\n")
        print(f"Golden saved to {golden_png}")
        print(f"Metadata saved to {golden_json}")
    elif args.compare:
        if not golden_png.exists():
            print(f"ERROR: No existe el golden: {golden_png}")
            print("Genera el golden primero con: python3 scripts/external_visual_golden.py --update")
            sys.exit(1)

        # Generar contact sheet actual y guardarlo temporalmente
        current_contact = compose_contact_sheet(images)
        temp_png = Path(tempfile.mktemp(suffix=".png"))
        current_contact.save(temp_png)
        current_hash = sha256_file(temp_png)
        temp_png.unlink()

        metadata = json.loads(golden_json.read_text())
        expected_hash = metadata["sha256"]

        if current_hash == expected_hash:
            print("OK: El golden coincide (hash SHA-256)")
        else:
            print(f"FALLA: Hash distinto")
            print(f"  Esperado: {expected_hash}")
            print(f"  Actual:   {current_hash}")
            print("\nPosibles causas:")
            print("  - Cambio de paleta/saturación en style layer")
            print("  - Cambio de iluminación")
            print("  - Cambio de sombras")
            print("  - Cambio de transparencia")
            print("\nSi el cambio es intencional, regenera el golden con --update")
            sys.exit(1)
    else:
        # Por defecto: genera y compara
        contact.save(golden_png)
        metadata = {
            "schemaVersion": 1,
            "generator": "external_visual_golden.py",
            "assets": SAMPLE_JOB_IDS,
            "sha256": sha256_file(golden_png),
            "size": {"width": contact.width, "height": contact.height},
        }
        golden_json.write_text(json.dumps(metadata, indent=2) + "\n")
        print(f"Golden generado y guardado en {golden_png}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Genera evidencia A/B de sombras para WP4.15-V.b2.

Renderiza una muestra mínima (1 edificio, 1 árbol, 1 vehículo) con y sin sombras,
y compone un contact sheet para comparación visual.

Uso:
  python3 scripts/shadow_ab_evidence.py

Salida:
  artifacts/visual-slice/shadow-ab-contact.png
"""

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
OUTPUT_DIR = REPO_ROOT / "artifacts" / "visual-slice"
JOBS_PATH = REPO_ROOT / "blender_artist" / "manifests" / "asset-jobs.json"
SOURCES_PATH = REPO_ROOT / "blender_artist" / "manifests" / "staging-sources.json"

# Muestra mínima: 1 edificio con ventanas, 1 árbol, 1 vehículo
SAMPLE_JOB_IDS = ["bld_residential_a", "prp_tree_oak", "veh_sedan"]


def load_jobs():
    jobs = json.loads(JOBS_PATH.read_text())["jobs"]
    sources = json.loads(SOURCES_PATH.read_text())["sources"]
    sources_by_id = {s["id"]: s for s in sources}
    return {j["id"]: j for j in jobs}, sources_by_id


def args_for_job(job, sources_by_id, no_shadow):
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
    ]

    if job["kind"] == "building":
        args.extend(["--state", "complete"])

    # Sombras para edificios, props y vehículos (no terrain, no character)
    if job["kind"] not in ("terrain", "character") and not no_shadow:
        args.append("--shadow")
    if no_shadow:
        args.append("--no-shadow")

    return args


def render_asset(job_id, job, sources_by_id, no_shadow):
    work_dir = Path(tempfile.mkdtemp(prefix=f"landlord-shadow-ab-{job_id}-{'off' if no_shadow else 'on'}-"))
    output_png = work_dir / f"{job_id}.png"
    output_json = work_dir / f"{job_id}.json"

    args = args_for_job(job, sources_by_id, no_shadow)
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
            f"Blender falló para {job_id} (shadow={not no_shadow}):\n{result.stderr or result.stdout}"
        )
    return {"png": output_png, "json": output_json}


def compose_contact_sheet(pairs):
    cell_width = 256
    cell_height = 256
    gap = 20
    cols = len(pairs)
    rows = 2
    width = cols * cell_width + (cols + 1) * gap
    height = rows * cell_height + (rows + 1) * gap + 60

    canvas = Image.new("RGB", (width, height), "#1a1a1a")
    draw = ImageDraw.Draw(canvas)

    try:
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except OSError:
        font_bold = ImageFont.load_default()
        font_small = ImageFont.load_default()

    for col, pair in enumerate(pairs):
        x = gap + col * (cell_width + gap)

        # Label
        draw.text((x + cell_width // 2, 10), pair["label"], fill="#ffffff", font=font_bold, anchor="mt")

        # Shadow ON
        on_img = Image.open(pair["on_png"]).resize((cell_width, cell_height))
        canvas.paste(on_img, (x, 50))

        # Shadow OFF
        off_img = Image.open(pair["off_png"]).resize((cell_width, cell_height))
        canvas.paste(off_img, (x, 50 + cell_height + gap))

        # Labels ON/OFF
        draw.text((x + cell_width // 2, 50 + cell_height + 15), "SHADOW ON", fill="#00ff00", font=font_small, anchor="mt")
        draw.text((x + cell_width // 2, 50 + 2 * cell_height + gap + 15), "SHADOW OFF", fill="#ff0000", font=font_small, anchor="mt")

    return canvas


def main():
    print("Loading jobs...")
    jobs_by_id, sources_by_id = load_jobs()

    print("Rendering A/B shadow evidence...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pairs = []
    for job_id in SAMPLE_JOB_IDS:
        if job_id not in jobs_by_id:
            raise RuntimeError(f"Job no encontrado: {job_id}")
        job = jobs_by_id[job_id]
        print(f"  Rendering {job_id} with shadow ON...")
        on_result = render_asset(job_id, job, sources_by_id, False)
        print(f"  Rendering {job_id} with shadow OFF...")
        off_result = render_asset(job_id, job, sources_by_id, True)
        pairs.append({
            "label": job_id.replace("prp_", "").replace("bld_", "").replace("veh_", "").title(),
            "on_png": on_result["png"],
            "off_png": off_result["png"],
        })

    print("Composing contact sheet...")
    contact = compose_contact_sheet(pairs)
    output_path = OUTPUT_DIR / "shadow-ab-contact.png"
    contact.save(output_path)
    print(f"Contact sheet saved to {output_path}")


if __name__ == "__main__":
    main()

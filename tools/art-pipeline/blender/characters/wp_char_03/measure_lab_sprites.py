#!/usr/bin/env python3
"""Mide alfa/pivotes y copia los cinco personajes al laboratorio Phaser."""

import argparse
import hashlib
import json
import re
import shutil
import statistics
from pathlib import Path

import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[5]
ROOT = REPO_ROOT / "docs/art/characters/prototypes/wp-char-03"
QA = REPO_ROOT / "apps/web/public/qa-character-scale"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def measure(path, role, direction, animation, index):
    with Image.open(path) as image:
        rgba = np.asarray(image.convert("RGBA"))
        alpha = rgba[:, :, 3]
        rows, columns = np.where(alpha > 2)
        if not len(rows):
            raise RuntimeError(f"Imagen vacía: {path}")
        left, top = int(columns.min()), int(rows.min())
        right, bottom = int(columns.max()) + 1, int(rows.max()) + 1
        width, height = image.size
        target = QA / "sprites" / path.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        return {
            "role": role,
            "direction": direction,
            "animation": animation,
            "sampleIndex": index,
            "sourcePath": str(path.relative_to(REPO_ROOT)),
            "sourceSha256": sha256(path),
            "path": f"/qa-character-scale/sprites/{path.name}",
            "sha256": sha256(target),
            "width": width,
            "height": height,
            "visible": {"left": left, "top": top, "right": right, "bottom": bottom},
            "visibleWidth": right - left,
            "visibleHeight": bottom - top,
            "support": {"x": (left + right) / 2, "y": bottom},
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output_path = Path(args.output).resolve()
    if output_path.exists():
        raise RuntimeError(f"La salida ya existe: {output_path}")
    sources = {
        "worker": REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a/worker-reference/final",
        "police": REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b/prototypes/police/final",
        "supervisor": ROOT / "prototypes/supervisor/final",
        "enforcer": ROOT / "prototypes/enforcer/final",
        "firefighter": ROOT / "prototypes/firefighter/final",
    }
    frames = []
    for role, source_dir in sources.items():
        for path in sorted(source_dir.glob("*.png")):
            match = re.fullmatch(r"(?:worker-a|supervisor|enforcer|police|firefighter)-d(\d)-(idle|walk)-(\d+)", path.stem)
            if match is None:
                raise RuntimeError(f"Nombre de frame no reconocido: {path.name}")
            direction, animation, index_text = match.groups()
            frames.append(measure(path, role, int(direction), animation, int(index_text)))
    frames.sort(key=lambda item: (item["role"], item["animation"], item["direction"], item["sampleIndex"]))
    summaries = []
    groups = {}
    for frame in frames:
        key = (frame["role"], frame["animation"], frame["direction"])
        groups.setdefault(key, []).append(frame)
    for (role, animation, direction), items in sorted(groups.items()):
        heights = [item["visibleHeight"] for item in items]
        summaries.append(
            {
                "role": role,
                "animation": animation,
                "direction": direction,
                "frames": len(items),
                "minVisibleHeight": min(heights),
                "maxVisibleHeight": max(heights),
                "medianVisibleHeight": statistics.median(heights),
                "stableScale28": 28 / max(heights),
                "stableScale34": 34 / max(heights),
            }
        )
    manifest = {
        "schemaVersion": 1,
        "status": "measured_lab_sprites",
        "runtimePromotion": False,
        "alphaThreshold": 2,
        "supportRule": "horizontal center of the lowest visible alpha row",
        "calibrationRule": "one scale per role/animation/direction using the maximum visible height; per-frame support origin",
        "frames": frames,
        "summaries": summaries,
    }
    (QA / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"frames": len(frames), "summaries": len(summaries), "manifest": str((QA / "manifest.json").relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

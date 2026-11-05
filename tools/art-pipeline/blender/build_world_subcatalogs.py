"""V.h.3: subcatálogos semánticos como VISTAS GENERADAS del world-asset-index.

`world-asset-index.json` es la única fuente de verdad; cada `*-assets.json` es un filtro por categoría
regenerable. No se duplica metadata a mano: si el índice cambia, los subcatálogos se regeneran.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
INDEX = REPO_ROOT / "blender_artist" / "manifests" / "world-asset-index.json"
OUT_DIR = REPO_ROOT / "blender_artist" / "manifests" / "world-catalogs"

CATEGORY_TO_FILE = {
    "architecture": "architecture-assets.json",
    "building_mass": "building-mass-assets.json",
    "urban_prop": "urban-prop-assets.json",
    "environment": "environment-assets.json",
    "infrastructure": "infrastructure-assets.json",
    "vehicle": "vehicle-assets.json",
    "actor": "actor-assets.json",
    "animation": "animation-assets.json",
    # `material` NO es una vista plana: material-assets.json lo genera build_world_material_library.py
    # como biblioteca semántica (categorías + lenguajes visuales + gaps, §10). Si este script lo
    # escribiera, pisaría la biblioteca con el filtro plano del índice.
    "ui": "ui-assets.json",
    "audio": "audio-assets.json",
}


def main():
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    by_category = {}
    for asset in index["assets"]:
        by_category.setdefault(asset["category"], []).append(asset)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = {}
    for category, filename in CATEGORY_TO_FILE.items():
        assets = by_category.get(category, [])
        document = {
            "schemaVersion": 1,
            "generatedFrom": "blender_artist/manifests/world-asset-index.json",
            "category": category,
            "counts": {
                "total": len(assets),
                "runtimeReady": sum(1 for a in assets if a["runtimeReady"]),
            },
            "assets": assets,
        }
        (OUT_DIR / filename).write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
        summary[category] = len(assets)

    print("[world-subcatalogs] " + " · ".join(f"{k}={v}" for k, v in sorted(summary.items())))
    print(f"[world-subcatalogs] {OUT_DIR}")


if __name__ == "__main__":
    main()

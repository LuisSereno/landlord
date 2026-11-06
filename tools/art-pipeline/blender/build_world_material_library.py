"""V.h.4: biblioteca semántica de materiales (`material-assets.json`).

Capa por encima del índice: agrupa los materiales medidos/disponibles en categorías de lenguaje
(asphalt, pavement, brick, concrete, stone, metal, rusty_metal, wood, soil, grass) y declara qué
lenguajes visuales (civic, residential, commercial, industrial, infrastructure, park) pueden
seleccionarlos. Referencia los assetIds del world-asset-index (no duplica rutas).

No rompe Graphic Civic: cada entrada lleva `styleAdaptation` recordando que el material real se
remapea al style profile (saturación/valor/palette), nunca se muestra fotorealista crudo. Las
categorías sin fuente adquirida se declaran como gap con fallback procedural, no se fabrican.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
INDEX = REPO_ROOT / "blender_artist" / "manifests" / "world-asset-index.json"
OUT = REPO_ROOT / "blender_artist" / "manifests" / "world-catalogs" / "material-assets.json"

# assetId → categoría semántica (los 6 Poly Haven adquiridos).
POLYHAVEN_CATEGORY = {
    "wa_polyhaven_materials_asphalt_07_4k": "asphalt",
    "wa_polyhaven_materials_concrete_wall_003_4k": "concrete",
    "wa_polyhaven_materials_red_brick_03_4k": "brick",
    "wa_polyhaven_materials_red_bricks_02_4k": "brick",
    "wa_polyhaven_materials_rusty_metal_02_4k": "rusty_metal",
    "wa_polyhaven_materials_wood_planks_grey_4k": "wood",
}

# Lenguajes visuales que pueden seleccionar cada categoría.
LANGUAGES_BY_CATEGORY = {
    "asphalt": ["infrastructure", "industrial", "commercial"],
    "pavement": ["civic", "infrastructure", "commercial"],
    "brick": ["civic", "residential", "commercial", "industrial"],
    "concrete": ["infrastructure", "industrial", "civic"],
    "stone": ["civic", "park"],
    "metal": ["industrial", "infrastructure"],
    "rusty_metal": ["industrial"],
    "wood": ["residential", "park"],
    "soil": ["park", "industrial"],
    "grass": ["park", "residential"],
}

STYLE_ADAPTATION = (
    "El material se remapea al style profile Graphic Civic (palette, saturación/valor, sombra); "
    "nunca se aplica fotorealista crudo sobre la escena."
)

# Cierre de gaps (§10): categorías sin fuente Poly Haven adquirida reciben un tono procedural
# derivado del Graphic Civic (color lineal sRGB aprox + roughness), NO una textura falsa. Es la
# base sobre la que el renderer pinta superficies de esa categoría hasta que se adquiera fuente real.
DERIVED_TONE = {
    "pavement": {"color": [0.62, 0.60, 0.57], "roughness": 0.85},
    "stone": {"color": [0.55, 0.53, 0.50], "roughness": 0.9},
    "metal": {"color": [0.42, 0.44, 0.47], "roughness": 0.4},
    "soil": {"color": [0.32, 0.24, 0.16], "roughness": 0.95},
    "grass": {"color": [0.30, 0.44, 0.24], "roughness": 0.9},
}

# Selección por lenguaje visual (§10): qué categorías favorece cada contexto de la ciudad.
SELECTION_BY_LANGUAGE = {
    "civic": ["pavement", "stone", "brick", "concrete"],
    "residential": ["grass", "brick", "wood", "pavement"],
    "commercial": ["pavement", "brick", "asphalt", "concrete"],
    "industrial": ["concrete", "metal", "rusty_metal", "asphalt", "soil"],
    "infrastructure": ["asphalt", "concrete", "metal"],
    "park": ["grass", "soil", "stone", "wood"],
}


def main():
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    assets_by_id = {a["assetId"]: a for a in index["assets"]}

    categories = {}
    for category in [
        "asphalt", "pavement", "brick", "concrete", "stone",
        "metal", "rusty_metal", "wood", "soil", "grass",
    ]:
        entries = []
        for asset_id, cat in POLYHAVEN_CATEGORY.items():
            if cat != category:
                continue
            asset = assets_by_id.get(asset_id)
            if not asset:
                continue
            entries.append(
                {
                    "assetId": asset_id,
                    "sourcePath": asset["sourcePath"],
                    "license": asset["license"],
                    "runtimeReady": asset["runtimeReady"],
                }
            )
        categories[category] = {
            "visualLanguages": LANGUAGES_BY_CATEGORY.get(category, []),
            "styleAdaptation": STYLE_ADAPTATION,
            "assets": entries,
            "gap": not entries,
            "fallback": None if entries else "color procedural del style profile (Graphic Civic)",
            **(
                {"proceduralTone": DERIVED_TONE[category]}
                if not entries and category in DERIVED_TONE
                else {}
            ),
        }

    library = {
        "schemaVersion": 1,
        "generatedFrom": "blender_artist/manifests/world-asset-index.json",
        "purpose": "Biblioteca semántica de materiales: categorías de lenguaje × lenguajes visuales. Los subsistemas eligen material por categoría+lenguaje, nunca por nombre de archivo.",
        "visualLanguages": ["civic", "residential", "commercial", "industrial", "infrastructure", "park"],
        "selectionByLanguage": SELECTION_BY_LANGUAGE,
        "categories": categories,
    }
    OUT.write_text(json.dumps(library, indent=2) + "\n", encoding="utf-8")
    covered = sum(1 for c in categories.values() if not c["gap"])
    usable = sum(1 for c in categories.values() if not c["gap"] or "proceduralTone" in c)
    print(f"[material-library] con fuente real: {covered}/{len(categories)} · usables (fuente o tono derivado): {usable}/{len(categories)} → {OUT.name}")
    for name, cat in categories.items():
        if cat["gap"]:
            tone = "tono derivado" if "proceduralTone" in cat else "sin fuente"
            print(f"    gap: {name} ({tone})")


if __name__ == "__main__":
    main()

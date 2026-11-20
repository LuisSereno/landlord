"""Parche controlado del grammar para la variante B del A/B de Geometry Nodes (D-111 §3).

Sólo cambia qué módulo resuelve cada rol de fachada; no toca huellas, plantas, siluetas, techos,
accesos ni recetas. Se aplica sobre una copia de trabajo del manifiesto aprobado y se revierte
después del render: el archivo del repo no debe quedar modificado sin revisión humana.
"""

import json
import shutil
import sys
from pathlib import Path

# Derivado del árbol: el driver viaja con el pipeline, no con la máquina donde se probó.
REPO = Path(__file__).resolve().parents[4]
GRAMMAR = REPO / "blender_artist/manifests/building-composer-grammars.json"
# Copia de trabajo fuera del árbol versionado, compartida con `ab_grammar_patch.py`: el primer
# parche que corre guarda el manifiesto aprobado y el `revert` siempre tiene de dónde restaurar.
BACKUP = Path("/tmp/ab/grammar-head.json")

GN_PALETTE = {
    "id": "gn_masonry_bays",
    "label": "fábrica parametrizada en Geometry Nodes (D-111 §3)",
    "roleModule": {
        # El paño entre huecos sigue siendo megakit: conserva geometría licenciada en la
        # composición y aísla la variable (la crujía) del resto del edificio.
        "wall_panel": "mod_megakit_brick_wall_2m",
        "window_bay": "mod_gn_window_bay_2m",
        "ground_panel": "mod_gn_shopfront_bay_2m",
        "wainscot": "mod_gn_plinth_2m",
        "crown_panel": "mod_megakit_brick_top_trim_2m",
        "doorframe": "mod_megakit_doorframe_trim",
    },
}


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "apply"
    if action == "revert":
        shutil.copyfile(BACKUP, GRAMMAR)
        print("grammar revertido a HEAD")
        return
    data = json.loads(GRAMMAR.read_text(encoding="utf-8"))
    if not BACKUP.exists():
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        BACKUP.write_text(GRAMMAR.read_text(encoding="utf-8"), encoding="utf-8")
    grammar = data["grammars"]["mixed_tenement"]
    ids = [item["id"] for item in grammar["facadePalettes"]]
    if GN_PALETTE["id"] not in ids:
        grammar["facadePalettes"].append(GN_PALETTE)
    for recipe in grammar["recipes"]:
        if recipe.get("id") == "quaternius_balcony":
            # Reemplazar, no añadir: con una sola opción el eje `facade` deja de depender del azar
            # y B difiere de A sólo en los módulos de fachada.
            recipe["facadeIds"] = [GN_PALETTE["id"]]
    # La cornisa la elige la silueta por id de módulo explícito, no por rol del palette.
    for option in grammar["silhouetteOptions"]:
        if option.get("id") == "corniced_transition":
            option["corniceModule"] = "mod_gn_cornice_2m"
    GRAMMAR.write_text(
        json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print("grammar parcheado:", ids, "->", [i["id"] for i in grammar["facadePalettes"]])


if __name__ == "__main__":
    main()

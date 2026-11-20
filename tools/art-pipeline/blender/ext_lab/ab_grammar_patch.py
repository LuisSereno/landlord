"""Parche §6 (D-111): enriquece la fachada de una familia con los módulos Geometry Nodes.

A diferencia del parche §3, aquí no se añade una paleta nueva ni se toca la lista de opciones de
ningún eje: se sustituye `roleModule` EN LA PALETA EXISTENTE. Así el sorteo de variantes consume
exactamente la misma secuencia y control y candidata difieren sólo en los módulos de fachada.

Se revierte siempre: el manifiesto aprobado del repo no cambia sin revisión humana.
"""

import json
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
GRAMMAR = REPO / "blender_artist/manifests/building-composer-grammars.json"
# Copia de trabajo fuera del árbol versionado: si el proceso muere a mitad, el manifiesto del repo
# sigue siendo el aprobado y `revert` siempre tiene de dónde restaurar.
BACKUP = Path("/tmp/ab/grammar-head.json")

# Rol de la paleta -> módulo GN que lo sustituye. Sólo se tocan roles que la familia ya publica y
# para los que existe un módulo GN con ese mismo rol declarado en building-modules.json.
GN_BY_ROLE = {
    "window_bay": "mod_gn_window_bay_2m",
    "ground_panel": "mod_gn_shopfront_bay_2m",
    "wainscot": "mod_gn_plinth_2m",
}

# La cornisa clásica sólo sustituye a la de megakit donde la silueta ya era cornisada: `plain` y
# `parapet` se quedan como están porque no declaran módulo.
CORNICE_FAMILIES = {"row_house", "town_hall"}


def main():
    argv = sys.argv[1:]
    if "revert" in argv:
        shutil.copyfile(BACKUP, GRAMMAR)
        print("grammar revertido a HEAD")
        return
    data = json.loads(GRAMMAR.read_text(encoding="utf-8"))
    if not BACKUP.exists():
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        BACKUP.write_text(GRAMMAR.read_text(encoding="utf-8"), encoding="utf-8")
    for family in argv:
        grammar = data["grammars"][family]
        changed = []
        for palette in grammar["facadePalettes"]:
            roles = palette["roleModule"]
            for role, module in list(roles.items()):
                replacement = GN_BY_ROLE.get(role)
                if replacement and module.startswith("mod_megakit_"):
                    roles[role] = replacement
                    changed.append(f"{palette['id']}.{role}")
            # `warehouse` no publica `wainscot`: si el rol no está en la paleta, no se inventa.
        if family in CORNICE_FAMILIES:
            for option in grammar["silhouetteOptions"]:
                if (option.get("corniceModule") or "").startswith("mod_megakit_"):
                    option["corniceModule"] = "mod_gn_cornice_2m"
                    changed.append(f"silhouette.{option['id']}.corniceModule")
        print(f"parche {family}:", ", ".join(changed) or "NADA QUE CAMBIAR")
    GRAMMAR.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

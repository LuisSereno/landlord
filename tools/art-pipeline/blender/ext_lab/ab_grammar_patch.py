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
    "wainscot": "mod_gn_plinth_2m",
}

# El escaparate GN sólo enruta donde la identidad semántica aprobada ya exige planta baja comercial
# (`requireGroundCommercial`). En un adosado puro el `ground_panel` es vivienda: sustituirlo por un
# escaparate sería falsear la familia, que es justo lo que §5 prohibe.
COMMERCIAL_ROLE = ("ground_panel", "mod_gn_shopfront_bay_2m")

# La puerta-balcón GN sustituye al balcón suelto de Ultimate Buildings: el balcón pasa a nacer de
# una hoja real en su hueco en vez de flotar sobre el paño.
GN_BY_FEATURE_MODULE = {"mod_quat_ultimate_balcony": "mod_gn_balcony_door_bay_2m"}

# La cornisa clásica sólo sustituye a la de megakit donde la silueta ya era cornisada: `plain` y
# `parapet` se quedan como están porque no declaran módulo.
CORNICE_FAMILIES = {"row_house", "mixed_tenement", "town_hall"}


def main():
    argv = sys.argv[1:]
    if "revert" in argv:
        if not BACKUP.exists():
            sys.exit(
                f"no hay copia de HEAD en {BACKUP}: el manifiesto del repo está intacto "
                "o /tmp se limpió. Restaurar con `git checkout -- ` del manifiesto."
            )
        shutil.copyfile(BACKUP, GRAMMAR)
        print("grammar revertido a HEAD")
        return
    options = {t.split("=", 1)[0][2:]: t.split("=", 1)[1] for t in argv if t.startswith("--")}
    families = [t for t in argv if not t.startswith("--")]
    data = json.loads(GRAMMAR.read_text(encoding="utf-8"))
    if not BACKUP.exists():
        BACKUP.parent.mkdir(parents=True, exist_ok=True)
        BACKUP.write_text(GRAMMAR.read_text(encoding="utf-8"), encoding="utf-8")
    for family in families:
        grammar = data["grammars"][family]
        changed = []
        by_role = dict(GN_BY_ROLE)
        if grammar.get("semanticIdentity", {}).get("requireGroundCommercial"):
            by_role[COMMERCIAL_ROLE[0]] = COMMERCIAL_ROLE[1]
        for palette in grammar["facadePalettes"]:
            roles = palette["roleModule"]
            for role, module in list(roles.items()):
                replacement = by_role.get(role)
                if replacement and module.startswith("mod_megakit_"):
                    roles[role] = replacement
                    changed.append(f"{palette['id']}.{role}")
            # `warehouse` no publica `wainscot`: si el rol no está en la paleta, no se inventa.
        for recipe in grammar.get("recipes", []):
            for feature in recipe.get("requiredFeatures", []):
                replacement = GN_BY_FEATURE_MODULE.get(feature.get("module"))
                if replacement:
                    feature["module"] = replacement
                    changed.append(f"recipe.{recipe['id']}.{feature['id']}")
        # `--ground=panel`: enruta la planta baja al rol `ground_panel` para intentar consumir el
        # escaparate GN. Medido en D-111.2 WP01: **falla**, y la razón no es un defecto del parche.
        # `mixed_tenement` exige `requireGroundCommercial` y esa guarda (compose.py:453-456) pide
        # acristalamiento de banda baja con rol `window_bay`/`curtain_wall`; al mover el rol se
        # pierde y el Composer corta con SEMANTIC_IDENTITY_INCOMPLETE. La regla no se afloja: el
        # escaparate GN queda como módulo sin ruta hasta que el propietario enmiende la gramática.
        if options.get("ground") == "panel":
            for rhythm in grammar["rhythms"]:
                if rhythm.get("groundRole") == "window_bay" and COMMERCIAL_ROLE[0] in {
                    role for palette in grammar["facadePalettes"] for role in palette["roleModule"]
                }:
                    rhythm["groundRole"] = COMMERCIAL_ROLE[0]
                    changed.append(f"rhythm.{rhythm['id']}.groundRole")
        if family in CORNICE_FAMILIES:
            for option in grammar["silhouetteOptions"]:
                if (option.get("corniceModule") or "").startswith("mod_megakit_"):
                    option["corniceModule"] = "mod_gn_cornice_2m"
                    changed.append(f"silhouette.{option['id']}.corniceModule")
        print(f"parche {family}:", ", ".join(changed) or "NADA QUE CAMBIAR")
    GRAMMAR.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

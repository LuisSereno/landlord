"""Perfiles de candidato: rutas de selección de módulos independientes de la gramática de producción.

D-111.2 WP06. Hasta aquí los brazos A/B se conseguían con `ext_lab/ab_grammar_patch.py`, que
reescribía `building-composer-grammars.json` **dentro del árbol versionado** y lo restauraba desde una
copia en `/tmp`. El mecanismo tenía dos fallos estructurales:

1. Si el proceso moría entre el `apply` y el `revert`, el repo quedaba con la gramática de producción
   parcheada y el siguiente lote real se componía con módulos en QA sin que nadie lo pidiera.
2. El parche callaba cuando un rol no aparecía: `wainscot` en `mixed_tenement` (sus tres ritmos usan
   `groundRole: window_bay`) y `ground_panel` en `metal_brick_mix` se sobreescribían sin efecto
   alguno, así que un brazo podía anunciarse como "GN" llevando sólo una parte del cambio.

Un perfil de candidato es un **overlay en memoria** sobre una copia de la gramática aprobada: no
escribe ningún archivo del repo, se valida con las mismas guardas de §11/§17 que la producción
(`GrammarDocument.grammar()` aplica el overlay antes de `_check_roles`, así que un ancho de módulo que
no encaje en la crujía corta igual que en un lote canónico) y toda sobrecritura que no muerde es un
`GrammarError`, no un silencio. El `sha256` del manifiesto aprobado deja de interesarle a la corrida,
porque la corrida ya no lo toca.
"""

import copy
import json
from pathlib import Path

from .module_catalog import REPO_ROOT, GrammarError

CANDIDATES_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-candidates.json"

TOP_KEYS = {
    "schemaVersion",
    "composerVersion",
    "purpose",
    "provenance",
    "authority",
    "rules",
    "profiles",
}
PROFILE_KEYS = {"label", "authorship", "sources", "note", "families"}
FAMILY_KEYS = {
    "facadePalettes",
    "rhythms",
    "silhouetteOptions",
    "accessOptions",
    "recipeFeatures",
}
RHYTHM_KEYS = {"bayMeters", "groundRole", "groundFrontRole", "groundSideRole"}
SILHOUETTE_KEYS = {"corniceRole", "corniceModule", "projectionMeters"}
ACCESS_KEYS = {"frameRole"}
# Los roles que el compositor pide por el camino del acceso, no por el del ritmo.
ACCESS_ROLE_KEYS = ("frameRole", "leafRole", "aboveRole")


def _check_keys(record, allowed, where):
    unknown = set(record) - allowed
    if unknown:
        raise GrammarError(f"{where}: claves fuera del esquema {sorted(unknown)}")
    missing = allowed - set(record)
    if missing:
        raise GrammarError(f"{where}: faltan las claves {sorted(missing)}")


def _reject_unknown(record, allowed, where):
    """Como `_check_keys` pero con secciones opcionales: un overlay sólo declara lo que cambia.

    Exigir todas las claves convertiría cada perfil en una copia de la gramática, que es justo el
    segundo árbol de verdad que este manifiesto no puede llegar a ser.
    """
    unknown = set(record) - allowed
    if unknown:
        raise GrammarError(f"{where}: claves fuera del esquema {sorted(unknown)}")


def _from_index(found, option_id, where, kind):
    if option_id not in found:
        raise GrammarError(f"{where}: no existe {kind} `{option_id}`; declara {sorted(found)}")
    return found[option_id]


def load(path=CANDIDATES_PATH):
    """Lee y valida la forma del manifiesto de candidatos (no su geometría: eso hace `apply`)."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    _check_keys(raw, TOP_KEYS, "manifiesto de candidatos")
    if not raw["profiles"]:
        raise GrammarError("manifiesto de candidatos: sin perfiles, no hay ninguna ruta")
    for profile_id, profile in raw["profiles"].items():
        _check_keys(profile, PROFILE_KEYS, f"profiles.{profile_id}")
        if not profile["families"]:
            raise GrammarError(f"profiles.{profile_id}: sin familias, no es una ruta de candidato")
        for building_type, overlay in profile["families"].items():
            _reject_unknown(overlay, FAMILY_KEYS, f"profiles.{profile_id}.{building_type}")
    return raw


def profile(raw, profile_id, composer_version):
    found = raw["profiles"].get(profile_id)
    if found is None:
        raise GrammarError(
            f"no hay perfil de candidato `{profile_id}`: hay {sorted(raw['profiles'])}"
        )
    if raw["composerVersion"] != composer_version:
        raise GrammarError(
            f"§13: el perfil `{profile_id}` declara composerVersion {raw['composerVersion']} y la "
            f"gramática tiene {composer_version}: la firma no sería comparable con el control"
        )
    return found


def overlay_for(found, profile_id, building_type):
    """El overlay del tipo pedido, o error si el perfil no lo declara.

    Renderizar de control con `--candidate` puesto sería justo el silencio que sustituye al parche:
    una fila más en la hoja con la etiqueta de una autoría que no está en el edificio.
    """
    if building_type not in found["families"]:
        raise GrammarError(
            f"el perfil de candidato `{profile_id}` no declara `{building_type}` "
            f"(declara {sorted(found['families'])}): o se añade al perfil, o se corre sin `--candidate`"
        )
    return found["families"][building_type]


def _requested_roles(record):
    """Roles que la gramática ya fusionada llega a pedirle a la paleta, por cualquier camino.

    Es la guarda anti no-op: sustituir el módulo de un rol que ningún ritmo, silueta, acceso, volumen,
    cubierta, prop, secundario ni feature sortea no cambia ni un triángulo, y un brazo así se puede
    declarar horas sin que la imagen se entere.
    """
    roles = set()
    for rhythm in record["rhythms"]:
        for tokens in rhythm["tokens"].values():
            roles.update(tokens)
        for key in RHYTHM_KEYS - {"bayMeters"}:
            if rhythm.get(key):
                roles.add(rhythm[key])
    for silhouette in record["silhouetteOptions"]:
        for key in ("corniceRole", "crownRole"):
            if silhouette.get(key):
                roles.add(silhouette[key])
    for access in record["accessOptions"]:
        for key in ACCESS_ROLE_KEYS:
            if access.get(key):
                roles.add(access[key])
    for option in record["massingOptions"]:
        for volume in option["volumes"]:
            if volume.get("role"):
                roles.add(volume["role"])
    for roof in record["roofOptions"]:
        if roof.get("plateRole"):
            roles.add(roof["plateRole"])
        if roof.get("dormerBays"):
            roles.add("dormer")
        if roof.get("cornice"):
            roles.add("slope_cornice")
    for prop in record["propOptions"]:
        roles.add(prop["role"])
    for option in record["secondaryOptions"]:
        if option.get("role"):
            roles.add(option["role"])
    for recipe in record.get("recipes", []):
        for feature in recipe.get("requiredFeatures", []):
            roles.add(feature["role"])
    return roles


def apply(profile_id, record, overlay, catalog):
    """Copia de `record` con el overlay aplicado, más la lista de cambios para la procedencia.

    No repite lo que ya valida la producción: quien llama pasa el resultado por `_check_roles` y
    `_check_recipes`, así que los anchos de banda (§17), la identidad semántica y los roles inexistentes
    cortan con la misma regla sea un lote canónico o un candidato.
    """
    out = copy.deepcopy(record)
    family = out["family"]
    label = f"`{profile_id}` sobre {out['buildingType']}"
    changes = []
    touched = []

    palettes = {option["id"]: option for option in out["facadePalettes"]}
    for palette_id, roles in overlay.get("facadePalettes", {}).items():
        palette = _from_index(palettes, palette_id, label, "la paleta")
        for role, module_id in roles.items():
            if role not in palette["roleModule"]:
                raise GrammarError(
                    f"{label}.{palette_id}: la paleta no publica el rol `{role}` "
                    f"(publica {sorted(palette['roleModule'])}); un perfil sustituye un módulo en su "
                    "sitio, no inventa una banda que la familia no tiene"
                )
            module = catalog.pick(family, role, module_id)
            palette["roleModule"][role] = module.id
            touched.append((palette_id, role))
            changes.append(f"facade.{palette_id}.{role}={module.id}")

    rhythms = {option["id"]: option for option in out["rhythms"]}
    for rhythm_id, fields in overlay.get("rhythms", {}).items():
        _reject_unknown(fields, RHYTHM_KEYS, f"{label}.rhythms.{rhythm_id}")
        rhythm = _from_index(rhythms, rhythm_id, label, "el ritmo")
        for key, value in fields.items():
            if key == "bayMeters":
                if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
                    raise GrammarError(f"{label}.{rhythm_id}: bayMeters sin sentido {value!r}")
            elif value is not None:
                catalog.pool(family, value)
            rhythm[key] = value
            changes.append(f"rhythm.{rhythm_id}.{key}={value}")

    silhouettes = {option["id"]: option for option in out["silhouetteOptions"]}
    for silhouette_id, fields in overlay.get("silhouetteOptions", {}).items():
        _reject_unknown(fields, SILHOUETTE_KEYS, f"{label}.silhouetteOptions.{silhouette_id}")
        silhouette = _from_index(silhouettes, silhouette_id, label, "la silueta")
        for key, value in fields.items():
            silhouette[key] = value
            if key != "corniceModule":
                changes.append(f"silhouette.{silhouette_id}.{key}={value}")
        if silhouette["corniceModule"] and not silhouette["corniceRole"]:
            raise GrammarError(
                f"{label}.{silhouette_id}: `corniceModule` con `corniceRole: null`. `_build_cornice` "
                "sólo corre si el rol está declarado, así que el remate no aparecería: o se declara "
                "el rol en el mismo overlay, o el módulo sobra"
            )
        if silhouette["corniceRole"]:
            module = catalog.pick(family, silhouette["corniceRole"], silhouette["corniceModule"])
            silhouette["corniceModule"] = module.id
            changes.append(f"silhouette.{silhouette_id}.corniceModule={module.id}")

    accesses = {option["id"]: option for option in out["accessOptions"]}
    for access_id, fields in overlay.get("accessOptions", {}).items():
        _reject_unknown(fields, ACCESS_KEYS, f"{label}.accessOptions.{access_id}")
        access = _from_index(accesses, access_id, label, "el acceso")
        for key, value in fields.items():
            if value is not None:
                catalog.pool(family, value)
            access[key] = value
            changes.append(f"access.{access_id}.{key}={value}")

    recipes = {option["id"]: option for option in out.get("recipes", [])}
    for recipe_id, features in overlay.get("recipeFeatures", {}).items():
        recipe = _from_index(recipes, recipe_id, label, "la receta")
        by_feature = {feature["id"]: feature for feature in recipe.get("requiredFeatures", [])}
        for feature_id, module_id in features.items():
            feature = _from_index(by_feature, feature_id, f"{label}.{recipe_id}", "el feature")
            module = catalog.pick(family, feature["role"], module_id)
            feature["module"] = module.id
            changes.append(f"recipe.{recipe_id}.{feature_id}={module.id}")

    if not changes:
        raise GrammarError(
            f"{label}: el overlay no toca ningún eje, así que no es un brazo de comparación"
        )
    requested = _requested_roles(out)
    for palette_id, role in touched:
        if role not in requested:
            raise GrammarError(
                f"{label}.{palette_id}: se sustituye el rol `{role}`, pero ningún ritmo, silueta, "
                "acceso, volumen, cubierta, prop, secundario ni feature de esta gramática lo pide: el "
                "módulo no se colocaría nunca y el brazo se anunciaría con una autoría ausente de la "
                "imagen"
            )
    return out, changes

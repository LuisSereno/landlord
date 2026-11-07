"""V.g recipe model regression tests: facade feature spike for town_hall.

Estos tests fijan el contrato de las recipes arquitectónicas con facade features, que sustituye
el reparto ciego de ejes por una elección jerárquica: primero se sortea una receta y sólo después
se sortean los ejes dentro del subconjunto que la receta permite. El spike de `town_hall` es la
prueba de concepto antes de migrar las otras 14 gramáticas.

Cubren las 17 regresiones exigidas por el responsable:

  1. Las 15 gramáticas del documento cargan y componen con seed 1000 sin excepción.
  2. Una receta con clave desconocida (p.ej. `massings`) es GrammarError, no un silencio.
  3. Dos recetas con el mismo `id` son GrammarError: el id de receta es una clave primaria.
  4. Un eje declarado como lista vacía (`"massingIds": []`) es GrammarError, no un filtro abierto.
  5. Un `massingId` / `accessId` / `roofId` inexistente es GrammarError, no una selección vacía.
  6. Un `cornerModeId` inexistente en una receta es GrammarError.
  7. Un `targetVolume` fuera de rango para el massing permitido es CompositionError estático.
  8. Un facade feature con `role` != `module.role` es CompositionError.
  9. `required.count > capacity(massing, rhythm, cornerMode, access)` es CompositionError estático.
 10. `_symmetric_indices` reserva exactamente el bay del acceso y devuelve count posiciones.
 11. Una recipe con count=6 produce exactamente 6 placements por nivel (no 5, no adaptive).
 12. Una recipe con required feature que no cabe FALLA, no devuelve composición sin columnas.
 13. Ningún facade feature cae sobre `access:frame`, `access:leaf`, `access:above` o `access:steps`.
 14. `axisChoices.recipe` es el id de la receta sorteada (nunca "none" cuando la hay).
 15. El documento de gramática es inmutable: composer no muta el manifiesto.
 16. Misma seed → misma receta → mismo axisChoices → misma composición (firma idéntica).
 17. town_hall: las 10 seeds del barrido dan TRUE PASS (placed == count × levels, sin ceros).

Uso: python3 tools/art-pipeline/blender/test_vg_recipe_model.py
"""

import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]

if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from building_composer.compose import Composition, CompositionError, compose_candidate
from building_composer.grammar import GrammarDocument, GrammarError
from building_composer.module_catalog import Catalog
from building_composer.style_profile import StyleProfile

GRAMMARS_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-grammars.json"
PROFILE_ID = "graphic_civic_buildings_v1"

TOWN_HALL_FOOTPRINT = {"width": 8, "height": 4}
TOWN_HALL_FLOORS = 3
TOWN_HALL_FAMILY = "civic_landmark"
SEEDS_TEN = (42, 1000, 1001, 1002, 1003, 1004, 1005, 1337, 2000, 2026)

ALL_BUILDING_TYPES = [
    "courtyard_home", "row_house", "apartment_block", "mixed_tenement",
    "workshop", "warehouse", "cement_plant", "brickworks", "steelworks",
    "town_hall", "school_block", "clinic", "police_station", "fire_station",
    "market_hall",
]

DOMAIN_FOOTPRINTS = {
    "courtyard_home": {"width": 2, "height": 2, "floors": 1},
    "row_house": {"width": 4, "height": 1, "floors": 2},
    "apartment_block": {"width": 5, "height": 2, "floors": 5},
    "mixed_tenement": {"width": 4, "height": 2, "floors": 3},
    "workshop": {"width": 4, "height": 2, "floors": 1},
    "warehouse": {"width": 4, "height": 3, "floors": 1},
    "cement_plant": {"width": 5, "height": 2, "floors": 2},
    "brickworks": {"width": 5, "height": 2, "floors": 2},
    "steelworks": {"width": 4, "height": 3, "floors": 2},
    "town_hall": {"width": 8, "height": 4, "floors": 3},
    "school_block": {"width": 7, "height": 2, "floors": 3},
    "clinic": {"width": 3, "height": 2, "floors": 2},
    "police_station": {"width": 3, "height": 2, "floors": 2},
    "fire_station": {"width": 4, "height": 2, "floors": 2},
    "market_hall": {"width": 5, "height": 2, "floors": 2},
}

CATALOG = None
GRAMMARS_RAW = None


def catalog():
    global CATALOG
    if CATALOG is None:
        CATALOG = Catalog()
    return CATALOG


def grammars_raw():
    global GRAMMARS_RAW
    if GRAMMARS_RAW is None:
        GRAMMARS_RAW = json.loads(GRAMMARS_PATH.read_text(encoding="utf-8"))
    return GRAMMARS_RAW


def build_request(building_type, seed):
    domain = DOMAIN_FOOTPRINTS[building_type]
    family = grammars_raw()["grammars"][building_type]["family"]
    return {
        "candidateId": f"test_{building_type}_{seed}",
        "buildingType": building_type,
        "family": family,
        "styleProfileId": PROFILE_ID,
        "variantSeed": seed,
        "composerVersion": grammars_raw().get("composerVersion", "1.0"),
        "footprint": {"width": domain["width"], "height": domain["height"]},
        "floors": domain["floors"],
        "state": "complete",
    }


def town_hall_result(seed):
    return compose_candidate(build_request("town_hall", seed), catalog=catalog())


def town_hall_required_facade_features():
    """Diccionario recipe_id → lista de (feature_id, count, levels) de TODOS los facade requiredFeatures."""
    recipes = grammars_raw()["grammars"]["town_hall"]["recipes"]
    table = {}
    for recipe in recipes:
        features = []
        for feature in recipe["requiredFeatures"]:
            if feature["kind"] == "facade":
                features.append((feature["id"], feature["count"], feature["levels"]))
        table[recipe["id"]] = features
    return table


def facade_placements(result, feature_id):
    needle = f"facade_feature:{feature_id}:"
    return [p for p in result["placements"] if needle in p["purpose"]]


def access_placements(result):
    return [p for p in result["placements"] if p["purpose"].startswith("access:")]


def facade_feature_ids_for(recipe_id):
    """Lista de IDs de TODOS los facade requiredFeatures de una recipe."""
    for recipe in grammars_raw()["grammars"]["town_hall"]["recipes"]:
        if recipe["id"] == recipe_id:
            return [f["id"] for f in recipe["requiredFeatures"] if f["kind"] == "facade"]
    raise AssertionError(f"recipe {recipe_id} inexistente")


# ---- helpers para fabricar gramáticas defectuosas y esperar GrammarError ----

def load_fails(build, expected_substring):
    raw = copy.deepcopy(grammars_raw())
    build(raw)
    temp = Path("/tmp/vg_recipe_mutated.json")
    temp.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    doc = GrammarDocument(temp)
    profile = StyleProfile(PROFILE_ID)
    request = build_request("town_hall", 1000)
    try:
        Composition(catalog(), profile, doc, request).build()
        return False, "composición terminó sin error"
    except (GrammarError, CompositionError) as error:
        message = str(error)
        if expected_substring not in message:
            return False, f"esperado substring {expected_substring!r} en {message!r}"
        return True, message
    except Exception as error:
        return False, f"excepción inesperada {type(error).__name__}: {error}"


# ---- tests ----

def test_01a_grammar_load_all_types():
    """Las 15 gramáticas cargan y validan sin composición (schema + recipes + capacity estática).

    Aquí NO se construye geometría: se corre el path completo de GrammarDocument.grammar()
    que invoca _check_roles, _check_recipes, validación de facade features y validación
    de cornerModeIds/massingIds/rhythmIds. Una gramática mal formada debe fallar aquí,
    no al componer una seed.
    """
    profile = StyleProfile(PROFILE_ID)
    doc = GrammarDocument(GRAMMARS_PATH)
    loaded = []
    for name in ALL_BUILDING_TYPES:
        try:
            record = doc.grammar(name, catalog(), profile)
        except Exception as error:
            return False, f"{name}: {type(error).__name__}: {error}"
        if record["buildingType"] != name:
            return False, f"{name}: gramática se autodenomina {record['buildingType']}"
        loaded.append(name)
    return True, f"15/15 GRAMMAR LOAD PASS · {loaded[0]}…{loaded[-1]}"


def test_01b_composition_smoke_all_types():
    """Las 15 gramáticas componen con seed 1000 sin excepción (smoke legacy)."""
    for name in ALL_BUILDING_TYPES:
        try:
            compose_candidate(build_request(name, 1000), catalog=catalog())
        except Exception as error:
            return False, f"{name}: {error}"
    return True, "15/15 COMPOSITION SMOKE PASS (seed 1000)"


def test_02_unknown_recipe_key_rejected():
    def add_unknown(raw):
        raw["grammars"]["town_hall"]["recipes"][0]["massings"] = ["civic_block"]
    return load_fails(add_unknown, "claves desconocidas")


def test_03_duplicate_recipe_id_rejected():
    def duplicate_id(raw):
        recipes = raw["grammars"]["town_hall"]["recipes"]
        recipes[1]["id"] = recipes[0]["id"]
    return load_fails(duplicate_id, "ID duplicado")


def test_04_empty_recipe_axis_rejected():
    def empty_axis(raw):
        raw["grammars"]["town_hall"]["recipes"][0]["massingIds"] = []
    return load_fails(empty_axis, "massingIds declarada pero vacía")


def test_05_nonexistent_axis_id_rejected():
    def bogus_massing(raw):
        raw["grammars"]["town_hall"]["recipes"][0]["massingIds"] = ["no_existe"]
    return load_fails(bogus_massing, "inexistente")


def test_06_nonexistent_corner_mode_id_rejected():
    def bogus_corner(raw):
        raw["grammars"]["town_hall"]["recipes"][0]["cornerModeIds"] = ["no_existe"]
    return load_fails(bogus_corner, "inexistente")


def test_07_target_volume_out_of_range_rejected():
    def bad_target(raw):
        raw["grammars"]["town_hall"]["recipes"][0]["requiredFeatures"][0]["targetVolume"] = 99
    # civic_block tiene 1 volumen: targetVolume=99 es inválido.
    # Lo detecta el static checker: "fuera de rango para massing civic_block".
    return load_fails(bad_target, "targetVolume=99")


def test_08_wrong_module_role_rejected():
    """V.g P1: module/role mismatch se detecta en load, no al colocar geometría."""
    def swap_role(raw):
        # mod_megakit_column_trim_center es role=column; pedir role=pilaster debe fallar.
        feature = raw["grammars"]["town_hall"]["recipes"][0]["requiredFeatures"][0]
        feature["role"] = "pilaster"

    raw = copy.deepcopy(grammars_raw())
    swap_role(raw)
    temp = Path("/tmp/vg_recipe_mutated.json")
    temp.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    doc = GrammarDocument(temp)
    profile = StyleProfile(PROFILE_ID)
    try:
        doc.grammar("town_hall", catalog(), profile)
        return False, "carga terminó sin error"
    except GrammarError as error:
        message = str(error)
        if "role=pilaster" not in message or "role=column" not in message:
            return False, f"esperado rol declarativo y real en {message!r}"
        return True, f"GrammarError en load: {message}"
    except Exception as error:
        return False, f"excepción inesperada {type(error).__name__}: {error}"


def test_09_required_count_over_static_capacity_rejected():
    def huge_count(raw):
        # grand_neoclassical_hall + flush: 8 raw bays, 7 disponibles. Pedir 9 debe fallar estático.
        raw["grammars"]["town_hall"]["recipes"][0]["requiredFeatures"][0]["count"] = 9
    return load_fails(huge_count, "no cabe en massing=neoclassical_palace")


def test_10_access_excludes_exactly_one_bay():
    """El cálculo reserva exactamente UN bay central: civic_block (8 bays) deja 7 disponibles."""
    result = town_hall_result(1000)
    if result["axisChoices"]["recipe"] != "neoclassical_portico":
        return False, f"seed 1000 esperaba neoclassical_portico, salió {result['axisChoices']['recipe']}"
    massing = result["axisChoices"]["massing"]
    if massing != "civic_block":
        return False, f"seed 1000 esperaba civic_block, salió {massing}"
    facade = facade_placements(result, "portico_columns")
    # 6 columnas × 2 niveles = 12.
    if len(facade) != 12:
        return False, f"12 placements esperados, {len(facade)} colocados"
    # Ningún facade placement coincide con la posición del acceso.
    access_positions = {(round(p["position"][0], 3), round(p["position"][1], 3))
                        for p in access_placements(result) if p["purpose"] == "access:frame"}
    facade_front = [p for p in facade if p["purpose"].split(":")[3] == "level1"]
    facade_positions = {(round(p["position"][0], 3), round(p["position"][1], 3))
                        for p in facade_front}
    overlap = facade_positions & access_positions
    if overlap:
        return False, f"facade solapa acceso en {overlap}"
    return True, f"12 facade placements, sin solape con access (raw=8, acceso=1, disponibles=7)"


def test_11_required_count_cannot_adapt():
    """Cada recipe con count=N debe colocar EXACTAMENTE N×levels de CADA required facade feature."""
    expected = town_hall_required_facade_features()
    rows = []
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        recipe = result["axisChoices"]["recipe"]
        for feature_id, count, levels in expected[recipe]:
            placed = len(facade_placements(result, feature_id))
            if placed != count * levels:
                return False, (
                    f"seed {seed} recipe {recipe} feature {feature_id}: "
                    f"placed={placed} expected={count*levels}"
                )
            rows.append((seed, feature_id, placed, count * levels))
    return True, "placed exacto en las 10 seeds: " + "; ".join(f"{s}:{f}={p}" for s, f, p, _ in rows)


def test_12_required_feature_cannot_disappear():
    """Ninguna seed puede producir 0 facade features: required = required."""
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        facade_all = [p for p in result["placements"] if "facade_feature:" in p["purpose"]]
        if not facade_all:
            return False, f"seed {seed}: composition sin facade features"
    return True, "10/10 seeds con facade features colocados"


def test_13_no_facade_overlap_with_access():
    """Para cada seed: ningún facade placement a nivel del acceso (level 1) cae en la X de la puerta.

    Features en niveles superiores (level 2+) no chocan físicamente con la puerta: un frontón
    va SOBRE el acceso, no en lugar de él.
    """
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        access_x = {round(p["position"][0], 3)
                    for p in access_placements(result)}
        facade = [p for p in result["placements"]
                  if "facade_feature:" in p["purpose"] and ":level1:" in p["purpose"]]
        for p in facade:
            if round(p["position"][0], 3) in access_x:
                return False, f"seed {seed}: facade placement en X={p['position'][0]} solapa acceso"
    return True, "sin solape facade/access en 10 seeds"


def test_14_recipe_propagates_to_axis_choices():
    """axisChoices.recipe == id de una recipe declarada (nunca "none")."""
    declared = {r["id"] for r in grammars_raw()["grammars"]["town_hall"]["recipes"]}
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        recipe = result["axisChoices"].get("recipe")
        if recipe is None or recipe == "none":
            return False, f"seed {seed}: axisChoices.recipe == {recipe!r}"
        if recipe not in declared:
            return False, f"seed {seed}: axisChoices.recipe {recipe!r} no está declarada"
    return True, f"recipe propagada en las 10 seeds, todas en {sorted(declared)}"


def test_15_grammar_document_immutable():
    """compose_candidate no muta el manifiesto: misma semilla, dos corridas, mismo dict."""
    raw_before = json.loads(GRAMMARS_PATH.read_text(encoding="utf-8"))
    town_hall_result(1000)
    town_hall_result(1001)
    raw_after = json.loads(GRAMMARS_PATH.read_text(encoding="utf-8"))
    if raw_before != raw_after:
        return False, "building-composer-grammars.json cambió durante composición"
    # Además: el documento en memoria no se muta aunque se recicle el GrammarDocument.
    doc = GrammarDocument(GRAMMARS_PATH)
    snapshot = copy.deepcopy(doc.raw)
    compose_candidate(build_request("town_hall", 1002), catalog=catalog(), document=doc)
    if doc.raw != snapshot:
        return False, "GrammarDocument.raw mutado durante composición"
    return True, "manifiesto inmutable en disco y en memoria"


def test_16_determinism_same_seed_same_recipe_and_signature():
    """Misma seed → misma recipe → misma signature (no solo placements idénticos)."""
    for seed in SEEDS_TEN:
        first = town_hall_result(seed)
        second = town_hall_result(seed)
        if first["axisChoices"] != second["axisChoices"]:
            return False, f"seed {seed}: axisChoices diverge"
        if first["compositionSignature"] != second["compositionSignature"]:
            return False, f"seed {seed}: signature diverge"
        if first["axisChoices"]["recipe"] == "none":
            return False, f"seed {seed}: recipe sin propagar"
    return True, "10/10 seeds con axisChoices + signature idénticos entre corridas"


def test_17_town_hall_ten_seed_true_pass():
    """Para cada seed: TODOS los required facade features colocados == required × levels."""
    expected = town_hall_required_facade_features()
    rows = []
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        recipe = result["axisChoices"]["recipe"]
        if recipe == "none":
            return False, f"seed {seed}: recipe no propagada"
        for feature_id, count, levels in expected[recipe]:
            placed = len(facade_placements(result, feature_id))
            if placed != count * levels:
                return False, f"seed {seed} {recipe} {feature_id}: placed={placed} != expected={count * levels}"
            rows.append((seed, recipe, feature_id, placed))
    return True, (
        "10/10 TRUE PASS · " +
        " · ".join(f"{s}:{r}:{f}={p}" for s, r, f, p in rows)
    )


def test_18_required_facade_is_mirror_symmetric_around_access():
    """V.g P1: para cada recipe, TODOS los required facade features deben ser especulares
    respecto al eje X del acceso. No basta con 'no solapan': la distribución tiene
    que ser un pórtico simétrico de verdad, no un sesgo silencioso.

    Para cada seed de town_hall y cada facade feature:
      1. leer la X del access:frame en level1.
      2. agrupar las X de los placements del feature en level1.
      3. separar en left (x < access_x) y right (x > access_x).
      4. exigir |left| == |right| y distancias especulares (tolerancia mm).
    """
    expected = town_hall_required_facade_features()
    for seed in SEEDS_TEN:
        result = town_hall_result(seed)
        recipe = result["axisChoices"]["recipe"]
        frames = [p for p in access_placements(result) if p["purpose"] == "access:frame"]
        if not frames:
            return False, f"seed {seed}: sin access:frame (¿acceso en otro volumen?)"
        access_x = round(frames[0]["position"][0], 3)
        for feature_id, count, levels in expected[recipe]:
            level1 = [
                p for p in facade_placements(result, feature_id)
                if ":level1:" in p["purpose"]
            ]
            left = sorted(
                round(p["position"][0], 3) for p in level1 if p["position"][0] < access_x - 1e-3
            )
            right = sorted(
                round(p["position"][0], 3) for p in level1 if p["position"][0] > access_x + 1e-3
            )
            if len(left) != len(right):
                return False, (
                    f"seed {seed} {recipe} {feature_id}: {len(left)} a la izquierda vs {len(right)} a la "
                    f"derecha del acceso (access_x={access_x})"
                )
            mirrored_right = sorted(-round(x - access_x, 3) for x in left)
            distances_right = sorted(round(x - access_x, 3) for x in right)
            for left_offset, right_offset in zip(mirrored_right, distances_right):
                if abs(left_offset - right_offset) > 1e-3:
                    return False, (
                        f"seed {seed} {recipe} {feature_id}: distancias no especulares "
                        f"left offsets={mirrored_right}, right offsets={distances_right}"
                    )
    return True, "10/10 seeds con TODOS los facade features especulares respecto al acceso"


def test_19_hero_recipe_pins_approved_v7_composition():
    """V.i: la composición aprobada del town_hall (V7) es el contrato de la receta hero.

    El seed aprobado 1006 resuelve `grand_neoclassical_hall` con secondary_volume ==
    "corner_columns" y ritmo tall_aisles@5 (firma de composición d4404725…, promovida).
    El pin P2 (secondaryIds=["none"], commit 37592d4) desplazó los sorteos PRNG y cambió
    la composición sin aprobación humana: revertido para restaurar la V7 exacta.
    """
    result = town_hall_result(1006)
    choices = result["axisChoices"]
    if choices["recipe"] != "grand_neoclassical_hall":
        return False, f"seed 1006: recipe={choices['recipe']!r}, esperaba la hero"
    if choices["secondary_volume"] != "corner_columns":
        return False, f"seed 1006: secondary={choices['secondary_volume']!r}, esperaba 'corner_columns'"
    if choices["bay_sequence"] != "tall_aisles@5":
        return False, f"seed 1006: bay={choices['bay_sequence']!r}, esperaba 'tall_aisles@5'"
    return True, "seed 1006 reproduce la composición V7 aprobada (corner_columns, tall_aisles@5)"


def main():
    tests = [
        ("test_01a_grammar_load_all_types", test_01a_grammar_load_all_types),
        ("test_01b_composition_smoke_all_types", test_01b_composition_smoke_all_types),
        ("test_02_unknown_recipe_key_rejected", test_02_unknown_recipe_key_rejected),
        ("test_03_duplicate_recipe_id_rejected", test_03_duplicate_recipe_id_rejected),
        ("test_04_empty_recipe_axis_rejected", test_04_empty_recipe_axis_rejected),
        ("test_05_nonexistent_axis_id_rejected", test_05_nonexistent_axis_id_rejected),
        ("test_06_nonexistent_corner_mode_id_rejected", test_06_nonexistent_corner_mode_id_rejected),
        ("test_07_target_volume_out_of_range_rejected", test_07_target_volume_out_of_range_rejected),
        ("test_08_wrong_module_role_rejected", test_08_wrong_module_role_rejected),
        ("test_09_required_count_over_static_capacity_rejected", test_09_required_count_over_static_capacity_rejected),
        ("test_10_access_excludes_exactly_one_bay", test_10_access_excludes_exactly_one_bay),
        ("test_11_required_count_cannot_adapt", test_11_required_count_cannot_adapt),
        ("test_12_required_feature_cannot_disappear", test_12_required_feature_cannot_disappear),
        ("test_13_no_facade_overlap_with_access", test_13_no_facade_overlap_with_access),
        ("test_14_recipe_propagates_to_axis_choices", test_14_recipe_propagates_to_axis_choices),
        ("test_15_grammar_document_immutable", test_15_grammar_document_immutable),
        ("test_16_determinism_same_seed_same_recipe_and_signature", test_16_determinism_same_seed_same_recipe_and_signature),
        ("test_17_town_hall_ten_seed_true_pass", test_17_town_hall_ten_seed_true_pass),
        ("test_18_required_facade_is_mirror_symmetric_around_access", test_18_required_facade_is_mirror_symmetric_around_access),
        ("test_19_hero_recipe_pins_approved_v7_composition", test_19_hero_recipe_pins_approved_v7_composition),
    ]
    failures = []
    for name, fn in tests:
        try:
            ok, detail = fn()
        except Exception as error:
            ok = False
            detail = f"excepción {type(error).__name__}: {error}"
        mark = "✓" if ok else "✗"
        print(f"{mark} {name}: {detail}")
        if not ok:
            failures.append((name, detail))

    print()
    print(f"{len(tests) - len(failures)}/{len(tests)} PASS")
    if failures:
        print("FAILURES:")
        for name, detail in failures:
            print(f"  - {name}: {detail}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

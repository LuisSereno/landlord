"""Tests del contrato de proyección visual (D-111 WP04).

Corre con `python3` a secas: `weathering.py` hace el import de `bpy` opcional justamente para que la
mitad de sus reglas —las de datos— se puedan blindar sin arrancar Blender ni gastar un render.

Qué reproduce cada comprobación (defectos que WP04 tiene que hacer imposibles):

  · Que el tier envejecido se cuele en los sprites aprobados. `conserved` no proyecta nada y
    `project()` sin el campo `weathering` devuelve `None`: si alguien lo convierte en default, los
    888 sprites del catálogo cambian sin revisión humana.
  · Que se confunda suciedad con daño. `damaged`/`burning` no son tokens de `weathering`: son
    geometría y se eligen con `state`.
  · Que un modificador de mood pierda prioridad. Medido en el primer borrador: `group | recipe`
    hacía ganar a la receta base y el cristal de día se oscurecía igual que de noche.
  · Que el vocabulario de familias derive. Las familias las mide el perfil de estilo; el contrato
    tiene que cubrirlas todas o excluirlas explícitamente (§11 prohíbe un alzado con dos temperaturas).
  · Que resuciten recursos que §5 ya midió en contra: `concrete_wall_003` (las manchas de humedad se
    leen como ruina) y `red_brick_03` en un paño visible (queda restringido a mood de degradado).
  · Que el envejecimiento sea sólo grano. Una receta con `strength > 0` y `baseSoiling` 0 cambia la
    textura del paño pero deja su brillo intacto: la hoja A/B/C sale distinta y no se lee como usada.
  · Que las citas del contrato se pudran: derivan de `archivo:línea` del dominio y del runtime, y un
    número de línea sin comprobar deja de ser evidencia en el primer refactor.

Uso: python3 tools/art-pipeline/blender/test_building_weathering_contract.py
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from building_composer import weathering as W  # noqa: E402
from building_composer.module_catalog import REPO_ROOT  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402

# Los cinco moods que publica la capa de estilo: si uno se queda fuera de `moodGroups`, el render
# aborta (correcto), pero este test tiene que decir cuál antes de gastar veinte minutos de Blender.
MOODS = [
    "day_civic",
    "day_industrial",
    "night_civic",
    "material_maquette_day",
    "material_maquette_night",
]
# Recursos que §5 midió y restringió. La lista vive aquí porque el test es lo que impide que
# vuelvan a entrar en una receta; las notas del contrato siguen citándolos para explicar el porqué.
PROHIBITED_TEXTURES = ["concrete_wall_003", "red_brick_03"]
CITATION = re.compile(r"([\w./-]+\.(?:ts|py|json|md)):(\d+)")


def check_selection_tokens(contract, problems):
    tokens = contract.get("weatheringTokens") or []
    if tokens != ["conserved", "aged"]:
        problems.append(f"`weatheringTokens` cambió de semántica: {tokens}")
    states = contract["visualStates"]
    for token in tokens:
        record = states.get(token)
        if record is None:
            problems.append(f"`weatheringTokens` declara {token}, que no existe en `visualStates`")
            continue
        if record["geometryChange"]:
            problems.append(f"{token}: una proyección de material no puede declarar geometría")
        if record["spriteState"] != "complete":
            problems.append(
                f"{token}: spriteState {record['spriteState']!r} ≠ complete; envejecer no cambia "
                "el estado estructural del sprite"
            )
    if states["conserved"]["materialProjection"]:
        problems.append(
            "conserved: `materialProjection` true convierte el control de la hoja A/B/C en una "
            "cuarta variante y desprotege los sprites aprobados"
        )
    for token in ("damaged", "burning"):
        if token in tokens:
            problems.append(f"{token} es un estado de geometría, no una proyección de material")
        if not states[token]["geometryChange"]:
            problems.append(
                f"{token}: el daño del compositor SÍ cambia geometría y la evidencia tiene que decirlo"
            )


def check_family_coverage(contract, profile, problems):
    profile_families = set(profile.material_family.values())
    declared = set(contract["materials"])
    if profile_families != declared:
        problems.append(
            "vocabulario de familias divergente: el perfil y el contrato difieren en "
            + ", ".join(sorted(profile_families ^ declared))
        )
    excluded = set(contract["exclusions"]["families"])
    for state in contract["weatheringTokens"]:
        plan = W.Plan(contract, state, "day_civic", profile_families)
        uncovered = profile_families - set(plan.recipes) - excluded
        if state == "aged" and uncovered:
            problems.append(
                f"aged: ninguna receta cubre {', '.join(sorted(uncovered))} y no están excluidas "
                "→ mezclaría paño envejecido con paño de obra nueva en el mismo alzado (§11)"
            )
        if state == "conserved" and plan.material_projection:
            problems.append("conserved: el plan no debe proyectar capas de material")
    # WP04-D1/D2: excluir una FAMILIA en bloque no es una decisión de imagen, es una decisión sobre el
    # vocabulario del catálogo, y aquí se llevó por delante el alzado: el MegaKit llama `MI_InteriorWall`
    # al material que pinta el paño de ladrillo, así que `exclusions.families: ["interior"]` dejaba sin
    # tratar el 53,9 % de los píxeles opacos del sprite (sondeo verde, 2026-11-21). Lo que de verdad no se
    # ve —fondo del hueco, forjados, cubiertas interiores— se excluye por nombre.
    if excluded:
        problems.append(
            "exclusions.families no está vacío (" + ", ".join(sorted(excluded)) + "): una familia agrupada "
            "por nombre de origen puede pintar el alzado; exclúyense por nombre los materiales no visibles"
        )
    patterns = set(contract["exclusions"]["materialNamePatterns"])
    for required in ("MI_FakeInterior*", "MI_InteriorFloor*", "MI_InteriorRoof*"):
        if required not in patterns:
            problems.append(
                f"`{required}` dejó de estar en `exclusions.materialNamePatterns`: el fondo del hueco "
                "volvería a envejecerse sin que nadie lo vea en el alzado"
            )


def check_mood_resolution(contract, problems):
    for mood in MOODS:
        try:
            W.mood_group(contract, mood)
        except W.WeatheringError as error:
            problems.append(str(error))
    if len(contract["moodGroups"].get("night", [])) < 2:
        problems.append("el grupo night no cubre los dos moods nocturnos publicados")
    try:
        W.mood_group(contract, "mood_inventado")
        problems.append("mood_group aceptó un mood inexistente")
    except W.WeatheringError:
        pass


def check_recipes(contract, problems):
    """Valida las recetas y devuelve (fuerzas por grupo de mood, recursos usados)."""
    schema = set(contract["recipeSchema"])
    aged = {}
    textures = []
    for family, record in contract["materials"].items():
        for state, entry in record["states"].items():
            recipe = entry.get("recipe")
            if recipe is None:
                continue
            if set(recipe) != schema:
                problems.append(
                    f"{family}/{state}: la receta no coincide con `recipeSchema` "
                    + f"(faltan {sorted(schema - set(recipe))}, sobran {sorted(set(recipe) - schema)})"
                )
            for key in ("cavity", "blendSource"):
                source = recipe[key]
                if source is None:
                    continue
                if not source.get("license"):
                    problems.append(f"{family}/{state}: {key} sin licencia declarada")
                if not (REPO_ROOT / source["texture"]).is_file():
                    problems.append(f"{family}/{state}: {key} apunta a {source['texture']}, no existe")
                textures.append((f"{family}/{state}", source["texture"]))
        entry = record["states"].get("aged", {})
        if "recipe" in entry:
            aged[family] = {
                group: W.Plan(contract, "aged", mood, set(contract["materials"])).effective(family)
                for group, mood in (("day", "day_civic"), ("night", "night_civic"))
            }
        elif family not in contract["exclusions"]["families"]:
            problems.append(f"{family}: sin receta aged y sin exclusión")

    # Reglas medidas en la hoja A/B/C, no preferencias: la mugre del atlas no puede superar a la del
    # paño revocado, porque el mismo atlas pinta la ventana.
    if aged.get("atlas") and aged.get("plaster"):
        if aged["atlas"]["day"]["strength"] > aged["plaster"]["day"]["strength"]:
            problems.append(
                "atlas más sucio que plaster: el mismo atlas pinta el hueco de ventana y el reguero"
            )
    # `interior` (paño MegaKit) y `brick` (paño Poly Haven/Kenney) son el mismo ladrillo visto a dos
    # escalas: si sus fuerzas divergen, un alzado envejecería a dos velocidades dentro del mismo módulo.
    if aged.get("interior") and aged.get("brick"):
        for group in ("day", "night"):
            interior, brick = aged["interior"][group], aged["brick"][group]
            if abs(interior["strength"] - brick["strength"]) > 0.05:
                problems.append(
                    f"interior/{group}: fuerza {interior['strength']} frente a brick {brick['strength']}; "
                    "es el mismo paño de ladrillo y el tier se leería desigual en un mismo alzado"
                )
            if interior["grimeColor"] != brick["grimeColor"]:
                problems.append("interior y brick envejecen a distinto color de mugre: dos ladrillos en un paño")
            if interior["baseSoiling"] > brick["baseSoiling"]:
                problems.append(
                    f"interior/{group}: película base {interior['baseSoiling']} supera a brick "
                    f"{brick['baseSoiling']}; el paño del kit quedaría más sucio que el ladrillo hero"
                )
    for family, by_group in aged.items():
        if by_group["night"]["strength"] > by_group["day"]["strength"]:
            problems.append(
                f"{family}: el envejecimiento sube de noche ({by_group['night']['strength']} > "
                f"{by_group['day']['strength']}); la escala de mood sólo puede atenuar"
            )
    # WP04: el tier envejecido tiene que cambiar el TONO del paño, no sólo su grano. Sin `baseSoiling`
    # la máscara es alta frecuencia y promedia a cero contra el control — medido en la primera corrida:
    # |Δ| medio 8,1/255 con mediana 0 y tono −0,1, o sea un edificio con la textura cambiada y el
    # brillo de obra nueva. Las dos reglas siguientes hacen imposible volver a escribir esa receta.
    for family, by_group in aged.items():
        day = by_group["day"]
        if day["strength"] > 0.0 and day["baseSoiling"] <= 0.0:
            problems.append(
                f"{family}: strength {day['strength']} con baseSoiling 0 → la capa añade juntas y "
                "manchas pero no oscurece el paño; el tier no se lee como envejecido"
            )
        if day["strength"] == 0.0 and day["baseSoiling"] > 0.0:
            problems.append(
                f"{family}: baseSoiling {day['baseSoiling']} con strength 0 → `apply_material` no "
                "construye máscara con fuerza nula; la película declarada no se aplica nunca"
            )
    glass = aged.get("glass")
    if glass is not None:
        if glass["day"]["strength"] > 0.0:
            problems.append("glass: oscurecer el hueco de día lo convierte en agujero y borra la retícula")
        if glass["day"]["roughnessAdd"] != 0.0:
            problems.append(
                f"glass: moodModifiers.day no ganó ({glass['day']['roughnessAdd']} ≠ 0); de día el "
                "cristal envejece por difuminado, no por mugre"
            )
        # Medido en la corrida WP04 (`externalTreatment` del manifiesto nocturno): el mood cablea la
        # fuerza de `windowGlow` sobre el material del atlas (`emissiveTexels` 10144, `litWindows` 25),
        # nunca sobre MI_Glass. Declarar una escala de emisión en glass producía un registro
        # `skipped: el mood no cableó emisión` y una hoja que afirmaba lo contrario del raster.
        if glass["night"]["emissionScale"] is not None:
            problems.append(
                f"glass: emissionScale {glass['night']['emissionScale']} de noche es decorativa — "
                "el compositor no cablea emisión en MI_Glass; la luz de ventana envejece por el atlas"
            )
    atlas = aged.get("atlas")
    if atlas is not None and not 0.0 < atlas["night"]["emissionScale"] < 1.0:
        problems.append(
            "atlas: es el ÚNICO material donde el mood cablea el brillo de ventana, así que la regla "
            "«cristal sucio transmite menos luz» tiene que vivir aquí (0 < emissionScale < 1 de noche)"
        )
    return aged, textures


def check_textures_not_prohibited(textures, problems):
    """Sólo las rutas de recurso: las notas del contrato citan los descartes para explicarlos."""
    for label, texture in textures:
        for needle in PROHIBITED_TEXTURES:
            if needle in texture:
                problems.append(
                    f"{label}: {needle} vuelve a entrar como recurso de envejecimiento; §5 lo midió "
                    "y lo restringió (humedad que se lee como ruina / ladrillo gris azulado)"
                )


def check_citations(contract, problems):
    """Las citas `archivo:línea` son la prueba de que ningún umbral está inventado."""
    blob = json.dumps(contract["derivation"], ensure_ascii=False)
    blob += json.dumps(contract["visualStates"], ensure_ascii=False)
    checked = 0
    for relative, line in CITATION.findall(blob):
        path = REPO_ROOT / relative
        if not path.is_file():
            problems.append(f"cita rota en el contrato: {relative} no existe")
            continue
        total = len(path.read_text(encoding="utf-8").splitlines())
        if int(line) > total:
            problems.append(f"cita podrida: {relative}:{line} con {total} líneas")
            continue
        checked += 1
    thresholds = contract["derivation"]["thresholds"]
    values = [item["value"] for item in thresholds]
    if values != [60, 20]:
        problems.append(f"umbrales cambiados: {values} ≠ [60, 20]")
    for item in thresholds:
        if item.get("invented"):
            problems.append(f"umbral {item['value']} marcado como inventado")
    origin = CITATION.search(thresholds[0]["origin"])
    if origin is None:
        problems.append("el umbral 60 ya no cita un archivo:línea en `thresholds[0].origin`")
    elif "condition < 60" not in (REPO_ROOT / origin.group(1)).read_text(encoding="utf-8"):
        problems.append(
            f"el umbral 60 ya no está en {origin.group(1)}: la derivación perdió su fuente de verdad"
        )
    if contract["derivation"]["newDomainFieldsIntroduced"]:
        problems.append("WP04 prohibe introducir campos de dominio por conveniencia gráfica")
    return checked


def check_guards(contract, problems):
    for relative in contract["guards"]["notTouched"]:
        if not (REPO_ROOT / relative).is_file():
            problems.append(f"guards.notTouched nombra un archivo inexistente: {relative}")
    for relative in contract["consumers"]:
        if not (REPO_ROOT / relative.split(" ")[0]).is_file():
            problems.append(f"consumers nombra un módulo inexistente: {relative}")
    geometry = contract["visualStates"]["damaged"].get("geometry") or {}
    if not (geometry.get("removes") and geometry.get("adds")):
        problems.append(
            "damaged: la geometría adicional no está declarada en el contrato y WP04 exige "
            "declararla en la evidencia"
        )


def check_fail_closed(contract, profile, problems):
    families = set(profile.material_family.values())
    for bad_state, reason in (
        ("damaged", "aceptó `damaged` como proyección de material"),
        ("recien_inventado", "aceptó un estado visual inexistente"),
    ):
        try:
            W.Plan(contract, bad_state, "day_civic", families)
            problems.append(reason)
        except W.WeatheringError:
            pass
    # Una familia nueva en el perfil sin receta tiene que abortar, no renderizar a medias.
    try:
        W.Plan(contract, "aged", "day_civic", families | {"cobre"})
        problems.append("el Plan aceptó una familia que el contrato no trata")
    except W.WeatheringError:
        pass
    if W.project({"candidateId": "x"}, [], lambda name: None, "day_civic", families) is not None:
        problems.append("project() sin `weathering` en el request no devolvió None: el baseline se toca")


def main():
    contract = W.load_contract()
    profile = StyleProfile(contract["pins"]["styleProfileId"])
    problems = []
    check_selection_tokens(contract, problems)
    check_family_coverage(contract, profile, problems)
    check_mood_resolution(contract, problems)
    aged, textures = check_recipes(contract, problems)
    check_textures_not_prohibited(textures, problems)
    citations = check_citations(contract, problems)
    check_guards(contract, problems)
    check_fail_closed(contract, profile, problems)

    print(f"perfil fijado: {contract['pins']['styleProfileId']}")
    print(f"familias del perfil: {len(set(profile.material_family.values()))}")
    print(f"recetas aged: {len(aged)} · recursos referenciados: {len(textures)}")
    print("fuerza aged día:   " + ", ".join(f"{f}={r['day']['strength']}" for f, r in sorted(aged.items())))
    print("fuerza aged noche: " + ", ".join(f"{f}={r['night']['strength']}" for f, r in sorted(aged.items())))
    print(f"citaciones de origen comprobadas: {citations}")
    print(f"moods resueltos: {len(MOODS)}")
    if problems:
        print("\nFALLOS:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("\nOK: el contrato de conservación/envejecimiento es coherente, citado y opt-in")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

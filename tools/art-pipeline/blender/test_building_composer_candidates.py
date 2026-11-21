"""Tests de las rutas de selección de candidatos (D-111.2 WP06).

Corre con `python3` a secas: componer no necesita Blender —el manifiesto de gramáticas, el catálogo
medido y el PRNG sellado son datos— así que estas comprobaciones van en el gate, no en una corrida de
render de veinte minutos.

Qué blinda cada bloque (defectos que este paquete tiene que hacer imposibles):

  · Que un perfil de candidato mueva la producción. Sin `candidate` las cuatro gramáticas de piloto
    tienen que reproducir la firma del lote aprobado publicado en `evidence/v2/*/**-control.json`.
    Es la neutralidad del camino por defecto, y es la única forma de que el overlay exista sin que
    nadie tenga que confiar en que no toca nada.
  · Que la ruta verificada y el brazo revisado se separen. Cada candidato publicado en
    `evidence/v2/candidates/` se re-compone desde su perfil y se compara firma, colocaciones, huella,
    plantas, orientación, envelope, pivote y el `candidateOverlay` declarado. Si el perfil deriva y
    nadie lo mira, el PNG que revisa el propietario deja de ser el que produce la bandera.
  · Que un brazo anuncie una autoría que no está en la imagen. El precedente es el parche que
    reasignaba `wainscot` en `mixed_tenement`: ninguno de sus tres ritmos pide ese rol, así que el
    candidato se declaraba "GN" llevando sólo una parte del cambio. Ahora aborta.
  · Que un módulo de banda monte a la calle sin cara autorada. El zócalo de WP01 medía
    `frontAxis: symmetric-Y`, `anchors.rotation_for` no lo giraba y las juntas de sillar quedaban
    mirando al interior: a 0,5× el zócalo leía como paño liso. Todo módulo de fachada o hueco que un
    perfil coloque en una banda tiene que traer frente autorada.
  · Que un perfil cite geometría no medida o una autoría que no viaja con su fuente. Los módulos los
    valida el catálogo (§6/§7) y las fuentes las declara el perfil: si lo que se colocó no está en la
    lista de fuentes del perfil, la licencia del PNG es mentira.

Uso: python3 tools/art-pipeline/blender/test_building_composer_candidates.py
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from building_composer import candidates  # noqa: E402
from building_composer.compose import compose_candidate  # noqa: E402
from building_composer.grammar import GRAMMAR_PATH, GrammarDocument  # noqa: E402
from building_composer.module_catalog import Catalog, GrammarError  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
EVIDENCE = REPO / "docs/art/graphics-capabilities/evidence/v2"
STAGING_SOURCES = REPO / "blender_artist/manifests/staging-sources.json"

# Los cuatro pilotos del cierre de WP06: la semilla con la que se revisó cada brazo.
CASES = [
    ("gn_residential_v2", "row_house", "residential", 17),
    ("gn_residential_v2", "mixed_tenement", "commercial", 2),
    ("gn_industrial_v2", "warehouse", "industrial", 2),
    ("ag_civic_v2", "town_hall", "civic", 2),
]
# Los roles del dominio que un candidato no puede mover: cambia cómo se ve una parcela, no cuánto
# mide. `levels` es lo que publica la composición y `floors` lo que pidió el dominio (game-data).
DOMAIN_KEYS = ("footprintCells", "footprintMeters", "orientation", "family", "buildingType")
# Categorías con una cara que se ve: `symmetric-Y` en una banda frontal no gira y enseña el dorso.
FACED_CATEGORIES = {"facade", "window", "door", "balcony", "canopy"}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def compose(candidate, request, catalog):
    document = GrammarDocument(candidate=candidate)
    return document, compose_candidate(
        request, catalog, StyleProfile(request["styleProfileId"]), document
    )


def request_of(meta, candidate=None):
    request = dict(meta["request"])
    request["candidateProfile"] = candidate
    return request


def module_ids(placements):
    return sorted({p["moduleId"] for p in placements})


def check_control_neutral(catalog, problems):
    """Sin `candidate`, las gramáticas de piloto componen exactamente el lote aprobado."""
    for _profile, building_type, folder, _seed in CASES:
        meta = read(EVIDENCE / folder / f"{building_type}-control.json")
        try:
            _, built = compose(None, request_of(meta, None), catalog)
        except Exception as error:  # noqa: BLE001 - aquí cualquier excepción es el fallo
            problems.append(
                f"{building_type}: el control sin perfil ya no compone "
                f"({type(error).__name__}: {str(error)[:160]})"
            )
            continue
        if built["compositionSignature"] != meta["compositionSignature"]:
            problems.append(
                f"{building_type}: el control sin perfil firma "
                f"{built['compositionSignature'][:12]}, publicado {meta['compositionSignature'][:12]}"
            )
    return len(CASES)


def check_published(profile_id, building_type, folder, catalog, problems):
    """El perfil reproduce el PNG revisado y declara la autoría que realmente colocó."""
    control = read(EVIDENCE / folder / f"{building_type}-control.json")
    evidence_path = EVIDENCE / "candidates" / f"wp06_{building_type}-candidata.json"
    if not evidence_path.exists():
        problems.append(
            f"{building_type}: falta la evidencia de candidato "
            f"{evidence_path.relative_to(REPO)}"
        )
        return None
    published = read(evidence_path)
    try:
        document, built = compose(profile_id, request_of(published, profile_id), catalog)
    except Exception as error:  # noqa: BLE001
        problems.append(
            f"{building_type} × {profile_id}: el perfil publicado ya no compone "
            f"({type(error).__name__}: {str(error)[:160]})"
        )
        return None
    if built["compositionSignature"] != published["compositionSignature"]:
        problems.append(
            f"{building_type} × {profile_id}: firma {built['compositionSignature'][:12]} ≠ "
            f"la del PNG revisado {published['compositionSignature'][:12]}"
        )
    if module_ids(built["placements"]) != module_ids(published["composition"]["placements"]):
        problems.append(f"{building_type} × {profile_id}: el set de módulos colocados cambió")
    declared = published.get("candidateOverlay")
    applied = document.changes_for(building_type)
    if declared != applied:
        problems.append(
            f"{building_type} × {profile_id}: la metadata declara {declared} y el perfil aplica {applied}"
        )
    if published.get("candidateProfile") != profile_id:
        problems.append(f"{building_type}: la evidencia no etiqueta el perfil {profile_id}")
    for key in DOMAIN_KEYS:
        if built[key] != control["composition"][key]:
            problems.append(
                f"{building_type}: {key} {built[key]} ≠ control {control['composition'][key]}"
            )
    if built["levels"] != control["floors"]:
        problems.append(
            f"{building_type}: {built['levels']} plantas y el dominio pidió {control['floors']}"
        )
    # El envelope y los bounds de la evidencia son lo que revisó el ojo humano y lo que consume el
    # runtime para alinear el sprite: si derivan, el PNG publicado ya no es este edificio. Contra el
    # control NO se compara: WP05 movió el envelope de la nave a propósito (el pretil pasó a tener
    # relieve real) y esa diferencia es el hallazgo del paquete, no un fallo.
    for key in ("envelopeMeters", "bounds"):
        if built[key] != published["composition"][key]:
            problems.append(
                f"{building_type}: su {key} se movió respecto al PNG revisado "
                f"{published['composition'][key]} → {built[key]}"
            )
    return built, control, published


def check_authored_geometry(catalog, built, control, published, profile, profile_id, problems):
    """Lo que el candidato añade: frente autorada, familia legal y fuente declarada en el perfil."""
    introduced = sorted(
        {p["moduleId"] for p in built["placements"]}
        - {p["moduleId"] for p in control["composition"]["placements"]}
    )
    for module_id in introduced:
        module = catalog.get(module_id)
        if module.front_axis == "symmetric-Y" and module.category in FACED_CATEGORIES:
            problems.append(
                f"{module_id} entra en {profile_id} sin cara autorada (`symmetric-Y`): en la banda "
                "frontal no se gira y enseña el dorso a la calle (el zócalo de WP01)"
            )
        if module.source_id not in profile["sources"]:
            problems.append(
                f"{module_id} se coloca en {profile_id} pero su fuente `{module.source_id}` no está "
                f"en las `sources` declaradas {profile['sources']}"
            )
    placed_sources = sorted({p["sourceId"] for p in built["placements"]})
    missing = sorted(set(placed_sources) - set(published["sourceIds"]))
    if missing:
        problems.append(
            f"{profile_id}: la evidencia del candidato no declara las fuentes colocadas {missing}"
        )
    return introduced, placed_sources


def check_guards(catalog, problems):
    """Cada forma de silencio del parche antiguo, probada con un overlay sintético."""
    raw = candidates.load()
    record = read(GRAMMAR_PATH)["grammars"]["mixed_tenement"]

    cases = [
        (
            "rol que la familia no sortea",
            {"facadePalettes": {"brick_commercial": {"wainscot": "mod_gn_plinth_2m"}}},
            "nunca",
        ),
        (
            "rol que la paleta no publica",
            {"facadePalettes": {"brick_commercial": {"almena": "mod_gn_cornice_2m"}}},
            "no publica el rol",
        ),
        (
            "cornisa sin rol de cornisa",
            {"silhouetteOptions": {"awning_line": {"corniceModule": "mod_gn_cornice_2m"}}},
            "corniceRole",
        ),
        (
            "módulo de otra familia",
            {"facadePalettes": {"brick_commercial": {"window_bay": "mod_ag_arcade_bay_2m"}}},
            "no es compatible con la familia",
        ),
        (
            "módulo que no existe",
            {"facadePalettes": {"brick_commercial": {"window_bay": "mod_gn_inexistente_2m"}}},
            "módulo inexistente",
        ),
        (
            "paleta que no existe",
            {"facadePalettes": {"marmol_imperial": {"window_bay": "mod_gn_window_bay_2m"}}},
            "no existe la paleta",
        ),
        (
            "overlay vacío",
            {},
            "no toca ningún eje",
        ),
    ]
    for label, overlay, needle in cases:
        try:
            candidates.apply("sonda", record, overlay, catalog)
        except GrammarError as error:
            if needle not in str(error):
                problems.append(f"sonda «{label}»: aborta con el motivo equivocado: {error}")
        else:
            problems.append(f"sonda «{label}»: el overlay se aplicó sin abortar ({overlay})")

    # El tipo no declarado tiene que cortar antes del render: es el equivalente exacto de correr
    # `--candidate` sobre un piloto que el perfil no mira.
    profile = raw["profiles"]["ag_civic_v2"]
    try:
        candidates.overlay_for(profile, "ag_civic_v2", "row_house")
    except GrammarError as error:
        if "no declara" not in str(error):
            problems.append(f"sonda «tipo no declarado»: motivo equivocado: {error}")
    else:
        problems.append("sonda «tipo no declarado»: row_house no lo declara y no abortó")

    # Y su espejo: el orquestador declara el brazo en el archivo de requests, así que un proceso que
    # recibiera el documento equivocado escribiría una fila con la autoría del otro brazo (§13).
    meta = read(EVIDENCE / "civic" / "town_hall-control.json")
    for labelled in (None, "gn_industrial_v2"):
        try:
            compose("ag_civic_v2", request_of(meta, labelled), catalog)
        except Exception as error:  # noqa: BLE001 - CompositionError vive en compose.py
            if "candidateProfile del request" not in str(error):
                problems.append(f"sonda «request etiquetado {labelled!r}»: motivo equivocado: {error}")
        else:
            problems.append(
                f"sonda «request etiquetado {labelled!r}»: compuso sin abortar "
                "con el documento de otro brazo"
            )


def main():
    problems = []
    catalog = Catalog()
    raw = candidates.load()
    sources = {row["id"] for row in read(STAGING_SOURCES)["sources"]}

    for profile_id, profile in raw["profiles"].items():
        unknown = sorted(set(profile["sources"]) - sources)
        if unknown:
            problems.append(f"{profile_id}: fuentes fuera de `staging-sources.json` {unknown}")

    checked = check_control_neutral(catalog, problems)
    placed = []
    for profile_id, building_type, folder, _seed in CASES:
        result = check_published(profile_id, building_type, folder, catalog, problems)
        if result:
            built, control, published = result
            introduced, placed_sources = check_authored_geometry(
                catalog, built, control, published,
                raw["profiles"][profile_id], profile_id, problems
            )
            placed.append((profile_id, building_type, built, introduced, placed_sources))
    check_guards(catalog, problems)

    print(f"perfiles declarados: {sorted(raw['profiles'])}")
    print(f"controles re-compuestos sin perfil: {checked}")
    for profile_id, building_type, built, introduced, published_sources in placed:
        print(
            f"{building_type:16s} {profile_id:19s} firma={built['compositionSignature'][:12]} "
            f"coloc={len(built['placements'])} tri={built['metrics']['triangles']} "
            f"plantas={built['levels']} huella={built['footprintMeters']['width']}×"
            f"{built['footprintMeters']['depth']} m envelope={built['envelopeMeters']}"
        )
        print(f"{'':16s}   aportan: {introduced}")
        print(f"{'':16s}   fuentes: {published_sources}")
    if problems:
        print("\nFALLOS:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("\nOK: los candidatos se componen desde sus perfiles, la producción no se mueve y "
          "ningún silencio del parche antiguo vuelve a ser posible")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

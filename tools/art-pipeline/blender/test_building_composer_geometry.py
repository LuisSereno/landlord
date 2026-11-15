"""Regression tests §15/§17 del Building Composer (cierre V.f).

Reproduce los defectos que bloquearon R9 y blinda la auditoría de industria pesada a nivel de
GEOMETRÍA DECLARADA, sin depender del render final ni de Blender:

  §17 (cement_plant_1002): `_box(x0,y0,x1,y1,z0,z1)` recibía los argumentos del box support en
  orden `(xmin,ymin,zmin,xmax,ymax,zmax)`, cruzando el mínimo Z con el máximo X. La caja declarada
  salía degenerada (x.min > x.max) y la unión de la composición perdía el x.max real del soporte,
  de modo que la escena medía 9.000 donde la composición declaraba 8.900.

  §15 (cement_plant_1003): un conducto se declaraba con `4 * segments` triángulos, pero un cilindro
  de Blender con tapas NGON triangula en `4 * segments - 4` (2·segments laterales + 2·(segments-2)
  de las tapas). Cada pipe sobrestimaba 4 triángulos.

  V.i heavy: cada variante debe conservar su secundario identitario dentro de la huella real. El
  barrido cubre cement_plant, brickworks y steelworks sobre 100 seeds consecutivas; una celda fija
  inválida, un massing que ocupe la reserva o un support desanclado hacen fallar la composición.

El test fija la semántica canónica: los bounds declarados de un soporte caja son exactamente
`position ± size/2` por eje con min<max, y los triángulos declarados de un conducto son
`4 * segments - 4`. Si se reintroduce cualquiera de los dos bugs, este test falla sin necesidad de
renderizar.

Uso: python3 tools/art-pipeline/blender/test_building_composer_geometry.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from building_composer.compose import compose_candidate
from building_composer.grammar import GrammarDocument
from building_composer.module_catalog import Catalog
from building_composer.style_profile import StyleProfile

# Footprints reales del dominio (los que usaba R9 vía domainGeometry).
CASES = [
    ("cement_plant", "industrial_heavy", {"width": 5, "height": 2}, 2),
    ("brickworks", "industrial_heavy", {"width": 5, "height": 2}, 2),
    ("steelworks", "industrial_heavy", {"width": 4, "height": 3}, 2),
    ("town_hall", "civic_landmark", {"width": 8, "height": 4}, 3),
    ("row_house", "residential_low", {"width": 4, "height": 1}, 2),
]
HEAVY_CASES = CASES[:3]
SEEDS = (1000, 1001, 1002, 1003)
HEAVY_SWEEP_SEEDS = range(1000, 1100)


def failures_for_box_support(support, where):
    """§17: la caja declarada debe ser `position ± size/2` con min<max en los tres ejes."""
    problems = []
    position = support["position"]
    size = support["sizeMeters"]
    bounds = support["bounds"]
    expected = {
        "x": (position[0] - size[0] / 2, position[0] + size[0] / 2),
        "y": (position[1] - size[1] / 2, position[1] + size[1] / 2),
        "z": (position[2], position[2] + size[2]),
    }
    for axis, (low, high) in expected.items():
        declared_low = bounds[axis]["min"]
        declared_high = bounds[axis]["max"]
        if declared_low >= declared_high:
            problems.append(f"{where}: {axis} degenerado min={declared_low} max={declared_high}")
        if abs(declared_low - low) > 1e-3 or abs(declared_high - high) > 1e-3:
            problems.append(
                f"{where}: {axis}=[{declared_low:.3f},{declared_high:.3f}] ≠ "
                f"position±size/2=[{low:.3f},{high:.3f}]"
            )
    return problems


def failures_for_pipe_support(support, where):
    """§15: un cilindro NGON triangula en 4·segments-4, no en 4·segments."""
    segments = support["segments"]
    expected = 4 * segments - 4
    if support["triangles"] != expected:
        return [f"{where}: triangles={support['triangles']} ≠ 4*{segments}-4={expected}"]
    return []


def failures_for_support_anchor(composition, where):
    """V.i: cada support queda centrado sobre algún secundario realmente colocado."""
    centers = [
        placement["position"][:2]
        for placement in composition["placements"]
        if placement["purpose"].startswith("secondary:")
    ]
    problems = []
    for index, support in enumerate(composition["originalSupport"]):
        support_center = support["position"][:2] if support["shape"] == "box" else support["origin"][:2]
        if not any(
            abs(support_center[0] - center[0]) <= 1e-3
            and abs(support_center[1] - center[1]) <= 1e-3
            for center in centers
        ):
            problems.append(
                f"{where} support:{index}: centro {support_center} no sigue ningún secundario {centers}"
            )
    return problems


def failures_for_stacked_deck(composition, grammar, cell, where):
    """V.m: un volumen padre de un cuerpo apilado forja EN GEOMETRÍA, no sólo en el comentario.

    `build()` quita la cubierta al padre de un volumen apilado porque entre ambos hay un forjado.
    Si el forjado no se construye, el padre queda como una caja abierta y el interior se ve desde
    fuera alrededor del cuerpo apilado (school_block 2000: la cúpula mide 1,7 m sobre un bloque de
    4×4 m). El validador técnico no lo cazaba: los bounds siguen siendo válidos con el hueco.
    """
    problems = []
    massing = next(
        option for option in grammar["massingOptions"]
        if option["id"] == composition["axisChoices"]["massing"]
    )
    width = composition["footprintCells"]["width"] * cell
    depth = composition["footprintCells"]["height"] * cell
    steps = 40
    for index, spec in enumerate(massing["volumes"]):
        if not any(other.get("stackOn") == index for other in massing["volumes"]):
            continue
        volume = composition["volumes"][index]
        x0, y0, x1, y1 = (
            -width / 2 + spec["cells"][0] * cell,
            -depth / 2 + spec["cells"][1] * cell,
            -width / 2 + (spec["cells"][0] + spec["cells"][2]) * cell,
            -depth / 2 + (spec["cells"][1] + spec["cells"][3]) * cell,
        )
        top = volume["top"]
        plates = [
            placement["bounds"]
            for placement in composition["placements"]
            if placement["purpose"].startswith(f"deck:{index}:")
            and abs(placement["bounds"]["z"]["min"] - top) < 0.05
        ]
        if not plates:
            problems.append(
                f"{where} volumen {index}: cuerpo apilado sobre un padre sin placas de forjado"
            )
            continue
        uncovered = 0
        for ix in range(steps):
            x = x0 + (x1 - x0) * (ix + 0.5) / steps
            for iy in range(steps):
                y = y0 + (y1 - y0) * (iy + 0.5) / steps
                if not any(
                    bounds["x"]["min"] - 1e-3 <= x <= bounds["x"]["max"] + 1e-3
                    and bounds["y"]["min"] - 1e-3 <= y <= bounds["y"]["max"] + 1e-3
                    for bounds in plates
                ):
                    uncovered += 1
        if uncovered:
            area = (x1 - x0) * (y1 - y0)
            problems.append(
                f"{where} volumen {index}: forjado del padre descubierto en "
                f"{uncovered * area / steps / steps:.2f} m² de {area:.2f} m² a cota {top}"
            )
    return problems


def main():
    catalog = Catalog()
    profile = StyleProfile("graphic_civic_buildings_v1")
    document = GrammarDocument()

    problems = []
    box_seen = 0
    pipe_seen = 0
    hip_seen = 0
    deck_parents = 0
    for building_type, family, footprint, floors in CASES:
        for seed in SEEDS:
            request = {
                "candidateId": f"vf_{building_type}_{seed}",
                "buildingType": building_type,
                "family": family,
                "styleProfileId": profile.id,
                "variantSeed": seed,
                "composerVersion": document.composer_version,
                "footprint": footprint,
                "floors": floors,
                "state": "complete",
                "output": "/tmp/vf-geometry-test.png",
            }
            composition = compose_candidate(request, catalog, profile, document)
            for index, support in enumerate(composition["originalSupport"]):
                where = f"{building_type}_{seed} support:{support['purpose']}:{index}"
                if support["shape"] == "box":
                    box_seen += 1
                    problems += failures_for_box_support(support, where)
                elif support["shape"] == "pipe":
                    pipe_seen += 1
                    problems += failures_for_pipe_support(support, where)
            if str(composition["axisChoices"]["roof"]).startswith("gable"):
                hips = [
                    record
                    for record in composition["placements"]
                    if record["role"] in ("hip", "hip_cornice")
                ]
                mirrored = [record for record in hips if record.get("mirrorX")]
                hip_seen += len(hips)
                if len(hips) < 4 or len(hips) % 4:
                    problems.append(
                        f"{building_type}_{seed}: cubierta sin cuatro esquinas completas ({len(hips)})"
                    )
                if len(mirrored) * 2 != len(hips):
                    problems.append(
                        f"{building_type}_{seed}: esquinas asimétricas "
                        f"({len(mirrored)} espejadas de {len(hips)})"
                    )
                if any(
                    support["purpose"].startswith("gable:")
                    for support in composition["originalSupport"]
                ):
                    problems.append(
                        f"{building_type}_{seed}: reapareció un panel triangular de testero"
                    )
                ridge_along = next(
                    option["ridgeAlong"]
                    for option in document.grammar(building_type, catalog, profile)["roofOptions"]
                    if option["id"] == composition["axisChoices"]["roof"]
                )
                gable_sides = ("left", "right") if ridge_along == "x" else ("front", "rear")
                if any(
                    placement["purpose"].startswith(
                        tuple(f"cornice:{side}:" for side in gable_sides)
                    )
                    for placement in composition["placements"]
                ):
                    problems.append(
                        f"{building_type}_{seed}: cornisa horizontal atravesando el testero"
                    )
            # La unión de la composición no puede ser degenerada en ningún eje.
            for axis in ("x", "y", "z"):
                if composition["bounds"][axis]["min"] >= composition["bounds"][axis]["max"]:
                    problems.append(f"{building_type}_{seed}: unión {axis} degenerada")
            problems += failures_for_support_anchor(composition, f"{building_type}_{seed}")
            grammar = document.grammar(building_type, catalog, profile)
            problems += failures_for_stacked_deck(
                composition, grammar, profile.cell_meters, f"{building_type}_{seed}"
            )
            massing = next(
                option for option in grammar["massingOptions"]
                if option["id"] == composition["axisChoices"]["massing"]
            )
            deck_parents += sum(
                1 for index, spec in enumerate(massing["volumes"])
                if any(other.get("stackOn") == index for other in massing["volumes"])
            )

    heavy_compositions = 0
    heavy_supports = 0
    for building_type, family, footprint, floors in HEAVY_CASES:
        for seed in HEAVY_SWEEP_SEEDS:
            request = {
                "candidateId": f"vg_{building_type}_{seed}",
                "buildingType": building_type,
                "family": family,
                "styleProfileId": profile.id,
                "variantSeed": seed,
                "composerVersion": document.composer_version,
                "footprint": footprint,
                "floors": floors,
                "state": "complete",
                "output": "/tmp/vg-heavy-geometry-test.png",
            }
            try:
                composition = compose_candidate(request, catalog, profile, document)
                heavy_compositions += 1
                heavy_supports += len(composition["originalSupport"])
                problems += failures_for_support_anchor(composition, f"{building_type}_{seed}")
            except Exception as error:
                problems.append(f"{building_type}_{seed}: {type(error).__name__}: {error}")

    facade_cases = (
        ("fire_station", "civic_landmark", {"width": 4, "height": 2}, 2, 1003),
        ("apartment_block", "residential_low", {"width": 5, "height": 2}, 5, 1002),
    )
    facade_compositions = {}
    for building_type, family, footprint, floors, seed in facade_cases:
        facade_compositions[building_type] = compose_candidate(
            {
                "candidateId": f"vg_{building_type}_{seed}",
                "buildingType": building_type,
                "family": family,
                "styleProfileId": profile.id,
                "variantSeed": seed,
                "composerVersion": document.composer_version,
                "footprint": footprint,
                "floors": floors,
                "state": "complete",
                "output": "/tmp/vg-facade-geometry-test.png",
            },
            catalog,
            profile,
            document,
        )
        composition = facade_compositions[building_type]
        grammar = document.grammar(building_type, catalog, profile)
        problems += failures_for_stacked_deck(
            composition, grammar, profile.cell_meters, f"{building_type}_{seed}"
        )
        massing = next(
            option for option in grammar["massingOptions"]
            if option["id"] == composition["axisChoices"]["massing"]
        )
        deck_parents += sum(
            1 for index in range(len(massing["volumes"]))
            if any(other.get("stackOn") == index for other in massing["volumes"])
        )

    fire_placements = facade_compositions["fire_station"]["placements"]
    fire_infills = [
        placement
        for placement in fire_placements
        if placement["purpose"].startswith("band-infill:front:level1:")
    ]
    if len(fire_infills) < 4 or len(fire_infills) % 2:
        problems.append(
            f"fire_station_1003: los portones no conservan hojas dobles ({len(fire_infills)})"
        )
    if any(
        placement["role"] == "doorframe"
        for placement in fire_placements
        if placement["purpose"].startswith("band:front:")
        and placement["bounds"]["z"]["min"] > 0
    ):
        problems.append("fire_station_1003: los marcos de portón reaparecen en la planta superior")
    if not any(
        placement["role"] == "window_bay"
        for placement in fire_placements
        if placement["purpose"].startswith(("band:left:", "band:right:"))
        and placement["bounds"]["z"]["min"] > 0
    ):
        problems.append("fire_station_1003: los testeros superiores volvieron a quedar ciegos")
    fire_cornice_corners = [
        placement
        for placement in fire_placements
        if placement["moduleId"]
        in {
            "mod_megakit_cornice_brick_corner_left",
            "mod_megakit_cornice_brick_corner_right",
        }
    ]
    if len(fire_cornice_corners) < 4:
        problems.append(
            f"fire_station_1003: aleros sin retornos de cornisa ({len(fire_cornice_corners)})"
        )

    apartment_placements = facade_compositions["apartment_block"]["placements"]
    if not any(
        placement["purpose"] == "access:above" and placement["role"] == "overhang"
        for placement in apartment_placements
    ):
        problems.append("apartment_block_1002: el portal volvió a perder su marquesina")

    market_hall = compose_candidate(
        {
            "candidateId": "vg_market_hall_1000",
            "buildingType": "market_hall",
            "family": "civic_landmark",
            "styleProfileId": profile.id,
            "variantSeed": 1000,
            "composerVersion": document.composer_version,
            "footprint": {"width": 5, "height": 2},
            "floors": 2,
            "state": "complete",
            "output": "/tmp/vg-market-hall-geometry-test.png",
        },
        catalog,
        profile,
        document,
    )
    market_placements = market_hall["placements"]
    if len(market_hall["volumes"]) != 1:
        problems.append("market_hall_1000: el mercado volvió a dividirse en naves inconexas")
    if any(placement["purpose"] == "access:steps" for placement in market_placements):
        problems.append("market_hall_1000: el acceso a cota de plaza volvió a tener escalinata")
    if not any(
        placement["role"] == "curtain_wall"
        for placement in market_placements
        if placement["purpose"].startswith("band:front:")
        and placement["bounds"]["z"]["min"] == 0
    ):
        problems.append("market_hall_1000: la planta baja comercial volvió a quedar ciega")

    clinic = compose_candidate(
        {
            "candidateId": "vg_clinic_1003",
            "buildingType": "clinic",
            "family": "civic_landmark",
            "styleProfileId": profile.id,
            "variantSeed": 1003,
            "composerVersion": document.composer_version,
            "footprint": {"width": 3, "height": 2},
            "floors": 2,
            "state": "complete",
            "output": "/tmp/vg-clinic-geometry-test.png",
        },
        catalog,
        profile,
        document,
    )
    clinic_placements = clinic["placements"]
    if len(clinic["volumes"]) != 1:
        problems.append("clinic_1003: la clínica volvió a dividirse en cuerpos inconexos")
    if any(placement["purpose"] == "access:steps" for placement in clinic_placements):
        problems.append("clinic_1003: el acceso a nivel de acera volvió a tener escalinata")
    if not any(placement["purpose"] == "access:leaf" for placement in clinic_placements):
        problems.append("clinic_1003: la entrada sanitaria perdió su puerta legible")
    if any(placement["purpose"].startswith("cornice:") for placement in clinic_placements):
        problems.append("clinic_1003: reapareció una cornisa exenta sobre el testero")

    courtyard_home = compose_candidate(
        {
            "candidateId": "vg_courtyard_home_2003",
            "buildingType": "courtyard_home",
            "family": "residential_low",
            "styleProfileId": profile.id,
            "variantSeed": 2003,
            "composerVersion": document.composer_version,
            "footprint": {"width": 2, "height": 2},
            "floors": 1,
            "state": "complete",
            "output": "/tmp/vg-courtyard-home-geometry-test.png",
        },
        catalog,
        profile,
        document,
    )
    courtyard_placements = courtyard_home["placements"]
    if courtyard_home["axisChoices"]["massing"] != "l_shaped" or len(courtyard_home["volumes"]) != 2:
        problems.append("courtyard_home_2003: la vivienda perdió sus dos cuerpos alrededor del patio")
    if any(placement["role"] == "hip_cornice" for placement in courtyard_placements):
        problems.append("courtyard_home_2003: reapareció el alero integrado que sobresale del tejado")
    front_ground = [
        placement
        for placement in courtyard_placements
        if placement["purpose"].startswith("band:front:level1:")
        and placement["bounds"]["z"]["min"] == 0
    ]
    if any(placement["role"] == "wall_panel" for placement in front_ground):
        problems.append("courtyard_home_2003: reapareció el paño frontal oscuro sin lectura doméstica")
    courtyard_grammar = document.grammar("courtyard_home", catalog, profile)
    if any("wall_panel" in rhythm["tokens"]["front"] for rhythm in courtyard_grammar["rhythms"]):
        problems.append("courtyard_home: un ritmo alternativo puede reintroducir el paño frontal oscuro")

    print(f"soportes caja inspeccionados: {box_seen}")
    print(f"soportes conducto inspeccionados: {pipe_seen}")
    print(f"esquinas de cubierta inspeccionadas: {hip_seen}")
    print(f"padres de cuerpo apilado con forjado inspeccionados: {deck_parents}")
    print(f"variantes heavy inspeccionadas: {heavy_compositions}/300")
    print(f"anclajes heavy inspeccionados: {heavy_supports}")
    print("fachadas identitarias inspeccionadas: 5")
    if problems:
        print("\nFALLOS:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    if box_seen == 0 or pipe_seen == 0:
        print("\nAVISO: el corpus no ejercitó ambos tipos de soporte; el test no reproduce el defecto")
        return 1
    if deck_parents == 0:
        print("\nAVISO: el corpus no ejercitó ningún padre apilado; el forjado no está blindado")
        return 1
    print("\nOK: bounds de caja, triángulos de conducto y forjados apilados canónicos en todo el corpus")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

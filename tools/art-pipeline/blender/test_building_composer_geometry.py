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


def main():
    catalog = Catalog()
    profile = StyleProfile("graphic_civic_buildings_v1")
    document = GrammarDocument()

    problems = []
    box_seen = 0
    pipe_seen = 0
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
            # La unión de la composición no puede ser degenerada en ningún eje.
            for axis in ("x", "y", "z"):
                if composition["bounds"][axis]["min"] >= composition["bounds"][axis]["max"]:
                    problems.append(f"{building_type}_{seed}: unión {axis} degenerada")
            problems += failures_for_support_anchor(composition, f"{building_type}_{seed}")

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

    print(f"soportes caja inspeccionados: {box_seen}")
    print(f"soportes conducto inspeccionados: {pipe_seen}")
    print(f"variantes heavy inspeccionadas: {heavy_compositions}/300")
    print(f"anclajes heavy inspeccionados: {heavy_supports}")
    if problems:
        print("\nFALLOS:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    if box_seen == 0 or pipe_seen == 0:
        print("\nAVISO: el corpus no ejercitó ambos tipos de soporte; el test no reproduce el defecto")
        return 1
    print("\nOK: bounds de caja y triángulos de conducto canónicos en todo el corpus")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

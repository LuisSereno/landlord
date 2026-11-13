"""V.g public-space dressing: planificador determinista de mobiliario cívico.

Lee el fixture de celdas REALES (volcadas desde `generateDistrict`), el manifest de vocabulario por
tipo de espacio y el catálogo medido, y coloca módulos por rol y estrategia. No usa `random` del
sistema: cada espacio público saca su serie de un PRNG SplitMix64 sellado con
`seed ^ FNV-1a(publicSpaceId|kind)`, igual que el Building Composer (§13/§14). El resultado es una
lista de placements (módulo, posición en metros, rotación) que el scene builder de Blender monta.

Ninguna geometría se inventa aquí: los bounds y el anclaje de cada módulo salen del catálogo medido
(§6/§7). Un id inexistente o un rol que no publica el módulo es error duro al cargar, no a mitad de
render.
"""

import hashlib
import json
import math
from pathlib import Path

from building_composer.module_catalog import Catalog, GrammarError
from building_composer.prng import SealedRandom

REPO_ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = REPO_ROOT / "blender_artist/manifests/public-space-dressing.json"
FIXTURE_PATH = REPO_ROOT / "blender_artist/manifests/public-space-dressing-fixture.json"

MASK64 = (1 << 64) - 1


def _hash(text):
    """FNV-1a de 64 bits: la etiqueta entra en el estado del PRNG (mismo contrato que el compositor)."""
    value = 0xCBF29CE484222325
    for char in text.encode("utf-8"):
        value = ((value ^ char) * 0x100000001B3) & MASK64
    return value


def load_manifest(path=MANIFEST_PATH):
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    _validate_manifest(document)
    return document


def load_fixture(path=FIXTURE_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _validate_manifest(document):
    """El manifest no puede pedir un módulo que el catálogo no publica con ese rol (fail-closed)."""
    catalog = Catalog()
    known_roles = {"monument", "street_lamp", "bench", "planter", "bollard", "tree", "foliage"}
    for kind, profile in document["kinds"].items():
        for slot in profile["slots"]:
            if slot["role"] not in known_roles:
                raise GrammarError(f"dressing {kind}/{slot['id']}: rol desconocido {slot['role']}")
            if not slot["pool"]:
                raise GrammarError(f"dressing {kind}/{slot['id']}: pool vacío")
            for module_id in slot["pool"]:
                module = catalog.get(module_id)
                if module.role != slot["role"]:
                    raise GrammarError(
                        f"dressing {kind}/{slot['id']}: {module_id} tiene role={module.role} "
                        f"pero el slot pide role={slot['role']}"
                    )


def cellset_to_bounds(cells):
    xs = [cell["x"] for cell in cells]
    ys = [cell["y"] for cell in cells]
    return min(xs), min(ys), max(xs), max(ys)


def perimeter_cells(cellset):
    """Celdas con al menos un vecino 4-conectado fuera del conjunto (el borde del espacio)."""
    out = []
    for (x, y) in cellset:
        if (x + 1, y) not in cellset or (x - 1, y) not in cellset or (x, y + 1) not in cellset or (x, y - 1) not in cellset:
            out.append((x, y))
    return out


def interior_cells(cellset):
    return [cell for cell in cellset if cell not in set(perimeter_cells(cellset))]


def corner_cells(cellset, min_x, min_y, max_x, max_y):
    """La celda más cercana a cada una de las 4 esquinas del bounding box."""
    targets = [(min_x, min_y), (max_x, min_y), (min_x, max_y), (max_x, max_y)]
    chosen = []
    for tx, ty in targets:
        best = min(cellset, key=lambda c: (abs(c[0] - tx) + abs(c[1] - ty), c))
        if best not in chosen:
            chosen.append(best)
    return chosen


def centroid_cell(cellset):
    mean_x = sum(x for x, _ in cellset) / len(cellset)
    mean_y = sum(y for _, y in cellset) / len(cellset)
    return min(cellset, key=lambda c: ((c[0] - mean_x) ** 2 + (c[1] - mean_y) ** 2, c))


def stride_cells(ordered, every):
    if every <= 0:
        return ordered
    return ordered[::every]


def scatter_cells(interior, density, min_spacing, rng):
    """Elige celdas interiores por densidad con separación mínima, sorteadas con el PRNG."""
    if not interior:
        return []
    target = max(1, round(density * len(interior)))
    shuffled = list(interior)
    # Fisher-Yates determinista con el PRNG sellado.
    for i in range(len(shuffled) - 1, 0, -1):
        j = rng.below(i + 1)
        shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
    chosen = []
    for cell in shuffled:
        if len(chosen) >= target:
            break
        if all(abs(cell[0] - c[0]) + abs(cell[1] - c[1]) >= min_spacing for c in chosen):
            chosen.append(cell)
    return chosen


def _rotation_for_slot(slot, cell, centroid):
    """Bancos miran hacia el centro; farolas y árboles sin sesgo (rotación 0 o la del pool)."""
    if slot["role"] == "bench":
        dx = centroid[0] - cell[0]
        dy = centroid[1] - cell[1]
        if abs(dy) >= abs(dx):
            return 0 if dy >= 0 else 180
        return 270 if dx >= 0 else 90
    return 0


def _centroid(cells):
    return (sum(c[0] for c in cells) / len(cells), sum(c[1] for c in cells) / len(cells))


def civic_axis(cellset, townhall_cells):
    """Eje cívico de una plaza enlazada a un ayuntamiento.

    El eje va de la huella del town_hall al centroide de la plaza. El monumento se coloca SOBRE ese
    eje, sesgado hacia el edificio (es lo primero que ve quien sale por la puerta). El corredor son
    las celdas de la plaza a distancia perpendicular ≤ 1.5 del eje: se mantienen libres de mobiliario
    para que la travesía peatonal entrada↔monumento no se bloquee. No simula peatones: es geometría.
    """
    tx, ty = _centroid(townhall_cells)
    px, py = _centroid(cellset)
    axis = (px - tx, py - ty)
    length = math.hypot(*axis) or 1.0
    ux, uy = axis[0] / length, axis[1] / length
    # Perpendicular al eje para medir la distancia lateral de cada celda.
    def perpendicular_distance(cell):
        vx, vy = cell[0] - px, cell[1] - py
        cross = abs(vx * uy - vy * ux)
        return cross

    def along_distance(cell):
        vx, vy = cell[0] - px, cell[1] - py
        return vx * ux + vy * uy

    corridor = {cell for cell in cellset if perpendicular_distance(cell) <= 1.5}
    # Monumento: celda del corredor más cercana al town_hall (menor distancia a lo largo del eje,
    # hacia el edificio), desempate por distancia euclídea al edificio.
    monument = min(
        corridor or cellset,
        key=lambda c: (along_distance(c), (c[0] - tx) ** 2 + (c[1] - ty) ** 2, c),
    )
    return monument, corridor


def dress_space(space, kind, manifest, catalog, seed, townhall_cells=None):
    """Coloca el mobiliario de un espacio público. Devuelve placements en metros (origen = esquina min).

    Si `townhall_cells` se pasa (plaza enlazada a un ayuntamiento), la plaza se orienta al eje cívico:
    monumento sobre el eje, corredor peatonal libre de mobiliario y bancos mirando al monumento.
    """
    profile = manifest["kinds"].get(kind)
    if profile is None:
        return []
    cell_meters = manifest.get("cellMetersDefault", 4)
    cells = [(c["x"], c["y"]) for c in space["cells"]]
    cellset = set(cells)
    if not cellset:
        return []
    min_x, min_y, max_x, max_y = cellset_to_bounds(space["cells"])
    rng = SealedRandom(seed, label=f"{space['id']}|{kind}")

    perim = sorted(perimeter_cells(cellset))
    interior = sorted(interior_cells(cellset))
    centroid = centroid_cell(sorted(cellset))

    monument_cell = centroid
    corridor = set()
    if townhall_cells:
        monument_cell, corridor = civic_axis(cellset, townhall_cells)

    placements = []
    for slot in profile["slots"]:
        strategy = slot["strategy"]
        params = slot.get("params", {})
        if strategy == "center":
            targets = [monument_cell]
        elif strategy == "perimeter":
            targets = stride_cells(perim, params.get("everyCells", 3))
        elif strategy == "corners":
            targets = corner_cells(sorted(cellset), min_x, min_y, max_x, max_y)
        elif strategy == "inner_ring":
            inset = params.get("insetCells", 1)
            ring = [c for c in interior if min(c[0] - min_x, c[1] - min_y, max_x - c[0], max_y - c[1]) <= inset]
            targets = stride_cells(sorted(ring), max(1, len(ring) // max(1, params.get("count", 4))))[: params.get("count", 4)]
        elif strategy == "scatter":
            targets = scatter_cells(interior, params.get("density", 0.15), params.get("minSpacingCells", 2), rng)
        else:
            raise GrammarError(f"dressing {kind}/{slot['id']}: estrategia desconocida {strategy}")

        # El corredor peatonal queda libre salvo para el propio monumento (center) y las farolas,
        # que jalonan el eje sin cortarlo.
        if strategy != "center" and slot["role"] not in ("street_lamp",):
            targets = [cell for cell in targets if cell not in corridor]

        for cell in targets:
            module_id = rng.choice(slot["pool"])
            module = catalog.get(module_id)
            aim = monument_cell if townhall_cells else centroid
            rotation = _rotation_for_slot(slot, cell, aim)
            width, depth, height = module.size(rotation)
            position = ((cell[0] - min_x + 0.5) * cell_meters, (cell[1] - min_y + 0.5) * cell_meters, 0.0)
            placements.append(
                {
                    "moduleId": module_id,
                    "role": slot["role"],
                    "slot": slot["id"],
                    "purpose": f"dressing:{kind}:{slot['id']}",
                    "cell": {"x": cell[0], "y": cell[1]},
                    "position": [round(position[0], 3), round(position[1], 3), position[2]],
                    "rotationDegrees": rotation,
                    "footprintMeters": {"width": width, "depth": depth, "height": height},
                    "sourcePath": module.source_path,
                    "sourceId": module.source_id,
                    "license": module.license,
                }
            )
    return placements


def dress_all(manifest=None, fixture=None, catalog=None):
    """Viste todos los espacios del fixture. Determinista: misma entrada, misma salida."""
    manifest = manifest or load_manifest()
    fixture = fixture or load_fixture()
    catalog = catalog or Catalog()
    seed = fixture.get("seed", 0)
    cell_meters = fixture.get("cellMeters", manifest.get("cellMetersDefault", 4))

    results = []
    for district in fixture["districts"]:
        townhall_cells = [
            (c["x"], c["y"]) for c in district.get("townHallFootprintCells", [])
        ]
        civic_plaza_id = district.get("townHallPlazaId")
        for space in district["publicSpaces"]:
            # Sólo la plaza enlazada al ayuntamiento recibe el eje cívico; el resto se viste igual.
            space_townhall = townhall_cells if space["id"] == civic_plaza_id else None
            placements = dress_space(space, space["kind"], manifest, catalog, seed, space_townhall)
            results.append(
                {
                    "publicSpaceId": space["id"],
                    "kind": space["kind"],
                    "profileId": district["profileId"],
                    "districtRole": district.get("role", ""),
                    "civic": bool(space_townhall),
                    "cellMeters": cell_meters,
                    "boundsCells": list(cellset_to_bounds(space["cells"])),
                    "cellCount": len(space["cells"]),
                    "placements": placements,
                }
            )
    signature = hashlib.sha256(
        json.dumps(results, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return {
        "schemaVersion": 1,
        "dressingVersion": manifest.get("composerVersion", "vg-dressing-1"),
        "seed": seed,
        "signature": signature,
        "spaces": results,
    }


if __name__ == "__main__":
    import sys

    output = dress_all()
    json.dump(output, sys.stdout, indent=2)
    sys.stdout.write("\n")

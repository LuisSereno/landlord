"""Inventario headless de geometría de fuente real para el Building Composer (V.f.0).

No inventa nada: importa cada archivo candidato y mide lo que hay dentro. La clasificación
`modular / partially_modular / whole_asset_only / unsuitable` se deriva de la geometría
observada, nunca del nombre del archivo.

Uso (desde la raíz del repo):
  blender --background --python tools/art-pipeline/blender/inventory_building_modules.py -- \
    --scope /tmp/scope.json --output /tmp/inventory.json

`--scope` es una lista `[{"sourceId","path","unitScale","license"}]` con rutas relativas al repo.
El JSON de salida es una lista en el mismo orden que el scope: determinista por construcción.
"""

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from source_import import (  # noqa: E402
    SourceImportError,
    fix_texture_paths,
    import_source,
    normalize_import_root,
    unresolved_textures,
    world_bounds,
)

# Un módulo necesita piezas que puedan separarse; por debajo de esta dimensión en metros un
# componente suelto es un detalle pegado (remache, mancha) que no da lugar a un módulo útil.
MIN_PIECE_SIZE_M = 0.25
MIN_PIECE_TRIANGLES = 24
# Share mínimo de triángulos para que un componente cuente como pieza sustancial. medido: los GLB
# de Kenney vienen con geometría SIN SOLDAR por vértices (UVs y normales partidas), así que el
# union-find devuelve centenares de quads de detalle. Contar "cáscaras" sin este filtro clasificaría
# cualquier edificio como modular cuando en realidad no fragmenta en piezas útiles.
SUBSTANTIAL_PIECE_SHARE = 0.10


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", required=True)
    parser.add_argument("--output", required=True)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def purge_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def triangle_count(mesh):
    return sum(len(polygon.vertices) - 2 for polygon in mesh.polygons)


def connected_components(mesh):
    """Componentes conexos de una malla por union-find sobre vértices compartidos.

    Es el dato que decide si un GLB "de un solo objeto" es en realidad varias piezas sueltas
    separables de forma reproducible (`mesh.separate(type='LOOSE')`), y no una masa indivisible.
    Devuelve también la raíz de cada vértice para repartir los polígonos en O(caras).
    """
    parent = list(range(len(mesh.vertices)))

    def find(node):
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(left, right):
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parent[root_right] = root_left

    for edge in mesh.edges:
        union(edge.vertices[0], edge.vertices[1])
    groups = {}
    for index in range(len(mesh.vertices)):
        groups.setdefault(find(index), []).append(index)
    return list(groups.values()), groups


def piece_metrics(mesh, component, root, matrix_world, triangles_by_root):
    """Bounds mundiales y triángulos de un componente conexo, en metros normalizados."""
    component_vertices = [mesh.vertices[index].co for index in component]
    mins_local = Vector(
        (
            min(co.x for co in component_vertices),
            min(co.y for co in component_vertices),
            min(co.z for co in component_vertices),
        )
    )
    maxs_local = Vector(
        (
            max(co.x for co in component_vertices),
            max(co.y for co in component_vertices),
            max(co.z for co in component_vertices),
        )
    )
    corners = [
        matrix_world @ Vector((x, y, z))
        for x in (mins_local.x, maxs_local.x)
        for y in (mins_local.y, maxs_local.y)
        for z in (mins_local.z, maxs_local.z)
    ]
    mins = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    maxs = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return {
        "sizeMeters": {
            "width": round(maxs.x - mins.x, 3),
            "depth": round(maxs.y - mins.y, 3),
            "height": round(maxs.z - mins.z, 3),
        },
        "minZ": round(mins.z, 3),
        "triangles": triangles_by_root.get(root, 0),
    }


def material_names(obj):
    return [slot.material.name for slot in obj.material_slots if slot.material]


def image_names(objects):
    names = set()
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            node_tree = getattr(getattr(slot.material, "node_tree", None), "nodes", None)
            if node_tree is None:
                continue
            for node in node_tree:
                if node.type == "TEX_IMAGE" and node.image:
                    names.add(node.image.name)
    return sorted(names)


def object_records(objects, loose_parts_by_object):
    """Ficha por objeto importado. `loose_parts_by_object` viene ya medido: es caro repetirlo."""
    records = []
    for obj in sorted(objects, key=lambda item: item.name):
        record = {
            "name": obj.name,
            "type": obj.type,
            "parent": obj.parent.name if obj.parent else None,
            "materials": material_names(obj) if obj.type == "MESH" else [],
        }
        if obj.type == "MESH":
            record["vertices"] = len(obj.data.vertices)
            record["triangles"] = triangle_count(obj.data)
            record["looseParts"] = loose_parts_by_object.get(obj.name, 0)
        records.append(record)
    return records


def mesh_components(objects):
    """Componentes sueltos reales: la materia prima de un módulo separable.

    El union-find se recorre una sola vez por malla: los GLB de Kenney superan los miles de
    vértices y repetir el análisis por pieza doblaría el coste del inventario.
    """
    records = []
    by_object = {}
    for obj in sorted(objects, key=lambda item: item.name):
        if obj.type != "MESH" or not obj.data.vertices:
            continue
        components, groups = connected_components(obj.data)
        by_object[obj.name] = len(components)
        root_of = {}
        for root, members in groups.items():
            for vertex_index in members:
                root_of[vertex_index] = root
        # Una cara pertenece al componente de su primer vértice: repartir así es O(caras).
        triangles_by_root = {}
        for polygon in obj.data.polygons:
            root = root_of[polygon.vertices[0]]
            triangles_by_root[root] = triangles_by_root.get(root, 0) + len(polygon.vertices) - 2
        for root, component in groups.items():
            metrics = piece_metrics(obj.data, component, root, obj.matrix_world, triangles_by_root)
            if min(metrics["sizeMeters"].values()) < MIN_PIECE_SIZE_M:
                continue
            if metrics["triangles"] < MIN_PIECE_TRIANGLES:
                continue
            records.append(
                {
                    "object": obj.name,
                    "vertices": len(component),
                    "triangles": metrics["triangles"],
                    "sizeMeters": metrics["sizeMeters"],
                    "minZ": metrics["minZ"],
                }
            )
    records.sort(key=lambda item: (-item["triangles"], item["object"], item["minZ"]))
    return records, by_object


def substantial(units, triangle_total):
    """Unidades que pesan de verdad en la masa del archivo.

    Con `triangle_total` 0 (mallas vacías, armaduras sin geometría) cualquier umbral relativo se
    cumpliría por accidente y la fuente parecería modular sin tener nada.
    """
    if not triangle_total:
        return []
    threshold = SUBSTANTIAL_PIECE_SHARE * triangle_total
    return [unit for unit in units if unit.get("triangles", 0) >= threshold]


def separation_of(hierarchy, components, shells, triangle_total):
    """Unidades separables medidas, tanto objetos raíz independientes como piezas conexas.

    `dominantShare` se mide sobre el conjunto que da más unidades: una malla única partida en tres
    bloques grandes es fragmentable igual que tres objetos sueltos, y evaluar la clasificación con
    el conjunto equivocado enterraría ese hecho.
    """
    meshes = [record for record in hierarchy if record["type"] == "MESH"]
    candidates = (
        ("objects", substantial(meshes, triangle_total)),
        ("pieces", substantial(components, triangle_total)),
    )
    kind, units = max(candidates, key=lambda item: (len(item[1]), item[0] == "objects"))
    dominant = max((unit["triangles"] for unit in units), default=0)
    return {
        "unitKind": kind,
        "unitCount": len(units),
        "unitNames": [unit.get("name") or unit["object"] for unit in units],
        "dominantShare": round(dominant / triangle_total, 3) if triangle_total else 0.0,
        "shells": shells,
    }


def classify(entry, separation):
    """Regla determinista, derivada de lo que hay dentro del archivo (no de su nombre).

    `modular` exige unidades sustanciales de verdad. Un edificio de Kenney con 554 quads sueltos
    NO es modular: fragmentarlo sería reconstruirlo a mano, y eso es justo lo que D-098 prohíbe
    disfrazar de composición.
    """
    if entry.get("importError"):
        return "unsuitable", entry["importError"]
    if not entry.get("meshCount"):
        return "unsuitable", "la fuente no contiene ningún mesh"
    size = entry["normalized"]["sizeMeters"]
    largest_dimension = max(size["width"], size["depth"], size["height"])
    # Medido sobre el eje más largo: una columna o un poste legítimos miden < 0.5 m de ANCHO y no
    # por eso son geometría degenerada. Mirar sólo X los descartaba por error.
    if largest_dimension < 0.25:
        return "unsuitable", f"geometría degenerada: {largest_dimension:.3f} m en su eje mayor"
    if not entry.get("triangles"):
        return "unsuitable", "los meshes importados no tienen triángulos"
    # D-098 no es sólo "el archivo existe": una textura suelta que no resuelve se renderiza
    # magenta, y `runtime_asset.py` aborta ahí. Un módulo con texturas rotas es inhabible.
    unresolved = entry.get("unresolvedTextures") or []
    if unresolved:
        return (
            "unsuitable",
            f"{len(unresolved)} texturas sin resolver (render magenta): {unresolved[0]}",
        )
    pieces = separation["unitCount"]
    dominant_share = separation["dominantShare"]
    if pieces >= 3 and dominant_share < 0.75:
        return (
            "modular",
            f"{pieces} {separation['unitKind']} sustanciales, la mayor pesa "
            f"{dominant_share:.0%} (sobre {separation['shells']} cáscaras)",
        )
    if pieces >= 2:
        return (
            "partially_modular",
            f"{pieces} {separation['unitKind']} sustanciales pero una domina ({dominant_share:.0%})",
        )
    return (
        "whole_asset_only",
        f"una sola unidad sustancial ({dominant_share:.0%} de los triángulos, "
        f"{separation['shells']} cáscaras): usable como módulo de masa completo",
    )


def inventory_source(scope_entry):
    path = REPO_ROOT / scope_entry["path"]
    entry = {
        "sourceId": scope_entry["sourceId"],
        "path": scope_entry["path"],
        "license": scope_entry["license"],
        "unitScale": scope_entry["unitScale"],
        "exists": path.exists(),
    }
    if not path.exists():
        entry["importError"] = "no existe el archivo en staging"
        entry["classification"] = "unsuitable"
        entry["classificationReason"] = "no existe el archivo en staging"
        return entry

    purge_scene()
    try:
        objects = import_source(path)
        # Los glTF de Quaternius exportados para Godot referencian texturas por nombre suelto:
        # el remapeo de `fix_texture_paths` también es necesario aquí, no sólo en FBX.
        fix_texture_paths(path)
        normalization = normalize_import_root(objects, unit_scale=scope_entry["unitScale"])
    except (SourceImportError, RuntimeError) as error:
        entry["importError"] = str(error)
        entry["classification"] = "unsuitable"
        entry["classificationReason"] = str(error)
        return entry

    mins, maxs = world_bounds(objects)
    # El render de runtime aborta si una textura no resuelve (magenta), así que el inventario mide
    # lo mismo que va a decidir el compositor: si el archivo existe en disco o va empaquetado.
    missing_textures = unresolved_textures(objects)
    components, component_count_by_object = mesh_components(objects)
    shells = sum(component_count_by_object.values())
    hierarchy = object_records(objects, component_count_by_object)
    # Sólo los meshes aportan triángulos: un Empty raíz (IMPORT_ROOT) también entra en la jerarquía.
    triangle_total = sum(record.get("triangles", 0) for record in hierarchy)
    vertex_total = sum(record.get("vertices", 0) for record in hierarchy)
    largest = max((record["triangles"] for record in components), default=0)
    largest_share = round(largest / triangle_total, 3) if triangle_total else 0.0
    separation = separation_of(hierarchy, components, shells, triangle_total)

    entry.update(
        {
            "objectCount": len(objects),
            "meshCount": sum(1 for obj in objects if obj.type == "MESH"),
            "armatureCount": sum(1 for obj in objects if obj.type == "ARMATURE"),
            "vertices": vertex_total,
            "triangles": triangle_total,
            "materials": sorted({name for obj in objects for name in material_names(obj)}),
            "images": image_names(objects),
            "unresolvedTextures": missing_textures,
            "hierarchy": hierarchy,
            "normalized": {
                "sizeMeters": normalization["normalizedSize"],
                "worldMinZ": round(mins.z, 3),
                "worldCenterXY": [
                    round((mins.x + maxs.x) / 2, 3),
                    round((mins.y + maxs.y) / 2, 3),
                ],
                "sourceBounds": normalization["sourceBounds"],
                "importScale": normalization["importScale"],
                "importOffset": normalization["importOffset"],
            },
            "separation": {
                **separation,
                "pieceCandidates": len(components),
                "largestPieceTriangleShare": largest_share,
                "topPieces": components[:12],
            },
        }
    )
    classification, reason = classify(entry, separation)
    entry["classification"] = classification
    entry["classificationReason"] = reason
    entry["pivot"] = pivot_report(objects, mins, maxs)
    return entry


def axis_convention(low, high):
    """Cómo está autorada la geometría respecto al origen del objeto en un eje.

    El compositor apoya módulos en una retícula; necesitar saber si un panel de 2 m nace en su
    centro, en su canto izquierdo o colgando del techo. Se mide en metros con tolerancia de 2 cm
    porque los GLB traen decimales de export.
    """
    tolerance = 0.02
    if abs(low - high) < tolerance:
        return "degenerate"
    if abs(low + high) < tolerance:
        return "centered"
    if abs(low) < tolerance:
        return "positive-from-origin"
    if abs(high) < tolerance:
        return "negative-from-origin"
    return "offset"


def pivot_report(objects, mins, maxs):
    """Dónde cae el origen del objeto dominante respecto al suelo y al centro de la huella.

    Un asset cuyo origen está en la azotea obliga a corregir el pivot antes de componer: el
    compositor apoya los módulos por su origen, así que este dato se mide, no se supone.
    """
    meshes = [obj for obj in objects if obj.type == "MESH" and obj.data.vertices]
    if not meshes:
        return None
    dominant = max(meshes, key=lambda obj: triangle_count(obj.data))
    corners = [dominant.matrix_world @ Vector(corner) for corner in dominant.bound_box]
    origin = dominant.matrix_world.translation
    center = Vector(((mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2, mins.z))
    relative = {
        axis: {
            "min": round(min(c[index] for c in corners) - origin[index], 3),
            "max": round(max(c[index] for c in corners) - origin[index], 3),
        }
        for index, axis in enumerate(("x", "y", "z"))
    }
    return {
        "object": dominant.name,
        "origin": [round(value, 3) for value in origin],
        "offsetFromGroundCenter": [
            round(origin.x - center.x, 3),
            round(origin.y - center.y, 3),
            round(origin.z - center.z, 3),
        ],
        "localSizeMeters": {
            "width": round(max(c.x for c in corners) - min(c.x for c in corners), 3),
            "depth": round(max(c.y for c in corners) - min(c.y for c in corners), 3),
            "height": round(max(c.z for c in corners) - min(c.z for c in corners), 3),
        },
        "boundsRelativeToOrigin": relative,
        "convention": {
            axis: axis_convention(values["min"], values["max"])
            for axis, values in relative.items()
        },
    }


def main():
    args = parse_args()
    scope = json.loads(Path(args.scope).read_text(encoding="utf-8"))
    entries = [inventory_source(item) for item in scope]
    purge_scene()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "toolchain": {
            "blender": bpy.app.version_string,
            "buildHash": bpy.app.build_hash.decode()
            if isinstance(bpy.app.build_hash, bytes)
            else bpy.app.build_hash,
        },
        "sources": entries,
    }
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "sources": len(entries),
                "byClassification": {
                    key: sum(1 for item in entries if item["classification"] == key)
                    for key in ("modular", "partially_modular", "whole_asset_only", "unsuitable")
                },
            }
        )
    )


if __name__ == "__main__":
    main()

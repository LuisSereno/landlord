"""Medición headless de los módulos seleccionados para el catálogo de V.f.1.

El inventario de V.f.0 mide el ARCHIVO completo y su pivote (objeto dominante). Un módulo puede
seleccionar sólo parte de los meshes de un archivo (aerogenerador: torre + palas), y el compositor
apoya módulos por el origen de SU propia geometría, no por el del archivo. Por eso esta pasada
mide, por módulo, `moduleBounds` y `anchorTransform` sobre la selección real (§9).

No decide nada: recibe la selección ya curada y devuelve lo que Blender observa al importar.
Cualquier desviación (selector que no existe, geometría vacía, textura magenta) es un error duro,
no un dato: un módulo declarativo sin geometría real no llega a escribirse en el catálogo (§7).

Uso (desde la raíz del repo):
  blender --background --python tools/art-pipeline/blender/measure_building_modules.py -- \
    --selection /tmp/selection.json --output /tmp/measurements.json
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
)

TOLERANCE_M = 0.02


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--selection", required=True)
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


def shell_count(mesh):
    """Cáscaras separadas por union-find sobre las aristas del mesh.

    Kenney exporta sin soldar por vértices (UV y normales partidas), así que el número de vértices
    no dice cuántas piezas hay; hay que recorrer la conectividad real.
    """
    parent = list(range(len(mesh.vertices)))

    def find(node):
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    for edge in mesh.edges:
        a, b = find(edge.vertices[0]), find(edge.vertices[1])
        if a != b:
            parent[a] = b
    return len({find(node) for node in range(len(mesh.vertices))})


def evaluated_corners(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    corners = []
    for obj in objects:
        evaluated = obj.evaluated_get(deps)
        corners.extend(evaluated.matrix_world @ Vector(c) for c in evaluated.bound_box)
    return corners


def module_bounds(objects):
    """Caja del módulo en el marco de trabajo del compositor: metros de Landlord tras normalizar.

    Se mide en coordenadas de MUNDO, no en las locales de `IMPORT_ROOT`: el root lleva
    `scale = unitScale`, así que sus coordenadas locales siguen siendo las unidades crudas del
    glTF (KayKit mide 4× menos en local que en mundo). El compositor apoya módulos en metros.
    """
    corners = evaluated_corners(objects)
    if not corners:
        raise SourceImportError("el módulo no aporta ningún vértice")
    lows = [min(point[axis] for point in corners) for axis in range(3)]
    highs = [max(point[axis] for point in corners) for axis in range(3)]
    axes = ("x", "y", "z")
    return {
        "relativeToNormalizedFrame": {
            axis: {"min": round(low, 4), "max": round(high, 4)}
            for axis, low, high in zip(axes, lows, highs)
        },
        "sizeMeters": {
            "width": round(highs[0] - lows[0], 4),
            "depth": round(highs[1] - lows[1], 4),
            "height": round(highs[2] - lows[2], 4),
        },
        "centerXY": [round((lows[0] + highs[0]) / 2, 4), round((lows[1] + highs[1]) / 2, 4)],
        "minZ": round(lows[2], 4),
        "maxZ": round(highs[2], 4),
    }


def axis_convention(low, high):
    """Convención de apoyo del módulo en un eje, medida respecto al origen del root normalizado."""
    if abs(low - high) < TOLERANCE_M:
        return "degenerate"
    if abs(low + high) < TOLERANCE_M:
        return "centered"
    if abs(low) < TOLERANCE_M:
        return "positive-from-origin"
    if abs(high) < TOLERANCE_M:
        return "negative-from-origin"
    return "offset"


def measure_module(module, by_name):
    """Medición de la geometría REAL que el selector del módulo trae a la escena."""
    missing = [name for name in module["meshes"] if name not in by_name]
    if missing:
        raise SourceImportError(
            f"selector inexistente en {module['id']}: faltan {', '.join(missing)}"
        )
    if not module["meshes"]:
        raise SourceImportError(f"módulo sin selector de geometría: {module['id']}")

    objects = [by_name[name] for name in module["meshes"]]
    meshes = [obj for obj in objects if obj.type == "MESH" and obj.data.vertices]
    if not meshes:
        raise SourceImportError(f"módulo sin geometría real: {module['id']}")

    bounds = module_bounds(objects)
    materials, images, shells, vertices, triangles = [], [], 0, 0, 0
    for obj in meshes:
        for slot in obj.material_slots:
            material = slot.material
            if material is None:
                continue
            if material.name not in materials:
                materials.append(material.name)
            for node in material.node_tree.nodes if material.node_tree else []:
                image = getattr(node, "image", None)
                if image is not None and image.name not in images:
                    images.append(image.name)
        shells += shell_count(obj.data)
        vertices += len(obj.data.vertices)
        triangles += triangle_count(obj.data)

    if triangles == 0:
        raise SourceImportError(f"módulo sin triángulos: {module['id']}")
    blocked = unresolved_textures(meshes)
    if blocked:
        raise SourceImportError(
            f"módulo {module['id']} con texturas sin resolver (render magenta): {blocked[0]}"
        )

    relative = bounds["relativeToNormalizedFrame"]
    return {
        "id": module["id"],
        "selectedObjects": [obj.name for obj in objects],
        "moduleBounds": bounds,
        "anchor": {
            "originToGroundMeters": round(-bounds["minZ"], 4),
            "offsetToFootprintCenterMeters": [
                round(-bounds["centerXY"][0], 4),
                round(-bounds["centerXY"][1], 4),
            ],
            "convention": {
                axis: axis_convention(values["min"], values["max"])
                for axis, values in relative.items()
            },
        },
        "measured": {
            "meshObjects": len(meshes),
            "vertices": vertices,
            "triangles": triangles,
            "shells": shells,
            "materials": sorted(materials),
            "images": sorted(images),
        },
    }


def measure_file(entry):
    purge_scene()
    path = REPO_ROOT / entry["sourcePath"]
    if not path.exists():
        raise SourceImportError(f"ruta fuera de staging o inexistente: {entry['sourcePath']}")
    objects = import_source(path)
    # Los glTF de Godot referencian texturas por nombre suelto: sin remapear, el módulo mediría
    # geometría correcta pero renderizaría magenta.
    fix_texture_paths(path)
    if not objects:
        raise SourceImportError(f"la fuente no importó ningún objeto: {entry['sourcePath']}")
    normalized = normalize_import_root(objects, unit_scale=entry["unitScale"])
    by_name = {obj.name: obj for obj in objects}

    hierarchy = [
        {
            "name": obj.name,
            "type": obj.type,
            "parent": (None if obj.parent is None or obj.parent.name == "IMPORT_ROOT" else obj.parent.name),
            "triangles": triangle_count(obj.data) if obj.type == "MESH" else 0,
        }
        for obj in sorted(objects, key=lambda item: item.name)
    ]
    return {
        "sourcePath": entry["sourcePath"],
        "sourceId": entry["sourceId"],
        "license": entry["license"],
        "unitScale": entry["unitScale"],
        "normalized": normalized,
        "hierarchy": hierarchy,
        "modules": [
            measure_module(module, by_name)
            for module in entry["modules"]
        ],
    }


def toolchain():
    # `build_hash` viene como bytes en Blender 5.x; serializarlo tal cual revienta el json.dumps.
    build_hash = bpy.app.build_hash
    return {
        "blender": bpy.app.version_string,
        "buildHash": build_hash.decode() if isinstance(build_hash, bytes) else build_hash,
    }


def main():
    args = parse_args()
    selection = json.loads(Path(args.selection).read_text(encoding="utf-8"))
    files = [measure_file(entry) for entry in selection]
    purge_scene()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "toolchain": toolchain(),
                "files": files,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "status": "measured",
                "files": len(files),
                "modules": sum(len(item["modules"]) for item in files),
            }
        )
    )


if __name__ == "__main__":
    main()

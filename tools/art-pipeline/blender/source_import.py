"""Ingesta de geometría de terceros para el pipeline de arte.

Los assets CC0/MIT no se dibujan aquí: se importan, se remapean sus texturas y
se normalizan a la escala física de Landlord (1 BU = 1 m). Ver WP4.15-V.a 〔R2〕
y 〔R7〕 en el plan.

Regla normativa: la normalización actúa SÓLO sobre el contenedor raíz importado.
Nunca se tocan vértices, matrices locales, huesos, skinning ni animation data,
porque un personaje Rocketbox es `Armature -> Body/Clothes/Hair` y editar su
mesh rompería rig y animaciones.
"""

import os
from pathlib import Path

import bpy
import mathutils

SUPPORTED_SUFFIXES = (".glb", ".gltf", ".fbx")


class SourceImportError(RuntimeError):
    """Fuente no importable o mal formada: el render no debe continuar."""


def import_source(path):
    """Importa un GLB/glTF/FBX y devuelve los objetos recién creados.

    GLB es la ruta preferida: Kenney y KayKit empaquetan texturas dentro del
    archivo y la clase de bug de rutas absolutas de Windows desaparece.
    """
    source = Path(path)
    if not source.exists():
        raise SourceImportError(f"no existe la fuente: {source}")

    suffix = source.suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise SourceImportError(f"formato no soportado: {suffix} ({source.name})")

    before = set(bpy.data.objects)
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    else:
        # import_scene.gltf acepta .glb y .gltf; los .bin/.png relativos se
        # resuelven contra el propio directorio del archivo.
        bpy.ops.import_scene.gltf(filepath=str(source))

    imported = [obj for obj in bpy.data.objects if obj not in before]
    if not imported:
        raise SourceImportError(f"el importador no creó ningún objeto: {source.name}")
    return imported


def find_textures_dir(source_path):
    """Directorio de texturas de una fuente, del más cercano al más lejano."""
    source_dir = Path(source_path).parent
    for candidate in (
        source_dir / "Textures",
        source_dir.parent / "Textures",
        source_dir.parent.parent / "Textures",
    ):
        if candidate.is_dir():
            return candidate
    return None


def fix_texture_paths(source_path):
    """Reescribe rutas de textura rotas hacia el directorio Textures/ local.

    Los FBX de Quaternius (y los de Rocketbox) guardan rutas absolutas de
    Windows o relativas a un directorio de trabajo del autor. Blender las
    importa tal cual y el resultado es magenta, no un error.
    """
    textures_dir = find_textures_dir(source_path)
    if textures_dir is None:
        return 0

    fixed = 0
    for mat in bpy.data.materials:
        nodes = getattr(getattr(mat, "node_tree", None), "nodes", None)
        if nodes is None:
            continue
        for node in nodes:
            if node.type != "TEX_IMAGE" or node.image is None:
                continue
            filename = os.path.basename(node.image.filepath)
            if not filename:
                continue
            match = textures_dir / filename
            if not match.exists():
                match = next(
                    (
                        f
                        for f in textures_dir.iterdir()
                        if f.name.lower() == filename.lower()
                    ),
                    None,
                )
            if match is None:
                continue
            node.image.filepath = str(match)
            node.image.reload()
            fixed += 1
    return fixed


def unresolved_textures(objects):
    """Imágenes referenciadas que no existen en disco ni van empaquetadas."""
    missing = []
    for obj in objects:
        if obj.type != "MESH" or obj.data is None:
            continue
        for mat in obj.data.materials:
            if mat is None:
                continue
            nodes = getattr(getattr(mat, "node_tree", None), "nodes", None)
            if nodes is None:
                continue
            for node in nodes:
                if node.type != "TEX_IMAGE" or node.image is None:
                    continue
                if node.image.packed_file is not None:
                    continue
                if Path(bpy.path.abspath(node.image.filepath)).exists():
                    continue
                missing.append(f"{obj.name}/{mat.name}: {node.image.filepath}")
    return missing


def assert_textures_resolved(objects, source_path):
    """Convierte el magenta en fallo: una textura ausente aborta el render."""
    missing = unresolved_textures(objects)
    if missing:
        raise SourceImportError(
            f"{Path(source_path).name} tiene {len(missing)} texturas sin resolver "
            f"(quedarían magenta):\n  " + "\n  ".join(missing)
        )


def world_bounds(objects):
    """Caja de contorno mundial de los meshes, en la pose evaluada actual."""
    deps = bpy.context.evaluated_depsgraph_get()
    corners = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(deps)
        corners.extend(evaluated.matrix_world @ mathutils.Vector(c) for c in evaluated.bound_box)
    if not corners:
        raise SourceImportError("la fuente no contiene ningún mesh")
    mins = mathutils.Vector(map(min, zip(*[(v.x, v.y, v.z) for v in corners])))
    maxs = mathutils.Vector(map(max, zip(*[(v.x, v.y, v.z) for v in corners])))
    return mins, maxs


def hierarchy_signature(objects):
    """Huella de la jerarquía interna de la fuente, para demostrar 〔R2〕.

    `IMPORT_ROOT` se omite a propósito: es el único contenedor que la normalización SÍ mueve.
    Padres, matrices locales, huesos y vértices deben quedar idénticos: una normalización que
    reescala vértices en vez de contenedor rompería skinning y root motion sin dejar rastro.
    """
    # `matrix_local` se recalcula perezosamente: sin actualizar la depsgraph la huella sería stale.
    bpy.context.view_layer.update()
    signature = []
    for obj in sorted(objects, key=lambda item: item.name):
        parent = obj.parent
        if parent is not None and parent.name == "IMPORT_ROOT":
            parent = None
        vertices = (
            round(sum(v.co.x + v.co.y + v.co.z for v in obj.data.vertices), 4)
            if obj.type == "MESH"
            else 0.0
        )
        bones = (
            round(sum(b.head.x + b.head.y + b.head.z for b in obj.data.bones), 4)
            if obj.type == "ARMATURE"
            else 0
        )
        signature.append(
            (
                obj.name,
                obj.type,
                parent.name if parent is not None else None,
                tuple(round(value, 6) for row in obj.matrix_local for value in row),
                len(obj.data.vertices) if obj.type == "MESH" else 0,
                vertices,
                len(obj.data.bones) if obj.type == "ARMATURE" else 0,
                bones,
            )
        )
    return signature


def armature_report(objects):
    """Lo que una normalización sobre los vértices habría roto: huesos y meshes skinneados."""
    return {
        "armatures": [
            {"name": obj.name, "bones": len(obj.data.bones)}
            for obj in objects
            if obj.type == "ARMATURE"
        ],
        "skinnedMeshes": sum(
            1
            for obj in objects
            if obj.type == "MESH"
            and any(mod.type == "ARMATURE" and mod.object for mod in obj.modifiers)
        ),
    }


def assert_hierarchy_preserved(objects, before):
    after = hierarchy_signature(objects)
    if len(after) != len(before):
        raise SourceImportError(
            f"la normalización cambió el número de objetos: {len(before)} -> {len(after)}"
        )
    changed = [a[0] for a, b in zip(after, before) if a != b]
    if changed:
        raise SourceImportError(
            "la normalización tocó la jerarquía importada (〔R2〕): " + ", ".join(changed[:5])
        )


def normalize_import_root(objects, unit_scale=1.0):
    """Escala y asienta la jerarquía importada sin tocar sus objetos.

    Crea un empty `IMPORT_ROOT`, re-parenta los objetos sin padre sobre él
    (conservando su transformación mundial) y ajusta únicamente `scale` y
    `location` del empty hasta que el asset mide en metros de Landlord y su
    suelo queda en Z=0 centrado en XY.

    Devuelve la metadata de auditoría: dimensiones originales, escala aplicada y
    offset final.
    """
    if unit_scale <= 0:
        raise SourceImportError(f"unitScale debe ser > 0, recibido {unit_scale}")

    before = hierarchy_signature(objects)
    roots = [obj for obj in objects if obj.parent is None]
    import_root = bpy.data.objects.new("IMPORT_ROOT", None)
    bpy.context.collection.objects.link(import_root)
    for obj in roots:
        obj.parent = import_root
        obj.matrix_parent_inverse = import_root.matrix_world.inverted()

    mins, maxs = world_bounds(objects)
    source_size = maxs - mins
    source_bounds = {
        "width": round(source_size.x, 4),
        "depth": round(source_size.y, 4),
        "height": round(source_size.z, 4),
        "minZ": round(mins.z, 4),
    }

    import_root.scale = (unit_scale,) * 3
    bpy.context.view_layer.update()

    mins, maxs = world_bounds(objects)
    import_root.location = (
        -(mins.x + maxs.x) / 2,
        -(mins.y + maxs.y) / 2,
        -mins.z,
    )
    bpy.context.view_layer.update()

    mins, maxs = world_bounds(objects)
    assert_hierarchy_preserved(objects, before)
    return {
        "sourceBounds": source_bounds,
        "importScale": unit_scale,
        "importOffset": [round(v, 4) for v in import_root.location],
        "hierarchy": armature_report(objects),
        "normalizedSize": {
            "width": round(maxs.x - mins.x, 4),
            "depth": round(maxs.y - mins.y, 4),
            "height": round(maxs.z - mins.z, 4),
        },
    }

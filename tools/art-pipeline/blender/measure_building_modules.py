"""Medición headless de los módulos seleccionados para el catálogo de V.f.1.

El inventario de V.f.0 mide el ARCHIVO completo y su pivote (objeto dominante). Un módulo puede
seleccionar sólo parte de los meshes de un archivo (aerogenerador: torre + palas), y el compositor
apoya módulos por el origen de SU propia geometría, no por el del archivo. Por eso esta pasada
mide, por módulo, `moduleBounds` y `anchorTransform` sobre la selección real (§9).

Además de geometría mide MATERIAL: los nodos y valores efectivos de cada material y las
estadísticas de color de cada textura (`imageSamples`). El perfil de estilo (§10) y el remap
compartido (§11) no pueden inventar rugosidades ni saturaciones, y en estos packs la rugosidad real
vive en el canal G de un mapa ORM, no en un factor del material.

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
# Un swatch por debajo de este share en un atlas es ruido de compresión o un borde de texel: no es
# una familia de material, así que no se reporta.
MIN_BUCKET_SHARE = 0.02


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


def circular_mean_degrees(values):
    """Media de tonos sin el artefacto del envoltorio 0/360.

    Un bucket cálido con texeles a 350° y a 10° promedia 180° con la media aritmética: un cian que no
    existe en la textura y que el tratamiento de color reclamaría con la banda equivocada. El perfil
    de estilo (§10) se construye sobre estos números, así que se promedian en coordenadas polares.
    """
    import numpy as np

    radians = np.deg2rad(np.asarray(values, dtype=np.float32))
    mean = np.degrees(np.arctan2(np.sin(radians).mean(), np.cos(radians).mean())) % 360.0
    return round(float(mean), 1)


def image_samples(image, budget=20000):
    """Media HSV y reparto de tonos de una textura REAL, muestreada con stride uniforme.

    El perfil de estilo (§10) no puede inventar saturaciones: hay que mirar los atlas de los packs.
    Se muestrea un subconjunto, no todos los píxeles, porque sólo interesa la distribución de color.
    `np.array(image.pixels)` hace una única copia masiva en C: indexar el buffer de Blender elemento
    a elemento tarda minutos por atlas (medido en el primer intento: 10 min sin terminar).
    """
    import numpy as np

    width, height = image.size
    if width * height == 0:
        return None
    pixels = np.array(image.pixels, dtype=np.float32).reshape(-1, 4)
    step = max(1, len(pixels) // budget)
    sampled = pixels[::step]
    rgb = sampled[:, :3]
    maxc = rgb.max(axis=1)
    minc = rgb.min(axis=1)
    delta = maxc - minc
    value = maxc
    saturation = np.where(maxc > 0, delta / np.maximum(maxc, 1e-6), 0.0)

    degrees = np.zeros(len(rgb), dtype=np.float32)
    red, green, blue = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    nonzero = delta > 1e-6
    band = nonzero & (maxc == red)
    degrees[band] = ((green[band] - blue[band]) / delta[band]) % 6.0
    band = nonzero & (maxc == green) & (maxc != red)
    degrees[band] = (blue[band] - red[band]) / delta[band] + 2.0
    band = nonzero & (maxc == blue) & (maxc != green) & (maxc != red)
    degrees[band] = (red[band] - green[band]) / delta[band] + 4.0
    degrees = degrees * 60.0

    grey = (saturation < 0.12) | (value < 0.06) | (value > 0.97)
    buckets = {
        "grey": grey,
        "red": ~grey & ((degrees < 11) | (degrees >= 338)),
        "orange": ~grey & (degrees >= 11) & (degrees < 36),
        "yellow": ~grey & (degrees >= 36) & (degrees < 61),
        "green": ~grey & (degrees >= 61) & (degrees < 144),
        "cyan": ~grey & (degrees >= 144) & (degrees < 198),
        "blue": ~grey & (degrees >= 198) & (degrees < 259),
        "magenta": ~grey & (degrees >= 259) & (degrees < 338),
    }
    counted = int(len(rgb))
    if not counted:
        return None
    share = {name: round(float(mask.sum()) / counted, 3) for name, mask in buckets.items()}
    dominant = max(share, key=lambda name: (share[name], -len(name)))
    # Medias POR bucket, no sólo la media de la textura: en un atlas compartido (Kenney `colormap`,
    # KayKit `citybits_texture`) la media global es un marrón que no existe en ningún texel. El
    # swatch del cristal y el del tejado viven en el mismo archivo, y §11 exige que sigan siendo
    # distinguibles, así que cada familia se evalúa sobre su propia familia de texeles.
    bucket_stats = []
    for name, mask in buckets.items():
        count = int(mask.sum())
        if count == 0 or share[name] < MIN_BUCKET_SHARE:
            continue
        bucket_stats.append(
            {
                "hue": name,
                "share": share[name],
                "pixels": count,
                "meanHueDegrees": None if name == "grey" else circular_mean_degrees(degrees[mask]),
                "meanSaturation": round(float(saturation[mask].mean()), 3),
                "meanValue": round(float(value[mask].mean()), 3),
            }
        )
    bucket_stats.sort(key=lambda record: -record["share"])
    return {
        "name": image.name,
        "size": [width, height],
        "colorspace": image.colorspace_settings.name,
        "samples": counted,
        "meanSaturation": round(float(saturation.mean()), 3),
        "meanValue": round(float(value.mean()), 3),
        "meanAlpha": round(float(sampled[:, 3].mean()), 3),
        # En los mapas ORM de glTF los canales NO son color: R=oxclusión ambiental, G=rugosidad,
        # B=metallic. Sus medias son la rugosidad y el metallic reales del material, y son
        # Non-Color, así que nadie los miraría por HSV. §10 pide estos dos números medidos.
        "channelMeans": {
            "r": round(float(rgb[:, 0].mean()), 3),
            "g": round(float(rgb[:, 1].mean()), 3),
            "b": round(float(rgb[:, 2].mean()), 3),
        },
        "hueShare": share,
        "dominantHue": dominant,
        "hueBuckets": bucket_stats,
    }


IMAGE_CACHE = {}


def image_key(image):
    """Identidad de la textura: el ARCHIVO, no el nombre del datablock.

    Cada archivo licenciado se importa en una escena limpia (`measure_file` purga antes), así que los
    tres `colormap.png` de Kenney — comercial, industrial y suburbano, PNG distintos— llegan todos con
    el nombre `colormap`. Agrupar por nombre atribuiría el color de uno solo a los tres packs, y §10
    pide que la saturación y el valor estén justificados sobre la fuente real.
    """
    resolved = bpy.path.abspath(image.filepath)
    if not resolved:
        return f"datablock:{image.name}"
    path = Path(resolved)
    # Se registra relativa a la raíz del repo: el artefacto se commitea y `--check` lo compara byte a
    # byte, así que una ruta absoluta con el home del operador lo haría irreproducible en otra máquina.
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.resolve().as_posix()


def image_report(image):
    key = image_key(image)
    if key not in IMAGE_CACHE:
        # Se muestrean TODAS las texturas, también las Non-Color: en un mapa ORM el HSV no vale nada,
        # pero la media de sus canales ES la rugosidad y el metallic medidos del material.
        IMAGE_CACHE[key] = {
            "name": image.name,
            "filePath": key,
            "size": list(image.size),
            "colorspace": image.colorspace_settings.name,
            "hueMeaningful": image.colorspace_settings.name.startswith("sRGB"),
            "statistics": image_samples(image),
        }
    return IMAGE_CACHE[key]


def material_report(material):
    """Propiedades numéricas reales del material: nada de suponer rugosidades.

    Los packs vienen mezcleados: MegaKit usa factores de Base Color y mapas ORM, Kenney y KayKit un
    único atlas difuso con Principled sin conectar. El remap de §11 necesita saber qué hay en cada
    caso para no aplanar todos los materiales contra el mismo valor.
    """
    report = {
        "name": material.name,
        "blendMethod": material.blend_method,
        "nodes": sorted({node.type for node in material.node_tree.nodes}) if material.node_tree else [],
        "images": [],
    }
    if not material.node_tree:
        report["surface"] = None
        return report
    principled = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    surface = {}
    for socket_name in ("Base Color", "Roughness", "Metallic", "Specular IOR Level"):
        if principled is None:
            break
        socket = principled.inputs.get(socket_name)
        if socket is None:
            continue
        if socket.is_linked:
            from_node = socket.links[0].from_node
            image = getattr(from_node, "image", None)
            surface[socket_name] = {
                "linked": from_node.type,
                "image": image.name if image is not None else None,
                "imageFile": image_key(image) if image is not None else None,
            }
        else:
            # Base Color es un vector; Roughness y Metallic son escalares.
            value = socket.default_value
            if isinstance(value, (int, float)):
                surface[socket_name] = {"value": round(float(value), 4)}
            else:
                surface[socket_name] = {"value": [round(component, 4) for component in value]}
    report["surface"] = surface
    seen = set()
    for node in material.node_tree.nodes:
        image = getattr(node, "image", None)
        if image is not None and image_key(image) not in seen:
            seen.add(image_key(image))
            report["images"].append({"name": image.name, "filePath": image_key(image)})
    report["images"].sort(key=lambda entry: entry["filePath"])
    return report


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
    reports = []
    for obj in meshes:
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name in materials:
                continue
            materials.append(material.name)
            reports.append(material_report(material))
        shells += shell_count(obj.data)
        vertices += len(obj.data.vertices)
        triangles += triangle_count(obj.data)
    for report in reports:
        images.extend(entry["filePath"] for entry in report["images"])
        for entry in report["images"]:
            # Se muestrea aquí, con el datablock todavía vivo: tras purge_scene() no habría imagen.
            # `bpy.data.images.get(nombre)` no sirve: el mismo nombre pertenece a archivos distintos
            # en packs distintos, y la identidad que se informa es la ruta del archivo.
            image = next(
                (
                    candidate
                    for candidate in bpy.data.images
                    if image_key(candidate) == entry["filePath"]
                ),
                None,
            )
            if image is not None:
                image_report(image)

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
        "materialReport": reports,
        "measured": {
            "meshObjects": len(meshes),
            "vertices": vertices,
            "triangles": triangles,
            "shells": shells,
            "materials": sorted(materials),
            "images": sorted(set(images)),
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
                "imageSamples": [IMAGE_CACHE[key] for key in sorted(IMAGE_CACHE)],
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

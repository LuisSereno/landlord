"""Ensamblado del compositor en Blender: una composición decidida en Python se vuelve sprite.

`compose.py` decide QUÉ se coloca y DÓNDE; este módulo traduce esa lista en geometría licenciada
importada, la pasa por el estilo canónico y renderiza. La separación es deliberada (§12–§18): un
candidato se puede auditar, comparar y testear sin arrancar Blender, y el render no añade ninguna
decisión de diseño — recalcula la composición a partir del request, así que lo que sale en la imagen
es literalmente lo que firma §14.

Dos cosas viven aquí, y no en `runtime_asset.py`, porque §26 prohíbe tocar la pipeline embarcada:

- **Alcance profundo de §11.** El MegaKit enlaza su atlas a `Base Color` a través de un MULTIPLY con el
  color de vértice (medido en la fuente real: `Mix.blend_type=MULTIPLY`, factor 1, A=TEX_IMAGE,
  B=VERTEX_COLOR), y `apply_external_treatment` sólo mira el primer salto del socket
  (`runtime_asset.py:620-622`). Sin este paso la fachada Quaternius entraría en su albedo de origen
  junto a muros Kenney ya tratados: dos temperaturas de brillo en el mismo alzado, que es justo lo que
  §11 prohíbe. Se reutiliza `_styled_image`, no una segunda matemática de paleta (§10).
- **Verificación de anclaje, huella y encuadre.** El marco de colocación declarado de cada módulo se
  contrasta con lo que Blender obtiene al importar, la caja de cada colocación con la que compuso la
  gramática, y el pivot proyectado con la parcela que ocupa: un módulo inexistente, mal seleccionado,
  mal girado o recortado rompe el render en vez de dibujar un edificio falso (§7/§17/§18).

Marco: origen en el centro de la huella a nivel de suelo, frente hacia -Y, giros de 0/90/180/270° y
módulos sin escalar (los metros los fija el `unitScale` medido de la fuente).
"""

import hashlib
import json
import math
import resource
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
BLENDER_DIR = HERE.parent
if str(BLENDER_DIR) not in sys.path:
    sys.path.insert(0, str(BLENDER_DIR))

import runtime_asset as runtime  # noqa: E402
from source_import import (  # noqa: E402
    assert_textures_resolved,
    fix_texture_paths,
    import_source,
    normalize_import_root,
    world_bounds,
)

from .compose import compose_candidate  # noqa: E402
from .grammar import GrammarDocument  # noqa: E402
from .module_catalog import Catalog, REPO_ROOT  # noqa: E402
from .style_profile import StyleProfile  # noqa: E402
from . import anchors  # noqa: E402

COMPOSITION_ROOT = "COMPOSITION_ROOT"  # `nodeSelector.reparentTo`, medido en el catálogo
STYLED_PREFIX = "styled_"
# El bound_box evaluado y el redondeo a milímetros de las transformadas no coinciden al metro exacto;
# 2 cm es la desviación máxima observada entre la caja medida en V.f.1 y la caja instanciada aquí.
PLACEMENT_TOLERANCE_M = 0.02
# §15: los soportes originales usan la paleta baseline del proyecto (`PALETTE` de runtime_asset.py),
# no un color inventado en el compositor, y después pasan por el mismo remapeo que el resto.
SUPPORT_PALETTE = {
    "base": "ground",
    "plinth": "ground",
    "connector": "metal",
    "pipe": "metal",
    "support": "metal",
}


class SceneError(RuntimeError):
    pass


def reset_scene():
    """Vacía la escena entre candidatos sin descartar las imágenes ya tratadas.

    Remapear un atlas de 2048² cuesta ~4,3 s y ~250 MB de temporales (medido en esta herramienta);
    los candidatos de una familia comparten atlas, así que se conservan las imágenes y sólo se tiran
    objetos, mallas y materiales. Reimportar un archivo cuyo datablock sigue vivo lo reutiliza, y la
    copia `styled_*` se recupera por nombre: ningún atlas se remapea dos veces.
    """
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def base_color_images(material):
    """Nodos de textura que alimentan `Base Color`, a cualquier profundidad del grafo.

    Sólo devuelve mapas de color: una normal o un ORM alcanzable por accidente no debe recolorirse
    nunca (la propia pipeline lo dice: rugosidad y normales llegan intactas de la fuente).
    """
    tree = getattr(material, "node_tree", None)
    if tree is None:
        return []
    bsdf = next((node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return []
    socket = bsdf.inputs.get("Base Color")
    if socket is None:
        return []
    found = []
    pending = list(socket.links)
    seen = set()
    while pending:
        node = pending.pop().from_node
        if node.name in seen:
            continue
        seen.add(node.name)
        if node.type == "TEX_IMAGE":
            if node.image is not None and node.image.colorspace_settings.name == "sRGB":
                found.append(node)
            continue
        for input_socket in node.inputs:
            pending.extend(input_socket.links)
    return found


def flat_rule_matches(name, treatment):
    """Si `apply_external_treatment` ya trata este material plano por nombre.

    Divide el trabajo con la pipeline embarcada sin solapar: un material que casa con una regla
    `flatMaterials` ya quedó tratado en el paso canónico, y volver a pasarle la escalera lo
    oscurecería dos veces. §11 no admite dos temperaturas de brillo, pero tampoco dos tratamientos.
    """
    return any(
        runtime.name_matches(name, rule["match"]) for rule in treatment.get("flatMaterials", [])
    )


def complete_style_reach(objects, treatment, kind):
    """§11: sube a la escalera de tratamiento lo que el remapeo estándar no alcanza.

    Dos huecos reales se arreglan aquí, medidos sobre las fuentes del catálogo:

    - **Atlas a más de un salto.** El MegaKit enlaza su BaseColor por un MULTIPLY con vertex color,
      así que `apply_external_treatment` (que mira un sólo salto) deja el albedo de origen en escena.
      Se re-enlaza una copia ya pasada por `_styled_image`: la matemática de paleta sigue siendo una
      (§10), no una segunda escalera local.
    - **Colores planos sin regla de nombre.** Los materiales mate de KayKit vienen con `Base Color`
      descableado y su nombre no casa con ninguna regla `flatMaterials`, así que tampoco los trata
      nadie. Aquí pasan por `style_pixels`, la misma función que usa la ruta procedural.

    El tercer caso no se arregla, se nombra: `MI_Glass`/`MI_FakeInterior` enlazan `Base Color` a un MIX
    del que no sale ninguna textura sRGB (medido: `enlazado:MIX`), así que su color no es un albedo que
    podamos subir a la escalera, sino emisión y rugosidad. Se publican en `linkedWithoutColorSource`
    para que el hueco sea visible en la metadata en vez de un `untreated` en cero que el portal leería
    como «todo tratado».

    Un atlas con texeles de ventana alcanzaría su emisión dentro de `apply_external_treatment`; si
    sólo llega a través del MULTIPLY de vertex color no llega. Por eso aquí se aborta en vez de
    dibujar ventanas apagadas junto a ventanas encendidas: medido sobre las fuentes del catálogo, los
    BaseColor del MegaKit dan 0 texeles de ventana, así que el hueco es deuda documentada y no un
    sorpasso silencioso.
    """
    restyled = {}
    deep = []
    flat = []
    no_albedo = []
    names = sorted(
        {
            slot.material.name
            for obj in objects
            if obj.type == "MESH"
            for slot in obj.material_slots
            if slot.material
        }
    )
    for name in names:
        material = bpy.data.materials[name]
        nodes = base_color_images(material)
        if not nodes:
            bsdf = next(
                (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None
            )
            if bsdf is None:
                continue
            if bsdf.inputs["Base Color"].is_linked:
                no_albedo.append(name)
                continue
            if flat_rule_matches(name, treatment):
                continue  # ya lo trató el paso canónico por nombre
            linear = np.array(bsdf.inputs["Base Color"].default_value[:3], dtype=np.float32)
            source = np.clip(runtime.linear_to_srgb(linear), 0, 1).reshape(1, 1, 3)
            styled = runtime.style_pixels(source[:, :, :3], treatment, kind)["styled_rgb"][0, 0]
            bsdf.inputs["Base Color"].default_value = (
                *np.clip(runtime.srgb_to_linear(styled), 0.0, 1.0),
                1.0,
            )
            flat.append(name)
            continue
        for node in nodes:
            image = node.image
            if image.name.startswith(STYLED_PREFIX):
                continue  # ya pasó por el salto directo de `apply_external_treatment`
            if image.name not in restyled:
                existing = bpy.data.images.get(f"{STYLED_PREFIX}{image.name}")
                if existing is not None:
                    restyled[image.name] = existing
                else:
                    styled, _emissive, texels, _mask = runtime._styled_image(image, treatment, kind)
                    if texels:
                        raise SceneError(
                            f"§11: {image.name} alimenta Base Color a más de un salto y tiene {texels} "
                            "texeles de ventana: su emisión habría que cablear aquí y no está implementado"
                        )
                    restyled[image.name] = styled
            node.image = restyled[image.name]
            deep.append(f"{name}←{image.name}")
    return {
        "deepStyledNodes": len(deep),
        "deepStyledAtlases": sorted(restyled),
        "flatStyledMaterials": sorted(flat),
        "linkedWithoutColorSource": sorted(no_albedo),
        "detail": sorted(set(deep)),
    }


def bake_import_root(objects):
    """Despega el andamio de `normalize_import_root` horneando su transformada mundial.

    Dos razones, y ninguna toca la pipeline embarcada:

    - `hierarchy_signature` ignora un padre llamado exactamente `IMPORT_ROOT`; si quedara vivo, la
      segunda fuente del mismo proceso crearía `IMPORT_ROOT.001` y 〔R2〕 saltaría por un nombre, no
      por geometría. Un compositor coloca decenas de módulos, así que el andamio tiene que ser de un
      solo uso.
    - El compositor hornea `matrix_world` por instancia: el contenedor ya no aporta nada.

    Despegar con `matrix_basis = matrix_world` conserva la pose mundial al milímetro y deja la
    jerarquía interna de la fuente como está: sólo se sueltan los objetos que el andamio adoptó.
    """
    scaffold = next(
        (obj for obj in bpy.data.objects if obj.name == "IMPORT_ROOT" and obj.parent is None), None
    )
    if scaffold is None:
        return
    for obj in [item for item in objects if item.parent == scaffold]:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = world
    bpy.context.view_layer.update()
    bpy.data.objects.remove(scaffold, do_unlink=True)
    bpy.context.view_layer.update()


def import_module_source(module, cache):
    """Importa y normaliza la fuente de un módulo una sola vez por corrida (§12)."""
    path = Path(module.source_path)
    if not path.is_absolute():
        path = REPO_ROOT / path
    cached = cache.get(str(path))
    if cached is not None:
        return cached
    objects = import_source(str(path))
    if path.suffix.lower() == ".fbx":
        fix_texture_paths(path)
    assert_textures_resolved(objects, path)
    armatures = [obj.name for obj in objects if obj.type == "ARMATURE"]
    if armatures:
        raise SceneError(
            f"§7: {module.source_id} trae armadura {armatures}: los edificios del catálogo no están "
            "rigueados, importar uno rigueado significa que la selección declarada no es la geometría"
        )
    normalization = normalize_import_root(objects, module.unit_scale)
    bake_import_root(objects)
    cache[str(path)] = (objects, normalization)
    return cache[str(path)]


def selected_meshes(objects, names, module_id):
    picked = [obj for obj in objects if obj.name in set(names) and obj.type == "MESH"]
    missing = sorted(set(names) - {obj.name for obj in picked})
    if missing:
        raise SceneError(
            f"§7: {module_id} selecciona meshes que la fuente no importa: {', '.join(missing)}"
        )
    return picked


def check_imported_frame(module, picked):
    """§32 (anchors / source object existence): el marco declarado es el que Blender da al importar.

    Se mide antes de colocar nada: si el catálogo dijera que el módulo mide 2 m de ancho y la fuente
    real mide 2,05, aquí se rompe, y la composición no se construye sobre un anclaje soñado.
    """
    vertices = sum(len(obj.data.vertices) for obj in picked)
    triangles = sum(len(p.vertices) - 2 for obj in picked for p in obj.data.polygons)
    if vertices != module.vertices or triangles != module.triangles:
        raise SceneError(
            f"§7: {module.id} importa {vertices} vértices / {triangles} triángulos y el catálogo "
            f"declara {module.vertices} / {module.triangles}"
        )
    mins, maxs = world_bounds(picked)
    declared = module.placement_bounds
    for index, axis in enumerate(("x", "y", "z")):
        for value, edge in ((mins[index], "min"), (maxs[index], "max")):
            limit = declared[axis][edge]
            if abs(value - limit) > PLACEMENT_TOLERANCE_M:
                raise SceneError(
                    f"§7: {module.id} tiene marco de colocación {axis}.{edge}={value:.3f} y el catálogo "
                    f"declara {limit:.3f}"
                )


def place_modules(composition, catalog, root):
    """Instancia cada colocación como objeto nuevo que comparte la malla importada.

    Compartir `obj.data` en vez de duplicar la malla es lo que hace barata la escena y lo que prueba
    que no se alteró la fuente: la transformada vive en el empty de la colocación, y los vértices
    quedan intactos (〔R2〕, y se comprueba abajo con la huella de la malla).
    """
    cache = {}
    groups = []
    for record in sort_placements(composition["placements"]):
        module = catalog.get(record["moduleId"])
        objects, normalization = import_module_source(module, cache)
        picked = selected_meshes(objects, module.meshes, module.id)
        check_imported_frame(module, picked)
        empty = bpy.data.objects.new(f"place:{record['purpose']}:{module.id}", None)
        bpy.context.collection.objects.link(empty)
        empty.parent = root
        empty.location = record["position"]
        empty.rotation_euler = (0.0, 0.0, math.radians(record["rotationDegrees"]))
        children = []
        for source in picked:
            instance = bpy.data.objects.new(f"{source.name}|{record['purpose']}", source.data)
            bpy.context.collection.objects.link(instance)
            instance.parent = empty
            instance.matrix_parent_inverse = Matrix.Identity(4)
            instance.matrix_basis = source.matrix_world.copy()
            children.append(instance)
        groups.append((record, module, children, normalization))
    bpy.context.view_layer.update()
    for objects, _normalization in cache.values():
        for obj in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    return groups, cache


def sort_placements(placements):
    """Orden canónico de instanciación: el mismo request crea los mismos datablocks en el mismo orden."""
    return sorted(placements, key=lambda record: (record["purpose"], record["moduleId"]))


def check_placements(composition, groups):
    """§32 (bounds): la caja que la composición firmó es la que ocupa la geometría en escena."""
    errors = []
    for (record, module, children, _n), placement in zip(
        groups, sort_placements(composition["placements"])
    ):
        mins, maxs = world_bounds(children)
        for index, axis in enumerate(("x", "y", "z")):
            for value, edge in ((mins[index], "min"), (maxs[index], "max")):
                limit = placement["bounds"][axis][edge]
                if abs(value - limit) > PLACEMENT_TOLERANCE_M:
                    errors.append(
                        f"{module.id} ({record['purpose']}): {axis}.{edge} medido {value:.3f} ≠ "
                        f"compuesto {limit:.3f}"
                    )
    if errors:
        raise SceneError("la escena no reproduce la composición firmada:\n  " + "\n  ".join(errors[:12]))


def check_ground_contact(groups, composition):
    """§17/§18: lo que apoya, apoya en Z=0 dentro de la holgura declarada, y nada flota bajo la acera."""
    tolerance = float(composition["checks"]["groundToleranceMeters"])
    resting = [children for record, _m, children, _n in groups if record["bounds"]["z"]["min"] < tolerance]
    if not resting:
        raise SceneError("§18: ningún módulo apoya en el suelo: el sprite flotaría sobre la parcela")
    lowest = min(world_bounds(children)[0][2] for children in resting)
    if abs(lowest) > tolerance:
        raise SceneError(
            f"§18: el contacto con el suelo está a {lowest:.3f} m (holgura {tolerance} m)"
        )
    return {"restingModules": len(resting), "lowestZMeters": round(lowest, 4)}


def mesh_fingerprint(objects):
    """Huella de la geometría: demuestra que normalizar, instanciar y tratar no tocaron un vértice."""
    bpy.context.view_layer.update()
    return sorted(
        (
            obj.data.name,
            len(obj.data.vertices),
            round(sum(v.co.x + v.co.y + v.co.z for v in obj.data.vertices), 4),
        )
        for obj in objects
        if obj.type == "MESH"
    )


def support_materials(profile):
    """Materiales de los soportes §15: paleta baseline del proyecto, sin tratar todavía.

    Se crean crudos y los trata `complete_style_reach` por la rama de color plano, con la misma
    `style_pixels` que la ruta procedural: `PALETTE` es la escalera de día del spike de dirección
    visual y publicarla sin tratamiento dejaría un conector más brillante que las fachadas ya
    bajadas, que es exactamente la inversión de jerarquía que su docstring denuncia.
    """
    roughness = float(profile.value("materialRoughness")["canonicalOverride"])
    metallic = float(profile.value("materialMetallic")["canonicalOverride"])
    return {
        family: runtime.material(
            f"mat_composer_{family}",
            runtime.PALETTE[family],
            metallic=metallic,
            roughness=roughness,
        )
        for family in sorted(set(SUPPORT_PALETTE.values()))
    }


def add_supports(composition, materials, root):
    """Primitivas originales de §15: conector, conducto, zócalo o apoyo — nunca masa visible."""
    created = []
    for index, support in enumerate(composition["originalSupport"]):
        label = f"support:{support['purpose']}:{index}"
        mat = materials[SUPPORT_PALETTE[support["kind"]]]
        if support["shape"] == "pipe":
            direction = Vector(support["end"]) - Vector(support["start"])
            created.append(
                runtime.cylinder(
                    label,
                    support["origin"],
                    support["radiusMeters"],
                    direction.length,
                    mat,
                    vertices=support["segments"],
                    rotation=direction.to_track_quat("Z", "Y").to_euler(),
                )
            )
        elif support["shape"] == "box":
            size = support["sizeMeters"]
            center = (
                support["position"][0],
                support["position"][1],
                support["position"][2] + size[2] / 2.0,
            )
            created.append(
                runtime.cube(
                    label,
                    center,
                    size,
                    mat,
                    rotation=(0.0, 0.0, math.radians(support["rotationZDegrees"])),
                )
            )
        else:
            raise SceneError(f"§15: forma de soporte no construida {support['shape']}")
    for obj in created:
        obj.parent = root
        obj.matrix_parent_inverse = root.matrix_world.inverted()
    return created


def check_scene_geometry(composition, objects):
    """§15/§31: los triángulos y la envolvente que ve el render son los que declaró la gramática."""
    triangles = sum(
        len(p.vertices) - 2 for obj in objects if obj.type == "MESH" for p in obj.data.polygons
    )
    declared = composition["metrics"]["triangles"]
    if triangles != declared:
        raise SceneError(
            f"§15: la escena tiene {triangles} triángulos y la composición declaró {declared}"
        )
    mins, maxs = world_bounds(objects)
    box = composition["bounds"]
    for index, axis in enumerate(("x", "y", "z")):
        for value, edge in ((mins[index], "min"), (maxs[index], "max")):
            if abs(value - box[axis][edge]) > PLACEMENT_TOLERANCE_M:
                raise SceneError(
                    f"§17: envolvente {axis}.{edge} {value:.3f} ≠ compuesta {box[axis][edge]:.3f}"
                )
    return {
        "triangles": triangles,
        "meshObjects": len([obj for obj in objects if obj.type == "MESH"]),
        "worldSizeMeters": {
            axis: round(maxs[index] - mins[index], 4)
            for index, axis in enumerate(("x", "y", "z"))
        },
    }


def box_corners(box):
    """Las ocho esquinas de una caja del marco del compositor."""
    return [
        Vector((x, y, z))
        for x in (box["x"]["min"], box["x"]["max"])
        for y in (box["y"]["min"], box["y"]["max"])
        for z in (box["z"]["min"], box["z"]["max"])
    ]


def projected_extents(camera, box):
    """Metros de imagen que ocupa la caja, medidos en el espacio de la cámara ortográfica.

    El perfil deriva su encuadre de una fórmula de isométrica canónica; medir las esquinas reales es
    más honesto con las masas no ortogonales (aleros, cornisas, torres) y no cambia nada del estilo.
    """
    inverse = camera.matrix_world.inverted()
    points = [inverse @ corner for corner in box_corners(box)]
    return (
        max(point.x for point in points) - min(point.x for point in points),
        max(point.y for point in points) - min(point.y for point in points),
    )


def framing(composition, camera, profile):
    """§10: orthoScale y lienzo derivados del margen y la densidad que el perfil midió."""
    horizontal, vertical = projected_extents(camera, composition["bounds"])
    margin = profile.framing_margin
    width_meters = round(horizontal * margin, 3)
    height_meters = round(vertical * margin, 3)
    ortho_scale = round(max(width_meters, height_meters), 3)
    density = profile.pixels_per_meter
    return {
        "projectedWidthMeters": round(horizontal, 3),
        "projectedHeightMeters": round(vertical, 3),
        "marginUsed": margin,
        "pixelsPerMeter": density,
        "orthoScale": ortho_scale,
        "canvasPixels": [int(round(width_meters * density)), int(round(height_meters * density))],
    }


def to_final_pixels(point, trim):
    """Lleva una proyección normalizada del render completo al espacio [0,1] del sprite final.

    Es la misma cadena que aplica `pivot_from_origin`: píxel del lienzo renderizado → menos el offset
    del recorte → entre el tamaño del recorte. `world_to_camera_view` da V desde el borde inferior del
    lienzo, mientras el pivot publicado se expresa de arriba abajo, y por eso el giro va aquí y no en
    la comparación: quien mida el pivot y quien mide la huella tienen que estar en el mismo lienzo.
    """
    rendered = trim["rendered"]
    cropped = trim["cropped"]
    pixel_x = point[0] * rendered["width"]
    pixel_y = (1.0 - point[1]) * rendered["height"]
    return (
        (pixel_x - cropped["offsetX"]) / cropped["width"],
        (pixel_y - cropped["offsetY"]) / cropped["height"],
    )


def pivot_and_validator(scene, camera, trim, composition):
    """§18: publica el pivot normalizado y valida que sea el suelo de SU parcela, no un recorte.

    `pivot_from_origin` fuerza el valor a [0,1]: si el origen cayera fuera del recorte, publicaría un
    pivot pegado al borde y el edificio apoyaría en la casilla equivocada. Aquí se recalcula el valor
    sin forzar y se exige que esté dentro, que coincida con lo publicado y que caiga dentro de la
    huella proyectada a Z=0.
    """
    published = runtime.pivot_from_origin(scene, camera, trim)
    raw = to_final_pixels(world_to_camera_view(scene, camera, Vector((0.0, 0.0, 0.0))), trim)
    if not (0.0 <= raw[0] <= 1.0 and 0.0 <= raw[1] <= 1.0):
        raise SceneError(f"§18: el origen del solar cae fuera del recorte: {raw}")
    if (round(raw[0], 4), round(raw[1], 4)) != (published["x"], published["y"]):
        raise SceneError(f"§18: pivot publicado {published} ≠ proyectado {raw}")
    footprint = composition["footprintMeters"]
    quad = [
        to_final_pixels(
            world_to_camera_view(scene, camera, Vector((x, y, 0.0))),
            trim,
        )
        for x, y in (
            (-footprint["width"] / 2.0, -footprint["depth"] / 2.0),
            (footprint["width"] / 2.0, -footprint["depth"] / 2.0),
            (footprint["width"] / 2.0, footprint["depth"] / 2.0),
            (-footprint["width"] / 2.0, footprint["depth"] / 2.0),
        )
    ]
    inside = point_in_quad((published["x"], published["y"]), quad)
    if not inside:
        raise SceneError(
            f"§18: el pivot {published} no cae dentro de la huella proyectada "
            f"{[[round(u, 3), round(v, 3)] for u, v in quad]}"
        )
    return published, {
        "rawNormalized": {"x": round(raw[0], 4), "y": round(raw[1], 4)},
        "footprintProjected": [[round(u, 4), round(v, 4)] for u, v in quad],
        "insideFootprint": True,
        "groundZMeters": 0.0,
    }


def point_in_quad(point, quad):
    """Pertenencia a un cuadrilátero convexo: la huella de una parcela ortogonal proyectada."""
    sign = None
    for index in range(4):
        a = quad[index]
        b = quad[(index + 1) % 4]
        cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
        if abs(cross) < 1e-9:
            continue
        current = cross > 0
        if sign is None:
            sign = current
        elif sign != current:
            return False
    return True


def orientation_status(composition, catalog, camera, target):
    """§24: prueba medida de que el edificio mira a la cámara, no de espaldas.

    No se afirma la convención: se recalcula. El lado al que mira cada módulo de acceso sale de su
    `frontAxis` medido en la fuente y del giro que le dio la gramática; el hemisferio visible sale de
    la posición real de la cámara. Si alguien moviera el frente del marco a +Y o girara el rig, este
    registro cambiaría y el render abortaría en vez de dibujar una fachada ciega.
    """
    azimuth = math.degrees(math.atan2(-camera.location.y, camera.location.x))
    horizontal = math.hypot(camera.location.x - target.x, camera.location.y - target.y)
    elevation = math.degrees(math.atan2(camera.location.z - target.z, horizontal))
    if abs(azimuth - runtime.CAMERA_AZIMUTH_DEGREES) > 0.01:
        raise SceneError(f"§18: la cámara está a {azimuth:.2f}°, no en el azimut canónico")
    if abs(elevation - runtime.CAMERA_ELEVATION_DEGREES) > 0.01:
        raise SceneError(f"§18: la cámara está a {elevation:.2f}° de elevación, no en la canónica")
    # Con azimut 45° la cámara mira desde (+X, -Y): se ven el frente (-Y) y el costado derecho (+X).
    visible_sides = {"front", "right"}
    sides = {value: key for key, value in anchors.SIDE_OUTWARD_DEGREES.items()}
    access = []
    for record in sort_placements(composition["placements"]):
        if not record["purpose"].startswith("access:"):
            continue
        module = catalog.get(record["moduleId"])
        local = anchors.MODULE_FRONT_DEGREES.get(module.front_axis)
        if local is None:
            raise SceneError(f"§18: {module.id} trae frontAxis {module.front_axis} sin convención")
        outward = anchors.normalize_angle(record["rotationDegrees"] + local)
        side = sides.get(outward, "oblicuo")
        access.append(
            {
                "purpose": record["purpose"],
                "moduleId": module.id,
                "frontAxis": module.front_axis,
                "rotationDegrees": record["rotationDegrees"],
                "outwardDegrees": outward,
                "side": side,
                "visible": side in visible_sides,
            }
        )
    if not access:
        raise SceneError("§19: la composición no coloca ningún acceso: no hay forma de probar el frente")
    hidden = [item["purpose"] for item in access if not item["visible"]]
    if hidden:
        raise SceneError(
            "§18: la puerta mira a un lado no visible desde la cámara canónica: " + ", ".join(hidden)
        )
    return {
        "cameraAzimuthDegrees": round(azimuth, 2),
        "cameraElevationDegrees": round(elevation, 2),
        "visibleSides": sorted(visible_sides),
        "frontSideOfFrame": "-Y",
        "access": access,
        "allAccessVisible": True,
        "evidence": "frente -Y, azimut 45°: la normal de cada acceso se mide desde frontAxis+giro",
    }


def material_variants(groups, profile, treatment, deep):
    """§24 `materialVariants[]`: qué material entra en escena, por qué cadena medida y si quedó tratado.

    Se publica el camino real de tratamiento, no el que declaró el catálogo: `measuredChain` dice
    cómo venía el grafo de la fuente y `treatmentPath` dice por cuál de las cuatro ramas de §11 pasó.
    `untreatedColorSources` es la cuenta que abre el portal: si un material plano no casó con ninguna
    regla ni lo trató la rama profunda, aquí aparece y el render aborta en vez de publicar dos
    temperaturas de brillo en el mismo alzado.
    """
    flat_done = set(deep["flatStyledMaterials"])
    variants = []
    seen = set()
    for record, module, children, _normalization in groups:
        if module.id in seen:
            continue
        seen.add(module.id)
        for name in sorted(
            {
                slot.material.name
                for obj in children
                for slot in obj.material_slots
                if slot.material
            }
        ):
            material = bpy.data.materials[name]
            nodes = base_color_images(material)
            styled = sorted({node.image.name for node in nodes if node.image.name.startswith(STYLED_PREFIX)})
            bsdf = next(
                (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None
            )
            socket = bsdf.inputs["Base Color"] if bsdf else None
            if socket is None:
                path = "sin-base-color"
            elif not socket.is_linked:
                path = "plano"
            elif socket.links[0].from_node.type == "TEX_IMAGE":
                path = "atlas-directo"
            else:
                path = "atlas-profundo"
            if path == "atlas-profundo" and not nodes:
                path = "sin-albedo-enlazado"
            untreated = len([node for node in nodes if not node.image.name.startswith(STYLED_PREFIX)])
            if path == "plano":
                untreated = 0 if (flat_rule_matches(name, treatment) or name in flat_done) else 1
            variants.append(
                {
                    "moduleId": module.id,
                    "material": name,
                    "family": profile.material_family.get(name),
                    "elevationReach": profile.elevation_reach(module),
                    "measuredChain": sorted(
                        chain.split("=", 1)[1]
                        for chain in module.base_color_chains
                        if chain.split("=", 1)[0] == name
                    ),
                    "treatmentPath": path,
                    "colorSourceFound": bool(nodes) or path == "plano",
                    "styledAtlasesInScene": styled,
                    "untreatedColorSources": untreated,
                }
            )
    return variants


def render_candidate(request, catalog=None, profile=None, document=None, style_layer=None):
    """Un candidato `complete`: request → composición → escena tratada → PNG + metadata (§24/§31)."""
    started = time.perf_counter()
    if str(request.get("state", "complete")) != "complete":
        raise SceneError("§25: en este spike sólo se renderiza el estado `complete`")
    catalog = catalog or Catalog()
    profile = profile or StyleProfile(request["styleProfileId"])
    document = document or GrammarDocument()
    style_layer = style_layer or json.loads(
        (BLENDER_DIR / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    treatment = style_layer["externalTreatment"]
    composition = compose_candidate(request, catalog, profile, document)
    reset_scene()

    root = bpy.data.objects.new(COMPOSITION_ROOT, None)
    bpy.context.collection.objects.link(root)
    groups, imports = place_modules(composition, catalog, root)
    module_objects = [obj for _record, _module, children, _n in groups for obj in children]
    before = mesh_fingerprint(module_objects)
    check_placements(composition, groups)
    ground = check_ground_contact(groups, composition)

    objects = list(module_objects)
    objects += add_supports(composition, support_materials(profile), root)
    scene_geometry = check_scene_geometry(composition, objects)

    # El `ortho_scale` inicial es un asiento: `framing` mide la caja proyectada con la rotación del
    # rig (que no depende de la escala) y lo reescribe con el valor que publica el perfil.
    camera, target = runtime.place_camera(composition["envelopeMeters"]["z"] / 2.0, 40.0)
    bpy.context.view_layer.update()
    frame = framing(composition, camera, profile)
    camera.data.ortho_scale = frame["orthoScale"]
    scene = bpy.context.scene
    scene.camera = camera
    runtime.apply_style_layer_lighting(scene, style_layer)
    direct = runtime.apply_external_treatment(objects, style_layer, "building")
    deep = complete_style_reach(objects, treatment, "building")
    variants = material_variants(groups, profile, treatment, deep)
    unstyled = [variant for variant in variants if variant["untreatedColorSources"]]
    if unstyled:
        raise SceneError(
            "§11: materiales con color de origen sin tratar tras el remapeo profundo: "
            + ", ".join(f"{item['moduleId']}/{item['material']}" for item in unstyled[:6])
        )

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = frame["canvasPixels"][0] * runtime.SUPERSAMPLE
    scene.render.resolution_y = frame["canvasPixels"][1] * runtime.SUPERSAMPLE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    post = style_layer["rendering"]["postProcessing"]
    scene.view_settings.view_transform = post.split(" - ")[0]
    scene.view_settings.look = post
    scene.view_settings.exposure = style_layer["rendering"].get("exposure", 0.0)

    after = mesh_fingerprint(module_objects)
    if after != before:
        raise SceneError("〔R2〕 el ensamblado tocó la geometría de la fuente: " + str(after[:3]))

    output = Path(request["output"]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    render_path = output.with_suffix(".render.png")
    scene.render.filepath = str(render_path)
    prep_ms = round((time.perf_counter() - started) * 1000, 2)
    render_started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    render_ms = round((time.perf_counter() - render_started) * 1000, 2)
    shadow_style = style_layer.get("shadow", {})
    shadow_path = output.with_suffix(".shadow.png")
    shadow = runtime.render_shadow_pass(scene, style_layer, ground["lowestZMeters"], shadow_path)
    trim = runtime.trim_and_scale(render_path, output, shadow_path, shadow_style)
    render_path.unlink(missing_ok=True)
    shadow_path.unlink(missing_ok=True)

    pivot, pivot_check = pivot_and_validator(scene, camera, trim, composition)
    orientation = orientation_status(composition, catalog, camera, target)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    scene_materials = sorted(
        {
            slot.material.name
            for obj in scene.objects
            if obj.type == "MESH"
            for slot in obj.material_slots
            if slot.material
        }
    )
    scene_textures = sorted(
        {
            node.image.name.removeprefix(STYLED_PREFIX)
            for name in scene_materials
            for node in bpy.data.materials[name].node_tree.nodes
            if node.type == "TEX_IMAGE" and node.image
        }
    )
    return {
        "schemaVersion": 1,
        "candidateId": request["candidateId"],
        "buildingType": composition["buildingType"],
        "family": composition["family"],
        "state": "complete",
        "variantSeed": composition["variantSeed"],
        "composerVersion": composition["composerVersion"],
        "styleProfileId": composition["styleProfileId"],
        "compositionSignature": composition["compositionSignature"],
        "axisChoices": composition["axisChoices"],
        "footprintCells": composition["footprintCells"],
        "footprintMeters": composition["footprintMeters"],
        "floors": composition["levels"],
        "bounds": composition["bounds"],
        "envelopeMeters": composition["envelopeMeters"],
        "volumes": composition["volumes"],
        "transforms": composition["placements"],
        "originalSupport": composition["originalSupport"],
        "modules": sorted({record["moduleId"] for record in composition["placements"]}),
        "sourceIds": sorted({record["sourceId"] for record in composition["placements"]}),
        "sourcePaths": sorted({record["sourcePath"] for record in composition["placements"]}),
        "licenses": sorted({record["license"] for record in composition["placements"]}),
        "materialVariants": variants,
        "checks": composition["checks"],
        "sceneChecks": {
            "placementToleranceMeters": PLACEMENT_TOLERANCE_M,
            "groundContact": ground,
            "scene": scene_geometry,
            "sourcesImported": len(imports),
            "pivotValidator": pivot_check,
            "orientation": orientation,
        },
        "pivot": pivot,
        "footprint": composition["footprintCells"],
        "triangleCount": scene_geometry["triangles"],
        "materialCount": len(scene_materials),
        "textureCount": len(scene_textures),
        "renderTime": render_ms,
        "pngBytes": output.stat().st_size,
        "sha256": digest,
        "orientationStatus": orientation,
        "image": {
            "path": str(output),
            "width": trim["final"]["width"],
            "height": trim["final"]["height"],
            "sha256": digest,
            "bytes": output.stat().st_size,
        },
        "trim": trim,
        "metrics": composition["metrics"],
        "framing": frame,
        "style": {
            "layerVersion": treatment.get("version"),
            "directReach": direct,
            "deepReach": {key: value for key, value in deep.items() if key != "detail"},
            "deepReachDetail": deep["detail"],
        },
        "toolchain": {
            "blender": bpy.app.version_string,
            "buildHash": bpy.app.build_hash.decode()
            if isinstance(bpy.app.build_hash, bytes)
            else bpy.app.build_hash,
            "renderer": scene.render.engine,
        },
        "camera": {
            "projection": camera.data.type,
            "azimuthDegrees": runtime.CAMERA_AZIMUTH_DEGREES,
            "elevationDegrees": runtime.CAMERA_ELEVATION_DEGREES,
            "orthoScale": camera.data.ortho_scale,
            "targetZ": round(composition["envelopeMeters"]["z"] / 2.0, 3),
        },
        "shadow": shadow,
        "render": {
            "renderMs": render_ms,
            "prepMs": prep_ms,
            "totalMs": round((time.perf_counter() - started) * 1000, 2),
            "peakRssMb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0, 1),
        },
        "request": request,
        "composition": composition,
    }

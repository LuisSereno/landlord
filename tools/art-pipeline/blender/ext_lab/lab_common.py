"""Utilidades compartidas por los tres laboratorios de extensiones (D-111 §4).

Propósito: medir si una extensión de Blender produce arquitectura MEJOR que el control del
Building Composer, sin ensuciar la configuración global del usuario ni añadir dependencias al
repositorio.

Aislamiento
-----------
Blender 5.2 ya no acepta `--config-dir`; los directorios de usuario se redirigen con variables de
entorno (`blender --help`, sección Environment Variables). Los lanzadores de `README.md` exportan:

  BLENDER_USER_CONFIG     -> /tmp/d111-ext-lab/config/cfg
  BLENDER_USER_EXTENSIONS -> /tmp/d111-ext-lab/config/ext

De ese modo el repositorio de extensiones `User Default` queda fuera del perfil real del usuario y
`--factory-startup` evita además cargar preferencias de addons ya activas. Nada de esto toca el
repo: la instalación escribe sólo en `/tmp`.

Comparabilidad
--------------
Cámara, luz, color management y recorte se toman de los helpers del repo
(`runtime_asset.place_camera`, `runtime_asset.apply_style_layer_lighting`,
`render_settings.apply_render_settings`, `runtime_asset.trim_and_scale`) y del mismo
`style_layer_graphic_civic.json` que usa el control. Los archivos del pipeline no se modifican.
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
TOOLS_DIR = HERE.parent
REPO_ROOT = TOOLS_DIR.parents[2]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

# Los helpers del pipeline se importan tal cual; este módulo no reescribe ninguna de sus reglas.
from render_settings import active_mood, active_mood_id, apply_render_settings  # noqa: E402
from runtime_asset import (  # noqa: E402
    PALETTE,
    apply_style_layer_lighting,
    material,
    place_camera,
    trim_and_scale,
)
from source_import import (  # noqa: E402
    fix_texture_paths,
    import_source,
    normalize_import_root,
    unresolved_textures,
    world_bounds,
)

STYLE_LAYER_PATH = TOOLS_DIR / "style_layer_graphic_civic.json"
# Etiqueta de la línea de comandos que se anota en la evidencia: `sys.argv[0]` dentro de Blender es
# el ejecutable, pero se escribe aquí para que el JSON sea legible sin depender del PATH de quien corre.
BLENDER_LABEL = str(sys.argv[0]) if sys.argv and sys.argv[0].endswith("blender") else "blender"
DEFAULT_MOOD = "material_maquette_day"
DEFAULT_ZIP_DIR = Path("/tmp/d111-ext-lab/dl")
REGISTRY_API = "https://extensions.blender.org/api/v1/extensions/"

# Los tres paquetes se verifican contra el hash sha256 que publica el registro oficial.
# La fuente de verdad es el registro; si cambia la versión, cambia también esta tabla.
EXTENSIONS = {
    "hifi_builder": {
        "zip": "hifi.zip",
        "version": "4.6.7",
        "license": "SPDX:GPL-3.0-or-later",
        "registry_id": "hifi_builder",
        "registry_url": "https://extensions.blender.org/add-ons/hifi-builder/",
        "archive_sha256": "0ad3f685fa736bccf82b9d302dfc97a82ef6490f71f88038889c8e412e67f290",
        "archive_url": "https://extensions.blender.org/download/sha256:0ad3f685fa736bccf82b9d302dfc97a82ef6490f71f88038889c8e412e67f290/add-on-hifi-builder-v4.6.7.zip",
        "maintainer": "Malik Nomi",
        "blender_version_min": "4.2.0",
    },
    "arch_generator": {
        "zip": "archgen.zip",
        "version": "1.0.1",
        "license": "SPDX:GPL-3.0-or-later",
        "registry_id": "arch_generator",
        "registry_url": "https://extensions.blender.org/add-ons/arch-generator/",
        "upstream_url": "https://github.com/Aniruddhyagoswami/arch_generator",
        "archive_sha256": "b0a902ee3c0ff7b5360c3056bc9a084ba8e9d9f94882f68151abffb8df5abb4c",
        "archive_url": "https://extensions.blender.org/download/sha256:b0a902ee3c0ff7b5360c3056bc9a084ba8e9d9f94882f68151abffb8df5abb4c/add-on-arch-generator-v1.0.1.zip",
        "maintainer": "Aniruddhya Goswami",
        "blender_version_min": "5.0.0",
    },
    "archimesh": {
        "zip": "archimesh.zip",
        "version": "1.2.5",
        "license": "SPDX:GPL-2.0-or-later",
        "registry_id": "archimesh",
        "registry_url": "https://extensions.blender.org/add-ons/archimesh/",
        "upstream_url": "https://projects.blender.org/extensions/archimesh",
        "archive_sha256": "44745a86dd472e296e06cd45c511e002a1105512a73009cb0018c87611d18d87",
        "archive_url": "https://extensions.blender.org/download/sha256:44745a86dd472e296e06cd45c511e002a1105512a73009cb0018c87611d18d87/add-on-archimesh-v1.2.5.zip",
        "maintainer": "Community (Antonio Vazquez)",
        "blender_version_min": "4.2.0",
    },
}


class LabError(RuntimeError):
    """Fallo de entorno o de extensión: se registra como evidencia, no se maquilla."""


def install_and_enable(ext_id, *, zip_dir=DEFAULT_ZIP_DIR, force_reinstall=False):
    """Instala el ZIP en el repositorio `user_default` AISLADO y activa el módulo.

    Devuelve el nombre de módulo registrable (`bl_ext.user_default.<id>`). Es idempotente: si el
    paquete ya está en el disco aislado y la suma coincide, sólo lo activa.
    """
    meta = EXTENSIONS[ext_id]
    zip_path = Path(zip_dir) / meta["zip"]
    if not zip_path.exists():
        raise LabError(
            f"no existe el archivo descargado {zip_path}. Descárgalo del registro oficial con la "
            f"URL documentada en EXTENSIONS['{ext_id}'] y verifica su sha256."
        )
    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if digest != meta["archive_sha256"]:
        raise LabError(
            f"sha256 de {zip_path.name} no coincide con el registro oficial: {digest} != "
            f"{meta['archive_sha256']}"
        )
    module = f"bl_ext.user_default.{ext_id}"
    import addon_utils

    enabled = addon_utils.enable(module, default_set=False)
    if enabled is None or force_reinstall:
        result = bpy.ops.extensions.package_install_files(
            filepath=str(zip_path), repo="user_default", enable_on_install=True, overwrite=True
        )
        if result != {"FINISHED"}:
            raise LabError(f"package_install_files devolvió {result} para {zip_path.name}")
        enabled = addon_utils.enable(module, default_set=False)
    if enabled is None:
        raise LabError(f"el módulo {module} no quedó activo tras la instalación")
    return module


def load_style_layer(mood=None):
    """Estilo canónico del repo con el mood fijado por variable de entorno (D-108)."""
    os.environ["LANDLORD_ART_MOOD"] = mood or os.environ.get(
        "LANDLORD_ART_MOOD", DEFAULT_MOOD
    )
    return json.loads(STYLE_LAYER_PATH.read_text(encoding="utf-8"))


def palette_materials():
    """Misma paleta mate del pipeline, para que la A/B compare geometria y no textura.

    `glass` no usa PALETTE["window"]: ese color es la ventana ENCENDIDA del perfil nocturno y de
    dia pintaba los huecos de amarillo. La direccion D-111 pide vidrio oscuro, asi que el cristal
    de laboratorio es casi negro y mate-medio, igual que los paramentos del control.

    El color `stone` no esta en PALETTE: el control civico es de ladrillo y la piedra sillar se
    hundia contra la moldura `trim` (casi blanco). Sin un tercer valor medio la fachada civica
    salia monocroma y la silueta no leia a 0,5x.
    """
    return {
        "plaster": material("lab_plaster", PALETTE["plaster"], roughness=0.86),
        "brick": material("lab_brick", PALETTE["brick"], roughness=0.88),
        "stone": material("lab_stone", (0.355, 0.325, 0.275, 1.0), roughness=0.9),
        "trim": material("lab_trim", (0.82, 0.78, 0.68, 1.0), roughness=0.8),
        "metal": material("lab_metal", PALETTE["metal"], metallic=0.35, roughness=0.55),
        "glass": material("lab_glass", (0.055, 0.075, 0.098, 1.0), roughness=0.28),
        "roof": material("lab_roof", PALETTE["metal"], metallic=0.1, roughness=0.8),
        "ground": material("lab_ground", PALETTE["ground"], roughness=0.95),
    }


def paint(objects, mat, only_meshes=True, force=False):
    """Pinta los objetos con un material del laboratorio.

    Con `force=True` sustituye el material que la extension ya traia. Es la opcion correcta para
    la A/B: si cada generador conserva su material propio, la imagen compara shaders y no
    geometria, que es justo lo que D-111 pide medir.
    """
    painted = 0
    for obj in objects:
        if obj.data is None:
            continue
        if only_meshes and obj.type != "MESH":
            continue
        if force:
            obj.data.materials.clear()
        elif obj.data.materials:
            continue
        obj.data.materials.append(mat)
        painted += 1
    return painted


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def link_to_collection(objects, name="EXT_LAB"):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    for obj in objects:
        for parent in obj.users_collection:
            parent.objects.unlink(obj)
        if obj.name not in collection.objects:
            collection.objects.link(obj)
    return collection


def new_empty(name, location):
    empty = bpy.data.objects.new(name, None)
    empty.location = location
    bpy.context.collection.objects.link(empty)
    return empty


def move_by(objects, offset):
    from mathutils import Vector

    shift = Vector(offset)
    for obj in objects:
        obj.location = obj.location + shift
    return objects


def attach(objects, name, offset, rotation_z_degrees=0.0):
    """Agrupa un lote generado bajo un Empty y lo coloca/orienta en una sola operación.

    Las extensiones crean su geometría cerca del origen mundial con el origen de objeto ya en el
    centro mediano de la malla (HiFi) o repartida en varios hijos (Archimesh). Rotar objeto a
    objeto dependería de dónde quedó ese origen; parentear a un Empty en (0,0,0) y girar el Empty
    hace que la pieza rote sobre el punto de construcción con el que fue generada, que es lo que
    quiere decir «colocar el módulo».
    """
    empty = new_empty(name, (0.0, 0.0, 0.0))
    batch = set(objects)
    for obj in objects:
        if obj.parent is not None and obj.parent in batch:
            continue  # ya cuelga de algo del propio lote: la jerarquia interna se conserva
        obj.parent = empty
        obj.matrix_parent_inverse = empty.matrix_world.inverted()
    empty.rotation_euler = (0.0, 0.0, __import__("math").radians(rotation_z_degrees))
    empty.location = offset
    return empty


def set_cursor(location):
    bpy.context.scene.cursor.location = location


def triangle_count():
    """Triangulos que realmente se renderizan.

    Excluye `hide_render`: Archimesh deja en escena las mallas troquel del "autohole", que no
    forman parte del asset publicado y falsearian el presupuesto de D-100/D-102.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        if mesh is None:
            continue
        total += sum(len(p.vertices) - 2 for p in mesh.polygons)
        evaluated.to_mesh_clear()
    return total


def bounds_of(objects):
    if not objects:
        return None
    mins, maxs = world_bounds(objects)
    return {
        "min": [round(v, 3) for v in mins],
        "max": [round(v, 3) for v in maxs],
        "size": [round(maxs[i] - mins[i], 3) for i in range(3)],
    }


def render_evidence(
    *,
    label,
    png_path,
    json_path,
    ortho_scale,
    target_z,
    resolution=1024,
    samples=48,
    azimuth=45.0,
    ground_plane=False,
    provenance=None,
    generated=None,
):
    """Encuadre, luz, render EEVEE y recorte idénticos al control; escribe PNG + JSON hermano.

    `ground_plane` viene desactivado por defecto porque el sprite de control
    (`vf_mixed_tenement_2.png`) se renderiza sin terreno: un plano de suelo propio cambiaría el
    recorte por alpha y rompería la comparabilidad de escala entre imágenes.
    """
    scene = bpy.context.scene
    style_layer = load_style_layer((provenance or {}).get("mood"))
    profile = active_mood(style_layer)

    camera, _target = place_camera(target_z, ortho_scale, azimuth_degrees=azimuth)
    apply_style_layer_lighting(scene, style_layer)

    if ground_plane:
        bpy.ops.mesh.primitive_plane_add(size=90.0, location=(0.0, 0.0, 0.0))
        ground = bpy.context.object
        ground.name = "LAB_GROUND"
        ground.data.materials.append(palette_materials()["ground"])
        ground.visible_shadow = True

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = resolution
    scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.eevee.taa_render_samples = samples
    if hasattr(scene.eevee, "use_taa_reprojection"):
        scene.eevee.use_taa_reprojection = False
    apply_render_settings(scene, style_layer)

    png = Path(png_path).resolve()
    meta_path = Path(json_path).resolve()
    png.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)

    raw = png.with_suffix(".raw.png")
    scene.render.filepath = str(raw)
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    render_seconds = round(time.perf_counter() - started, 2)

    # supersample=1: el AA lo aportan las muestras TAA, así el PNG final mantiene ~resolution px
    # y el recorte por alpha es el mismo algoritmo que produjo el control.
    trim = trim_and_scale(raw, png, supersample=1)
    raw.unlink(missing_ok=True)

    mesh_objects = [obj for obj in scene.objects if obj.type == "MESH" and not obj.hide_render]
    metadata = {
        "schemaVersion": 1,
        "task": "D-111 §4 Blender extension lab",
        "label": label,
        "toolchain": {
            "blender": bpy.app.version_string,
            "buildHash": _decode(bpy.app.build_hash),
            "renderer": scene.render.engine,
        },
        "extension": provenance,
        "generated": generated,
        "camera": {
            "projection": "ORTHO",
            "azimuthDegrees": azimuth,
            "elevationDegrees": 30,
            "orthoScale": camera.data.ortho_scale,
            "targetZ": target_z,
        },
        "lighting": {
            "moodId": active_mood_id(style_layer),
            "keyEnergy": profile["lighting"]["keyEnergy"],
            "keyColor": profile["lighting"]["keyColor"],
            "fillEnergy": profile["lighting"]["fillEnergy"],
            "rimEnergy": profile["lighting"]["rimEnergy"],
            "worldColor": profile["lighting"]["worldColor"],
            "worldStrength": profile["lighting"]["worldStrength"],
            "viewTransform": scene.view_settings.view_transform,
            "look": scene.view_settings.look,
            "exposure": profile["rendering"].get("exposure", 0.0),
        },
        "render": {
            "resolution": [resolution, resolution],
            "taaRenderSamples": samples,
            "taaReprojection": False,
            "filmTransparent": True,
            "seconds": render_seconds,
            "trim": trim,
        },
        "geometry": {
            "triangles": triangle_count(),
            "meshObjects": len(mesh_objects),
            "bounds": bounds_of(mesh_objects),
        },
        "image": {
            "path": str(png),
            "width": trim["final"]["width"],
            "height": trim["final"]["height"],
            "sha256": hashlib.sha256(png.read_bytes()).hexdigest(),
            "bytes": png.stat().st_size,
        },
        "command": _command_line(),
    }
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"label": label, "png": str(png), "sha256": metadata["image"]["sha256"],
                      "triangles": metadata["geometry"]["triangles"],
                      "renderSeconds": render_seconds}))
    return metadata


def _decode(value):
    return value.decode() if isinstance(value, bytes) else value


def import_cc0_module(relative_path, unit_scale=1.0, name_hint=""):
    """Trae un módulo CC0 del staging del repo y lo normaliza a metros de Landlord.

    `IMPORT_ROOT` lo crea `normalize_import_root` DESPUES de importar, asi que no esta en la
    lista que devolvio `import_source`: se busca en la escena. Se devuelve tambien la auditoria
    de normalizacion (dimensiones originales, escala aplicada, offset final).
    """
    source = REPO_ROOT / relative_path
    objects = import_source(source)
    if source.suffix.lower() == ".fbx":
        fix_texture_paths(source)
    normalization = normalize_import_root(objects, unit_scale=unit_scale)
    normalization["unresolvedTextures"] = unresolved_textures(objects)
    root = bpy.data.objects.get("IMPORT_ROOT")
    if root is None:
        raise LabError(f"normalize_import_root no creo IMPORT_ROOT al importar {source.name}")
    root.name = f"CC0_ROOT_{name_hint or source.stem}"
    return objects, root, source, normalization


def _command_line():
    """Reproducibilidad: la corrida completa, no los últimos seis tokens.

    Recortar `sys.argv` dejaba fuera `--output`/`--metadata`, que son justamente las rutas que
    dicen qué archivo produjo la imagen: el JSON de evidencia no podía relanzarse desde sí mismo.
    """
    script = HERE / Path(sys.argv[1]).name if len(sys.argv) > 1 else Path("lab")
    tail = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[2:]
    return " ".join([BLENDER_LABEL, "-b", "--factory-startup", "-P", str(script), "--"] + tail)


def summarize(items):
    return json.dumps(items, indent=2, default=str)

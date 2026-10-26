"""Render por-asset de Landlord para Blender 5.2.2 (ruta E2E de WP4.15-H).

Diferencia con `visual_direction_spike.py`: aquel renderiza una escena de comparación
de estilo; éste produce UN asset de runtime con fondo transparente, lo recorta al
contenido real, lo reduce a la mitad y escribe los metadatos que necesita el contrato
`RuntimeAssetManifestV1` (tamaño, pivote proyectado desde el origen 3D, huella y hash).

Uso (desde la raíz del repo):
  blender --background --python tools/art-pipeline/blender/runtime_asset.py -- \
    --asset courtyard_home --state complete \
    --output blender_artist/generated/runtime/courtyard_home-complete.png \
    --metadata blender_artist/generated/runtime/courtyard_home-complete.json

Personajes:
  blender --background --python tools/art-pipeline/blender/runtime_asset.py -- \
    --asset vecino_variante --direction 2 --animation walk --frame 1 \
    --output salida.png --metadata salida.json

Assets de terceros (WP4.15-V.a, ruta CC0/MIT):
  blender --background --python tools/art-pipeline/blender/runtime_asset.py -- \
    --asset bld_commercial --source glb:blender_artist/staging/third_party/cc0/extracted/kenney/... \\
    --unit-scale 4 --ortho-scale 1.6 --target-z 0.65 \
    --render-width 256 --render-height 256 --source-id src_kenney_city_commercial \\
    --output salida.png --metadata salida.json

Sin `--source` se ejecuta la ruta procedural legacy, que queda congelada: sus parámetros de
cámara y resolución viven en los dicts BUILDINGS/CHARACTERS y su salida debe seguir siendo
byte-idéntica (〔R2〕 y requisito de regresión del plan).
"""

import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from source_import import (  # noqa: E402
    SourceImportError,
    assert_textures_resolved,
    fix_texture_paths,
    import_source,
    normalize_import_root,
    world_bounds,
)

BUILDINGS = {
    "courtyard_home": {
        "label": "Patio compacto",
        "footprint": {"width": 1, "height": 1},
        "renderSize": (256, 224),
        "orthoScale": 7.4,
        "targetZ": 1.5,
    },
}

CHARACTERS = {
    "vecino_variante": {
        "label": "Vecino con abrigo",
        "directions": 4,
        "renderSize": (96, 128),
        "orthoScale": 2.5,
        "targetZ": 0.75,
        "coat": (0.478, 0.373, 0.620, 1),
        "accent": (0.851, 0.561, 0.416, 1),
    },
}

BUILDING_STATES = ("complete", "construction", "damaged", "burning")
ANIMATIONS = ("idle", "walk")

STYLE_LAYER_PATH = HERE / "style_layer_graphic_civic.json"
CAMERA_AZIMUTH_DEGREES = 45
CAMERA_ELEVATION_DEGREES = 30

# Paleta graphic civic, la baseline aprobada en el Visual Direction Spike (D-054).
PALETTE = {
    "brick": (0.48, 0.25, 0.24, 1),
    "plaster": (0.68, 0.67, 0.54, 1),
    "metal": (0.05, 0.11, 0.15, 1),
    "accent": (0.08, 0.68, 0.72, 1),
    "window": (0.98, 0.75, 0.25, 1),
    "green": (0.22, 0.36, 0.28, 1),
    "ground": (0.20, 0.25, 0.25, 1),
    "lighting": (0.72, 0.82, 0.89, 1),
    "fill": (0.21, 0.34, 0.44, 1),
}

ALPHA_THRESHOLD = 0.02
CAMERA_DISTANCE = 18.0
# El recorte final reduce 2× por filtro de caja (ver `trim_and_scale`), así que se renderiza al
# doble y se baja: `render.width/height` de un job es el tamaño PUBLICADO, no el de render.
SUPERSAMPLE = 2


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument(
        "--kind",
        choices=("building", "character", "terrain", "prop", "vehicle"),
        default="building",
        help="categoría del job; la ruta legacy la deduce de sus dicts",
    )
    parser.add_argument("--source", help="glb:|gltf:|fbx:<ruta> para geometría de terceros")
    parser.add_argument("--source-id", help="id lógico en staging-sources.json")
    parser.add_argument("--license", dest="license", help="licencia SPDX declarada por la fuente")
    parser.add_argument("--unit-scale", type=float, help="〔R7〕 escala física de la fuente")
    parser.add_argument("--ortho-scale", type=float)
    parser.add_argument("--target-z", type=float)
    parser.add_argument("--render-width", type=int)
    parser.add_argument("--render-height", type=int)
    parser.add_argument("--state", choices=BUILDING_STATES, default="complete")
    parser.add_argument("--direction", type=int, default=0)
    parser.add_argument("--animation", choices=ANIMATIONS, default="idle")
    parser.add_argument("--frame", type=int, default=0)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def parse_source(value):
    """`glb:ruta/relativa.glb` -> Path. Sin `--source` la ruta es la procedural legacy."""
    if not value:
        return None
    kind, _, raw = value.partition(":")
    if kind not in ("glb", "gltf", "fbx") or not raw:
        raise SystemExit(f"--source debe ser glb:|gltf:|fbx:<ruta>, recibido '{value}'")
    path = Path(raw)
    return path if path.is_absolute() else REPO_ROOT / path


def material(name, color, metallic=0.0, roughness=0.62, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 2.6
    return mat


def cube(name, location, size, mat, bevel=0.0, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("soft_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def cylinder(name, location, radius, depth, mat, vertices=12, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location
    )
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    return obj


def sphere(name, location, radius, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def build_courtyard_home(state, mats):
    """Vivienda alrededor de un patio: dos crujías y un muro bajo, geometría original."""
    if state == "construction":
        # Obra: sólo la crujía trasera levantada, andamio y acopio en el patio.
        cube("bld_courtyard_rear_mass", (0.0, 1.05, 0.85), (2.6, 0.9, 1.7), mats["brick"], bevel=0.05)
        cube("bld_courtyard_slab", (0.0, 0.0, 0.06), (3.0, 3.0, 0.12), mats["plaster"], bevel=0.03)
        for dx in (-1.15, 1.15):
            cylinder("prp_scaffold_post", (dx, -0.9, 1.0), 0.05, 2.0, mats["accent"], vertices=8)
        cube("prp_scaffold_plank", (0.0, -0.9, 1.55), (2.4, 0.3, 0.1), mats["plaster"], bevel=0.02)
        cube("prp_material_stack", (0.55, -0.35, 0.28), (0.75, 0.55, 0.36), mats["metal"], bevel=0.03)
        return
    damaged = state in ("damaged", "burning")
    cube("bld_courtyard_left_mass", (-1.05, 0.35, 1.15), (0.9, 2.3, 2.3), mats["brick"], bevel=0.06)
    cube(
        "bld_courtyard_rear_mass",
        (0.35, 1.15, 0.95),
        (2.3, 0.7, 1.9),
        mats["plaster"] if not damaged else mats["brick"],
        bevel=0.05,
    )
    cube("bld_courtyard_wall_low", (0.85, -0.85, 0.45), (1.3, 0.22, 0.9), mats["plaster"], bevel=0.03)
    cube("bld_courtyard_patio_floor", (0.15, -0.15, 0.04), (2.1, 2.1, 0.08), mats["ground"], bevel=0.02)
    cube("bld_courtyard_roof_left", (-1.05, 0.35, 2.42), (1.15, 2.6, 0.26), mats["metal"], bevel=0.06)
    cube("bld_courtyard_roof_rear", (0.35, 1.15, 2.02), (2.6, 0.95, 0.24), mats["metal"], bevel=0.05)
    cube("bld_courtyard_door", (-1.52, -0.35, 0.62), (0.08, 0.55, 1.2), mats["accent"], bevel=0.02)
    for dz in (0.95, 1.75):
        cube("bld_courtyard_window", (-1.52, 0.55, dz), (0.07, 0.42, 0.5), mats["window"])
    if state == "damaged":
        cube("bld_courtyard_breach", (-1.05, -0.55, 1.9), (0.95, 0.9, 0.95), mats["metal"], bevel=0.04)
        cube("bld_courtyard_rubble_a", (-0.35, -0.95, 0.16), (0.5, 0.42, 0.24), mats["brick"])
        cube("bld_courtyard_rubble_b", (0.25, -1.05, 0.12), (0.34, 0.3, 0.18), mats["plaster"])
    if state == "burning":
        for index, (dx, dy, dz, radius) in enumerate(
            ((-1.05, 0.35, 2.05, 0.42), (-0.55, 0.85, 1.55, 0.3), (0.35, 1.15, 1.75, 0.34))
        ):
            sphere(f"fx_flame_{index}", (dx, dy, dz), radius, mats["flame"])
            sphere(f"fx_smoke_{index}", (dx + 0.18, dy, dz + 0.72), radius * 0.85, mats["smoke"])


def build_character(spec, direction, animation, frame, mats):
    """Variante de vecino: gira sobre Z según la dirección y separa las piernas al andar."""
    angle = math.radians((360 / spec["directions"]) * direction)
    stride = 0.0
    bob = 0.0
    if animation == "walk":
        stride = 0.16 if frame % 2 == 0 else -0.16
        bob = 0.02 if frame % 2 == 0 else 0.0
    else:
        bob = 0.0 if frame % 2 == 0 else 0.03
    root = bpy.data.objects.new("chr_root", None)
    bpy.context.collection.objects.link(root)
    root.rotation_euler = (0.0, 0.0, angle)
    created = []
    created.append(
        cylinder("chr_leg_left", (-0.11, stride, 0.2 + bob), 0.075, 0.4, mats["metal"], vertices=8)
    )
    created.append(
        cylinder("chr_leg_right", (0.11, -stride, 0.2 + bob), 0.075, 0.4, mats["metal"], vertices=8)
    )
    created.append(cylinder("chr_torso", (0.0, 0.0, 0.78 + bob), 0.24, 0.78, mats["coat"]))
    created.append(cube("chr_coat_flap", (0.0, 0.19, 0.72 + bob), (0.44, 0.1, 0.6), mats["coat"], bevel=0.03))
    created.append(sphere("chr_head", (0.0, -0.02, 1.36 + bob), 0.21, mats["skin"]))
    created.append(cube("chr_scarf", (0.0, 0.02, 1.16 + bob), (0.34, 0.2, 0.12), mats["accent"], bevel=0.02))
    for obj in created:
        obj.parent = root


def place_camera(target_z, ortho_scale, name="CAM_ASSET"):
    """Cámara ortográfica isométrica fija (45° azimut, 30° elevación).

    Compartida entre la ruta legacy y la de terceros: los mismos números, el mismo orden de
    creación. El test de regresión byte-idéntica es lo que demuestra que extraerla no cambió
    el render procedural.
    """
    azimuth = math.radians(CAMERA_AZIMUTH_DEGREES)
    elevation = math.radians(CAMERA_ELEVATION_DEGREES)
    direction_vector = Vector(
        (
            math.cos(elevation) * math.cos(azimuth),
            -math.cos(elevation) * math.sin(azimuth),
            math.sin(elevation),
        )
    )
    target = Vector((0.0, 0.0, target_z))
    bpy.ops.object.camera_add(location=tuple(target + direction_vector * CAMERA_DISTANCE))
    camera = bpy.context.object
    camera.name = name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    return camera, target


def create_scene(args):
    mats = {key: material(f"mat_{key}", value, metallic=0.2 if key == "metal" else 0.0)
            for key, value in PALETTE.items() if key not in ("lighting", "fill")}
    mats["flame"] = material("mat_flame", (1.0, 0.45, 0.1, 1), emission=(1.0, 0.42, 0.08, 1), roughness=1.0)
    mats["smoke"] = material("mat_smoke", (0.22, 0.22, 0.24, 1), roughness=1.0)
    mats["skin"] = material("mat_skin", (0.91, 0.77, 0.60, 1), roughness=0.8)
    mats["coat"] = material("mat_coat", CHARACTERS["vecino_variante"]["coat"])
    mats["accent"] = material("mat_accent_char", CHARACTERS["vecino_variante"]["accent"])

    spec = BUILDINGS.get(args.asset) or CHARACTERS[args.asset]
    if args.asset in BUILDINGS:
        build_courtyard_home(args.state, mats)
    else:
        build_character(CHARACTERS[args.asset], args.direction, args.animation, args.frame, mats)

    camera, target = place_camera(spec["targetZ"], spec["orthoScale"])

    bpy.ops.object.light_add(type="AREA", location=(-4.0, -5.0, 9.0))
    key = bpy.context.object
    key.name = "LIGHT_KEY_NW"
    key.data.energy = 900
    key.data.shape = "DISK"
    key.data.size = 6.0
    key.data.color = PALETTE["lighting"][:3]
    key.rotation_euler = (target - key.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.light_add(type="AREA", location=(5.0, 3.0, 6.0))
    fill = bpy.context.object
    fill.name = "LIGHT_FILL"
    fill.data.energy = 380
    fill.data.size = 7.0
    fill.data.color = PALETTE["fill"][:3]
    fill.rotation_euler = (target - fill.location).to_track_quat("-Z", "Y").to_euler()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = spec["renderSize"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    return scene, camera, spec


def apply_style_layer_lighting(scene, style_layer):
    """Rig SUN del style layer, igual al que validó el spike de compatibilidad.

    La ruta legacy usa dos AREA con energías congeladas; un asset con texturas PBR propias se
    quemaba con ellas, así que la rama externa ilumina con lo que declara el JSON de estilo.
    """
    lighting = style_layer["lighting"]
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (*lighting["worldColor"], 1.0)
        background.inputs["Strength"].default_value = lighting["worldStrength"]
    rig = (
        ("LIGHT_KEY", (8.0, -8.0, 12.0), "keyEnergy", "keyColor"),
        ("LIGHT_FILL", (-6.0, 4.0, 6.0), "fillEnergy", "fillColor"),
        ("LIGHT_RIM", (0.0, 8.0, 5.0), "rimEnergy", "rimColor"),
    )
    for name, location, energy_key, color_key in rig:
        bpy.ops.object.light_add(type="SUN", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = lighting[energy_key]
        light.data.color = tuple(lighting[color_key])
    return world


def create_external_scene(args, source_path, style_layer):
    """Rama CC0/MIT: importa geometría externa y la normaliza sin tocar su jerarquía interna."""
    objects = import_source(source_path)
    if source_path.suffix.lower() == ".fbx":
        fix_texture_paths(source_path)
    # El magenta no es un aviso: una textura sin resolver aborta el render.
    assert_textures_resolved(objects, source_path)

    normalization = normalize_import_root(objects, unit_scale=args.unit_scale)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    body = max(meshes, key=lambda obj: len(obj.data.vertices))

    camera, _ = place_camera(args.target_z, args.ortho_scale)
    apply_style_layer_lighting(bpy.context.scene, style_layer)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = args.render_width * SUPERSAMPLE
    scene.render.resolution_y = args.render_height * SUPERSAMPLE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    post = style_layer["rendering"]["postProcessing"]
    scene.view_settings.view_transform = post.split(" - ")[0]
    scene.view_settings.look = post

    mins, maxs = world_bounds(objects)
    normalization["worldSizeMeters"] = {
        "x": round(maxs[0] - mins[0], 4),
        "y": round(maxs[1] - mins[1], 4),
        "z": round(maxs[2] - mins[2], 4),
    }
    return scene, camera, body, normalization


def trim_and_scale(render_path, output_path, alpha_threshold=ALPHA_THRESHOLD):
    """Recorta el margen transparente y reduce a la mitad. Devuelve medidas, offset y pivote."""
    image = bpy.data.images.load(str(render_path))
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    alpha = pixels[:, :, 3]
    opaque_rows = np.where(np.any(alpha > alpha_threshold, axis=1))[0]
    opaque_cols = np.where(np.any(alpha > alpha_threshold, axis=0))[0]
    if opaque_rows.size == 0 or opaque_cols.size == 0:
        raise ValueError("El render no tiene ningún píxel opaco: nada que recortar")
    # `pixels` está en orden Blender (fila 0 = abajo); los offsets publicados se expresan arriba-abajo.
    row_min, row_hi = int(opaque_rows[0]), int(opaque_rows[-1]) + 1
    col_min, col_hi = int(opaque_cols[0]), int(opaque_cols[-1]) + 1
    if (row_hi - row_min) % 2 == 1 and row_hi < height:
        row_hi += 1
    if (col_hi - col_min) % 2 == 1 and col_hi < width:
        col_hi += 1
    crop = pixels[row_min:row_hi, col_min:col_hi, :]
    crop_h, crop_w = crop.shape[0], crop.shape[1]
    # Reducción 2× por filtro de caja: conserva el supersampling sin depender de operadores de recorte.
    small = crop.reshape(crop_h // 2, 2, crop_w // 2, 2, 4).mean(axis=(1, 3))
    final_h, final_w = small.shape[0], small.shape[1]
    trimmed = bpy.data.images.new(
        "runtime_asset_trimmed", width=final_w, height=final_h, alpha=True, float_buffer=False
    )
    trimmed.pixels = np.clip(small, 0.0, 1.0).astype(np.float32).flatten().tolist()
    trimmed.filepath_raw = str(output_path)
    trimmed.file_format = "PNG"
    trimmed.save()
    bpy.data.images.remove(image)
    bpy.data.images.remove(trimmed)
    return {
        "rendered": {"width": width, "height": height},
        "cropped": {"width": crop_w, "height": crop_h, "offsetX": col_min, "offsetY": height - row_hi},
        "final": {"width": final_w, "height": final_h},
    }


def pivot_from_origin(scene, camera, trim):
    """Proyecta el origen 3D (centro de huella a nivel de suelo) sobre la imagen recortada."""
    normalized = world_to_camera_view(scene, camera, Vector((0.0, 0.0, 0.0)))
    rendered = trim["rendered"]
    pixel_x = normalized[0] * rendered["width"]
    pixel_y = (1 - normalized[1]) * rendered["height"]
    cropped = trim["cropped"]
    local_x = pixel_x - cropped["offsetX"]
    local_y = pixel_y - cropped["offsetY"]
    final = trim["final"]
    scale_x = final["width"] / cropped["width"]
    scale_y = final["height"] / cropped["height"]
    pivot_x = local_x * scale_x / final["width"]
    pivot_y = local_y * scale_y / final["height"]
    return {
        "x": round(min(1.0, max(0.0, pivot_x)), 4),
        "y": round(min(1.0, max(0.0, pivot_y)), 4),
    }


def main():
    args = parse_args()
    started = time.perf_counter()
    output = Path(args.output).resolve()
    metadata_path = Path(args.metadata).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    source_path = parse_source(args.source)
    normalization = None
    if source_path is None:
        if args.asset not in BUILDINGS and args.asset not in CHARACTERS:
            raise SystemExit(
                f"--asset '{args.asset}' no es un asset procedural y no se pasó --source"
            )
        scene, camera, spec = create_scene(args)
        kind = "building" if args.asset in BUILDINGS else "character"
        label = spec["label"]
        footprint = spec.get("footprint")
    else:
        required = (
            ("--unit-scale", args.unit_scale),
            ("--ortho-scale", args.ortho_scale),
            ("--target-z", args.target_z),
            ("--render-width", args.render_width),
            ("--render-height", args.render_height),
        )
        missing = [flag for flag, value in required if value is None]
        if missing:
            raise SystemExit("los jobs de terceros requieren " + ", ".join(missing))
        style_layer = json.loads(STYLE_LAYER_PATH.read_text(encoding="utf-8"))
        scene, camera, _body, normalization = create_external_scene(
            args, source_path, style_layer
        )
        kind = args.kind
        label = args.asset
        # La huella la conoce el manifiesto de jobs; el render sólo publica geometría.
        footprint = None

    render_path = output.with_suffix(".render.png")
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    render_ms = round((time.perf_counter() - started) * 1000, 2)
    trim = trim_and_scale(render_path, output)
    render_path.unlink(missing_ok=True)
    pivot = pivot_from_origin(scene, camera, trim)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

    is_building = kind == "building"
    metadata = {
        "schemaVersion": 1,
        "assetId": args.asset,
        "kind": kind,
        "label": label,
        "state": args.state if is_building else None,
        "direction": None if is_building else args.direction,
        "animation": None if is_building else args.animation,
        "frame": None if is_building else args.frame,
        "footprint": footprint,
        "pivot": pivot,
        "image": {
            "path": str(output),
            "width": trim["final"]["width"],
            "height": trim["final"]["height"],
            "sha256": digest,
        },
        "trim": trim,
        "origin": "original",
        "license": "PROJECT-ASSET-LICENSE",
        "author": "Landlord project / blender runtime asset pipeline",
        "toolchain": {
            "blender": bpy.app.version_string,
            "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
            "renderer": scene.render.engine,
        },
        "camera": {
            "projection": "ORTHO",
            "azimuthDegrees": CAMERA_AZIMUTH_DEGREES,
            "elevationDegrees": CAMERA_ELEVATION_DEGREES,
            "orthoScale": camera.data.ortho_scale,
        },
        "palette": "graphic_civic",
        "render": {
            "colorMode": "RGBA",
            "colorDepth": 8,
            "transparentFilm": True,
            "renderMs": render_ms,
            "totalMs": elapsed_ms,
        },
        "reproducibility": {
            "script": "tools/art-pipeline/blender/runtime_asset.py",
            "argv": sys.argv[sys.argv.index("--") + 1 :],
        },
    }
    if source_path is not None:
        # La rama legacy conserva su bloque `original` intacto; esto sólo existe en terceros.
        metadata["origin"] = "licensed"
        metadata["license"] = args.license
        metadata["author"] = f"{args.source_id} via {source_path.name}"
        metadata["source"] = {
            "id": args.source_id,
            "path": str(source_path.relative_to(REPO_ROOT)),
            "kind": source_path.suffix.lstrip(".").lower(),
            **normalization,
        }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "asset": args.asset,
                "state": args.state,
                "direction": args.direction,
                "animation": args.animation,
                "frame": args.frame,
                "output": str(output),
                "width": trim["final"]["width"],
                "height": trim["final"]["height"],
                "sha256": digest,
                "elapsedMs": elapsed_ms,
            }
        )
    )


if __name__ == "__main__":
    main()

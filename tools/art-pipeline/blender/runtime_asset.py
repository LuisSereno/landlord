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

TERRAIN = {
    "ter_lot_dirt_a": {
        "label": "Solar de obra A",
        "footprint": {"width": 1, "height": 1},
        "renderSize": (128, 64),
        "orthoScale": 5.657,
        "targetZ": 0.0,
        "seed": 11,
    },
    "ter_lot_dirt_b": {
        "label": "Solar de obra B",
        "footprint": {"width": 1, "height": 1},
        "renderSize": (128, 64),
        "orthoScale": 5.657,
        "targetZ": 0.0,
        "seed": 23,
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
    "dirt": (0.30, 0.23, 0.17, 1),
    "dirt_dark": (0.20, 0.15, 0.11, 1),
    "dirt_light": (0.40, 0.32, 0.23, 1),
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
    parser.add_argument(
        "--azimuth",
        type=float,
        help="azimut de cámara en grados para variantes de orientación de terceros",
    )
    parser.add_argument(
        "--shadow",
        action="store_true",
        help="compone la sombra proyectada del rig (segunda pasada con plano blanco)",
    )
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


def place_camera(target_z, ortho_scale, name="CAM_ASSET", azimuth_degrees=None):
    """Cámara ortográfica isométrica fija (45° azimut, 30° elevación).

    Compartida entre la ruta legacy y la de terceros: los mismos números, el mismo orden de
    creación. El test de regresión byte-idéntica es lo que demuestra que extraerla no cambió
    el render procedural. `azimuth_degrees` permite variantes de orientación en terceros.
    """
    azimuth = math.radians(
        CAMERA_AZIMUTH_DEGREES if azimuth_degrees is None else azimuth_degrees
    )
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


def build_dirt_lot(spec, mats):
    """Solar de obra procedimental: losa de tierra con zanja y cascotes, cubre una celda."""
    bpy.ops.mesh.primitive_plane_add(size=4.2, location=(0.0, 0.0, 0.0))
    ground = bpy.context.object
    ground.name = "ter_lot_ground"
    ground.data.materials.append(mats["dirt"])
    rng = np.random.default_rng(spec["seed"])
    cube("ter_lot_trench", (-0.55, 0.65, 0.035), (1.9, 0.95, 0.07), mats["dirt_dark"], bevel=0.02)
    for index in range(8):
        x = float(rng.uniform(-1.7, 1.7))
        y = float(rng.uniform(-1.7, 1.7))
        width = float(rng.uniform(0.22, 0.62))
        depth = float(rng.uniform(0.18, 0.45))
        height = float(rng.uniform(0.03, 0.08))
        cube(
            f"ter_lot_clod_{index}",
            (x, y, height / 2),
            (width, depth, height),
            mats["dirt_light" if index % 2 == 0 else "dirt_dark"],
            bevel=0.01,
        )


def create_scene(args):
    mats = {key: material(f"mat_{key}", value, metallic=0.2 if key == "metal" else 0.0)
            for key, value in PALETTE.items() if key not in ("lighting", "fill")}
    mats["flame"] = material("mat_flame", (1.0, 0.45, 0.1, 1), emission=(1.0, 0.42, 0.08, 1), roughness=1.0)
    mats["smoke"] = material("mat_smoke", (0.22, 0.22, 0.24, 1), roughness=1.0)
    mats["skin"] = material("mat_skin", (0.91, 0.77, 0.60, 1), roughness=0.8)
    mats["coat"] = material("mat_coat", CHARACTERS["vecino_variante"]["coat"])
    mats["accent"] = material("mat_accent_char", CHARACTERS["vecino_variante"]["accent"])

    spec = BUILDINGS.get(args.asset) or CHARACTERS.get(args.asset) or TERRAIN.get(args.asset)
    if args.asset in BUILDINGS:
        build_courtyard_home(args.state, mats)
    elif args.asset in TERRAIN:
        build_dirt_lot(TERRAIN[args.asset], mats)
    else:
        build_character(CHARACTERS[args.asset], args.direction, args.animation, args.frame, mats)

    camera, target = place_camera(spec["targetZ"], spec["orthoScale"])

    if args.asset not in TERRAIN:
        # Los solares se iluminan con el rig SUN del style layer (ver `main`), no con el rig legacy
        # de dos AREA: una loseta de tierra iluminada de dia queda mas brillante que las fachadas.
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


from style_layer_math import (  # noqa: E402
    hsv_to_rgb,
    linear_to_srgb,
    name_matches,
    rgb_to_hsv,
    style_pixels,
    srgb_to_linear,
)


def apply_style_layer_lighting(scene, style_layer):
    """Rig SUN del style layer, igual al que validó el spike de compatibilidad.

    La ruta legacy usa dos AREA con energías congeladas; un asset con texturas PBR propias se
    quemaba con ellas, así que la rama externa ilumina con lo que declara el JSON de estilo.
    Sólo la key proyecta sombra: tres soles proyectando sombras superpuestas ensuciaban el suelo.
    """
    lighting = style_layer["lighting"]
    shadow_config = style_layer.get("shadow", {})
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (*lighting["worldColor"], 1.0)
        background.inputs["Strength"].default_value = lighting["worldStrength"]
    rig = (
        ("LIGHT_KEY", tuple(lighting.get("keyPosition", (6.0, -12.0, 12.0))), "keyEnergy", "keyColor"),
        ("LIGHT_FILL", tuple(lighting.get("fillPosition", (-8.0, 6.0, 7.0))), "fillEnergy", "fillColor"),
        ("LIGHT_RIM", tuple(lighting.get("rimPosition", (0.0, 8.0, 5.0))), "rimEnergy", "rimColor"),
    )
    for name, location, energy_key, color_key in rig:
        bpy.ops.object.light_add(type="SUN", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = lighting[energy_key]
        light.data.color = tuple(lighting[color_key])
        # Una SUN sólo importa por su rotación; sin orientarla, todas caían verticales y no
        # proyectaban sombra visible.
        light.rotation_euler = (
            Vector((0.0, 0.0, 0.0)) - light.location
        ).to_track_quat("-Z", "Y").to_euler()
        if name == "LIGHT_KEY":
            light.data.angle = math.radians(shadow_config.get("keySunAngleDegrees", 3.0))
        else:
            light.data.use_shadow = False
    return world


def style_procedural_materials(treatment, kind):
    """Pasa los colores planos de la ruta procedural por el MISMO remapeo que los atlas.

    `PALETTE` es la baseline de dia del spike de direccion visual. Un solar procedural que se
    queda en ella se publica a V 0.31, por encima de las fachadas ya tratadas, y la jerarquia
    suelo/edificio se invierte. Reusar `style_pixels` mantiene el JSON de estilo como unica fuente
    de verdad en lugar de inventar una segunda escalera de valores para dos losetas.
    """
    styled = 0
    for material in bpy.data.materials:
        node_tree = material.node_tree
        if not node_tree:
            continue
        bsdf = next((node for node in node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        base_color = bsdf.inputs["Base Color"]
        if base_color.is_linked:
            continue
        linear = np.array(base_color.default_value[:3], dtype=np.float32)
        source = np.clip(linear_to_srgb(linear), 0, 1).reshape(1, 1, 3)
        out = style_pixels(source, treatment, kind)["styled_rgb"][0, 0]
        base_color.default_value = (*np.clip(srgb_to_linear(out), 0.0, 1.0), 1.0)
        styled += 1
    return {
        "version": treatment.get("version", 1),
        "atlases": [],
        "flatMaterials": styled,
        "emissiveTexels": 0,
        "litWindows": 0,
    }


def _styled_image(image, treatment, kind):
    """Remapea el atlas en una copia en memoria y devuelve también la máscara emisiva.

    La matemática vive en `style_layer_math` para que `check_style_layer.py` pueda predecir este
    mismo remapeo sin arrancar Blender. Las fuentes nunca se reescriben: se crea un image nuevo.
    """
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    result = style_pixels(pixels[:, :, :3], treatment, kind)
    styled = bpy.data.images.new(
        f"styled_{image.name}", width=width, height=height, alpha=True, float_buffer=False
    )
    styled.colorspace_settings.name = "sRGB"
    styled.pixels = np.clip(
        np.dstack([result["styled_rgb"], pixels[:, :, 3]]), 0, 1
    ).astype(np.float32).flatten().tolist()
    styled.pack()

    window_mask = result["window_mask"]
    emissive = None
    emissive_texels = 0
    if window_mask is not None and window_mask.any():
        emissive_texels = int(window_mask.sum())
        pattern = np.repeat(window_mask[:, :, None], 3, axis=2).astype(np.float32)
        emissive = bpy.data.images.new(
            f"emissive_{image.name}", width=width, height=height, alpha=False, float_buffer=False
        )
        emissive.colorspace_settings.name = "Non-Color"
        emissive.pixels = np.dstack(
            [pattern, np.ones((height, width, 1), dtype=np.float32)]
        ).flatten().tolist()
        emissive.pack()
    return styled, emissive, emissive_texels, window_mask


def _hash_unit(salt, center):
    """Unidades en [0,1) deterministas para un centro de cara: qué ventanas duermen y cuáles no.

    `hash()` de Python no vale: está seedado por proceso. `blake2s` sobre el centro cuantizado da
    el mismo número en cualquier máquina y cualquier corrida.
    """
    key = "%d|%.4f,%.4f,%.4f" % (salt, center[0], center[1], center[2])
    return int.from_bytes(hashlib.blake2s(key.encode(), digest_size=4).digest(), "big") / 0xFFFFFFFF


def _apply_window_glow_attribute(polygons_owner, mask, glow):
    """Marca cara a cara (no texel a texel) si esa ventana está encendida.

    Todas las ventanas del atlas Kenney comparten un swatch, así que la única forma de elegir
    subconjunto es la geometría: el baricentro UV de la cara dice si es cristal, y el hash de su
    centro 3D dice si ese cristal concreto tiene luz dentro.
    """
    mesh = polygons_owner.data
    uv_layer = mesh.uv_layers.active
    if uv_layer is None:
        return 0
    attribute = mesh.attributes.get("window_glow") or mesh.attributes.new(
        name="window_glow", type="FLOAT", domain="FACE"
    )
    height, width = mask.shape
    lit_fraction = glow.get("litFraction", 1.0)
    salt = int(glow.get("salt", 0))
    lit = 0
    for poly in mesh.polygons:
        loops = list(poly.loop_indices)
        u = sum(uv_layer.data[i].uv[0] for i in loops) / len(loops)
        v = sum(uv_layer.data[i].uv[1] for i in loops) / len(loops)
        col = min(max(int(u * width), 0), width - 1)
        row = min(max(int(v * height), 0), height - 1)
        if not mask[row, col]:
            attribute.data[poly.index].value = 1.0
            continue
        factor = 1.0 if _hash_unit(salt, poly.center) < lit_fraction else 0.0
        attribute.data[poly.index].value = factor
        lit += int(factor)
    return lit


def _apply_flat_material_treatment(material, treatment):
    """Aplica la paleta a colores planos (vegetación, KayKit). Los nodos trabajan en lineal."""
    node_tree = material.node_tree
    if not node_tree:
        return False
    bsdf = next((node for node in node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return False
    base_color = bsdf.inputs["Base Color"]
    if base_color.is_linked:
        return False
    linear = np.array(base_color.default_value[:3], dtype=np.float32)
    srgb = np.clip(linear_to_srgb(linear), 0, 1).reshape(1, 1, 3)
    hue, saturation, value = rgb_to_hsv(srgb)
    for rule in treatment.get("flatMaterials", []):
        if not name_matches(material.name, rule["match"]):
            continue
        if "hueTo" in rule:
            hue = np.full_like(hue, float(rule["hueTo"]))
        saturation = saturation * rule.get("saturationScale", 1.0)
        value = value * rule.get("valueScale", 1.0)
        rgb = hsv_to_rgb(hue, np.clip(saturation, 0, 1), np.clip(value, 0, 1))[0, 0]
        base_color.default_value = (*srgb_to_linear(rgb), 1.0)
        return True
    return False


def apply_external_treatment(objects, style_layer, kind):
    """Aplica Graphic Civic a materiales externos sin reescribir las fuentes.

    Kenney comparte un único atlas `colormap` entre paredes, tejados, ventanas y calzada, así que
    el tratamiento es un remapeo determinista del atlas (bandas de tono/saturación/valor), no un
    cambio por material. Los colores planos (vegetación) se tratan por nombre de material.
    """
    treatment = style_layer.get("externalTreatment")
    if not treatment:
        return None
    materials = set()
    objects_by_material = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material:
                materials.add(slot.material)
                objects_by_material.setdefault(slot.material, []).append(obj)
    styled_by_image = {}
    emissive_texels = 0
    lit_windows = 0
    flat_materials = 0
    touched_meshes = set()
    for material in materials:
        node_tree = material.node_tree
        if not node_tree:
            continue
        bsdf = next((node for node in node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not bsdf:
            continue
        # Sólo se trata la textura que alimenta Base Color: normales, rugosidad y emisión propias
        # de la fuente (p. ej. Quaternius) deben llegar intactas al render.
        base_color = bsdf.inputs["Base Color"]
        source_node = base_color.links[0].from_node if base_color.is_linked else None
        if source_node is not None and source_node.type == "TEX_IMAGE" and source_node.image:
            key = source_node.image.name
            if key not in styled_by_image:
                styled_by_image[key] = _styled_image(source_node.image, treatment, kind)
            styled, emissive, count, window_mask = styled_by_image[key]
            emissive_texels = max(emissive_texels, count)
            source_node.image = styled
            if emissive is not None:
                glow = treatment["windowGlow"]
                lit_on_mesh = 0
                if glow.get("litFraction", 1.0) < 1.0:
                    for obj in objects_by_material.get(material, []):
                        if obj.data.name in touched_meshes:
                            continue
                        touched_meshes.add(obj.data.name)
                        lit_on_mesh += _apply_window_glow_attribute(obj, window_mask, glow)
                tint = np.array(glow["colorSrgb"], dtype=np.float32) / 255.0
                tint_linear = srgb_to_linear(tint)
                emissive_node = node_tree.nodes.new("ShaderNodeTexImage")
                emissive_node.image = emissive
                emissive_node.interpolation = "Closest"
                tint_node = node_tree.nodes.new("ShaderNodeVectorMath")
                tint_node.operation = "MULTIPLY"
                tint_node.inputs[0].default_value = tuple(tint_linear[:3])
                lit_source = emissive_node.outputs["Color"]
                if lit_on_mesh > 0:
                    # Sin caras encendidas detectadas no se enlaza el atributo: un atributo
                    # inexistente devolvería 0 y apagaría el edificio entero en silencio.
                    attribute_node = node_tree.nodes.new("ShaderNodeAttribute")
                    attribute_node.attribute_name = "window_glow"
                    gate_node = node_tree.nodes.new("ShaderNodeVectorMath")
                    gate_node.operation = "MULTIPLY"
                    node_tree.links.new(emissive_node.outputs["Color"], gate_node.inputs[0])
                    node_tree.links.new(attribute_node.outputs["Fac"], gate_node.inputs[1])
                    lit_source = gate_node.outputs["Vector"]
                    lit_windows += lit_on_mesh
                node_tree.links.new(lit_source, tint_node.inputs[1])
                emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get(
                    "Emission"
                )
                if emission_input:
                    node_tree.links.new(tint_node.outputs["Vector"], emission_input)
                    bsdf.inputs["Emission Strength"].default_value = treatment["windowGlow"][
                        "strength"
                    ]
        if _apply_flat_material_treatment(material, treatment):
            flat_materials += 1
        if not bsdf.inputs["Metallic"].is_linked:
            bsdf.inputs["Metallic"].default_value = treatment.get("metallic", 0.0)
        if not bsdf.inputs["Roughness"].is_linked:
            bsdf.inputs["Roughness"].default_value = treatment.get("roughness", 0.9)
    return {
        "version": treatment.get("version", 1),
        "atlases": sorted(styled_by_image.keys()),
        "flatMaterials": flat_materials,
        "emissiveTexels": emissive_texels,
        "litWindows": lit_windows,
    }


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

    camera, _ = place_camera(
        args.target_z, args.ortho_scale, azimuth_degrees=args.azimuth
    )
    apply_style_layer_lighting(bpy.context.scene, style_layer)
    style_summary = apply_external_treatment(objects, style_layer, args.kind)

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
    scene.view_settings.exposure = style_layer["rendering"].get("exposure", 0.0)

    mins, maxs = world_bounds(objects)
    normalization["worldSizeMeters"] = {
        "x": round(maxs[0] - mins[0], 4),
        "y": round(maxs[1] - mins[1], 4),
        "z": round(maxs[2] - mins[2], 4),
    }
    return scene, camera, body, normalization, style_summary, mins[2]


def render_shadow_pass(scene, style_layer, ground_z, shadow_path):
    """Segunda pasada con un plano blanco: la sombra real del rig, no una elipse inventada.

    La cámara se abre 3× para que la sombra quepa entera; luego se reduce a la resolución del
    pase principal y se compone.
    """
    shadow_config = style_layer.get("shadow", {})
    camera = scene.camera
    original_ortho = camera.data.ortho_scale
    original_width = scene.render.resolution_x
    original_height = scene.render.resolution_y
    camera.data.ortho_scale = original_ortho * 3.0
    scene.render.resolution_x = original_width * 3
    scene.render.resolution_y = original_height * 3
    plane_size = max(16.0, camera.data.ortho_scale * 4.0)
    bpy.ops.mesh.primitive_plane_add(
        size=plane_size, location=(0.0, 0.0, ground_z - 0.002)
    )
    plane = bpy.context.object
    plane.name = "SHADOW_CATCHER"
    catcher = bpy.data.materials.new("mat_shadow_catcher")
    catcher.use_nodes = True
    bsdf = catcher.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    plane.data.materials.append(catcher)
    scene.render.filepath = str(shadow_path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(plane, do_unlink=True)
    camera.data.ortho_scale = original_ortho
    scene.render.resolution_x = original_width
    scene.render.resolution_y = original_height
    return {
        "pass": True,
        "keySunAngleDegrees": shadow_config.get("keySunAngleDegrees", 3.0),
        "strength": shadow_config.get("strength", 0.55),
        "frameScale": 3,
    }


def trim_and_scale(render_path, output_path, shadow_path=None, shadow_style=None):
    """Recorta el margen transparente, compone la sombra y reduce a la mitad."""
    image = bpy.data.images.load(str(render_path))
    width, height = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(height, width, 4)
    if shadow_path is not None and shadow_style is not None:
        shadow_image = bpy.data.images.load(str(shadow_path))
        shadow_width, shadow_height = shadow_image.size
        shadow_pixels = np.array(shadow_image.pixels[:], dtype=np.float32).reshape(
            shadow_height, shadow_width, 4
        )
        bpy.data.images.remove(shadow_image)
        factor = shadow_width // width
        if factor > 1 and shadow_width % width == 0 and shadow_height % height == 0:
            shadow_pixels = shadow_pixels.reshape(
                height, factor, width, factor, 4
            ).mean(axis=(1, 3))
        luminance = (
            shadow_pixels[:, :, 0] * 0.2126
            + shadow_pixels[:, :, 1] * 0.7152
            + shadow_pixels[:, :, 2] * 0.0722
        )
        plane_mask = (pixels[:, :, 3] < 0.02) & (shadow_pixels[:, :, 3] > 0.5)
        if plane_mask.any():
            lit = float(np.percentile(luminance[plane_mask], 97))
            darkness = np.clip((lit - luminance) / max(lit, 1e-4), 0.0, 1.0)
            shadow_alpha = darkness * float(shadow_style.get("strength", 0.55)) * plane_mask
            shadow_color = np.array(shadow_style.get("colorSrgb", [12, 18, 26]), dtype=np.float32) / 255.0
            object_alpha = pixels[:, :, 3:4]
            out_alpha = object_alpha + shadow_alpha[:, :, None] * (1 - object_alpha)
            out_rgb = (
                pixels[:, :, :3] * object_alpha
                + shadow_color * shadow_alpha[:, :, None] * (1 - object_alpha)
            ) / np.maximum(out_alpha, 1e-6)
            pixels = np.clip(
                np.concatenate([out_rgb, out_alpha], axis=-1), 0.0, 1.0
            ).astype(np.float32)
    alpha = pixels[:, :, 3]
    opaque_rows = np.where(np.any(alpha > ALPHA_THRESHOLD, axis=1))[0]
    opaque_cols = np.where(np.any(alpha > ALPHA_THRESHOLD, axis=0))[0]
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
    style_summary = None
    ground_z = None
    shadow_style = None
    style_exposure = 0.0
    if source_path is None:
        if args.asset not in BUILDINGS and args.asset not in CHARACTERS and args.asset not in TERRAIN:
            raise SystemExit(
                f"--asset '{args.asset}' no es un asset procedural y no se pasó --source"
            )
        scene, camera, spec = create_scene(args)
        kind = (
            "building"
            if args.asset in BUILDINGS
            else "terrain"
            if args.asset in TERRAIN
            else "character"
        )
        label = spec["label"]
        footprint = spec.get("footprint")
        if kind == "terrain":
            style_layer = json.loads(STYLE_LAYER_PATH.read_text(encoding="utf-8"))
            apply_style_layer_lighting(scene, style_layer)
            style_summary = style_procedural_materials(
                style_layer["externalTreatment"], kind
            )
            post = style_layer["rendering"]["postProcessing"]
            scene.view_settings.view_transform = post.split(" - ")[0]
            scene.view_settings.look = post
            style_exposure = style_layer["rendering"].get("exposure", 0.0)
            scene.view_settings.exposure = style_exposure
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
        scene, camera, _body, normalization, style_summary, ground_z = create_external_scene(
            args, source_path, style_layer
        )
        style_exposure = style_layer["rendering"].get("exposure", 0.0)
        kind = args.kind
        label = args.asset
        # La huella la conoce el manifiesto de jobs; el render sólo publica geometría.
        footprint = None
        if args.shadow:
            shadow_style = style_layer.get("shadow", {})

    render_path = output.with_suffix(".render.png")
    scene.render.filepath = str(render_path)
    bpy.ops.render.render(write_still=True)
    render_ms = round((time.perf_counter() - started) * 1000, 2)
    shadow_path = None
    shadow_meta = None
    if shadow_style is not None and shadow_style.get("enabled", True) and ground_z is not None:
        shadow_path = output.with_suffix(".shadow.png")
        shadow_meta = render_shadow_pass(scene, style_layer, ground_z, shadow_path)
    trim = trim_and_scale(render_path, output, shadow_path, shadow_style)
    render_path.unlink(missing_ok=True)
    if shadow_path is not None:
        shadow_path.unlink(missing_ok=True)
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
            "azimuthDegrees": args.azimuth if args.azimuth is not None else CAMERA_AZIMUTH_DEGREES,
            "elevationDegrees": CAMERA_ELEVATION_DEGREES,
            "orthoScale": camera.data.ortho_scale,
        },
        "palette": "graphic_civic",
        "styleLayer": (
            {
                **style_summary,
                "exposure": style_exposure,
            }
            if style_summary
            else None
        ),
        "shadow": shadow_meta,
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

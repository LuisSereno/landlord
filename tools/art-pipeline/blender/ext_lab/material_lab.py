"""D-111 §5 — A/B/C de materiales sobre geometría idéntica.

Tres brazos por superficie, en el MISMO fotograma y con la misma cámara/luz/recorte que el control:

  A  Kenney Retro Textures Fantasy (baldosas de 64 px, CC0, sin canales PBR)
  B  Poly Haven (4/2k con albedo + normal + rough, CC0, ya usados por la maqueta de materiales)
  C  Graphic Civic procedural (la paleta mate del pipeline pasada por el remapeo de estilo real)

La geometría es un cupón neutro (muro + zócalo + marco de ventana) que se construye una vez por
brazo y se repite idéntica: lo único que cambia entre A, B y C es el shader. El UV es métrico
(unidad de UV = 1 m) en los tres brazos, de modo que la densidad de cada material se declara en
`tileMeters` y se puede calcular `texelsPerMeter` en la metadata.

Uso (ver README de ext_lab para el aislamiento de perfil):

  blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/material_lab.py -- \\
      --outDir=docs/art/graphics-capabilities/evidence/materials --mood=day_civic

Opciones: `--surfaces=brick_wall,stone_plinth` para re-renderizar sólo algunas, `--samples=`,
`--resolution=`.
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import lab_common  # noqa: E402
from lab_common import LabError, clear_scene, render_evidence  # noqa: E402
from runtime_asset import PALETTE, style_procedural_materials  # noqa: E402

REPO = lab_common.REPO_ROOT
KENNEY_DIR = REPO / "blender_artist/staging/third_party/cc0/extracted/kenney/retro-textures-fantasy/PNG"
POLYHAVEN_DIR = REPO / "blender_artist/staging/third_party/cc0/extracted/polyhaven"

COUPON_GAP = 3.4
COUPON_WIDTH = 2.2
# Separación > ancho del cupón: con 2.4 los tres brazos se solapaban en pantalla (la cámara entra
# con 25° de azimut, así que el cupón de la derecha tapa al del centro) y la hoja no era legible.
# Densidad nominal de cada brazo: la Kenney es una loseta de dibujo (medio metro de muro por
# textura); los escaneos de Poly Haven se publican enlosados a 2 m y el procedural no tiene
# repetición, así que su densidad se registra como nula.
POLYHAVEN_TILE_METERS = 2.0

SURFACES = [
    {
        "id": "brick_wall",
        "label": "fábrica de ladrillo",
        "family": "brick",
        "kenney": {"file": "wall_brick_stone_center.png", "depth": "wall_brick_stone_center_depth.png", "tileMeters": 0.5},
        "polyhaven": {"material": "red_brick_03", "res": "4k"},
    },
    {
        "id": "stucco_wall",
        "label": "revoco / estuco",
        "family": "plaster",
        # El pack no tiene un paño continuo revocado: `wall_rock` es roca y `floor_tiles_*` son
        # losetas. Se registra como hueco en vez de forzar un equivalente.
        "kenney": None,
        "polyhaven": {"material": "concrete_wall_003", "res": "4k"},
    },
    {
        "id": "stone_plinth",
        "label": "zócalo de sillería",
        "family": "stone",
        "kenney": {"file": "wall_stone.png", "depth": "wall_stone_depth.png", "tileMeters": 0.5},
        "polyhaven": {"material": "stone_wall_02", "res": "2k"},
    },
    {
        "id": "timber",
        "label": "tablero de madera",
        "family": "wood",
        "kenney": {"file": "floor_wood_planks.png", "depth": "floor_wood_planks_depth.png", "tileMeters": 0.6},
        "polyhaven": {"material": "wood_planks_grey", "res": "4k"},
    },
    {
        "id": "clay_roof",
        "label": "teja curva",
        "family": "roof",
        "kenney": {"file": "roof_clay_grey_center.png", "depth": None, "tileMeters": 0.5},
        "polyhaven": None,
    },
    {
        "id": "metal_sheet",
        "label": "chapa metálica",
        "family": "metal",
        # Sin loseta de chapa en el pack: `door_metal_*` es una puerta y `floor_stone_grate` una
        # rejilla, ninguna se enlosa como paramento.
        "kenney": None,
        "polyhaven": {"material": "corrugated_iron_03", "res": "2k"},
    },
    {
        "id": "window_glass",
        "label": "hueco de ventana",
        "family": "window",
        "kenney": {"file": "window_tall_divided.png", "lit": "window_tall_divided_lit.png", "tileMeters": 0.8},
        "polyhaven": None,
    },
    {
        "id": "pavement",
        "label": "pavimento de acera",
        "family": "ground",
        "kenney": {"file": "floor_stone_pattern.png", "depth": "floor_stone_pattern_depth.png", "tileMeters": 0.5},
        "polyhaven": {"material": "cobblestone_pavement", "res": "2k"},
    },
]

# `stone` y `roof` no están en PALETTE: son los dos valores que el laboratorio de extensiones ya
# tuvo que añadir para que la fachada civica no saliera monocroma.
FLAT_COLORS = {
    "brick": PALETTE["brick"],
    "plaster": PALETTE["plaster"],
    "stone": (0.355, 0.325, 0.275, 1.0),
    "wood": (0.34, 0.24, 0.15, 1.0),
    "roof": PALETTE["metal"],
    "metal": PALETTE["metal"],
    # La ventana de día del control es vidrio oscuro, no el amarillo de PALETTE["window"]: ese es
    # el hueco ENCENDIDO del perfil nocturno (lab_common.palette_materials documenta lo mismo).
    "window": (0.055, 0.075, 0.098, 1.0),
    "ground": PALETTE["ground"],
}
FLAT_ROUGHNESS = {
    "brick": 0.88,
    "plaster": 0.86,
    "stone": 0.9,
    "wood": 0.85,
    "roof": 0.8,
    "metal": 0.55,
    "window": 0.28,
    "ground": 0.95,
}


def purge_datablocks():
    """Libera las texturas del brazo anterior: un 4k EXR son ~270 MB y son ocho superficies.

    `clear_scene` sólo borra objetos/mallas. Sin esto, los `images` de las superficies previas
    seguirían residentes y el pico de RSS escalaría con el número de superficies del lote.
    """
    for collection in (bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def new_box(name, size, location):
    # El cubo base de `primitive_cube_add(size=1.0)` ya mide 1 m de arista: escalar por `size`,
    # no por `size/2`, o el cupón sale a media escala y el zócalo se despega del muro.
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return obj


def build_coupon(prefix, x):
    """El mismo cupón tres veces: muro, zócalo saliente y marco de ventana en relieve."""
    parts = [
        new_box(f"{prefix}_wall", (2.0, 0.28, 2.6), (x, 0.0, 1.30)),
        new_box(f"{prefix}_plinth", (2.2, 0.40, 0.34), (x, 0.0, 0.17)),
        new_box(f"{prefix}_frame", (1.05, 0.34, 1.35), (x, 0.02, 1.65)),
    ]
    return parts


def metric_uv(objects):
    """UV métrico por proyección de caja: UV = coordenada mundial en metros.

    Se calcula sobre la malla ya transformada, así que los tres brazos comparten exactamente el
    mismo desplegado y la comparación de densidad es válida. Ningún helper del repo hace esto
    (`source_import` sólo repara rutas de texturas), por eso vive aquí.
    """
    from mathutils import Vector

    axes = {
        "x": (Vector((0.0, 1.0, 0.0)), Vector((0.0, 0.0, 1.0))),
        "y": (Vector((1.0, 0.0, 0.0)), Vector((0.0, 0.0, 1.0))),
        "z": (Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0))),
    }
    for obj in objects:
        mesh = obj.data
        if not mesh.uv_layers:
            mesh.uv_layers.new(name="UVMap")
        layer = mesh.uv_layers.active.data
        matrix = obj.matrix_world
        for poly in mesh.polygons:
            normal = (matrix.to_3x3() @ poly.normal).normalized()
            key = max("xyz", key=lambda a: abs(getattr(normal, a)))
            u_axis, v_axis = axes[key]
            for index in poly.loop_indices:
                world = matrix @ mesh.vertices[mesh.loops[index].vertex_index].co
                layer[index].uv = (world.dot(u_axis), world.dot(v_axis))
        mesh.uv_layers.active.name = "UVMap"


def image(path, non_color=False):
    file = Path(path)
    if not file.exists():
        raise LabError(f"no existe la textura {file}")
    existing = bpy.data.images.get(file.stem)
    if existing:
        return existing
    img = bpy.data.images.load(str(file))
    img.name = file.stem
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def kenney_material(surface, spec, night):
    """Brazo A: una sola loseta de color + su acompañante `_depth` como relieve.

    `interpolation='Closest'` no es un capricho estético: en runtime Phaser dibuja con
    `roundPixels`/sin suavizado, y medir la legibilidad de una baldosa de 64 px con interpolación
    bilineal daría una lectura borrosa que el juego nunca muestra.
    """
    material = bpy.data.materials.new(f"mat_kenney_{surface['id']}")
    material.use_nodes = True
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image(KENNEY_DIR / spec["file"])
    texture.interpolation = "Closest"
    texture.extension = "REPEAT"
    uv = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0 / spec["tileMeters"], 1.0 / spec["tileMeters"], 1.0)
    tree.links.new(uv.outputs["UV"], mapping.inputs["Vector"])
    tree.links.new(mapping.outputs["Vector"], texture.inputs["Vector"])
    tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    record = {
        "arm": "kenney_retro_textures_fantasy",
        "source": f"blender_artist/staging/third_party/cc0/extracted/kenney/retro-textures-fantasy/PNG/{spec['file']}",
        "license": "CC0-1.0",
        "tileMeters": spec["tileMeters"],
        "channels": ["color"],
        "interpolation": "Closest",
        "textureResolution": texture.image.size[0],
    }
    depth_name = spec.get("depth") or spec.get("lit")
    if spec.get("depth"):
        depth = tree.nodes.new("ShaderNodeTexImage")
        depth.image = image(KENNEY_DIR / spec["depth"], non_color=True)
        depth.interpolation = "Closest"
        depth.extension = "REPEAT"
        tree.links.new(mapping.outputs["Vector"], depth.inputs["Vector"])
        bump = tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.18
        tree.links.new(depth.outputs["Color"], bump.inputs["Height"])
        tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        record["channels"].append("depth_as_bump")
    elif spec.get("lit"):
        # Las `_lit` de Kenney son ventanas encendidas: suman emisión, no reemplazan el albedo.
        # Aplicadas de día queman el cupón (medido en la primera pasada: blanco puro sobre ladrillo),
        # así que se enlazan igual pero con fuerza condicionada al mood, que es como debería
        # consumirlas el runtime.
        lit = tree.nodes.new("ShaderNodeTexImage")
        lit.image = image(KENNEY_DIR / spec["lit"])
        lit.interpolation = "Closest"
        tree.links.new(mapping.outputs["Vector"], lit.inputs["Vector"])
        tree.links.new(lit.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0 if night else 0.0
        record["channels"].append("lit_emissive")
        record["litSource"] = spec["lit"]
        record["litMoodGated"] = True
        record["emissionStrength"] = 1.0 if night else 0.0
    return material, record


def polyhaven_material(surface, spec):
    """Brazo B: el material tal cual viene en el .blend de Poly Haven, sólo re-encuadrado a UV métrico.

    Se conservan sus nodos de normal y rugosidad; se reemplaza la cadena de coordenadas porque el
    despliegue del cupón es métrico y el del cubo original usa UV 0-1 sobre el tamaño del scan.
    """
    directory = POLYHAVEN_DIR / spec["material"]
    blend = directory / f"{spec['material']}_{spec['res']}.blend"
    if not blend.exists():
        raise LabError(f"no existe {blend}")
    with bpy.data.libraries.load(str(blend), link=False) as (source, target):
        target.materials = [spec["material"]]
    template = target.materials[0]
    material = template.copy()
    material.name = f"mat_polyhaven_{surface['id']}"
    bpy.data.materials.remove(template)
    tree = material.node_tree
    bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise LabError(f"{spec['material']} no tiene BSDF Principled")
    uv = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (
        1.0 / POLYHAVEN_TILE_METERS,
        1.0 / POLYHAVEN_TILE_METERS,
        1.0,
    )
    tree.links.new(uv.outputs["UV"], mapping.inputs["Vector"])
    channels = []
    for node in [n for n in tree.nodes if n.type == "TEX_IMAGE"]:
        file = Path(bpy.path.abspath(node.image.filepath)) if node.image else None
        target_path = directory / "textures" / file.name
        if node.image and not target_path.exists():
            raise LabError(f"textura declarada por el .blend ausente en disco: {file.name}")
        if node.image:
            node.image.filepath = str(target_path)
            node.image.reload()
            suffix = file.name.replace(spec["material"], "").replace(spec["res"], "").strip("._")
            channels.append(suffix)
            for input_socket in node.inputs:
                if input_socket.type == "VECTOR":
                    for link in list(material.node_tree.links):
                        if link.to_node == node:
                            tree.links.remove(link)
                    tree.links.new(mapping.outputs["Vector"], input_socket)
    textures = sorted({node.image.name for node in tree.nodes if node.type == "TEX_IMAGE" and node.image})
    sizes = [node.image.size[0] for node in tree.nodes if node.type == "TEX_IMAGE" and node.image and node.image.size[0]]
    record = {
        "arm": "polyhaven",
        "source": f"blender_artist/staging/third_party/cc0/extracted/polyhaven/{spec['material']}",
        "license": "CC0-1.0",
        "tileMeters": POLYHAVEN_TILE_METERS,
        "channels": sorted(set(channels)),
        "textureResolution": max(sizes) if sizes else None,
        "textures": textures,
    }
    return material, record


def flat_material(surface):
    """Brazo C: el color plano canónico, después pasado por `style_procedural_materials`."""
    family = surface["family"]
    material = bpy.data.materials.new(f"mat_civic_{surface['id']}")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = FLAT_COLORS[family]
    bsdf.inputs["Roughness"].default_value = FLAT_ROUGHNESS[family]
    if family == "metal":
        bsdf.inputs["Metallic"].default_value = 0.35
    record = {
        "arm": "graphic_civic_procedural",
        "source": "tools/art-pipeline/blender/runtime_asset.py:PALETTE + style_procedural_materials",
        "license": "original",
        "tileMeters": None,
        "channels": ["flat_albedo_tratado"],
    }
    return material, record


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def render_surface(surface, out_dir, mood, resolution, samples, index, total):
    started = time.perf_counter()
    clear_scene()
    purge_datablocks()
    os.environ["LANDLORD_ART_MOOD"] = mood
    specs = {"kenney": surface.get("kenney"), "polyhaven": surface.get("polyhaven"), "civic": True}
    # El encuadre se ajusta al número de brazos presentes: `render_evidence` recorta por alpha, así
    # que un ortho_scale fijo dejaría hojas de dos brazos a un tercio del tamaño de las de tres.
    present = [(arm, specs[arm]) for arm in ("kenney", "polyhaven", "civic") if specs[arm]]
    ortho_scale = ((len(present) - 1) * COUPON_GAP + COUPON_WIDTH) * 1.18
    night = mood.startswith("night")
    records = []
    for offset, (arm, spec) in enumerate(present):
        objects = build_coupon(f"{surface['id']}_{arm}", (offset - (len(present) - 1) / 2) * COUPON_GAP)
        metric_uv(objects)
        if arm == "kenney":
            material, record = kenney_material(surface, spec, night)
        elif arm == "polyhaven":
            material, record = polyhaven_material(surface, spec)
        else:
            material, record = flat_material(surface)
        for obj in objects:
            obj.data.materials.clear()
            obj.data.materials.append(material)
        record["objects"] = [obj.name for obj in objects]
        records.append(record)
    for arm in ("kenney", "polyhaven", "civic"):
        if specs[arm]:
            continue
        records.append({"arm": arm, "absent": True, "reason": surface.get(f"{arm}Gap", "sin candidato en el pack")})
    # El remapeo de estilo sólo toca albedos planos: los brazos A y B llevan Base Color enlazado a
    # textura y el propio helper los salta, así que el control C es el único que se transforma.
    style_layer = lab_common.load_style_layer(mood)
    treatment = lab_common.active_mood(style_layer)["externalTreatment"]
    style_procedural_materials(treatment, "building")
    lab_common.link_to_collection(bpy.data.objects, "MATERIAL_LAB")

    png = Path(out_dir) / f"{surface['id']}.png"
    meta = Path(out_dir) / f"{surface['id']}.json"
    provenance = {
        "mood": mood,
        "capability": "material_lab_d111_s5",
        "surface": surface["id"],
        "surfaceLabel": surface["label"],
        "family": surface["family"],
        "arms": records,
        "armOrder": [arm for arm, _spec in present],
        "geometry": "cupón idéntico por brazo (muro 2.0x0.28x2.6 + zócalo 2.2x0.40x0.34 + marco 1.05x0.34x1.35)",
        "uvConvention": "UV = coordenada mundial en metros (proyección de caja por normal dominante)",
    }
    metadata = render_evidence(
        label=f"D-111 §5 {surface['label']}",
        png_path=png,
        json_path=meta,
        ortho_scale=ortho_scale,
        target_z=1.35,
        resolution=resolution,
        samples=samples,
        azimuth=25.0,
        provenance=provenance,
        generated={"script": "tools/art-pipeline/blender/ext_lab/material_lab.py", "surfaceSeconds": None},
    )
    for record in metadata["extension"]["arms"]:
        if record.get("absent") or record.get("arm") == "graphic_civic_procedural":
            continue
        if record["tileMeters"]:
            resolution_px = record.get("textureResolution") or 64
            record["texelsPerMeter"] = round(resolution_px / record["tileMeters"], 1)
    metadata["extension"]["surfaceSeconds"] = round(time.perf_counter() - started, 2)
    meta.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"[{index}/{total}] {surface['id']}: {metadata['image']['width']}x{metadata['image']['height']} "
        f"tri={metadata['geometry']['triangles']} {metadata['extension']['surfaceSeconds']}s "
        f"sha={digest(png)[:12]}"
    )
    return metadata


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    options = {
        key.split("=", 1)[0][2:]: key.split("=", 1)[1]
        for key in argv
        if key.startswith("--") and "=" in key
    }
    out_dir = Path(options.get("outDir", "docs/art/graphics-capabilities/evidence/materials"))
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    mood = options.get("mood", "day_civic")
    resolution = int(options.get("resolution", 1024))
    samples = int(options.get("samples", 48))
    wanted = options.get("surfaces")
    surfaces = SURFACES if not wanted else [s for s in SURFACES if s["id"] in wanted.split(",")]
    print(f"material lab: {len(surfaces)} superficies · mood={mood} · {resolution}px · {samples} muestras")
    results = []
    for position, surface in enumerate(surfaces, start=1):
        try:
            metadata = render_surface(surface, out_dir, mood, resolution, samples, position, len(surfaces))
            results.append({"id": surface["id"], "ok": True, "png": metadata["image"]["path"]})
        except Exception as error:  # una superficie caída no detiene el lote (§11)
            import traceback

            print(f"FALLO {surface['id']}: {type(error).__name__}: {error}")
            traceback.print_exc(limit=4)
            results.append({"id": surface["id"], "ok": False, "error": f"{type(error).__name__}: {error}"})
    summary = {
        "schemaVersion": 1,
        "task": "D-111 §5 A/B/C de materiales",
        "mood": mood,
        "render": {"resolution": resolution, "samples": samples},
        "surfaces": results,
        "trianglesTotal": None,
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({"ok": sum(1 for r in results if r["ok"]), "failed": sum(1 for r in results if not r["ok"])}))


if __name__ == "__main__":
    main()

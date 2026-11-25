"""Ensamblado del compositor en Blender: una composición decidida en Python se vuelve sprite.

`compose.py` decide QUÉ se coloca y DÓNDE; este módulo traduce esa lista en geometría licenciada
importada, la pasa por el estilo canónico y renderiza. La separación es deliberada (§12–§18): un
candidato se puede auditar, comparar y testear sin arrancar Blender, y el render no añade ninguna
decisión de diseño — recalcula la composición a partir del request, así que lo que sale en la imagen
es literalmente lo que firma §14.

Dos cosas viven aquí, y no en `runtime_asset.py`, porque §26 prohíbe tocar la pipeline embarcada:

- **Alcance profundo de §11 y lighting horneado.** El MegaKit venía enlazando su atlas a `Base Color`
  a través de un MULTIPLY con el color de vértice (medido en la fuente real: `Mix.blend_type=MULTIPLY`,
  factor 1, A=TEX_IMAGE, B=VERTEX_COLOR), y `apply_external_treatment` sólo mira el primer salto del
  socket (`runtime_asset.py:620-622`). Sin este paso la fachada Quaternius entraría en su albedo de
  origen junto a muros Kenney ya tratados: dos temperaturas de brillo en el mismo alzado, que es justo
  lo que §11 prohíbe. Se reutiliza `_styled_image`, no una segunda matemática de paleta (§10). Desde
  〔D-111.3-T FASE 1〕 el COLOR_0 horneado del export "glTF (Godot)" —una fila inferior de vértices
  (0, 0.126, 0.126) que pintaba de negro-verdoso la cabecera de cada paño— se neutraliza al importar
  (`strip_baked_vertex_lighting`): el MULTIPLY se resuelve al atlas directo y la escalera de §11 se
  aplica sobre el color real del ladrillo, sin doble sombreado.
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
import re
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
from render_settings import active_mood, active_mood_id, apply_render_settings  # noqa: E402
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
from . import anchors, architectural_details, weathering  # noqa: E402

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
MATERIAL_MAQUETTE_ASSETS = {
    "residential_low": {
        "assetId": "wa_polyhaven_materials_red_brick_03_4k",
        "blend": "blender_artist/staging/third_party/cc0/extracted/polyhaven/red_brick_03/red_brick_03_4k.blend",
        "material": "red_brick_03",
        "license": "CC0-1.0",
    },
    "industrial_heavy": {
        "assetId": "wa_polyhaven_materials_corrugated_iron_03_2k",
        "blend": "blender_artist/staging/third_party/cc0/extracted/polyhaven/corrugated_iron_03/corrugated_iron_03_2k.blend",
        "material": "corrugated_iron_03",
        "license": "CC0-1.0",
    },
}


class SceneError(RuntimeError):
    pass


def reset_scene():
    """Vacía la escena entre candidatos reseteando Blender a estado de fábrica.

    Remapear un atlas de 2048² cuesta ~4,3 s y ~250 MB de temporales (medido en esta herramienta).
    El comentario original decía conservar las imágenes porque candidatos de una familia comparten
    atlas, pero diferentes familias usan texturas con los mismos nombres (T_Concrete_BaseColor) que
    son ficheros distintos: Blender crea copias .001/.002 y los materiales referencian la versión
    equivocada, produciendo renders transparentes.
    
    Se ha probado limpiar objetos, materiales, imágenes, luces, cámaras, colecciones, nodos y crear
    escenas nuevas, pero el estado interno acumulado de Blender causa que el segundo candidato falle.
    La solución es resetear Blender completamente a estado de fábrica, que limpia TODO el estado
    interno incluyendo datos no accesibles desde Python.
    """
    # Reset Blender to factory settings - this clears EVERYTHING
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # After factory reset, we have a bare scene. Set up render settings.
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.film_transparent = False
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100


def apply_material_maquette_pbr(groups, building_type, family):
    """Prueba PBR CC0 acotada a paños opacos de fachada; no altera perfiles/runtime base."""
    source = MATERIAL_MAQUETTE_ASSETS.get(family)
    if source is None:
        raise SceneError(f"D-111: no hay material PBR candidato para la familia {family}")
    source_path = REPO_ROOT / source["blend"]
    if not source_path.is_file():
        raise SceneError(f"D-111: falta la fuente PBR registrada {source_path}")
    with bpy.data.libraries.load(str(source_path), link=False) as (data_from, data_to):
        if source["material"] not in data_from.materials:
            raise SceneError(f"D-111: {source['material']} no existe en {source_path.name}")
        data_to.materials = [source["material"]]
    template = bpy.data.materials.get(source["material"])
    if template is None or not template.use_nodes:
        raise SceneError(f"D-111: material PBR incompleto {source['material']}")
    material = template.copy()
    material.name = f"material_maquette_{building_type}_{source['material']}"
    texture_files = []
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            image_path = bpy.path.abspath(node.image.filepath)
            if not Path(image_path).is_file():
                fallback = source_path.parent / "textures" / Path(node.image.filepath).name
                if not fallback.is_file():
                    raise SceneError(f"D-111: textura Poly Haven ausente {node.image.filepath}")
                node.image.filepath = str(fallback)
                image_path = str(fallback)
            node.image.filepath = image_path
            texture_path = Path(image_path).resolve()
            texture_files.append(
                {
                    "path": str(texture_path.relative_to(REPO_ROOT)),
                    "sha256": hashlib.sha256(texture_path.read_bytes()).hexdigest(),
                }
            )
        elif node.type == "BSDF_PRINCIPLED":
            # Mate urbano y legible a 1×; conservamos albedo/normal/roughness PBR y atenuamos
            # reflejos metálicos para que la textura no convierta la maqueta en fotorealismo.
            node.inputs["Roughness"].default_value = 0.78
            node.inputs["Metallic"].default_value = 0.08 if family == "industrial_heavy" else 0.0
        elif node.type == "NORMAL_MAP":
            node.inputs["Strength"].default_value = 0.28
    applied = 0
    for record, _module, children, _normalization in groups:
        target_roles = {"wall_panel", "ground_panel"}
        if family == "industrial_heavy":
            target_roles.add("hall")
        if record["role"] not in target_roles:
            continue
        for obj in children:
            obj.data.materials.clear()
            obj.data.materials.append(material)
            applied += 1
    if not applied:
        raise SceneError(f"D-111: ningún paño opaco de {building_type} recibió material PBR")
    return {
        "method": "Poly Haven PBR albedo + roughness + tangent normal, assigned to opaque facade panels",
        "assetId": source["assetId"],
        "sourcePath": source["blend"],
        "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "textureFiles": sorted(texture_files, key=lambda item: item["path"]),
        "license": source["license"],
        "material": source["material"],
        "assignedMeshObjects": applied,
        "renderSettings": {"engine": "BLENDER_EEVEE", "samples": 96, "screenRayTracing": True},
    }


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


def authored_material_name(name):
    """El nombre con el que la fuente authorió el material, sin el sufijo de colisión de Blender.

    Un segundo GLB que traiga `MI_Trim` ya registrado lo importa como `MI_Trim.001`. La familia
    medida del perfil está indexada por el nombre original, así que sin este paso §11 publicaría
    `family: null` para un material que sí está clasificado y el revisor no podría juzgar si
    brick/plaster/metal/glass/stone/wood siguen distinguiéndose.
    """
    return re.sub(r"\.\d+$", "", name)


def pixels_digest(path):
    """sha256 del búfer de píxeles decodificado, no de los bytes del PNG.

    Medido en este spike: el escritor PNG de Blender produce cuatro ficheros con sha256 distinto para
    un raster idéntico (la misma escena, dos procesos, dos pasadas cada uno: el sha del píxel no se
    mueve, el del fichero cambia siempre y la longitud es la misma). Un `sha256(read_bytes())` como
    firma de §13 juzgaría pues el contenedor —orden de chunks y metadatos— y declararía
    NO_DETERMINISTA un sprite que pixel a pixel es igual, que es exactamente el ruido que hizo fallar
    la primera corrida del test de regeneración. §13 pide que el *resultado* sea reproducible, así que
    cada pase se firma sobre los mismos floats que lee la propia pipeline (`runtime_asset.py:769`).

    Las dos firmas conviven: el sprite publicado sí resultó byte-estable entre procesos (cuatro
    renders, `9bd059ea…`) porque lo escribe `images.new().save()`, no `write_still`, y §24 pide ese sha
    como integridad del artefacto. Aquí se firman en píxeles los pases intermedios, que sí cambian.

    Se usa `foreach_get` sobre un búfer preasignado en vez de `pixels[:]`: el pase de sombra va a 3×
    (11,6 Mpx, 46,5 M de componentes) y la forma lista de Python costaría ~1,5 GB transitorios encima
    de los 3,1 GB de RSS que ya mide la corrida.
    """
    image = bpy.data.images.load(str(path))
    try:
        width, height = int(image.size[0]), int(image.size[1])
        buffer = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(buffer)
        return {
            "width": width,
            "height": height,
            "sha256": hashlib.sha256(buffer.tobytes()).hexdigest(),
        }
    finally:
        bpy.data.images.remove(image)


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
        # V.j: llama/humo son VFX emisivos con color propio (naranja fuego, gris humo); no son albedo
        # del edificio y no deben pasarse por la paleta civic (los dejaría pálidos). Se conservan.
        if name.startswith(("flame_", "fire_")):
            continue
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


# Cuánto prende el hollín en cada familia medida del perfil (`materialFamilies`). La madera es
# combustible y el yeso se descascara; un vidrio a esa distancia se ahúma pero sigue siendo vidrio.
# Sin esta tabla los paños viraban todos al mismo marrón y la silueta quemada perdía la lectura de
# qué era cada superficie (medido en FASE 2: 24/24 materiales al mismo factor 0,7).
SOOT_FAMILY_BIAS = {
    "wood": 1.0,
    "brick": 0.9,
    "plaster": 0.85,
    "stone": 0.78,
    "atlas": 0.72,
    "metal": 0.6,
    # El interior va por encima del yeso: es la cara que da a la sala que arde, y con el sesgo viejo
    # (0,5) el forjado quemado se seguía viendo claro entre las lenguas. Hollín de sala incendiada, no
    # de fachada.
    "interior": 0.66,
    "glass": 0.35,
    "default": 0.72,
}
# Techo del Fac: por debajo de él el paño más quemado conserva algo de su propio color, que es la
# diferencia entre "fachada carbonizada" y "masa negra". El encargo lo pide explícito.
SOOT_CAP = 0.85


def _soot_field(tree, region, feather, rise, fall):
    """Socket escalar (0..1): 1 dentro de la caja quemada, 0 a `feather` metros de ella.

    Se construye una cadena POR MATERIAL: los nodos viven dentro del `node_tree` de cada material y
    no se pueden compartir entre árboles. Trabaja sobre `Geometry→Position` (metros de mundo), así
    que localiza el quemado sin tocar un vértice de la fuente — 〔R2〕 y §32 siguen midiendo la misma
    geometría. Dentro de la caja la distancia exterior es 0 por construcción, de modo que el campo no
    necesita los semiejes de la sección: el incendio ES la caja y alrededor cae la pluma.

    El eje Z usa dos radios distintos (`rise` > `fall`) porque la mancha de humo trepa por la fachada
    y no baja; con un solo radio el resultado es una sombra esférica centrada en el hueco.
    """
    x0, y0, z0 = region["x"]["min"], region["y"]["min"], region["z"]["min"]
    x1, y1, z1 = region["x"]["max"], region["y"]["max"], region["z"]["max"]
    geometry = tree.nodes.new("ShaderNodeNewGeometry")

    def vector(operation, a, b):
        node = tree.nodes.new("ShaderNodeVectorMath")
        node.operation = operation
        for slot, value in ((0, a), (1, b)):
            if isinstance(value, tuple):
                # Los sockets de VectorMath son de tres componentes: con el cuarto componente alfa de
                # un color Blender responde `sequences of dimension 0 should contain 3 items, not 4`.
                node.inputs[slot].default_value = (float(value[0]), float(value[1]), float(value[2]))
            elif value is not None:
                tree.links.new(value, node.inputs[slot])
        # `outputs[0]` y no `outputs["Vector"]`: LENGTH y DOT PRODUCT sacan el resultado por un socket
        # escalar llamado "Value", y el nombre cambia con la operación.
        return node.outputs[0]

    def math(operation, a, b):
        node = tree.nodes.new("ShaderNodeMath")
        node.operation = operation
        for slot, value in ((0, a), (1, b)):
            if isinstance(value, (int, float)):
                node.inputs[slot].default_value = float(value)
            else:
                tree.links.new(value, node.inputs[slot])
        return node.outputs["Value"]

    position = geometry.outputs["Position"]
    outside_max = vector("MAXIMUM", vector("SUBTRACT", position, (x1, y1, z1)), (0.0, 0.0, 0.0))
    outside_min = vector("MAXIMUM", vector("SUBTRACT", (x0, y0, z0), position), (0.0, 0.0, 0.0))
    spread = vector(
        "ADD",
        vector("MULTIPLY", outside_max, (1.0 / feather, 1.0 / feather, 1.0 / rise)),
        vector("MULTIPLY", outside_min, (1.0 / feather, 1.0 / feather, 1.0 / fall)),
    )
    # t = clamp01(1 - d) con suavizado de Hermite t²(3-2t): el borde de la mancha no sale a corte.
    t = math("MAXIMUM", math("SUBTRACT", 1.0, vector("LENGTH", spread, None)), 0.0)
    return math("MULTIPLY", math("MULTIPLY", t, t), math("SUBTRACT", 3.0, math("MULTIPLY", 2.0, t)))


def apply_soot(objects, strength, region=None, family_of=None):
    """V.j / FASE 3.4: hollín localizado sobre el albedo ya tratado de damaged/burning.

    El control (evidence/v2/fire/DIAGNOSIS.md) multiplicaba los 24 materiales del edificio por el mismo
    marrón con Fac=1: el resultado era un bloque uniforme donde ya no se leía qué paño era fachada y
    cuál cornisa, y el envejecimiento de D-111 WP04 quedaba borrado por encima. Aquí el factor sale
    del campo de `region` —cero fuera del incendio, de modo que lo que no arde conserva exactamente su
    albedo envejecido, que es la separación envejecido≠quemado que pedía el pase de estados— y la
    amplitud, de la familia del material.

    `strength` sigue siendo la escala del estado (damaged 0,45 / burning 0,7) recortada por `SOOT_CAP`.
    Atlas y color plano reciben el mismo trato: la textura compartida no se modifica, se inserta un
    Mix entre la fuente y el BSDF. Los materiales de equipo (andamio/valla/escombros) y VFX
    (llama/humo) se conservan intactos.
    """
    skip_prefixes = ("flame_", "fire_", "scaffold_", "debris_", "barrier_")
    scorch = np.array([0.26, 0.22, 0.20], dtype=np.float32)
    feather = 0.0
    rise = 0.0
    fall = 0.0
    if region is not None:
        span = max(region["x"]["max"] - region["x"]["min"], region["y"]["max"] - region["y"]["min"], 1.0)
        feather = max(1.4, min(3.4, 0.45 * span))
        # El trecho vertical lo mide la propia caja del daño (el piso quemado), no la envoltoria:
        # la envoltoria incluye la pluma de humo, que no es superficie y no tiene nada que tiznar.
        height = max(1.0, region["z"]["max"] - region["z"]["min"])
        rise = max(1.2, min(2.6, 0.45 * height))
        fall = max(1.2, feather * 0.55)
    seen = set()
    scorched = 0
    skipped = 0
    peaks = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name in seen:
                continue
            seen.add(material.name)
            if material.name.startswith(skip_prefixes):
                skipped += 1
                continue
            tree = material.node_tree
            bsdf = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf is None:
                skipped += 1
                continue
            family = (family_of(material.name) if family_of else None) or "default"
            peak = min(SOOT_CAP, strength * SOOT_FAMILY_BIAS.get(family, SOOT_FAMILY_BIAS["default"]))
            peaks[family] = round(peak, 3)
            tint = np.clip(scorch * peak + np.ones(3, dtype=np.float32) * (1.0 - peak), 0.0, 1.0)
            base = bsdf.inputs["Base Color"]
            mix = tree.nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs["Color2"].default_value = (*tint, 1.0)
            if region is not None:
                tree.links.new(_soot_field(tree, region, feather, rise, fall), mix.inputs["Fac"])
            else:
                mix.inputs["Fac"].default_value = 1.0
            if base.is_linked:
                tree.links.new(base.links[0].from_socket, mix.inputs["Color1"])
            else:
                mix.inputs["Color1"].default_value = (*base.default_value[:3], 1.0)
            tree.links.new(mix.outputs["Color"], base)
            scorched += 1
    return {
        "sootStrength": round(strength, 3),
        "localized": region is not None,
        "materialsScorched": scorched,
        "materialsSkipped": skipped,
        "coreOpacity": round(max(peaks.values()), 3) if peaks else 0.0,
        "familyPeaks": dict(sorted(peaks.items())),
        "scorchTintLinear": [round(float(value), 3) for value in scorch],
        **(
            {"fieldMeters": {"feather": round(feather, 3), "rise": round(rise, 3), "fall": round(fall, 3)}}
            if region
            else {}
        ),
        **(
            {"regionMeters": {axis: [region[axis]["min"], region[axis]["max"]] for axis in ("x", "y", "z")}}
            if region
            else {}
        ),
    }


def _authored_input(bsdf, name, fallback):
    """Valor real de un input del BSDF, aunque el import glTF lo haya cableado a un nodo.

    El importador de glTF cuelga `Base Color`/`Emission Color` de un RGB y `Emission Strength` de un
    Value antes de escribirlos en el default. Leer sólo `default_value` devolvía el color de fábrica
    (blanco / 1.0) y reescalar sobre eso borraba el gradiente que el módulo trae autorado.
    """
    socket = bsdf.inputs.get(name)
    if socket is None:
        return fallback
    if socket.is_linked:
        node = socket.links[0].from_node
        if node.type == "VALUE":
            return float(node.outputs[0].default_value)
        if node.type in ("RGB", "RGBA"):
            return tuple(node.outputs[0].default_value)
    if socket.type == "VALUE":
        return float(socket.default_value)
    return tuple(socket.default_value)


# El difuso de la llama se apaga, no se borra: con el albedo naranja que dejó el control, la luz clave
# sumaba una capa clara por encima de la emisión y ese era el blanco del pico medido (255,255,165).
FLAME_BASE_ALBEDO = 0.16


def boost_flame_emission(objects, peak_strength):
    """FASE 3.4: sube la llama conservando el gradiente de zonas que el módulo ya trae autorado.

    El control escribía el MISMO `Emission Strength` en todos los materiales `flame_` y elegía el
    color por un sufijo `_inner` que ya no existe; con núcleo/cuerpo/borde el resultado volvía a ser
    una masa naranja plana. Aquí se lee la emisión con la que cada zona fue esculpida y todas se
    reescalan por el mismo factor, así que `peak_strength` manda sobre la más caliente y el resto cae
    proporcionalmente detrás: amarillo dentro, naranja en el cuerpo, rojo en el filo.

    Sólo toca materiales `flame_` (VFX); el humo (`fire_smoke_*`) y el hollín del edificio viven en
    otros pases a propósito: que la columna no se vea afectada por lo que haga el fuego es parte de
    que se lean como dos cosas distintas.
    """
    zones = []
    seen = set()
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name in seen or not material.name.startswith("flame_"):
                continue
            seen.add(material.name)
            bsdf = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bsdf is None:
                continue
            base = _authored_input(bsdf, "Base Color", (1.0, 0.45, 0.10, 1.0))
            color = _authored_input(bsdf, "Emission Color", None) or base
            zones.append(
                {
                    "material": material.name,
                    "bsdf": bsdf,
                    "tree": material.node_tree,
                    "color": tuple(color[:3]),
                    "authored": _authored_input(bsdf, "Emission Strength", 0.0),
                }
            )
    if not zones:
        return {"flamePeakEmission": peak_strength, "flameMaterials": 0, "flameZones": []}
    authored_peak = max(zone["authored"] for zone in zones) or 1.0
    scale = peak_strength / authored_peak
    for zone in zones:
        # Desenlazar antes de escribir: si el Value del import sigue mandando, el default no se entera.
        for name in ("Base Color", "Emission Color", "Emission Strength"):
            socket = zone["bsdf"].inputs.get(name)
            if socket is not None:
                for link in list(socket.links):
                    zone["tree"].links.remove(link)
        strength = zone["authored"] * scale if zone["authored"] > 0.0 else peak_strength
        zone["bsdf"].inputs["Base Color"].default_value = (
            *np.array(zone["color"], dtype=np.float32) * FLAME_BASE_ALBEDO,
            1.0,
        )
        if "Emission Color" in zone["bsdf"].inputs:
            zone["bsdf"].inputs["Emission Color"].default_value = (*zone["color"], 1.0)
        if "Emission Strength" in zone["bsdf"].inputs:
            zone["bsdf"].inputs["Emission Strength"].default_value = strength
        zone["applied"] = strength
    return {
        "flamePeakEmission": round(peak_strength, 3),
        "flameEmissionScale": round(scale, 3),
        "flameMaterials": len(zones),
        "flameBaseAlbedo": FLAME_BASE_ALBEDO,
        "flameZones": [
            {
                "material": zone["material"],
                "authoredStrength": round(zone["authored"], 3),
                "appliedStrength": round(zone["applied"], 3),
                "emissionColorLinear": [round(float(value), 3) for value in zone["color"]],
            }
            for zone in zones
        ],
    }


VFX_SHADOW_PREFIXES = ("flame_", "fire_smoke_")


def clear_vfx_shadow_rays(objects):
    """Las lenguas y la columna no tapian la luz: son volumen emisivo/transparente, no opacidad.

    Medido en la pasada F (nave nocturna): el rig SUN seguía proyectando la malla de la llama sobre el
    forjado y abría una cuña negra exactamente debajo del fuego, que es el único suelo que el incendio
    tiene que iluminar; el humo añadía su banda encima. La cuota de `apply_fire_glow` no lo arregla:
    una luz nueva no borra la sombra que tira la luz vieja. Se apaga el rayo de sombra por objeto, no
    el material, así que el albedo, la emisión y el pase de hollín siguen midiendo lo mismo (§32).
    """
    cleared = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        names = [slot.material.name for slot in obj.material_slots if slot.material is not None]
        if any(name.startswith(VFX_SHADOW_PREFIXES) for name in names):
            obj.visible_shadow = False
            cleared.append(obj.name)
    return {"vfxShadowRaysOff": len(cleared), "vfxObjects": cleared}


# D-111.2 FASE 3.5: el incendio alumbra. Hasta aquí las llamas eran mallas con emisión y la escena
# seguía iluminada sólo por el rig SUN del mood, así que de noche el fuego no dejaba luz en ninguna
# parte: una lengua muy brillante sobre una fachada que no se enteraba. Abajo no hay vatios a mano,
# hay una CUOTA: se pide que a `FIRE_GLOW_REACH_M` del foco el fuego aporte la misma irradiancia que
# la clave del mood, y la potencia se despeja de la ley del inverso del cuadrado
# (E = P / 4πd² → P = E · 4πd²). Por eso el mismo código da una vela de día (key 4,2 W/m²) y un
# brasero de noche (key 2,35) sin que nadie haya escrito dos constantes.
FIRE_GLOW_SHARE = 1.25
FIRE_GLOW_REACH_M = 2.5
FIRE_GLOW_COLOUR = (1.0, 0.47, 0.22)
# Como mucho dos luces: con una por cada foco de la nave larga, las colas de 1/d² se suman en el
# centro del alzado y vuelven a planchar lo que el gradiente de zonas acaba de separar.
FIRE_GLOW_MAX_LIGHTS = 2
# Frente por debajo del cual un solo foco basta: por encima, la llama se lee como dos hogueras y una
# bombilla en el centro no cae sobre ninguna de las dos.
FIRE_GLOW_SPREAD_M = 4.0
# Altura de la bombilla dentro del foco, en fracción del propio bulto de la llama. Con 0,55 (medido en
# la pasada E) la luz colgaba a 1,1–1,8 m del forjado y, por la ley del cuadrado, quemaba un agujero
# blanco en el suelo justo debajo del fuego; a 0,85 vive entre las puntas de las lenguas, que es donde
# tiene que estar: alumbra el pretil, el paño de alrededor y el interior de la pluma.
FIRE_GLOW_HEIGHT_FRACTION = 0.85
FIRE_GLOW_SOFT_M = 0.35


def fire_glow_groups(flames, spread_limit=FIRE_GLOW_SPREAD_M, max_lights=FIRE_GLOW_MAX_LIGHTS):
    """Agrupa los focos declarados en los centros de luz que hacen falta, ni uno más.

    El eje del frente es el que más se abre entre las posiciones de las lenguas; si el incendio no
    tiene ese reparto (una sola hoguera, o un puñado de ventanas) devuelve un único grupo.
    """
    axis = 0
    spans = [
        max(a["position"][i] for a in flames) - min(a["position"][i] for a in flames) for i in (0, 1)
    ]
    if spans[1] > spans[0]:
        axis = 1
    if len(flames) < 3 or spans[axis] <= spread_limit or max_lights < 2:
        return [flames]
    ordered = sorted(flames, key=lambda a: a["position"][axis])
    half = len(ordered) // 2
    return [ordered[:half], ordered[half:]]


def apply_fire_glow(flames, key_energy):
    """Coloca las luces del incendio y publica de dónde salió cada vatio.

    Se deriva TODO de `fireAnchors` (la lista ya rotada que publica el compositor) y de la energía de
    la clave del mood: la posición es el centroide del grupo de lenguas, la cota es la fracción
    `FIRE_GLOW_HEIGHT_FRACTION` de su propio bulto y la potencia la cuota del párrafo de arriba. Un
    edificio sin focos no entra aquí, y uno con los focos más bajos no puede encender una bombilla a 4 m.
    """
    if not flames or key_energy <= 0.0:
        return [], {"lights": 0, "reason": "sin focos declarados"}
    watts = key_energy * FIRE_GLOW_SHARE * 4.0 * math.pi * FIRE_GLOW_REACH_M**2
    lamps = []
    for group in fire_glow_groups(flames):
        position = (
            sum(a["position"][0] for a in group) / len(group),
            sum(a["position"][1] for a in group) / len(group),
            sum(
                a["zRangeMeters"][0]
                + FIRE_GLOW_HEIGHT_FRACTION * (a["zRangeMeters"][1] - a["zRangeMeters"][0])
                for a in group
            )
            / len(group),
        )
        bpy.ops.object.light_add(type="POINT", location=position)
        lamp = bpy.context.object
        lamp.name = f"fire_glow_{len(lamps)}"
        lamp.data.energy = watts
        lamp.data.color = FIRE_GLOW_COLOUR
        # Sombra activa: sin ella la bombilla atravesaría el muro de la planta en pie y iluminaría la
        # calle por detrás del edificio, que es la manera más rápida de que el sprite mienta.
        lamp.data.use_shadow = True
        lamp.data.shadow_soft_size = FIRE_GLOW_SOFT_M
        lamp.data.use_custom_distance = True
        lamp.data.cutoff_distance = FIRE_GLOW_REACH_M * 3.0
        lamps.append(lamp)
    return lamps, {
        "lights": len(lamps),
        "wattsEach": round(watts, 1),
        "keyEnergyReference": round(float(key_energy), 3),
        "shareOfKey": FIRE_GLOW_SHARE,
        "reachMeters": FIRE_GLOW_REACH_M,
        "cutoffMeters": round(FIRE_GLOW_REACH_M * 3.0, 2),
        "softSizeMeters": FIRE_GLOW_SOFT_M,
        "colourLinear": [round(float(value), 3) for value in FIRE_GLOW_COLOUR],
        "heightFractionOfFlame": FIRE_GLOW_HEIGHT_FRACTION,
        "shadowCasting": True,
        "focos": len(flames),
        "posiciones": [
            [round(value, 2) for value in lamp.location] for lamp in lamps
        ],
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


def strip_baked_vertex_lighting(objects, path):
    """Quita el vertex lighting horneado de las fuentes CC0 antes de que doble sombree el paño.

    Medido en la fuente real (〔D-111.3-T FASE 1〕, `Brick_Plain_3.gltf` del export "glTF (Godot)"
    del MegaKit): el atributo `COLOR_0` guarda la iluminación horneada de la escena original de
    Godot — la fila inferior de vértices vale (0, 0.126, 0.126), verde-azulada casi negra, y el
    resto blanco. El importador de glTF conecta ese COLOR_0 a `Base Color` mediante un MULTIPLY
    (〔§11〕 lo documentaba para alcanzar el atlas), así que cada panel de ladrillo llega con una
    banda degradada negro-verdosa propia, independiente del rig de luz: la franja que el
    propietario rechazó. El laboratorio de fachada (scripts/d1113t-facade-lab.py) demostró que la
    banda persiste con las sombras de la key apagadas y con cornisas, losas y paneles sin
    proyectar: no es sombra proyectada ni tinte del ambiente, es esta multiplicación.

    La corrección es geométricamente neutra: no toca vértices ni UVs; desconecta el MULTIPLY
    dejando el atlas como única fuente de color y elimina el atributo de color horneado. El rig
    de tres luces y el tratamiento externo (§11) siguen decidiendo la sombra, ahora una sola vez.
    Sólo actúa cuando el color de vértice entra por un MIX MULTIPLY con factor constante: si otro
    grafo usara COLOR_0 con intención de diseño, se queda intacto.
    """
    for obj in objects:
        if obj.type != "MESH":
            continue
        layers = set()
        for material in obj.data.materials:
            tree = material.node_tree if material and material.use_nodes else None
            if tree is None:
                continue
            for node in [n for n in tree.nodes if n.type == "VERTEX_COLOR"]:
                outputs = node.outputs
                color_out = next((s for s in outputs if s.type == "RGBA"), None)
                if color_out is None or not color_out.links:
                    tree.nodes.remove(node)
                    continue
                bypassed = True
                for link in list(color_out.links):
                    mix = link.to_node
                    if mix.type != "MIX" or getattr(mix, "blend_type", None) != "MULTIPLY":
                        bypassed = False
                        continue
                    factor = mix.inputs[0]
                    if factor.is_linked or abs(factor.default_value - 1.0) > 1e-4:
                        bypassed = False
                        continue
                    sources = [
                        s
                        for s in mix.inputs
                        if s.type == "RGBA" and s.is_linked and s != link.to_socket
                    ]
                    outs = [s for s in mix.outputs if s.type == "RGBA" and s.is_linked]
                    if len(sources) != 1 or len(outs) != 1:
                        bypassed = False
                        continue
                    source_socket = sources[0].links[0].from_socket
                    for out_link in list(outs[0].links):
                        tree.links.new(source_socket, out_link.to_socket)
                    tree.nodes.remove(mix)
                if bypassed:
                    layers.add(node.layer_name)
                    tree.nodes.remove(node)
        if not layers:
            continue
        for attr in list(obj.data.attributes):
            if attr.data_type in ("BYTE_COLOR", "FLOAT_COLOR") and attr.name in layers:
                obj.data.attributes.remove(attr)
        print(f"strip_baked_vertex_lighting: {obj.name} ← {Path(path).name} (COLOR_0 horneado retirado)")


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
    strip_baked_vertex_lighting(objects, path)
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
        # `scale` lo firma la composición (FASE 3: llamas y humo de tamaños distintos) y vive en el
        # empty, no en la malla: `mesh_fingerprint` sigue demostrando que ningún vértice se tocó y
        # §32 sigue comparando la caja firmada contra la caja medida en escena.
        scale = record.get("scale", 1.0)
        sx, sy, sz = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
        if record.get("mirrorX"):
            sx = -sx
        empty.scale = (sx, sy, sz)
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
        for family in sorted(set(SUPPORT_PALETTE.values()) | {"plaster"})
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


def add_architectural_details(composition, materials, root):
    """Construye la geometría original neutral firmada por compose.py.

    No hay color de organización: la placa y su rombo hundido son materiales neutros. La capa web
    puede pintar el rombo después, sin volver a hornear cuatro juegos de texturas.
    """
    created = []
    for detail in composition.get("architecturalDetails", []):
        origin = Vector(detail["position"])
        angle = math.radians(detail["rotationDegrees"])
        cosine, sine = round(math.cos(angle), 12), round(math.sin(angle), 12)

        def world(point):
            x, y, z = point
            return origin + Vector((x * cosine - y * sine, x * sine + y * cosine, z))

        for part in architectural_details.parts_for(detail):
            label = f"detail:{detail['id']}:{part['name']}"
            material = materials[part["material"]]
            if part["shape"] == "box":
                obj = runtime.cube(
                    label,
                    world(part["center"]),
                    part["size"],
                    material,
                    rotation=(0.0, 0.0, angle),
                )
            else:
                mesh = bpy.data.meshes.new(label)
                mesh.from_pydata([world(vertex) for vertex in part["vertices"]], [], part["faces"])
                mesh.update()
                obj = bpy.data.objects.new(label, mesh)
                bpy.context.collection.objects.link(obj)
                obj.data.materials.append(material)
            obj.parent = root
            obj.matrix_parent_inverse = root.matrix_world.inverted()
            created.append(obj)
    return created


def check_scene_geometry(composition, objects):
    """§15/§31: los triángulos y la envolvente que ve el render son los que declaró la gramática."""
    # Las mallas de soporte se acaban de crear; el view layer sólo las expone tras sincronizarse.
    bpy.context.view_layer.update()
    linked = {obj.name for obj in bpy.context.view_layer.objects}
    orphans = [obj.name for obj in objects if obj.type == "MESH" and obj.name not in linked]
    if orphans:
        raise SceneError(
            "§15: mallas fuera de la colección activa; no se pueden contar como geometría renderizada: "
            + ", ".join(orphans[:6])
        )
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
    density = profile.pixels_per_meter * composition.get("renderScale", 1)
    return {
        "projectedWidthMeters": round(horizontal, 3),
        "projectedHeightMeters": round(vertical, 3),
        "marginUsed": margin,
        "pixelsPerMeter": density,
        "orthoScale": ortho_scale,
        "canvasPixels": [int(round(width_meters * density)), int(round(height_meters * density))],
    }


def deterministic_crop_rect(composition, scene, camera, style_layer, width, height):
    """Rect de recorte determinista en píxeles del lienzo: bounding box proyectado del edificio ∪ su sombra.

    §8 exige que dimensiones y pivot del sprite publicado sean reproducibles entre procesos. El recorte
    por bounding box de alpha no lo es: la cobertura AA de EEVEE Next jittera ±1 LSB en el borde, la
    columna extrema entra y sale del umbral, y la corrección de paridad de `trim_and_scale` amplifica el
    ±1 a ±2 píxeles. Aquí la caja se deriva SOLO de cantidades deterministas —los bounds de composición,
    la matriz de la cámara y la posición de la key light—, nunca del raster.

    Se proyectan las 8 esquinas del volumen y las 8 sombras de esas esquinas sobre el plano z=0 (rayo
    desde la key light) y se toman los extremos en píxeles, sin ajuste de paridad en este nivel.

    La paridad la aplica `trim_and_scale` según su supersample efectivo y no aquí: este rect se recorta
    de nuevo contra el lienzo, y un ajuste de paridad previo con fallback erróneo colapsó el recorte a
    1 px cuando la caja saturada (una sombra cuyo punto de fuga sale del lienzo) tenía lado impar —
    fue el fallo §18 del clinic a renderScale 2.
    """
    light = Vector(active_mood(style_layer)["lighting"]["keyPosition"])
    points = list(box_corners(composition["bounds"]))
    for corner in box_corners(composition["bounds"]):
        direction = corner - light
        if abs(direction.z) < 1e-6:
            continue
        t = -corner.z / direction.z
        if t > 0:
            points.append(corner + direction * t)
    columns = []
    rows = []
    for point in points:
        view = world_to_camera_view(scene, camera, point)
        columns.append(view.x * width)
        rows.append(view.y * height)  # v desde el borde inferior, igual que el array de `pixels`.
    col_min = max(0, math.floor(min(columns)))
    col_hi = min(width, math.ceil(max(columns)))
    row_min = max(0, math.floor(min(rows)))
    row_hi = min(height, math.ceil(max(rows)))
    return col_min, row_min, col_hi, row_hi


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


def organization_badges(composition, scene, camera, trim):
    """Anclas de imagen de las placas neutrales; el color/emblema pertenece al renderer.

    Se proyectan los cuatro extremos del rombo real, no una caja aproximada del edificio. Así el
    overlay QA usa exactamente el hueco hornedo y puede elegir la placa visible (frontal o trasera).
    """
    visible_sides = {"front", "right"}
    sides = {value: key for key, value in anchors.SIDE_OUTWARD_DEGREES.items()}
    badges = []
    for detail in composition.get("architecturalDetails", []):
        if detail["kind"] != "organization_badge":
            continue
        center = Vector(detail["badgeCenter"])
        half_w = float(detail["badgeWidthMeters"]) / 2.0
        half_h = float(detail["badgeHeightMeters"]) / 2.0
        projected = []
        for point in ((-half_w, 0.0, 0.0), (0.0, 0.0, half_h), (half_w, 0.0, 0.0), (0.0, 0.0, -half_h)):
            local = architectural_details.rotate_local(point, detail["rotationDegrees"])
            world = center + Vector(local)
            projected.append(to_final_pixels(world_to_camera_view(scene, camera, world), trim))
        anchor = to_final_pixels(world_to_camera_view(scene, camera, center), trim)
        side = sides.get(detail["outwardDegrees"], "oblicuo")
        badges.append(
            {
                "detailId": detail["id"],
                "mount": detail["mount"],
                "side": side,
                "doubleSided": bool(detail.get("doubleSided")),
                "visible": bool(detail.get("doubleSided")) or side in visible_sides,
                "anchor": {"x": round(anchor[0], 5), "y": round(anchor[1], 5)},
                "widthPixels": round(
                    (max(point[0] for point in projected) - min(point[0] for point in projected))
                    * trim["final"]["width"],
                    3,
                ),
                "heightPixels": round(
                    (max(point[1] for point in projected) - min(point[1] for point in projected))
                    * trim["final"]["height"],
                    3,
                ),
                "widthMeters": detail["badgeWidthMeters"],
                "heightMeters": detail["badgeHeightMeters"],
                "physicalOrientationDegrees": int(composition.get("orientation", 0)),
                "bakedOrganizationColor": None,
            }
        )
    return badges


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
                "primary": len(record["purpose"].split(":")) == 2,
            }
        )
    for detail in composition.get("architecturalDetails", []):
        if not detail["purpose"].startswith("access:"):
            continue
        side = sides.get(detail["outwardDegrees"], "oblicuo")
        access.append(
            {
                "purpose": detail["purpose"],
                "moduleId": None,
                "detailId": detail["id"],
                "frontAxis": None,
                "rotationDegrees": detail["rotationDegrees"],
                "outwardDegrees": detail["outwardDegrees"],
                "side": side,
                "visible": side in visible_sides,
                "primary": bool(detail.get("primaryAccess", False)),
            }
        )
    orientation = int(composition.get("orientation", 0))
    state = composition.get("state", "complete")
    stage = composition.get("constructionStage")
    if not access:
        # V.j: la obra en foundation/structure aún no coloca acceso; no hay puerta que probar.
        if state == "construction" and stage in ("foundation", "structure"):
            return {
                "cameraAzimuthDegrees": round(azimuth, 2),
                "cameraElevationDegrees": round(elevation, 2),
                "visibleSides": sorted(visible_sides),
                "frontSideOfFrame": "-Y",
                "physicalOrientationDegrees": orientation,
                "access": [],
                "allAccessVisible": True,
                "anyAccessVisible": False,
                "primaryAccessVisible": False,
                "visibleAccessCount": 0,
                "evidence": f"obra en etapa {stage}: aún no hay acceso; cámara canónica validada",
            }
        raise SceneError("§19: la composición no coloca ningún acceso: no hay forma de probar el frente")
    hidden = [item["purpose"] for item in access if not item["visible"]]
    hidden_primary = [item["purpose"] for item in access if item["primary"] and not item["visible"]]
    # A 0° el acceso PRINCIPAL debe mirar a cámara. Los accesos de servicio pueden estar detrás:
    # son precisamente los que hacen visible la sede a 180°/270°. Antes esta puerta exigía que
    # todos los accesos fueran visibles y por ello una segunda puerta real era imposible.
    if hidden_primary and orientation == 0:
        raise SceneError(
            "§18: la puerta principal mira a un lado no visible desde la cámara canónica: "
            + ", ".join(hidden_primary)
        )
    return {
        "cameraAzimuthDegrees": round(azimuth, 2),
        "cameraElevationDegrees": round(elevation, 2),
        "visibleSides": sorted(visible_sides),
        "frontSideOfFrame": "-Y",
        "physicalOrientationDegrees": orientation,
        "access": access,
        "allAccessVisible": not hidden,
        "anyAccessVisible": any(item["visible"] for item in access),
        "primaryAccessVisible": any(item["primary"] and item["visible"] for item in access),
        "visibleAccessCount": sum(1 for item in access if item["visible"]),
        "evidence": (
            "frente -Y, azimut 45°: la normal de cada acceso se mide desde frontAxis+giro"
            if orientation == 0
            else f"orientación física {orientation}°: vista real girada; el acceso puede no ser visible"
        ),
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
            if name.startswith(("flame_", "fire_")):
                # V.j: VFX emisivo con color propio intencional (llama naranja, humo gris); no es albedo
                # del edificio y no pasa por la paleta civic. Se documenta como rama propia, no untreated.
                path = "vfx-emisivo"
                untreated = 0
            elif path == "plano":
                untreated = 0 if (flat_rule_matches(name, treatment) or name in flat_done) else 1
            variants.append(
                {
                    "moduleId": module.id,
                    "material": name,
                    "family": profile.material_family.get(authored_material_name(name)),
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
    """Un candidato: request → composición (complete/construction/damaged/burning) → escena tratada
    → PNG + metadata (§24/§31). V.j: los estados no-complete derivan geometría real del compositor."""
    started = time.perf_counter()
    catalog = catalog or Catalog()
    profile = profile or StyleProfile(request["styleProfileId"])
    document = document or GrammarDocument()
    style_layer = style_layer or json.loads(
        (BLENDER_DIR / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    treatment = active_mood(style_layer)["externalTreatment"]
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
    original_materials = support_materials(profile)
    objects += add_supports(composition, original_materials, root)
    objects += add_architectural_details(composition, original_materials, root)
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
    material_experiment = None
    if profile.id == "material_maquette_buildings_v1":
        material_experiment = apply_material_maquette_pbr(
            groups, composition["buildingType"], composition["family"]
        )
    # D-111 WP04: tier de conservación/envejecimiento opt-in. Sin `request["weathering"]` no se lee ni
    # el contrato, así que los sprites aprobados del catálogo se siguen dibujando igual.
    weathering_block = weathering.project(
        request,
        objects,
        family_of=lambda name: profile.material_family.get(authored_material_name(name)),
        mood_id=active_mood_id(style_layer),
        profile_families=set(profile.material_family.values()),
    )
    # V.j: hollín sobre el albedo ya tratado para los estados de daño/fuego (no afecta al complete).
    state = composition.get("state", "complete")
    damage_treatment = None
    glow_lamps = []
    if state in ("damaged", "burning"):
        # D-111 WP04: el tier de daño también cambia MATERIAL, no sólo geometría. Sin publicar lo que
        # devuelven estos dos pases la evidencia diría "estado damaged" pero no qué se oscureció ni con qué fuerza.
        damage_treatment = {
            "soot": apply_soot(
                objects,
                0.7 if state == "burning" else 0.45,
                region=composition.get("damageRegion"),
                family_of=lambda name: profile.material_family.get(authored_material_name(name)),
            )
        }
        if state == "burning":
            # Pico 1,35 en vez del 2,0 del control: con la escala del módulo (núcleo 2,6) el AgX del
            # view transform desaturaba el centro hasta recortarlo a (255,255,165) de día. La cifra se
            # vuelve a medir en la hoja A/B de FASE 3, no se da por buena por docstring.
            # D-111.2 cierre: `qaFlamePeakEmission` es el mando de la variante QA híbrida —el sprite
            # baja sus focos estáticos y el cuerpo animado del fuego lo pone Phaser—. Sólo llega por
            # request explícito del arnés; producción no envía el campo y renderiza 1,35.
            damage_treatment["flames"] = boost_flame_emission(
                objects, float(request.get("qaFlamePeakEmission") or 1.35)
            )
            damage_treatment["vfx"] = clear_vfx_shadow_rays(objects)
            glow_lamps, damage_treatment["glow"] = apply_fire_glow(
                [
                    anchor
                    for anchor in composition.get("fireAnchors", [])
                    if anchor["purpose"] == "fire:flame"
                ],
                active_mood(style_layer)["lighting"]["keyEnergy"],
            )

    scene.render.engine = "BLENDER_EEVEE"
    # §13 también muerde al rasterizador. El test de regeneración encontró dos procesos con la misma
    # firma, el mismo encuadre y los mismos materiales produciendo PNGs distintos: el pase de sombra
    # había tardado 55 s en vez de 131 s. Con la reproyección TAA activa, cuántas muestras caben en el
    # tiempo que tarda el render depende de la máquina, así que la acumulación no es reproducible entre
    # procesos. Se fija el muestreo y se congela el historial; el número de muestras se escribe aquí
    # aunque hoy sea el default de fábrica, para que un cambio de default no cuele aleatoriedad.
    scene.eevee.use_taa_reprojection = False
    default_samples = 96 if material_experiment else 64
    taa_samples = int(request.get("taaSamples", default_samples))
    if not 1 <= taa_samples <= 128:
        raise SceneError(f"§13: taaSamples fuera de [1,128]: {taa_samples}")
    scene.eevee.taa_render_samples = taa_samples
    if material_experiment:
        scene.eevee.use_raytracing = True
    scene.render.use_persistent_data = True
    # V.i quality pass: con renderScale 2 el supersample efectivo baja a 1 para que el presupuesto
    # absoluto de píxeles (pase principal + sombra 3×) no crezca con la densidad final; el AA lo
    # aportan las 64 muestras TAA a resolución final. La sombra mantiene 3× el pase principal.
    supersample = max(1, round(runtime.SUPERSAMPLE / composition.get("renderScale", 1)))
    scene.render.resolution_x = frame["canvasPixels"][0] * supersample
    scene.render.resolution_y = frame["canvasPixels"][1] * supersample
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    apply_render_settings(scene, style_layer)

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
    render_pass = pixels_digest(render_path)
    shadow_style = active_mood(style_layer).get("shadow", {})
    shadow_path = output.with_suffix(".shadow.png")
    # La segunda pasada pinta un plano blanco y saca de ahí la sombra del rig. Si el incendio sigue
    # encendido, su luz cálida cae sobre el plano y el detector lee menos oscuridad: el sprite saldría
    # con la sombra más tenue según lo alto que arda. Se apagan para el pase de suelo y se vuelven a
    # encender después, porque lo que se promociona es el pase principal.
    glow_watts = [lamp.data.energy for lamp in glow_lamps]
    for lamp in glow_lamps:
        lamp.data.energy = 0.0
    shadow = runtime.render_shadow_pass(scene, style_layer, ground["lowestZMeters"], shadow_path)
    for lamp, watts in zip(glow_lamps, glow_watts):
        lamp.data.energy = watts
    # Los dos pases se firman por separado y en píxeles: si §13 vuelve a fallar, la metadata tiene que
    # decir si se movió el albedo, la sombra o sólo la composición de ambos. Con el sha del fichero no
    # se puede distinguir un defecto del compositor de uno del rasterizador, porque el contenedor PNG
    # ya difiere de por sí.
    shadow["renderPixels"] = render_pass
    shadow["pixels"] = pixels_digest(shadow_path)
    crop_rect = deterministic_crop_rect(
        composition, scene, camera, style_layer,
        scene.render.resolution_x, scene.render.resolution_y,
    )
    trim = runtime.trim_and_scale(render_path, output, shadow_path, shadow_style, crop_rect, supersample=supersample)
    render_path.unlink(missing_ok=True)
    shadow_path.unlink(missing_ok=True)

    pivot, pivot_check = pivot_and_validator(scene, camera, trim, composition)
    orientation = orientation_status(composition, catalog, camera, target)
    badges = organization_badges(composition, scene, camera, trim)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    final_pixels = pixels_digest(output)
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
        "state": composition.get("state", "complete"),
        "constructionStage": composition.get("constructionStage"),
        "orientation": composition.get("orientation", 0),
        "variantSeed": composition["variantSeed"],
        "composerVersion": composition["composerVersion"],
        "styleProfileId": composition["styleProfileId"],
        # El mood no se deduce del artefacto: day_industrial hereda de day_civic y sólo cambia dos
        # bandas, así que sin este campo el manifiesto runtime dependería del prefijo del archivo.
        "moodId": active_mood_id(style_layer),
        "materialExperiment": material_experiment,
        "compositionSignature": composition["compositionSignature"],
        "axisChoices": composition["axisChoices"],
        "footprintCells": composition["footprintCells"],
        "footprintMeters": composition["footprintMeters"],
        "floors": composition["levels"],
        "bounds": composition["bounds"],
        "envelopeMeters": composition["envelopeMeters"],
        "volumes": composition["volumes"],
        "transforms": composition["placements"],
        # FASE 3 → FASE 4: el incendio como datos, no como píxel horneado. `damageRegion` es la caja
        # del hueco que abrió la sección y `fireAnchors` la lista de focos en metros, ambos en el
        # marco ya rotado; el laboratorio de Phaser ancla ahí sus emisores en vez del desplazamiento
        # universal `y − 26 px` que usa hoy. Se publican en la raíz aunque `damageTreatment.soot`
        # también lleve la caja: la primera es contrato para el runtime, la segunda es el parte del
        # pase de material.
        **({"damageRegion": composition["damageRegion"]} if composition.get("damageRegion") else {}),
        **({"fireAnchors": composition["fireAnchors"]} if composition.get("fireAnchors") else {}),
        "originalSupport": composition["originalSupport"],
        "architecturalDetails": composition.get("architecturalDetails", []),
        "organizationBadges": badges,
        "modules": sorted({record["moduleId"] for record in composition["placements"]}),
        "sourceIds": sorted(
            {record["sourceId"] for record in composition["placements"]}
            | ({architectural_details.SOURCE_ID} if composition.get("architecturalDetails") else set())
        ),
        "sourcePaths": sorted(
            {record["sourcePath"] for record in composition["placements"]}
            | ({architectural_details.SOURCE_PATH} if composition.get("architecturalDetails") else set())
        ),
        "licenses": sorted(
            {record["license"] for record in composition["placements"]}
            | ({architectural_details.LICENSE} if composition.get("architecturalDetails") else set())
        ),
        "materialVariants": variants,
        # WP04: `litWindows`/`emissiveTexels` dicen si el compositor cableó de verdad la ruta de
        # emisión de ventana. Sin este bloque la evidencia nocturna afirmaba «el cristal sucio deja
        # salir menos luz» sin poder comprobarlo: el brillo puede viajar por Base Color (pase plano)
        # y entonces ninguna escala de emisión llega al raster.
        "externalTreatment": direct,
        "weathering": weathering_block,
        "damageTreatment": damage_treatment,
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
        # `sha256` es integridad del artefacto publicado (§24); `pixelSha256` es la firma con la que
        # §13 compara dos procesos. Los dos números son necesarios y no significan lo mismo.
        "pixelSha256": final_pixels["sha256"],
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

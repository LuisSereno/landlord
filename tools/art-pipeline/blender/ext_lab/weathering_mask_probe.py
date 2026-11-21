"""Medidor de máscaras de envejecimiento (D-111 WP04).

La primera corrida del tier `aged` sobre `mixed_tenement` 1001 sí produjo un sprite distinto del
control (media |Δ| = 8,1/255 sobre píxel sólido, 9,6 % del lienzo moviéndose más de 16), pero la
MEDIANA era 0 y el tono medio no se movía ni 1/255: la receta aportaba grano y juntas sin ensuciar
el paño. Un alzado que cambia de textura pero conserva el brillo de obra nueva no se lee como
envejecido, que es el criterio de cierre de WP04. La causa no se ve en el sprite final: está en la
distribución de la máscara contra la ventana del ramp, así que se mide aquí directamente.

Qué hace: monta un paño vertical de 16,00 × 12,00 m (x ∈ [-8,8], z ∈ [0,12], y = 0) — la caja de
frente que mide un mixed_tenement de huella 4×2 y 3 plantas — y le pone la receta de cada familia
sobre un gris de referencia. Cada paño se renderiza **sin luz y con el albedo conectado a emisión**:

  · `mask`: la máscara del contrato sola. Es el dato que explica el fallo — si la rampa corta por
    encima de la moda del ruido, la máscara vale 0 en casi todo el alzado.
  · `aged`: el color de base que sale del grafo tras `apply_material`, es decir mugre mezclada.

Conectar el albedo a emisión en vez de iluminarlo quita del medida dos variables que no son el
objeto de esta calibración (el HDRI del mood y el ángulo del sol) y deja el delta en las mismas
unidades de 8 bits que revisa §13. El control es el mismo paño con la receta desactivada, renderizado
una sola vez.

Las coordenadas son de ESPACIO MUNDO (`ShaderNodeNewGeometry.Position`), igual que en el render del
compositor: el paño se coloca a x=0, z=0..12 para que la rampa de gravedad y el tiling métrico
reciban los mismos valores que recibe un edificio real.

Salida: `evidence/v2/weathering/mask/<familia>_{mask,aged}.png` + `summary.json` con media,
percentiles, fracción de texels por encima de umbral y — la que decide — la fracción del alzado cuyo
delta contra el control supera la cota de ruido. Con eso se calibra el contrato, no a ojo.

Uso:
    BLENDER_USER_CONFIG=/tmp/d111-ext-lab/config/cfg \\
    BLENDER_USER_EXTENSIONS=/tmp/d111-ext-lab/config/ext \\
    blender_artist/toolchain/blender-5.2.2-linux-x64/blender -b --factory-startup -P \\
      tools/art-pipeline/blender/ext_lab/weathering_mask_probe.py -- --mood=day_civic
"""

import json
import sys
import time
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
TOOLS_DIR = HERE.parent
sys.path.insert(0, str(TOOLS_DIR))

# El búfer float del render sustituye al PNG en la medición: `check_style_layer.read_png_rgba`, el
# decodificador mínimo del repo, desplaza los filtros Sub y Paeth de a un byte en vez de a `bpp` y con
# un RGBA 8-bit (lo que escribe Blender) devuelve píxeles que no existen en la imagen.
from building_composer import weathering as W  # noqa: E402
from building_composer.module_catalog import REPO_ROOT  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402

EVIDENCE = REPO_ROOT / "docs/art/graphics-capabilities/evidence/v2/weathering/mask"
# Paño de 16 × 12 m: el frente medido de mixed_tenement 4×2 celdas × 3 plantas de 3,00 m.
WALL_METERS = (16.0, 12.0)
RESOLUTION = 512
REFERENCE_GRAY = (0.42, 0.42, 0.42)
# Cota de ruido del test de regeneración (§13): por debajo de 4/255 dos renders no se distinguen.
NOISE_FLOOR_8BIT = 4.0 / 255.0


def arg(name, default=None):
    tokens = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    for token in tokens:
        if token.startswith(f"--{name}="):
            return token.split("=", 1)[1]
    return default


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)


def unlit_albedo(tree, bsdf):
    """Saca el color de base tal como lo calcula el grafo: emisión 1:1, sin luz ni reflejos."""
    base = bsdf.inputs["Base Color"]
    original = tuple(base.default_value)
    if base.is_linked:
        tree.links.new(base.links[0].from_socket, bsdf.inputs["Emission Color"])
    else:
        # Sin enlace no hay grafo que leer: el propio valor plano ES el albedo (control y glass).
        bsdf.inputs["Emission Color"].default_value = original
    base.default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0


def wall_material(name, plan, family, mode):
    """Material de prueba: máscara sola (`mask`), albedo envejecido (`aged`) o gris sin tratar (`control`)."""
    material = bpy.data.materials.new(name)
    tree = material.node_tree
    bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*REFERENCE_GRAY, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    if mode == "control":
        unlit_albedo(tree, bsdf)
        return material
    if mode == "mask":
        recipe = plan.effective(family)
        if recipe["strength"] == 0.0:
            # `apply_material` no construye máscara con strength 0 (glass sólo ensucia rugosidad y
            # apaga emisión): la máscara de esa familia es literalmente cero en todo el alzado. Se
            # apaga también el color de emisión, que de fábrica es blanco y con fuerza 1 pintaría el
            # paño de un 1,0 que la receta no declara.
            bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
            bsdf.inputs["Emission Color"].default_value = (0.0, 0.0, 0.0, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 1.0
            return material
        geometry = tree.nodes.new("ShaderNodeNewGeometry")
        mask, _ = W.build_mask(tree, recipe, geometry.outputs["Position"])
        bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
        tree.links.new(mask, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
        return material
    W.apply_material(plan, material, lambda _name, value=family: value)
    unlit_albedo(tree, bsdf)
    return material


def add_wall(material):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(0.0, 0.0, WALL_METERS[1] / 2.0))
    wall = bpy.context.object
    wall.rotation_euler = (1.5707963267948966, 0.0, 0.0)
    wall.scale = (WALL_METERS[0], WALL_METERS[1], 1.0)
    wall.data.materials.append(material)
    return wall


def add_camera(scene):
    """Ortográfica mirando al +Y: la escala cubre los 16 m de ancho y, en lienzo cuadrado, 16 de alto."""
    camera_data = bpy.data.cameras.new("probe")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = WALL_METERS[0]
    camera = bpy.data.objects.new("probe", camera_data)
    scene.collection.objects.link(camera)
    camera.location = (0.0, -30.0, WALL_METERS[1] / 2.0)
    camera.rotation_euler = (1.5707963267948966, 0.0, 0.0)
    scene.camera = camera


def render_wall(material, png_path):
    """Un paño con `material`, sin luz, medido de frente. Devuelve (luminancia lineal, segundos).

    No limpia la escena: `clear_scene()` purga los materiales huérfanos y el que se pasa por
    argumento lo es hasta que se asigna al paño. Quien llama vacía antes de crear el material.

    Se mide el PNG recargado por Blender (`images.load` + `pixels`, el mismo patrón que firma los
    sprites en `scene.py:pixel_sha`), no el búfer `Render Result`: en modo background Blender lo
    reporta con tamaño 0×0 y no se puede leer. Tampoco se usa `check_style_layer.read_png_rgba`, el
    decodificador mínimo del repo, que desplaza los filtros Sub y Paeth de a un byte en vez de a
    `bpp` y con un RGBA 8-bit — que es lo que escribe Blender — devuelve píxeles que no están en la
    imagen.
    """
    add_wall(material)
    scene = bpy.context.scene
    add_camera(scene)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION
    scene.render.resolution_y = RESOLUTION
    scene.eevee.taa_render_samples = 16
    if hasattr(scene.eevee, "use_taa_reprojection"):
        scene.eevee.use_taa_reprojection = False
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    # Sin HDRI: el único contribuyente es la emisión del propio material. `world.light_settings` ya
    # no existe en 5.2; el fondo del mundo se apaga por su grafo de nodos.
    world = scene.world
    if world is not None and world.node_tree is not None:
        background = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
        if background is not None:
            background.inputs["Strength"].default_value = 0.0
    scene.render.filepath = str(png_path)
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    seconds = round(time.perf_counter() - started, 2)
    return read_render(png_path), seconds


def read_render(png_path):
    """RGB lineal del PNG recién escrito, en el orden de filas de la imagen (fila 0 = arriba).

    `image.pixels` de un PNG cargado en background entrega el valor **codificado**, no el lineal:
    medido con el control, el gris 0,42 lineal sale como 0,678 en el búfer y como 174/255 en el
    archivo, que es exactamente sRGB(0,42). Por eso se linealiza aquí explícitamente en vez de
    suponer que Blender ya lo hizo.
    """
    image = bpy.data.images.load(str(png_path))
    try:
        width, height = int(image.size[0]), int(image.size[1])
        buffer = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(buffer)
        display = buffer.reshape(height, width, 4)[::-1, :, :3]
        return srgb_to_linear(np.clip(display, 0.0, 1.0)).copy()
    finally:
        bpy.data.images.remove(image)


def wall_region(rgb):
    """Recorte a los píxeles del paño.

    La cámara ortográfica mide 16 m horizontales y, con un lienzo cuadrado, 16 m verticales: el paño
    ocupa 12 de esos 16 m centrado, así que las franjas de arriba y abajo son fondo negro y sesgarían
    cualquier media si entraran en la estadística. Se deja además un margen lateral de 1 celda para
    descartar el antialiasing del borde.
    """
    height, width = rgb.shape[:2]
    vertical = int(round(height * (1.0 - WALL_METERS[1] / WALL_METERS[0]) / 2.0))
    margin = max(1, int(round(width * 0.01)))
    return rgb[vertical : height - vertical, margin : width - margin, :]


def srgb_to_linear(display):
    return np.where(display <= 0.04045, display / 12.92, ((display + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(value):
    return np.where(
        value <= 0.0031308, value * 12.92, 1.055 * np.power(np.maximum(value, 0.0), 1.0 / 2.4) - 0.055
    )


def luminance(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def field_stats(field):
    """Estadística de la máscara lineal: el dominio donde `apply_material` hace la mezcla."""
    value = field.ravel()
    band = max(1, int(field.shape[0] * 0.15))
    return {
        "mean": round(float(value.mean()), 4),
        "p50": round(float(np.percentile(value, 50)), 4),
        "p90": round(float(np.percentile(value, 90)), 4),
        "p99": round(float(np.percentile(value, 99)), 4),
        "fractionOver0.10": round(float((value > 0.10).mean()), 4),
        "fractionOver0.25": round(float((value > 0.25).mean()), 4),
        "fractionOver0.50": round(float((value > 0.50).mean()), 4),
        # Cordura: la mugre tiene que pesar abajo. Si `top` sale mayor que `bottom` la rampa está invertida.
        "topRowMean": round(float(field[:band].mean()), 4),
        "bottomRowMean": round(float(field[-band:].mean()), 4),
    }


def delta_stats(field, control_field):
    """Qué vería una persona: delta de luminancia en unidades de 8 bits contra el control."""
    display = linear_to_srgb(np.clip(field, 0.0, 1.0))
    control_display = linear_to_srgb(np.clip(control_field, 0.0, 1.0))
    delta = (display - control_display).ravel()
    magnitude = np.abs(delta)
    mean_abs = float(magnitude.mean())
    # `toneVsTexture` es el diagnóstico que no da la media a secas: si el envejecimiento sólo añade
    # grano (manchas claras y oscuras que se promedian) el edificio cambia de textura pero sigue
    # teniendo el mismo tono y no se lee como usado. Por debajo de 0,4 es casi todo grano.
    tone_vs_texture = abs(float(delta.mean())) / mean_abs if mean_abs > 1e-6 else 0.0
    return {
        "meanDisplay": round(float(display.mean() * 255.0), 2),
        "controlDisplay": round(float(control_display.mean() * 255.0), 2),
        "meanSigned": round(float(delta.mean() * 255.0), 2),
        "meanAbs": round(mean_abs, 2),
        "maxAbs": round(float(magnitude.max()), 2),
        "toneVsTexture": round(tone_vs_texture, 2),
        "fractionAboveNoiseFloor": round(float((magnitude > NOISE_FLOOR_8BIT).mean()), 4),
        "fractionAbove16": round(float((magnitude > 16.0).mean()), 4),
    }


def measure(plan, family, mode, png_path):
    """Vacía, construye el paño de `mode` para `family`, renderiza y devuelve su luminancia lineal."""
    clear_scene()
    material = wall_material(f"probe_{family}_{mode}", plan, family, mode)
    rgb, seconds = render_wall(material, png_path)
    return luminance(wall_region(rgb)), seconds


def main():
    mood = arg("mood", "day_civic")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    contract = W.load_contract()
    profile = StyleProfile(contract["pins"]["styleProfileId"])
    plan = W.Plan(contract, "aged", mood, set(profile.material_family.values()))
    families = sorted(plan.recipes)

    control, control_seconds = measure(plan, "control", "control", EVIDENCE / "_control.png")
    # Autochequeo de la cadena de medición: el control es un valor que se conoce de antemano. Si no
    # vuelve, el dominio está mal (lineal vs codificado) y todos los deltas serían basura con pinta
    # de dato.
    if abs(float(control.mean()) - REFERENCE_GRAY[0]) > 0.01:
        raise RuntimeError(
            f"el control de {REFERENCE_GRAY[0]:.2f} lineal se lee {float(control.mean()):.3f}: "
            "la cadena de decodificación de `read_render` no está devolviendo lineal"
        )
    print(
        f"control gris {REFERENCE_GRAY[0]:.2f} lineal medido {control.mean():.3f} "
        f"→ {float(linear_to_srgb(np.clip(control, 0.0, 1.0)).mean()) * 255:.1f}/255 "
        f"({control_seconds} s)"
    )

    rows = []
    for family in families:
        recipe = plan.effective(family)
        mask_png = EVIDENCE / f"{family}_mask.png"
        aged_png = EVIDENCE / f"{family}_aged.png"
        mask_field, mask_seconds = measure(plan, family, "mask", mask_png)
        aged_field, aged_seconds = measure(plan, family, "aged", aged_png)
        mask = field_stats(mask_field)
        delta = delta_stats(aged_field, control)
        rows.append(
            {
                "family": family,
                "strength": recipe["strength"],
                "baseSoiling": recipe["baseSoiling"],
                "grimeColorLinear": recipe["grimeColor"],
                "mask": mask,
                "agedVsControl": delta,
                "renderSeconds": [mask_seconds, aged_seconds],
                "png": [str(mask_png.relative_to(REPO_ROOT)), str(aged_png.relative_to(REPO_ROOT))],
            }
        )
        print(
            f"{family:9s} s={recipe['strength']:.2f} base={recipe['baseSoiling']:.2f} "
            f"máscara media={mask['mean']:.3f} p90={mask['p90']:.3f} >0,25={mask['fractionOver0.25'] * 100:5.1f}%  "
            f"Δ={delta['meanSigned']:+6.2f}/255 tono/textura={delta['toneVsTexture']:.2f} "
            f"texels sobre ruido={delta['fractionAboveNoiseFloor'] * 100:5.1f}%"
        )
    summary = {
        "schemaVersion": 1,
        "task": "D-111 WP04 weathering mask measurement",
        "contractId": contract["id"],
        "contractSha256": W.sha256_file(W.CONTRACT_PATH),
        "moodId": mood,
        "moodGroup": plan.mood,
        "wallMeters": list(WALL_METERS),
        "resolution": RESOLUTION,
        "referenceGray": REFERENCE_GRAY,
        "noiseFloor8bit": NOISE_FLOOR_8BIT * 255.0,
        "method": (
            "Paño vertical 16×12 m, cámara ortográfica, sin HDRI, albedo conectado a emisión. Se mide "
            "el PNG recargado por Blender y linealizado a mano (`pixels` entrega el valor codificado), "
            "no el búfer `Render Result`, que en background se reporta 0×0. La máscara se publica en "
            "lineal y el delta contra el control en unidades de 8 bits, que es la escala con la que "
            "§13 fija su cota de ruido."
        ),
        "blender": bpy.app.version_string,
        "families": rows,
    }
    (EVIDENCE / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {EVIDENCE / 'summary.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

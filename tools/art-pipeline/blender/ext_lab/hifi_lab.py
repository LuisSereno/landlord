"""D-111 §4 — Laboratorio de HiFi Architecture Builder (extensión `hifi_builder`).

Pregunta que responde: ¿una fachada compuesta con los generadores de HiFi tiene MÁS arquitectura
(molduras, marcos con profundidad real, balcón con barandilla, cornisa, zócalo, pilastras) que el
control del Building Composer, a coste de producción comparable?

Uso (ver README.md del directorio para el aislamiento de configuración):

  blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/hifi_lab.py -- \
    --output docs/art/graphics-capabilities/evidence/extensions/hifi_facade.png \
    --metadata docs/art/graphics-capabilities/evidence/extensions/hifi_facade.json

La fachada se construye íntegramente con `bpy.ops.hifi.generate` tras fijar `scene.hifi_props`.
Las piezas que no salen de la extensión (volumen de masa, cubierta, hojas y cristales) se
etiquetan como `lab_filler` en el JSON para que la autoría de cada objeto sea auditable.
"""

import argparse
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))

import lab_common as lab  # noqa: E402
from runtime_asset import cube  # noqa: E402  (primitiva del propio pipeline, no se modifica)

EXT_ID = "hifi_builder"

# Crujía y alturas del control (`mixed_tenement`: 16,2 x 8,4 x 10 m, 3 plantas de ~3 m).
FLOOR_H = 3.0
FLOORS = 3
WIDTH = 16.0
WALL_T = 0.30
DEPTH = 6.8
COUNTERS = {}

# --- Retícula del Composer (WP03) ---------------------------------------------------------------
# Nada de esto es un gusto del laboratorio: `BAY`/`BAND` son el paso que valida el Building Composer
# y los ritmos de hueco están copiados de `gn_facade_grammar.py:part_parameters()` (window_bay,
# shopfront_bay, balcony_door_bay, cornice), que es la gramática que ya compone los sprites piloto.
BAY = 2.0
BAND = 3.0
# Baches impar para que el portal caiga sobre una crujía (x=0) y no sobre una junta: con 9 crujías de
# 2 m los centros de crujía son x = -8..8 (pares) y las juntas x = -9..9 (impares).
BAYS = 9
GRID_WIDTH = BAYS * BAY
GRID_FLOORS = 3
WINDOW_RHYTHM = {"width": 1.05, "height": 1.45, "sill": 0.95, "frame": 0.085, "depth": 0.30}
SHOP_RHYTHM = {"width": 1.44, "height": 2.00, "sill": 0.42, "frame": 0.16, "depth": 0.40,
               "pilaster": 0.28, "fascia": 0.30}
DOOR_RHYTHM = {"width": 1.10, "height": 2.10, "frame": 0.10, "depth": 0.40}
BALCONY_RHYTHM = {"projection": 0.72, "railHeight": 0.92, "slab": 0.12}
CORNICE_RHYTHM = {"height": 1.0, "depth": 0.40}
# Pasos cuyo eje x debe caer sobre un centro de crujía. Los de línea de banda son sólo los que por
# construcción tienen que apoyar en un forjado: la cornisa superior, el antepecho, la balaustrada y
# el manopostiglio viven POR ENCIMA de la última banda, así que medirlos contra un múltiplo de 3 m
# daría un "desvío" que no es un defecto, sino el remate de la cornisa.
OPENING_LABELS = ("ventana_", "escaparate_", "portal", "balcon_", "barandilla_")
BAND_LINE_LABELS = ("impasta_", "cornisa_inferior")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--ortho-scale", type=float, default=22.97)
    parser.add_argument("--target-z", type=float, default=5.0)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--mood", default=lab.DEFAULT_MOOD)
    # `free` es la receta original del laboratorio (huecos en x = -5,3/0/5,3 y plantas en
    # z = 0,55 + 3k). `grid` es la muestra que pide WP03: todo múltiplo de la retícula del Composer.
    # Se conservan las dos porque la diferencia entre ellas ES el hallazgo de WP03.
    parser.add_argument("--layout", default="free", choices=["free", "grid"])
    # `palette` es la maqueta mate del laboratorio, que compara geometría sin texturas. `atlas` son
    # los materiales del atlas licenciado que ya usan WP01/WP02/WP03: es el brazo que hay que juzgar
    # para decidir si HiFi entra en una candidata, porque la misma geometría con otro shader se ve
    # distinta y la dirección D-111 se decide sobre el resultado visual final.
    parser.add_argument("--materials", default="palette", choices=["palette", "atlas"])
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def facade_materials(kind):
    """Paleta del laboratorio o atlas del pipeline, devueltos con las mismas claves de la receta."""
    if kind == "palette":
        return lab.palette_materials()
    from gn_facade_grammar import MATERIALS, ensure_materials  # noqa: PLC0415

    ensure_materials()
    atlas = {key: bpy.data.materials[spec["name"]] for key, spec in MATERIALS.items()}
    return {
        "brick": atlas["wall"], "stone": atlas["render"], "trim": atlas["render"],
        "plaster": atlas["render"], "metal": atlas["metal"], "glass": atlas["glass"],
        "roof": atlas["metal"], "ground": atlas["wall"],
    }


def generate(hp, gen_type, params, offset, mats, mat_key, label, rotation_z_degrees=0.0):
    """Una llamada real a la extension: props -> preview -> hifi.generate -> colocar.

    `rotation_z_degrees` se aplica al Empty contenedor, no a cada malla, porque `hifi.generate`
    mueve el origen de cada objeto al centro mediano de su geometria y girar objeto a objeto
    dependeria de ese centro.
    """
    before = set(bpy.data.objects.keys())
    hp.unit_type = "METERS"
    hp.generator_type = gen_type
    for key, value in params.items():
        setattr(hp, key, value)
    from bl_ext.user_default.hifi_builder.preview_logic import update_preview

    update_preview(bpy.context.scene)
    result = bpy.ops.hifi.generate()
    if result != {"FINISHED"}:
        raise lab.LabError(f"hifi.generate devolvio {result} para {gen_type}")
    created = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]
    if not created:
        raise lab.LabError(f"{gen_type} no creo ningun objeto")
    COUNTERS[label] = COUNTERS.get(label, 0) + 1
    empty = lab.attach(created, f"HF_{label}_{COUNTERS[label]}", offset, rotation_z_degrees)
    lab.paint(created, mats[mat_key], force=True)
    for obj in created:
        obj["ext_lab_author"] = "hifi_builder"
    return {
        "generator": gen_type,
        "label": label,
        "controller": empty.name,
        "offset": [round(v, 3) for v in offset],
        "rotationZDegrees": rotation_z_degrees,
        "params": dict(params),
        "objects": sorted(obj.name for obj in created),
    }


def filler(name, location, size, mat, note):
    obj = cube(name, location, size, mat, bevel=0.02)
    obj["ext_lab_author"] = "lab_filler"
    obj["ext_lab_note"] = note
    return obj


def build_facade(mats, hp):
    """Receta de fachada: 3 plantas, zocalo, pilastras, marcos en relieve, balcones, cornisa."""
    steps = []
    total_h = FLOOR_H * FLOORS
    top = 0.55 + total_h

    # --- Volumen del edificio (masa y cubierta): relleno del laboratorio, no de la extension --
    filler(
        "lab_body", (0.0, DEPTH / 2, 0.55 + total_h / 2), (WIDTH - 0.1, DEPTH, total_h),
        mats["brick"], "masa tras la fachada para que el sprite tenga volumen",
    )
    filler(
        "lab_roof_deck", (0.0, DEPTH / 2, top + 0.62), (WIDTH + 0.2, DEPTH + 0.2, 0.16),
        mats["roof"], "cubierta plana interior",
    )

    # --- Zocalo --------------------------------------------------------------------------------
    steps.append(generate(hp, "WALL", {
        "wall_length_ft": WIDTH + 0.7, "wall_height_ft": 0.55, "wall_thickness_ft": 0.5,
    }, (0.0, -0.1, 0.0), mats, "brick", "zocalo"))

    # --- Cuerpo por planta ---------------------------------------------------------------------
    for floor in range(FLOORS):
        z = 0.55 + floor * FLOOR_H
        steps.append(generate(hp, "WALL", {
            "wall_length_ft": WIDTH, "wall_height_ft": FLOOR_H, "wall_thickness_ft": WALL_T,
        }, (0.0, 0.0, z), mats, "brick", f"muro_planta_{floor}"))
        if floor:
            # Cordon / linea de impostas: losa de HiFi que sobresale del paramento.
            steps.append(generate(hp, "CEILING", {
                "ceiling_length_ft": WIDTH + 0.6, "ceiling_width_ft": 0.5,
                "ceiling_thickness_ft": 0.16, "ceiling_height_ft": 0.0,
            }, (0.0, -0.22, z - 0.08), mats, "trim", f"impasta_{floor}"))

        if floor == 0:
            # Planta baja comercial: portal con marco en relieve + dos escaparates.
            steps.append(generate(hp, "DOOR_FLAT", {
                "door_f_width_ft": 2.6, "door_f_height_ft": 2.9,
                "door_f_depth_ft": 0.6, "door_f_frame_thick_ft": 0.24,
            }, (0.0, -0.16, z), mats, "trim", "portal_comercial"))
            filler("lab_door_leaf", (0.0, -0.05, z + 1.35), (2.1, 0.12, 2.7), mats["metal"],
                   "hoja de puerta dentro del marco HiFi")
            for index, x in enumerate((-5.3, 5.3)):
                steps.append(generate(hp, "WINDOW_FLAT", {
                    "win_f_width_ft": 3.4, "win_f_height_ft": 2.3, "win_f_depth_ft": 0.55,
                    "win_f_frame_thick_ft": 0.24, "win_f_base_z_ft": 0.45,
                }, (x, -0.16, z), mats, "trim", f"escaparate_{index}"))
                filler(f"lab_glass_shop_{index}", (x, -0.02, z + 1.6), (2.95, 0.08, 1.85),
                       mats["glass"], "cristal del escaparate")
        else:
            window_w, window_h, base = 1.5, 1.5, 0.95
            for index, x in enumerate((-5.3, 0.0, 5.3)):
                steps.append(generate(hp, "WINDOW_FLAT", {
                    "win_f_width_ft": window_w, "win_f_height_ft": window_h,
                    "win_f_depth_ft": 0.45, "win_f_frame_thick_ft": 0.17,
                    "win_f_base_z_ft": base,
                }, (x, -0.14, z), mats, "trim", f"ventana_{floor}_{index}"))
                filler(f"lab_glass_{floor}_{index}", (x, -0.02, z + base + window_h / 2),
                       (window_w - 0.34, 0.07, window_h - 0.34), mats["glass"], "cristal")
                # Fronton/pala sobre la ventana: moldura generada con el creador de losas.
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": window_w + 0.6, "ceiling_width_ft": 0.36,
                    "ceiling_thickness_ft": 0.15, "ceiling_height_ft": 0.0,
                }, (x, -0.18, z + base + window_h + 0.04), mats, "trim",
                    f"fronton_{floor}_{index}"))
                # Alfeizar: la misma losa, mas fina, bajo la ventana.
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": window_w + 0.45, "ceiling_width_ft": 0.34,
                    "ceiling_thickness_ft": 0.1, "ceiling_height_ft": 0.0,
                }, (x, -0.17, z + base - 0.12), mats, "trim", f"alfeniz_{floor}_{index}"))
            if floor == 1:
                # Balcones ante las dos ventanas laterales. HiFi proyecta la plataforma sobre +X,
                # asi que se gira el contenedor -90 grados para que salga hacia -Y (la calle).
                for index, x in enumerate((-5.3, 5.3)):
                    steps.append(generate(hp, "BALCONY", {
                        "bal_width_ft": 2.4, "bal_depth_ft": 0.85, "bal_height_ft": 0.0,
                        "bal_thickness_ft": 0.14, "bal_rail_height_ft": 0.95,
                        "bal_rail_thick_ft": 0.09, "bal_rail_back": False,
                    }, (x, -0.3, z + base - 0.18), mats, "trim", f"balcon_{index}",
                        rotation_z_degrees=-90.0))

    # --- Cornisa y remate ----------------------------------------------------------------------
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": WIDTH + 1.3, "ceiling_width_ft": 0.95,
        "ceiling_thickness_ft": 0.24, "ceiling_height_ft": 0.0,
    }, (0.0, -0.42, top), mats, "trim", "cornisa_inferior"))
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": WIDTH + 0.85, "ceiling_width_ft": 0.62,
        "ceiling_thickness_ft": 0.18, "ceiling_height_ft": 0.0,
    }, (0.0, -0.25, top + 0.24), mats, "trim", "cornisa_superior"))
    steps.append(generate(hp, "WALL", {
        "wall_length_ft": WIDTH + 0.5, "wall_height_ft": 0.55, "wall_thickness_ft": 0.22,
    }, (0.0, 0.05, top + 0.42), mats, "plaster", "antepecho"))

    # Pilastras / lesenas en los extremos de la fachada.
    for index, x in enumerate((-(WIDTH / 2) - 0.1, (WIDTH / 2) + 0.1)):
        steps.append(generate(hp, "PILLAR", {
            "pillar_height_ft": total_h + 0.35, "pillar_radius_ft": 0.45,
            "pillar_shape": "SQUARE", "pillar_resolution": 4,
        }, (x, -0.12, 0.55), mats, "plaster", f"pilastra_{index}"))
        steps.append(generate(hp, "CEILING", {
            "ceiling_length_ft": 0.95, "ceiling_width_ft": 0.7,
            "ceiling_thickness_ft": 0.2, "ceiling_height_ft": 0.0,
        }, (x, -0.2, 0.55 + total_h + 0.35), mats, "trim", f"capitel_pilastra_{index}"))

    # Balaustrada de coronacion. El generador de vallas reparte los postes desde x=0 hasta
    # x=length (no los centra), por eso el desplazamiento es -length/2.
    fence_length = WIDTH + 0.9
    steps.append(generate(hp, "FENCE", {
        "fence_length_ft": fence_length, "fence_height_ft": 0.8, "fence_posts": 17,
        "fence_shape": "ROUND", "fence_resolution": 8,
    }, (-fence_length / 2, 0.05, top + 0.97), mats, "plaster", "balaustrada"))
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": fence_length + 0.3, "ceiling_width_ft": 0.34,
        "ceiling_thickness_ft": 0.12, "ceiling_height_ft": 0.0,
    }, (0.0, 0.05, top + 1.77), mats, "trim", "manopostigo"))
    return steps


def build_grid_facade(mats, hp):
    """Fachada residencial/comercial montada ENTERA sobre la retícula: 9 crujías x 3 bandas.

    Es la muestra que pide WP03. La diferencia con `build_facade` no es de gusto: allí los huecos
    caían en x = -5,3 / 0 / 5,3 y las plantas en z = 0,55 + 3k, cotas que no son múltiplos de la
    retícula del Composer, así que la fachada no era traducible a módulos. Aquí cada x es un centro de
    crujía, cada línea horizontal es una banda y cada hueco usa el ritmo declarado en la gramática GN.
    """
    steps = []
    total_h = BAND * GRID_FLOORS
    top = total_h
    centers = [(-BAYS / 2 + i + 0.5) * BAY for i in range(BAYS)]  # -8 .. 8 (centros de crujía)
    joints = [(-BAYS / 2 + i) * BAY for i in range(BAYS + 1)]     # -9 .. 9 (juntas)

    filler("lab_body", (0.0, DEPTH / 2, total_h / 2), (GRID_WIDTH - 0.1, DEPTH, total_h),
           mats["brick"], "masa tras la fachada para que el sprite tenga volumen")
    # La cubierta apoya en el forjado (top + 0,05), no a media altura del remate: con el borde
    # anterior a 0,62 m la losa asomaba por encima de la cornisa y el sprite leía una bandeja
    # flotando sobre el edificio en vez de un plano de cubierta.
    filler("lab_roof_deck", (0.0, DEPTH / 2, top + 0.05), (GRID_WIDTH + 0.2, DEPTH + 0.2, 0.16),
           mats["roof"], "cubierta plana interior apoyada en el último forjado")

    for floor in range(GRID_FLOORS):
        # Sin zócalo: la banda 1 arranca en el suelo, que es el único modo de que las líneas de
        # forjado caigan exactamente en múltiplos de 3,00 m.
        z = floor * BAND
        steps.append(generate(hp, "WALL", {
            "wall_length_ft": GRID_WIDTH, "wall_height_ft": BAND, "wall_thickness_ft": WALL_T,
        }, (0.0, 0.0, z), mats, "brick", f"muro_banda_{floor}"))
        if floor:
            steps.append(generate(hp, "CEILING", {
                "ceiling_length_ft": GRID_WIDTH, "ceiling_width_ft": 0.45,
                "ceiling_thickness_ft": 0.16, "ceiling_height_ft": 0.0,
            }, (0.0, -0.22, z), mats, "trim", f"impasta_{floor}"))

        if floor == 0:
            # Planta baja comercial: portal sobre la crujía central + escaparate en cada una de las
            # otras ocho crujías. El portal mide el hueco del `balcony_door_bay` de la gramática.
            steps.append(generate(hp, "DOOR_FLAT", {
                "door_f_width_ft": DOOR_RHYTHM["width"], "door_f_height_ft": DOOR_RHYTHM["height"],
                "door_f_depth_ft": DOOR_RHYTHM["depth"],
                "door_f_frame_thick_ft": DOOR_RHYTHM["frame"],
            }, (0.0, -0.16, z), mats, "trim", "portal"))
            filler("lab_door_leaf", (0.0, -0.04, z + DOOR_RHYTHM["height"] / 2),
                   (DOOR_RHYTHM["width"] - 0.20, 0.10, DOOR_RHYTHM["height"] - 0.10),
                   mats["metal"], "hoja de puerta dentro del marco HiFi")
            for x in centers:
                if x == 0.0:
                    continue
                tag = f"{x:+.0f}"
                steps.append(generate(hp, "WINDOW_FLAT", {
                    "win_f_width_ft": SHOP_RHYTHM["width"], "win_f_height_ft": SHOP_RHYTHM["height"],
                    "win_f_depth_ft": SHOP_RHYTHM["depth"],
                    "win_f_frame_thick_ft": SHOP_RHYTHM["frame"],
                    "win_f_base_z_ft": SHOP_RHYTHM["sill"],
                }, (x, -0.16, z), mats, "trim", f"escaparate_{tag}"))
                filler(f"lab_glass_shop_{tag}",
                       (x, -0.02, z + SHOP_RHYTHM["sill"] + SHOP_RHYTHM["height"] / 2),
                       (SHOP_RHYTHM["width"] - 0.26, 0.07, SHOP_RHYTHM["height"] - 0.26),
                       mats["glass"], "cristal del escaparate")
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": SHOP_RHYTHM["width"] + 0.10,
                    "ceiling_width_ft": 0.30, "ceiling_thickness_ft": SHOP_RHYTHM["fascia"],
                    "ceiling_height_ft": 0.0,
                }, (x, -0.20, z + SHOP_RHYTHM["sill"] + SHOP_RHYTHM["height"]), mats, "trim",
                    f"fascia_{tag}"))
        else:
            for x in centers:
                tag = f"{x:+.0f}"
                steps.append(generate(hp, "WINDOW_FLAT", {
                    "win_f_width_ft": WINDOW_RHYTHM["width"],
                    "win_f_height_ft": WINDOW_RHYTHM["height"],
                    "win_f_depth_ft": WINDOW_RHYTHM["depth"],
                    "win_f_frame_thick_ft": WINDOW_RHYTHM["frame"],
                    "win_f_base_z_ft": WINDOW_RHYTHM["sill"],
                }, (x, -0.15, z), mats, "trim", f"ventana_{floor}_{tag}"))
                filler(f"lab_glass_{floor}_{tag}",
                       (x, -0.02, z + WINDOW_RHYTHM["sill"] + WINDOW_RHYTHM["height"] / 2),
                       (WINDOW_RHYTHM["width"] - 0.21, 0.06, WINDOW_RHYTHM["height"] - 0.21),
                       mats["glass"], "cristal del hueco")
                # HiFi no divide el hueco: `WINDOW_FLAT` sólo expone ancho, alto, profundidad,
                # grosor de marco y cota de base. La cruceta se monta con generadores de la propia
                # extensión (pilar = montante, losa = travesero), no con relleno del laboratorio.
                steps.append(generate(hp, "PILLAR", {
                    "pillar_height_ft": WINDOW_RHYTHM["height"], "pillar_radius_ft": 0.035,
                    "pillar_shape": "SQUARE", "pillar_resolution": 4,
                }, (x, -0.11, z + WINDOW_RHYTHM["sill"]), mats, "trim", f"montante_{floor}_{tag}"))
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": WINDOW_RHYTHM["width"], "ceiling_width_ft": 0.09,
                    "ceiling_thickness_ft": 0.05, "ceiling_height_ft": 0.0,
                }, (x, -0.11, z + WINDOW_RHYTHM["sill"] + WINDOW_RHYTHM["height"] / 2), mats,
                    "trim", f"travesero_{floor}_{tag}"))
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": WINDOW_RHYTHM["width"] + 0.30, "ceiling_width_ft": 0.28,
                    "ceiling_thickness_ft": 0.08, "ceiling_height_ft": 0.0,
                }, (x, -0.20, z + WINDOW_RHYTHM["sill"] - 0.10), mats, "trim",
                    f"alfeniz_{floor}_{tag}"))
                steps.append(generate(hp, "CEILING", {
                    "ceiling_length_ft": WINDOW_RHYTHM["width"] + 0.30, "ceiling_width_ft": 0.22,
                    "ceiling_thickness_ft": 0.12, "ceiling_height_ft": 0.0,
                }, (x, -0.17, z + WINDOW_RHYTHM["sill"] + WINDOW_RHYTHM["height"] + 0.04), mats,
                    "trim", f"dintel_{floor}_{tag}"))
            if floor == 1:
                # Balcones en las cinco crujías centrales: el vuelo y la barandilla salen del
                # `balcony_door_bay` de la gramática, y el ancho (1,60 m) deja 0,20 m de machón por
                # lado para no invadir la junta.
                for x in [c for c in centers if abs(c) <= 4.0]:
                    tag = f"{x:+.0f}"
                    step = generate(hp, "BALCONY", {
                        "bal_width_ft": 1.60, "bal_depth_ft": BALCONY_RHYTHM["projection"],
                        "bal_height_ft": 0.0, "bal_thickness_ft": BALCONY_RHYTHM["slab"],
                        # 0,12 m de llanta: el bordillo del forjado. La barandilla no la hace BALCONY.
                        "bal_rail_height_ft": 0.12,
                        "bal_rail_thick_ft": 0.07, "bal_rail_back": False,
                    }, (x, -0.30, z + WINDOW_RHYTHM["sill"] - 0.18), mats, "trim", f"balcon_{tag}",
                        rotation_z_degrees=-90.0)
                    steps.append(step)
                    # HiFi expone sólo siete propiedades en BALCONY y ninguna de ellas genera
                    # balaustres: su "barandilla" es un peto macizo que tapaba la ventana. La barandilla
                    # se monta con el otro generador que sí reparte postes, FENCE, y se apoya en la
                    # cota REAL del forjado medido, no en la cota pedida en la receta.
                    slab = lab.bounds_of(
                        [bpy.data.objects[n] for n in step["objects"]
                         if bpy.data.objects[n].type == "MESH"]
                    )
                    steps.append(generate(hp, "FENCE", {
                        "fence_length_ft": 1.60, "fence_height_ft": 0.80, "fence_posts": 5,
                        "fence_shape": "SQUARE", "fence_resolution": 4,
                    }, (x - 0.80, slab["min"][1] + 0.035, slab["min"][2] + BALCONY_RHYTHM["slab"]),
                        mats, "trim", f"barandilla_{tag}"))

    # --- Cornisa y remate, con la altura de la `cornice` de la gramática (1,00 m) ---------------
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": GRID_WIDTH, "ceiling_width_ft": CORNICE_RHYTHM["depth"],
        "ceiling_thickness_ft": 0.24, "ceiling_height_ft": 0.0,
    }, (0.0, -0.35, top), mats, "trim", "cornisa_inferior"))
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": GRID_WIDTH, "ceiling_width_ft": 0.25,
        "ceiling_thickness_ft": 0.18, "ceiling_height_ft": 0.0,
    }, (0.0, -0.22, top + 0.24), mats, "trim", "cornisa_superior"))
    steps.append(generate(hp, "WALL", {
        "wall_length_ft": GRID_WIDTH, "wall_height_ft": 0.55, "wall_thickness_ft": 0.22,
    }, (0.0, 0.05, top + 0.42), mats, "plaster", "antepecho"))

    # Lesenas en las juntas extremas y en las dos juntas que flanquean la crujía del portal: 0,28 m
    # de ancho, el `pilasterWidth` de la gramática, y altura exacta de las tres bandas. Se eligen las
    # juntas adyacentes al portal (x = ±1) y no las siguientes (±7) para que el ritmo lea un cuerpo
    # central remarcado, que es lo que la retícula permite sin inventar un vano de 4 m.
    for index, x in enumerate((joints[0], -BAY / 2, BAY / 2, joints[-1])):
        steps.append(generate(hp, "PILLAR", {
            "pillar_height_ft": total_h, "pillar_radius_ft": 0.14,
            "pillar_shape": "SQUARE", "pillar_resolution": 4,
        }, (x, -0.12, 0.0), mats, "plaster", f"lesena_{index}"))
        steps.append(generate(hp, "CEILING", {
            "ceiling_length_ft": 0.44, "ceiling_width_ft": 0.44,
            "ceiling_thickness_ft": 0.18, "ceiling_height_ft": 0.0,
        }, (x, -0.14, total_h), mats, "trim", f"capitel_lesena_{index}"))

    # Balaustrada de coronación: `fence_posts = BAYS + 1` sobre una longitud de 9 crujías hace que
    # el poste caiga cada 2,00 m y exactamente sobre las juntas (-9, -7, ... 9).
    fence_length = GRID_WIDTH
    steps.append(generate(hp, "FENCE", {
        "fence_length_ft": fence_length, "fence_height_ft": 0.8, "fence_posts": BAYS + 1,
        "fence_shape": "ROUND", "fence_resolution": 8,
    }, (-fence_length / 2, 0.05, top + 0.97), mats, "plaster", "balaustrada"))
    steps.append(generate(hp, "CEILING", {
        "ceiling_length_ft": fence_length, "ceiling_width_ft": 0.34,
        "ceiling_thickness_ft": 0.12, "ceiling_height_ft": 0.0,
    }, (0.0, 0.05, top + 1.77), mats, "trim", "manopostigo"))
    return steps


def offset_to_grid(value, phase=0.0, step=BAY):
    """Distancia con signo de `value` al eje de retícula más cercano, desplazado `phase` metros.

    `phase=0` pregunta por un centro de crujía; `phase=BAY/2` pregunta por una junta. Se evita el
    `round(value/step)*step` directo porque con BAYS impar los centros caen en múltiplos de 2 y las
    juntas en impares: la misma fórmula sirve para los dos ejes y deja ver cuál está fallando.
    """
    return round(((value - phase) % step + step / 2.0) % step - step / 2.0, 4)


def railing_posts(prefix):
    """Postes de cada valla `FENCE` bajo los controladores `prefix`, medidos en coordenadas de mundo.

    Se agrupa por controlador porque la fachada usa dos vallas distintas (la balaustrada de coronación
    y las barandillas de los balcones): mezclar sus postes daría un "paso" sin significado. Sólo la
    balaustrada pretende caer sobre las juntas; los balaustres de un balcón de 1,60 m siguen su propio
    sub-paso y por eso se reportan aparte.
    """
    groups = {}
    for obj in bpy.context.scene.objects:
        if not obj.name.startswith("hifi_fence_post") or obj.parent is None:
            continue
        if not obj.parent.name.startswith(prefix):
            continue
        groups.setdefault(obj.parent.name, []).append(obj.matrix_world.translation.x)
    spacings, joint_offsets, samples = [], [], []
    for controller in sorted(groups):
        xs = sorted(groups[controller])
        spacings += [round(xs[i + 1] - xs[i], 4) for i in range(len(xs) - 1)]
        joint_offsets += [abs(offset_to_grid(x, BAY / 2.0)) for x in xs]
        samples.append({"controller": controller, "posts": len(xs),
                        "firstX": round(xs[0], 4), "lastX": round(xs[-1], 4)})
    return {
        "railings": len(samples),
        "posts": sum(len(values) for values in groups.values()),
        "spacingMeters": {"min": min(spacings), "max": max(spacings)} if spacings else None,
        "maxOffsetFromJointMeters": round(max(joint_offsets), 4) if joint_offsets else None,
        "samples": samples,
    }


def audit_grid(steps):
    """Mide, sobre la geometría ya generada, si cada hueco cae en su crujía y cada línea en su banda.

    WP03 no se cierra declarando la coherencia: hay que medirla. `hifi.generate` reubica el origen de
    cada objeto en el centro mediano de su geometría, así que la cota pedida en la receta no garantiza
    la cota construida. Los desvíos que devuelve esta función son los que se ven en la hoja.
    """
    openings, lines, others = [], [], []
    worst_opening = worst_line = 0.0
    for step in steps:
        meshes = [bpy.data.objects[n] for n in step["objects"] if bpy.data.objects[n].type == "MESH"]
        bounds = lab.bounds_of(meshes)
        if not bounds:
            continue
        center_x = (bounds["min"][0] + bounds["max"][0]) / 2.0
        # `FENCE` reparte los postes desde x=0 hasta x=length, así que su offset es el ARRANQUE del
        # tramo, no su centro: comparar el centro medido contra el offset daría un desvío de media
        # longitud en cada valla, que es un artefacto del generador y no un fallo de la retícula.
        declared_x = step["offset"][0]
        if step["generator"] == "FENCE":
            declared_x += step["params"].get("fence_length_ft", 0.0) / 2.0
        row = {
            "label": step["label"],
            "generator": step["generator"],
            "declaredXMeters": round(declared_x, 4),
            "measuredCenterXMeters": round(center_x, 4),
            "deviationFromDeclaredMeters": round(center_x - declared_x, 4),
            "boundsMinMeters": bounds["min"],
            "boundsMaxMeters": bounds["max"],
            "sizeMeters": bounds["size"],
        }
        if step["label"].startswith(OPENING_LABELS):
            row["offsetFromBayCenterMeters"] = offset_to_grid(center_x)
            worst_opening = max(worst_opening, abs(row["offsetFromBayCenterMeters"]))
            openings.append(row)
        elif step["label"].startswith(BAND_LINE_LABELS):
            bottom_z = bounds["min"][2]
            row["measuredBottomZMeters"] = round(bottom_z, 4)
            row["offsetFromBandLineMeters"] = offset_to_grid(bottom_z, step=BAND)
            worst_line = max(worst_line, abs(row["offsetFromBandLineMeters"]))
            lines.append(row)
        else:
            others.append(row)
    return {
        "bayMeters": BAY,
        "bandMeters": BAND,
        "openingsAudited": len(openings),
        "bandLinesAudited": len(lines),
        "maxOpeningOffsetFromBayCenterMeters": round(worst_opening, 4),
        "maxLineOffsetFromBandMeters": round(worst_line, 4),
        "maxOpeningDeviationFromDeclaredMeters": round(
            max([abs(r["deviationFromDeclaredMeters"]) for r in openings] or [0.0]), 4
        ),
        "balustradePosts": railing_posts("HF_balaustrada"),
        "balconyRailPosts": railing_posts("HF_barandilla"),
        "openings": openings,
        "bandLines": lines,
        "otherSteps": others,
    }


def main():
    args = parse_args()
    lab.clear_scene()
    module = lab.install_and_enable(EXT_ID)
    mats = facade_materials(args.materials)
    hp = bpy.context.scene.hifi_props

    steps = build_grid_facade(mats, hp) if args.layout == "grid" else build_facade(mats, hp)
    audit = audit_grid(steps)

    provenance = dict(lab.EXTENSIONS[EXT_ID])
    provenance.update({
        "registryId": EXT_ID,
        "moduleId": module,
        "mood": args.mood,
        "headless": True,
        "layout": args.layout,
        "materials": args.materials,
        "invocation": "scene.hifi_props + preview_logic.update_preview() + bpy.ops.hifi.generate()",
        "generatorCalls": len(steps),
        "generatorTypes": sorted({step["generator"] for step in steps}),
    })
    generated = {
        "layout": args.layout,
        "grid": {"bayMeters": BAY, "bandMeters": BAND, "bays": BAYS, "floors": GRID_FLOORS,
                 "widthMeters": GRID_WIDTH, "rhythms": {
                     "window_bay": WINDOW_RHYTHM, "shopfront_bay": SHOP_RHYTHM,
                     "door": DOOR_RHYTHM, "balcony": BALCONY_RHYTHM, "cornice": CORNICE_RHYTHM}},
        "recipe": steps,
        "gridAudit": audit,
        "labFiller": sorted(
            obj.name for obj in bpy.context.scene.objects
            if obj.get("ext_lab_author") == "lab_filler"
        ),
        "note": (
            "Todo objeto cuyo atributo custom `ext_lab_author` vale 'hifi_builder' proviene de un "
            "generador de la extension. `lab_filler` son las piezas de masa, cubierta, hojas y "
            "cristales que HiFi no genera. En el layout `grid` cada cota de hueco es un centro de "
            "crujia y cada linea horizontal una banda de 3,00 m; `gridAudit` lo mide sobre la "
            "geometria construida, no sobre la receta."
        ),
    }
    lab.render_evidence(
        label=(
            "HiFi Architecture Builder - fachada de 9 crujias x 3 bandas coherente con la reticula "
            "de Landlord"
            if args.layout == "grid"
            else "HiFi Architecture Builder - fachada mixta de 3 plantas (cornisa, marcos, balcones)"
        ),
        png_path=args.output,
        json_path=args.metadata,
        ortho_scale=args.ortho_scale,
        target_z=args.target_z,
        resolution=args.resolution,
        samples=args.samples,
        provenance=provenance,
        generated=generated,
    )


if __name__ == "__main__":
    main()

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


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    parser.add_argument("--ortho-scale", type=float, default=22.97)
    parser.add_argument("--target-z", type=float, default=5.0)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--mood", default=lab.DEFAULT_MOOD)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


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


def main():
    args = parse_args()
    lab.clear_scene()
    module = lab.install_and_enable(EXT_ID)
    mats = lab.palette_materials()
    hp = bpy.context.scene.hifi_props

    steps = build_facade(mats, hp)

    provenance = dict(lab.EXTENSIONS[EXT_ID])
    provenance.update({
        "registryId": EXT_ID,
        "moduleId": module,
        "mood": args.mood,
        "headless": True,
        "invocation": "scene.hifi_props + preview_logic.update_preview() + bpy.ops.hifi.generate()",
        "generatorCalls": len(steps),
        "generatorTypes": sorted({step["generator"] for step in steps}),
    })
    generated = {
        "recipe": steps,
        "labFiller": sorted(
            obj.name for obj in bpy.context.scene.objects
            if obj.get("ext_lab_author") == "lab_filler"
        ),
        "note": (
            "Todo objeto cuyo atributo custom `ext_lab_author` vale 'hifi_builder' proviene de un "
            "generador de la extension. `lab_filler` son las piezas de masa, cubierta, hojas y "
            "cristales que HiFi no genera."
        ),
    }
    lab.render_evidence(
        label="HiFi Architecture Builder - fachada mixta de 3 plantas (cornisa, marcos, balcones)",
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

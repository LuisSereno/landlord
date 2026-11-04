"""§28 — Contexto urbano de evidencia para los candidatos del Building Composer (V.f.5b).

No es runtime ni gameplay: es una escena de revisión que planta la geometría licenciada REAL que
produjo el compositor sobre un tramo de calle Graphic Civic — calzada, aceras, parcela, un árbol,
un personaje y un vehículo como referencias de escala — y la renderiza con la cámara isométrica del
juego a 0.5×, 1× y 2×.

El edificio se ensambla con las mismas funciones del pipeline de sprite (`place_modules`,
`add_supports`, `complete_style_reach`, `apply_external_treatment`), así que lo que se ve aquí es
literalmente la misma geometría y el mismo tratamiento que §24 publica, no una maqueta. El entorno
son primitivas con la paleta `PALETTE` de `runtime_asset` porque §28 sólo pide escala y legibilidad
in-game, no reusar el bundle.

Uso:
  blender -b -P tools/art-pipeline/blender/build_building_composer_context.py -- --outDir=<dir>
"""

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import bpy

import runtime_asset as runtime
from building_composer.compose import compose_candidate
from building_composer.grammar import GrammarDocument
from building_composer.module_catalog import Catalog
from building_composer.scene import (
    COMPOSITION_ROOT,
    add_supports,
    complete_style_reach,
    framing,
    place_modules,
    reset_scene,
    support_materials,
)
from building_composer.style_profile import StyleProfile

STYLE_LAYER_PATH = HERE / "style_layer_graphic_civic.json"

# Un candidato representativo por familia: el seed cuyo secundario es identitario y el bounds pasa.
FAMILIES = [
    ("row_house", "residential_low", {"width": 4, "height": 1}, 2, 1003),
    ("cement_plant", "industrial_heavy", {"width": 5, "height": 2}, 2, 1002),
    ("town_hall", "civic_landmark", {"width": 4, "height": 3}, 4, 1000),
]
ZOOMS = {"0.5x": 2.0, "1x": 1.0, "2x": 0.5}  # factor sobre ortho_scale: más zoom ⇒ menos escala


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--outDir", required=True)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def context_materials():
    """Paleta Graphic Civic para el entorno, en los nombres que realmente existen en PALETTE."""
    mats = {}
    for key, value in runtime.PALETTE.items():
        if key in ("lighting", "fill"):
            continue
        mats[key] = runtime.material(f"mat_ctx_{key}", value, metallic=0.2 if key == "metal" else 0.0)
    return mats


def build_context_ground(mats, cell_width, depth):
    """Tramo de calle bajo y delante del edificio: parcela, calzada, aceras, bordillo de propiedad."""
    span = cell_width * 2.4
    front = depth / 2.0
    runtime.cube("ctx_parcel", (0.0, 0.0, -0.06), (span, depth + 3.0, 0.12), mats["ground"])
    runtime.cube("ctx_road", (0.0, -(front + 3.2), 0.02), (span * 1.5, 3.6, 0.06), mats["dirt_dark"])
    runtime.cube("ctx_sidewalk", (0.0, -(front + 1.0), 0.06), (span * 1.5, 0.9, 0.12), mats["plaster"])
    for x in (-3.0, 0.0, 3.0):
        runtime.cube(f"ctx_marking_{x}", (x, -(front + 3.2), 0.07), (1.3, 0.08, 0.02), mats["plaster"])
    for side, x in (("l", -span / 2 + 0.4), ("r", span / 2 - 0.4)):
        runtime.cube(f"ctx_groundpost_{side}", (x, -(front + 0.6), 0.35), (0.12, 0.12, 0.7), mats["metal"])


def build_scale_props(mats, cell_width, depth):
    """Árbol, personaje y vehículo como referencias de escala sobre la acada/calzada."""
    front = depth / 2.0
    span = cell_width * 2.4
    # Árbol (tronco + copa): ~2.5 m.
    runtime.cube("ctx_tree_trunk", (span / 2 - 1.5, -(front + 1.2), 0.7), (0.25, 0.25, 1.4), mats["dirt"])
    runtime.sphere("ctx_tree_crown", (span / 2 - 1.5, -(front + 1.2), 1.9), 0.9, mats["green"])
    # Personaje (cuerpo + cabeza): ~1.7 m.
    runtime.cube("ctx_char_body", (-span / 2 + 1.5, -(front + 1.0), 0.75), (0.5, 0.35, 1.1), mats["accent"])
    runtime.sphere("ctx_char_head", (-span / 2 + 1.5, -(front + 1.0), 1.5), 0.24, mats["plaster"])
    # Vehículo (chasis + cabina) sobre la calzada: ~1.4 m alto, 2.2 m largo.
    runtime.cube("ctx_car_body", (0.0, -(front + 3.4), 0.45), (2.2, 1.1, 0.5), mats["metal"])
    runtime.cube("ctx_car_cabin", (0.0, -(front + 3.4), 0.9), (1.1, 1.0, 0.4), mats["window"])


def render_family(building_type, family, footprint, floors, seed, style_layer, treatment,
                  catalog, document, profile, out_dir, index):
    request = {
        "candidateId": f"vf_{building_type}_{seed}",
        "buildingType": building_type,
        "family": family,
        "styleProfileId": profile.id,
        "variantSeed": seed,
        "composerVersion": document.composer_version,
        "footprint": footprint,
        "floors": floors,
        "state": "complete",
        "output": str(out_dir / f"{building_type}-context.png"),
    }
    composition = compose_candidate(request, catalog, profile, document)
    reset_scene()
    root = bpy.data.objects.new(COMPOSITION_ROOT, None)
    bpy.context.collection.objects.link(root)
    groups, _imports = place_modules(composition, catalog, root)
    module_objects = [obj for _r, _m, children, _n in groups for obj in children]
    objects = list(module_objects) + add_supports(composition, support_materials(profile), root)

    cell_width = composition["footprintMeters"]["width"] / max(1, footprint["width"])
    depth = composition["footprintMeters"]["depth"]
    mats = context_materials()
    build_context_ground(mats, cell_width, depth)
    build_scale_props(mats, cell_width, depth)

    camera, target = runtime.place_camera(composition["envelopeMeters"]["z"] / 2.0, 40.0)
    bpy.context.view_layer.update()
    base_scale = framing(composition, camera, profile)["orthoScale"]
    scene = bpy.context.scene
    scene.camera = camera
    runtime.apply_style_layer_lighting(scene, style_layer)
    runtime.apply_external_treatment(objects, style_layer, "building")
    complete_style_reach(objects, treatment, "building")

    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_taa_reprojection = False
    scene.eevee.taa_render_samples = 64
    scene.render.use_persistent_data = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    post = style_layer["rendering"]["postProcessing"]
    scene.view_settings.view_transform = post.split(" - ")[0]
    scene.view_settings.look = post
    scene.view_settings.exposure = style_layer["rendering"].get("exposure", 0.0)

    for zoom_label, factor in ZOOMS.items():
        camera.data.ortho_scale = base_scale * factor
        out_path = out_dir / f"{building_type}-city-context-{zoom_label}.png"
        scene.render.filepath = str(out_path)
        bpy.ops.render.render(write_still=True)
        index.append(
            {
                "candidateId": request["candidateId"],
                "buildingType": building_type,
                "family": family,
                "variantSeed": seed,
                "zoom": zoom_label,
                "orthoScale": round(camera.data.ortho_scale, 3),
                "image": str(out_path),
            }
        )
    print(f"OK contexto {building_type} seed {seed}")


def main():
    args = parse_args()
    out_dir = Path(args.outDir)
    out_dir.mkdir(parents=True, exist_ok=True)
    style_layer = json.loads(STYLE_LAYER_PATH.read_text(encoding="utf-8"))
    treatment = style_layer["externalTreatment"]
    catalog = Catalog()
    document = GrammarDocument()
    profile = StyleProfile("graphic_civic_buildings_v1")

    index = []
    for building_type, family, footprint, floors, seed in FAMILIES:
        render_family(building_type, family, footprint, floors, seed, style_layer, treatment,
                      catalog, document, profile, out_dir, index)

    (out_dir / "urban-context-index.json").write_text(
        json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"manifiesto contexto: {out_dir / 'urban-context-index.json'} ({len(index)} renders)")


if __name__ == "__main__":
    main()

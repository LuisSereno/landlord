"""V.g civic-core P9: escena combinada town_hall V7 + plaza vestida, misma cámara Graphic Civic.

Dos subsistemas, un solo encuadre. El ayuntamiento se compone con el Building Composer (recipe hero
`grand_neoclassical_hall`) y se ancla en el centro de su huella real (del fixture). La plaza se viste
con el planificador de dressing y se ancla en la esquina mínima de sus celdas reales. Ambos viven en
el mismo marco de metros global y la cámara encuadra la unión: así se ve el eje cívico entrada↔
monumento sin hornear la plaza dentro del edificio (son sistemas separados, §22).

Uso:
  blender -b --python build_civic_core_scene.py -- --outDir <dir> [--seed 1002]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy

BLENDER_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BLENDER_DIR))

import public_space_dresser as dresser  # noqa: E402
from building_composer import scene  # noqa: E402
from building_composer.compose import compose_candidate  # noqa: E402
from building_composer.module_catalog import Catalog  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402
import runtime_asset as runtime  # noqa: E402
from render_settings import apply_render_settings  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_PATH = REPO_ROOT / "blender_artist/manifests/public-space-dressing-fixture.json"
GRAMMARS_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-grammars.json"
BUILDING_ROOT = "CIVIC_BUILDING_ROOT"
DRESSING_ROOT = "CIVIC_DRESSING_ROOT"


def _cell_center_meters(cell, cell_meters):
    return ((cell["x"] + 0.5) * cell_meters, (cell["y"] + 0.5) * cell_meters)


def _centroid_meters(cells, cell_meters):
    if not cells:
        return (0.0, 0.0)
    sx = sum(c["x"] for c in cells) / len(cells)
    sy = sum(c["y"] for c in cells) / len(cells)
    return ((sx + 0.5) * cell_meters, (sy + 0.5) * cell_meters)


def town_hall_request(seed):
    grammars = json.loads(GRAMMARS_PATH.read_text(encoding="utf-8"))
    return {
        "candidateId": f"civic_town_hall_{seed}",
        "buildingType": "town_hall",
        "family": "civic_landmark",
        "styleProfileId": "graphic_civic_buildings_v1",
        "variantSeed": seed,
        "composerVersion": grammars.get("composerVersion", "vf-3"),
        "footprint": {"width": 8, "height": 4},
        "floors": 3,
        "state": "complete",
    }


def add_plaza_ground(space, root, cell_meters):
    min_x, min_y, max_x, max_y = space["boundsCells"]
    width = (max_x - min_x + 1) * cell_meters
    depth = (max_y - min_y + 1) * cell_meters
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(min_x * cell_meters + width / 2, min_y * cell_meters + depth / 2, 0.0))
    ground = bpy.context.object
    ground.name = f"civic_ground_{space['publicSpaceId']}"
    ground.scale = (width, depth, 1.0)
    material = bpy.data.materials.new("civic_plaza_paving")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.62, 0.60, 0.55, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.85
    ground.data.materials.append(material)
    ground.parent = root
    return ground


def place_dressing(space, catalog, root, cell_meters):
    cache = {}
    min_x, min_y, _max_x, _max_y = space["boundsCells"]
    groups = []
    for placement in space["placements"]:
        module = catalog.get(placement["moduleId"])
        objects, _norm = scene.import_module_source(module, cache)
        picked = scene.selected_meshes(objects, module.meshes, module.id)
        scene.check_imported_frame(module, picked)
        local_x, local_y, _z = placement["position"]
        # El placement viene en metros locales a la esquina mínima; se lleva al marco global.
        global_position = ((min_x * cell_meters) + local_x, (min_y * cell_meters) + local_y, 0.0)
        children = []
        for source in picked:
            duplicate = source.copy()
            duplicate.data = source.data
            duplicate.location = global_position
            duplicate.rotation_euler = (0.0, 0.0, math.radians(placement["rotationDegrees"]))
            bpy.context.collection.objects.link(duplicate)
            duplicate.parent = root
            children.append(duplicate)
        groups.append(children)
    return groups


def render_civic_core(out_dir, seed):
    catalog = Catalog()
    profile = StyleProfile("graphic_civic_buildings_v1")
    style_layer = json.loads(
        (BLENDER_DIR / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    civic = next(d for d in fixture["districts"] if d["profileId"] == "centro_civico")
    cell_meters = fixture["cellMeters"]
    plaza_id = civic["townHallPlazaId"]
    plaza_cells = next(s["cells"] for s in civic["publicSpaces"] if s["id"] == plaza_id)

    # 1. Ayuntamiento V7 compuesto y anclado en el centro de su huella real.
    composition = compose_candidate(town_hall_request(seed), catalog, profile)
    hall_center = _centroid_meters(civic["townHallFootprintCells"], cell_meters)

    # 2. Plaza vestida con el planificador de dressing (eje cívico activo).
    dressing_space = {
        "id": plaza_id,
        "kind": "plaza",
        "cells": plaza_cells,
    }
    manifest = dresser.load_manifest()
    placements = dresser.dress_space(
        dressing_space, "plaza", manifest, catalog, fixture["seed"],
        [(c["x"], c["y"]) for c in civic["townHallFootprintCells"]],
    )
    dressed = {
        "publicSpaceId": plaza_id,
        "kind": "plaza",
        "boundsCells": dresser.cellset_to_bounds(plaza_cells),
        "cellCount": len(plaza_cells),
        "placements": placements,
    }

    scene.reset_scene()
    building_root = bpy.data.objects.new(BUILDING_ROOT, None)
    bpy.context.collection.objects.link(building_root)
    building_root.location = (hall_center[0], hall_center[1], 0.0)
    groups, _cache = scene.place_modules(composition, catalog, building_root)
    building_objects = [obj for _r, _m, children, _n in groups for obj in children]

    dressing_root = bpy.data.objects.new(DRESSING_ROOT, None)
    bpy.context.collection.objects.link(dressing_root)
    dressing_groups = place_dressing(dressed, catalog, dressing_root, cell_meters)
    dressing_objects = [obj for children in dressing_groups for obj in children]
    add_plaza_ground(dressed, dressing_root, cell_meters)

    # Encuadre: unión de la huella del edificio y la plaza, en metros globales.
    hall_bounds = civic["townHallFootprintCells"]
    all_cells = hall_bounds + plaza_cells
    min_x = min(c["x"] for c in all_cells)
    max_x = max(c["x"] for c in all_cells)
    min_y = min(c["y"] for c in all_cells)
    max_y = max(c["y"] for c in all_cells)
    center_x = (min_x + max_x + 1) / 2 * cell_meters
    center_y = (min_y + max_y + 1) / 2 * cell_meters
    span = math.hypot((max_x - min_x + 1) * cell_meters, (max_y - min_y + 1) * cell_meters)
    ortho_scale = span * 0.80

    camera, _target = runtime.place_camera(6.0, ortho_scale)
    # La cámara mira al origen; desplazamos las raíces para centrar la unión en el encuadre.
    shift = (-center_x, -center_y, 0.0)
    building_root.location = (hall_center[0] + shift[0], hall_center[1] + shift[1], 0.0)
    dressing_root.location = shift
    bpy.context.view_layer.update()

    scene_obj = bpy.context.scene
    scene_obj.camera = camera
    runtime.apply_style_layer_lighting(scene_obj, style_layer)
    all_objects = building_objects + dressing_objects
    runtime.apply_external_treatment(all_objects, style_layer, "building")

    scene_obj.render.engine = "BLENDER_EEVEE"
    scene_obj.eevee.use_taa_reprojection = False
    scene_obj.eevee.taa_render_samples = 64
    scene_obj.render.use_persistent_data = True
    scene_obj.render.resolution_x = 1920
    scene_obj.render.resolution_y = 1080
    scene_obj.render.image_settings.file_format = "PNG"
    scene_obj.render.image_settings.color_mode = "RGBA"
    scene_obj.render.film_transparent = True
    apply_render_settings(scene_obj, style_layer)

    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"civic_core_town_hall_{seed}.png"
    scene_obj.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"[civic-core] renderizado {output} · building={composition['axisChoices']['recipe']} · plaza props={len(placements)}")


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--outDir", required=True)
    parser.add_argument("--seed", type=int, default=1002)
    args, _unknown = parser.parse_known_args(argv)
    render_civic_core(Path(args.outDir).resolve(), args.seed)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1 :])

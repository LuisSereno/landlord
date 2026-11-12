"""V.g public-space dressing: monta y renderiza en Blender los espacios públicos vestidos.

Reutiliza la infraestructura del Building Composer (import normalizado, anclaje medido, rig de
cámara isométrica, iluminación del estilo canónico Graphic Civic) pero sobre placements de dressing,
no de edificio. El plano de suelo sale de las celdas reales del fixture: baldosa cívica para plaza,
césped para parque. Ninguna geometría se inventa: cada módulo entra por su sourcePath medido (§7).

Uso (invocado por scripts/build-public-space-dressing.mjs):
  blender -b --python build_public_space_dressing.py -- --outDir <dir> [--spaces=all]
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
from building_composer.module_catalog import Catalog  # noqa: E402
import runtime_asset as runtime  # noqa: E402
from render_settings import apply_render_settings  # noqa: E402

COMPOSITION_ROOT = "DRESSING_ROOT"
GROUND_COLORS = {
    "plaza": (0.62, 0.60, 0.55, 1.0),        # baldosa cívica cálida
    "civic_courtyard": (0.58, 0.56, 0.52, 1.0),
    "park": (0.28, 0.44, 0.22, 1.0),          # césped
    "pocket_park": (0.30, 0.46, 0.24, 1.0),
}


def add_ground(space, root):
    """Losa de suelo del tamaño del bounding box de celdas, coloreada por tipo de espacio."""
    min_x, min_y, max_x, max_y = space["boundsCells"]
    cell = space["cellMeters"]
    width = (max_x - min_x + 1) * cell
    depth = (max_y - min_y + 1) * cell
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=(width / 2.0, depth / 2.0, 0.0))
    ground = bpy.context.object
    ground.name = f"dress_ground_{space['publicSpaceId']}"
    ground.scale = (width, depth, 1.0)
    material = bpy.data.materials.new(f"dress_{space['kind']}")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    color = GROUND_COLORS.get(space["kind"], (0.5, 0.5, 0.5, 1.0))
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.85
    ground.data.materials.append(material)
    ground.parent = root
    return ground


def place_dressing_modules(space, catalog, root, cache):
    """Importa y coloca cada módulo de dressing en su celda (posición en metros, rotación Z)."""
    groups = []
    for placement in space["placements"]:
        module = catalog.get(placement["moduleId"])
        objects, _norm = scene.import_module_source(module, cache)
        picked = scene.selected_meshes(objects, module.meshes, module.id)
        scene.check_imported_frame(module, picked)
        children = []
        for source in picked:
            duplicate = source.copy()
            duplicate.data = source.data
            duplicate.name = f"dress_{placement['slot']}_{placement['cell']['x']}_{placement['cell']['y']}_{source.name}"
            duplicate.location = placement["position"]
            duplicate.rotation_euler = (0.0, 0.0, math.radians(placement["rotationDegrees"]))
            bpy.context.collection.objects.link(duplicate)
            duplicate.parent = root
            children.append(duplicate)
        groups.append((placement, module, children))
    return groups


def render_space(space, catalog, style_layer, output_path):
    scene.reset_scene()
    root = bpy.data.objects.new(COMPOSITION_ROOT, None)
    bpy.context.collection.objects.link(root)

    min_x, min_y, max_x, max_y = space["boundsCells"]
    cell = space["cellMeters"]
    width = (max_x - min_x + 1) * cell
    depth = (max_y - min_y + 1) * cell
    # El rig de cámara mira a (0,0): se centra el espacio en el origen restando la mitad de su huella.
    root.location = (-width / 2.0, -depth / 2.0, 0.0)

    cache = {}
    groups = place_dressing_modules(space, catalog, root, cache)
    add_ground(space, root)

    module_objects = [obj for _p, _m, children in groups for obj in children]

    ortho_scale = math.hypot(width, depth) * 0.72
    camera, _target = runtime.place_camera(3.0, ortho_scale)
    bpy.context.view_layer.update()

    scene_obj = bpy.context.scene
    scene_obj.camera = camera
    runtime.apply_style_layer_lighting(scene_obj, style_layer)
    if module_objects:
        runtime.apply_external_treatment(module_objects, style_layer, "building")

    scene_obj.render.engine = "BLENDER_EEVEE"
    scene_obj.eevee.use_taa_reprojection = False
    scene_obj.eevee.taa_render_samples = 64
    scene_obj.render.use_persistent_data = True
    scene_obj.render.resolution_x = 1920
    scene_obj.render.resolution_y = 1080
    scene_obj.render.resolution_percentage = 100
    scene_obj.render.image_settings.file_format = "PNG"
    scene_obj.render.image_settings.color_mode = "RGBA"
    scene_obj.render.film_transparent = True
    apply_render_settings(scene_obj, style_layer)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene_obj.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    return {
        "publicSpaceId": space["publicSpaceId"],
        "kind": space["kind"],
        "placementCount": len(space["placements"]),
        "output": str(output_path),
    }


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--outDir", required=True)
    parser.add_argument("--spaces", default="all")
    args, _unknown = parser.parse_known_args(argv)

    catalog = Catalog()
    style_layer = json.loads(
        (BLENDER_DIR / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    dressing = dresser.dress_all()
    out_dir = Path(args.outDir).resolve()

    results = []
    for space in dressing["spaces"]:
        if args.spaces != "all" and space["kind"] != args.spaces:
            continue
        output = out_dir / f"dress_{space['kind']}_{space['publicSpaceId']}.png"
        record = render_space(space, catalog, style_layer, output)
        results.append(record)
        print(f"[dressing] renderizado {record['output']} ({record['placementCount']} props)")

    manifest = {
        "schemaVersion": 1,
        "dressingVersion": dressing["dressingVersion"],
        "seed": dressing["seed"],
        "signature": dressing["signature"],
        "rendered": results,
        "spaces": dressing["spaces"],
    }
    (out_dir / "dressing-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"[dressing] manifest: {out_dir / 'dressing-manifest.json'} signature={dressing['signature'][:16]}")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1 :])

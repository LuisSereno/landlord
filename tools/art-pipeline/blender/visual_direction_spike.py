"""Procedural, original Visual Direction Spike scene for Blender 5.2.2.

This script is deliberately small and data-driven. It is a validation scene, not a
production asset factory: each direction uses the same geometry, camera and scene
kit so the visual comparison is attributable to style parameters.

Usage (from the repository root):
  blender --background --python tools/art-pipeline/blender/visual_direction_spike.py -- \
    --direction warm_editorial --output path/to/render.png --metadata path/to/render.json
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector


DIRECTIONS = {
    "warm_editorial": {
        "label": "Warm editorial",
        "sky": (0.09, 0.12, 0.15, 1),
        "ground": (0.27, 0.25, 0.19, 1),
        "road": (0.12, 0.13, 0.14, 1),
        "brick": (0.47, 0.19, 0.12, 1),
        "plaster": (0.65, 0.52, 0.34, 1),
        "metal": (0.08, 0.12, 0.13, 1),
        "accent": (0.86, 0.53, 0.15, 1),
        "window": (1.0, 0.53, 0.17, 1),
        "green": (0.19, 0.31, 0.14, 1),
        "outline": (0.90, 0.66, 0.22, 1),
        "lighting": (1.0, 0.62, 0.28, 1),
        "fill": (0.23, 0.34, 0.42, 1),
    },
    "graphic_civic": {
        "label": "Graphic civic",
        "sky": (0.04, 0.08, 0.12, 1),
        "ground": (0.20, 0.25, 0.25, 1),
        "road": (0.08, 0.13, 0.16, 1),
        "brick": (0.48, 0.25, 0.24, 1),
        "plaster": (0.68, 0.67, 0.54, 1),
        "metal": (0.05, 0.11, 0.15, 1),
        "accent": (0.08, 0.68, 0.72, 1),
        "window": (0.98, 0.75, 0.25, 1),
        "green": (0.22, 0.36, 0.28, 1),
        "outline": (0.10, 0.84, 0.85, 1),
        "lighting": (0.72, 0.82, 0.89, 1),
        "fill": (0.21, 0.34, 0.44, 1),
    },
    "blue_hour": {
        "label": "Blue hour ledger",
        "sky": (0.015, 0.035, 0.09, 1),
        "ground": (0.07, 0.11, 0.17, 1),
        "road": (0.025, 0.055, 0.09, 1),
        "brick": (0.24, 0.12, 0.16, 1),
        "plaster": (0.28, 0.35, 0.49, 1),
        "metal": (0.025, 0.06, 0.12, 1),
        "accent": (0.92, 0.42, 0.16, 1),
        "window": (1.0, 0.42, 0.08, 1),
        "green": (0.08, 0.19, 0.19, 1),
        "outline": (0.95, 0.43, 0.15, 1),
        "lighting": (0.18, 0.34, 0.70, 1),
        "fill": (0.08, 0.13, 0.29, 1),
    },
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--direction", choices=sorted(DIRECTIONS), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--metadata", required=True)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def material(name, color, metallic=0.0, roughness=0.75, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 2.2
    return mat


def apply_material(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)
    return obj


def cube(name, location, scale, mat, bevel=0.0, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_material(obj, mat)
    if bevel:
        modifier = obj.modifiers.new("soft_crafted_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def cylinder(name, location, radius, depth, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return obj


def sphere(name, location, radius, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    return obj


def create_tree(prefix, x, y, scale, mats):
    cylinder(f"{prefix}_trunk", (x, y, 0.9 * scale), 0.16 * scale, 1.8 * scale, mats["metal"])
    sphere(f"{prefix}_canopy", (x, y, 2.25 * scale), 0.9 * scale, mats["green"])
    sphere(f"{prefix}_canopy_b", (x + 0.35 * scale, y + 0.1 * scale, 2.05 * scale), 0.65 * scale, mats["green"])


def create_window(prefix, x, y, z, mats, width=0.5, height=0.65):
    cube(f"{prefix}_frame", (x, y, z), (width + 0.12, 0.08, height + 0.12), mats["metal"], bevel=0.02)
    cube(f"{prefix}_glass", (x, y - 0.05, z), (width, 0.03, height), mats["window"])


def create_rowhouse(x, y, mats):
    cube("bld_res_rowhouse_a_mass", (x, y, 2.2), (3.1, 3.0, 4.4), mats["brick"], bevel=0.08)
    cube("bld_res_rowhouse_a_front", (x, y - 1.53, 2.5), (2.45, 0.10, 3.85), mats["plaster"], bevel=0.04)
    for row, z in enumerate((1.35, 2.65, 3.95)):
        for column, dx in enumerate((-0.75, 0.75)):
            create_window(f"rowhouse_window_{row}_{column}", x + dx, y - 1.61, z, mats)
    cube("rowhouse_door", (x, y - 1.64, 0.7), (0.62, 0.12, 1.25), mats["accent"], bevel=0.03)
    cube("rowhouse_roof", (x, y, 4.62), (3.3, 3.2, 0.32), mats["metal"], bevel=0.08, rotation=(0.0, 0.0, math.radians(8)))
    for dx in (-0.9, 0.9):
        cylinder("rowhouse_chimney", (x + dx, y + 0.3, 5.25), 0.18, 1.0, mats["brick"])


def create_workshop(x, y, mats):
    cube("bld_ind_workshop_mass", (x, y, 1.7), (4.4, 3.4, 3.4), mats["brick"], bevel=0.08)
    cube("workshop_front", (x, y - 1.73, 1.75), (3.2, 0.10, 2.7), mats["metal"], bevel=0.04)
    for dx in (-1.1, 0.0, 1.1):
        create_window(f"workshop_window_{dx}", x + dx, y - 1.80, 2.55, mats, width=0.72, height=0.72)
    cube("workshop_loading_door", (x, y - 1.84, 0.85), (1.35, 0.12, 1.55), mats["accent"], bevel=0.04)
    cube("workshop_roof", (x, y, 3.52), (4.55, 3.55, 0.32), mats["metal"], bevel=0.08, rotation=(0.0, 0.0, math.radians(-5)))
    cylinder("workshop_chimney", (x + 1.25, y + 0.25, 4.5), 0.24, 1.9, mats["brick"])
    for smoke_index in range(3):
        sphere("workshop_smoke", (x + 1.25 + 0.22 * smoke_index, y + 0.25, 5.55 + smoke_index * 0.35), 0.32 - smoke_index * 0.06, mats["fill"])


def create_character(prefix, x, y, mats, carrying=False):
    cylinder(f"{prefix}_body", (x, y, 0.72), 0.22, 0.85, mats["accent"])
    sphere(f"{prefix}_head", (x, y, 1.35), 0.22, mats["plaster"])
    cylinder(f"{prefix}_legs", (x - 0.10, y, 0.18), 0.07, 0.36, mats["metal"], vertices=8)
    cylinder(f"{prefix}_leg_b", (x + 0.10, y, 0.18), 0.07, 0.36, mats["metal"], vertices=8)
    if carrying:
        cube(f"{prefix}_cargo", (x + 0.48, y - 0.08, 0.85), (0.42, 0.42, 0.42), mats["plaster"], bevel=0.04)


def create_vehicle(x, y, mats):
    cube("veh_delivery_van_body", (x, y, 0.72), (2.1, 1.15, 0.8), mats["accent"], bevel=0.12)
    cube("veh_delivery_van_cab", (x - 0.55, y, 1.25), (0.85, 1.05, 0.55), mats["plaster"], bevel=0.08)
    for dx in (-0.68, 0.68):
        cylinder("veh_delivery_van_wheel", (x + dx, y - 0.62, 0.34), 0.22, 0.18, mats["metal"], vertices=12).rotation_euler[0] = math.radians(90)


def create_scaffold(x, y, mats):
    for z in (0.9, 2.0, 3.1):
        for dx in (-1.2, 1.2):
            cylinder("prp_scaffold_post", (x + dx, y, z), 0.055, 1.9, mats["accent"], vertices=8)
        cube("prp_scaffold_plank", (x, y, z), (2.55, 0.32, 0.12), mats["plaster"], bevel=0.02)
    for dx in (-1.2, 1.2):
        cube("prp_scaffold_brace", (x + dx / 2, y - 0.04, 1.5), (0.08, 0.08, 2.3), mats["accent"], rotation=(0, math.radians(35), 0))


def create_scene(direction):
    palette = DIRECTIONS[direction]
    mats = {key: material(f"mat_{direction}_{key}", value, metallic=0.25 if key == "metal" else 0.0, roughness=0.62, emission=value if key == "window" else None) for key, value in palette.items() if key not in ("label", "sky", "lighting", "fill")}
    mats["fill"] = material(f"mat_{direction}_fill", palette["fill"], roughness=1.0)

    cube("ter_ground", (0, 0, -0.25), (18, 16, 0.5), mats["ground"], bevel=0.02)
    cube("ter_road", (0, -1.8, 0.02), (18, 3.5, 0.12), mats["road"])
    cube("ter_sidewalk_n", (0, 0.25, 0.08), (18, 0.55, 0.18), mats["plaster"])
    cube("ter_sidewalk_s", (0, -3.85, 0.08), (18, 0.55, 0.18), mats["plaster"])
    for x in (-7.0, -3.5, 0.0, 3.5, 7.0):
        cube("ter_parcel_marker", (x, 2.15, 0.11), (0.08, 4.2, 0.06), mats["outline"])
    for x in (-7.0, -3.5, 0.0, 3.5, 7.0):
        cube("ter_road_marking", (x, -1.8, 0.10), (1.3, 0.08, 0.03), mats["plaster"])

    create_rowhouse(-3.3, 2.3, mats)
    create_workshop(2.5, 2.2, mats)
    create_scaffold(5.4, 3.0, mats)
    create_character("chr_worker_m01", 2.0, -0.35, mats, carrying=True)
    create_character("chr_civilian_f01", -1.8, -0.35, mats, carrying=False)
    create_vehicle(0.0, -1.85, mats)
    create_tree("ter_tree_a", -6.0, 2.0, 1.1, mats)
    create_tree("ter_tree_b", 6.7, -0.1, 0.8, mats)
    create_tree("ter_tree_c", -6.8, -3.7, 0.7, mats)

    # Ownership and selection are intentionally represented with geometry, not color alone.
    bpy.ops.mesh.primitive_torus_add(major_radius=1.05, minor_radius=0.055, major_segments=32, location=(2.5, 0.45, 0.16))
    selection = bpy.context.object
    selection.name = "ui_selection_ring_workshop"
    apply_material(selection, mats["outline"])
    for x, y in ((-3.3, 0.65), (2.5, 0.65)):
        cube("ui_ownership_marker", (x, y, 0.18), (1.65, 0.05, 0.05), mats["accent"], bevel=0.01)

    bpy.ops.object.camera_add(location=(13.8, -16.0, 14.5))
    camera = bpy.context.object
    camera.name = "CAM_GAME"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 18.4
    target = Vector((0.0, 0.55, 1.1))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-5.0, -7.0, 15.0))
    key = bpy.context.object
    key.name = "LIGHT_KEY_NW"
    key.data.energy = 1300
    key.data.shape = "DISK"
    key.data.size = 8.0
    key.data.color = palette["lighting"][:3]
    key.rotation_euler = ((Vector((0.0, 1.0, 0.0)) - key.location).to_track_quat("-Z", "Y").to_euler())
    bpy.ops.object.light_add(type="AREA", location=(7.0, 5.0, 10.0))
    fill = bpy.context.object
    fill.name = "LIGHT_FILL"
    fill.data.energy = 560
    fill.data.size = 10.0
    fill.data.color = palette["fill"][:3]
    fill.rotation_euler = ((Vector((0.0, 0.0, 1.0)) - fill.location).to_track_quat("-Z", "Y").to_euler())

    scene = bpy.context.scene
    scene.world.color = palette["sky"][:3]
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 576
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.render.film_transparent = True
    scene.render.image_settings.compression = 15
    scene.render.filepath = ""
    scene.render.fps = 24
    scene.view_settings.look = "AgX - Medium High Contrast"
    return scene, camera


def main():
    args = parse_args()
    started = time.perf_counter()
    output = Path(args.output).resolve()
    metadata_path = Path(args.metadata).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene, camera = create_scene(args.direction)
    scene.render.filepath = str(output)
    bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix(".blend")))
    bpy.ops.render.render(write_still=True)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    metadata = {
        "schemaVersion": 1,
        "assetId": f"visual_direction_spike_{args.direction}",
        "type": "visual_direction_spike_render",
        "direction": args.direction,
        "label": DIRECTIONS[args.direction]["label"],
        "origin": "original",
        "license": "PROJECT-ASSET-LICENSE",
        "author": "Landlord project / procedural pipeline",
        "source": str(output.with_suffix(".blend").relative_to(Path.cwd())) if output.with_suffix(".blend").is_relative_to(Path.cwd()) else str(output.with_suffix(".blend")),
        "toolchain": {"blender": "5.2.2", "renderer": "BLENDER_EEVEE"},
        "camera": {"projection": "ORTHO", "azimuthBaseline": 45, "elevationBaseline": 30, "orthoScale": camera.data.ortho_scale},
        "render": {"width": scene.render.resolution_x, "height": scene.render.resolution_y, "colorMode": "RGBA", "colorDepth": 16, "elapsedMs": elapsed_ms},
        "kit": ["residential", "industrial", "road", "parcel", "worker", "civilian", "vehicle", "scaffold", "smoke", "selection", "ownership"],
        "reproducibility": {"seed": 42, "script": "tools/art-pipeline/blender/visual_direction_spike.py"},
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"direction": args.direction, "output": str(output), "metadata": str(metadata_path), "elapsedMs": elapsed_ms}))


if __name__ == "__main__":
    main()

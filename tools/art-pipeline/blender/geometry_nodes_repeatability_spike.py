"""D-111 V.f Geometry Nodes spike: repeat a real licensed facade module on authored points.

Run with Blender 5.2.2:
  blender -b --factory-startup -P tools/art-pipeline/blender/geometry_nodes_repeatability_spike.py -- --outDir=...

This is a bounded experiment, not a production path. The Python control and GN candidate use the
same catalog module and the same point coordinates. The report records whether GN lowers object
count while retaining instance count and positions; it does not replace Composer seed/validation.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from building_composer.module_catalog import Catalog, REPO_ROOT
from building_composer.scene import import_module_source, selected_meshes


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--outDir", required=True)
    return parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])[0]


def make_nodes(source, count, start_x, spacing):
    group = bpy.data.node_groups.new("D111_Facade_Repeat", "GeometryNodeTree")
    group.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes, links = group.nodes, group.links
    input_node = nodes.new("NodeGroupInput")
    output_node = nodes.new("NodeGroupOutput")
    line = nodes.new("GeometryNodeMeshLine")
    line.inputs["Count"].default_value = count
    line.inputs["Start Location"].default_value = (start_x, 0.0, 0.0)
    line.inputs["Offset"].default_value = (spacing, 0.0, 0.0)
    source_info = nodes.new("GeometryNodeObjectInfo")
    source_info.inputs["Object"].default_value = source
    source_info.transform_space = "ORIGINAL"
    source_info.inputs["As Instance"].default_value = True
    instance = nodes.new("GeometryNodeInstanceOnPoints")
    links.new(line.outputs["Mesh"], instance.inputs["Points"])
    links.new(source_info.outputs["Geometry"], instance.inputs["Instance"])
    links.new(instance.outputs["Instances"], output_node.inputs["Geometry"])
    return group


def main():
    args = parse_args()
    out_dir = Path(args.outDir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog = Catalog()
    module = catalog.pick("residential_low", "wall_panel", "mod_megakit_brick_wall_2m")
    imported, _normalization = import_module_source(module, {})
    source = selected_meshes(imported, module.meshes, module.id)[0]
    source.hide_render = True
    # Keep the source available in the dependency graph: hide_set removes it from
    # GeometryNodeObjectInfo evaluation in headless Blender. hide_render keeps the
    # original from appearing in the comparison render while preserving provenance.
    bpy.context.view_layer.update()

    count, spacing, start_x = 8, 2.0, -7.0
    python_collection = bpy.data.collections.new("Python_Control")
    bpy.context.scene.collection.children.link(python_collection)
    python_started = time.perf_counter()
    for index in range(count):
        item = bpy.data.objects.new(f"python_bay_{index:02d}", source.data)
        python_collection.objects.link(item)
        item.location = (start_x + index * spacing, -4.0, 0.0)
    python_setup_ms = round((time.perf_counter() - python_started) * 1000, 3)

    gn_started = time.perf_counter()
    gn_object = bpy.data.objects.new("GeometryNodes_Candidate", None)
    bpy.context.scene.collection.objects.link(gn_object)
    gn_object.location.y = 4.0
    gn_object.modifiers.new("D111_GN_Repeat", "NODES").node_group = make_nodes(
        source, count, start_x, spacing
    )
    bpy.context.view_layer.update()
    gn_setup_ms = round((time.perf_counter() - gn_started) * 1000, 3)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    actual_x = []
    for instance in depsgraph.object_instances:
        if instance.is_instance:
            # Blender invalidates DepsgraphObjectInstance wrappers after iteration;
            # copy primitive values while each wrapper is live.
            actual_x.append(round(instance.matrix_world.translation.x, 5))
    expected_x = [round(start_x + index * spacing, 5) for index in range(count)]
    actual_x.sort()
    positions_match = len(actual_x) == count and actual_x == expected_x

    # Ground, camera and one area light give a compact visual check of the repeated licensed module.
    bpy.ops.mesh.primitive_plane_add(size=32, location=(0.0, 0.0, -0.08))
    ground = bpy.context.object
    ground.name = "QA_Ground"
    ground_mat = bpy.data.materials.new("QA_Matte_Ground")
    ground_mat.diffuse_color = (0.34, 0.32, 0.28, 1.0)
    ground_mat.roughness = 0.9
    ground.data.materials.append(ground_mat)
    bpy.ops.object.light_add(type="AREA", location=(0.0, -8.0, 16.0))
    light = bpy.context.object
    light.data.energy = 2500
    light.data.shape = "DISK"
    light.data.size = 12
    bpy.ops.object.camera_add(location=(0.0, -24.0, 22.0))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 28
    camera.rotation_euler = (Vector((0.0, 0.0, 0.0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_taa_reprojection = False
    scene.eevee.taa_render_samples = 64
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = str(out_dir / "geometry-nodes-repeatability.png")
    render_started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    render_ms = round((time.perf_counter() - render_started) * 1000, 3)

    report = {
        "schemaVersion": 1,
        "purpose": "D-111 controlled repeat test; Geometry Nodes candidate vs Python linked-object control",
        "toolchain": {"blender": bpy.app.version_string, "renderer": "EEVEE"},
        "module": {"moduleId": module.id, "sourcePath": module.source_path, "license": module.license},
        "inputs": {"count": count, "spacingMeters": spacing, "startXMeters": start_x},
        "control": {"linkedMeshObjects": count, "setupMs": python_setup_ms},
        "candidate": {"geometryNodesObjects": 1, "evaluatedInstances": len(actual_x), "setupMs": gn_setup_ms},
        "renderMs": render_ms,
        "positionsMatch": positions_match,
        "expectedInstanceX": expected_x,
        "actualInstanceX": actual_x,
        "decision": "evaluate integration only if further tests preserve seeded point layout and module provenance",
        "image": "geometry-nodes-repeatability.png",
    }
    (out_dir / "geometry-nodes-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False))
    if not positions_match:
        raise SystemExit("Geometry Nodes instance count does not match authored point count")


if __name__ == "__main__":
    main()

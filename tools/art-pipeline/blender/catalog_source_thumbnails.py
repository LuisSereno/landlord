"""Render deterministic staging candidates for the V.e.0 visual-source contact sheets."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args_after_separator() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials, bpy.data.images, bpy.data.curves, bpy.data.meshes):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def import_model(source: Path) -> None:
    extension = source.suffix.lower()
    if extension in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif extension == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    elif extension == ".obj":
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        raise ValueError(f"Unsupported catalog format: {extension}")


def bounds() -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for obj in bpy.context.scene.objects if obj.type == "MESH" for corner in obj.bound_box]
    if not points:
        raise ValueError("Imported source contains no mesh objects")
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def normalize() -> None:
    minimum, maximum = bounds()
    size = maximum - minimum
    scale = 4.0 / max(size.x, size.y, size.z, 0.001)
    center = (minimum + maximum) * 0.5
    for obj in [entry for entry in bpy.context.scene.objects if entry.parent is None]:
        obj.location = (obj.location - center) * scale
        obj.location.z += size.z * scale * 0.5
        obj.scale *= scale


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene(output: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(output)
    scene.world.color = (0.025, 0.04, 0.065)

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.02))
    plane = bpy.context.object
    material = bpy.data.materials.new("catalog-ground")
    material.diffuse_color = (0.09, 0.13, 0.18, 1.0)
    plane.data.materials.append(material)

    bpy.ops.object.light_add(type="AREA", location=(4, -4, 8))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 5
    bpy.ops.object.light_add(type="AREA", location=(-4, 1, 4))
    bpy.context.object.data.energy = 450
    bpy.context.object.data.size = 4

    bpy.ops.object.camera_add(location=(6.5, -7.5, 5.5))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.5
    point_at(camera, Vector((0, 0, 1.4)))
    scene.camera = camera


def main() -> None:
    arguments = args_after_separator()
    if len(arguments) != 2:
        raise SystemExit("usage: blender ... -- inventory.json output-dir")
    inventory_path, output_dir = Path(arguments[0]), Path(arguments[1])
    inventory = json.loads(inventory_path.read_text(encoding="utf8"))
    output_dir.mkdir(parents=True, exist_ok=True)
    rendered: dict[str, list[dict[str, str]]] = {}
    for category, candidates in inventory["contactSheetCandidates"].items():
        rendered[category] = []
        for index, candidate in enumerate(candidates, start=1):
            source = Path(candidate["file"])
            target = output_dir / f"{category}-{index:02d}.png"
            clear_scene()
            import_model(source)
            normalize()
            setup_scene(target)
            bpy.ops.render.render(write_still=True)
            rendered[category].append({"file": candidate["file"], "thumbnail": target.name})
    (output_dir / "rendered.json").write_text(json.dumps(rendered, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()

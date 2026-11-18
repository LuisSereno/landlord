"""
Asta de bandera original para la plaza cívica del ayuntamiento (town_hall).

Geometría propia: basa escalonada, mástil metálico y bandera con vuelo simple.
Huella <= 1.0 x 1.0 m; altura 6 m. No copia ningún asset protegido.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_flagpole.py
"""

import bpy
import os


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.6
    return mat


def box(name, sx, sy, sz, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], loc[2] + sz / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def main():
    clear_scene()
    stone = material("flagpole_stone", (0.75, 0.72, 0.66))
    metal = material("flagpole_metal", (0.8, 0.8, 0.82))
    cloth = material("flagpole_cloth", (0.68, 0.2, 0.22))
    parts = []

    parts.append(box("base_step", 0.9, 0.9, 0.18, (0, 0, 0.0), stone))
    parts.append(box("base_pedestal", 0.6, 0.6, 0.35, (0, 0, 0.18), stone))
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.05, depth=5.4, location=(0, 0, 0.53 + 2.7))
    pole = bpy.context.active_object
    pole.name = "pole"
    pole.data.materials.append(metal)
    parts.append(pole)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.09, location=(0, 0, 6.0))
    finial = bpy.context.active_object
    finial.name = "finial"
    finial.data.materials.append(metal)
    parts.append(finial)
    flag = box("flag", 1.3, 0.04, 0.8, (0.7, 0, 5.0), cloth)
    parts.append(flag)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    prop = bpy.context.active_object
    prop.name = "Flagpole"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "flagpole.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "flagpole.glb"), export_format='GLB', use_selection=True)
    print("Asta de bandera original creada:", prop.name)


if __name__ == "__main__":
    main()
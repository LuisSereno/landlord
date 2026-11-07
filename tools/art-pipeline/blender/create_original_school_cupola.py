"""
Genera una cupula/linterna de campanario para el colegio americano (school_block).

Geometría original: pedestal + cuatro postes + campana + techo piramidal + remate.
Huella <= 1.7 x 1.7 m para caber en un volumen apilado de 1 celda (2 x 2 m).
No copia ningún edificio protegido; es una linterna genérica compatible con Graphic Civic.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_school_cupola.py
"""

import bpy
import os


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def box(name, sx, sy, sz, z):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z + sz / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    return obj


def main():
    clear_scene()
    parts = []
    parts.append(box("pedestal", 1.6, 1.6, 0.25, 0.0))
    for i, (x, y) in enumerate([(-0.65, -0.65), (0.65, -0.65), (-0.65, 0.65), (0.65, 0.65)]):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.25 + 0.55))
        post = bpy.context.active_object
        post.name = f"post{i}"
        post.scale = (0.06, 0.06, 0.55)
        bpy.ops.object.transform_apply(scale=True)
        parts.append(post)
    parts.append(box("entablature", 1.5, 1.5, 0.15, 1.35))
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.28, radius2=0.10, depth=0.4, location=(0, 0, 1.05))
    bell = bpy.context.active_object
    bell.name = "bell"
    parts.append(bell)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.2, radius2=0.0, depth=0.7, location=(0, 0, 1.5 + 0.35))
    roof = bpy.context.active_object
    roof.name = "pyramid_roof"
    roof.rotation_euler[2] = 0.7853981634
    parts.append(roof)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.09, location=(0, 0, 2.28))
    finial = bpy.context.active_object
    finial.name = "finial"
    parts.append(finial)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    cupola = bpy.context.active_object
    cupola.name = "SchoolCupola"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "school_cupola.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "school_cupola.glb"), export_format='GLB', use_selection=True)
    print("Cúpula de colegio original creada:", cupola.name)


if __name__ == "__main__":
    main()
"""
Zona de juegos escolar original para el patio del colegio (school_block).

Geometría propia: pórtico de columpios con dos asientos + tobogán compacto.
Huella <= 3.6 x 3.0 m para caber en una celda de 4 m del patio escolar.
No copia ningún asset protegido; lenguaje genérico compatible con Graphic Civic.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_school_playground.py
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
    bsdf.inputs["Roughness"].default_value = 0.7
    return mat


def box(name, sx, sy, sz, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], loc[2] + sz / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, loc, mat, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def main():
    clear_scene()
    frame = material("playground_frame", (0.72, 0.22, 0.18))
    seat = material("playground_seat", (0.9, 0.72, 0.25))
    slide = material("playground_slide", (0.3, 0.55, 0.75))
    parts = []

    # Pórtico de columpios: dos pares de postes en A y barra superior.
    for x in (-1.5, 1.5):
        for y, tilt in ((-0.5, 0.22), (0.5, -0.22)):
            post = cylinder(f"swing_post_{x}_{y}", 0.05, 2.3, (x, y, 1.15), frame)
            post.rotation_euler[0] = tilt
            parts.append(post)
    parts.append(cylinder("swing_bar", 0.05, 3.2, (0, 0, 2.25), frame))
    parts[-1].rotation_euler[1] = 1.5707963
    for x in (-0.7, 0.7):
        parts.append(box(f"swing_chain_{x}", 0.03, 0.03, 1.5, (x, 0, 0.75), frame))
        parts.append(box(f"swing_seat_{x}", 0.5, 0.22, 0.06, (x, 0, 0.45), seat))

    # Tobogán compacto al lado: plataforma, rampa y escalera.
    parts.append(box("slide_platform", 0.8, 0.8, 0.12, (0, 1.1, 1.0), frame))
    for x in (-0.35, 0.35):
        for y in (0.75, 1.45):
            parts.append(cylinder(f"slide_leg_{x}_{y}", 0.04, 1.0, (x, y, 0.5), frame))
    ramp = box("slide_ramp", 0.6, 1.6, 0.06, (0, 0.1, 0.55), slide)
    ramp.rotation_euler[0] = -0.62
    parts.append(ramp)
    for i in range(3):
        parts.append(box(f"slide_step_{i}", 0.6, 0.22, 0.05, (0, 1.65, 0.3 + i * 0.3), frame))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    prop = bpy.context.active_object
    prop.name = "SchoolPlayground"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "school_playground.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "school_playground.glb"), export_format='GLB', use_selection=True)
    print("Zona de juegos escolar original creada:", prop.name)


if __name__ == "__main__":
    main()
"""
Puesto de mercado original para el patio del mercado (market_hall).

Geometría propia: mostrador de obra, cuatro postes, toldo inclinado a dos aguas
y cajas de género. Huella <= 3.2 x 2.2 m para una celda de 4 m del patio.
No copia ningún asset protegido; lenguaje genérico compatible con Graphic Civic.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_market_stall.py
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
    bsdf.inputs["Roughness"].default_value = 0.75
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
    masonry = material("stall_masonry", (0.78, 0.72, 0.62))
    wood = material("stall_wood", (0.55, 0.4, 0.26))
    awning_a = material("stall_awning_red", (0.75, 0.25, 0.2))
    awning_b = material("stall_awning_cream", (0.9, 0.85, 0.72))
    crate = material("stall_crates", (0.62, 0.48, 0.3))
    parts = []

    parts.append(box("counter", 2.8, 0.9, 0.9, (0, -0.4, 0.0), masonry))
    parts.append(box("counter_top", 3.0, 1.0, 0.08, (0, -0.4, 0.9), wood))
    for x in (-1.4, 1.4):
        for y in (-0.9, 0.9):
            parts.append(box(f"post_{x}_{y}", 0.09, 0.09, 2.3, (x, y, 0.0), wood))
    # Toldo a dos aguas con franjas alternas.
    for i in range(6):
        strip = box(f"awning_front_{i}", 0.5, 1.15, 0.05, (-1.25 + i * 0.5, -0.55, 2.32),
                    awning_a if i % 2 == 0 else awning_b)
        strip.rotation_euler[0] = 0.28
        parts.append(strip)
        strip_back = box(f"awning_back_{i}", 0.5, 1.15, 0.05, (-1.25 + i * 0.5, 0.55, 2.32),
                         awning_a if i % 2 == 0 else awning_b)
        strip_back.rotation_euler[0] = -0.28
        parts.append(strip_back)
    parts.append(box("awning_ridge", 3.0, 0.12, 0.08, (0, 0, 2.45), wood))
    parts.append(box("crate_a", 0.5, 0.5, 0.35, (-0.9, 0.5, 0.0), crate))
    parts.append(box("crate_b", 0.5, 0.5, 0.35, (-0.3, 0.55, 0.0), crate))
    parts.append(box("crate_c", 0.45, 0.45, 0.3, (-0.6, 0.5, 0.35), crate))
    parts.append(box("goods_a", 0.6, 0.4, 0.18, (0.6, -0.4, 0.98), awning_b))
    parts.append(box("goods_b", 0.5, 0.35, 0.15, (1.1, -0.35, 0.98), awning_a))

    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    prop = bpy.context.active_object
    prop.name = "MarketStall"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "market_stall.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "market_stall.glb"), export_format='GLB', use_selection=True)
    print("Puesto de mercado original creado:", prop.name)


if __name__ == "__main__":
    main()
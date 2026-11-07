"""
Genera los módulos originales del vocabulario de estados del Building Composer (V.j).

Cuatro módulos de geometría propia, compatibles con Graphic Civic, para los estados construction /
damaged / burning:
  - ConstructionBarrier: valla de obra de dos tablones horizontales sobre patas (2 m × 1 m).
  - DamageDebris: montón de escombros (bloque roto irregular) para el pie de un edificio dañado.
  - FireFlame: lengua de llama estilizada (emisiva) para el estado burning.
  - FireSmoke: columna de humo estilizada (pufos) para el estado burning.

No copia ningún asset protegido; vocabulario genérico de obra/daño/fuego. Cada módulo se exporta
como .blend/.glb independiente a sources/original/ para medirlo y registrarlo en el catálogo.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_state_modules.py
"""

import bpy
import math
import os


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(name, rgb, roughness=0.8, emission=None, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission[0], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
    return mat


def box(name, sx, sy, sz, location, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def join_export(parts, name, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, f"{filename}.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, f"{filename}.glb"), export_format="GLB", use_selection=True
    )
    print(f"Módulo original creado: {name} -> {filename}.glb")


def build_barrier():
    clear_scene()
    orange = material("barrier_orange", (0.85, 0.4, 0.1))
    white = material("barrier_white", (0.9, 0.9, 0.88))
    steel = material("barrier_leg", (0.4, 0.42, 0.45))
    parts = []
    for i, x in enumerate((-0.85, 0.85)):
        parts.append(box(f"leg{i}", 0.06, 0.5, 1.0, (x, 0.0, 0.5), steel))
    parts.append(box("board_top", 1.9, 0.06, 0.23, (0.0, 0.0, 0.99), orange))
    parts.append(box("board_mid", 1.9, 0.06, 0.23, (0.0, 0.0, 0.62), white))
    join_export(parts, "ConstructionBarrier", "construction_barrier")


def build_debris():
    clear_scene()
    rubble = material("debris_rubble", (0.45, 0.42, 0.38))
    brick = material("debris_brick", (0.55, 0.3, 0.22))
    char = material("debris_char", (0.2, 0.18, 0.16))
    parts = []
    # Montón irregular de bloques rotos en distintas posiciones/ángulos ( determinista).
    chunks = [
        (0.0, 0.0, 0.12, 0.5, 0.4, 0.24, 0.2, rubble),
        (-0.35, 0.15, 0.1, 0.34, 0.3, 0.2, 0.5, brick),
        (0.3, -0.1, 0.09, 0.3, 0.28, 0.18, -0.4, rubble),
        (0.1, 0.25, 0.22, 0.26, 0.24, 0.2, 0.9, char),
        (-0.2, -0.2, 0.08, 0.24, 0.22, 0.16, 0.3, brick),
        (0.4, 0.2, 0.07, 0.2, 0.2, 0.14, -0.7, rubble),
        (-0.45, -0.05, 0.06, 0.18, 0.18, 0.12, 0.6, char),
        (0.0, -0.3, 0.16, 0.22, 0.2, 0.18, 1.2, brick),
    ]
    for i, (x, y, z, sx, sy, sz, rz, mat) in enumerate(chunks):
        parts.append(box(f"chunk{i}", sx, sy, sz, (x, y, z), mat, rotation=(0.1 * i, 0.05 * i, rz)))
    join_export(parts, "DamageDebris", "damage_debris")


def build_flame():
    clear_scene()
    flame_outer = material("flame_outer", (1.0, 0.45, 0.1), emission=((1.0, 0.35, 0.05), 3.0))
    flame_inner = material("flame_inner", (1.0, 0.8, 0.25), emission=((1.0, 0.7, 0.2), 5.0))
    parts = []
    for i, (x, y, r, h) in enumerate(
        [(0.0, 0.0, 0.28, 1.0), (-0.18, 0.05, 0.18, 0.7), (0.16, -0.08, 0.16, 0.6)]
    ):
        bpy.ops.mesh.primitive_cone_add(
            vertices=10, radius1=r, radius2=0.02, depth=h, location=(x, y, h / 2)
        )
        tongue = bpy.context.active_object
        tongue.name = "flame_tongue"
        tongue.data.materials.append(flame_outer if i else flame_inner)
        parts.append(tongue)
    join_export(parts, "FireFlame", "fire_flame")


def build_smoke():
    clear_scene()
    smoke = material("fire_smoke", (0.25, 0.24, 0.23), roughness=1.0, alpha=0.85)
    parts = []
    puffs = [
        (0.0, 0.0, 0.4, 0.32),
        (0.1, 0.05, 0.85, 0.4),
        (-0.12, -0.05, 1.3, 0.46),
        (0.05, 0.08, 1.75, 0.5),
    ]
    for i, (x, y, z, r) in enumerate(puffs):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=10, ring_count=8, radius=r, location=(x, y, z)
        )
        puff = bpy.context.active_object
        puff.name = "smoke_puff"
        puff.data.materials.append(smoke)
        parts.append(puff)
    join_export(parts, "FireSmoke", "fire_smoke")


def main():
    build_barrier()
    build_debris()
    build_flame()
    build_smoke()


if __name__ == "__main__":
    main()

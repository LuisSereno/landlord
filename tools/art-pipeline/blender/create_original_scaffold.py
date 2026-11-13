"""
Genera un módulo de andamio de fachada para los estados de obra (construction) del Building Composer.

Geometría original: bastidor metálico de una crujía (2 m de desarrollo × 3 m de altura, la planta del
perfil Graphic Civic) con dos postes, tres niveles de largueros, una diagonal, dos plataformas de
tablones y zapatas. Pensado para teselar a lo largo de la fachada en la etapa `structure` (envolvente)
y `finishing` (una cara). No copia ningún asset protegido; vocabulario genérico de obra compatible
con Graphic Civic.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_scaffold.py
"""

import bpy
import os


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.7
    return mat


def box(name, sx, sy, sz, location, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return obj


def main():
    clear_scene()
    steel = material("scaffold_steel", (0.45, 0.47, 0.50))
    wood = material("scaffold_plank", (0.55, 0.42, 0.28))
    parts = []
    # Dos postes verticales en los extremos de la crujía (eje X = desarrollo de fachada).
    for i, x in enumerate((-0.9, 0.9)):
        parts.append(box(f"post{i}", 0.06, 0.06, 3.0, (x, 0.0, 1.5), steel))
        parts.append(box(f"base{i}", 0.2, 0.2, 0.04, (x, 0.0, 0.02), steel))
    # Largueros horizontales a tres alturas (conectan los postes en el plano de fachada).
    for level, z in enumerate((0.5, 1.5, 2.9)):
        parts.append(box(f"rail{level}", 1.86, 0.05, 0.05, (0.0, 0.0, z), steel))
        # Barandilla trasera desplazada para dar profundidad al bastidor.
        parts.append(box(f"rail_back{level}", 1.86, 0.05, 0.05, (0.0, 0.4, z), steel))
    # Postes traseros y travesaños de profundidad (el andamio tiene ~0.4 m de fondo).
    for i, x in enumerate((-0.9, 0.9)):
        parts.append(box(f"post_back{i}", 0.06, 0.06, 3.0, (x, 0.4, 1.5), steel))
        for level, z in enumerate((0.5, 1.5, 2.9)):
            parts.append(box(f"transom{level}_{i}", 0.05, 0.4, 0.05, (x, 0.2, z), steel))
    # Diagonal de rigidización en el plano frontal.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.0, 0.0, 1.7))
    diag = bpy.context.active_object
    diag.name = "diagonal"
    diag.scale = (0.04, 0.04, 1.5)
    diag.rotation_euler[1] = 0.62
    bpy.ops.object.transform_apply(scale=True)
    diag.data.materials.append(steel)
    parts.append(diag)
    # Plataformas de tablones a media altura y a coronación.
    for level, z in enumerate((1.52, 2.92)):
        for plank in range(4):
            y = 0.05 + plank * 0.1
            parts.append(box(f"plank{level}_{plank}", 1.8, 0.09, 0.04, (0.0, y, z), wood))

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    scaffold = bpy.context.active_object
    scaffold.name = "ConstructionScaffold"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    out_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "construction_scaffold.blend"))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out_dir, "construction_scaffold.glb"),
        export_format="GLB",
        use_selection=True,
    )
    print("Andamio de obra original creado:", scaffold.name)


if __name__ == "__main__":
    main()

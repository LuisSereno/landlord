"""Genera la columna y el paño calizo del town_hall neoclásico (D-111.3 FASE 6).

Geometría original parametrizada, sin copiar ningún edificio real. Ambas piezas no llevan
material: como el frontón cívico, se renderizan con el gris claro por defecto del pipeline —
la piedra caliza clara que pide la dirección neoclásica — y quedan fuera del vocabulario §11.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_neoclassical_townhall.py
"""

import bpy
import bmesh
import os


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def make_box(bm, size, center):
    """Caja centrada en `center` con tamaño `size` (x, y, z)."""
    sx, sy, sz = size[0] / 2.0, size[1] / 2.0, size[2] / 2.0
    cx, cy, cz = center
    verts = []
    for sign_x in (-1, 1):
        for sign_y in (-1, 1):
            for sign_z in (-1, 1):
                verts.append(bm.verts.new((cx + sign_x * sx, cy + sign_y * sy, cz + sign_z * sz)))
    # Índices de las 8 esquinas: (x,y,z) → v[4*i + 2*j + k] con i=x, j=y, k=z
    def v(sx_i, sy_i, sz_i):
        return verts[sx_i * 4 + sy_i * 2 + sz_i]

    faces = [
        (v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)),  # frente (y-)
        (v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)),  # atrás (y+)
        (v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)),  # izquierda (x-)
        (v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)),  # derecha (x+)
        (v(0, 0, 1), v(0, 1, 1), v(1, 1, 1), v(1, 0, 1)),  # arriba
        (v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)),  # abajo
    ]
    for face in faces:
        bm.faces.new(face)


def create_column():
    """Columna exenta de orden toscano simplificado: basa, fuste con éntasis por escalones y capitel.

    Altura total 5,9 m = 2 plantas de 3 m del town_hall menos la cota del entablamento.
    Origen en el suelo, centrada en XY.
    """
    mesh = bpy.data.meshes.new("NeoclassicalColumn")
    bm = bmesh.new()
    make_box(bm, (0.72, 0.72, 0.30), (0.0, 0.0, 0.15))    # basa
    make_box(bm, (0.60, 0.60, 0.20), (0.0, 0.0, 0.40))    # toro de la basa
    make_box(bm, (0.50, 0.50, 4.60), (0.0, 0.0, 2.80))    # fuste
    make_box(bm, (0.58, 0.58, 0.12), (0.0, 0.0, 5.16))    # collarino
    make_box(bm, (0.74, 0.74, 0.34), (0.0, 0.0, 5.39))    # capitel
    make_box(bm, (0.86, 0.86, 0.18), (0.0, 0.0, 5.65))    # ábaco
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("NeoclassicalColumn", mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def create_wall():
    """Paño calizo de 2 m con cornisa corrida en coronación: muro liso + dintel superior.

    2 × 3 m (una crujía del town_hall), profundidad 0,3 m; origen en el suelo, centrado en XY.
    """
    mesh = bpy.data.meshes.new("NeoclassicalWall")
    bm = bmesh.new()
    make_box(bm, (2.0, 0.30, 2.82), (0.0, 0.0, 1.41))     # paño liso
    make_box(bm, (2.0, 0.42, 0.18), (0.0, 0.0, 2.91))     # cornisa volada
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("NeoclassicalWall", mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def export_glb(obj, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=output_path, use_selection=True, export_format="GLB")
    print(f"Exportado: {output_path}")


def main():
    clear_scene()
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    original_dir = os.path.join(repo_root, "blender_artist", "sources", "original")
    export_glb(create_column(), os.path.join(original_dir, "neoclassical_column.glb"))
    clear_scene()
    export_glb(create_wall(), os.path.join(original_dir, "neoclassical_wall_2m.glb"))
    print("Piezas neoclásicas originales creadas correctamente.")


if __name__ == "__main__":
    main()

"""
Genera un frontón triangular simple para el town_hall neoclásico.

Geometría original: triángulo equilátero con base de 8m y altura proporcional.
No copia la Casa Blanca, es un frontón genérico compatible con Graphic Civic.

Uso:
  blender --background --python tools/art-pipeline/blender/create_original_civic_pediment.py
"""

import bpy
import bmesh
import sys
import os

def clear_scene():
    """Limpia la escena por completo."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_pediment():
    """Crea un frontón triangular: base rectangular + triángulo superior.
    
    Dimensiones:
    - Ancho: 8m (para cubrir el cuerpo central de 4 celdas × 2m)
    - Profundidad: 0.4m (profundidad del frontón)
    - Altura total: 2m (base 0.5m + triángulo 1.5m)
    """
    width = 8.0
    depth = 0.4
    base_height = 0.5
    triangle_height = 1.5
    
    # Crear mesh con bmesh para control preciso de vértices
    mesh = bpy.data.meshes.new("CivicPediment")
    bm = bmesh.new()
    
    # Vértices de la base rectangular (8 vértices: 4 abajo, 4 arriba de la base)
    # Cara frontal (Y = 0)
    v0 = bm.verts.new((0, 0, 0))  # abajo-izquierda
    v1 = bm.verts.new((width, 0, 0))  # abajo-derecha
    v2 = bm.verts.new((width, 0, base_height))  # arriba-derecha-base
    v3 = bm.verts.new((0, 0, base_height))  # arriba-izquierda-base
    v4 = bm.verts.new((width / 2, 0, base_height + triangle_height))  # ápice
    
    # Cara trasera (Y = -depth)
    v5 = bm.verts.new((0, -depth, 0))
    v6 = bm.verts.new((width, -depth, 0))
    v7 = bm.verts.new((width, -depth, base_height))
    v8 = bm.verts.new((0, -depth, base_height))
    v9 = bm.verts.new((width / 2, -depth, base_height + triangle_height))
    
    # Caras de la base rectangular
    # Frente (abajo)
    bm.faces.new([v0, v1, v2, v3])
    # Trasera (abajo)
    bm.faces.new([v5, v8, v7, v6])
    # Izquierda
    bm.faces.new([v0, v3, v8, v5])
    # Derecha
    bm.faces.new([v1, v6, v7, v2])
    # Arriba de la base (donde empieza el triángulo)
    bm.faces.new([v3, v2, v7, v8])
    
    # Caras del triángulo superior
    # Frente del triángulo
    bm.faces.new([v3, v2, v4])
    # Trasera del triángulo
    bm.faces.new([v8, v9, v7])
    # Izquierda del triángulo
    bm.faces.new([v3, v4, v9, v8])
    # Derecha del triángulo
    bm.faces.new([v2, v7, v9, v4])
    
    # Aplicar bmesh al mesh
    bm.to_mesh(mesh)
    bm.free()
    
    # Crear objeto
    obj = bpy.data.objects.new("CivicPediment", mesh)
    bpy.context.collection.objects.link(obj)
    
    # Centrar el objeto en el origen
    obj.location = (-width / 2, depth / 2, 0)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    
    return obj

def save_blend(output_path):
    """Guarda el .blend."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    print(f"Guardado: {output_path}")

def main():
    clear_scene()
    create_pediment()
    
    # Guardar en sources/original/
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    output_path = os.path.join(repo_root, "blender_artist", "sources", "original", "civic_pediment.blend")
    save_blend(output_path)
    
    print("Frontón cívico original creado correctamente.")

if __name__ == "__main__":
    main()

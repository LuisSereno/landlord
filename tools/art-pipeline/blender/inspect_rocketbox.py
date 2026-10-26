"""WP4.15-V: inspecciona la estructura interna de un FBX de Microsoft Rocketbox.

    blender --background --python inspect_rocketbox.py -- <ruta.fbx>
"""

import sys
from pathlib import Path

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
fbx = Path(argv[0]) if argv else None
if fbx is None or not fbx.exists():
    print("Uso: blender --background --python inspect_rocketbox.py -- <ruta.fbx>")
    sys.exit(1)

before = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.fbx(filepath=str(fbx))
new = [o for o in bpy.data.objects if o.name not in before]

print(f"\n=== {fbx.name} ===")
print(f"objetos importados: {len(new)}")
for obj in sorted(new, key=lambda o: o.name):
    parent = obj.parent.name if obj.parent else "-"
    if obj.type == "MESH":
        print(f"  MESH  {obj.name:28s} verts={len(obj.data.vertices):7d} "
              f"mats={len(obj.data.materials)} parent={parent}")
    elif obj.type == "ARMATURE":
        print(f"  ARM   {obj.name:28s} bones={len(obj.data.bones)} parent={parent}")
    else:
        print(f"  {obj.type:5s} {obj.name:28s} parent={parent}")

print("\n=== materiales e imagenes ===")
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            exists = Path(bpy.path.abspath(node.image.filepath)).exists()
            print(f"  {mat.name:22s} <- {node.image.filepath}  [local={exists}]")

print("\n=== dimensiones del bind pose ===")
for obj in new:
    if obj.type == "MESH" and len(obj.data.vertices) > 500:
        bb = [obj.matrix_world @ __import__("mathutils").Vector(c) for c in obj.bound_box]
        h = max(v.z for v in bb) - min(v.z for v in bb)
        print(f"  {obj.name}: altura={h:.3f} m")

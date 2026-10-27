"""
WP4.15-V: Modelar ropa de gánster para personaje de Quaternius (v2).

Crea geometría de ropa (camisa, chaqueta, pantalones, sombrero)
que se ajusta mejor al rig de Superhero_Male_FullBody.fbx.
Usa formas más orgánicas en lugar de cajas simples.
"""

import bpy
import mathutils
import math
import os

# Paths
ROOT = "/home/luis/RepositorioGitHub/landlord"
CHARACTER_FBX = f"{ROOT}/blender_artist/staging/third_party/cc0/extracted/quaternius/base-characters/Universal Base Characters[Standard]/Base Characters/Unity/Superhero_Male_FullBody.fbx"
TEXTURES_DIR = f"{ROOT}/blender_artist/staging/third_party/cc0/extracted/quaternius/base-characters/Universal Base Characters[Standard]/Base Characters/Textures"
OUTPUT_DIR = f"{ROOT}/blender_artist/spike"


def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_character():
    """Import character FBX and fix texture paths."""
    bpy.ops.import_scene.fbx(filepath=CHARACTER_FBX)

    # Fix texture paths
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                filename = os.path.basename(node.image.filepath)
                local_path = os.path.join(TEXTURES_DIR, filename)
                if os.path.exists(local_path):
                    node.image.filepath = local_path
                    node.image.reload()

    # Find character mesh
    character = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH' and len(obj.data.vertices) > 1000:
            character = obj
            break

    return character


def create_material(name, color, roughness=0.7):
    """Create a simple PBR material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = roughness
    return mat


def create_cylinder_mesh(name, radius_top, radius_bottom, height, segments, material, location=(0, 0, 0)):
    """Create a cylinder mesh."""
    bpy.ops.mesh.primitive_cylinder_add(
        radius=1,
        depth=height,
        vertices=segments,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name

    # Scale to create tapered shape
    obj.scale = (radius_top, radius_bottom, 1.0)

    obj.data.materials.append(material)
    return obj


def create_box_mesh(name, dimensions, material, location=(0, 0, 0)):
    """Create a box mesh."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name

    # Scale to dimensions
    obj.scale = dimensions

    obj.data.materials.append(material)
    return obj


def model_gangster_clothing_v2(character):
    """Create improved gangster clothing pieces."""

    # Get character dimensions
    bbox = [character.matrix_world @ mathutils.Vector(v) for v in character.bound_box]
    min_x = min(v.x for v in bbox)
    max_x = max(v.x for v in bbox)
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)
    min_z = min(v.z for v in bbox)
    max_z = max(v.z for v in bbox)

    width = max_x - min_x
    depth = max_y - min_y
    height = max_z - min_z

    print(f"Character: W={width:.2f}m, D={depth:.2f}m, H={height:.2f}m")

    # Materials
    shirt_mat = create_material('Shirt', (0.95, 0.95, 0.95, 1.0), 0.6)  # White shirt
    jacket_mat = create_material('Jacket', (0.15, 0.15, 0.15, 1.0), 0.8)  # Dark jacket
    pants_mat = create_material('Pants', (0.10, 0.10, 0.10, 1.0), 0.8)  # Dark pants
    hat_mat = create_material('Hat', (0.10, 0.10, 0.10, 1.0), 0.8)  # Dark hat

    clothing_objects = []

    # Shirt (torso - tapered cylinder)
    shirt = create_cylinder_mesh(
        'Shirt',
        radius_top=0.22,
        radius_bottom=0.20,
        height=0.35,
        segments=16,
        material=shirt_mat,
        location=(0, 0, 1.05)
    )
    clothing_objects.append(shirt)

    # Jacket (torso - slightly larger, longer)
    jacket = create_cylinder_mesh(
        'Jacket',
        radius_top=0.25,
        radius_bottom=0.23,
        height=0.45,
        segments=16,
        material=jacket_mat,
        location=(0, 0, 1.00)
    )
    clothing_objects.append(jacket)

    # Pants (legs - two cylinders)
    # Left leg
    pants_left = create_cylinder_mesh(
        'Pants_Left',
        radius_top=0.12,
        radius_bottom=0.10,
        height=0.70,
        segments=12,
        material=pants_mat,
        location=(-0.10, 0, 0.55)
    )
    clothing_objects.append(pants_left)

    # Right leg
    pants_right = create_cylinder_mesh(
        'Pants_Right',
        radius_top=0.12,
        radius_bottom=0.10,
        height=0.70,
        segments=12,
        material=pants_mat,
        location=(0.10, 0, 0.55)
    )
    clothing_objects.append(pants_right)

    # Hat (fedora - crown + brim)
    # Crown (tall cylinder)
    hat_crown = create_cylinder_mesh(
        'Hat_Crown',
        radius_top=0.14,
        radius_bottom=0.15,
        height=0.12,
        segments=16,
        material=hat_mat,
        location=(0, 0, 1.70)
    )
    clothing_objects.append(hat_crown)

    # Brim (flat wide cylinder)
    hat_brim = create_cylinder_mesh(
        'Hat_Brim',
        radius_top=0.22,
        radius_bottom=0.22,
        height=0.02,
        segments=24,
        material=hat_mat,
        location=(0, 0, 1.64)
    )
    clothing_objects.append(hat_brim)

    print(f"Created clothing: Shirt, Jacket, Pants (2 legs), Hat (crown + brim)")

    return clothing_objects


def setup_camera_and_lighting(target_obj):
    """Setup camera and lighting for render."""
    # Camera
    bpy.ops.object.camera_add(location=(3, -3, 2))
    cam = bpy.context.active_object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.5
    direction = mathutils.Vector((0, 0, 1)) - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    bpy.context.scene.camera = cam

    # Lighting
    bpy.ops.object.light_add(type='SUN', location=(5, -5, 8))
    bpy.context.active_object.data.energy = 500
    bpy.context.active_object.data.color = (0.9, 0.9, 1.0)

    bpy.ops.object.light_add(type='SUN', location=(-5, 3, 6))
    bpy.context.active_object.data.energy = 300
    bpy.context.active_object.data.color = (1.0, 0.9, 0.8)

    # World background
    world = bpy.data.worlds.get('World')
    if world is None:
        world = bpy.data.worlds.new('World')
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.75, 0.75, 0.75, 1.0)
        bg.inputs['Strength'].default_value = 0.5


def render_and_save(output_path):
    """Render scene and save."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    scene.render.filepath = output_path

    bpy.ops.render.render(write_still=True)
    print(f"Rendered to {output_path}")


def main():
    print("=== Gangster Clothing Modeler v2 ===")
    clear_scene()

    # Import character
    print("Importing character...")
    character = import_character()
    if character is None:
        print("ERROR: Character not found!")
        return

    print(f"Character: {character.name}")

    # Model clothing
    print("Modeling gangster clothing v2...")
    clothing = model_gangster_clothing_v2(character)

    # Setup render
    setup_camera_and_lighting(character)

    # Render
    output_path = f"{OUTPUT_DIR}/gangster_character_v2.png"
    print(f"Rendering to {output_path}...")
    render_and_save(output_path)

    print("\n=== Complete ===")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()

"""
WP4.15-V Spike v2: Compatibility test for CC0 sources with graphic_civic style layer.

Key changes from v1:
- Keep original FBX materials (textures for windows, brick, clothing, skin)
- Style layer adjusts (tint/roughness) instead of replacing
- Better lighting: ambient + softer key/fill
- Ground plane for context
- Higher resolution (1024x1024)
- Neutral background for quality evaluation

Usage:
    blender --background --python spike_compatibility.py
"""

import bpy
import json
import math
import os
from pathlib import Path
import mathutils

# Paths
ROOT = Path(bpy.path.abspath("//")).parent.parent
STAGING = ROOT / "blender_artist/staging/third_party/cc0/extracted"
SPIKE_DIR = ROOT / "blender_artist/spike"
STYLE_LAYER = ROOT / "tools/art-pipeline/blender/style_layer_graphic_civic.json"

# Spike assets
BUILDING_FBX = STAGING / "quaternius/downtown-city-megakit/Exports/FBX (Unity)/Building_Medium_2_001.fbx"
CHARACTER_FBX = STAGING / "quaternius/base-characters/Universal Base Characters[Standard]/Base Characters/Unity/Superhero_Male_FullBody.fbx"


def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # Clear orphan data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.textures:
        if block.users == 0:
            bpy.data.textures.remove(block)
    for block in bpy.data.images:
        if block.users == 0:
            bpy.data.images.remove(block)


def load_style_layer():
    """Load style layer configuration."""
    with open(STYLE_LAYER, 'r') as f:
        return json.load(f)


def setup_world(style_layer):
    """Setup world with neutral background and ambient light."""
    lighting = style_layer['lighting']
    world = bpy.data.worlds.get('World')
    if world is None:
        world = bpy.data.worlds.new('World')
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (*lighting['worldColor'], 1.0)
        bg.inputs['Strength'].default_value = lighting['worldStrength']


def add_ground_plane(target_obj):
    """Add a ground plane below the target object."""
    bbox = [target_obj.matrix_world @ mathutils.Vector(c) for c in target_obj.bound_box]
    min_z = min(v.z for v in bbox)

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, min_z - 0.01))
    ground = bpy.context.active_object
    ground.name = 'GroundPlane'

    # Simple concrete-like material
    mat = bpy.data.materials.new(name='ground_concrete')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.42, 0.41, 0.39, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.9
    ground.data.materials.append(mat)
    return ground


def setup_camera(target_obj=None, margin=1.4, min_scale=3.0):
    """Create orthographic camera with graphic_civic angles, framed on target."""
    if target_obj is not None:
        bbox = [target_obj.matrix_world @ mathutils.Vector(c) for c in target_obj.bound_box]
        cx = (min(v.x for v in bbox) + max(v.x for v in bbox)) / 2
        cy = (min(v.y for v in bbox) + max(v.y for v in bbox)) / 2
        cz = (min(v.z for v in bbox) + max(v.z for v in bbox)) / 2
    else:
        cx, cy, cz = 0, 0, 0

    # Isometric offset: camera looks toward origin from (+X, -Y, +Z)
    distance = 15
    cam_x = cx + distance * math.cos(math.radians(30)) * math.cos(math.radians(45))
    cam_y = cy - distance * math.cos(math.radians(30)) * math.sin(math.radians(45))
    cam_z = cz + distance * math.sin(math.radians(30))

    bpy.ops.object.camera_add(location=(cam_x, cam_y, cam_z))
    camera = bpy.context.active_object
    camera.data.type = 'ORTHO'

    # Point camera at target center
    direction = mathutils.Vector((cx, cy, cz)) - camera.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

    # Compute ortho_scale in camera space using actual camera rotation
    if target_obj is not None:
        cam_rot_mat = camera.matrix_world.to_3x3()
        cam_bbox = [cam_rot_mat @ (v - camera.location) for v in bbox]
        extent_x = max(v.x for v in cam_bbox) - min(v.x for v in cam_bbox)
        extent_y = max(v.y for v in cam_bbox) - min(v.y for v in cam_bbox)
        footprint = max(extent_x, extent_y) * margin
        camera.data.ortho_scale = max(footprint, min_scale)
    else:
        camera.data.ortho_scale = 5.0

    bpy.context.scene.camera = camera
    return camera


def setup_lighting(style_layer):
    """Create balanced lighting: ambient + key + fill + rim."""
    lighting = style_layer['lighting']

    # Ambient via world
    setup_world(style_layer)

    # Key light - sun from upper right
    bpy.ops.object.light_add(type='SUN', location=(8, -8, 12))
    key_light = bpy.context.active_object
    key_light.data.energy = lighting['keyEnergy']
    key_light.data.color = tuple(lighting['keyColor'])

    # Fill light - softer from left
    bpy.ops.object.light_add(type='SUN', location=(-6, 4, 6))
    fill_light = bpy.context.active_object
    fill_light.data.energy = lighting['fillEnergy']
    fill_light.data.color = tuple(lighting['fillColor'])

    # Rim light - subtle backlight for edge definition
    bpy.ops.object.light_add(type='SUN', location=(0, 8, 5))
    rim_light = bpy.context.active_object
    rim_light.data.energy = lighting['rimEnergy']
    rim_light.data.color = tuple(lighting['rimColor'])

    return key_light, fill_light, rim_light


def import_fbx(filepath):
    """Import FBX file."""
    bpy.ops.import_scene.fbx(filepath=str(filepath))
    return bpy.context.selected_objects


def fix_texture_paths(source_fbx_path):
    """Fix Windows absolute texture paths to local relative paths.

    FBX files from Quaternius/Kenney often contain absolute Windows paths
    like C:/Dropbox/Work/... We need to remap these to the local Textures/
    directory. The Textures/ folder can be at different levels depending on
    the pack structure, so we search multiple candidate locations.
    """
    fbx_dir = source_fbx_path.parent  # e.g., Exports/FBX (Unity)/ or Base Characters/Unity/

    # Search for Textures/ directory in candidate locations (from closest to farthest)
    candidate_dirs = [
        fbx_dir.parent / "Textures",  # e.g., Exports/Textures/ or Base Characters/Textures/
        fbx_dir.parent.parent / "Textures",  # e.g., pack_root/Textures/
    ]

    textures_dir = None
    for candidate in candidate_dirs:
        if candidate.exists():
            textures_dir = candidate
            break

    if textures_dir is None:
        print(f"Warning: Textures directory not found for {source_fbx_path.name}")
        return

    fixed_count = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type != 'TEX_IMAGE':
                continue
            if node.image is None:
                continue

            # Get the filename from the (broken) Windows path
            old_path = node.image.filepath
            filename = os.path.basename(old_path)

            # Look for this file in the local Textures directory
            local_path = textures_dir / filename
            if local_path.exists():
                node.image.filepath = str(local_path)
                node.image.reload()
                fixed_count += 1
            else:
                # Try case-insensitive search
                for f in textures_dir.iterdir():
                    if f.name.lower() == filename.lower():
                        node.image.filepath = str(f)
                        node.image.reload()
                        fixed_count += 1
                        break

    print(f"Fixed {fixed_count} texture paths (searched in {textures_dir})")


def apply_style_layer_tint(obj, style_layer):
    """NO-OP for v2 spike: preserve original FBX materials exactly.

    The style layer adjustments will come in Fase 2+ after we verify
    the base quality of CC0 sources.
    """
    pass


def render_and_save(output_path, resolution=(1024, 1024), style_layer=None):
    """Render scene and save to file."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.film_transparent = False  # Use world background
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '16'  # Higher quality

    if style_layer:
        post = style_layer.get('rendering', {}).get('postProcessing', '')
        if post:
            scene.view_settings.view_transform = post.split(' - ')[0]
            try:
                scene.view_settings.look = post
            except TypeError:
                print(f"look no disponible: {post}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_path)

    bpy.ops.render.render(write_still=True)
    return output_path


def compute_pivot(obj):
    """Compute pivot point (ground center) in normalized coordinates."""
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    min_z = min(v.z for v in bbox)
    max_z = max(v.z for v in bbox)
    min_x = min(v.x for v in bbox)
    max_x = max(v.x for v in bbox)
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)

    pivot_x = (min_x + max_x) / 2
    pivot_y = (min_y + max_y) / 2

    width = max_x - min_x
    depth = max_y - min_y
    height = max_z - min_z

    return {
        "x": 0.5,
        "y": 0.5,
        "width_meters": width,
        "depth_meters": depth,
        "height_meters": height,
        "ground_z": min_z
    }


def spike_building():
    """Run building spike."""
    print("\n=== Building Spike ===")
    clear_scene()
    style_layer = load_style_layer()

    # Import building
    print(f"Importing {BUILDING_FBX.name}...")
    objects = import_fbx(BUILDING_FBX)
    fix_texture_paths(BUILDING_FBX)

    # Get all mesh objects (building may have multiple parts)
    meshes = [obj for obj in objects if obj.type == 'MESH']
    if not meshes:
        print("Warning: No mesh objects found!")
        return None

    print(f"Found {len(meshes)} mesh objects:")
    for m in meshes:
        print(f"  - {m.name}: {len(m.data.vertices)} verts, {len(m.data.materials)} materials")

    # Apply style layer tint to all meshes (preserve original textures)
    for mesh in meshes:
        apply_style_layer_tint(mesh, style_layer)

    # Use the largest mesh as primary for camera framing
    primary = max(meshes, key=lambda m: len(m.data.vertices))
    print(f"Primary mesh for framing: {primary.name}")

    # Add ground plane
    add_ground_plane(primary)

    # Setup camera and lighting
    setup_camera(primary)
    setup_lighting(style_layer)

    # Render
    output_path = SPIKE_DIR / "building_spike.png"
    print(f"Rendering to {output_path}...")
    render_and_save(output_path, resolution=(1024, 1024), style_layer=style_layer)

    # Compute metadata
    pivot = compute_pivot(primary)
    metadata = {
        "asset": "bld_res_rowhouse_spike",
        "source": str(BUILDING_FBX.relative_to(ROOT)),
        "material": "original_fbx_with_style_tint",
        "mesh_count": len(meshes),
        "pivot": pivot,
        "render": str(output_path.relative_to(ROOT))
    }

    metadata_path = SPIKE_DIR / "building_spike.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Metadata saved to {metadata_path}")
    return metadata


def spike_character():
    """Run character spike."""
    print("\n=== Character Spike ===")
    clear_scene()
    style_layer = load_style_layer()

    # Import character
    print(f"Importing {CHARACTER_FBX.name}...")
    objects = import_fbx(CHARACTER_FBX)
    fix_texture_paths(CHARACTER_FBX)

    # Find all mesh objects and pick the largest by vertex count
    meshes = [obj for obj in objects if obj.type == 'MESH']

    if not meshes:
        print("Warning: No mesh objects found!")
        return None

    character = max(meshes, key=lambda m: len(m.data.vertices))

    print(f"Using character: {character.name} ({character.type}, {len(character.data.vertices)} verts)")
    if len(meshes) > 1:
        others = [f"{m.name}({len(m.data.vertices)})" for m in meshes if m is not character]
        print(f"  (skipped {len(meshes)-1} smaller meshes: {', '.join(others)})")

    # Apply style layer tint (preserve original FBX textures for skin/clothing)
    apply_style_layer_tint(character, style_layer)

    # Add ground plane
    add_ground_plane(character)

    # Setup camera and lighting
    setup_camera(character, margin=1.12, min_scale=2.0)
    setup_lighting(style_layer)

    # Render
    output_path = SPIKE_DIR / "character_spike.png"
    print(f"Rendering to {output_path}...")
    render_and_save(output_path, resolution=(1024, 1024), style_layer=style_layer)

    # Compute metadata
    pivot = compute_pivot(character)
    metadata = {
        "asset": "chr_worker_spike",
        "source": str(CHARACTER_FBX.relative_to(ROOT)),
        "material": "original_fbx_with_style_tint",
        "pivot": pivot,
        "render": str(output_path.relative_to(ROOT))
    }

    metadata_path = SPIKE_DIR / "character_spike.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Metadata saved to {metadata_path}")
    return metadata


def main():
    print("WP4.15-V Compatibility Spike v2")
    print(f"Root: {ROOT}")
    print(f"Staging: {STAGING}")

    # Ensure spike directory exists
    SPIKE_DIR.mkdir(parents=True, exist_ok=True)

    # Run spikes
    building_meta = spike_building()
    character_meta = spike_character()

    print("\n=== Spike Complete ===")
    print(f"Building: {SPIKE_DIR / 'building_spike.png'}")
    print(f"Character: {SPIKE_DIR / 'character_spike.png'}")
    print("\nReview the renders and metadata to decide STOP V1:")
    print("  - GO: Both render correctly with materials")
    print("  - CONDITIONAL GO: Building works, character needs more work")
    print("  - NO-GO: Sources don't survive the pipeline")


if __name__ == "__main__":
    main()

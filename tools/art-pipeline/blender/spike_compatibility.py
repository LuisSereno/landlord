"""
WP4.15-V Spike: Compatibility test for CC0 sources with graphic_civic style layer.

This script imports one building and one character from Quaternius packs,
applies Poly Haven PBR materials, and renders them with the graphic_civic palette.

Usage:
    blender --background --python spike_compatibility.py

Requirements:
    - Blender 5.2.2 LTS
    - Extracted CC0 packs in blender_artist/staging/third_party/cc0/extracted/
    - Poly Haven material .blend files in blender_artist/staging/third_party/cc0/extracted/polyhaven/

Output:
    - blender_artist/spike/building_spike.png
    - blender_artist/spike/character_spike.png
    - blender_artist/spike/building_spike.json (metadata)
    - blender_artist/spike/character_spike.json (metadata)
"""

import bpy
import json
import math
import os
from pathlib import Path

# Paths
ROOT = Path(bpy.path.abspath("//")).parent.parent  # Adjust if needed
STAGING = ROOT / "blender_artist/staging/third_party/cc0/extracted"
SPIKE_DIR = ROOT / "blender_artist/spike"
STYLE_LAYER = ROOT / "tools/art-pipeline/blender/style_layer_graphic_civic.json"

# Spike assets
BUILDING_FBX = STAGING / "quaternius/downtown-city-megakit/Exports/FBX (Unity)/Building_Medium_2_001.fbx"
CHARACTER_FBX = STAGING / "quaternius/base-characters/Universal Base Characters[Standard]/Base Characters/Unity/Superhero_Male_FullBody.fbx"
ANIMATION_GLB = STAGING / "quaternius/animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"

# Poly Haven materials
POLYHAVEN_DIR = STAGING / "polyhaven"

def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def load_style_layer():
    """Load style layer configuration."""
    with open(STYLE_LAYER, 'r') as f:
        return json.load(f)

def setup_camera():
    """Create orthographic camera with graphic_civic angles."""
    bpy.ops.object.camera_add(location=(10, -10, 10))
    camera = bpy.context.active_object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 5.0  # Adjust based on asset size
    
    # Rotate to isometric: 45° azimuth, 30° elevation
    camera.rotation_euler = (math.radians(30), 0, math.radians(45))
    
    bpy.context.scene.camera = camera
    return camera

def setup_lighting(style_layer):
    """Create key and fill lights."""
    lighting = style_layer['lighting']
    
    # Key light
    bpy.ops.object.light_add(type='SUN', location=(5, -5, 8))
    key_light = bpy.context.active_object
    key_light.data.energy = lighting['keyEnergy']
    key_light.data.color = tuple(lighting['keyColor'])
    key_light.rotation_euler = (
        math.atan2(lighting['keyDirection'][2], lighting['keyDirection'][1]),
        0,
        math.atan2(lighting['keyDirection'][1], lighting['keyDirection'][0])
    )
    
    # Fill light
    bpy.ops.object.light_add(type='SUN', location=(-5, 3, 4))
    fill_light = bpy.context.active_object
    fill_light.data.energy = lighting['fillEnergy']
    fill_light.data.color = tuple(lighting['fillColor'])
    
    return key_light, fill_light

def import_fbx(filepath):
    """Import FBX file."""
    bpy.ops.import_scene.fbx(filepath=str(filepath))
    return bpy.context.selected_objects

def apply_material_recipe(obj, recipe_name, style_layer):
    """Apply a material recipe from the style layer."""
    recipes = style_layer['materialRecipes']
    if recipe_name not in recipes:
        print(f"Warning: Recipe '{recipe_name}' not found")
        return
    
    recipe = recipes[recipe_name]
    
    # Create material
    mat = bpy.data.materials.new(name=recipe_name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    
    if bsdf:
        # Apply tint
        if 'tint' in recipe:
            bsdf.inputs['Base Color'].default_value = tuple(recipe['tint']) + (1.0,)
        
        # Apply roughness
        if 'roughness' in recipe:
            bsdf.inputs['Roughness'].default_value = recipe['roughness']
        elif 'roughnessRange' in recipe:
            bsdf.inputs['Roughness'].default_value = sum(recipe['roughnessRange']) / 2
        
        # Apply metallic
        if 'metallic' in recipe:
            bsdf.inputs['Metallic'].default_value = recipe['metallic']
    
    # Assign material to object
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

def render_and_save(output_path, resolution=(512, 512)):
    """Render scene and save to file."""
    scene = bpy.context.scene
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output_path)
    
    bpy.ops.render.render(write_still=True)
    return output_path

def compute_pivot(obj):
    """Compute pivot point (ground center) in normalized coordinates."""
    # Get bounding box
    bbox = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    min_z = min(v.z for v in bbox)
    max_z = max(v.z for v in bbox)
    min_x = min(v.x for v in bbox)
    max_x = max(v.x for v in bbox)
    min_y = min(v.y for v in bbox)
    max_y = max(v.y for v in bbox)
    
    # Pivot is ground center
    pivot_x = (min_x + max_x) / 2
    pivot_y = (min_y + max_y) / 2
    
    # Normalize to 0..1 relative to footprint
    width = max_x - min_x
    height = max_y - min_y
    
    return {
        "x": 0.5,  # Center of footprint
        "y": 0.5,  # Center of footprint
        "width_meters": width,
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
    building = objects[0]  # Assume first object is the main building
    
    # Apply residential brick material
    apply_material_recipe(building, 'residential_brick', style_layer)
    
    # Setup camera and lighting
    setup_camera()
    setup_lighting(style_layer)
    
    # Render
    output_path = SPIKE_DIR / "building_spike.png"
    print(f"Rendering to {output_path}...")
    render_and_save(output_path)
    
    # Compute metadata
    pivot = compute_pivot(building)
    metadata = {
        "asset": "bld_res_rowhouse_spike",
        "source": str(BUILDING_FBX.relative_to(ROOT)),
        "material": "residential_brick",
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
    character = objects[0]  # Assume first object is the character
    
    # Apply basic material (skin/clothing would need more detailed mapping)
    mat = bpy.data.materials.new(name="character_base")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.7, 0.6, 0.5, 1.0)  # Skin tone
        bsdf.inputs['Roughness'].default_value = 0.7
    
    if character.data.materials:
        character.data.materials[0] = mat
    else:
        character.data.materials.append(mat)
    
    # Setup camera and lighting
    setup_camera()
    setup_lighting(style_layer)
    
    # Render
    output_path = SPIKE_DIR / "character_spike.png"
    print(f"Rendering to {output_path}...")
    render_and_save(output_path, resolution=(256, 256))
    
    # Compute metadata
    pivot = compute_pivot(character)
    metadata = {
        "asset": "chr_worker_spike",
        "source": str(CHARACTER_FBX.relative_to(ROOT)),
        "material": "character_base",
        "pivot": pivot,
        "render": str(output_path.relative_to(ROOT))
    }
    
    metadata_path = SPIKE_DIR / "character_spike.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Metadata saved to {metadata_path}")
    return metadata

def main():
    print("WP4.15-V Compatibility Spike")
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

"""WP4.15-V Spike: compatibilidad de Microsoft Rocketbox (licencia MIT).

Los Universal Base Characters de Quaternius llegan sin ropa, así que este spike
valida la alternativa: avatares ya vestidos, rigueados y con texturas propias.

Reutiliza la cámara y la iluminación del spike de compatibilidad CC0 para que la
comparación sea directa.

    blender --background --python tools/art-pipeline/blender/spike_rocketbox.py
"""

import json
import sys
from pathlib import Path

import bpy
import mathutils

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from spike_compatibility import (  # noqa: E402
    add_ground_plane,
    clear_scene,
    compute_pivot,
    fix_texture_paths,
    import_fbx,
    render_and_save,
    setup_camera,
    setup_lighting,
)

ROCKETBOX = ROOT / "blender_artist/staging/third_party/rocketbox"
SPIKE_DIR = ROOT / "blender_artist/spike"
STYLE_LAYER = HERE / "style_layer_graphic_civic.json"

# avatar -> rol visual que cubriría en el slice
AVATARS = {
    "chr_worker": "Male_Adult_05",
    "chr_enforcer": "Male_Adult_10",
    "chr_civilian": "Male_Adult_09",
    "chr_professional": "Female_Adult_09",
}

WALK_FBX = ROCKETBOX / "animations/walk/m_walk_neutral.max.fbx"


def avatar_fbx(name):
    return ROCKETBOX / "avatars" / name / "Export" / f"{name}.fbx"


def load_style_layer():
    with open(STYLE_LAYER) as f:
        return json.load(f)


def find_body_mesh(objects):
    """El mesh del cuerpo es el que va huesos y texturas de piel/ropa."""
    meshes = [o for o in objects if o.type == "MESH"]
    if not meshes:
        return None, []
    return max(meshes, key=lambda m: len(m.data.vertices)), meshes


def world_center(obj):
    """Centro de la bounding box ya con la pose deformada por el armature."""
    deps = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(deps)
    corners = [evaluated.matrix_world @ mathutils.Vector(c) for c in evaluated.bound_box]
    total = mathutils.Vector((0.0, 0.0, 0.0))
    for corner in corners:
        total += corner
    return total / len(corners)


def render_avatar(role, name, style_layer):
    print(f"\n=== {role} <- {name} ===")
    clear_scene()
    fbx = avatar_fbx(name)
    objects = import_fbx(fbx)
    fix_texture_paths(fbx)

    body, meshes = find_body_mesh(objects)
    if body is None:
        print(f"  ERROR: sin mesh en {fbx.name}")
        return None

    armatures = [o for o in objects if o.type == "ARMATURE"]
    print(f"  mesh={body.name} verts={len(body.data.vertices)} "
          f"slots={len(body.data.materials)} armature={len(armatures)}")
    for slot in body.material_slots:
        img = None
        if slot.material and slot.material.use_nodes:
            for node in slot.material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    img = Path(bpy.path.abspath(node.image.filepath)).name
                    break
        print(f"    slot {slot.material.name if slot.material else '-':16s} <- {img}")

    add_ground_plane(body)
    setup_camera(body, margin=1.12, min_scale=2.0)
    setup_lighting(style_layer)

    out = SPIKE_DIR / f"rocketbox_{role}.png"
    render_and_save(out, resolution=(1024, 1024), style_layer=style_layer)

    meta = {
        "asset": role,
        "source": str(fbx.relative_to(ROOT)),
        "license": "MIT (Microsoft Rocketbox)",
        "mesh": body.name,
        "vertices": len(body.data.vertices),
        "materialSlots": [s.material.name for s in body.material_slots if s.material],
        "pivot": compute_pivot(body),
        "render": str(out.relative_to(ROOT)),
    }
    (SPIKE_DIR / f"rocketbox_{role}.json").write_text(json.dumps(meta, indent=2))
    return meta


def spike_walk(style_layer, name="Male_Adult_05"):
    """Comprueba si una animación Rocketbox se aplica al rig sin retargeting."""
    print(f"\n=== walk cycle <- {name} ===")
    clear_scene()
    fbx = avatar_fbx(name)
    objects = import_fbx(fbx)
    fix_texture_paths(fbx)
    body, _ = find_body_mesh(objects)
    armature = next((o for o in objects if o.type == "ARMATURE"), None)
    if body is None or armature is None:
        print("  ERROR: falta mesh o armadura")
        return None

    before = {o.name for o in bpy.data.objects}
    import_fbx(WALK_FBX)
    clip = next((o for o in bpy.data.objects if o.name not in before and o.type == "ARMATURE"), None)
    if clip is None or not clip.animation_data or not clip.animation_data.action:
        print("  ERROR: el FBX de animación no trae action")
        return None

    action = clip.animation_data.action
    anim_bones = {b.name for b in clip.data.bones}
    rig_bones = {b.name for b in armature.data.bones}
    common = anim_bones & rig_bones
    print(f"  action={action.name} bones clip={len(anim_bones)} rig={len(rig_bones)} "
          f"comunes={len(common)}")

    armature.animation_data_create()
    armature.animation_data.action = action
    bpy.data.objects.remove(clip, do_unlink=True)

    add_ground_plane(body)
    camera = setup_camera(body, margin=1.12, min_scale=2.0)
    setup_lighting(style_layer)

    scene = bpy.context.scene
    frames = list(action.frame_range)
    scene.frame_start, scene.frame_end = int(frames[0]), int(frames[1])
    out = SPIKE_DIR / "rocketbox_walk"
    out.mkdir(parents=True, exist_ok=True)

    # Los clips "xy" traen movimiento de raíz: la cámara sigue al personaje.
    cam_start = camera.location.copy()
    origin = world_center(body)
    drift = 0.0
    steps = 4
    for i in range(steps):
        scene.frame_set(scene.frame_start + int(i * (scene.frame_end - scene.frame_start) / steps))
        offset = world_center(body) - origin
        drift = max(drift, offset.length)
        camera.location = cam_start + offset
        render_and_save(out / f"frame_{i}.png", resolution=(512, 512), style_layer=style_layer)

    meta = {
        "asset": "chr_worker_walk",
        "source": str(WALK_FBX.relative_to(ROOT)),
        "license": "MIT (Microsoft Rocketbox)",
        "actionFrames": [scene.frame_start, scene.frame_end],
        "sharedBones": len(common),
        "rootMotionMeters": round(drift, 2),
        "render": str(out / "frame_0.png").replace(str(ROOT) + "/", ""),
    }
    (SPIKE_DIR / "rocketbox_walk.json").write_text(json.dumps(meta, indent=2))
    return meta


def main():
    print("WP4.15-V Rocketbox spike")
    print(f"root: {ROOT}")
    print(f"staging: {ROCKETBOX}")
    if not ROCKETBOX.exists():
        print(f"ERROR: no existe {ROCKETBOX}")
        return

    SPIKE_DIR.mkdir(parents=True, exist_ok=True)
    style_layer = load_style_layer()

    done = []
    for role, name in AVATARS.items():
        if render_avatar(role, name, style_layer):
            done.append(role)
    if WALK_FBX.exists():
        spike_walk(style_layer)
    else:
        print(f"\nsin FBX de animación en {WALK_FBX}")

    print("\n=== spike terminado ===")
    print(f"renders: {', '.join(done)}")


if __name__ == "__main__":
    main()

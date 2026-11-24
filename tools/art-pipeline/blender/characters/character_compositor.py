#!/usr/bin/env python3
import importlib.util
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True

MATERIAL_COLORS = {
    "ochre": ((0.48, 0.27, 0.08, 1), 0.0, 0.82),
    "leather": ((0.18, 0.10, 0.05, 1), 0.0, 0.9),
    "paper": ((0.74, 0.70, 0.56, 1), 0.0, 0.92),
    "metal": ((0.30, 0.33, 0.35, 1), 0.65, 0.5),
    "olive": ((0.25, 0.28, 0.18, 1), 0.0, 0.88),
    "slate": ((0.20, 0.29, 0.34, 1), 0.0, 0.88),
    "charcoal": ((0.07, 0.075, 0.08, 1), 0.0, 0.9),
    "charcoal_brown": ((0.10, 0.075, 0.055, 1), 0.0, 0.9),
}


def argument(name):
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv
    index = args.index(name)
    return args[index + 1]


def make_material(name, color, metallic=0.0, roughness=0.88):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Specular IOR Level"].default_value = 0.25
    return material


def finish_object(obj, name, material, smooth=False, bevel=0.0):
    obj.name = name
    obj.data.materials.append(material)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if bevel > 0:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


def make_box(name, location, scale, material, rotation=(0.0, 0.0, 0.0), bevel=0.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, material, bevel=bevel)


def make_cylinder(name, location, radius, depth, material, scale=(1.0, 1.0, 1.0), bevel=0.004):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16,
        radius=radius,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, material, smooth=True, bevel=bevel)


def make_sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16,
        ring_count=8,
        radius=1,
        location=location,
    )
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, material, smooth=True)


def make_torus(name, location, major_radius, minor_radius, material, scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=16,
        minor_segments=6,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=location,
    )
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, name, material, smooth=True)


def bone_anchor(armature, bone_name):
    bpy.context.view_layer.update()
    pose_matrix = armature.matrix_world @ armature.pose.bones[bone_name].matrix
    return pose_matrix.translation


def attach_to_bone(obj, armature, bone_name, job_id, accessory_type):
    bpy.context.view_layer.update()
    constraint = obj.constraints.new("CHILD_OF")
    constraint.name = f"WP-CHAR-01B {accessory_type}"
    constraint.target = armature
    constraint.subtarget = bone_name
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.constraints.active = constraint
    bpy.ops.constraint.childof_set_inverse(constraint=constraint.name, owner="OBJECT")
    bpy.context.view_layer.update()
    obj["wp_character_job"] = job_id
    obj["wp_character_accessory"] = accessory_type
    obj["wp_character_bone"] = bone_name


def apply_body_tint(scene, job, policy):
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No avatar mesh found after source scene creation")
    mesh = max(meshes, key=lambda obj: len(obj.data.vertices))
    slot_index = next(
        (
            index
            for index, material in enumerate(mesh.data.materials)
            if material and "body" in material.name.lower()
        ),
        None,
    )
    if slot_index is None:
        raise RuntimeError("Avatar body material slot not found")
    slot = mesh.material_slots[slot_index]
    original = mesh.data.materials[slot_index]
    slot.link = "OBJECT"
    variant = original.copy()
    variant.name = f"{original.name}_{job['id']}_tint"
    variant.diffuse_color = (*job["materialVariant"]["bodyTint"], 1)
    principled = next(
        (node for node in variant.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )
    if principled is None:
        raise RuntimeError("Body material has no Principled BSDF")
    base_color = principled.inputs["Base Color"]
    source_link = next(
        (link for link in variant.node_tree.links if link.to_socket == base_color),
        None,
    )
    if source_link is not None:
        from_socket = source_link.from_socket
        variant.node_tree.links.remove(source_link)
        multiply = variant.node_tree.nodes.new("ShaderNodeMixRGB")
        multiply.name = "WP-CHAR-01B body tint"
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        multiply.inputs[2].default_value = (*job["materialVariant"]["bodyTint"], 1)
        variant.node_tree.links.new(from_socket, multiply.inputs[1])
        variant.node_tree.links.new(multiply.outputs[0], base_color)
    else:
        base_color.default_value = (*job["materialVariant"]["bodyTint"], 1)
    principled.inputs["Metallic"].default_value = policy["bodyMetallic"]
    principled.inputs["Roughness"].default_value = policy["bodyRoughness"]
    principled.inputs["Specular IOR Level"].default_value = policy["bodySpecularLevel"]
    slot.material = variant
    return {
        "mesh": mesh.name,
        "slot": slot_index,
        "originalMaterial": original.name,
        "variantMaterial": variant.name,
        "tint": job["materialVariant"]["bodyTint"],
    }


def add_hard_hat(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    material = materials["ochre"]
    objects = [
        make_sphere("wp_helmet_dome", anchor + Vector((0, 0, 0.265)), (0.115, 0.105, 0.065), material),
        make_cylinder("wp_helmet_brim", anchor + Vector((0, 0, 0.215)), 0.135, 0.015, material),
        make_box("wp_helmet_ridge", anchor + Vector((0, 0, 0.325)), (0.015, 0.09, 0.01), material, bevel=0.004),
    ]
    for obj in objects:
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend(objects)


def add_cap(armature, spec, materials, job_id, created, flat=False):
    anchor = bone_anchor(armature, spec["bone"])
    material = materials[spec["material"]]
    crown = make_sphere(
        "wp_cap_crown",
        anchor + Vector((0, 0, 0.04 if flat else 0.035)),
        (0.105, 0.10, 0.035 if flat else 0.045),
        material,
    )
    brim = make_box(
        "wp_cap_brim",
        anchor + Vector((0, -0.09, 0.025)),
        (0.10, 0.065, 0.012),
        material,
        bevel=0.005,
    )
    for obj in (crown, brim):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((crown, brim))


def add_clipboard(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    board = make_box(
        "wp_clipboard_board",
        anchor + Vector((0, -0.035, 0.075)),
        (0.10, 0.014, 0.14),
        materials["leather"],
    )
    paper = make_box(
        "wp_clipboard_paper",
        anchor + Vector((0, -0.051, 0.078)),
        (0.082, 0.005, 0.115),
        materials["paper"],
        bevel=0.002,
    )
    clip = make_box(
        "wp_clipboard_clip",
        anchor + Vector((0, -0.052, 0.185)),
        (0.025, 0.007, 0.018),
        materials["metal"],
        bevel=0.002,
    )
    for obj in (board, paper, clip):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((board, paper, clip))


def add_tool_belt(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    belt = make_torus(
        "wp_tool_belt",
        anchor + Vector((0, 0, 0.025)),
        0.145,
        0.018,
        materials["leather"],
        scale=(1.15, 0.75, 0.55),
    )
    pouches = [
        make_box(
            f"wp_tool_pouch_{side}",
            anchor + Vector((0.11 if side == "l" else -0.11, -0.095, 0.0)),
            (0.04, 0.025, 0.06),
            materials["leather"],
            bevel=0.006,
        )
        for side in ("l", "r")
    ]
    for obj in (belt, *pouches):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((belt, *pouches))


def add_tool_bag(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    bag = make_box(
        "wp_tool_bag",
        anchor + Vector((0, -0.01, -0.055)),
        (0.09, 0.055, 0.11),
        materials[spec["material"]],
        bevel=0.012,
    )
    handle = make_torus(
        "wp_tool_bag_handle",
        anchor + Vector((0, -0.01, 0.06)),
        0.035,
        0.008,
        materials["leather"],
        scale=(1, 0.55, 1),
    )
    for obj in (bag, handle):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((bag, handle))


def add_wrench(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    handle = make_cylinder(
        "wp_wrench_handle",
        anchor + Vector((0, -0.025, 0.055)),
        0.009,
        0.15,
        materials["metal"],
        bevel=0.002,
    )
    jaw = make_torus(
        "wp_wrench_jaw",
        anchor + Vector((0, -0.025, 0.135)),
        0.022,
        0.006,
        materials["metal"],
        scale=(1, 1, 0.7),
    )
    for obj in (handle, jaw):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((handle, jaw))


def add_reinforced_collar(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    collar = make_torus(
        "wp_reinforced_collar",
        anchor + Vector((0, 0, 0.005)),
        0.07,
        0.025,
        materials[spec["material"]],
        scale=(1.15, 0.9, 0.65),
    )
    attach_to_bone(collar, armature, spec["bone"], job_id, spec["type"])
    created.append(collar)


def add_long_coat_panels(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    material = materials[spec["material"]]
    panels = [
        make_box(
            "wp_coat_back",
            anchor + Vector((0, 0.105, -0.18)),
            (0.18, 0.03, 0.28),
            material,
            bevel=0.012,
        ),
        make_box(
            "wp_coat_front_l",
            anchor + Vector((0.085, -0.105, -0.18)),
            (0.08, 0.025, 0.28),
            material,
            rotation=(0, 0, -0.04),
            bevel=0.012,
        ),
        make_box(
            "wp_coat_front_r",
            anchor + Vector((-0.085, -0.105, -0.18)),
            (0.08, 0.025, 0.28),
            material,
            rotation=(0, 0, 0.04),
            bevel=0.012,
        ),
    ]
    belt = make_torus(
        "wp_coat_belt",
        anchor + Vector((0, 0, -0.34)),
        0.145,
        0.018,
        materials["leather"],
        scale=(1.15, 0.75, 0.55),
    )
    for obj in (*panels, belt):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((*panels, belt))


def add_brim_hat(armature, spec, materials, job_id, created):
    anchor = bone_anchor(armature, spec["bone"])
    material = materials[spec["material"]]
    brim = make_cylinder("wp_hat_brim", anchor + Vector((0, 0, 0.035)), 0.145, 0.015, material)
    crown = make_cylinder("wp_hat_crown", anchor + Vector((0, 0, 0.085)), 0.09, 0.09, material, bevel=0.008)
    band = make_torus("wp_hat_band", anchor + Vector((0, 0, 0.055)), 0.091, 0.01, materials["leather"])
    for obj in (brim, crown, band):
        attach_to_bone(obj, armature, spec["bone"], job_id, spec["type"])
    created.extend((brim, crown, band))


def validate_anchor_drift(scene, armature, objects):
    current_frame = scene.frame_current
    alternate_frame = 1 if current_frame == 0 else 0

    def relative_matrices():
        bpy.context.view_layer.update()
        result = {}
        for obj in objects:
            bone_name = obj["wp_character_bone"]
            pose_matrix = armature.matrix_world @ armature.pose.bones[bone_name].matrix
            result[obj.name] = pose_matrix.inverted() @ obj.matrix_world
        return result

    try:
        first = relative_matrices()
        scene.frame_set(alternate_frame)
        second = relative_matrices()
    finally:
        scene.frame_set(current_frame)
        bpy.context.view_layer.update()
    drift = max(
        (
            abs(first[name][row][column] - second[name][row][column])
            for name in first
            for row in range(4)
            for column in range(4)
        ),
        default=0.0,
    )
    if drift > 1e-4:
        raise RuntimeError(f"Accessory anchor drift exceeds tolerance: {drift}")
    return drift


def compose_scene(scene, job, manifest):
    armature = next((obj for obj in scene.objects if obj.type == "ARMATURE"), None)
    if armature is None or armature.name != "Bip01":
        raise RuntimeError("Expected Bip01 armature after source scene creation")
    materials = {
        key: make_material(f"wp_char_{key}", *values)
        for key, values in MATERIAL_COLORS.items()
    }
    body_material = apply_body_tint(scene, job, manifest["materialPolicy"])
    created = []
    for spec in job["accessories"]:
        if spec["type"] == "hard_hat":
            add_hard_hat(armature, spec, materials, job["id"], created)
        elif spec["type"] == "clipboard":
            add_clipboard(armature, spec, materials, job["id"], created)
        elif spec["type"] == "tool_belt":
            add_tool_belt(armature, spec, materials, job["id"], created)
        elif spec["type"] == "work_cap":
            add_cap(armature, spec, materials, job["id"], created)
        elif spec["type"] == "flat_cap":
            add_cap(armature, spec, materials, job["id"], created, flat=True)
        elif spec["type"] == "tool_bag":
            add_tool_bag(armature, spec, materials, job["id"], created)
        elif spec["type"] == "wrench":
            add_wrench(armature, spec, materials, job["id"], created)
        elif spec["type"] == "reinforced_collar":
            add_reinforced_collar(armature, spec, materials, job["id"], created)
        elif spec["type"] == "long_coat_panels":
            add_long_coat_panels(armature, spec, materials, job["id"], created)
        elif spec["type"] == "brim_hat":
            add_brim_hat(armature, spec, materials, job["id"], created)
        else:
            raise RuntimeError(f"Unsupported accessory: {spec['type']}")
    anchor_drift = validate_anchor_drift(scene, armature, created)
    bpy.context.view_layer.update()
    meshes = [obj for obj in scene.objects if obj.type == "MESH"]
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in meshes
        for corner in obj.bound_box
    ]
    minimum = [min(point[axis] for point in corners) for axis in range(3)]
    maximum = [max(point[axis] for point in corners) for axis in range(3)]
    scene["wp_character_job"] = job["id"]
    scene["wp_character_factory_id"] = job["factoryCharacterId"]
    return {
        "bodyMaterial": body_material,
        "accessories": [
            {
                "type": spec["type"],
                "bone": spec["bone"],
                "material": spec["material"],
                "objects": [
                    obj.name
                    for obj in created
                    if obj.get("wp_character_accessory") == spec["type"]
                ],
            }
            for spec in job["accessories"]
        ],
        "accessoryObjectCount": len(created),
        "maxAnchorDrift": anchor_drift,
        "composedSizeMeters": [round(maximum[axis] - minimum[axis], 4) for axis in range(3)],
    }


def main():
    runtime_path = Path(argument("--runtime-asset")).resolve()
    config_path = Path(argument("--character-config")).resolve()
    job_id = argument("--character-job-id")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    job = next((entry for entry in config["jobs"] if entry["id"] == job_id), None)
    if job is None:
        raise RuntimeError(f"Unknown character job: {job_id}")
    sys.path.insert(0, str(runtime_path.parent))
    spec = importlib.util.spec_from_file_location("landlord_runtime_asset", runtime_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import runtime asset module: {runtime_path}")
    runtime_asset = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runtime_asset
    spec.loader.exec_module(runtime_asset)
    original_create_external_scene = runtime_asset.create_external_scene
    composition = {}

    def create_external_scene_with_character(*args, **kwargs):
        result = original_create_external_scene(*args, **kwargs)
        composition.update(compose_scene(result[0], job, config))
        return result

    runtime_asset.create_external_scene = create_external_scene_with_character
    runtime_asset.main()
    if not composition:
        raise RuntimeError("Character compositor was not called by the external source route")
    metadata_path = Path(argument("--metadata")).resolve()
    sidecar = {
        "schemaVersion": 1,
        "jobId": job["id"],
        "factoryCharacterId": job["factoryCharacterId"],
        "source": job["source"],
        "materialVariant": job["materialVariant"],
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode()
        if isinstance(bpy.app.build_hash, bytes)
        else bpy.app.build_hash,
        "validationStatus": "pending_independent_check",
        **composition,
    }
    metadata_path.with_suffix(".composition.json").write_text(
        json.dumps(sidecar, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"WP_CHAR_COMPOSITOR_OK {job['id']}")


if __name__ == "__main__":
    main()

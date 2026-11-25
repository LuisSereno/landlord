#!/usr/bin/env python3
"""Render the two authorized WP-CHAR-04 smoke frames for one Kenney candidate."""

import argparse
import hashlib
import importlib.util
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"
WP02B_TOOLS = TOOL_DIR.parent / "wp_char_02b"
EXPECTED_BONES = {"root", "leg-left", "leg-right", "torso", "arm-left", "arm-right", "head"}
BODY_GROUPS = ("torso", "arm-left", "arm-right", "leg-left", "leg-right")
BODY_MATERIAL_KEYS = ("torso", "arms", "legs", "boots", "reflective", "gloves", "shirt")


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color_linear(hex_color):
    value = hex_color.lstrip("#")
    channels = [int(value[index : index + 2], 16) / 255.0 for index in (0, 2, 4)]
    return tuple(srgb_to_linear(channel) for channel in channels)


def vector_list(vector):
    return [round(float(value), 6) for value in vector]


def make_material(compositor, role, name, palette_key, palette):
    if palette_key not in palette:
        raise RuntimeError(f"Missing palette key {palette_key} for {role}/{name}")
    return compositor.make_material(
        f"wp04_{role}_{name}",
        (*color_linear(palette[palette_key]), 1.0),
        metallic=0.0,
        roughness=0.9,
    )


def dominant_group(polygon, obj, groups=BODY_GROUPS):
    weights = {name: 0.0 for name in groups}
    for vertex_index in polygon.vertices:
        for item in obj.data.vertices[vertex_index].groups:
            name = obj.vertex_groups[item.group].name
            if name in weights:
                weights[name] += item.weight
    if not weights or max(weights.values()) <= 0:
        return None
    return max(weights, key=weights.get)


def dominant_vertex_group(vertex, obj, groups=BODY_GROUPS):
    weights = {name: 0.0 for name in groups}
    for item in vertex.groups:
        name = obj.vertex_groups[item.group].name
        if name in weights:
            weights[name] += item.weight
    if not weights or max(weights.values()) <= 0:
        return None
    return max(weights, key=weights.get)


def components_by_position(mesh):
    parent = list(range(len(mesh.vertices)))
    owners = {}

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(first, second):
        first_root, second_root = find(first), find(second)
        if first_root != second_root:
            parent[second_root] = first_root

    for index, vertex in enumerate(mesh.vertices):
        key = tuple(round(float(axis), 6) for axis in vertex.co)
        if key in owners:
            union(index, owners[key])
        else:
            owners[key] = index
    for polygon in mesh.polygons:
        first = polygon.vertices[0]
        for vertex in polygon.vertices[1:]:
            union(first, vertex)
    grouped = defaultdict(list)
    for polygon in mesh.polygons:
        grouped[find(polygon.vertices[0])].append(polygon.index)
    return sorted(grouped.values(), key=lambda indices: (-len(indices), indices[0]))


def component_evidence(obj, component_indices, components):
    mesh = obj.data
    evidence = []
    for component_index in component_indices:
        if component_index < 0 or component_index >= len(components):
            raise RuntimeError(f"Component {component_index} out of range for {obj.name}")
        polygon_indices = components[component_index]
        vertex_indices = sorted(
            {vertex for polygon_index in polygon_indices for vertex in mesh.polygons[polygon_index].vertices}
        )
        coordinates = [mesh.vertices[index].co for index in vertex_indices]
        groups = Counter(dominant_group(mesh.polygons[index], obj) for index in polygon_indices)
        evidence.append(
            {
                "component": component_index,
                "polygons": len(polygon_indices),
                "vertices": len(vertex_indices),
                "dominantGroups": dict(sorted(groups.items(), key=lambda item: str(item[0]))),
                "localBounds": {
                    "min": [round(min(value[axis] for value in coordinates), 6) for axis in range(3)],
                    "max": [round(max(value[axis] for value in coordinates), 6) for axis in range(3)],
                },
            }
        )
    return evidence


def delete_faces(mesh, polygon_indices):
    selected = set(polygon_indices)
    if not selected:
        return 0
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[index] for index in sorted(selected)], context="FACES")
    bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return len(selected)


def delete_component_faces(mesh, component_indices, components):
    return delete_faces(
        mesh,
        {polygon_index for index in component_indices for polygon_index in components[index]},
    )


def apply_head_corrections(head, candidate, compositor, palette):
    head.data = head.data.copy()
    components = components_by_position(head.data)
    selected = sorted(set(candidate.get("headComponents", [])))
    remove = sorted(set(candidate.get("headRemoveComponents", [])))
    mouth_component = candidate.get("mouthComponent")
    mouth_center = None
    if mouth_component is not None:
        if mouth_component < 0 or mouth_component >= len(components):
            raise RuntimeError("Mouth component out of range")
        mouth_polygons = components[mouth_component]
        mouth_vertices = sorted(
            {vertex for polygon_index in mouth_polygons for vertex in head.data.polygons[polygon_index].vertices}
        )
        mouth_center = sum((head.data.vertices[index].co for index in mouth_vertices), Vector()) / len(mouth_vertices)
        head["wp04_mouth_center_local"] = list(mouth_center)
        remove = sorted(set([*remove, mouth_component]))
    modified = component_evidence(head, selected, components) if selected else []
    removed_evidence = component_evidence(head, remove, components) if remove else []
    material = None
    if selected:
        material = make_material(compositor, candidate["canonicalId"], "hair", candidate["palette"]["hair"], palette)
        material_index = len(head.data.materials)
        head.data.materials.append(material)
        for item in modified:
            for polygon_index in components[item["component"]]:
                head.data.polygons[polygon_index].material_index = material_index
    removed_polygons = delete_component_faces(head.data, remove, components) if remove else 0
    changes = []
    if remove:
        changes.append(
            {
                "mesh": head.name,
                "operation": "delete_local_components",
                "components": remove,
                "polygons": removed_polygons,
                "componentEvidence": removed_evidence,
                "sourceModified": False,
            }
        )
    if mouth_component is not None:
        changes.append(
            {
                "mesh": head.name,
                "operation": "replace_smile_with_neutral_mouth_line",
                "component": mouth_component,
                "sourceModified": False,
            }
        )
    return {
        "mode": "local_material_and_component_correction" if selected or remove else "source_atlas",
        "modifiedComponents": modified,
        "material": material.name if material else None,
        "removedComponents": remove,
        "removedPolygonCount": removed_polygons,
        "geometryChanges": changes,
    }, changes


def in_bands(value, bands):
    return any(lower <= value <= upper for lower, upper in bands)


def apply_body_materials(body, candidate, compositor, palette):
    body.data = body.data.copy()
    if candidate["paletteMode"] == "source_atlas":
        return {
            "mode": "source_atlas",
            "polygonCounts": {"original": len(body.data.polygons)},
            "materials": {},
        }, []
    keys = tuple(key for key in BODY_MATERIAL_KEYS if key in candidate["palette"])
    materials = {
        key: make_material(compositor, candidate["canonicalId"], key, candidate["palette"][key], palette)
        for key in keys
    }
    original = body.material_slots[0].material
    body.material_slots[0].link = "DATA"
    body.data.materials.clear()
    body.data.materials.append(original)
    indices = {"original": 0}
    for key, material in materials.items():
        body.data.materials.append(material)
        indices[key] = len(body.data.materials) - 1
    ranges = {}
    for group in BODY_GROUPS:
        values = [
            float(polygon.center.z)
            for polygon in body.data.polygons
            if dominant_group(polygon, body) == group
        ]
        if values:
            ranges[group] = (min(values), max(values))
    counts = {key: 0 for key in indices}
    bands = candidate["bodyBands"]
    for polygon in body.data.polygons:
        group = dominant_group(polygon, body)
        z = float(polygon.center.z)
        material_key = "original"
        if group in ranges:
            minimum, maximum = ranges[group]
            ratio = (z - minimum) / max(maximum - minimum, 1e-6)
            if group in ("leg-left", "leg-right"):
                material_key = "boots" if ratio < bands["bootRatio"] else "legs"
            elif group in ("arm-left", "arm-right"):
                band_material = next(
                    (
                        item["material"]
                        for item in bands.get("armBands", [])
                        if item["range"][0] <= ratio <= item["range"][1]
                    ),
                    None,
                )
                if band_material:
                    material_key = band_material
                elif ratio <= bands["armHands"][1]:
                    material_key = bands.get("armHandsMaterial", "original")
                else:
                    material_key = "arms"
            elif group == "torso":
                band_material = next(
                    (
                        item["material"]
                        for item in bands.get("torsoBands", [])
                        if item["range"][0] <= ratio <= item["range"][1]
                    ),
                    None,
                )
                material_key = band_material or "torso"
        if material_key not in indices:
            material_key = "original"
        polygon.material_index = indices[material_key]
        counts[material_key] += 1
    return {
        "mode": "solid_local_regions",
        "method": "Assign local solid materials to existing skinned polygons by dominant vertex group and manifest height bands.",
        "groupRanges": {name: [round(value, 6) for value in bounds] for name, bounds in ranges.items()},
        "polygonCounts": counts,
        "materials": {key: material.name for key, material in materials.items()},
    }, []


def apply_padded_jacket_v2(body, candidate, compositor, palette, unit_scale, armature, components, weapon_evidence):
    specification = candidate["meshAdaptation"]
    volume_components = sorted(set(specification["volumeComponents"]))
    volume_evidence = component_evidence(body, volume_components, components)
    shell_offset = specification["shellOffsetMeters"] / unit_scale
    expanded_counts = Counter()
    for vertex in body.data.vertices:
        group = dominant_vertex_group(vertex, body)
        if group == "torso":
            vertex.co += vertex.normal * shell_offset
            vertex.co.x *= specification["torsoWidthScale"]
            vertex.co.y *= specification["torsoDepthScale"]
            expanded_counts[group] += 1
        elif group in ("arm-left", "arm-right"):
            vertex.co += vertex.normal * shell_offset
            vertex.co.x *= specification["armWidthScale"]
            expanded_counts[group] += 1
    body.data.update()

    collar_components = sorted(set(specification["collarSourceComponents"]))
    collar_evidence = component_evidence(body, collar_components, components)
    collar_candidates = {
        polygon_index for index in collar_components for polygon_index in components[index]
    }
    torso_values = [
        float(body.data.polygons[index].center.z)
        for index in collar_candidates
        if dominant_group(body.data.polygons[index], body) == "torso"
    ]
    if not torso_values:
        raise RuntimeError("Jacket collar source has no torso polygons")
    collar_threshold = min(torso_values) + specification["collarTopRatio"] * (
        max(torso_values) - min(torso_values)
    )
    collar_polygons = [
        index
        for index in collar_candidates
        if dominant_group(body.data.polygons[index], body) == "torso"
        and float(body.data.polygons[index].center.z) >= collar_threshold
    ]
    collar = body.copy()
    collar.data = body.data.copy()
    collar.name = f"wp04_{candidate['canonicalId']}_jacket_collar"
    bpy.context.collection.objects.link(collar)
    collar.parent = body.parent
    jacket_material = make_material(
        compositor, candidate["canonicalId"], "jacket", specification["material"], palette
    )
    trim_material = make_material(
        compositor, candidate["canonicalId"], "jacket_trim", specification["trimMaterial"], palette
    )
    collar.data.materials.clear()
    collar.data.materials.append(jacket_material)
    collar.data.materials.append(trim_material)
    bm = bmesh.new()
    bm.from_mesh(collar.data)
    bm.faces.ensure_lookup_table()
    collar_faces = [bm.faces[index] for index in collar_polygons]
    bmesh.ops.delete(
        bm,
        geom=[face for face in bm.faces if face.index not in set(collar_polygons)],
        context="FACES",
    )
    bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context="VERTS")
    original_vertices = set(bm.verts)
    extruded_faces = bmesh.ops.extrude_discrete_faces(
        bm, faces=collar_faces, use_normal_flip=False
    )["faces"]
    collar_height = specification["collarHeightMeters"] / unit_scale
    new_vertices = {vertex for face in extruded_faces for vertex in face.verts} - original_vertices
    for vertex in new_vertices:
        vertex.co.z += collar_height
    for face in extruded_faces:
        face.material_index = 1
    bm.to_mesh(collar.data)
    bm.free()
    collar.data.update()
    collar.modifiers.clear()
    bevel = collar.modifiers.new("Soft collar edges", "BEVEL")
    bevel.width = specification["bevelMeters"] / unit_scale
    bevel.segments = 2
    deform = collar.modifiers.new("Kenney collar skinning", "ARMATURE")
    deform.object = armature
    deform.use_deform_preserve_volume = True
    collar["wp04_skinned_clothing"] = specification["type"]
    collar["wp04_collar_source_components"] = collar_components

    weapon_components = sorted(set(candidate.get("bodyRemoveComponents", [])))
    weapon_polygons = {
        polygon_index for index in weapon_components for polygon_index in components[index]
    }
    removed_polygons = delete_faces(body.data, weapon_polygons)
    clothing_report = {
        "type": specification["type"],
        "volumeObject": body.name,
        "volumeComponents": volume_components,
        "volumeComponentEvidence": volume_evidence,
        "volumeSourcePolygons": sum(len(components[index]) for index in volume_components),
        "expandedVertexCounts": dict(sorted(expanded_counts.items())),
        "collarObject": collar.name,
        "collarSourceComponents": collar_components,
        "collarSourceEvidence": collar_evidence,
        "collarSourcePolygons": len(collar_polygons),
        "collarVertices": len(collar.data.vertices),
        "collarPolygons": len(collar.data.polygons),
        "collarModifiers": [{"name": modifier.name, "type": modifier.type} for modifier in collar.modifiers],
        "shellOffsetMeters": specification["shellOffsetMeters"],
        "volumeMethod": specification["volumeMethod"],
        "bevelMeters": specification["bevelMeters"],
        "collarHeightMeters": specification["collarHeightMeters"],
        "torsoWidthScale": specification["torsoWidthScale"],
        "torsoDepthScale": specification["torsoDepthScale"],
        "armWidthScale": specification["armWidthScale"],
        "justification": specification["justification"],
        "rigidPanels": False,
        "sourceModified": False,
    }
    changes = [
        {
            "mesh": body.name,
            "operation": "identified_incompatible_weapon_components",
            "components": weapon_components,
            "polygons": sum(item["polygons"] for item in weapon_evidence),
            "componentEvidence": weapon_evidence,
            "sourceModified": False,
        },
        {
            "mesh": body.name,
            "operation": "expand_existing_skinned_torso_and_upper_arms_for_padded_jacket",
            "components": volume_components,
            "expandedVertexCounts": dict(sorted(expanded_counts.items())),
            "sourceModified": False,
        },
        {
            "mesh": body.name,
            "operation": "add_skinned_high_collar_from_top_torso_polygons",
            "sourceComponents": collar_components,
            "polygons": len(collar_polygons),
            "replacementObject": collar.name,
            "sourceModified": False,
        },
        {
            "mesh": body.name,
            "operation": "delete_weapon_components",
            "components": weapon_components,
            "polygons": removed_polygons,
            "componentEvidence": weapon_evidence,
            "sourceModified": False,
        },
    ]
    return collar, {"skinnedClothing": clothing_report, "geometryChanges": changes}


def apply_mesh_adaptation(body, candidate, compositor, palette, unit_scale, armature):
    body.data = body.data.copy()
    specification = candidate.get("meshAdaptation")
    removed_components = sorted(set(candidate.get("bodyRemoveComponents", [])))
    if not specification and not removed_components:
        return None, []
    components = components_by_position(body.data)
    weapon_evidence = component_evidence(body, removed_components, components) if removed_components else []
    if specification and specification["type"] == "skinned_padded_jacket_v2":
        return apply_padded_jacket_v2(
            body, candidate, compositor, palette, unit_scale, armature, components, weapon_evidence
        )
    jacket = None
    jacket_report = None
    changes = []
    if specification:
        source_components = sorted(set(specification["sourceComponents"]))
        source_evidence = component_evidence(body, source_components, components)
        selected_polygons = {
            polygon_index for index in source_components for polygon_index in components[index]
        }
        torso_values = [
            float(body.data.polygons[index].center.z)
            for index in selected_polygons
            if dominant_group(body.data.polygons[index], body) == "torso"
        ]
        if not torso_values:
            raise RuntimeError("Jacket source has no torso polygons")
        bottom_ratio = specification.get("torsoBottomRatio", 0.0)
        if bottom_ratio > 0:
            bottom_threshold = min(torso_values) + bottom_ratio * (max(torso_values) - min(torso_values))
            selected_polygons = {
                index
                for index in selected_polygons
                if dominant_group(body.data.polygons[index], body) != "torso"
                or float(body.data.polygons[index].center.z) >= bottom_threshold
            }
            torso_values = [
                float(body.data.polygons[index].center.z)
                for index in selected_polygons
                if dominant_group(body.data.polygons[index], body) == "torso"
            ]
        collar_threshold = min(torso_values) + specification["collarTopRatio"] * (
            max(torso_values) - min(torso_values)
        )
        collar_polygons = [
            index
            for index in selected_polygons
            if dominant_group(body.data.polygons[index], body) == "torso"
            and float(body.data.polygons[index].center.z) >= collar_threshold
        ]
        jacket = body.copy()
        jacket.data = body.data.copy()
        jacket.name = f"wp04_{candidate['canonicalId']}_skinned_jacket"
        bpy.context.collection.objects.link(jacket)
        jacket.parent = body.parent
        shell_offset = specification["shellOffsetMeters"] / unit_scale
        for vertex in jacket.data.vertices:
            vertex.co += vertex.normal * shell_offset
            group = dominant_vertex_group(vertex, body)
            if group == "torso":
                vertex.co.x *= specification["torsoWidthScale"]
                vertex.co.y *= specification["torsoDepthScale"]
            elif group in ("arm-left", "arm-right"):
                vertex.co.x *= specification["armWidthScale"]
        jacket_material = make_material(
            compositor, candidate["canonicalId"], "jacket", specification["material"], palette
        )
        trim_material = make_material(
            compositor, candidate["canonicalId"], "jacket_trim", specification["trimMaterial"], palette
        )
        jacket.data.materials.clear()
        jacket.data.materials.append(jacket_material)
        jacket.data.materials.append(trim_material)
        bm = bmesh.new()
        bm.from_mesh(jacket.data)
        bm.faces.ensure_lookup_table()
        collar_faces = [bm.faces[index] for index in collar_polygons]
        bmesh.ops.delete(
            bm,
            geom=[face for face in bm.faces if face.index not in selected_polygons],
            context="FACES",
        )
        bmesh.ops.delete(bm, geom=[vertex for vertex in bm.verts if not vertex.link_faces], context="VERTS")
        original_vertices = set(bm.verts)
        extruded_faces = bmesh.ops.extrude_discrete_faces(
            bm, faces=collar_faces, use_normal_flip=False
        )["faces"]
        collar_height = specification["collarHeightMeters"] / unit_scale
        new_vertices = {vertex for face in extruded_faces for vertex in face.verts} - original_vertices
        for vertex in new_vertices:
            vertex.co.z += collar_height
        for face in extruded_faces:
            face.material_index = 1
        bm.to_mesh(jacket.data)
        bm.free()
        jacket.data.update()
        jacket.modifiers.clear()
        bevel = jacket.modifiers.new("Soft padded edges", "BEVEL")
        bevel.width = specification["bevelMeters"] / unit_scale
        bevel.segments = 2
        deform = jacket.modifiers.new("Kenney jacket skinning", "ARMATURE")
        deform.object = armature
        deform.use_deform_preserve_volume = True
        jacket["wp04_skinned_clothing"] = specification["type"]
        jacket["wp04_source_components"] = source_components
        jacket_report = {
            "type": specification["type"],
            "object": jacket.name,
            "sourceComponents": source_components,
            "sourceComponentEvidence": source_evidence,
            "sourcePolygons": len(selected_polygons),
            "torsoBottomRatio": bottom_ratio,
            "collarPolygons": len(collar_polygons),
            "vertices": len(jacket.data.vertices),
            "polygons": len(jacket.data.polygons),
            "localBounds": {
                "min": [round(min(vertex.co[axis] for vertex in jacket.data.vertices), 6) for axis in range(3)],
                "max": [round(max(vertex.co[axis] for vertex in jacket.data.vertices), 6) for axis in range(3)],
            },
            "objectScale": vector_list(jacket.scale),
            "parent": jacket.parent.name if jacket.parent else None,
            "vertexGroups": [group.name for group in jacket.vertex_groups],
            "modifiers": [{"name": modifier.name, "type": modifier.type} for modifier in jacket.modifiers],
            "shellOffsetMeters": specification["shellOffsetMeters"],
            "volumeMethod": specification["volumeMethod"],
            "bevelMeters": specification["bevelMeters"],
            "collarHeightMeters": specification["collarHeightMeters"],
            "torsoWidthScale": specification["torsoWidthScale"],
            "torsoDepthScale": specification["torsoDepthScale"],
            "armWidthScale": specification["armWidthScale"],
            "justification": specification["justification"],
            "rigidPanels": False,
            "sourceModified": False,
        }
        changes.append(
            {
                "mesh": body.name,
                "operation": "replace_clothing_components_with_skinned_jacket_shell",
                "components": source_components,
                "polygons": len(selected_polygons),
                "replacementObject": jacket.name,
                "sourceModified": False,
            }
        )
    weapon_polygons = {
        polygon_index for index in removed_components for polygon_index in components[index]
    }
    polygons_to_remove = set(weapon_polygons)
    if specification:
        polygons_to_remove.update(selected_polygons)
    if polygons_to_remove:
        removed_polygons = delete_faces(body.data, polygons_to_remove)
        changes.append(
            {
                "mesh": body.name,
                "operation": "delete_weapon_and_replaced_clothing_polygons",
                "weaponComponents": removed_components,
                "weaponPolygons": len(weapon_polygons),
                "replacedJacketPolygons": len(selected_polygons) if specification else 0,
                "polygons": removed_polygons,
                "componentEvidence": weapon_evidence,
                "sourceModified": False,
            }
        )
    if weapon_evidence:
        changes.insert(
            0,
            {
                "mesh": body.name,
                "operation": "identified_incompatible_weapon_components",
                "components": sorted(set(candidate.get("bodyRemoveComponents", []))),
                "polygons": sum(item["polygons"] for item in weapon_evidence),
                "componentEvidence": weapon_evidence,
                "sourceModified": False,
            },
        )
    return jacket, {"skinnedClothing": jacket_report, "geometryChanges": changes}


def attach(compositor, objects, armature, role, accessory_type, bone):
    for obj in objects:
        compositor.attach_to_bone(obj, armature, bone, f"wp04_{role}", accessory_type)


def add_supervisor_helmet(armature, head, candidate, compositor, palette, created):
    top = PROTOTYPE.head_top(armature, head)
    helmet = make_material(compositor, candidate["canonicalId"], "helmet", "sand", palette)
    band = make_material(compositor, candidate["canonicalId"], "helmet_band", "charcoal", palette)
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.43, radius2=0.36, depth=0.24, location=top + Vector((0, 0, -0.025))
    )
    crown = bpy.context.object
    crown.name = "wp04_supervisor_helmet_crown"
    compositor.finish_object(crown, crown.name, helmet, bevel=0.012)
    brim = compositor.make_cylinder("wp04_supervisor_helmet_brim", top + Vector((0, 0, -0.15)), 0.5, 0.05, helmet)
    visor = compositor.make_box(
        "wp04_supervisor_helmet_visor", top + Vector((0, -0.36, -0.14)), (0.54, 0.24, 0.05), helmet, bevel=0.014
    )
    band_ring = compositor.make_torus(
        "wp04_supervisor_helmet_band", top + Vector((0, 0, -0.135)), 0.405, 0.022, band, scale=(1.04, 0.92, 0.75)
    )
    ridge = compositor.make_box(
        "wp04_supervisor_helmet_ridge", top + Vector((0, 0, 0.105)), (0.055, 0.28, 0.035), helmet, bevel=0.008
    )
    objects = [crown, brim, visor, band_ring, ridge]
    attach(compositor, objects, armature, candidate["canonicalId"], "supervisor_helmet_v2", "head")
    created.extend(objects)


def add_lowered_clipboard(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "arm-left", "tail") + Vector((0.035, -0.1, -0.24))
    leather = make_material(compositor, candidate["canonicalId"], "clipboard", "leather", palette)
    paper = make_material(compositor, candidate["canonicalId"], "paper", "paper", palette)
    metal = make_material(compositor, candidate["canonicalId"], "clip", "metal", palette)
    board = compositor.make_box(
        "wp04_supervisor_clipboard_board", anchor, (0.22, 0.035, 0.3), leather, bevel=0.01
    )
    sheet = compositor.make_box(
        "wp04_supervisor_clipboard_paper", anchor + Vector((0, -0.023, 0.01)), (0.18, 0.009, 0.245), paper, bevel=0.004
    )
    clip = compositor.make_box(
        "wp04_supervisor_clipboard_clip", anchor + Vector((0, -0.03, 0.135)), (0.06, 0.018, 0.026), metal, bevel=0.004
    )
    objects = [board, sheet, clip]
    attach(compositor, objects, armature, candidate["canonicalId"], "clipboard_lowered", "arm-left")
    created.extend(objects)


def add_fire_helmet_v2(armature, head, candidate, compositor, palette, created):
    top = PROTOTYPE.head_top(armature, head)
    helmet = make_material(compositor, candidate["canonicalId"], "helmet", "fire_yellow", palette)
    shield = make_material(compositor, candidate["canonicalId"], "helmet_shield", "charcoal", palette)
    bpy.ops.mesh.primitive_cone_add(
        vertices=10, radius1=0.5, radius2=0.4, depth=0.25, location=top + Vector((0, 0, -0.02))
    )
    crown = bpy.context.object
    crown.name = "wp04_firefighter_helmet_crown"
    compositor.finish_object(crown, crown.name, helmet, bevel=0.015)
    brim = compositor.make_cylinder(
        "wp04_firefighter_helmet_brim", top + Vector((0, 0, -0.18)), 0.56, 0.06, helmet
    )
    visor = compositor.make_box(
        "wp04_firefighter_helmet_visor", top + Vector((0, -0.4, -0.17)), (0.58, 0.22, 0.05), helmet, bevel=0.016
    )
    rear = compositor.make_box(
        "wp04_firefighter_helmet_rear_flap",
        top + Vector((0, 0.36, -0.095)),
        (0.56, 0.065, 0.19),
        shield,
        rotation=(math.radians(-18), 0, 0),
        bevel=0.02,
    )
    front = compositor.make_box(
        "wp04_firefighter_helmet_front_shield",
        top + Vector((0, -0.405, 0.015)),
        (0.22, 0.04, 0.16),
        shield,
        bevel=0.016,
    )
    crest = compositor.make_box(
        "wp04_firefighter_helmet_crest", top + Vector((0, 0, 0.125)), (0.06, 0.36, 0.05), helmet, bevel=0.01
    )
    objects = [crown, brim, visor, rear, front, crest]
    attach(compositor, objects, armature, candidate["canonicalId"], "fire_helmet_v2", "head")
    created.extend(objects)


def add_work_helmet(armature, head, candidate, compositor, palette, created):
    top = PROTOTYPE.head_top(armature, head)
    helmet = make_material(compositor, candidate["canonicalId"], "helmet", "ochre", palette)
    dome = compositor.make_sphere(
        "wp04_worker_b_helmet_dome", top + Vector((0, 0, -0.055)), (0.4, 0.37, 0.2), helmet
    )
    brim = compositor.make_cylinder(
        "wp04_worker_b_helmet_brim", top + Vector((0, 0, -0.16)), 0.46, 0.05, helmet
    )
    ridge = compositor.make_box(
        "wp04_worker_b_helmet_ridge", top + Vector((0, 0, 0.135)), (0.05, 0.3, 0.035), helmet, bevel=0.008
    )
    objects = [dome, brim, ridge]
    attach(compositor, objects, armature, candidate["canonicalId"], "work_helmet", "head")
    created.extend(objects)


def add_work_cap(armature, head, candidate, compositor, palette, created):
    top = PROTOTYPE.head_top(armature, head)
    cap = make_material(compositor, candidate["canonicalId"], "cap", "navy", palette)
    crown = compositor.make_sphere(
        "wp04_technician_cap_crown", top + Vector((0, 0, -0.025)), (0.36, 0.33, 0.12), cap
    )
    brim = compositor.make_box(
        "wp04_technician_cap_brim", top + Vector((0, -0.29, -0.08)), (0.42, 0.22, 0.04), cap, bevel=0.012
    )
    objects = [crown, brim]
    attach(compositor, objects, armature, candidate["canonicalId"], "work_cap", "head")
    created.extend(objects)


def add_belt(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "torso", "tail") + Vector((0, 0, 0.015))
    leather = make_material(compositor, candidate["canonicalId"], "belt", "leather", palette)
    metal = make_material(compositor, candidate["canonicalId"], "buckle", "metal", palette)
    belt = compositor.make_torus(
        f"wp04_{candidate['canonicalId']}_belt", anchor, 0.29, 0.035, leather, scale=(1.12, 0.78, 0.75)
    )
    buckle = compositor.make_box(
        f"wp04_{candidate['canonicalId']}_belt_buckle",
        anchor + Vector((0, -0.235, 0)),
        (0.075, 0.025, 0.055),
        metal,
        bevel=0.006,
    )
    objects = [belt, buckle]
    attach(compositor, objects, armature, candidate["canonicalId"], "belt", "torso")
    created.extend(objects)


def add_badge(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "torso", "tail") + Vector((0.14, -0.225, 0.2))
    material = make_material(compositor, candidate["canonicalId"], "badge", "badge_gold", palette)
    badge = compositor.make_cylinder("wp04_police_badge", anchor, 0.045, 0.018, material, bevel=0.003)
    badge.rotation_euler = (math.pi / 2, 0, 0)
    attach(compositor, [badge], armature, candidate["canonicalId"], "badge", "torso")
    created.append(badge)


def add_serious_mouth(armature, head, candidate, compositor, palette, created):
    local = head.get("wp04_mouth_center_local")
    if local is None:
        raise RuntimeError("Missing neutral-mouth anchor")
    anchor = head.matrix_world @ Vector(local)
    mouth = make_material(compositor, candidate["canonicalId"], "mouth", "black", palette)
    line = compositor.make_box(
        "wp04_enforcer_neutral_mouth", anchor, (0.09, 0.012, 0.014), mouth, bevel=0.003
    )
    attach(compositor, [line], armature, candidate["canonicalId"], "serious_mouth", "head")
    created.append(line)


def add_wrench(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "arm-right", "tail") + Vector((0.025, -0.035, -0.015))
    metal = make_material(compositor, candidate["canonicalId"], "wrench", "metal", palette)
    handle = compositor.make_cylinder(
        "wp04_technician_wrench_handle", anchor + Vector((0, 0, 0.055)), 0.012, 0.18, metal, bevel=0.003
    )
    jaw = compositor.make_torus(
        "wp04_technician_wrench_jaw", anchor + Vector((0, 0, 0.15)), 0.026, 0.007, metal, scale=(1, 1, 0.7)
    )
    objects = [handle, jaw]
    attach(compositor, objects, armature, candidate["canonicalId"], "wrench", "arm-right")
    created.extend(objects)


def add_folder(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "arm-left", "tail") + Vector((0.025, -0.09, -0.015))
    folder = make_material(compositor, candidate["canonicalId"], "folder", "navy", palette)
    paper = make_material(compositor, candidate["canonicalId"], "paper", "paper", palette)
    board = compositor.make_box(
        f"wp04_{candidate['canonicalId']}_folder", anchor, (0.2, 0.028, 0.26), folder, bevel=0.008
    )
    sheet = compositor.make_box(
        f"wp04_{candidate['canonicalId']}_folder_paper",
        anchor + Vector((0, -0.021, 0.015)),
        (0.17, 0.008, 0.22),
        paper,
        bevel=0.003,
    )
    objects = [board, sheet]
    attach(compositor, objects, armature, candidate["canonicalId"], "folder", "arm-left")
    created.extend(objects)


def add_medical_bag(armature, candidate, compositor, palette, created):
    anchor = PROTOTYPE.bone_point(armature, "arm-left", "tail") + Vector((0.02, -0.04, -0.11))
    bag = make_material(compositor, candidate["canonicalId"], "bag", "cream", palette)
    trim = make_material(compositor, candidate["canonicalId"], "trim", "teal", palette)
    leather = make_material(compositor, candidate["canonicalId"], "handle", "leather", palette)
    box = compositor.make_box(
        "wp04_medical_bag", anchor, (0.18, 0.1, 0.2), bag, bevel=0.015
    )
    cross = compositor.make_box(
        "wp04_medical_bag_trim", anchor + Vector((0, -0.052, 0)), (0.035, 0.012, 0.16), trim, bevel=0.003
    )
    handle = compositor.make_torus(
        "wp04_medical_bag_handle", anchor + Vector((0, 0, 0.105)), 0.05, 0.009, leather, scale=(1, 0.65, 1)
    )
    objects = [box, cross, handle]
    attach(compositor, objects, armature, candidate["canonicalId"], "medical_bag", "arm-left")
    created.extend(objects)


def build_accessories(armature, head, candidate, compositor, palette):
    created = []
    for accessory in candidate["accessories"]:
        if accessory == "supervisor_helmet_v2":
            add_supervisor_helmet(armature, head, candidate, compositor, palette, created)
        elif accessory == "clipboard_lowered":
            add_lowered_clipboard(armature, candidate, compositor, palette, created)
        elif accessory == "fire_helmet_v2":
            add_fire_helmet_v2(armature, head, candidate, compositor, palette, created)
        elif accessory == "work_helmet":
            add_work_helmet(armature, head, candidate, compositor, palette, created)
        elif accessory == "work_cap":
            add_work_cap(armature, head, candidate, compositor, palette, created)
        elif accessory == "belt":
            add_belt(armature, candidate, compositor, palette, created)
        elif accessory == "badge":
            add_badge(armature, candidate, compositor, palette, created)
        elif accessory == "serious_mouth":
            add_serious_mouth(armature, head, candidate, compositor, palette, created)
        elif accessory == "wrench":
            add_wrench(armature, candidate, compositor, palette, created)
        elif accessory == "folder":
            add_folder(armature, candidate, compositor, palette, created)
        elif accessory == "medical_bag":
            add_medical_bag(armature, candidate, compositor, palette, created)
        else:
            raise RuntimeError(f"Unsupported accessory: {accessory}")
    return created


def packed_atlas_hashes(objects):
    result = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if not material or not material.node_tree:
                continue
            for node in material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and node.image.packed_file:
                    result[f"{obj.name}/{material.name}/{node.image.name}"] = sha256_bytes(
                        node.image.packed_file.data
                    )
    return result


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def measure_accessory_drift(armature, accessories, frames):
    if not accessories:
        return 0.0
    bpy.context.scene.frame_set(frames[0])
    bpy.context.view_layer.update()

    def relative():
        bpy.context.view_layer.update()
        return {
            obj.name: (
                armature.matrix_world @ armature.pose.bones[obj["wp_character_bone"]].matrix
            ).inverted()
            @ obj.matrix_world
            for obj in accessories
        }

    first = relative()
    maximum = 0.0
    try:
        for frame in frames:
            bpy.context.scene.frame_set(frame)
            current = relative()
            for name in first:
                for row in range(4):
                    for column in range(4):
                        maximum = max(
                            maximum, abs(first[name][row][column] - current[name][row][column])
                        )
    finally:
        bpy.context.scene.frame_set(frames[0])
        bpy.context.view_layer.update()
    if maximum > 1e-4:
        raise RuntimeError(f"Accessory drift exceeds tolerance: {maximum}")
    return maximum


def configure_render(runtime_asset, style_layer, config):
    runtime_asset.apply_style_layer_lighting(bpy.context.scene, style_layer)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = config["render"]["width"]
    scene.render.resolution_y = config["render"]["height"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.render.film_transparent = True
    runtime_asset.apply_render_settings(scene, style_layer)


def dependency_report(config, manifest_path, runtime_path):
    paths = {
        "manifest": manifest_path,
        "renderer": TOOL_DIR / "render_smoke.py",
        "animationCommon": REPO_ROOT / config["dependencies"]["shared"]["animationCommon"],
        "workerRenderer": REPO_ROOT / config["dependencies"]["shared"]["workerRenderer"],
        "prototypeHelpers": REPO_ROOT / config["dependencies"]["shared"]["prototypeHelpers"],
        "compositor": REPO_ROOT / config["dependencies"]["shared"]["compositor"],
        "runtimeAsset": runtime_path,
        "sourceImport": runtime_path.parent / "source_import.py",
        "styleLayer": runtime_path.parent / "style_layer_graphic_civic.json",
    }
    return {
        name: {
            "path": str(path.resolve()),
            "repositoryPath": str(path.resolve().relative_to(REPO_ROOT)),
            "sha256": sha256(path),
        }
        for name, path in paths.items()
    }


def main():
    global PROTOTYPE
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_dir = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    if config["stage"] != "smoke" or not config["matrix"]["smoke"]["rendered"]:
        raise RuntimeError("This renderer is restricted to the authorized SMOKE stage")
    if args.role not in config["candidates"]:
        raise RuntimeError(f"Unknown role: {args.role}")
    if len(config["candidates"]) != 14:
        raise RuntimeError("WP-CHAR-04 requires exactly 14 candidates")
    candidate = config["candidates"][args.role]
    resolved_palette = {
        **config["palette"],
        **{
            key: config["palette"][value]
            for key, value in candidate["palette"].items()
            if value in config["palette"]
        },
    }
    if output_dir.exists() and any(path.is_file() for path in output_dir.iterdir()):
        raise RuntimeError(f"Output is not fresh: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    common = load_module("wp04_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp04_worker", WP02A_TOOLS / "render_worker_reference.py")
    PROTOTYPE = load_module("wp04_prototype", WP02B_TOOLS / "render_profession_prototypes.py")
    compositor = load_module("wp04_compositor", REPO_ROOT / config["dependencies"]["shared"]["compositor"])
    runtime_asset = load_module("wp04_runtime", runtime_path)
    source_import = load_module("wp04_source_import", runtime_path.parent / "source_import.py")
    style_layer = json.loads(
        (runtime_path.parent / "style_layer_graphic_civic.json").read_text(encoding="utf-8")
    )
    source_path = source_root / candidate["sourcePath"]
    license_path = source_root / config["sourcePolicy"]["licenseFile"]
    if sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError(f"Source hash mismatch: {args.role}")
    if sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("Kenney license hash mismatch")

    common.clear_scene()
    imported = source_import.import_source(source_path)
    source_import.assert_textures_resolved(imported, source_path)
    armature = next(obj for obj in imported if obj.type == "ARMATURE")
    if {bone.name for bone in armature.data.bones} != EXPECTED_BONES:
        raise RuntimeError(f"Unexpected Kenney rig: {[bone.name for bone in armature.data.bones]}")
    if len(bpy.data.actions) != 32:
        raise RuntimeError(f"Expected 32 Kenney actions, found {len(bpy.data.actions)}")
    objects = worker.character_objects(armature)
    worker.remove_objects([obj for obj in bpy.data.objects if obj not in objects])
    source_mins, source_maxs = source_import.world_bounds(objects)
    unit_scale = config["render"]["visibleHeightMeters"] / float(source_maxs.z - source_mins.z)
    normalization = source_import.normalize_import_root(objects, unit_scale=unit_scale)
    material_treatment = worker.local_material_treatment(objects, "source")
    atlas_before = packed_atlas_hashes(objects)
    body = next(obj for obj in objects if obj.type == "MESH" and obj.name == "body-mesh")
    head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")

    jacket, adaptation = apply_mesh_adaptation(
        body, candidate, compositor, resolved_palette, unit_scale, armature
    )
    if jacket is not None:
        objects.append(jacket)
    head_report, head_changes = apply_head_corrections(head, candidate, compositor, resolved_palette)
    body_report, body_changes = apply_body_materials(body, candidate, compositor, resolved_palette)
    geometry_changes = [*(adaptation["geometryChanges"] if adaptation else []), *head_changes, *body_changes]

    idle_action = bpy.data.actions.get("idle")
    walk_action = bpy.data.actions.get("walk")
    if idle_action is None or walk_action is None:
        raise RuntimeError("Missing idle/walk actions")
    worker.bind_action(armature, idle_action)
    accessories = build_accessories(armature, head, candidate, compositor, resolved_palette)
    objects.extend(accessories)
    bpy.context.view_layer.update()
    head_mins, head_maxs = source_import.world_bounds([head])
    head_size = head_maxs - head_mins
    accessory_report = []
    for obj in accessories:
        mins, maxs = source_import.world_bounds([obj])
        size = maxs - mins
        accessory_report.append(
            {
                "name": obj.name,
                "type": obj.get("wp_character_accessory"),
                "bone": obj.get("wp_character_bone"),
                "constraints": [constraint.type for constraint in obj.constraints],
                "dimensionsMeters": vector_list(size),
                "boundsMeters": {"min": vector_list(mins), "max": vector_list(maxs)},
                "widthToHeadRatio": round(float(size.x / head_size.x), 6),
            }
        )
    walk_frames, _, _ = common.useful_frames(
        walk_action, len(config["matrix"]["batchContract"]["walkSamples"])
    )
    if walk_frames != config["matrix"]["batchContract"]["walkActionFrames"]:
        raise RuntimeError(f"Unexpected walk sampling: {walk_frames}")
    drift_frames = [int(round(idle_action.frame_range[0])), *walk_frames]
    max_drift = measure_accessory_drift(armature, accessories, drift_frames)
    configure_render(runtime_asset, style_layer, config)

    skinned_clothing = adaptation["skinnedClothing"] if adaptation else None
    if skinned_clothing:
        pose_bounds = {}
        for label, action, frame in (
            ("idle", idle_action, int(round(idle_action.frame_range[0]))),
            ("walk04", walk_action, walk_frames[4]),
        ):
            worker.bind_action(armature, action)
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            mins, maxs = source_import.world_bounds([jacket])
            pose_bounds[label] = {
                "frame": frame,
                "boundsMeters": {"min": vector_list(mins), "max": vector_list(maxs)},
                "sizeMeters": vector_list(maxs - mins),
            }
        skinned_clothing["poseBounds"] = pose_bounds
        worker.bind_action(armature, idle_action)

    dependencies = dependency_report(config, manifest_path, runtime_path)
    report = {
        "schemaVersion": 1,
        "status": "smoke_technical_complete_pending_human_review",
        "stage": "smoke",
        "pipelineVersion": config["pipelineVersion"],
        "revision": config["revision"],
        "runId": args.run_id,
        "role": args.role,
        "canonicalId": candidate["canonicalId"],
        "worktree": str(REPO_ROOT),
        "branch": config["branch"],
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "blender": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode() if isinstance(bpy.app.build_hash, bytes) else bpy.app.build_hash,
        "source": {
            "path": str(source_path),
            "repositoryPath": str(source_path.relative_to(REPO_ROOT)),
            "sha256": sha256(source_path),
            "license": config["sourcePolicy"]["license"],
        },
        "license": {
            "path": str(license_path),
            "repositoryPath": str(license_path.relative_to(REPO_ROOT)),
            "sha256": sha256(license_path),
        },
        "coverage": candidate["coverage"],
        "technicalCorrection": candidate["technicalCorrection"],
        "normalization": normalization,
        "unitScale": round(unit_scale, 8),
        "materialTreatment": material_treatment,
        "bodyMaterials": body_report,
        "headMaterials": head_report,
        "geometryChanges": geometry_changes,
        "skinnedClothing": skinned_clothing,
        "accessories": accessory_report,
        "declaredAccessoryOrder": candidate["accessories"],
        "anchors": sorted({obj["wp_character_bone"] for obj in accessories}),
        "maxAccessoryDrift": max_drift,
        "rig": {
            "armature": armature.name,
            "bones": len(armature.data.bones),
            "boneNames": [bone.name for bone in armature.data.bones],
            "actions": len(bpy.data.actions),
        },
        "animations": {
            "idle": common.action_report(idle_action),
            "walk": common.action_report(walk_action),
            "walkFrames": walk_frames,
        },
        "camera": config["camera"],
        "render": config["render"],
        "headDimensionsMeters": vector_list(head_size),
        "atlasHashesBefore": atlas_before,
        "atlasHashesAfter": packed_atlas_hashes(objects),
        "dependencies": dependencies,
        "batchRendered": False,
        "runtimePromotion": False,
        "approval": "pending_human",
        "humanApprovalClaimed": False,
        "visualRisks": candidate["visualRisks"],
        "outputs": [],
    }
    if sorted(report["atlasHashesBefore"].values()) != sorted(report["atlasHashesAfter"].values()):
        raise RuntimeError("Packed atlas hash set changed during local rework")

    camera, _ = runtime_asset.place_camera(
        config["camera"]["targetZ"],
        config["camera"]["orthoScale"],
        name=f"WP04_{args.role.upper()}_D0",
        azimuth_degrees=config["camera"]["azimuthBaseDegrees"],
    )
    smoke_walk_sample = candidate.get("smokeWalkSample", config["matrix"]["smoke"]["walkSamples"][0])
    for animation, action, sample_index, frame in (
        ("idle", idle_action, 0, int(round(idle_action.frame_range[0]))),
        ("walk", walk_action, smoke_walk_sample, walk_frames[smoke_walk_sample]),
    ):
        worker.bind_action(armature, action)
        path = output_dir / f"{args.role}-d0-{animation}-{sample_index:02d}.png"
        sample = worker.render_frame(
            objects,
            armature,
            bpy.context.scene,
            camera,
            frame,
            0,
            animation,
            sample_index,
            path,
            common,
            source_import,
            {**config, "materialMode": "source", "walkSamples": 8},
        )
        sample["runId"] = args.run_id
        sample["bonePositions"] = {
            bone.name: {
                "head": vector_list(common.bone_position(armature, bone.name, "head")),
                "tail": vector_list(common.bone_position(armature, bone.name, "tail")),
            }
            for bone in armature.data.bones
        }
        sample["compositionSidecar"] = str(path.with_suffix(".composition.json").relative_to(REPO_ROOT))
        sample["actionReport"] = common.action_report(action)
        report["outputs"].append(sample)

    if sha256(source_path) != candidate["sourceSha256"]:
        raise RuntimeError("Source GLB changed during rendering")
    if sha256(license_path) != config["sourcePolicy"]["licenseFileSha256"]:
        raise RuntimeError("License file changed during rendering")
    report_path = output_dir / f"{args.role}-prototype.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    report_hash = sha256(report_path)
    for sample in report["outputs"]:
        image_path = REPO_ROOT / sample["image"]["path"]
        sidecar_path = REPO_ROOT / sample["compositionSidecar"]
        sidecar = {
            "schemaVersion": 1,
            "runId": args.run_id,
            "role": args.role,
            "canonicalId": candidate["canonicalId"],
            "stage": "smoke",
            "direction": sample["direction"],
            "animation": sample["animation"],
            "sampleIndex": sample["sampleIndex"],
            "actionFrame": sample["frame"],
            "source": report["source"],
            "license": report["license"],
            "manifest": report["manifest"],
            "manifestSha256": report["manifestSha256"],
            "dependencies": dependencies,
            "blender": report["blender"],
            "buildHash": report["buildHash"],
            "declaredAccessoryOrder": candidate["accessories"],
            "accessoryObjectCount": len(accessories),
            "accessories": accessory_report,
            "maxAccessoryDrift": max_drift,
            "skinnedClothing": skinned_clothing,
            "geometryChanges": geometry_changes,
            "camera": config["camera"],
            "render": config["render"],
            "cameraBounds": sample["cameraBounds"],
            "ground": {
                "minZ": sample["minZ"],
                "groundingOffsetMeters": sample["groundingOffsetMeters"],
                "toleranceMeters": config["acceptance"]["groundToleranceMeters"],
            },
            "output": sample["image"],
            "metadata": {
                "path": str(report_path.relative_to(REPO_ROOT)),
                "sha256": report_hash,
            },
            "atlasHashesBefore": atlas_before,
            "atlasHashesAfter": report["atlasHashesAfter"],
            "batchRendered": False,
            "runtimePromotion": False,
            "approval": "pending_human",
            "humanApprovalClaimed": False,
        }
        sidecar_path.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        if sha256(image_path) != sample["image"]["sha256"]:
            raise RuntimeError("Rendered image hash changed while writing sidecar")
    print(
        json.dumps(
            {
                "status": "smoke_rendered",
                "role": args.role,
                "canonicalId": candidate["canonicalId"],
                "frames": len(report["outputs"]),
                "report": str(report_path),
            },
            ensure_ascii=False,
        )
    )
    print(f"WP_CHAR_04_SMOKE_OK {args.role} {args.run_id}")


if __name__ == "__main__":
    main()

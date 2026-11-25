"""Original, neutral architectural details for organization headquarters.

The Composer owns this geometry so it is deterministic and appears in the composition signature,
bounds, triangle accounting and Blender scene checks.  It deliberately contains NO organization
color or organization-specific emblem: the baked diamond is only a neutral recess.  The view layer
may later paint the recess with the organization's color and shape.

This module has no ``bpy`` dependency.  ``compose.py`` uses the same part list as ``scene.py`` to
sign bounds/triangles and to build the meshes, which prevents metadata from promising geometry that
was never rendered.
"""

from __future__ import annotations

import math


SOURCE_ID = "src_original_headquarters_composer"
SOURCE_PATH = "tools/art-pipeline/blender/building_composer/architectural_details.py"
LICENSE = "original"
KINDS = {"organization_badge", "garage_portal", "courtyard_portal"}


def cube_part(name, size, center, material):
    return {
        "name": name,
        "shape": "box",
        "size": [round(float(value), 4) for value in size],
        "center": [round(float(value), 4) for value in center],
        "material": material,
        "triangles": 12,
    }


def diamond_part(name, width, height, depth, center_y, material="metal"):
    """Diamond prism in the local X/Z plane, with its front toward local -Y."""
    half_w = width / 2.0
    half_h = height / 2.0
    y0 = center_y - depth / 2.0
    y1 = center_y + depth / 2.0
    vertices = [
        (-half_w, y0, 0.0),
        (0.0, y0, half_h),
        (half_w, y0, 0.0),
        (0.0, y0, -half_h),
        (-half_w, y1, 0.0),
        (0.0, y1, half_h),
        (half_w, y1, 0.0),
        (0.0, y1, -half_h),
    ]
    faces = [
        (0, 1, 2),
        (0, 2, 3),
        (4, 6, 5),
        (4, 7, 6),
        (0, 4, 5),
        (0, 5, 1),
        (1, 5, 6),
        (1, 6, 2),
        (2, 6, 7),
        (2, 7, 3),
        (3, 7, 4),
        (3, 4, 0),
    ]
    return {
        "name": name,
        "shape": "diamond",
        "vertices": [[round(value, 4) for value in vertex] for vertex in vertices],
        "faces": faces,
        "material": material,
        "triangles": len(faces),
    }


def parts_for(detail):
    """Return the exact original parts used by both composition and Blender scene."""
    kind = detail["kind"]
    width = float(detail["widthMeters"])
    height = float(detail["heightMeters"])
    depth = float(detail["depthMeters"])
    double_sided = bool(detail.get("doubleSided", False))
    if kind == "organization_badge":
        parts = [cube_part("plaque", (width, depth, height), (0.0, 0.0, 0.0), "plaster")]
        diamond_width = width * float(detail.get("recessRatio", 0.58))
        diamond_height = height * float(detail.get("recessRatio", 0.58))
        diamond_depth = max(0.018, depth * 0.22)
        front_y = -depth / 2.0 - diamond_depth / 2.0 + 0.006
        parts.append(
            diamond_part(
                "neutral_recess_front",
                diamond_width,
                diamond_height,
                diamond_depth,
                front_y,
            )
        )
        if double_sided:
            parts.append(
                diamond_part(
                    "neutral_recess_rear",
                    diamond_width,
                    diamond_height,
                    diamond_depth,
                    -front_y,
                )
            )
            # A freestanding construction board: two original posts, not contextual dressing.
            for index, x in enumerate((-width * 0.36, width * 0.36)):
                parts.append(
                    cube_part(
                        f"board_post_{index}",
                        (0.08, depth * 0.80, height),
                        (x, 0.0, -height),
                        "metal",
                    )
                )
        return parts
    if kind == "garage_portal":
        pier = max(0.18, width * 0.09)
        lintel = max(0.22, height * 0.10)
        door_height = height - lintel - 0.12
        parts = [
            cube_part("pier_left", (pier, depth, height), (-width / 2.0 + pier / 2.0, 0.0, 0.0), "plaster"),
            cube_part("pier_right", (pier, depth, height), (width / 2.0 - pier / 2.0, 0.0, 0.0), "plaster"),
            cube_part("lintel", (width, depth, lintel), (0.0, 0.0, height / 2.0 - lintel / 2.0), "plaster"),
            cube_part(
                "garage_leaf",
                (width - pier * 2.0 - 0.08, depth * 0.30, door_height),
                (0.0, -depth * 0.10, -height / 2.0 + 0.06 + door_height / 2.0),
                "metal",
            ),
        ]
        for index in range(1, 5):
            z = -height / 2.0 + 0.10 + door_height * index / 5.0
            parts.append(
                cube_part(
                    f"garage_panel_{index}",
                    (width - pier * 2.0 - 0.22, depth * 0.10, 0.035),
                    (0.0, -depth * 0.28, z),
                    "plaster",
                )
            )
        return parts
    if kind == "courtyard_portal":
        pier = max(0.28, width * 0.10)
        board_height = min(0.62, height * 0.22)
        lintel_height = max(0.24, height * 0.10)
        pier_height = height - board_height - lintel_height
        board_z = height / 2.0 - board_height / 2.0
        lintel_z = height / 2.0 - board_height - lintel_height / 2.0
        parts = [
            cube_part("pier_left", (pier, depth, pier_height), (-width / 2.0 + pier / 2.0, 0.0, -height / 2.0 + pier_height / 2.0), "plaster"),
            cube_part("pier_right", (pier, depth, pier_height), (width / 2.0 - pier / 2.0, 0.0, -height / 2.0 + pier_height / 2.0), "plaster"),
            cube_part("lintel", (width, depth, lintel_height), (0.0, 0.0, lintel_z), "plaster"),
            cube_part("service_plaque", (width * 0.72, depth * 0.72, board_height), (0.0, 0.0, board_z), "metal"),
            diamond_part(
                "service_direction_recess",
                width * 0.72 * 0.58,
                board_height * 0.58,
                max(0.018, depth * 0.16),
                -depth * 0.40,
                "plaster",
            ),
        ]
        return parts
    raise ValueError(f"detalle arquitectónico no construido: {kind}")


def part_bounds(part):
    if part["shape"] == "box":
        sx, sy, sz = part["size"]
        cx, cy, cz = part["center"]
        return {
            "x": {"min": cx - sx / 2.0, "max": cx + sx / 2.0},
            "y": {"min": cy - sy / 2.0, "max": cy + sy / 2.0},
            "z": {"min": cz - sz / 2.0, "max": cz + sz / 2.0},
        }
    vertices = part["vertices"]
    return {
        axis: {"min": min(vertex[index] for vertex in vertices), "max": max(vertex[index] for vertex in vertices)}
        for index, axis in enumerate(("x", "y", "z"))
    }


def diamond_local_center(detail, face="front"):
    depth = float(detail["depthMeters"])
    diamond_depth = max(0.018, depth * 0.22)
    y = -depth / 2.0 - diamond_depth / 2.0 + 0.006
    return [0.0, y if face == "front" else -y, 0.0]


def rotate_local(point, rotation_degrees):
    angle = math.radians(rotation_degrees)
    cosine = round(math.cos(angle), 12)
    sine = round(math.sin(angle), 12)
    x, y, z = point
    return [x * cosine - y * sine, x * sine + y * cosine, z]

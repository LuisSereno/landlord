"""Fabrica modular de siluetas V.e.2. La configuración vive fuera del código."""

import math

import bpy


def _cube(cube, name, xyz, size, mat, bevel=0.04, rotation=None):
    return cube(name, xyz, size, mat, bevel=bevel, rotation=rotation)


def _window_grid(cube, width, depth, floors, mats, facade):
    rows = max(1, floors)
    columns = max(2, min(6, round(width / 0.7)))
    for row in range(rows):
        z = 0.72 + row * 0.82
        for col in range(columns):
            x = -width * 0.38 + (width * 0.76 * col / max(1, columns - 1))
            _cube(cube, f"window_{row}_{col}", (x, -depth / 2 - 0.025, z),
                  (0.34, 0.05, 0.38), mats["window"], bevel=0.01)
    if facade in ("tower_grid", "school_wings"):
        for row in range(rows):
            _cube(cube, f"band_{row}", (0, -depth / 2 - 0.055, 0.43 + row * 0.82),
                  (width * 0.9, 0.06, 0.08), mats["accent"], bevel=0.01)


def _roof(cube, cylinder, preset, width, depth, height, mats):
    if preset in ("flat", "flat_parapet"):
        _cube(cube, "roof_flat", (0, 0, height + 0.12), (width * 1.03, depth * 1.03, 0.22), mats["metal"])
        if preset == "flat_parapet":
            for y in (-depth / 2, depth / 2):
                _cube(cube, "parapet", (0, y, height + 0.32), (width * 1.05, 0.12, 0.4), mats["brick"])
    elif preset in ("pitched", "clerestory"):
        for sign in (-1, 1):
            _cube(cube, "roof_pitch", (sign * width * 0.23, 0, height + 0.32),
                  (width * 0.58, depth * 1.06, 0.16), mats["metal"],
                  rotation=(0, math.radians(sign * 24), 0))
        if preset == "clerestory":
            _cube(cube, "clerestory", (0, 0, height + 0.64), (width * 0.42, depth * 0.7, 0.55), mats["plaster"])
    elif preset == "sawtooth":
        for x in (-width * 0.27, 0, width * 0.27):
            _cube(cube, "sawtooth", (x, 0, height + 0.25), (width * 0.28, depth, 0.18), mats["metal"], rotation=(0, math.radians(18), 0))
    elif preset == "clock_pediment":
        _cube(cube, "pediment", (0, 0, height + 0.28), (width * 0.72, depth * 0.65, 0.45), mats["plaster"])
        cylinder("clock_tower", (0, 0, height + 1.05), width * 0.16, 1.35, mats["brick"], vertices=12)


def build_factory_building(spec, state, mats, cube, cylinder, sphere):
    """Compone un edificio completo desde el preset, sin ramas por id."""
    footprint = spec["footprint"]
    width = 2.2 + footprint["width"] * 0.55
    depth = 2.0 + footprint["height"] * 0.38
    floors = spec["floorCount"]
    height = 0.72 + floors * 0.82
    facade = spec["facadePreset"]
    family = spec["materialFamily"]
    wall = mats["brick"] if "brick" in family or "stone" in family else mats["plaster"]
    if "metal" in family:
        wall = mats["metal"]

    if state == "construction":
        _cube(cube, "foundation", (0, 0, 0.09), (width, depth, 0.18), mats["plaster"])
        partial_height = max(0.8, height * 0.48)
        _cube(cube, "partial_structure", (0, depth * 0.08, partial_height / 2),
              (width * 0.72, depth * 0.68, partial_height), mats["brick"])
        for x in (-width * 0.46, width * 0.46):
            for y in (-depth * 0.42, depth * 0.42):
                cylinder("scaffold_post", (x, y, 1.15), 0.045, 2.3, mats["accent"], vertices=8)
        for z in (0.65, 1.45):
            _cube(cube, "scaffold_plank", (0, -depth * 0.46, z), (width, 0.18, 0.1), mats["metal"])
        _cube(cube, "material_pile", (width * 0.32, -depth * 0.3, 0.25), (0.75, 0.6, 0.5), mats["plaster"])
        for x in (-width * 0.32, width * 0.32):
            cylinder("barrier_cone", (x, -depth * 0.58, 0.2), 0.12, 0.4, mats["accent"], vertices=8)
        return

    # La masa responde a presets morfológicos, no a ids de gameplay.
    if facade in ("terraced", "school_wings", "market_aisles"):
        segments = 4 if facade == "terraced" else 3
        for index in range(segments):
            x = -width * 0.4 + index * width * 0.8 / max(1, segments - 1)
            _cube(cube, f"mass_{index}", (x, 0, height / 2),
                  (width / segments * 1.08, depth, height - (0.18 if index % 2 else 0)), wall)
    elif facade in ("process_hall", "kiln_hall", "heavy_bay"):
        _cube(cube, "industrial_hall", (-width * 0.12, 0, height * 0.45), (width * 0.76, depth, height * 0.9), wall)
        _cube(cube, "industrial_annex", (width * 0.38, depth * 0.16, height * 0.28), (width * 0.32, depth * 0.62, height * 0.56), mats["metal"])
    elif facade == "civic_symmetry":
        _cube(cube, "civic_center", (0, 0, height / 2), (width * 0.62, depth, height), wall)
        for sign in (-1, 1):
            _cube(cube, "civic_wing", (sign * width * 0.38, 0.18, height * 0.38), (width * 0.28, depth * 0.78, height * 0.76), wall)
    else:
        _cube(cube, "main_mass", (0, 0, height / 2), (width, depth, height), wall)

    _window_grid(cube, width, depth, floors, mats, facade)
    _cube(cube, "entry", (0, -depth / 2 - 0.06, 0.48), (0.62, 0.12, 0.96), mats["accent"])
    _roof(cube, cylinder, spec["roofPreset"], width, depth, height, mats)

    equipment = set(spec["industrialEquipment"])
    if "silos" in equipment:
        for x in (width * 0.28, width * 0.5):
            cylinder("silo", (x, depth * 0.18, 1.5), 0.42, 3.0, mats["plaster"], vertices=16)
    if "tall_chimney" in equipment or "twin_stacks" in equipment:
        count = 2 if "twin_stacks" in equipment else 1
        for index in range(count):
            cylinder("stack", (width * (0.25 + index * 0.22), depth * 0.24, 2.25), 0.25, 4.5, mats["brick"], vertices=12)
    if "gantry" in equipment:
        for x in (-width * 0.45, width * 0.45):
            _cube(cube, "gantry_post", (x, 0, 1.55), (0.18, 0.18, 3.1), mats["accent"])
        _cube(cube, "gantry_beam", (0, 0, 3.0), (width, 0.22, 0.22), mats["accent"])
    if "three_engine_doors" in equipment or "loading_bays" in equipment:
        count = 3
        for index in range(count):
            x = -width * 0.27 + index * width * 0.27
            _cube(cube, "bay_door", (x, -depth / 2 - 0.08, 0.66), (width * 0.2, 0.14, 1.28), mats["metal"])
    if "hose_tower" in equipment:
        _cube(cube, "hose_tower", (width * 0.34, depth * 0.18, height * 0.75), (0.72, 0.72, height * 1.5), mats["brick"])

    dressing = set(spec["civicDressing"])
    if "steps" in dressing or "entrance_canopy" in dressing:
        _cube(cube, "canopy_steps", (0, -depth / 2 - 0.34, 0.2), (1.35, 0.7, 0.22), mats["plaster"])
    if "clock" in dressing:
        sphere("clock_face", (0, -0.31, height + 1.05), 0.25, mats["window"])
    if "awnings" in dressing:
        for x in (-width * 0.27, width * 0.27):
            _cube(cube, "awning", (x, -depth / 2 - 0.22, 0.86), (width * 0.3, 0.5, 0.12), mats["accent"], rotation=(math.radians(12), 0, 0))
    if "blue_lamps" in dressing or "red_lamps" in dressing:
        lamp_mat = mats["accent"] if "blue_lamps" in dressing else mats["brick"]
        for x in (-0.52, 0.52):
            sphere("service_lamp", (x, -depth / 2 - 0.16, 1.25), 0.12, lamp_mat)
    if "secure_gate" in dressing:
        for x in (-0.34, 0.34):
            _cube(cube, "secure_post", (x, -depth / 2 - 0.2, 0.58), (0.1, 0.1, 1.16), mats["metal"])
        for z in (0.28, 0.86):
            _cube(cube, "secure_bar", (0, -depth / 2 - 0.2, z), (0.78, 0.1, 0.08), mats["metal"])

    # Señalética abstracta: forma reproducible, sin texto copiado ni dependencia tipográfica.
    if spec["signage"] == "medical_cross":
        z = min(height - 0.25, 1.62)
        _cube(cube, "medical_cross_h", (0, -depth / 2 - 0.16, z), (0.82, 0.12, 0.22), mats["accent"])
        _cube(cube, "medical_cross_v", (0, -depth / 2 - 0.17, z), (0.22, 0.12, 0.82), mats["accent"])
    elif spec["signage"] == "shield":
        _cube(cube, "shield_field", (0, -depth / 2 - 0.16, min(height - 0.25, 1.66)),
              (0.58, 0.12, 0.72), mats["accent"], rotation=(0, 0, math.radians(45)))
    elif spec["signage"] != "none":
        sign_width = 0.62 if spec["signage"] in ("medical_cross", "shield") else min(2.1, width * 0.55)
        _cube(cube, "signage", (0, -depth / 2 - 0.13, min(height - 0.25, 1.58)),
              (sign_width, 0.12, 0.28), mats["accent"])

    if state in ("damaged", "burning"):
        _cube(cube, "soot_panel", (-width * 0.23, -depth / 2 - 0.18, height * 0.62),
              (width * 0.3, 0.1, height * 0.42), mats["metal"], rotation=(0, 0, math.radians(-7)))
        for index, x in enumerate((-0.72, -0.18, 0.48)):
            _cube(cube, f"debris_{index}", (x, -depth * 0.58, 0.12 + index * 0.025),
                  (0.42, 0.34, 0.2), mats["brick" if index % 2 == 0 else "plaster"],
                  rotation=(0, 0, math.radians(index * 19)))
    if state == "burning":
        for index, (x, z) in enumerate(((-width * 0.22, height * 0.72), (width * 0.18, height * 0.9))):
            sphere(f"flame_{index}", (x, -depth * 0.34, z), 0.32, mats["flame"])
            sphere(f"smoke_{index}", (x + 0.12, -depth * 0.28, z + 0.7), 0.38, mats["smoke"])

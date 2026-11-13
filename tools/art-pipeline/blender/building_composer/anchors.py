"""Anclajes: del marco de colocación medido al marco del edificio.

El marco del compositor tiene el origen en el centro de la huella a nivel de suelo (§18: es justo el
punto que `pivot_from_origin` proyecta sobre la imagen). El frente da a -Y porque el rig canónico
pone la cámara en azimuth 45°, es decir en (+X, -Y, +Z): las dos caras visibles son el frente y el
costado derecho, y cualquier otro reparto dibujaría el edificio de espaldas.
"""

SIDE_OUTWARD_DEGREES = {"front": 270, "rear": 90, "left": 180, "right": 0}
# `symmetric-Y` no tiene cara, así que su "frontAxis local" es una convención de encuadre, no una
# medición: se le asigna la del frente (-Y) para que el giro salga 0°/180° en las bandas frontal y
# posterior y 90°/270° en las laterales. Con cualquier otro valor esas piezas (losas, cornisas de
# metal, hojas de puerta) rodarían 90° y desarrollarían su canto de 20 cm en la banda de 2 m.
MODULE_FRONT_DEGREES = {"+Y": 90, "-Y": 270, "symmetric-Y": 270}


def normalize_angle(angle):
    return angle % 360


def rotation_for(module, side):
    """Giro que pone la cara exterior medida del módulo mirando a la calle de esa cara."""
    if side not in SIDE_OUTWARD_DEGREES:
        raise ValueError(f"lado inexistente: {side}")
    local = MODULE_FRONT_DEGREES.get(module.front_axis)
    if local is None:
        raise ValueError(f"{module.id}: frontAxis {module.front_axis} sin convención conocida")
    # Un módulo simétrico en Y no tiene cara: su giro lo fija la convención de arriba, no la medición.
    angle = normalize_angle(SIDE_OUTWARD_DEGREES[side] - local)
    if angle not in module.rotations:
        raise ValueError(
            f"{module.id} no puede mirar a {side}: necesitaría {angle}° y sólo admite {module.rotations}"
        )
    return angle


def rotate_box(box, rotation_degrees):
    """Caja del marco de colocación girada 0/90/180/270° (rotación ortogonal → sigue siendo AABB).

    El giro es alrededor de Z, así que la cota vertical pasa tal cual: perderla aquí mezclaba el
    ancho con la altura y dejaba `placed_bounds` sin eje Z.
    """
    x, y, z = box["x"], box["y"], box["z"]
    if rotation_degrees == 0:
        return {"x": dict(x), "y": dict(y), "z": dict(z)}
    if rotation_degrees == 90:
        return {"x": {"min": -y["max"], "max": -y["min"]}, "y": dict(x), "z": dict(z)}
    if rotation_degrees == 180:
        return {"x": {"min": -x["max"], "max": -x["min"]}, "y": {"min": -y["max"], "max": -y["min"]}, "z": dict(z)}
    if rotation_degrees == 270:
        return {"x": dict(y), "y": {"min": -x["max"], "max": -x["min"]}, "z": dict(z)}
    raise ValueError(f"rotación no ortogonal: {rotation_degrees}")


def placed_bounds(module, rotation_degrees, position):
    rotated = rotate_box(module.placement_bounds, rotation_degrees)
    return {
        "x": {"min": rotated["x"]["min"] + position[0], "max": rotated["x"]["max"] + position[0]},
        "y": {"min": rotated["y"]["min"] + position[1], "max": rotated["y"]["max"] + position[1]},
        "z": {"min": rotated["z"]["min"] + position[2], "max": rotated["z"]["max"] + position[2]},
    }


def inward_offset(module, rotation_degrees, side):
    """Lo que hay que sumar al plano de fachada para que el centro del módulo quede dentro.

    Las bandas se apoyan en el plano de la fachada y crecen hacia dentro: el módulo queda siempre
    contenido en el volumen y el único saliente que puede sacar la huella del solar es el que nace
    volado a más de un metro de altura (cornisas, aleros, toldos), que §17 permite y §31 informa.
    """
    rotated = rotate_box(module.placement_bounds, rotation_degrees)
    if side == "front":
        return -rotated["y"]["min"]
    if side == "rear":
        return -rotated["y"]["max"]
    if side == "left":
        return -rotated["x"]["min"]
    return -rotated["x"]["max"]


def place_on_face(module, side, along, face_line, z):
    """Coloca un módulo de fachada con su cara exterior sobre `face_line`.

    `along` es el centro del hueco en el eje de la banda; `face_line` es el plano de fachada en el
    eje normal (frente: y mínima; rear: y máxima; left: x mínima; right: x máxima).
    """
    angle = rotation_for(module, side)
    offset = inward_offset(module, angle, side)
    if side in ("front", "rear"):
        position = (along, face_line + offset, z)
    else:
        position = (face_line + offset, along, z)
    return angle, [round(value, 3) for value in position]


def union(boxes):
    if not boxes:
        return None
    result = {"x": dict(boxes[0]["x"]), "y": dict(boxes[0]["y"]), "z": dict(boxes[0]["z"])}
    for box in boxes[1:]:
        for axis in ("x", "y", "z"):
            result[axis]["min"] = min(result[axis]["min"], box[axis]["min"])
            result[axis]["max"] = max(result[axis]["max"], box[axis]["max"])
    return result


def size_of(box):
    return {
        axis: round(box[axis]["max"] - box[axis]["min"], 3) for axis in ("x", "y", "z")
    }

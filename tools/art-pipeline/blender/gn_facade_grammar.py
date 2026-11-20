"""Gramática de fachada paramétrica en Geometry Nodes (D-111 §3).

Blender construye cada crujía con un modificador Geometry Nodes. La repetición arquitectónica
(dentillos de cornisa, balaustres de barandilla, montantes de escaparate, travesaños de hoja
balconera) se resuelve con Instance on Points sobre mallas generadas, no con un bucle Python que
enlace objetos: esa es justamente la diferencia que este módulo existe para medir.

El archivo NO decide recetas, semillas de composición, validación de huella ni procedencia de
publicación: eso sigue siendo autoridad del Building Composer. Aquí sólo separamos parámetros de
geometría; lo que sale es un módulo medible más de la biblioteca.

Convención de marco (compatível con `module_catalog`):
  X = ancho de crujía, centrado en 0.
  Y = profundidad; la pared ocupa [-T/2, +T/2] y la calle mira a +Y.
  Z = 0 en el nivel de la losa.

Uso:
  blender -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- \
      --out-dir=/tmp/gn --seed=7 --parts=window_bay,shopfront_bay,plinth,cornice,balcony_door_bay
"""

import json
import os
import sys
import time
from pathlib import Path

import bpy

GROUP_PREFIX = "D111_Facade"

# ---------------------------------------------------------------------------
# Vocabulario de partes. Comparten constructor y rejilla (crujía 2 m, planta 3 m)
# para que una regla escrita para `row_house` sirva a `mixed_tenement` sin tocar
# el núcleo del Composer.
# ---------------------------------------------------------------------------

PARTS = {
    "window_bay": {
        "role": "window_bay",
        "category": "window",
        "objectName": "GnWindowBay",
        "note": "crujía residencial de 2 m con hueco calado, marco en relieve, alféizar saliente, "
        "dintel, reveco interior y montantes generados por Geometry Nodes",
    },
    "shopfront_bay": {
        "role": "shopfront",
        "category": "facade",
        "objectName": "GnShopfrontBay",
        "note": "crujía comercial de planta baja con escaparate de 1,44 × 2,00 m, pilastras, frente "
        "de rótulo y estribera de madera; hueco a escala de tienda, no de vivienda",
    },
    "plinth": {
        "role": "wainscot",
        "category": "facade",
        "objectName": "GnPlinth",
        "note": "zócalo de 2 m con soclo saliente, labio superior y juntas de sillar instanciadas",
    },
    "cornice": {
        "role": "cornice",
        "category": "facade",
        "objectName": "GnCornice",
        "note": "cornisa de 2 m con cama, dentillos instanciados, corona volada, friso y sima",
    },
    "balcony_door_bay": {
        "role": "balcony",
        "category": "balcony",
        "objectName": "GnBalconyDoorBay",
        "note": "balcón con puerta balconera doble acristalada, trasdós, losa volada con canto "
        "retranqueado y barandilla con balaustres instanciados; el balcón nace de la puerta, no flota",
    },
}

# Paleta plana. `complete_style_reach` (building_composer/scene.py:277) trata automáticamente
# cualquier material plano sin regla de nombre, así que estos colores entran en la escalera Graphic
# Civic sin tocar la capa de estilo. El matiz importa: azul de hueco (banda
# `window_blue_to_dark_glass`), ocre de ladrillo, claro de piedra.
MATERIALS = {
    "wall": {"name": "gn_brick_wall", "color": (0.42, 0.17, 0.12), "roughness": 0.86},
    "render": {"name": "gn_stone_trim", "color": (0.72, 0.68, 0.58), "roughness": 0.74},
    "metal": {"name": "gn_painted_metal", "color": (0.16, 0.24, 0.28), "roughness": 0.55},
    "glass": {"name": "gn_dark_glass", "color": (0.07, 0.13, 0.22), "roughness": 0.14},
    "shop": {"name": "gn_shopfront_wood", "color": (0.24, 0.14, 0.09), "roughness": 0.68},
}


def part_parameters(part, seed):
    """Ritmo del hueco y número de piezas instanciadas, derivados de la semilla."""
    cycle = ((seed * 2654435761) % 997) / 997.0
    table = {
        "window_bay": {
            "bayWidth": 2.0,
            "bayHeight": 3.0,
            "wallThickness": 0.20,
            "openingWidth": 1.05,
            "openingHeight": 1.45,
            "sillHeight": 0.95,
            "frameWidth": 0.085,
            "glassRecess": 0.085,
            "mullions": 2 if seed % 2 else 1,
            "transom": 1,
        },
        "shopfront_bay": {
            "bayWidth": 2.0,
            "bayHeight": 3.0,
            "wallThickness": 0.22,
            "openingWidth": 1.44,
            "openingHeight": 2.00,
            "sillHeight": 0.42,
            "pilasterWidth": 0.28,
            "fasciaHeight": 0.30,
            "mullions": 2,
        },
        "plinth": {
            "bayWidth": 2.0,
            "bayHeight": 0.90,
            "wallThickness": 0.30,
            "socleProjection": 0.06,
            "joints": 3,
        },
        "cornice": {
            "bayWidth": 2.0,
            "bayHeight": 0.55,
            "wallThickness": 0.26,
            "coronaProjection": 0.21,
            "dentils": 5 + int(round(cycle * 3)),
        },
        "balcony_door_bay": {
            "bayWidth": 2.0,
            # Altura de forjado completo: elComposer encaja los huecos de una banda piso a piso, así
            # que un módulo de 2,45 m dejaría una franja ciega de 55 cm sobre el dintel. El muro por
            # encima del dintel cierra el hueco hasta la línea de forjado.
            "bayHeight": 3.0,
            "wallThickness": 0.10,
            "slabHeight": 0.12,
            "openingWidth": 1.10,
            "openingHeight": 2.10,
            "frameWidth": 0.10,
            "balconyProjection": 0.72,
            "railingHeight": 0.92,
            "balusters": 9 + int(round(cycle * 4)),
            "leafBars": 3,
        },
    }
    return table[part]


# ---------------------------------------------------------------------------
# Constructor del árbol Geometry Nodes
# ---------------------------------------------------------------------------


class GrammarTree:
    """Envoltorio de construcción: los helpers devuelven *sockets* de geometría, no nodos."""

    def __init__(self, name):
        tree = bpy.data.node_groups.new(name, "GeometryNodeTree")
        self.tree = tree
        self.nodes = tree.nodes
        self.links = tree.links
        tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        self.output = self._node("NodeGroupOutput")
        self._group_input = None
        self.live_inputs = set()

    def _node(self, bl_type, location=(0.0, 0.0)):
        node = self.nodes.new(bl_type)
        node.location = location
        return node

    def socket(self, name, socket_type, default):
        io = self.tree.interface.new_socket(name, in_out="INPUT", socket_type=socket_type)
        io.default_value = default
        return name

    def input(self, name):
        """Salida del nodo Group Input correspondiente a la entrada de grupo `name`."""
        if self._group_input is None:
            self._group_input = self._node("NodeGroupInput", (-2400.0, 0.0))
        for item in self._group_input.outputs:
            if item.name == name:
                self.live_inputs.add(name)
                return item
        raise KeyError(f"el grupo {self.tree.name} no declara la entrada {name!r}")

    def declare_inputs(self, params):
        for name, value in params.items():
            if isinstance(value, int):
                self.socket(name, "NodeSocketInt", int(value))
            else:
                self.socket(name, "NodeSocketFloat", float(value))

    # -- primitivas --------------------------------------------------------

    def box(self, size, origin):
        """Cubo centrado en X/Y e instalado en `origin` (centro del volumen)."""
        cube = self._node("GeometryNodeMeshCube")
        cube.inputs["Size"].default_value = tuple(max(float(v), 1e-4) for v in size)
        move = self._node("GeometryNodeTransform")
        self.links.new(cube.outputs["Mesh"], move.inputs["Geometry"])
        move.inputs["Translation"].default_value = tuple(float(v) for v in origin)
        return move.outputs["Geometry"]

    def frame_rect(self, outer_w, outer_h, bar, depth, centre_z, y):
        """Marco de cuatro piezas alrededor de un hueco `outer_w × outer_h`."""
        half_w, half_h = outer_w / 2.0, outer_h / 2.0
        return [
            self.box((outer_w, depth, bar), (0.0, y, centre_z - half_h + bar / 2.0)),
            self.box((outer_w, depth, bar), (0.0, y, centre_z + half_h - bar / 2.0)),
            self.box((bar, depth, max(outer_h - 2 * bar, 1e-4)), (-half_w + bar / 2.0, y, centre_z)),
            self.box((bar, depth, max(outer_h - 2 * bar, 1e-4)), (half_w - bar / 2.0, y, centre_z)),
        ]

    def points_row(self, width, count, location):
        """Fila de `count` puntos que reparten `width` en tramos iguales.

        `count` puede ser el *nombre* de una entrada de grupo: entonces el reparto se calcula dentro
        del árbol (paso = width/(count+1), primer punto = -width/2 + paso), así que cambiar el número
        de montantes, dentillos o balaustres es un parámetro vivo del módulo y no una regeneración
        en Python. Con entero, el mismo reparto se resuelve en Python y queda grabado en la malla.
        """
        line = self._node("GeometryNodeMeshLine")
        if isinstance(count, str):
            source = self.input(count)
            self.links.new(source, line.inputs["Count"])
            plus = self._math("ADD", 1.0)
            self.links.new(source, plus.inputs[0])
            step = self._math("DIVIDE")
            step.inputs[0].default_value = float(width)
            self.links.new(plus.outputs[0], step.inputs[1])
            first = self._math("ADD")
            first.inputs[1].default_value = float(location[0]) - float(width) / 2.0
            self.links.new(step.outputs[0], first.inputs[0])
            start = self._node("ShaderNodeCombineXYZ")
            start.inputs["Y"].default_value = float(location[1])
            start.inputs["Z"].default_value = float(location[2])
            self.links.new(first.outputs[0], start.inputs["X"])
            self.links.new(start.outputs["Vector"], line.inputs["Start Location"])
            offset = self._node("ShaderNodeCombineXYZ")
            self.links.new(step.outputs[0], offset.inputs["X"])
            self.links.new(offset.outputs["Vector"], line.inputs["Offset"])
        else:
            count = max(int(count), 1)
            step = float(width) / (count + 1)
            line.inputs["Count"].default_value = count
            line.inputs["Start Location"].default_value = (
                float(location[0]) - float(width) / 2.0 + step,
                float(location[1]),
                float(location[2]),
            )
            line.inputs["Offset"].default_value = (step, 0.0, 0.0)
        return line.outputs["Mesh"]

    def _math(self, operation, value=None):
        node = self._node("ShaderNodeMath")
        node.operation = operation
        if value is not None:
            node.inputs[1].default_value = float(value)
        return node

    def instance_on_row(self, proto_socket, points_socket, rotation=None):
        inst = self._node("GeometryNodeInstanceOnPoints")
        self.links.new(points_socket, inst.inputs["Points"])
        self.links.new(proto_socket, inst.inputs["Instance"])
        if rotation is not None:
            inst.inputs["Rotation"].default_value = tuple(float(v) for v in rotation)
        realize = self._node("GeometryNodeRealizeInstances")
        self.links.new(inst.outputs["Instances"], realize.inputs["Geometry"])
        return realize.outputs["Geometry"]

    def join(self, sockets):
        node = self._node("GeometryNodeJoinGeometry")
        for socket in reversed(list(sockets)):
            self.links.new(socket, node.inputs["Geometry"])
        return node.outputs["Geometry"]

    def with_material(self, geometry_socket, material_name):
        node = self._node("GeometryNodeSetMaterial")
        node.inputs["Material"].default_value = bpy.data.materials[material_name]
        self.links.new(geometry_socket, node.inputs["Geometry"])
        return node.outputs["Geometry"]

    def finish(self, geometry_socket):
        self.links.new(geometry_socket, self.output.inputs["Geometry"])


# ---------------------------------------------------------------------------
# Las cinco partes
# ---------------------------------------------------------------------------


def _build_window_bay(params):
    tree = GrammarTree(f"{GROUP_PREFIX}_Window_Bay")
    tree.declare_inputs(params)
    t = params["wallThickness"]
    h = params["bayHeight"]
    ow, oh = params["openingWidth"], params["openingHeight"]
    sill, bar = params["sillHeight"], params["frameWidth"]
    recess = params["glassRecess"]
    front = t / 2.0
    half_w = params["bayWidth"] / 2.0
    centre_z = sill + oh / 2.0
    pier_w = half_w - ow / 2.0
    head_h = h - (centre_z + oh / 2.0)

    wall = tree.join(
        [
            tree.box((pier_w, t, h), (-half_w + pier_w / 2.0, 0.0, h / 2.0)),
            tree.box((pier_w, t, h), (half_w - pier_w / 2.0, 0.0, h / 2.0)),
            tree.box((ow, t, sill), (0.0, 0.0, sill / 2.0)),
            tree.box((ow, t, head_h), (0.0, 0.0, centre_z + oh / 2.0 + head_h / 2.0)),
        ]
    )
    # El hueco es un agujero de verdad a través de los 0,20 m de muro: la profundidad se ve porque la
    # luz incide sobre las cuatro caras del reveco, no porque alguien pinte un marco en el albedo.
    stone_parts = tree.frame_rect(ow, oh, 0.035, t - 0.06, centre_z, 0.0)
    # Carpintería en relieve sobre la cara exterior, no embutida a ras del paño.
    stone_parts += tree.frame_rect(
        ow + 2 * bar, oh + 2 * bar, bar, bar + 0.02, centre_z, front + bar / 2.0 - 0.012
    )
    stone_parts += [
        tree.box((ow + 2 * bar + 0.16, t + 0.20, 0.075), (0.0, 0.05, sill - 0.037)),
        tree.box((ow + 2 * bar + 0.22, t + 0.05, 0.17), (0.0, 0.02, centre_z + oh / 2.0 + bar + 0.05)),
    ]
    glass_y = front - recess
    mullion_pts = tree.points_row(ow, "mullions", (0.0, glass_y + 0.03, centre_z))
    stone_parts.append(
        tree.instance_on_row(tree.box((0.045, 0.05, oh - 0.06), (0.0, 0.0, 0.0)), mullion_pts)
    )
    if params["transom"]:
        stone_parts.append(
            tree.box((ow - 0.06, 0.05, 0.045), (0.0, glass_y + 0.03, centre_z + oh * 0.18))
        )

    body = tree.with_material(wall, MATERIALS["wall"]["name"])
    stone = tree.with_material(tree.join(stone_parts), MATERIALS["render"]["name"])
    pane = tree.with_material(tree.box((ow - 0.06, 0.02, oh - 0.06), (0.0, glass_y, centre_z)), MATERIALS["glass"]["name"])
    tree.finish(tree.join([body, stone, pane]))
    return tree


def _build_shopfront_bay(params):
    tree = GrammarTree(f"{GROUP_PREFIX}_Shopfront_Bay")
    tree.declare_inputs(params)
    t = params["wallThickness"]
    h = params["bayHeight"]
    ow, oh = params["openingWidth"], params["openingHeight"]
    sill, pil = params["sillHeight"], params["pilasterWidth"]
    front = t / 2.0
    half_w = params["bayWidth"] / 2.0
    inner = half_w - pil
    centre_z = sill + oh / 2.0
    top = sill + oh

    piers = tree.join(
        [
            tree.box((pil, t + 0.07, h), (-(half_w - pil / 2.0), 0.035, h / 2.0)),
            tree.box((pil, t + 0.07, h), (half_w - pil / 2.0, 0.035, h / 2.0)),
        ]
    )
    spandrel = tree.box((2 * inner, t, h - top - params["fasciaHeight"]), (0.0, 0.0, (top + params["fasciaHeight"] + h) / 2.0))
    under = tree.box((ow, t, sill), (0.0, 0.0, sill / 2.0))
    # `inner` mide exactamente ow/2: el hueco comercial va DE pilastra A pilastra, como un
    # escaparate real. No queda paño lateral que rellenar, así que el fondo es un vidrio corrido
    # (interior en penumbra) y no un agujero transparente.
    backdrop = tree.box((ow, 0.02, oh), (0.0, -front + 0.02, centre_z))
    fascia = tree.box((2 * inner + 0.12, t + 0.18, params["fasciaHeight"]), (0.0, 0.07, top + params["fasciaHeight"] / 2.0))
    lintel = tree.box((ow + 0.16, t + 0.09, 0.14), (0.0, 0.03, top + 0.05))
    stallriser = tree.box((ow, t + 0.06, 0.12), (0.0, 0.025, sill - 0.06))
    glass = tree.box((ow - 0.08, 0.02, oh - 0.10), (0.0, front - 0.10, centre_z + 0.02))
    bar_pts = tree.points_row(ow, "mullions", (0.0, front - 0.075, centre_z + 0.02))
    bars = tree.instance_on_row(tree.box((0.06, 0.05, oh - 0.10), (0.0, 0.0, 0.0)), bar_pts)
    transom = tree.box((ow - 0.08, 0.05, 0.06), (0.0, front - 0.075, centre_z + oh * 0.32))
    surround = tree.join(tree.frame_rect(ow + 0.12, oh + 0.12, 0.06, 0.09, centre_z, front + 0.03))

    brick = tree.with_material(tree.join([spandrel, under]), MATERIALS["wall"]["name"])
    stone = tree.with_material(tree.join([piers, fascia, lintel, surround, bars, transom]), MATERIALS["render"]["name"])
    wood = tree.with_material(stallriser, MATERIALS["shop"]["name"])
    pane = tree.with_material(tree.join([glass, backdrop]), MATERIALS["glass"]["name"])
    tree.finish(tree.join([brick, stone, wood, pane]))
    return tree


def _build_plinth(params):
    tree = GrammarTree(f"{GROUP_PREFIX}_Plinth")
    tree.declare_inputs(params)
    t = params["wallThickness"]
    h = params["bayHeight"]
    body = tree.box((params["bayWidth"], t, h - 0.17), (0.0, 0.0, (h - 0.17) / 2.0))
    socle = tree.box((params["bayWidth"], t + params["socleProjection"] * 2, 0.10), (0.0, 0.0, 0.05))
    lip = tree.box((params["bayWidth"], t + 0.08, 0.07), (0.0, 0.02, h - 0.035))
    pts = tree.points_row(params["bayWidth"] - 0.4, "joints", (0.0, t / 2.0 + 0.006, (h - 0.17) / 2.0))
    joints = tree.instance_on_row(tree.box((0.028, 0.014, h - 0.24), (0.0, 0.0, 0.0)), pts)
    stone = tree.with_material(tree.join([body, socle, lip, joints]), MATERIALS["render"]["name"])
    tree.finish(stone)
    return tree


def _build_cornice(params):
    tree = GrammarTree(f"{GROUP_PREFIX}_Cornice")
    tree.declare_inputs(params)
    t = params["wallThickness"]
    proj = params["coronaProjection"]
    w = params["bayWidth"]
    bed = tree.box((w, t, 0.10), (0.0, 0.0, 0.05))
    dentil_pts = tree.points_row(1.72, "dentils", (0.0, t / 2.0 + 0.02, 0.165))
    dentils = tree.instance_on_row(tree.box((0.10, proj + 0.02, 0.13), (0.0, 0.0, 0.0)), dentil_pts)
    corona = tree.box((w, t + proj * 2, 0.15), (0.0, proj / 2.0, 0.315))
    fascia = tree.box((w, t + 0.04, 0.13), (0.0, 0.01, 0.455))
    cyma = tree.box((w, t + 0.12, 0.09), (0.0, 0.03, 0.505))
    stone = tree.with_material(tree.join([bed, dentils, corona, fascia, cyma]), MATERIALS["render"]["name"])
    tree.finish(stone)
    return tree


def _build_balcony_door_bay(params):
    tree = GrammarTree(f"{GROUP_PREFIX}_Balcony_Door_Bay")
    tree.declare_inputs(params)
    t = params["wallThickness"]
    h = params["bayHeight"]
    ow, oh = params["openingWidth"], params["openingHeight"]
    bar = params["frameWidth"]
    proj = params["balconyProjection"]
    rail_h = params["railingHeight"]
    slab = params["slabHeight"]
    front = t / 2.0
    # El umbral del balcón es el origen Z del módulo: `module_catalog` exige cota mínima 0 y el
    # Composer apoya el módulo en la línea de forjado del nivel. Con las ménsulas colgando por
    # debajo, la losa subía 15 cm y la puerta quedaba flotando; así, el dintel cierra a 2,44 m y
    # el hueco arranca en el suelo.
    centre_z = slab + oh / 2.0
    w = params["bayWidth"]
    pier_w = (w - ow) / 2.0
    head_h = h - (slab + oh)

    # Muro con hueco de puerta de verdad, no panel sólido delante: por eso el balcón puede leerse
    # como salida y no como adorno pegado a la fachada.
    back = tree.join(
        [
            tree.box((pier_w, t, h), (-w / 2.0 + pier_w / 2.0, -0.05, h / 2.0)),
            tree.box((pier_w, t, h), (w / 2.0 - pier_w / 2.0, -0.05, h / 2.0)),
            tree.box((ow, t, slab), (0.0, -0.05, slab / 2.0)),
            tree.box((ow, t, head_h), (0.0, -0.05, slab + oh + head_h / 2.0)),
        ]
    )
    surround = tree.join(tree.frame_rect(ow + 2 * bar, oh + 2 * bar, bar, 0.07, centre_z, front + bar / 2.0))
    transom_band = tree.box((ow + 2 * bar, 0.06, 0.20), (0.0, front + 0.02, slab + oh + 0.10))
    head = tree.box((ow + 2 * bar + 0.10, 0.10, 0.12), (0.0, front + 0.03, slab + oh + 0.16))
    meeting = tree.box((0.05, 0.06, oh - 0.06), (0.0, front + 0.02, centre_z))

    leaf_w = (ow - 0.06) / 2.0
    leaves, panes = [], []
    for sign in (-1, 1):
        cx = sign * (leaf_w / 2.0 + 0.015)
        leaves += tree.frame_rect(leaf_w, oh - 0.06, 0.05, 0.035, centre_z, front + 0.005)
        bars = tree.points_row(leaf_w - 0.06, "leafBars", (cx, front + 0.028, centre_z + 0.02))
        leaves.append(tree.instance_on_row(tree.box((0.028, 0.032, oh - 0.16), (0.0, 0.0, 0.0)), bars))
        panes.append(tree.box((leaf_w - 0.12, 0.02, oh - 0.16), (cx, front - 0.005, centre_z + 0.02)))
    panes.append(tree.box((ow - 0.02, 0.02, oh - 0.02), (0.0, -front + 0.01, centre_z)))

    # Losa en dos bandas: el canto inferior retranqueado da la sombra que una ménsula suelta daría,
    # sin sacar geometría por debajo del nivel de forjado.
    slab_lower = tree.box((1.56, proj - 0.09, 0.05), (0.0, front + (proj - 0.09) / 2.0 - 0.02, 0.025))
    slab_upper = tree.box((1.56, proj, slab - 0.05), (0.0, front + proj / 2.0 - 0.02, 0.05 + (slab - 0.05) / 2.0))
    balusters = tree.instance_on_row(
        tree.box((0.045, 0.045, rail_h), (0.0, 0.0, 0.0)),
        tree.points_row(1.50, "balusters", (0.0, front + proj - 0.075, slab + rail_h / 2.0)),
    )
    handrail = tree.box((1.56, 0.09, 0.06), (0.0, front + proj - 0.075, slab + rail_h + 0.03))
    rail_base = tree.box((1.56, 0.09, 0.06), (0.0, front + proj - 0.075, slab + 0.03))
    side_rails = tree.join(
        [
            tree.box((0.075, proj - 0.10, rail_h), (-0.74, front + proj / 2.0 - 0.02, slab + rail_h / 2.0)),
            tree.box((0.075, proj - 0.10, rail_h), (0.74, front + proj / 2.0 - 0.02, slab + rail_h / 2.0)),
        ]
    )

    shell = tree.with_material(
        tree.join([back, surround, head, transom_band, meeting, slab_lower, slab_upper]), MATERIALS["render"]["name"]
    )
    joinery = tree.with_material(tree.join(leaves), MATERIALS["shop"]["name"])
    rail = tree.with_material(tree.join([balusters, handrail, rail_base, side_rails]), MATERIALS["metal"]["name"])
    pane = tree.with_material(tree.join(panes), MATERIALS["glass"]["name"])
    tree.finish(tree.join([shell, joinery, rail, pane]))
    return tree


BUILDERS = {
    "window_bay": _build_window_bay,
    "shopfront_bay": _build_shopfront_bay,
    "plinth": _build_plinth,
    "cornice": _build_cornice,
    "balcony_door_bay": _build_balcony_door_bay,
}


# ---------------------------------------------------------------------------
# Evaluación y exportación
# ---------------------------------------------------------------------------


def ensure_materials():
    for spec in MATERIALS.values():
        existing = bpy.data.materials.get(spec["name"])
        if existing:
            bpy.data.materials.remove(existing)
        material = bpy.data.materials.new(spec["name"])
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*spec["color"], 1.0)
        bsdf.inputs["Roughness"].default_value = spec["roughness"]
        bsdf.inputs["Metallic"].default_value = 0.0


def _socket_item(tree, socket_name):
    for item in tree.interface.items_tree:
        if item.item_type == "SOCKET" and item.in_out == "INPUT" and item.name == socket_name:
            return item
    return None


def set_param(modifier, tree, name, value):
    item = _socket_item(tree, name)
    if item is None:
        raise RuntimeError(f"el grupo {tree.name} no expone el parámetro {name!r}")
    # Blender 5.2 retiró el diccionario de ID-properties del modificador y expone
    # `modifier.properties.inputs[identifier]` como IDPropertyGroup. Escribir el escalar directo
    # (`inputs[identifier] = 5`) no lanza nada pero se ignora: la evaluación sigue usando el default
    # de la interfaz. El valor vivo de la instancia es la clave "value" del grupo, y su tipo debe
    # respetarse (una ranura float rechaza un int y viceversa).
    slot = modifier.properties.inputs[item.identifier]
    current = slot["value"]
    cast = type(current) if isinstance(current, (int, float)) else (
        int if isinstance(value, int) and not isinstance(value, bool) else float
    )
    slot["value"] = cast(value)
    modifier.id_data.update_tag()


def set_params(modifier, tree, params):
    for name, value in params.items():
        set_param(modifier, tree, name, value)


def parametric_host(tree, params, object_name):
    """Malla vacía + modificador Geometry Nodes. El .blend guarda ESTOS objetos, no una copia horneada.

    Así la pieza sigue siendo editable por parámetros desde el Editor, que es lo que la hace
    reutilizable para otra familia sin volver a escribir Python.
    """
    mesh = bpy.data.meshes.new(f"{object_name}_source")
    host = bpy.data.objects.new(object_name, mesh)
    bpy.context.collection.objects.link(host)
    modifier = host.modifiers.new("facade", "NODES")
    modifier.node_group = tree.tree
    set_params(modifier, tree.tree, params)
    return host, modifier


def measured_mesh(host):
    """Copia realizada del modificador, sólo para medir; la exportación usa `export_apply`.

    Se copian los índices de material: `Set Material` decide la paleta dentro del árbol y perderla
    aquí dejaría el módulo del catálogo sin colores.
    """
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    source = bpy.data.meshes.new_from_object(host.evaluated_get(depsgraph))
    result = bpy.data.meshes.new(f"{host.name}_measured")
    for material in source.materials:
        result.materials.append(material)
    result.from_pydata([v.co[:] for v in source.vertices], [], [f.vertices[:] for f in source.polygons])
    for index, polygon in enumerate(source.polygons):
        result.polygons[index].material_index = polygon.material_index
    result.update()
    bpy.data.meshes.remove(source)
    return result


def bounds_of(mesh):
    if not mesh.vertices:
        return None
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    return {
        "x": {"min": round(min(xs), 4), "max": round(max(xs), 4)},
        "y": {"min": round(min(ys), 4), "max": round(max(ys), 4)},
        "z": {"min": round(min(zs), 4), "max": round(max(zs), 4)},
    }


def mesh_stats(mesh):
    return {
        "vertices": len(mesh.vertices),
        "triangles": sum(len(p.vertices) - 2 for p in mesh.polygons),
        "boundsMeters": bounds_of(mesh),
    }


def repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


# Repetición arquitectónica que se puede ordenar sin reprogramar: el valor cambia el parámetro vivo
# del árbol y se mide el coste. Es la evidencia de §3 de que Geometry Nodes aporta algo real.
PROBES = {
    "window_bay": ("mullions", (1, 2, 3)),
    "cornice": ("dentils", (4, 8, 12)),
    "balcony_door_bay": ("balusters", (6, 11, 16)),
}


def generate(parts=None, seed=7, out_dir=None, report_dir=None):
    parts = parts or list(PARTS)
    out_dir = out_dir or os.path.join(repo_root(), "blender_artist", "sources", "original")
    report_dir = report_dir or out_dir
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(report_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ensure_materials()
    report = {
        "schemaVersion": 1,
        "generator": "tools/art-pipeline/blender/gn_facade_grammar.py",
        "blender": bpy.app.version_string,
        "construction": "objeto vacío + modificador Geometry Nodes evaluado en headless; el GLB se "
        "exporta con export_apply (instancias realizadas por el propio árbol) y el .blend conserva "
        "el modificador vivo",
        "seed": seed,
        "grid": {"bayMeters": 2.0, "floorHeightMeters": 3.0, "wallThicknessMeters": 0.20},
        "parts": [],
    }
    for part in parts:
        meta = PARTS[part]
        params = part_parameters(part, seed)
        started = time.perf_counter()
        tree = BUILDERS[part](params)
        setup_ms = round((time.perf_counter() - started) * 1000, 2)
        host, modifier = parametric_host(tree, params, meta["objectName"])
        started = time.perf_counter()
        mesh = measured_mesh(host)
        evaluate_ms = round((time.perf_counter() - started) * 1000, 2)
        if not mesh.polygons:
            raise RuntimeError(f"{part}: Geometry Nodes no produjo ninguna cara")
        glb = os.path.join(out_dir, f"gn_{part}_2m.glb")
        bpy.ops.object.select_all(action="DESELECT")
        host.select_set(True)
        bpy.context.view_layer.objects.active = host
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)
        entry = {
            "part": part,
            "moduleId": f"mod_gn_{part}_2m",
            "role": meta["role"],
            "category": meta["category"],
            "objectName": meta["objectName"],
            "note": meta["note"],
            "parameters": params,
            "nodeGroup": tree.tree.name,
            "nodeCount": len(tree.tree.nodes),
            "liveParameters": sorted(tree.live_inputs),
            "bakedParameters": sorted(name for name in params if name not in tree.live_inputs),
            "setupMs": setup_ms,
            "evaluateMs": evaluate_ms,
            "materials": sorted(m.name for m in mesh.materials if m),
            "glb": glb,
        }
        entry.update(mesh_stats(mesh))
        probe = PROBES.get(part)
        if probe:
            name, values = probe
            entry["parametricProbe"] = []
            for value in values:
                # Un solo modificador vivo: se cambia UN número y se re-mide. Es la evidencia de que
                # la repetición arquitectónica es un parámetro, no una regeneración desde Python.
                set_param(modifier, tree.tree, name, value)
                started = time.perf_counter()
                variant = measured_mesh(host)
                stats = mesh_stats(variant)
                stats["evaluateMs"] = round((time.perf_counter() - started) * 1000, 2)
                bpy.data.meshes.remove(variant)
                entry["parametricProbe"].append({"parameter": name, "value": value, **stats})
            set_param(modifier, tree.tree, name, params[name])
        bpy.data.meshes.remove(mesh)
        report["parts"].append(entry)
    blend = os.path.join(out_dir, "gn_facade_system.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    report["blend"] = blend
    path = os.path.join(report_dir, f"gn-facade-report-seed{seed}.json")
    Path(path).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    report["reportPath"] = path
    return report


def _cli(argv):
    parts, seed, out, report_dir = None, 7, None, None
    for token in argv:
        if token.startswith("--parts="):
            parts = token.split("=", 1)[1].split(",")
        elif token.startswith("--seed="):
            seed = int(token.split("=", 1)[1])
        elif token.startswith("--out-dir="):
            out = token.split("=", 1)[1]
        elif token.startswith("--report-dir="):
            report_dir = token.split("=", 1)[1]
    return parts, seed, out, report_dir


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parts, seed, out_dir, report_dir = _cli(argv)
    result = generate(parts, seed, out_dir, report_dir)
    for item in result["parts"]:
        span = item["boundsMeters"]
        print(
            f"{item['part']:18s} {item['triangles']:6d} tri  "
            f"x[{span['x']['min']},{span['x']['max']}] y[{span['y']['min']},{span['y']['max']}] "
            f"z[{span['z']['min']},{span['z']['max']}]  nodes={item['nodeCount']}  "
            f"{item['setupMs']}+{item['evaluateMs']}ms  {item['glb']}"
        )

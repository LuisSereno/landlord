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

Dos rejillas conviven en el mismo sistema (D-111.2 WP05): las partes residencial y comercial
trabajan sobre crujía de 2 m; las tres partes industriales, sobre 4 m, que es la celda completa
del Composer y la única donde un portón de muelle cabe de verdad. El tag de salida
(`gn_<parte>_<ancho>m.glb`) sale del parámetro `bayWidth` de cada parte, no de una constante, así
que ninguna de las dos rejillas pisa el id de la otra.

Uso:
  blender -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- \
      --out-dir=/tmp/gn --seed=7 --parts=window_bay,shopfront_bay,plinth,cornice,balcony_door_bay
  # D-111.2 WP05, las tres piezas de la nave (crujía 4 m):
  blender -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- \
      --out-dir=/tmp/gn --seed=7 --parts=metal_siding_bay,truck_dock_bay,metal_parapet
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
# el núcleo del Composer. Las tres partes de WP05 son la excepción medida: crujía de
# 4 m (una celda) y familia `industrial_heavy`, que ningún módulo residencial puede
# suplantar porque `allowedFamilies` lo impide en el catálogo.
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
        "note": "banda de planta baja de 3 m con zócalo de sillar saliente hasta 0,90 m, labio "
        "superior y juntas instanciadas: rellena el paso de forjado del rol que sustituye",
    },
    "cornice": {
        "role": "cornice",
        "category": "facade",
        "objectName": "GnCornice",
        "note": "pretil de 1 m con cornisa clásica leída de abajo arriba (cama, dentillos, corona "
        "volada, friso y sima): mismo alto y mismo vuelo que el módulo megakit que reemplaza",
    },
    "balcony_door_bay": {
        "role": "balcony",
        "category": "balcony",
        "objectName": "GnBalconyDoorBay",
        "note": "balcón con puerta balconera doble acristalada, trasdós, losa volada con canto "
        "retranqueado y barandilla con balaustres instanciados; el balcón nace de la puerta, no flota",
    },
    # --- D-111.2 WP05: familia industrial pesada, rejilla de 4 m (una celda) -------------
    "metal_siding_bay": {
        "role": "wall_panel",
        "category": "facade",
        "objectName": "GnMetalSidingBay",
        "note": "paño de chapa perfilada de nave de 4 m: nervaduras verticales instanciadas, traverse "
        "horizontales con goterón, solera de hormigón, coronación de alero, junta de nave en el canto "
        "y bajante en la línea de pilar; el origen autor queda en la cara posterior del muro y el "
        "plano exterior a 0,20 m, la misma convención de caja del panel megakit que sustituye",
    },
    "metal_window_bay": {
        "role": "window_bay",
        "category": "window",
        "objectName": "GnMetalWindowBay",
        "note": "crujía de chapa de 4 m con franja alta de vidrios de 2,60 × 0,75 m: hueco atravesado "
        "de verdad con reveco de cuatro caras, montantes instanciados, chapa de alféizar con goterón "
        "y nervaduras que se cortan en el hueco; autoría propia porque el único window_bay de 4 m del "
        "catálogo enlaza MI_RedBrick y asoma ladrillo en la paleta steel_cladding",
    },
    "truck_dock_bay": {
        "role": "dock_doorframe",
        "category": "door",
        "objectName": "GnTruckDockBay",
        "note": "portón de muelle de 4 m con hueco estructural de 2,60 × 2,74 m (camión rígido: caja "
        "2,50 × 2,60), hoja seccionada instanciada en lamas, guías de rollo, pletina de niveladora, "
        "puerta de personal de 0,85 × 2,05 integrada en la hoja y topes de goma salientes; sustituye "
        "el hueco abierto de 2 m que el control presentaba como muelle completo",
    },
    "metal_parapet": {
        "role": "cornice",
        "category": "facade",
        "objectName": "GnMetalParapet",
        "note": "pretil ciego de chapa de 4 m con capa plegada volada, junta de dilatación instanciada "
        "en la capa, banda de sombra bajo el canto y bajante alineado con el del paño: es la cubierta "
        "coherente que la opción `parapet` de la gramática declaraba con nombre pero sin módulo",
    },
}

# Paleta plana. D-111.2 WP01: estos colores **no se eligen a mano**, se derivan con
# `ext_lab/gn_palette.py` del atlas licenciado que usa el módulo de control de cada rol
# (T_RedBrick, T_Trim, T_MetalConcrete) y del `baseColorFactor` de MI_Glass en el glTF. Con el
# color de origen coincidente, el píxel lo reclama la misma banda de `externalTreatment`, así que
# recibe las mismas escalas en **todos** los moods: el A/B deja de comparar tratamientos de color y
# compara arquitectura. La evidencia numérica es
# `docs/art/graphics-capabilities/evidence/v2/gn/palette_day_civic.json`.
#
# Los nombres también se miden: `apply_external_treatment` trata los planos por nombre antes que
# nadie y esa rama no pasa por `global` ni por las bandas. El material de carpintería se llamaba
# `gn_shopfront_wood` y caía en la regla de la madera de nature-kit (valueScale 0,42 sin el 1,7
# diurno), de ahí el tono opaco del frente de tienda. `gn_joinery_dark` no casa con ninguna regla
# y entra por la escalera común.
MATERIALS = {
    "wall": {"name": "gn_brick_wall", "color": (0.116, 0.0692, 0.0358), "roughness": 0.86},
    "render": {"name": "gn_stone_trim", "color": (0.3485, 0.3485, 0.1775), "roughness": 0.74},
    "metal": {"name": "gn_painted_metal", "color": (0.1775, 0.1775, 0.1775), "roughness": 0.55},
    "glass": {"name": "gn_dark_glass", "color": (0.0395, 0.0761, 0.0801), "roughness": 0.14},
    "shop": {"name": "gn_joinery_dark", "color": (0.0692, 0.0143, 0.0032), "roughness": 0.68},
    # WP05: los tres flats de la nave salen de las bandas de valor medidas sobre el mismo atlas
    # licenciado que usa el control para ese paño (T_MetalConcrete), con share real de píxel
    # 10,34 % / 2,44 % / 4,04 %. El paño reutiliza `metal`: es el cluster dominante 28,26 % del
    # mismo atlas, el que ya se midió en WP01. Evidencia:
    # `docs/art/graphics-capabilities/evidence/v2/gn/palette_industrial_day_civic.json`.
    "trim": {"name": "gn_metal_trim", "color": (0.2547, 0.2547, 0.2547), "roughness": 0.62},
    "shutter": {"name": "gn_dock_shutter", "color": (0.116, 0.116, 0.116), "roughness": 0.48},
    "dark": {"name": "gn_rubber_dark", "color": (0.0358, 0.0358, 0.0358), "roughness": 0.92},
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
            # D-111.2 WP01: el rol `wainscot` sustituye el token de TODA la planta baja y el
            # Composer sólo valida el desarrollo horizontal de la banda
            # (`compose.py:693§17`), no la altura. Con 0,90 m quedaban 2,1 m de hueco pasivo
            # sobre el zócalo: el sprite se recortaba contra el vacío y la banda se leía rota.
            # La banda vuelve a medir el paso de forjado y el saliente pasa a ser la parte baja.
            "bayHeight": 3.0,
            "socleHeight": 0.90,
            "depthMeters": 0.229,  # = mod_megakit_brick_bottom_trim_2m: el plano de fachada no se mueve
            "socleProjection": 0.10,
            "joints": 3,
        },
        "cornice": {
            "bayWidth": 2.0,
            # D-111.2 WP01: 1,00 m de alto y 0,40 m de fondo son las medidas de
            # `mod_megakit_cornice_brick_center_2m`, el módulo que este reemplaza en la silueta.
            # Con 0,55 m el pretil bajaba 45 cm, el `targetZ` derivado pasaba de 5,00 a 4,775 y
            # el recorte alfa apretaba hasta que el sprite tocaba el borde del lienzo.
            "bayHeight": 1.0,
            "depthMeters": 0.40,
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
        # --- D-111.2 WP05: rejilla industrial de 4 m ------------------------------------
        # Dos marcos hay que mantener a la vez, y no son el mismo.
        # Marco AUTORADO: y ∈ [0, 0,20] con el origen en la cara posterior del muro, como los paños
        # megakit. No es cosmética: el catálogo deriva `frontAxis` de esa asimetría, y un módulo
        # simétrico se clasifica `symmetric-Y` (= 270° locales) con lo que en la banda frontal no
        # gira y enseña el dorso a la cámara.
        # Marco de COLOCACIÓN: y ∈ [-0,10, +0,10], exactamente la caja medida de los módulos que
        # sustituyen (panel 2×0,2×3, doorframe 2×0,2×3, cornisa 2×0,2×1). `anchors.inward_offset`
        # apoya la cara más saliente sobre la línea de fachada, así que conservar el máximo en 0,20
        # autorados es lo que impide que el envelope -y con él el encuadre derivado y el margen de
        # recorte alfa del sprite- cambie por culpa de la autoría nueva y no de la arquitectura.
        "metal_siding_bay": {
            "bayWidth": 4.0,
            "bayHeight": 3.0,
            "panelThickness": 0.172,
            "ribDepth": 0.026,
            "ribWidth": 0.14,
            "ribs": 8 + int(round(cycle * 4)),
            "kerbHeight": 0.35,
            "eavesHeight": 0.12,
            "seamLevels": 2,
            "seamHeight": 0.05,
            "jointWidth": 0.075,
            "downspoutSize": 0.11,
        },
        "metal_window_bay": {
            "bayWidth": 4.0,
            "bayHeight": 3.0,
            "panelThickness": 0.172,
            "ribDepth": 0.026,
            "ribWidth": 0.14,
            "ribs": 8 + int(round(cycle * 4)),
            "kerbHeight": 0.35,
            "eavesHeight": 0.12,
            "seamLevels": 2,
            "seamHeight": 0.05,
            "jointWidth": 0.075,
            "downspoutSize": 0.11,
            # 0,70 + 2,60 + 0,70 = 4,00: el mismo machón que el portón, así que el hueco de la
            # ventana cae en el centro exacto de la crujía y el ritmo de 4 m no se rompe.
            "openingWidth": 2.60,
            # 1,95 → 2,70 con la coronación de alero en 2,76: franja alta, por debajo de la línea de
            # pilar superior y por encima del alcance de una carretilla.
            "openingHeight": 0.75,
            "sillZ": 1.95,
            "frameBar": 0.09,
            "mullions": 2 + int(round(cycle * 2)),
        },
        "truck_dock_bay": {
            "bayWidth": 4.0,
            "bayHeight": 3.0,
            "panelThickness": 0.172,
            # 4,00 − 2×0,70 = 2,60 m libres de ancho: la caja del camión de referencia del repo
            # (`ext_lab/garage_probe.py`: 2,50 × 2,60) pasa con 5 cm por lado. Con 0,55 de
            # machón el hueco sería de 2,90, pero el dintel dejaría de apoyarse en la línea de
            # pilar de la junta de nave y el paño perdería su ritmo de 4 m.
            "pierWidth": 0.70,
            "headerHeight": 0.26,
            "sillPlateHeight": 0.06,
            "slats": 15 + int(round(cycle * 3)),
            "slatGap": 0.015,
            "shutterRecess": 0.055,
            "guideWidth": 0.085,
            "leafWidth": 0.85,
            "leafHeight": 2.05,
            "leafFrame": 0.055,
            "bumperWidth": 0.16,
            "bumperHeight": 0.75,
            "bumperSill": 0.30,
        },
        "metal_parapet": {
            "bayWidth": 4.0,
            # 1,00 m = la altura de `mod_megakit_cornice_metal_center_2m`: el pretil arranca en la
            # cota superior de la banda y remata ahí, así que la envolvente Z del control (3,00 →
            # 4,00) se conserva sin retocar la gramática.
            "bayHeight": 1.0,
            "wallThickness": 0.162,
            "ribDepth": 0.022,
            "ribWidth": 0.14,
            "ribs": 6 + int(round(cycle * 3)),
            "capDepth": 0.20,
            "capHeight": 0.12,
            "joints": 3 + int(round(cycle * 2)),
            "shadowHeight": 0.035,
            "downspoutSize": 0.11,
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

    def points_row(self, span, count, location, axis="x", tile=False):
        """Fila de `count` puntos que reparten `span` sobre `axis` ("x" o "z").

        `count` puede ser el *nombre* de una entrada de grupo: entonces el reparto se calcula dentro
        del árbol (paso = width/(count+1), primer punto = -width/2 + paso), así que cambiar el número
        de montantes, dentillos o balaustres es un parámetro vivo del módulo y no una regeneración
        en Python. Con entero, el mismo reparto se resuelve en Python y queda grabado en la malla.

        `tile=True` cambia el reparto para que los elementos **lasquen** el tramo de borde a borde
        (paso = span/count, el primero a medio paso): es lo que necesitan las lamas de un portón o
        las hiladas de una chapa, donde un hueco de un paso en cada extremo deja ver el fondo. Con
        `tile=False` queda el reparto histórico de las partes de 2 m, que es el correcto para
        dentillos y balaustres empotrados en los extremos.
        """
        span = float(span)
        index = {"x": 0, "z": 2}[axis]
        letter = "XYZ"
        line = self._node("GeometryNodeMeshLine")
        if isinstance(count, str):
            source = self.input(count)
            self.links.new(source, line.inputs["Count"])
            divisor = source
            if not tile:
                plus = self._math("ADD", 1.0)
                self.links.new(source, plus.inputs[0])
                divisor = plus.outputs[0]
            step = self._math("DIVIDE")
            step.inputs[0].default_value = span
            self.links.new(divisor, step.inputs[1])
            lead = step.outputs[0]
            if tile:
                half = self._math("MULTIPLY", 0.5)
                self.links.new(step.outputs[0], half.inputs[0])
                lead = half.outputs[0]
            first = self._math("ADD")
            first.inputs[1].default_value = float(location[index]) - span / 2.0
            self.links.new(lead, first.inputs[0])
            start = self._node("ShaderNodeCombineXYZ")
            for other in range(3):
                if other != index:
                    start.inputs[letter[other]].default_value = float(location[other])
            self.links.new(first.outputs[0], start.inputs[letter[index]])
            self.links.new(start.outputs["Vector"], line.inputs["Start Location"])
            offset = self._node("ShaderNodeCombineXYZ")
            self.links.new(step.outputs[0], offset.inputs[letter[index]])
            self.links.new(offset.outputs["Vector"], line.inputs["Offset"])
        else:
            count = max(int(count), 1)
            step = span / (count if tile else count + 1)
            line.inputs["Count"].default_value = count
            start = [float(v) for v in location]
            start[index] = start[index] - span / 2.0 + (step / 2.0 if tile else step)
            line.inputs["Start Location"].default_value = tuple(start)
            vector = [0.0, 0.0, 0.0]
            vector[index] = step
            line.inputs["Offset"].default_value = tuple(vector)
        return line.outputs["Mesh"]

    def span_step(self, span, count):
        """Salida de un DIVIDE `span / count` con `count` como entrada viva del grupo."""
        step = self._math("DIVIDE")
        step.inputs[0].default_value = float(span)
        self.links.new(self.input(count), step.inputs[1])
        return step.outputs[0]

    def box_live_height(self, width, depth, height, min_height=0.02):
        """Cubo centrado en el origen con la **altura enlazada desde el propio grafo**.

        Cuando el recuento es un parámetro vivo, el paso también lo es: si la altura de la pieza se
        hornea en Python con el valor por defecto, un recuento alto hace que la primera pieza cruce
        el plano de solera y el módulo salga de su caja de colocación (medido en la sonda de
        `truck_dock_bay`: −21 mm con 24 lamas). Derivándola del paso vivo, el borde inferior queda
        siempre a media junta sobre la solera para cualquier recuento.
        """
        floor = self._math("MAXIMUM", min_height)
        self.links.new(height, floor.inputs[0])
        size = self._node("ShaderNodeCombineXYZ")
        size.inputs["X"].default_value = float(width)
        size.inputs["Y"].default_value = float(depth)
        self.links.new(floor.outputs[0], size.inputs["Z"])
        cube = self._node("GeometryNodeMeshCube")
        self.links.new(size.outputs["Vector"], cube.inputs["Size"])
        return cube.outputs["Mesh"]

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
    """Banda completa de planta baja: paño replanteado hacia dentro y zócalo de sillar saliente.

    La cara exterior del módulo cae en el mismo plano que el panel megakit que sustituye
    (`depthMeters`), así que lo único que cambia respecto al control es el relieve. El labio
    superior es lo que le devuelve la sombra horizontal que el zócalo necesita para leerse.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Plinth")
    tree.declare_inputs(params)
    w = params["bayWidth"]
    d = params["depthMeters"]
    h = params["bayHeight"]
    socle = params["socleHeight"]
    proj = params["socleProjection"]
    back, front = -d / 2.0, d / 2.0
    body_t = d - proj
    lip_t = proj + 0.05
    ashlar_h = socle - lip_t - 0.08
    stone = [
        # paño de la banda, retraído: es lo que hace que el zócalo sobresalga del muro
        tree.box((w, body_t, h), (0.0, back + body_t / 2.0, h / 2.0)),
        # dadillo de arranque, a pleno
        tree.box((w, d, 0.08), (0.0, 0.0, 0.04)),
        # hiladas de sillar
        tree.box((w, d - 0.05, ashlar_h), (0.0, back + (d - 0.05) / 2.0, 0.08 + ashlar_h / 2.0)),
        # labio (cobija) que corona el zócalo
        tree.box((w, d, lip_t), (0.0, 0.0, socle - lip_t / 2.0)),
    ]
    pts = tree.points_row(w - 0.4, "joints", (0.0, front - 0.025, 0.08 + ashlar_h / 2.0))
    stone.append(
        tree.instance_on_row(tree.box((0.028, 0.05, ashlar_h - 0.08), (0.0, 0.0, 0.0)), pts)
    )
    result = tree.with_material(tree.join(stone), MATERIALS["render"]["name"])
    tree.finish(result)
    return tree


def _build_cornice(params):
    """Pretil de 1 m con el perfil clásico construido de abajo arriba dentro del vuelo medido.

    El perfil se apoya en el dintel del último forjado y remata exactamente en `bayHeight`: así el
    envelope del edificio no se mueve cuando este módulo sustituye a la cornisa del control, y con
    él se conserva el encuadre derivado y el margen de recorte alfa del sprite.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Cornice")
    tree.declare_inputs(params)
    w = params["bayWidth"]
    d = params["depthMeters"]
    h = params["bayHeight"]
    back = -d / 2.0
    wall_t = 0.20
    # El parapeto va en ladrillo, igual que el paño: la cornisa de piedra es el remate, no el muro.
    wall = tree.box((w, wall_t, h), (0.0, back + wall_t / 2.0, h / 2.0))
    bed = tree.box((w, 0.30, 0.15), (0.0, back + 0.15, 0.375))
    dentil_pts = tree.points_row(w - 0.28, "dentils", (0.0, back + 0.18, 0.54))
    dentils = tree.instance_on_row(tree.box((0.10, 0.36, 0.18), (0.0, 0.0, 0.0)), dentil_pts)
    corona = tree.box((w, d, 0.17), (0.0, 0.0, 0.715))
    fascia = tree.box((w, 0.32, 0.11), (0.0, back + 0.16, 0.855))
    cyma = tree.box((w, 0.26, 0.09), (0.0, back + 0.13, 0.955))
    brick = tree.with_material(wall, MATERIALS["wall"]["name"])
    stone = tree.with_material(
        tree.join([bed, dentils, corona, fascia, cyma]), MATERIALS["render"]["name"]
    )
    tree.finish(tree.join([brick, stone]))
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


# ---------------------------------------------------------------------------
# Las tres partes industriales de D-111.2 WP05 (crujía = celda de 4 m)
# ---------------------------------------------------------------------------

FACADE_PLANE = 0.20
# El plano más saliente de cualquier módulo de fachada queda a 0,20 m del ORIGEN AUTORADO, no a 0,10:
# las tres partes industriales nacen en la cara posterior del muro (y ∈ [0, 0,20]) exactamente igual
# que los paños megakit que sustituyen. Es una cuestión de semántica medida, no de gusto: el catálogo
# deriva `frontAxis` de la simetría de la caja respecto al origen, y un módulo simétrico en Y se
# clasifica `symmetric-Y`, que en `anchors.MODULE_FRONT_DEGREES` vale 270° y por tanto NO gira en la
# banda frontal. Con el origen centrado el relieve de chapa habría mirado hacia el interior de la
# nave y la calle habría visto el dorso. Ya en [0, 0,20] la clasificación sale `+Y`, el frente gira
# 180° y la caja de colocación medida vuelve a y ∈ [-0,10, +0,10]: el envelope del sprite y el
# encuadre derivado del control no se mueven.


def _build_metal_siding_bay(params):
    """Paño de chapa perfilada de 4 m con solera, alero, junta de nave y bajante.

    El cambio no es decorativo: `mod_megakit_metal_wall_2m` —el único panel metálico de 2 m del
    catálogo— enlaza 6 de sus 18 triángulos a `MI_InteriorWall`, cuya base de color es
    T_RedBrick. La gramática declara `steel_cladding` y el render devolvía ladrillo (medido en los
    dos brazos de control de WP05). Aquí el paño es chapa de principio a fin, y la junta de nave
    cae donde la propia gramática dice que hay un pilar: en el canto de la celda.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Metal_Siding_Bay")
    tree.declare_inputs(params)
    w = params["bayWidth"]
    h = params["bayHeight"]
    outer = FACADE_PLANE
    rib = params["ribDepth"]
    skin_out = outer - rib
    t = params["panelThickness"]
    skin_y = skin_out - t / 2.0
    kerb = params["kerbHeight"]
    eaves = params["eavesHeight"]
    rib_h = h - kerb - eaves
    rib_z = kerb + rib_h / 2.0
    ds = params["downspoutSize"]
    joint = params["jointWidth"]

    panel = [
        tree.box((w, t, h), (0.0, skin_y, h / 2.0)),
        tree.instance_on_row(
            tree.box((params["ribWidth"], rib, rib_h), (0.0, 0.0, 0.0)),
            tree.points_row(w, "ribs", (0.0, skin_out + rib / 2.0, rib_z)),
        ),
    ]
    # Traverses horizontales: van por detrás de la punta de las nervaduras para que los cruces no
    # dejen dos caras coplanares (a 60 px/m eso parpadea como ruido, no como relieve).
    for level in range(1, int(params["seamLevels"]) + 1):
        z = kerb + rib_h * level / (params["seamLevels"] + 1.0)
        panel.append(
            tree.box((w, 0.024, params["seamHeight"]), (0.0, skin_out + 0.012, z))
        )
    formed = [
        tree.box((w, outer, kerb), (0.0, outer / 2.0, kerb / 2.0)),
        tree.box((w, outer, eaves), (0.0, outer / 2.0, h - eaves / 2.0)),
        tree.box((ds, ds, rib_h + 0.02), (w / 2.0 - joint - 0.02 - ds / 2.0, outer - ds / 2.0, rib_z)),
    ]
    detail = [
        # junta de nave en el canto: el único elemento oscuro del paño, para que el ritmo de 4 m se
        # lea como línea de pilar y no como suciedad.
        tree.box((joint, 0.024, rib_h), (w / 2.0 - joint / 2.0, skin_out + 0.012, rib_z)),
        tree.box((ds + 0.08, 0.04, 0.05), (w / 2.0 - joint - 0.02 - ds / 2.0, outer - 0.03, kerb + 0.35)),
        tree.box((ds + 0.08, 0.04, 0.05), (w / 2.0 - joint - 0.02 - ds / 2.0, outer - 0.03, h - eaves - 0.20)),
    ]
    tree.finish(
        tree.join(
            [
                tree.with_material(tree.join(panel), MATERIALS["metal"]["name"]),
                tree.with_material(tree.join(formed), MATERIALS["trim"]["name"]),
                tree.with_material(tree.join(detail), MATERIALS["dark"]["name"]),
            ]
        )
    )
    return tree


def _build_metal_window_bay(params):
    """Crujía de chapa de 4 m con franja alta de vidrios: la `ventana alta` que declaran los ritmos.

    El `window_bay` de 4 m del catálogo CC0 (`mod_megakit_metal_window_4m`) enlaza `MI_RedBrick`:
    en la paleta `steel_cladding` asoma ladrillo en medio del chapa, que es exactamente el paño
    equivocado en el sitio equivocado que WP05 prohíbe. El de 2 m no lleva ladrillo pero mide 2 m,
    así que en rejilla de 4 m no hay módulo metálico válido: se autoría. Los ritmos aprobados no
    piden un hueco doméstico, piden `dock_windows` = "chapa con ventanas **altas**" y `strip_windows`
    = "**franja** de huecos": aquí la franja va alta y corrido, como en una nave real.

    El hueco es atravesado de verdad (montantes, bajo y antepecho dejan el paso libre) y el marco
    queda a flor del relieve: el máximo en y sigue siendo `FACADE_PLANE`, así que la caja de
    colocación medida y el encuadre del sprite no cambian por autoría nueva.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Metal_Window_Bay")
    tree.declare_inputs(params)
    w = params["bayWidth"]
    h = params["bayHeight"]
    outer = FACADE_PLANE
    rib = params["ribDepth"]
    skin_out = outer - rib
    t = params["panelThickness"]
    skin_y = skin_out - t / 2.0
    kerb = params["kerbHeight"]
    eaves = params["eavesHeight"]
    rib_h = h - kerb - eaves
    ds = params["downspoutSize"]
    joint = params["jointWidth"]
    ow, oh = params["openingWidth"], params["openingHeight"]
    sill = params["sillZ"]
    head = sill + oh
    bar = params["frameBar"]
    half_w = w / 2.0
    pier_w = half_w - ow / 2.0
    centre_z = sill + oh / 2.0

    # Pared en cuatro piezas, no un paño con la ventana pintada: el reveco se ilumina porque hay
    # 0,172 m de espesor que recorrer, igual que en `window_bay` residencial (§WP01).
    wall = [
        tree.box((pier_w, t, h), (-half_w + pier_w / 2.0, skin_y, h / 2.0)),
        tree.box((pier_w, t, h), (half_w - pier_w / 2.0, skin_y, h / 2.0)),
        tree.box((ow, t, sill), (0.0, skin_y, sill / 2.0)),
        tree.box((ow, t, h - head), (0.0, skin_y, head + (h - head) / 2.0)),
    ]
    # Las nervaduras se cortan en el hueco: una chapa perfilada no sigue subiendo por encima del
    # vidrio, y una nervadura a 0,026 m sobre el marco se leería como un defecto de modelado.
    lower_h = sill - kerb
    upper_h = (h - eaves) - head
    ribs = [
        tree.instance_on_row(
            tree.box((params["ribWidth"], rib, lower_h), (0.0, 0.0, 0.0)),
            tree.points_row(w, "ribs", (0.0, skin_out + rib / 2.0, kerb + lower_h / 2.0)),
        ),
        tree.instance_on_row(
            tree.box((params["ribWidth"], rib, upper_h), (0.0, 0.0, 0.0)),
            tree.points_row(w, "ribs", (0.0, skin_out + rib / 2.0, head + upper_h / 2.0)),
        ),
    ]
    seams = []
    for level in range(1, int(params["seamLevels"]) + 1):
        z = kerb + rib_h * level / (params["seamLevels"] + 1.0)
        if sill <= z < head:
            # El traverse no cruza el hueco: se interrumpe en los montantes, como en el paño real.
            for sign in (-1.0, 1.0):
                seams.append(
                    tree.box(
                        (pier_w, 0.024, params["seamHeight"]),
                        (sign * (ow / 2.0 + pier_w / 2.0), skin_out + 0.012, z),
                    )
                )
        else:
            seams.append(tree.box((w, 0.024, params["seamHeight"]), (0.0, skin_out + 0.012, z)))
    panel = wall + ribs + seams
    formed = [
        tree.box((w, outer, kerb), (0.0, outer / 2.0, kerb / 2.0)),
        tree.box((w, outer, eaves), (0.0, outer / 2.0, h - eaves / 2.0)),
        tree.box((ds, ds, rib_h + 0.02), (half_w - joint - 0.02 - ds / 2.0, outer - ds / 2.0, kerb + rib_h / 2.0)),
    ]
    # Marco, montantes y alféizar de chapa plegada, todo a flor del relieve (y ≤ 0,20 autorados).
    joinery = tree.frame_rect(ow, oh, 0.03, t - 0.06, centre_z, skin_y)
    joinery += tree.frame_rect(ow + 2 * bar, oh + 2 * bar, bar, rib, centre_z, skin_out + rib / 2.0)
    joinery += [
        tree.instance_on_row(
            tree.box((0.045, rib, oh - 0.06), (0.0, 0.0, 0.0)),
            tree.points_row(ow, "mullions", (0.0, skin_out + rib / 2.0, centre_z)),
        ),
        tree.box((ow + 2 * bar + 0.12, rib, 0.06), (0.0, skin_out + rib / 2.0, sill - bar - 0.03)),
    ]
    glass = tree.box((ow - 0.05, 0.02, oh - 0.05), (0.0, skin_out - 0.01, centre_z))
    detail = [
        tree.box((joint, 0.024, rib_h), (half_w - joint / 2.0, skin_out + 0.012, kerb + rib_h / 2.0)),
        tree.box((ds + 0.08, 0.04, 0.05), (half_w - joint - 0.02 - ds / 2.0, outer - 0.03, kerb + 0.35)),
        tree.box((ds + 0.08, 0.04, 0.05), (half_w - joint - 0.02 - ds / 2.0, outer - 0.03, h - eaves - 0.20)),
        # Fondo del hueco: sin él la franja sería un agujero al vacío del volumen. Es el mismo
        # reveco `gn_rubber_dark` del portón, y `ext_lab/dock_probe.py` lo excluye por material.
        tree.box((ow - 0.02, 0.02, oh - 0.02), (0.0, skin_y - t / 2.0 + 0.015, centre_z)),
    ]
    tree.finish(
        tree.join(
            [
                tree.with_material(tree.join(panel), MATERIALS["metal"]["name"]),
                tree.with_material(tree.join(formed + joinery), MATERIALS["trim"]["name"]),
                tree.with_material(tree.join(detail), MATERIALS["dark"]["name"]),
                tree.with_material(glass, MATERIALS["glass"]["name"]),
            ]
        )
    )
    return tree


def _build_truck_dock_bay(params):
    """Portón de muelle: hueco estructural de 2,60 × 2,74 m con hoja seccionada y puerta personal.

    El control presenta como "muelle" un `doorframe` de 2 m abierto de arriba abajo: sin hoja, sin
    guías y sin niveladora, así que el píxel devolvía el interior del volumen como un agujero más
    estrecho que la caja de un camión (la referencia del propio repo, `ext_lab/garage_probe.py`:
    2,50 × 2,60 m). Aquí el hueco es utilizable y está **cerrado por una hoja**, que es justamente
    lo que lo convierte en muelle en vez de en un fallo de modelado.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Truck_Dock_Bay")
    tree.declare_inputs(params)
    outer = FACADE_PLANE
    w, h = params["bayWidth"], params["bayHeight"]
    t = params["panelThickness"]
    pier, header = params["pierWidth"], params["headerHeight"]
    ap_w, ap_h = w - 2 * pier, h - header
    guide, recess = params["guideWidth"], params["shutterRecess"]
    leaf_w, leaf_h, frame = params["leafWidth"], params["leafHeight"], params["leafFrame"]
    bumper = params["bumperWidth"]
    skin = outer - 0.028  # los machones quedan 2,8 cm por detrás del plano de fachada
    shutter_y = outer - recess  # punta de las lamas: 5,5 cm de retranqueo dentro del hueco

    structure = [
        tree.box((pier, t, h), (-(w - pier) / 2.0, skin - t / 2.0, h / 2.0)),
        tree.box((pier, t, h), ((w - pier) / 2.0, skin - t / 2.0, h / 2.0)),
        tree.box((ap_w, t, header), (0.0, skin - t / 2.0, ap_h + header / 2.0)),
        # los machones llevan la nervadura del paño, para que el portón lea como un hueco abierto
        # EN EL MISMO MURO y no como un artefacto pegado delante de él.
        tree.box((0.13, 0.026, ap_h), (-1.765, outer - 0.013, ap_h / 2.0)),
        tree.box((0.13, 0.026, ap_h), (1.765, outer - 0.013, ap_h / 2.0)),
    ]
    formed = [
        # guías del rollo: nacen en la cara del machón y sobresalen hasta el plano de fachada, así
        # que el hueco estructural sigue midiendo 2,60 m (las guías caen a x > ap_w/2).
        tree.box((guide, 0.045, ap_h), (-(ap_w + guide) / 2.0, outer - 0.0225, ap_h / 2.0)),
        tree.box((guide, 0.045, ap_h), ((ap_w + guide) / 2.0, outer - 0.0225, ap_h / 2.0)),
        # dintel chapeado POR ENCIMA del hueco: no le quita un centímetro de paso al camión.
        tree.box((ap_w + 2 * guide, 0.045, 0.09), (0.0, outer - 0.0225, ap_h + 0.045)),
        # pletina de niveladora a nivel de solera: es lo que hace que el umbral sea de muelle.
        tree.box((ap_w, 0.09, params["sillPlateHeight"]), (0.0, outer - 0.045, params["sillPlateHeight"] / 2.0)),
    ]
    # La lama mide `paso − junta`, y el paso se lee del parámetro vivo dentro del grafo: con la altura
    # horneada en Python el recuento alto cruzaba el plano de solera (ver `box_live_height`).
    pitch = tree.span_step(ap_h, "slats")
    slat_height = tree._math("SUBTRACT")
    slat_height.inputs[1].default_value = params["slatGap"]
    tree.links.new(pitch, slat_height.inputs[0])
    slats = tree.instance_on_row(
        tree.box_live_height(ap_w - 0.04, 0.03, slat_height.outputs[0]),
        tree.points_row(ap_h, "slats", (0.0, shutter_y - 0.015, ap_h / 2.0), axis="z", tile=True),
    )
    leaf_x = -(ap_w - leaf_w) / 2.0 + 0.05
    leaf = [
        tree.box((leaf_w - 2 * frame, 0.02, leaf_h - 2 * frame), (leaf_x, shutter_y + 0.01, leaf_h / 2.0)),
        tree.box((frame, 0.03, leaf_h), (leaf_x - leaf_w / 2.0 + frame / 2.0, shutter_y + 0.03, leaf_h / 2.0)),
        tree.box((frame, 0.03, leaf_h), (leaf_x + leaf_w / 2.0 - frame / 2.0, shutter_y + 0.03, leaf_h / 2.0)),
        tree.box((leaf_w, 0.03, frame), (leaf_x, shutter_y + 0.03, leaf_h - frame / 2.0)),
        tree.box((leaf_w, 0.03, frame), (leaf_x, shutter_y + 0.03, frame / 2.0)),
    ]
    lite = [tree.box((0.36, 0.012, 0.42), (leaf_x, shutter_y + 0.035, leaf_h - 0.42))]
    hardware = [
        tree.box((0.50, 0.025, 0.05), (leaf_x + 0.06, shutter_y + 0.04, 1.05)),
        # topes de goma: llegan al plano de fachada pegados a las guías; el camión apoya aquí y no
        # sobre la chapa, que es la diferencia entre un muelle y un hueco en la pared.
        tree.box((bumper, 0.03, params["bumperHeight"]), (-(ap_w / 2.0 + guide + bumper / 2.0), outer - 0.015, params["bumperSill"] + params["bumperHeight"] / 2.0)),
        tree.box((bumper, 0.03, params["bumperHeight"]), ((ap_w / 2.0 + guide + bumper / 2.0), outer - 0.015, params["bumperSill"] + params["bumperHeight"] / 2.0)),
        # fondo del hueco: sin él, los 15 mm de junta entre lamas mostrarían la pared del fondo de
        # la nave y el portón volvería a leerse como un agujero.
        # En el plano medio del muro (los machones van de y = 0 a y = skin), no a mitad del
        # presupuesto autorad: así el fondo no asoma por ninguno de los dos planos.
        tree.box((ap_w - 0.02, 0.02, ap_h), (0.0, skin - t / 2.0, ap_h / 2.0)),
    ]
    tree.finish(
        tree.join(
            [
                tree.with_material(tree.join(structure), MATERIALS["metal"]["name"]),
                # La hoja se pinta Entera con el material de las lamas, marco incluido: es lo que
                # permite medir el hueco de paso excluyendo lo que se recoge. La sonda
                # `ext_lab/dock_probe.py` separa estático/móvil por material, no por convención.
                tree.with_material(tree.join(formed), MATERIALS["trim"]["name"]),
                tree.with_material(tree.join([slats] + leaf), MATERIALS["shutter"]["name"]),
                tree.with_material(tree.join(lite), MATERIALS["glass"]["name"]),
                tree.with_material(tree.join(hardware), MATERIALS["dark"]["name"]),
            ]
        )
    )
    return tree


def _build_metal_parapet(params):
    """Pretil ciego de chapa: la `silhouetteOption` que en la gramática existía de nombre y no de geometría.

    La capa volada es lo que da la sombra horizontal que un pretil de chapa necesita para no leerse
    como un simple crecimiento del muro; el canto inferior y las juntas van en el mismo plano que las
    nervaduras del paño, y la bajante continua exactamente sobre la del muro de debajo.
    """
    tree = GrammarTree(f"{GROUP_PREFIX}_Metal_Parapet")
    tree.declare_inputs(params)
    w = params["bayWidth"]
    h = params["bayHeight"]
    outer = FACADE_PLANE
    t = params["wallThickness"]
    rib = params["ribDepth"]
    cap_h, cap_d = params["capHeight"], params["capDepth"]
    wall_h = h - cap_h
    skin_out = outer - 0.038
    ds = params["downspoutSize"]
    shadow_y = skin_out + 0.009

    panel = [
        tree.box((w, t, wall_h), (0.0, skin_out - t / 2.0, wall_h / 2.0)),
        tree.instance_on_row(
            tree.box((params["ribWidth"], rib, wall_h - 0.02), (0.0, 0.0, 0.0)),
            tree.points_row(w, "ribs", (0.0, skin_out + rib / 2.0, wall_h / 2.0)),
        ),
    ]
    # La capa no pasa de z = 1,00 ni de y = 0,20: son las cotas del módulo megakit que reemplaza, y
    # son justamente las que sujetan el envelope (y el encuadre derivado) del sprite de control.
    cap = [tree.box((w, cap_d, cap_h), (0.0, outer - cap_d / 2.0, wall_h + cap_h / 2.0))]
    joint = [
        # banda de sombra bajo el canto, junta de dilatación en el mismo canto que el paño y juntas
        # verticales instanciadas: el ritmo de 4 m no se corta en la cubierta.
        tree.box((w, 0.018, params["shadowHeight"]), (0.0, shadow_y, wall_h - params["shadowHeight"] / 2.0)),
        tree.instance_on_row(
            tree.box((0.03, 0.018, wall_h - 0.02), (0.0, 0.0, 0.0)),
            tree.points_row(w, "joints", (0.0, shadow_y, wall_h / 2.0)),
        ),
        tree.box((0.075, 0.018, wall_h - 0.02), (w / 2.0 - 0.0375, shadow_y, wall_h / 2.0)),
    ]
    formed = [tree.box((ds, ds, h), (w / 2.0 - 0.075 - 0.02 - ds / 2.0, outer - ds / 2.0, h / 2.0))]
    tree.finish(
        tree.join(
            [
                tree.with_material(tree.join(panel), MATERIALS["metal"]["name"]),
                tree.with_material(tree.join(cap + formed), MATERIALS["trim"]["name"]),
                tree.with_material(tree.join(joint), MATERIALS["dark"]["name"]),
            ]
        )
    )
    return tree


BUILDERS = {
    "window_bay": _build_window_bay,
    "shopfront_bay": _build_shopfront_bay,
    "plinth": _build_plinth,
    "cornice": _build_cornice,
    "balcony_door_bay": _build_balcony_door_bay,
    "metal_siding_bay": _build_metal_siding_bay,
    "metal_window_bay": _build_metal_window_bay,
    "truck_dock_bay": _build_truck_dock_bay,
    "metal_parapet": _build_metal_parapet,
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
    # WP05: en la nave la repetición también es viva, y es la que de verdad cuesta dinero: nervaduras
    # del paño, lamas del portón y juntas del pretil se re-miden cambiando UN número del modificador.
    "metal_siding_bay": ("ribs", (6, 10, 14)),
    "metal_window_bay": ("mullions", (2, 3, 4)),
    "truck_dock_bay": ("slats", (12, 17, 24)),
    "metal_parapet": ("joints", (2, 4, 7)),
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
        "grid": {
            # Dos rejillas en el mismo sistema (WP05): el tag del archivo y el id del módulo salen del
            # `bayWidth` de cada parte, no de una constante, así que las piezas de 4 m de la nave no
            # pueden pisar el id de las cinco piezas de 2 m ya publicadas.
            "bayMetersByPart": {part: part_parameters(part, seed)["bayWidth"] for part in parts},
            "floorHeightMeters": 3.0,
            "wallThicknessMeters": 0.20,
        },
        "parts": [],
    }
    for part in parts:
        meta = PARTS[part]
        params = part_parameters(part, seed)
        tag = f"{params['bayWidth']:g}m"
        started = time.perf_counter()
        tree = BUILDERS[part](params)
        setup_ms = round((time.perf_counter() - started) * 1000, 2)
        host, modifier = parametric_host(tree, params, meta["objectName"])
        started = time.perf_counter()
        mesh = measured_mesh(host)
        evaluate_ms = round((time.perf_counter() - started) * 1000, 2)
        if not mesh.polygons:
            raise RuntimeError(f"{part}: Geometry Nodes no produjo ninguna cara")
        glb = os.path.join(out_dir, f"gn_{part}_{tag}.glb")
        bpy.ops.object.select_all(action="DESELECT")
        host.select_set(True)
        bpy.context.view_layer.objects.active = host
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)
        entry = {
            "part": part,
            "moduleId": f"mod_gn_{part}_{tag}",
            "bayMeters": params["bayWidth"],
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

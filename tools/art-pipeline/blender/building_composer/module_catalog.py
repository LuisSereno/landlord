"""Índice del catálogo medido (`building-modules.json`) sobre el que el compositor puede decidir.

El catálogo es la única fuente de geometría: un módulo que no está aquí no existe para la gramática,
así que un error de nombre es un fallo ruidoso y no un edificio incompleto (§7: nada declarativo).
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
CATALOG_PATH = REPO_ROOT / "blender_artist/manifests/building-modules.json"
TOLERANCE_M = 0.005


class GrammarError(Exception):
    pass


class Module:
    """Un módulo del catálogo visto desde el marco de colocación que usa la gramática.

    `placementBounds` es `moduleBoundsInPlacementFrameMeters + anchorTransform.translation`: el marco
    donde la huella ya está centrada en XY y apoyada en Z=0 (así lo publica V.f.1 y está comprobado
    módulo a módulo). Todo lo que la gramática hace con un módulo es rotarlo 90° y trasladarlo.
    """

    def __init__(self, record):
        anchor = record["anchor"]
        shift = anchor["anchorTransform"]["translation"]
        raw = anchor["moduleBoundsInPlacementFrameMeters"]
        self.id = record["id"]
        self.role = record["role"]
        self.category = record["category"]
        self.families = set(record["allowedFamilies"])
        self.source_path = record["sourcePath"]
        self.source_id = record["sourceId"]
        self.license = record["license"]
        self.unit_scale = record["unitScale"]
        self.meshes = list(record["objectSelector"]["meshes"])
        self.selected_objects = list(record["measured"]["selectedObjects"])
        self.triangles = int(record["measured"]["triangles"])
        self.vertices = int(record["measured"]["vertices"])
        self.shells = int(record["measured"]["shells"])
        self.materials = list(record["measured"]["materials"])
        self.images = list(record["measured"]["images"])
        # Cadenas "material=cadena de Base Color" medidas en Blender: deciden si el albedo exterior de
        # este módulo pasa de verdad por el remapeo de §11.
        self.base_color_chains = list(record["measured"]["baseColorChains"])
        self.front_axis = anchor["frontAxis"]
        self.rotations = list(record["orientation"]["allowedRotationsDegrees"])
        self.placement_bounds = {
            axis: {
                "min": raw[axis]["min"] + shift[index],
                "max": raw[axis]["max"] + shift[index],
            }
            for index, axis in enumerate(("x", "y", "z"))
        }
        for axis in ("x", "y"):
            box = self.placement_bounds[axis]
            if abs(box["min"] + box["max"]) > TOLERANCE_M:
                raise GrammarError(f"{self.id}: su marco de colocación no está centrado en {axis}")
        if abs(self.placement_bounds["z"]["min"]) > TOLERANCE_M:
            raise GrammarError(f"{self.id}: su marco de colocación no apoya en Z=0")

    def size(self, rotation_degrees):
        box = self.placement_bounds
        depth = box["y"]["max"] - box["y"]["min"]
        width = box["x"]["max"] - box["x"]["min"]
        if rotation_degrees in (90, 270):
            width, depth = depth, width
        return width, depth, box["z"]["max"] - box["z"]["min"]

    def __repr__(self):
        return f"<Module {self.id} role={self.role}>"


class Catalog:
    def __init__(self, path=CATALOG_PATH):
        document = json.loads(Path(path).read_text(encoding="utf-8"))
        self.style_profile = document.get("generator", {})
        self.families = set(document["families"])
        self.modules = {}
        for record in document["modules"]:
            module = Module(record)
            self.modules[module.id] = module
        # Pool canónico: ordenado por id para que un sorteo sobre el pool sea reproducible aunque
        # el catálogo se reordene a mano.
        self.pools = {}
        for module in sorted(self.modules.values(), key=lambda item: item.id):
            for family in sorted(module.families):
                self.pools.setdefault((family, module.role), []).append(module)

    def get(self, module_id):
        module = self.modules.get(module_id)
        if module is None:
            raise GrammarError(f"el manifiesto referencia un módulo inexistente: {module_id}")
        return module

    def pool(self, family, role):
        found = self.pools.get((family, role))
        if not found:
            raise GrammarError(f"ningún módulo de familia {family} declara el rol {role}")
        return found

    def pick(self, family, role, module_id=None):
        """Rol → módulo concreto: o el que pide la paleta, o el primero canónico del pool."""
        if module_id is not None:
            module = self.get(module_id)
            if family not in module.families:
                raise GrammarError(
                    f"{module.id} no es compatible con la familia {family} (§7 familia incompatible)"
                )
            if module.role != role:
                raise GrammarError(f"{module.id} no tiene el rol {role} que pide la gramática")
            return module
        return self.pool(family, role)[0]

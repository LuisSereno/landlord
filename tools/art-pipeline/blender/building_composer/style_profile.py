"""Lectura del perfil de estilo medido (`building-style-profiles.json`).

El compositor no decide parámetros: §10 los exige justificados y el perfil ya los trae con evidencia.
Cada valor que usa la gramática se lee aquí, y si el perfil no lo publica el compositor falla en vez
de inventar un número razonable.
"""

import hashlib
import json
from pathlib import Path

from .module_catalog import REPO_ROOT, GrammarError

PROFILE_PATH = REPO_ROOT / "blender_artist/manifests/building-style-profiles.json"
# Las familias que no definen la temperatura cromática de un alzado: el cristal se resuelve por
# emisión y el interior queda oculto tras el marco, así que mezclarlos no rompe §11.
NON_ELEVATION_FAMILIES = {"interior", "glass"}


class StyleProfile:
    def __init__(self, profile_id, catalog_path=REPO_ROOT / "blender_artist/manifests/building-modules.json"):
        document = json.loads(Path(PROFILE_PATH).read_text(encoding="utf-8"))
        record = next(
            (item for item in document["profiles"] if item["id"] == profile_id), None
        )
        if record is None:
            raise GrammarError(f"no existe el perfil de estilo {profile_id}")
        expected = record["moduleCatalogSha256"]
        actual = hashlib.sha256(Path(catalog_path).read_bytes()).hexdigest()
        if expected != actual:
            raise GrammarError(
                f"el perfil {profile_id} se midió sobre otro catálogo ({expected[:12]}≠{actual[:12]}): "
                "rehaz el perfil antes de componer"
            )
        self.id = profile_id
        self.record = record
        self.parameters = record["parameters"]
        self.families = set(record["appliesToFamilies"])
        self.material_family = {}
        for mechanism in record["packCoexistence"]["mechanismMeasured"]:
            for reach in mechanism["materialReach"]:
                self.material_family[reach["material"]] = reach["family"]

    def value(self, name):
        entry = self.parameters.get(name)
        if entry is None:
            raise GrammarError(f"el perfil {self.id} no publica el parámetro {name}")
        return entry["value"]

    @property
    def floor_height(self):
        return float(self.value("floorHeightMeters"))

    @property
    def cell_meters(self):
        return float(self.value("bays")["cellSizeMeters"])

    @property
    def bay_meters(self):
        return float(min(self.value("bays")["bayWidthMeters"]))

    @property
    def bay_options(self):
        return sorted(float(value) for value in self.value("bays")["bayWidthMeters"])

    @property
    def roof_overhang_range(self):
        overhang = self.value("roofOverhangMeters")
        return float(overhang["min"]), float(overhang["max"])

    @property
    def door_scale(self):
        return self.value("doorScale")

    @property
    def camera(self):
        return self.value("camera")

    @property
    def framing_margin(self):
        """Margen mediano observado en los jobs embarcados: el perfil lo publica, no lo elegimos.

        `ortho_scale` demasiado ajustado recorta el edificio; demasiado holgado pierde resolución.
        La pipeline ya publica renders aprobados, así que su margen real es la referencia.
        """
        margins = sorted(entry["margin"] for entry in self.camera["observedMargins"])
        middle = len(margins) // 2
        if len(margins) % 2:
            return margins[middle]
        return (margins[middle - 1] + margins[middle]) / 2

    @property
    def pixels_per_meter(self):
        observed = sorted(
            entry["pixelsPerMeter"] for entry in self.camera["observedMargins"]
        )
        return observed[len(observed) // 2]

    def elevation_reach(self, module):
        """"tratado" | "en_bruto" | "mixto": si el albedo exterior del módulo pasa por el remapeo.

        §11 prohíbe que un mismo alzado muestre dos temperaturas de brillo, y la alcanzabilidad se
        mide por instancia (módulo, material): `MI_Trim` entra tratado en unos archivos y en bruto en
        otros. Por eso se decide sobre `measured.baseColorChains`, no sobre el nombre del material.
        """
        exterior = [
            chain
            for chain in module.base_color_chains
            if self.material_family.get(chain.split("=")[0]) not in NON_ELEVATION_FAMILIES
        ]
        if not exterior:
            return "sin_albedo_exterior"
        reached = sum(1 for chain in exterior if chain.split("=", 1)[1].startswith("atlas:"))
        if reached == len(exterior):
            return "tratado"
        if reached == 0:
            return "en_bruto"
        return "mixto"

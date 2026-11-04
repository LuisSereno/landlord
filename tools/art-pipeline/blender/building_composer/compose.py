"""Composición determinista de un candidato (§12–§18).

Todo el geometrado vive aquí, sin `bpy`: recibe catálogo + perfil + gramática + seed y devuelve una
lista de colocaciones (módulo, giro, posición en el marco del edificio), su firma canónica, sus
métricas y sus comprobaciones. `scene.py` sólo traduce esa lista a objetos de Blender, así que un
candidato se puede auditar, comparar y testear sin renderizar nada (§32).

Convenciones centralizadas (no son negociables y por eso no se repiten por el módulo):
- Origen = centro de la huella a nivel de suelo: es el punto que `pivot_from_origin` proyecta (§18).
- El frente da a -Y: el rig canónico (azimut 45°) mira desde (+X, -Y, +Z); otro reparto dibujaría
  el edificio de espaldas.
- Colocación = `T(posición) · Rz(giro)` sobre el marco de colocación del catálogo, que ya trae la
  huella centrada en XY y apoyada en Z=0 (medido módulo a módulo en V.f.1).
- Los módulos NO se escalan: el paso de piso, la crujía y el vuelo de cornisa vienen del perfil.
"""

import hashlib
import json
import math

from . import anchors
from .grammar import GrammarDocument, draw_choices, option_by_id
from .module_catalog import Catalog
from .style_profile import StyleProfile

GROUND_Z_TOLERANCE_DEFAULT = 0.05
DORMER_ROLLOUT_TOLERANCE_M = 0.02


class CompositionError(Exception):
    pass


def _round(value):
    return round(value, 3)


def _box(x0, y0, x1, y1, z0, z1):
    return {
        "x": {"min": _round(x0), "max": _round(x1)},
        "y": {"min": _round(y0), "max": _round(y1)},
        "z": {"min": _round(z0), "max": _round(z1)},
    }


def _contained(center, half, low, high):
    return low - 1e-6 <= center - half and center + half <= high + 1e-6


class Occupancy:
    """Retícula de crujías del solar: lo que toca el suelo no puede repetirse.

    Los volúmenes reclaman sus celdas y los props de patio sólo caen en celdas libres. Sin esto un
    depósito de Kenney aparecería atravesado dentro del volumen principal, y a 256 px eso es un
    artefacto imposible de justificar ante la revisión humana.
    """

    def __init__(self, columns, rows, bay_meters, origin_x, origin_y):
        self.columns = columns
        self.rows = rows
        self.bay = bay_meters
        self.origin_x = origin_x
        self.origin_y = origin_y
        self.claimed = {}

    def cells_for(self, x0, x1, y0, y1):
        low_column = max(0, int(math.floor((x0 - self.origin_x) / self.bay + 1e-6)))
        high_column = min(
            self.columns - 1, int(math.ceil((x1 - self.origin_x) / self.bay - 1e-6)) - 1
        )
        low_row = max(0, int(math.floor((y0 - self.origin_y) / self.bay + 1e-6)))
        high_row = min(self.rows - 1, int(math.ceil((y1 - self.origin_y) / self.bay - 1e-6)) - 1)
        return [
            (column, row)
            for column in range(low_column, high_column + 1)
            for row in range(low_row, high_row + 1)
        ]

    def claim(self, owner, box):
        cells = self.cells_for(box["x"]["min"], box["x"]["max"], box["y"]["min"], box["y"]["max"])
        if not cells or any(cell in self.claimed for cell in cells):
            return False
        for cell in cells:
            self.claimed[cell] = owner
        return True

    def free_cells(self):
        return [
            (column, row)
            for column in range(self.columns)
            for row in range(self.rows)
            if (column, row) not in self.claimed
        ]

    def center_of(self, cell):
        column, row = cell
        return (
            self.origin_x + (column + 0.5) * self.bay,
            self.origin_y + (row + 0.5) * self.bay,
        )


class Composition:
    def __init__(self, catalog, profile, document, request):
        self.catalog = catalog
        self.profile = profile
        self.document = document
        self.building_type = request["buildingType"]
        self.family = request["family"]
        self.variant_seed = int(request["variantSeed"])
        self.composer_version = request["composerVersion"]
        self.style_profile_id = request["styleProfileId"]
        self.footprint_cells = dict(request["footprint"])
        self.levels = int(request["floors"])
        if self.style_profile_id != profile.id:
            raise CompositionError(f"perfil de estilo inesperado: {self.style_profile_id}")
        if self.composer_version != document.composer_version:
            raise CompositionError(
                f"composerVersion del request ({self.composer_version}) ≠ manifiesto "
                f"({document.composer_version})"
            )
        if self.family not in profile.families:
            raise CompositionError(f"el perfil {profile.id} no aplica a {self.family}")
        self.record = document.grammar(self.building_type, catalog, profile)
        if self.record["family"] != self.family:
            raise CompositionError(
                f"la gramática de {self.building_type} es de familia {self.record['family']}, "
                f"se pidió {self.family}"
            )
        if not self.record["levelsFromDomain"]:
            raise CompositionError("la gramática no declara levelsFromDomain: los pisos manda el dominio")
        self.cell = profile.cell_meters
        self.grid_bay = min(profile.bay_options)
        self.bay = profile.bay_meters
        self.level = profile.floor_height
        self.ground_tolerance = float(
            document.frame.get("groundToleranceMeters", GROUND_Z_TOLERANCE_DEFAULT)
        )
        self.width = self.footprint_cells["width"] * self.cell
        self.depth = self.footprint_cells["height"] * self.cell
        if self.width % self.grid_bay or self.depth % self.grid_bay:
            raise CompositionError("el solar no se reparte en crujías enteras")
        self.rect = (-self.width / 2.0, -self.depth / 2.0, self.width / 2.0, self.depth / 2.0)
        # El frente da a -Y (rect[1]), así que la franja que reserva `frontCells` está ENTRE la calle
        # y el volumen: el solar no se estrecha por el lado de atrás.
        yard = self.record["yard"]
        self.yard_front_cells = int(yard["frontCells"])
        self.buildable = (
            self.rect[0] + yard["leftCells"] * self.cell,
            self.rect[1] + yard["frontCells"] * self.cell,
            self.rect[2] - yard["rightCells"] * self.cell,
            self.rect[3],
        )
        self.front_strip = None
        if yard["frontCells"]:
            self.front_strip = (
                self.rect[0],
                self.rect[1],
                self.rect[2],
                self.rect[1] + yard["frontCells"] * self.cell,
            )
        self.occupancy = Occupancy(
            int(round(self.width / self.grid_bay)),
            int(round(self.depth / self.grid_bay)),
            self.grid_bay,
            self.rect[0],
            self.rect[1],
        )
        self.placements = []
        self.supports = []
        self.volumes = []
        self.axis_fingerprint = {}
        # `variantSeed` entra en el estado y la etiqueta fija el orden de sorteo: dos ejes con el
        # mismo número no reparten igual, y cambiar el orden de los ejes cambia el edificio (a
        # propósito: el orden es parte del contrato de reproducibilidad, §13).
        self.rng = document.random_for(
            self.variant_seed, f"{self.building_type}|{self.family}|{self.composer_version}"
        )

    # -- construcción ------------------------------------------------------------------------------

    def build(self):
        choices = draw_choices(self.rng, self.record, self.document.variant_axes)
        corner = option_by_id(self.record["cornerModes"], choices["cornerTreatment"], "cornerModes")
        choices["corner"] = corner
        self.choices = choices
        self.corner = corner
        palette = option_by_id(self.record["facadePalettes"], choices["facade"], "facadePalettes")
        rhythm = option_by_id(self.record["rhythms"], choices["bay_sequence"], "rhythms")
        self.bay = float(rhythm["bayMeters"])
        if self.bay not in self.profile.bay_options:
            raise CompositionError(
                f"{rhythm['id']}: crujía de {self.bay} m fuera de la retícula del perfil "
                f"{self.profile.id} {self.profile.bay_options}"
            )
        massing = option_by_id(self.record["massingOptions"], choices["massing"], "massingOptions")
        silhouette = option_by_id(
            self.record["silhouetteOptions"], choices["silhouette"], "silhouetteOptions"
        )
        roof = option_by_id(self.record["roofOptions"], choices["roof"], "roofOptions")
        access = option_by_id(self.record["accessOptions"], choices["access"], "accessOptions")
        secondary = option_by_id(
            self.record["secondaryOptions"], choices["secondary_volume"], "secondaryOptions"
        )

        for spec in massing["volumes"]:
            self.volumes.append(self._resolve_volume(spec))
        for volume in self.volumes:
            self._build_volume(volume, palette, rhythm, silhouette, corner)
        for volume in self.volumes:
            self._build_roof(volume, roof)
        self._build_access(access, corner)
        
        # V.g: garantizar requiredFeatures de la receta ANTES del secondary normal
        # para que tengan prioridad en el espacio disponible
        required_features = choices.get("requiredFeatures", [])
        variant_features = choices.get("variantFeatures", [])
        self._build_required_features(required_features, variant_features, choices["propSlots"])
        
        secondary_placed = self._build_secondary(secondary)
        self._build_props(choices["intrinsic_props"], choices["propSlots"])

        self.axis_fingerprint = {
            "recipe": choices.get("recipe", "none"),
            "massing": massing["id"],
            "bay_sequence": f"{rhythm['id']}@{choices['rhythmOffset']}",
            "roof": roof["id"],
            "access": f"{access['id']}@{self.access_bay}",
            # Un secundario opcional que no cabe no deja geometría: el eje se firma como no resuelto
            # para que §16 no cuente como diferencia un cambio que el render no muestra.
            "secondary_volume": secondary["id"] + ("" if secondary_placed else "/sin_hueco"),
            "facade": palette["id"],
            "silhouette": f"{silhouette['id']}/{corner['id']}",
            "intrinsic_props": "+".join(sorted(choices["intrinsic_props"])) or "none",
        }
        self._check_semantic_identity(access, roof, secondary, secondary_placed)
        return self.finalize()

    def _check_semantic_identity(self, access, roof, secondary, secondary_placed):
        """R3: la gramática no sólo produce geometría válida, produce un edificio RECONOCIBLE.

        El validador técnico (§15/§17/§18) comprueba bounds, triángulos y apoyo en suelo. Eso no
        sabe qué hace que una casa sea una casa o que una cementera sea una cementera. El
        responsable documentó en `c1a635b` dos fallos de identidad que pasaban todos los checks:
        una hilera residencial con chimenea industrial plantada en el suelo a 6 m del edificio,
        y una cementera que perdía sus silos y salía como nave comercial acristalada.

        Las reglas viven en la gramática, no aquí, para que un cambio de identidad sea un diff de
        datos y no una edición del compositor. Este método sólo sabe leerlas y aplicarlas.

        V.g endurecido: se añaden requireAll, requireGroundCommercial, prohibitRhythmIds,
        requireRoleCount, requireAccessIds, requireRhythmIds, requireMassingIds.
        """
        rules = self.record.get("semanticIdentity")
        if not rules:
            return
        placed_roles = {record["role"] for record in self.placements}
        placed_modules = {record["moduleId"] for record in self.placements}
        problems = []

        # --- requireRoles: cada rol de la lista debe estar presente ---
        for role in rules.get("requireRoles", []):
            if role not in placed_roles:
                problems.append(f"falta el rol obligatorio `{role}`")

        # --- requireAnyRoles: al menos un rol de cada sublista ---
        for any_roles in rules.get("requireAnyRoles", []):
            if not placed_roles & set(any_roles):
                problems.append(
                    "no hay ningún rol de la familia identitaria "
                    + "/".join(f"`{r}`" for r in any_roles)
                )

        # --- requireAll (V.g): TODOS los roles de cada sublista deben estar presentes ---
        for all_group in rules.get("requireAll", []):
            missing = [r for r in all_group if r not in placed_roles]
            if missing:
                problems.append(
                    "faltan roles obligatorios (requireAll): "
                    + ", ".join(f"`{r}`" for r in missing)
                )

        # --- requireRoofKinds ---
        for kind in rules.get("requireRoofKinds", []):
            if roof["kind"] not in kind:
                problems.append(
                    f"la cubierta `{roof['id']}` (kind `{roof['kind']}`) no es residencial: "
                    + "exigida en "
                    + "/".join(f"`{k}`" for k in kind)
                )
                break

        # --- requireDomesticAccess ---
        if not access.get("domestic", True) and rules.get("requireDomesticAccess"):
            problems.append(f"el acceso `{access['id']}` no es doméstico")

        # --- prohibitSecondaryModules ---
        prohibited_modules = set(rules.get("prohibitSecondaryModules", []))
        if secondary_placed and secondary.get("module") in prohibited_modules:
            problems.append(
                f"el secundario `{secondary['id']}` usa el módulo industrial "
                f"`{secondary['module']}`, prohibido en esta familia"
            )

        # --- prohibitAccessIds ---
        prohibited_access = set(rules.get("prohibitAccessIds", []))
        if access["id"] in prohibited_access:
            problems.append(f"el acceso `{access['id']}` está prohibido en esta familia")

        # --- requireSecondaryPlaced ---
        if rules.get("requireSecondaryPlaced") and not secondary_placed:
            problems.append(
                f"el secundario `{secondary['id']}` es obligatorio pero no cupo en la parcela "
                "(quedaría `sin_hueco` y el edificio perdería su identidad)"
            )

        # --- requireGroundCommercial (V.g): planta baja con lenguaje comercial real ---
        if rules.get("requireGroundCommercial"):
            commercial_roles = {"curtain_wall", "awning", "shopfront"}
            ground_commercial = any(
                record["role"] in commercial_roles
                and record.get("purpose", "").startswith("band:front:level1:")
                for record in self.placements
            )
            if not ground_commercial:
                problems.append(
                    "planta baja sin lenguaje comercial real "
                    "(se exige curtain_wall, shopfront o awning en band:front:level1)"
                )

        # --- prohibitRhythmIds (V.g): el rhythm sorteados no debe estar en la lista negra ---
        rhythm_id = self.choices.get("bay_sequence")
        prohibited_rhythms = set(rules.get("prohibitRhythmIds", []))
        if rhythm_id in prohibited_rhythms:
            problems.append(
                f"el rhythm `{rhythm_id}` está prohibido en esta familia"
            )

        # --- requireAccessIds (V.g): el acceso debe estar en la lista permitida ---
        required_access_ids = rules.get("requireAccessIds")
        if required_access_ids and access["id"] not in required_access_ids:
            problems.append(
                f"el acceso `{access['id']}` no es monumental; "
                "se exige uno de: " + ", ".join(f"`{a}`" for a in required_access_ids)
            )

        # --- requireRhythmIds (V.g): el rhythm debe estar en la lista permitida ---
        required_rhythm_ids = rules.get("requireRhythmIds")
        if required_rhythm_ids and rhythm_id not in required_rhythm_ids:
            problems.append(
                f"el rhythm `{rhythm_id}` no está en la lista permitida: "
                + ", ".join(f"`{r}`" for r in required_rhythm_ids)
            )

        # --- requireMassingIds (V.g): el massing debe estar en la lista permitida ---
        massing_id = self.choices.get("massing")
        required_massing_ids = rules.get("requireMassingIds")
        if required_massing_ids and massing_id not in required_massing_ids:
            problems.append(
                f"el massing `{massing_id}` no está en la lista permitida: "
                + ", ".join(f"`{m}`" for m in required_massing_ids)
            )

        # --- requireRoleCount (V.g): contar instancias de un rol y comparar ---
        for role, count_spec in rules.get("requireRoleCount", {}).items():
            actual_count = sum(1 for r in self.placements if r["role"] == role)
            if ">=" in str(count_spec):
                required = int(str(count_spec).replace(">=", "").strip())
                if actual_count < required:
                    problems.append(
                        f"rol `{role}` requiere >= {required} instancias, tiene {actual_count}"
                    )
            elif "==" in str(count_spec):
                required = int(str(count_spec).replace("==", "").strip())
                if actual_count != required:
                    problems.append(
                        f"rol `{role}` requiere == {required} instancias, tiene {actual_count}"
                    )

        if problems:
            raise CompositionError(
                "SEMANTIC_IDENTITY_INCOMPLETE [" + self.family + "]: " + "; ".join(problems)
            )

    def _resolve_volume(self, spec):
        x0, y0, wide, deep = spec["cells"]
        if x0 < 0 or y0 < 0 or x0 + wide > self.footprint_cells["width"]:
            raise CompositionError(f"§17: el volumen {spec['cells']} se sale del solar en X")
        if y0 < 0 or y0 + deep > self.footprint_cells["height"]:
            raise CompositionError(f"§17: el volumen {spec['cells']} se sale del solar en Y")
        if y0 < self.yard_front_cells:
            raise CompositionError(
                f"§17: el volumen {spec['cells']} invade la franja frontal reservada por la gramática"
            )
        build = spec["build"]
        if build not in ("bands", "whole"):
            raise CompositionError(f"§19: modo de volumen inexistente {build}")
        if build == "whole":
            if spec["stackOn"] is not None:
                raise CompositionError("§15: un volumen entero no se apila: su masa la define la fuente")
            if spec["slab"]:
                raise CompositionError("un volumen entero ya trae su suelo: la losa quedaría empotrada")
        elif spec["slab"] and spec["stackOn"] is not None:
            raise CompositionError("un volumen apilado forja sobre la cubierta de su padre, no sobre otra losa")
        levels = self.levels if spec["levels"] == "domain" else int(spec["levels"])
        if levels < 1:
            raise CompositionError("un volumen sin plantas no es un edificio")
        return {
            "cells": list(spec["cells"]),
            "rect": (
                self.rect[0] + x0 * self.cell,
                self.rect[1] + y0 * self.cell,
                self.rect[0] + (x0 + wide) * self.cell,
                self.rect[1] + (y0 + deep) * self.cell,
            ),
            "levels": levels,
            "slab": spec["slab"],
            "stackOn": spec["stackOn"],
            "build": build,
            "role": spec["role"],
            "module": spec["module"],
        }

    def add(self, module, angle, position, purpose):
        record = {
            "moduleId": module.id,
            "role": module.role,
            "sourceId": module.source_id,
            "sourcePath": module.source_path,
            "license": module.license,
            "rotationDegrees": int(angle),
            "position": [_round(value) for value in position],
            "bounds": anchors.placed_bounds(module, angle, position),
            "triangles": module.triangles,
            "meshObjects": len(module.selected_objects),
            "elevationReach": self.profile.elevation_reach(module),
            "purpose": purpose,
        }
        self.placements.append(record)
        return record

    def add_on_face(self, module, side, along, face_line, z, purpose, projection=0.0):
        """Módulo de fachada: su cara exterior en el plano de fachada, desplazado `projection`.

        `projection` > 0 saca el módulo hacia la calle (cornisas, toldos); < 0 lo esconde dentro del
        marco (la hoja de puerta detrás del marco, para que nunca haya dos caras coplanares).
        """
        angle = anchors.rotation_for(module, side)
        shift = anchors.inward_offset(module, angle, side) - projection
        position = (along, face_line + shift, z) if side in ("front", "rear") else (
            face_line + shift,
            along,
            z,
        )
        return self.add(module, angle, position, purpose)

    def band_inset(self, corner):
        return float(corner["widthMeters"] or 0.0)

    def band_bays(self, rect, side, corner):
        inset = self.band_inset(corner)
        start, end = (
            (rect[0] + inset, rect[2] - inset)
            if side in ("front", "rear")
            else (rect[1] + inset, rect[3] - inset)
        )
        span = end - start
        if span < -1e-6:
            raise CompositionError(f"§17: el lado {side} no cabe con postes de esquina")
        count = int(round(span / self.bay))
        if abs(count * self.bay - span) > 1e-6:
            raise CompositionError(
                f"el lado {side} mide {span:.3f} m y no se reparte en crujías de {self.bay} m"
            )
        return [start + self.bay * (index + 0.5) for index in range(count)]

    def _build_volume(self, volume, palette, rhythm, silhouette, corner):
        rect = volume["rect"]
        base = 0.0
        if volume["stackOn"] is not None:
            parent = self.volumes[volume["stackOn"]] if volume["stackOn"] < len(self.volumes) else None
            if parent is None:
                raise CompositionError("stackOn referencia un volumen que todavía no existe")
            base = parent["top"]
            inner, outer = parent["rect"], rect
            if any(
                value
                for value in (
                    inner[0] - outer[0],
                    outer[2] - inner[2],
                    inner[1] - outer[1],
                    outer[3] - inner[3],
                )
                if value > 1e-6
            ):
                raise CompositionError("§17: un volumen apilado asoma fuera del volumen que lo sostiene")
        else:
            cells = self.occupancy.cells_for(rect[0], rect[2], rect[1], rect[3])
            if any(cell in self.occupancy.claimed for cell in cells):
                raise CompositionError("dos volúmenes del mismo solar se solapan en el suelo")
            for cell in cells:
                self.occupancy.claimed[cell] = "volume"
        volume["base"] = base
        if volume["build"] == "whole":
            self._build_whole_volume(volume)
            return
        volume["top"] = base + volume["levels"] * self.level
        if volume["slab"]:
            self._tile_flat(rect, base, "slab", "slab")
        faces = {"front": rect[1], "rear": rect[3], "left": rect[0], "right": rect[2]}
        for level_index in range(volume["levels"]):
            z = base + level_index * self.level
            is_top = level_index == volume["levels"] - 1
            for side in ("front", "rear", "left", "right"):
                tokens = rhythm["tokens"]["sides"] if side in ("left", "right") else rhythm["tokens"][side]
                for bay_index, along in enumerate(self.band_bays(rect, side, corner)):
                    token = tokens[(bay_index + self.choices["rhythmOffset"]) % len(tokens)]
                    if level_index == 0 and rhythm["groundRole"]:
                        token = rhythm["groundRole"]
                    # En un volumen de una sola planta el forjado bajo manda sobre la cornisa: un
                    # zócalo se lee, un pretil ciego taparía la única fila de ventanas.
                    if is_top and silhouette.get("crownRole") and volume["levels"] > 1:
                        token = silhouette["crownRole"]
                    module = self.catalog.pick(self.family, token, palette["roleModule"].get(token))
                    extent = module.size(anchors.rotation_for(module, side))[
                        0 if side in ("front", "rear") else 1
                    ]
                    if abs(extent - self.bay) > 1e-6:
                        raise CompositionError(
                            f"§17: {module.id} mide {extent} m de desarrollo y la banda va a "
                            f"{self.bay} m: la fachada quedaría solapada o con huecos"
                        )
                    self.add_on_face(
                        module,
                        side,
                        along,
                        faces[side],
                        z,
                        f"band:{side}:level{level_index + 1}:bay{bay_index + 1}",
                    )
        if corner["module"]:
            self._build_corner_posts(rect, base, volume["levels"], corner)
        if silhouette.get("corniceRole"):
            self._build_cornice(rect, volume["top"], silhouette, corner)

    def _build_corner_posts(self, rect, base, levels, corner):
        post = self.catalog.get(corner["module"])
        if abs(post.size(0)[0] - corner["widthMeters"]) > 1e-6:
            raise CompositionError(
                f"{post.id} mide {post.size(0)[0]} m de ancho y cornerModes declara "
                f"{corner['widthMeters']} m: las bandas dejarían de encajar"
            )
        half = corner["widthMeters"] / 2
        for name, (x, y) in {
            "front-left": (rect[0] + half, rect[1] + half),
            "front-right": (rect[2] - half, rect[1] + half),
            "rear-left": (rect[0] + half, rect[3] - half),
            "rear-right": (rect[2] - half, rect[3] - half),
        }.items():
            for level_index in range(levels):
                # Un poste de esquina es cuadrado y sin cara autorada: su giro no cambia la lectura.
                self.add(
                    post,
                    0,
                    (x, y, base + level_index * self.level),
                    f"corner:{name}:level{level_index + 1}",
                )

    def _build_cornice(self, rect, top, silhouette, corner):
        projection = float(silhouette.get("projectionMeters", 0.0))
        self._check_overhang(projection, f"cornisa {silhouette['id']}")
        module = self.catalog.pick(
            self.family, silhouette["corniceRole"], silhouette["corniceModule"]
        )
        faces = {"front": rect[1], "rear": rect[3], "left": rect[0], "right": rect[2]}
        for side in ("front", "rear", "left", "right"):
            for index, along in enumerate(self.band_bays(rect, side, corner)):
                self.add_on_face(
                    module, side, along, faces[side], top, f"cornice:{side}:{index + 1}", projection
                )

    def _check_overhang(self, projection, label):
        """El vuelo sale de la banda medida por el perfil de estilo, no de un gusto (§10)."""
        low, high = self.profile.roof_overhang_range
        if not low - 1e-6 <= projection <= high + 1e-6:
            raise CompositionError(
                f"§10: el vuelo de {label} ({projection} m) está fuera de la banda medida "
                f"[{low}, {high}] m del perfil {self.profile.id}"
            )

    def _build_roof(self, volume, roof):
        rect = volume["rect"]
        top = volume["top"]
        if volume["build"] == "whole" or roof["kind"] == "none":
            # La masa entera ya trae su cubierta; "none" es la cubierta plana sin losas de las naves.
            volume.setdefault("deck", top)
            volume["rise"] = 0.0
            return
        if roof["kind"] == "flat":
            self._tile_flat(rect, top, roof["plateRole"], "roof:flat")
            volume["deck"] = top
            volume["rise"] = 0.0
            return
        along = roof["ridgeAlong"]
        slope = self.catalog.pick(self.family, "slope_cornice" if roof["cornice"] else "slope")
        bounds = slope.placement_bounds
        run = bounds["y"]["max"] - bounds["y"]["min"]
        rise = bounds["z"]["max"] - bounds["z"]["min"]
        if abs(bounds["x"]["min"] + bounds["x"]["max"]) > DORMER_ROLLOUT_TOLERANCE_M:
            raise CompositionError(f"{slope.id}: la pendiente no es simétrica en X, no se puede titular")
        transverse = rect[3] - rect[1] if along == "x" else rect[2] - rect[0]
        rows = int(round(transverse / 2 / run))
        if rows < 1 or abs(rows * run - transverse / 2) > 1e-6:
            raise CompositionError(
                f"§17: la cubierta a dos aguas no cierra sobre {transverse} m con módulos de {run} m"
            )
        span = rect[2] - rect[0] if along == "x" else rect[3] - rect[1]
        columns = int(round(span / self.bay))
        if abs(columns * self.bay - span) > 1e-6:
            raise CompositionError("la cumbrera no se reparte en crujías enteras")
        dormers = []
        if roof["dormerBays"]:
            pool = self.catalog.pool(self.family, "dormer")
            wanted = min(int(roof["dormerBays"]), columns)
            dormers = [
                pool[self.rng.below(len(pool))]
                for _ in range(self.rng.below(wanted + 1))
            ]
        for side_index, side in enumerate(("near", "far")):
            for row in range(rows):
                z = top + row * rise
                for index in range(columns):
                    # Cada fila avanza `run` hacia la cumbrera y sube `rise`: la vertiente se arma
                    # peldaño a peldaño y la meseta de una fila empata con el alero de la siguiente.
                    inward = run / 2 + row * run
                    cross = rect[0] + self.bay * (index + 0.5)
                    if along == "x":
                        offset = (rect[1] + inward) if side == "near" else (rect[3] - inward)
                        position = (cross, offset, z)
                    else:
                        cross = rect[1] + self.bay * (index + 0.5)
                        offset = (rect[0] + inward) if side == "near" else (rect[2] - inward)
                        position = (offset, cross, z)
                    module = slope
                    if side_index == 0 and row == 0 and index < len(dormers):
                        module = dormers[index]
                    self.add(
                        module,
                        self._slope_angle(along, side, module),
                        position,
                        f"roof:{along}:{side}:row{row}:bay{index}",
                    )
        volume["deck"] = top + rows * rise
        volume["rise"] = rows * rise
        volume["slope"] = {"along": along, "run": run, "rise": rise, "rows": rows}
        volume["ridgeAlong"] = along
        volume["ridgeOffset"] = 0.0

    def _slope_angle(self, along, side, module):
        """Giro de cada vertiente: el alero es el extremo opuesto a la cara autorada medida.

        La sonda de vértices de V.f.3 muestra que `Roof_Slate_Center` tiene el pie de agua en -Y
        (z=0) y la meseta de cumbrera en +Y (z=3), y que el catálogo le declara `frontAxis` +Y. Con
        cumbrera en X, la vertiente frontal (la que asoma a la calle, -Y) va sin girar y la trasera
        180°; con cumbrera en Y la cara autorada mira hacia +X o -X, es decir 270° y 90°.
        """
        if module.front_axis == "symmetric-Y":
            raise CompositionError(
                f"{module.id}: sin cara autorada no se sabe por dónde cae el alero de la pendiente"
            )
        eave_at_minus_y = module.front_axis == "+Y"
        if along == "x":
            near, far = (0, 180) if eave_at_minus_y else (180, 0)
            return near if side == "near" else far
        near, far = (270, 90) if eave_at_minus_y else (90, 270)
        return near if side == "near" else far

    def _build_whole_volume(self, volume):
        """Masa entera de una fuente licenciada (§19: kitbashing, no cubos).

        La pieza no se escala ni se corta: se busca el primer giro que quepa en el volumen y se
        centra. Su techo es el techo de la fuente, así que la cubierta de la gramática no la toca.
        """
        module = self.catalog.pick(self.family, volume["role"], volume["module"])
        rect = volume["rect"]
        span_x, span_y = rect[2] - rect[0], rect[3] - rect[1]
        fitting = [
            angle
            for angle in module.rotations
            if module.size(angle)[0] <= span_x + 1e-6 and module.size(angle)[1] <= span_y + 1e-6
        ]
        if not fitting:
            raise CompositionError(
                f"§17: {module.id} mide {module.size(0)[0]}×{module.size(0)[1]} m y no cabe en un "
                f"volumen de {span_x}×{span_y} m"
            )
        angle = fitting[0]
        record = self.add(
            module, angle, ((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2, volume["base"]),
            f"whole:{module.id}",
        )
        volume["top"] = record["bounds"]["z"]["max"]
        volume["deck"] = volume["top"]
        volume["rise"] = 0.0
        volume["levels"] = max(1, math.ceil((volume["top"] - volume["base"]) / self.level))

    def _square_plates(self, role):
        """Placas cuadradas de la familia (losas de cubierta y de forjado), por lado.

        Sólo entran las de 2 y 4 m: son la retícula que publica el perfil, así que un solar par o
        impar se repeina siempre sin cortar módulos (§17: la huella no se modifica). El pool está
        ordenado por id, así que la pieza central se impone a las de esquina homónimas.
        """
        plates = {}
        for module in self.catalog.pool(self.family, role):
            width, depth, height = module.size(0)
            if height > 0.25 or abs(width - depth) > 1e-6:
                continue
            plates.setdefault(round(width, 3), module)
        for size in plates:
            if size not in (2.0, 4.0):
                raise CompositionError(f"{role}: placa de {size} m fuera de la retícula del perfil")
        if 2.0 not in plates:
            raise CompositionError(f"la familia no tiene {role} de 2 m: ningún lado impar sería cubrible")
        return plates

    def _tile_flat(self, rect, z, role, purpose):
        """Repeinado voraz 4 m → 2 m: cubre el rectángulo exacto sin cortar módulos."""
        plates = self._square_plates(role)
        x = rect[0]
        while x < rect[2] - 1e-6:
            width = 4.0 if (x + 4.0 <= rect[2] + 1e-6 and 4.0 in plates) else 2.0
            y = rect[1]
            while y < rect[3] - 1e-6:
                depth = 4.0 if (y + 4.0 <= rect[3] + 1e-6 and 4.0 in plates) else 2.0
                module = plates[width] if width == depth else plates[2.0]
                self.add(
                    module,
                    0,
                    (x + width / 2, y + depth / 2, z),
                    f"{purpose}:{_round(x)}:{_round(y)}",
                )
                y += depth
            x += width

    def _access_volume(self, corner):
        """Primer volumen de bandas que asoma a la línea de edificación con hueco para la puerta.

        El acceso es la decisión jerárquica del alzado (§19/§21), así que tiene que caer en la banda
        que ve la calle: si el primer volumen de la lista estuviera retranqueado, la puerta quedaría
        oculta tras el volumen delantero y la variante sería ilegible a 256 px. Se exige además que
        ese frente tenga crujías, porque un volumen estrecho entre dos postes de esquina no las deja.
        """
        bands = [volume for volume in self.volumes if volume["build"] == "bands"]
        if not bands:
            raise CompositionError(
                "§19: sin volumen de bandas no hay acceso legible; la gramática debe dejar una banda"
            )
        for volume in bands:
            if abs(volume["rect"][1] - self.buildable[1]) > 1e-6:
                continue
            if self.band_bays(volume["rect"], "front", corner):
                return volume
        raise CompositionError(
            f"§19: la masa {self.choices['massing']} no deja frente accesible "
            f"con el modo de esquina {corner['id']}"
        )

    def _build_access(self, access, corner):
        """Acceso sobre la banda frontal: una masa entera ya trae su propia puerta.

        La crujía del acceso se sustituye (no se superpone) para que el hueco se lea; el marco manda
        la altura de puerta del perfil y la hoja queda detrás, nunca coplanar con el marco.
        """
        volume = self._access_volume(corner)
        rect = volume["rect"]
        bays = self.band_bays(rect, "front", corner)
        index = len(bays) // 2 if access["bayRule"] == "center" else self.rng.below(len(bays))
        self.access_bay = index
        along = bays[index]
        frame = self.catalog.pick(self.family, access["frameRole"])
        self._replace_front_bay(volume, along, frame, corner)
        if access["leafRole"]:
            leaf = self.catalog.pick(self.family, access["leafRole"])
            self.add_on_face(
                leaf, "front", along, rect[1], volume["base"], "access:leaf", projection=-0.02
            )
        if access["aboveRole"]:
            module = self.catalog.pick(self.family, access["aboveRole"])
            projection = float(access["projectionMeters"])
            self._check_overhang(projection, f"elementos sobre {access['id']}")
            self.add_on_face(
                module,
                "front",
                along,
                rect[1],
                float(self.profile.door_scale["heightMeters"]) + volume["base"],
                "access:above",
                projection,
            )
        if access["steps"]:
            if not self.front_strip:
                raise CompositionError(
                    "§17: la gramática pide escaleras de acceso sin reservar franja frontal; "
                    "apoyarían en el suelo fuera del solar"
                )
            module = self.catalog.pick(self.family, "access")
            depth = module.size(0)[1]
            # Las escaleras empiezan EN el plano de fachada y llegan hasta la calle: separarlas de la
            # puerta dejaría un hueco de patio entre el arranque de la escalera y el zaguán.
            y = volume["rect"][1] - depth / 2
            if y - depth / 2 < self.rect[1] - self.ground_tolerance:
                raise CompositionError(
                    f"§17: la franja frontal de {self.building_type} ({self.yard_front_cells} celdas) "
                    f"no da los {depth} m de fondo de {module.id}"
                )
            self.add(
                module, anchors.rotation_for(module, "front"), (along, y, 0.0), "access:steps"
            )

    def _replace_front_bay(self, volume, along, frame, corner):
        """Sustituye la crujía del acceso por el marco, sin dejar el panel detrás.

        Dos paneles coplanares en la misma fachada se ven como un parpadeo a 256 px; quitar el
        panel y poner el marco deja el hueco legible desde el primer render.

        El filtro de rol acepta cualquier módulo de fachada que pueda ocupar la planta baja:
        wall_panel y doorframe (caso estándar), pero también wainscot, ground_panel, curtain_wall
        y window_bay cuando el rhythm declara un groundRole distinto o el token cíclico cae en
        hueco en vez de muro. La comprobación de posición (front, level1, z=base, x=bay) ya
        garantiza que sólo se toca el panel exacto bajo el acceso.
        """
        rect = volume["rect"]
        facade_roles = {
            "wall_panel", "doorframe", "wainscot", "ground_panel", "curtain_wall", "window_bay",
        }
        removed = 0
        for record in list(self.placements):
            if not record["purpose"].startswith("band:front:level1:"):
                continue
            if record["bounds"]["z"]["min"] != _round(volume["base"]):
                continue
            if record["role"] not in facade_roles:
                continue
            # Comprobar que el panel está en la cara frontal del volumen de acceso, no en la de
            # otro volumen que comparta la misma línea de fachada (p.ej. base_and_tower: la base
            # tiene front en y=-4 y la torre en y=0; ambas generan paneles "band:front:level1"
            # con las mismas X y Z, pero el Y de los bounds distingue la cara de colocación).
            if abs(record["bounds"]["y"]["min"] - rect[1]) > 1e-6:
                continue
            center = (record["bounds"]["x"]["min"] + record["bounds"]["x"]["max"]) / 2
            if abs(center - along) < self.bay / 2 - 1e-6:
                self.placements.remove(record)
                removed += 1
        if removed != 1:
            raise CompositionError(f"el acceso no encontró su crujía de planta baja ({removed})")
        self.add_on_face(frame, "front", along, rect[1], volume["base"], "access:frame")

    def _secondary_centers(self):
        """Centros candidatos: cada celda libre y el punto medio entre dos celdas libres.

        Una nave de 8 m no cabe centrada en una celda de 2 m aunque sí entre cuatro celdas libres
        contiguas; sin los puntos medios módulos enteros válidos quedarían inhabilitados como volumen
        secundario y la variante se reduciría a ruido de fachada.
        
        V.g: solo se consideran celdas dentro de la zona construible (buildable), no del solar completo.
        """
        x0, y0, x1, y1 = self.buildable
        free = [
            cell for cell in self.occupancy.free_cells()
            if x0 <= self.occupancy.center_of(cell)[0] <= x1
            and y0 <= self.occupancy.center_of(cell)[1] <= y1
        ]
        centers = []
        for index, cell in enumerate(free):
            first = self.occupancy.center_of(cell)
            for other in free[index:]:
                point = (
                    (first[0] + self.occupancy.center_of(other)[0]) / 2,
                    (first[1] + self.occupancy.center_of(other)[1]) / 2,
                )
                if point not in centers:
                    centers.append(point)
        return centers

    def _cell_center(self, cell):
        """Centro de una celda del solar, en el mismo datum que los anclajes de §15."""
        return (
            self.rect[0] + (float(cell[0]) + 0.5) * self.cell,
            self.rect[1] + (float(cell[1]) + 0.5) * self.cell,
        )

    def _build_secondary(self, option):
        """Coloca el volumen secundario (y sus anclajes) en el solar.

        Devuelve si se ha colocado: un eje que no deja geometría no puede firmar como diferencia,
        porque §14 cuenta variantes por lo que se ve, no por lo que el sorteo pidió. Con `atCell` la
        gramática fija la celda — es lo que permite declarar un conducto o un zócalo que empata con la
        pieza medida, en vez de un cilindro suelto en un hueco aleatorio.
        """
        if not option.get("role"):
            for support in option.get("supports", []):
                self._add_support(support)
            return True
        module = self.catalog.pick(self.family, option["role"], option.get("module"))
        x0, y0, x1, y1 = self.buildable
        
        
        centers = (
            [self._cell_center(option["atCell"])]
            if option.get("atCell")
            else self._secondary_centers()
        )
        # V.g: filtrar centros para que estén dentro de la zona construible
        centers = [
            (cx, cy) for cx, cy in centers
            if x0 <= cx <= x1 and y0 <= cy <= y1
        ]
        
        
        for center_x, center_y in self.rng.sampled(centers, len(centers)):
            for angle in (0, 90, 180, 270):
                if angle not in module.rotations:
                    continue
                width_now, depth_now, _ = module.size(angle)
                if not _contained(center_x, width_now / 2, x0, x1):
                    continue
                if not _contained(center_y, depth_now / 2, y0, y1):
                    continue
                box = anchors.placed_bounds(module, angle, (center_x, center_y, 0.0))
                if self.occupancy.claim(option["id"], box):
                    self.add(module, angle, (center_x, center_y, 0.0), f"secondary:{option['id']}")
                    for support in option.get("supports", []):
                        self._add_support(support)
                    return True
        if option.get("optional") is False:
            raise CompositionError(
                f"§17: no cabe el volumen secundario {option['id']} dentro del solar"
            )
        return False

    def _build_facade_feature(self, feature):
        """V.g: coloca un facade feature integrado en la fachada.

        Un facade feature NO usa Occupancy ni _build_secondary(). Se ancla a un volumen objetivo
        (targetVolume) y se distribuye simétricamente a lo largo de la fachada, excluyendo el
        bay del acceso principal.

        REQUIRED SIGNIFICA REQUIRED: si count=6, deben colocarse exactamente 6 elementos por nivel.
        Si no caben, la composición falla explícitamente (no hay adaptación silenciosa).
        """
        module_id = feature["module"]
        role = feature["role"]
        side = feature["side"]
        count = feature["count"]
        levels = feature["levels"]
        distribution = feature["distribution"]
        target_volume_index = feature.get("targetVolume", 0)

        module = self.catalog.get(module_id)
        if module.role != role:
            raise CompositionError(
                f"§12: {module_id} tiene role={module.role} pero el feature pide role={role}"
            )

        if target_volume_index >= len(self.volumes):
            raise CompositionError(
                f"§12: targetVolume={target_volume_index} fuera de rango (hay {len(self.volumes)} volúmenes)"
            )

        volume = self.volumes[target_volume_index]
        rect = volume["rect"]
        corner = self.choices.get("corner", {"widthMeters": 0.0})

        if side in ("front", "rear"):
            face_line = rect[1] if side == "front" else rect[3]
            bays = self.band_bays(rect, side, corner)
        else:
            face_line = rect[0] if side == "left" else rect[2]
            bays = self.band_bays(rect, side, corner)

        if not bays:
            raise CompositionError(
                f"§12: facade feature en lado {side} no tiene crujías disponibles"
            )

        available_bays = [b for b in bays if not self._is_access_bay(b, side, rect)]
        if len(available_bays) < count:
            raise CompositionError(
                f"§12: facade feature requiere {count} módulos en lado {side} pero solo hay "
                f"{len(available_bays)} bays disponibles (excluyendo acceso)"
            )

        volume_levels = volume.get("levels", 1)
        if levels > volume_levels:
            raise CompositionError(
                f"§12: facade feature pide {levels} niveles pero el volumen objetivo solo tiene {volume_levels}"
            )

        if distribution == "symmetric":
            indices = self._symmetric_indices(available_bays, bays, count)
        else:
            raise CompositionError(f"§12: distribución {distribution} no soportada (solo symmetric)")

        placed_count = 0
        for level_index in range(levels):
            z = volume["base"] + level_index * self.level
            for bay_index in indices:
                along = bays[bay_index]
                self.add_on_face(
                    module,
                    side,
                    along,
                    face_line,
                    z,
                    f"facade_feature:{feature['id']}:{side}:level{level_index + 1}:bay{bay_index + 1}",
                )
                placed_count += 1

        expected_count = count * levels
        if placed_count != expected_count:
            raise CompositionError(
                f"§12: facade feature {feature['id']} colocó {placed_count} módulos pero debía colocar {expected_count}"
            )

    def _is_access_bay(self, bay_position, side, rect):
        """Determina si un bay coincide con el acceso principal."""
        if not hasattr(self, 'access_bay') or self.access_bay is None:
            return False
        if side != "front":
            return False
        if abs(rect[1] - self.buildable[1]) > 1e-6:
            return False
        corner = self.choices.get("corner", {"widthMeters": 0.0})
        bays = self.band_bays(rect, "front", corner)
        if self.access_bay >= len(bays):
            return False
        access_position = bays[self.access_bay]
        return abs(bay_position - access_position) < 1e-6

    def _symmetric_indices(self, available_bays, all_bays, count):
        """Selecciona count posiciones simétricas respecto al centro, excluyendo el acceso.

        Devuelve índices en all_bays (no en available_bays) para que el placement use las
        posiciones correctas.
        """
        if count == 0:
            return []
        
        if len(available_bays) < count:
            raise CompositionError(
                f"§12: distribución simétrica requiere {count} bays pero solo hay {len(available_bays)} disponibles"
            )
        
        # Convertir available_bays a índices en all_bays
        available_indices = []
        for avail_pos in available_bays:
            for idx, all_pos in enumerate(all_bays):
                if abs(avail_pos - all_pos) < 1e-6:
                    available_indices.append(idx)
                    break
        
        available_indices.sort()
        
        # Seleccionar count índices simétricamente
        center_idx = len(all_bays) / 2.0
        sorted_by_distance = sorted(
            available_indices,
            key=lambda idx: abs(idx - center_idx)
        )
        
        # Tomar los count más cercanos al centro
        selected = sorted(sorted_by_distance[:count])
        return selected

    def _build_required_features(self, required_features, variant_features, prop_slots):
        """V.g: coloca features obligatorios de la receta.

        Los requiredFeatures DEBEN colocarse exactamente (si no caben, fallo determinista).
        NO muta el manifiesto: trabaja con copias.
        V.g spike: variantFeatures se ignoran temporalmente para simplificar el contrato.
        """
        for feature in required_features:
            kind = feature["kind"]
            if kind == "facade":
                self._build_facade_feature(feature)
            elif kind == "secondary":
                option = option_by_id(
                    self.record["secondaryOptions"], feature["id"], "secondaryOptions (required)"
                )
                option_copy = dict(option)
                option_copy["optional"] = False
                self._build_secondary(option_copy)
            elif kind == "prop":
                prop_slots_copy = dict(prop_slots)
                prop_slots_copy[feature["id"]] = 0
                self._build_props([feature["id"]], prop_slots_copy)

    def _add_support(self, support):
        """Primitivas §15: solo conector, conducto, zócalo o base; nunca masa visible.

        Las coordenadas se dan en celdas del solar (relativas a la esquina frontal) para que la
        gramática no fije metros: el mismo soporte vale si el dominio cambia la huella.
        """
        kind = support["kind"]
        if kind not in self.document.support["allowedKinds"]:
            raise CompositionError(f"§15: soporte {kind} fuera del vocabulario de §15")
        origin_x, origin_y = self.rect[0], self.rect[1]
        anchor = [
            origin_x + float(support["cell"][0]) * self.cell,
            origin_y + float(support["cell"][1]) * self.cell,
            float(support["z"]) * self.level,
        ]
        if support["shape"] == "pipe":
            start = [
                anchor[0] + float(value) * self.cell for value in support["from"][0:2]
            ] + [anchor[2] + float(support["from"][2]) * self.level]
            end = [anchor[0] + float(value) * self.cell for value in support["to"][0:2]] + [
                anchor[2] + float(support["to"][2]) * self.level
            ]
            radius = float(support["radiusMeters"])
            segments = int(support.get("segments", 12))
            direction = [b - a for a, b in zip(start, end)]
            length = math.sqrt(sum(value * value for value in direction))
            if length < 1e-6:
                raise CompositionError("§15: un conducto de longitud cero no es soporte, es ruido")
            origin = [(a + b) / 2 for a, b in zip(start, end)]
            # Caja del cilindro: el segmento más el radio en los dos ejes perpendiculares. Un eje
            # alineado con el conducto no recibe radio (lo cubre la longitud), los demás sí.
            box = {}
            for axis, name in enumerate(("x", "y", "z")):
                span = abs(direction[axis]) / length
                low = min(start[axis], end[axis]) - (0.0 if span > 0.999 else radius)
                high = max(start[axis], end[axis]) + (0.0 if span > 0.999 else radius)
                box[name] = {"min": _round(low), "max": _round(high)}
            self.supports.append(
                {
                    "kind": kind,
                    "shape": "pipe",
                    "label": support["label"],
                    "start": [_round(value) for value in start],
                    "end": [_round(value) for value in end],
                    "origin": [_round(value) for value in origin],
                    "radiusMeters": radius,
                    "lengthMeters": _round(length),
                    "segments": segments,
                    "bounds": box,
                    # Un cilindro de `segments` caras laterales y dos tapas NGON triangula, medido
                    # como `len(p.vertices) - 2` por polígono (la métrica de §15), en 2·segments
                    # laterales + 2·(segments-2) de las tapas = 4·segments - 4. Declarar 4·segments
                    # contaba cada tapa como segments triángulos (abanico con vértice central), que
                    # Blender no genera: sobrecontaba 4 triángulos por conducto.
                    "triangles": 4 * segments - 4,
                    "purpose": support["purpose"],
                }
            )
            return
        if support["shape"] != "box":
            raise CompositionError(f"§15: forma de soporte no construida {support['shape']}")
        size = [float(value) * self.cell for value in support["sizeCells"]]
        size[2] = float(support["sizeCells"][2]) * self.level
        # `position` es el centro en XY y la BASE en Z: un soporte se apoia en una planta, igual que
        # los módulos del catálogo, así que `z` y `offset[2]` se leen en plantas del perfil.
        position = [
            anchor[0] + float(support["offset"][0]) * self.cell,
            anchor[1] + float(support["offset"][1]) * self.cell,
            anchor[2] + float(support["offset"][2]) * self.level,
        ]
        self.supports.append(
            {
                "kind": kind,
                "shape": "box",
                "label": support["label"],
                "sizeMeters": [_round(value) for value in size],
                "position": [_round(value) for value in position],
                "rotationZDegrees": int(support.get("rotationDegrees", 0)),
                "bounds": _box(
                    position[0] - size[0] / 2,
                    position[1] - size[1] / 2,
                    position[0] + size[0] / 2,
                    position[1] + size[1] / 2,
                    position[2],
                    position[2] + size[2],
                ),
                "triangles": 12,
                "purpose": support["purpose"],
            }
        )

    def _roof_target(self):
        """Volumen de bandas con la cubierta más grande: donde van los elementos de azotea.

        Las masas enteras no se calcables: su propia cubierta es la que los dibuja, y ponerles un
        depósito encima saldría atravesado porque su AABB superior no es una azotea practicable.
        """
        candidates = [
            volume
            for volume in self.volumes
            if volume["build"] == "bands" and volume.get("deck") is not None
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda volume: (volume["rect"][2] - volume["rect"][0]) *
                                                    (volume["rect"][3] - volume["rect"][1]))

    def _deck_slots(self, rect, module):
        """Verticales de la retícula cuya huella cabe entera dentro del volumen.

        Un módulo de azotea se apoya en el forjado: si su caja asoma por el canto del volumen, en el
        render flotaría sobre la acera (§17: la masa no puede crecer fuera de la huella). La retícula
        de crujías es la rejilla de colocación, pero sólo entran los cruces donde el módulo cabe; si
        ninguno cabe, se prueba el centro del volumen y, aun así fuera, la gramática falla.
        """
        width, depth, _ = module.size(0)
        slots_x = [
            center
            for center in self.band_bays(rect, "front", self.corner)
            if _contained(center, width / 2, rect[0], rect[2])
        ] or [(rect[0] + rect[2]) / 2]
        slots_y = [
            center
            for center in self.band_bays(rect, "left", self.corner)
            if _contained(center, depth / 2, rect[1], rect[3])
        ] or [(rect[1] + rect[3]) / 2]
        if not (
            _contained(slots_x[0], width / 2, rect[0], rect[2])
            and _contained(slots_y[0], depth / 2, rect[1], rect[3])
        ):
            raise CompositionError(
                f"§17: {module.id} ({width}×{depth} m) no cabe en la cubierta del volumen "
                f"{rect[2] - rect[0]:g}×{rect[3] - rect[1]:g} m"
            )
        return slots_x, slots_y

    def _surface_height(self, volume, x, y):
        """Cota de la cubierta en un punto del solar: la vertiente, no la cumbrera.

        Un panel solar o un condensador tienen que apoyar EN la pendiente que pisan. Firmarlos contra
        el alzado de la cumbrera los dejaría flotando sobre el alero en cuanto la cubierta no es plana
        (§17: la masa no crece fuera de lo que la fuente construye), y a 256 px un panel suspendido es
        un artefacto, no un detalle.
        """
        slope = volume.get("slope")
        if not slope:
            return volume["top"]
        rect = volume["rect"]
        if slope["along"] == "x":
            distance = min(y - rect[1], rect[3] - y)
        else:
            distance = min(x - rect[0], rect[2] - x)
        row = min(int(distance / slope["run"]), slope["rows"] - 1)
        return volume["top"] + (row + 1) * slope["rise"]

    def _build_props(self, chosen, slots):
        for prop_id in chosen:
            option = option_by_id(self.record["propOptions"], prop_id, "propOptions")
            slot = slots[prop_id]
            module = self.catalog.pick(self.family, option["role"], option["module"])
            volume = self._roof_target()
            rect = volume["rect"]
            centers_x, centers_y = self._deck_slots(rect, module)
            if option["at"] == "ridge":
                # `offset` es lo que la punta asoma por encima de la cumbrera; el pie queda enterrado
                # en la vertiente, que es como se apoyan las chimeneas reales de este catálogo.
                z = volume["deck"] + float(option["offset"]) - module.size(0)[2]
                if volume.get("ridgeAlong") == "x":
                    position = (centers_x[slot % len(centers_x)], (rect[1] + rect[3]) / 2, z)
                else:
                    position = ((rect[0] + rect[2]) / 2, centers_y[slot % len(centers_y)], z)
            else:
                center_x = centers_x[slot % len(centers_x)]
                center_y = centers_y[(slot // len(centers_x)) % len(centers_y)]
                position = (
                    center_x,
                    center_y,
                    self._surface_height(volume, center_x, center_y) + float(option["offset"]),
                )
            # Giro 0: un elemento técnico de azotea no tiene cara de lectura, y su orientación la fija
            # la fuente, no la gramática.
            self.add(module, 0, position, f"prop:{option['id']}")

    # -- salida ------------------------------------------------------------------------------------

    def signature(self):
        """Firma canónica §14: idéntico resultado ⇒ idéntica firma, sea cual sea el seed.

        Se firman los IDs de módulo, sus transformadas canónicas (posición redondeada y giro), los
        originales de soporte, el atlas que entra en escena y el perfil. El seed NO entra: dos seeds
        que producen el mismo edificio no son dos variantes, y esa es justo la comprobación de §14.
        """
        payload = {
            "buildingType": self.building_type,
            "family": self.family,
            "styleProfileId": self.style_profile_id,
            "composerVersion": self.composer_version,
            "footprintCells": self.footprint_cells,
            "levels": self.levels,
            "modules": [
                {
                    "id": record["moduleId"],
                    "r": record["rotationDegrees"],
                    "p": record["position"],
                    "q": record["purpose"],
                }
                for record in sorted(
                    self.placements, key=lambda item: (item["purpose"], item["moduleId"])
                )
            ],
            "supports": [
                {
                    "kind": record["kind"],
                    "shape": record["shape"],
                    "bounds": record["bounds"],
                }
                for record in self.supports
            ],
            "atlases": sorted(
                {
                    path
                    for record in self.placements
                    for path in self.catalog.modules[record["moduleId"]].images
                    if path.endswith((".png", ".jpg", ".jpeg"))
                }
            ),
        }
        blob = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()

    def finalize(self):
        boxes = [record["bounds"] for record in self.placements + self.supports]
        bounds = anchors.union(boxes)
        ground = [
            record["bounds"]
            for record in self.placements + self.supports
            if record["bounds"]["z"]["min"] < GROUND_Z_TOLERANCE_DEFAULT
        ]
        ground_box = anchors.union(ground) if ground else _box(0, 0, 0, 0, 0, 0)
        x0, y0, x1, y1 = self.rect
        outside = [
            name
            for name, (value, limit) in {
                "x min": (ground_box["x"]["min"], x0),
                "x max": (ground_box["x"]["max"], x1),
                "y min": (ground_box["y"]["min"], y0),
                "y max": (ground_box["y"]["max"], y1),
            }.items()
            if (value < limit - self.ground_tolerance if "min" in name else value > limit + self.ground_tolerance)
        ]
        if outside:
            raise CompositionError(
                f"§17: el contacto con el suelo se sale del solar por {', '.join(outside)} "
                f"(holgura {self.ground_tolerance} m)"
            )
        licensed = sum(record["triangles"] for record in self.placements)
        support = sum(record["triangles"] for record in self.supports)
        total = licensed + support
        share = support / total if total else 0.0
        ceiling = float(self.document.support["maxTrianglesShare"])
        if share > ceiling:
            raise CompositionError(
                f"§15: los soportes originales suman el {share:.1%} de los triángulos "
                f"(techo {ceiling:.0%}): la masa volvería a ser primitivas"
            )
        distinct = {record["moduleId"] for record in self.placements}
        sources = {record["sourceId"] for record in self.placements}
        ladders = sorted({record["elevationReach"] for record in self.placements})
        return {
            "buildingType": self.building_type,
            "family": self.family,
            "styleProfileId": self.style_profile_id,
            "composerVersion": self.composer_version,
            "variantSeed": self.variant_seed,
            "footprintCells": self.footprint_cells,
            "footprintMeters": {"width": self.width, "depth": self.depth},
            "levels": self.levels,
            "volumes": [
                {
                    "cells": volume["cells"],
                    "build": volume["build"],
                    "levels": volume["levels"],
                    "base": _round(volume["base"]),
                    "top": _round(volume["top"]),
                    "deck": _round(volume.get("deck", volume["top"])),
                }
                for volume in self.volumes
            ],
            "axisChoices": {axis: self.axis_fingerprint[axis] for axis in self.document.variant_axes},
            "placements": self.placements,
            "originalSupport": self.supports,
            "bounds": bounds,
            "envelopeMeters": anchors.size_of(bounds),
            "groundContactMeters": anchors.size_of(ground_box),
            "checks": {
                "groundContactInsideFootprint": True,
                "groundToleranceMeters": self.ground_tolerance,
                "distinctModuleIds": len(distinct),
                "distinctSources": len(sources),
                "supportTriangleShare": round(share, 4),
                "elevationTreatmentLadders": ladders,
            },
            "metrics": {
                "placements": len(self.placements),
                "meshObjects": sum(record["meshObjects"] for record in self.placements),
                "distinctModuleIds": len(distinct),
                "sources": sorted(sources),
                "triangles": total,
                "licensedTriangles": licensed,
                "supportTriangles": support,
                "licensedGeometryRatio": round(licensed / total, 4) if total else 0.0,
                "materials": sorted(
                    {
                        name
                        for record in self.placements
                        for name in self.catalog.modules[record["moduleId"]].materials
                    }
                ),
                "textures": sorted(
                    {
                        path
                        for record in self.placements
                        for path in self.catalog.modules[record["moduleId"]].images
                    }
                ),
            },
            "compositionSignature": self.signature(),
        }


def changed_axes(first, second, axes):
    """Ejes §16 que difieren entre dos candidatos ya construidos."""
    return [
        axis
        for axis in axes
        if first["axisChoices"][axis] != second["axisChoices"][axis]
    ]


def compose_candidate(request, catalog=None, profile=None, document=None):
    """Punto de entrada sin `bpy`: el mismo código corre en el test y dentro de Blender."""
    catalog = catalog if catalog is not None else Catalog()
    document = document if document is not None else GrammarDocument()
    profile = profile if profile is not None else StyleProfile(request["styleProfileId"])
    return Composition(catalog, profile, document, request).build()

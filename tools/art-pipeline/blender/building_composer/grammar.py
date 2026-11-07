"""Gramáticas del Building Composer: manifiesto curado + sorteo determinista de variantes.

La gramática es DATOS (regla de arquitectura: preferir datos configurables): qué volúmenes caben en
el solar, qué roles alimentan cada banda, qué cornisas y cubiertas existen, qué props son
intrínsecos. Lo que decide una variante se saca de una lista de opciones con el PRNG del seed, así
que la misma entrada reproduce el mismo edificio (§13) y un cambio de manifiesto se revisa en diff.

Este módulo valida el manifiesto contra el catálogo: una gramática que referencia un rol o módulo
inexistente falla al cargar, no a mitad de composición.
"""

import json
from pathlib import Path

from .module_catalog import REPO_ROOT, GrammarError
from .prng import SealedRandom

GRAMMAR_PATH = REPO_ROOT / "blender_artist/manifests/building-composer-grammars.json"

TOP_LEVEL_KEYS = {
    "schemaVersion",
    "composerVersion",
    "purpose",
    "provenance",
    "authority",
    "geometryEvidence",
    "frame",
    "prng",
    "treatment",
    "support",
    "variantAxes",
    "minimumChangedAxes",
    "grammars",
}
# V.g: separar claves obligatorias y opcionales para permitir migración gradual a recipes
REQUIRED_GRAMMAR_KEYS = {
    "buildingType",
    "family",
    "label",
    "notes",
    "yard",
    "levelsFromDomain",
    "cornerModes",
    "massingOptions",
    "facadePalettes",
    "rhythms",
    "silhouetteOptions",
    "roofOptions",
    "accessOptions",
    "propOptions",
    "secondaryOptions",
    "semanticIdentity",
}
OPTIONAL_GRAMMAR_KEYS = {
    "recipes",  # V.g: recetas arquitectónicas (opcional durante migración)
    "renderScale",  # V.i: densidad de render explícita por tipo (D-100 exige decisión explícita)
}
GRAMMAR_KEYS = REQUIRED_GRAMMAR_KEYS | OPTIONAL_GRAMMAR_KEYS
# Cada eje debe poder cambiar la geometría por sí solo: sin opción lista, el eje no puede variar.
AXIS_OPTIONS = {
    "massing": "massingOptions",
    "facade": "facadePalettes",
    "bay_sequence": "rhythms",
    "silhouette": "silhouetteOptions",
    "roof": "roofOptions",
    "access": "accessOptions",
    "intrinsic_props": "propOptions",
    "secondary_volume": "secondaryOptions",
}
YARD_KEYS = {"leftCells", "rightCells", "frontCells"}
MASSING_KEYS = {"id", "label", "volumes"}
VOLUME_KEYS = {"cells", "levels", "stackOn", "slab", "build", "role", "module"}
PALETTE_KEYS = {"id", "label", "roleModule"}
RHYTHM_KEYS = {"id", "label", "tokens", "bayMeters", "groundRole"}
SILHOUETTE_KEYS = {"id", "label", "corniceRole", "corniceModule", "crownRole", "projectionMeters"}
ROOF_KEYS = {"id", "kind", "cornice", "plateRole", "dormerBays", "ridgeAlong"}
ACCESS_KEYS = {
    "id",
    "label",
    "bayRule",
    "frameRole",
    "leafRole",
    "aboveRole",
    "projectionMeters",
    "steps",
}
PROP_KEYS = {"id", "label", "role", "module", "at", "offset"}
SECONDARY_KEYS = {"id", "label", "role", "module", "optional", "atCell", "supports"}
CORNER_KEYS = {"id", "label", "module", "widthMeters"}
REQUIRED_FEATURE_KEYS = {"kind", "id", "role"}
VARIANT_FEATURE_KEYS = {"kind", "id", "probability"}
FEATURE_KINDS = {"secondary", "prop", "facade"}  # V.g: facade para features integrados en fachada
FACADE_FEATURE_REQUIRED_KEYS = {"kind", "id", "role", "module", "side", "count", "levels", "distribution", "targetVolume"}
FACADE_FEATURE_KEYS = {
    "kind", "id", "role", "module", "side", "count", "levels", "distribution", "targetVolume",
    "startLevel", "projectionMeters"
}
FACADE_SIDES = {"front", "rear", "left", "right"}
FACADE_DISTRIBUTIONS = {"symmetric"}  # V.g spike: solo symmetric por ahora
RECIPE_KEYS = {
    "id", "label", "massingIds", "accessIds", "roofIds", "rhythmIds",
    "facadeIds", "silhouetteIds", "cornerModeIds", "requiredFeatures", "variantFeatures",
    "accessTargetVolume", "propIds", "secondaryIds"
}
SUPPORT_BASE_KEYS = {"kind", "shape", "label", "cell", "z", "purpose"}
SUPPORT_SHAPE_KEYS = {"pipe": {"from", "to", "radiusMeters", "segments"}, "box": {"sizeCells", "offset", "rotationDegrees"}}
SUPPORT_KINDS = {"base", "connector", "plinth", "pipe", "support"}
# §22: lo que el compositor puede pegar al edificio son elementos intrínsecos, y los intrínsecos viven
# SOBRE la masa. Todo lo que apoya en el suelo del solar (valla, jardín, acceso desde la acera, patio,
# palés, contenedores, vegetación) es contextual y lo pone `property-grounds` de V.d-7C, así que no es
# un destino de prop: aceptarlo aquí duplicaría el sistema que §22 prohíbe duplicar.
PROP_AT = {"ridge", "roof"}
BAY_RULES = {"center", "drawn"}
SEMANTIC_IDENTITY_KEYS = {
    "description",
    "requireRoles",
    "requireAnyRoles",
    "requireAll",
    "prohibitSecondaryModules",
    "prohibitAccessIds",
    "prohibitRhythmIds",
    "requireRoofKinds",
    "requireDomesticAccess",
    "requireGroundCommercial",
    "requireRoleCount",
    "requireAccessIds",
    "requireRhythmIds",
    "requireMassingIds",
    "requireSecondaryPlaced",
}


def _require_keys(record, allowed, label, where):
    unknown = set(record) - allowed
    if unknown:
        raise GrammarError(f"{where} ({label}): claves fuera del esquema {sorted(unknown)}")
    missing = allowed - set(record)
    if missing:
        raise GrammarError(f"{where} ({label}): faltan las claves {sorted(missing)}")


def _require_mandatory_keys(record, required, allowed, label, where):
    """V.g: validar claves obligatorias permitiendo adicionales opcionales.
    
    - required: claves que DEBEN estar presentes
    - allowed: todas las claves permitidas (required + optional)
    """
    # Verificar que no haya claves fuera del esquema permitido
    unknown = set(record) - allowed
    if unknown:
        raise GrammarError(f"{where} ({label}): claves fuera del esquema {sorted(unknown)}")
    # Verificar que todas las claves obligatorias estén presentes
    missing = required - set(record)
    if missing:
        raise GrammarError(f"{where} ({label}): faltan las claves obligatorias {sorted(missing)}")


class GrammarDocument:
    def __init__(self, path=GRAMMAR_PATH):
        self.raw = json.loads(Path(path).read_text(encoding="utf-8"))
        _require_keys(self.raw, TOP_LEVEL_KEYS, "manifiesto de gramáticas", "raíz")
        self.composer_version = self.raw["composerVersion"]
        self.frame = self.raw["frame"]
        self.variant_axes = self.raw["variantAxes"]
        self.minimum_changed_axes = self.raw["minimumChangedAxes"]
        self.support = self.raw["support"]
        self.treatment = self.raw["treatment"]
        self.prng = self.raw["prng"]
        if set(self.support["allowedKinds"]) - SUPPORT_KINDS:
            raise GrammarError(
                f"§15: kinds de soporte fuera del vocabulario {sorted(self.support['allowedKinds'])}"
            )
        if set(self.variant_axes) != set(AXIS_OPTIONS):
            raise GrammarError(
                "variantAxes debe declarar exactamente el vocabulario de §16, ni un eje menos"
            )

    def random_for(self, seed, label):
        return SealedRandom(seed, label)

    def grammar(self, building_type, catalog, profile):
        record = self.raw["grammars"].get(building_type)
        if record is None:
            raise GrammarError(f"no hay gramática para {building_type}")
        # V.g: validar claves obligatorias y permitir opcionales
        _require_mandatory_keys(
            record, REQUIRED_GRAMMAR_KEYS, GRAMMAR_KEYS, 
            record["label"], f"grammars.{building_type}"
        )
        if record["buildingType"] != building_type:
            raise GrammarError(f"{building_type}: la gramática se autodenomina {record['buildingType']}")
        if "renderScale" in record:
            scale = record["renderScale"]
            if not isinstance(scale, (int, float)) or isinstance(scale, bool) or scale < 1:
                raise GrammarError(f"{building_type}: renderScale debe ser un número >= 1, no {scale!r}")
        self._check_roles(record, catalog, profile)
        self._check_recipes(record, catalog, record["family"])  # V.g: validar recetas arquitectónicas
        return record

    def _check_roles(self, record, catalog, profile):
        family = record["family"]
        _require_keys(record["yard"], YARD_KEYS, record["label"], f"{record['buildingType']}.yard")
        for key, options in (
            ("massingOptions", record["massingOptions"]),
            ("facadePalettes", record["facadePalettes"]),
            ("rhythms", record["rhythms"]),
            ("silhouetteOptions", record["silhouetteOptions"]),
            ("roofOptions", record["roofOptions"]),
            ("accessOptions", record["accessOptions"]),
            # R5: `propOptions` admite lista vacía. Una familia residencial sin módulos de azotea
            # legítimos (AC, paneles, chimeneas industriales) prefiere no sortear el eje antes que
            # plantar un equipo comercial sobre una hilera doméstica.
            ("propOptions", record["propOptions"]),
            ("secondaryOptions", record["secondaryOptions"]),
            ("cornerModes", record["cornerModes"]),
        ):
            if not options and key != "propOptions":
                raise GrammarError(f"{record['buildingType']}.{key}: lista vacía, el eje no puede variar")
        for option in record["massingOptions"]:
            _require_keys(option, MASSING_KEYS, option["id"], "massingOptions")
            if not option["volumes"]:
                raise GrammarError(f"{option['id']}: opción de massing sin volúmenes")
            for volume in option["volumes"]:
                _require_keys(volume, VOLUME_KEYS, str(volume["cells"]), "massingOptions.volumes")
                if volume["levels"] != "domain" and int(volume["levels"]) < 1:
                    raise GrammarError(f"{option['id']}: un volumen necesita al menos una planta")
                if volume["build"] == "whole":
                    if not volume["role"]:
                        raise GrammarError(f"{option['id']}: un volumen entero necesita el rol de la fuente")
                    catalog.pick(family, volume["role"], volume["module"])
                elif volume["role"] or volume["module"]:
                    raise GrammarError(f"{option['id']}: un volumen de bandas no declara módulo entero")
        for palette in record["facadePalettes"]:
            _require_keys(palette, PALETTE_KEYS, palette["id"], "facadePalettes")
            for role, module_id in palette["roleModule"].items():
                catalog.pick(family, role, module_id)
        for rhythm in record["rhythms"]:
            _require_keys(rhythm, RHYTHM_KEYS, rhythm["id"], "rhythms")
            if float(rhythm["bayMeters"]) <= 0:
                raise GrammarError(f"{rhythm['id']}: bayMeters sin sentido {rhythm['bayMeters']}")
            if set(rhythm["tokens"]) != {"front", "rear", "sides"}:
                raise GrammarError(f"{rhythm['id']}: los tokens deben cubrir front, rear y sides")
            for side, tokens in rhythm["tokens"].items():
                if not tokens:
                    raise GrammarError(f"{rhythm['id']}.{side}: ritmo vacío")
                for token in tokens:
                    # El token ES el rol: la paleta decide qué módulo lo rellena.
                    catalog.pool(family, token)
            if rhythm["groundRole"]:
                catalog.pool(family, rhythm["groundRole"])
        for silhouette in record["silhouetteOptions"]:
            _require_keys(silhouette, SILHOUETTE_KEYS, silhouette["id"], "silhouetteOptions")
            if silhouette["corniceRole"]:
                catalog.pick(family, silhouette["corniceRole"], silhouette["corniceModule"])
            elif silhouette["corniceModule"]:
                raise GrammarError(f"{silhouette['id']}: corniceModule sin corniceRole")
            if silhouette["crownRole"]:
                catalog.pool(family, silhouette["crownRole"])
        self._check_band_widths(record, catalog)
        for roof in record["roofOptions"]:
            _require_keys(roof, ROOF_KEYS, roof["id"], "roofOptions")
            if roof["kind"] not in ("gable", "flat", "none"):
                raise GrammarError(f"{roof['id']}: tipo de cubierta no construido {roof['kind']}")
            if roof["ridgeAlong"] not in (None, "x", "y"):
                raise GrammarError(f"{roof['id']}: ridgeAlong inválido {roof['ridgeAlong']}")
            if roof["kind"] == "gable" and not roof["ridgeAlong"]:
                raise GrammarError(f"{roof['id']}: cubierta a dos aguas sin eje de cumbrera")
            if roof["kind"] == "flat":
                if not roof["plateRole"]:
                    raise GrammarError(f"{roof['id']}: cubierta plana sin rol de losa")
                catalog.pool(family, roof["plateRole"])
            elif roof["plateRole"]:
                raise GrammarError(f"{roof['id']}: {roof['kind']} no repeina losas")
            if roof["dormerBays"]:
                catalog.pool(family, "dormer")
            if roof["cornice"]:
                catalog.pool(family, "slope_cornice")
        for access in record["accessOptions"]:
            _require_keys(access, ACCESS_KEYS, access["id"], "accessOptions")
            if access["bayRule"] not in BAY_RULES:
                raise GrammarError(f"{access['id']}: bayRule inexistente {access['bayRule']}")
            for key in ("frameRole", "leafRole", "aboveRole"):
                if access[key]:
                    catalog.pool(family, access[key])
            if access["steps"]:
                catalog.pool(family, "access")
        for prop in record["propOptions"]:
            _require_keys(prop, PROP_KEYS, prop["id"], "propOptions")
            if prop["at"] not in PROP_AT:
                raise GrammarError(
                    f"{prop['id']}: colocación de prop inexistente {prop['at']} "
                    f"(§22: el patio contextual lo pone property-grounds, no el compositor)"
                )
            catalog.pick(family, prop["role"], prop["module"])
        for option in record["secondaryOptions"]:
            _require_keys(option, SECONDARY_KEYS, option["id"], "secondaryOptions")
            if option["role"]:
                catalog.pick(family, option["role"], option["module"])
            self._check_supports(option["supports"], catalog, option["id"])
        for mode in record["cornerModes"]:
            _require_keys(mode, CORNER_KEYS, mode["id"], "cornerModes")
            if mode["module"]:
                post = catalog.get(mode["module"])
                if post.role != "corner":
                    raise GrammarError(f"{mode['id']}: {post.id} no tiene rol corner")
        
        # V.g: validar semanticIdentity contra whitelist
        semantic_identity = record.get("semanticIdentity")
        if semantic_identity:
            unknown_keys = set(semantic_identity.keys()) - SEMANTIC_IDENTITY_KEYS
            if unknown_keys:
                raise GrammarError(
                    f"{record['buildingType']}.semanticIdentity: claves fuera del esquema "
                    f"{sorted(unknown_keys)}"
                )
        
        self._check_front_reach(record, profile)

    def _check_front_reach(self, record, profile):
        """§7/§19: un volumen de bandas tiene que dejar sitio real para el ritmo y para la puerta.

        Con postes de esquina de 2 m, un volumen de una celda (4 m) se convierte en dos pilares: no
        queda ni una crujía de fachada, así que el acceso se cae a mitad de composición según qué
        seed salga. El costado sí puede quedar a cero (es el muro ciego que remata una hilera), pero
        el frente no: §19/§21 piden entrada y ritmo EN la cara que ve la cámara. Se comprueba cada
        masa × cada modo de esquina × cada ritmo, y el ancho de crujía tiene que rellenar el vano
        exacto: un resto sería un panel a medias que la retícula del perfil no puede cubrir.
        """
        cell = profile.cell_meters
        bays = [float(rhythm["bayMeters"]) for rhythm in record["rhythms"]]
        for mode in record["cornerModes"]:
            inset = float(mode["widthMeters"] or 0.0)
            for option in record["massingOptions"]:
                for volume in option["volumes"]:
                    if volume["build"] != "bands":
                        continue
                    for side, cells in (
                        ("frente", volume["cells"][2]),
                        ("costado", volume["cells"][3]),
                    ):
                        span = cells * cell - 2 * inset
                        for bay in bays:
                            if abs(span / bay - round(span / bay)) > 1e-6:
                                raise GrammarError(
                                    f"§17: {option['id']}×{mode['id']}: el {side} de "
                                    f"{cells * cell:.1f} m no se reparte en crujías de {bay} m"
                                )
                        if side == "frente" and span < min(bays):
                            raise GrammarError(
                                f"§19: {option['id']}×{mode['id']}: el frente de {cells * cell:.1f} m "
                                f"con poste de {inset} m no deja ni una crujía de {min(bays)} m, "
                                "así que no habría ni ritmo ni acceso"
                            )

    def _check_band_widths(self, record, catalog):
        """Puerta geométrica de §11/§17: todo lo que repite una banda debe medir su crujía exacta.

        Un panel de 4 m en una crujía de 2 m solaparía al vecino; uno de 1,1 m dejaría un hueco al
        cielo. Ambas se ven como artefactos a 256 px y ninguna se puede defender ante la revisión
        humana, así que la combinación ritmo × paleta × silueta se comprueba al cargar el manifiesto,
        no a mitad de render.
        """
        family = record["family"]
        crowns = [item["crownRole"] for item in record["silhouetteOptions"] if item["crownRole"]]
        cornices = [
            (item["corniceRole"], item["corniceModule"])
            for item in record["silhouetteOptions"]
            if item["corniceRole"]
        ]
        for rhythm in record["rhythms"]:
            bay = float(rhythm["bayMeters"])
            roles = set()
            for tokens in rhythm["tokens"].values():
                roles.update(tokens)
            if rhythm["groundRole"]:
                roles.add(rhythm["groundRole"])
            for palette in record["facadePalettes"]:
                for role in sorted(roles | set(crowns)):
                    module = catalog.pick(family, role, palette["roleModule"].get(role))
                    if abs(module.size(0)[0] - bay) > 1e-6:
                        raise GrammarError(
                            f"{rhythm['id']}×{palette['id']}: {module.id} mide {module.size(0)[0]} m "
                            f"y la crujía es de {bay} m (dejaría solapes o huecos en la banda)"
                        )
            for role, module_id in cornices:
                module = catalog.pick(family, role, module_id)
                if abs(module.size(0)[0] - bay) > 1e-6:
                    raise GrammarError(
                        f"{rhythm['id']}: la cornisa {module.id} mide {module.size(0)[0]} m "
                        f"y la crujía es de {bay} m"
                    )

    def _check_recipes(self, record, catalog, family):
        """V.g: validar recetas arquitectónicas con contrato estricto.

        Cada receta debe declarar combinaciones compatibles de ejes y features obligatorios.
        Validación exhaustiva:
        - Recipe IDs únicos
        - Claves desconocidas rechazadas
        - Listas de ejes no vacías
        - IDs de ejes existentes
        - Required features completos y válidos
        - Facade features con targetVolume válido
        """
        recipes = record.get("recipes", [])
        if not recipes:
            return  # recetas opcionales
        
        recipe_ids = set()
        massing_ids = {m["id"] for m in record["massingOptions"]}
        access_ids = {a["id"] for a in record["accessOptions"]}
        roof_ids = {r["id"] for r in record["roofOptions"]}
        rhythm_ids = {r["id"] for r in record["rhythms"]}
        facade_ids = {f["id"] for f in record["facadePalettes"]}
        silhouette_ids = {s["id"] for s in record["silhouetteOptions"]}
        secondary_ids = {s["id"] for s in record["secondaryOptions"]}
        prop_ids = {p["id"] for p in record["propOptions"]}
        corner_mode_ids = {c["id"] for c in record["cornerModes"]}
        
        for recipe in recipes:
            # Rechazar claves desconocidas
            unknown_keys = set(recipe.keys()) - RECIPE_KEYS
            if unknown_keys:
                raise GrammarError(
                    f"receta: claves desconocidas {sorted(unknown_keys)}"
                )
            
            # id y label obligatorios
            if "id" not in recipe:
                raise GrammarError(f"receta: falta id obligatorio")
            if "label" not in recipe:
                raise GrammarError(f"receta {recipe['id']}: falta label obligatorio")
            
            recipe_id = recipe["id"]
            
            # IDs únicos
            if recipe_id in recipe_ids:
                raise GrammarError(f"receta: ID duplicado {recipe_id}")
            recipe_ids.add(recipe_id)
            
            # Validar listas de ejes no vacías y IDs existentes
            axis_map = {
                "massingIds": (massing_ids, "massing"),
                "accessIds": (access_ids, "access"),
                "roofIds": (roof_ids, "roof"),
                "rhythmIds": (rhythm_ids, "rhythm"),
                "facadeIds": (facade_ids, "facade"),
                "silhouetteIds": (silhouette_ids, "silhouette"),
                "cornerModeIds": (corner_mode_ids, "cornerMode"),
                "secondaryIds": (secondary_ids, "secondary"),
                "propIds": (prop_ids, "prop"),
            }
            
            for axis_key, (valid_ids, axis_name) in axis_map.items():
                if axis_key not in recipe:
                    continue  # eje opcional no declarado
                ids_list = recipe[axis_key]
                if axis_key != "propIds" and ids_list is not None and len(ids_list) == 0:
                    raise GrammarError(
                        f"receta {recipe_id}: {axis_key} declarada pero vacía"
                    )
                for axis_id in ids_list:
                    if axis_id not in valid_ids:
                        raise GrammarError(
                            f"receta {recipe_id}: {axis_name}Id inexistente {axis_id}"
                        )
            
            # Validar requiredFeatures
            if "requiredFeatures" in recipe:
                required_features = recipe["requiredFeatures"]
                if required_features is not None and len(required_features) == 0:
                    raise GrammarError(
                        f"receta {recipe_id}: requiredFeatures declarada pero vacía"
                    )
                
                for feature in required_features:
                    self._validate_feature(feature, recipe_id, "required", secondary_ids, prop_ids, record, catalog, family)
            
            # Validar variantFeatures
            if "variantFeatures" in recipe:
                variant_features = recipe["variantFeatures"]
                if variant_features is not None and len(variant_features) == 0:
                    raise GrammarError(
                        f"receta {recipe_id}: variantFeatures declarada pero vacía"
                    )
                
                for feature in variant_features:
                    self._validate_feature(feature, recipe_id, "variant", secondary_ids, prop_ids, record, catalog, family)
    
    def _validate_feature(self, feature, recipe_id, context, secondary_ids, prop_ids, record, catalog=None, family=None):
        """Valida un feature (required o variant) con contrato estricto.

        Cuando se dispone de `catalog`+`family` se comprueban aquí, en carga del manifiesto,
        las invariantes estáticas del facade feature (módulo existe, familia permitida, rol
        coincide). Una gramática incorrecta debe fallar antes de dibujar cualquier placement.
        """
        if "kind" not in feature or "id" not in feature:
            raise GrammarError(
                f"receta {recipe_id} {context}Feature: falta kind o id"
            )
        
        if feature["kind"] not in FEATURE_KINDS:
            raise GrammarError(
                f"receta {recipe_id} {context}Feature: kind inexistente {feature['kind']}"
            )
        
        if feature["kind"] == "secondary" and feature.get("id") not in secondary_ids:
            raise GrammarError(
                f"receta {recipe_id} {context}Feature: secondary inexistente {feature['id']}"
            )
        
        if feature["kind"] == "prop" and feature.get("id") not in prop_ids:
            raise GrammarError(
                f"receta {recipe_id} {context}Feature: prop inexistente {feature['id']}"
            )
        
        if feature["kind"] == "facade":
            _require_mandatory_keys(
                feature,
                FACADE_FEATURE_REQUIRED_KEYS,
                FACADE_FEATURE_KEYS | {"probability"},
                feature["id"],
                f"receta {recipe_id} {context}Feature facade",
            )
            
            if feature["side"] not in FACADE_SIDES:
                raise GrammarError(
                    f"receta {recipe_id} {context}Feature: facade side inválida {feature['side']}"
                )
            
            if feature["distribution"] not in FACADE_DISTRIBUTIONS:
                raise GrammarError(
                    f"receta {recipe_id} {context}Feature: facade distribution inválida {feature['distribution']}"
                )
            
            if feature["count"] <= 0:
                raise GrammarError(
                    f"receta {recipe_id} {context}Feature: facade count debe ser > 0"
                )
            
            if feature["levels"] <= 0:
                raise GrammarError(
                    f"receta {recipe_id} {context}Feature: facade levels debe ser > 0"
                )
            
            target_volume = feature.get("targetVolume", 0)
            if not isinstance(target_volume, int) or target_volume < 0:
                raise GrammarError(
                    f"receta {recipe_id} {context}Feature: targetVolume debe ser entero >= 0"
                )

            # V.g P1: validar módulo/familia/rol en load, no al componer.
            if catalog is not None and family is not None:
                module = catalog.get(feature["module"])
                if family not in module.families:
                    raise GrammarError(
                        f"receta {recipe_id} {context}Feature: módulo {module.id} "
                        f"no está permitido para la familia {family}"
                    )
                if module.role != feature["role"]:
                    raise GrammarError(
                        f"receta {recipe_id} {context}Feature: módulo {module.id} "
                        f"tiene role={module.role} pero el feature pide role={feature['role']}"
                    )

    def _check_supports(self, supports, catalog, label):
        for support in supports:
            shape = support.get("shape")
            if shape not in SUPPORT_SHAPE_KEYS:
                raise GrammarError(f"§15: forma de soporte no construida {shape} ({label})")
            _require_keys(
                support,
                SUPPORT_BASE_KEYS | SUPPORT_SHAPE_KEYS[shape],
                support["label"],
                f"soportes de {label}",
            )
            if support["kind"] not in SUPPORT_KINDS:
                raise GrammarError(f"§15: kind de soporte inexistente {support['kind']}")


def draw_choices(rng, record, axes):
    """Sorteo de variantes en un orden fijo de ejes (§13: el orden de sorteo es parte del contrato).

    V.g: si la gramática declara recetas, primero se sortea una receta y luego se restringen los ejes
    a las opciones compatibles con esa receta. Cada eje saca opción de SU lista filtrada; 
    `intrinsic_props` sortea además un subconjunto y un hueco por prop, porque un prop repetido en 
    otro sitio del alzado es otro edificio a efectos de silueta.
    """
    choices = {}
    
    # V.g: seleccionar receta primero si existe
    recipes = record.get("recipes", [])
    recipe = None
    if recipes:
        recipe = rng.choice(recipes)
        choices["recipe"] = recipe["id"]
    
    for axis in axes:
        options = record[AXIS_OPTIONS[axis]]
        
        # V.g: filtrar opciones por receta si aplica
        if recipe:
            axis_key = {
                "massing": "massingIds",
                "access": "accessIds",
                "roof": "roofIds",
                "bay_sequence": "rhythmIds",
                "facade": "facadeIds",
                "silhouette": "silhouetteIds",
                "intrinsic_props": "propIds",
                "secondary_volume": "secondaryIds",
            }.get(axis)
            if axis_key and axis_key in recipe:
                allowed_ids = set(recipe[axis_key])
                options = [o for o in options if o["id"] in allowed_ids]
            
            # V.g: para secondary_volume, excluir los required features de la receta
            # para evitar colocación duplicada
            if axis == "secondary_volume" and recipe.get("requiredFeatures"):
                required_secondary_ids = {
                    f["id"] for f in recipe["requiredFeatures"]
                    if f["kind"] == "secondary"
                }
                options = [o for o in options if o["id"] not in required_secondary_ids]
        
        if axis == "intrinsic_props":
            count = rng.below(len(options) + 1)
            choices[axis] = [option["id"] for option in rng.sampled(options, count)]
        else:
            choices[axis] = rng.choice(options)["id"]
    # El tratamiento de esquina es parte del eje de silueta (dos aguas iguales con poste de esquina
    # distinto se leen como edificios distintos), pero se sortea aparte para que §16 lo cuente junto.
    # V.g: si la receta declara cornerModeIds, sólo se sortea entre ellos.
    corner_options = record["cornerModes"]
    if recipe and "cornerModeIds" in recipe:
        allowed_corner_ids = set(recipe["cornerModeIds"])
        corner_options = [c for c in corner_options if c["id"] in allowed_corner_ids]
        if not corner_options:
            raise GrammarError(
                f"receta {recipe['id']}: cornerModeIds no coincide con ningún cornerMode disponible"
            )
    choices["cornerTreatment"] = rng.choice(corner_options)["id"]
    # El desfase de la retícula de crujías es geométrico, no una opción: cambia el orden del ritmo
    # sin cambiar el patrón, y es la diferencia entre dos alzados que comparten ritmo.
    choices["rhythmOffset"] = rng.below(8)
    choices["propSlots"] = {option["id"]: rng.below(64) for option in record["propOptions"]}
    
    # V.g: guardar requiredFeatures de la receta para que compose.py los garantice
    if recipe:
        choices["requiredFeatures"] = recipe.get("requiredFeatures", [])
        choices["variantFeatures"] = recipe.get("variantFeatures", [])
        if "accessTargetVolume" in recipe:
            choices["accessTargetVolume"] = recipe["accessTargetVolume"]
    
    return choices


def option_by_id(options, option_id, label):
    found = next((option for option in options if option["id"] == option_id), None)
    if found is None:
        raise GrammarError(f"{label}: opción inexistente {option_id}")
    return found

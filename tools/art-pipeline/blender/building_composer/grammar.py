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
GRAMMAR_KEYS = {
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
SUPPORT_BASE_KEYS = {"kind", "shape", "label", "cell", "z", "purpose"}
SUPPORT_SHAPE_KEYS = {"pipe": {"from", "to", "radiusMeters", "segments"}, "box": {"sizeCells", "offset", "rotationDegrees"}}
SUPPORT_KINDS = {"base", "connector", "plinth", "pipe", "support"}
# §22: lo que el compositor puede pegar al edificio son elementos intrínsecos, y los intrínsecos viven
# SOBRE la masa. Todo lo que apoya en el suelo del solar (valla, jardín, acceso desde la acera, patio,
# palés, contenedores, vegetación) es contextual y lo pone `property-grounds` de V.d-7C, así que no es
# un destino de prop: aceptarlo aquí duplicaría el sistema que §22 prohíbe duplicar.
PROP_AT = {"ridge", "roof"}
BAY_RULES = {"center", "drawn"}


def _require_keys(record, allowed, label, where):
    unknown = set(record) - allowed
    if unknown:
        raise GrammarError(f"{where} ({label}): claves fuera del esquema {sorted(unknown)}")
    missing = allowed - set(record)
    if missing:
        raise GrammarError(f"{where} ({label}): faltan las claves {sorted(missing)}")


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
        _require_keys(record, GRAMMAR_KEYS, record["label"], f"grammars.{building_type}")
        if record["buildingType"] != building_type:
            raise GrammarError(f"{building_type}: la gramática se autodenomina {record['buildingType']}")
        self._check_roles(record, catalog, profile)
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

    Cada eje saca opción de SU lista; `intrinsic_props` sortea además un subconjunto y un hueco por
    prop, porque un prop repetido en otro sitio del alzado es otro edificio a efectos de silueta.
    """
    choices = {}
    for axis in axes:
        options = record[AXIS_OPTIONS[axis]]
        if axis == "intrinsic_props":
            count = rng.below(len(options) + 1)
            choices[axis] = [option["id"] for option in rng.sampled(options, count)]
        else:
            choices[axis] = rng.choice(options)["id"]
    # El tratamiento de esquina es parte del eje de silueta (dos aguas iguales con poste de esquina
    # distinto se leen como edificios distintos), pero se sortea aparte para que §16 lo cuente junto.
    choices["cornerTreatment"] = rng.choice(record["cornerModes"])["id"]
    # El desfase de la retícula de crujías es geométrico, no una opción: cambia el orden del ritmo
    # sin cambiar el patrón, y es la diferencia entre dos alzados que comparten ritmo.
    choices["rhythmOffset"] = rng.below(8)
    choices["propSlots"] = {option["id"]: rng.below(64) for option in record["propOptions"]}
    return choices


def option_by_id(options, option_id, label):
    found = next((option for option in options if option["id"] == option_id), None)
    if found is None:
        raise GrammarError(f"{label}: opción inexistente {option_id}")
    return found

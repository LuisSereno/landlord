"""Proyección visual de conservación/envejecimiento sobre un candidato ya compuesto (D-111 WP04).

El contrato `blender_artist/manifests/building-weathering-contract.json` dice QUÉ material semántico
recibe qué tratamiento en qué estado y bajo qué mood. Este módulo lo valida al cargar y lo convierte
en nodos de shader. Dos cosas no hace, a propósito:

- **No toca geometría ni composición.** El daño físico (secciones, escombros, llama) ya lo produce el
  compositor (`compose.py:_compose_damage`) y el hollín lo aplica `scene.py:apply_soot`. Aquí sólo
  entra mugre superficial: si envejecer necesitara mover un vértice sería daño, y WP04 prohibe
  confundir los dos.
- **No se aplica si el request no lo pide.** Sin el campo `weathering` no se lee ni el JSON: los
  sprites aprobados del catálogo salen byte a byte como salen hoy.

Matemática del tier envejecido (por material, una sola vez —los materiales vienen compartidos entre
instancias—):

    cavity = ramp(invert(depth(mundo / tileMeters)))             juntas y poros
    patch  = ramp(noise(mapping(scale) · Position, noiseScale))  mancha / reguero
    grav   = map_range(Position.z, zLow..zHigh → 1..0)           la mugre baja
    mask   = min((max(cavity·w_c, patch·w_p) + base) · (1 + grav·boost), 1)
    fac    = mask · strength · strengthScale(mood)

Todo se muestrea sobre `Position` del nodo Geometry (metros de espacio mundo), nunca sobre UV: los
atlases de runtime (Kenney, MegaKit) comparten UV 0-1 entre decenas de superficies, así que un tiling
métrico por UV daría una densidad de mugre distinta en cada módulo del mismo edificio. La Z de mundo
sí es fiable: el marco del compositor pone el origen en el centro de la huella a nivel de suelo.

`bpy` es un import opcional: la mitad de este módulo es validación de datos y tiene que poder
comprobarse sin arrancar Blender (`test_building_weathering_contract.py`).
"""

import hashlib
import json
import os
import sys
from pathlib import Path

try:
    import bpy
except ImportError:  # validación fuera de Blender: sólo las funciones de shader lo necesitan
    bpy = None

HERE = Path(__file__).resolve().parent
BLENDER_DIR = HERE.parent
if str(BLENDER_DIR) not in sys.path:
    sys.path.insert(0, str(BLENDER_DIR))

# `REPO_ROOT` lo publica el catálogo: la ruta de la raiz no puede tener dos definiciones en el paquete.
from .module_catalog import REPO_ROOT  # noqa: E402

# `LANDLORD_ART_WEATHERING_CONTRACT` permite calibrar recetas en un manifiesto de trabajo sin tocar el
# publicado: el render registra el sha256 del archivo que usó, así que la evidencia dice siempre cuál fue.
CONTRACT_PATH = Path(
    os.environ.get("LANDLORD_ART_WEATHERING_CONTRACT")
    or REPO_ROOT / "blender_artist/manifests/building-weathering-contract.json"
)
# `damaged` y `burning` viven en el contrato como referencia del tier de daño, pero no son
# proyecciones de material: esos se eligen con `state` en el request. La lista la publica el JSON
# (`weatheringTokens`) para que el orquestador node y este módulo no mantengan cada uno la suya.
NODE_PREFIX = "WX_"


class WeatheringError(RuntimeError):
    """Contrato incompleto o derivación imposible: el render aborta en vez de adivinar."""


def _require(condition, message):
    if not condition:
        raise WeatheringError(message)


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_contract(path=CONTRACT_PATH):
    """Lee el contrato y comprueba los pins: si el vocabulario de familias cambió, hay que revalidarlo.

    Las familias semánticas no las declara este contrato: las mide `building-style-profiles.json`
    sobre `building-modules.json`. Sin estas dos sumas, añadir un módulo con un material nuevo
    dejaría el contrato incompleto en silencio.
    """
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    pins = document["pins"]
    catalog = REPO_ROOT / "blender_artist/manifests/building-modules.json"
    if pins["moduleCatalogSha256"] != sha256_file(catalog):
        raise WeatheringError(
            f"el contrato {document['id']} se escribió sobre otro catálogo de módulos "
            f"({pins['moduleCatalogSha256'][:12]}≠{sha256_file(catalog)[:12]}): vuelve a medir las "
            "familias antes de renderizar"
        )
    profiles = REPO_ROOT / "blender_artist/manifests/building-style-profiles.json"
    if pins["styleProfilesSha256"] != sha256_file(profiles):
        raise WeatheringError(
            f"el contrato {document['id']} se midió sobre otro perfil de estilo "
            f"({pins['styleProfilesSha256'][:12]}≠{sha256_file(profiles)[:12]})"
        )
    for path_key in ("styleLayer", "materialDecisions"):
        _require(
            (REPO_ROOT / pins[path_key]).is_file(),
            f"{document['id']}: pins.{path_key} apunta a {pins[path_key]}, que no existe",
        )
    for token in document.get("weatheringTokens") or []:
        record = document["visualStates"].get(token)
        _require(
            record is not None and not record["geometryChange"],
            f"{document['id']}: `weatheringTokens` declara {token!r}, que no es un estado de "
            "proyección material (debe existir en `visualStates` y no cambiar geometría)",
        )
    return document


def mood_group(contract, mood_id):
    """Grupo de mood (day/night) a partir del id resuelto por la capa de estilo."""
    groups = [name for name, ids in contract["moodGroups"].items() if mood_id in ids]
    _require(
        len(groups) == 1,
        f"el mood {mood_id!r} no pertenece a un único grupo de envejecimiento "
        f"(coincidencias: {groups or 'ninguna'}); decláralo en `moodGroups` del contrato",
    )
    return groups[0]


def _check_recipe(contract_id, family, recipe):
    """Validación estática: un parámetro fuera de rango o un recurso ausente no llegan al shader."""
    _require(
        0.0 <= recipe["strength"] <= 1.0,
        f"{contract_id}/{family}: strength fuera de 0..1 ({recipe['strength']})",
    )
    _require(
        0.0 <= recipe["baseSoiling"] <= 1.0,
        f"{contract_id}/{family}: baseSoiling fuera de 0..1 ({recipe['baseSoiling']})",
    )
    _require(
        len(recipe["grimeColor"]) == 3 and all(0.0 <= c <= 1.0 for c in recipe["grimeColor"]),
        f"{contract_id}/{family}: grimeColor no es un RGB lineal en 0..1",
    )
    _require(
        len(recipe["grimeColorSrgb"]) == 3 and all(0 <= c <= 255 for c in recipe["grimeColorSrgb"]),
        f"{contract_id}/{family}: grimeColorSrgb no es un RGB de 8 bits (es lo que revisa una persona)",
    )
    _require(
        0.0 <= recipe["roughnessAdd"] <= 1.0,
        f"{contract_id}/{family}: roughnessAdd fuera de 0..1",
    )
    emission = recipe["emissionScale"]
    _require(
        emission is None or 0.0 <= emission <= 2.0,
        f"{contract_id}/{family}: emissionScale debe ser nulo o estar en 0..2",
    )
    for key in ("cavity", "blendSource"):
        source = recipe[key]
        if source is None:
            continue
        _require(
            (REPO_ROOT / source["texture"]).is_file(),
            f"{contract_id}/{family}: {key} apunta a un recurso que no existe ({source['texture']})",
        )
        _require(
            source["tileMeters"] > 0.0,
            f"{contract_id}/{family}: {key}.tileMeters debe ser positivo",
        )
        _require(
            "license" in source,
            f"{contract_id}/{family}: {key} no declara licencia; todo recurso de envejecimiento "
            "tiene que poder auditarse",
        )
        if key == "cavity":
            low, high = source["ramp"]
            _require(
                0.0 <= low < high <= 1.0,
                f"{contract_id}/{family}: ramp de cavidad mal ordenada ({low}..{high})",
            )
            _require(
                0.0 <= source["weight"] <= 1.0,
                f"{contract_id}/{family}: cavity.weight fuera de 0..1",
            )
    patch = recipe["patch"]
    if patch is not None:
        low = patch["threshold"]
        high = patch["threshold"] + patch["width"]
        _require(
            0.0 <= low and high <= 1.0,
            f"{contract_id}/{family}: la ventana de mancha sale de 0..1 ({low}..{high})",
        )
        _require(
            len(patch["scale"]) == 3,
            f"{contract_id}/{family}: patch.scale necesita tres componentes (X, Y, Z en metros)",
        )
    gravity = recipe["gravity"]
    if gravity is not None:
        _require(
            gravity["zHighMeters"] > gravity["zLowMeters"],
            f"{contract_id}/{family}: la rampa de gravedad está invertida",
        )


class Plan:
    """Contrato resuelto para (estado visual, mood, familias que publica el perfil de estilo)."""

    def __init__(self, contract, state, mood_id, profile_families):
        self.contract = contract
        self.id = contract["id"]
        self.state = state
        self.mood_id = mood_id
        states = contract["visualStates"]
        _require(state in states, f"{self.id}: el contrato no declara el estado visual {state!r}")
        # La lista la publica el JSON: el orquestador node y este módulo no mantienen cada uno la suya.
        tokens = contract.get("weatheringTokens") or []
        _require(
            state in tokens,
            f"estado de envejecimiento {state!r} no es una proyección de material: los tiers con "
            "geometría se eligen con `state` (damaged/burning) y `weathering` acepta "
            + "/".join(tokens),
        )
        self.state_record = states[state]
        self.material_projection = bool(self.state_record["materialProjection"])
        self.geometry_change = bool(self.state_record["geometryChange"])
        self.sprite_state = self.state_record["spriteState"]
        self.derivation = self.state_record["derivation"]
        self.mood = mood_group(contract, mood_id)
        declared = set(contract["materials"])
        measured = set(profile_families)
        _require(
            measured <= declared,
            f"{self.id}: el perfil de estilo publica familias que el contrato no trata: "
            + ", ".join(sorted(measured - declared))
            + " → añade su receta o declárala en `exclusions.families` antes de renderizar",
        )
        _require(
            declared <= measured | set(contract["exclusions"]["families"]),
            f"{self.id}: el contrato trata familias que ya no existen en el perfil: "
            + ", ".join(sorted(declared - measured)),
        )
        self.recipes = {}
        for family, record in contract["materials"].items():
            entry = record["states"].get(state) or {}
            if entry.get("excluded") or "recipe" not in entry:
                continue
            _check_recipe(self.id, family, entry["recipe"])
            self.recipes[family] = entry["recipe"]
        if self.material_projection:
            missing = sorted(measured - set(self.recipes) - set(contract["exclusions"]["families"]))
            _require(
                not missing,
                f"{self.id}/{state}: ninguna receta cubre " + ", ".join(missing)
                + " y no están en `exclusions.families`; dejarlas fuera mezclaría paños sucios con "
                "paños de obra nueva en el mismo alzado",
            )

    def recipe_for(self, family):
        return self.recipes.get(family)

    MOOD_MODIFIERS = ("strengthScale", "roughnessAdd", "emissionScale")

    def effective(self, family):
        """Receta con los modificadores del grupo de mood aplicados (copia: nunca se muta el contrato)."""
        recipe = dict(self.recipes[family])
        entry = self.contract["materials"][family]["states"][self.state]
        modifiers = entry.get("moodModifiers", {})
        for group_name, group in modifiers.items():
            _require(
                group_name in self.contract["moodGroups"],
                f"{self.id}/{family}: moodModifiers declara el grupo inexistente {group_name!r}",
            )
            unknown = sorted(set(group) - set(self.MOOD_MODIFIERS))
            _require(
                not unknown,
                f"{self.id}/{family}: modificador de mood que este módulo no sabe aplicar: "
                + ", ".join(unknown)
                + " (se aceptan " + ", ".join(self.MOOD_MODIFIERS) + ")",
            )
        group = dict(modifiers.get(self.mood, {}))
        recipe["strength"] = round(recipe["strength"] * group.get("strengthScale", 1.0), 4)
        for key in ("roughnessAdd", "emissionScale"):
            if key in group:
                recipe[key] = group[key]
        return recipe


def _needs_blender():
    _require(bpy is not None, "aplicar la proyección requiere Blender (este módulo se importó fuera)")


def _image(path, non_color, max_resolution=None):
    cached = bpy.data.images.get(Path(path).stem)
    if cached is not None:
        return cached
    image = bpy.data.images.load(str(path))
    if max_resolution and max(image.size) > max_resolution:
        # Un 4k cuesta ~270 MB en memoria y el sprite se recorta a ~1000 px: la densidad que entra
        # en el render es la rebajada, y por eso se declara en la evidencia, no se calla.
        ratio = max_resolution / max(image.size)
        image.scale(int(image.size[0] * ratio), int(image.size[1] * ratio))
    image.name = Path(path).stem
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    return image


def _sampled_texture(tree, vector, image, scale, location):
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = tuple(scale)
    mapping.location = location
    tree.links.new(vector, mapping.inputs["Vector"])
    node = tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    node.extension = "REPEAT"
    node.location = (location[0] + 260, location[1])
    tree.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
    return node


def _ramp(tree, low, high, location):
    node = tree.nodes.new("ShaderNodeValToRGB")
    element_low, element_high = node.color_ramp.elements
    element_low.position = low
    element_low.color = (0, 0, 0, 1)
    element_high.position = high
    element_high.color = (1, 1, 1, 1)
    node.location = location
    return node


def _math(tree, operation, value_a, value_b, location, value_c=None):
    """`value_*`: un socket de origen o un escalar literal. Devuelve el socket de salida."""
    node = tree.nodes.new("ShaderNodeMath")
    node.operation = operation
    node.use_clamp = False
    values = [value_a, value_b] + ([value_c] if value_c is not None else [])
    for index, value in enumerate(values):
        socket = node.inputs[index]
        if hasattr(value, "node"):
            tree.links.new(value, socket)
        else:
            socket.default_value = float(value)
    node.location = location
    return node.outputs["Value"]


def build_mask(tree, recipe, position):
    """Construye la máscara de mugre 0..1 y devuelve (socket, detalle para la evidencia)."""
    detail = {}
    terms = []
    cavity = recipe["cavity"]
    if cavity is not None:
        image = _image(REPO_ROOT / cavity["texture"], non_color=True)
        node = _sampled_texture(
            tree, position, image, (1.0 / cavity["tileMeters"],) * 2 + (1.0,), (-900, 260)
        )
        invert = tree.nodes.new("ShaderNodeInvert")
        invert.location = (-380, 260)
        tree.links.new(node.outputs["Color"], invert.inputs["Color"])
        ramp = _ramp(tree, cavity["ramp"][0], cavity["ramp"][1], (-180, 260))
        tree.links.new(invert.outputs["Color"], ramp.inputs["Fac"])
        terms.append(_math(tree, "MULTIPLY", ramp.outputs["Color"], cavity["weight"], (40, 320)))
        detail["cavity"] = {
            "texture": cavity["texture"],
            "channelUsed": "depth invertida (las juntas honda acumulan)",
            "tileMeters": cavity["tileMeters"],
            "ramp": list(cavity["ramp"]),
            "weight": cavity["weight"],
        }
    patch = recipe["patch"]
    if patch is not None:
        mapping = tree.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = tuple(patch["scale"])
        mapping.location = (-900, -120)
        tree.links.new(position, mapping.inputs["Vector"])
        noise = tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = patch["noiseScale"]
        noise.inputs["Detail"].default_value = patch["detail"]
        noise.location = (-620, -120)
        tree.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        ramp = _ramp(tree, patch["threshold"], patch["threshold"] + patch["width"], (-380, -120))
        tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        terms.append(_math(tree, "MULTIPLY", ramp.outputs["Color"], patch["weight"], (40, -60)))
        detail["patch"] = {
            "anisotropicScale": list(patch["scale"]),
            "noiseScale": patch["noiseScale"],
            "detail": patch["detail"],
            "ramp": [patch["threshold"], patch["threshold"] + patch["width"]],
            "weight": patch["weight"],
            "reading": (
                "Z baja en `anisotropicScale` = reguero vertical; isótropo = moho en parches"
            ),
        }
    _require(
        terms or recipe["baseSoiling"] > 0.0,
        "la receta no aporta ninguna máscara ni película (cavity, patch y baseSoiling nulos): no hay nada "
        "que mezclar",
    )
    if not terms:
        # Película uniforme sin alta frecuencia: es el caso del cristal, que de noche se empaña sin mancharse.
        return _math(tree, "MINIMUM", recipe["baseSoiling"], 1.0, (340, 200)), {
            "baseSoiling": recipe["baseSoiling"],
            "reading": "sin cavity ni patch: sólo la película uniforme",
        }
    mask = terms[0] if len(terms) == 1 else _math(tree, "MAXIMUM", terms[0], terms[1], (240, 120))
    # Película de suciedad uniforme, el término que hace que un paño se lea *usado* y no sólo *manchado*.
    # Sin él la máscara es pura alta frecuencia: el histograma promedia contra el control, el tono del
    # edificio sigue siendo el de obra nueva y la hoja A/B/C no se puede revisar (medido con
    # `ext_lab/weathering_mask_probe.py`: 8,1/255 de |Δ| medio con mediana 0 y tono −0,1).
    base_soiling = recipe["baseSoiling"]
    if base_soiling > 0.0:
        mask = _math(
            tree,
            "MINIMUM",
            _math(tree, "ADD", mask, base_soiling, (140, 200)),
            1.0,
            (340, 200),
        )
        detail["baseSoiling"] = base_soiling
    gravity = recipe["gravity"]
    if gravity is not None:
        separate = tree.nodes.new("ShaderNodeSeparateXYZ")
        separate.location = (-900, -380)
        tree.links.new(position, separate.inputs["Vector"])
        ramp = tree.nodes.new("ShaderNodeMapRange")
        ramp.clamp = True
        ramp.inputs["From Min"].default_value = gravity["zLowMeters"]
        ramp.inputs["From Max"].default_value = gravity["zHighMeters"]
        ramp.inputs["To Min"].default_value = 1.0
        ramp.inputs["To Max"].default_value = 0.0
        ramp.location = (-680, -380)
        tree.links.new(separate.outputs["Z"], ramp.inputs["Value"])
        # (1 + grav·boost): la base del edificio admite hasta un (1+boost) de la máscara.
        bump = _math(tree, "MULTIPLY_ADD", ramp.outputs["Result"], gravity["boost"], (-420, -380), 1.0)
        mask = _math(tree, "MINIMUM", _math(tree, "MULTIPLY", mask, bump, (-220, -380)), 1.0, (0, -380))
        detail["gravity"] = {
            "zMeters": [gravity["zLowMeters"], gravity["zHighMeters"]],
            "baseBoost": gravity["boost"],
        }
    return mask, detail


def _mix_target(tree, recipe, position):
    """Socket que alimenta el color de mugre: el albedo del escaneo o el color plano de la familia."""
    blend = recipe["blendSource"]
    if blend is None:
        rgb = tree.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = (*recipe["grimeColor"], 1.0)
        rgb.location = (-400, 60)
        return rgb.outputs[0], {"kind": "grimeColor", "linear": list(recipe["grimeColor"])}
    image = _image(
        REPO_ROOT / blend["texture"], non_color=False, max_resolution=blend.get("maxResolution")
    )
    node = _sampled_texture(
        tree, position, image, (1.0 / blend["tileMeters"],) * 2 + (1.0,), (-900, -660)
    )
    return node.outputs["Color"], {
        "kind": "blendSource",
        "texture": blend["texture"],
        "license": blend["license"],
        "tileMeters": blend["tileMeters"],
        "resolutionInRenderPx": list(image.size),
        "requestedMaxResolutionPx": blend.get("maxResolution"),
    }


def surface_bsdf(tree):
    """El Principled BSDF que REALMENTE alimenta la salida activa, con su diagnóstico.

    `next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")` es la trampa que WP04 tuvo que
    medir: un material pasado por el pase de estilo profundo puede tener dos BSDF (el importado del GLB y
    el que el pase cableó a la salida) y el primero en la lista no tiene por qué ser el segundo. Envejecer
    el huérfano produce un grafo distinto, un `pixelSha` distinto y una fachada que NO envejece — exactamente
    lo que pasó en el paño de ladrillo del `mixed_tenement` (tono medido −0,05/255 con 0,9 % de píxeles sobre
    el ruido de §13 mientras la cornisa del mismo edificio bajaba −7,6). Se recorre el grafo hacia atrás
    desde la salida y se escoge el BSDF alcanzado; si no lo está ninguno, se falla cerrado en vez de dibujar
    una capa que no se ve.
    """
    outputs = [node for node in tree.nodes if node.type == "OUTPUT_MATERIAL"]
    active = [node for node in outputs if getattr(node, "is_active_output", True)] or outputs
    reached = set()
    stack = [(node, "Surface") for node in active]
    while stack:
        node, socket_name = stack.pop()
        socket = node.inputs.get(socket_name)
        if socket is None or not socket.is_linked:
            continue
        source = socket.links[0].from_socket
        reached.add(source.node.name)
        stack.extend((source.node, item.name) for item in source.node.inputs)
    principled = [node for node in tree.nodes if node.type == "BSDF_PRINCIPLED"]
    wired = [node for node in principled if node.name in reached]
    _require(
        bool(wired),
        f"{tree.name}: ningún BSDF Principled alimenta la salida activa "
        f"({len(principled)} en el grafo): la capa de mugre no se vería",
    )
    return wired[0], {
        "principledNodes": len(principled),
        "wiredToOutput": len(wired),
        "chosen": wired[0].name,
    }


def apply_material(plan, material, family_of):
    """Inserta la capa de mugre en un material. Devuelve el registro de lo que tocó."""
    _needs_blender()
    family = family_of(material.name)
    _require(
        family is not None,
        f"{plan.id}: el material {material.name} no está clasificado por el perfil "
        f"{plan.contract['pins']['styleProfileId']}: no se puede elegir receta",
    )
    _require(
        plan.recipe_for(family) is not None,
        f"{plan.id}/{plan.state}: el edificio usa la familia {family} ({material.name}) y el "
        "contrato no le da receta ni la excluye",
    )
    recipe = plan.effective(family)
    tree = material.node_tree
    _require(tree is not None, f"{material.name} no tiene grafo de nodos")
    bsdf, bsdf_audit = surface_bsdf(tree)
    before = len(tree.nodes)
    record = {
        "material": material.name,
        "family": family,
        "state": plan.state,
        "moodGroup": plan.mood,
        "bsdf": bsdf_audit,
        "recipe": {
            "strength": recipe["strength"],
            "grimeColorLinear": list(recipe["grimeColor"]),
            "grimeColorSrgb": list(recipe["grimeColorSrgb"]),
            "roughnessAdd": recipe["roughnessAdd"],
            "emissionScale": recipe["emissionScale"],
        },
    }
    geometry = tree.nodes.new("ShaderNodeNewGeometry")
    geometry.name = f"{NODE_PREFIX}position"
    geometry.location = (-1200, 0)
    position = geometry.outputs["Position"]

    base = bsdf.inputs["Base Color"]
    if recipe["strength"] > 0.0:
        mask, record["mask"] = build_mask(tree, recipe, position)
        factor = _math(tree, "MULTIPLY", mask, recipe["strength"], (240, 480))
        mix = tree.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MIX"
        mix.location = (200, 200)
        tree.links.new(factor, mix.inputs["Fac"])
        if base.is_linked:
            source = base.links[0].from_socket
            record["colorSource"] = {
                "kind": "enlazado",
                "from": f"{source.node.type}:{source.node.name}:{source.name}",
            }
        else:
            original = tree.nodes.new("ShaderNodeRGB")
            original.outputs[0].default_value = tuple(base.default_value)
            original.location = (-400, 320)
            record["colorSource"] = {"kind": "plano", "linear": list(base.default_value[:3])}
            source = original.outputs[0]
        tree.links.new(source, mix.inputs["Color1"])
        grime, record["grimeSource"] = _mix_target(tree, recipe, position)
        tree.links.new(grime, mix.inputs["Color2"])
        tree.links.new(mix.outputs["Color"], base)
    else:
        record["colorSource"] = {"kind": "intacto", "reason": "strength 0: la familia no se oscurece"}

    roughness = bsdf.inputs["Roughness"]
    if recipe["roughnessAdd"]:
        if roughness.is_linked:
            added = _math(tree, "ADD", roughness.links[0].from_socket, recipe["roughnessAdd"], (200, -300))
            tree.links.new(_math(tree, "MINIMUM", added, 1.0, (380, -300)), roughness)
            record["roughness"] = {"before": "enlazado", "add": recipe["roughnessAdd"]}
        else:
            was = round(roughness.default_value, 4)
            roughness.default_value = min(1.0, was + recipe["roughnessAdd"])
            record["roughness"] = {"before": was, "after": round(roughness.default_value, 4)}
    emission = bsdf.inputs.get("Emission Strength")
    scale = recipe["emissionScale"]
    if scale is not None and emission is not None:
        if emission.is_linked:
            tree.links.new(
                _math(tree, "MULTIPLY", emission.links[0].from_socket, scale, (200, -560)), emission
            )
            record["emission"] = {"scale": scale, "source": "enlazado"}
        elif emission.default_value > 0.0:
            was = round(emission.default_value, 4)
            emission.default_value = round(was * scale, 4)
            record["emission"] = {"scale": scale, "before": was, "after": emission.default_value}
        else:
            record["emission"] = {"scale": scale, "skipped": "el mood no cableó emisión en este material"}
    record["nodesInserted"] = len(tree.nodes) - before
    return record


def apply_weathering(objects, plan, family_of, is_excluded_name):
    """Aplica por material, una sola vez por material: las instancias comparten el mismo datablock."""
    records = []
    seen = set()
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            material = slot.material
            if material is None or material.name in seen:
                continue
            seen.add(material.name)
            if is_excluded_name(material.name):
                records.append({"material": material.name, "skipped": "equipo de obra o VFX"})
                continue
            family = family_of(material.name)
            if family in plan.contract["exclusions"]["families"]:
                records.append({"material": material.name, "family": family, "skipped": "familia excluida"})
                continue
            records.append(apply_material(plan, material, family_of))
    return records


def pattern_matches(name, patterns):
    from fnmatch import fnmatch

    return any(fnmatch(name, pattern) for pattern in patterns)


def project(request, objects, family_of, mood_id, profile_families, contract=None):
    """Punto de entrada del compositor. `None` si el request no pidió proyección (baseline intacto)."""
    state = request.get("weathering")
    if not state:
        return None
    contract = contract or load_contract()
    plan = Plan(contract, state, mood_id, profile_families)
    records = []
    if plan.material_projection:
        exclusions = contract["exclusions"]["materialNamePatterns"]
        records = apply_weathering(objects, plan, family_of, lambda name: pattern_matches(name, exclusions))
    return {
        "contractId": plan.id,
        "contractSha256": sha256_file(CONTRACT_PATH),
        "visualState": plan.state,
        "label": plan.state_record["label"],
        "spriteState": plan.sprite_state,
        "derivation": plan.derivation,
        "materialProjection": plan.material_projection,
        "geometryChange": plan.geometry_change,
        "moodId": mood_id,
        "moodGroup": plan.mood,
        "materials": records,
        "materialsChanged": sum(1 for item in records if "recipe" in item),
        "skipped": sum(1 for item in records if "skipped" in item),
    }

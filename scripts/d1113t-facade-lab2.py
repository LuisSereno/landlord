#!/usr/bin/env python3
"""D-111.3-T FASE 1 — laboratorio 2: acotar el emisor de la banda por nivel.

Escenas:
  I slab_sin_sombra    visible_shadow=False sólo en losas/azoteas (mod_megakit_floor_slab/roof_flat)
  J paneles_sin_sombra visible_shadow=False sólo en paneles de ladrillo
  L sin_tratamiento    external treatment OFF (texturas crudas de catálogo)
  M primer_plano       cámara cercana a la cabecera de un paño (estructura de la banda)
  K modulo_solo        escena aparte: UN mod_megakit_brick_wall_2m con el rig completo

Uso: blender -b --factory-startup -P scripts/d1113t-facade-lab2.py -- --out=/tmp/d1113t/lab3
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
HERE = REPO / "tools" / "art-pipeline" / "blender"
sys.path.insert(0, str(HERE))

import bpy  # noqa: E402

from building_composer.grammar import GrammarDocument  # noqa: E402
from building_composer.module_catalog import Catalog  # noqa: E402
from building_composer.scene import (  # noqa: E402
    COMPOSITION_ROOT,
    add_supports,
    check_placements,
    compose_candidate,
    framing,
    place_modules,
    reset_scene,
    support_materials,
)
from building_composer.style_profile import StyleProfile  # noqa: E402
import runtime_asset as runtime  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = Path(next((t.split("=", 1)[1] for t in argv if t.startswith("--out=")), "/tmp/d1113t/lab3"))
OUT.mkdir(parents=True, exist_ok=True)

request = {
    "candidateId": "w06cnd_mixed_tenement_2",
    "buildingType": "mixed_tenement",
    "family": "residential_low",
    "styleProfileId": "graphic_civic_buildings_v1",
    "variantSeed": 2,
    "orientation": 0,
    "composerVersion": "vf-3",
    "footprint": {"width": 4, "height": 2},
    "floors": 3,
    "state": "complete",
    "constructionStage": None,
    "candidateProfile": "gn_residential_v2",
}

style_layer = json.loads((HERE / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
catalog = Catalog()
profile = StyleProfile(request["styleProfileId"])
document = GrammarDocument(candidate=request["candidateProfile"])
composition = compose_candidate(request, catalog, profile, document)
reset_scene()
root = bpy.data.objects.new(COMPOSITION_ROOT, None)
bpy.context.collection.objects.link(root)
groups, imports = place_modules(composition, catalog, root)
objects = [obj for _r, _m, children, _n in groups for obj in children]
objects += add_supports(composition, support_materials(profile), root)
check_placements(composition, groups)

camera, target = runtime.place_camera(composition["envelopeMeters"]["z"] / 2.0, 40.0)
bpy.context.view_layer.update()
camera.data.ortho_scale = framing(composition, camera, profile)["orthoScale"]
scene = bpy.context.scene
scene.camera = camera
runtime.apply_style_layer_lighting(scene, style_layer)
runtime.apply_external_treatment(objects, style_layer, "building")
scene.render.resolution_x = 720
scene.render.resolution_y = 720

# mapa objeto→módulo para mutaciones quirúrgicas
by_module = {}
for _rule, module, children, _node in groups:
    for obj in children:
        by_module.setdefault(getattr(module, "id", None) or str(module), []).append(obj)
print("MODULES:", {k: len(v) for k, v in sorted(by_module.items())})


def render(name):
    path = OUT / f"{name}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"RENDER {path.name}")


def shadows_off(module_ids):
    cleared = []
    for mid in module_ids:
        for obj in by_module.get(mid, []):
            if obj.visible_shadow:
                obj.visible_shadow = False
                cleared.append(obj.name)
    return cleared


def shadows_on(names):
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.visible_shadow = True


# I · losas y azoteas sin proyectar
cleared = shadows_off(["mod_megakit_floor_slab_2m", "mod_megakit_roof_flat_2m"])
render("I_slab_sin_sombra")
shadows_on(cleared)

# J · paneles de ladrillo sin proyectar
cleared = shadows_off(["mod_megakit_brick_wall_2m"])
render("J_paneles_sin_sombra")
shadows_on(cleared)

# L · sin tratamiento externo (texturas crudas)
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if mat and mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    node.inputs["Base Color"].default_value = (1, 1, 1, 1)
render("L_sin_tratamiento_raw")

# M · primer plano de la cabecera de un paño frontal
old_scale = camera.data.ortho_scale
camera.data.ortho_scale = 3.0
camera.location = (camera.location.x + 2.0, camera.location.y - 2.0, camera.location.z + 4.0)
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
render("M_primer_plano")
camera.data.ortho_scale = old_scale

print("LAB2 DONE")

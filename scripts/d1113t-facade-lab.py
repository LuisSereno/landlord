#!/usr/bin/env python3
"""D-111.3-T FASE 1 — laboratorio de atribución de franjas negro-verdosas (GLB corregido).

Blender headless. Compone UNA vez `mixed_tenement` seed 2 (`gn_residential_v2`, day_civic) con el
pipeline oficial y renderiza celdas que aíslan causas, sin tocar el árbol de composición salvo la
mutación de la celda:

  A control            estado actual publicado (GLB corregido ya en catálogo)
  B key_sin_sombra     sólo desactiva la sombra del SOL key (demuestra si la franja es proyectada)
  C ambiente_neutro    sombras ON pero fill/rim/world a gris neutro cálido (aísla el tinte verde)
  D key_sola           fill/rim/world a energía 0 (revela la forma pura de la sombra proyectada)
  E sin_sombra_cornisa visible_shadow=False SOLO en objetos de cornisa/parapeto (identifica el emisor)
  F sin_sombra_ventana visible_shadow=False SOLO en GnWindowBay (descarta la carpintería ya corregida)
  H cenital            key casi cenital (si la franja encoge, es sombra rasante proyectada)
  G clay               materiales arcilla gris difusa + sombras ON, última pasada (descarta textura/material)

Salidas: /tmp/d1113t/lab2/{building}_{celda}.png + JSON de métricas de franja por celda.
Uso:
  blender -b --factory-startup -P scripts/d1113t-facade-lab.py -- \
      --building=mixed_tenement --seed=2 --out=/tmp/d1113t/lab2
"""

import json
import math
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


def _cli(argv):
    values = {"building": "mixed_tenement", "seed": 2, "out": "/tmp/d1113t/lab2"}
    for token in argv:
        if token.startswith("--building="):
            values["building"] = token.split("=", 1)[1]
        elif token.startswith("--seed="):
            values["seed"] = int(token.split("=", 1)[1])
        elif token.startswith("--out="):
            values["out"] = token.split("=", 1)[1]
    return values


argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
opts = _cli(argv)
OUT = Path(opts["out"])
OUT.mkdir(parents=True, exist_ok=True)

if opts["building"] == "mixed_tenement":
    request = {
        "candidateId": "w06cnd_mixed_tenement_2",
        "buildingType": "mixed_tenement",
        "family": "residential_low",
        "styleProfileId": "graphic_civic_buildings_v1",
        "variantSeed": opts["seed"],
        "orientation": 0,
        "composerVersion": "vf-3",
        "footprint": {"width": 4, "height": 2},
        "floors": 3,
        "state": "complete",
        "constructionStage": None,
        "candidateProfile": "gn_residential_v2",
    }
else:
    request = {
        "candidateId": "w06cnd_row_house_17",
        "buildingType": "row_house",
        "family": "residential_low",
        "styleProfileId": "graphic_civic_buildings_v1",
        "variantSeed": opts["seed"],
        "orientation": 0,
        "composerVersion": "vf-3",
        "footprint": {"width": 4, "height": 1},
        "floors": 2,
        "state": "complete",
        "constructionStage": None,
        "candidateProfile": "gn_residential_v2",
    }

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

style_layer = json.loads((HERE / "style_layer_graphic_civic.json").read_text(encoding="utf-8"))
camera, target = runtime.place_camera(composition["envelopeMeters"]["z"] / 2.0, 40.0)
bpy.context.view_layer.update()
frame = framing(composition, camera, profile)
camera.data.ortho_scale = frame["orthoScale"]
scene = bpy.context.scene
scene.camera = camera
runtime.apply_style_layer_lighting(scene, style_layer)
runtime.apply_external_treatment(objects, style_layer, "building")
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.film_transparent = False

LIGHTS = {name: bpy.data.objects.get(name) for name in ("LIGHT_KEY", "LIGHT_FILL", "LIGHT_RIM")}
WORLD = scene.world


def render(name):
    path = OUT / f"{request['buildingType']}_{name}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"RENDER {path.name}")


def set_light_energy(name, value):
    lamp = LIGHTS.get(name)
    if lamp:
        lamp.data.energy = value


def world_strength(value):
    for node in WORLD.node_tree.nodes:
        if node.type == "BACKGROUND":
            node.inputs["Strength"].default_value = value


def world_color(rgb):
    for node in WORLD.node_tree.nodes:
        if node.type == "BACKGROUND":
            node.inputs["Color"].default_value = (*rgb, 1.0)


def light_color(name, rgb):
    lamp = LIGHTS.get(name)
    if lamp:
        lamp.data.color = rgb


def key_position(xyz):
    import mathutils

    lamp = LIGHTS["LIGHT_KEY"]
    lamp.location = xyz
    direction = mathutils.Vector((0, 0, 0)) - mathutils.Vector(xyz)
    lamp.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def shadow_off(pred):
    cleared = []
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and pred(obj.name):
            if obj.visible_shadow:
                obj.visible_shadow = False
                cleared.append(obj.name)
    return cleared


def shadow_restore(names):
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.visible_shadow = True


# --- A · control ---
render("A_control")

# --- B · key sin sombra ---
LIGHTS["LIGHT_KEY"].data.use_shadow = False
render("B_key_sin_sombra")
LIGHTS["LIGHT_KEY"].data.use_shadow = True

# --- C · ambiente neutro cálido (sombras ON) ---
light_color("LIGHT_FILL", (0.78, 0.72, 0.62))
light_color("LIGHT_RIM", (0.80, 0.74, 0.64))
world_color((0.66, 0.63, 0.58))
render("C_ambiente_neutro")
runtime.apply_style_layer_lighting(scene, style_layer)  # re-aplica colores de capa

# --- D · sólo key ---
set_light_energy("LIGHT_FILL", 0.0)
set_light_energy("LIGHT_RIM", 0.0)
world_strength(0.0)
render("D_key_sola")
runtime.apply_style_layer_lighting(scene, style_layer)

# --- E · sin sombra de cornisas/parapetos/aleros ---
cleared = shadow_off(
    lambda n: any(k in n for k in ("Cornice", "cornice", "Parapet", "parapet", "Plinth"))
)
print("E shadow-off:", sorted(set(cleared)))
render("E_sin_sombra_cornisa")
shadow_restore(cleared)

# --- F · sin sombra de la ventana GN ---
cleared = shadow_off(lambda n: "GnWindowBay" in n or "WindowBay" in n)
print("F shadow-off:", sorted(set(cleared)))
render("F_sin_sombra_ventana")
shadow_restore(cleared)

# --- H · key casi cenital (materiales reales: si la franja encoge, es sombra rasante) ---
key_position((6.0, -12.0, 60.0))
render("H_cenital")
key_position((6.0, -12.0, 12.0))

# --- G · clay (última pasada: destruye los materiales originales del scene) ---
saved = {}
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    for slot in obj.material_slots:
        if slot.material and slot.material.name not in saved:
            saved[slot.material.name] = (
                tuple(slot.material.diffuse_color),
                slot.material.use_nodes,
            )
clay = bpy.data.materials.get("LAB_CLAY") or bpy.data.materials.new("LAB_CLAY")
clay.use_nodes = False
clay.diffuse_color = (0.55, 0.55, 0.55, 1.0)
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    for slot in obj.material_slots:
        slot.material = clay
render("G_clay")

print("LAB DONE")

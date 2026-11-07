/**
 * §29 — Golden evidence del Building Composer (V.f.5c).
 *
 * Compone las diez imágenes exigidas por §29 exclusivamente desde el attempt 12/12 ya promocionado
 * (`candidates/`) y las salidas de §27 (contact sheets) y §28 (city context). No reutiliza imágenes
 * de attempts fallidos: si falta un candidato promocionado, el script falla en vez de improvisar.
 *
 *   1. row-house-contact-sheet.png        (desde §27)
 *   2. row-house-city-context.png         (desde §28, 1x)
 *   3. cement-plant-contact-sheet.png     (desde §27)
 *   4. cement-plant-city-context.png      (desde §28, 1x)
 *   5. town-hall-contact-sheet.png        (desde §27)
 *   6. town-hall-city-context.png         (desde §28, 1x)
 *   7. scale-comparison.png               (las tres familias a la misma escala de parcela)
 *   8. material-comparison.png            (escalera de materiales tratada)
 *   9. 1280x720.png                       (un candidato compuesto a resolución 1280×720)
 *   10. 1920x1080.png                     (el mismo candidato a 1920×1080)
 *
 * Uso: node scripts/build-building-composer-golden.mjs [--candidates=<dir>] [--sheets=<dir>]
 *      [--context=<dir>] [--out=<dir>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CANDIDATES = join(REPO_ROOT, "docs/art/building-composer/candidates");
const DEFAULT_SHEETS = join(REPO_ROOT, "docs/art/golden/vf-building-composer");
const DEFAULT_CONTEXT = join(REPO_ROOT, "docs/art/golden/vf-building-composer/context");
const DEFAULT_OUT = join(REPO_ROOT, "docs/art/golden/vf-building-composer");

const GOLDEN = [
  { file: "row-house-contact-sheet.png", from: "sheet", buildingType: "row_house" },
  { file: "row-house-city-context.png", from: "context", buildingType: "row_house" },
  { file: "cement-plant-contact-sheet.png", from: "sheet", buildingType: "cement_plant" },
  { file: "cement-plant-city-context.png", from: "context", buildingType: "cement_plant" },
  { file: "town-hall-contact-sheet.png", from: "sheet", buildingType: "town_hall" },
  { file: "town-hall-city-context.png", from: "context", buildingType: "town_hall" },
];

function parseArgs(argv) {
  const options = {
    candidates: DEFAULT_CANDIDATES,
    sheets: DEFAULT_SHEETS,
    context: DEFAULT_CONTEXT,
    out: DEFAULT_OUT,
  };
  for (const argument of argv.slice(2)) {
    const [flag, value] = argument.split("=");
    if (flag === "--candidates") options.candidates = resolve(value);
    else if (flag === "--sheets") options.sheets = resolve(value);
    else if (flag === "--context") options.context = resolve(value);
    else if (flag === "--out") options.out = resolve(value);
    else throw new Error(`argumento desconocido ${argument}`);
  }
  return options;
}

const read = (path) => JSON.parse(readFileSync(path, "utf8"));

function main() {
  const options = parseArgs(process.argv);
  const manifestPath = join(options.candidates, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`§29: no hay manifest en ${options.candidates}`);
  const manifest = read(manifestPath);
  if (manifest.rendered !== manifest.requested) {
    throw new Error(
      `§29: el manifest promocionado no es 12/12 (${manifest.rendered}/${manifest.requested})`,
    );
  }
  mkdirSync(options.out, { recursive: true });

  // 1-6: reutilizar §27 y §28 sin recomponer.
  const copied = [];
  for (const item of GOLDEN) {
    const source =
      item.from === "sheet"
        ? join(options.sheets, `${item.buildingType}-contact-sheet.png`)
        : join(options.context, `${item.buildingType}-city-context-1x.png`);
    if (!existsSync(source)) {
      throw new Error(`§29: falta ${source}; genera §27/§28 antes que golden`);
    }
    const target = join(options.out, item.file);
    writeFileSync(target, readFileSync(source));
    copied.push(item.file);
  }

  // 7-10: compuestos por Blender desde la geometría del compositor (mismas funciones del pipeline).
  const script = `
import json, sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(join(REPO_ROOT, "tools/art-pipeline/blender"))})
from building_composer.compose import compose_candidate
from building_composer.grammar import GrammarDocument
from building_composer.module_catalog import Catalog
from building_composer.style_profile import StyleProfile
import bpy, runtime_asset as runtime
from building_composer.scene import (
    COMPOSITION_ROOT, place_modules, add_supports, support_materials,
    complete_style_reach, framing, reset_scene,
)

OUT = Path(${JSON.stringify(options.out)})
style_layer = json.loads((Path(${JSON.stringify(join(REPO_ROOT, "tools/art-pipeline/blender"))}) / "style_layer_graphic_civic.json").read_text())
treatment = style_layer["externalTreatment"]
catalog, document = Catalog(), GrammarDocument()
profile = StyleProfile("graphic_civic_buildings_v1")

def assemble(building_type, family, footprint, floors, seed):
    request = {"candidateId": f"vf_{building_type}_{seed}", "buildingType": building_type,
               "family": family, "styleProfileId": profile.id, "variantSeed": seed,
               "composerVersion": document.composer_version, "footprint": footprint,
               "floors": floors, "state": "complete", "output": str(OUT / "tmp.png")}
    comp = compose_candidate(request, catalog, profile, document)
    root = bpy.data.objects.new(COMPOSITION_ROOT + f"_{building_type}", None)
    bpy.context.collection.objects.link(root)
    groups, _ = place_modules(comp, catalog, root)
    objs = [o for _r,_m,ch,_n in groups for o in ch] + add_supports(comp, support_materials(profile), root)
    bpy.context.view_layer.update()
    return comp, objs, root

def style_scene(comp, objs, res_x, res_y, out_path, ortho_scale=None, offset_x=0.0):
    cam, tgt = runtime.place_camera(comp["envelopeMeters"]["z"]/2.0, 40.0)
    bpy.context.view_layer.update()
    cam.data.ortho_scale = ortho_scale or framing(comp, cam, profile)["orthoScale"]
    cam.location.x += offset_x; tgt.x += offset_x
    cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene; scene.camera = cam
    runtime.apply_style_layer_lighting(scene, style_layer)
    runtime.apply_external_treatment(objs, style_layer, "building")
    complete_style_reach(objs, treatment, "building")
    scene.render.engine="BLENDER_EEVEE"; scene.eevee.use_taa_reprojection=False
    scene.eevee.taa_render_samples=64; scene.render.use_persistent_data=True
    scene.render.resolution_x=res_x; scene.render.resolution_y=res_y
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"
    scene.render.film_transparent=True
    post=style_layer["rendering"]["postProcessing"]
    scene.view_settings.view_transform=post.split(" - ")[0]; scene.view_settings.look=post
    scene.view_settings.exposure=style_layer["rendering"].get("exposure",0.0)
    scene.render.filepath=str(out_path); bpy.ops.render.render(write_still=True)

# 9 y 10: town_hall_1000 a 1280x720 y 1920x1080.
reset_scene()
comp, objs, _root = assemble("town_hall","civic_landmark",{"width":4,"height":3},4,1000)
style_scene(comp, list(objs), 1280, 720, OUT / "1280x720.png")
style_scene(comp, list(objs), 1920, 1080, OUT / "1920x1080.png")
print("renders 9-10 OK")

# 7 scale-comparison: las tres familias del seed 1000 a escala real de parcela, en fila.
# Cada familia queda bajo su propio root; desplazar el root en X separa la jerarquía completa.
reset_scene()
FAMS = [("row_house","residential_low",{"width":4,"height":1},2),
        ("cement_plant","industrial_heavy",{"width":5,"height":2},2),
        ("town_hall","civic_landmark",{"width":4,"height":3},4)]
comps = []
x = 0.0
for bt, fam, fp, fl in FAMS:
    comp, objs, root = assemble(bt, fam, fp, fl, 1000)
    root.location = (x, 0.0, 0.0)
    width = comp["footprintMeters"]["width"]
    x += width + 8.0
    comps.append(comp)
bpy.context.view_layer.update()
# Cámara centrada en la fila de tres familias.
cam, tgt = runtime.place_camera(max(c["envelopeMeters"]["z"] for c in comps)/2.0, 40.0)
tgt.x = (x - 8.0) / 2.0
bpy.context.view_layer.update()
cam.location.x += tgt.x
cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.ortho_scale = x + 12.0
scene = bpy.context.scene; scene.camera = cam
all_objs = [o for o in bpy.data.objects if o.type=="MESH"]
runtime.apply_style_layer_lighting(scene, style_layer)
runtime.apply_external_treatment(all_objs, style_layer, "building")
complete_style_reach(all_objs, treatment, "building")
scene.render.engine="BLENDER_EEVEE"; scene.eevee.use_taa_reprojection=False
scene.eevee.taa_render_samples=64; scene.render.use_persistent_data=True
scene.render.resolution_x=1920; scene.render.resolution_y=1080; scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"
scene.render.film_transparent=True
post=style_layer["rendering"]["postProcessing"]
scene.view_settings.view_transform=post.split(" - ")[0]; scene.view_settings.look=post
scene.view_settings.exposure=style_layer["rendering"].get("exposure",0.0)
scene.render.filepath=str(OUT / "scale-comparison.png"); bpy.ops.render.render(write_still=True)
print("scale-comparison OK")

# 8 material-comparison: franja de swatches con la paleta tratada por style_pixels.
import numpy as np
from style_layer_math import style_pixels
reset_scene()
PAL = runtime.PALETTE
order = ["brick","plaster","metal","window","green","ground"]
cell = 4.0
mats = {}
for key in order:
    col = PAL[key]
    mats[key] = runtime.material(f"mat_mat_{key}", col, metallic=0.2 if key=="metal" else 0.0)
for i, key in enumerate(order):
    runtime.cube(f"swatch_{key}", (i*cell, 0, 0.5), (cell*0.9, cell*0.9, 1.0), mats[key])
cam, tgt = runtime.place_camera(0.5, 40.0)
bpy.context.view_layer.update()
cam.data.ortho_scale = len(order)*cell + 4.0
scene = bpy.context.scene; scene.camera = cam
runtime.apply_style_layer_lighting(scene, style_layer)
all_objs = [o for o in bpy.data.objects if o.type=="MESH"]
runtime.apply_external_treatment(all_objs, style_layer, "building")
complete_style_reach(all_objs, treatment, "building")
scene.render.engine="BLENDER_EEVEE"; scene.eevee.use_taa_reprojection=False
scene.eevee.taa_render_samples=64; scene.render.use_persistent_data=True
scene.render.resolution_x=1920; scene.render.resolution_y=480; scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"
scene.render.film_transparent=True
post=style_layer["rendering"]["postProcessing"]
scene.view_settings.view_transform=post.split(" - ")[0]; scene.view_settings.look=post
scene.view_settings.exposure=style_layer["rendering"].get("exposure",0.0)
scene.render.filepath=str(OUT / "material-comparison.png"); bpy.ops.render.render(write_still=True)
print("material-comparison OK")
`;
  const scriptPath = join(options.out, ".golden.py");
  writeFileSync(scriptPath, script);
  const blender =
    process.env.BLENDER_BIN ??
    join(REPO_ROOT, "blender_artist/toolchain/blender-5.2.2-linux-x64/blender");
  const run = spawnSync(blender, ["-b", "--factory-startup", "-P", scriptPath], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (run.status !== 0)
    throw new Error(`§29: la composición Blender de golden falló (exit ${run.status})`);

  console.log(
    `golden §29 escrita en ${options.out}: 6 copiadas de §27/§28 + scale/material/1280/1920`,
  );
}

main();

"""Sonda WP05 (D-111.2): el hueco de muelle medido sobre la malla, no sobre los parámetros.

El brief de WP05 es literal: "portón útil para camión (no la cochera de 1 m de Retro Urban)" y
"comparar escala contra vehículo". Eso sólo se prueba con un número que salga de la geometría
exportada, así que esta sonda:

1. lee los GLB ya publicados en `blender_artist/sources/original/` (los mismos que consume el
   Composer, no una reconstrucción),
2. proyecta las caras sobre el plano (x, z) y calcula el **rectángulo libre máximo** que deja la
   carpintería FIJA, y
3. lo contrasta con la caja de carga de referencia del propio repo (`garage_probe.py`:
   2,50 × 2,60 m) y con una persona de 1,75 m.

La separación es por MATERIAL y está declarada en cada módulo con tres clases que se excluyen de la
cuenta del hueco y se publican etiquetadas: `moving` (la hoja que en uso real va arriba), `interior`
(el fondo de nave, que no es fachada) y `joinery` (carpintería y vidrio). En `gn_truck_dock_bay_4m`
la hoja entera sale de `gn_dock_shutter` / `gn_dark_glass` y el fondo de `gn_rubber_dark`; lo que
queda contando es chapa y perfil (`gn_painted_metal`, `gn_metal_trim`). Medir con la hoja abajo daría
0 m de hueco, que es cierto y no es la pregunta: la pregunta es si pasa el camión cuando el portón
está levantado.

Para el módulo de control (`mod_megakit_doorframe_metal_2m`) no hay hoja que excluir: se miden
TODAS sus caras con el mismo algoritmo, que es justo la comparación que pide el paquete.

    blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/dock_probe.py -- \
        --resolution=1600 --samples=48
"""

import hashlib
import json
from pathlib import Path
import sys

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import lab_common  # noqa: E402
from lab_common import clear_scene, render_evidence  # noqa: E402

REPO = lab_common.REPO_ROOT
ORIGINAL = "blender_artist/sources/original"
MEGAKIT = "blender_artist/staging/third_party/cc0/extracted/quaternius/downtown-city-megakit/Exports/glTF (Godot)"
CAR_KIT = "blender_artist/staging/third_party/cc0/extracted/kenney/car-kit/Models/GLB format"

# Referencias de escala del repo (mismo origen que `ext_lab/garage_probe.py`, para que las dos
# sondas hablen en las mismas unidades).
TRUCK = {"width": 2.50, "depth": 1.20, "height": 2.60}
PERSON = 1.75
BAY = 4.0

MODULES = [
    {
        "id": "mod_megakit_doorframe_metal_2m",
        "role": "doorframe (control)",
        "path": f"{MEGAKIT}/DoorFrame_Metal_Single.gltf",
        # El control no tiene hoja: todo lo que exporta es estructura.
        "moving": (),
        "interior": (),
        "joinery": (),
    },
    {
        "id": "mod_gn_metal_siding_bay_4m",
        "role": "wall_panel (candidata)",
        "path": f"{ORIGINAL}/gn_metal_siding_bay_4m.glb",
        "moving": (),
        "interior": ("gn_rubber_dark",),
        "joinery": (),
    },
    {
        "id": "mod_gn_metal_window_bay_4m",
        "role": "window_bay (candidata)",
        "path": f"{ORIGINAL}/gn_metal_window_bay_4m.glb",
        "moving": (),
        "interior": ("gn_rubber_dark",),
        # La carpintería y el vidrio se excluyen por el mismo motivo que la hoja del portón: no son
        # estructura. Medido con ellas dentro, el rectángulo libre saldría el vidrio practicable de
        # una hoja (0,82 × 0,69 m, sacado de la corrida anterior) y diría "aquí no hay hueco", que
        # no es la pregunta: aquí se comprueba que el recorte de la chapa deja la franja de diseño
        # 2,60 × 0,75 con los mismos machones de 0,70 m del portón.
        "joinery": ("gn_dark_glass", "gn_metal_trim"),
    },
    {
        "id": "mod_gn_truck_dock_bay_4m",
        "role": "dock_doorframe (candidata)",
        "path": f"{ORIGINAL}/gn_truck_dock_bay_4m.glb",
        "moving": ("gn_dock_shutter", "gn_dark_glass"),
        "interior": ("gn_rubber_dark",),
        "joinery": (),
    },
    {
        "id": "mod_gn_metal_parapet_4m",
        "role": "cornice (candidata)",
        "path": f"{ORIGINAL}/gn_metal_parapet_4m.glb",
        "moving": (),
        "interior": ("gn_rubber_dark",),
        "joinery": (),
    },
]


def material_of(obj, polygon):
    slot = obj.material_slots[polygon.material_index] if obj.material_slots else None
    name = slot.material.name if slot and slot.material else ""
    # Blender añade sufijos `.001`, `.002`... a los materiales repetidos entre imports: sin
    # quitarlos, la exclusión de la hoja móvil no casaba y el hueco medía 1 cm (así salió en la
    # primera corrida de esta sonda).
    head, _, tail = name.rpartition(".")
    if head and tail.isdigit() and len(tail) == 3:
        return head
    return name


def faces(obj):
    """Caras en coordenadas de mundo como AABBs.

    Todo el módulo es ortogonal por construcción (cajas instanciadas), así que el AABB de cada cara
    ES su huella en (x, z): no hay sesgo de aproximación que declarar.
    """
    matrix = obj.matrix_world
    out = []
    for polygon in obj.data.polygons:
        points = [matrix @ obj.data.vertices[index].co for index in polygon.vertices]
        out.append(
            {
                "material": material_of(obj, polygon),
                "x": (min(p.x for p in points), max(p.x for p in points)),
                "y": (min(p.y for p in points), max(p.y for p in points)),
                "z": (min(p.z for p in points), max(p.z for p in points)),
            }
        )
    return out


def largest_free_rect(blocks, x_lo, x_hi, z_lo, z_hi):
    """Rectángulo libre máximo de un conjunto de AABBs alineados.

    El espacio libre es un polígono rectilíneo, así que el rectángulo inscripto máximo tiene sus
    cantos sobre bordes de primitiva: basta con considerar las coordenadas que aparecen en los
    propios AABBs. Se devuelve el de mayor área y, en empate, el más alto (a un muelle le exige
    gálibo antes que ancho).
    """
    xs = sorted({x_lo, x_hi} | {v for b in blocks for v in (max(x_lo, b["x"][0]), min(x_hi, b["x"][1]))})
    zs = sorted({z_lo, z_hi} | {v for b in blocks for v in (max(z_lo, b["z"][0]), min(z_hi, b["z"][1]))})
    cols, rows = len(xs) - 1, len(zs) - 1
    if cols < 1 or rows < 1:
        return None
    occupied = [[False] * rows for _ in range(cols)]
    for block in blocks:
        for i in range(cols):
            cx = 0.5 * (xs[i] + xs[i + 1])
            if not block["x"][0] <= cx <= block["x"][1]:
                continue
            for j in range(rows):
                cz = 0.5 * (zs[j] + zs[j + 1])
                if block["z"][0] <= cz <= block["z"][1]:
                    occupied[i][j] = True
    best = None
    for i in range(cols):
        free = [True] * rows
        for k in range(i, cols):
            for j in range(rows):
                free[j] = free[j] and not occupied[k][j]
            run, best_run = 0, None
            for j in range(rows + 1):
                if j < rows and free[j]:
                    run += 1
                else:
                    if run and (best_run is None or run > best_run[1]):
                        best_run = (j - run, run)
                    run = 0
            if not best_run:
                continue
            top, span = best_run
            rect = {
                "widthMeters": round(xs[k + 1] - xs[i], 3),
                "heightMeters": round(zs[top + span] - zs[top], 3),
                "x": [round(xs[i], 3), round(xs[k + 1], 3)],
                "z": [round(zs[top], 3), round(zs[top + span], 3)],
            }
            area = rect["widthMeters"] * rect["heightMeters"]
            if best is None or (area, rect["heightMeters"]) > (
                best["areaM2"],
                best["heightMeters"],
            ):
                best = {**rect, "areaM2": round(area, 3)}
    return best


def measure(unit, objects):
    faces_all = [face for obj in objects for face in faces(obj)]
    x_lo = min(f["x"][0] for f in faces_all)
    x_hi = max(f["x"][1] for f in faces_all)
    z_lo = min(f["z"][0] for f in faces_all)
    z_hi = max(f["z"][1] for f in faces_all)
    # `moving` = hoja que en uso real va arriba; `interior` = fondo que no es fachada;
    # `joinery` = carpintería y vidrio. Los tres se excluyen del rectángulo libre por el mismo
    # motivo —no son la estructura que define el hueco— pero se publican con clase distinta para
    # que el revisor pueda auditar qué se sacó de la cuenta.
    classes = {}
    for key in ("moving", "interior", "joinery"):
        for name in unit[key]:
            classes[name] = key
    skip = set(classes)
    fixed = [f for f in faces_all if f["material"] not in skip]
    rect = largest_free_rect(fixed, x_lo, x_hi, z_lo, z_hi)
    by_material = {}
    for face in faces_all:
        bucket = by_material.setdefault(
            face["material"], {"faces": 0, "class": classes.get(face["material"], "structure")}
        )
        bucket["faces"] += 1
    record = {
        "moduleId": unit["id"],
        "role": unit["role"],
        "sourcePath": unit["path"],
        "envelopeMeters": {
            "x": [round(x_lo, 3), round(x_hi, 3)],
            "y": [round(min(f["y"][0] for f in faces_all), 3), round(max(f["y"][1] for f in faces_all), 3)],
            "z": [round(z_lo, 3), round(z_hi, 3)],
        },
        "faces": len(faces_all),
        "materials": {k: v for k, v in sorted(by_material.items())},
        "excludedFromOpening": sorted(skip),
        "largestFreeRect": rect,
    }
    if rect:
        record["vsTruckBox"] = {
            "caja": TRUCK,
            "cabeAncho": rect["widthMeters"] >= TRUCK["width"],
            "cabeAlto": rect["heightMeters"] >= TRUCK["height"],
            "sobranAncho": round(rect["widthMeters"] - TRUCK["width"], 3),
            "sobranAlto": round(rect["heightMeters"] - TRUCK["height"], 3),
            "cabePersona": rect["heightMeters"] >= PERSON,
        }
    return record


def new_box(name, size, location, color):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1.0)
    obj.data.materials.append(mat)
    return obj


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    options = {
        t.split("=", 1)[0][2:]: t.split("=", 1)[1] for t in argv if t.startswith("--") and "=" in t
    }
    out_dir = Path(options.get("dir", REPO / "docs/art/graphics-capabilities/evidence/v2/industrial"))
    resolution = int(options.get("resolution", 1600))
    samples = int(options.get("samples", 48))
    mood = options.get("mood", "day_civic")
    skip_render = "--skip-render" in argv

    clear_scene()
    units = []
    for unit in MODULES:
        objects, root, source, _normalization = lab_common.import_cc0_module(
            unit["path"], unit_scale=1.0, name_hint=unit["id"]
        )
        bpy.context.view_layer.update()
        record = measure(unit, objects)
        record["sha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
        record["bytes"] = source.stat().st_size
        units.append({"root": root, "objects": objects, "record": record, "width": record["envelopeMeters"]["x"][1] - record["envelopeMeters"]["x"][0]})

    # Referencias y módulos en una sola franja, todos a y = 0: la cámara ortogonal mira a lo largo
    # del eje Y, así que nada se tapa con nada y el píxel por metro es idéntico para todos los
    # cuerpos. Cualquier otra colocación obligaría a leer la escala de dos fotogramas distintos.
    bay = new_box("REF_BAY_4M", (BAY, 0.06, 3.0), (0.0, 0.0, 1.5), (0.30, 0.42, 0.62))
    truck = new_box("REF_TRUCK_BOX", (TRUCK["width"], TRUCK["depth"], TRUCK["height"]),
                    (0.0, 0.0, TRUCK["height"] / 2), (0.62, 0.18, 0.16))
    person = new_box("REF_PERSON", (0.55, 0.35, PERSON), (0.0, 0.0, PERSON / 2), (0.85, 0.72, 0.5))
    van_objects = []
    van = None
    if not skip_render:
        van_objects, van, _source, _norm = lab_common.import_cc0_module(
            f"{CAR_KIT}/truck.glb", unit_scale=1.0, name_hint="kenney_truck"
        )
        # El camión de Kenney mira a +X; se le pone la proa hacia la cámara para que se vea de
        # frente el contorno que tiene que pasar por el portón.
        van.rotation_euler[2] = 1.5707963
        bpy.context.view_layer.update()
    van_width = lab_common.bounds_of(van_objects)["size"][0] if van else 0.0

    row = [(bay, BAY), (truck, TRUCK["width"]), (person, 0.55)]
    row += [(u["root"], u["width"]) for u in units]
    if van:
        row.append((van, van_width))
    gap = 0.9
    total = sum(w for _o, w in row) + gap * (len(row) - 1)
    cursor = -total / 2
    order = []
    for obj, width in row:
        obj.location.x = -(cursor + width / 2)
        order.append({"object": obj.name, "widthMeters": round(width, 3), "xCentre": round(obj.location.x, 3)})
        cursor += width + gap

    records = [u["record"] for u in units]
    lab_common.link_to_collection(bpy.data.objects, "DOCK_PROBE")
    provenance = {
        "mood": mood,
        "capability": "geometry_nodes_dock_4m",
        "question": "D-111.2 WP05: ¿el portón GN de 4 m deja pasar la caja de 2,50 × 2,60, qué hueco "
        "real deja su ventana de banda y qué midió el control de 2 m?",
        "method": "rectángulo libre máximo sobre la proyección (x,z) de las caras de la carpintería fija; "
        "hoja móvil y fondo de nave excluidos por material (declarado en cada módulo)",
        "references": {"truckBox": TRUCK, "personHeightMeters": PERSON, "bayFrameMeters": BAY,
                       "kenneyTruck": {"sourcePath": f"{CAR_KIT}/truck.glb", "widthMeters": round(van_width, 3)}},
        "modules": records,
        "stripOrder": order,
        "materials": "los módulos GN conservan sus flats autorados y el camión su material CC0: la franja "
        "mide escala, no acabado, así que no se aplica `style_procedural_materials` a ninguno.",
    }
    if skip_render:
        print(json.dumps(provenance, indent=2, ensure_ascii=False))
        return
    metadata = render_evidence(
        label="D-111.2 WP05 hueco de muelle GN de 4 m contra la caja de 2,50 × 2,60",
        png_path=out_dir / "dock_aperture_scale.png",
        json_path=out_dir / "dock_aperture_scale.json",
        ortho_scale=total * 1.04,
        target_z=1.55,
        resolution=resolution,
        samples=samples,
        azimuth=270.0,
        provenance=provenance,
        generated={"script": "tools/art-pipeline/blender/ext_lab/dock_probe.py"},
    )
    (out_dir / "dock_aperture_scale.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    for record in records:
        rect = record["largestFreeRect"] or {}
        print(
            f"{record['moduleId']}: sobre {record['envelopeMeters']['x'][1]-record['envelopeMeters']['x'][0]:g} m "
            f"de módulo → hueco libre {rect.get('widthMeters')} × {rect.get('heightMeters')} m "
            f"(gálibo desde z={rect.get('z', [None])[0]}) "
            f"camión={'SÍ' if record.get('vsTruckBox', {}).get('cabeAncho') and record.get('vsTruckBox', {}).get('cabeAlto') else 'NO'}"
        )
    print(json.dumps({"png": metadata["image"]["path"],
                      "sha256": metadata["image"]["sha256"],
                      "triangles": metadata["geometry"]["triangles"],
                      "seconds": metadata["render"]["seconds"]}))


if __name__ == "__main__":
    main()

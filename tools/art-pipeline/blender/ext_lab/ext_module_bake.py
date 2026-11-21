"""D-111.2 WP03 — hornea UN componente de HiFi o de Archimesh a la crujía del Composer.

WP02 demostró el camino con Arch Generator: la extensión sabe hacer arquitectura, pero su salida es
un objeto de escena con propiedades vivas, no un módulo del Composer. Este adaptador repite la
conversión para las otras dos herramientas, con la misma caja de corte de `ag_module_bake`
(crujía 2,00 m, banda 3,00 m, y ∈ [-0,15; +0,35]), para que la comparación entre
control, HiFi y Archimesh sea geométrica y no de encuadre.

Qué se elige como componente y por qué: el **vano de ventana con molduras** de la planta noble. Es
el rol más repetido de cualquier fachada (`window_bay`) y el único donde "más arquitectura" se ve sin
cambiar la silueta del edificio. El control que ya publica el catálogo (`mod_gn_window_bay_2m`, 216 tri
medidos sobre el GLB) resuelve marco con retranqueo, dos montantes, travesero, alféizar con retorno y
dintel. HiFi aporta marco en relieve + alféizar + dintel + pilastras en la junta; Archimesh aporta
moldura perimetral, hoja partida y alféizar volado. Ambos se hornean en dos brazos de calidad para
poder medir el coste antes de adoptar nada.

`--tool=control` no hornea nada: importa el módulo GN que el catálogo ya publica para esa crujía y lo
renderiza con esta misma cámara y este mismo tileado, para que la columna de control de la hoja salga
del mismo script que las otras dos y no de una imagen de otro laboratorio con otro encuadre.

La licencia del código de cada extensión se registra aparte de la geometría exportada: no se copia
ni una línea de su fuente a este repo.
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))

import lab_common as lab  # noqa: E402
from ag_module_bake import BAND, BAY, PROJECTION_FRONT, WALL_BACK, cut_to_bay, join, measured, normalize  # noqa: E402
from gn_facade_grammar import MATERIALS, ensure_materials  # noqa: E402
from runtime_asset import cube  # noqa: E402

# Cota de alféizar del hueco: 0,95 m sobre el suelo de banda, el valor que ya usa `hifi_lab.py` y
# que en el perfil del Composer sale de la moda de los marcos licenciados.
SILL = 0.95
# Hueco algo más estrecho que la crujía: deja 0,30 m de machón a cada lado para que la pilastra de
# la junta tenga dónde apoyarse al tilear.
OPENING = 1.40

QUALITY = {
    "high": {"decimate": 1.0, "window_model": "2", "frame_profile": 0.09},
    # El brazo simplificado no es un capricho: WP03 pide explorar simplificación/bake. Se aplica un
    # decimador al lote ya cortado, así el ratio se mide sobre la geometría que de verdad se exporta.
    "simplified": {"decimate": 0.45, "window_model": "1", "frame_profile": 0.07},
}

# Columna de control de la hoja WP03. Es el módulo que el Composer publica HOY para la crujía de
# ventana residencial: mismo paso de 2 m, misma banda de 3 m y los mismos tres materiales del atlas
# que usan los brazos horneados, así la imagen compara arquitectura y no shaders ni encuadre.
CONTROL = {
    "id": "mod_gn_window_bay_2m",
    "path": "blender_artist/sources/original/gn_window_bay_2m.glb",
    # Referencia licenciada citada en el pie de la hoja: el marco CC0 que el catálogo usa como
    # ventana de moldura, para que el juicio "más detalle" no se haga sólo contra geometría propia.
    "licensedReference": {"id": "mod_megakit_trim_window_2m", "trianglesDeclared": 574},
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tool", required=True, choices=["control", "hifi", "archimesh"])
    parser.add_argument("--out-glb", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--evidence-png", required=True)
    parser.add_argument("--evidence-json", required=True)
    parser.add_argument("--quality", default="high", choices=["high", "simplified"])
    parser.add_argument("--mood", default="day_civic")
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


# ---------------------------------------------------------------------------------------------
# HiFi Architecture Builder
# ---------------------------------------------------------------------------------------------
def hifi_generate(hp, gen_type, params, offset, mat, label, rotation_z_degrees=180.0):
    """Una llamada real a `bpy.ops.hifi.generate()` colocada en la celda del módulo.

    `rotation_z_degrees=180` es obligatorio aquí: `hifi_lab.py` construía la fachada mirando a -Y
    (la calle del laboratorio), pero el Composer declara `frontAxis: +Y` y todas sus anclas están
    medidas contra ese eje. Generar sin girar daría un módulo cuyas molduras miran hacia el interior
    del edificio.
    """
    before = set(bpy.data.objects.keys())
    hp.unit_type = "METERS"
    hp.generator_type = gen_type
    for key, value in params.items():
        setattr(hp, key, value)
    from bl_ext.user_default.hifi_builder.preview_logic import update_preview

    update_preview(bpy.context.scene)
    result = bpy.ops.hifi.generate()
    if result != {"FINISHED"}:
        raise lab.LabError(f"hifi.generate devolvio {result} para {gen_type}")
    created = [bpy.data.objects[n] for n in bpy.data.objects.keys() if n not in before]
    if not created:
        raise lab.LabError(f"{gen_type} no creo ningun objeto")
    lab.paint(created, mat, force=True)
    for obj in created:
        obj["ext_lab_author"] = "hifi_builder"
    empty = lab.attach(created, f"HFM_{label}", offset, rotation_z_degrees)
    return {"generator": gen_type, "label": label, "controller": empty.name,
            "offset": [round(v, 3) for v in offset], "params": dict(params),
            "objects": sorted(obj.name for obj in created)}


def build_hifi(mats, quality):
    """Marco en relieve + alféizar + dintel + pilastras de junta, dentro de una banda de 3 m."""
    hp = bpy.context.scene.hifi_props
    steps = [
        hifi_generate(hp, "WINDOW_FLAT", {
            "win_f_width_ft": OPENING, "win_f_height_ft": 1.45, "win_f_depth_ft": 0.42,
            "win_f_frame_thick_ft": 0.17, "win_f_base_z_ft": 0.0,
        }, (0.0, 0.0, SILL), mats["render"], "marco"),
        hifi_generate(hp, "CEILING", {
            "ceiling_length_ft": OPENING + 0.40, "ceiling_width_ft": 0.34,
            "ceiling_thickness_ft": 0.11, "ceiling_height_ft": 0.0,
        }, (0.0, 0.10, SILL - 0.11), mats["render"], "alfeniz"),
        hifi_generate(hp, "CEILING", {
            "ceiling_length_ft": OPENING + 0.30, "ceiling_width_ft": 0.30,
            "ceiling_thickness_ft": 0.14, "ceiling_height_ft": 0.0,
        }, (0.0, 0.09, SILL + 1.45 + 0.02), mats["render"], "dintel"),
    ]
    # Pilastras en las dos juntas: media pilastra a cada lado, igual que el vano de arcada de WP02,
    # para que al tilear salga una pilastra por junta y no dos.
    for side, x in (("izq", -BAY / 2.0), ("der", BAY / 2.0)):
        steps.append(hifi_generate(hp, "PILLAR", {
            "pillar_height_ft": BAND, "pillar_radius_ft": 0.17,
            "pillar_shape": "SQUARE", "pillar_resolution": 4,
        }, (x, 0.14, 0.0), mats["render"], f"pilastra_{side}"))
    parts = []
    for step in steps:
        parts.extend(bpy.data.objects[n] for n in step["objects"])
    return parts, steps


# ---------------------------------------------------------------------------------------------
# Archimesh
# ---------------------------------------------------------------------------------------------
def archimesh_window(props, settings):
    """Ventana Archimesh headless: el operador no expone propiedades, viven en la CollectionProperty.

    El orden es el que documenta `archimesh_lab.py`: crear, activar (el callback lee
    `context.active_object`) y escribir; cada escritura reconstruye la malla y destruye los hijos,
    así que el lote se recolecta al final.
    """
    before = set(bpy.data.objects.keys())
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    result = bpy.ops.mesh.archimesh_window()
    if result != {"FINISHED"}:
        raise lab.LabError(f"mesh.archimesh_window devolvio {result}")
    main = next(
        (obj for obj in bpy.data.objects
         if obj.name not in before and len(getattr(obj, props, []) or []) > 0),
        None,
    )
    if main is None:
        raise lab.LabError(f"archimesh_window no creo un objeto con {props}")
    bpy.ops.object.select_all(action="DESELECT")
    main.select_set(True)
    bpy.context.view_layer.objects.active = main
    collection = getattr(main, props)[0]
    applied = {}
    for key, value in settings.items():
        setattr(collection, key, value)
        applied[key] = value
    parts = [obj for obj in bpy.data.objects if obj.name not in before]
    for obj in parts:
        if obj.name.startswith("CTRL_"):
            obj.hide_render = True
        obj["ext_lab_author"] = "archimesh"
    mesh_parts = [obj for obj in parts if obj.type == "MESH" and not obj.hide_render]
    return mesh_parts, {"element": "window", "root": main.name, "properties": applied,
                        "objects": sorted(obj.name for obj in mesh_parts)}


def build_archimesh(mats, quality):
    """Vano Archimesh con pintura por rol y un vidrio que no tapa la carpintería.

    Devuelve `(parts, steps, glazing)`. `glazing=False` porque las dos hojas que genera la extensión
    son el cerramiento: si el adaptador añade además su propia lámina, la moldura de la hoja y las
    manijas quedan ocultas y la hoja de revisión juzga el andamio en vez de la herramienta.
    """
    settings = {
        "crt_mat": False,
        "opentype": "1",
        "width": OPENING,
        "height": 1.45,
        "depth": 0.12,
        "external": True,
        "frame": quality["frame_profile"],
        "frame_L": quality["frame_profile"],
        "wf": 0.07,
        "leafratio": 0.5,
        "handle": True,
        "sill": True,
        "sill_thickness": 0.06,
        "sill_front": 0.16,
        "sill_back": 0.06,
        "blind": False,
        "model": quality["window_model"],
        "r": 0.0,
    }
    parts, info = archimesh_window("WindowObjectGenerator", settings)
    # Archimesh genera la ventana en el plano XY centrada en su propio hueco y con el alféizar hacia
    # -Y: se gira 180° para que mire a la calle (+Y). No se aplica el transform aqui; `bake_world`
    # despues del join hornea la matriz de mundo de cada pieza, que es lo que de verdad necesita el
    # corte. `view_layer.update()` es obligatorio: sin ella las cotas medidas seguirían siendo las
    # de la pieza sin girar.
    for obj in parts:
        obj.rotation_euler = (0.0, 0.0, 3.141592653589793)
    bpy.context.view_layer.update()
    centre = lab.world_bounds(parts)
    lowest = min((obj.matrix_world @ v.co).z for obj in parts for v in obj.data.vertices)
    offset = (-centre[0].x, -centre[1].y, SILL - lowest)
    lab.attach(parts, "AM_window", offset)
    # Pintura por rol, dentro de los buckets del atlas que ya usan WP01/WP02: marco y alféizar en
    # piedra, las dos hojas acristaladas en vidrio y las manijas en metal pintado. Con todo en piedra
    # (la primera corrida) el vano salia como un hueco ciego y la hoja comparaba el andamio del
    # adaptador en vez de lo que genera la extension.
    for obj in parts:
        role = ("glass" if obj.name.startswith("Window.")
                else "metal" if obj.name.startswith("Handle") else "render")
        lab.paint([obj], mats[role], force=True)
    return parts, [info]


# ---------------------------------------------------------------------------------------------
# Piezas comunes y salida
# ---------------------------------------------------------------------------------------------
def backing(mats, back_y, glazing=True):
    """Paño de fondo y vidrio: sin ellos el módulo es un agujero en el envelope del sprite.

    El paño se apoya en la cara posterior real del relieve (`back_y`, ya asentada en WALL_BACK) y el
    vidrio se pega a la cara interior de ese paño, NO al centro del hueco. La primera corrida usaba
    `(pared + fondo del componente)/2` y el resultado era un cristal por delante de la moldura: el
    `max(ys)` del lote mergeado es la proyección del alféizar (0,37 m en Archimesh, 0,27 m en HiFi),
    no el plano del marco, así que el punto medio caía fuera de la ventana y la hoja comparaba un
    cristal pegado a la calle. Pegado al paño, el vidrio queda siempre detrás del marco y el vano
    lee lo que es: un hueco con relieve.

    `glazing=False` lo usa Archimesh: sus dos hojas ya son el cerramiento acristalado, y añadir una
    lámina propia por delante tapaba la moldura de la hoja y las manijas, que es justo el detalle
    por el que la extensión podría interesar.
    """
    pieces = [cube("XB_wall", (0.0, back_y + 0.05, BAND / 2.0), (BAY, 0.10, BAND), mats["wall"])]
    if glazing:
        pieces.append(cube("XB_glazing", (0.0, back_y + 0.13, SILL + 1.45 / 2.0),
                           (OPENING - 0.22, 0.06, 1.45 - 0.22), mats["glass"]))
    return pieces


def decimate(obj, ratio):
    """Simplificación medida sobre el lote ya cortado, no sobre la pieza original."""
    modifier = obj.modifiers.new("WP03_decimate", "DECIMATE")
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def bake_world(obj):
    """Convierte la malla a coordenadas de mundo y deja el transform en identidad.

    Hace falta antes de cortar por dos motivos que `transform_apply` no resuelve aquí: `join` hereda
    el transform del primer objeto seleccionado (en HiFi es un lote padreado a un Empty girado 180°,
    y la rotación del padre no se aplica con `transform_apply`), y Archimesh genera piezas con escala
    propia. Si el corte se evalúa en el espacio local girado, el plano de la calle se convierte en el
    plano posterior y el `bisect` se come las molduras: medido, la primera corrida salió con
    y ∈ [-0,21; +0,15] en vez de [-0,15; +0,35], y la de Archimesh perdió el marco entero.
    """
    from mathutils import Matrix

    world = obj.matrix_world.copy()
    obj.data = obj.data.copy()
    obj.data.transform(world)
    obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()


def seat_in_bay(obj):
    """Centra el componente en la crujía y apoya su cara posterior en el plano del paño.

    No se asume el eje frontal de cada extensión: se mide. Así HiFi (que genera mirando a -Y) y
    Archimesh (que lo hace en el plano XY) acaban ambos dentro de la caja canónica del Composer con
    el relieve hacia +Y, que es el `frontAxis` que declara el catálogo.
    """
    ys = [v.co.y for v in obj.data.vertices]
    xs = [v.co.x for v in obj.data.vertices]
    shift_x = -(min(xs) + max(xs)) / 2.0
    shift_y = WALL_BACK - min(ys)
    for vertex in obj.data.vertices:
        vertex.co.x += shift_x
        vertex.co.y += shift_y
    obj.data.update()
    bpy.context.view_layer.update()
    return {"shiftXMeters": round(shift_x, 4), "shiftYMeters": round(shift_y, 4),
            "projectedFrontMeters": round(max(v.co.y for v in obj.data.vertices), 4)}


def part_metrics(obj, tags, names):
    """Cuánto ocupa cada pieza del lote en el marco del módulo, por etiqueta de vértice.

    Se llama dos veces: sobre el componente asentado (lo que la extensión PIDE) y sobre el módulo ya
    cortado (lo que SOBREVIVE). `bake_world` dejó el transform en identidad y `seat_in_bay` trasladó
    los vértices, así que `v.co.y` es la cota real frente al paño y frente al límite +0,35 m.
    """
    by_index = {group.index: tags[group.name] for group in obj.vertex_groups if group.name in tags}
    owner = [next((by_index[g.group] for g in vertex.groups if g.group in by_index), None)
             for vertex in obj.data.vertices]
    vertices, front = {}, {}
    for tag, vertex in zip(owner, obj.data.vertices):
        if tag is None:
            continue
        vertices[tag] = vertices.get(tag, 0) + 1
        front[tag] = max(front.get(tag, vertex.co.y), vertex.co.y)
    triangles = {}
    for face in obj.data.loop_triangles:
        tag = next((owner[index] for index in face.vertices if owner[index]), None)
        if tag:
            triangles[tag] = triangles.get(tag, 0) + 1
    return {tag: {"vertices": vertices.get(tag, 0),
                  "triangles": triangles.get(tag, 0),
                  "frontYMeters": round(front[tag], 4)}
            for tag in front}


def run_control(args):
    """Render de control: el módulo GN de la crujía, tileado tres veces con la misma cámara.

    No se asienta, no se corta y no se decima. Ya está dentro de la caja canónica y recortarlo sería
    comparar un control retocado contra dos brazos horneados, cuando lo que WP03 tiene que juzgar es
    qué aporta cada herramienta frente a lo que el catálogo publica hoy. Lo único que se hace aquí es
    hornear el transform de mundo (`bake_world`) para que las tres instancias tileen a 2,00 m exactos
    en el mismo marco de colocación que usa el Composer.
    """
    lab.clear_scene()
    started = time.perf_counter()
    objects, root, source, normalization = lab.import_cc0_module(
        CONTROL["path"], unit_scale=1.0, name_hint="gn_window_bay_control"
    )
    parts = [obj for obj in objects if obj.type == "MESH"]
    for obj in parts:
        obj["ext_lab_author"] = "geometry_nodes"
    bay = parts[0] if len(parts) == 1 else join(parts, "XBControlWindowBay")
    bay.parent = None
    bake_world(bay)
    stats = measured(bay)
    build_seconds = round(time.perf_counter() - started, 2)

    provenance = {
        "tool": "control",
        "authorship": "Geometry Nodes del proyecto (D-111.2 WP01)",
        "license": "original",
        "moduleId": CONTROL["id"],
        "sourcePath": CONTROL["path"],
        "mood": args.mood,
        "invocation": f"modulo del catalogo: {CONTROL['id']} -> {CONTROL['path']}",
        "adaptador": "tools/art-pipeline/blender/ext_lab/ext_module_bake.py",
        "licensedReference": CONTROL["licensedReference"],
    }
    report = {
        "schemaVersion": 1,
        "generator": "tools/art-pipeline/blender/ext_lab/ext_module_bake.py",
        "blender": bpy.app.version_string,
        "tool": "control",
        "quality": args.quality,
        "mood": args.mood,
        "grid": {"bayMeters": BAY, "bandMeters": BAND, "wallBackMeters": WALL_BACK,
                 "projectionFrontMeters": PROJECTION_FRONT},
        "normalization": normalization,
        "buildSeconds": build_seconds,
        "glb": None,
        "measured": stats,
        "provenance": provenance,
    }
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", "utf-8")

    for index in (-1, 1):
        clone = bay.copy()
        clone.data = bay.data
        clone.name = f"XBControlTile{index + 2}"
        clone.location = (index * BAY, 0.0, 0.0)
        bpy.context.collection.objects.link(clone)
    lab.render_evidence(
        label=f"control GN - vano de ventana 2x3 m ({args.quality}), tileado 3 veces",
        png_path=args.evidence_png,
        json_path=args.evidence_json,
        ortho_scale=8.6,
        target_z=1.6,
        azimuth=225.0,
        resolution=args.resolution,
        samples=args.samples,
        ground_plane=False,
        provenance=provenance,
        generated={"measured": stats, "normalization": normalization, "note": (
            "El control se importa tal cual lo publica el catálogo: sin corte y sin simplificar. "
            "Comparten atlas (gn_stone_trim / gn_brick_wall / gn_dark_glass), crujía, banda y cámara "
            "con los brazos horneados de HiFi y Archimesh."
        )},
    )
    print(json.dumps({"tool": "control", "quality": args.quality, **stats}, ensure_ascii=False))


def main():
    args = parse_args()
    if args.tool == "control":
        run_control(args)
        return
    lab.clear_scene()
    ext_id = "hifi_builder" if args.tool == "hifi" else "archimesh"
    module = lab.install_and_enable(ext_id)
    started = time.perf_counter()
    ensure_materials()
    mats = {key: bpy.data.materials[spec["name"]] for key, spec in MATERIALS.items()}

    if args.tool == "hifi":
        parts, steps = build_hifi(mats, QUALITY[args.quality])
    else:
        parts, steps = build_archimesh(mats, QUALITY[args.quality])
    # Cada pieza se etiqueta con un grupo de vértices antes del join. Es lo que permite medir su
    # relieve DESPUÉS de asentarla y recortarla, en el mismo marco que el módulo entregado: medir
    # `matrix_world` pieza a pieza antes del join da otra cosa (Archimesh re-parenta y rota sus
    # objetos dentro de `build_archimesh`, HiFi los padrea a un Empty girado 180°) y la cifra que
    # sale no es comparable con `projectedFrontMeters`. El grupo sobrevive al join, al bisect y al
    # decimate, así que con él se responde la pregunta que cierra WP03: ¿qué pide cada extensión y
    # qué le queda después de obligarla a caber en la caja canónica?
    tags = {f"XBpart_{index}_{obj.name}": obj.name for index, obj in enumerate(parts)}
    for group_name, obj in zip(tags, parts):
        obj.vertex_groups.new(name=group_name).add(
            range(len(obj.data.vertices)), 1.0, "REPLACE")
    names = set(tags.values())
    breakdown = [{"object": obj.name,
                  "material": obj.material_slots[0].material.name if obj.material_slots else None}
                 for obj in parts]
    # El componente se asienta EN la caja canónica antes de añadirle el paño y el vidrio: así ambos
    # se colocan contra la cara real medida del relieve, no contra una cota supuesta.
    component = join(parts, "XB_component")
    bake_world(component)
    seating = seat_in_bay(component)
    requested = part_metrics(component, tags, names)
    ys = [v.co.y for v in component.data.vertices]
    pieces = [component] + backing(mats, min(ys), glazing=args.tool != "archimesh")
    bay = join(pieces, "XBWindowBay2m")
    bake_world(bay)
    normalize(bay)
    cut_to_bay(bay)
    survived = part_metrics(bay, tags, names)
    if QUALITY[args.quality]["decimate"] != 1.0:
        decimate(bay, QUALITY[args.quality]["decimate"])
    labels = {object_name: step.get("label")
              for step in steps for object_name in step.get("objects", []) if step.get("label")}
    for row in breakdown:
        name = row["object"]
        want, got = requested.get(name, {}), survived.get(name, {})
        row["triangles"] = want.get("triangles", 0)
        if labels.get(name):
            row["label"] = labels[name]
        row["requestedFrontYMeters"] = want.get("frontYMeters")
        row["trianglesAfterCut"] = got.get("triangles", 0)
        row["trianglesCutOff"] = row["triangles"] - row["trianglesAfterCut"]
        row["frontYMeters"] = got.get("frontYMeters")
    breakdown.sort(key=lambda row: -row["triangles"])
    cut_summary = {
        "frontLimitMeters": PROJECTION_FRONT,
        "trianglesRequested": sum(row["triangles"] for row in breakdown),
        "trianglesSurviving": sum(row["trianglesAfterCut"] for row in breakdown),
        "maxRequestedFrontYMeters": max(
            (row["requestedFrontYMeters"] or 0.0 for row in breakdown), default=0.0),
    }
    build_seconds = round(time.perf_counter() - started, 2)
    stats = measured(bay)

    Path(args.out_glb).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    bay.select_set(True)
    bpy.context.view_layer.objects.active = bay
    bpy.ops.export_scene.gltf(
        filepath=args.out_glb, export_format="GLB", use_selection=True, export_apply=True
    )

    provenance = dict(lab.EXTENSIONS[ext_id])
    provenance.update({
        "registryId": ext_id,
        "moduleId": module,
        "mood": args.mood,
        "invocation": (
            "scene.hifi_props + preview_logic.update_preview() + bpy.ops.hifi.generate()"
            if args.tool == "hifi"
            else "bpy.ops.mesh.archimesh_window() + Object.WindowObjectGenerator[0]"
        ),
        "adaptador": "tools/art-pipeline/blender/ext_lab/ext_module_bake.py",
        "glbSha256": hashlib.sha256(Path(args.out_glb).read_bytes()).hexdigest(),
        "licenceNote": (
            f"{provenance.get('license')} es la licencia del CODIGO de la extension. La geometria "
            "exportada se registra como authored-original del proyecto porque este repo no "
            "redistribuye el add-on: se instala en un perfil aislado de /tmp y solo se publica el "
            "GLB resultante."
        ),
    })
    report = {
        "schemaVersion": 1,
        "generator": "tools/art-pipeline/blender/ext_lab/ext_module_bake.py",
        "blender": bpy.app.version_string,
        "tool": args.tool,
        "quality": args.quality,
        "mood": args.mood,
        "grid": {"bayMeters": BAY, "bandMeters": BAND, "sillMeters": SILL, "openingMeters": OPENING,
                 "wallBackMeters": WALL_BACK, "projectionFrontMeters": PROJECTION_FRONT,
                 "decimateRatio": QUALITY[args.quality]["decimate"]},
        "recipe": steps,
        "partsBreakdown": breakdown,
        "partsTrianglesTotal": sum(row["triangles"] for row in breakdown),
        "cutAudit": cut_summary,
        "seating": seating,
        "buildSeconds": build_seconds,
        "glb": str(Path(args.out_glb).resolve()),
        "measured": stats,
        "provenance": provenance,
    }
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", "utf-8")

    tiled = []
    for index in (-1, 1):
        clone = bay.copy()
        clone.data = bay.data
        clone.name = f"XBWindowTile{index + 2}"
        clone.location = (index * BAY, 0.0, 0.0)
        bpy.context.collection.objects.link(clone)
        tiled.append(clone)
    lab.render_evidence(
        label=f"{args.tool} - vano de ventana con molduras 2x3 m ({args.quality}), tileado 3 veces",
        png_path=args.evidence_png,
        json_path=args.evidence_json,
        ortho_scale=8.6,
        target_z=1.6,
        # El módulo mira a +Y (frontAxis) y la camara del laboratorio esta en -Y: hay que rodearlo.
        azimuth=225.0,
        resolution=args.resolution,
        samples=args.samples,
        ground_plane=False,
        provenance=provenance,
        generated={
            "recipe": steps,
            "measured": stats,
            "partsBreakdown": breakdown,
            "seating": seating,
            "cutAudit": cut_summary,
            "backing": {"wallBackMeters": round(min(ys), 4),
                        "wallFrontMeters": round(min(ys) + 0.10, 4),
                        "glazingAdded": args.tool != "archimesh"},
            "note": (
                "Las tres instancias comparten la pilastra de la junta. Materiales del atlas licenciado, "
                "los mismos buckets de WP01 y WP02, aplicados por rol: gn_brick_wall en el paño, "
                "gn_stone_trim en molduras y marco, gn_dark_glass en el cerramiento y gn_painted_metal "
                "solo en las manijas de Archimesh, que el control no tiene. HiFi no genera vidrio, así "
                "que su hoja lleva la lámina del adaptador pegada a la cara interior del paño. "
                "Archimesh no recibe lámina porque trae sus dos hojas: el error estuvo en suponer que "
                "eso basta, porque `partsBreakdown` mide esas hojas y sus manijas por detrás de la cara "
                "del paño (-0,05), es decir ocultas por el propio muro. La hoja de revisión lo muestra: "
                "el vano sale con color de ladrillo dentro del marco."
            ),
        },
    )
    print(json.dumps({"tool": args.tool, "quality": args.quality, **stats}, ensure_ascii=False))


if __name__ == "__main__":
    main()

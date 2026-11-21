"""D-111.2 WP02 — hornea UN componente cívico de Arch Generator como módulo original.

`arch_generator_lab.py` respondía a la pregunta de si la extensión sabe hacer un edificio público.
Sabe, pero su salida no entra en el Composer: es un objeto de escena con propiedades vivas, no un
GLB con ancla, pivote y huella canónica. Este adaptador hace esa conversión y sólo ésa:

  1. genera un vano de arcada con `bpy.ops.mesh.arch_create()` + `arch_props`,
  2. lo recorta a la crujía de 2,00 m cortando los estribos por su eje (así al tilear dos
     instancias contiguas el pilar se reconstruye entero en la junta, que es lo que hace que la
     crujía se mantenga sin inventar un segundo paso),
  3. le añade trasero de muro, antepecho y vidrio con la primitiva del pipeline, para que el vano
     no sea un agujero en el envelope,
  4. converge la altura del estribo a la banda de 3,00 m que el Composer valida,
  5. exporta GLB + informe medido, y pinta una evidencia del módulo solo y tileado tres veces.

La licencia del código de la extensión (GPL-3.0-or-later) se registra aparte de la geometría
exportada: no se copia ni una línea de su fuente a este repo.
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
from gn_facade_grammar import MATERIALS, ensure_materials  # noqa: E402
from runtime_asset import cube  # noqa: E402

EXT_ID = "arch_generator"
OBJECT_NAME = "AGArcadeBay2m"

# Crujía y banda leídas del dominio, no inventadas: town_hall = 20 x 12 m, 3 plantas, bayMeters 2.
BAY = 2.0
BAND = 3.0
# El paño de fondo cae en el mismo plano que los módulos GN (WP01): el trasero del vano empieza en
# y=-0,15, la cara posterior del `mod_gn_window_bay_2m`, y la arcada proyecta hasta y=+0,35, sólo
# 0,10 m mas de lo que ya proyecta el GN. Asi la A/B civica proyecta sin mover el envelope del
# sprite mas alla de lo que la propia arquitectura pide.
WALL_BACK = -0.15
PROJECTION_FRONT = 0.35
PARAPET = 0.90


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-glb", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--evidence-png", required=True)
    parser.add_argument("--evidence-json", required=True)
    parser.add_argument("--quality", default="high", choices=["high", "simplified"])
    parser.add_argument("--mood", default=lab.DEFAULT_MOOD)
    parser.add_argument("--resolution", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=48)
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


# Los dos brazos de calidad que compara WP02: "¿merece la pena el detalle?" no se decide sin medir
# ambos, y la simplificación sólo es admisible después de ver la alta calidad.
QUALITY = {
    "high": {"arch_segments": 32, "flute_count": 14, "flute_depth": 0.09, "trim_resolution": 28},
    "simplified": {"arch_segments": 12, "flute_count": 6, "flute_depth": 0.07, "trim_resolution": 12},
}


def arch_settings(stambha_height, quality):
    """Vano romano con pilastras compartidas: hueco 1,40 m + 0,60 m de estribo = 2,00 m de crujía."""
    return {
        "mode": "SINGLE",
        "frame_type": "FULL",
        "multi_stambha_mode": "SHARED",
        "arch_style": "ROMAN",
        "arch_segments": quality["arch_segments"],
        "width": BAY - 0.60,
        "gap_between_arches": 0.0,
        "height": 1.0,
        "depth": 0.60,
        "thickness": 0.30,
        "stambha_width": 0.60,
        "stambha_depth": 0.60,
        "stambha_height": stambha_height,
        "pillar_style": "FLUTED",
        "flute_count": quality["flute_count"],
        "flute_depth": quality["flute_depth"],
        "base_style": "ATTIC",
        "base_width": 0.72,
        "base_depth": 0.72,
        "base_height": 0.22,
        "capital_style": "IONIC",
        "capital_width": 0.72,
        "capital_depth": 0.66,
        "capital_height": 0.34,
        "trim_resolution": quality["trim_resolution"],
        "enable_support_beam": True,
        "frame_beam_height": 0.34,
        "enable_spring_block": True,
        "enable_arch_root": True,
    }


def create_arch(stambha_height, quality):
    """Una instancia de `mesh.arch_create()` aislada: devuelve el objeto que la extension creo."""
    module = importlib_module()
    rebuild_mesh = module.builders.rebuild_mesh
    before = set(bpy.data.objects.keys())
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    result = bpy.ops.mesh.arch_create()
    if result != {"FINISHED"}:
        raise lab.LabError(f"mesh.arch_create devolvio {result}")
    created = [obj for obj in bpy.data.objects if obj.name not in before and obj.type == "MESH"]
    if not created:
        raise lab.LabError("arch_create no creo ningun mesh")
    obj = created[0]
    obj.name = "AG_arcade_raw"
    props = obj.arch_props
    for key, value in arch_settings(stambha_height, quality).items():
        setattr(props, key, value)
    rebuild_mesh(bpy.context, obj)
    return obj


def importlib_module():
    import importlib

    package = "bl_ext.user_default.arch_generator"
    try:
        module = importlib.import_module(package)
        importlib.import_module(f"{package}.builders")
    except ModuleNotFoundError as error:
        raise lab.LabError(f"arch_generator no esta importable: {error}") from error
    if not hasattr(module, "builders"):
        raise lab.LabError("el paquete arch_generator no expone su submodulo builders")
    return module


def cut_to_bay(obj):
    """Recorta el mesh a la celda del modulo: x en [-1,1] e y en [WALL_BACK, PROJECTION_FRONT].

    Es el paso que convierte una arcada de extension en un modulo tileable: la mitad del pilar
    izquierdo y la del derecho viven en esta instancia, de modo que dos contiguas suman un pilar
    completo exactamente sobre la junta de 2 m. Sin este corte cada vano llevaria sus dos pilares
    enteros y la crujia se leeria doble.

    El corte en y elimina lo que quedaria embebido en el muro: geometria invisible que el Composer
    pagaria en triangulos y que ensancha el envelope del sprite sin aportar una sola cara vista.
    """
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # `clear_outer` tira lo que queda DEL LADO QUE APUNTA la normal, asi que cada plano apunta hacia
    # el exterior del vano: +x en la junta derecha y -x en la izquierda. Al reves se borra el modulo
    # entero, que es el fallo que esta funcion midi6 la primera vez.
    cuts = (
        ((BAY / 2.0, 0.0, 0.0), (1.0, 0.0, 0.0)),
        ((-BAY / 2.0, 0.0, 0.0), (-1.0, 0.0, 0.0)),
        ((0.0, PROJECTION_FRONT, 0.0), (0.0, 1.0, 0.0)),
        ((0.0, WALL_BACK, 0.0), (0.0, -1.0, 0.0)),
    )
    for co, no in cuts:
        bmesh.ops.bisect_plane(
            bm,
            geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
            plane_co=co,
            plane_no=no,
            clear_outer=True,
        )
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def converge_stambha_height(quality, *, tolerance=0.01, max_steps=6):
    """Ajusta la altura del estribo hasta que el vano mide exactamente la banda de 3,00 m.

    `arch_props.height` no es una cota absoluta: es un factor del arco, asi que la unica forma
    honesta de casar con la banda es medir y corregir. Se registra cada intento en el informe.
    """
    trial = BAND - 0.70
    log = []
    for _ in range(max_steps):
        obj = create_arch(trial, quality)
        top = max((obj.matrix_world @ v.co).z for v in obj.data.vertices)
        log.append({"stambhaHeight": round(trial, 4), "measuredTop": round(top, 4)})
        bpy.data.objects.remove(obj, do_unlink=True)
        if abs(top - BAND) <= tolerance:
            return trial, log
        trial += BAND - top
    raise lab.LabError(f"el vano no converge a la banda de {BAND} m: {log}")


def backing(mats, spring_z):
    """Trasero de muro, antepecho de piedra y vidrio: el vano no puede ser un agujero pasivo.

    El Composer valida el desarrollo horizontal de la banda, no la altura del modulo, asi que un
    vano hueco dejaria ver el interior del volumen. El trasero va al plano posterior del modulo GN
    equivalente y el vidrio se apoya en la linea de arrancada real del arco, medida, no supuesta.
    """
    return [
        cube("AB_wall", (0.0, WALL_BACK + 0.05, BAND / 2.0), (BAY, 0.10, BAND), mats["wall"]),
        cube("AB_parapet", (0.0, 0.06, PARAPET / 2.0), (BAY - 0.60, 0.28, PARAPET), mats["render"]),
        cube(
            "AB_glazing",
            (0.0, 0.02, PARAPET + (spring_z - PARAPET) / 2.0),
            (BAY - 0.70, 0.06, spring_z - PARAPET),
            mats["glass"],
        ),
    ]


def join(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    merged = bpy.context.object
    merged.name = name
    merged.data.name = name
    return merged


def normalize(obj):
    """Pivote en el centro de la crujia y solado en z=0, como los modulos GN de WP01."""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    # Traslacion rigida del mesh: recortar los vertices por debajo de z=0 hundiria la basa del
    # pilar y dejaria el modulo sin apoyo, que es justo el defecto de envelope que WP01 midio.
    lowest = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    if abs(lowest) > 1e-6:
        for vertex in obj.data.vertices:
            vertex.co.z -= lowest
    obj.data.update()


def measured(obj):
    xs = [(obj.matrix_world @ v.co) for v in obj.data.vertices]
    triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    return {
        "vertices": len(obj.data.vertices),
        "triangles": triangles,
        "bounds": {
            "x": [round(min(v.x for v in xs), 4), round(max(v.x for v in xs), 4)],
            "y": [round(min(v.y for v in xs), 4), round(max(v.y for v in xs), 4)],
            "z": [round(min(v.z for v in xs), 4), round(max(v.z for v in xs), 4)],
        },
        "materials": sorted(m.name for m in obj.data.materials if m),
    }


def main():
    args = parse_args()
    lab.clear_scene()
    module = lab.install_and_enable(EXT_ID)
    started = time.perf_counter()
    stambha, log = converge_stambha_height(QUALITY[args.quality])
    arch = create_arch(stambha, QUALITY[args.quality])
    cut_to_bay(arch)
    ensure_materials()
    mats = {key: bpy.data.materials[spec["name"]] for key, spec in MATERIALS.items()}
    arch.data.materials.clear()
    arch.data.materials.append(mats["render"])
    pieces = [arch] + backing(mats, spring_z=stambha)
    bay = join(pieces, OBJECT_NAME)
    normalize(bay)
    build_seconds = round(time.perf_counter() - started, 2)
    stats = measured(bay)

    Path(args.out_glb).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    bay.select_set(True)
    bpy.context.view_layer.objects.active = bay
    bpy.ops.export_scene.gltf(
        filepath=args.out_glb, export_format="GLB", use_selection=True, export_apply=True
    )

    provenance = dict(lab.EXTENSIONS[EXT_ID])
    provenance.update({
        "registryId": EXT_ID,
        "moduleId": module,
        "mood": args.mood,
        "invocation": "bpy.ops.mesh.arch_create() + obj.arch_props + builders.rebuild_mesh()",
        "adaptador": "tools/art-pipeline/blender/ext_lab/ag_module_bake.py",
        "glbSha256": hashlib.sha256(Path(args.out_glb).read_bytes()).hexdigest(),
        "licenceNote": (
            "GPL-3.0-or-later es la licencia del CODIGO de la extension. La geometria exportada se "
            "registra como authored-original del proyecto porque este repo no redistribuye el "
            "add-on: se instala en un perfil aislado de /tmp y solo se publica el GLB resultante."
        ),
    })
    report = {
        "schemaVersion": 1,
        "generator": "tools/art-pipeline/blender/ext_lab/ag_module_bake.py",
        "blender": bpy.app.version_string,
        "quality": args.quality,
        "mood": args.mood,
        "grid": {"bayMeters": BAY, "bandMeters": BAND, "wallBackMeters": WALL_BACK,
                 "projectionFrontMeters": PROJECTION_FRONT, "parapetMeters": PARAPET},
        "stambhaConvergence": log,
        "stambhaHeight": stambha,
        "archProps": arch_settings(stambha, QUALITY[args.quality]),
        "buildSeconds": build_seconds,
        "glb": str(Path(args.out_glb).resolve()),
        "measured": stats,
        "provenance": provenance,
    }
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    Path(args.report).write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", "utf-8")

    # Evidencia: el modulo solo y tileado tres veces, para que la junta se juzgue en la imagen.
    tiled = []
    for index in (-1, 1):
        clone = bay.copy()
        clone.data = bay.data
        clone.name = f"AGArcadeTile{index + 2}"
        clone.location = (index * BAY, 0.0, 0.0)
        bpy.context.collection.objects.link(clone)
        tiled.append(clone)
    lab.render_evidence(
        label=f"Arch Generator - vano civico de arcada 2x3 m ({args.quality}), tileado 3 veces",
        png_path=args.evidence_png,
        json_path=args.evidence_json,
        ortho_scale=8.6,
        target_z=1.6,
        # El vano mira a +Y, como declara `frontAxis` en el catalogo de modulos; la camara del
        # laboratorio esta en -Y para los edificios, asi que aqui hay que rodearla 180 grados o la
        # evidencia sale del trasero de muro y no del arco.
        azimuth=225.0,
        resolution=args.resolution,
        samples=args.samples,
        ground_plane=False,
        provenance=provenance,
        generated={"recipe": report, "note": (
            "Las tres instancias comparten el pilar de la junta: la crujia de 2 m se mantiene sin "
            "dosificar la extension. Materiales: piedra del atlas (gn_stone_trim) en arco, pilastra "
            "y antepecho; ladrillo (gn_brick_wall) en el trasero; vidrio oscuro en el hueco."
        )},
    )
    print(json.dumps({"quality": args.quality, **stats, "stambhaHeight": stambha}, ensure_ascii=False))


if __name__ == "__main__":
    main()

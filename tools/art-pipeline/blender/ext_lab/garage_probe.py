"""Sonda §6.C: las cuatro piezas de garaje de Kenney Retro Urban Kit a escala de Landlord.

`warehouse` necesita puertas industriales y muelles de carga. El Spike D-111 ya descartó las puertas
de Modular Buildings por peatonales; quedan estos cuatro muros con garaje. Antes de registrarlos como
módulos hay que responder dos cosas con números, no con la impresión de la miniatura:

1. qué miden realmente de ancho/alto frente a una crujía de 2 m y de 4 m, y
2. si su hueco sirve como muelle (camión: caja a 2,60 m y 2,50 m de ancho) o es puerta de cochera.

Se renderizan las cuatro junto a los volúmenes de referencia, sin tocar ningún manifiesto:

    blender -b --factory-startup -P tools/art-pipeline/blender/ext_lab/garage_probe.py -- \
        --resolution=1600 --samples=48
"""

import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lab_common  # noqa: E402
from runtime_asset import style_procedural_materials  # noqa: E402

REPO = lab_common.REPO_ROOT
PACK = "blender_artist/staging/third_party/cc0/extracted/kenney/retro-urban-kit/Models/GLB format"
PIECES = [
    "wall-a-garage",
    "wall-a-flat-garage",
    "wall-b-garage",
    "wall-b-flat-garage",
]
# Crujías que maneja el Composer (los módulos de fachada son de 2 m) y la alternativa de 4 m que
# plantea D-111 §6.C para nave industrial.
BAYS = [2.0, 4.0]
# Caja de carga de un camión rígido y altura de andén: la referencia que exige el brief.
TRUCK = {"width": 2.50, "height": 2.60, "depth": 1.20}
PERSON = 1.75
GAP = 0.9


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


def measure(unit, source_bounds):
    bounds = lab_common.bounds_of(unit["objects"])["size"]
    width, depth, height = bounds
    bays = {
        f"{bay:.0f}m": {
            "modulesPorCrujia": round(bay / width, 2) if width else None,
            "sobraFaltan": round(bay - width, 3),
        }
        for bay in BAYS
    }
    return {
        "id": unit["id"],
        "source": unit["source"],
        "sourceBounds": source_bounds,
        "meters": {
            "width": round(width, 3),
            "depth": round(depth, 3),
            "height": round(height, 3),
        },
        "boundsMin": lab_common.bounds_of(unit["objects"])["min"],
        "unitScaleIsOneMeter": abs(width - source_bounds["width"]) < 0.01,
        "triangles": sum(len(o.data.polygons) for o in unit["objects"] if o.type == "MESH"),
        "materials": sorted(
            {slot.material.name for o in unit["objects"] if o.type == "MESH" for slot in o.material_slots}
        ),
        "unresolvedTextures": unit["normalization"].get("unresolvedTextures", []),
        "bayFit": bays,
        "dockFit": {
            "camionAncho": TRUCK["width"],
            "camionAlto": TRUCK["height"],
            "cubreAnchoDeCaja": width >= TRUCK["width"],
            "cubreAltoDeCaja": height >= TRUCK["height"],
        },
    }


def main():
    options = {}
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    for token in argv:
        if token.startswith("--"):
            key, _, value = token[2:].partition("=")
            options[key] = value
    out_dir = Path(options.get("dir", REPO / "docs/art/graphics-capabilities/evidence/warehouse"))
    mood = options.get("mood", "day_civic")
    resolution = int(options.get("resolution", 1024))
    samples = int(options.get("samples", 48))

    lab_common.clear_scene()
    imported = []
    for piece in PIECES:
        objects, root, source, normalization = lab_common.import_cc0_module(
            f"{PACK}/{piece}.glb", unit_scale=1.0, name_hint=piece
        )
        bpy.context.view_layer.update()
        imported.append(
            {
                "id": piece,
                "objects": objects,
                "root": root,
                "source": str(source.relative_to(REPO)),
                "normalization": normalization,
                "record": measure(
                    {"id": piece, "objects": objects, "source": str(source.relative_to(REPO)),
                     "normalization": normalization},
                    normalization["sourceBounds"],
                ),
            }
        )

    # Franja tipo estantería: cada volumen con su hueco real, de izquierda a derecha, para que la
    # comparación de escala no dependa de adivinar el encuadre. El marco de crujía de 2 m es la
    # pregunta del brief: ¿cabe un garaje de Retro Urban en el módulo de fachada del Composer?
    bay = new_box("REF_BAY_2M", (BAYS[0], 0.06, 3.0), (0.0, 0.0, 1.5), (0.30, 0.42, 0.62))
    truck = new_box("REF_TRUCK", (TRUCK["width"], TRUCK["depth"], TRUCK["height"]),
                    (0.0, 0.0, TRUCK["height"] / 2), (0.62, 0.18, 0.16))
    person = new_box("REF_PERSON", (0.55, 0.35, PERSON), (0.0, 0.0, PERSON / 2), (0.85, 0.72, 0.5))
    row = [(bay, BAYS[0]), (truck, TRUCK["width"]), (person, 0.55)]
    row += [(item["root"], item["record"]["meters"]["width"]) for item in imported]
    # La cara buena de estos paños mira a +Y (medido: todas las normales de `wall-a-flat-garage` son
    # (0,+1,0); es una lámina de una sola cara, no un caja). La cámara de `render_evidence` entra por
    # -Y, así que veríamos el dorso: se mira desde +Y y se invierte el cursor para que la franja
    # siga leyendo de izquierda a derecha.
    total_width = sum(width for _obj, width in row) + GAP * (len(row) - 1)
    cursor = -total_width / 2
    for obj, width in row:
        obj.location.x = -(cursor + width / 2)
        cursor += width + GAP

    for item in imported:
        box = lab_common.bounds_of(item["objects"])
        item["record"]["placedMin"] = box["min"]
        item["record"]["placedSize"] = box["size"]
    records = [item["record"] for item in imported]
    style_layer = lab_common.load_style_layer(mood)
    style_procedural_materials(
        lab_common.active_mood(style_layer)["externalTreatment"], "building"
    )
    lab_common.link_to_collection(bpy.data.objects, "GARAGE_PROBE")

    png = out_dir / "garage_probe.png"
    meta = out_dir / "garage_probe.json"
    provenance = {
        "mood": mood,
        "capability": "kenney_retro_urban_kit",
        "question": "D-111 §6.C: ¿resuelven estas cuatro piezas una fachada industrial con muelle?",
        "pieces": records,
        "references": {"truck": TRUCK, "personHeightMeters": PERSON, "bayFrameMeters": BAYS[0]},
        "baysMeters": BAYS,
        "referenceOrder": ["REF_BAY_2M", "REF_TRUCK", "REF_PERSON"] + PIECES,
    }
    # Sin plano de suelo: con `film_transparent` el recorte por alpha se quedaría con el cuadro
    # completo (aqui, 12 m de cielo vacío) y las piezas saldrían como manchas de 40 px. La escala la
    # aportan los volúmenes de referencia, no la línea de ground.
    metadata = lab_common.render_evidence(
        label="D-111 §6.C garajes Retro Urban a escala",
        png_path=png,
        json_path=meta,
        ortho_scale=total_width * 1.06,
        target_z=1.45,
        resolution=resolution,
        samples=samples,
        azimuth=270.0,
        provenance=provenance,
        generated={"script": "tools/art-pipeline/blender/ext_lab/garage_probe.py"},
    )
    meta.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for record in records:
        meters = record["meters"]
        print(
            f"{record['id']}: {meters['width']}x{meters['depth']}x{meters['height']} m "
            f"tri={record['triangles']} escala1m={record['unitScaleIsOneMeter']} "
            f"muelle={record['dockFit']['cubreAnchoDeCaja']}/{record['dockFit']['cubreAltoDeCaja']} "
            f"texturas={len(record['unresolvedTextures'])} sin resolver"
        )
    print(f"evidencia: {png.relative_to(REPO)} · {metadata['image']['width']}x{metadata['image']['height']}")


if __name__ == "__main__":
    main()

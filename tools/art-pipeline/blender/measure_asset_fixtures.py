"""WP4.15-V.a 〔R3〕+〔R7〕: matriz de métricas de binario y de escala.

Mide fixtures reales de cada fuente (Kenney GLB, Kenney glTF de KayKit,
Quaternius FBX, Rocketbox FBX) en el formato que de verdad se publica:
PNG RGBA 8 bits con canal alfa, sin fondo.

    blender --background --python tools/art-pipeline/blender/measure_asset_fixtures.py

Salida: blender_artist/manifests/asset-metrics.json y tabla por consola.
"""

import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from source_import import (  # noqa: E402
    assert_textures_resolved,
    fix_texture_paths,
    import_source,
    normalize_import_root,
    world_bounds,
)
from spike_compatibility import (  # noqa: E402
    clear_scene,
    setup_camera,
    setup_lighting,
)

STAGING = ROOT / "blender_artist/staging/third_party"
STYLE_LAYER = HERE / "style_layer_graphic_civic.json"
OUT_PATH = ROOT / "blender_artist/manifests/asset-metrics.json"
RENDER_DIR = ROOT / "blender_artist/spike/metrics"
SIZES = (256, 512)

FIXTURES = [
    {
        "id": "bld_commercial",
        "category": "building",
        "sourceId": "src_kenney_city_commercial",
        "path": STAGING / "cc0/extracted/kenney/city-kit-commercial/Models/GLB format/building-a.glb",
        "unitScale": 1.0,
    },
    {
        "id": "bld_suburban",
        "category": "building",
        "sourceId": "src_kenney_city_suburban",
        "path": STAGING / "cc0/extracted/kenney/city-kit-suburban/Models/GLB format/building-type-u.glb",
        "unitScale": 1.0,
    },
    {
        "id": "bld_downtown",
        "category": "building",
        "sourceId": "src_quaternius_downtown_city_megakit",
        "path": STAGING / "cc0/extracted/quaternius/downtown-city-megakit/Exports/FBX (Unity)/Building_Medium_2_001.fbx",
        "unitScale": 1.0,
    },
    {
        "id": "bld_kaykit",
        "category": "building",
        "sourceId": "src_kaykit_city_builder_bits",
        "path": STAGING
        / "cc0/extracted/kaykit/city-builder-bits/KayKit-City-Builder-Bits-1.0-main/addons/kaykit_city_builder_bits/Assets/gltf/building_A.gltf",
        "unitScale": 1.0,
    },
    {
        "id": "ter_road",
        "category": "terrain",
        "sourceId": "src_kenney_city_roads",
        "path": STAGING / "cc0/extracted/kenney/city-kit-roads/Models/GLB format/road-straight.glb",
        "unitScale": 1.0,
    },
    {
        "id": "veh_truck",
        "category": "vehicle",
        "sourceId": "src_kenney_car_kit",
        "path": STAGING / "cc0/extracted/kenney/car-kit/Models/GLB format/truck.glb",
        "unitScale": 1.0,
    },
    {
        "id": "prp_tree",
        "category": "prop",
        "sourceId": "src_kenney_nature_kit",
        "path": STAGING / "cc0/extracted/kenney/nature-kit/Models/GLTF format/tree_pineTallB_detailed.glb",
        "unitScale": 1.0,
    },
    {
        "id": "chr_worker",
        "category": "character",
        "sourceId": "src_microsoft_rocketbox",
        "path": STAGING / "mit/rocketbox/avatars/Male_Adult_05/Export/Male_Adult_05.fbx",
        "unitScale": 1.0,
    },
]

# Supuestos de proyección, explícitos para que el usuario los corrija.
PROJECTION = {
    "fase2": {
        "buildingStates": 4,
        "buildings": 3,
        "terrainPropsVehicles": 5,
        "characters": 3,
        "directions": 4,
        "animations": 2,
        "framesPerAnimation": 2,
    },
    "beta": {
        "buildingStates": 4,
        "buildings": 8,
        "terrainPropsVehicles": 12,
        "characters": 6,
        "directions": 4,
        "animations": 2,
        "framesPerAnimation": 4,
    },
}


def load_style_layer():
    return json.loads(STYLE_LAYER.read_text())


def render_sprite(obj, size, out_file, style_layer):
    """Render en el formato que se publica: RGBA 8 bits con alfa."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    post = style_layer["rendering"]["postProcessing"]
    scene.view_settings.view_transform = post.split(" - ")[0]
    try:
        scene.view_settings.look = post
    except TypeError:
        pass

    setup_camera(obj, margin=1.12, min_scale=1.2)
    setup_lighting(style_layer)
    scene.render.filepath = str(out_file)
    bpy.ops.render.render(write_still=True)
    return out_file.stat().st_size


def measure(fixture, style_layer):
    label = fixture["id"]
    print(f"\n=== {label} ({fixture['category']}) ===")
    clear_scene()
    objects = import_source(fixture["path"])
    if fixture["path"].suffix.lower() == ".fbx":
        fix_texture_paths(fixture["path"])
    assert_textures_resolved(objects, fixture["path"])

    norm = normalize_import_root(objects, unit_scale=fixture["unitScale"])
    meshes = [o for o in objects if o.type == "MESH"]
    body = max(meshes, key=lambda m: len(m.data.vertices))
    mins, maxs = world_bounds(objects)
    size = [round(maxs[i] - mins[i], 3) for i in range(3)]
    print(f"  dimensión mundial tras normalizar: {size[0]} x {size[1]} x {size[2]} m")
    print(f"  sourceBounds: {norm['sourceBounds']}  importScale: {norm['importScale']}")

    bytes_by_size = {}
    for px in SIZES:
        out_file = RENDER_DIR / f"{label}_{px}.png"
        out_file.parent.mkdir(parents=True, exist_ok=True)
        n = render_sprite(body, px, out_file, style_layer)
        bytes_by_size[str(px)] = n
        print(f"  PNG {px}px: {n:,} bytes")

    return {
        "id": label,
        "category": fixture["category"],
        "sourceId": fixture["sourceId"],
        "path": str(fixture["path"].relative_to(ROOT)),
        "unitScale": fixture["unitScale"],
        "worldSizeMeters": {"x": size[0], "y": size[1], "z": size[2]},
        "normalization": norm,
        "pngBytes": bytes_by_size,
        "vertices": len(body.data.vertices),
        "objects": len(objects),
    }


def project(rows):
    """Extrapolación a bundle completo usando la media medida por categoría."""
    out = {}
    for scenario, spec in PROJECTION.items():
        building_n = spec["buildings"] * spec["buildingStates"]
        dressing_n = spec["terrainPropsVehicles"]
        char_n = (
            spec["characters"]
            * spec["directions"]
            * spec["animations"]
            * spec["framesPerAnimation"]
        )
        by_size = {}
        for px in SIZES:
            samples = {}
            for row in rows:
                samples.setdefault(row["category"], []).append(row["pngBytes"][str(px)])
            mean = {k: sum(v) / len(v) for k, v in samples.items()}
            # El dressing mezcla terreno, props y vehículos a partes iguales.
            dressing_keys = [k for k in ("terrain", "prop", "vehicle") if k in mean]
            dressing_mean = (
                sum(mean[k] for k in dressing_keys) / len(dressing_keys) if dressing_keys else 0
            )
            total = (
                building_n * mean.get("building", 0)
                + dressing_n * dressing_mean
                + char_n * mean.get("character", 0)
            )
            by_size[str(px)] = {
                "pngCount": building_n + dressing_n + char_n,
                "meanBytesByCategory": {k: round(v) for k, v in mean.items()},
                "bytes": round(total),
                "megabytes": round(total / 1_048_576, 1),
            }
        out[scenario] = {"assumptions": spec, "bySize": by_size}
    return out


def main():
    style_layer = load_style_layer()
    rows = []
    for fixture in FIXTURES:
        try:
            rows.append(measure(fixture, style_layer))
        except Exception as error:  # noqa: BLE001 - el informe debe listarlo todo
            print(f"  ERROR {fixture['id']}: {error}")
            rows.append(
                {
                    "id": fixture["id"],
                    "category": fixture["category"],
                    "sourceId": fixture["sourceId"],
                    "path": str(fixture["path"].relative_to(ROOT)),
                    "error": str(error),
                }
            )

    ok = [r for r in rows if "error" not in r]
    report = {
        "schemaVersion": 1,
        "purpose": "WP4.15-V.a 〔R3〕 presupuesto de binario y 〔R7〕 escala física común",
        "renderContract": "PNG RGBA 8-bit, film_transparent, EEVEE, AgX",
        "budget": json.loads((ROOT / "docs/art/BINARY-ALLOWLIST.json").read_text()),
        "fixtures": rows,
        "projection": project(ok),
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(report, indent=2))

    print("\n=== RESUMEN ===")
    print(f"{'fixture':18s} {'categoría':11s} {'mundo (x,y,z) m':22s} {'256px':>9s} {'512px':>9s}")
    for row in ok:
        s = row["worldSizeMeters"]
        print(
            f"{row['id']:18s} {row['category']:11s} "
            f"{s['x']:6.2f} {s['y']:6.2f} {s['z']:6.2f}   "
            f"{row['pngBytes']['256']:>9,} {row['pngBytes']['512']:>9,}"
        )
    failed = [r["id"] for r in rows if "error" in r]
    if failed:
        print(f"\nfixtures con error: {', '.join(failed)}")
    print(f"\ninforme: {OUT_PATH.relative_to(ROOT)}")
    limit = report["budget"]["maxBinaryBytes"]
    print(f"techo por fichero: {limit:,} bytes")
    for row in ok:
        for px, n in row["pngBytes"].items():
            if n > limit:
                print(f"  FUERA DE PRESUPUESTO: {row['id']} @ {px}px = {n:,}")


if __name__ == "__main__":
    main()

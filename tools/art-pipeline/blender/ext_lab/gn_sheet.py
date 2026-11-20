"""D-111 §8.2 — hoja de evidencia visual del sistema de fachada en Geometry Nodes.

Dos fotogramas, misma cámara/luz/recorte que el control del Building Composer:

  1. `gn_parts.png`  las cinco crujías del sistema lado a lado (identidad, relieve y escala).
  2. `gn_params.png`  la MISMA pieza con un solo número cambiado por columna: montantes, dentículos
     y balaustres. Es la prueba de que la repetición arquitectónica es un parámetro vivo del
     modificador y no una regeneración desde Python.

Las mallas se obtienen del modificador en vivo (`parametric_host` + `measured_mesh`), igual que en
la generación de los GLB, así que la hoja muestra exactamente lo que se publicó en el catálogo.
"""

import json
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import lab_common  # noqa: E402  (inserta tools/art-pipeline/blender en sys.path)
import gn_facade_grammar as gn  # noqa: E402
from lab_common import clear_scene, render_evidence  # noqa: E402

REPO = lab_common.REPO_ROOT
PART_SPACING = 2.6
PROBE_SPACING_X = 2.6
PROBE_SPACING_Y = 4.0


def realized(part, overrides=None):
    """Una crujía del árbol, evaluada con sus parámetros (o con los que se quieran sobreescribir)."""
    params = dict(gn.part_parameters(part, 7))
    if overrides:
        params.update(overrides)
    tree = gn.BUILDERS[part](params)
    host, modifier = gn.parametric_host(tree, params, f"host_{part}")
    mesh = gn.measured_mesh(host)
    bpy.data.objects.remove(host, do_unlink=True)
    return mesh, tree, modifier


def place(mesh, name, location):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return obj


def sheet_parts(png, meta, mood, resolution, samples):
    clear_scene()
    gn.ensure_materials()
    entries = []
    for index, part in enumerate(gn.PARTS):
        mesh, _tree, _modifier = realized(part)
        stats = gn.mesh_stats(mesh)
        place(mesh, f"part_{part}", (index * PART_SPACING, 0.0, 0.0))
        entries.append({"part": part, **stats})
    provenance = {
        "mood": mood,
        "capability": "geometry_nodes_facade_grammar",
        "sheet": "parts",
        "grid": {"bayMeters": 2.0, "floorHeightMeters": 3.0},
        "parts": entries,
    }
    return render_evidence(
        label="D-111 §8.2 cinco crujías del sistema GN",
        png_path=png,
        json_path=meta,
        ortho_scale=len(entries) * PART_SPACING + 2.0,
        target_z=1.5,
        resolution=resolution,
        samples=samples,
        azimuth=30.0,
        provenance=provenance,
    )


def sheet_params(png, meta, mood, resolution, samples):
    clear_scene()
    gn.ensure_materials()
    rows = []
    for row, (part, (name, values)) in enumerate(gn.PROBES.items()):
        cells = []
        for column, value in enumerate(values):
            started = time.perf_counter()
            mesh, _tree, _modifier = realized(part, {name: value})
            evaluate_ms = round((time.perf_counter() - started) * 1000, 2)
            stats = gn.mesh_stats(mesh)
            place(mesh, f"probe_{part}_{value}", (column * PROBE_SPACING_X, -row * PROBE_SPACING_Y, 0.0))
            cells.append({"value": value, "evaluateMs": evaluate_ms, **stats})
        rows.append({"part": part, "parameter": name, "cells": cells})
    provenance = {
        "mood": mood,
        "capability": "geometry_nodes_facade_grammar",
        "sheet": "parametric_probe",
        "reading": "cada columna cambia UN número del modificador vivo; la geometría se re-evalúa, no se re-programa",
        "rows": rows,
    }
    return render_evidence(
        label="D-111 §8.2 repetición paramétrica (montantes, dentículos, balaustres)",
        png_path=png,
        json_path=meta,
        ortho_scale=PROBE_SPACING_X * 3 + 3.0,
        target_z=1.4,
        resolution=resolution,
        samples=samples,
        azimuth=28.0,
        provenance=provenance,
    )


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    options = {
        token.split("=", 1)[0][2:]: token.split("=", 1)[1]
        for token in argv
        if token.startswith("--") and "=" in token
    }
    out_dir = Path(options.get("outDir", "docs/art/graphics-capabilities/evidence/geometry-nodes"))
    if not out_dir.is_absolute():
        out_dir = REPO / out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    mood = options.get("mood", "day_civic")
    resolution = int(options.get("resolution", 1024))
    samples = int(options.get("samples", 48))
    results = []
    for sheet, function in (("gn_parts", sheet_parts), ("gn_params", sheet_params)):
        try:
            metadata = function(out_dir / f"{sheet}.png", out_dir / f"{sheet}.json", mood, resolution, samples)
            results.append({"sheet": sheet, "ok": True, "png": metadata["image"]["path"],
                            "triangles": metadata["geometry"]["triangles"],
                            "seconds": metadata["render"]["seconds"]})
        except Exception as error:  # una hoja caída no detiene la otra
            import traceback

            traceback.print_exc(limit=5)
            results.append({"sheet": sheet, "ok": False, "error": f"{type(error).__name__}: {error}"})
    (out_dir / "summary.json").write_text(
        json.dumps({"schemaVersion": 1, "task": "D-111 §8.2 GN sheets", "sheets": results}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()

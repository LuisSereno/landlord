#!/usr/bin/env python3
"""Inspecciona piezas de cabeza de bases alternativas Kenney para WP-CHAR-02C."""

import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
WP02A_TOOLS = TOOL_DIR.parent / "wp_char_02a"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"No se puede cargar {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--runtime-asset", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_path = Path(args.output).resolve()
    runtime_path = Path(args.runtime_asset).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    if output_path.exists():
        raise RuntimeError(f"La salida ya existe: {output_path}")
    common = load_module("wp02c_inspect_common", WP02A_TOOLS / "diagnose_rocketbox_animation.py")
    worker = load_module("wp02c_inspect_worker", WP02A_TOOLS / "render_worker_reference.py")
    diagnostic = load_module("wp02c_inspect_diagnostic", TOOL_DIR / "diagnose_head_defects.py")
    source_import = load_module("wp02c_inspect_source", runtime_path.parent / "source_import.py")
    report = {"schemaVersion": 1, "status": "source_head_inspected", "runtimePromotion": False, "sources": {}}
    for role in ("enforcer", "firefighter"):
        candidate = config["candidates"][role]
        source_path = source_root / candidate["sourcePath"]
        if common.sha256(source_path) != candidate["sourceSha256"]:
            raise RuntimeError(f"Hash incorrecto: {role}")
        common.clear_scene()
        imported = source_import.import_source(source_path)
        source_import.assert_textures_resolved(imported, source_path)
        armature = next(obj for obj in imported if obj.type == "ARMATURE")
        objects = worker.character_objects(armature)
        head = next(obj for obj in objects if obj.type == "MESH" and obj.name == "head-mesh")
        report["sources"][role] = {
            "source": {"path": str(source_path), "sha256": common.sha256(source_path), "license": "CC0-1.0"},
            "head": diagnostic.head_report(head),
        }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "source_heads_inspected", "roles": list(report["sources"]), "report": str(output_path)}, ensure_ascii=False))
    print("WP_CHAR_02C_SOURCE_HEAD_INSPECTION_OK")


if __name__ == "__main__":
    main()

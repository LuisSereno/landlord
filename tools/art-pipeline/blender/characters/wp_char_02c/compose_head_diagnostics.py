#!/usr/bin/env python3
"""Compone las láminas A/B/C del diagnóstico de cabeza WP-CHAR-02C."""

import hashlib
import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[5]
TOOL_DIR = Path(__file__).resolve().parent
DIAGNOSTICS = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c/diagnostics-v3"
REVIEW = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02c/diagnostics"
ROLES = ("supervisor", "enforcer", "firefighter")
LABELS = {"supervisor": "Supervisor", "enforcer": "Enforcer", "firefighter": "Bombero"}
FINDINGS = {
    "supervisor": [
        "La zona blanca ya existe en el GLB original.",
        "La cabeza usa un único atlas `colormap`; no hay material local por pieza.",
        "El casco de 02B no cubre la coronilla; el pelo se ve entre domo y ala.",
        "Causa confirmada: región clara del atlas en la pieza superior del pelo.",
        "Solución: recolorear localmente esa pieza y ampliar el elemento de cabeza.",
    ],
    "enforcer": [
        "El círculo oscuro ya existe en el GLB original.",
        "La pieza superior del pelo reevalúa una región oscura del mismo atlas.",
        "La gorra de 02B es estable, pero no tapa el círculo en todas las vistas.",
        "Causa confirmada: atlas de pelo original, no un hueco ni un accesorio.",
        "Solución: eliminar la dependencia del pelo oscuro y reforzar silueta/chaqueta.",
    ],
    "firefighter": [
        "La barba pertenece a la geometría original `character-male-b`.",
        "El casco de 02B mide 0,58 m frente a una cabeza de 1,234 m (47%).",
        "El ala mide 0,72 m (58%); por eso el casco parece diminuto.",
        "El anclaje no falla: deriva máxima < 0,000001 m.",
        "Solución: base sin barba y casco de mayor cobertura con visera/reborde.",
    ],
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_helpers():
    path = TOOL_DIR.parent / "wp_char_02a/compose_worker_review_sheets.py"
    spec = importlib.util.spec_from_file_location("wp02c_diag_helpers", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    helpers = load_helpers()
    REVIEW.mkdir(parents=True, exist_ok=True)
    report = json.loads((DIAGNOSTICS / "head-defects-diagnosis.json").read_text(encoding="utf-8"))
    generated = []
    inputs = []
    for role in ROLES:
        paths = {
            "A": DIAGNOSTICS / f"{role}-A_original-d0-idle-00.png",
            "B": DIAGNOSTICS / f"{role}-B_wp02b_candidate-d0-idle-00.png",
            "C": DIAGNOSTICS / f"{role}-C_no_accessories-d0-idle-00.png",
            "M": DIAGNOSTICS / f"{role}-C_material_map-d0-idle-00.png",
            "P": DIAGNOSTICS / f"{role}-C_component_map-d0-idle-00.png",
        }
        for path in paths.values():
            inputs.append({"path": str(path.relative_to(REPO_ROOT)), "sha256": sha256(path), "role": role})
        canvas = Image.new("RGBA", (1600, 1020), (238, 235, 225, 255))
        draw = ImageDraw.Draw(canvas)
        draw.text((28, 20), f"WP-CHAR-02C · Diagnóstico de cabeza · {LABELS[role]}", fill=(30, 35, 38), font=helpers.font(27))
        draw.text((28, 58), "A = GLB original · B = candidato 02B · C = mismo candidato sin accesorios · mapas sólo de cabeza", fill=(70, 75, 77), font=helpers.font(14))
        images = {key: helpers.crop_alpha(Image.open(path).convert("RGBA")) for key, path in paths.items()}
        panels = (
            ("A", "A · GLB original", "Sin modificar materiales ni geometría"),
            ("B", "B · Candidato WP-CHAR-02B", "Materiales regionales + accesorios"),
            ("C", "C · Sin accesorios", "Aísla el origen en malla/atlas"),
        )
        for index, (key, title, subtitle) in enumerate(panels):
            helpers.panel(canvas, draw, helpers.gamma(images[key]), 25 + index * 520, 100, 500, 360, title, subtitle)
        helpers.panel(canvas, draw, helpers.gamma(images["M"]), 25, 500, 360, 280, "Mapa de materiales", "Un slot = un atlas colormap")
        helpers.panel(canvas, draw, helpers.gamma(images["P"]), 405, 500, 360, 280, "Mapa de piezas", "Color por componente conectado")
        draw.rectangle((790, 500, 1575, 780), fill=(248, 246, 239), outline=(190, 188, 178), width=1)
        draw.text((812, 518), "Hallazgos medidos", fill=(35, 40, 42), font=helpers.font(18))
        for index, line in enumerate(FINDINGS[role]):
            draw.text((812, 558 + index * 40), f"• {line}", fill=(55, 60, 62), font=helpers.font(14))
        head = report["roles"][role]["variants"]["A_original"]["sourceHead"]
        draw.text((28, 820), f"Cabeza: {len(head['components'])} piezas · {head['polygons']} polígonos · 1 material · rig de 7 huesos", fill=(55, 60, 62), font=helpers.font(15))
        draw.text((28, 852), "Los componentes se agrupan por posición de vértices, no por costuras UV. Los mapas son diagnóstico, no arte final.", fill=(70, 75, 77), font=helpers.font(13))
        draw.text((28, 900), "Composición offline; no es captura de Phaser. Estado: diagnóstico técnico, revisión artística pendiente.", fill=(70, 75, 77), font=helpers.font(13))
        path = REVIEW / f"01-head-{role}.png"
        canvas.convert("RGB").save(path, optimize=True, compress_level=9)
        generated.append(path)
    manifest = {
        "schemaVersion": 1,
        "status": "head_diagnostic_review_pending",
        "runtimePromotion": False,
        "diagnosis": str((DIAGNOSTICS / "head-defects-diagnosis.json").relative_to(REPO_ROOT)),
        "diagnosisSha256": sha256(DIAGNOSTICS / "head-defects-diagnosis.json"),
        "inputs": inputs,
        "sheets": [
            {
                "path": str(path.relative_to(REPO_ROOT)),
                "sha256": sha256(path),
                "bytes": path.stat().st_size,
                "width": Image.open(path).width,
                "height": Image.open(path).height,
            }
            for path in generated
        ],
    }
    (REVIEW / "head-diagnostics-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(generated), "manifest": str((REVIEW / "head-diagnostics-manifest.json").relative_to(REPO_ROOT))}, ensure_ascii=False))


if __name__ == "__main__":
    main()

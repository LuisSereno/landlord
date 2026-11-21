"""Medidor de la sección de daño y de su anomalía de cornisas (D-111.2 §6.3).

WP04 declaró `WP04-D1`: `_compose_damage` comparaba algunos `purpose` con valores exactos
(`dormer`, `cornice`) mientras el compositor publica identificadores compuestos
(`cornice:front:3`, y los dormerios viajan como `roof:x:near:row0:bay1`). La igualdad nunca casaba,
así que la cornisa del semiplano dañado sobrevivía a la sección de cubierta y quedaba flotando sobre
el hueco.

Este sondeo mide, sobre los MISMOS candidatos QA de la hoja de weathering (lee sus `request` del
manifiesto publicado, no los reinventa):

  · cuántas colocaciones se llevan realmente las dos reglas — la declarada con igualdad y la corregida
    con prefijo — y qué grupos sobreviven en el semiplano dañado (x ≥ 0);
  · qué hace cada regla con la caja de daño (`_damage_rect` / `_damage_z`), que es de donde se anclan
    escombros, llama y humo: cambiar la regla no sólo quita módulos, mueve la cota del incendio;
  · el estado real del código, recomponiendo los candidatos `damaged` y `burning` y comprobando que ya
    no queda ninguna cornisa en el semiplano dañado.

Corre sin Blender (`compose_candidate` es geometría pura), así que es barato y repetible.

Salida: `docs/art/graphics-capabilities/evidence/v2/weathering/damage_section_probe.json`.

Uso: python3 tools/art-pipeline/blender/ext_lab/damage_section_probe.py
"""

import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
BLENDER_DIR = HERE.parent
if str(BLENDER_DIR) not in sys.path:
    sys.path.insert(0, str(BLENDER_DIR))

from building_composer.compose import compose_candidate  # noqa: E402
from building_composer.grammar import GrammarDocument  # noqa: E402
from building_composer.module_catalog import Catalog  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402

REPO_ROOT = BLENDER_DIR.parent.parent.parent
CANDIDATE_DIR = REPO_ROOT / "docs/art/graphics-capabilities/evidence/v2/weathering/day"
OUTPUT = CANDIDATE_DIR.parent / "damage_section_probe.json"

### Las dos reglas. `igualdad` es la de WP04 (comparación exacta, inerte para las colocaciones
# compuestas); `prefijo` es la corregida: el prefijo es lo que el compositor realmente publica.
IGUALDAD = "igualdad"
PREFIJO = "prefijo"


def secciona(placements, regla):
    """Reproduce el corte de `_compose_damage` con la regla dada. Devuelve (retiradas, conservadas)."""
    removed, kept = [], []
    for record in placements:
        purpose = record["purpose"]
        if regla == IGUALDAD:
            cubierto = purpose.startswith("roof") or purpose in ("dormer", "cornice")
        else:
            cubierto = purpose.startswith(("roof", "cornice"))
        if cubierto and record["position"][0] >= 0.0:
            removed.append(record)
            continue
        if purpose.startswith("band:front:") and ":level" in purpose:
            tag = purpose.split(":level")[1].split(":")[0]
            if tag.isdigit() and int(tag) >= 2 and record["position"][0] >= 0.0:
                removed.append(record)
                continue
        kept.append(record)
    return removed, kept


def caja(bounds):
    """La `_damage_rect`/`_damage_z` que produciría esa lista de colocaciones retiradas."""
    if not bounds:
        return None
    return {
        "rect": [
            round(min(b["x"]["min"] for b in bounds), 3),
            round(min(b["y"]["min"] for b in bounds), 3),
            round(max(b["x"]["max"] for b in bounds), 3),
            round(max(b["y"]["max"] for b in bounds), 3),
        ],
        "z": [
            round(min(b["z"]["min"] for b in bounds), 3),
            round(max(b["z"]["max"] for b in bounds), 3),
        ],
    }


def grupo(purpose):
    if purpose.startswith("roof"):
        return "roof"
    if purpose.startswith("cornice"):
        return "cornice"
    if purpose.startswith("band:front:"):
        tag = purpose.split(":level")[1].split(":")[0] if ":level" in purpose else "?"
        return f"band:front:level{tag}"
    if purpose.startswith("damage:"):
        return "damage:debris"
    if purpose.startswith("fire:"):
        return "fire"
    return "otro"


def resumen(placements):
    damaged_side = [p for p in placements if p["position"][0] >= 0.0]
    return {
        "total": len(placements),
        "porGrupo": dict(sorted(Counter(grupo(p["purpose"]) for p in placements).items())),
        "enSemiplanoDanado": dict(
            sorted(Counter(grupo(p["purpose"]) for p in damaged_side).items())
        ),
    }


def main():
    catalog, document = Catalog(), GrammarDocument()
    rows = []
    for path in sorted(CANDIDATE_DIR.glob("vw_*.json")):
        metadata = json.loads(path.read_text(encoding="utf-8"))
        request = metadata["request"]
        profile = StyleProfile(request["styleProfileId"])
        composition = compose_candidate(request, catalog, profile, document)
        placements = composition["placements"]
        row = {
            "candidateId": request["candidateId"],
            "state": request["state"],
            "weathering": request.get("weathering"),
            "peticion": str(path.relative_to(REPO_ROOT)),
            "firmas": {
                "composicion": composition.get("compositionSignature"),
                "publicada": metadata.get("compositionSignature"),
                "coinciden": composition.get("compositionSignature")
                == metadata.get("compositionSignature"),
            },
            "compuesto": resumen(placements),
        }
        if request["state"] in ("damaged", "burning"):
            # El candidato ya viene seccionado: lo que se mide aquí es qué dejó pasar el código actual.
            row["cornisasVivasEnSemiplanoDanado"] = sum(
                1
                for p in placements
                if p["purpose"].startswith("cornice") and p["position"][0] >= 0.0
            )
            if composition.get("fireAnchors"):
                row["anclasDeFuego"] = [
                    {
                        "focus": anchor.get("focus"),
                        "x": round(anchor["position"][0], 3),
                        "y": round(anchor["position"][1], 3),
                        "z": round(anchor["position"][2], 3),
                    }
                    for anchor in composition["fireAnchors"]
                ]
        else:
            # Geometría íntegra: sobre ella se comparan las dos reglas, que es el A/B que pide §6.3.
            for nombre, regla in (("igualdad_WP04", IGUALDAD), ("prefijo_corregida", PREFIJO)):
                removed, _ = secciona(placements, regla)
                row[f"regla_{nombre}"] = {
                    "retiradas": len(removed),
                    "porGrupo": dict(sorted(Counter(grupo(p["purpose"]) for p in removed).items())),
                    "cajaDanio": caja([p["bounds"] for p in removed]),
                }
        rows.append(row)

    intacta = next(
        row for row in rows if row["state"] == "complete" and row["weathering"] == "conserved"
    )
    antes = intacta.get("regla_igualdad_WP04", {})
    despues = intacta.get("regla_prefijo_corregida", {})
    verdict = {
        "candidatoMedido": intacta["candidateId"],
        "retiradasAntes": antes.get("retiradas"),
        "retiradasDespues": despues.get("retiradas"),
        "diferenciaModulos": (despues.get("retiradas") or 0) - (antes.get("retiradas") or 0),
        "cajaDanioAntes": antes.get("cajaDanio"),
        "cajaDanioDespues": despues.get("cajaDanio"),
        "firmasIntactas": all(row["firmas"]["coinciden"] for row in rows),
        "cornisasVivasEnDanados": sum(
            row.get("cornisasVivasEnSemiplanoDanado", 0)
            for row in rows
            if row["state"] in ("damaged", "burning")
        ),
    }
    rules = {
        "igualdad_WP04": "purpose.startswith('roof') | purpose in ('dormer','cornice') — la igualdad "
        "nunca casa con los ids compuestos, y los dormerios ya viajan bajo 'roof:…'",
        "prefijo_corregida": "purpose.startswith(('roof', 'cornice')) — lo que publica el compositor",
    }
    document_out = {
        "schemaVersion": 1,
        "generatedBy": "tools/art-pipeline/blender/ext_lab/damage_section_probe.py",
        "task": "D-111.2 §6.3 — anomalía de cornisas en `_compose_damage` (WP04-D1)",
        "candidateDir": str(CANDIDATE_DIR.relative_to(REPO_ROOT)),
        "rules": rules,
        "candidates": rows,
        "verdict": verdict,
    }
    OUTPUT.write_text(json.dumps(document_out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(verdict, indent=1, ensure_ascii=False))
    print(f"escrito en {OUTPUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

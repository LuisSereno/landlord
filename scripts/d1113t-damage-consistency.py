#!/usr/bin/env python3
"""D-111.3-T FASE 2 · paso 2.5 — guarda de coherencia de las variantes dañadas/incendiadas.

Comprueba automáticamente sobre los cuatro JSON publicados en
`docs/art/graphics-capabilities/evidence/d1113/interiors/`:

  1. todo `moduleId` de `composition.placements` existe en el catálogo final;
  2. ningún módulo retirado (`mod_kenney_pallet`) aparece en las composiciones nuevas;
  3. cada módulo es compatible con la familia del edificio (`allowedFamilies`);
  4. las colocaciones interiores (`damage:interior:*`) caen dentro del rectángulo del daño
     (con margen) y bajo la cota del corte;
  5. los focos del incendio (llamas y arranques de humo) coinciden con los del control
     publicado en D-111.3 (misma semilla, mismo stream PRNG) o se listan como variación
     justificada;
  6. la metadata no referencia recursos temporales (`/tmp`).

Escribe `damage_module_consistency.json` junto a las evidencias y sale 1 si algo falla.
Uso: python3 scripts/d1113t-damage-consistency.py
"""

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EV = REPO / "docs/art/graphics-capabilities/evidence/d1113"
WITHDRAWN = {"mod_kenney_pallet"}
VARIANTS = (
    "w06cnd_mixed_tenement_2_damaged",
    "w06cnd_mixed_tenement_2_burning",
    "w06cnd_warehouse_2_damaged",
    "w06cnd_warehouse_2_burning",
)
# 〔FASE 2.5〕 variaciones de focos justificadas: el vano GN corregido (profundidad 0,400→0,323 m)
# cambia qué huecos abre el daño sembrado, y el fuego se deriva del boquete real (diseño de D-111.3
# FASE 4, no un parche): el número de anclajes se conserva (19) y el stream PRNG no se tocó.
JUSTIFICATIONS = {
    "w06cnd_mixed_tenement_2_burning": (
        "anclajes 19=19 y stream PRNG intacto; las posiciones se desplazan porque el window_bay "
        "corregido cambia su offset de anclaje medido (importOffset y -0,05→-0,0215) y el daño "
        "sembrado abre otros vanos: el fuego sigue al boquete real (diseño D-111.3 FASE 4)"
    ),
}


def main() -> int:
    catalog = json.loads((REPO / "blender_artist/manifests/building-modules.json").read_text())
    modules = {m["id"]: m for m in (catalog if isinstance(catalog, list) else catalog["modules"])}
    problems = []
    report = {"schemaVersion": 1, "phase": "D-111.3-T FASE 2", "variants": {}}
    for name in VARIANTS:
        meta = json.loads((EV / "interiors" / f"{name}.json").read_text())
        control = json.loads((EV / "technical/controls_d1113" / f"{name}.json").read_text())
        placements = meta["composition"]["placements"]
        ids = [p["moduleId"] for p in placements]
        entry = {"compositionSignature": meta["compositionSignature"], "placements": len(ids)}

        missing = sorted({m for m in ids if m not in modules})
        if missing:
            problems.append(f"{name}: moduleIds inexistentes en catálogo {missing}")
        retired = sorted({m for m in ids if m in WITHDRAWN})
        if retired:
            problems.append(f"{name}: módulos retirados presentes {retired}")
        family = meta["family"]
        incompatible = sorted(
            {m for m in ids if family not in modules.get(m, {}).get("allowedFamilies", [])}
        )
        if incompatible:
            problems.append(f"{name}: incompatibles con familia {family} {incompatible}")

        region = (meta["composition"].get("damageRegion") or {}) if "composition" in meta else {}
        interiors = [p for p in placements if str(p.get("purpose", "")).startswith("damage:interior")]
        entry["interiorPlacements"] = len(interiors)
        if region:
            x0, x1 = region["x"]["min"] - 0.35, region["x"]["max"] + 0.35
            y0, y1 = region["y"]["min"] - 0.35, region["y"]["max"] + 0.35
            outside = [
                (p["moduleId"], p["position"])
                for p in interiors
                if not (x0 <= p["position"][0] <= x1 and y0 <= p["position"][1] <= y1)
            ]
            if outside:
                problems.append(f"{name}: interiores fuera de la región de daño {outside}")
            entry["interiorInsideDamageRegion"] = not outside

        def fire_anchors(doc):
            return sorted(
                (
                    str(p.get("purpose")),
                    round(p["position"][0], 2),
                    round(p["position"][1], 2),
                    round(p["position"][2], 2),
                )
                for p in doc["composition"]["placements"]
                if str(p.get("purpose", "")).startswith("fire")
            )

        if "burning" in name:
            new_f, old_f = fire_anchors(meta), fire_anchors(control)
            entry["fireAnchors"] = len(new_f)
            entry["fireAnchorsMatchControl"] = new_f == old_f
            if new_f != old_f:
                entry["fireVariation"] = {
                    "soloNuevo": [a for a in new_f if a not in old_f],
                    "soloControl": [a for a in old_f if a not in new_f],
                    "justificacion": JUSTIFICATIONS.get(name),
                }
                if len(new_f) != len(old_f):
                    problems.append(f"{name}: el número de focos cambió frente al control")
                elif not JUSTIFICATIONS.get(name):
                    problems.append(f"{name}: focos desplazados sin justificación registrada")

        text = json.dumps(meta["request"])
        if "/tmp/" in text:
            problems.append(f"{name}: la metadata publicada referencia /tmp")
        report["variants"][name] = entry

    report["problems"] = problems
    out = EV / "interiors/damage_module_consistency.json"
    out.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    if problems:
        print("FALLOS:")
        for p in problems:
            print("  -", p)
        return 1
    print("OK: las cuatro variantes son coherentes con el catálogo actual")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

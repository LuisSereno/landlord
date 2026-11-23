#!/usr/bin/env python3
"""D-111.3-T FASE 3 · paso 3 — manifiesto de reproducibilidad.

Enumera las ENTRADAS versionadas (con SHA-256) que necesita cualquier agente para volver a
generar las comparativas de D-111.3/D-111.3-T desde un checkout limpio, y los mandatos exactos.
No hay dependencias de /tmp: si algo falta en Git, este manifiesto lo declara como bloqueado.

Uso: python3 scripts/d1113t-reproducibility-manifest.py
"""

import hashlib
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EV = REPO / "docs/art/graphics-capabilities/evidence"
OUT = EV / "d1113/technical/reproducibility_manifest.json"


def sha(rel: str) -> str:
    return hashlib.sha256((REPO / rel).read_bytes()).hexdigest()


def entry(rel: str) -> dict:
    return {"path": rel, "sha256": sha(rel)}


def main() -> None:
    inputs = {
        "glbVentanaCorregido": entry("blender_artist/sources/original/gn_window_bay_2m.glb"),
        "blendVivo": entry("blender_artist/sources/original/gn_facade_system.blend"),
        "reporteGenerador": entry("blender_artist/sources/original/gn-facade-report-seed7.json"),
        "catalogo": entry("blender_artist/manifests/building-modules.json"),
        "perfilEstilo": entry("blender_artist/manifests/building-style-profiles.json"),
        "contratoWeathering": entry("blender_artist/manifests/building-weathering-contract.json"),
        "perfilCandidatos": entry("blender_artist/manifests/building-composer-candidates.json"),
        "capaEstilo": entry("tools/art-pipeline/blender/style_layer_graphic_civic.json"),
        "candidatasDIA": [
            entry(f"docs/art/graphics-capabilities/evidence/v2/candidates/wp06_{b}-candidata.{ext}")
            for b in ("mixed_tenement", "row_house", "warehouse", "town_hall")
            for ext in ("png", "json")
        ],
        "variantesDano": [
            entry(f"docs/art/graphics-capabilities/evidence/d1113/interiors/{n}.{ext}")
            for n in (
                "w06cnd_mixed_tenement_2_damaged",
                "w06cnd_mixed_tenement_2_burning",
                "w06cnd_warehouse_2_damaged",
                "w06cnd_warehouse_2_burning",
            )
            for ext in ("png", "json")
        ],
        "agedV3": [
            entry("docs/art/graphics-capabilities/evidence/d1113/weathering/w06cnd_mixed_tenement_2_aged.png"),
            entry("docs/art/graphics-capabilities/evidence/d1113/weathering/w06cnd_mixed_tenement_2_aged.json"),
        ],
        "townHallNeoclasico": [
            entry("docs/art/graphics-capabilities/evidence/d1113/townhall/w06cnd_town_hall_5.png"),
            entry("docs/art/graphics-capabilities/evidence/d1113/townhall/w06cnd_town_hall_5.json"),
        ],
        "controles": [
            entry(f"docs/art/graphics-capabilities/evidence/d1113/technical/controls_d1112/{n}")
            for n in (
                "wp06_mixed_tenement-candidata.png",
                "wp06_row_house-candidata.png",
            )
        ]
        + [
            entry(f"docs/art/graphics-capabilities/evidence/d1113/technical/controls_d1113/{n}")
            for n in (
                "w06cnd_mixed_tenement_2_damaged.png",
                "w06cnd_mixed_tenement_2_burning.png",
                "w06cnd_warehouse_2_damaged.png",
                "w06cnd_warehouse_2_burning.png",
                "aged_v3_d1113.png",
            )
        ],
    }
    commands = {
        "regenerarGLBVentana": "blender -b --factory-startup -P tools/art-pipeline/blender/gn_facade_grammar.py -- --out-dir=<tmp> --seed=7 --parts=window_bay (publicar solo window_bay; los otros 8 GLB son byte-deterministas)",
        "recrearCadenaCatalogo": [
            "node scripts/inventory-building-modules.mjs  # OJO: re-mide fuego y omite neoclásicos; trasplantar solo gn_window_bay_2m",
            "node scripts/build-building-modules.mjs",
            "node scripts/build-building-style.mjs",
            "actualizar pins de building-weathering-contract.json (moduleCatalogSha256, styleProfilesSha256)",
        ],
        "renderCandidato": "LANDLORD_ART_MOOD=<day_civic|night_civic> blender -b --factory-startup -P tools/art-pipeline/blender/build_building_composer.py -- --requests=<requests.json> --manifest=<manifest.json>  (un candidato por proceso: el lote multi-candidato puede dejar en blanco el segundo PNG)",
        "hojaFachadaFinal": "python3 scripts/d1113t-facade-final-sheet.py",
        "guardaVariantes": "python3 scripts/d1113t-damage-consistency.py",
        "capturasPhaser": "pnpm --filter @landlord/web build && node scripts/d1113-phaser-capture.mjs (entradas: sprites versionados listados arriba)",
    }
    notes = {
        "mood": "el mood NO viaja en el request: se selecciona con LANDLORD_ART_MOOD; sin esa variable el activo es night_civic y los renders salen nocturnos",
        "determinismoPixel": "firma de composición determinista; el PNG puede variar en el último dígito de sha por el pase de sombra de EEVEE (mismo contenido visual)",
        "deudaInventariado": "scripts/inventory-building-modules.mjs no conoce src_original_neoclassical_* ni re-mide fuego sin cambiar clasificaciones: la regeneración completa del inventario sigue siendo destructiva (registrado en el ledger técnico)",
    }
    OUT.write_text(
        json.dumps(
            {"schemaVersion": 1, "phase": "D-111.3-T FASE 3", "inputs": inputs, "commands": commands, "notes": notes},
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"manifiesto: {OUT}")


if __name__ == "__main__":
    main()

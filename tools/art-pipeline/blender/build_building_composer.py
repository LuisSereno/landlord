"""Entrypoint de Blender del Building Composer: varios candidatos por proceso (§12/§31).

El orquestador node (`scripts/build-building-composer.mjs`) es quien decide qué candidatos existen —
lee huellas y pisos del dominio, nunca los duplica aquí — y escribe el archivo de requests; este
script sólo los ejecuta en orden y escribe la metadata §24 de cada uno. La separación importa porque
§13 exige que el mismo request produzca la misma firma: si el listado de candidatos viviera en
Blender, cambiar de binario o de versión de Blender cambiaría también el set, y la comparación de
variantes dejaría de ser entre edificios para ser entre pipelines.

Un solo proceso para varios candidatos es deliberado: `scene.reset_scene` conserva las imágenes ya
tratadas y remapear un atlas de 2048² cuesta ~4,3 s medidos aquí. Los cuatro candidatos de una
familia comparten fuentes, así que el segundo y el tercero pagan la mitad.

Un candidato que falla no tumba la corrida: se registra con su traceback en el manifiesto y el
proceso continúa, porque el acta §38 necesita saber cuántos de los doce se caen y por qué, no sólo el
primero. El código de salida es 1 si falló alguno, así que el orquestador no puede declarar éxito a
medias.
"""

import argparse
import json
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import bpy  # noqa: E402

from building_composer.grammar import GrammarDocument  # noqa: E402
from building_composer.module_catalog import Catalog  # noqa: E402
from building_composer.scene import render_candidate  # noqa: E402
from building_composer.style_profile import StyleProfile  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", required=True, help="JSON con los candidatos que renderizar")
    parser.add_argument("--manifest", required=True, help="JSON de salida con la metadata §24")
    values, _ = parser.parse_known_args(sys.argv[sys.argv.index("--") + 1 :])
    return values


def main():
    args = parse_args()
    spec = json.loads(Path(args.requests).read_text(encoding="utf-8"))
    catalog = Catalog()
    document = GrammarDocument()
    if spec["composerVersion"] != document.composer_version:
        raise SystemExit(
            f"§13: el archivo de requests declara composerVersion {spec['composerVersion']} y el "
            f"manifiesto tiene {document.composer_version}: la firma no sería comparable"
        )
    profile = StyleProfile(spec["styleProfileId"])
    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    candidates = []
    failures = []
    for request in spec["candidates"]:
        started = time.perf_counter()
        label = request["candidateId"]
        try:
            metadata = render_candidate(request, catalog, profile, document)
        except Exception as error:  # un candidato caído se registra, la corrida continúa (§38)
            failures.append(
                {
                    "candidateId": label,
                    "errorType": type(error).__name__,
                    "error": str(error),
                    "traceback": traceback.format_exc(limit=6),
                    "elapsedMs": round((time.perf_counter() - started) * 1000, 2),
                }
            )
            print(f"FALLO {label}: {type(error).__name__}: {str(error)[:200]}")
            continue
        metadata_path = Path(request["metadata"])
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        metadata_path.write_text(
            json.dumps(metadata, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        # El manifiesto no arrastra doce composiciones completas: cada una queda en su metadata.
        candidates.append({key: value for key, value in metadata.items() if key != "composition"})
        print(
            f"OK {label}: {metadata['image']['width']}x{metadata['image']['height']} "
            f"sha={metadata['sha256'][:12]} firma={metadata['compositionSignature'][:12]} "
            f"licensed={metadata['metrics']['licensedGeometryRatio']} "
            f"{round(time.perf_counter() - started, 1)}s"
        )
    manifest = {
        "schemaVersion": 1,
        "composerVersion": spec["composerVersion"],
        "styleProfileId": spec["styleProfileId"],
        "requested": len(spec["candidates"]),
        "rendered": len(candidates),
        "signatures": sorted(item["compositionSignature"] for item in candidates),
        "peakRssMb": max((item["render"]["peakRssMb"] for item in candidates), default=0.0),
        "toolchain": {
            "blender": bpy.app.version_string,
            "renderer": "BLENDER_EEVEE",
        },
        "candidates": candidates,
        "failures": failures,
    }
    manifest_path.write_text(
        json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"manifiesto: {manifest_path} ({len(candidates)}/{len(spec['candidates'])} candidatos)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

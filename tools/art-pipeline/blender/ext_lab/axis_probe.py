"""WP01 — qué ejes sortea cada semilla, sin arrancar Blender.

ElComposer decide la variante en Python puro (`draw_choices`) y sólo necesita Blender para
hacerla visible. Elegir un seed que ejercite un módulo concreto —el zócalo de sillar, el
escaparate— era hasta ahora cuestión de renderizar y mirar: 100 s por intento.

Esta sonda responde en milisegundos y es la que fija los seeds de las hojas A/B: un control y
su candidata deben coincider eje a eje salvo en lo declarado, así que el seed se escoge por lo
que sortea, no por lo que gusta.

    python3 tools/art-pipeline/blender/ext_lab/axis_probe.py --types=row_house \\
      --seeds=1-40 --filter=bay_sequence=brick_bands

Huella y plantas se leen del catálogo de dominio (`building-catalog.json`), nunca se inventan.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
GRAMMARS = REPO / "blender_artist/manifests/building-composer-grammars.json"
PROFILES = REPO / "blender_artist/manifests/building-style-profiles.json"
# §17: la huella y las plantas las manda el dominio. `building-catalog.json` guarda la huella del
# asset (a veces girada 90° respecto al solar), así que se lee del mismo fichero que lee el juego,
# igual que hace `scripts/validate-building-composer.mjs:domainGeometry`.
GAME_DATA = REPO / "packages/simulation/src/game-data.ts"

# El compositor se importa desde Python de sistema (no necesita `bpy` para sortear ejes).
PROBE = r"""
import json, sys
sys.path.insert(0, "tools/art-pipeline/blender")
from building_composer.compose import compose_candidate
from building_composer.module_catalog import Catalog
from building_composer.grammar import GrammarDocument
from building_composer.style_profile import StyleProfile
catalog, document = Catalog(), GrammarDocument()
requests = json.loads(sys.argv[1])
profile_id = sys.argv[2]
out = []
for request in requests:
    profile = StyleProfile(profile_id)
    try:
        composed = compose_candidate(dict(request), catalog, profile, document)
        out.append({"seed": request["variantSeed"], "buildingType": request["buildingType"],
                    "axes": composed["axisChoices"], "signature": composed["compositionSignature"],
                    "gnModules": sorted({p["moduleId"] for p in composed["placements"]
                                         if p["moduleId"].startswith("mod_gn_")})})
    except Exception as error:
        out.append({"seed": request["variantSeed"], "buildingType": request["buildingType"],
                    "error": f"{type(error).__name__}: {error}"})
print(json.dumps(out))
"""


def parse_seeds(text: str) -> list[int]:
    seeds: list[int] = []
    for token in text.split(","):
        if "-" in token:
            start, end = token.split("-", 1)
            seeds.extend(range(int(start), int(end) + 1))
        else:
            seeds.append(int(token))
    return seeds


def domain_geometry(text: str, building_type: str):
    """`preferredFootprint`/`defaultFloors` del bloque de dominio de ese tipo de edificio."""
    domain_type = "headquarters" if building_type.startswith("headquarters_") else building_type
    start = text.find(f"  {domain_type}: {{")
    if start < 0:
        return None
    block = text[start:]
    footprint = re.search(r"preferredFootprint: \{ width: (\d+), height: (\d+) \}", block)
    floors = re.search(r"defaultFloors: (\d+)", block)
    if not footprint or not floors:
        return None
    return {"footprint": {"width": int(footprint[1]), "height": int(footprint[2])},
            "floors": int(floors[1])}


def build_requests(types: list[str], seeds: list[int], profile_id: str) -> list[dict]:
    grammars = json.loads(GRAMMARS.read_text(encoding="utf-8"))["grammars"]
    domain = GAME_DATA.read_text(encoding="utf-8")
    requests = []
    for building_type in types:
        geometry = domain_geometry(domain, building_type)
        if geometry is None:
            raise SystemExit(f"el dominio no declara huella/plantas para {building_type}")
        for seed in seeds:
            requests.append(
                {
                    "candidateId": f"probe_{building_type}_{seed}",
                    "buildingType": building_type,
                    "family": grammars[building_type]["family"],
                    "styleProfileId": profile_id,
                    "variantSeed": seed,
                    "composerVersion": "vf-3",
                    **geometry,
                    "output": "/tmp/probe.png",
                }
            )
    return requests


def main() -> None:
    options = {
        token.split("=", 1)[0][2:]: token.split("=", 1)[1]
        for token in sys.argv[1:]
        if token.startswith("--") and "=" in token
    }
    types = options.get("types", "row_house").split(",")
    seeds = parse_seeds(options.get("seeds", "1-12"))
    profile_id = options.get("profile") or json.loads(PROFILES.read_text(encoding="utf-8"))["profiles"][0]["id"]
    filters = []
    for clause in options.get("filter", "").split(","):
        if "=" in clause:
            key, value = clause.split("=", 1)
            filters.append((key.strip(), value.strip()))

    run = subprocess.run(
        ["python3", "-c", PROBE, json.dumps(build_requests(types, seeds, profile_id)), profile_id],
        cwd=REPO,
        encoding="utf8",
        capture_output=True,
        check=False,
    )
    if run.returncode != 0:
        sys.exit(run.stderr[-800:])
    rows = json.loads(run.stdout)
    for row in rows:
        if "error" in row:
            print(f"{row['buildingType']} seed {row['seed']}: {row['error']}")
            continue
        axes = row["axes"]
        wanted = []
        for key, value in filters:
            if key == "gn":
                wanted.append(any(value in m for m in row.get("gnModules", [])))
            else:
                wanted.append(str(axes.get(key, "")).startswith(value))
        if not all(wanted):
            continue
        print(
            f"{row['buildingType']} seed {row['seed']}: "
            + " ".join(f"{key}={value}" for key, value in sorted(axes.items()) if value)
            + (" · GN: " + ",".join(m.replace("mod_gn_", "").replace("_2m", "") for m in row["gnModules"])
               if row.get("gnModules") else "")
        )
    print(json.dumps({"profile": profile_id, "probe": {"types": types, "seeds": seeds, "filter": filters}}))


if __name__ == "__main__":
    main()

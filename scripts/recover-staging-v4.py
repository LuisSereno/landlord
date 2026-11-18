#!/usr/bin/env python3
"""Recupera las corridas diurnas abortadas por §26 (D-109, 2026-11-18).

Las tres primeras corridas diurnas (town_hall, clinic, fire_station) renderizaron y validaron sus
24 candidatos, pero la promoción atómica R1 se abortó porque la publicación deliberada de los tres
props originales cambió runtime-assets-blender.json durante la corrida. Este script promueve esos
staging ya validados: comprueba manifiesto (24 candidatos, 0 fallos), moodId, sha256 contra disco y
medidas PNG, y copia los artefactos al directorio del lote con el mismo formato del orquestador.
No rehornea nada ni toca el bundle.
"""
import hashlib
import json
import os
import shutil
import struct
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(REPO)
BATCH = "docs/art/quality-vj/batch-facilities-v4"
RUNS = [
    ("lane1", "town_hall", "2026-11-18T1821"),
    ("lane2", "clinic", "2026-11-18T1820"),
    ("lane3", "fire_station", "2026-11-18T1820"),
]


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


for lane, building_type, run_id in RUNS:
    staging = f"{BATCH}/{lane}/day/attempts/{run_id}"
    target = f"{BATCH}/{lane}/day/{building_type}"
    manifest = json.load(open(f"{staging}/manifest.json"))
    candidates = manifest["candidates"]
    assert manifest["failures"] == [], (lane, building_type, manifest["failures"])
    assert len(candidates) == 24, (lane, building_type, len(candidates))
    for cand in candidates:
        assert cand["buildingType"] == building_type
        assert cand["moodId"] == "day_civic", (cand["candidateId"], cand["moodId"])
        png = f"{staging}/{cand['candidateId']}.png"
        meta = f"{staging}/{cand['candidateId']}.json"
        assert os.path.exists(png) and os.path.exists(meta), cand["candidateId"]
        digest = hashlib.sha256(open(png, "rb").read()).hexdigest()
        assert digest == cand["sha256"], (cand["candidateId"], "sha mismatch")
        width, height = png_size(png)
        assert (width, height) == (cand["image"]["width"], cand["image"]["height"])
        disk_meta = json.load(open(meta))
        assert disk_meta["candidateId"] == cand["candidateId"]
    os.makedirs(target, exist_ok=True)
    for existing in os.listdir(target):
        os.remove(f"{target}/{existing}")
    for cand in candidates:
        shutil.copyfile(f"{staging}/{cand['candidateId']}.png", f"{target}/{cand['candidateId']}.png")
        shutil.copyfile(f"{staging}/{cand['candidateId']}.json", f"{target}/{cand['candidateId']}.json")
    manifest["outDir"] = target
    with open(f"{target}/manifest.json", "w") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"recovered {lane}/day/{building_type}: 24 candidates")
print("recovery done")
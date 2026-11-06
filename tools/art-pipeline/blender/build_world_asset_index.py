"""V.h.1/V.h.2: auditoría total de fuentes + World Asset Knowledge Base.

Recorre TODO `blender_artist/staging/third_party` (no sólo lo que ya mide el catálogo de edificios),
clasifica cada recurso geométrico/textura/animación en el vocabulario del índice global y emite:

  - `blender_artist/manifests/world-asset-index.json`  (manifiesto canónico, fuente de verdad)
  - `docs/asset-library/world-asset-audit.md`          (tabla Source|discovered|indexed|classified|runtime-ready|excluded|reason)

La clasificación es automática (source + pack + filename + dimensiones medidas cuando existen) con
overrides curados para los casos importantes. Reutiliza `building-module-inventory.json` para las
dimensiones/triángulos ya medidos en Blender; lo que no está medido queda `indexed`/`classified` con
`runtimeReady=false` (no se inventan medidas: §7 provenance fail-closed).

Los recursos `quarantined` cuyos archivos NO están en disco no se registran como activos: se listan
en la auditoría como "autorizados pero no adquiridos" y permanecen en cuarentena (no hay path/hash
que registrar sin fabricar trazabilidad).
"""

import hashlib
import json
import os
import re
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
STAGING = REPO_ROOT / "blender_artist" / "staging" / "third_party"
INVENTORY = REPO_ROOT / "blender_artist" / "manifests" / "building-module-inventory.json"
CATALOG = REPO_ROOT / "blender_artist" / "manifests" / "building-modules.json"
SOURCES = REPO_ROOT / "blender_artist" / "manifests" / "staging-sources.json"
JOBS = REPO_ROOT / "blender_artist" / "manifests" / "asset-jobs.json"
OUT_INDEX = REPO_ROOT / "blender_artist" / "manifests" / "world-asset-index.json"
OUT_AUDIT = REPO_ROOT / "docs" / "asset-library" / "world-asset-audit.md"

GEOM_EXTS = {".glb", ".gltf", ".fbx", ".blend", ".obj"}
TEX_EXTS = {".png", ".jpg", ".jpeg"}
ANIM_EXTS = {".fbx", ".glb"}  # se refina por pack

# sourceId por prefijo de ruta bajo third_party/
def source_id_for(relpath):
    p = relpath.replace("\\", "/")
    if p.startswith("mit/rocketbox"):
        return "src_microsoft_rocketbox"
    if p.startswith("cc0/extracted/polyhaven"):
        return "src_polyhaven_materials"
    if p.startswith("cc0/extracted/quaternius/downtown-city-megakit"):
        return "src_quaternius_downtown_city_megakit"
    if p.startswith("cc0/extracted/quaternius/base-characters"):
        return "src_quaternius_base_characters"
    if p.startswith("cc0/extracted/quaternius/animation-library-2"):
        return "src_quaternius_animation_library_2"
    if p.startswith("cc0/extracted/quaternius/animation-library"):
        return "src_quaternius_animation_library"
    if p.startswith("cc0/extracted/kaykit"):
        return "src_kaykit_city_builder_bits"
    if p.startswith("cc0/extracted/kenney/car-kit"):
        return "src_kenney_car_kit"
    if p.startswith("cc0/extracted/kenney/city-kit-commercial"):
        return "src_kenney_city_commercial"
    if p.startswith("cc0/extracted/kenney/city-kit-industrial"):
        return "src_kenney_city_industrial"
    if p.startswith("cc0/extracted/kenney/city-kit-roads"):
        return "src_kenney_city_roads"
    if p.startswith("cc0/extracted/kenney/city-kit-suburban"):
        return "src_kenney_city_suburban"
    if p.startswith("cc0/extracted/kenney/nature-kit"):
        return "src_kenney_nature_kit"
    return None


LICENSE_BY_SOURCE = {
    "src_microsoft_rocketbox": "MIT",
    "src_original_civic_pediment": "original",
}
DEFAULT_LICENSE = "CC0-1.0"


def classify(relpath, filename):
    """Devuelve (category, semanticRoles, contexts) por heurística de pack + filename."""
    p = relpath.replace("\\", "/").lower()
    n = filename.lower()

    if p.startswith("cc0/extracted/polyhaven"):
        return "material", ["surface_material"], ["any"]
    if p.startswith("mit/rocketbox/animations") or p.startswith("cc0/extracted/quaternius/animation-library"):
        return "animation", ["animation_clip"], ["actor"]
    if p.startswith("mit/rocketbox/avatars") or p.startswith("cc0/extracted/quaternius/base-characters"):
        return "actor", ["humanoid"], ["street", "plaza", "interior"]
    if p.startswith("cc0/extracted/kenney/car-kit"):
        return _vehicle_class(n)
    if p.startswith("cc0/extracted/kenney/nature-kit"):
        return _nature_class(n)
    if p.startswith("cc0/extracted/kenney/city-kit-roads"):
        return _roads_class(n)
    if p.startswith("cc0/extracted/kenney/city-kit-industrial"):
        return "building_mass", ["industrial", "warehouse"], ["industrial_logistics"]
    if p.startswith("cc0/extracted/kenney/city-kit-commercial"):
        return "building_mass", ["commercial", "shop"], ["commercial_corridor", "mixed_core"]
    if p.startswith("cc0/extracted/kenney/city-kit-suburban"):
        return "building_mass", ["residential", "suburban"], ["urban_residential", "low_density_residential"]
    if p.startswith("cc0/extracted/kaykit"):
        return _kaykit_class(n)
    if p.startswith("cc0/extracted/quaternius/downtown-city-megakit"):
        return _megakit_class(n)
    return "environment", ["generic"], ["any"]


VEHICLE_PART_KEYWORDS = (
    "debris", "wheel", "kart", "cone", "box", "plate", "bolt", "bumper", "spoiler", "axle",
    "nut", "door", "engine", "tire", "exhaust", "mirror", "seat", "steering", "dashboard",
    "drivetrain", "hood", "trunk", "antenna",
)


def is_vehicle_part(n):
    """Ruedas, escombros, karts y conos del Car Kit no son vehículos colocables (§8)."""
    return any(k in n for k in VEHICLE_PART_KEYWORDS)


def vehicle_class_of(n):
    """vehicleClass del contrato §4 para vehículos reales; None para piezas/no-colocables."""
    if is_vehicle_part(n):
        return None
    if any(k in n for k in ("ambulance", "medical")):
        return "ambulance"
    if any(k in n for k in ("fire", "ladder")):
        return "fire"
    if any(k in n for k in ("police",)):
        return "police"
    if any(k in n for k in ("garbage", "trash", "waste")):
        return "garbage"
    if any(k in n for k in ("taxi",)):
        return "taxi"
    if any(k in n for k in ("delivery", "van")):
        return "delivery"
    if any(k in n for k in ("truck", "freight", "cargo")):
        return "freight"
    if any(k in n for k in ("tractor", "excavator", "crane", "construction", "forklift")):
        return "construction"
    return "civilian"


def _vehicle_class(n):
    roles = ["vehicle"]
    contexts = ["road", "parking"]
    if is_vehicle_part(n):
        roles = ["vehicle_part"]
        contexts = ["none"]
    elif any(k in n for k in ["ambulance", "medical"]):
        roles = ["vehicle", "emergency_vehicle", "ambulance"]
        contexts = ["clinic", "road", "service_parking"]
    elif any(k in n for k in ["fire", "ladder"]):
        roles = ["vehicle", "emergency_vehicle", "fire_truck"]
        contexts = ["fire_station", "road"]
    elif any(k in n for k in ["police"]):
        roles = ["vehicle", "police_car"]
        contexts = ["police_station", "road"]
    elif any(k in n for k in ["truck", "freight", "cargo", "delivery", "van"]):
        roles = ["vehicle", "freight", "delivery"]
        contexts = ["industrial_logistics", "commercial_corridor", "road"]
    elif any(k in n for k in ["garbage", "trash", "waste"]):
        roles = ["vehicle", "garbage"]
        contexts = ["road", "service"]
    elif any(k in n for k in ["taxi"]):
        roles = ["vehicle", "taxi"]
        contexts = ["commercial_corridor", "road"]
    elif any(k in n for k in ["tractor", "excavator", "crane", "construction", "forklift"]):
        roles = ["vehicle", "construction", "industrial"]
        contexts = ["construction_site", "industrial_logistics"]
    else:
        roles = ["vehicle", "civilian"]
        contexts = ["residential", "commercial_corridor", "road"]
    return "vehicle", roles, contexts


# V.h.7: taxonomía de clases de actor (§16). En v1 sólo `civilian` tiene fuente horneada
# (vecino_variante) y avatares vestidos Rocketbox; las clases profesionales se declaran aquí y se
# poblarán con overrides curados / bakes futuros cuando exista fuente que las codifique.
ACTOR_CLASSES = (
    "civilian", "worker", "maintenance", "enforcer", "service_worker",
    "police", "medical", "firefighter",
)

ACTOR_PART_KEYWORDS = (
    "hair", "eyebrow", "beard", "body", "base", "head", "eye", "mouth", "nose", "ear",
    "hand", "foot", "shoe", "shirt", "pants", "hat", "cap", "glass", "accessory", "mesh",
)


def is_actor_part(n):
    """Piezas de customización (pelo/cejas/cuerpo base) no son actores colocables (§8)."""
    return any(k in n for k in ACTOR_PART_KEYWORDS)


def actor_class_of(n, source_id):
    """actorClass del contrato §16; None para piezas de customización no colocables."""
    if source_id == "src_quaternius_base_characters" or is_actor_part(n):
        return None
    # Override curado: los avatares Rocketbox concretos horneados como profesionales (V.h.11).
    # El filename de Rocketbox es demográfico, no de profesión; la clase se asigna por avatar.
    override = ROCKETBOX_ACTOR_CLASS.get(n.lower().split(".")[0])
    if override:
        return override
    return "civilian"


# Avatar Rocketbox (filename del .fbx sin extensión) → actorClass colocada en el runtime.
ROCKETBOX_ACTOR_CLASS = {
    "male_adult_02": "police",
    "female_adult_09": "medical",
    "male_adult_09": "firefighter",
    "male_adult_12": "worker",
}


def animation_clip_of(n):
    """Familia de clip de animación (idle/walk/run/…) por filename; v1 coarse."""
    for family in ("idle", "walk", "run", "sit", "stand", "point", "wave", "talk", "cheer", "crouch", "jump", "dance", "carry", "push", "pull", "climb", "death", "injured"):
        if family in n:
            return family
    return "other"


def _nature_class(n):
    if any(k in n for k in ["tree", "pine", "oak", "palm", "cone", "plateau"]):
        return "environment", ["tree", "vegetation"], ["park", "street", "residential"]
    if any(k in n for k in ["bush", "plant", "shrub", "hedge", "grass", "flower", "fern", "reed"]):
        return "environment", ["foliage", "vegetation"], ["park", "garden", "plaza"]
    if any(k in n for k in ["rock", "stone", "boulder", "cliff", "cactus", "log", "stump", "mushroom"]):
        return "environment", ["rock", "natural_prop"], ["park", "green_open_space"]
    if any(k in n for k in ["statue", "obelisk", "monument", "fountain"]):
        return "urban_prop", ["monument", "civic_landmark"], ["plaza", "civic_courtyard", "park"]
    if any(k in n for k in ["bench", "chair", "seat"]):
        return "urban_prop", ["bench", "seating"], ["plaza", "park", "street"]
    if any(k in n for k in ["pot", "planter", "urn"]):
        return "urban_prop", ["planter"], ["plaza", "park", "street"]
    if any(k in n for k in ["lamp", "light", "lantern", "streetlight"]):
        return "urban_prop", ["street_lamp", "lighting"], ["street", "plaza", "park"]
    if any(k in n for k in ["fence", "wall", "gate", "railing"]):
        return "infrastructure", ["fence", "boundary"], ["residential", "industrial_logistics"]
    if any(k in n for k in ["sign", "billboard"]):
        return "urban_prop", ["signage"], ["street", "commercial_corridor"]
    return "environment", ["natural_prop"], ["park", "green_open_space"]


def _roads_class(n):
    if any(k in n for k in ["light", "lamp", "streetlight"]):
        return "urban_prop", ["street_lamp", "lighting"], ["street", "plaza"]
    if any(k in n for k in ["sign", "signal", "traffic"]):
        return "infrastructure", ["signage", "traffic_control"], ["road", "intersection"]
    if any(k in n for k in ["bridge", "pillar"]):
        return "infrastructure", ["bridge"], ["road", "water"]
    if any(k in n for k in ["tile", "road", "pavement", "asphalt", "sidewalk", "crossing"]):
        return "infrastructure", ["road_surface"], ["road"]
    if any(k in n for k in ["barrier", "cone", "fence"]):
        return "infrastructure", ["barrier"], ["construction_site", "road"]
    return "infrastructure", ["road_element"], ["road"]


def _kaykit_class(n):
    if any(k in n for k in ["bench", "chair"]):
        return "urban_prop", ["bench", "seating"], ["plaza", "park", "street"]
    if any(k in n for k in ["streetlight", "lamp", "light"]):
        return "urban_prop", ["street_lamp", "lighting"], ["street", "plaza"]
    if any(k in n for k in ["firehydrant", "hydrant"]):
        return "urban_prop", ["hydrant"], ["street", "fire_station"]
    if any(k in n for k in ["tree", "plant", "bush"]):
        return "environment", ["vegetation"], ["park", "street"]
    if any(k in n for k in ["building", "shop", "house", "block"]):
        return "building_mass", ["commercial", "modular"], ["commercial_corridor", "mixed_core"]
    return "urban_prop", ["street_furniture"], ["street", "plaza"]


def _megakit_class(n):
    if any(k in n for k in ["roof", "slate", "dormer", "chimney"]):
        return "architecture", ["roof"], ["building"]
    if any(k in n for k in ["door", "doorframe", "entrance"]):
        return "architecture", ["door", "access"], ["building"]
    if any(k in n for k in ["window"]):
        return "architecture", ["window_bay"], ["building"]
    if any(k in n for k in ["wall", "brick", "trim", "column", "cornice", "frieze"]):
        return "architecture", ["facade"], ["building"]
    return "architecture", ["facade_element"], ["building"]


# Overrides curados para casos importantes (el nombre solo no basta).
CURATED_OVERRIDES = {
    "statue_obelisk.glb": ("urban_prop", ["monument", "civic_landmark"], ["plaza", "civic_courtyard", "park"],
                           {"placement": ["open_space", "center_preferred"]}),
    "statue_column.glb": ("urban_prop", ["monument", "civic_landmark"], ["plaza", "park"],
                          {"placement": ["open_space"]}),
}


def load_measured():
    """path → {dims, triangles} desde el inventario ya medido en Blender."""
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    measured = {}
    for entry in inv["sources"]:
        norm = entry.get("normalized", {})
        size = norm.get("sizeMeters", {})
        measured[entry["path"]] = {
            "dimensions": {
                "width": size.get("width"),
                "depth": size.get("depth"),
                "height": size.get("height"),
            },
            "triangleCount": entry.get("triangles"),
            "classification": entry.get("classification"),
        }
    return measured


def load_catalog_roles():
    """sourcePath → role del catálogo de módulos (los ya runtime-ready)."""
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    roles = {}
    for mod in cat["modules"]:
        roles[mod["sourcePath"]] = mod.get("role")
    return roles


def load_job_runtime():
    """sourcePath → runtimeAssetId de los jobs horneados en el atlas (vehículos/props/terrain).

    Un asset con job `target: bundle` tiene pipeline y runtime ID reales (§5 runtime_ready), aunque
    no pertenezca al catálogo de módulos de edificios. Sin esto el índice subdeclaraba runtime-ready.
    """
    jobs = json.loads(JOBS.read_text(encoding="utf-8"))
    runtime = {}
    for job in jobs.get("jobs", []):
        if job.get("target") != "bundle":
            continue
        src = job.get("source") or {}
        path = src.get("path")
        if path:
            runtime[path] = job.get("assetId")
    return runtime


def main():
    measured = load_measured()
    catalog_roles = load_catalog_roles()
    job_runtime = load_job_runtime()
    sources_doc = json.loads(SOURCES.read_text(encoding="utf-8"))
    quarantined = sources_doc.get("quarantined", [])

    assets = []
    stats = defaultdict(lambda: {"discovered": 0, "indexed": 0, "classified": 0, "runtime_ready": 0, "excluded": 0})
    seen_ids = set()

    for dirpath, _dirnames, filenames in os.walk(STAGING):
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, REPO_ROOT).replace("\\", "/")
            staging_rel = os.path.relpath(full, STAGING).replace("\\", "/")
            source_id = source_id_for(staging_rel)
            if source_id is None:
                continue
            stats[source_id]["discovered"] += 1

            is_geom = ext in GEOM_EXTS
            is_tex = ext in TEX_EXTS
            if not (is_geom or is_tex):
                stats[source_id]["excluded"] += 1
                continue  # docs, licencias, metadata: no son assets visuales

            stats[source_id]["indexed"] += 1
            license_ = LICENSE_BY_SOURCE.get(source_id, DEFAULT_LICENSE)

            if is_tex:
                category, roles, contexts = "material", ["texture"], ["any"]
                dims = None
                tris = None
                runtime_ready = False
                vclass = None
                aclass = None
                clip = None
                placeable = None
            else:
                override = CURATED_OVERRIDES.get(fn)
                if override:
                    category, roles, contexts, extra = override
                else:
                    category, roles, contexts = classify(staging_rel, fn)
                    extra = {}
                m = measured.get(rel)
                dims = m["dimensions"] if m else None
                tris = m["triangleCount"] if m else None
                # runtime_ready: promovido al catálogo de edificios O horneado en el atlas vía job.
                runtime_ready = rel in catalog_roles or rel in job_runtime
                vclass = vehicle_class_of(fn) if category == "vehicle" else None
                aclass = actor_class_of(fn, source_id) if category == "actor" else None
                clip = animation_clip_of(fn) if category == "animation" else None
                if category == "vehicle":
                    placeable = vclass is not None
                elif category == "actor":
                    placeable = aclass is not None
                else:
                    placeable = None

            asset_id = f"wa_{source_id.replace('src_', '')}_{re.sub(r'[^a-z0-9]+', '_', os.path.splitext(fn)[0].lower()).strip('_')}"
            base_id = asset_id
            counter = 1
            while asset_id in seen_ids:
                asset_id = f"{base_id}_{counter}"
                counter += 1
            seen_ids.add(asset_id)

            assets.append({
                "assetId": asset_id,
                "sourceId": source_id,
                "sourcePath": rel,
                "license": license_,
                "category": category,
                "semanticRoles": roles,
                "contexts": contexts,
                "dimensions": dims,
                "triangleCount": tris,
                "modularity": "modular" if category == "architecture" else "whole_asset",
                "styleCompatibility": ["graphic_civic"],
                "recommendedUses": contexts,
                "runtimeLayer": "blender_sprite" if runtime_ready else "none",
                "qualityTier": "measured" if dims else "unmeasured",
                "orientationSupport": [0, 90, 180, 270] if category in ("urban_prop", "vehicle", "environment") else [0],
                "animationSupport": category in ("actor", "animation"),
                "runtimeReady": runtime_ready,
                "state": "runtime_ready" if runtime_ready else "classified",
                **({"vehicleClass": vclass} if vclass else {}),
                **({"actorClass": aclass} if aclass else {}),
                **({"animationClip": clip} if clip else {}),
                **({"placeable": placeable} if placeable is not None else {}),
                **({"runtimeAssetId": job_runtime[rel]} if rel in job_runtime else {}),
                **({"catalogRole": catalog_roles[rel]} if rel in catalog_roles else {}),
                **(extra if is_geom and CURATED_OVERRIDES.get(fn) else {}),
            })
            stats[source_id]["classified"] += 1
            if runtime_ready:
                stats[source_id]["runtime_ready"] += 1

    # Recursos quarantined sin archivo en disco: autorizados pero no adquiridos.
    excluded_quarantine = []
    for name in quarantined:
        excluded_quarantine.append({
            "name": name,
            "reason": "autorizado CC0 por el responsable pero el archivo no está en staging; sin path/hash no hay registro válido (provenance fail-closed). Permanece en cuarentena hasta adquirirse.",
        })

    index = {
        "schemaVersion": 1,
        "purpose": "V.h World Asset Knowledge Base: índice canónico de TODOS los recursos visuales del proyecto. Los subcatálogos (architecture/urban-prop/vehicle/actor/...) son vistas generadas de este índice; no duplican verdad.",
        "states": {
            "indexed": "existe, con procedencia, licencia y metadata técnica",
            "classified": "sabemos qué representa y dónde puede usarse",
            "runtime_ready": "hay pipeline/manifiesto/runtime ID que permite usarlo de verdad",
        },
        "categories": [
            "architecture", "building_mass", "urban_prop", "environment", "infrastructure",
            "vehicle", "actor", "animation", "material", "ui", "audio",
        ],
        # Taxonomías semánticas (§15 vehículos, §16 actores). Una clase puede quedar declarada sin
        # miembros runtime-ready en v1 (p.ej. police/medical): se poblará con bakes/overrides futuros.
        "vehicleClasses": [
            "civilian", "taxi", "delivery", "freight", "garbage", "police", "fire",
            "ambulance", "construction", "industrial", "service",
        ],
        "actorClasses": list(ACTOR_CLASSES),
        "counts": {
            "assets": len(assets),
            "runtimeReady": sum(1 for a in assets if a["runtimeReady"]),
            "classified": sum(1 for a in assets if a["state"] in ("classified", "runtime_ready")),
            "quarantinedUnacquired": len(excluded_quarantine),
        },
        "assets": assets,
        "quarantinedUnacquired": excluded_quarantine,
    }
    OUT_INDEX.parent.mkdir(parents=True, exist_ok=True)
    OUT_INDEX.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")

    # Auditoría.
    lines = [
        "# World Asset Audit (V.h.1)",
        "",
        "Auditoría total del staging disponible. `discovered` = archivos bajo la fuente; `indexed` =",
        "recursos visuales con procedencia+licencia; `classified` = con categoría/roles semánticos;",
        "`runtime-ready` = ya promovidos a un pipeline runtime (catálogo de módulos). Los zips",
        "`quarantined` cuyos archivos no están en disco no se registran como activos: sin path/hash no",
        "hay trazabilidad válida, así que permanecen en cuarentena como *autorizados pero no adquiridos*.",
        "",
        "| Source | Files discovered | Indexed | Classified | Runtime-ready | Excluded | Reason |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for source_id in sorted(stats):
        s = stats[source_id]
        reason = "" if s["discovered"] else "sin archivos"
        lines.append(
            f"| {source_id} | {s['discovered']} | {s['indexed']} | {s['classified']} | "
            f"{s['runtime_ready']} | {s['excluded']} | {reason} |"
        )
    lines += [
        "",
        "## Quarantined autorizados pero no adquiridos",
        "",
    ]
    for q in excluded_quarantine:
        lines.append(f"- `{q['name']}` — {q['reason']}")
    lines += [
        "",
        f"**Totales:** {len(assets)} assets indexados · "
        f"{sum(1 for a in assets if a['runtimeReady'])} runtime-ready · "
        f"{len(excluded_quarantine)} quarantined sin adquirir.",
        "",
    ]
    OUT_AUDIT.parent.mkdir(parents=True, exist_ok=True)
    OUT_AUDIT.write_text("\n".join(lines), encoding="utf-8")

    print(f"[world-index] assets={len(assets)} runtime_ready={sum(1 for a in assets if a['runtimeReady'])}")
    print(f"[world-index] {OUT_INDEX}")
    print(f"[world-audit] {OUT_AUDIT}")


if __name__ == "__main__":
    main()

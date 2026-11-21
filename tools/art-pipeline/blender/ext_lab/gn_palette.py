"""Paleta plana de los módulos GN derivada del control, no elegida a ojo (D-111.2 WP01).

El problema que resuelve (limitaciones 1 y 2 de `evaluations/geometry-nodes.md`): un módulo
generado en Geometry Nodes trae materiales de **color plano**, mientras el control del Composer
pinta su fachada con los atlas licenciados de Quaternius. Si el color plano se escribe a mano,
cae en otra banda de `externalTreatment` y el A/B compara dos tratamientos, no dos arquitecturas.
Medido en D-111.1: el ladrillo GN salía más saturado y la cornisa casi blanca.

La regla que sale de aquí es reutilizable para cualquier módulo propio del repo:

1. **Autoría idéntica al control.** El color plano se fija al color *dominante medido en el atlas
   licenciado* que el control usa para esa superficie. Con el color de origen coincidente, la
   banda que reclama el píxel es la misma, así que recibe las mismas escalas **en todos los
   moods**: la coincidencia no es un ajuste por captura, es estructural.
2. **Nombres que no secuestran una regla ajena.** `apply_external_treatment` trata los materiales
   planos por *nombre* (`flatMaterials`) antes que nadie, y esa rama no pasa por `global` ni por
   las bandas. Un material llamado `gn_shopfront_wood` caía en la regla de la madera de
   nature-kit (valueScale 0,42 sin el 1,7 del día) y salía mucho más oscuro que el resto de la
   fachada. Este script detecta el secuestro y lo informa.
3. **Vidrio: inversión numérica.** En el control `MI_Glass` no tiene albedo de textura (su
   `Base Color` es un MIX), así que `complete_style_reach` lo declara `no_albedo` y **no lo
   toca**. Un plano sí se trata, así que no existe color de autor que coincida en todos los
   moods: se resuelve el que coincide en el mood de trabajo y se informa el residuo del resto.

Uso:
  python3 tools/art-pipeline/blender/ext_lab/gn_palette.py --mood=day_civic \
      --json=/tmp/gn/palette.json [--authored=gn_brick_wall=0.42,0.17,0.12,...]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / "tools/art-pipeline/blender"))

from render_settings import active_mood, active_mood_id  # noqa: E402
from style_layer_math import (  # noqa: E402
    hsv_to_rgb,
    linear_to_srgb,
    name_matches,
    rgb_to_hsv,
    srgb_to_linear,
    style_pixels,
)

TEXTURES = REPO / "blender_artist/staging/third_party/cc0/extracted/quaternius/downtown-city-megakit/Textures"
STYLE_LAYER = REPO / "tools/art-pipeline/blender/style_layer_graphic_civic.json"
GLTF_DIR = REPO / "blender_artist/staging/third_party/cc0/extracted/quaternius/downtown-city-megakit/Exports/glTF (Godot)"

# material GN -> de dónde sale su color. `atlas` = cluster dominante de la textura licenciada que
# usa el módulo de control de ese rol; `factor` = `baseColorFactor` del glTF (superficie que el
# tratamiento canónico deja intacta); `solver` = hay que invertir la escalera para casarla.
SURFACES = [
    {
        "gn": "gn_brick_wall",
        "role": "paño de fábrica",
        "atlas": "T_RedBrick_BaseColor.png",
        "hue": (5, 40),
        "value": (0.25, 0.75),
    },
    {
        "gn": "gn_stone_trim",
        "role": "encofrado, dintel, alfiz y cornisa",
        "atlas": "T_Trim_BaseColor.png",
        "hue": (40, 80),
        "value": (0.45, 0.85),
    },
    {
        "gn": "gn_joinery_dark",
        "role": "carpintería y frentes de tienda",
        "atlas": "T_Trim_BaseColor.png",
        "hue": (10, 40),
        "value": (0.15, 0.45),
    },
    {
        "gn": "gn_painted_metal",
        "role": "barandillas y chapa",
        "atlas": "T_MetalConcrete_BaseColor.png",
        "hue": (0, 360),
        "value": (0.35, 0.65),
        "maxSaturation": 0.08,
    },
    {
        "gn": "gn_dark_glass",
        "role": "acristalamiento",
        "factor": "MI_Glass",
        "solver": {"hue": (185, 250), "value": (0.06, 0.45)},
    },
]


def dominant_cluster(path: Path, hue, value, max_saturation=None, bins=12) -> dict:
    """Cluster dominante del atlas dentro de la familia de tono declarada.

    Se cuantiza antes de contar: un atlas 2048² tiene miles de valores distintos y el promedio
    aritmético mezclaría el ladrillo con la junta. El cluster es determinista porque el orden de
    desempate es el propio array de `np.unique`.
    """
    pixels = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32).reshape(-1, 3) / 255.0
    grid = np.floor(pixels * bins).astype(np.int32)
    keys, counts = np.unique(grid, axis=0, return_counts=True)
    candidates = (keys + 0.5) / bins
    hue_arr, sat_arr, val_arr = rgb_to_hsv(candidates)
    low, high = hue
    in_hue = (hue_arr >= low) & (hue_arr <= high) if low <= high else (hue_arr >= low) | (hue_arr <= high)
    keep = in_hue & (val_arr >= value[0]) & (val_arr <= value[1])
    if max_saturation is not None:
        keep &= sat_arr <= max_saturation
    if not keep.any():
        raise SystemExit(f"{path.name}: ningún cluster en hue={hue} value={value}")
    share = np.zeros(len(keys), dtype=np.int64)
    share[keep] = counts[keep]
    best = int(np.argmax(share))
    return {
        "atlas": path.name,
        "authoredSrgb": [round(float(v), 4) for v in candidates[best]],
        "authoredLinear": [round(float(v), 4) for v in srgb_to_linear(candidates[best])],
        "share": round(float(share[best] / pixels.shape[0]), 4),
        "hue": round(float(hue_arr[best]), 1),
        "saturation": round(float(sat_arr[best]), 3),
        "value": round(float(val_arr[best]), 3),
    }


def gltf_factor(material_name: str) -> dict:
    """`baseColorFactor` del glTF licenciado, que Blender importa como MIX sin albedo de textura."""
    for file in sorted(GLTF_DIR.glob("*.gltf")):
        spec = json.loads(file.read_text(encoding="utf-8"))
        for material in spec.get("materials", []):
            if material.get("name") != material_name:
                continue
            factor = material.get("pbrMetallicRoughness", {}).get("baseColorFactor")
            if not factor:
                continue
            linear = np.asarray(factor[:3], dtype=np.float32)
            return {
                "gltfMaterial": material_name,
                "authoredLinear": [round(float(v), 4) for v in linear],
                "authoredSrgb": [round(float(v), 4) for v in linear_to_srgb(linear)],
                "alpha": round(float(factor[3]), 4),
            }
    raise SystemExit(f"{material_name} no aparece con baseColorFactor en {GLTF_DIR}")


def treatment_path(name: str, treatment: dict) -> str:
    """Por cuál de las ramas de §11 pasaría este material plano."""
    if any(name_matches(name, rule["match"]) for rule in treatment.get("flatMaterials", [])):
        return "flatMaterials_por_nombre"
    return "escalera_de_bandas"


def styled(color_srgb: np.ndarray, treatment: dict, kind: str = "building") -> np.ndarray:
    return style_pixels(np.asarray(color_srgb, dtype=np.float32).reshape(1, 1, 3), treatment, kind)[
        "styled_rgb"
    ][0, 0]


def flat_rule_result(name: str, color_srgb, treatment: dict):
    """Reproduce `_apply_flat_material_treatment`: la primera regla por nombre gana y no hay global."""
    hue, sat, val = rgb_to_hsv(np.asarray(color_srgb, dtype=np.float32).reshape(1, 1, 3))
    for rule in treatment.get("flatMaterials", []):
        if not name_matches(name, rule["match"]):
            continue
        if "hueTo" in rule:
            hue = np.full_like(hue, float(rule["hueTo"]))
        sat = np.clip(sat * rule.get("saturationScale", 1.0), 0, 1)
        val = np.clip(val * rule.get("valueScale", 1.0), 0, 1)
        return hsv_to_rgb(hue, sat, val)[0, 0], rule["match"]
    return None, None


def solve_authored(target_srgb, treatments: dict, window: dict, kind: str = "building") -> dict:
    """Color de autor cuyo resultado tratado coincide con `target_srgb` en el mood de trabajo.

    Se minimiza sólo el primer mood y se *informa* el residuo del resto. No se puede pedir lo
    contrario: el objetivo del control es una constante que escapa al tratamiento, así que no
    existe un único color de autor que lo iguale de día y de noche a la vez, y optimizar la suma
    devuelve un vidrio casi negro que además viola §5.3 (noche legible).

    La búsqueda se acota a la familia de tono del vidrio para no proponer un albedo absurdo que
    coincida por casualidad desde otra banda.
    """
    target = np.asarray(target_srgb, dtype=np.float32)
    mood_names = list(treatments)
    working = mood_names[0]
    best = (np.inf, np.array([0.2, 0.2, 0.25], dtype=np.float32), None)
    hue_lo, hue_hi = window["hue"]
    val_lo, val_hi = window["value"]
    plans = [(18, 21, 21), (9, 7, 7), (5, 4, 4)]
    centre = None
    for index, (hue_steps, sat_steps, val_steps) in enumerate(plans):
        if centre is None:
            hue_grid = np.linspace(hue_lo, hue_hi, hue_steps)
            sat_lo, sat_hi = 0.0, 0.6
            val_lo_, val_hi_ = val_lo, val_hi
        else:
            span = (hue_hi - hue_lo) / 18 / 4 ** (index - 1)
            hue_grid = np.linspace(max(0.0, centre[0] - span), min(360.0, centre[0] + span), hue_steps)
            pad = 0.3 / 2**index
            sat_lo, sat_hi = max(0.0, centre[1] - pad), min(1.0, centre[1] + pad)
            pad = 0.25 / 2**index
            val_lo_, val_hi_ = max(0.02, centre[2] - pad), min(1.0, centre[2] + pad)
        h, s, v = np.meshgrid(
            hue_grid,
            np.linspace(sat_lo, sat_hi, sat_steps),
            np.linspace(val_lo_, val_hi_, val_steps),
            indexing="ij",
        )
        candidates = hsv_to_rgb(h.ravel(), s.ravel(), np.clip(v.ravel(), val_lo_, val_hi_)).reshape(-1, 3)
        if not len(candidates):
            continue
        delta = np.abs(
            style_pixels(candidates, treatments[working], kind)["styled_rgb"] - target
        ).sum(axis=1)
        pick = int(np.argmin(delta))
        if float(delta[pick]) < best[0]:
            best = (float(delta[pick]), candidates[pick], delta[pick])
        hue, sat, val = rgb_to_hsv(candidates[pick : pick + 1])
        centre = (float(hue[0]), float(sat[0]), float(val[0]))
    authored = np.clip(best[1], 0, 1)
    return {
        "objectiveMood": working,
        "authoredSrgb": [round(float(v), 4) for v in authored],
        "authoredLinear": [round(float(v), 4) for v in srgb_to_linear(authored)],
        "residualByMood": {
            name: round(float(np.abs(styled(authored, treatments[name], kind) - target).sum()), 4)
            for name in mood_names
        },
        "objectiveL1": round(float(best[0]), 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mood", default=None, help="mood de trabajo (por defecto el activo del estilo)")
    parser.add_argument("--json", default=None)
    parser.add_argument(
        "--authored",
        default="",
        help="comparación con la tabla actual: gn_brick_wall=0.42,0.17,0.12;...",
    )
    args = parser.parse_args()
    if args.mood:
        import os

        os.environ["LANDLORD_ART_MOOD"] = args.mood
    style_layer = json.loads(STYLE_LAYER.read_text(encoding="utf-8"))
    mood_id = active_mood_id(style_layer)
    # `active_mood` consume el perfil una sola vez (aplica `bandOverrides` y los retira), así que
    # cada mood que se evalúa se lee de una copia fresca del JSON.
    treatment = json.loads(STYLE_LAYER.read_text(encoding="utf-8"))
    treatment = active_mood(treatment)["externalTreatment"]
    others = {}
    for other in ("night_civic", "day_industrial"):
        import os

        previous = os.environ.get("LANDLORD_ART_MOOD")
        os.environ["LANDLORD_ART_MOOD"] = other
        others[other] = active_mood(json.loads(STYLE_LAYER.read_text(encoding="utf-8")))["externalTreatment"]
        if previous is None:
            os.environ.pop("LANDLORD_ART_MOOD", None)
        else:
            os.environ["LANDLORD_ART_MOOD"] = previous

    current = {}
    for token in filter(None, args.authored.split(";")):
        name, value = token.split("=")
        current[name] = np.asarray([float(v) for v in value.split(",")], dtype=np.float32)

    surfaces = []
    for spec in SURFACES:
        name = spec["gn"]
        if "atlas" in spec:
            source = dominant_cluster(
                TEXTURES / spec["atlas"],
                spec["hue"],
                spec["value"],
                spec.get("maxSaturation"),
            )
            authored = np.asarray(source["authoredSrgb"], dtype=np.float32)
            target_note = "cluster dominante del atlas de control"
        else:
            source = gltf_factor(spec["factor"])
            target = np.asarray(source["authoredSrgb"], dtype=np.float32)
            solved = solve_authored(target, {mood_id: treatment, **others}, spec["solver"])
            source["untreatedTargetSrgb"] = [round(float(v), 4) for v in target]
            source["solved"] = solved
            authored = np.asarray(solved["authoredSrgb"], dtype=np.float32)
            target_note = (
                "MI_Glass no tiene albedo de textura: el control escapa al tratamiento, así que se "
                "invierte la escalera minimizando el residuo en los tres moods a la vez"
            )
        path = treatment_path(name, treatment)
        entry = {
            "gnMaterial": name,
            "role": spec["role"],
            "derivation": target_note,
            "treatmentPath": path,
            "controlMeasured": source,
            "authoredLinear": [round(float(v), 4) for v in srgb_to_linear(authored)],
            "authoredSrgb": [round(float(v), 4) for v in authored],
        }
        if path == "flatMaterials_por_nombre":
            hijack, matched = flat_rule_result(name, authored, treatment)
            entry["nameHijack"] = {
                "matchedKeywords": matched,
                "styledSrgb": [round(float(v), 4) for v in hijack],
                "expectedSrgb": [round(float(v), 4) for v in styled(authored, treatment)],
                "verdict": "SECUESTRO: este nombre no pasa por la escalera de bandas",
            }
        else:
            entry["styledSrgb"] = [round(float(v), 4) for v in styled(authored, treatment)]
        if name in current:
            before = current[name]
            entry["previouslyAuthoredSrgb"] = [round(float(v), 4) for v in linear_to_srgb(before)]
            entry["styledPreviously"] = [round(float(v), 4) for v in styled(before, treatment)]
            entry["styledNow"] = [
                round(float(v), 4)
                for v in (
                    flat_rule_result(name, authored, treatment)[0]
                    if path == "flatMaterials_por_nombre"
                    else styled(authored, treatment)
                )
            ]
            entry["controlStyledReference"] = [
                round(float(v), 4)
                for v in (
                    np.asarray(source["authoredSrgb"], dtype=np.float32)
                    if "factor" in spec
                    else styled(np.asarray(source["authoredSrgb"], dtype=np.float32), treatment)
                )
            ]
            entry["deltaStyledL1"] = round(
                float(np.abs(np.asarray(entry["styledNow"]) - np.asarray(entry["controlStyledReference"])).sum()),
                4,
            )
            entry["deltaBeforeL1"] = round(
                float(
                    np.abs(
                        np.asarray(entry["styledPreviously"]) - np.asarray(entry["controlStyledReference"])
                    ).sum()
                ),
                4,
            )
        # Residuo en los demás moods: la coincidencia estructural sólo vale si el mismo color de
        # autor sigue coincidiendo de noche.
        entry["moodResidual"] = {}
        for other, other_treatment in others.items():
            got = (
                flat_rule_result(name, authored, other_treatment)[0]
                if treatment_path(name, other_treatment) == "flatMaterials_por_nombre"
                else styled(authored, other_treatment)
            )
            control_authored = np.asarray(source["authoredSrgb"], dtype=np.float32)
            if "factor" in spec:
                want = control_authored  # en el control el vidrio no se trata en ningún mood
            else:
                want = (
                    styled(control_authored, other_treatment)
                    if treatment_path(name, other_treatment) == "escalera_de_bandas"
                    else flat_rule_result(name, control_authored, other_treatment)[0]
                )
            entry["moodResidual"][other] = round(float(np.abs(got - np.asarray(want)).sum()), 4)
        surfaces.append(entry)

    report = {
        "schemaVersion": 1,
        "generator": "tools/art-pipeline/blender/ext_lab/gn_palette.py",
        "mood": mood_id,
        "styleLayer": str(STYLE_LAYER.relative_to(REPO)),
        "rule": (
            "color de autor = cluster dominante medido en el atlas del control; misma banda => "
            "mismas escalas en todos los moods. El vidrio se invierte numéricamente porque en el "
            "control no tiene albedo de textura y escapa al tratamiento."
        ),
        "surfaces": surfaces,
    }
    text = json.dumps(report, indent=1, ensure_ascii=False)
    print(text)
    if args.json:
        Path(args.json).parent.mkdir(parents=True, exist_ok=True)
        Path(args.json).write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

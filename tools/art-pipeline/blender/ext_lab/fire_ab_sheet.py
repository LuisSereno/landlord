"""D-111.2 FASE 3 — hoja A/B de los incendios de Blender, con las lecturas dentro del pie.

El diagnóstico de FASE 2 se midió con un script desechable que vivía en `/tmp` y ya no existe: la
evidencia eran los PNG y sus números, pero nadie podía volver a sacarlos. Este vive en el repo y
repite la medición con el mismo criterio (píxel cálido = `R−B > 50 y R > 170`; focos = componentes
conexas de ese mapa con área ≥ 40 px), de modo que control y candidata se juzgan con la misma vara y
un tercero puede reproducir la tabla sin abrir Blender.

No re-renderiza nada: lee los PNG+JSON hermanos de `evidence/v2/fire/`. Si falta un brazo, el panel
lo declara `SIN EVIDENCIA` en vez de inventarse una muestra (mandato §8.3).

Uso:
    python3 tools/art-pipeline/blender/ext_lab/fire_ab_sheet.py

Salidas (versionadas, junto a los fotogramas):
    evidence/v2/fire/fire_blender_ab.png          lectura 1×
    evidence/v2/fire/fire_blender_ab_half.png     0,5× = escala real de juego
    evidence/v2/fire/fire_blender_ab_readings.json  las mismas cifras, en texto
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from compose_review_sheets import panel, placeholder, sheet

REPO = Path(__file__).resolve().parents[4]
FIRE = REPO / "docs/art/graphics-capabilities/evidence/v2/fire"

# Umbral de "foco" sobre el mapa cálido: por debajo, el anti-aliasing de un canto caliente del muro
# contaría como llama y la cuenta dejaría de significar "fuego visible".
MIN_FOCUS_PX = 40
WARM_MIN_R = 170
WARM_MIN_GAP = 50

# (carpeta no hace falta: los cuatro fotogramas viven juntos) tipo, mood, etiqueta del pie
CASES = (
    ("mixed_tenement", "day", "cívico de 3 plantas · día"),
    ("mixed_tenement", "night", "cívico de 3 plantas · noche"),
    ("warehouse", "day", "nave de 1 planta · día"),
    ("warehouse", "night", "nave de 1 planta · noche"),
)


def load_meta(png: Path) -> dict:
    meta = png.with_suffix(".json")
    return json.loads(meta.read_text(encoding="utf8")) if meta.exists() else {}


def warm_map(rgb: np.ndarray) -> np.ndarray:
    """Máscara de píxel cálido: rojo dominante y suficientemente brillante para ser llama."""
    red = rgb[:, :, 0].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    return ((red - blue) > WARM_MIN_GAP) & (red > WARM_MIN_R)


def count_foci(mask: np.ndarray) -> tuple[int, int]:
    """(focos, píxeles del mayor): componentes 4-conexas del mapa cálido.

    `structure` en cruz y no en 8: dos lenguas que sólo se tocan por la esquina son un foco distinto
    a efectos de lectura, que es lo que se está juzgando aquí.
    """
    structure = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
    labels, _count = ndimage.label(mask, structure=structure)
    areas = np.bincount(labels.ravel())[1:]
    big = areas[areas >= MIN_FOCUS_PX]
    return int(len(big)), int(big.max()) if len(big) else 0


def saturation(rgb: np.ndarray, mask: np.ndarray) -> int:
    """Saturación media (max−canal, escala 0..255) sobre el mapa cálido: lo que se aplana a blanco cae."""
    pixels = rgb[mask]
    if not len(pixels):
        return 0
    top = pixels.max(axis=1).astype(np.int16)
    low = pixels.min(axis=1).astype(np.int16)
    return int(round(float((top - low).mean())))


def peak(rgb: np.ndarray, mask: np.ndarray) -> tuple[int, int, int]:
    pixels = rgb[mask]
    if not len(pixels):
        return (0, 0, 0)
    brightest = pixels[int(np.argmax(pixels.sum(axis=1)))]
    return (int(brightest[0]), int(brightest[1]), int(brightest[2]))


def clipped(rgb: np.ndarray, alpha: np.ndarray) -> tuple[int, float]:
    """Píxeles quemados a blanco puro y su tanto por ciento sobre el dibujo.

    El cierre de FASE 3 pide un incendio convincente "sin recortes ni sobreexposición". Un picos RGB
    (255,255,255) puede ser la punta de una llama de tres píxeles o un boquete de luz; lo que juzga
    el ojo es cuánta superficie se quedó sin información. Se cuenta el pixel con los tres canales en
    255 sobre el sprite recortado, que es lo que ve el jugador.
    """
    opaque = alpha > 8
    blown = opaque & (rgb.min(axis=2) >= 250)
    total = int(opaque.sum()) or 1
    return int(blown.sum()), round(100.0 * blown.sum() / total, 2)


def fire_transforms(meta: dict, role: str) -> list[dict]:
    return [
        record
        for record in meta.get("transforms", [])
        if str(record.get("purpose", "")).startswith(f"fire:{role}")
    ]


def readings(png: Path, meta: dict) -> dict:
    rgba = np.asarray(Image.open(png).convert("RGBA"))
    image = rgba[:, :, :3]
    mask = warm_map(image)
    foci, largest = count_foci(mask)
    blown, blown_pct = clipped(image, rgba[:, :, 3])
    flames = fire_transforms(meta, "flame")
    smoke = fire_transforms(meta, "smoke")
    envelope = meta.get("envelopeMeters", {}).get("z", 0.0)
    soot = (meta.get("damageTreatment") or {}).get("soot", {})
    flames_block = (meta.get("damageTreatment") or {}).get("flames", {})
    smoke_top = max((record["bounds"]["z"]["max"] for record in smoke), default=0.0)
    smoke_base = min((record["bounds"]["z"]["min"] for record in smoke), default=0.0)
    flame_top = max((record["bounds"]["z"]["max"] for record in flames), default=0.0)
    # El pretil es el plano de la cubierta seccionada, no el borde del lienzo: en el control la
    # envoltoria la marcaba el edificio (10,00 m) y en la candidata la marca la propia pluma, así que
    # medir el humo contra la envoltoria daría +0,00 justo en el caso arreglado.
    parapet = ((meta.get("damageRegion") or {}).get("z") or {}).get("max") or float(envelope)
    return {
        "focosDeclarados": len(flames),
        "focosVisibles": foci,
        "focoMayorPx": largest,
        "píxelesRecortados": blown,
        "recortePorciento": blown_pct,
        "lienzoPx": list((meta.get("framing") or {}).get("canvasPixels") or []),
        "spritePx": [
            (meta.get("trim") or {}).get("final", {}).get("width", 0),
            (meta.get("trim") or {}).get("final", {}).get("height", 0),
        ],
        "pesoKiB": round((meta.get("pngBytes") or 0) / 1024),
        "luzDelFuego": (meta.get("damageTreatment") or {}).get("glow"),
        # Cuántas mallas de fuego/humo van sin rayo de sombra. En el control es 0 y la llama proyecta
        # su cuña negra sobre el forjado que ella misma debería iluminar.
        "mallasSinSombra": (meta.get("damageTreatment") or {}).get("vfx", {}).get(
            "vfxShadowRaysOff", 0
        ),
        "picoRGB": peak(image, mask),
        "saturacionCalida": saturation(image, mask),
        "cotaLlamaMin": round(min((r["bounds"]["z"]["min"] for r in flames), default=0.0), 2),
        "cotaLlamaMax": round(max((r["bounds"]["z"]["max"] for r in flames), default=0.0), 2),
        "alturasLlamaDistintas": len({round(r["bounds"]["z"]["max"] - r["bounds"]["z"]["min"], 2) for r in flames}),
        "topeHumoM": round(smoke_top, 2),
        "envoltoriaM": round(float(envelope), 2),
        "cotaPretilM": round(float(parapet), 2),
        "humoSobrePretilM": round(smoke_top - float(parapet), 2),
        # Positivo = la primera bocanada nace POR DEBAJO de la punta de la llama dominante, que es la
        # geometría de la oclusión medida en la pasada D (la bola de humo delante del cuerpo del fuego).
        "arranqueHumoBajoPuntaM": round(flame_top - smoke_base, 2),
        "hollin": {
            "strength": soot.get("sootStrength"),
            "materiales": soot.get("materialsScorched"),
            "localizado": soot.get("localized", False),
            "opacidadNucleo": soot.get("coreOpacity"),
        },
        "llamaEmission": {
            "pico": flames_block.get("flamePeakEmission", flames_block.get("flameEmissionStrength")),
            "materiales": flames_block.get("flameMaterials"),
            "zonas": [
                zone.get("appliedStrength", zone.get("authored"))
                for zone in flames_block.get("flameZones", [])
            ],
        },
        "firma": meta.get("compositionSignature"),
    }


def caption(arm: str, label: str, r: dict) -> str:
    soot = r["hollin"]
    flame = r["llamaEmission"]
    glow = r.get("luzDelFuego") or {}
    hollin = (
        f"hollín {soot['strength']} localizado núcl {soot['opacidadNucleo']}"
        if soot["localizado"]
        else f"hollín {soot['strength']} uniforme"
    )
    zonas = "/".join(str(value) for value in flame["zonas"]) or "—"
    luz = (
        f"{glow['lights']} luces de {glow['wattsEach']} W ({glow['shareOfKey']}× clave "
        f"{glow['keyEnergyReference']}, alcance {glow['reachMeters']} m)"
        if glow.get("lights")
        else "sin luz de fuego"
    )
    return (
        f"{label} · {arm.upper()} — focos {r['focosVisibles']} visibles de {r['focosDeclarados']} "
        f"(mayor {r['focoMayorPx']} px) · pico {r['picoRGB']} · sat {r['saturacionCalida']} · "
        f"recorte {r['píxelesRecortados']} px ({r['recortePorciento']} %) · "
        f"llamas {r['cotaLlamaMin']}–{r['cotaLlamaMax']} m en {r['alturasLlamaDistintas']} alturas · "
        f"humo {r['arranqueHumoBajoPuntaM']:+} m bajo la punta y {r['humoSobrePretilM']:+} m sobre "
        f"pretil · {hollin} sobre {soot['materiales']} mat · emisión núcleo {flame['pico']} zonas "
        f"{zonas} · {luz} · {r['mallasSinSombra']} mallas VFX sin proyectar sombra · "
        f"sprite {r['spritePx'][0]}×{r['spritePx'][1]} · {r['pesoKiB']} KiB"
    )


def build(scale: float, measured: dict) -> tuple[int, int]:
    panels = []
    for building, mood, label in CASES:
        for arm in ("control", "candidata"):
            png = FIRE / f"{arm}_{building}_{mood}.png"
            key = f"{building}-{mood}-{arm}"
            if not png.exists():
                panels.append(placeholder(f"{label} · {arm} · SIN EVIDENCIA", 520, 340))
                continue
            measured[key] = readings(png, load_meta(png))
            panels.append(
                panel(
                    png,
                    caption(arm, label, measured[key]),
                    max_height=round(880 * scale),
                    big=max(11, round(16 * scale)),
                    # El pie lleva diez datos desde que la hoja mide también recorte, luz del fuego,
                    # sombra de las mallas VFX y tamaño de sprite. A 0,5× la columna es la mitad de
                    # ancha, así que las líneas que caben se doblan: con un tope fijo el
                    # `wrap_caption` callaría la última mitad del pie, y un pie truncado no es evidencia.
                    max_lines=11 if scale >= 1.0 else 20,
                )
            )
    title = "D-111.2 FASE 3 · incendios en Blender: control congelado vs candidata"
    subtitle = (
        "Cuatro filas, cada una con su control a la izquierda y su candidata a la derecha: cívico de "
        "3 plantas (10,00 m) de día y de noche, nave de 1 planta (6,42 m) de día y de noche. Misma "
        "semilla (2), mismo estado (burning), mismo mood y misma cámara resuelta por el compositor. El "
        "pie de cada panel está medido sobre el PNG con la máscara cálida R−B>50 y R>170 (foco = "
        "componente conexas ≥ 40 px), no escrito a mano. · 'recorte' cuenta el píxel opaco con los "
        "tres canales en 255: es la superficie que perdió su color por sobreexposición, y el cierre de "
        "la fase la exige en 0. · 'humo +X m bajo la punta' es cuánto el arranque de la columna se "
        "come el cuerpo de las llamas (positivo = oclusión). · 'sobre pretil' es el saldo de la cima "
        "contra el plano de la cubierta seccionada (negativo = muere dentro del edificio). · 'luz' "
        "declara las luces puntuales que el incendio encendió en la escena, en vatios y en cuota "
        "sobre la clave del mood; 'sin luz de fuego' es el control, que sólo tenía mallas emisivas. · "
        "'mallas VFX sin proyectar sombra' es cuántos objetos de llama y humo van apagados al rayo de "
        "sombra: en el control son 0 y el sol dibuja una cuña negra bajo cada hoguera. · "
        "'sprite' y 'KiB' son el coste real del lienzo que paga el navegador."
    )
    out = FIRE / ("fire_blender_ab.png" if scale >= 1.0 else "fire_blender_ab_half.png")
    return sheet(out, title, subtitle, panels, columns=2)


def main() -> int:
    missing = [
        str(FIRE / f"{arm}_{building}_{mood}.png")
        for building, mood, _ in CASES
        for arm in ("control", "candidata")
        if not (FIRE / f"{arm}_{building}_{mood}.png").exists()
    ]
    if missing:
        print("FALTAN FOTOGRAMAS (la hoja los declararía SIN EVIDENCIA):")
        for path in missing:
            print(" -", path)
    measured: dict = {}
    sizes = [build(scale, measured) for scale in (1.0, 0.5)]
    (FIRE / "fire_blender_ab_readings.json").write_text(
        json.dumps(measured, ensure_ascii=False, indent=1), encoding="utf8"
    )
    print(json.dumps({"sheets": sizes, "panels": len(measured)}, ensure_ascii=False))
    for key, r in measured.items():
        glow = r.get("luzDelFuego") or {}
        print(f"{key}: focos {r['focosVisibles']}/{r['focosDeclarados']} pico {r['picoRGB']} "
              f"sat {r['saturacionCalida']} recorte {r['píxelesRecortados']} px "
              f"({r['recortePorciento']} %) humo {r['topeHumoM']} m ({r['humoSobrePretilM']:+} sobre "
              f"pretil, {r['arranqueHumoBajoPuntaM']:+} bajo punta) llamas {r['cotaLlamaMin']}–"
              f"{r['cotaLlamaMax']} m sprite {r['spritePx']} {r['pesoKiB']} KiB "
              f"luz {glow.get('lights', 0)}×{glow.get('wattsEach', 0)} W "
              f"sombraVfx {r['mallasSinSombra']} hollin {r['hollin']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

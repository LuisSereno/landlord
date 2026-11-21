#!/usr/bin/env python3
"""
D-111.2 FASE 6 — hoja de los cuatro estados de conservación del MISMO edificio.

El encargo pide una comparación con el mismo edificio mostrando conservación, envejecimiento, daño e
incendio. Se leen los cuatro candidatos publicados en `evidence/v2/weathering/day/` (misma semilla
1001, mismo `mixed_tenement`, mismo perfil) y se mide lo que la hoja tiene que demostrar, que no es el
gusto del paño sino la DISTINCIÓN:

· `envejecido` tiene que ser el mismo edificio: misma firma de composición, mismo número de
  colocaciones, mismo despiece por grupo. Si moviera geometría sería daño, y §6 lo prohibe.
· `dañado` tiene que perder estructura: secciona cubierta y paños altos y añade escombros. Si no los
  perdiera, el runtime seguiría pintando de ruina un edificio con mantenimiento bajo.
· `en llamas` es el dañado más los focos: se cuentan, y se anotan sus cotas.

Cada panel lleva debajo las cifras con las que se puede discutir la representación. La tabla de la
cabecera es la proyección derivada que implementa
`apps/web/src/isometric/building-condition.ts` — leída de `visualStates.*.derivation` del contrato de
weathering, sin umbrales nuevos.

Salidas (junto a las de WP04):
 - `docs/art/graphics-capabilities/evidence/v2/sheets/building_condition_states.png`
 - `docs/art/graphics-capabilities/evidence/v2/sheets/building_condition_states.json`

Uso:
    python3 scripts/building-condition-sheet.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parent.parent
DAY = REPO / "docs/art/graphics-capabilities/evidence/v2/weathering/day"
ANTES = DAY.parent / "damage_section_probe.json"
OUT_DIR = REPO / "docs/art/graphics-capabilities/evidence/v2/sheets"
OUT_PNG = OUT_DIR / "building_condition_states.png"
OUT_JSON = OUT_DIR / "building_condition_states.json"

PANEL_PX = 336
GAP = 16
# Ruido de muestreo: WP04 fijó en 16/255 el salto que cuenta como píxel movido.
PIXEL_MOVIDO = 16

TIER = ["conserved", "aged", "damaged", "burning"]
CANDIDATO = "vw_mixed_tenement_1001"
ETIQUETA = {
    "conserved": "CONSERVADO · operational · condition ≥ 60",
    "aged": "ENVEJECIDO · operational · condition < 60 · integridad > 0",
    "damaged": "DAÑADO · ruin, o condition < 60 sin integridad",
    "burning": "EN LLAMAS · burning / collapse_pending",
}


def grupo(purpose: str) -> str:
    if purpose.startswith("roof"):
        return "cubierta"
    if purpose.startswith("cornice"):
        return "cornisa"
    if purpose.startswith("band:front:"):
        return "huecos del frente"
    if purpose.startswith(("band:left:", "band:right:", "band:rear:")):
        return "huecos de testero"
    if purpose.startswith("damage:"):
        return "escombros"
    if purpose.startswith("fire:"):
        return "fuego/humo"
    return "otros"


def carga(tier: str):
    stem = DAY / f"{CANDIDATO}_{tier}"
    metadata = json.loads(stem.with_suffix(".json").read_text(encoding="utf-8"))
    placements = metadata["composition"]["placements"]
    image = Image.open(stem.with_suffix(".png")).convert("RGBA")
    array = np.asarray(image, dtype=np.int16)
    solido = array[..., 3] > 8
    luma = (0.2126 * array[..., 0] + 0.7152 * array[..., 1] + 0.0722 * array[..., 2])[solido]
    return {
        "tier": tier,
        "etiqueta": ETIQUETA[tier],
        "candidateId": metadata["candidateId"],
        "png": str(stem.with_suffix(".png").relative_to(REPO)),
        "sello": metadata["pixelSha256"],
        "firmaComposicion": metadata["compositionSignature"],
        "state": metadata["state"],
        "weathering": (metadata.get("weathering") or {}).get("visualState"),
        "materialProjection": (metadata.get("weathering") or {}).get("materialProjection"),
        "colocaciones": len(placements),
        "porGrupo": dict(sorted(Counter(grupo(p["purpose"]) for p in placements).items())),
        "cornisasEnSemiplanoDanado": sum(
            1
            for p in placements
            if p["purpose"].startswith("cornice") and p["position"][0] >= 0.0
        ),
        "lumaMedia": round(float(luma.mean()), 2),
        "desviacionLuma": round(float(luma.std()), 2),
        "pixels": [image.width, image.height],
        "_array": array,
        "_solido": solido,
    }


def compara(panel, base):
    """Δ de luma y fracción de píxel movido contra el conservado, sobre la intersección opaca."""
    a, b = panel["_array"], base["_array"]
    if a.shape != b.shape:
        # `damaged`/`burning` se recortan con otra caja: se alinea por el borde y se compara el común.
        h = min(a.shape[0], b.shape[0])
        w = min(a.shape[1], b.shape[1])
        a, b = a[:h, :w], b[:h, :w]
    solido = (a[..., 3] > 8) & (b[..., 3] > 8)
    la = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[solido]
    lb = (0.2126 * b[..., 0] + 0.7152 * b[..., 1] + 0.0722 * b[..., 2])[solido]
    delta = la - lb
    return {
        "deltaLumaMedio": round(float(delta.mean()), 2),
        "deltaLumaMediano": round(float(np.median(delta)), 2),
        "pixelsMovidosPorcentaje": round(float((abs(delta) > PIXEL_MOVIDO).mean() * 100.0), 2),
    }


def fuente(tamano: int, negrita: bool = False):
    nombres = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if negrita
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
        if negrita
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for nombre in nombres:
        path = Path(nombre)
        if path.is_file():
            return ImageFont.truetype(str(path), tamano)
    return ImageFont.load_default()


def envolver(draw, texto: str, font, ancho_max: int) -> list[str]:
    """Parte por palabras y, si una palabra sola no cabe, la corta en trozos.

    WP08 pide rótulos sin cortar: en 1440 px de hoja la tabla de la cabecera y el despiece por grupo
    desbordaban su panel y se escribían encima del vecino. Aquí nada se dibuja fuera de `ancho_max`.
    """
    lineas: list[str] = []
    for parrafo in texto.splitlines() or [""]:
        actual = ""
        for palabra in parrafo.split():
            candidato = f"{actual} {palabra}" if actual else palabra
            if draw.textlength(candidato, font=font) <= ancho_max:
                actual = candidato
                continue
            if actual:
                lineas.append(actual)
                actual = ""
            while len(palabra) > 1 and draw.textlength(palabra, font=font) > ancho_max:
                corte = max(2, int(len(palabra) * ancho_max / draw.textlength(palabra, font=font)))
                if corte >= len(palabra):
                    corte = len(palabra) - 1
                lineas.append(palabra[:corte])
                palabra = palabra[corte:]
            actual = palabra
        lineas.append(actual)
    return [linea for linea in lineas if linea]


def main() -> None:
    paneles = [carga(tier) for tier in TIER]
    base = paneles[0]
    for panel in paneles:
        panel.update(compara(panel, base))
        panel["lumaMediaDelta"] = round(panel["lumaMedia"] - base["lumaMedia"], 2)

    mismo_edificio = (
        paneles[0]["firmaComposicion"] == paneles[1]["firmaComposicion"]
        and paneles[0]["colocaciones"] == paneles[1]["colocaciones"]
        and paneles[0]["porGrupo"] == paneles[1]["porGrupo"]
    )
    veredicto = {
        "envejecidoConservaLaMismaGeometria": mismo_edificio,
        "envejecidoIgualQueConservadoEnPxMovidos": paneles[1]["pixelsMovidosPorcentaje"],
        "danadoPierdeCubierta": (
            paneles[2]["porGrupo"].get("cubierta", 0) < paneles[0]["porGrupo"].get("cubierta", 0)
        ),
        "danadoAnadeEscombros": paneles[2]["porGrupo"].get("escombros", 0),
        "llamasAnadenFuego": paneles[3]["porGrupo"].get("fuego/humo", 0)
        - paneles[2]["porGrupo"].get("fuego/humo", 0),
        "cornisasVivasEnSemiplanoDanado": {
            panel["tier"]: panel["cornisasEnSemiplanoDanado"] for panel in paneles
        },
    }

    ancho = GAP + (PANEL_PX + GAP) * len(paneles)
    texto_ancho = ancho - 2 * GAP
    f_titulo, f_tabla, f_caps, f_mini = fuente(23, True), fuente(15), fuente(14), fuente(12)

    antes = json.loads(ANTES.read_text(encoding="utf-8"))["verdict"] if ANTES.is_file() else {}
    cabecera = [
        ("D-111.2 FASE 6 · los cuatro estados de conservación del mismo edificio", f_titulo, (236, 238, 242)),
        (
            "mixed_tenement · semilla 1001 · perfil graphic_civic_buildings_v1 · mood day_civic · "
            "regenerados tras cerrar WP04-D1 en compose.py:_compose_damage",
            f_tabla,
            (150, 158, 172),
        ),
        (
            "proyección derivada (apps/web/src/isometric/building-condition.ts ← "
            "visualStates.*.derivation del contrato de weathering, sin umbrales nuevos):  "
            + "   |   ".join(
                [
                    "operational · condition ≥ 60 → conservado",
                    "operational · condition < 60 · integridad > 0 → envejecido",
                    "ruin (o condition < 60 sin integridad) → dañado",
                    "burning / collapse_pending → en llamas",
                ]
            ),
            f_mini,
            (198, 205, 216),
        ),
        (
            f"envejecido conserva la MISMA composición que conservado: "
            f"{veredicto['envejecidoConservaLaMismaGeometria']} · píxeles movidos "
            f"{paneles[1]['pixelsMovidosPorcentaje']} % (material, no geometría) · dañado pierde "
            f"cubierta: {veredicto['danadoPierdeCubierta']} y añade {veredicto['danadoAnadeEscombros']} "
            f"escombros · fuego/humo en llamas: "
            f"{paneles[3]['porGrupo'].get('fuego/humo', 0)} módulos",
            f_mini,
            (228, 190, 96),
        ),
        (
            "WP04-D1 (cornisas): colocaciones `cornice:*` vivas en el semiplano dañado → "
            + " · ".join(f"{panel['tier']} {panel['cornisasEnSemiplanoDanado']}" for panel in paneles)
            + (
                f"  |  la regla de igualdad seccionaba {antes.get('retiradasAntes')} módulos y la de "
                f"prefijo {antes.get('retiradasDespues')} (+{antes.get('diferenciaModulos')} cornisas) "
                f"· caja de daño y: {antes.get('cajaDanioAntes', {}).get('rect', [])[1]} → "
                f"{antes.get('cajaDanioDespues', {}).get('rect', [])[1]} m"
                if antes
                else ""
            ),
            f_mini,
            (232, 140, 120),
        ),
    ]

    # Medir antes de reservar: una cabecera con altura fija es exactamente como se cortaban los rótulos.
    medidor = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    filas_cabecera = [envolver(medidor, texto, font, texto_ancho) for texto, font, _ in cabecera]
    alto_cabecera = sum(len(filas) * 19 + 8 for filas in filas_cabecera) + 14
    filas_pie = []
    for panel in paneles:
        lineas = [(linea, f_caps, (236, 238, 242)) for linea in
                  envolver(medidor, panel["etiqueta"], f_caps, PANEL_PX - 8)]
        for texto in (
            f"colocaciones {panel['colocaciones']} · firma {panel['firmaComposicion'][:8]}",
            " · ".join(f"{k} {v}" for k, v in panel["porGrupo"].items()),
            f"luma media {panel['lumaMedia']} (Δ {panel['lumaMediaDelta']:+}) · desviación "
            f"{panel['desviacionLuma']}",
            f"píxeles movidos vs conservado {panel['pixelsMovidosPorcentaje']} %",
            f"weathering {panel['weathering'] or '—'} · proyección de material "
            f"{panel['materialProjection']}",
        ):
            lineas += [(linea, f_mini, (176, 184, 197)) for linea in
                       envolver(medidor, texto, f_mini, PANEL_PX - 8)]
        filas_pie.append(lineas)
    alto_pie = max(len(filas) for filas in filas_pie) * 16 + 12

    lienzo = Image.new("RGB", (ancho, alto_cabecera + PANEL_PX + alto_pie + GAP), (16, 17, 20))
    draw = ImageDraw.Draw(lienzo)

    y = 14
    for (texto, font, relleno), filas in zip(cabecera, filas_cabecera):
        for linea in filas:
            draw.text((GAP, y), linea, font=font, fill=relleno)
            y += 19
        y += 8

    y_cabecera = y
    for index, panel in enumerate(paneles):
        x = GAP + index * (PANEL_PX + GAP)
        fondo = Image.new("RGB", (PANEL_PX, PANEL_PX), (28, 30, 35))
        imagen = Image.open(DAY / f"{CANDIDATO}_{panel['tier']}.png").convert("RGBA")
        escala = PANEL_PX / max(imagen.width, imagen.height)
        talla = (max(1, round(imagen.width * escala)), max(1, round(imagen.height * escala)))
        recortada = imagen.resize(talla, Image.LANCZOS)
        fondo.paste(recortada, ((PANEL_PX - talla[0]) // 2, PANEL_PX - talla[1]), recortada)
        lienzo.paste(fondo, (x, y_cabecera))
        draw.rectangle(
            [x, y_cabecera, x + PANEL_PX - 1, y_cabecera + PANEL_PX - 1],
            outline=(58, 62, 70),
            width=1,
        )

        pie = y_cabecera + PANEL_PX + 6
        for offset, (linea, font, relleno) in enumerate(filas_pie[index]):
            draw.text((x + 4, pie + offset * 16), linea, font=font, fill=relleno)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lienzo.save(OUT_PNG)
    salida = {
        "schemaVersion": 1,
        "generatedBy": "scripts/building-condition-sheet.py",
        "task": "D-111.2 FASE 6 — envejecimiento vs daño",
        "candidato": "mixed_tenement 1001 (huella 4×2, 3 plantas, mood day_civic)",
        "fuente": str(DAY.relative_to(REPO)),
        "veredicto": veredicto,
        "paneles": [{k: v for k, v in panel.items() if not k.startswith("_")} for panel in paneles],
        "png": str(OUT_PNG.relative_to(REPO)),
    }
    OUT_JSON.write_text(json.dumps(salida, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(veredicto, indent=1, ensure_ascii=False))
    for panel in paneles:
        print(
            f"{panel['tier']:<10} col {panel['colocaciones']:>4}  luma {panel['lumaMedia']:>6} "
            f"Δ {panel['lumaMediaDelta']:>+6}  movidos {panel['pixelsMovidosPorcentaje']:>5} %  "
            + " ".join(f"{k}={v}" for k, v in panel["porGrupo"].items())
        )
    print(f"escrito en {OUT_PNG.relative_to(REPO)}")


if __name__ == "__main__":
    main()

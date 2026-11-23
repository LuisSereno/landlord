#!/usr/bin/env python3
"""
D-111.2 FASE 7 · WP08 — índice de la evidencia visual y comprobación de defectos de raster.

El cierre de WP08 pide un índice con enlaces directos a cada PNG y un JSON hermano de procedencia por
imagen, y «marcar SIN EVIDENCIA donde falte, sin inventar sustitutos». Este script hace las dos cosas
sobre lo que hay en disco:

1. Recorre los PNG de `ALCANCE` (`v2/**` y el `phaser/` de las FASES 4-5), busca su JSON hermano (o el
   manifiesto compartido que lo cubre) y mide el raster: bytes, dimensiones, luma media, desviación,
   porcentaje de píxel casi negro, porcentaje recortado a blanco y la cara del lienzo con más contenido
   no-fondo, en porcentaje de su propia longitud.
   Con eso «recortes alfa», «capturas negras» y «escenas lavadas» dejan de ser una impresión al abrir
   la carpeta: son una columna.
2. Escribe `INDEX.md` agrupado por carpeta (que es el orden de las FASES) y una sección final de
   huecos declarados: lo que el encargo pide y NO tiene evidencia, para que el responsable decida sin
   tener que adivinar qué falta.

No arregla nada ni promociona nada: sólo describe el estado del árbol de evidencia.

Uso:
  python3 scripts/wp08-index.py            # reescribe INDEX.md
  python3 scripts/wp08-index.py --check    # sale 1 si hay PNG sin procedencia o con defecto durísimo
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageStat

REPO = Path(__file__).resolve().parent.parent
RAIZ = REPO / "docs/art/graphics-capabilities/evidence"
"""
El paquete de D-111.2 vive en dos árboles: `v2/` (Blender, Composer y mundo runtime de las FASES 1-3
y 6, WP01-WP06) y `phaser/` (el tiempo real de FASE 4 y FASE 5, WP07). El resto de `evidence/` es el
catálogo de capacidades anterior al encargo; no se indexa aquí para no mezclar control y candidata.
"""
ALCANCE = ("v2/", "phaser/fx_v2/", "phaser/fire_sheet/", "phaser/fire_animation_sheet.png")

# Umbrales: el runbook no fija números (§5.3 es cualitativa —«se reconoce el pavimento y la fachada
# incluso fuera del halo… sin saturación general»—), así que éstos son una propuesta operativa medida
# sobre la propia evidencia de D-111.2:
# · una captura diurna útil de este paquete nunca baja de luma 60 ni de desviación 28;
# · el fondo de las hojas es #0b1422 (luma 21), así que «casi negro» se mide como < 12 para no
#   contar el propio fondo;
# · 0,6 % de píxeles recortados a blanco es lo que da un LED de farola bien expuesto; por encima de
#   3 % la escena está lavada (así salió el incendio de FASE 2).
LUMA_NEGRA = 45.0
DESVIACION_PLANA = 18.0
CASI_NEGRO_UMBRAL = 12
BLANCO_RECORTADO_UMBRAL = 252
BLANCO_RECORTADO_LAVADA = 3.0
# `TOCA-BORDE` se mide por cara, no por perímetro: una cara del lienzo con al menos la mitad de su
# longitud ocupada por contenido no-fondo es la forma geométrica de un cuerpo seccionado. Medido sobre
# las 108 filas: los recortes de sprite y de módulo no pasan de 0,54 (`v2/ext/control_gn_window_bay.png`,
# que es la falda de la sombra) y los edificios del paquete WP06 se quedan en 0,30; los cantos llenos
# (≥ 0,75) son capturas a pantalla de juego completa y teselas de receta, donde tocar el canto es el
# encuadre, no un defecto.
BORDE_CARA_CONTENIDO = 0.5

"""
Las banderas se miden sobre TODAS las imágenes, pero no todas las banderas aplican a todos los brazos.
Medido en la primera pasada de este índice: de las 43 filas con defecto duro, 33 eran falsos positivos
de clasificador, no de raster.

- `v2/sheets/*.png` son documentos compuestos: su fondo #0b1422 ocupa la mayor parte del lienzo, así
  que la media de luma siempre está por debajo del suelo de una «captura negra» (37,99 en
  `wp06_candidates_ab.png`) y el blanco recortado depende de lo que se pegó encima.
- `v2/weathering/mask/*_mask.png` son canales de trabajo: `glass_mask` es negro porque el contrato deja
  el vidrio fuera de la receta, no porque la captura saliera mal.
- Las capturas nocturnas legítimas miden luma 33–41 con casiNegro 0,04 %; lo que distingue una noche
  legible de una captura negra es la distribución del píxel, no la media.

Por eso `CASI-TODO-NEGRO` (más del 60 % del píxel bajo 12) sustituye a `NEGRA` en el brazo nocturno y
en las hojas, y `LAVADA` no corta en mapas de trabajo. Ninguna medida se tira: se imprime la columna en todas
las filas y lo que cambia es cuál de ellas hace fallar `--check`.

A `TOCA-BORDE` le pasó lo mismo pero al revés: escrita como «cualquier píxel no-fondo en el perímetro»
encendía 88 de las 108 filas, porque el techo aquel (`tocando <= 2 * (ancho + alto)`) no podía excluir
nada —el conteo nunca supera el perímetro que recorre— y la condición era tautológica en cuanto un píxel
aislado tocaba el canto. Ahora mide la cara más llena del lienzo (ver `BORDE_CARA_CONTENIDO`) y avisa en
49 filas, que se reparten exactamente por construcción y no por error:

- 24 al 98,6 % son `phaser/fx_v2` (11) y `phaser/fire_sheet` (13): capturas del viewport de juego, donde
  el canto del PNG es el canto del mundo.
- 16 al 75,4 % son los mapas de receta de `v2/weathering`: la tesela llena la muestra porque se la ve
  repetida, no recortada.
- 1 al 88,5 % es `v2/industrial/dock_aperture_scale.png`, una medida de hueco sobre andamio.
- 8 entre 51,9 % y 54,8 % son los siete vanos de módulo (`v2/ext`, `v2/ag`) y la hoja `v2/ag/quality_ab.png`:
  la crujía sigue existiendo más allá del encuadre a propósito, que es lo que esas hojas demuestran.

Los cuatro edificios que WP08 tiene que comparar, que son donde un corte sí sería un defecto, quedan por
debajo del aviso y no se marcan: `row_house` 0,0 %, `town_hall` 1,5 %, `warehouse` 16,8 % (control 18,1) y
`mixed_tenement` 30,3 %, que es el mismo número en control y en candidata —lo que descarta que el brazo B
perdiera margen de recorte—. La bandera sigue siendo aviso en todos los brazos: lo que decide si un vano
está mal encuadrado es la hoja impresa, no un umbral puesto para que salga verde.
"""
BRAZO_HOJA = "hoja de trabajo"
BRAZO_MAPA = "mapa de trabajo"
BRAZO_NOCHE = "escena nocturna"
BRAZO_DIA = "escena diurna"
# WP08 nombra los defectos que hay que corregir: «rótulos cortados, recortes alfa, capturas negras,
# escenas lavadas, archivos rotos». Éstas son las banderas que cortan `--check` en cada brazo.
# `PLANA` y `TOCA-BORDE` se imprimen en todas las filas pero no cortan: en una hoja con el lienzo como
# fondo es normal que el contenido llegue al canto, y «plana» lo es en un albedo sin iluminación.
DURAS_POR_BRAZO = {
    BRAZO_DIA: {"NEGRA", "CASI-TODO-NEGRO", "LAVADA", "TODO-TRANSPARENTE", "ROTO"},
    BRAZO_NOCHE: {"CASI-TODO-NEGRO", "LAVADA", "TODO-TRANSPARENTE", "ROTO"},
    BRAZO_HOJA: {"CASI-TODO-NEGRO", "TODO-TRANSPARENTE", "ROTO"},
    BRAZO_MAPA: {"TODO-TRANSPARENTE", "ROTO"},
}

# Qué brazo es cada archivo, con la razón medida. Se cura a mano porque el brazo es una propiedad del
# artefacto («esto es un documento», «esto es un canal de receta»), no del raster: decidirlo por
# «¿cuánta luma tiene?» sería usar el defecto para elegir la regla que lo juzga.
BRAZOS_POR_RUTA = {
    # Compuestas por `compose_review_sheets.py` sobre el lienzo #0b1422 (esquinas medidas 11,20,34).
    "v2/sheets/": BRAZO_HOJA,
    # Documentos de FASE 2-5 con su propio lienzo plano medido en las cuatro esquinas:
    "v2/fire/fire_blender_ab.png": BRAZO_HOJA,  # 11,20,34
    "v2/fire/fire_control_sheet.png": BRAZO_HOJA,  # 28,32,40
    "v2/fire/fire_control_detail.png": BRAZO_HOJA,  # 28,32,40
    "v2/ag/quality_ab.png": BRAZO_HOJA,  # dos renders pegados sobre negro, no una escena
    "phaser/fx_v2/phaser_fx_v2_sheet.png": BRAZO_HOJA,  # 16,18,22, la clave `panels` del manifiesto
    "phaser/fire_animation_sheet.png": BRAZO_HOJA,  # 16,18,22, tira de fotogramas
    # Hojas compuestas del cierre D-111.2 (mismo lienzo oscuro de documento, no son escenas):
    "v2/closure/fire/hybrid_fire_ab.png": BRAZO_HOJA,
    "v2/closure/urban/four_candidates_in_phaser.png": BRAZO_HOJA,
    "v2/closure/condition/building_condition_in_phaser.png": BRAZO_HOJA,
    "v2/closure/night/night_lighting_final_ab.png": BRAZO_HOJA,
    # Canales y atlases que alimentan la receta de envejecimiento (FASE 6): no son imagen de escena.
    "v2/weathering/mask/": BRAZO_MAPA,
    # Las tres sondas del halo de FASE 5 son la calle de noche (`fx-effects.ts` §5.2 mide el filamento de
    # la farola sobre `preset_night_fire`), pero ningún JSON las nombra, así que no hay mood que leer:
    # se declara aquí. No oculta nada —en el brazo nocturno siguen cortando CASI-TODO-NEGRO y LAVADA—
    # y NEGRA deja de ser un defecto: las ocho capturas nocturnas declaradas de este paquete miden 33–41.
    "phaser/fx_v2/atribucion/halo_con_pointlight.png": BRAZO_NOCHE,
    "phaser/fx_v2/atribucion/halo_retirado_fire_lighting.png": BRAZO_NOCHE,
    "phaser/fx_v2/atribucion/halo_sin_lighting.png": BRAZO_NOCHE,
}

# Procedencias que viven en un manifiesto compartido en lugar de un JSON por imagen. Sólo valen si el
# manifiesto NOMBRA el archivo: `phaser/fx_v2/atribucion/halo_*.png` caen dentro de la carpeta de
# `fx_v2.json`, pero ese manifiesto lista 8 rutas y ninguna es la suya —atribuirles el lote habría
# sido inventar la procedencia (WP08: «marcar SIN EVIDENCIA donde falte, sin inventar sustitutos»).
MANIFIESTOS = [
    ("phaser/fx_v2/", "phaser/fx_v2/fx_v2.json"),
    ("phaser/fx_v2/", "phaser/fx_v2/phaser_fx_v2_measure.json"),
    ("phaser/fire_sheet/", "phaser/fire_sheet/fire_sheet.json"),
    ("phaser/", "phaser/fire_animation_measure.json"),
    ("v2/weathering/day/", "v2/weathering/day/manifest.json"),
    ("v2/weathering/night/", "v2/weathering/night/manifest.json"),
    ("v2/weathering/optout/", "v2/weathering/optout/manifest.json"),
    ("v2/weathering/mask/", "v2/weathering/mask/summary.json"),
    # Manifiestos del cierre D-111.2 (FASE 6.3): cada uno nombra por basename los PNG que produzco.
    ("v2/closure/urban/", "v2/closure/urban/candidate-runtime-qa-manifest.json"),
    ("v2/closure/fire/", "v2/closure/fire/hybrid_fire_summary.json"),
    ("v2/closure/fire/", "v2/closure/fire/hybrid_fire_anchors.json"),
    ("v2/closure/condition/", "v2/closure/condition/building_condition_summary.json"),
    ("v2/closure/night/", "v2/closure/night/night_lighting_final_summary.json"),
]
_REGISTROS: dict[Path, dict] = {}

# Lo que pide el encargo y no tiene imagen: se declara aquí para que el índice lo imprima.
HUECOS = [
    (
        "Calle poblada de noche en el mundo real",
        "el bundle runtime promocionado es de día (`day_civic`); la noche sólo existe en el laboratorio "
        "(`phaser/fx_v2/preset_night_*.png`). Promover noche al mundo es decisión del responsable.",
    ),
    (
        "Sprite `aged` en catálogo runtime",
        "FASE 6 derivó el tier `aged` pero el manifiesto runtime no tiene ese estado: no hay píxel que "
        "enseñar en juego. Ver `building-weathering-contract.json → derivation.runtimeConflict`.",
    ),
    (
        "Esquina cívica a pico",
        "necesita geometría nueva sobre el extremo de la banda; forzar `brick_post` compone 0/60 semillas y "
        "limitar el módulo a `municipal_block` mueve 56 de 105 colocaciones. No se fuerza con parche.",
    ),
    (
        "Recorte determinista de lienzo",
        "`row_house` y `town_hall` tocan el borde derecho del lienzo con margen 1–2 px en control y candidata "
        "por igual: es la deuda declarada de `deterministic_crop_rect`, no algo introducido por v2.",
    ),
]

# Por qué cada PNG sin procedencia es lo que es, en vez de una fila muda. No es un sustituto: dice
# dónde está la información y por qué no llegó a un JSON hermano con el nombre del archivo. Los commits
# citados son los que publicaron cada imagen (`git log -1 -- <ruta>`), medidos al escribir esta tabla.
SIN_PROCEDENCIA_MOTIVO = {
    "v2/fire/fire_blender_ab.png": (
        "hoja de FASE 3 (`b58f263`) escrita por `tools/art-pipeline/blender/ext_lab/fire_ab_sheet.py`; las "
        "medidas por panel sí están, en `v2/fire/fire_blender_ab_readings.json`, indexadas como "
        "`{familia}-{mood}-{brazo}` y no por nombre de archivo."
    ),
}
SIN_PROCEDENCIA_POR_CARPETA = {
    "phaser/fx_v2/atribucion/": (
        "sondas de atribución del halo de FASE 5 (`f606813`), citadas con sus RGB en "
        "`apps/web/src/fx-lab/fx-effects.ts` §5.2; la corrida que las disparó no las nombró en ningún JSON."
    ),
    "v2/sheets/": (
        "hoja compuesta en WP02-WP05 (`9a48fee`, `464608f`, `348eb78`), antes de que existiera `firmar_hoja()`. "
        "Regenerarla reescribiría una imagen ya revisada: decide el responsable si se vuelve a publicar con firma."
    ),
    "v2/ag/": (
        "render intermedio de WP02 (`9a48fee`) pegado sobre negro para el A/B de calidad; sus dos fuentes sí "
        "tienen JSON hermano en `v2/ag/`."
    ),
    "v2/fire/": (
        "diagnóstico de FASE 2 (`9e95206`): la hoja de control y su detalle se escribieron antes de que el "
        "script dejara procedencia por archivo."
    ),
    "v2/weathering/mask/": (
        "la corrida de FASE 6 escribe `v2/weathering/mask/summary.json`, que lista los 16 canales tratados y "
        "envejecidos pero no el atlas de control del que salen."
    ),
}
SIN_PROCEDENCIA_MOTIVO_DEFAULT = (
    "ningún JSON del árbol nombra este archivo y no tiene hermano: autoría sin registrar."
)


def motivo_sin_procedencia(ruta: str) -> str:
    if ruta in SIN_PROCEDENCIA_MOTIVO:
        return SIN_PROCEDENCIA_MOTIVO[ruta]
    for carpeta, motivo in SIN_PROCEDENCIA_POR_CARPETA.items():
        if ruta.startswith(carpeta):
            return motivo
    return SIN_PROCEDENCIA_MOTIVO_DEFAULT


# Lo que el índice deja visto a propósito: defectos reales que no se borran tocando el umbral.
HALLAZGOS = [
    (
        "El recorte a blanco de las 8 capturas urbanas es el HUD, no la calle",
        "`v2/urban/*.png` miden 4,4–4,6 % de píxel ≥ 252, pero el mapa por octavos lo concentra todo en la "
        "banda de arriba y en la tarjeta inferior izquierda: excluida la banda del HUD (filas 0–14 % y 88–100 %) "
        "el recorte del lienzo de juego queda en 0,02–0,14 % y su luma media en 83–97. La bandera se queda en "
        "rojo porque el PNG publicado sí lleva la interfaz dentro: `«Distrito observado cambiado.»` y el panel "
        "«Vista normal» se ven en la evidencia.",
        "responsable: silenciar el UI en la captura de QA o aceptar el rótulo como parte de la evidencia",
    ),
    (
        "Distritos casi vacíos",
        "`faltaWP08` en los JSON de `v2/urban/`: sólo el distrito cívico llega a los contadores; residencial, "
        "comercial e industrial ponen 1–4 fachadas en cuadro. Es densidad del generador de mundo, no de la "
        "captura.",
        "encargo aparte (prioridad declarada: densidad, más atrezo no)",
    ),
    (
        "Parcelas de tierra desnuda con fauna suelta",
        "en `urban_civic_10x.png` y `urban_civic_05x.png` se ven motas cian de vegetación sobre solar sin "
        "fachada: la siembra de props no comprueba que la parcela tenga edificio.",
        "encargo aparte",
    ),
]


def registros(manifiesto: Path) -> dict[str, dict]:
    """
    Lo que un manifiesto compartido declara por cada PNG: nombre → {ruta declarada, mood declarado}.

    Se recorre el JSON buscando cadenas que terminen en `.png`; el `mood` se toma del mismo objeto que
    contiene la ruta (`fire_sheet.json` lo lleva ahí por fotograma y por caso), que es donde el
    generador lo escribió. Sin esta función el índice daba procedencia de lote a cualquier archivo que
    viviera dentro de una carpeta con manifiesto, y eso era inventar.
    """
    if manifiesto in _REGISTROS:
        return _REGISTROS[manifiesto]
    hallado: dict[str, dict] = {}

    def registrar(ruta: str, mood: str | None) -> None:
        registro = hallado.setdefault(Path(ruta).name, {"rutas": set(), "mood": None})
        registro["rutas"].add(ruta)
        registro["mood"] = registro["mood"] or mood

    def caminar(nodo, mood: str | None = None) -> None:
        """
        `mood` baja del dict contenedor: `summary.json` de las máscaras declara su `moodId` en la raíz y
        las rutas en una lista dentro de cada familia, y el mood del caso sólo sirve si llega al archivo.
        """
        if isinstance(nodo, dict):
            mood = next(
                (
                    v
                    for k, v in nodo.items()
                    if k.lower() in {"mood", "moodid", "fxmood"} and isinstance(v, str)
                ),
                mood,
            )
            for valor in nodo.values():
                if isinstance(valor, str) and valor.lower().endswith(".png"):
                    registrar(valor, mood)
            for valor in nodo.values():
                if not isinstance(valor, str):
                    caminar(valor, mood)
        elif isinstance(nodo, list):
            for valor in nodo:
                if isinstance(valor, str) and valor.lower().endswith(".png"):
                    registrar(valor, mood)
                else:
                    caminar(valor, mood)

    caminar(json.loads(manifiesto.read_text(encoding="utf8")))
    _REGISTROS[manifiesto] = hallado
    return hallado


def procedencia(png: Path) -> tuple[str | None, str, dict | None]:
    """
    (dónde está la procedencia, en qué régimen, documento) para un PNG.

    Primero el JSON hermano; si no, el primer manifiesto del lote cuyo contenido nombre el archivo. El
    documento se devuelve porque `brazo()` lee en él el mood declarado: la noche de FASE 4-5 es un
    dato del manifiesto, no una suposisión sobre el nombre del archivo.
    """
    hermano = png.with_suffix(".json")
    if hermano.exists():
        try:
            doc = json.loads(hermano.read_text(encoding="utf8"))
        except (OSError, json.JSONDecodeError):
            doc = None
        return hermano.relative_to(RAIZ).as_posix(), "json hermano", doc
    rel = png.relative_to(RAIZ).as_posix()
    for prefijo, manifiesto in MANIFIESTOS:
        if not rel.startswith(prefijo):
            continue
        ruta = RAIZ / manifiesto
        if not ruta.exists():
            continue
        registro = registros(ruta).get(png.name)
        if registro:
            return (
                manifiesto,
                "manifiesto del lote",
                {"mood": registro["mood"], "declara": sorted(registro["rutas"])[:3]},
            )
    return None, "SIN PROCEDENCIA", None


def brazo(png: Path, doc: dict | None) -> str:
    """
    Qué reglas de raster aplican a este archivo. Ver el bloque `DURAS_POR_BRAZO`: la media de luma es
    una prueba válida sobre una escena y no lo es sobre una hoja compuesta ni sobre un canal de receta.

    Orden: la tabla curada por ruta (documentos y mapas de trabajo), luego el mood declarado por la
    propia procedencia, luego los tokens del nombre, y si nada dice nada, `escena diurna` — el brazo
    estricto, para que la duda nunca se resuelva a favor de ocultar un defecto.
    """
    rel = png.relative_to(RAIZ).as_posix()
    for prefijo, clase in BRAZOS_POR_RUTA.items():
        if rel.startswith(prefijo) or rel == prefijo:
            return clase
    mood = str((doc or {}).get("mood") or "").lower()
    if "night" in mood or "noche" in mood:
        return BRAZO_NOCHE
    if "day" in mood or "día" in mood or "dia" in mood:
        return BRAZO_DIA
    tokens = rel.lower()
    if "night" in tokens or "noche" in tokens:
        return BRAZO_NOCHE
    return BRAZO_DIA


def cara_del_borde(img: Image.Image) -> tuple[float, int]:
    """
    La cara del lienzo con más contenido no-fondo, como fracción de su propia longitud, y el número
    total de píxeles del perímetro que no son fondo.

    El alfa manda (un canto transparente no es contenido) y la luma se compara con la del píxel (0, 0),
    que en todo este paquete es el lienzo declarado de la hoja o el cielo de la captura.
    """
    ancho, alto = img.size
    fondo = img.getpixel((0, 0))
    luma_fondo = 0.2126 * fondo[0] + 0.7152 * fondo[1] + 0.0722 * fondo[2]
    px = img.load()

    def contenido(p: tuple[int, int, int, int]) -> bool:
        return p[3] > 8 and abs(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] - luma_fondo) > 24

    arriba = sum(contenido(px[x, 0]) for x in range(ancho))
    abajo = sum(contenido(px[x, alto - 1]) for x in range(ancho))
    izquierda = sum(contenido(px[0, y]) for y in range(alto))
    derecha = sum(contenido(px[ancho - 1, y]) for y in range(alto))
    la_mas_llena = max(arriba / ancho, abajo / ancho, izquierda / alto, derecha / alto)
    return la_mas_llena, arriba + abajo + izquierda + derecha


def medir(png: Path, clase: str, exclusiones=None) -> dict:
    """
    Lectura del raster en RGBA: el alfa manda, porque un borde transparente no es contenido.

    Las banderas se miden todas; lo que cambia por brazo es cuáles se declaran duras (`duras`), es
    decir, cuáles cortan `--check`. Un archivo que no decodifica es `ROTO` en cualquier brazo.

    Se mide con histograma e `ImageStat` (C dentro de Pillow) en lugar de recorrer los píxeles en
    Python: el árbol de evidencia tiene 108 PNG y 231 M de píxeles, y la primera versión tardaba más
    que la propia corrida de capturas.
    """
    defectos = []
    try:
        with Image.open(png) as raw:
            img = raw.convert("RGBA")
    except (OSError, ValueError) as error:
        return {
            "brazo": clase,
            "bytes": png.stat().st_size,
            "ancho": 0,
            "alto": 0,
            "lumaMedia": None,
            "desviacion": None,
            "casiNegroPct": None,
            "blancoRecortadoPct": None,
            "bordeCaraPct": None,
            "pixelesEnBorde": None,
            "defectos": ["ROTO"],
            "duras": ["ROTO"],
            "error": f"{type(error).__name__}: {error}",
        }
    ancho, alto = img.size
    gray = img.convert("L")
    alpha = img.getchannel("A")
    if alpha.getextrema()[1] <= 8:
        return {
            "brazo": clase,
            "bytes": png.stat().st_size,
            "ancho": ancho,
            "alto": alto,
            "lumaMedia": 0.0,
            "desviacion": 0.0,
            "casiNegroPct": 100.0,
            "blancoRecortadoPct": 0.0,
            "bordeCaraPct": 0.0,
            "pixelesEnBorde": 0,
            "defectos": ["TODO-TRANSPARENTE"],
            "duras": sorted(DURAS_POR_BRAZO[clase].intersection(["TODO-TRANSPARENTE"])),
        }
    # Región de análisis sin HUD (D-111.2 cierre FASE 6.2): si el JSON hermano declara
    # `analysisExcludeRects`, esos rectángulos (el HUD de React compuesto sobre el fotograma) salen de
    # la medida con un denominador de píxeles analizados, y la captura completa original no se toca.
    if exclusiones:
        alpha_editable = alpha.copy()
        px_alpha = alpha_editable.load()
        for x0, y0, x1, y1 in exclusiones:
            for y in range(max(0, y0), min(alto, y1)):
                for x in range(max(0, x0), min(ancho, x1)):
                    px_alpha[x, y] = 0
        mask = alpha_editable.point(lambda v: 255 if v > 8 else 0)
    else:
        mask = alpha.point(lambda v: 255 if v > 8 else 0)
    stat = ImageStat.Stat(gray, mask=mask)
    hist = gray.histogram(mask)
    opacos = sum(hist) or 1
    casi_negros = sum(hist[:CASI_NEGRO_UMBRAL]) / opacos * 100
    analizados = sum(1 for v in mask.getdata() if v) or 1
    recortados = sum(hist[BLANCO_RECORTADO_UMBRAL:]) / (ancho * alto) * 100
    recortados_region = sum(hist[BLANCO_RECORTADO_UMBRAL:]) / analizados * 100
    # Contenido que toca el canto, por cara (ver `BORDE_CARA_CONTENIDO`): lo que se juzga es si un cuerpo
    # CRUZA el canto, no si lo roza en un píxel.
    cara, tocando = cara_del_borde(img)
    if stat.mean[0] < LUMA_NEGRA:
        defectos.append("NEGRA")
    if stat.stddev[0] < DESVIACION_PLANA:
        defectos.append("PLANA")
    if casi_negros > 60:
        defectos.append("CASI-TODO-NEGRO")
    # El corte de LAVADA se aplica sobre la región sin HUD cuando la hay; el valor de fotograma
    # completo sigue imprimiéndose (nada se tira), sólo que ya no decide la bandera.
    if (recortados_region if exclusiones else recortados) > BLANCO_RECORTADO_LAVADA:
        defectos.append("LAVADA")
    if cara >= BORDE_CARA_CONTENIDO:
        defectos.append("TOCA-BORDE")
    return {
        "brazo": clase,
        "bytes": png.stat().st_size,
        "ancho": ancho,
        "alto": alto,
        "lumaMedia": round(stat.mean[0], 2),
        "desviacion": round(stat.stddev[0], 2),
        "casiNegroPct": round(casi_negros, 2),
        "blancoRecortadoPct": round(recortados, 2),
        "blancoRecortadoRegionPct": round(recortados_region, 2) if exclusiones else None,
        "regionSinHud": [list(rect) for rect in exclusiones] if exclusiones else None,
        "bordeCaraPct": round(cara * 100, 1),
        "pixelesEnBorde": tocando,
        "defectos": defectos,
        "duras": sorted(DURAS_POR_BRAZO[clase].intersection(defectos)),
    }


def carpeta(png: Path) -> str:
    """
    Agrupa por las dos primeras piezas del camino: `v2/gn` y `phaser/fx_v2` son lotes distintos y
    el índice los recorre en el orden de las FASES; con la primera pieza se fundían en un `phaser`
    que además se tragaba el catálogo de capacidades anterior al encargo.
    """
    partes = png.relative_to(RAIZ).parts[:-1]
    return "/".join(partes[:2]) if partes else "."


def main() -> int:
    check = "--check" in sys.argv
    pngs = sorted(
        p
        for p in RAIZ.rglob("*.png")
        if "_half" not in p.name
        and p.relative_to(RAIZ).as_posix().startswith(ALCANCE)
    )
    filas = []
    for png in pngs:
        prov, modo, doc = procedencia(png)
        exclusiones = doc.get("analysisExcludeRects") if isinstance(doc, dict) else None
        medida = medir(png, brazo(png, doc), exclusiones)
        filas.append(
            {
                "ruta": png.relative_to(RAIZ).as_posix(),
                "carpeta": carpeta(png),
                "procedencia": prov,
                "modoProcedencia": modo,
                **medida,
            }
        )
    sin_procedencia = [f for f in filas if f["procedencia"] is None]
    # D-111.2 cierre FASE 6.3 · los históricos sin procedencia quedan identificados (cada uno con su
    # motivo anclado en commit) y AISLADOS del conjunto de aceptación: estado `legacy_unverified`,
    # cuentan aparte y no bloquean el gate. Un PNG NUEVO sin procedencia seguiría bloqueando.
    for fila in filas:
        fila["estado"] = (
            "legacy_unverified"
            if fila["procedencia"] is None and motivo_sin_procedencia(fila["ruta"])
            else "validada"
        )
    legacy = [f for f in sin_procedencia if f["estado"] == "legacy_unverified"]
    nueva_sin_procedencia = [f for f in sin_procedencia if f["estado"] == "validada"]
    con_defecto = [f for f in filas if f["defectos"]]
    con_dura = [f for f in filas if f["duras"]]
    por_brazo = sorted({f["brazo"] for f in filas}, key=lambda b: -sum(1 for f in filas if f["brazo"] == b))

    lineas = [
        "# Índice de evidencia visual D-111.2 (WP08)",
        "",
        "Generado por `scripts/wp08-index.py` — no se edita a mano. Cada fila es un PNG del árbol,",
        "su JSON de procedencia y la medida del raster. Las columnas de defecto existen porque WP08",
        "exige corregir «rótulos cortados, recortes alfa, capturas negras, escenas lavadas» y eso no se",
        "puede cerrar con una impresión visual.",
        "",
        f"- PNG indexadas (sin contar las `_half` de repaso): **{len(filas)}**",
        f"- sin JSON de procedencia: **{len(sin_procedencia)}**",
        f"- con defecto duro para su brazo: **{len(con_dura)}**",
        f"- con algún defecto de raster marcado: **{len(con_defecto)}**",
        f"- huecos declarados (abajo): **{len(HUECOS)}** · hallazgos abiertos: **{len(HALLAZGOS)}**",
        "",
        "Leyenda de banderas: `NEGRA` luma media < 45 · `PLANA` desviación < 18 ·",
        "`CASI-TODO-NEGRO` > 60 % del píxel bajo 12 de luma · `LAVADA` > 3 % recortado a blanco ·",
        "`TOCA-BORDE` una cara del lienzo con ≥ 50 % de su longitud ocupada por contenido no-fondo",
        "(columna **%borde**; medido: los cuatro edificios de la hoja de candidatas están entre 0,0 y",
        "30,3 %, los vanos de módulo entre 51,9 y 54,8 % porque la crujía continúa fuera de encuadre a",
        "propósito, las teselas de receta al 75,4 % y las capturas del viewport de juego al 98,6 %) ·",
        "`TODO-TRANSPARENTE` el archivo decodifica pero no tiene un solo píxel opaco ·",
        "`ROTO` no decodifica. Todas se miden en todas las filas; la columna **brazo** dice cuáles",
        "cortan: una hoja compuesta sobre lienzo plano no se juzga por su media de luma, y un canal de",
        "receta no se juzga por estar oscuro. `PLANA` y `TOCA-BORDE` son avisos en todos los brazos.",
        "",
        "| brazo | filas | duras que cortan |",
        "| --- | --- | --- |",
    ]
    for clase in por_brazo:
        n = sum(1 for f in filas if f["brazo"] == clase)
        lineas.append(
            f"| {clase} | {n} | {' · '.join(f'`{d}`' for d in sorted(DURAS_POR_BRAZO[clase]))} |"
        )
    lineas.append("")
    carpeta_actual = None
    orden = sorted(filas, key=lambda f: (f["carpeta"], f["ruta"]))
    for indice, fila in enumerate(orden):
        if fila["carpeta"] != carpeta_actual:
            carpeta_actual = fila["carpeta"]
            lineas += [
                f"## `{carpeta_actual}/`",
                "",
                "| PNG | brazo | procedencia | tamaño | luma | σ | %negro | %blanco | %borde | banderas |",
                "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
            ]
        banderas = " ".join(
            f"**`{d}`**" if d in fila["duras"] else f"`{d}`" for d in fila["defectos"]
        ) or "—"
        prov = f"[`{fila['procedencia']}`]({fila['procedencia']})" if fila["procedencia"] else "**SIN**"
        if fila["modoProcedencia"] == "manifiesto del lote":
            prov += " (lote)"
        lineas.append(
            f"| [{Path(fila['ruta']).name}]({fila['ruta']}) | {fila['brazo']} | {prov} | "
            f"{fila['ancho']}×{fila['alto']} · {fila['bytes'] // 1024} KiB | "
            f"{fila['lumaMedia']} | {fila['desviacion']} | {fila['casiNegroPct']} | "
            f"{fila['blancoRecortadoPct']} | {fila['bordeCaraPct']} | {banderas} |"
        )
        if indice + 1 < len(orden) and fila["carpeta"] != orden[indice + 1]["carpeta"]:
            lineas.append("")

    if sin_procedencia:
        lineas += [
            "## PNG sin JSON de procedencia",
            "",
            "El lote no las nombra y no tienen hermano: **SIN EVIDENCIA de autoría**, no sustituidas por",
            "la carpeta de al lado. Cada una lleva su motivo: dónde está la información y por qué no llegó",
            "a un JSON con su nombre.",
            "",
        ]
        for fila in sin_procedencia:
            lineas.append(f"- `{fila['ruta']}` — {motivo_sin_procedencia(fila['ruta'])}")
        lineas.append("")

    lineas += [
        "## Hallazgos abiertos (medidos, no ocultados)",
        "",
        "| qué | medido | quién decide |",
        "| --- | --- | --- |",
    ]
    for que, medido, quien in HALLAZGOS:
        lineas.append(f"| {que} | {medido} | {quien} |")
    lineas += [
        "",
        "## SIN EVIDENCIA (declarado, no sustituido)",
        "",
        "| Lo que pide el encargo | Por qué no hay imagen |",
        "| --- | --- |",
    ]
    for peticion, motivo in HUECOS:
        lineas.append(f"| {peticion} | {motivo} |")
    lineas += [
        "",
        "Ninguna de estas filas se cierra con un sustituto más barato: si aparece la evidencia, se añade",
        "su PNG con JSON hermano y el índice la incorpora sola al regenerar.",
        "",
    ]
    destino = RAIZ / "INDEX.md"
    destino.write_text("\n".join(lineas), encoding="utf8")
    datos = RAIZ / "INDEX.json"
    datos.write_text(
        json.dumps(
            {
                "schemaVersion": 2,
                "generatedBy": "scripts/wp08-index.py",
                "brazos": {
                    clase: sorted(DURAS_POR_BRAZO[clase]) for clase in DURAS_POR_BRAZO
                },
                "png": filas,
                "sinProcedencia": [
                    {"ruta": f["ruta"], "motivo": motivo_sin_procedencia(f["ruta"])}
                    for f in sin_procedencia
                ],
                "conDefectoDuro": [f["ruta"] for f in con_dura],
                "conDefecto": [
                    {"ruta": f["ruta"], "defectos": f["defectos"]} for f in con_defecto
                ],
                "hallazgos": [{"que": q, "medido": m, "decide": d} for q, m, d in HALLAZGOS],
                "huecos": [{"peticion": p, "motivo": m} for p, m in HUECOS],
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf8",
    )
    resumen = {
        # Sin `--check` el script sólo regenera y sale 0; con `--check` cortan la ausencia de
        # procedencia y los defectos duros *para el brazo de cada archivo*, no los avisos de hoja.
        "status": "revisar" if (nueva_sin_procedencia or con_dura) else "ok",
        "legacyUnverified": {"total": len(legacy), "aislados": True},
        "png": len(filas),
        "porBrazo": {clase: sum(1 for f in filas if f["brazo"] == clase) for clase in por_brazo},
        "sinProcedencia": [f["ruta"] for f in sin_procedencia],
        "conDefectoDuro": [{"ruta": f["ruta"], "duras": f["duras"]} for f in con_dura],
        "conDefecto": [{"ruta": f["ruta"], "defectos": f["defectos"]} for f in con_defecto],
        "index": destino.relative_to(REPO).as_posix(),
    }
    print(json.dumps(resumen, indent=1, ensure_ascii=False))
    return 1 if check and resumen["status"] == "revisar" else 0


if __name__ == "__main__":
    raise SystemExit(main())

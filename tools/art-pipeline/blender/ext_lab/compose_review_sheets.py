"""D-111 §8 — Hojas de revisión humana a partir de la evidencia suelta del ext_lab.

La evidencia se genera por fotograma (un PNG + JSON por superficie, extensión o brazo). Para
decidir hacen falta comparaciones, no archivos sueltos: este compositor junta los PNG ya
promocionados como hoja y copia en cada pie de foto los números que salen del JSON hermano
(triángulos, texels/m, procedencia), de modo que la imagen y su medición viajen juntas.

No re-renderiza nada: si un PNG falta, la hoja lo declara como `SIN EVIDENCIA` en el pie en vez
de inventarse una muestra (mandato §8.3).

Uso:
    python3 tools/art-pipeline/blender/ext_lab/compose_review_sheets.py [frase-de-la-hoja ...]
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[4]
CAPS = REPO / "docs/art/graphics-capabilities"
EVIDENCE = CAPS / "evidence"
SHEETS = EVIDENCE / "sheets"
PILOTS = EVIDENCE / "pilots"
# D-111.2: la segunda iteración no pisa la baseline. Sus hojas nacen en su propia carpeta y los
# fotogramas que comparan viven en `evidence/v2/<wp>/`, cada uno con su JSON hermano.
V2 = EVIDENCE / "v2"
V2_SHEETS = V2 / "sheets"

BACKGROUND = "#0b1422"
PANEL = "#111d2e"
TITLE = "#f4c44e"
MUTED = "#8fa6c4"


def font(size):
    for name in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "LiberationSans-Regular.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def load_json(png: Path):
    meta = png.with_suffix(".json")
    if not meta.exists():
        return {}
    return json.loads(meta.read_text(encoding="utf8"))


def draw_textlength(text: str, typeface) -> float:
    """Medida de texto sin lienzo: se necesita antes de conocer el alto de la banda del pie."""
    return ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(text, font=typeface)


def placeholder(text: str, width: int = 400, height: int = 300):
    """Hueco declarado: una muestra que no existe se nombra, no se deja en blanco (§8.3)."""
    blank = Image.new("RGBA", (width, height), PANEL)
    ImageDraw.Draw(blank).text((12, 12), text, fill=TITLE, font=font(17))
    return blank


def wrap_caption(caption: str, width: int, typeface, max_lines: int = 4) -> list[str]:
    """El pie se parte en líneas: una decisión recortada a media palabra no es revisable (§9.9).

    `max_lines` es configurable porque el pie de un sprite del Composer lleva siete datos (seed, tri,
    altura, px/m, margen, veredicto de recorte y ejes) y a 0,5× la columna es la mitad de ancha: con el
    tope fijo en 4 se perdía justo la línea que declara qué eje cambió.
    """
    lines: list[str] = []
    for word in caption.split():
        candidate = f"{lines[-1]} {word}" if lines else word
        if lines and draw_textlength(candidate, typeface) > width:
            lines.append(word)
        elif lines:
            lines[-1] = candidate
        else:
            lines.append(word)
    # Un token más ancho que la columna invadiría el panel vecino: ése sí se recorta.
    wrapped = []
    for line in lines[:max_lines]:
        while line and draw_textlength(line, typeface) > width:
            line = line[:-1]
        wrapped.append(line)
    return wrapped


def panel(png: Path, caption: str, max_height: int, big: int = 15, upscale: bool = False, max_lines: int = 4):
    """Un recuadro de la hoja: imagen escalada + pie de foto con los números del JSON hermano.

    `upscale` es para la evidencia de componente (un módulo suelto de 549 px sería ilegible al lado
    de un sprite de 1487 px); los sprites de edificio nunca se agrandan, porque su lectura obligatoria
    es la escala nativa de juego.
    """
    image = Image.open(png).convert("RGBA")
    scale = max_height / image.size[1] if upscale else min(1.0, max_height / image.size[1])
    size = (max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale)))
    resized = image.resize(size, Image.LANCZOS)
    typeface = font(big)
    ascent, descent = typeface.getmetrics()
    line_height = ascent + descent
    lines = wrap_caption(caption, size[0] - 14, typeface, max_lines)
    band = 6 + len(lines) * line_height + 4
    canvas = Image.new("RGBA", (size[0], size[1] + band), BACKGROUND)
    canvas.paste(resized, (0, 0), resized)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, size[1], size[0], size[1] + band - 1), fill=PANEL)
    for index, line in enumerate(lines):
        draw.text((8, size[1] + 5 + index * line_height), line, fill=TITLE, font=typeface)
    return canvas


def sheet(path: Path, title: str, subtitle: str, panels: list[Image.Image], columns: int):
    """Rejilla de paneles con cabecera. El ancho de columna lo fija el panel más ancho."""
    rows = (len(panels) + columns - 1) // columns
    row_heights = []
    for row in range(rows):
        group = panels[row * columns : (row + 1) * columns]
        row_heights.append(max(p.size[1] for p in group))
    panel_width = max(p.size[0] for p in panels)
    header = 74
    # La cabecera no puede recortarse: si es más ancha que la rejilla, se ensanchan las columnas.
    header_width = max(draw_textlength(title, font(24)), draw_textlength(subtitle, font(14))) + 32
    panel_width = max(panel_width, int(-(-header_width // columns)))
    height = header + sum(row_heights) + (rows - 1) * 16
    canvas = Image.new("RGB", (columns * panel_width + 16, height), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 14), title, fill=TITLE, font=font(24))
    draw.text((16, 46), subtitle, fill=MUTED, font=font(14))
    y = header
    for row in range(rows):
        group = panels[row * columns : (row + 1) * columns]
        for index, panel_image in enumerate(group):
            canvas.paste(panel_image, (16 + index * panel_width, y), panel_image)
        y += row_heights[row] + 16
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    return canvas.size


def materials_sheet():
    """§8.4: control procedural / Poly Haven / Kenney sobre geometría idéntica."""
    surfaces = json.loads((EVIDENCE / "materials/summary.json").read_text(encoding="utf8"))["surfaces"]
    decisions = {
        entry["id"]: entry
        for entry in json.loads((CAPS / "material-decisions.json").read_text(encoding="utf8"))["surfaces"]
    }
    short = {
        "kenney": "A Kenney",
        "polyhaven": "B PolyHaven",
        "civic": "C control",
        "graphic": "C control",
    }
    verdict = {
        "approved_for_candidate": "candidato",
        "restricted_use": "restringido",
        "rejected_for_style": "rechazado por estilo",
        "no_candidate": "sin pieza en el pack",
    }
    panels = []
    for entry in surfaces:
        png = Path(entry["png"])
        if not png.is_absolute():
            png = REPO / png
        if not png.exists():
            continue
        ext = load_json(png).get("extension", {})
        # `armOrder` admite el id corto y el nombre largo del registro de material.
        order = [next((label for key, label in short.items() if arm.startswith(key)), arm) for arm in ext.get("armOrder", [])]
        decided = decisions.get(entry["id"], {})
        call = []
        for key, label in (("kenney", "Kenney"), ("polyhaven", "PolyHaven")):
            arm = decided.get(key)
            # `no_candidate` ya se ve en el panel: ese brazo no está dibujado, no hace falta nombrarlo.
            if arm and arm.get("verdict") != "no_candidate":
                call.append(f"{label}={verdict.get(arm['verdict'], arm['verdict'])}")
        caption = f"{entry['id']} · izq→der {' | '.join(order)}"
        if call:
            caption += " · §5: " + " ".join(call)
        panels.append(panel(png, caption, max_height=430))
    return sheet(
        SHEETS / "materials_sheet.png",
        "D-111 §8.4 · Materiales: Kenney Retro Textures Fantasy vs Poly Haven vs control Graphic Civic",
        "Cupón idéntico por brazo (muro + zócalo + marco), UV métrico, cámara y luz del pipeline, mood day_civic. "
        "Los brazos ausentes no se dibujan: el orden izquierda→derecha está en el pie de cada hoja.",
        panels,
        columns=4,
    )


def extensions_sheet():
    """§8.3: HiFi Architecture Builder / Arch Generator / Archimesh."""
    targets = [
        ("hifi_facade", "HiFi Architecture Builder"),
        ("archgen_sections", "Arch Generator"),
        ("archimesh_parts", "Archimesh"),
    ]
    panels = []
    for stem, name in targets:
        png = EVIDENCE / "extensions" / f"{stem}.png"
        if not png.exists():
            blank = Image.new("RGBA", (400, 300), PANEL)
            ImageDraw.Draw(blank).text((12, 12), f"{name} · SIN EVIDENCIA", fill=TITLE, font=font(18))
            panels.append(blank)
            continue
        meta = load_json(png)
        ext = meta.get("extension", {})
        triangles = meta.get("geometry", {}).get("triangles")
        caption = f"{name} v{ext.get('version','?')} · {ext.get('license','?')} · {triangles} tri"
        panels.append(panel(png, caption, max_height=430))
    return sheet(
        SHEETS / "extensions_sheet.png",
        "D-111 §8.3 · Extensiones arquitectónicas de Blender (instalación aislada, headless)",
        "Cada hoja es un fotograma real generado por la extensión. Los triángulos son del render de evidencia, "
        "no del modelo fuente; el presupuesto de sprite del juego es D-100/D-102.",
        panels,
        columns=3,
    )


def geometry_nodes_sheet():
    """§8.2: fachada Composer actual vs fachada enriquecida con Geometry Nodes, a escala real."""
    pairs = [
        ("mixed_tenement A (control)", PILOTS / "mixed_tenement-control.png"),
        ("mixed_tenement B (Geometry Nodes)", PILOTS / "mixed_tenement-candidata.png"),
    ]
    panels = []
    for caption, png in pairs:
        if not png.exists():
            panels.append(placeholder(f"{caption} · SIN EVIDENCIA"))
            continue
        meta = load_json(png)
        triangles = meta.get("triangleCount")
        envelope = meta.get("envelopeMeters", {}).get("z")
        framing = meta.get("framing", {})
        pixels_per_meter = framing.get("pixelsPerMeter")
        panels.append(
            panel(
                png,
                f"{caption} · {triangles} tri · h {envelope} m · {pixels_per_meter} px/m",
                max_height=1360,
                big=30,
            )
        )
    return sheet(
        SHEETS / "gn_facade_ab.png",
        "D-111 §8.2 · Fachada: Composer actual vs Geometry Nodes (misma parcela, pisos, cámara, luz y mood)",
        "Pegado a escala nativa: ambos a 60.2 px/m, así que el tamaño relativo es el real de juego. "
        "Diferencia declarada en axisChoices.facade; el resto de ejes es idéntico.",
        panels,
        columns=2,
    )


def crop_margins(meta: dict) -> tuple[int, int, int, int] | None:
    """Márgenes de recorte alfa reales (L, T, R, B) del sprite sobre el lienzo renderizado.

    `trim.cropped` es la caja de píxeles opacos. Si coincide con el ancho o el alto de
    `trim.rendered`, el contenido tocó el borde del lienzo y **no se puede saber** si lo que había
    fuera se cortó: es el defecto que D-111.1 registró como limitación 3 del A/B de Geometry Nodes.
    WP01 lo vuelve una medida, no una impresión visual.
    """
    trim = meta.get("trim") or {}
    rendered, cropped = trim.get("rendered"), trim.get("cropped")
    if not rendered or not cropped:
        return None
    return (
        cropped["offsetX"],
        cropped["offsetY"],
        rendered["width"] - cropped["offsetX"] - cropped["width"],
        rendered["height"] - cropped["offsetY"] - cropped["height"],
    )


def geometry_border_hit(png: Path, threshold: int = 200) -> tuple[int, int, int, int] | None:
    """Píxeles de geometría opaca (alfa >= `threshold`) que tocan cada borde del sprite final.

    Hay que distinguir dos cortes que el JSON hermano no separa. La caja que mide `trim` incluye
    la sombra proyectada, y una sombra suave que llega al borde del lienzo no invalida un sprite;
    lo que lo invalida es que la alfa sólida lo haga, porque entonces falta un trozo de edificio
    y su tamaño real es desconocido. WP01 exige "el sprite no esté recortado", así que se comprueba
    sobre el PNG entregado, no sobre la estimación del encuadre.
    """
    with Image.open(png) as im:
        alpha = im.convert("L")
    w, h = alpha.size
    solid = alpha.point(lambda a: 255 if a >= threshold else 0).load()
    return (
        sum(1 for y in range(h) if solid[0, y]),
        sum(1 for x in range(w) if solid[x, 0]),
        sum(1 for y in range(h) if solid[w - 1, y]),
        sum(1 for x in range(w) if solid[x, h - 1]),
    )


def crop_verdict(meta: dict, png: Path | None = None) -> str:
    """Veredicto de recorte: primero la geometría (la que ve el jugador), luego la sombra."""
    margins = crop_margins(meta)
    hits = geometry_border_hit(png) if png is not None and png.exists() else None
    if hits is None:
        return "recorte sin medir" if margins is None else (
            "geometría sin medir · márgenes de lienzo " + "/".join(str(m) for m in margins) + " px"
        )
    cut = [side for side, value in zip(("izq", "sup", "der", "inf"), hits) if value > 0]
    if cut:
        return "GEOMETRÍA RECORTADA por " + ",".join(cut) + f" ({hits} px sólidos en el borde)"
    if margins is None:
        return "geometría íntegra · márgenes de lienzo sin medir"
    shadow_cut = [side for side, value in zip(("izq", "sup", "der", "inf"), margins) if value <= 0]
    if shadow_cut:
        return (
            "geometría íntegra · sombra recortada por " + ",".join(shadow_cut) + " · márgenes "
            + "/".join(str(m) for m in margins) + " px"
        )
    return "SIN CORTE · márgenes " + "/".join(str(m) for m in margins) + " px"


def framing_note(meta: dict, png: Path | None = None) -> str:
    """Pie de un sprite del Composer: geometría, encuadre derivado y veredicto del recorte."""
    framing = meta.get("framing", {})
    axes = meta.get("axisChoices", {})
    return (
        f"seed {meta.get('variantSeed')} · {meta.get('triangleCount')} tri · "
        f"h {meta.get('envelopeMeters', {}).get('z')} m · "
        f"{framing.get('pixelsPerMeter')} px/m · margen {framing.get('marginUsed')} · "
        f"{crop_verdict(meta, png)} · "
        f"fachada {axes.get('facade', '-')} · ritmo {axes.get('bay_sequence', '-')} · "
        f"receta {axes.get('recipe', '-')}"
    )


def v2_panel(folder: str, stem: str, caption: str, max_height: int, big: int = 22):
    """Un fotograma de `evidence/v2/<folder>/` con su pie leído del JSON hermano (§8.3)."""
    png = V2 / folder / f"{stem}.png"
    if not png.exists():
        return placeholder(f"{caption} · SIN EVIDENCIA", 460, 320)
    return panel(
        png, f"{caption} · {framing_note(load_json(png), png)}", max_height=max_height, big=big, max_lines=7
    )


def v2_sheet(
    path_stem: Path,
    title: str,
    subtitle: str,
    rows: list[tuple[str, str, str]],
    columns: int = 2,
    height: int = 980,
):
    """Hoja WP con sus dos lecturas obligatorias: 1x y 0,5x (escala de juego).

    `rows` son tripletas (carpeta, raiz-del-archivo, pie). La variante `_half` no es un zoom out
    del PNG final: se redibuja con los sprites a la mitad de píxeles y el pie a tamaño legible,
    porque lo que hay que juzgar es si la mejora sobrevive a la escala real del juego.
    """
    def build(scale: float, out_path: Path):
        panels = []
        for folder, stem, label in rows:
            panels.append(v2_panel(folder, f"{stem}-control", f"{stem} · {label} · control", round(height * scale)))
            panels.append(v2_panel(folder, f"{stem}-candidata", f"{stem} · {label} · candidata", round(height * scale)))
        return sheet(out_path, title, subtitle, panels, columns=columns)

    first = build(1.0, path_stem.with_suffix(".png"))
    second = build(0.5, path_stem.parent / f"{path_stem.name}_half.png")
    return first, second


def gn_v2_sheet():
    """WP01: las fábricas GN corregidas (paleta derivada, bandas a 3 m/1 m) contra su control."""
    rows = (
        ("commercial", "mixed_tenement", "comercio abajo + viviendas arriba (crujía, cornisa, puerta-balcón)"),
        ("residential", "row_house", "adosado con zócalo de sillar (crujía, zócalo, cornisa)"),
    )
    return v2_sheet(
        V2_SHEETS / "gn_v2_ab",
        "D-111.2 WP01 · Geometry Nodes v2: misma parcela, mismos pisos, misma semilla, misma luz",
        "Correcciones declaradas: los colores de las fábricas GN se derivan del atlas licenciado con "
        "`ext_lab/gn_palette.py` (ya no se eligen a mano), el zócalo rellena los 3 m de la banda que "
        "sustituye y la cornisa vuelve a medir 1 m con piedra del atlas en vez de casi blanco. "
        "Eje a eje, control y candidata son idénticos (medido sin Blender con `ext_lab/axis_probe.py`): "
        "lo único que cambia es qué módulo resuelve cada rol. El pie mide dos cortes distintos sobre el "
        "PNG entregado: la geometría opaca (alfa>=200) y la caja de sombra del lienzo.",
        rows,
    )


def ag_module_note(png: Path) -> str:
    """Pie de un fotograma de horneado Arch Generator: geometría medida, cámara y procedencia."""
    meta = load_json(png)
    geo = meta.get("geometry", {})
    bounds = geo.get("bounds", {}).get("size", [0, 0, 0])
    ext = meta.get("extension", {})
    cam = meta.get("camera", {})
    trim = meta.get("render", {}).get("trim", {})
    final = trim.get("final", {})
    return (
        f"{geo.get('triangles', '?')} tri en {geo.get('meshObjects', '?')} objetos · "
        f"caja {bounds[0]}×{bounds[1]}×{bounds[2]} m · ortogonal az {cam.get('azimuthDegrees')}° "
        f"escala {round(cam.get('orthoScale', 0), 2)} · sprite {final.get('width')}×{final.get('height')} px · "
        f"{ext.get('registry_id', '-')} v{ext.get('version', '?')} ({ext.get('license', '?')})"
    )


def ag_civic_sheet():
    """WP02: el vano cívico horneado, su brazo de calidad y el A/B del town_hall a escala de juego."""
    module = V2 / "ag/ag_arcade_bay_2m.png"
    quality = V2 / "ag/quality_ab.png"
    title = (
        "D-111.2 WP02 · Arch Generator como autoría cívica: vano de arcada horneado a la crujía del Composer"
    )
    subtitle = (
        "Arriba, el componente; abajo, el mismo town_hall seed 2, misma parcela, mismos pisos, misma luz: "
        "sólo cambia el módulo que resuelve el rol `window_bay` (21 colocaciones 1:1, ejes idénticos). "
        "El sprite se pega a escala nativa (60,2 px/m en ambos brazos). La lectura al 50 % se aplica a los "
        "sprites de edificio, que son los que entran en pantalla; el componente no es un artefacto de juego."
    )

    def build(sprite_height: int, out_path: Path):
        rows = [
            panel(
                module,
                "A · módulo horneado tileado 3× (5430 tri = 3×1810) · paso de crujía 2,00 m: "
                "las juntas reconstruyen UN pilar por eje, no dos. " + ag_module_note(module),
                max_height=560,
                big=17,
                upscale=True,
            )
            if module.exists()
            else placeholder("A · módulo horneado · SIN EVIDENCIA", 460, 320),
            panel(
                quality,
                "B · brazo de calidad: high 1810 tri vs simplified 938 tri. La simplificación ahorra "
                "un 48 % pero pierde el estriado del fuste y el óvolo del capitel, que es lo que hace "
                "que el vano se lea a 0,5×. Se adopta high y se registra el alternativo.",
                max_height=560,
                big=17,
            )
            if quality.exists()
            else placeholder("B · brazo de calidad · SIN EVIDENCIA", 460, 320),
            v2_panel("civic", "town_hall-control", "town_hall · control Graphic Civic", sprite_height),
            v2_panel("civic", "town_hall-candidata", "town_hall · candidata arcada AG", sprite_height),
        ]
        return sheet(out_path, title, subtitle, rows, columns=2)

    first = build(980, V2_SHEETS / "ag_civic_ab.png")
    second = build(490, V2_SHEETS / "ag_civic_ab_half.png")
    return first, second


def text_panel(heading: str, lines: list[str], width: int, big: int = 17,
               body: int = 15) -> Image.Image:
    """Panel de texto para lo que no es una imagen: la decisión tomada sobre lo fotografiado.

    Una hoja de revisión humana que sólo muestra muestras obliga a leer otro archivo para saber qué
    se decidió con ellas. El pie de foto tiene poco espacio, así que el veredicto va en su propio
    panel, dentro de la misma rejilla.

    El alto se deriva del texto, no se fija: un veredicto que no cabe es un veredicto no entregado.
    El ancho sí es fijo y no depende de la escala de la hoja, porque la lectura al 50 % reduce los
    sprites (que son los que entran en pantalla) pero la letra de una decisión nunca se encoge.
    """
    typeface, small = font(big), font(body)
    ascent, descent = small.getmetrics()
    line_height = ascent + descent
    wrapped = [entry for source in lines for entry in wrap_caption(source, width - 28, small, max_lines=40)]
    canvas = Image.new("RGBA", (width, 12 + big + 18 + len(wrapped) * (line_height + 4) + 8), PANEL)
    draw = ImageDraw.Draw(canvas)
    draw.text((14, 12), heading, fill=TITLE, font=typeface)
    y = 12 + big + 18
    for entry in wrapped:
        draw.text((14, y), entry, fill=MUTED, font=small)
        y += line_height + 4
    return canvas


def ext_module_note(png: Path) -> str:
    """Pie de un brazo horneado: la caja del MÓDULO (no la de la escena) y su procedencia.

    `geometry` del JSON de evidencia es el bounding de toda la escena, incluidos los Empty de
    control que dejan las extensiones: por eso un módulo de 3,00 m aparece con 3,95 m de alto en el
    fotograma. La caja que hay que citar es la que midió el adaptador sobre el lote exportado.
    """
    meta = load_json(png)
    module = (meta.get("generated") or {}).get("measured") or {}
    bounds = module.get("bounds") or {}
    axis = lambda name: bounds.get(name) or [0, 0]
    span = lambda name: round(axis(name)[1] - axis(name)[0], 3)
    box = lambda name: f"[{axis(name)[0]};{axis(name)[1]}]"
    ext = meta.get("extension") or {}
    cam = meta.get("camera") or {}
    final = (meta.get("render") or {}).get("trim", {}).get("final", {})
    seat = (meta.get("generated") or {}).get("seating") or {}
    back = (meta.get("generated") or {}).get("backing") or {}
    relief = (f" · relieve +{seat.get('projectedFrontMeters')} m antes de cortar "
              f"(paño en {back.get('wallFrontMeters')} m)"
              if seat.get("projectedFrontMeters") is not None else "")
    # Lo que decide el descarte es si la pieza CABE, así que el pie muestra el balance del corte:
    # triángulos pedidos contra triángulos entregados dentro de la caja canónica.
    cut = (meta.get("generated") or {}).get("cutAudit") or {}
    cut_note = (f" · corte {cut.get('trianglesRequested')}->{cut.get('trianglesSurviving')} tri "
                f"(limite +{cut.get('frontLimitMeters')} m)" if cut else "")
    return (
        f"modulo {module.get('triangles', '?')} tri / {module.get('vertices', '?')} vert · "
        f"caja {span('x')}x{span('y')}x{span('z')} m (x{box('x')} y{box('y')} z{box('z')}){relief}"
        f"{cut_note} · "
        f"{ext.get('registry_id') or ext.get('moduleId') or '-'} v{ext.get('version', '-')} "
        f"({ext.get('license', '-')}) · ortogonal az {cam.get('azimuthDegrees')}° "
        f"escala {round(cam.get('orthoScale') or 0, 2)} · fotograma {final.get('width')}×{final.get('height')} px"
    )


def hifi_audit_note(png: Path) -> str:
    """Pie de una muestra HiFi: los desvíos medidos contra la retícula del Composer.

    La última cifra no sale del `gridAudit` sino de los tramos de barandilla ya muestreados: un
    balcón de 1,60 m no tiene por qué caer sobre una junta, lo que tiene que hacer es quedar
    centrado en SU crujía. Medir sus balaustres contra la junta devolvía 1,00 m de "desvío" que
    era un artefacto del indicador, no un defecto de la fachada.
    """
    meta = load_json(png)
    ext = meta.get("extension") or {}
    generated = meta.get("generated") or {}
    audit = generated.get("gridAudit") or {}
    posts = audit.get("balustradePosts") or {}
    rail = audit.get("balconyRailPosts") or {}
    spacing = posts.get("spacingMeters") or {}
    rail_spacing = rail.get("spacingMeters") or {}
    bay = audit.get("bayMeters") or 2.0
    rails = [(s["firstX"] + s["lastX"]) / 2.0 for s in rail.get("samples", [])]
    rail_off = min((abs(((r + bay / 2.0) % bay) - bay / 2.0) for r in rails), default=None)
    railings = (
        f"barandillas {rail.get('posts', 0)} postes en {rail.get('railings', 0)} tramos de paso "
        f"{rail_spacing.get('min', '?')} m, cada tramo centrado en su crucia con desvio max "
        f"{round(rail_off, 4) if rail_off is not None else '-'} m"
        if rail.get("posts")
        else "sin barandillas de balcon"
    )
    return (
        f"{meta.get('geometry', {}).get('triangles', '?')} tri en {meta.get('geometry', {}).get('meshObjects', '?')} "
        f"objetos · receta {ext.get('layout', '-')} · materiales {ext.get('materials', '-')} · "
        f"{ext.get('generatorCalls', '?')} llamadas a la extension + {len(generated.get('labFiller') or [])} piezas "
        f"de laboratorio que HiFi no genera · "
        f"{audit.get('openingsAudited', '?')} huecos: desvio max al centro de crucia "
        f"{audit.get('maxOpeningOffsetFromBayCenterMeters', '?')} m · "
        f"{audit.get('bandLinesAudited', '?')} lineas de banda: desvio max "
        f"{audit.get('maxLineOffsetFromBandMeters', '?')} m · desvio max cota construida vs pedida "
        f"{audit.get('maxOpeningDeviationFromDeclaredMeters', '?')} m · "
        f"balaustrada {posts.get('posts', 0)} postes sobre las juntas (paso {spacing.get('min', '?')}-"
        f"{spacing.get('max', '?')} m, desvio max {posts.get('maxOffsetFromJointMeters', '?')} m) · "
        f"{railings}"
    )


def ext_window_columns_sheet():
    """WP03: control, HiFi y Archimesh resolviendo el MISMO vano de ventana de 2×3 m."""
    folder = V2 / "ext"

    def arm(stem: str, caption: str, height: int):
        png = folder / f"{stem}.png"
        if not png.exists():
            return placeholder(f"{caption} · SIN EVIDENCIA", 460, 320)
        return panel(png, f"{caption} · {ext_module_note(png)}", max_height=height, big=16,
                     upscale=True, max_lines=14)

    decision = [
        "NINGUNO de los dos vanos se adopta como modulo del Catalogo. Motivos medidos:",
        "HiFi: WINDOW_FLAT expone 5 propiedades (ancho, alto, profundidad, grosor de marco y cota "
        "de base) y ninguna divide el hueco, asi que el vano sale sin montantes ni travesero. El "
        "control GN resuelve marco con retranqueo, 2 montantes, travesero, alféizar con retorno y "
        "dintel en 216 tri; HiFi necesita 5 llamadas (marco + alféizar + dintel + 2 pilastras) para "
        "una caja de 98 tri en la que el hueco sigue siendo un agujero unico. Y la pilastra no es "
        "tal: PILLAR genera una columna exenta de 0,34x0,34 cuyo relieve llega a +0,37 m (0,42 m por "
        "delante de la cara del pano), asi que en fachada se lee como soporte suelto, no como "
        "retranqueo.",
        "Archimesh: si divide el hueco (genera Window.L y Window.R con su manija) y si aporta moldura "
        "perimetral y alféizar volado, pero la carpinteria queda DENTRO del paño. El paño canonico mide "
        "0,10 m (y entre -0,15 y -0,05) y el lote es un componente de 0,54 m de fondo pensado para muro "
        "de obra: asentado por detras, sus hojas caen en y=-0,105 y -0,055 y las manijas en -0,146 y "
        "-0,097, todas por detras de la cara del paño, asi que en el fotograma el hueco sale con color "
        "de ladrillo. Nada que ver con el tamano: a 120 px de crujia (2 m x 60,2 px/m) el detalle no se "
        "veria igual, pero es que ademas esta oculto por construccion. Y cuesta 1358 tri (6,3x el "
        "control), 912 de ellos (61%) en las dos manijas. El preset no ayuda: high (model 2, frame 0,09) "
        "y simplified (model 1, frame 0,07) generan el MISMO lote de 1488 tri con las mismas cotas; lo "
        "unico que cambia es el decimate (1346 -> 610).",
        "LO QUE SI SE QUEDA DE WP03: (1) el adaptador ext_module_bake.py, que normaliza la salida de "
        "cualquier extension a la caja canonica (crujia 2 m, banda 3 m, y [-0,15; +0,35]) con asiento "
        "medido, corte a junta y brazo decimado, y sobre todo su cutAudit: triangulos pedidos contra "
        "triangulos entregados, que es la prueba de que un componente no cabe (HiFi 80 -> 72, "
        "Archimesh 1488 -> 1346); (2) la receta de fachada HiFi sobre reticula, que es lo que se podra "
        "usar en WP06; (3) la tecnica de barandilla: BALCONY no genera balaustres, pero FENCE si, y se "
        "apoya en la cota medida del forjado.",
    ]

    def build(height: int, out_path: Path):
        panels = [
            arm("control_gn_window_bay",
                "A · CONTROL GN mod_gn_window_bay_2m: marco con retranqueo, 2 montantes, travesero, "
                "alféizar con retorno y dintel", height),
            arm("hifi_window_bay_2m_high",
                "B · HiFi high: marco en relieve + alféizar + dintel + pilastras en las juntas; "
                "hueco sin dividir", height),
            arm("archimesh_window_bay_2m_high",
                "C · Archimesh high: moldura perimetral, hoja partida con manija y alféizar volado; "
                "las hojas y las manijas quedan dentro del paño, el hueco sale con color de ladrillo",
                height),
            arm("hifi_window_bay_2m_simplified",
                "D · HiFi simplified (decimate 0,45): el marco se colapsa y las pilastras quedan "
                "como aletas sueltas - la simplificacion no es admisible aqui", height),
            arm("archimesh_window_bay_2m_simplified",
                "E · Archimesh simplified (decimate 0,45): sin perdida visible a esta escala; el "
                "bake con decimador SI es una via util para otras piezas", height),
            text_panel("WP03 · decision por herramienta", decision, width=560),
        ]
        return sheet(out_path, title, subtitle, panels, columns=3)

    title = (
        "D-111.2 WP03 · Componente de ventana: control Geometry Nodes vs HiFi vs Archimesh, "
        "misma crujía de 2 m y misma banda de 3 m"
    )
    subtitle = (
        "Los tres brazos se hornean con el mismo adaptador, dentro de la misma caja canónica "
        "(y ∈ [-0,15; +0,35]), con los buckets del atlas que usan WP01/WP02 -el adaptador pinta por rol "
        "y sólo pone metal en las manijas de Archimesh- y la misma cámara ortogonal (az 225°, escala "
        "8,6), y se tilean tres veces para juzgar la junta. La comparación es geométrica y se cierra "
        "con números medidos: qué cota y alcanza cada pieza, cuántos triángulos pide y cuántos le "
        "sobreviven al corte a la caja canónica, y qué queda realmente por delante de la cara del paño."
    )
    first = build(560, V2_SHEETS / "ext_window_columns.png")
    second = build(280, V2_SHEETS / "ext_window_columns_half.png")
    return first, second


def hifi_grid_sheet():
    """WP03: la receta libre del laboratorio contra la receta montada sobre la retícula del Composer."""
    folder = V2 / "hifi"

    def arm(stem: str, caption: str, height: int):
        png = folder / f"{stem}.png"
        if not png.exists():
            return placeholder(f"{caption} · SIN EVIDENCIA", 460, 320)
        return panel(png, f"{caption} · {hifi_audit_note(png)}", max_height=height, big=16, max_lines=14)

    def build(height: int, out_path: Path):
        panels = [
            arm("hifi_facade_free",
                "A · receta libre (la que habia): huecos en x = -5,3 / 0 / 5,3 y plantas en "
                "z = 0,55 + 3k. No es traducible a modulos", height),
            arm("hifi_facade_grid",
                "B · receta sobre reticula: 9 crucias x 3 bandas, hueco 1,05x1,45 en el centro de "
                "cada crucia y lineas de forjado exactas", height),
        ]
        return sheet(out_path, title, subtitle, panels, columns=2)

    title = (
        "D-111.2 WP03 · HiFi Architecture Builder: muestra de fachada residencial/comercial coherente "
        "con la retícula de Landlord"
    )
    subtitle = (
        "Misma extensión, misma luz, misma cámara ortogonal (escala 23,6 · target 5,4) y los mismos "
        "materiales del atlas; lo único que cambia es la receta. `gridAudit` no declara la coherencia, "
        "la mide sobre la geometría construida: cada hueco auditado contra el centro de crujía más "
        "cercano y cada línea de forjado contra la banda de 3,00 m. Los postes de la balaustrada se "
        "miden uno a uno contra las juntas."
    )
    first = build(760, V2_SHEETS / "hifi_grid_ab.png")
    second = build(380, V2_SHEETS / "hifi_grid_ab_half.png")
    return first, second


def pilots_sheet():
    """§8.1: control y candidata por familia piloto, mismo encuadre y mismo seed."""
    pairs = [
        ("row_house", PILOTS / "row_house-control.png", PILOTS / "row_house-candidata.png"),
        ("mixed_tenement", PILOTS / "mixed_tenement-control.png", PILOTS / "mixed_tenement-candidata.png"),
        ("warehouse", PILOTS / "warehouse-control.png", None),
        ("town_hall", PILOTS / "town_hall-control.png", None),
    ]
    # Familias donde el Composer cortó la candidata antes del render: se muestra el hueco con su
    # motivo, no un espacio en blanco que parece un fallo del compositor (§6, evaluations/pilots.md).
    blocked = {
        "warehouse": "SIN CANDIDATA · GrammarError: GN es residential_low",
        "town_hall": "SIN CANDIDATA · GrammarError: GN es residential_low",
    }
    panels = []
    for family, ctl_png, cnd_png in pairs:
        for arm, png in (("control", ctl_png), ("candidata", cnd_png)):
            if png is None or not png.exists():
                if arm == "candidata" and family in blocked:
                    panels.append(placeholder(f"{family} · {blocked[family]}", 420, 300))
                else:
                    panels.append(placeholder(f"{family} · {arm} · SIN EVIDENCIA", 420, 300))
                continue
            meta = load_json(png)
            axes = meta.get("axisChoices", {})
            panels.append(
                panel(
                    png,
                    f"{family} · {arm} · {meta.get('triangleCount')} tri · fachada {axes.get('facade', '-')}",
                    max_height=560,
                )
            )
    return sheet(
        SHEETS / "pilots_sheet.png",
        "D-111 §8.1 · Cuatro familias piloto: control vs candidata con módulos Geometry Nodes",
        "Mismo seed, mismo mood day_civic, misma huella y pisos. Los sprites se pegan a escala nativa: "
        "los px/m son los del propio framing del candidato, así que el tamaño relativo es el real de juego.",
        panels,
        columns=4,
    )


def _phaser_costs():
    """p95 y contadores por caso, leídos del JSON que escribió el propio arnés (§7.6)."""
    perf = EVIDENCE / "phaser/fx-lab-perf.json"
    if not perf.exists():
        return {}
    data = json.loads(perf.read_text(encoding="utf8"))
    return {row["label"]: row for row in data.get("rows", [])}


def case_to_label(case: str) -> str:
    """El arnés guarda la medición on/off con la etiqueta del eje, no con el nombre del PNG."""
    if case == "degrade_canvas_all_effects":
        return "canvas-todos"
    if case.endswith("_control"):
        return "control"
    if case.endswith("_all_effects"):
        return "todos"
    return case.removeprefix("street_day_").removeprefix("street_night_")


def phaser_sheet():
    """§8.5: la misma calle de QA con y sin cada familia de efectos, de día y de noche."""
    rows = _phaser_costs()
    cases = [
        ("street_day_control", "día · control"),
        ("street_day_grading", "color grading"),
        ("street_day_bloomThreshold", "bloom por umbral"),
        ("street_day_bloomObjects", "bloom por objeto"),
        ("street_day_lighting", "luz dinámica"),
        ("street_day_lightingNormals", "luz + normales"),
        ("street_day_particles", "partículas"),
        ("street_day_all_effects", "día · todo"),
        ("street_night_control", "noche · control"),
        ("street_night_lighting", "noche · luz"),
        ("street_night_lightingNormals", "noche · luz + normales"),
        ("street_night_bloomObjects", "noche · bloom objeto"),
        ("street_night_particles", "noche · partículas"),
        ("street_night_all_effects", "noche · todo"),
        ("street_day_zoom_050x", "día · zoom 0,5× (legibilidad)"),
        ("degrade_canvas_all_effects", "CANVAS · todo"),
    ]
    panels = []
    for case, label in cases:
        png = EVIDENCE / "phaser" / f"{case}.png"
        if not png.exists():
            panels.append(placeholder(f"{label} · SIN EVIDENCIA", 620, 260))
            continue
        # La tabla on/off se midió de día (y en CANVAS): a las de noche no se les puede prestar su p95.
        measured = not case.startswith("street_night_")
        row = rows.get(case_to_label(case), {}) if measured else {}
        p95 = (row.get("stats") or {}).get("frameTimeP95Ms")
        panels.append(
            panel(
                png,
                f"{label} · p95 {p95 if p95 is not None else '—'} ms" if p95 is not None else label,
                max_height=270,
            )
        )
    return sheet(
        SHEETS / "phaser_sheet.png",
        "D-111 §8.5 · Phaser 4.2.1: una sola calle isométrica, un efecto cada vez",
        "Misma escena, misma semilla de colocación; los píxeles que cambian son del efecto nombrado. "
        "p95 medido en la ventana móvil de 180 frames sobre WebGL/SwiftShader (sin GPU: valores absolutos "
        "no comparables a un equipo con aceleración; el orden relativo sí). Abajo, el mismo lote forzado a "
        "renderer CANVAS para ver la degradación sin filtros WebGL.",
        panels,
        columns=4,
    )


def urban_sheet():
    """§8.6: control y candidata GN del §6 plantados sobre el tramo de calle Graphic Civic."""
    arms = ("control", "candidata")
    families = ["row_house", "mixed_tenement"]
    zooms = ["1x", "0.5x"]
    indexes = {}
    for arm in arms:
        path = EVIDENCE / "urban" / arm / "urban-context-index.json"
        if path.exists():
            indexes[arm] = {
                (entry["buildingType"], entry["zoom"]): entry
                for entry in json.loads(path.read_text(encoding="utf8"))
            }
        else:
            indexes[arm] = {}
    panels = []
    for family in families:
        for zoom in zooms:
            for arm in arms:
                png = EVIDENCE / "urban" / arm / f"{family}-city-context-{zoom}.png"
                entry = indexes[arm].get((family, zoom), {})
                if not png.exists():
                    blank = Image.new("RGBA", (620, 400), PANEL)
                    ImageDraw.Draw(blank).text(
                        (12, 12), f"{family} · {arm} · {zoom} · SIN EVIDENCIA", fill=TITLE, font=font(17)
                    )
                    panels.append(blank)
                    continue
                panels.append(
                    panel(
                        png,
                        f"{arm} · {family} · {zoom} · seed {entry.get('variantSeed', '?')} · "
                        f"ortho {entry.get('orthoScale', '?')} · {entry.get('moodId', '-')}",
                        max_height=420,
                    )
                )
    return sheet(
        SHEETS / "urban_context_sheet.png",
        "D-111 §8.6 · Contexto urbano 1440×900: control vs candidata con fachada Geometry Nodes",
        "Geometría licenciada real del Composer sobre calzada, acera, parcela, árbol, personaje y vehículo "
        "de escala, con la cámara isométrica del juego. Dos filas por familia × (1×, 0,5×) × (control, "
        "candidata). La legibilidad a 0,5× es el criterio, no el detalle del paño.",
        panels,
        columns=4,
    )


def pixel_delta(reference_png: Path, arm_png: Path) -> str:
    """Delta de píxel entre dos fotogramas del mismo encuadre, en unidades de 8 bits.

    Es el número que decide si un tier se ve. `meanAbsDiff` sobre el lienzo entero se diluye en el
    fondo, así que se mide sólo sobre píxel no-fondo y se separa el cambio de TONO (los píxeles se
    mueven con el mismo signo) del de TEXTURA (claros y oscuros que promedian a cero): un tier que
    sólo cambia de textura produce un archivo distinto que NO se lee como envejecido, que es justo
    el defecto que la primera corrida del WP04 tuvo que medir para poder corregirse.
    """
    import numpy as np

    if not (reference_png.exists() and arm_png.exists()):
        return "delta de píxel no medible (falta alguno de los dos fotogramas)"
    reference = np.asarray(Image.open(reference_png).convert("RGB"), dtype=np.float32) / 255.0
    arm = np.asarray(Image.open(arm_png).convert("RGB"), dtype=np.float32) / 255.0
    if reference.shape != arm.shape:
        return (
            f"encuadres distintos ({reference.shape[1]}×{reference.shape[0]} vs "
            f"{arm.shape[1]}×{arm.shape[0]}): no comparable píxel a píxel"
        )
    weights = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    luma_reference = reference @ weights
    luma_arm = arm @ weights
    # El fondo del sprite del compositor es negro casi puro; todo lo demás es edificio o parcela.
    solid = luma_reference > 0.02
    signed = (luma_arm - luma_reference)[solid] * 255.0
    magnitude = np.abs(signed)
    mean_abs = float(magnitude.mean())
    tone_share = abs(float(signed.mean())) / mean_abs if mean_abs > 1e-6 else 0.0
    return (
        f"|Δ| media {mean_abs:.1f}/255 · tono {signed.mean():+.1f} "
        f"({'domina el tono' if tone_share >= 0.6 else 'casi todo textura'}) · "
        f"mediana {float(np.median(magnitude)):.1f} · "
        f"{100.0 * float((magnitude > 4.0).mean()):.1f} % del lienzo sobre la cota de §13"
    )


def window_glow_delta(control_png: Path, aged_png: Path, threshold: float = 0.45) -> str:
    """Cuánta luz de ventana pierde el tier envejecido, medida sólo sobre el píxel del hueco.

    La máscara es de luminancia sobre el control (`luma > threshold`), no cromática. Se probó la
    cromática primero y mentía: el mood `night_civic` tiñe de frío toda la escena, así que
    `R − B > 25` no seleccionaba los huecos sino el ladrillo de paño y devolvía ×0,881 como si la
    ventana perdiera un 12 % de luz. Medida la máscara correcta, el hueco encendido resulta ser el
    3,3 % más brillante del sprite (luma ≈ 140/255) y apenas se mueve.
    """
    import numpy as np

    if not (control_png.exists() and aged_png.exists()):
        return "Delta de hueco: sin los dos fotogramas nocturnos."
    weights = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    def read(png: Path):
        rgba = np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32)
        return rgba[..., :3], rgba[..., 3] > 10

    base, base_alpha = read(control_png)
    aged, aged_alpha = read(aged_png)
    if base.shape != aged.shape:
        return "Delta de hueco: encuadres distintos, no comparable."
    opaque = base_alpha & aged_alpha
    luma_base = base @ weights
    glow = (luma_base > threshold * 255.0) & opaque
    if int(glow.sum()) < 200:
        return (
            f"Delta de hueco: el control no tiene ventanales encendidos (luma > {threshold} en "
            f"{int(glow.sum())} px) — el mood nocturno no se aplicó."
        )
    luma_aged = aged @ weights
    ratio = float(luma_aged[glow].mean() / luma_base[glow].mean())
    identical = float((np.abs(base - aged).max(axis=2)[glow] == 0).mean())
    return (
        f"sobre {int(glow.sum())} px de hueco encendido (luma > {threshold} en el control, "
        f"{100.0 * int(glow.sum()) / max(int(opaque.sum()), 1):.2f} % del área opaca): luma media "
        f"{float(luma_base[glow].mean()):.2f} → {float(luma_aged[glow].mean()):.2f}/255 (×{ratio:.4f}) "
        f"y {100.0 * identical:.1f} % de esos píxeles byte-idénticos"
    )


def emission_lever_probe(arms: list[tuple[str, Path]]) -> str:
    """Si `emissionScale` del contrato mueve algo en el raster, medido brazo contra brazo.

    WP04-D3. El socket se escribe (la metadata de cada brazo registra `before`/`after`), así que la
    pregunta no es si el código lo toca sino si se ve. Se re-renderiza la MISMA receta con la
    palanca en 0,0 y en 1,0: si los tres PNG son el mismo raster, la palanca es inerte en este
    encuadre y ningún WP07 puede contar con ella. Se leen también los valores reales del socket
    desde la metadata de cada brazo, para que la frase no pueda quedar desfasada del render.
    """
    import numpy as np

    available = [(label, png) for label, png in arms if png.exists()]
    if len(available) < 2:
        return "sonda de emisión: faltan brazos (se esperan los tres valores de `emissionScale`)"
    weights = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    def read(png: Path):
        rgba = np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32)
        return rgba[..., :3], rgba[..., 3] > 10

    frames = []
    for label, png in available:
        rgb, alpha = read(png)
        meta = load_json(png)
        sockets = [
            (m.get("emission") or {}).get("after")
            for m in ((meta.get("weathering") or {}).get("materials") or [])
            if m.get("family") == "atlas"
        ]
        frames.append((label, rgb, alpha, sockets))
    reference = frames[0]
    parts = []
    worst = 0
    differing = 0
    for label, rgb, alpha, sockets in frames[1:]:
        if rgb.shape != reference[1].shape:
            return "sonda de emisión: los brazos no comparten encuadre"
        delta = np.abs(rgb - reference[1]).max(axis=2)
        shared = alpha & reference[2]
        differing = max(differing, int((delta[shared] > 0).sum()))
        worst = max(worst, int(delta[shared].max()))
    for label, rgb, alpha, sockets in frames:
        luma = float((rgb @ weights)[alpha & reference[2]].mean())
        parts.append(f"{label}: socket atlas {sockets}, luma media {luma:.2f}/255")
    verdict = (
        "la palanca NO llega al raster (sólo difieren en ruido de codificador)"
        if differing <= 2 and worst <= 1
        else f"sí llega al raster ({differing} px difieren, hasta {worst}/255)"
    )
    return " · ".join(parts) + f" — entre brazos {verdict}"


def vertical_tone_gradient(reference_png: Path, arm_png: Path, bands: int = 3) -> str:
    """Tono por franjas verticales: la prueba de que la rampa de gravedad del contrato se ve.

    `gravityRamp` sólo puede hacer una cosa —subir la máscara hacia la cota baja del muro— así que
    su firma es un gradiente monotónico de arriba abajo. Si las franjas no son monotónicas, la
    rampa está cableada pero no llega al raster (escala mal puesta, o `zHighMeters` por encima del
    edificio), que es el tipo de defecto que un promedio global no puede delatar.
    """
    import numpy as np

    if not (reference_png.exists() and arm_png.exists()):
        return "gradiente vertical no medible"
    weights = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

    def read(png: Path):
        rgba = np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32)
        return (rgba[..., :3] @ weights) / 255.0, rgba[..., 3] > 10

    luma_ref, alpha_ref = read(reference_png)
    luma_arm, alpha_arm = read(arm_png)
    if luma_ref.shape != luma_arm.shape:
        return "gradiente vertical: encuadres distintos"
    opaque = alpha_ref & alpha_arm
    height = luma_ref.shape[0]
    tones = []
    for i in range(bands):
        rows = slice(i * height // bands, (i + 1) * height // bands)
        band = np.zeros_like(opaque)
        band[rows] = True
        band &= opaque
        tones.append(float(((luma_arm - luma_ref)[band] * 255.0).mean()) if band.any() else float("nan"))
    monotonic = all(tones[i] >= tones[i + 1] - 0.2 for i in range(len(tones) - 1))
    return (
        "tono por tercios (cubierta → planta baja): "
        + " · ".join(f"{tone:+.1f}" for tone in tones)
        + f"/255 · {'monótono, la rampa de gravedad se ve' if monotonic else 'NO monótono: la rampa no llega al raster'}"
    )


def probe_coverage(probe_png: Path, control_png: Path, threshold: int = 8) -> str:
    """Fracción del área opaca que cambia cuando la mugre se pide al 100 % de fuerza.

    Es la sonda que encontró WP04-D2. Se renderiza el MISMO request con todas las recetas `aged` a
    strength 1,0, baseSoiling 1,0 y `grimeColor` verde: un píxel opaco que sigue siendo el del control
    no recibe la capa en absoluto, y eso sólo puede pasar si su material está excluido. Medido sobre el
    alfa de los dos fotogramas, no sobre el lienzo entero, porque el fondo transparente diluye el
    porcentaje y un 46 % real se leería como un 23 %.
    """
    import numpy as np

    if not (probe_png.exists() and control_png.exists()):
        return "sonda de cobertura no medible (falta alguno de los dos fotogramas)"
    probe = np.asarray(Image.open(probe_png).convert("RGBA"), dtype=np.int16)
    control = np.asarray(Image.open(control_png).convert("RGBA"), dtype=np.int16)
    if probe.shape != control.shape:
        return (
            f"sonda con encuadres distintos ({probe.shape[1]}×{probe.shape[0]} vs "
            f"{control.shape[1]}×{control.shape[0]})"
        )
    opaque = (control[:, :, 3] > 10) & (probe[:, :, 3] > 10)
    delta = np.abs(probe[:, :, :3] - control[:, :, :3]).max(axis=2)
    treated = opaque & (delta > threshold)
    total = max(int(opaque.sum()), 1)
    return (
        f"{100.0 * int(treated.sum()) / total:.1f} % de los {int(opaque.sum())} píxeles opacos reciben "
        f"capa ({100.0 - 100.0 * int(treated.sum()) / total:.1f} % sin tratar)"
    )


def mask_probe_note() -> str:
    """Línea de calibración leída del medidor de máscaras, no de la receta.

    `weathering_mask_probe.py` renderiza un paño 16×12 m por familia y mide la máscara y el delta de
    tono contra un gris de control. Si una familia se queda por debajo de la cota de ruido, o su
    delta es pura textura, la hoja lo dice aquí en vez de esperar a que un revisor lo note a ojo.
    """
    path = V2 / "weathering" / "mask" / "summary.json"
    if not path.exists():
        return "medidor de máscaras no ejecutado: la calibración del tier envejecido no está medida"
    summary = json.loads(path.read_text(encoding="utf8"))
    treated = [row for row in summary["families"] if row["strength"] > 0.0]
    weak = []
    for row in treated:
        delta = row["agedVsControl"]
        if delta["fractionAboveNoiseFloor"] < 0.5 or delta["toneVsTexture"] < 0.4:
            weak.append(
                f"{row['family']} (Δ{delta['meanSigned']:+.1f}, "
                f"{100 * delta['fractionAboveNoiseFloor']:.0f} % sobre ruido, tono/textura "
                f"{delta['toneVsTexture']:.2f})"
            )
    darkest = min(treated, key=lambda row: row["agedVsControl"]["meanSigned"])
    verdict = (
        "todas las familias con color alterado superan la cota de ruido de §13 y su delta es de tono"
        if not weak
        else "POR CALIBRAR: " + "; ".join(weak)
    )
    return (
        f"Paño 16×12 m por familia ({summary['moodId']}, contrato {summary['contractId']}@"
        f"{summary['contractSha256'][:8]}): máscara media "
        f"{min(row['mask']['mean'] for row in treated):.2f}–"
        f"{max(row['mask']['mean'] for row in treated):.2f}, oscurecimiento "
        f"{darkest['agedVsControl']['meanSigned']:+.1f}/255 en la familia más tratada "
        f"({darkest['family']}). {verdict}."
    )


def weathering_textures(block: dict) -> list[str]:
    """Recursos que la proyección metería en el shader, por nombre de archivo.

    Es la respuesta literal a «indica qué texturas o decals se han cambiado»: se lee del registro por
    material que escribió el render, no de lo que el contrato dice que pensaba hacer.
    """
    found = set()
    for material in block.get("materials") or []:
        for entry in (material.get("mask") or {}).values():
            if isinstance(entry, dict) and entry.get("texture"):
                found.add(Path(entry["texture"]).name)
        grime = material.get("grimeSource") or {}
        if grime.get("texture"):
            found.add(Path(grime["texture"]).name)
    return sorted(found)


def weathering_delta(reference: dict, arm: dict) -> str:
    """Delta de GEOMETRÍA medido entre el control y el brazo, sobre las colocaciones declaradas."""
    if not reference.get("transforms") or not arm.get("transforms"):
        return "delta de geometría no medible (falta el control)"
    base = {
        (record["purpose"], tuple(round(value, 2) for value in record["position"]))
        for record in reference["transforms"]
    }
    current = {
        (record["purpose"], tuple(round(value, 2) for value in record["position"]))
        for record in arm["transforms"]
    }

    def group(purpose: str) -> str:
        parts = purpose.split(":")
        # `band:front:level2:bay5` se cuenta por banda y nivel: el delta dice qué se fue, bay a bay.
        return ":".join(parts[:3]) if parts[0] == "band" else parts[0]

    removed = Counter(group(purpose) for purpose, _ in base - current)
    added = Counter(group(purpose) for purpose, _ in current - base)
    triangles = int(arm.get("triangleCount") or 0) - int(reference.get("triangleCount") or 0)
    text = (
        f"colocaciones {len(base)}→{len(current)} · triángulos {triangles:+d}"
        if removed or added
        else f"colocaciones idénticas al control ({len(current)}) · triángulos {triangles:+d}"
    )
    if removed:
        text += " · retiradas " + ", ".join(f"{name}×{count}" for name, count in sorted(removed.items()))
    if added:
        text += " · añadidas " + ", ".join(f"{name}×{count}" for name, count in sorted(added.items()))
    return text


def weathering_sheet():
    """WP04: el MISMO edificio en sus tres tiers, con el delta de material y de geometría medido.

    La hoja no puede decir "envejecido se ve más sucio": tiene que decir qué capas se insertaron
    sobre qué albedo y, en los brazos de daño, cuántas colocaciones se fueron y cuáles se añadieron.
    Todo eso se lee de la metadata que escribió el propio render, así que si el contrato cambia de
    receta la hoja cambia de texto sin que nadie la reescriba a mano.
    """
    day = V2 / "weathering" / "day"
    night = V2 / "weathering" / "night"
    conserved_png = day / "vw_mixed_tenement_1001_conserved.png"
    aged_png = day / "vw_mixed_tenement_1001_aged.png"
    damaged_png = day / "vw_mixed_tenement_1001_damaged.png"
    burning_png = day / "vw_mixed_tenement_1001_burning.png"
    reference = load_json(conserved_png)

    def arm(png: Path, caption: str, height: int):
        if not png.exists():
            return placeholder(f"{caption} · SIN EVIDENCIA", 460, 320)
        meta = load_json(png)
        note = framing_note(meta, png)
        block = meta.get("weathering") or {}
        if block:
            note += (
                f" · tier {block['visualState']} ({block['label']}) · {block['materialsChanged']} "
                f"materiales envejecidos / {block['skipped']} excluidos · proyección material "
                f"{block['materialProjection']} · geometría {block['geometryChange']}"
            )
            textures = weathering_textures(block)
            note += " · recursos: " + (", ".join(textures) if textures else "ninguno nuevo")
            note += f" · contrato {block['contractId']}@{block['contractSha256'][:8]}"
        else:
            note += f" · estado del compositor {meta.get('state')} · {weathering_delta(reference, meta)}"
            damage = meta.get("damageTreatment") or {}
            soot = damage.get("soot") or {}
            if soot:
                note += f" · hollín {soot.get('sootStrength')} sobre {soot.get('materialsScorched')} materiales"
            flames = damage.get("flames") or {}
            if flames:
                note += f" · llama a emisión {flames.get('flameEmissionStrength')}"
        return panel(png, f"{caption} · {note}", max_height=height, big=18, max_lines=13)

    aged = load_json(aged_png)
    damaged = load_json(damaged_png)
    burning = load_json(burning_png)
    night_conserved = night / "vwn_mixed_tenement_1001_conserved.png"
    night_aged = night / "vwn_mixed_tenement_1001_aged.png"
    # El mismo request SIN la clave `weathering`: si este fotograma difiere de `conserved`, la bandera
    # opt-in no es inerte y el control de los sprites aprobados cae.
    optout_png = V2 / "weathering" / "optout" / "vw_mixed_tenement_1001.png"
    probe_dir = V2 / "weathering" / "probe"
    probe_before = probe_dir / "green_before_interior_fix.png"
    probe_after = probe_dir / "green_after_interior_fix.png"
    # WP04-D3: la misma receta nocturna con la palanca de emisión en sus dos extremos.
    emission_one_png = probe_dir / "night_aged_emission_scale_1.png"
    emission_zero_png = probe_dir / "night_aged_emission_scale_0.png"

    def canvas(meta: dict) -> str:
        image = meta.get("image") or {}
        return f"{image.get('width')}×{image.get('height')}"

    decision = [
        "Qué se decidió con estos fotogramas (medido sobre la metadata, no a ojo):",
        f"· A→B envejecido: firma de composición {'IDÉNTICA' if aged.get('compositionSignature') == reference.get('compositionSignature') else 'DISTINTA'} "
        f"y triángulos {reference.get('triangleCount')}→{aged.get('triangleCount')}. La proyección es sólo material: "
        f"{(aged.get('weathering') or {}).get('materialsChanged')} materiales reciben capa de mugre y "
        f"{(aged.get('weathering') or {}).get('skipped')} quedan excluidos por nombre (fondo del hueco, forjados "
        "interiores y equipo de obra).",
        f"· A→B píxel a píxel: {pixel_delta(conserved_png, aged_png)}.",
        f"· Rampa de gravedad (la única cosa que puede hacer `gravityRamp`): {vertical_tone_gradient(conserved_png, aged_png)}.",
        "· WP04-D2 · sonda de cobertura (mugre pedida al 100 % de fuerza sobre este mismo request, manifiesto de "
        f"trabajo aparte): antes de corregir el contrato {probe_coverage(probe_before, conserved_png)}; después, "
        f"{probe_coverage(probe_after, conserved_png)}. La diferencia es el paño de fachada: el MegaKit llama "
        "`MI_InteriorWall` al material que pinta el ladrillo del alzado, y la familia `interior` estaba excluida "
        "en bloque, así que más de la mitad del edificio no envejecía. La exclusión ahora es por nombre y el paño "
        "lleva la receta de ladrillo; el residual sin tratar es el fondo del hueco y los forjados.",
        f"· Calibración de la máscara: {mask_probe_note()}",
        f"· A→C dañado: el lienzo pasa de {canvas(reference)} a {canvas(damaged)} y la firma de composición "
        f"difiere ({reference.get('compositionSignature', '')[:12]}→{damaged.get('compositionSignature', '')[:12]}) — "
        "no es comparable píxel a píxel, y esa es precisamente la prueba de que la silueta cambia, que es lo que "
        "separa el daño del envejecido.",
        f"· C dañado (geometría): {weathering_delta(reference, damaged)}. El daño lo sigue produciendo el compositor "
        "(mismo seed, misma parcela); el contrato lo DECLARA pero no lo parametriza.",
        f"· D ardiendo: {weathering_delta(reference, burning)}.",
        f"· A conservado: proyección declarada pero CERO capas insertadas "
        f"({(reference.get('weathering') or {}).get('materialsChanged')} materiales). Contra el mismo request "
        f"sin la clave `weathering`: {pixel_delta(optout_png, conserved_png)} — la bandera opt-in no toca "
        "los sprites aprobados.",
        f"· E→F envejecido de noche: {pixel_delta(night_conserved, night_aged)}. Hueco: {window_glow_delta(night_conserved, night_aged)}.",
        "· Restricción de vidrio día/noche (pedida en WP04): de día el hueco NO se oscurece —ya es casi negro "
        "y bajarlo lo convertiría en agujero, borrando la retícula de crujías—; envejece sólo por rugosidad "
        "(0,88 → 1,00 medidos en el socket). De noche ocurre lo mismo por la misma razón, y es lo que preserva "
        "la señal de ocupación: el contrato deja `glass` en fuerza 0 y `emissionScale` nulo.",
        "· WP04-D3 · la palanca de emisión del contrato es INERTE en este encuadre (medido, no supuesto): "
        f"{emission_lever_probe([('publicado ×0,78', night_aged), ('×1,0', emission_one_png), ('×0,0', emission_zero_png)])}. "
        "El socket sí se escribe (la metadata de cada brazo registra el `before` 1,15 y su `after`), pero "
        "`colormap`/`colormap.001` son los dos únicos materiales con emisión cableada y los traen "
        "`mod_kenney_com_awning_1_6m` y `mod_kenney_com_block_k`: en este seed la luz de ventana que se ve no "
        "sale de ahí, sale del `MI_Glass` del MegaKit teñido por el mood. Consecuencia para WP07: "
        "`emissionScale` no es una palanca de legibilidad nocturna sobre este edificio; la legibilidad del hueco "
        "hay que ganarla con luz y con el panel de ventanas del runtime, no escalando este socket.",
        "· Señal de ocupación (fila E/F): la mugre baja de fuerza de noche (×0,7–0,8 en las recetas) y el paño "
        "pierde contraste, pero el hueco encendido se queda donde estaba, así que el envejecido no puede leerse "
        "como un edificio apagado a medias —que era el riesgo de mezclar desgaste con la señal de uso.",
        "· Límite medido y NO corregido aquí: la regla de daño retira `purpose in ('dormer','cornice')`, pero los "
        "propósitos reales van prefijados (`cornice:front:3`), así que la cornisa sobrevive a la sección de "
        "cubierta. Corregirlo cambia los sprites `damaged`/`burning` publicados: es decisión del responsable, "
        "no un ajuste de esta hoja.",
        "· Conflicto de runtime propuesto, no aplicado: hoy `buildingAssetStateFor` convierte `condition < 60` en "
        "el sprite `damaged` (geometría seccionada). Un edificio simplemente desatendido se dibuja derruido. La "
        "salida es publicar el tier envejecido bajo `complete` y dejar `damaged` para integridad estructural; "
        "eso cambia el contrato de assets (D-080) y requiere revisión humana.",
    ]

    def build(height: int, out_path: Path):
        panels = [
            arm(conserved_png, "A · conservado (control, de día)", height),
            arm(aged_png, "B · envejecido (sólo material, de día)", height),
            arm(damaged_png, "C · dañado (geometría del compositor)", height),
            arm(burning_png, "D · en llamas", height),
            arm(night_conserved, "E · conservado, de noche", height),
            arm(night_aged, "F · envejecido, de noche (mugre atenuada, huecos intactos)", height),
            text_panel("WP04 · qué cambió exactamente en cada tier", decision, width=900),
        ]
        return sheet(out_path, title, subtitle, panels, columns=2)

    title = (
        "D-111.2 WP04 · mixed_tenement seed 1001 en tres tiers de conservación: mismo edificio, "
        "misma cámara, misma geometría de base"
    )
    subtitle = (
        "Los seis fotogramas salen del mismo request del Building Composer (huella 4×2, 3 plantas, perfil "
        "graphic_civic_buildings_v1, azimut 45°) y se pegan a escala nativa: 60,2 px/m en todos, así que el "
        "tamaño relativo es el real de juego. `conserved` y `aged` comparten firma de composición; `damaged` "
        "y `burning` difieren porque el compositor retira y añade colocaciones, y esa diferencia se mide "
        "aquí sobre las propias transformadas. Ningún sprite del catálogo publicado se regenera con esto."
    )
    first = build(900, V2_SHEETS / "weathering_states.png")
    second = build(450, V2_SHEETS / "weathering_states_half.png")
    return first, second


def industrial_warehouse_sheet():
    """WP05: la nave en crujía de 4 m con portón de camión, ventana de banda y pretil propios."""
    strip = V2 / "industrial/dock_aperture_scale.png"
    ctl = V2 / "industrial/warehouse-control.png"
    cnd = V2 / "industrial/warehouse-candidata.png"
    ctl_meta, cnd_meta = load_json(ctl), load_json(cnd)
    title = (
        "D-111.2 WP05 · Nave industrial original a 4 m: portón de muelle, ventana de banda y pretil "
        "de chapa, contra el almacén aprobado"
    )
    subtitle = (
        "Fila superior: la franja de escala (módulos sueltos, no un edificio) y la decisión medida. Fila "
        "inferior: el MISMO warehouse seed 2, misma parcela 4×3 celdas (16×12 m), misma luz day_civic y "
        "mismo encuadre; cambian los módulos que resuelven `wall_panel`, `window_bay`, el rol de acceso y "
        "la silueta. Los sprites se pegan a escala nativa y la lectura al 50 % redibuja a la mitad de píxeles."
    )

    def aperture(png: Path, module_id: str) -> tuple:
        for entry in load_json(png)["extension"]["modules"]:
            if entry["moduleId"] == module_id:
                rect = entry.get("largestFreeRect") or {}
                return rect, entry.get("vsTruckBox", {})
        raise KeyError(f"{module_id} no está en {png}")

    def build(sprite_height: int, out_path: Path):
        dock_rect, dock_vs = aperture(strip, "mod_gn_truck_dock_bay_4m")
        frame_rect, _ = aperture(strip, "mod_megakit_doorframe_metal_2m")
        window_rect, _ = aperture(strip, "mod_gn_metal_window_bay_4m")
        box = load_json(strip)["extension"]["references"]["truckBox"]
        ctl_deep = load_json(ctl)["style"]["deepReach"]["deepStyledAtlases"]
        cnd_deep = load_json(cnd)["style"]["deepReach"]["deepStyledAtlases"]
        same_axes = [
            key
            for key, value in ctl_meta["axisChoices"].items()
            if cnd_meta["axisChoices"].get(key) == value
        ]
        diff_axes = [k for k in ctl_meta["axisChoices"] if k not in same_axes]

        def dock_x(meta, role):
            return sorted(round(t["position"][0], 2) for t in meta["transforms"] if t["role"] == role)

        ctl_docks, cnd_docks = dock_x(ctl_meta, "doorframe"), dock_x(cnd_meta, "dock_doorframe")
        decision = [
            f"Hueco de carga: el marco aprobado mide {frame_rect['widthMeters']} × "
            f"{frame_rect['heightMeters']} m de paso libre, la caja de referencia del repo es de "
            f"{box['width']} × {box['height']} m → el camión NO entra; hoy los muelles son puertas "
            f"peatinales. El portón GN deja {dock_rect['widthMeters']} × {dock_rect['heightMeters']} m "
            f"desde z={dock_rect['z'][0]} (gálibo {dock_vs['sobranAlto']} m y ancho {dock_vs['sobranAncho']} m "
            "de sobra), medido sobre las caras de la malla exportada con la hoja excluida por material, "
            "no deducido de los parámetros.",
            f"Ventana de banda: {window_rect['widthMeters']} × {window_rect['heightMeters']} m de recorte "
            "estructural con los mismos machones de 0,70 m del portón, así que la fachada lee una sola "
            "retícula. La variante CC0 de 4 m no se usó: su paleta enlaza `MI_RedBrick` y metería ladrillo "
            "en `steel_cladding`. Y el control ya lo mete: `deepStyledAtlases` del brazo aprobado es "
            f"{ctl_deep} (ladrillo vía `MI_InteriorWall` del paño megakit), el de la candidata es "
            f"{cnd_deep} y además cierra los 3 materiales `linkedWithoutColorSource` del vidrio megakit. "
            "Los 15 flats GN de la candidata entran por `flatStyledMaterials` con color derivado del mismo "
            "atlas licenciado (evidencia `gn/palette_industrial_day_civic.json`).",
            "Silueta: en HEAD `plain` y `parapet` declaraban `corniceRole: null`, es decir eran "
            "geométricamente idénticas y el eje de silueta no existía en la nave. El pretil GN de 4 m da "
            "remate real a las dos y las separa por vuelo (0,20 m frente a 0,35 m).",
            f"Ejes: {len(same_axes)} de las {len(ctl_meta['axisChoices'])} decisiones de la gramática "
            f"salen idénticas; difiere {', '.join(f'`{k}`' for k in diff_axes)} y su sufijo no es un sorteo "
            "nuevo sino el índice de crujía por donde empieza la hilada "
            "(`compose.py:353` → `f\"{{access['id']}}@{{self.access_bay}}\"`). Al pasar la retícula de 2 a 4 m "
            f"la hilada corre {abs(cnd_docks[0] - ctl_docks[0]):.2f} m en X "
            f"({', '.join(f'{v:+.0f}' for v in ctl_docks)} → {', '.join(f'{v:+.0f}' for v in cnd_docks)}) "
            "conservando los cuatro huecos y el paso de 4 m que declara `repeatEveryMeters`: son los mismos "
            "muelles centrados en la retícula nueva, no otro edificio.",
            f"Coste: {ctl_meta['triangleCount']} tri del control contra {cnd_meta['triangleCount']} tri "
            f"({cnd_meta['checks']['distinctModuleIds']} módulos, {cnd_meta['checks']['distinctSources']} "
            "fuentes, licenciado 100 %). Es offline y se acepta: el sprite sigue siendo un PNG y el "
            "presupuesto de navegador no cambia.",
            "No se toca ningún sprite aprobado: con los cuatro módulos ya registrados, el brazo de control "
            "reproduce las firmas de HEAD `59f0c437e1c2` (seed 2) y `3b1c9a197bc2` (seed 1002) byte a byte. "
            "El seed 1002 es el caso ciego (`blind_siding`: paño sin ventanas, paleta `metal_brick_mix`, "
            "silueta `metal_cornice`) y allí la candidata también cambia (`c21d74c47e22`, 80→52 "
            "colocaciones, 2 516→6 648 tri) porque el paño, el portón y el pretil no dependen del ritmo: "
            "la retícula de 4 m divide las colocaciones a la mitad y cada una lleva más geometría.",
            "Trampa evitada: `compose.py:1055` resuelve el marco del acceso SIN id y "
            "`module_catalog.py:88` ordena el pool por id, así que un módulo GN de 4 m con rol `doorframe` "
            "hubiera sustituido el marco peatonal de 2 m en las cinco gramáticas industriales sin tocar "
            "ningún manifiesto (medido: §17 de contacto con el suelo). El portón declara su propio rol "
            "`dock_doorframe` y el parche lo pide explícitamente.",
        ]
        rows = [
            panel(
                strip,
                "A · franja de escala ortogonal (nativa, sin agrandar: es una tira de 1541 px y subirla "
                "deformaría el px/m con el que se compara el camión). De izquierda a derecha: marco de 4 m, "
                "caja de camión 2,50 × 2,60, persona de 1,75, control CC0, paño, ventana, portón, pretil y "
                "el camión real de Kenney.",
                max_height=560,
                big=17,
            )
            if strip.exists()
            else placeholder("A · franja de escala · SIN EVIDENCIA", 460, 320),
            text_panel("B · qué se midió y qué se decidió", decision, width=900),
            v2_panel("industrial", "warehouse-control", "warehouse seed 2 · control aprobado", sprite_height),
            v2_panel("industrial", "warehouse-candidata", "warehouse seed 2 · candidata GN 4 m", sprite_height),
        ]
        return sheet(out_path, title, subtitle, rows, columns=2)

    first = build(980, V2_SHEETS / "industrial_warehouse_ab.png")
    second = build(490, V2_SHEETS / "industrial_warehouse_ab_half.png")
    return first, second


def wp06_candidates_sheet():
    """WP06: las cuatro candidatas revisables, cada una contra su control de producción.

    Es la hoja del cierre: lo que se juzga aquí no es un módulo suelto sino que un perfil de
    `building-composer-candidates.json` plantado sobre la gramática aprobada —sin parchearla— dé un
    edificio que sigue siendo su familia. Cada pie sale del JSON hermano del PNG (§8.3): firma de
    composición, triángulos y recorte reales de ese brazo, no los que recuerda quien monta la hoja.
    """
    rows = (
        ("residential", "row_house", "GN: crujía, zócalo de sillar y cornisa"),
        ("commercial", "mixed_tenement", "GN: crujía, cornisa y puerta-balcón"),
        ("industrial", "warehouse", "GN: chapa, ventana, portón y pretil a 4 m"),
        ("civic", "town_hall", "Arch Generator: vano de arcada cívica"),
    )

    def build(sprite_height: int, out_path: Path):
        panels = []
        for folder, building_type, label in rows:
            panels.append(
                v2_panel(folder, f"{building_type}-control",
                         f"{building_type} · {label} · control", sprite_height)
            )
            panels.append(
                v2_panel("candidates", f"wp06_{building_type}-candidata",
                         f"{building_type} · {label} · candidata", sprite_height)
            )
        return sheet(
            out_path,
            "D-111.2 WP06 · cuatro candidatas por perfil de candidato, sobre la gramática aprobada",
            "Ninguno de los cuatro brazos tocó `building-composer-grammars.json`: cada uno se compuso "
            "con `--candidate=<perfil>` y se validó con las mismas guardas de §11/§17 que la producción. "
            "Huella, orientación y plantas son idénticos al control en las cuatro y el pivote también, "
            "salvo en la nave, donde sube con el pretil de 4 m que WP05 declaró (medido en "
            "`test_building_composer_candidates.py`). Lo único que cambia es qué módulo resuelve cada "
            "rol. Las tres autorías distintas: Geometry Nodes en las dos residenciales, GN industrial a "
            "4 m en la nave y un vano horneado desde Arch Generator en el hito cívico.",
            panels,
            columns=2,
        )

    first = build(980, V2_SHEETS / "wp06_candidates_ab.png")
    second = build(490, V2_SHEETS / "wp06_candidates_ab_half.png")
    return first, second


def main() -> None:
    if not SHEETS.exists():
        SHEETS.mkdir(parents=True)
    only = [a for a in sys.argv[1:] if a != "--"]
    for name, fn in (
        ("§8.1 pilotos", pilots_sheet),
        ("§8.4 materiales", materials_sheet),
        ("§8.3 extensiones", extensions_sheet),
        ("§8.2 geometry nodes", geometry_nodes_sheet),
        ("§8.5 phaser", phaser_sheet),
        ("§8.6 contexto urbano", urban_sheet),
        ("WP01 geometry nodes v2", gn_v2_sheet),
        ("WP02 arcada civica ag", ag_civic_sheet),
        ("WP03 componentes ext", ext_window_columns_sheet),
        ("WP03 fachada hifi grid", hifi_grid_sheet),
        ("WP04 estados de conservación", weathering_sheet),
        ("WP05 nave industrial", industrial_warehouse_sheet),
        ("WP06 cuatro candidatas", wp06_candidates_sheet),
    ):
        if only and not any(key in name for key in only):
            continue
        try:
            size = fn()
            # Una hoja simple devuelve (ancho, alto); las WP devuelven además su lectura al 50 %.
            text = "x".join(str(v) for v in size)
            if len(size) == 2 and isinstance(size[0], tuple):
                text = "1x " + "x".join(map(str, size[0])) + " · 0,5x " + "x".join(map(str, size[1]))
            print(f"{name}: {text}")
        except Exception as error:  # noqa: BLE001 - la hoja no debe tumbar el lote
            print(f"{name}: ERROR {type(error).__name__}: {error}")


if __name__ == "__main__":
    main()

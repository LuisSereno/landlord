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
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

REPO = Path(__file__).resolve().parents[4]
CAPS = REPO / "docs/art/graphics-capabilities"
EVIDENCE = CAPS / "evidence"
SHEETS = EVIDENCE / "sheets"
PILOTS = EVIDENCE / "pilots"

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


def wrap_caption(caption: str, width: int, typeface) -> list[str]:
    """El pie se parte en líneas: una decisión recortada a media palabra no es revisable (§9.9)."""
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
    for line in lines[:4]:
        while line and draw_textlength(line, typeface) > width:
            line = line[:-1]
        wrapped.append(line)
    return wrapped


def panel(png: Path, caption: str, max_height: int, big: int = 15):
    """Un recuadro de la hoja: imagen escalada + pie de foto con los números del JSON hermano."""
    image = Image.open(png).convert("RGBA")
    scale = min(1.0, max_height / image.size[1])
    size = (max(1, round(image.size[0] * scale)), max(1, round(image.size[1] * scale)))
    resized = image.resize(size, Image.LANCZOS)
    typeface = font(big)
    ascent, descent = typeface.getmetrics()
    line_height = ascent + descent
    lines = wrap_caption(caption, size[0] - 14, typeface)
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
    ):
        if only and not any(key in name for key in only):
            continue
        try:
            size = fn()
            print(f"{name}: {size[0]}x{size[1]}")
        except Exception as error:  # noqa: BLE001 - la hoja no debe tumbar el lote
            print(f"{name}: ERROR {type(error).__name__}: {error}")


if __name__ == "__main__":
    main()

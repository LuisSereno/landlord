#!/usr/bin/env python3
"""
D-111.2 FASE 4.4 — de dónde salen los anclajes del incendio del laboratorio.

El encargo prohíbe colocar el fuego con una constante universal (`sprite.y − 26`) y obliga a derivarlo
del propio edificio. Este script mide sobre los PNG horneados del catálogo en runtime:

1. los **hitos de silueta** que reproduce `fx-fire-anchors.ts`: primera fila con ancho estructural
   (≥35 % del máximo), centroide de la banda de cubierta y fin de esa banda;
2. los **focos** del sprite `burning` como la diferencia real contra `complete` más una máscara de
   píxel cálido: no se adiviza dónde arde, lo dice el bake;
3. el **sha256 de los cuatro estados** de cada módulo. Es el dato que cambia el diseño: si los cuatro
   hashes coinciden, el catálogo no tiene arte de incendio y todo fuego visible en el navegador es
   presentación derivada, nunca un dato del asset.

La salida es la provenencia de los anclajes de `apps/web/src/fx-lab/fx-fire-anchors.ts` y se versiona
junto a la evidencia (`--json`). Sin este archivo, los números del laboratorio serían fe ciega.

Uso:
    python3 scripts/fx-fire-anchor-measure.py --all-bld \
        --json docs/art/graphics-capabilities/evidence/phaser/fire_anchor_measure.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "apps" / "web" / "public" / "assets" / "runtime" / "blender"
MANIFEST = REPO / "apps" / "web" / "src" / "generated" / "runtime-assets-blender.json"
MIN_COMPONENT_PX = 6
STATES = ("complete", "construction", "damaged", "burning")
# Las mismas fracciones del runtime: mover una sin mover la otra dejaría de ser evidencia.
ROOF_WIDTH_FRACTION = 0.35
ROOF_BAND_FRACTION = 0.2


def load(name: str, assets: Path) -> Image.Image:
    path = assets / name
    if not path.is_file():
        sys.exit(f"falta el asset {path}")
    with Image.open(path) as raw:
        return raw.convert("RGBA")


def sha256(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def row_widths(image: Image.Image) -> list[int]:
    """Píxeles opacos por fila: la silueta leída como perfil, que es lo que el navegador recorre."""
    width, height = image.size
    data = list(image.getdata())
    return [
        sum(1 for px in data[y * width : (y + 1) * width] if px[3] > 8) for y in range(height)
    ]


def roof_line(image: Image.Image) -> tuple[int, float] | None:
    """Primera fila con píxeles opacos y su centroide horizontal, en píxeles del sprite."""
    width = image.size[0]
    data = list(image.getdata())
    for y in range(image.size[1]):
        xs = [x for x, px in enumerate(data[y * width : (y + 1) * width]) if px[3] > 8]
        if len(xs) >= 3:
            return y, sum(xs) / len(xs)
    return None


def landmarks(image: Image.Image) -> dict | None:
    """Los tres hitos que usa el runtime, calculados con su mismo algoritmo sobre el mismo PNG."""
    width, height = image.size
    widths = row_widths(image)
    max_width = max(widths)
    if not max_width:
        return None
    roof_row = next(
        (y for y, count in enumerate(widths) if count >= max_width * ROOF_WIDTH_FRACTION), -1
    )
    if roof_row < 0:
        return None
    band_end = min(height, roof_row + round(height * ROOF_BAND_FRACTION))
    data = list(image.getdata())
    sum_x = 0
    sum_y = 0
    pixels = 0
    for y in range(roof_row, band_end):
        for x, px in enumerate(data[y * width : (y + 1) * width]):
            if px[3] <= 8:
                continue
            sum_x += x
            sum_y += y
            pixels += 1
    if not pixels:
        return None
    return {
        "spritePx": [width, height],
        "maxRowWidthPx": max_width,
        "roofRowPx": roof_row,
        "roofRowV": round(roof_row / height, 4),
        "roofBandEndV": round(band_end / height, 4),
        "roofCentroidUv": [round(sum_x / pixels / width, 4), round(sum_y / pixels / height, 4)],
        "meaning": "cubierta real de ESTE edificio: la primera fila con ancho estructural y el "
        "centroide de su banda, que es donde el laboratorio ancla el foco de azotea",
    }


def silhouette(image: Image.Image) -> set[tuple[int, int]]:
    width, height = image.size
    data = list(image.getdata())
    return {
        (x, y)
        for y in range(height)
        for x, px in enumerate(data[y * width : (y + 1) * width])
        if px[3] > 8
    }


def warm_mask(image: Image.Image) -> set[tuple[int, int]]:
    """Píxel cálido: el rojo manda sobre el azul y hay luz suficiente. Es la firma del fuego."""
    width, height = image.size
    data = list(image.getdata())
    out: set[tuple[int, int]] = set()
    for y in range(height):
        for x, px in enumerate(data[y * width : (y + 1) * width]):
            r, g, b, a = px
            if a > 8 and r > 130 and r - b > 28 and r - g > 8:
                out.add((x, y))
    return out


def changed_pixels(burning: Image.Image, base: Image.Image) -> set[tuple[int, int]] | str:
    """Diferencia real entre el estado ardiendo y el intacto: lo que el incendio pintó encima."""
    if burning.size != base.size:
        return "burning y complete no miden igual; no se puede atribuir el cambio"
    width, height = burning.size
    a = list(burning.getdata())
    b = list(base.getdata())
    out: set[tuple[int, int]] = set()
    for y in range(height):
        for x in range(width):
            i = y * width + x
            pa, pb = a[i], b[i]
            if max(abs(pa[c] - pb[c]) for c in range(4)) > 24 and pa[3] > 8:
                out.add((x, y))
    return out


def components(pixels: set[tuple[int, int]], width: int, height: int) -> list[list[tuple[int, int]]]:
    """Etiquetado 8-conexas con BFS: sin dependencias científicas, sobre 26 k píxeles es instantáneo."""
    todo = set(pixels)
    found: list[list[tuple[int, int]]] = []
    while todo:
        seed = next(iter(todo))
        todo.discard(seed)
        blob = [seed]
        queue = deque([seed])
        while queue:
            x, y = queue.popleft()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (x + dx, y + dy)
                    if n in todo:
                        todo.discard(n)
                        blob.append(n)
                        queue.append(n)
        if len(blob) >= MIN_COMPONENT_PX:
            found.append(blob)
    found.sort(key=len, reverse=True)
    return found


def describe(blob, width: int, height: int) -> dict:
    xs = [p[0] for p in blob]
    ys = [p[1] for p in blob]
    return {
        "pixels": len(blob),
        "bboxPx": [min(xs), min(ys), max(xs), max(ys)],
        "centroidUv": [round(sum(xs) / len(xs) / width, 4), round(sum(ys) / len(ys) / height, 4)],
        "heightPx": max(ys) - min(ys) + 1,
        "widthPx": max(xs) - min(xs) + 1,
    }


def state_hashes(building_type: str, assets: Path) -> dict:
    hashes = {
        state: sha256(assets / f"{building_type}-{state}.png")
        for state in STATES
        if (assets / f"{building_type}-{state}.png").is_file()
    }
    distinct = {value for value in hashes.values() if value}
    return {
        "sha256": hashes,
        "estadosDeclarados": len(hashes),
        "distinctHashes": len(distinct),
        # Un solo hash entre cuatro estados = no hay arte de incendio en el catálogo.
        "estadosIdenticos": len(distinct) == 1 and len(hashes) > 1,
    }


def measure(building_type: str, assets: Path) -> dict:
    base = load(f"{building_type}-complete.png", assets)
    burning = load(f"{building_type}-burning.png", assets)
    width, height = burning.size
    roof = roof_line(base)
    changed = changed_pixels(burning, base)
    if isinstance(changed, str):
        return {
            "buildingType": building_type,
            "error": changed,
            "stateHashes": state_hashes(building_type, assets),
        }
    fire = warm_mask(burning) & changed
    blobs = components(fire, width, height)
    opaque = silhouette(base)
    hashes = state_hashes(building_type, assets)
    return {
        "buildingType": building_type,
        "stateHashes": hashes,
        "spritePx": [width, height],
        "opaquePixelsComplete": len(opaque),
        "landmarks": landmarks(base),
        "roofLine": None
        if roof is None
        else {
            "rowPx": roof[0],
            "v": round(roof[0] / height, 4),
            "u": round(roof[1] / width, 4),
            "meaning": "primera fila opaca del sprite complete: la cubierta real de ESTE edificio",
        },
        "firePixels": len(fire),
        "focos": [describe(blob, width, height) for blob in blobs],
        "nota": (
            "foco = componente conexa de píxel cálido QUE ADEMÁS cambia respecto al sprite intacto. "
            f"firePixels=0 con estadosIdenticos=True confirma que el bake no pinta fuego: el incendio "
            "del laboratorio es 100 % presentación derivada de la silueta (`landmarks`), que es justo "
            "lo que implementa fx-fire-anchors.ts."
        ),
    }


def declared_bld(assets_dir: Path) -> list[str]:
    """Los módulos del Composer declarados en el manifiesto runtime, sin inventar ninguno."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    buildings = manifest.get("buildings", manifest.get("assets", {}))
    return sorted(
        key
        for key in buildings
        if key.startswith("bld_") and (assets_dir / f"{key}-complete.png").is_file()
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", action="append", dest="types")
    parser.add_argument("--all-bld", action="store_true")
    parser.add_argument("--assets-dir", default=str(ASSETS))
    parser.add_argument("--json", dest="json_out")
    args = parser.parse_args()
    assets = Path(args.assets_dir)
    types = declared_bld(assets) if args.all_bld else (args.types or ["bld_commercial_c"])
    report = {
        "schemaVersion": 2,
        "generatedBy": "scripts/fx-fire-anchor-measure.py",
        "task": "D-111.2 FASE 4.4 — anclajes de incendio medidos sobre el bake",
        "assetsDir": str(assets.relative_to(REPO)),
        "manifest": str(MANIFEST.relative_to(REPO)),
        "roofWidthFraction": ROOF_WIDTH_FRACTION,
        "roofBandFraction": ROOF_BAND_FRACTION,
        "buildings": [measure(t, assets) for t in types],
    }
    identical = [b["buildingType"] for b in report["buildings"] if b.get("stateHashes", {}).get("estadosIdenticos")]
    report["hallazgo"] = (
        f"{len(identical)} de {len(types)} módulos del catálogo runtime tienen los cuatro estados "
        f"byte-idénticos: {', '.join(identical)}. No existe arte de `burning` que el navegador pueda "
        "copiar, así que el incendio es derivación de silueta y el perfil de candidato pasa los gates "
        "por omisión en lo que a estados se refiere."
        if identical
        else "todos los módulos medidos traen arte distinto por estado"
    )
    text = json.dumps(report, indent=1, ensure_ascii=False)
    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(f"{text}\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

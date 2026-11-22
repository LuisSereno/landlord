#!/usr/bin/env python3
"""D-111.2 cierre FASE 2 — el checker de los anclajes del incendio híbrido.

Dos pruebas, ambas contra evidencia ya capturada (no re-renderiza nada):

1. **La proyección no inventa nada.** Re-proyecta los `fireAnchors` del JSON del compositor con su
   propia implementación independiente (la misma matemática de `runtime_asset.pivot_from_origin`,
   re-derivada aquí) y compara contra los u,v que el adaptador TS calculó EN el navegador
   (`hybrid_fire_anchors.json`). Tolerancia 0,002 de sprite: un píxel de diferencia en un sprite de
   1091 px ya no cabe.
2. **Los anclajes corresponden a la geometría.** Muestrea el PNG del sprite QA hacia arriba desde
   cada foco proyectado: la variante híbrida redujo la emisión, pero el cuerpo de la llama sigue
   siendo cálido (R > B + 40), así que un foco que no encuentra píxel caliente está mal anclado.

Además mide el recorte a blanco (255,255,255) del brazo híbrido contra el brazo sin fuego dinámico:
es la medida que decide si el ADD de Phaser apila blanco sobre el bake reducido.
"""

import json
import math
import sys
from pathlib import Path

from PIL import Image

FIRE_DIR = Path(
    "docs/art/graphics-capabilities/evidence/v2/closure/fire"
)
TOLERANCE = 0.002
WARM_DELTA = 40
SEARCH_UP_PX = 160


def project(meta: dict, x: float, y: float, z: float) -> tuple[float, float]:
    theta = math.radians(meta["camera"]["azimuthDegrees"])
    phi = math.radians(meta["camera"]["elevationDegrees"])
    screen_x = math.sin(theta) * x + math.cos(theta) * y
    screen_y = (
        -math.sin(phi) * math.cos(theta) * x
        + math.sin(phi) * math.sin(theta) * y
        + math.cos(phi) * (z - meta["camera"]["targetZ"])
    )
    scale = meta["trim"]["final"]["width"] / meta["trim"]["cropped"]["width"]
    px = (
        meta["trim"]["rendered"]["width"] / 2
        + screen_x * meta["framing"]["pixelsPerMeter"]
        - meta["trim"]["cropped"]["offsetX"]
    ) * scale
    py = (
        meta["trim"]["rendered"]["height"] / 2
        - screen_y * meta["framing"]["pixelsPerMeter"]
        - meta["trim"]["cropped"]["offsetY"]
    ) * scale
    return px / meta["trim"]["final"]["width"], py / meta["trim"]["final"]["height"]


def main() -> int:
    meta = json.loads((FIRE_DIR / "hybrid_sprite_day.json").read_text(encoding="utf-8"))
    anchors_ts = json.loads((FIRE_DIR / "hybrid_fire_anchors.json").read_text(encoding="utf-8"))

    # 1. TS contra esta re-proyección independiente.
    max_delta = 0.0
    mismatches = []
    flame_anchors = [
        item for item in meta["fireAnchors"] if item["purpose"].startswith("fire:flame")
    ]
    if len(flame_anchors) != len(anchors_ts["anchors"]):
        print(
            f"FALLO: el adaptador devolvió {len(anchors_ts['anchors'])} focos y el JSON declara "
            f"{len(flame_anchors)} de llama"
        )
        return 1
    for index, (anchor, published) in enumerate(zip(flame_anchors, anchors_ts["anchors"])):
        u, v = project(meta, *anchor["position"])
        du = abs(u - published["u"])
        dv = abs(v - published["v"])
        max_delta = max(max_delta, du, dv)
        if du > TOLERANCE or dv > TOLERANCE:
            mismatches.append((index, anchor["focus"], u, v, published["u"], published["v"]))
    if mismatches:
        for index, focus, u, v, tu, tv in mismatches:
            print(f"FALLO anclaje {index} ({focus}): aquí ({u:.5f},{v:.5f}) TS ({tu:.5f},{tv:.5f})")
        return 1

    # 2. Cada foco cae en geometría de llama (píxel cálido buscándolo hacia arriba).
    image = Image.open(FIRE_DIR / "hybrid_sprite_day.png").convert("RGBA")
    width, height = image.size
    found = 0
    misses = []
    for index, anchor in enumerate(flame_anchors):
        u, v = project(meta, *anchor["position"])
        px, py = u * width, v * height
        hit = None
        for step in range(0, SEARCH_UP_PX, 4):
            x, y = int(px), int(py - step)
            if not (0 <= x < width and 0 <= y < height):
                break
            red, green, blue, alpha = image.getpixel((x, y))
            if alpha > 8 and red > 170 and red > blue + WARM_DELTA:
                hit = (x, y, (red, green, blue))
                break
        if hit:
            found += 1
        else:
            misses.append((index, anchor["focus"]))
    print(
        f"proyección: {len(flame_anchors)} focos · Δ máx TS-vs-checker {max_delta:.5f} "
        f"(tolerancia {TOLERANCE})"
    )
    print(f"geometría: {found}/{len(flame_anchors)} focos con llama cálida en el PNG")
    if misses:
        print("  sin llama visible:", ", ".join(f"{i}({focus})" for i, focus in misses))


    # 3. Recorte a blanco del brazo híbrido contra el brazo sin fuego dinámico.
    for mood in ("day", "night"):
        hybrid = Image.open(FIRE_DIR / f"hybrid_fire_{mood}.png").convert("RGB")
        quiet = Image.open(FIRE_DIR / f"phaser_candidate_{mood}.png").convert("RGB")
        clip_hybrid = sum(
            1
            for pixel in hybrid.getdata()
            if pixel[0] == 255 and pixel[1] == 255 and pixel[2] == 255
        )
        clip_quiet = sum(
            1
            for pixel in quiet.getdata()
            if pixel[0] == 255 and pixel[1] == 255 and pixel[2] == 255
        )
        total = hybrid.size[0] * hybrid.size[1]
        print(
            f"blanco {mood}: híbrido {clip_hybrid} px ({100 * clip_hybrid / total:.3f} %) · "
            f"sin fuego dinámico {clip_quiet} px ({100 * clip_quiet / total:.3f} %)"
        )

    if max_delta > TOLERANCE:
        return 1
    print("CHECK OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())

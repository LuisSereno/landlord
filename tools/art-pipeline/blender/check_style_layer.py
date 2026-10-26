"""Comprobación estática del `externalTreatment` contra los atlas reales del staging.

Corre con python3 normal, sin Blender, y usa la MISMA matemática que el render
(`style_layer_math.style_pixels`). Su razón de ser es un fallo que sólo se veía en el pixel final:
una celda de atlas que ninguna banda reclama conserva su color de día a plena luz, así que aparece
un panel blancuzco o un acento saturado perdido en mitad de una ciudad nocturna. Con packs que
comparten un único atlas llamado `colormap`, eso es invisible hasta que se renderiza.

Chequea, sobre las texturas de los jobs publicados en el bundle:
  * cobertura  → toda celda de swatch la reclama una banda;
  * vigas       → ninguna banda declarada es inalcanzable (config muerta);
  * escalera    → todo albedo cae en la franja nocturna y la separación entre familias no colapsa.

Uso (desde la raíz del repo):
  python3 tools/art-pipeline/blender/check_style_layer.py
"""

import json
import struct
import sys
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))

from style_layer_math import rgb_to_hsv, style_pixels  # noqa: E402

STYLE_LAYER_PATH = HERE / "style_layer_graphic_civic.json"
JOBS_PATH = REPO_ROOT / "blender_artist" / "manifests" / "asset-jobs.json"
# Los atlas de Kenney son una retícula de swatches; el tamaño de celda lo declara el style layer.
SKIP_TEXTURE_TOKENS = ("normal", "rough", "metal", "ao", "occlusion", "emissive", "mask")
COLOR_TOKENS = ("colormap", "palette", "texture", "diffuse", "albedo", "basecolor", "color")


def read_png_rgba(path):
    """Decodificador mínimo de PNG 8-bit no entrelazado: sin dependencias fuera de stdlib+numpy."""
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{path}: no es PNG"
    pos = 8
    width = height = depth = ctype = interlace = None
    palette = None
    idat = []
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            width, height, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            assert depth == 8 and interlace == 0, f"{path}: esperado PNG 8-bit no entrelazado"
        elif kind == b"PLTE":
            palette = np.frombuffer(chunk, dtype=np.uint8).reshape(-1, 3)
        elif kind == b"IDAT":
            idat.append(chunk)
        elif kind == b"IEND":
            break
        pos += 12 + length
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(b"".join(idat))
    stride = width * channels
    previous = np.zeros(stride, dtype=np.uint8)
    rows = []
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        line = np.frombuffer(raw[offset : offset + stride], dtype=np.uint8).astype(np.int32)
        offset += stride
        if filter_type == 1:
            line = (line + np.pad(line[:-1], (1, 0), constant_values=0)) & 0xFF
        elif filter_type == 2:
            line = (line + previous) & 0xFF
        elif filter_type == 3:
            left = np.pad(line[:-1], (1, 0), constant_values=0)
            line = (line + ((left + previous) >> 1)) & 0xFF
        elif filter_type == 4:
            left = np.pad(line[:-1], (1, 0), constant_values=0)
            up_left = np.pad(previous[:-1], (1, 0), constant_values=0)
            p = left + previous - up_left
            pa = np.abs(p - left)
            pb = np.abs(p - previous)
            pc = np.abs(p - up_left)
            predictor = np.where((pa <= pb) & (pa <= pc), left, np.where(pb <= pc, previous, up_left))
            line = (line + predictor) & 0xFF
        previous = line
        rows.append(line)
    pixels = np.array(rows, dtype=np.uint8).reshape(height, width, channels)
    if ctype == 3:
        assert palette is not None, f"{path}: PNG de paleta sin PLTE"
        rgb = palette[pixels[:, :, 0]]
    elif channels == 4:
        rgb = pixels[:, :, :3]
    elif channels == 3:
        rgb = pixels
    elif channels == 2:
        rgb = np.repeat(pixels[:, :1], 3, axis=2)
    else:
        rgb = np.repeat(pixels[:, :, None], 3, axis=2)
    return rgb.astype(np.float32) / 255.0


def referenced_textures(job):
    """Texturas que el propio archivo del job declara, resueltas contra su carpeta.

    No se puede globbear `Textures/`: Kenney la usa y KayKit guarda el atlas al lado del .gltf.
    El check tiene que mirar exactamente lo que el render va a cargar, o mide otra cosa.
    """
    model = (REPO_ROOT / job["source"]["path"]).resolve()
    uris = []
    if model.is_file():
        data = model.read_bytes()
        document = None
        if data[:4] == b"glTF":
            chunk_length = struct.unpack("<I", data[12:16])[0]
            document = json.loads(data[20 : 20 + chunk_length])
        else:
            try:
                document = json.loads(data.decode("utf-8"))
            except UnicodeDecodeError:
                document = None
        if document is not None:
            # El `kind` del manifiesto no siempre coincide con la extensión real (nature-kit declara
            # `gltf` y entrega `.glb`), así que se decide por el contenido del archivo.
            uris = [
                image.get("uri", "")
                for image in document.get("images", [])
                if not image.get("uri", "").startswith("data:")
            ]
    if not uris and job["source"]["kind"] == "fbx":
        uris = [str(p.relative_to(model.parent)) for p in (model.parent / "Textures").glob("*.png")]
    out = []
    for uri in uris:
        texture = (model.parent / uri).resolve()
        name = texture.name.lower()
        if not texture.is_file() or not name.endswith(".png"):
            continue
        if any(token in name for token in SKIP_TEXTURE_TOKENS):
            continue
        if not any(token in name for token in COLOR_TOKENS):
            continue
        out.append(texture)
    return out


def swatch_colors(rgb, min_pixels=16):
    """Colores presentes en el atlas, cuantizados, con su peso.

    No se asume retícula: Kenney usa celdas de 64 px con degradado y KayKit usa una paleta propia.
    Cuantificando a 16 niveles por canal se obtiene el mismo conjunto de familias sea cual sea el
    layout, y un color que ocupa menos de `min_pixels` es ruido de filtrado, no un material.
    """
    quantized = (np.round(rgb * 15).astype(np.uint8))
    flat = quantized.reshape(-1, 3)
    codes = (flat[:, 0].astype(np.uint16) << 8) | (flat[:, 1].astype(np.uint16) << 4) | flat[:, 2]
    code, counts = np.unique(codes, return_counts=True)
    colors = []
    for entry, total in zip(code, counts):
        if total < min_pixels:
            continue
        red = int(entry >> 8) & 15
        green = int(entry >> 4) & 15
        blue = int(entry) & 15
        color = ((red + 0.5) / 16, (green + 0.5) / 16, (blue + 0.5) / 16)
        colors.append((color, int(total)))
    return colors


def main():
    treatment = json.loads(STYLE_LAYER_PATH.read_text())["externalTreatment"]
    jobs = json.loads(JOBS_PATH.read_text())["jobs"]
    bands = treatment.get("hueBands", [])
    night_ceiling = float(treatment.get("acceptance", {}).get("nightValueCeiling", 0.62))
    min_floor = float(treatment.get("acceptance", {}).get("darkestValueFloor", 0.05))

    claimed_counts = {band["id"]: 0 for band in bands}
    band_by_index = {index: band["id"] for index, band in enumerate(bands)}
    values_by_band = {band["id"]: [] for band in bands}
    uncovered = []
    atlases = set()
    for job in jobs:
        if job["source"]["kind"] == "procedural" or job.get("target") != "bundle":
            continue
        for texture in referenced_textures(job):
            atlases.add(str(texture))
            rgb = read_png_rgba(texture)
            samples = swatch_colors(rgb)
            if not samples:
                continue
            stack = np.array([color for color, _ in samples], dtype=np.float32).reshape(
                1, len(samples), 3
            )
            result = style_pixels(stack, treatment, job["kind"])
            _, _, val = rgb_to_hsv(stack)
            claimed = result["claimed_by"].reshape(-1)
            out_value = result["out_value"].reshape(-1)
            for index, (band_code, source_v) in enumerate(zip(claimed, val.reshape(-1))):
                if source_v < 0.06:
                    continue  # swatches de relleno negro: no forman parte de la escalera
                if band_code < 0:
                    uncovered.append(
                        {
                            "texture": str(texture.relative_to(REPO_ROOT)),
                            "kind": job["kind"],
                            "rgb": tuple(
                                int(c) for c in np.round(np.array(samples[index][0]) * 255)
                            ),
                            "pixels": samples[index][1],
                        }
                    )
                    continue
                name = band_by_index[int(band_code)]
                claimed_counts[name] += samples[index][1]
                values_by_band[name].append(float(out_value[index]))

    print(f"atlas revisados: {len(atlases)}")
    print(f"{'familia':34} {'peso':>8} {'V min':>7} {'V media':>8} {'V max':>7}")
    ladder = []
    for band in bands:
        name = band["id"]
        vs = values_by_band[name]
        if not vs:
            print(f"{name:34} {0:>8}      -- VACÍA: banda declarada pero inalcanzable")
            ladder.append(None)
            continue
        ladder.append((name, max(vs), float(np.mean(vs))))
        print(
            f"{name:34} {claimed_counts[name]:>8} {min(vs):>7.2f} {np.mean(vs):>8.2f} {max(vs):>7.2f}"
        )

    failures = []
    if uncovered:
        sample = uncovered[:10]
        failures.append(
            "celdas sin banda (conservan su color de día): %d. Ejemplos: %s"
            % (len(uncovered), "; ".join(str(s) for s in sample))
        )
    dead = [band["id"] for band in bands if claimed_counts[band["id"]] == 0]
    if dead:
        failures.append("bandas inalcanzables (config muerta): %s" % ", ".join(dead))
    entries = [entry for entry in ladder if entry is not None]
    if entries:
        # El techo se comprueba por MÁXIMO, no por media: un solo swatch que se quede en plena luz
        # de día es precisamente el fallo que este check existe para cazar.
        hottest = max(entries, key=lambda entry: entry[1])
        if hottest[1] > night_ceiling:
            failures.append(
                "la familia %s tiene celdas en V=%.2f, por encima del techo nocturno %.2f"
                % (hottest[0], hottest[1], night_ceiling)
            )
        coldest = min(entries, key=lambda entry: entry[1])
        if coldest[1] < min_floor:
            failures.append(
                "la familia %s baja a V=%.2f: se pierde el volumen bajo la luz"
                % (coldest[0], coldest[1])
            )
        means = [entry[2] for entry in entries]
        if max(means) - min(means) < 0.15:
            failures.append(
                "la escalera de valores sólo abarca %.2f–%.2f: sin separación entre materiales"
                % (min(means), max(means))
            )
    if failures:
        print("\nFALLA el style layer:")
        for message in failures:
            print("  - " + message)
        return 1
    print("\nOK: cobertura total, todas las bandas alcanzables, escalera nocturna separada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

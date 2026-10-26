"""Matemática de color del style layer, sin `bpy`.

Vive separada de `runtime_asset.py` porque `check_style_layer.py` tiene que predecir exactamente el
mismo remapeo que el render sin arrancar Blender. Si el código se duplicara, el check mediría otra
cosa que la pipeline aplica.
"""

import numpy as np


def srgb_to_linear(values):
    values = np.asarray(values, dtype=np.float32)
    return np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(values):
    values = np.asarray(values, dtype=np.float32)
    return np.where(values <= 0.0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - 0.055)


def rgb_to_hsv(rgb):
    """HSV sobre sRGB (0..1). El atlas de Kenney se trata como color de artista, no lineal."""
    rgb = np.asarray(rgb, dtype=np.float32)
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = rgb.max(axis=-1)
    minc = rgb.min(axis=-1)
    delta = maxc - minc
    hue = np.zeros_like(maxc)
    chromatic = delta > 1e-6
    is_red = chromatic & (maxc == red)
    is_green = chromatic & (maxc == green) & ~is_red
    is_blue = chromatic & ~is_red & ~is_green
    hue[is_red] = ((green[is_red] - blue[is_red]) / delta[is_red]) % 6
    hue[is_green] = (blue[is_green] - red[is_green]) / delta[is_green] + 2
    hue[is_blue] = (red[is_blue] - green[is_blue]) / delta[is_blue] + 4
    saturation = np.zeros_like(maxc)
    np.divide(delta, maxc, out=saturation, where=maxc > 1e-6)
    return hue * 60.0, saturation, maxc


def hsv_to_rgb(hue, saturation, value):
    hue = (np.asarray(hue, dtype=np.float32) % 360.0) / 60.0
    saturation = np.asarray(saturation, dtype=np.float32)
    value = np.asarray(value, dtype=np.float32)
    chroma = value * saturation
    x = chroma * (1 - np.abs(hue % 2 - 1))
    match = np.floor(hue).astype(np.int32) % 6
    red = np.choose(match, [chroma, x, 0, 0, x, chroma])
    green = np.choose(match, [x, chroma, chroma, x, 0, 0])
    blue = np.choose(match, [0, 0, x, chroma, chroma, x])
    offset = value - chroma
    return np.clip(np.stack([red + offset, green + offset, blue + offset], axis=-1), 0, 1)


def hue_in(hue, band):
    low, high = band
    return (hue >= low) & (hue <= high) if low <= high else (hue >= low) | (hue <= high)


def in_range(values, band):
    return (values >= band[0]) & (values <= band[1])


def name_matches(name, keywords):
    lowered = str(name).lower()
    return any(keyword in lowered for keyword in keywords)


def band_mask(hue, saturation, value, band, kind):
    """Máscara de familia, siempre evaluada sobre el HSV de ORIGEN."""
    if band.get("kinds") and kind not in band["kinds"]:
        return None
    return (
        hue_in(hue, band["hue"])
        & in_range(saturation, band["sat"])
        & in_range(value, band["value"])
    )


def style_pixels(source_rgb, treatment, kind):
    """Aplica `externalTreatment` a un bloque de sRGB y devuelve el resultado y quién lo reclamó.

    `claimed_by` es un entero por píxel: el índice de la banda que se lo quedó, o -1 si cayó fuera
    de todas. El check lo usa para exigir cobertura; el render sólo usa `styled_rgb` y
    `window_mask`.
    """
    rgb = np.asarray(source_rgb, dtype=np.float32)
    hue, saturation, value = rgb_to_hsv(rgb)
    global_config = treatment.get("global", {})
    kind_override = treatment.get("kindOverrides", {}).get(kind, {})
    # El override de kind MODULA el global, no lo sustituye: así "terreno un 15% más oscuro" se
    # escribe sin repetir en cada categoría el nivel absoluto de la noche.
    out_saturation = (
        saturation
        * global_config.get("saturationScale", 1.0)
        * kind_override.get("saturationScale", 1.0)
    )
    out_value = (
        value
        * global_config.get("valueScale", 1.0)
        * kind_override.get("valueScale", 1.0)
    )
    out_hue = hue.copy()
    bands = treatment.get("hueBands", [])
    claimed_by = np.full(hue.shape, -1, dtype=np.int16)
    # Primer match gana: una cara de atlas pertenece a UNA familia. Sin esto, dos bandas cuyos
    # rangos se solapan apilan sus escalas y el resultado depende del orden de multiplicación.
    claimed = np.zeros(hue.shape, dtype=bool)
    for index, band in enumerate(bands):
        mask = band_mask(hue, saturation, value, band, kind)
        if mask is None:
            continue
        mask &= ~claimed
        claimed |= mask
        claimed_by[mask] = index
        if "hueTo" in band:
            out_hue[mask] = band["hueTo"]
        elif "hueOffset" in band:
            out_hue[mask] = (out_hue[mask] + band["hueOffset"]) % 360
        out_saturation[mask] *= band.get("saturationScale", 1.0)
        out_value[mask] *= band.get("valueScale", 1.0)
    for band in treatment.get("valueBands", []):
        mask = band_mask(hue, saturation, value, band, kind)
        if mask is None:
            continue
        out_value[mask] *= band.get("valueScale", 1.0)
        if "saturationScale" in band:
            out_saturation[mask] *= band["saturationScale"]
    styled_rgb = hsv_to_rgb(out_hue, np.clip(out_saturation, 0, 1), np.clip(out_value, 0, 1))
    multiply = np.array(global_config.get("multiplySrgb", [1.0, 1.0, 1.0]), dtype=np.float32)
    styled_rgb = np.clip(styled_rgb * multiply, 0.0, 1.0)

    glow = treatment.get("windowGlow")
    window_mask = None
    if glow and kind in glow.get("kinds", []):
        window_mask = (
            hue_in(hue, glow["hue"])
            & in_range(saturation, glow["sat"])
            & in_range(value, glow["value"])
        )
    return {
        "styled_rgb": styled_rgb,
        "window_mask": window_mask,
        "claimed_by": claimed_by,
        "out_hue": out_hue,
        "out_saturation": np.clip(out_saturation, 0, 1),
        "out_value": np.clip(out_value, 0, 1),
    }

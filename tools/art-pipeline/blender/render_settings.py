"""Resolución y aplicación única de los ajustes de render del mood activo."""

import copy
import os


def _merge(base, override):
    """Mezcla perfiles declarativos sin compartir estructuras mutables."""
    merged = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def _resolve_profile(profiles, mood_id, seen=()):
    if mood_id in seen:
        raise ValueError("ciclo de herencia de mood: " + " → ".join((*seen, mood_id)))
    if mood_id not in profiles:
        raise ValueError(f"activeMood desconocido: {mood_id}")
    profile = profiles[mood_id]
    parent_id = profile.get("extends")
    resolved = _resolve_profile(profiles, parent_id, (*seen, mood_id)) if parent_id else {}
    return _merge(resolved, {key: value for key, value in profile.items() if key != "extends"})


def _apply_band_overrides(profile):
    treatment = profile["externalTreatment"]
    overrides = treatment.pop("bandOverrides", {})
    if not overrides:
        return profile
    for band in treatment.get("hueBands", []):
        if band["id"] in overrides:
            band.update(overrides[band["id"]])
    return profile


def active_mood(style_layer):
    """Devuelve el perfil activo y falla explícitamente ante configuraciones incompletas."""
    mood_id = os.environ.get("LANDLORD_ART_MOOD", style_layer.get("activeMood"))
    profiles = style_layer.get("moodProfiles", {})
    if not mood_id:
        raise ValueError("style layer sin activeMood")
    profile = _apply_band_overrides(_resolve_profile(profiles, mood_id))
    required = ("lighting", "rendering", "externalTreatment", "shadow")
    missing = [key for key in required if key not in profile]
    if missing:
        raise ValueError(f"mood profile {mood_id} incompleto: {', '.join(missing)}")
    return profile


def apply_render_settings(scene, style_layer):
    """Aplica el color management declarado por el perfil activo a una escena Blender."""
    rendering = active_mood(style_layer)["rendering"]
    post = rendering["postProcessing"]
    scene.view_settings.view_transform = post.split(" - ")[0]
    try:
        scene.view_settings.look = post
    except TypeError:
        # Blender registra los looks de AgX como "AgX - …", pero los de Standard como
        # "Medium Contrast". El JSON conserva una gramática uniforme para ambos perfiles.
        scene.view_settings.look = post.split(" - ", 1)[-1]
    scene.view_settings.exposure = rendering.get("exposure", 0.0)
    return rendering

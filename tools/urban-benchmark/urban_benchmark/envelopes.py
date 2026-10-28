"""Per-family envelopes: the observed spread across the four reference cities."""

from __future__ import annotations

from typing import Any

import numpy as np

METRIC_PATHS = (
    ("street", "densityKmPerKm2"),
    ("street", "intersections"),
    ("street", "intersectionDensityPerKm2"),
    ("street", "meanEdgeLengthMeters"),
    ("street", "orientationEntropyBits"),
    ("blocks", "count"),
    ("blocks", "medianAreaM2"),
    ("blocks", "meanAreaM2"),
    ("blocks", "medianAreaCells4m"),
    ("built", "coveragePercent"),
    ("built", "buildingCount"),
    ("green", "coveragePercent"),
    ("facilities", "amenityCount"),
    ("facilities", "shopCount"),
    ("functionalMix", "distinctAmenityClasses"),
    ("functionalMix", "amenityFamilyEntropyBits"),
)


def _spread(values: list[float]) -> dict[str, float]:
    array = np.asarray(values, dtype=float)
    return {
        "min": round(float(array.min()), 3),
        "p25": round(float(np.percentile(array, 25)), 3),
        "median": round(float(np.percentile(array, 50)), 3),
        "p75": round(float(np.percentile(array, 75)), 3),
        "max": round(float(array.max()), 3),
        "samples": int(array.size),
    }


def _value(metric: dict[str, Any], group: str, key: str) -> float:
    raw = metric[group][key]
    if isinstance(raw, bool):
        return float(raw)
    return float(raw)


def build_envelopes(metrics: list[dict[str, Any]]) -> dict[str, Any]:
    families = sorted({metric["family"] for metric in metrics})
    envelopes: dict[str, Any] = {}
    for family in families:
        rows = [metric for metric in metrics if metric["family"] == family]
        per_metric: dict[str, Any] = {}
        for group, key in METRIC_PATHS:
            values = [_value(metric, group, key) for metric in rows]
            per_metric[f"{group}.{key}"] = _spread(values)
        cities = sorted({metric["city"] for metric in rows})
        envelopes[family] = {
            "cities": cities,
            "windowIds": sorted(metric["windowId"] for metric in rows),
            "metrics": per_metric,
        }
    return {
        "schemaVersion": 1,
        "note": (
            "Envelopes derived from real cities steer generator parameters. They are aggregate "
            "spreads, not layouts: no reference geometry is reproduced."
        ),
        "families": envelopes,
    }

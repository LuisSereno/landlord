"""Aggregate morphometric extraction. Returns numbers, never geometry."""

from __future__ import annotations

import math
from typing import Any

import geopandas as gpd
import numpy as np
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import MultiLineString, box as shp_box
from shapely.ops import polygonize, unary_union

from .fetch import Window

AMENITY_FAMILIES = {
    "education": {"school", "college", "university", "kindergarten"},
    "health": {"hospital", "clinic", "doctors", "dentist", "pharmacy", "nursing_home"},
    "public_service": {"police", "fire_station", "townhall", "community_centre", "library"},
    "worship": {"place_of_worship"},
    "food_retail": {"restaurant", "cafe", "fast_food", "bar", "pub", "marketplace", "food_court"},
    "mobility": {"bus_station", "taxi", "bicycle_parking", "parking", "fuel"},
}


def _utm_crs(lat: float, lon: float) -> str:
    zone = int((lon + 180.0) // 6) + 1
    return f"EPSG:{32600 + zone}" if lat >= 0 else f"EPSG:{32700 + zone}"


def _window_box(window: Window, crs: str):
    west, east, south, north = window.bbox
    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    x_min, y_min = transformer.transform(west, south)
    x_max, y_max = transformer.transform(east, north)
    return shp_box(x_min, y_min, x_max, y_max)


def _summary(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"count": 0, "mean": 0.0, "p25": 0.0, "median": 0.0, "p75": 0.0, "max": 0.0}
    array = np.asarray(values, dtype=float)
    return {
        "count": int(array.size),
        "mean": round(float(array.mean()), 2),
        "p25": round(float(np.percentile(array, 25)), 2),
        "median": round(float(np.percentile(array, 50)), 2),
        "p75": round(float(np.percentile(array, 75)), 2),
        "max": round(float(array.max()), 2),
    }


def _clip(gdf: gpd.GeoDataFrame | None, geometry) -> gpd.GeoDataFrame | None:
    if gdf is None or len(gdf) == 0:
        return gdf
    clipped = gpd.clip(gdf, geometry)
    return clipped[~clipped.geometry.is_empty]


def _count(gdf: gpd.GeoDataFrame | None) -> int:
    return 0 if gdf is None or len(gdf) == 0 else int(len(gdf))


def _union_area(gdf: gpd.GeoDataFrame | None) -> float:
    if gdf is None or len(gdf) == 0:
        return 0.0
    return float(unary_union(list(gdf.geometry)).area)


def _orientation_entropy(edge_gdf: gpd.GeoDataFrame, bins: int = 8) -> float:
    """Shannon entropy over length-weighted undirected bearings (0..3 bits for 8 bins)."""
    if edge_gdf is None or len(edge_gdf) == 0:
        return 0.0
    histogram = np.zeros(bins)
    width = 180.0 / bins
    for geometry, length in zip(edge_gdf.geometry, edge_gdf["length"], strict=True):
        coords = list(geometry.coords)
        if len(coords) < 2:
            continue
        dx = coords[-1][0] - coords[0][0]
        dy = coords[-1][1] - coords[0][1]
        if dx == 0 and dy == 0:
            continue
        bearing = math.degrees(math.atan2(dy, dx)) % 180.0
        histogram[min(int(bearing / width), bins - 1)] += float(length)
    total = histogram.sum()
    if total <= 0:
        return 0.0
    probabilities = histogram / total
    return round(-sum(p * math.log2(p) for p in probabilities if p > 0), 4)


def _block_areas(edge_gdf: gpd.GeoDataFrame, window_area: float) -> list[float]:
    if edge_gdf is None or len(edge_gdf) < 3:
        return []
    merged = unary_union(MultiLineString(list(edge_gdf.geometry)))
    areas: list[float] = []
    for polygon in polygonize(merged):
        if polygon.is_empty or not polygon.is_valid:
            continue
        area = float(polygon.area)
        # One 4x4 cell is the floor; anything above the window is the outer face.
        if 16.0 < area <= window_area * 1.2:
            areas.append(area)
    return areas


def _class_counts(gdf: gpd.GeoDataFrame | None, column: str) -> dict[str, int]:
    if gdf is None or len(gdf) == 0 or column not in gdf.columns:
        return {}
    counts: dict[str, int] = {}
    for value in gdf[column].dropna().astype(str):
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def _family_counts(gdf: gpd.GeoDataFrame | None, families: dict[str, set[str]]) -> dict[str, int]:
    counts = _class_counts(gdf, "amenity")
    return {
        name: sum(count for value, count in counts.items() if value in tag_values)
        for name, tag_values in families.items()
    }


def _mix_entropy(counts: dict[str, int]) -> float:
    total = sum(counts.values())
    if total <= 0:
        return 0.0
    return round(-sum((c / total) * math.log2(c / total) for c in counts.values() if c > 0), 4)


def extract_metrics(window: Window, layers: tuple[Any, ...]) -> dict[str, Any]:
    graph, buildings, greens, amenities, shops = layers
    crs = _utm_crs(window.lat, window.lon)
    geometry = _window_box(window, crs)

    projected_graph = ox.project_graph(graph, to_crs=crs)
    nodes, edges = ox.graph_to_gdfs(projected_graph, nodes=True, edges=True)
    edges_in = _clip(edges, geometry)
    nodes_in = _clip(nodes, geometry)

    street_length = float(edges_in["length"].sum()) if edges_in is not None and len(edges_in) else 0.0
    intersections = _count(nodes_in)
    area_km2 = window.area_m2 / 1_000_000.0

    blocks = _block_areas(edges_in, window.area_m2)
    block_stats = _summary(blocks)
    buildings_in = _clip(buildings, geometry)
    greens_in = _clip(greens, geometry)
    amenities_in = _clip(amenities, geometry)
    shops_in = _clip(shops, geometry)

    built = _union_area(buildings_in)
    green = _union_area(greens_in)
    mean_edge = (
        round(float(edges_in["length"].mean()), 2) if edges_in is not None and len(edges_in) else 0.0
    )

    return {
        "windowId": window.window_id,
        "city": window.city,
        "family": window.family,
        "label": window.label,
        "center": {"lat": window.lat, "lon": window.lon},
        "windowSideMeters": window.side_meters,
        "windowAreaM2": window.area_m2,
        "projection": crs,
        "street": {
            "lengthMetersTotal": round(street_length, 1),
            "densityKmPerKm2": round(street_length / 1000.0 / area_km2, 3),
            "intersections": intersections,
            "intersectionDensityPerKm2": round(intersections / area_km2, 2),
            "meanEdgeLengthMeters": mean_edge,
            "orientationEntropyBits": _orientation_entropy(edges_in),
        },
        "blocks": {
            "count": int(block_stats["count"]),
            "meanAreaM2": block_stats["mean"],
            "medianAreaM2": block_stats["median"],
            "p25AreaM2": block_stats["p25"],
            "p75AreaM2": block_stats["p75"],
            "maxAreaM2": block_stats["max"],
            "medianAreaCells4m": round(float(block_stats["median"]) / 16.0, 2),
        },
        "built": {
            "footprintAreaM2": round(built, 1),
            "coveragePercent": round(100.0 * built / window.area_m2, 2),
            "buildingCount": _count(buildings_in),
        },
        "green": {
            "areaM2": round(green, 1),
            "coveragePercent": round(100.0 * green / window.area_m2, 2),
        },
        "facilities": {
            "byFamily": _family_counts(amenities_in, AMENITY_FAMILIES),
            "amenityCount": _count(amenities_in),
            "shopCount": _count(shops_in),
        },
        "functionalMix": {
            "distinctAmenityClasses": len(_class_counts(amenities_in, "amenity")),
            "distinctShopClasses": len(_class_counts(shops_in, "shop")),
            "amenityFamilyEntropyBits": _mix_entropy(_family_counts(amenities_in, AMENITY_FAMILIES)),
        },
    }

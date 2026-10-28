"""Overpass fetching with endpoint rotation, backoff and a local JSON metric cache.

Raw OSM responses stay inside the gitignored cache. Only aggregates leave this module.
"""

from __future__ import annotations

import json
import math
import random
import time
from dataclasses import dataclass
from pathlib import Path

import osmnx as ox

# Public Overpass instances, base form: OSMnx appends "/interpreter" itself.
# Probed 2026-10-28: kumi.systems and maps.mail.ru answer empty or refuse non-allowlisted
# clients, so they are deliberately absent — a rotating dead endpoint silently yields zero-metric
# windows, which is worse than a failed run.
OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api",
    "https://overpass.private.coffee/api",
)

USER_AGENT = "landlord-urban-benchmark/1.0 (offline research tool; https://github.com/landlord)"

BUILDING_TAGS = {"building": True}
GREEN_TAGS = {
    "landuse": ["grass", "meadow", "forest", "recreation_ground", "village_green"],
    "leisure": ["park", "garden", "play_area", "pitch", "nature_reserve", "common"],
}
AMENITY_TAGS = {"amenity": True}
SHOP_TAGS = {"shop": True}


@dataclass(frozen=True)
class Window:
    window_id: str
    city: str
    family: str
    label: str
    lat: float
    lon: float
    side_meters: int

    @property
    def bbox(self) -> tuple[float, float, float, float]:
        """OSMnx order: (west, east, south, north) in degrees, centred on the anchor."""
        half_m = self.side_meters / 2.0
        half_lat = half_m / 111_320.0
        half_lon = half_m / (111_320.0 * math.cos(math.radians(self.lat)))
        return (
            self.lon - half_lon,
            self.lon + half_lon,
            self.lat - half_lat,
            self.lat + half_lat,
        )

    @property
    def area_m2(self) -> float:
        return float(self.side_meters) * float(self.side_meters)


def configure(cache_folder: Path, verbose: bool = False) -> None:
    cache_folder.mkdir(parents=True, exist_ok=True)
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(cache_folder)
    ox.settings.http_user_agent = USER_AGENT
    # OSMnx 1.9.3 crashes with UnboundLocalError inside _get_overpass_pause whenever a status
    # probe fails, so the probe is disabled and the backoff is owned by _fetch_with_retry.
    ox.settings.overpass_rate_limit = False
    ox.settings.requests_timeout = (10, 45)
    ox.settings.requests_kwargs = {"allow_redirects": True}
    ox.settings.log_console = verbose
    ox.settings.log_level = "INFO" if verbose else "ERROR"


def load_windows(manifest_path: Path) -> list[Window]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    side = int(manifest["windowSideMeters"])
    windows: list[Window] = []
    for city_key, city_block in manifest["cities"].items():
        for family in manifest["families"]:
            anchor = city_block[family]
            windows.append(
                Window(
                    window_id=f"{city_key}__{family}",
                    city=city_key,
                    family=family,
                    label=anchor["label"],
                    lat=float(anchor["lat"]),
                    lon=float(anchor["lon"]),
                    side_meters=side,
                )
            )
    return windows


def _is_transient(error: Exception) -> bool:
    text = f"{type(error).__name__}: {error}".lower()
    return any(
        needle in text
        for needle in (
            "502",
            "503",
            "504",
            "bad gateway",
            "gateway timeout",
            "read timeout",
            "timed out",
            "connection reset",
            "connection",
            "capacity",
            "max retries",
            "temporarily unavailable",
        )
    )


def _fetch_with_retry(fn, *args, attempts_per_endpoint: int = 2, rounds: int = 2, **kwargs):
    """Try every endpoint in rotation, then give up on this window.

    A 400 from a mirror is not a reason to abandon a 28-window sweep: an endpoint that
    rejects the query tells us nothing about the query, only about that mirror. The sweep
    records the failure, keeps the windows already extracted, and a re-run resumes only the gaps.
    """
    last_error: Exception | None = None
    for attempt_round in range(rounds):
        for endpoint in OVERPASS_ENDPOINTS:
            ox.settings.overpass_url = endpoint
            for attempt in range(attempts_per_endpoint):
                try:
                    return fn(*args, **kwargs)
                except Exception as error:  # noqa: BLE001 - re-raised after the rotation ends
                    last_error = error
                    if not _is_transient(error):
                        break
                    time.sleep(min(20.0, 2.0 ** (attempt + attempt_round) + random.random()))
        time.sleep(3.0)
    raise RuntimeError(f"all Overpass endpoints failed: {last_error}") from last_error


def fetch_layers(window: Window):
    """Return (graph, buildings, greens, amenities, shops) for one reference window."""
    bbox = window.bbox
    graph = _fetch_with_retry(
        ox.graph_from_bbox,
        bbox=bbox,
        network_type="all",
        simplify=True,
        truncate_by_edge=True,
    )
    buildings = _fetch_with_retry(ox.features_from_bbox, bbox=bbox, tags=BUILDING_TAGS)
    greens = _fetch_with_retry(ox.features_from_bbox, bbox=bbox, tags=GREEN_TAGS)
    amenities = _fetch_with_retry(ox.features_from_bbox, bbox=bbox, tags=AMENITY_TAGS)
    shops = _fetch_with_retry(ox.features_from_bbox, bbox=bbox, tags=SHOP_TAGS)
    return graph, buildings, greens, amenities, shops

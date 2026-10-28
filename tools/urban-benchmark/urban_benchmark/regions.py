"""Offline source: Geofabrik regional extracts cut to the reference windows.

The public Overpass API is a shared queue that answers 502 for hours at a time; a benchmark that
depends on it is not reproducible. This module downloads one regional extract per city, cuts the
seven reference windows out of it with pyosmium, and hands the result to OSMnx as local XML.

Nothing downloaded here is versioned: the cache is gitignored, and only aggregate metrics leave it.
"""

from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

import osmium
import osmnx as ox
from shapely.geometry import box

from .fetch import Window


def load_sources(manifest_path: Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def region_for(sources: dict, city: str) -> dict:
    region = sources["regions"].get(city)
    if region is None:
        raise ValueError(f"no regional extract declared for city {city!r}")
    return region


def download_region(sources: dict, city: str, cache_dir: Path, refresh: bool = False) -> Path:
    """Fetch one regional .osm.pbf into the cache, checking it against the declared byte size."""
    region = region_for(sources, city)
    regions_dir = cache_dir / "regions"
    regions_dir.mkdir(parents=True, exist_ok=True)
    target = regions_dir / f"{region['id']}.osm.pbf"
    expected = int(region["bytes"])
    if target.exists() and not refresh and target.stat().st_size == expected:
        return target
    if target.exists():
        target.unlink()

    partial = target.with_suffix(".pbf.part")
    print(f"  downloading {region['url']} ({expected / 1e6:.1f} MB)", flush=True)
    with urllib.request.urlopen(region["url"], timeout=120) as response, partial.open("wb") as sink:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            sink.write(chunk)
    size = partial.stat().st_size
    partial.rename(target)
    if size == 0:
        raise RuntimeError(f"{region['id']}: empty extract")
    if size != expected:
        print(
            f"  note: {region['id']} is {size} bytes, manifest declared {expected}; "
            "the extract moved upstream. Provenance records the bytes actually used.",
            flush=True,
        )
    return target


def window_bounds(window: Window, padding_meters: float = 40.0) -> tuple[float, float, float, float]:
    """(west, south, east, north) with a margin so ways that cross the border are kept whole."""
    west, east, south, north = window.bbox
    lat_pad = padding_meters / 111_320.0
    lon_pad = padding_meters / (111_320.0 * abs(math.cos(math.radians(window.lat))))
    return (west - lon_pad, south - lat_pad, east + lon_pad, north + lat_pad)


def _inside_any(lon: float, lat: float, bounds: list[tuple[float, float, float, float]]) -> bool:
    for west, south, east, north in bounds:
        if west <= lon <= east and south <= lat <= north:
            return True
    return False


class _WayCollector(osmium.SimpleHandler):
    """Pass 1: decide which ways touch any of the city's windows, and which nodes they need."""

    def __init__(self, bounds: list[tuple[float, float, float, float]]):
        super().__init__()
        self.bounds = bounds
        self.way_ids: set[int] = set()
        self.node_ids: set[int] = set()

    def way(self, way):  # noqa: D401 - pyosmium callback
        try:
            touches = any(_inside_any(node.lon, node.lat, self.bounds) for node in way.nodes)
        except osmium.InvalidLocationError:
            return
        if not touches:
            return
        self.way_ids.add(way.id)
        self.node_ids.update(node.ref for node in way.nodes)


class _ExtractWriter(osmium.SimpleHandler):
    """Pass 2: write the nodes, ways and self-contained relations that pass 1 selected."""

    def __init__(self, writer: osmium.SimpleWriter, way_ids: set[int], node_ids: set[int]):
        super().__init__()
        self.writer = writer
        self.way_ids = way_ids
        self.node_ids = node_ids

    def node(self, node):  # noqa: D401 - pyosmium callback
        if node.id in self.node_ids:
            self.writer.add_node(node)

    def way(self, way):
        if way.id in self.way_ids:
            self.writer.add_way(way)

    def relation(self, relation):
        # Only relations whose node/way members were all kept: a partial multipolygon has no usable
        # geometry and OSMnx fails to assemble it. Large parks that cross a window are therefore
        # missed; that bias is declared in provenance-v1.json instead of being papered over.
        members = [(member.type, member.ref) for member in relation.members]
        relevant = [(kind, ref) for kind, ref in members if kind in {"n", "w"}]
        if not relevant:
            return
        if all(
            ref in (self.node_ids if kind == "n" else self.way_ids) for kind, ref in relevant
        ):
            self.writer.add_relation(relation)


def build_city_extract(
    pbf_path: Path, windows: list[Window], out_path: Path, refresh: bool = False
) -> Path:
    """Cut the union of one city's windows out of its regional extract."""
    if out_path.exists() and not refresh and out_path.stat().st_mtime >= pbf_path.stat().st_mtime:
        return out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bounds = [window_bounds(window) for window in windows]

    collector = _WayCollector(bounds)
    collector.apply_file(str(pbf_path), locations=True)
    if not collector.way_ids:
        raise RuntimeError(f"no ways found for {out_path.stem}; check the window anchors")

    tmp = out_path.with_suffix(".tmp.osm")
    # pyosmium 4.x derives the format from the filename; a ".osm" target writes XML.
    writer = osmium.SimpleWriter(str(tmp), overwrite=True)
    try:
        handler = _ExtractWriter(writer, collector.way_ids, collector.node_ids)
        handler.apply_file(str(pbf_path), locations=True)
    finally:
        writer.close()
    tmp.replace(out_path)
    return out_path


def city_graph(xml_path: Path):
    # retain_all keeps every window's component: the union extract is seven disconnected pieces.
    return ox.graph_from_xml(str(xml_path), retain_all=True, simplify=True)


def window_features(xml_path: Path, window: Window, tags: dict):
    # Window.bbox is OSMnx order: (west, east, south, north).
    west, east, south, north = window.bbox
    return ox.features_from_xml(str(xml_path), polygon=box(west, south, east, north), tags=tags)


def extract_city_metrics(windows: list[Window], xml_path: Path) -> list[dict]:
    """Run the shared metric extractor for every window of one city from a local extract."""
    from .fetch import AMENITY_TAGS, BUILDING_TAGS, GREEN_TAGS, SHOP_TAGS
    from .metrics import extract_metrics

    graph = city_graph(xml_path)
    results = []
    for window in windows:
        layers = (
            graph,
            window_features(xml_path, window, BUILDING_TAGS),
            window_features(xml_path, window, GREEN_TAGS),
            window_features(xml_path, window, AMENITY_TAGS),
            window_features(xml_path, window, SHOP_TAGS),
        )
        results.append(extract_metrics(window, layers))
    return results

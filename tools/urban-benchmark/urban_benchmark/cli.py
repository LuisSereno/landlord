"""CLI for the offline morphological benchmark.

    python3 -m urban_benchmark.cli extract   # 28 windows -> aggregate metrics
    python3 -m urban_benchmark.cli envelopes # metrics -> per-family envelopes
    python3 -m urban_benchmark.cli all
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import platform
import sys
import time
from pathlib import Path

from . import __version__
from .envelopes import build_envelopes
from .fetch import OVERPASS_ENDPOINTS, configure, fetch_layers, load_windows
from .metrics import extract_metrics
from .regions import (
    build_city_extract,
    download_region,
    extract_city_metrics,
    load_sources,
    region_for,
)

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DEFAULT_MANIFEST = ROOT / "windows.json"
DEFAULT_SOURCES = ROOT / "sources.json"
DEFAULT_CACHE = ROOT / ".cache"
DEFAULT_OUTPUT = REPO / "docs" / "urban-benchmark"

# ODbL requires derived products to credit the source. The repository ships aggregates only.
ATTRIBUTION = {
    "source": "OpenStreetMap (https://www.openstreetmap.org/copyright)",
    "license": "ODbL 1.0",
    "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
    "extractedData": "aggregate morphometric statistics only; no OSM geometry is versioned or shipped",
}


def _toolchain() -> dict[str, object]:
    import geopandas
    import networkx
    import numpy
    import osmnx
    import pandas
    import shapely

    return {
        "urbanBenchmarkVersion": __version__,
        "python": sys.version.split()[0],
        "platform": f"{platform.system()}/{platform.machine()}",
        "osmnx": osmnx.__version__,
        "networkx": networkx.__version__,
        "geopandas": geopandas.__version__,
        "shapely": shapely.__version__,
        "numpy": numpy.__version__,
        "pandas": pandas.__version__,
        "overpassEndpoints": list(OVERPASS_ENDPOINTS),
    }


def _read_metrics(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))["windows"]


MIN_STREET_DENSITY_KM_PER_KM2 = 5.0
MIN_BUILT_COVERAGE_PERCENT = 2.0


def _degenerate_windows(metrics: list[dict]) -> list[dict]:
    """Flag windows that carry no morphology.

    A window over water, a park or an empty warehouse yard still returns numbers, and those numbers
    would enter an envelope as if they described a street grid. The gate needs to see them named.
    """
    flagged = []
    for metric in metrics:
        density = metric["street"]["densityKmPerKm2"]
        built = metric["built"]["coveragePercent"]
        if density < MIN_STREET_DENSITY_KM_PER_KM2 or built < MIN_BUILT_COVERAGE_PERCENT:
            flagged.append(
                {
                    "windowId": metric["windowId"],
                    "densityKmPerKm2": density,
                    "builtCoveragePercent": built,
                    "reason": (
                        "no street morphology"
                        if density < MIN_STREET_DENSITY_KM_PER_KM2
                        else "no built coverage"
                    ),
                }
            )
    return flagged


def _extract_overpass(args: argparse.Namespace, windows, metrics_dir: Path) -> list[dict[str, str]]:
    failures: list[dict[str, str]] = []
    for index, window in enumerate(windows, start=1):
        cache_file = metrics_dir / f"{window.window_id}.json"
        if cache_file.exists() and not args.refresh:
            print(f"[{index}/{len(windows)}] {window.window_id} cached", flush=True)
            continue
        print(f"[{index}/{len(windows)}] {window.window_id} fetching", flush=True)
        try:
            layers = fetch_layers(window)
            metric = extract_metrics(window, layers)
        except Exception as error:  # noqa: BLE001 - one window must not kill a 28-window sweep
            failures.append({"windowId": window.window_id, "error": f"{type(error).__name__}: {error}"})
            print(f"    FAILED {type(error).__name__}: {str(error)[:180]}", flush=True)
            continue
        cache_file.write_text(json.dumps(metric, indent=2, sort_keys=True), encoding="utf-8")
        time.sleep(args.pause)
    return failures


def _extract_geofabrik(args: argparse.Namespace, windows, metrics_dir: Path) -> list[dict[str, str]]:
    """Default source: one regional extract per city, cut locally, no queue to wait on."""
    cache_dir = Path(args.cache)
    sources = load_sources(Path(args.sources))
    failures: list[dict[str, str]] = []
    inputs_path = cache_dir / "inputs-v1.json"
    inputs = json.loads(inputs_path.read_text(encoding="utf-8")) if inputs_path.exists() else {}

    by_city: dict[str, list] = {}
    for window in windows:
        by_city.setdefault(window.city, []).append(window)

    for city, city_windows in sorted(by_city.items()):
        pending = [
            window
            for window in city_windows
            if args.refresh or not (metrics_dir / f"{window.window_id}.json").exists()
        ]
        if not pending:
            print(f"[{city}] 7/7 cached", flush=True)
            continue
        print(f"[{city}] {len(city_windows)} windows, {len(pending)} pending", flush=True)
        try:
            pbf = download_region(sources, city, cache_dir, refresh=False)
            inputs[city] = {
                "regionId": region_for(sources, city)["id"],
                "url": region_for(sources, city)["url"],
                "bytes": pbf.stat().st_size,
                "sha256": _sha256(pbf),
                "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            }
            inputs_path.write_text(json.dumps(inputs, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            xml_path = build_city_extract(
                pbf, city_windows, cache_dir / "extracts" / f"{city}.osm", refresh=args.refresh
            )
            metrics = extract_city_metrics(pending, xml_path)
        except Exception as error:  # noqa: BLE001 - one city must not kill the corpus
            for window in pending:
                failures.append(
                    {"windowId": window.window_id, "error": f"{type(error).__name__}: {error}"}
                )
            print(f"    FAILED {type(error).__name__}: {str(error)[:220]}", flush=True)
            continue
        for metric in metrics:
            cache_file = metrics_dir / f"{metric['windowId']}.json"
            cache_file.write_text(json.dumps(metric, indent=2, sort_keys=True), encoding="utf-8")
            print(f"    {metric['windowId']} ok", flush=True)
    return failures


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def cmd_extract(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest)
    cache_dir = Path(args.cache)
    output_dir = Path(args.output)
    metrics_dir = cache_dir / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    configure(cache_dir, verbose=args.verbose)

    windows = load_windows(manifest_path)
    if args.only:
        wanted = set(args.only.split(","))
        windows = [window for window in windows if window.window_id in wanted]

    if args.source == "geofabrik":
        failures = _extract_geofabrik(args, windows, metrics_dir)
    else:
        failures = _extract_overpass(args, windows, metrics_dir)

    collected = []
    for window in load_windows(manifest_path):
        cache_file = metrics_dir / f"{window.window_id}.json"
        if cache_file.exists():
            collected.append(json.loads(cache_file.read_text(encoding="utf-8")))

    output_dir.mkdir(parents=True, exist_ok=True)
    inputs_path = cache_dir / "inputs-v1.json"
    payload = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "manifest": json.loads(manifest_path.read_text(encoding="utf-8"))["windowSideMeters"],
        "source": args.source,
        "inputs": json.loads(inputs_path.read_text(encoding="utf-8")) if inputs_path.exists() else {},
        "toolchain": _toolchain(),
        "attribution": ATTRIBUTION,
        "windows": sorted(collected, key=lambda item: item["windowId"]),
        "degenerateWindows": _degenerate_windows(
            sorted(collected, key=lambda item: item["windowId"])
        ),
        "failures": failures,
    }
    target = output_dir / "metrics-v1.json"
    target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(
        f"windows={len(collected)}/{len(load_windows(manifest_path))} failures={len(failures)} -> {target}",
        flush=True,
    )
    return 0 if collected and not failures else (0 if collected else 1)


def cmd_envelopes(args: argparse.Namespace) -> int:
    metrics_file = Path(args.output) / "metrics-v1.json"
    if not metrics_file.exists():
        print(f"missing {metrics_file}; run extract first", file=sys.stderr)
        return 1
    metrics = _read_metrics(metrics_file)
    envelopes = build_envelopes(metrics)
    envelopes["generatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    envelopes["toolchain"] = _toolchain()
    envelopes["attribution"] = ATTRIBUTION
    target = Path(args.output) / "envelopes-v1.json"
    target.write_text(json.dumps(envelopes, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"families={len(envelopes['families'])} windows={len(metrics)} -> {target}", flush=True)
    return 0


def cmd_provenance(args: argparse.Namespace) -> int:
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    inputs_path = Path(args.cache) / "inputs-v1.json"
    inputs = json.loads(inputs_path.read_text(encoding="utf-8")) if inputs_path.exists() else {}
    sources_path = Path(args.sources)
    sources = load_sources(sources_path) if sources_path.exists() else {}
    payload = {
        "schemaVersion": 1,
        "recordedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "toolchain": _toolchain(),
        "attribution": ATTRIBUTION,
        "sampleCount": len(manifest["families"]) * len(manifest["cities"]),
        "cities": sorted(manifest["cities"]),
        "families": manifest["families"],
        "windowSideMeters": manifest["windowSideMeters"],
        "cellMeters": manifest["cellMeters"],
        "source": args.source,
        "regionalExtracts": inputs or {"note": "no extract inputs recorded in this cache"},
        "knownLimitation": (
            "Multipolygon landuse relations are kept only when every member falls inside the "
            "window cut, so very large parks that straddle a window boundary are undercounted in "
            "green coverage. Overpass returns partial relations; a regional cut cannot."
        ),
        "versionedArtifacts": [
            "tools/urban-benchmark/windows.json",
            "tools/urban-benchmark/sources.json",
            "docs/urban-benchmark/metrics-v1.json",
            "docs/urban-benchmark/envelopes-v1.json",
            "docs/urban-benchmark/provenance-v1.json",
        ],
        "notVersioned": [
            "downloaded regional .osm.pbf extracts and window cuts (.cache, gitignored)",
            "building/road/green geometry of any kind",
        ],
    }
    if sources.get("source"):
        payload["sourceDescription"] = sources["source"]
    target = Path(args.output) / "provenance-v1.json"
    target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"-> {target}", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="urban-benchmark", description=__doc__)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--sources", default=str(DEFAULT_SOURCES))
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument(
        "--source",
        choices=["geofabrik", "overpass"],
        default="geofabrik",
        help="geofabrik (offline regional extracts, default) or overpass (live API)",
    )
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--only", default=None)
    parser.add_argument(
        "--pause",
        type=float,
        default=3.0,
        help="seconds to rest between windows on the Overpass source",
    )
    parser.add_argument("command", choices=["extract", "envelopes", "provenance", "all"])
    args = parser.parse_args(argv)

    if args.command in ("extract", "all"):
        code = cmd_extract(args)
        if code and args.command == "all":
            return code
    if args.command in ("envelopes", "all"):
        code = cmd_envelopes(args)
        if code:
            return code
    if args.command in ("provenance", "all"):
        code = cmd_provenance(args)
        if code:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""CLI for the offline morphological benchmark.

    python3 -m urban_benchmark.cli extract   # 28 windows -> aggregate metrics
    python3 -m urban_benchmark.cli envelopes # metrics -> per-family envelopes
    python3 -m urban_benchmark.cli all
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import platform
import sys
import time
from pathlib import Path

from . import __version__
from .envelopes import build_envelopes
from .fetch import OVERPASS_ENDPOINTS, configure, fetch_layers, load_windows
from .metrics import extract_metrics

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DEFAULT_MANIFEST = ROOT / "windows.json"
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

    collected = []
    for window in load_windows(manifest_path):
        cache_file = metrics_dir / f"{window.window_id}.json"
        if cache_file.exists():
            collected.append(json.loads(cache_file.read_text(encoding="utf-8")))

    output_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "manifest": json.loads(manifest_path.read_text(encoding="utf-8"))["windowSideMeters"],
        "toolchain": _toolchain(),
        "attribution": ATTRIBUTION,
        "windows": sorted(collected, key=lambda item: item["windowId"]),
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
        "versionedArtifacts": [
            "tools/urban-benchmark/windows.json",
            "docs/urban-benchmark/metrics-v1.json",
            "docs/urban-benchmark/envelopes-v1.json",
            "docs/urban-benchmark/provenance-v1.json",
        ],
        "notVersioned": [
            "raw Overpass responses (.cache, gitignored)",
            "building/road/green geometry of any kind",
        ],
    }
    target = Path(args.output) / "provenance-v1.json"
    target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"-> {target}", flush=True)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="urban-benchmark", description=__doc__)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--only", default=None)
    parser.add_argument(
        "--pause",
        type=float,
        default=3.0,
        help="seconds to rest between windows (public Overpass slots are shared)",
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

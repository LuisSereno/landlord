#!/usr/bin/env bash
# Offline morphological benchmark runner.
#
#   tools/urban-benchmark/run.sh [extra cli args]
#
# Public Overpass instances are shared and frequently saturated, so the sweep is resumable:
# extracted windows are cached under .cache/metrics and only the gaps are refetched.
set -euo pipefail

cd "$(dirname "$0")"

VENV="${URBAN_BENCHMARK_VENV:-/tmp/osm-venv}"
PY="$VENV/bin/python"

if [ ! -x "$PY" ]; then
  echo "missing interpreter: $PY" >&2
  echo "create it with:" >&2
  echo "  python3 -m venv $VENV && $VENV/bin/pip install -r requirements.lock.txt" >&2
  exit 1
fi

ATTEMPTS="${URBAN_BENCHMARK_SWEEP_ATTEMPTS:-3}"
for attempt in $(seq 1 "$ATTEMPTS"); do
  echo "== sweep attempt $attempt/$ATTEMPTS =="
  "$PY" -m urban_benchmark.cli extract --pause "${URBAN_BENCHMARK_PAUSE:-2}" "$@" || true
  completed=$(find .cache/metrics -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
  echo "windows cached: $completed/28"
  if [ "$completed" -ge 28 ]; then
    break
  fi
  echo "waiting before retrying the missing windows"
  sleep 30
done

"$PY" -m urban_benchmark.cli envelopes
"$PY" -m urban_benchmark.cli provenance

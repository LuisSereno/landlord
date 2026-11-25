#!/usr/bin/env python3
"""Construye un manifiesto agregado de evidencia y fuentes de WP-CHAR-02A."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
PROTOTYPE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02a"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    config_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    output_path = Path(args.output).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    external = {}

    def add(path, expected, role):
        resolved = source_root / path
        actual = sha256(resolved) if resolved.exists() else None
        external[path] = {
            "path": str(resolved),
            "role": role,
            "expectedSha256": expected,
            "actualSha256": actual,
            "exists": resolved.exists(),
            "hashMatches": actual == expected,
        }

    diagnosis = config["animationDiagnosis"]
    add(diagnosis["avatar"]["path"], diagnosis["avatar"]["sha256"], "Rocketbox diagnostic avatar")
    add(diagnosis["idleClip"]["path"], diagnosis["idleClip"]["sha256"], "Rocketbox diagnostic idle")
    add(diagnosis["walkClip"]["path"], diagnosis["walkClip"]["sha256"], "Rocketbox diagnostic walk")
    add(diagnosis["licenseFile"]["path"], diagnosis["licenseFile"]["sha256"], "Rocketbox license")
    for name, source in config["sourceComparison"]["candidates"].items():
        add(source["path"], source["sha256"], f"{name} comparison source")
        add(source["licenseFile"], source["licenseFileSha256"], f"{name} license")
        for key in ("idleClip", "walkClip"):
            if key in source:
                add(source[key]["path"], source[key]["sha256"], f"{name} {key}")
    files = []
    aggregate_validation = PROTOTYPE / "evidence-validation.json"
    for path in sorted(PROTOTYPE.rglob("*")):
        if not path.is_file() or path in (output_path, aggregate_validation):
            continue
        relative = path.relative_to(REPO_ROOT).as_posix()
        role = "reference" if "/reference/" in relative else "diagnostic" if "/diagnostics/" in relative else "source_comparison" if "/source-comparison/" in relative else "worker_reference" if "/worker-reference/" in relative else "prototype_evidence"
        files.append(
            {
                "path": relative,
                "role": role,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    result = {
        "schemaVersion": 1,
        "status": "evidence_manifest",
        "worktree": str(REPO_ROOT),
        "branch": subprocess.check_output(["git", "branch", "--show-current"], cwd=REPO_ROOT, text=True).strip(),
        "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True).strip(),
        "experimentManifest": str(config_path.relative_to(REPO_ROOT)),
        "experimentManifestSha256": sha256(config_path),
        "runtimePromotion": False,
        "approval": "pending_human",
        "externalSources": list(external.values()),
        "files": files,
        "summary": {
            "fileCount": len(files),
            "totalBytes": sum(item["bytes"] for item in files),
            "externalSourceCount": len(external),
            "allExternalHashesMatch": all(item["hashMatches"] for item in external.values()),
        },
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))
    if not result["summary"]["allExternalHashesMatch"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

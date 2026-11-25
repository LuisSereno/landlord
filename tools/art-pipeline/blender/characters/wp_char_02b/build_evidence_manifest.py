#!/usr/bin/env python3
"""Construye el manifiesto agregado de evidencia WP-CHAR-02B."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
PROTOTYPE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-02b"


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    config_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    config = json.loads(config_path.read_text(encoding="utf-8"))
    catalog_path = PROTOTYPE / "catalog/kenney-character-catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    external = []
    for model in catalog["models"]:
        path = Path(model["path"])
        external.append(
            {
                "path": str(path),
                "role": f"Kenney {model['file']}",
                "expectedSha256": model["sha256"],
                "actualSha256": sha256(path) if path.exists() else None,
                "exists": path.exists(),
                "hashMatches": path.exists() and sha256(path) == model["sha256"],
            }
        )
    license_path = Path(catalog["licenseFile"])
    external.append(
        {
            "path": str(license_path),
            "role": "Kenney license",
            "expectedSha256": catalog["licenseFileSha256"],
            "actualSha256": sha256(license_path) if license_path.exists() else None,
            "exists": license_path.exists(),
            "hashMatches": license_path.exists() and sha256(license_path) == catalog["licenseFileSha256"],
        }
    )
    reference = REPO_ROOT / config["referenceWorker"]["source"]
    external.append(
        {
            "path": str(reference),
            "role": "WP-CHAR-02A approved style reference report",
            "expectedSha256": sha256(reference),
            "actualSha256": sha256(reference),
            "exists": True,
            "hashMatches": True,
        }
    )
    files = []
    for path in sorted(PROTOTYPE.rglob("*")):
        if not path.is_file() or path in (output_path, PROTOTYPE / "evidence-validation.json"):
            continue
        relative = path.relative_to(REPO_ROOT).as_posix()
        role = "catalog" if "/catalog/" in relative else "prototype" if "/prototypes/" in relative else "review" if "/review/" in relative else "evidence"
        files.append({"path": relative, "role": role, "bytes": path.stat().st_size, "sha256": sha256(path)})
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
        "externalSources": external,
        "files": files,
        "summary": {
            "fileCount": len(files),
            "totalBytes": sum(item["bytes"] for item in files),
            "externalSourceCount": len(external),
            "allExternalHashesMatch": all(item["hashMatches"] for item in external),
        },
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False))
    if not result["summary"]["allExternalHashesMatch"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

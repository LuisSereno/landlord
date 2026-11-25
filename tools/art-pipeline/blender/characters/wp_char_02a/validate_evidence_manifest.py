#!/usr/bin/env python3
"""Verifica el manifiesto agregado de evidencia WP-CHAR-02A."""

import argparse
import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]


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
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = []
    checks = []

    def check(condition, label):
        checks.append({"label": label, "passed": bool(condition)})
        if not condition:
            errors.append(label)

    check(manifest.get("runtimePromotion") is False, "runtime promotion disabled")
    check(manifest.get("approval") == "pending_human", "human approval pending")
    check(manifest["summary"]["allExternalHashesMatch"], "all external source hashes match")
    for source in manifest["externalSources"]:
        path = Path(source["path"])
        check(path.exists(), f"external exists: {source['role']}")
        if path.exists():
            check(sha256(path) == source["expectedSha256"], f"external hash: {source['role']}")
    for item in manifest["files"]:
        path = REPO_ROOT / item["path"]
        check(path.exists(), f"evidence exists: {item['path']}")
        if path.exists():
            check(path.stat().st_size == item["bytes"], f"evidence bytes: {item['path']}")
            check(sha256(path) == item["sha256"], f"evidence hash: {item['path']}")
    check(len(manifest["files"]) == manifest["summary"]["fileCount"], "evidence file count")
    check(sum(item["bytes"] for item in manifest["files"]) == manifest["summary"]["totalBytes"], "evidence total bytes")
    result = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "manifest": str(manifest_path.relative_to(REPO_ROOT)),
        "manifestSha256": sha256(manifest_path),
        "fileCount": len(manifest["files"]),
        "externalSourceCount": len(manifest["externalSources"]),
        "checkCount": len(checks),
        "errors": errors,
        "checks": checks,
    }
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "checks": len(checks), "errors": errors}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

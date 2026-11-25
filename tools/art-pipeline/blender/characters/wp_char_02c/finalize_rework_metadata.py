#!/usr/bin/env python3
"""Refresca hashes/estado de reportes tras cerrar el manifiesto WP-CHAR-02C."""

import argparse
import hashlib
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    manifest_path = Path(args.manifest).resolve()
    root = Path(args.root).resolve()
    config = json.loads(manifest_path.read_text(encoding="utf-8"))
    if config.get("status") != "technical_complete_pending_human_review":
        raise RuntimeError("El manifiesto aún no está cerrado técnicamente")
    manifest_hash = sha256(manifest_path)
    updated = []
    for role in ("supervisor", "enforcer", "firefighter"):
        for stage in ("smoke", "final"):
            path = root / role / stage / f"{role}-prototype.json"
            if not path.exists():
                raise RuntimeError(f"Falta reporte: {path}")
            report = json.loads(path.read_text(encoding="utf-8"))
            report["manifestSha256"] = manifest_hash
            if stage == "final":
                report["status"] = "technical_complete_pending_human_review"
            path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            updated.append(str(path.relative_to(REPO_ROOT)))
    print(json.dumps({"status": "metadata_finalized", "manifestSha256": manifest_hash, "reports": updated}, ensure_ascii=False))


if __name__ == "__main__":
    main()

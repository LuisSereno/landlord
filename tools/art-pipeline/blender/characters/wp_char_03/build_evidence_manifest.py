#!/usr/bin/env python3
"""Construye el manifiesto agregado de evidencia WP-CHAR-03."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[5]
BASE = REPO_ROOT / "docs/art/characters/prototypes/wp-char-03"


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
    source_root = Path(config["sourcePolicy"]["sourceRepositoryRoot"])
    external_specs = []
    for role in ("supervisor", "enforcer", "firefighter"):
        candidate = config["candidates"][role]
        external_specs.append((source_root / candidate["sourcePath"], f"Kenney {role}", candidate["sourceSha256"]))
    model_dir = source_root / "blender_artist/staging/third_party/cc0/extracted/kenney/mini-characters/Models/GLB format"
    external_specs.extend(
        [
            (model_dir / "character-worker.glb", "Kenney worker control", "c8e0cd7a98737f33f0a6a6c9f2575054baff3b443925b57f0451ba3268128319"),
            (model_dir / "character-male-c.glb", "Kenney police control", "6bb3b1ac8b196fd005dd5cb73621cd88d8a44d1f0f92fcf0c03f3b47ac9b9a74"),
            (source_root / config["sourcePolicy"]["licenseFile"], "Kenney license", config["sourcePolicy"]["licenseFileSha256"]),
        ]
    )
    runtime = REPO_ROOT / "apps/web/public/assets/runtime/blender-day"
    for filename in ("row_house-complete.png", "workshop-complete.png", "veh_truck.png", "veh_delivery.png"):
        path = runtime / filename
        external_specs.append((path, f"Read-only runtime reference {filename}", sha256(path)))
    external = []
    for path, role, expected in external_specs:
        actual = sha256(path) if path.exists() else None
        external.append({"path": str(path), "role": role, "expectedSha256": expected, "actualSha256": actual, "exists": path.exists(), "hashMatches": actual == expected})
    roots = [
        BASE,
        REPO_ROOT / "tools/art-pipeline/blender/characters/wp_char_03",
        REPO_ROOT / "docs/execution/phase-4/characters/wp-char-03",
        REPO_ROOT / "apps/web/src/character-scale-lab",
        REPO_ROOT / "apps/web/public/qa-character-scale",
    ]
    files = []
    for root in roots:
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path in (output_path, BASE / "evidence-validation.json"):
                continue
            relative = path.relative_to(REPO_ROOT).as_posix()
            role = "phaser_capture" if "/phaser-captures/" in relative else "review" if "/review/" in relative else "scale_comparison" if "/scale-comparison/" in relative else "prototype" if "/prototypes/" in relative else "qa_sprite" if "/qa-character-scale/" in relative else "lab_code" if "/character-scale-lab/" in relative else "tool" if relative.startswith("tools/") else "documentation"
            files.append({"path": relative, "role": role, "bytes": path.stat().st_size, "sha256": sha256(path)})
    html = REPO_ROOT / "apps/web/char-scale-lab.html"
    files.append({"path": str(html.relative_to(REPO_ROOT)), "role": "lab_html", "bytes": html.stat().st_size, "sha256": sha256(html)})
    files.sort(key=lambda item: item["path"])
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

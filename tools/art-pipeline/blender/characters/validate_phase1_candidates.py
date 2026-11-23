#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[4]
CANDIDATE_ROOT = REPO_ROOT / "docs/art/characters/candidates"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inside(parent: Path, child: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return child.resolve() != parent.resolve()
    except ValueError:
        return False


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest",
        type=Path,
        default=CANDIDATE_ROOT / "candidate-manifest.json",
    )
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    errors = []
    if not manifest_path.is_file():
        print(f"Missing candidate manifest: {manifest_path}", file=sys.stderr)
        return 1
    manifest = load_json(manifest_path)
    if manifest.get("status") != "candidate" or manifest.get("runtimePromotion") is not False:
        errors.append("Candidate manifest must remain candidate with runtimePromotion=false")
    if manifest.get("approval") != "pending_human":
        errors.append("Candidate manifest must remain pending human approval")
    jobs = manifest.get("jobs", [])
    if len(jobs) != 3:
        errors.append(f"Expected 3 candidate jobs, received {len(jobs)}")

    source_root = Path(manifest["sourceRepository"]["root"]).resolve()
    jobs_manifest_path = REPO_ROOT / manifest["jobsManifest"]
    if not jobs_manifest_path.is_file() or sha256(jobs_manifest_path) != manifest["jobsManifestSha256"]:
        errors.append("Source jobs manifest hash changed")
    for key in ("runtimeScriptSha256", "styleLayerSha256"):
        source_path = source_root / manifest["sourceRepository"][key.removesuffix("Sha256")]
        if not source_path.is_file() or sha256(source_path) != manifest["sourceRepository"][key]:
            errors.append(f"Dependency hash changed: {source_path}")

    source_policy = load_json(jobs_manifest_path)["sourcePolicy"]
    license_path = source_root / source_policy["licenseFile"]
    if not license_path.is_file() or sha256(license_path) != source_policy["licenseFileSha256"]:
        errors.append("Rocketbox license hash changed")

    output_root = (REPO_ROOT / manifest["outputDirectory"]).resolve()
    if not inside(REPO_ROOT, output_root) or output_root != CANDIDATE_ROOT.resolve():
        errors.append("Candidate output directory is not the isolated docs directory")

    output_results = []
    job_results = []
    all_paths = set()
    for job in jobs:
        job_errors = []
        outputs = job.get("outputs", [])
        expected_count = 4 * 2 * 2
        if len(outputs) != expected_count:
            job_errors.append(f"Expected {expected_count} frames, received {len(outputs)}")
        slots = set()
        by_slot = {}
        source_path = source_root / job["source"]["path"]
        if not source_path.is_file() or sha256(source_path) != job["source"]["sha256"]:
            job_errors.append("Avatar source hash changed")
        for animation in ("idle", "walk"):
            clip = source_root / job["animationSources"][animation]["path"]
            if not clip.is_file() or sha256(clip) != job["animationSources"][animation]["sha256"]:
                job_errors.append(f"{animation} clip hash changed")

        for output in outputs:
            local_errors = []
            slot = (output.get("direction"), output.get("animation"), output.get("frame"))
            if slot in slots:
                local_errors.append("Duplicate matrix slot")
            slots.add(slot)
            by_slot[slot] = output
            png_path = (REPO_ROOT / output["path"]).resolve()
            metadata_path = (REPO_ROOT / output["metadataPath"]).resolve()
            if output["path"] in all_paths:
                local_errors.append("Duplicate output path")
            all_paths.add(output["path"])
            if not inside(output_root, png_path) or not inside(output_root, metadata_path):
                local_errors.append("Output escapes candidate directory")
            if not png_path.is_file() or not metadata_path.is_file():
                local_errors.append("PNG or metadata missing")
                output_results.append({"path": output["path"], "status": "failed", "errors": local_errors})
                continue
            if sha256(png_path) != output["sha256"]:
                local_errors.append("PNG hash mismatch")
            if sha256(metadata_path) != output["metadataSha256"]:
                local_errors.append("Metadata hash mismatch")
            metadata = load_json(metadata_path)
            if metadata.get("assetId") != job["id"]:
                local_errors.append("Metadata assetId mismatch")
            if metadata.get("kind") != "character":
                local_errors.append("Metadata kind is not character")
            if (
                metadata.get("direction") != output["direction"]
                or metadata.get("animation") != output["animation"]
                or metadata.get("frame") != output["frame"]
            ):
                local_errors.append("Metadata matrix slot mismatch")
            if metadata.get("license") != "MIT" or metadata.get("source", {}).get("id") != "src_microsoft_rocketbox":
                local_errors.append("Metadata provenance is not Rocketbox MIT")
            if metadata.get("source", {}).get("path") != job["source"]["path"]:
                local_errors.append("Metadata source path mismatch")
            if metadata.get("toolchain", {}).get("blender") != "5.2.2 LTS":
                local_errors.append("Metadata Blender version mismatch")
            if metadata.get("render", {}).get("colorMode") != "RGBA" or metadata.get("render", {}).get("transparentFilm") is not True:
                local_errors.append("Metadata render is not transparent RGBA")
            if metadata.get("image", {}).get("sha256") != output["sha256"]:
                local_errors.append("Metadata image hash mismatch")
            expected_orientation = 45 + output["direction"] * 90
            if output.get("orientationDegrees") != expected_orientation:
                local_errors.append("Candidate orientation mismatch")

            alpha_bbox = None
            magenta_pixels = None
            with Image.open(png_path) as image:
                rgba = image.convert("RGBA")
                if rgba.size != (output["width"], output["height"]):
                    local_errors.append("PNG dimensions differ from metadata")
                if rgba.size != (metadata.get("image", {}).get("width"), metadata.get("image", {}).get("height")):
                    local_errors.append("PNG dimensions differ from metadata image")
                alpha_bbox = rgba.getchannel("A").getbbox()
                if alpha_bbox is None:
                    local_errors.append("PNG has no visible alpha content")
                magenta_pixels = sum(
                    1
                    for red, green, blue, alpha in rgba.getdata()
                    if alpha > 0 and red > 200 and green < 60 and blue > 200
                )
                if magenta_pixels:
                    local_errors.append("PNG contains unresolved magenta texture pixels")
                content_touches_border = alpha_bbox is not None and (
                    alpha_bbox[0] == 0
                    or alpha_bbox[1] == 0
                    or alpha_bbox[2] == rgba.width
                    or alpha_bbox[3] == rgba.height
                )
            output_results.append(
                {
                    "path": output["path"],
                    "status": "passed" if not local_errors else "failed",
                    "alphaBBox": alpha_bbox,
                    "contentTouchesBorder": content_touches_border,
                    "magentaPixels": magenta_pixels,
                    "errors": local_errors,
                }
            )
            if local_errors:
                job_errors.extend(f"{output['path']}: {error}" for error in local_errors)

        expected_slots = {
            (direction, animation, frame)
            for direction in range(4)
            for animation in ("idle", "walk")
            for frame in (0, 1)
        }
        if slots != expected_slots:
            job_errors.append("Matrix slots do not match 4 directions x idle/walk x 2 frames")
        for direction in range(4):
            idle = by_slot.get((direction, "idle", 0))
            walk = by_slot.get((direction, "walk", 0))
            if not idle or not walk or idle.get("sha256") == walk.get("sha256"):
                job_errors.append(f"idle/walk are not differentiated in direction {direction}")
            for animation in ("idle", "walk"):
                first = by_slot.get((direction, animation, 0))
                second = by_slot.get((direction, animation, 1))
                if not first or not second or first.get("sha256") == second.get("sha256"):
                    job_errors.append(f"{animation} poses are not differentiated in direction {direction}")
        job_results.append(
            {
                "id": job["id"],
                "status": "passed" if not job_errors else "failed",
                "framesValidated": len(outputs),
                "errors": job_errors,
            }
        )
        errors.extend(f"{job['id']}: {error}" for error in job_errors)

    validation = {
        "schemaVersion": 1,
        "status": "passed" if not errors else "failed",
        "approval": "pending_human",
        "runtimePromotion": False,
        "sourceManifest": str(manifest_path.relative_to(REPO_ROOT)),
        "sourceManifestSha256": sha256(manifest_path),
        "jobs": job_results,
        "outputs": output_results,
        "errors": errors,
    }
    validation_path = CANDIDATE_ROOT / "candidate-validation.json"
    validation_path.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "status": validation["status"],
                "jobs": len(job_results),
                "frames": len(output_results),
                "errors": len(errors),
                "validation": str(validation_path.relative_to(REPO_ROOT)),
            }
        )
    )
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())

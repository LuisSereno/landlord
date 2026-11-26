#!/usr/bin/env python3
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

TOOL = Path(__file__).with_name("audit-building-candidate-evidence.py")
SPEC = importlib.util.spec_from_file_location("building_candidate_audit", TOOL)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class BuildingCandidateAuditTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.family = "organization-headquarters"
        self.base = self.root / "docs/art" / self.family
        (self.base / "gameplay-capture-v1").mkdir(parents=True)
        (self.root / "source.glb").write_bytes(b"source")
        image_path = self.base / "candidate.png"
        image = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        image.putpixel((4, 4), (120, 120, 120, 255))
        image.save(image_path)
        metadata_path = self.base / "candidate.json"
        metadata_path.write_text(
            json.dumps(
                {
                    "image": {"width": 8, "height": 8},
                    "transforms": [
                        {"sourceId": "src", "sourcePath": "source.glb", "license": "CC0-1.0"}
                    ],
                }
            ),
            encoding="utf-8",
        )
        matrix = {
            "assets": [
                {
                    "candidateId": "candidate",
                    "moodId": "day_civic",
                    "buildingType": "headquarters_cupola",
                    "stateToken": "complete",
                    "orientation": 0,
                    "pngPath": "docs/art/organization-headquarters/candidate.png",
                    "metadataPath": "docs/art/organization-headquarters/candidate.json",
                    "pngSha256": sha256(image_path),
                    "metadataSha256": sha256(metadata_path),
                    "footprint": {"width": 4, "height": 2},
                    "pivot": {"x": 0.5, "y": 0.5},
                    "pixelsPerMeter": 64,
                }
            ]
        }
        (self.base / "candidate-matrix.json").write_text(json.dumps(matrix), encoding="utf-8")
        (self.base / "gameplay-capture-v1/capture-manifest.json").write_text(
            json.dumps({"pageErrors": [], "captures": []}), encoding="utf-8"
        )

    def tearDown(self):
        self.temp.cleanup()

    def audit(self):
        with patch.object(AUDIT, "REPO_ROOT", self.root):
            return AUDIT.audit_family(self.family)

    def test_valid_candidate_passes(self):
        result = self.audit()
        self.assertEqual(result["status"], "passed")
        self.assertEqual(result["assetCount"], 1)
        self.assertEqual(result["assets"][0]["sources"][0]["license"], "CC0-1.0")

    def test_png_hash_mismatch_fails(self):
        matrix_path = self.base / "candidate-matrix.json"
        matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        matrix["assets"][0]["pngSha256"] = "0" * 64
        matrix_path.write_text(json.dumps(matrix), encoding="utf-8")
        result = self.audit()
        self.assertEqual(result["status"], "failed")
        self.assertTrue(any("matrix PNG hash" in error for error in result["errors"]))

    def test_unsupported_license_fails(self):
        metadata_path = self.base / "candidate.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["transforms"][0]["license"] = "unknown"
        metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
        matrix_path = self.base / "candidate-matrix.json"
        matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
        matrix["assets"][0]["metadataSha256"] = sha256(metadata_path)
        matrix_path.write_text(json.dumps(matrix), encoding="utf-8")
        result = self.audit()
        self.assertEqual(result["status"], "failed")
        self.assertTrue(any("unsupported license" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()

"""Software-only tests: generated records are never engineering evidence."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from train_lack_of_fusion import evaluate, load_verified_shape


def fixture():
    rows = []
    for b in range(8):
        for i in range(10):
            rows.append({
                "specimen_id": f"example-{b}-{i}",
                "build_id": f"example-build-{b}",
                "material": "SYNTHETIC_TEST_FIXTURE_MATERIAL",
                "machine": "SYNTHETIC_TEST_FIXTURE_MACHINE",
                "process_revision": "TEST_REVISION",
                "inspection_method": "SYNTHETIC_TEST_FIXTURE_INSPECTION",
                "inspection_reference": f"synthetic-ref-{b}",
                "outcome_definition": "SYNTHETIC_TEST_FIXTURE_ONLY",
                "measured_lack_of_fusion": int((i + b) % 3 == 0),
                "laser_power_w": 130 + 4 * b + i,
                "scan_speed_mm_s": 700 + 13 * i + b,
                "hatch_spacing_mm": 0.085 + 0.001 * i,
                "layer_thickness_mm": 0.025 + 0.001 * b,
            })
    return pd.DataFrame(rows)


class ResearchLoFTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "fixture.csv"
        self.report = Path(self.tmp.name) / "report.json"

    def load(self, data):
        data.to_csv(self.source, index=False)
        return load_verified_shape(self.source)

    def test_build_grouped_training_is_research_only(self):
        self.load(fixture())
        report = evaluate(self.source, self.report)
        self.assertFalse(report["release_eligible"])
        self.assertFalse(report["inference_enabled"])
        self.assertEqual(report["source_rows"], 80)
        self.assertTrue(set(report["training"]["build_ids"]).isdisjoint(report["held_out"]["build_ids"]))
        self.assertGreaterEqual(len(report["held_out"]["build_ids"]), 2)
        self.assertEqual(json.loads(self.report.read_text())["dataset_sha256"], report["dataset_sha256"])

    def test_missing_labels_and_provenance_fail(self):
        for column, value in [
            ("measured_lack_of_fusion", None),
            ("inspection_reference", None),
            ("build_id", "unknown"),
            ("laser_power_w", -1),
        ]:
            data = fixture()
            data.loc[0, column] = value
            with self.subTest(column=column), self.assertRaises(ValueError):
                self.load(data)

    def test_duplicate_specimen_and_mixed_profile_fail(self):
        data = fixture()
        data.loc[1, "specimen_id"] = data.loc[0, "specimen_id"]
        with self.assertRaises(ValueError):
            self.load(data)
        data = fixture()
        data.loc[1, "machine"] = "OTHER_MACHINE"
        with self.assertRaises(ValueError):
            self.load(data)

    def test_too_few_builds_and_one_class_fail(self):
        data = fixture()
        data["build_id"] = [f"group-{i % 3}" for i in range(len(data))]
        with self.assertRaises(ValueError):
            self.load(data)
        data = fixture()
        data["measured_lack_of_fusion"] = 0
        with self.assertRaises(ValueError):
            self.load(data)


if __name__ == "__main__":
    unittest.main()

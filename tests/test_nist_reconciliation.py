import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location(
    "reconcile", pathlib.Path(__file__).parents[1] / "scripts/reconcile-nist-source.py"
)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class SourceReconciliationTests(unittest.TestCase):
    def fixture(self):
        rows = []
        for plate, count in gate.EXPECTED_COUNTS.items():
            for _ in range(count):
                rows.append(dict(source_row=len(rows)+2, sample_id=plate,
                    source_sha256=gate.PINNED_SHA256, source_doi=gate.DOI,
                    part_id="P1", build_id=None, defect_label=None,
                    powder_present=False, power_w=200, speed_mm_s=800,
                    beam_diameter_mm=.067, measured_depth_mm=.1,
                    measured_width_mm=.08, overlap_depth_mm=None,
                    overlap_width_mm=None))
        return dict(source_sha256=gate.PINNED_SHA256,
                    measurement_count=len(rows), measurements=rows)

    def test_identity_and_missing_values_without_training_claim(self):
        result = gate.reconcile(self.fixture(), "readme-hash")
        self.assertEqual(result["measurement_count"], 228)
        self.assertEqual(result["plate_summary"]["BP1"]["missing_targets"]["overlap_width_mm"], 42)
        self.assertFalse(result["training_ready"])
        self.assertFalse(result["independent_build_validation"])
        self.assertFalse(result["defect_labels_available"])

    def test_reject_changed_source_counts_duplicate_rows_and_inferred_labels(self):
        for change in ("hash", "count", "duplicate", "label", "build", "powder"):
            with self.subTest(change=change):
                a = self.fixture()
                if change == "hash": a["source_sha256"] = "changed"
                if change == "count": a["measurements"].pop()
                if change == "duplicate": a["measurements"][0]["source_row"] = a["measurements"][1]["source_row"]
                if change == "label": a["measurements"][0]["defect_label"] = 0
                if change == "build": a["measurements"][0]["build_id"] = "invented"
                if change == "powder": a["measurements"][0]["powder_present"] = True
                with self.assertRaises(ValueError):
                    gate.reconcile(a, "readme-hash")

    def test_readme_identity(self):
        readme = ("NIST " + gate.DOI + " " + gate.WORKBOOK + " BP1 BP2 BP3").encode()
        self.assertEqual(len(gate.check_readme(readme)), 64)
        with self.assertRaises(ValueError):
            gate.check_readme(b"Different deflection README 10.18434/mds2-2711")

if __name__ == "__main__":
    unittest.main()

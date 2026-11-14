"""Synthetic contract tests. Test rows are not experimental observations."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from summarize_cmu_ct_pores import summarize

PCOLS = ["Name", "Power (W)", "Velocity (mm/s)", "Spot Size (um)",
         "Hatch Spacing (um)", "Layer Height (um)", "Geometry"]
DCOLS = ["Name", "Equivalent Spherical Diameter (um)", "Aspect Ratio", "Sphericity"]

def make_csv(path, headers, rows):
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)

class TestDescriptiveCT(unittest.TestCase):
    def test_quarantine_and_no_training(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            p, q, r = d/"parameters.csv", d/"poredf.csv", d/"report.json"
            make_csv(p, PCOLS, [["A", 300, 1000, 80, 100, 30, "cube"],
                                 ["B", 400, 1100, 80, 100, 30, "cube"]])
            make_csv(q, DCOLS, [["A", 50, 1, 1], ["A", 150, 1, 1],
                                 ["B", 20, 1, 1], ["Powder", 15, 1, 1]])
            x = summarize(p, q, r)
            self.assertEqual(x["number_of_matched_names"], 2)
            self.assertEqual(x["total_pore_detections"], 4)
            self.assertEqual(x["matched"][0]["mean_equivalent_spherical_diameter_um"], 100)
            self.assertEqual(x["matched"][0]["detections_at_least_100um"], 1)
            self.assertEqual(x["pore_only_quarantined"][0]["name"], "Powder")
            self.assertFalse(x["training_ready"])
            self.assertFalse(x["join_attempted"])
            self.assertFalse(x["production_inference_enabled"])
            self.assertEqual(json.loads(r.read_text())["status"], "DESCRIPTIVE_ONLY_NOT_VALIDATED")

    def test_invalid_detection_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            p, q, r = d/"p.csv", d/"q.csv", d/"r.json"
            make_csv(p, PCOLS, [["A", 300, 1000, 80, 100, 30, "cube"]])
            make_csv(q, DCOLS, [["A", "nan", 1, 1]])
            with self.assertRaises(ValueError):
                summarize(p, q, r)

    def test_missing_parameter_specimen_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            p, q, r = d/"p.csv", d/"q.csv", d/"r.json"
            make_csv(p, PCOLS, [["A", 300, 1000, 80, 100, 30, "cube"]])
            make_csv(q, DCOLS, [["B", 20, 1, 1]])
            with self.assertRaises(ValueError):
                summarize(p, q, r)

if __name__ == "__main__":
    unittest.main()

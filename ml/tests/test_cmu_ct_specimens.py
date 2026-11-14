import csv
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare_cmu_ct_specimens import summarize


class CMUSpecimenTests(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.root = Path(self.t.name)
        self.a = self.root / "parameters.csv"
        self.b = self.root / "poredf.csv"
        self.c = self.root / "specimens.csv"
        self.d = self.root / "report.json"
        self.a.write_text(
            "Name,Power (W),Velocity (mm/s),Spot Size (um),Hatch Spacing (um),Layer Height (um)\n"
            "sample-A,370,1000,80,100,30\n"
            "sample-B,370,1200,80,100,30\n")
        self.b.write_text(
            "Name,Equivalent Spherical Diameter (um),Aspect Ratio,Sphericity\n"
            "sample-A,12,1,1\n"
            "sample-A,24,1,1\n"
            "sample-B,30,1,1\n")

    def test_pore_rows_are_grouped_not_treated_as_independent(self):
        result = summarize(self.a, self.b, self.c, self.d)
        self.assertEqual(result["specimens"], 2)
        self.assertEqual(result["pore_rows"], 3)
        self.assertFalse(result["training_ready"])
        with self.c.open(newline="") as file:
            rows = list(csv.DictReader(file))
        self.assertEqual([int(row["ct_detected_pore_count"]) for row in rows], [2, 1])
        self.assertEqual(float(rows[0]["mean_detected_pore_diameter_um"]), 18.0)

    def test_ambiguous_or_missing_identity_is_rejected(self):
        with self.a.open("a") as file:
            file.write("sample-A,370,1300,80,100,30\n")
        with self.assertRaises(ValueError):
            summarize(self.a, self.b, self.c, self.d)

    def test_unknown_pore_specimen_rejected(self):
        with self.b.open("a") as file:
            file.write("unknown,19,1,1\n")
        with self.assertRaises(ValueError):
            summarize(self.a, self.b, self.c, self.d)

    def test_postbuild_labels_not_created(self):
        summarize(self.a, self.b, self.c, self.d)
        with self.c.open() as f:
            header = f.readline().strip().split(",")
        self.assertNotIn("failure_probability", header)
        self.assertNotIn("lof_label", header)
        self.assertNotIn("build_id", header)


if __name__ == "__main__":
    unittest.main()

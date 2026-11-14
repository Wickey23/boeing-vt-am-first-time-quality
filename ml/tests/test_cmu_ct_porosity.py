"""Software contract tests only; fabricated rows are never defect training evidence."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_cmu_ct_porosity import audit


class CMUSourceAuditTests(unittest.TestCase):
    def test_identity_overlap_is_diagnostic_not_a_join(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            params = root / "parameters.csv"
            pores = root / "poredf.csv"
            with params.open("w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(["sample_id", "laser_power", "postbuild_evs"])
                writer.writerow(["A", 370, 9])
                writer.writerow(["B", 370, 10])
            with pores.open("w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(["sample_id", "pore_volume"])
                writer.writerow(["A", 0.001])
                writer.writerow(["A", 0.002])
                writer.writerow(["B", 0.003])
            report_path = root / "audit.json"
            result = audit([params, pores], report_path)
            self.assertFalse(result["training_ready"])
            self.assertFalse(result["production_inference_enabled"])
            self.assertEqual(result["same_named_identity_overlap_candidates"][0]["common_distinct_sampled"], 2)
            self.assertEqual(result["files"][0]["rows_sampled"], 2)
            self.assertEqual(result["files"][1]["rows_sampled"], 3)
            self.assertEqual(json.loads(report_path.read_text())["status"], "SCHEMA_AUDITED_NOT_TRAINED")

    def test_extra_pore_names_are_counted_without_fabricating_joins(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            parameters = root / "parameters.csv"
            pores = root / "poredf.csv"
            parameters.write_text("Name,Power (W)\\nA,350\\nB,400\\n".replace("\\n", "\n"))
            pores.write_text("Name,Diameter\\nA,5\\nB,6\\nPowder,3\\nPowder,4\\n".replace("\\n", "\n"))
            report = audit([parameters, pores], root / "report.json")
            matched = report["same_named_identity_overlap_candidates"][0]
            self.assertEqual(matched["common_distinct_sampled"], 2)
            self.assertEqual(matched["left_only_exact_ids"], [])
            self.assertEqual(matched["right_only_exact_ids"], ["Powder"])
            self.assertEqual(report["files"][1]["identity_columns"]["Name"]["counts_by_id"]["Powder"], 2)
            self.assertFalse(report["training_ready"])

    def test_bad_csv_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            a = root / "parameters.csv"
            b = root / "poredf.csv"
            a.write_text("sample_id,sample_id\nA,B\n")
            b.write_text("sample_id,pore_volume\nA,1\n")
            with self.assertRaises(ValueError):
                audit([a, b], root / "audit.json")

    def test_missing_file_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            with self.assertRaises(FileNotFoundError):
                audit([root / "missing.csv", root / "other.csv"], root / "audit.json")


if __name__ == "__main__":
    unittest.main()

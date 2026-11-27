import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location(
    "benchmark", pathlib.Path(__file__).parents[1]/"scripts/benchmark-nist-melt-pool.py")
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)

def fixture():
    rows = []
    for plate in bench.PLATES:
        for power in (100, 200, 300, 400, 500):
            for repeat in range(2):
                rows.append(dict(sample_id=plate, source_row=len(rows)+2,
                                 power_w=power, speed_mm_s=1000, beam_diameter_mm=.1,
                                 measured_depth_mm=.02+.3*power/1000,
                                 measured_width_mm=.04+.4*power/1000))
    return rows

class BenchmarkTests(unittest.TestCase):
    def test_condition_held_out_and_no_extrapolation(self):
        result = bench.evaluate(fixture(), "BP1", "measured_depth_mm")
        self.assertEqual(result["rows"], 10)
        self.assertEqual(result["condition_count"], 5)
        self.assertEqual(result["covered_conditions"], 3)
        self.assertEqual(result["covered_rows"], 6)
        self.assertAlmostEqual(result["eligible_row_coverage"], .6)
        self.assertAlmostEqual(result["paired_metrics"]["candidate_errors"]["mae_mm"], 0)
        self.assertGreater(result["paired_metrics"]["baseline_errors"]["mae_mm"], 0)
        self.assertEqual(result["folds"][0]["abstention_reason"], "outside_training_feature_ranges")
        self.assertEqual(result["folds"][-1]["abstention_reason"], "outside_training_feature_ranges")
        for fold in result["folds"]:
            self.assertEqual(fold["training_conditions"], 4)
            self.assertEqual(len(fold["held_out_source_rows"]), 2)

    def test_held_out_targets_and_other_plates_do_not_change_prediction(self):
        original = fixture()
        changed = fixture()
        for row in changed:
            if row["sample_id"] != "BP1" or row["power_w"] == 300:
                row["measured_depth_mm"] += 10
        def middle(rows):
            return bench.evaluate(rows, "BP1", "measured_depth_mm")["folds"][2]
        a, b = middle(original), middle(changed)
        self.assertEqual(a["candidate_prediction_mm"], b["candidate_prediction_mm"])
        self.assertEqual(a["baseline_prediction_mm"], b["baseline_prediction_mm"])
        self.assertNotEqual(a["candidate_errors"], b["candidate_errors"])

    def test_missing_invalid_data_and_small_groups_abstain(self):
        rows = fixture()
        rows[0]["measured_width_mm"] = None
        rows[1]["speed_mm_s"] = 0
        r = bench.evaluate(rows, "BP1", "measured_width_mm")
        self.assertEqual(r["excluded_rows"], 2)
        small = [row for row in rows if row["power_w"] <= 300]
        r = bench.evaluate(small, "BP2", "measured_width_mm")
        self.assertEqual(r["covered_conditions"], 0)
        self.assertIsNone(r["paired_metrics"])
        self.assertTrue(all(f["abstention_reason"] == "insufficient_training_conditions" for f in r["folds"]))

    def test_constant_energy_is_not_fitted(self):
        rows = fixture()
        for row in rows:
            row["speed_mm_s"] = row["power_w"]*2
        r = bench.evaluate(rows, "BP3", "measured_depth_mm")
        self.assertEqual(r["covered_conditions"], 0)
        self.assertTrue(all(f["abstention_reason"] == "constant_training_line_energy" for f in r["folds"]))

if __name__ == "__main__":
    unittest.main()

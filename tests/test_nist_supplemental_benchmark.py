import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location("bench",pathlib.Path(__file__).parents[1]/"scripts/benchmark-nist-supplemental.py")
bench=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)

def fixture():
    rows=[]
    for sample in ("A","B","C"):
        for power in (100,200,300):
            rows.append(dict(material="IN718",machine="AMMT",surface="320 grit",
                direction="X",spot_raw=70,sample=sample,track=str(power),
                power=power,speed=1000,width_um=20+power/10,depth_um=power/5))
    return rows

class SupplementalBenchmarkTests(unittest.TestCase):
    def test_sample_held_out_regression_and_track_averaging(self):
        rows=fixture()
        rows.append(dict(rows[0]))
        result=bench.evaluate(rows,"width_um")[0]
        self.assertEqual(result["sample_name_groups"],3)
        self.assertEqual(result["track_setting_points"],9)
        self.assertEqual(result["covered_points"],9)
        self.assertAlmostEqual(result["paired_metrics"]["line_energy"]["mae_um"],0)
        self.assertGreater(result["paired_metrics"]["baseline"]["mae_um"],0)

    def test_two_sample_groups_abstain(self):
        rows=[r for r in fixture() if r["sample"]!="C"]
        result=bench.evaluate(rows,"depth_um")[0]
        self.assertEqual(result["covered_points"],0)
        self.assertIsNone(result["paired_metrics"])
        self.assertEqual(result["abstentions"]["insufficient_training_sample_names_or_settings"],6)

    def test_separate_protocol_and_out_of_range(self):
        rows=fixture()
        rows.append(dict(rows[0],machine="EOS"))
        rows.append(dict(rows[0],track="extra",power=500))
        result=bench.evaluate(rows,"depth_um")
        self.assertEqual(len(result),2)
        ammt=next(r for r in result if r["machine"]=="AMMT")
        self.assertEqual(ammt["abstentions"]["outside_training_ranges"],1)
        eos=next(r for r in result if r["machine"]=="EOS")
        self.assertIsNone(eos["paired_metrics"])

    def test_shared_image_rows_excluded_even_across_sample_names(self):
        base={"A":"folder","B":"image","E":"A","F":"IN718","G":"320 grit","H":"AMMT",
              "I":"1","J":"X","K":"70","L":"200","M":"800","N":"100","O":"50"}
        rows=[(2,base),(3,dict(base,E="B")),(4,dict(base,B="different"))]
        records,excluded=bench.prepare(rows,bench.load_audit().numeric)
        self.assertEqual(len(records),1)
        self.assertEqual(excluded["shared_image_key"],2)

    def test_fit_does_not_depend_on_held_out_values(self):
        points=bench.track_points(fixture(),"width_um")
        train=[(k,y) for k,y in points if k[0]!="C"]
        first=bench.fit(train)
        altered=[(k,y+10000 if k[0]=="C" else y) for k,y in points]
        self.assertEqual(first,bench.fit([(k,y) for k,y in altered if k[0]!="C"]))

if __name__=="__main__":
    unittest.main()

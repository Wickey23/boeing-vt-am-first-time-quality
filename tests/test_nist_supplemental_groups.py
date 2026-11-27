import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location("groups",pathlib.Path(__file__).parents[1]/"scripts/audit-nist-supplemental-groups.py")
groups=importlib.util.module_from_spec(spec)
spec.loader.exec_module(groups)

def row(sample="sample-1",image="image-1",material="IN718",machine="AMMT",track="1",width="125"):
    return {"A":"folder","B":image,"E":sample,"F":material,"G":"bare","H":machine,
            "I":track,"J":"X","K":"70","L":"200","M":"800","N":width,"O":"100"}

class GroupAuditTests(unittest.TestCase):
    def test_separates_alloys_and_machines_and_preserves_group_counts(self):
        result=groups.summarize([(2,row()),(3,row(sample="sample-2",image="image-2")),
            (4,row(material="IN625",image="image-3")),(5,row(machine="EOS",image="image-4"))])
        self.assertEqual(result["data_rows"],4)
        self.assertEqual(len(result["material_machine_strata"]),3)
        stratum=next(r for r in result["material_machine_strata"] if r["material"]=="IN718" and r["machine"]=="AMMT")
        self.assertEqual(stratum["distinct_sample_names"],2)
        self.assertEqual(stratum["distinct_complete_process_settings"],1)
        self.assertTrue(stratum["target_eligibility"]["width_um"]["minimum_two_sample_groups_present"])
        self.assertFalse(result["training_ready"])
        self.assertFalse(result["independent_build_validation"])
        self.assertNotIn("sample-1",str(result))

    def test_missing_and_duplicate_data_are_reported_without_imputation(self):
        result=groups.summarize([(2,row()),(3,row(width="N/A")),(4,row(sample=""))])
        self.assertEqual(result["rows_with_incomplete_identity"],1)
        self.assertEqual(result["duplicate_image_key_excess_rows"],1)
        s=result["material_machine_strata"][0]
        self.assertEqual(s["missing_or_invalid"]["width_um"],1)
        self.assertEqual(s["target_eligibility"]["width_um"]["rows"],1)
        self.assertFalse(s["target_eligibility"]["width_um"]["minimum_two_sample_groups_present"])

    def test_numeric_validation_and_duplicate_rows(self):
        for v in ("nan","inf","bad","-5",None):
            self.assertIsNone(groups.numeric(v))
        self.assertEqual(groups.numeric("0"),0)
        self.assertIsNone(groups.numeric("0",True))
        with self.assertRaisesRegex(ValueError,"Duplicate source row"):
            groups.summarize([(2,row()),(2,row())])

if __name__=="__main__":
    unittest.main()

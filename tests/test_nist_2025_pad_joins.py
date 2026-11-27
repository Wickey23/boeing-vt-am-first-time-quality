import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location("joins",pathlib.Path(__file__).parents[1]/"scripts/audit-nist-2025-pad-joins.py")
joins=importlib.util.module_from_spec(spec)
spec.loader.exec_module(joins)

def param(sample="s1",loc="1.0"):
    return dict(zip(joins.PARAM_HEADER,[sample,"200","70","800","0.1","0","5","2",loc]))

def measurement(loc="1",row="1"):
    return dict(zip(joins.MEAS_HEADER,[row,"0.0","5.00","2.0",loc,"0","-1","NaN","",*(["10"]*41)]))

class PadJoinTests(unittest.TestCase):
    def test_exact_numeric_join_not_row_order(self):
        result=joins.audit([param(),param("s2","2")],{"depth":[measurement("2"),measurement()]})
        self.assertTrue(result["candidate_join_complete"])
        self.assertEqual(result["targets"]["depth"]["one_to_one_candidate_keys"],2)
        self.assertEqual(result["targets"]["depth"]["cell_classifications"],{"zero":2,"negative":2,"nonnumeric":2,"blank":2,"positive":82})

    def test_duplicate_keys_fail_closed(self):
        result=joins.audit([param(),param("s2")],{"depth":[measurement()]})
        self.assertFalse(result["candidate_join_complete"])
        self.assertEqual(result["duplicate_parameter_keys"],1)
        self.assertEqual(result["targets"]["depth"]["one_to_one_candidate_keys"],0)

    def test_missing_keys_do_not_match(self):
        result=joins.audit([param(loc="NaN")],{"depth":[measurement("2")]})
        self.assertFalse(result["candidate_join_complete"])
        self.assertEqual(result["invalid_parameter_keys"],1)
        self.assertEqual(result["targets"]["depth"]["keys_absent_from_parameters"],1)

    def test_header_and_row_width_validation(self):
        self.assertRaises(ValueError,joins.read_table,b"x,y\n1,2","utf-8",("a","b"))
        self.assertRaises(ValueError,joins.read_table,b"a,b\n1","utf-8",("a","b"))

    def protocol_fixture(self):
        params=[]
        rows=[]
        for plate in range(1,13):
            day="20241010" if plate in (1,4,7,10,11,12) else "20241015"
            for section in (1,2,3):
                sample=f"{day}_AMB_T{plate}2_P{section}"
                key=[str(x) for x in (*joins.CONDITIONS[(plate-1)//3],*joins.SECTIONS[section])]
                params.append(dict(zip(joins.PARAM_HEADER,[sample,"200","70","800","0.1",*key])))
                rows.append(dict(zip(joins.MEAS_HEADER,[sample,*key,*(["10"]*45)])))
        return params,rows

    def test_protocol_confirms_plates_without_approving_specimen_join(self):
        params,rows=self.protocol_fixture()
        result=joins.protocol_audit(params,{"depth":list(reversed(rows))})
        self.assertTrue(result["parameter_plate_section_design_verified"])
        self.assertEqual(result["matched_parameter_plate_groups"],12)
        self.assertTrue(result["target_protocol_audit"]["depth"]["literal_sample_identity_complete"])
        self.assertFalse(result["specimen_join_authorized"])
        self.assertEqual(len(result["target_protocol_audit"]["depth"]["condition_summaries"]),12)

    def test_condition_summary_does_not_assume_row_identity_or_cell_independence(self):
        params,rows=self.protocol_fixture()
        for i,r in enumerate(rows):
            r["Row"]=str(i)
        # Same condition: one row mean 100 based on a single cell,
        # two row means 10 based on 45 cells. Equal row weight gives 40.
        rows[0]["1 (µm)"]="100"
        for c in joins.MEAS_HEADER[6:]:
            rows[0][c]="NA"
        result=joins.protocol_audit(params,{"depth":rows})
        target=result["target_protocol_audit"]["depth"]
        self.assertFalse(target["literal_sample_identity_complete"])
        s=next(x for x in target["condition_summaries"] if x["powder_um"]=="80" and x["location_mm"]=="0.460")
        self.assertEqual(s["positive_cells"],91)
        self.assertEqual(s["row_balanced_positive_mean_um"],40)
        self.assertEqual(s["row_mean_range_um"],[10,100])

    def test_wrong_condition_layout_withholds_summary(self):
        params,rows=self.protocol_fixture()
        rows[0]["Location (mm)"]="99"
        result=joins.protocol_audit(params,{"depth":rows})
        self.assertFalse(result["target_protocol_audit"]["depth"]["condition_layout_matches"])
        self.assertEqual(result["target_protocol_audit"]["depth"]["condition_summaries"],[])

if __name__=="__main__":
    unittest.main()

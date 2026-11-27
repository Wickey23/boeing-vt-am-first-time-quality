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

if __name__=="__main__":
    unittest.main()

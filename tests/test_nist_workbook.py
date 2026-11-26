import importlib.util
import pathlib
import unittest
spec=importlib.util.spec_from_file_location('audit',pathlib.Path(__file__).parents[1]/'scripts/audit-nist-workbook.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
class Measurements(unittest.TestCase):
    def test_units_missing_values_and_no_inferred_build(self):
        row=audit.normalize({'A':'BP1','B':'P3','D':'Line 1','H':'139.863','I':'0','J':'N/A'},2,'hash')
        self.assertAlmostEqual(row['measured_depth_mm'],.139863)
        self.assertEqual(row['measured_width_mm'],0)
        self.assertIsNone(row['overlap_depth_mm'])
        self.assertIsNone(row['power_w'])
        self.assertIsNone(row['build_id'])
        self.assertIsNone(row['defect_label'])
        self.assertEqual(row['source_row'],2)
    def test_invalid_numeric_data_and_missing_identity_fail(self):
        with self.assertRaises(ValueError): audit.normalize({'A':'BP1','B':'P3','D':'1','H':'NaN'},2,'hash')
        with self.assertRaises(ValueError): audit.normalize({'A':'BP1'},2,'hash')
if __name__=='__main__': unittest.main()

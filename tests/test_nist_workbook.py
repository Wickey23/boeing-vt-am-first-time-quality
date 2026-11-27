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
    def test_plate_protocol_preserves_distinct_width_targets(self):
        for plate, expected_type, width_definition in (
            ('BP1','single_track','full_cross_section_width'),
            ('BP2','x_pad','remelted_pad_partial_width'),
            ('BP3','y_pad','remelted_pad_partial_width'),
        ):
            with self.subTest(plate=plate):
                row=audit.normalize({'A':plate,'B':'P1','D':'1','I':'125'},2,'hash')
                self.assertEqual(row['bare_plate_id'],plate)
                self.assertEqual(row['experiment_type'],expected_type)
                self.assertEqual(row['width_definition'],width_definition)
                self.assertEqual(row['measured_width_mm'],.125)
                self.assertIs(row['powder_present'],False)
                self.assertIsNone(row['build_id'])
                self.assertIsNone(row['defect_label'])

    def test_unknown_protocol_is_not_inferred(self):
        row=audit.normalize({'A':'other','B':'P1','D':'1'},2,'hash')
        for field in ('bare_plate_id','experiment_type','width_definition',
                      'powder_present','protocol_doi','build_id','defect_label'):
            self.assertIsNone(row[field])

    def test_verified_full_source_ids_map_to_canonical_plate_without_losing_raw_value(self):
        for plate in ('BP1','BP2','BP3'):
            source_id = 'AMB2022-718-SH1-' + plate
            row = audit.normalize({'A':source_id,'B':'P1','D':'1'},2,'hash')
            self.assertEqual(row['source_sample_id'],source_id)
            self.assertEqual(row['raw_cells']['A'],source_id)
            self.assertEqual(row['sample_id'],plate)
            self.assertEqual(row['bare_plate_id'],plate)
            self.assertIs(row['powder_present'],False)
            self.assertIsNone(row['build_id'])
        foreign = audit.normalize({'A':'OTHER-BP1','B':'P1','D':'1'},2,'hash')
        self.assertIsNone(foreign['bare_plate_id'])
        self.assertEqual(foreign['sample_id'],'OTHER-BP1')

if __name__=='__main__': unittest.main()

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evaluation import diagnostics, metrics, validate_study_split
from train_material_orientation import run


class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.train = pd.DataFrame({'paper ID':[1,1,2,2,3,3], 'x':[1.,2.,3.,4.,5.,6.], 'y':[3.,5.,7.,9.,11.,13.]})
        self.holdout = pd.DataFrame({'paper ID':[4,4], 'x':[7.,8.], 'y':[15.,17.]}, index=[6,7])

    def test_leakage_and_missing_identity_block_evaluation(self):
        for group in [1,np.nan]:
            with self.assertRaises(ValueError):
                validate_study_split(self.train,self.holdout.assign(**{'paper ID':group}),['x'],'y')
        with self.assertRaises(ValueError):
            validate_study_split(self.train,self.holdout.assign(x=[1.,8.],y=[3.,17.]),['x'],'y')
        with self.assertRaises(ValueError):
            validate_study_split(self.train,self.holdout.assign(x=[np.inf,8.]),['x'],'y')

    def test_development_folds_exclude_holdout(self):
        report=diagnostics(self.train,self.holdout,['x'],'y',{'model':[14.,16.]})
        self.assertEqual(len(report['development_leave_one_study_out']),3)
        for fold in report['development_leave_one_study_out']:
            self.assertNotIn(fold['held_out_study'],fold['training_studies'])
            self.assertNotIn(4,fold['training_studies'])
        changed=diagnostics(self.train,self.holdout.assign(x=[700.,800.]),['x'],'y',{'model':[14.,16.]})
        self.assertEqual(report['development_leave_one_study_out'],changed['development_leave_one_study_out'])
        self.assertEqual(report['holdout_rows_outside_training_feature_ranges'],2)
        self.assertEqual(report['holdout_metrics']['model']['mae'],1)
        self.assertFalse(report['release_eligible'])
        self.assertFalse(report['inference_enabled'])
        self.assertEqual(report['split_sha256'],changed['split_sha256'])

    def test_metrics_reject_missing_or_nonfinite_predictions(self):
        for actual,predicted in [([],[]),([1],[np.nan]),([1,2],[1])]:
            with self.assertRaises(ValueError):metrics(actual,predicted)
        self.assertEqual(metrics([1,2],[1,2])['rmse'],0)

    def test_material_baseline_cannot_grant_release(self):
        # Synthetic data tests the software contract, never engineering accuracy.
        rows=[{'study_id':f's{study}','specimen_id':f'p{i}','material':'TEST_ONLY','process_profile_id':'TEST_ONLY','build_angle_deg':i*10,'yield_strength_mpa':100+i*2} for study in range(4) for i in range(10)]
        with tempfile.TemporaryDirectory() as path:
            source=Path(path)/'test.csv';output=Path(path)/'result.json'
            pd.DataFrame(rows).to_csv(source,index=False)
            with contextlib.redirect_stdout(io.StringIO()):
                run(source,output)
            report=json.loads(output.read_text())
            self.assertFalse(report['release_eligible'])
            self.assertFalse(report['inference_enabled'])
            rows[0]['study_id']=None
            pd.DataFrame(rows).to_csv(source,index=False)
            with self.assertRaises(ValueError):run(source,output)


if __name__=='__main__':unittest.main()

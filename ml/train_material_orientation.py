#!/usr/bin/env python3
"""Orientation-dependent tensile-response baseline using experimentally measured CSV rows.
Research-only. This is NOT a surrogate for support volume or aerospace allowables.
"""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.dummy import DummyRegressor

REQUIRED=["study_id","specimen_id","material","process_profile_id","build_angle_deg","yield_strength_mpa"]
def run(path:Path, output:Path):
 d=pd.read_csv(path)
 missing=set(REQUIRED)-set(d)
 if missing: raise ValueError("Missing required measured columns: "+str(sorted(missing)))
 if d[REQUIRED].isna().any().any() or any(d[c].astype(str).str.strip().eq("").any() for c in ["study_id","specimen_id","material","process_profile_id"]): raise ValueError("Missing specimen identity or process provenance")
 if d.study_id.nunique()<3 or len(d)<30: raise ValueError("Require >=30 experimental specimens and >=3 independently identifiable studies for holdout validation")
 if d.material.nunique()!=1 or d.process_profile_id.nunique()!=1: raise ValueError("One material and process profile per model")
 d["build_angle_deg"]=pd.to_numeric(d.build_angle_deg,errors="coerce")
 d["yield_strength_mpa"]=pd.to_numeric(d.yield_strength_mpa,errors="coerce")
 if d[["build_angle_deg","yield_strength_mpa"]].isna().any().any() or not np.isfinite(d[["build_angle_deg","yield_strength_mpa"]].to_numpy()).all(): raise ValueError("Nonfinite angle or strength")
 if not d.build_angle_deg.between(0,180).all() or (d.yield_strength_mpa<=0).any():raise ValueError("Invalid strength or angle range")
 if d.duplicated(["study_id","specimen_id"]).any(): raise ValueError("Duplicate specimen identifiers")
 angle=np.deg2rad(d.build_angle_deg.to_numpy())
 X=np.column_stack((np.sin(angle),np.cos(angle),np.sin(2*angle),np.cos(2*angle)))
 y=d.yield_strength_mpa.to_numpy()
 tr,te=next(GroupShuffleSplit(n_splits=1,test_size=.25,random_state=42).split(X,groups=d.study_id))
 model=RandomForestRegressor(n_estimators=200,min_samples_leaf=3,random_state=42)
 model.fit(X[tr],y[tr]); p=model.predict(X[te])
 dummy=DummyRegressor(strategy="mean");dummy.fit(X[tr],y[tr]);b=dummy.predict(X[te])
 report={"status":"RESEARCH_ONLY_NOT_QUALIFIED","target":"measured_yield_strength_mpa","material":str(d.material.iloc[0]),"process_profile":str(d.process_profile_id.iloc[0]),"sample_count":len(d),"training_studies":int(d.study_id.iloc[tr].nunique()),"holdout_studies":int(d.study_id.iloc[te].nunique()),"holdout_mae_mpa":float(mean_absolute_error(y[te],p)),"naive_baseline_mae_mpa":float(mean_absolute_error(y[te],b)),"data_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"beats_mean_baseline":bool(mean_absolute_error(y[te],p)<mean_absolute_error(y[te],b)),"release_eligible":False,"inference_enabled":False,"release_blockers":["Independent provenance/property-condition review required","External validation and predeclared engineering tolerances required","Predictive uncertainty and applicability domain not validated"],"note":"Study-held-out exploratory validation only; no aircraft allowable inference or qualification"}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+"\n");print(json.dumps(report,indent=2))
if __name__=="__main__":
 a=argparse.ArgumentParser();a.add_argument("--csv",required=True,type=Path);a.add_argument("--out",default="ml/reports/material-orientation.json",type=Path);p=a.parse_args();run(p.csv,p.out)

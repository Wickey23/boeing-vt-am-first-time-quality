#!/usr/bin/env python3
"""Train a research-only support-volume surrogate from *measured* slicer outcomes.

Input CSV must have one row per part/orientation/process run. No synthetic labels accepted
for release. The holdout is grouped by part ID to test generalization to unseen parts.
"""
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

FEATURES = ["build_height_mm","down_facing_area_mm2","support_proxy_mm3","contact_area_mm2","overhang_fraction","part_volume_mm3","surface_area_mm2"]
REQUIRED = ["part_id","process_profile_id","target_support_volume_mm3",*FEATURES]

def train(source: Path, output: Path, min_parts: int = 5):
    data = pd.read_csv(source)
    missing = [c for c in REQUIRED if c not in data.columns]
    if missing: raise ValueError("Missing columns: " + ", ".join(missing))
    if len(data) < 30 or data.part_id.nunique() < min_parts:
        raise ValueError("Need at least 30 labeled orientations and 5 distinct parts before training")
    if data.process_profile_id.nunique() != 1:
        raise ValueError("Train one material/machine/process profile at a time")
    numeric = data[FEATURES + ["target_support_volume_mm3"]].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(numeric.to_numpy()).all() or (numeric.target_support_volume_mm3 < 0).any():
        raise ValueError("Features/targets must be finite and support volume nonnegative")
    if ((numeric[FEATURES] < 0).any().any()) or (numeric.overhang_fraction > 1).any():
        raise ValueError("Invalid geometric features")
    if data.duplicated(subset=["part_id","process_profile_id","build_height_mm","down_facing_area_mm2","support_proxy_mm3","contact_area_mm2"]).any():
        raise ValueError("Duplicate records detected: check repeated labels")
    splitter=GroupShuffleSplit(n_splits=1,test_size=.25,random_state=42)
    train_idx,test_idx=next(splitter.split(numeric,groups=data.part_id))
    X=numeric[FEATURES];y=numeric.target_support_volume_mm3
    model=Pipeline([("scale",StandardScaler()),("regression",Ridge(alpha=10.0,positive=True))])
    model.fit(X.iloc[train_idx],y.iloc[train_idx])
    predicted=np.maximum(0,model.predict(X.iloc[test_idx]))
    baseline=np.maximum(0,X.iloc[test_idx].support_proxy_mm3.to_numpy())
    mae=float(mean_absolute_error(y.iloc[test_idx],predicted))
    baseline_mae=float(mean_absolute_error(y.iloc[test_idx],baseline))
    # If the trained surrogate does not outperform the geometry proxy, do not export.
    if mae>=baseline_mae: raise ValueError(f"Model not released: holdout MAE {mae:.3f} >= proxy MAE {baseline_mae:.3f}")
    scaler=model.named_steps["scale"];reg=model.named_steps["regression"]
    artifact={
      "schema":"orientation-support-surrogate/v1",
      "status":"RESEARCH_ONLY_NOT_QUALIFIED",
      "version":datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
      "profile_id":str(data.process_profile_id.iloc[0]),
      "features":FEATURES,
      "scaler_mean":scaler.mean_.tolist(),"scaler_scale":scaler.scale_.tolist(),
      "coefficients":reg.coef_.tolist(),"intercept":float(reg.intercept_),
      "prediction_target":"slicer_support_volume_mm3",
      "training":{"rows":len(train_idx),"holdout_rows":len(test_idx),
                  "train_parts":int(data.part_id.iloc[train_idx].nunique()),
                  "holdout_parts":int(data.part_id.iloc[test_idx].nunique()),
                  "mae_mm3":mae,"baseline_proxy_mae_mm3":baseline_mae,
                  "rmse_mm3":float(np.sqrt(mean_squared_error(y.iloc[test_idx],predicted))),
                  "r2":float(r2_score(y.iloc[test_idx],predicted)),
                  "dataset_sha256":hashlib.sha256(source.read_bytes()).hexdigest()},
      "limitations":["Only valid for the encoded manufacturing profile and data distribution.",
                     "Support prediction is not structural or certification evidence.",
                     "Model is a statistical research surrogate; no thermal or mechanical properties inferred."]
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(artifact,indent=2)+"\n")
    print(json.dumps({"output":str(output),"holdout_mae_mm3":mae,"proxy_mae_mm3":baseline_mae},indent=2))

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--csv",required=True,type=Path)
    parser.add_argument("--output",default="ml/models/support-model.json",type=Path)
    args=parser.parse_args()
    train(args.csv,args.output)

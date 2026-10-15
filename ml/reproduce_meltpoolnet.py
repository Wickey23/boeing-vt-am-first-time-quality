#!/usr/bin/env python3
"""Reproduce the ORIENTAI exploratory melt-pool baseline from the public MeltpoolNet CSV.
This is NOT a production or aerospace-qualified model.
"""
import argparse,hashlib,json,urllib.request
from pathlib import Path
import numpy as np,pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler

SOURCE="https://raw.githubusercontent.com/BaratiLab/MeltpoolNet/main/Data/meltpoolnet_regression.csv"
FEATURES=["Power","Velocity","beam D","layer thickness"]
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--csv",type=Path,help="Local copy of original meltpoolnet_regression.csv; omit to download")
 p.add_argument("--out",type=Path,default=Path("ml/reports/meltpoolnet-reproduced.json"))
 a=p.parse_args()
 if a.csv:data=a.csv.read_bytes()
 else:
  with urllib.request.urlopen(urllib.request.Request(SOURCE,headers={"User-Agent":"ORIENTAI research replication"}),timeout=40) as r:data=r.read(2_000_001)
  if len(data)>2_000_000:raise ValueError("Unexpectedly large source")
 source_sha=hashlib.sha256(data).hexdigest()
 from io import BytesIO
 df=pd.read_csv(BytesIO(data))
 d=df[(df.Material=="Ti-6Al-4V")&(df.Process=="PBF")].copy()
 for col in FEATURES+["depth of meltpool","paper ID"]:d[col]=pd.to_numeric(d[col],errors="coerce")
 d=d.dropna(subset=FEATURES+["depth of meltpool","paper ID"])
 d=d[(d[FEATURES+["depth of meltpool"]]>0).all(axis=1)]
 papers=sorted(d["paper ID"].unique())
 held=set(x for i,x in enumerate(papers) if i%4==1)
 tr=d[~d["paper ID"].isin(held)];te=d[d["paper ID"].isin(held)]
 if len(d)<100 or len(papers)<5 or len(tr)<50 or len(te)<20:raise ValueError("Dataset underpowered or incompatible")
 scale=StandardScaler().fit(tr[FEATURES])
 xtrain=scale.transform(tr[FEATURES]);xtest=scale.transform(te[FEATURES])
 ridge=Ridge(alpha=50.0).fit(xtrain,tr["depth of meltpool"])
 knn=KNeighborsRegressor(n_neighbors=7,weights="distance").fit(xtrain,tr["depth of meltpool"])
 actual=te["depth of meltpool"]
 report={"source":SOURCE,"source_sha256":source_sha,"filter":"Ti-6Al-4V PBF with positive finite melt-pool depth and process features","n_rows":len(d),"train":len(tr),"holdout":len(te),"held_out_paper_ids":sorted(held),"ridge_mae":float(mean_absolute_error(actual,np.maximum(0,ridge.predict(xtest)))),"knn7_mae":float(mean_absolute_error(actual,knn.predict(xtest))),"mean_baseline_mae":float(mean_absolute_error(actual,np.repeat(tr["depth of meltpool"].mean(),len(te)))),"status":"UNQUALIFIED_RESEARCH_BASELINE","limitations":["Reported target units and measurement provenance require source-paper review","Study-ID holdout does not ensure independent-machine generalization","No first-time-quality certification or support-volume labels"]}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2)+"\n");print(json.dumps(report,indent=2))
if __name__=="__main__":main()

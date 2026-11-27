#!/usr/bin/env python3
"""Exploratory sample-name-held-out benchmark, no independent-build claim.

Exact material, machine, surface, direction and raw spot category strata.
Exclude all rows sharing an image key (conservative until resolved).
Do not pool source datasets, alloys, or different experimental protocols.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import math
import pathlib
import statistics

TARGETS=("width_um","depth_um")
MIN_TRAIN_SAMPLES=2
MIN_TRAIN_CONDITIONS=3

def load_audit():
    spec=importlib.util.spec_from_file_location("groups",pathlib.Path(__file__).with_name("audit-nist-supplemental-groups.py"))
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def prepare(rows,numeric):
    image_counts=collections.Counter((c.get("A"),c.get("B")) for _,c in rows)
    records=[]
    excluded=collections.Counter()
    for idx,c in rows:
        if not all((c.get(k) or "").strip() for k in "ABEFGHIJ"):
            excluded["incomplete_identity_or_protocol"]+=1
            continue
        if image_counts[(c["A"],c["B"])]>1:
            excluded["shared_image_key"]+=1
            continue
        spot,power,speed=(numeric(c.get(k),True) for k in "KLM")
        if None in (spot,power,speed):
            excluded["invalid_process_input"]+=1
            continue
        records.append(dict(source_row=idx,material=c["F"],machine=c["H"],
            surface=c["G"],direction=c["J"],spot_raw=spot,sample=c["E"],track=c["I"],
            power=power,speed=speed,width_um=numeric(c.get("N")),depth_um=numeric(c.get("O"))))
    return records,dict(excluded)

def stratum(r):
    return tuple(r[k] for k in ("material","machine","surface","direction","spot_raw"))

def track_points(rows,target):
    """Average repeated sections only within one sample, track and setting."""
    tracks=collections.defaultdict(list)
    for r in rows:
        if r[target] is not None:
            tracks[(r["sample"],r["track"],r["power"],r["speed"])].append(r[target])
    return [(key,statistics.mean(vals)) for key,vals in sorted(tracks.items())]

def fit(points):
    # Balance specimen names and process conditions, not image counts.
    by_sample=collections.defaultdict(lambda:collections.defaultdict(list))
    for (sample,track,power,speed),y in points:
        by_sample[sample][(power,speed)].append(y)
    settings={k for groups in by_sample.values() for k in groups}
    if len(by_sample)<MIN_TRAIN_SAMPLES or len(settings)<MIN_TRAIN_CONDITIONS:
        return None,"insufficient_training_sample_names_or_settings"
    weighted=[]
    for groups in by_sample.values():
        weight=1/(len(by_sample)*len(groups))
        for (power,speed),ys in groups.items():
            weighted.append((power/speed,statistics.mean(ys),weight))
    xbar=math.fsum(x*w for x,y,w in weighted)
    ybar=math.fsum(y*w for x,y,w in weighted)
    denom=math.fsum(w*(x-xbar)**2 for x,y,w in weighted)
    if denom<=0:
        return None,"constant_training_line_energy"
    slope=math.fsum(w*(x-xbar)*(y-ybar) for x,y,w in weighted)/denom
    return (ybar,ybar-slope*xbar,slope,
            min(x for x,y,w in weighted),max(x for x,y,w in weighted),
            min(p for p,s in settings),max(p for p,s in settings),
            min(s for p,s in settings),max(s for p,s in settings)),None

def evaluate(records,target):
    groups=collections.defaultdict(list)
    for r in records:
        groups[stratum(r)].append(r)
    outputs=[]
    for key,rs in sorted(groups.items()):
        points=track_points(rs,target)
        samples=sorted({k[0] for k,y in points})
        paired=[]
        reasons=collections.Counter()
        covered_samples=0
        for held in samples:
            train=[(k,y) for k,y in points if k[0]!=held]
            test=[(k,y) for k,y in points if k[0]==held]
            model,reason=fit(train)
            if model is None:
                reasons[reason]+=len(test)
                continue
            mean,intercept,slope,elo,ehi,plo,phi,slo,shi=model
            errors=[]
            for (_,track,power,speed),y in test:
                x=power/speed
                prediction=intercept+slope*x
                if not (elo<=x<=ehi and plo<=power<=phi and slo<=speed<=shi):
                    reasons["outside_training_ranges"]+=1
                elif not math.isfinite(prediction) or prediction<0:
                    reasons["invalid_prediction"]+=1
                else:
                    errors.append((mean-y,prediction-y))
            if errors:
                paired.append(errors)
                covered_samples+=1
        count=sum(len(fold) for fold in paired)
        metrics=None
        if paired:
            metrics={name:{"mae_um":statistics.mean(statistics.mean(abs(e[i]) for e in fold) for fold in paired),
                           "rmse_um":math.sqrt(statistics.mean(statistics.mean(e[i]**2 for e in fold) for fold in paired))}
                     for i,name in enumerate(("baseline","line_energy"))}
        outputs.append({"material":key[0],"machine":key[1],"surface":key[2],"direction":key[3],
                        "spot_raw":key[4],"target":target,"rows":len(rs),
                        "sample_name_groups":len(samples),"track_setting_points":len(points),
                        "covered_sample_name_groups":covered_samples,"covered_points":count,
                        "point_coverage":count/len(points) if points else None,
                        "abstentions":dict(reasons),"paired_metrics":metrics})
    return outputs

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source-dir",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    a=p.parse_args()
    audit=load_audit()
    for name,digest in ((audit.WORKBOOK,audit.WORKBOOK_SHA),(audit.README,audit.README_SHA)):
        if hashlib.sha256((a.source_dir/name).read_bytes()).hexdigest()!=digest:
            raise ValueError("Unreviewed supplemental source version: "+name)
    rows=audit.read_data(a.source_dir/audit.WORKBOOK)
    if len(rows)!=250:
        raise ValueError("Unexpected measurement row count")
    records,excluded=prepare(rows,audit.numeric)
    result={"schema":"orientai.supplemental-sample-benchmark.v1","source_doi":"10.18434/mds2-2923",
            "workbook_sha256":audit.WORKBOOK_SHA,"readme_sha256":audit.README_SHA,
            "source_rows":len(rows),"eligible_protocol_rows":len(records),"excluded":excluded,
            "experiments":[item for target in TARGETS for item in evaluate(records,target)],
            "independent_build_validation":False,"defect_prediction":False,"deployment_approved":False,
            "calibrated_uncertainty":False,"limitations":[
                "Sample-name-held-out is not verified physical build independence.",
                "Exact raw spot category is not a validated spot diameter measurement.",
                "Rows with shared image keys are conservatively excluded, not silently deduplicated.",
                "No transfer across machine, alloy, surface, direction or source dataset.",
                "Metrics balanced across covered held-out sample names only. Report coverage.",
                "No independent holdout or engineering acceptance threshold."]}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__=="__main__":
    main()

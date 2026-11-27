#!/usr/bin/env python3
"""Exploratory within-plate measurement benchmark, NOT a defect predictor.

Frozen comparison: train-only mean versus ordinary least squares on line energy.
Leave one exact process-parameter tuple out at a time, separately by plate and
target. This is condition-held-out, NOT specimen- or build-held-out validation.
Requires original source reconciliation; never imports derived or synthetic CSVs
in the CLI. All generated outputs are local research evidence.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import pathlib
import statistics

TARGETS = ("measured_depth_mm", "measured_width_mm")
FEATURES = ("power_w", "speed_mm_s", "beam_diameter_mm")
PLATES = ("BP1", "BP2", "BP3")
MIN_TRAIN_GROUPS = 3

def positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0

def nonnegative(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0

def group_key(row):
    return tuple(row[key] for key in FEATURES)

def energy(row):
    return row["power_w"] / row["speed_mm_s"]

def fit(train, target):
    # Give each distinct process condition equal weight, not each section.
    groups = {}
    for r in train:
        groups.setdefault(group_key(r), []).append(r)
    points = [(energy(rs[0]), statistics.mean(r[target] for r in rs))
              for rs in groups.values()]
    if len(points) < MIN_TRAIN_GROUPS:
        return None, "insufficient_training_conditions"
    xs, ys = zip(*points)
    xbar, ybar = statistics.mean(xs), statistics.mean(ys)
    denom = math.fsum((x-xbar)**2 for x in xs)
    if denom <= 0:
        return None, "constant_training_line_energy"
    slope = math.fsum((x-xbar)*(y-ybar) for x,y in points) / denom
    intercept = ybar-slope*xbar
    bounds = [(min(k[i] for k in groups), max(k[i] for k in groups))
              for i in range(len(FEATURES))]
    return (ybar, intercept, slope, min(xs), max(xs), bounds), None

def metrics(folds):
    """Condition-balanced errors on the identical paired evaluation subset."""
    if not folds:
        return None
    return {
        key: {
            "mae_mm": statistics.mean(statistics.mean(abs(e) for e in f[key]) for f in folds),
            "rmse_mm": math.sqrt(statistics.mean(statistics.mean(e**2 for e in f[key]) for f in folds)),
        } for key in ("baseline_errors", "candidate_errors")
    }

def evaluate(rows, plate, target):
    if plate not in PLATES or target not in TARGETS:
        raise ValueError("Unsupported plate or target")
    selected = [r for r in rows if r["sample_id"] == plate]
    valid = [r for r in selected if all(positive(r.get(k)) for k in FEATURES)
             and nonnegative(r.get(target))]
    groups = {}
    for r in valid:
        groups.setdefault(group_key(r), []).append(r)
    folds, paired = [], []
    for condition, test in sorted(groups.items()):
        train = [r for key, rs in groups.items() if key != condition for r in rs]
        model, reason = fit(train, target)
        fold = {"held_out_condition": dict(zip(FEATURES, condition)),
                "held_out_source_rows": [r["source_row"] for r in test],
                "training_conditions": len(groups)-1, "test_rows": len(test)}
        if model is not None:
            baseline, intercept, slope, lo, hi, bounds = model
            x = energy(test[0])
            prediction = intercept+slope*x
            if not lo <= x <= hi or any(not a <= v <= b for v,(a,b) in zip(condition,bounds)):
                reason = "outside_training_feature_ranges"
            elif not nonnegative(prediction):
                reason = "nonphysical_or_nonfinite_prediction"
            else:
                fold.update(baseline_prediction_mm=baseline, candidate_prediction_mm=prediction,
                            baseline_errors=[baseline-r[target] for r in test],
                            candidate_errors=[prediction-r[target] for r in test])
                paired.append(fold)
        fold["abstention_reason"] = reason
        folds.append(fold)
    covered = sum(f["test_rows"] for f in paired)
    return {"plate": plate, "target": target, "rows": len(selected),
            "eligible_rows": len(valid), "excluded_rows": len(selected)-len(valid),
            "condition_count": len(groups), "covered_conditions": len(paired),
            "covered_rows": covered,
            "condition_coverage": len(paired)/len(groups) if groups else None,
            "eligible_row_coverage": covered/len(valid) if valid else None,
            "paired_metrics": metrics(paired), "folds": folds}

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-dir", type=pathlib.Path, default=pathlib.Path("data/nist-lpbf"))
    p.add_argument("--output", type=pathlib.Path, required=True)
    args = p.parse_args()
    here = pathlib.Path(__file__).parent
    gate = load_module("reconcile", here/"reconcile-nist-source.py")
    parser = load_module("audit", here/"audit-nist-workbook.py")
    workbook = args.source_dir/gate.WORKBOOK
    if hashlib.sha256(workbook.read_bytes()).hexdigest() != gate.PINNED_SHA256:
        raise ValueError("Unreviewed workbook version")
    audit = parser.audit(workbook)
    reconciliation = gate.reconcile(audit, gate.check_readme((args.source_dir/"2718_README.txt").read_bytes()))
    result = {"schema": "orientai.nist-exploratory-benchmark.v1",
              "source_reconciliation": reconciliation,
              "method": "within-plate leave-one-process-condition-out; condition-balanced mean vs fixed line-energy OLS",
              "experiments": [evaluate(audit["measurements"], plate, target) for plate in PLATES for target in TARGETS],
              "independent_build_validation": False, "deployment_approved": False,
              "defect_prediction": False, "calibrated_uncertainty": False,
              "limitations": ["Repeated sections may share physical specimens across conditions.",
                              "Range checks do not establish physical applicability.",
                              "No calibrated prediction intervals or independent-build metrics.",
                              "Bare-plate width definitions differ; plate results are not pooled."]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False)+"\n", encoding="utf-8")

if __name__ == "__main__":
    main()

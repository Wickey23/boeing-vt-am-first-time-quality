#!/usr/bin/env python3
"""Research-only measured lack-of-fusion classifier. Never enables production inference.

Requires independently inspected per-specimen binary outcomes from multiple physical
LPBF builds. Build identity, machine profile and provenance are mandatory. Results
are exploratory even when metrics are favorable; approval requires human review.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, brier_score_loss, confusion_matrix, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = ["laser_power_w", "scan_speed_mm_s", "hatch_spacing_mm", "layer_thickness_mm"]
REQUIRED = ["specimen_id", "build_id", "material", "machine", "process_revision",
            "inspection_method", "inspection_reference", "outcome_definition",
            "measured_lack_of_fusion", *FEATURES]
INVALID_WORDS = {"", "unknown", "n/a", "na", "placeholder", "synthetic", "demo", "test_only", "none"}


def load_verified_shape(source: Path):
    """Validate format and provenance claims; cannot independently authenticate measurements."""
    data = pd.read_csv(source, dtype={col: "string" for col in REQUIRED[:8]})
    missing = sorted(set(REQUIRED) - set(data.columns))
    if missing:
        raise ValueError("Missing columns: " + ", ".join(missing))
    if len(data) < 60:
        raise ValueError("Require at least 60 measured specimens for exploratory baseline")
    for field in REQUIRED[:8]:
        values = data[field].astype("string").str.strip()
        if values.isna().any() or values.str.lower().isin(INVALID_WORDS).any():
            raise ValueError(f"Missing or placeholder provenance: {field}")
        data[field] = values
    if data.specimen_id.duplicated().any():
        raise ValueError("Duplicate specimen ID")
    if data.build_id.nunique() < 6:
        raise ValueError("Require at least six independent physical builds")
    for field in ["material", "machine", "process_revision", "inspection_method", "outcome_definition"]:
        if data[field].nunique() != 1:
            raise ValueError(f"Mixed {field}; separate model/inspection scope required")
    if data.inspection_reference.nunique() < 2:
        raise ValueError("Require inspection references traceable to multiple inspected builds")
    labels = pd.to_numeric(data.measured_lack_of_fusion, errors="coerce")
    if labels.isna().any() or not labels.isin([0, 1]).all():
        raise ValueError("Measured outcome must be binary 0/1")
    if labels.nunique() < 2:
        raise ValueError("Both observed outcome classes are required")
    features = data[FEATURES].apply(pd.to_numeric, errors="coerce")
    if not np.isfinite(features.to_numpy(dtype=float)).all() or (features <= 0).any().any():
        raise ValueError("Physical process features must be finite positive numbers")
    if data.duplicated(["build_id", *FEATURES, "measured_lack_of_fusion"]).any():
        raise ValueError("Repeated process/outcome rows within build require provenance review")
    return data, features, labels.astype(int)


def evaluate(source: Path, output: Path):
    data, x, y = load_verified_shape(source)
    # One prespecified grouped split. Never search held-out outcomes for a favorable split.
    train, test = next(GroupShuffleSplit(n_splits=1, test_size=.3, random_state=42)
                       .split(x, y, groups=data.build_id))
    if len(set(data.build_id.iloc[train]) & set(data.build_id.iloc[test])):
        raise ValueError("Build leakage detected")
    if y.iloc[train].nunique() != 2 or y.iloc[test].nunique() != 2:
        raise ValueError("Prespecified split lacks both measured classes; collect more independent builds")
    if len(set(data.build_id.iloc[test])) < 2:
        raise ValueError("Require at least two independent held-out builds")
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=1.0))
    model.fit(x.iloc[train], y.iloc[train])
    probabilities = model.predict_proba(x.iloc[test])[:, 1]
    threshold = .5  # Fixed before holdout evaluation; not tuned to the test set.
    predicted = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = (int(v) for v in confusion_matrix(y.iloc[test], predicted, labels=[0, 1]).ravel())
    base = float(y.iloc[train].mean())
    brier = float(brier_score_loss(y.iloc[test], probabilities))
    baseline_brier = float(brier_score_loss(y.iloc[test], np.full(len(test), base)))
    report = {
        "schema": "orientai.lof.research-baseline.v1",
        "status": "TRAINED_RESEARCH_ONLY_NOT_VALIDATED",
        "inference_enabled": False,
        "release_eligible": False,
        "dataset_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "source_rows": len(data),
        "scope": {name: str(data[name].iloc[0]) for name in
                  ("material", "machine", "process_revision", "inspection_method", "outcome_definition")},
        "features": FEATURES,
        "training": {"rows": len(train), "build_ids": sorted(data.build_id.iloc[train].unique().tolist()),
                     "positive_cases": int(y.iloc[train].sum())},
        "held_out": {"rows": len(test), "build_ids": sorted(data.build_id.iloc[test].unique().tolist()),
                     "positive_cases": int(y.iloc[test].sum())},
        "metrics": {"threshold": threshold, "tn": tn, "fp": fp, "fn": fn, "tp": tp,
                    "balanced_accuracy": float(balanced_accuracy_score(y.iloc[test], predicted)),
                    "brier": brier, "training_prevalence_baseline_brier": baseline_brier,
                    "roc_auc": float(roc_auc_score(y.iloc[test], probabilities))},
        "release_blockers": [
            "Input inspection provenance and physical independence not independently authenticated",
            "Single dataset grouped holdout is not external machine/build validation",
            "No confidence intervals, calibration review, or qualified engineering acceptance criteria",
            "No authorized machine/material-specific predictive deployment"
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    result = evaluate(args.csv, args.report)
    print(json.dumps({"status": result["status"], "report": str(args.report),
                      "holdout_builds": len(result["held_out"]["build_ids"]),
                      "brier": result["metrics"]["brier"]}, indent=2))


if __name__ == "__main__":
    main()

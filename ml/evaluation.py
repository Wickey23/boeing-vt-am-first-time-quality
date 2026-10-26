"""Auditable research evaluation; these checks never grant production eligibility."""
import hashlib
import json
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def metrics(actual, predicted):
    actual, predicted = np.asarray(actual), np.asarray(predicted)
    if not len(actual) or actual.shape != predicted.shape or not np.isfinite(actual).all() or not np.isfinite(predicted).all():
        raise ValueError("Metrics require matching nonempty finite observations")
    return {"n": len(actual), "mae": float(mean_absolute_error(actual, predicted)),
            "rmse": float(np.sqrt(mean_squared_error(actual, predicted)))}


def validate_study_split(train, holdout, features, target, group="paper ID"):
    if not len(train) or not len(holdout):
        raise ValueError("Empty training or holdout partition")
    if train[group].isna().any() or holdout[group].isna().any():
        raise ValueError("Missing source study identity")
    if not set(train[group]).isdisjoint(set(holdout[group])):
        raise ValueError("Source study leakage across train and holdout")
    columns = features + [target]
    if not np.isfinite(train[columns].to_numpy()).all() or not np.isfinite(holdout[columns].to_numpy()).all():
        raise ValueError("Nonfinite model features or targets")
    overlap = train[columns].merge(holdout[columns], on=columns).drop_duplicates()
    if len(overlap):
        raise ValueError("Duplicate feature/target records across studies require provenance review before evaluation")


def diagnostics(train, holdout, features, target, predictions, group="paper ID"):
    validate_study_split(train, holdout, features, target, group)
    folds = []
    # Only development studies participate. Holdout results do not tune alpha.
    for study in sorted(train[group].unique()):
        fit = train[train[group] != study]
        test = train[train[group] == study]
        validate_study_split(fit, test, features, target, group)
        if len(fit) < 2:
            raise ValueError("Insufficient independent development studies")
        model = make_pipeline(StandardScaler(), Ridge(alpha=50.0))
        model.fit(fit[features], fit[target])
        pred = np.maximum(0, model.predict(test[features]))
        folds.append({"held_out_study": float(study), "training_studies": sorted(float(v) for v in fit[group].unique()),
                      "ridge": metrics(test[target], pred),
                      "mean_baseline": metrics(test[target], np.repeat(fit[target].mean(), len(test)))})
    overall = {name: metrics(holdout[target], values) for name, values in predictions.items()}
    per_study = []
    for study in sorted(holdout[group].unique()):
        mask = (holdout[group] == study).to_numpy()
        per_study.append({"study": float(study), "models": {
            name: metrics(holdout.loc[holdout[group] == study, target], np.asarray(values)[mask])
            for name, values in predictions.items()}})
    ranges = {f: {"min": float(train[f].min()), "max": float(train[f].max())} for f in features}
    outside = np.zeros(len(holdout), dtype=bool)
    for f in features:
        outside |= (holdout[f].to_numpy() < ranges[f]["min"]) | (holdout[f].to_numpy() > ranges[f]["max"])
    records = {name: [{"source_row_index": int(index), "study": float(row[group])} for index, row in data.iterrows()]
               for name, data in (("train", train), ("holdout", holdout))}
    split_hash = hashlib.sha256(json.dumps(records, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"metric_units": "source target units; not independently verified",
            "development_leave_one_study_out": folds, "holdout_metrics": overall,
            "holdout_by_study": per_study, "training_feature_ranges_source_units": ranges,
            "holdout_rows_outside_training_feature_ranges": int(outside.sum()),
            "applicability_note": "Marginal feature ranges are diagnostics, not a validated applicability domain.",
            "split_manifest": records, "split_sha256": split_hash,
            "external_validation": "not performed; holdout is from the same compiled dataset",
            "inference_enabled": False, "release_eligible": False,
            "release_blockers": ["Source units and measurement provenance not independently verified",
                                 "No external compatible dataset validation",
                                 "No predeclared engineering acceptance threshold",
                                 "No calibrated predictive uncertainty or validated applicability domain"]}

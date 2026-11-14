#!/usr/bin/env python3
"""Exploratory Aalto Good-vs-Defects visual classifier; no prebuild failure model.

Uses reviewed source groups and archive hashes, trains a deterministic frozen
32x32 grayscale logistic baseline. The output is a metrics report, not deployed
weights or a qualified part-failure probability.
"""
import argparse
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, confusion_matrix, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def evaluate(source: Path, manifest: Path, output: Path):
    with manifest.open(newline="") as handle:
        records = list(csv.DictReader(handle))
    if len(records) < 60:
        raise ValueError("Require at least 60 audited labeled image records")
    ids, arrays, labels, groups, dims = set(), [], [], [], {0: set(), 1: set()}
    modalities = set()
    with zipfile.ZipFile(source) as z:
        for record in records:
            member = record["archive_member"]
            if member in ids:
                raise ValueError("Repeated archive image")
            ids.add(member)
            label = int(record["image_label"])
            if label not in (0, 1):
                raise ValueError("Invalid visual defect class")
            group = record["source_group_id"].strip()
            modality = record["source_modality"].strip()
            if not group or not modality or group.lower() in ("unknown", "synthetic", "placeholder"):
                raise ValueError("Researcher-reviewed source_group_id and modality required")
            modalities.add(modality)
            raw = z.read(member)
            if hashlib.sha256(raw).hexdigest() != record["sha256"]:
                raise ValueError("Archive bytes differ from reviewed manifest")
            with Image.open(io.BytesIO(raw)) as image:
                image.load()
                dims[label].add(image.size)
                grayscale = ImageOps.grayscale(image)
                arrays.append(np.asarray(grayscale.resize((32, 32)), dtype=np.float32).reshape(-1) / 255.0)
            labels.append(label)
            groups.append(group)
    if len(modalities) != 1:
        raise ValueError("Train PB and optical tomography images independently")
    if len(set(groups)) < 6:
        raise ValueError("At least 6 independently documented source groups required")
    if not dims[0].intersection(dims[1]):
        raise ValueError("Good/Defects image resolutions do not overlap: crop-size shortcut risk")
    x, y = np.stack(arrays), np.array(labels, dtype=int)
    if len(set(y)) != 2:
        raise ValueError("Both visual classes required")
    training, heldout = next(GroupShuffleSplit(n_splits=1, test_size=.3, random_state=42)
                            .split(x, y, groups=groups))
    if len(set(np.array(groups)[training]) & set(np.array(groups)[heldout])):
        raise ValueError("Source group leakage")
    if len(set(y[training])) != 2 or len(set(y[heldout])) != 2:
        raise ValueError("Prespecified group holdout must contain both classes")
    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.1, random_state=42))
    model.fit(x[training], y[training])
    score = model.predict_proba(x[heldout])[:, 1]
    tn, fp, fn, tp = [int(v) for v in confusion_matrix(y[heldout], score >= .5, labels=[0, 1]).ravel()]
    report = {
        "schema": "orientai.aalto.visual-defect-research.v1",
        "status": "IMAGE_RESEARCH_ONLY_NOT_QUALIFIED",
        "inference_enabled": False, "release_eligible": False,
        "dataset": "https://doi.org/10.5281/zenodo.14996806",
        "source_zip_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
        "modality": modalities.pop(), "target": "annotated image Good vs Defects (not inspected part failure)",
        "train_rows": len(training), "holdout_rows": len(heldout),
        "train_groups": sorted(set(np.array(groups)[training])),
        "holdout_groups": sorted(set(np.array(groups)[heldout])),
        "balanced_accuracy": float(balanced_accuracy_score(y[heldout], score >= .5)),
        "roc_auc": float(roc_auc_score(y[heldout], score)),
        "confusion": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "limitations": [
            "Label folder names do not confirm independently inspected part defects.",
            "Physical independence of source groups requires external human audit.",
            "Visual crop/context shortcuts may distort apparent accuracy.",
            "No out-of-dataset machine or part validation.",
            "No model exported or connected to ORIENTAI production predictions.",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--zip", type=Path, required=True)
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(evaluate(a.zip, a.manifest, a.report), indent=2))


if __name__ == "__main__":
    main()

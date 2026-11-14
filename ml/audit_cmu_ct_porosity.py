#!/usr/bin/env python3
"""Audit CMU Ti64 CT pore measurements before constructing any supervised labels.

Source: https://doi.org/10.1184/R1/26304175.v1. No row joins or
part-level targets are inferred. Source files stay outside Git and reports
contain only aggregate field diagnostics.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

IDENTITY_TERMS = ("name", "sample", "specimen", "build", "coupon", "part", "scan", "id")


def audit_csv(path, max_rows=1000000):
    if not path.is_file():
        raise FileNotFoundError(path)
    with path.open("r", newline="", encoding="utf-8-sig", errors="replace") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        if not columns or len(columns) != len(set(columns)):
            raise ValueError(f"Missing or duplicate column names: {path.name}")
        nonempty = Counter()
        identity_values = {col: set() for col in columns
                           if any(term in col.casefold() for term in IDENTITY_TERMS)}
        identity_examples = {col: [] for col in identity_values}
        rows = 0
        for row in reader:
            if None in row:
                raise ValueError(f"Malformed CSV row: {path.name}")
            rows += 1
            for key, value in row.items():
                if value is not None and str(value).strip():
                    nonempty[key] += 1
                    if key in identity_values:
                        normalized = str(value).strip()
                        if len(identity_values[key]) < max_rows:
                            identity_values[key].add(normalized)
                        if len(identity_examples[key]) < 4 and normalized not in identity_examples[key]:
                            identity_examples[key].append(normalized[:80])
            if rows >= max_rows:
                break
        with path.open("rb") as binary:
            content_sha256 = hashlib.file_digest(binary, "sha256").hexdigest()
        return {
            "name": path.name,
            "sha256": content_sha256,
            "rows_sampled": rows,
            "row_limit_reached": rows >= max_rows,
            "columns": columns,
            "nonempty_by_column": dict(nonempty),
            "identity_columns": {
                col: {"distinct_sampled": len(values), "examples": identity_examples[col]}
                for col, values in identity_values.items()
            },
            "_identities": identity_values,
        }


def audit(paths, output, max_rows=1000000):
    if len(paths) < 2:
        raise ValueError("Need parameter and pore measurement files")
    results = [audit_csv(Path(p), max_rows=max_rows) for p in paths]
    overlap = []
    a, b = results[:2]
    for left, leftvals in a["_identities"].items():
        for right, rightvals in b["_identities"].items():
            if left.casefold() == right.casefold():
                common = leftvals & rightvals
                overlap.append({
                    "left": left, "right": right,
                    "left_distinct_sampled": len(leftvals),
                    "right_distinct_sampled": len(rightvals),
                    "common_distinct_sampled": len(common),
                })
    for result in results:
        del result["_identities"]
    summary = {
        "source": "https://doi.org/10.1184/R1/26304175.v1",
        "status": "SCHEMA_AUDITED_NOT_TRAINED",
        "training_ready": False,
        "production_inference_enabled": False,
        "reason": "Must manually confirm specimen/build IDs, join cardinalities, measured target units and independence before training.",
        "files": results, "same_named_identity_overlap_candidates": overlap,
        "prohibitions": [
            "Pore-level CT rows are not independent specimens.",
            "Do not infer build identifiers from filenames or process parameter values.",
            "Do not train on post-build EVS parameters or CT-derived quantities as prebuild predictors.",
            "Do not label porosity as binary lack-of-fusion without an inspected defect-mechanism definition.",
            "No STL-to-failure probability has been validated.",
        ],
    }
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--parameters", type=Path, required=True)
    parser.add_argument("--pores", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--max-rows", type=int, default=1000000)
    args = parser.parse_args()
    if args.max_rows <= 0:
        parser.error("--max-rows must be positive")
    result = audit([args.parameters, args.pores], args.report, args.max_rows)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

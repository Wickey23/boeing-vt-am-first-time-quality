#!/usr/bin/env python3
"""Aggregate observed CT pores by reviewed specimen Name, never by individual pore.

This descriptive output is NOT a porosity percentage or validated defect target.
No build identities, failures, or failure probabilities are fabricated.
"""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

PREBUILD_COLS = ("Power (W)", "Velocity (mm/s)", "Spot Size (um)",
                 "Hatch Spacing (um)", "Layer Height (um)")
PARAM_ID = "Name"
PORE_ID = "Name"
PORE_DIAMETER = "Equivalent Spherical Diameter (um)"


def finite_positive(value, field):
    try:
        number = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"Invalid {field}") from None
    if not math.isfinite(number) or number <= 0:
        raise ValueError(f"Nonpositive or nonfinite {field}")
    return number


def summarize(parameters: Path, pores: Path, output: Path, report_path: Path):
    specs = {}
    with parameters.open(newline="", encoding="utf-8-sig") as file:
        rdr = csv.DictReader(file)
        required = (PARAM_ID, *PREBUILD_COLS)
        if any(col not in (rdr.fieldnames or []) for col in required):
            raise ValueError("Missing necessary parameter fields")
        for row in rdr:
            name = (row.get(PARAM_ID) or "").strip()
            if not name or name in specs:
                raise ValueError("Missing or duplicate specimen Name")
            factors = {k: finite_positive(row[k], k) for k in PREBUILD_COLS}
            specs[name] = factors
    if not specs:
        raise ValueError("No inspected specimens")
    counts = Counter()
    diameters = Counter()
    with pores.open(newline="", encoding="utf-8-sig") as file:
        rdr = csv.DictReader(file)
        if any(col not in (rdr.fieldnames or []) for col in (PORE_ID, PORE_DIAMETER)):
            raise ValueError("Missing pore Name or measured diameter")
        for row in rdr:
            name = (row.get(PORE_ID) or "").strip()
            if name not in specs:
                raise ValueError("Pore measurements refer to unknown specimen Name")
            diameter = finite_positive(row[PORE_DIAMETER], PORE_DIAMETER)
            counts[name] += 1
            diameters[name] += diameter
    if not counts:
        raise ValueError("No measured pores")
    output.parent.mkdir(parents=True, exist_ok=True)
    columns = ("specimen_name", *PREBUILD_COLS,
               "ct_detected_pore_count", "mean_detected_pore_diameter_um")
    with output.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        for name in sorted(specs):
            writer.writerow({
                "specimen_name": name, **specs[name],
                "ct_detected_pore_count": counts[name],
                "mean_detected_pore_diameter_um": diameters[name] / counts[name]
                if counts[name] else "",
            })
    with parameters.open("rb") as file:
        psha = hashlib.file_digest(file, "sha256").hexdigest()
    with pores.open("rb") as file:
        osha = hashlib.file_digest(file, "sha256").hexdigest()
    report = {
        "dataset": "https://doi.org/10.1184/R1/26304175.v1",
        "parameter_sha256": psha, "pore_sha256": osha,
        "status": "DESCRIPTIVE_SPECIMEN_AGGREGATION_UNVALIDATED",
        "specimens": len(specs),
        "specimens_with_detected_pores": len(counts),
        "pore_rows": sum(counts.values()),
        "training_ready": False,
        "build_independent_validation": False,
        "production_inference_enabled": False,
        "limitations": [
            "Specimen Name requires independent provenance confirmation.",
            "No build identity or source grouping was verified.",
            "Observed pore counts are sensitive to CT threshold, scanned volume and resolution.",
            "Pore count is not volumetric porosity, lack-of-fusion mechanism, or binary part failure.",
            "Only nominated pre-print machine settings retained as candidate features.",
            "No model trained, exported, validated or enabled.",
        ],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--parameters", required=True, type=Path)
    p.add_argument("--pores", required=True, type=Path)
    p.add_argument("--specimens", required=True, type=Path)
    p.add_argument("--report", required=True, type=Path)
    a = p.parse_args()
    print(json.dumps(summarize(a.parameters, a.pores, a.specimens, a.report), indent=2))


if __name__ == "__main__":
    main()

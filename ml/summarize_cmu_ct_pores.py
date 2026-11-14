#!/usr/bin/env python3
"""Descriptive CMU CT pore detections by source Name; NOT training or porosity prediction.

Source: https://doi.org/10.1184/R1/26304175.v1
The observation unit is a recorded pore detection, not a specimen or independent build.
No physical build IDs, absolute pore fraction, defect type, or binary failure labels inferred.
"""
import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

PARAM_COLUMNS = {"Name", "Power (W)", "Velocity (mm/s)", "Spot Size (um)",
                 "Hatch Spacing (um)", "Layer Height (um)", "Geometry"}
PORE_COLUMNS = {"Name", "Equivalent Spherical Diameter (um)", "Aspect Ratio", "Sphericity"}


def summarize(parameters, pores, output):
    parameters, pores, output = map(Path, (parameters, pores, output))
    with parameters.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not PARAM_COLUMNS.issubset(reader.fieldnames or []):
            raise ValueError("Missing expected CMU manufacturing-parameter columns")
        params = {}
        for row in reader:
            name = (row["Name"] or "").strip()
            if not name or name in params:
                raise ValueError("Missing or duplicated parameter Name")
            params[name] = row
    stats = defaultdict(lambda: {"count": 0, "diameter_sum_um": 0.0,
                                  "diameter_min_um": math.inf, "diameter_max_um": -math.inf,
                                  "diameter_at_least_100um": 0})
    with pores.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not PORE_COLUMNS.issubset(reader.fieldnames or []):
            raise ValueError("Missing expected CT pore measurement columns")
        for row in reader:
            name = (row["Name"] or "").strip()
            if not name:
                raise ValueError("Pore row missing Name")
            try:
                d = float(row["Equivalent Spherical Diameter (um)"])
            except (ValueError, TypeError) as exc:
                raise ValueError("Invalid equivalent spherical diameter") from exc
            if not math.isfinite(d) or d <= 0:
                raise ValueError("Non-positive or non-finite equivalent spherical diameter")
            s = stats[name]
            s["count"] += 1
            s["diameter_sum_um"] += d
            s["diameter_min_um"] = min(s["diameter_min_um"], d)
            s["diameter_max_um"] = max(s["diameter_max_um"], d)
            s["diameter_at_least_100um"] += d >= 100
    missing = sorted(set(params) - set(stats))
    matched = sorted(set(params) & set(stats))
    unmatched = sorted(set(stats) - set(params))
    if missing:
        raise ValueError(f"Parameter Names lack pore records: {missing}")
    def entry(name):
        s = stats[name]
        return {"name": name, "detected_pore_count": s["count"],
                "mean_equivalent_spherical_diameter_um": round(s["diameter_sum_um"] / s["count"], 6),
                "min_equivalent_spherical_diameter_um": s["diameter_min_um"],
                "max_equivalent_spherical_diameter_um": s["diameter_max_um"],
                "detections_at_least_100um": s["diameter_at_least_100um"]}
    report = {
        "source": "https://doi.org/10.1184/R1/26304175.v1",
        "status": "DESCRIPTIVE_ONLY_NOT_VALIDATED",
        "training_ready": False,
        "production_inference_enabled": False,
        "join_attempted": False,
        "build_independent_validation": False,
        "number_of_parameter_names": len(params),
        "number_of_matched_names": len(matched),
        "number_of_unmatched_pore_only_names": len(unmatched),
        "total_pore_detections": sum(v["count"] for v in stats.values()),
        "matched": [entry(name) for name in matched],
        "pore_only_quarantined": [entry(name) for name in unmatched],
        "cautions": [
            "Counts and size summaries depend on CT scanning, volume, thresholds and segmentation.",
            "These are detected-pore summaries; not void volume fraction, defect mechanism or pass/fail.",
            "Identical names across files are candidate links only, not provenance-verified joins.",
            "No specimen-to-physical-build mapping; no statistically independent build split.",
            "No post-build target or CT measurement may be a prebuild predictor.",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--parameters", type=Path, required=True)
    p.add_argument("--pores", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    r = summarize(args.parameters, args.pores, args.report)
    print(json.dumps({k: v for k, v in r.items() if k not in ("matched", "pore_only_quarantined")}, indent=2))
    print("Quarantined:", [(x["name"], x["detected_pore_count"]) for x in r["pore_only_quarantined"]])

#!/usr/bin/env python3
"""Reconcile the previously audited AMB2022-03 source version before research.
This is a provenance gate, not a training or independent-validation gate.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import pathlib

WORKBOOK = "AMB2022-718-SH1-MeltPool_Cross-Section_Measurement_Results.xlsx"
PINNED_SHA256 = "2cfaac96aaca3dabb77b7029f842cdcc7e75c5a2cf3577d0734823246364a931"
EXPECTED_COUNTS = {"BP1": 42, "BP2": 94, "BP3": 92}
TARGETS = ("measured_depth_mm", "measured_width_mm", "overlap_depth_mm", "overlap_width_mm")
DOI = "10.18434/mds2-2718"

def check_readme(raw):
    text = raw.decode("utf-8-sig", errors="strict")
    for marker in (DOI, "AMB2022-718-SH1-MeltPool_Cross-Section_Measurement_Results.xlsx",
                   "BP1", "BP2", "BP3"):
        if marker not in text:
            raise ValueError("Measurement README identity missing: " + marker)
    return hashlib.sha256(raw).hexdigest()

def reconcile(audit, readme_sha256):
    if audit.get("source_sha256") != PINNED_SHA256:
        raise ValueError("Workbook differs from previously audited SHA-256; source review required")
    rows = audit["measurements"]
    counts = dict(collections.Counter(row["sample_id"] for row in rows))
    if counts != EXPECTED_COUNTS or audit.get("measurement_count") != len(rows):
        # Emit aggregate counts for investigation, not rows or specimen IDs.
        # Keep the pinned expectation until the original workbook is reviewed.
        details = {
            "expected_plate_counts": EXPECTED_COUNTS,
            "observed_plate_counts": counts,
            "expected_total": sum(EXPECTED_COUNTS.values()),
            "observed_total": len(rows),
            "parser_reported_total": audit.get("measurement_count"),
        }
        raise ValueError("Measurement counts differ from source audit: " +
                         json.dumps(details, sort_keys=True, ensure_ascii=True))
    if len({row["source_row"] for row in rows}) != len(rows):
        raise ValueError("Repeated source row identity")
    if any(row.get("source_sha256") != PINNED_SHA256 or row.get("source_doi") != DOI
           or row.get("build_id") is not None or row.get("defect_label") is not None
           or row.get("powder_present") is not False
           for row in rows):
        raise ValueError("Inconsistent source provenance, protocol or inferred label")
    per_plate = {}
    for plate in EXPECTED_COUNTS:
        subset = [row for row in rows if row["sample_id"] == plate]
        per_plate[plate] = {
            "rows": len(subset),
            "section_ids": sorted({row["part_id"] for row in subset}),
            "distinct_process_parameter_tuples": len({
                (r["power_w"], r["speed_mm_s"], r["beam_diameter_mm"]) for r in subset
            }),
            "missing_targets": {target: sum(r[target] is None for r in subset) for target in TARGETS},
        }
    return {
        "schema": "orientai.nist-source-reconciliation.v1",
        "workbook_sha256": PINNED_SHA256,
        "readme_sha256": readme_sha256,
        "readme_identity_checked": True,
        "measurement_count": len(rows),
        "plate_summary": per_plate,
        "training_ready": False,
        "independent_build_validation": False,
        "defect_labels_available": False,
        "limitations": [
            "Workbook hash is the previously recorded local audit hash, not a newly verified NIST checksum.",
            "Plate section IDs are not independent builds.",
            "Missing targets are counted, never imputed.",
            "No pooling of single-track full width and pad partial width.",
        ],
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-dir", type=pathlib.Path, default=pathlib.Path("data/nist-lpbf"))
    p.add_argument("--output", type=pathlib.Path, required=True)
    args = p.parse_args()
    workbook = args.source_dir / WORKBOOK
    if hashlib.sha256(workbook.read_bytes()).hexdigest() != PINNED_SHA256:
        raise ValueError("Workbook differs from previously audited SHA-256; source review required")
    digest = check_readme((args.source_dir / "2718_README.txt").read_bytes())
    spec = importlib.util.spec_from_file_location("nist_audit", pathlib.Path(__file__).with_name("audit-nist-workbook.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    report = reconcile(module.audit(workbook), digest)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, allow_nan=False))

if __name__ == "__main__":
    main()

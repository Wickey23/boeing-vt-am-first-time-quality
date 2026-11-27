#!/usr/bin/env python3
"""Acquire AM Bench 2025 pad tables and verify publisher SHA-256 sidecars.
Inventory only; no assumed joins, units, or training.
"""
import argparse
import collections
import csv
import hashlib
import importlib.util
import io
import json
import pathlib
import re

BASE="https://data.nist.gov/od/ds/ark:/88434/mds2-4103/"
FILES=("4103_ReadMe.txt","SampleIParameters.csv",
       "Cross_Sections/Tracks_Results/depths.csv",
       "Cross_Sections/Tracks_Results/widths.csv",
       "Cross_Sections/Tracks_Results/overlap_depths.csv",
       "Cross_Sections/Tracks_Results/overlap_widths.csv")
CHECKSUM=re.compile(r"^([0-9a-fA-F]{64})(?:[ \t]+\*?[^\r\n]+)?$")

def check_bytes(raw, sidecar):
    match=CHECKSUM.fullmatch(sidecar.decode("ascii").strip())
    if not match:
        raise ValueError("Invalid publisher SHA-256 sidecar")
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=match.group(1).lower():
        raise ValueError("Source does not match publisher SHA-256")
    return digest

def inspect_csv(raw):
    data=raw.decode("utf-8-sig")
    if data.lstrip().startswith("<"):
        raise ValueError("Markup instead of measurement CSV")
    rows=[r for r in csv.reader(io.StringIO(data),strict=True)
          if any(v.strip() for v in r)]
    if len(rows)<2 or len(rows[0])<2:
        raise ValueError("CSV lacks expected tabular structure")
    headers=rows[0]
    # No column mapping or automatic numeric conversion in this inventory.
    return {"first_row_header_candidates":headers,
            "nonempty_rows_after_first":len(rows)-1,
            "row_width_counts":dict(collections.Counter(str(len(r)) for r in rows[1:])),
            "blank_first_row_cells":sum(not h.strip() for h in headers),
            "duplicate_nonblank_first_row_cells":len([h for h in headers if h.strip()])-len({h for h in headers if h.strip()})}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source-dir",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    a=p.parse_args()
    spec=importlib.util.spec_from_file_location("fetch",pathlib.Path(__file__).with_name("fetch-nist-lpbf-measurements.py"))
    fetch=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fetch)
    result={"schema":"orientai.nist-2025-pad-inventory.v1","source_doi":"10.18434/mds2-4103",
            "files":{},"training_ready":False,"independent_build_validation":False,
            "limitations":["Measurement units and parameter/measurement joins require source review.",
                           "Fixed primary laser settings; do not use for power/speed generalization.",
                           "Separate bare plate and single powder layer protocols.",
                           "No raw measurement rows are published."]}
    for name in FILES:
        dest=a.source_dir/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        side=dest.with_name(dest.name+".sha256")
        fetch.download(BASE+name+".sha256",side)
        # Download to a staging file; never replace the retained original until
        # the publisher checksum AND basic structure have been validated.
        staging=dest.with_name(dest.name+".staging")
        try:
            fetch.download(BASE+name,staging)
            raw=staging.read_bytes()
            digest=check_bytes(raw,side.read_bytes())
            entry={"url":BASE+name,"sha256":digest,"bytes":len(raw),
                   "publisher_checksum_matched":True}
            if name.endswith(".csv"):
                entry["inventory"]=inspect_csv(raw)
            else:
                readme=raw.decode("utf-8-sig")
                if readme.lstrip().startswith("<") or not readme.strip():
                    raise ValueError("Invalid README")
            staging.replace(dest)
            result["files"][name]=entry
        finally:
            staging.unlink(missing_ok=True)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__=="__main__":
    main()

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
BASES=(BASE,"https://data.nist.gov/od/ds/mds2-4103/")
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

def inspect_csv(raw, encoding="utf-8-sig"):
    # Cross-section exports contain a single-byte micro sign (0xb5).
    # Decode only after verifying untouched original bytes; no lossy replacement.
    data=raw.decode(encoding, errors="strict")
    if "\x00" in data or any(ord(c)<32 and c not in "\t\r\n" for c in data):
        raise ValueError("Unexpected control characters in measurement CSV")
    if data.lstrip().startswith("<"):
        raise ValueError("Markup instead of measurement CSV")
    rows=[r for r in csv.reader(io.StringIO(data),strict=True)
          if any(v.strip() for v in r)]
    if len(rows)<2 or len(rows[0])<2:
        raise ValueError("CSV lacks expected tabular structure")
    headers=rows[0]
    # No column mapping or automatic numeric conversion in this inventory.
    return {"decoded_encoding":encoding,"first_row_header_candidates":headers,
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
        result["files"][name]=acquire(name,a.source_dir,fetch.download)
    result["measurement_inventory_complete"]=all(e.get("accepted",False) for n,e in result["files"].items() if n.endswith(".csv"))
    result["readme_verified"]=result["files"]["4103_ReadMe.txt"].get("accepted",False)
    result["complete"]=result["measurement_inventory_complete"] and result["readme_verified"]
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))
    if not result["complete"]:
        raise SystemExit("One or more original sources could not be accepted; see inventory for checksum and schema outcomes")

def acquire(name,root,download,bases=BASES):
    dest=root/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    side=dest.with_name(dest.name+".sha256.staging")
    staging=dest.with_name(dest.name+".staging")
    attempts=[]
    for base in bases:
        attempt={"url":base+name,"checksum_url":base+name+".sha256"}
        attempts.append(attempt)
        try:
            download(attempt["checksum_url"],side)
            sidecar=side.read_bytes()
            match=CHECKSUM.fullmatch(sidecar.decode("ascii").strip())
            if not match:
                raise ValueError("Invalid publisher SHA-256 sidecar")
            attempt["expected_sha256"]=match.group(1).lower()
            download(attempt["url"],staging)
            raw=staging.read_bytes()
            attempt.update(bytes=len(raw),observed_sha256=hashlib.sha256(raw).hexdigest())
            digest=check_bytes(raw,sidecar)
            attempt["publisher_checksum_matched"]=True
            entry={"url":attempt["url"],"sha256":digest,"bytes":len(raw),
                   "publisher_checksum_matched":True,"accepted":True,"attempts":attempts}
            if name.endswith(".csv"):
                entry["inventory"]=inspect_csv(raw, encoding="cp1252" if name.startswith("Cross_Sections/Tracks_Results/") else "utf-8-sig")
            else:
                readme=raw.decode("utf-8-sig")
                if readme.lstrip().startswith("<") or not readme.strip():
                    raise ValueError("Invalid README")
            staging.replace(dest)
            side.replace(dest.with_name(dest.name+".sha256"))
            attempt["status"]="verified"
            return entry
        except (OSError,ValueError,csv.Error) as error:
            attempt.update(status="rejected",error=str(error))
        finally:
            staging.unlink(missing_ok=True)
            side.unlink(missing_ok=True)
    return {"publisher_checksum_matched":any(x.get("publisher_checksum_matched",False) for x in attempts),
            "accepted":False,"attempts":attempts}

if __name__=="__main__":
    main()

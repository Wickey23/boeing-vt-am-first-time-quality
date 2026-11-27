#!/usr/bin/env python3
"""Audit candidate parameter/measurement joins on pinned, verified CSV bytes.
No physical interpretation, solver comparison or training while README unresolved.
"""
import argparse
import collections
import csv
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
import pathlib
import re
import statistics

PARAM="SampleIParameters.csv"
TARGETS={"depth":"depths.csv","width":"widths.csv",
         "overlap_depth":"overlap_depths.csv","overlap_width":"overlap_widths.csv"}
PREFIX="Cross_Sections/Tracks_Results/"
HASHES={PARAM:"ad3efdd8757d19f435bb234483ed6ebdaea3e3ee5149aee77113d0d7bdff9e8c",
        PREFIX+"depths.csv":"b8dac45c0b8d6e32bc44b642b1357e88080929a4b7fb56835e8cd959189d14ce",
        PREFIX+"widths.csv":"004b35eff80d4300b508b58d7ecc98ce94a1c9108b41c0af4aceaef7cecadfbf",
        PREFIX+"overlap_depths.csv":"f655b5813633e25c850098e1321bb0bd6a6aeb8cdfef2bc2c9b69e630a7f7fc5",
        PREFIX+"overlap_widths.csv":"40bfa477424ce48049625677e4cf708006b43c8bba27025840e97074cd0606c2"}
KEYS=("Powder_Layer_Thickness (µm)","Turnaround_Time (ms)","Pad_Width (mm)","Location (mm)")
PARAM_HEADER=("Sample ID","Laser Power (W)","Laser Spot Diameter (µm)","Laser Scan Speed (mm/s)","Hatch Spacing (mm)",*KEYS)
MEAS_HEADER=("Row",*KEYS,*(f"{i} (µm)" for i in range(1,46)))

def read_table(raw,encoding,header):
    rows=[r for r in csv.reader(io.StringIO(raw.decode(encoding)),strict=True) if any(x.strip() for x in r)]
    if not rows or tuple(rows[0])!=header:
        raise ValueError("Unexpected table header")
    if any(len(r)!=len(header) for r in rows[1:]):
        raise ValueError("Unexpected row width")
    return [dict(zip(header,r)) for r in rows[1:]]

def decimal(value):
    try:
        n=Decimal(value.strip())
        return n if n.is_finite() else None
    except (InvalidOperation,AttributeError):
        return None

def key(row):
    k=tuple(decimal(row[x]) for x in KEYS)
    if any(v is None for v in k):
        return None
    return k

def index(rows):
    result=collections.defaultdict(list)
    invalid=0
    for r in rows:
        k=key(r)
        if k is None:
            invalid+=1
        else:
            result[k].append(r)
    return result,invalid

def audit(params,tables):
    p,invalid=index(params)
    report={"parameter_rows":len(params),"invalid_parameter_keys":invalid,
            "distinct_parameter_keys":len(p),"duplicate_parameter_keys":sum(len(v)>1 for v in p.values()),
            "duplicate_sample_id_excess":len(params)-len({r["Sample ID"] for r in params}),
            "distinct_parameter_values":{k:len({r[k] for r in params}) for k in PARAM_HEADER[1:]},
            "targets":{}}
    keysets=[]
    for name,rows in tables.items():
        m,invalid_m=index(rows)
        keysets.append(set(m))
        counts=collections.Counter()
        for r in rows:
            for col in MEAS_HEADER[5:]:
                v=r[col].strip()
                n=decimal(v)
                if not v: counts["blank"]+=1
                elif n is None: counts["nonnumeric"]+=1
                elif n<0: counts["negative"]+=1
                elif n==0: counts["zero"]+=1
                else: counts["positive"]+=1
        unique=sum(len(v)==1 and len(p.get(k,[]))==1 for k,v in m.items())
        report["targets"][name]={"rows":len(rows),"invalid_keys":invalid_m,
             "distinct_keys":len(m),"duplicate_keys":sum(len(v)>1 for v in m.values()),
             "keys_absent_from_parameters":len(set(m)-set(p)),
             "parameter_keys_absent_from_target":len(set(p)-set(m)),
             "one_to_one_candidate_keys":unique,"measurement_cells":len(rows)*45,
             "cell_classifications":dict(counts)}
    report["all_target_keysets_match"]=bool(keysets) and all(s==keysets[0] for s in keysets)
    report["candidate_join_complete"]=bool(tables) and not invalid and len(p)==len(params) and all(
        t["one_to_one_candidate_keys"]==len(params)==t["rows"] and not t["invalid_keys"]
        for t in report["targets"].values())
    return report

# NIST AMB2025-06/07 challenge descriptions v3, section 2.6, table 8.
# This is an independent protocol reference, not a substitute for the
# checksum-rejected dataset README.
PROTOCOL_URL="https://www.nist.gov/system/files/documents/2025/12/18/AMB2024-06%20and%2007%20challenge%20descriptions_v3.pdf"
D=Decimal
CONDITIONS=((D("80"),D("0.75")),(D("160"),D("0.75")),
            (D("0"),D("0.75")),(D("0"),D("5")))
SECTIONS={1:(D("5"),D("0.460")),2:(D("5"),D("2.545")),3:(D("1"),D("0.556"))}
EXPECTED_KEYS={(*condition,*section) for condition in CONDITIONS for section in SECTIONS.values()}

def protocol_audit(params,tables):
    p,invalid=index(params)
    sample_ids={r["Sample ID"].strip() for r in params}
    plate_sections=collections.defaultdict(set)
    matched=0
    mismatches=collections.Counter()
    for r in params:
        m=re.fullmatch(r"(20241010|20241015)_AMB_T([1-9]|1[0-2])2_P([123])",r["Sample ID"].strip())
        if not m:
            mismatches["sample_name_pattern"]+=1
            continue
        day,plate,section=m.group(1),int(m.group(2)),int(m.group(3))
        # Date and plate identity checked against published Table 8.
        expected_day="20241010" if plate in (1,4,7,10,11,12) else "20241015"
        expected_key=(*CONDITIONS[(plate-1)//3],*SECTIONS[section])
        observed_key=key(r)
        if day!=expected_day:
            mismatches["sample_date"]+=1
        if observed_key!=expected_key:
            mismatches["condition_or_location"]+=1
            for field,actual,expected in zip(KEYS,observed_key or (None,)*4,expected_key):
                if actual!=expected:
                    mismatches[field]+=1
        if day!=expected_day or observed_key!=expected_key:
            continue
        matched+=1
        plate_sections[plate].add(section)
    protocol_complete=(matched==len(params)==36 and len(sample_ids)==36 and
                       len(plate_sections)==12 and all(v=={1,2,3} for v in plate_sections.values()))
    condition_layout=(not invalid and set(p)==EXPECTED_KEYS and all(len(v)==3 for v in p.values()))
    outputs={}
    for name,rows in tables.items():
        m,bad=index(rows)
        layout=condition_layout and not bad and set(m)==EXPECTED_KEYS and all(len(v)==3 for v in m.values())
        ids=collections.Counter(r["Row"].strip() for r in rows)
        literal_matches=sum(r["Row"].strip() in sample_ids for r in rows)
        exact_identity=(protocol_complete and layout and literal_matches==len(rows) and
                        len(ids)==len(rows) and all(
                            r["Row"].strip() in {v["Sample ID"].strip() for v in p[k]}
                            for k,rs in m.items() for r in rs))
        summary=[]
        if layout:
            for k,rs in sorted(m.items()):
                means=[]
                valid_counts=[]
                for r in rs:
                    vals=[decimal(r[col]) for col in MEAS_HEADER[5:]]
                    valid=[float(v) for v in vals if v is not None and v>0]
                    valid_counts.append(len(valid))
                    if valid:
                        means.append(statistics.mean(valid))
                # Equal row weight. No claim that Row is a physical plate identifier;
                # no confidence intervals or cross-target pairing.
                summary.append({"powder_um":str(k[0]),"turnaround_ms":str(k[1]),
                                "pad_width_mm":str(k[2]),"location_mm":str(k[3]),
                                "rows":len(rs),"rows_with_positive_values":len(means),
                                "positive_cells":sum(valid_counts),"potential_cells":45*len(rs),
                                "row_balanced_positive_mean_um":statistics.mean(means) if means else None,
                                "row_mean_range_um":[min(means),max(means)] if means else None})
        outputs[name]={"condition_layout_matches":layout,"distinct_row_labels":len(ids),
                       "literal_sample_id_matches":literal_matches,
                       "literal_sample_identity_complete":exact_identity,
                       "condition_summaries":summary}
    return {"protocol_reference":PROTOCOL_URL,"parameter_sample_ids_match_published_table":matched,
            "parameter_plate_section_design_verified":protocol_complete,
            "matched_parameter_plate_groups":len(plate_sections),
            "parameter_protocol_mismatches":dict(mismatches),
            "observed_condition_keys":[{"fields":[str(x) for x in k],"rows":len(p[k])} for k in sorted(p)],
            "keys_not_in_published_table":[[str(x) for x in k] for k in sorted(set(p)-EXPECTED_KEYS)],
            "published_keys_not_in_csv":[[str(x) for x in k] for k in sorted(EXPECTED_KEYS-set(p))],
            "parameter_condition_layout_matches":condition_layout,
            "target_protocol_audit":outputs,
            "specimen_join_authorized":False,"physical_validation":False,
            "notes":["Condition summaries are descriptive only and use positive numeric cells.",
                     "Row means are weighted equally, without assuming track or plate identities.",
                     "No uncertainty interval, paired target join or validation claim.",
                     "README discrepancy remains an independent blocker."]}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source-dir",type=pathlib.Path,required=True)
    ap.add_argument("--inventory",type=pathlib.Path,required=True)
    ap.add_argument("--output",type=pathlib.Path,required=True)
    a=ap.parse_args()
    inv=json.loads(a.inventory.read_text(encoding="utf-8"))
    if not inv.get("measurement_inventory_complete"):
        raise ValueError("Measurement inventory is incomplete")
    raw={}
    for name,digest in HASHES.items():
        entry=inv["files"][name]
        if not entry.get("accepted") or not entry.get("publisher_checksum_matched") or entry.get("sha256")!=digest:
            raise ValueError("Unaccepted or changed source: "+name)
        raw[name]=(a.source_dir/name).read_bytes()
        if hashlib.sha256(raw[name]).hexdigest()!=digest:
            raise ValueError("Pinned source hash mismatch: "+name)
    params=read_table(raw[PARAM],"utf-8-sig",PARAM_HEADER)
    tables={k:read_table(raw[PREFIX+v],"cp1252",MEAS_HEADER) for k,v in TARGETS.items()}
    if len(params)!=36 or any(len(t)!=36 for t in tables.values()):
        raise ValueError("Unexpected pinned row count")
    result={"schema":"orientai.nist-2025-pad-join-audit.v1","source_hashes":HASHES,
            "readme_verified":inv.get("readme_verified",False),
            "training_ready":False,"physical_validation":False,
            "notes":["Exact Decimal key comparisons only; no row-position join.",
                     "Candidate match is not a reviewed physical specimen relationship.",
                     "Blank, zero, negative and nonnumeric cells remain distinct; no imputation.",
                     "Numbered columns not yet established as physical track identities."],
            **audit(params,tables),"published_protocol_audit":protocol_audit(params,tables)}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__=="__main__":
    main()

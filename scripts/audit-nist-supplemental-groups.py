#!/usr/bin/env python3
"""Pinned supplemental NIST data audit. No model training or physical validation."""
import argparse
import collections
import hashlib
import json
import math
import pathlib
import posixpath
import xml.etree.ElementTree as ET
import zipfile

WORKBOOK_SHA = "6cd32669f5c84cdb9e90890ba40ddc5548c85b0dbb95cf038f2f6fc69da67a52"
README_SHA = "8b8fc00ce62915af3e0c91c138dc4d033c031d7758161fb9da0e8702fa621c39"
WORKBOOK = "Master_TrackList_Measurements.xlsx"
README = "2923_README.txt"
NS = {"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
HEADERS = ("Folder Name","Image Name","Image file format","Pixel Size (µm)",
           "Sample Name","Material","Surface Condition","Machine","Track No.",
           "Scan Direction","Est. Spot Diameter (D4σ = Dg)","Laser Power (W)",
           "Laser Scan Speed (mm/s)","Width (µm)","Depth (µm)")
COLS = "ABCDEFGHIJKLMNO"

def read_data(path):
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist()) > 80*1024*1024:
            raise ValueError("Workbook decompression limit exceeded")
        book = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]:r.attrib["Target"] for r in rels
                   if r.attrib.get("TargetMode") != "External"}
        sheets = [s for s in book.findall("s:sheets/s:sheet",NS) if s.attrib["name"]=="Data"]
        if len(sheets)!=1:
            raise ValueError("Expected one Data sheet")
        target = targets[sheets[0].attrib[RID]]
        target = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl",target))
        if not target.startswith("xl/worksheets/"):
            raise ValueError("Unexpected worksheet path")
        strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            strings = ["".join(t.text or "" for t in e.findall(".//s:t",NS))
                       for e in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rows=[]
        for row in ET.fromstring(z.read(target)).findall("s:sheetData/s:row",NS):
            cells={}
            for c in row.findall("s:c",NS):
                if c.find("s:f",NS) is not None:
                    raise ValueError("Unexpected formula in measurement sheet")
                v=c.find("s:v",NS)
                kind=c.attrib.get("t")
                if kind=="inlineStr":
                    val="".join(t.text or "" for t in c.findall(".//s:t",NS))
                elif v is not None and v.text is not None:
                    val=strings[int(v.text)] if kind=="s" else v.text
                else:
                    continue
                cells["".join(filter(str.isalpha,c.attrib["r"]))]=val
            if cells:
                rows.append((int(row.attrib["r"]),cells))
    if not rows or tuple(rows[0][1].get(c) for c in COLS)!=HEADERS:
        raise ValueError("Supplemental header schema mismatch")
    return rows[1:]

def numeric(value, positive=False):
    if value is None or str(value).strip().upper() in ("","N/A","NA","-"):
        return None
    try:
        n=float(value)
    except (ValueError,TypeError):
        return None
    if not math.isfinite(n) or n<0 or (positive and n==0):
        return None
    return n

def summarize(rows):
    if len({idx for idx,_ in rows})!=len(rows):
        raise ValueError("Duplicate source row")
    strata=collections.defaultdict(list)
    images=collections.Counter()
    incomplete=0
    for idx,c in rows:
        identity=tuple((c.get(k) or "").strip() for k in "ABEFHI")
        if not all(identity):
            incomplete+=1
            continue
        folder,image,sample,material,machine,track=identity
        images[(folder,image)]+=1
        strata[(material,machine)].append({
            "sample":sample,"track":track,"surface":(c.get("G") or "").strip(),
            "direction":(c.get("J") or "").strip(),
            "spot_raw":numeric(c.get("K"),True),"power_w":numeric(c.get("L"),True),
            "speed_mm_s":numeric(c.get("M"),True),"width_um":numeric(c.get("N")),
            "depth_um":numeric(c.get("O")),
        })
    output=[]
    for (material,machine), records in sorted(strata.items()):
        fields=("spot_raw","power_w","speed_mm_s","width_um","depth_um")
        samples={r["sample"] for r in records}
        tracks={(r["sample"],r["track"]) for r in records}
        settings={(r["spot_raw"],r["power_w"],r["speed_mm_s"])
                  for r in records if all(r[f] is not None for f in fields[:3])}
        eligible={}
        for target in fields[3:]:
            valid=[r for r in records if all(r[f] is not None for f in (*fields[:3],target))]
            by_sample=collections.Counter(r["sample"] for r in valid)
            eligible[target]={"rows":len(valid),"sample_groups":len(by_sample),
                "largest_sample_group_rows":max(by_sample.values(),default=0),
                "distinct_settings":len({tuple(r[f] for f in fields[:3]) for r in valid}),
                "minimum_two_sample_groups_present":len(by_sample)>=2}
        output.append({"material":material,"machine":machine,"rows":len(records),
            "distinct_sample_names":len(samples),"distinct_sample_track_keys":len(tracks),
            "distinct_complete_process_settings":len(settings),
            "surface_categories":dict(collections.Counter(r["surface"] or "(missing)" for r in records)),
            "scan_direction_categories":dict(collections.Counter(r["direction"] or "(missing)" for r in records)),
            "missing_or_invalid":{f:sum(r[f] is None for r in records) for f in fields},
            "target_eligibility":eligible})
    return {"data_rows":len(rows),"rows_with_incomplete_identity":incomplete,
            "duplicate_image_key_excess_rows":sum(n-1 for n in images.values() if n>1),
            "material_machine_strata":output,"training_ready":False,
            "independent_build_validation":False,"cross_source_overlap_verified":False,
            "notes":["Sample names and track keys are grouping candidates, not verified independent builds.",
                     "Spot diameter is kept as a raw numeric value; confirm units and measured/estimated definitions before fitting.",
                     "Summary sheet is not treated as independent observations.",
                     "No sample names, image names or row-level measurements are published in this report."]}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source-dir",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    a=p.parse_args()
    for name,digest in ((WORKBOOK,WORKBOOK_SHA),(README,README_SHA)):
        if hashlib.sha256((a.source_dir/name).read_bytes()).hexdigest()!=digest:
            raise ValueError("Supplemental source differs from inventoried version: "+name)
    rows=read_data(a.source_dir/WORKBOOK)
    if len(rows)!=250:
        raise ValueError("Expected 250 data rows from pinned workbook")
    result={"schema":"orientai.nist-supplemental-group-audit.v1",
            "doi":"10.18434/mds2-2923","workbook_sha256":WORKBOOK_SHA,
            "readme_sha256":README_SHA,**summarize(rows)}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__=="__main__":
    main()

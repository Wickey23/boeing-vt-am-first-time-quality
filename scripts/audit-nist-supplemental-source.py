#!/usr/bin/env python3
"""Acquire and inventory the supplemental NIST workbook; no training or labels."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import posixpath
import xml.etree.ElementTree as ET
import zipfile

DOI = "10.18434/mds2-2923"
BASE = "https://data.nist.gov/od/ds/mds2-2923/"
WORKBOOK = "Master_TrackList_Measurements.xlsx"
README = "2923_README.txt"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

def inspect_workbook(path):
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist()) > 80*1024*1024:
            raise ValueError("Workbook decompression limit exceeded")
        book = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.attrib["Id"]: r.attrib["Target"] for r in rels
                   if r.attrib.get("TargetMode") != "External"}
        strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            strings = ["".join(t.text or "" for t in e.findall(".//s:t", NS))
                       for e in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        sheets = {}
        for sheet in book.findall("s:sheets/s:sheet", NS):
            target = targets[sheet.attrib[RID]]
            target = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl",target))
            if not target.startswith("xl/worksheets/"):
                raise ValueError("Unexpected worksheet path")
            root = ET.fromstring(z.read(target))
            rows = root.findall("s:sheetData/s:row", NS)
            populated = [r for r in rows if any(c.find("s:v", NS) is not None or c.find("s:is", NS) is not None for c in r)]
            # Only the first populated row is inspected for possible schema labels.
            # Do not emit later measurement rows or formula values.
            labels = []
            if populated:
                for c in populated[0].findall("s:c", NS):
                    v = c.find("s:v", NS)
                    if c.attrib.get("t") == "s" and v is not None:
                        labels.append({"cell":c.attrib["r"],"text":strings[int(v.text)]})
                    elif c.attrib.get("t") == "inlineStr":
                        labels.append({"cell":c.attrib["r"],"text":"".join(t.text or "" for t in c.findall(".//s:t",NS))})
            sheets[sheet.attrib["name"]] = {"populated_rows_including_headers":len(populated),
                "first_row_text_candidates":labels,
                "formula_cells":len(root.findall(".//s:f",NS))}
        if not {"Data","Summary"} <= sheets.keys():
            raise ValueError("Expected Data and Summary sheets not found")
        return sheets

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-dir",type=pathlib.Path,default=pathlib.Path("data/nist-lpbf/supplemental"))
    p.add_argument("--output",type=pathlib.Path,required=True)
    args = p.parse_args()
    args.source_dir.mkdir(parents=True,exist_ok=True)
    spec = importlib.util.spec_from_file_location("fetch_nist",pathlib.Path(__file__).with_name("fetch-nist-lpbf-measurements.py"))
    fetch = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fetch)
    sources = {}
    for name in (WORKBOOK,README):
        size,digest = fetch.download(BASE+name,args.source_dir/name)
        sources[name] = {"url":BASE+name,"bytes":size,"sha256":digest}
    readme = (args.source_dir/README).read_text(encoding="utf-8-sig")
    if DOI not in readme or "IN718" not in readme or "IN625" not in readme:
        raise ValueError("Unexpected supplemental source identity")
    result = {"schema":"orientai.nist-supplemental-inventory.v1","catalog_doi":DOI,
        "sources":sources,"sheets":inspect_workbook(args.source_dir/WORKBOOK),
        "citation_discrepancy_2716_present":"10.18434/mds2-2716" in readme,
        "training_ready":False,"independence_verified":False,
        "note":"Schema inventory only; first-row strings are unverified header candidates, not normalized measurements."}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__ == "__main__":
    main()

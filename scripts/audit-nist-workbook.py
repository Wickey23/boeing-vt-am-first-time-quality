#!/usr/bin/env python3
"""Read the original AMB2022-03 workbook into traceable measurements, never labels."""
import argparse
import collections
import hashlib
import json
import math
import pathlib
import xml.etree.ElementTree as ET
import zipfile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
HEADERS = ["Sample", "Part No.", "Position (mm)", "Case and Line No.",
           "Velocity (mm/s)", "Power (W)", "Beam diameter (gauss, avg) (µm)",
           "Depth (µm)", "Width (µm)", "Overlap Depth (µm)", "Overlap Width (µm)"]
FIELDS = {"C": ("position_mm", 1), "E": ("speed_mm_s", 1), "F": ("power_w", 1),
          "G": ("beam_diameter_mm", .001), "H": ("measured_depth_mm", .001),
          "I": ("measured_width_mm", .001), "J": ("overlap_depth_mm", .001),
          "K": ("overlap_width_mm", .001)}

def normalize(cells, row, digest):
    if any(not cells.get(c) for c in ("A", "B", "D")):
        raise ValueError(f"Missing measurement identity at row {row}")
    record = {"source_sha256": digest, "source_doi": "10.18434/mds2-2718",
              "sheet": "Sheet1", "source_row": row, "sample_id": cells["A"],
              "part_id": cells["B"], "case_line_id": cells["D"],
              "build_id": None, "machine": None, "defect_label": None,
              "material": "IN718", "raw_cells": cells}
    for column, (field, factor) in FIELDS.items():
        value = cells.get(column)
        if value in (None, "", "N/A"):
            record[field] = None
        else:
            number = float(value)
            if not math.isfinite(number):
                raise ValueError(f"Nonfinite measurement at {column}{row}")
            record[field] = number * factor
    return record

def audit(path):
    original = path.read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    with zipfile.ZipFile(path) as archive:
        if sum(i.file_size for i in archive.infolist()) > 80 * 1024 * 1024:
            raise ValueError("Workbook decompression limit exceeded")
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        names = [s.attrib["name"] for s in workbook.findall("s:sheets/s:sheet", NS)]
        if names != ["Sheet1"]:
            raise ValueError("Workbook sheet layout changed; review source before parsing")
        strings = ["".join(t.text or "" for t in item.findall(".//s:t", NS))
                   for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall("s:sheetData/s:row", NS):
            cells = {}
            for cell in row.findall("s:c", NS):
                if cell.find("s:f", NS) is not None:
                    raise ValueError("Unexpected formula: source measurement review required")
                value = cell.find("s:v", NS)
                if value is not None:
                    cells[''.join(filter(str.isalpha, cell.attrib['r']))] = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
            if cells:
                rows.append((int(row.attrib['r']), cells))
    if not rows or [rows[0][1].get(c) for c in 'ABCDEFGHIJK'] != HEADERS:
        raise ValueError("Measurement headers or units changed; review source before parsing")
    measurements = [normalize(cells, row, digest) for row, cells in rows[1:]]
    return {"schema": "orientai.nist-measurements.v1", "source_sha256": digest,
            "source_file": path.name, "measurement_count": len(measurements),
            "sample_counts": dict(collections.Counter(r['sample_id'] for r in measurements)),
            "training_ready": False, "blockers": ["Physical build independence is not verified from sample names", "Measurement uncertainty and experimental procedure need source review", "No independently assigned defect labels"],
            "measurements": measurements}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = audit(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'measurements'}))

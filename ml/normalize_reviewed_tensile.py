#!/usr/bin/env python3
"""Convert reviewed NIST specimen table into an explicitly mapped experimental CSV.

Never infers angles, mechanical property definitions, studies or scan strategies.
The operator must supply a mapping file, and the result remains pending review.
"""
import argparse,csv,hashlib,json,math
from pathlib import Path

FIELDS=["study_id","specimen_id","material","process_profile_id","build_angle_deg","yield_strength_mpa"]
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--source",required=True,type=Path)
 p.add_argument("--mapping",required=True,type=Path)
 p.add_argument("--output",required=True,type=Path)
 args=p.parse_args()
 spec=json.loads(args.mapping.read_text())
 if not isinstance(spec,dict) or not isinstance(spec.get("columns"),dict):
  raise ValueError("Mapping JSON must contain a columns dictionary")
 if set(spec["columns"])!=set(FIELDS):raise ValueError("Map all and only six required fields")
 if not spec.get("reviewed_by") or not spec.get("source_citation") or not spec.get("angle_definition"):
  raise ValueError("Set reviewed_by, source_citation and angle_definition")
 if "tensile" not in spec["angle_definition"].lower() or "build" not in spec["angle_definition"].lower():
  raise ValueError("Explicitly document tensile-axis/build-direction convention")
 if "yield" not in str(spec.get("property_definition","")).lower():
  raise ValueError("Explicitly document measured yield definition and units")
 if args.source.suffix.lower()!=".csv":raise ValueError("Export the reviewed source sheet to CSV first, preserving original headers")
 with args.source.open(newline="",encoding="utf-8-sig") as f:
  reader=csv.DictReader(f);headers=reader.fieldnames or []
  for name,value in spec["columns"].items():
   if not isinstance(value,str) or value not in headers:raise ValueError("Column not found for "+name+": "+str(value))
  rows=[]
  for idx,r in enumerate(reader,2):
   out={key:str(r[spec["columns"][key]]).strip() for key in FIELDS}
   if not all(out.values()):raise ValueError("Missing specimen measurement in source row "+str(idx))
   angle=float(out["build_angle_deg"]);strength=float(out["yield_strength_mpa"])
   if not math.isfinite(angle) or not 0<=angle<=180 or not math.isfinite(strength) or strength<=0:
    raise ValueError("Invalid angle or measured strength at row "+str(idx))
   rows.append(out)
 if not rows:raise ValueError("No measurements")
 keys=[(r["study_id"],r["specimen_id"]) for r in rows]
 if len(set(keys))!=len(keys):raise ValueError("Repeated study/specimen identifier")
 args.output.parent.mkdir(parents=True,exist_ok=True)
 with args.output.open("w",newline="",encoding="utf-8") as f:
  writer=csv.DictWriter(f,fieldnames=FIELDS);writer.writeheader();writer.writerows(rows)
 meta={"status":"PENDING_INDEPENDENT_PROVENANCE_REVIEW","input_sha256":hashlib.sha256(args.source.read_bytes()).hexdigest(),"mapping_sha256":hashlib.sha256(args.mapping.read_bytes()).hexdigest(),"output_sha256":hashlib.sha256(args.output.read_bytes()).hexdigest(),"records":len(rows),"unique_studies":len({r["study_id"] for r in rows}),"source_citation":spec["source_citation"],"angle_definition":spec["angle_definition"],"property_definition":spec["property_definition"],"reviewed_by":spec["reviewed_by"],"note":"One NIST experiment with multiple scan groups is not multiple independent studies. No material allowable or qualification."}
 args.output.with_suffix(".provenance.json").write_text(json.dumps(meta,indent=2)+"\n")
 print(json.dumps(meta,indent=2))
if __name__=="__main__":main()

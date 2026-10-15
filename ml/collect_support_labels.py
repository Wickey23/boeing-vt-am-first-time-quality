#!/usr/bin/env python3
"""Join genuine exported orientation candidates and externally measured slicer labels.
No simulated targets or generated labels.
"""
import argparse,csv,json
from pathlib import Path
FIELDS=["part_id","process_profile_id","build_height_mm","down_facing_area_mm2","support_proxy_mm3","contact_area_mm2","overhang_fraction","part_volume_mm3","surface_area_mm2","target_support_volume_mm3"]
def run(manifest:Path,labels:Path,out:Path):
 entries=json.loads(manifest.read_text())
 if not isinstance(entries,list):raise ValueError("Manifest must be a list of evidence JSON paths and part metadata")
 with labels.open(newline="") as f: observations=list(csv.DictReader(f))
 indexes={}
 for row in observations:
  key=(row["part_id"],row["candidate_id"],row["process_profile_id"])
  if key in indexes:raise ValueError("Duplicate slicer label: "+str(key))
  indexes[key]=row
 rows=[]
 for entry in entries:
  evidence=json.loads(Path(entry["evidence_path"]).read_text())
  if evidence.get("qualification") not in ("RESEARCH_ONLY","NOT_APPROVED") and not evidence.get("algorithm"): raise ValueError("Invalid orientation evidence")
  volume=float(entry["part_volume_mm3"]);surface=float(entry["surface_area_mm2"])
  if volume<=0 or surface<=0:raise ValueError("Geometry properties must be positive")
  for c in evidence["candidates"]:
   key=(entry["part_id"],c["id"],entry["process_profile_id"])
   if key not in indexes:continue
   measured=float(indexes[key]["target_support_volume_mm3"])
   if measured<0:raise ValueError("Negative slicer volume")
   rows.append(dict(zip(FIELDS,[key[0],key[2],c["buildHeightMm"],c["downFacingAreaMm2"],c["supportProxyMm3"],c["contactAreaMm2"],c["overhangFraction"],volume,surface,measured])))
 if not rows:raise ValueError("No labels joined; check IDs and profiles")
 out.parent.mkdir(parents=True,exist_ok=True)
 with out.open("w",newline="") as f:
  w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
 print(f"Joined {len(rows)} real slicer observations to {len(set(x['part_id'] for x in rows))} parts; no labels fabricated.")
if __name__=="__main__":
 a=argparse.ArgumentParser();a.add_argument("--manifest",required=True,type=Path);a.add_argument("--labels",required=True,type=Path);a.add_argument("--out",default="ml/data/measured_support.csv",type=Path);p=a.parse_args();run(p.manifest,p.labels,p.out)

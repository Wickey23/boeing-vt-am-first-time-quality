#!/usr/bin/env python3
"""Download and audit original NIST AM Bench MaTTO files without inventing ML labels.
Does not modify the support-volume training dataset. Requires outbound internet.
"""
import hashlib,json,zipfile,io,urllib.request,pathlib
SOURCES={
 "matto_answers":"https://data.nist.gov/od/ds/mds2-2588/ANSWERS%20Macroscale_CHAL-AMB2022-04-MaTTO.zip",
 "matto_archive":"https://data.nist.gov/od/ds/ark:/88434/mds2-2588/Macroscale_CHAL-AMB2022-04-MaTTO.zip"
}
def main():
 base=pathlib.Path("ml/data/nist_audit");base.mkdir(parents=True,exist_ok=True)
 report={"dataset":"NIST AM Bench 2022 MaTTO mds2-2588","purpose":"Experimental IN625 tensile research only; not support volume labels","sources":[]}
 for name,url in SOURCES.items():
  rec={"name":name,"url":url}
  try:
   req=urllib.request.Request(url,headers={"User-Agent":"ORIENTAI VT Research Dataset Audit 1.0"})
   with urllib.request.urlopen(req,timeout=60) as response:
    data=response.read(150*1024*1024+1)
   if len(data)>150*1024*1024:raise ValueError("Dataset exceeded 150 MB audit limit")
   if not zipfile.is_zipfile(io.BytesIO(data)):raise ValueError("Response not a ZIP file")
   with zipfile.ZipFile(io.BytesIO(data)) as z:
    rec["files"]=[{"name":item.filename,"size":item.file_size} for item in z.infolist() if not item.is_dir()]
    if sum(x["size"] for x in rec["files"])>800*1024*1024:raise ValueError("Expanded archive exceeds audit limits")
   (base/(name+".zip")).write_bytes(data)
   rec.update(status="downloaded",size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
  except Exception as ex:rec.update(status="failed",error=str(ex)[:300])
  report["sources"].append(rec)
 (base/"inventory.json").write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
 if all(r["status"]!="downloaded" for r in report["sources"]):raise SystemExit("No public NIST archives downloaded")
if __name__=="__main__":main()

/// <reference lib="webworker" />
import {slicePhysicalStl,type PhysicalSliceResult,type SliceOptions} from "../lib/lpbf-physical-slicer";
import {parsePhysicalScanCsv} from "../lib/lpbf-physical-schedule";
import type {PhysicalScanPlan} from "../lib/lpbf-physical-schedule";
import {registerPhysicalScanToSlices,type RegisteredPhysicalScan} from "../lib/lpbf-slice-registration";

type Request={
 part:ArrayBuffer;partSha256:string;options:SliceOptions;
 scanCsv?:ArrayBuffer;scanFileName?:string;
};
type Response=
 |{type:"result";partSha256:string;result:PhysicalSliceResult;registration:RegisteredPhysicalScan|null;scanPlan:PhysicalScanPlan|null}
 |{type:"error";error:string};

self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  const {part,partSha256,options,scanCsv,scanFileName}=event.data;
  if(!/^[a-f0-9]{64}$/.test(partSha256))
   throw Error("STL source identity is required before local physical slicing.");
  const result=await slicePhysicalStl(part,options);
  if(result.partSha256!==partSha256)
   throw Error("Uploaded STL changed during physical slice preflight. Reconfirm units and rerun.");
  let registration:RegisteredPhysicalScan|null=null;
  let scanPlan:PhysicalScanPlan|null=null;
  if(scanCsv){
   if(scanCsv.byteLength<1||scanCsv.byteLength>256*1024)
    throw Error("The optional physical scan CSV must be 1–256 KB.");
   const sourceHash=await crypto.subtle.digest("SHA-256",scanCsv);
   const scanSourceSha256=Array.from(new Uint8Array(sourceHash),x=>x.toString(16).padStart(2,"0")).join("");
   const csv=new TextDecoder("utf-8",{fatal:true}).decode(scanCsv);
   const parsed=parsePhysicalScanCsv(csv,scanFileName||"physical-scan.csv");
   registration=registerPhysicalScanToSlices({slices:result,scan:parsed,scanSourceSha256});
   scanPlan=parsed;
  }
  const output:Response={type:"result",partSha256,result,registration,scanPlan};
  self.postMessage(output);
 }catch(e){
  const output:Response={type:"error",error:e instanceof Error?e.message:"Local physical STL slice preflight failed."};
  self.postMessage(output);
 }
};

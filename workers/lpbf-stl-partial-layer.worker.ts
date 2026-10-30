/// <reference lib="webworker" />
import {slicePhysicalStl,type SliceOptions} from "../lib/lpbf-physical-slicer";
import {parsePhysicalScanCsv} from "../lib/lpbf-physical-schedule";
import {registerPhysicalScanToSlices} from "../lib/lpbf-slice-registration";
import {buildStlPartialLayerInputs,type ResearchMaterial} from "../lib/lpbf-stl-partial-layer";
import {runPartialLayerResearch} from "../lib/lpbf-partial-layer";

type Input={
 approved:true;part:ArrayBuffer;scanCsv:ArrayBuffer;
 partSha256:string;scanSha256:string;
 scanName:string;options:SliceOptions;material:ResearchMaterial;
};
const sha=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),x=>x.toString(16).padStart(2,"0")).join("");
const progress=(stage:"slice"|"register"|"integrate",done:number,total:number)=>
 self.postMessage({type:"progress",stage,done,total});

self.onmessage=async(event:MessageEvent<Input>)=>{
 try{
  const a=event.data;
  if(a?.approved!==true||!/^[0-9a-f]{64}$/.test(a.partSha256)||!/^[0-9a-f]{64}$/.test(a.scanSha256))
   throw Error("Engineer approval and both exact SHA-256 identities are required before solver execution.");
  if(a.part.byteLength>8*1024*1024||a.scanCsv.byteLength>256*1024)
   throw Error("Research solver data exceeds input safety bounds.");
  progress("slice",0,1);
  const slices=await slicePhysicalStl(a.part,a.options);
  if(slices.partSha256!==a.partSha256)throw Error("STL source changed since approved preflight.");
  progress("slice",1,1);
  if(await sha(a.scanCsv)!==a.scanSha256)throw Error("Physical scan CSV source changed since approved preflight.");
  const scan=parsePhysicalScanCsv(new TextDecoder("utf-8",{fatal:true}).decode(a.scanCsv),a.scanName);
  progress("register",0,1);
  const registration=registerPhysicalScanToSlices({slices,scan,scanSourceSha256:a.scanSha256});
  const input=buildStlPartialLayerInputs({slices,scan,registration,material:a.material});
  progress("register",1,1);
  const result=runPartialLayerResearch(input,(done,total)=>progress("integrate",done,total));
  self.postMessage({type:"result",result,geometry:{
   version:slices.version,layerCount:slices.grid.physicalLayers,
   sampledVolumeDifference:slices.geometry.relativeVolumeDifference,
   sourceSha256:slices.partSha256,scanSha256:a.scanSha256,
   source:"real-STL-full-occupied-cell-only"}});
 }catch(e){
  self.postMessage({type:"error",error:e instanceof Error?e.message:"M06 research study failed without publishing results."});
 }
};

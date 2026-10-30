/// <reference lib="webworker" />
/** Independent, local metal-build preparation worker. Never transmits geometry. */
import {assessMetalBuildEdit,exportMetalBuildStl,suggestMetalBuildEdits,
 type BuildEdit,type BuildEnvelope} from "../lib/metal-build-edit";

type Request={
 type:"preview"|"export";
 source:ArrayBuffer;sourceSha256:string;
 scale:number;recipe:BuildEdit;envelope:BuildEnvelope;
};
const hash=async(b:ArrayBuffer)=>Array.from(
 new Uint8Array(await crypto.subtle.digest("SHA-256",b)),
 x=>x.toString(16).padStart(2,"0")).join("");

self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  const r=event.data;
  if(!r||!/^[a-f0-9]{64}$/.test(r.sourceSha256))
   throw Error("An approved original STL SHA-256 is required.");
  if(await hash(r.source)!==r.sourceSha256)
   throw Error("Original STL bytes no longer match the selected part; the edit was rejected.");
  if(r.type==="preview"){
   const assessment=await assessMetalBuildEdit(r.source,r.scale,r.recipe,r.envelope);
   const suggestions=await suggestMetalBuildEdits(r.source,r.scale,r.recipe,r.envelope,assessment);
   self.postMessage({type:"preview",assessment,suggestions});
  }else if(r.type==="export"){
   const output=await exportMetalBuildStl(r.source,r.scale,r.recipe,r.envelope);
   self.postMessage({type:"export",output});
  }else throw Error("Unsupported metal editor operation.");
 }catch(e){
  self.postMessage({type:"error",error:e instanceof Error?e.message:"Metal build edit operation failed."});
 }
};

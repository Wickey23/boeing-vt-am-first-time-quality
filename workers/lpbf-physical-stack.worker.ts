/// <reference lib="webworker" />
import {parsePhysicalScanCsv} from "../lib/lpbf-physical-schedule";
import {simulatePhysicalLayerStack,type PhysicalStackResult} from "../lib/lpbf-physical-stack";
import type {MovingInputs} from "../lib/lpbf-moving-source";
type Request={
 part:ArrayBuffer;scan:ArrayBuffer;partSha256:string;sourceSha256:string;
 unitScale:number;sourceName:string;inputs:MovingInputs;
};
const sha256=async(data:ArrayBuffer)=>Array.from(new Uint8Array(
 await crypto.subtle.digest("SHA-256",data)
),v=>v.toString(16).padStart(2,"0")).join("");
self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  const {part,scan,partSha256,sourceSha256,unitScale,sourceName,inputs}=event.data;
  if(part.byteLength>2*1024*1024||scan.byteLength>256*1024||
     !/^[a-f0-9]{64}$/.test(partSha256)||!/^[a-f0-9]{64}$/.test(sourceSha256))
   throw Error("Invalid study file sizes or source hashes.");
  const [partHash,scanHash]=await Promise.all([sha256(part),sha256(scan)]);
  if(partHash!==partSha256||scanHash!==sourceSha256)
   throw Error("Part or physical scan CSV changed after the approved chronology audit. Rerun audit.");
  const plan=parsePhysicalScanCsv(new TextDecoder("utf-8",{fatal:true}).decode(scan),sourceName);
  const result:PhysicalStackResult=simulatePhysicalLayerStack({
   part,plan,partSha256,sourceSha256,unitScale,inputs,
   onProgress:(done,total)=>self.postMessage({type:"progress",partSha256,done,total})
  });
  self.postMessage({type:"result",partSha256,sourceSha256,result});
 }catch(e){
  self.postMessage({type:"error",error:e instanceof Error?e.message:"Physical-layer research solve failed."});
 }
};

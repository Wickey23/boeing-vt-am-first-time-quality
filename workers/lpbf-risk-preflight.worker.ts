/// <reference lib="webworker" />
/** Local deterministic STL preflight. Never uploads model geometry or forwards it to ARC. */
import {screenLpbfPreflight,type Axis3} from "../lib/lpbf-risk-preflight";
type Request={source:ArrayBuffer;sourceSha256:string;unitScaleToMm:number;
 rotationDeg:Axis3;envelopeMm:Axis3;overhangThresholdDeg:number};
const sha=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),
 x=>x.toString(16).padStart(2,"0")).join("");
self.onmessage=async(e:MessageEvent<Request>)=>{
 try{
  const input=e.data;
  if(!input||typeof input.sourceSha256!=="string"||!/^[a-f0-9]{64}$/.test(input.sourceSha256))
   throw Error("A known STL identity is required.");
  if(await sha(input.source)!==input.sourceSha256)
   throw Error("The uploaded STL hash has changed; geometric preflight was discarded.");
  const result=screenLpbfPreflight(input.source,input.unitScaleToMm,input.rotationDeg,
   input.envelopeMm,input.overhangThresholdDeg,input.sourceSha256);
  self.postMessage({type:"result",result});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"The local preflight failed."});
 }
};

/// <reference lib="webworker" />
import {voxelizePart} from "../lib/voxel-thermal";
import {parsePhysicalScanCsv,auditPhysicalScanPlan} from "../lib/lpbf-physical-schedule";
type Request={
 part:ArrayBuffer;csv:ArrayBuffer;partSha256:string;
 fileName:string;unitScale:number;voxelResolution:number;
 nominalLayerThicknessMm:number;
};
const sha256=async(buffer:ArrayBuffer)=>Array.from(
 new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)),
 n=>n.toString(16).padStart(2,"0")).join("");
self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  const {part,csv,partSha256,fileName,unitScale,voxelResolution,
   nominalLayerThicknessMm}=event.data;
  if(!/^[0-9a-f]{64}$/.test(partSha256)||part.byteLength>2*1024*1024||
     csv.byteLength>256*1024||csv.byteLength===0)
   throw Error("Invalid STL identity or imported file size.");
  const hash=await sha256(part);
  if(hash!==partSha256)throw Error("STL SHA-256 changed since approved thermal research study.");
  const csvHash=await sha256(csv);
  const utf8=new TextDecoder("utf-8",{fatal:true}).decode(csv);
  const parsed=parsePhysicalScanCsv(utf8,fileName);
  const m=voxelizePart(part,{x:0,y:0,z:0},unitScale,voxelResolution);
  const zs=[...new Set(m.cells.map(c=>c[2]))].sort((a,b)=>a-b);
  if(zs.length<2||m.cells.length>5000||m.vertices.length>6000)
   throw Error("Physical scan audit needs a bounded, closed, supported STL voxel mesh.");
  const b=m.box;
  const audit=auditPhysicalScanPlan(parsed,{
   sourceSha256:csvHash,partSha256,
   geometry:{minX:b.min.x,maxX:b.max.x,minY:b.min.y,maxY:b.max.y,minZ:b.min.z,maxZ:b.max.z},
   physicalLayerThicknessMm:nominalLayerThicknessMm,
   thermalVoxelWidthMm:m.h,occupiedVoxelZIndices:zs
  });
  self.postMessage({type:"result",partSha256,sourceSha256:csvHash,audit});
 }catch(e){
  self.postMessage({type:"error",error:e instanceof Error?e.message:"Physical scan preflight failed."});
 }
};

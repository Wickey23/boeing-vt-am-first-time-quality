/// <reference lib="webworker" />
import {simulateMovingSource,validateMovingInputs,type MovingInputs} from "../lib/lpbf-moving-source";
import type {LpbfProbePoint,LpbfResult} from "../lib/lpbf-transient";
import type {ScanPlan} from "../lib/lpbf-scan-plan";
type Request={
 file:ArrayBuffer;partHash:string;unitScale:number;inputs:MovingInputs;
 baseline:LpbfResult;scanPlan?:ScanPlan;probePoint:LpbfProbePoint;
};
self.onmessage=async(event:MessageEvent<Request>)=>{
 try{
  const {file,partHash,unitScale,inputs,baseline,scanPlan,probePoint}=event.data;
  if(!/^[0-9a-f]{64}$/.test(partHash))throw Error("Invalid active STL SHA-256.");
  const digest=await crypto.subtle.digest("SHA-256",file);
  const actual=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
  if(actual!==partHash)throw Error("Thermal probe STL differs from approved baseline part.");
  validateMovingInputs(inputs);
  if(baseline.engine!==(scanPlan?"lpbf-imported-enthalpy-0.1":"lpbf-raster-enthalpy-0.1"))
   throw Error("Thermal probe mode does not match approved baseline.");
  for(const [key,value] of Object.entries(baseline.inputs)){
   if((inputs as unknown as Record<string,number>)[key]!==value)
    throw Error("Thermal probe inputs changed after baseline approval: "+key);
  }
  if((baseline.scanPlan?.sha256??null)!==(scanPlan?.sha256??null))
   throw Error("Thermal probe scan plan SHA-256 differs from approved baseline.");
  const output=simulateMovingSource(file,unitScale,inputs,
   (done,total)=>self.postMessage({type:"progress",partHash,done,total}),
   scanPlan,1,probePoint);
  if(!output.probe)throw Error("No voxel probe returned.");
  self.postMessage({type:"result",partHash,engine:output.engine,
   probe:output.probe,layerMapping:output.layerMapping,summary:output.summary});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"LPBF thermal probe failed."});
 }
};

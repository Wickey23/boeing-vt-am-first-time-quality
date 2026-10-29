/// <reference lib="webworker" />
import {simulateLpbfTransient,validateLpbfInputs,type LpbfInputs} from "../lib/lpbf-transient";

import {simulateMovingSource,validateMovingInputs,type MovingInputs} from "../lib/lpbf-moving-source";
import {type ScanPlan} from "../lib/lpbf-scan-plan";
type Request={file:ArrayBuffer;unitScale:number;inputs:LpbfInputs|MovingInputs;partHash:string;mode?:"uniform"|"moving"|"imported";scanPlan?:ScanPlan};
self.onmessage=(event:MessageEvent<Request>)=>{
 try{
  const {file,unitScale,inputs,partHash,mode="uniform",scanPlan}=event.data;
  if(!/^[a-f0-9]{64}$/.test(partHash))throw Error("Invalid part identity.");
  if(mode!=="uniform"&&mode!=="moving"&&mode!=="imported")throw Error("Unknown thermal research mode.");
  if(mode==="imported"&&!scanPlan)throw Error("Imported thermal mode requires a reviewed CSV scan plan.");
  if(mode==="moving"||mode==="imported")validateMovingInputs(inputs as MovingInputs);else validateLpbfInputs(inputs);
  const progress=(done:number,total:number)=>{
   self.postMessage({type:"progress",done,total,partHash});
  };
  const result=mode==="moving"||mode==="imported"?simulateMovingSource(file,unitScale,inputs as MovingInputs,progress,mode==="imported"?scanPlan:undefined):
   simulateLpbfTransient(file,unitScale,inputs,progress);
  self.postMessage({type:"result",result,partHash});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"LPBF transient solve failed"});
 }
};

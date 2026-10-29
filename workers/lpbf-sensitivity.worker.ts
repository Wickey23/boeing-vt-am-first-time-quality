/// <reference lib="webworker" />
import {runLpbfSensitivity,type SensitivityStudy} from "../lib/lpbf-sensitivity";
import {validateMovingInputs,type MovingInputs} from "../lib/lpbf-moving-source";
import type {LpbfResult} from "../lib/lpbf-transient";
import type {ScanPlan} from "../lib/lpbf-scan-plan";
type Payload={
 file:ArrayBuffer;unitScale:number;partHash:string;
 inputs:MovingInputs;baseline:LpbfResult;scanPlan?:ScanPlan;
};
self.onmessage=(event:MessageEvent<Payload>)=>{
 try{
  const {file,unitScale,partHash,inputs,baseline,scanPlan}=event.data;
  if(!/^[a-f0-9]{64}$/.test(partHash))throw Error("Invalid part identity.");
  validateMovingInputs(inputs);
  const result:SensitivityStudy=runLpbfSensitivity(file,unitScale,inputs,baseline,scanPlan,
   (stage,done,total)=>self.postMessage({type:"progress",partHash,stage,done,total}));
  self.postMessage({type:"result",partHash,result});
 }catch(error){
  self.postMessage({type:"error",error:error instanceof Error?error.message:"Numerical sensitivity failed."});
 }
};
